// The section's geometry (js/section.js, and js/seismic.js's lines and horizons) against the data files, in
// Node: Norne Reservoir's test (plan 0012, package 3.4) carried to Volve, whose deck names no formations.
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
//  4. the survey's own lines (plan 0012 D14): every inline and crossline runs the cube end to end, A at its
//     west end, on the traces themselves; the Hugin horizons along a line are the file's own values at
//     its nodes and nothing where a node holds no pick; the axis shows exactly the depths it is given;
//  5. the wells near the line: every path point within the corridor and between A and A′ is drawn,
//     and every drawn point is within it;
//  6. the axis: one scale for distance, the same times the stretch for depth, the section inside the
//     box, and the ticks written in SI notation with the unit on the last;
//  7. the cost of a cut, as a trend (Node on this Mac, never phone evidence);
//  8. the sweep (2.3, plan 0012 D14): Along sweeps the grid's columns (I) and Across its rows (J), each
//     field line in its place among them; every slice's section holds exactly that slice's active cells
//     (none missed, none from another), each a quad between its own corners' depths, on one path whose
//     distances run from 0 to its length, A at its west end;
//     a drawn line's steps are square to it, one slice wide; the wells near a slice's path lie within
//     the corridor of it; and the own stretch: never under the 3D view's, a round figure, the section
//     inside its box at it, and the 3D view's where the box has no more room.
//  9. the zoom and the axes' lock (1.2, plan 0012 D18, D19): slicePaths the paths sliceSection draws; the common
//     distance of the inlines and the crosslines (from the survey's edge), of Along's and Across's families (each
//     start where it lies, a slice that runs against the line laid the other way) and of a drawn line's steps;
//     the field's window and the seismic's margin inside the cube; a view's zoom, move, limits, kept section and
//     stretch; the ticks of a zoomed and a locked axis within the plot and the data; five locked sweep steps on
//     one scale, the data moving; the zoom's limit from the cells' thickness.

import fs from 'node:fs';
import * as U from '../js/units.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cutGrid, wellsNear, fieldLines, sectionAxis, depthTicks, distanceTicks, lineOf, columns, sweepAxis, slices, slot, sliceSection, shifts, lineAt, wellsNearPath, ownExag, STRETCHES, slicePaths, commonFrame, fieldDepths, readableScale, fitWindow, viewOfAxis, viewAxis, zoomAt, panBy, keepIn, restretch, fillStretch } from '../js/section.js';
import { grid, xyOf, uvOf, surveyLine, surveyNumbers, nearestNumber, horizonAt } from '../js/seismic.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const model = JSON.parse(fs.readFileSync(path.join(APP, 'data/model.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'config.json'), 'utf8'));
const buf = (f) => { const b = fs.readFileSync(path.join(APP, 'data', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const geom = new Float32Array(buf('geometry.bin')), ijk = new Uint8Array(buf('ijk.bin')), NA = model.NA;
const tops = null;   // Volve's deck names no formations: no tops are cut
void cfg;
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
let polys = 0, worst = [], convexBad = 0, dup = 0, outS = 0, outZ = 0, flat = 0, msSum = 0;
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
}
ok(dup === 0 && outS === 0 && outZ === 0 && convexBad === 0 && flat === 0 && polys > 3000,
  `${tests.length} lines, ${polys} polygons: every one inside its line (${outS} points outside), between its own cell's shallowest and deepest corner (${outZ} outside), convex (${convexBad} not${worst.length ? ': ' + worst.slice(0, 3).join(', ') : ''}), with area (${flat} flat); no cell twice (${dup} lines with one)`);

// 4. the survey's own lines, the horizons along a line, the axis's window
{
  const meta = JSON.parse(fs.readFileSync(path.join(APP, 'data/seismic.json'), 'utf8')), g = grid(meta, model.center);
  const hz = new Float32Array(buf('horizons.bin'));
  let bad = 0, n = 0;
  for (const kind of ['inline', 'crossline']) for (const num of surveyNumbers(g, kind)) {
    const l = surveyLine(g, kind, num), L = Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]), want = 25 * ((kind === 'inline' ? g.nv : g.nu) - 1);
    const [ua, va] = uvOf(g, ...l.a), [ub, vb] = uvOf(g, ...l.b), on = kind === 'inline' ? [ua, ub] : [va, vb];
    n++;
    if (l.a[0] > l.b[0] + 1e-6 || Math.abs(L - want) > 0.05 || on.some((v) => Math.abs(v - Math.round(v)) > 1e-6) || nearestNumber(g, kind, (l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2) !== num) bad++;
  }
  const il = surveyLine(g, 'inline', 10174), sec = cutGrid(geom, NA, ijk, il.a, il.b, null);
  ok(bad === 0 && n === g.nu + g.nv && sec.n > 1000,
    `the survey's lines: ${g.nu} inlines and ${g.nv} crosslines, each end to end over the cube (${25 * (g.nv - 1)} and ${25 * (g.nu - 1)} m), A at its west end, on its own traces, and found again as the line nearest its middle (${bad} not); inline 10174 cuts ${sec.n} cells`);
  // the horizons at the nodes are the file's values; between nodes, inside the four around; NaN beside a node with no pick
  let node = 0, between = 0, nanOk = 0, nanN = 0;
  for (let t = 0; t < 3000; t++) {
    const u = Math.floor(rnd() * (g.nu - 1)), v = Math.floor(rnd() * (g.nv - 1)), w = t % 2, at = (i, j) => hz[w * g.nu * g.nv + i * g.nv + j];
    const [x, y] = xyOf(g, u, v), h = horizonAt(g, hz, w, x, y);
    if (!(at(u, v) !== at(u, v) ? h !== h : Math.abs(h - at(u, v)) < 1e-3)) node++;
    const fu = rnd(), fv = rnd(), [x2, y2] = xyOf(g, u + fu, v + fv), h2 = horizonAt(g, hz, w, x2, y2), four = [at(u, v), at(u + 1, v), at(u, v + 1), at(u + 1, v + 1)];
    if (four.some((q) => q !== q)) { nanN++; if (h2 !== h2) nanOk++; } else if (h2 < Math.min(...four) - 1e-3 || h2 > Math.max(...four) + 1e-3) between++;
  }
  ok(node === 0 && between === 0 && nanOk === nanN && nanN > 0, `the Hugin top and base along a line: the file's own depth at 3000 nodes (${node} not), bilinear inside the four nodes around a point (${between} outside), and nothing where a node around holds no pick (${nanOk} of ${nanN})`);
  const box = { x: 60, y: 15, w: 300, h: 200 }, win = { top: sec.z0 - 150, bot: sec.z1 + 150 }, ax = sectionAxis(sec, box, 3, model.center[2], win);
  ok(Math.abs(ax.zTop - win.top) < 1e-9 && Math.abs(ax.zBot - win.bot) < 1e-9 && Math.abs(ax.Y(win.top) - ax.y0) < 1e-9 && ax.y1 <= box.y + box.h + 1e-6 && Math.abs(ax.sz / ax.sx - 3) < 1e-9,
    `the axis shows the depths it is given and nothing else: ${(win.top + model.center[2]).toFixed(1)} to ${(win.bot + model.center[2]).toFixed(1)} m below sea level at the plot's top and foot, depth px per meter three times distance's`);
}

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
  ok(missing === 0 && far <= 6, `a plane through a cell's middle (${n} random cells, random bearings): the cell is cut every time (${missing} missed); its polygon holds the middle in ${n - outside}, and in the other ${outside} (warped faces, drawn as chords; Volve's cells are thicker and more warped than Norne's) the middle is at most ${far.toFixed(2)} m off it (bound 6 m: ${(far * 0.19).toFixed(2)} px at the default ×3 on an inline, 0.064 px a meter across)`);
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
  ok(d.length >= 2 && x.length >= 2 && sorted(d, 'y') && sorted(x, 'x') && d.every((t) => fmt(t.text)) && du.every((t) => fmt(t.text))
    && x[0].text === '0' && x[x.length - 1].text.endsWith(`${NN}m`) && xu[xu.length - 1].text.endsWith(`${NN}ft`)
    && d.every((t) => t.y >= ax.y0 - 1e-6 && t.y <= ax.y1 + 1e-6) && x.every((t) => t.x >= ax.x0 - 1e-6 && t.x <= ax.x1 + 1e-6),
  `the ticks: depth ${d.map((t) => t.text).join(' | ')} (the figures alone: the axis's title carries the unit and the datum); distance ${x.map((t) => t.text).join(' | ')}; in US units ${du[du.length - 1].text} and ${xu[xu.length - 1].text}; each inside the section, the unit on the last distance (U+202F)`);
}

// 8. the sweep
{
  const cols = columns(geom, NA, ijk, model.NI, model.NJ);
  const axA = sweepAxis(cols, lines.along.a, lines.along.b), axB = sweepAxis(cols, lines.across.a, lines.across.b);
  const lA = slices(cols, axA), lB = slices(cols, axB), sA = slot(cols, axA, lA, lines.along), sB = slot(cols, axB, lB, lines.across);
  const has = { I: new Set(), J: new Set() };
  for (let c = 0; c < NA; c++) { has.I.add(ijk[c * 3] + 1); has.J.add(ijk[c * 3 + 1] + 1); }
  const square = (l, d) => { const L = lineOf(l.a, l.b); return Math.abs(-L.uy * d[0] + L.ux * d[1]); };
  ok(axA !== axB && square(lines.along, axA === 'I' ? cols.dI : cols.dJ) >= square(lines.along, axA === 'I' ? cols.dJ : cols.dI) && lA.length === has[axA].size && lB.length === has[axB].size && lA.every((v, i) => !i || v.k > lA[i - 1].k) && sA > 0 && sA < lA.length && sB > 0 && sB < lB.length,
    `the sweep's families: Along (at ${lines.along.deg}°) through the ${lA.length} ${axA === 'I' ? 'columns (I)' : 'rows (J)'} with a cell, the field's line between ${axA} ${lA[sA - 1].k} and ${axA} ${lA[sA].k}; Across through the ${lB.length} ${axB === 'I' ? 'columns (I)' : 'rows (J)'}, between ${axB} ${lB[sB - 1].k} and ${axB} ${lB[sB].k}`);
  let foreign = 0, missed = 0, badZ = 0, badS = 0, west = 0, total = 0, topBad2 = 0, ms = 0, worstMs = 0;
  for (const [axis, list] of [[axA, lA], [axB, lB]]) for (const { k } of list) {
    const sec = sliceSection(geom, NA, ijk, axis, k, tops), own = axis === 'I' ? 0 : 1;
    ms += sec.ms; worstMs = Math.max(worstMs, sec.ms);
    let want = 0, pinched = 0;
    for (let c = 0; c < NA; c++) if (ijk[c * 3 + own] === k - 1) { want++; let lo = Infinity, hi = -Infinity; for (let q = 0; q < 4; q++) { lo = Math.min(lo, corner(c, q)[2]); hi = Math.max(hi, corner(c, q + 4)[2]); } if (hi - lo < 1e-3) pinched++; }
    if (sec.n + pinched < want) missed += want - sec.n - pinched;
    for (let i = 0; i < sec.n; i++) {
      const c = sec.cells[i];
      total++;
      if (ijk[c * 3 + own] !== k - 1) foreign++;
      let zlo = Infinity, zhi = -Infinity;
      for (let q = 0; q < 8; q++) { const z = corner(c, q)[2]; zlo = Math.min(zlo, z); zhi = Math.max(zhi, z); }
      for (let q = sec.offs[i]; q < sec.offs[i + 1]; q++) {
        if (sec.pts[q * 2 + 1] < zlo - 1e-3 || sec.pts[q * 2 + 1] > zhi + 1e-3) badZ++;
        if (sec.pts[q * 2] < -1e-3 || sec.pts[q * 2] > sec.line.L + 1e-3) badS++;
      }
    }
    if (sec.line.a[0] > sec.line.b[0] + 1e-6 || Math.abs(sec.line.s[0]) > 1e-9 || Math.abs(sec.line.s[sec.line.s.length - 1] - sec.line.L) > 1e-6) west++;
    for (let i = 0; i < sec.tops.length; i += 4) if (sec.tops[i] > sec.tops[i + 2] || sec.tops[i] < -1e-3 || sec.tops[i + 2] > sec.line.L + 1e-3) topBad2++;
  }
  ok(foreign === 0 && missed === 0 && badZ === 0 && badS === 0 && west === 0 && topBad2 === 0 && total > 300000,
    `${lA.length + lB.length} slices, ${total} blocks: every one its slice's own cell (${foreign} not), no active cell of a slice left out but the pinched-out (${missed} missed), each corner between its cell's own shallowest and deepest (${badZ} not) and on the path (${badS} not); A at the west end, the path's distances 0 to its length (${west} not); a slice cut in ${(ms / (lA.length + lB.length)).toFixed(2)} ms on average, ${worstMs.toFixed(1)} at most (Node, a trend)`);
  // a slice's path: lineAt runs along it, and the wells near it are within the corridor of it
  {
    const sec = sliceSection(geom, NA, ijk, axA, lA[sA].k, tops), ln = sec.line;
    const p0 = lineAt(ln, 0), p1 = lineAt(ln, ln.L), pm = lineAt(ln, ln.s[3]);
    const near = wellsNearPath(model.wells.map((w) => w.path), ln, 150);
    let farPts = 0, pts = 0;
    const dist = (x, y) => { let d = Infinity; for (let g = 1; g < ln.path.length; g++) { const P = ln.path[g - 1], Q = ln.path[g], ex = Q[0] - P[0], ey = Q[1] - P[1], u = Math.max(0, Math.min(1, ((x - P[0]) * ex + (y - P[1]) * ey) / (ex * ex + ey * ey || 1))); d = Math.min(d, Math.hypot(x - P[0] - ex * u, y - P[1] - ey * u)); } return d; };
    for (const w of near) {
      for (const part of w.parts) for (let k = 0; k < part.length; k += 2) { pts++; if (part[k] < -1e-6 || part[k] > ln.L + 1e-6) farPts++; }
      if (w.dmin > 150 + 1e-6) farPts++;
    }
    const truly = model.wells.filter((w) => w.path.some((p) => dist(p[0], p[1]) < 149)).length;
    ok(Math.hypot(p0[0] - ln.path[0][0], p0[1] - ln.path[0][1]) < 1e-6 && Math.hypot(p1[0] - ln.b[0], p1[1] - ln.b[1]) < 1e-6 && Math.hypot(pm[0] - ln.path[3][0], pm[1] - ln.path[3][1]) < 1e-6 && farPts === 0 && near.length >= truly && near.length > 0,
      `${axA === 'I' ? 'column' : 'row'} ${axA} ${lA[sA].k}'s path: lineAt runs it end to end; ${near.length} wells drawn within 150 m of it (${truly} have a path point that near), ${pts} points all on the path's length (${farPts} not)`);
  }
  // a drawn line's steps
  {
    let bad = 0;
    for (let n = 0; n < 20; n++) {
      const th = rnd() * Math.PI, a = [-1500 * Math.cos(th), -1500 * Math.sin(th)], b = [1500 * Math.cos(th), 1500 * Math.sin(th)], h = shifts(cols, a, b), ln = lineOf(a, b);
      if (Math.abs(h.nx * ln.ux + h.ny * ln.uy) > 1e-9 || h.step < 30 || h.step > 100 || h.lo > 0 || h.hi < 0 || h.hi - h.lo < 20) bad++;
    }
    ok(bad === 0, `a drawn line's sweep, 20 bearings: steps square to the line, 30 to 100 m (a slice's width across it), over the field either side (${bad} not)`);
  }
  // the own stretch
  {
    const sec = cutGrid(geom, NA, ijk, lines.along.a, lines.along.b, tops), res = [];
    for (const [w, h, e] of [[312, 64, 5], [312, 300, 5], [312, 600, 5], [600, 100, 5], [312, 300, 12], [312, 64, 7.5]]) {
      const box = { x: 46, y: 15, w, h }, x = ownExag(sec, box, e), ax = sectionAxis(sec, box, x, model.center[2]);
      const inside = ax.y1 <= box.y + box.h + 1e-6 && ax.x1 <= box.x + box.w + 1e-6;
      res.push([x >= e && (x === e || (STRETCHES.includes(x) && x >= e * 1.2)) && inside, `${w} × ${h} at ×${e}: ×${x}${x === e ? '' : `, ${Math.round(ax.y1 - ax.y0)} of ${h} px tall`}`]);
    }
    ok(res.every((r) => r[0]) && res[2][1] !== res[0][1], `the pane's own stretch: never under the 3D view's, a round figure a fifth or more above it, the section inside its box: ${res.map((r) => r[1]).join('; ')}`);
  }
}

// 9. the zoom and the axes' lock (1.2, plan 0012 D18, D19): the window, the common distance and the ticks
{
  const datum = model.center[2], box = { x: 60, y: 15, w: 306, h: 110 }, cols = columns(geom, NA, ijk, model.NI, model.NJ);
  const meta = JSON.parse(fs.readFileSync(path.join(APP, 'data/seismic.json'), 'utf8')), g = grid(meta, model.center);
  // slicePaths: the very paths sliceSection draws, for every slice of both families, in one pass
  {
    let bad = 0, n = 0;
    for (const axis of ['I', 'J']) for (const [k, m] of slicePaths(geom, NA, ijk, axis)) {
      const ln = sliceSection(geom, NA, ijk, axis, k, null).line, P = ln.path;
      n++;
      if (Math.hypot(m.p0[0] - P[0][0], m.p0[1] - P[0][1]) > 1e-9 || Math.hypot(m.p1[0] - P[P.length - 1][0], m.p1[1] - P[P.length - 1][1]) > 1e-9 || Math.abs(m.L - ln.L) > 1e-9) bad++;
    }
    ok(bad === 0 && n === slices(cols, 'I').length + slices(cols, 'J').length, `slicePaths: ${n} slices' paths, ends and lengths those sliceSection draws (${bad} not)`);
  }
  // the common distance of the survey's own lines: straight and parallel, each at its own distance along them
  // from one baseline square to them, which on the survey's grid is its edge, where every one starts
  const survey = (kind) => surveyNumbers(g, kind).map((n) => { const l = surveyLine(g, kind, n); return { key: n, p0: l.a, p1: l.b, L: Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]) }; });
  const fams = {};
  for (const kind of ['inline', 'crossline']) {
    const members = survey(kind), mid = surveyLine(g, kind, nearestNumber(g, kind, 0, 0)), ln = lineOf(mid.a, mid.b), f = commonFrame(members, [ln.ux, ln.uy]);
    let bad = 0, worst = 0;
    for (const m of members) {
      const p = f.at.get(m.key);
      // every point of the line at distance s along it lies at off + s along the family's direction from the baseline
      for (const t of [0, 0.5, 1]) { const q = [m.p0[0] + (m.p1[0] - m.p0[0]) * t, m.p0[1] + (m.p1[1] - m.p0[1]) * t], base = Math.min(...members.map((o) => o.p0[0] * ln.ux + o.p0[1] * ln.uy)); const e = Math.abs(p.off + p.sgn * m.L * t - (q[0] * ln.ux + q[1] * ln.uy - base)); worst = Math.max(worst, e); if (e > 1e-6) bad++; }
      if (p.sgn !== 1) bad++;
    }
    const offs = [...f.at.values()].map((p) => p.off);
    fams[kind] = { f, members, ln };
    ok(bad === 0 && Math.abs(f.L - members[0].L) < 0.05, `the common distance, the ${kind}s: all ${members.length} on one distance from the survey's edge, each point at its own distance along them (worst ${worst.toExponential(1)} m), every start within ${Math.max(...offs).toFixed(3)} m of the edge (the grid is square), the family ${f.L.toFixed(2)} m, the line's own ${members[0].L.toFixed(2)}`);
  }
  // the field's own lines' families (the line and every row or column its sweep goes through); a slice whose path
  // runs against the line is laid with its distance the other way, its start where it lies
  for (const name of ['along', 'across']) {
    const l = lines[name], axis = sweepAxis(cols, l.a, l.b), ln = lineOf(l.a, l.b), members = [{ key: null, p0: l.a, p1: l.b, L: ln.L }];
    for (const [k, m] of slicePaths(geom, NA, ijk, axis)) members.push({ key: k, ...m });
    const f = commonFrame(members, [ln.ux, ln.uy]);
    let bad = 0, lo = Infinity, hi = -Infinity, base = Infinity, against = 0;
    for (const m of members) base = Math.min(base, m.p0[0] * ln.ux + m.p0[1] * ln.uy, m.p1[0] * ln.ux + m.p1[1] * ln.uy);
    for (const m of members) {
      const p = f.at.get(m.key), a = p.off, b = p.off + p.sgn * m.L, way = (m.p1[0] - m.p0[0]) * ln.ux + (m.p1[1] - m.p0[1]) * ln.uy;
      lo = Math.min(lo, a, b); hi = Math.max(hi, a, b);
      // the end nearer the baseline at its own distance along the line (the start running with it, the end against it)
      const near = p.sgn > 0 ? [a, m.p0] : [b, m.p1];
      if (Math.abs(near[0] - (near[1][0] * ln.ux + near[1][1] * ln.uy - base)) > 1e-6 || p.sgn !== (way < 0 ? -1 : 1)) bad++;
      if (p.sgn < 0) against++;
    }
    const p = f.at.get(null);
    for (let i = 0; i <= 10; i++) { const s = ln.L * i / 10, q = [l.a[0] + ln.ux * s, l.a[1] + ln.uy * s]; if (Math.abs(p.off + s - (q[0] * ln.ux + q[1] * ln.uy - base)) > 1e-6) bad++; }
    fams[name] = { f, members, ln, axis };
    ok(bad === 0 && Math.abs(lo) < 1e-9 && Math.abs(hi - f.L) < 1e-9 && f.L >= ln.L,
      `the common distance, ${name[0].toUpperCase()}${name.slice(1)}'s family: ${members.length - 1} ${axis === 'I' ? 'columns' : 'rows'} and the line, each one's end nearer the baseline square to the line at its own distance along it, the line's points exactly, every member inside 0 to ${Math.round(f.L)} m (the line ${Math.round(ln.L)} m); ${against} laid against the line, each the way its own path runs (${bad} not)`);
  }
  {
    const a = [-2000, -900], b = [1800, 1300], h = shifts(cols, a, b), ln = lineOf(a, b), members = [];
    for (let j = h.lo; j <= h.hi; j++) { const d = j * h.step, A = [a[0] + h.nx * d, a[1] + h.ny * d], Bp = [b[0] + h.nx * d, b[1] + h.ny * d]; members.push({ key: j, p0: A, p1: Bp, L: Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) }); }
    const f = commonFrame(members, [ln.ux, ln.uy]);
    ok(Math.abs(f.L - ln.L) < 1e-6 && members.every((m) => Math.abs(f.at.get(m.key).off) < 1e-6), `the common distance, a drawn line's ${members.length} steps: each at 0, the family's length its own ${Math.round(ln.L)} m (${Math.round(f.L)})`);
  }
  // the field's window: every active cell's depths, padded as a section's, and unpadded for the seismic's margin
  const win = fieldDepths(geom, NA);
  {
    let z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < NA * 8; i++) { z0 = Math.min(z0, geom[i * 3 + 2]); z1 = Math.max(z1, geom[i * 3 + 2]); }
    const pad = Math.max(10, (z1 - z0) * 0.04), L = fams.inline.f.L, v = fitWindow(L, win.z0 - 150, win.z1 + 150, box, 3), ax = viewAxis({ line: { L } }, box, v, datum);
    const cubeTop = g.z0 - datum, cubeBot = g.z0 + (g.nz - 1) * g.dz - datum;
    ok(win.z0 === z0 && win.z1 === z1 && Math.abs(win.top - (z0 - pad)) < 1e-9 && Math.abs(win.bot - (z1 + pad)) < 1e-9 && z0 - 150 > cubeTop && z1 + 150 < cubeBot && Math.abs(ax.Y(win.z0 - 150) - box.y) < 1e-9 && ax.Y(win.z1 + 150) <= box.y + box.h + 1e-9 && ax.dX(L) <= box.x + box.w + 1e-9 && Math.abs((ax.dX(0) - box.x) - (box.x + box.w - ax.dX(L))) < 1e-9,
      `the field's window: ${U.int(z0 + datum)} to ${U.int(z1 + datum)} m below sea level, and the locked window 150 m beyond each, ${U.int(z0 - 150 + datum)} to ${U.int(z1 + 150 + datum)} m, inside the seismic's ${U.int(g.z0)} to ${U.int(g.z0 + (g.nz - 1) * g.dz)} m; fitted to ${box.w} × ${box.h} at ×3 with the inlines' ${Math.round(L)} m, the whole of it inside, centered across`);
  }
  // a view: X and S invert, a zoom keeps the meters under the fingers, a move moves by the finger, the
  // section kept in view, the stretch slider keeps the scale and the middle
  {
    const l = surveyLine(g, 'inline', nearestNumber(g, 'inline', 0, 0)), sec = cutGrid(geom, NA, ijk, l.a, l.b, tops), fit = sectionAxis(sec, box, 3, datum), v0 = viewOfAxis(fit, box), a0 = viewAxis(sec, box, v0, datum);
    let bad = 0;
    for (const s of [0, 1000, sec.line.L]) if (Math.abs(a0.X(s) - fit.X(s)) > 1e-9) bad++;
    for (const z of [sec.z0, sec.z1]) if (Math.abs(a0.Y(z) - fit.Y(z)) > 1e-9) bad++;
    const lo = fit.sx, hi = readableScale(geom, NA).sz / 3, x = 150, y = 40, before = [a0.S(x), a0.Z(y)];
    const v1 = zoomAt(v0, 3.7, x, y, box, lo, hi), a1 = viewAxis(sec, box, v1, datum);
    const anchor = Math.hypot(a1.X(before[0]) - x, a1.Y(before[1]) - y);
    const v2 = panBy(v1, 25, -12), a2 = viewAxis(sec, box, v2, datum), moved = [a2.X(before[0]) - a1.X(before[0]), a2.Y(before[1]) - a1.Y(before[1])];
    const v3 = zoomAt(v1, 1e6, x, y, box, lo, hi), v4 = zoomAt(v1, 1e-6, x, y, box, lo, hi);
    const far = keepIn({ ...v1, sL: 1e6 }, box, { s0: 0, s1: sec.line.L, z0: sec.z0, z1: sec.z1 }), af = viewAxis(sec, box, far, datum);
    const kept = Math.min(af.x1, box.x + box.w) - Math.max(af.x0, box.x);
    const v5 = restretch(v1, 10, box), a5 = viewAxis(sec, box, v5, datum), zm = a1.Z(box.y + box.h / 2);
    // a section laid against its family (sgn -1): its distance runs right to left, and S still inverts X
    const ar = viewAxis(sec, box, v1, datum, { off: 5000, sgn: -1 }), inv = Math.abs(ar.S(ar.X(1234)) - 1234) + Math.abs(ar.X(0) - ar.dX(5000)) + Math.abs(ar.X(100) - ar.dX(4900));
    ok(bad === 0 && anchor < 1e-6 && Math.abs(moved[0] - 25) < 1e-6 && Math.abs(moved[1] + 12) < 1e-6 && Math.abs(v3.sx - hi) < 1e-12 && Math.abs(v4.sx - lo) < 1e-12 && kept >= 48 - 1e-6 && Math.abs(a1.sz / a1.sx - 3) < 1e-9 && v5.sx === v1.sx && Math.abs(a5.Y(zm) - (box.y + box.h / 2)) < 1e-6 && inv < 1e-6 && ar.xb < ar.xa,
      `a view, on inline ${l.n}: the fit as a view draws as the fit (${bad} not); zoomed ×3.7 the meters under (${x}, ${y}) stay there (${anchor.toExponential(1)} px off), a move moves them by the finger, the scale held within the fit and the limit, ${Math.round(kept)} px of the section kept in view when moved far off, the stretch ×3 through the zoom; the slider's ×10 keeps the scale and the depth at the middle; laid against its family, A′ left of A and S the inverse of X`);
  }
  // the ticks of a zoomed axis and of a locked one, against the data
  {
    const l = surveyLine(g, 'inline', nearestNumber(g, 'inline', 0, 0)), sec = cutGrid(geom, NA, ijk, l.a, l.b, tops), fit = sectionAxis(sec, box, 3, datum), lim = { d0: 0, d1: sec.line.L, z0: fit.zTop, z1: fit.zBot };
    const res = [];
    let bad = 0;
    for (const k of [1.5, 4, 12, 40]) {
      const v = zoomAt(viewOfAxis(fit, box), k, 200, 40, box, fit.sx, 1e9), ax = viewAxis(sec, box, v, datum, undefined, lim);
      const xt = distanceTicks(ax, 'SI', 3), dt = depthTicks(ax, 'SI', 2), s0 = ax.S(box.x), s1 = ax.S(box.x + box.w);
      const steps = new Set(xt.slice(1).map((t, i) => Math.round((t.v - xt[i].v) * 1e6) / 1e6));
      if (!xt.length || xt.some((t) => t.v < Math.max(0, s0) - 1e-6 || t.v > Math.min(sec.line.L, s1) + 1e-6 || t.x < box.x - 1e-6 || t.x > box.x + box.w + 1e-6) || steps.size > 1) bad++;
      if (!dt.length || dt.some((t) => t.y < box.y - 1e-6 || t.y > box.y + box.h + 1e-6 || t.v < fit.zTop + datum - 1e-6 || t.v > fit.zBot + datum + 1e-6)) bad++;
      if (!/\u202fm$/.test(xt[xt.length - 1].text)) bad++;   // the unit after a narrow no-break space (SI)
      res.push(`×${k}: ${xt.map((t) => t.text).join(' | ')}; ${dt.map((t) => t.text).join(' | ')}`);
    }
    // locked: the inlines on their common distance, the window on the field and the seismic's margin
    const { f } = fams.inline, wz = { top: win.z0 - 150, bot: win.z1 + 150 }, home = fitWindow(f.L, wz.top, wz.bot, box, 3), place = f.at.get(l.n);
    const lax = viewAxis(sec, box, home, datum, place, { d0: 0, d1: f.L, z0: wz.top, z1: wz.bot }), lt = distanceTicks(lax, 'SI', 3), ld = depthTicks(lax, 'SI', 2);
    if (lt[0].v !== 0 || lt.some((t) => t.v > f.L + 1e-6) || lt[lt.length - 1].v - lt[0].v < f.L * 0.7 || ld.some((t) => t.v < wz.top + datum - 1e-6 || t.v > wz.bot + datum + 1e-6) || Math.abs(lax.xa - lax.dX(place.off)) > 1e-9) bad++;
    res.push(`locked on the field: ${lt.map((t) => t.text).join(' | ')}; ${ld.map((t) => t.text).join(' | ')}`);
    // five steps of each sweep, locked: one scale and one set of ticks; each section where it lies
    const sweeps = [];
    for (const name of ['inline', 'across']) {
      const fam = fams[name], xs = [];
      const keys = name === 'inline' ? surveyNumbers(g, 'inline').slice(70, 75) : slices(cols, fam.axis).slice(40, 45).map((s) => s.k);
      for (const k of keys) {
        const sl = name === 'inline' ? (() => { const q = surveyLine(g, 'inline', k); return cutGrid(geom, NA, ijk, q.a, q.b, tops); })() : sliceSection(geom, NA, ijk, fam.axis, k, tops);
        const hm = fitWindow(fam.f.L, wz.top, wz.bot, box, 3), ax = viewAxis(sl, box, hm, datum, fam.f.at.get(k), { d0: 0, d1: fam.f.L, z0: wz.top, z1: wz.bot });
        xs.push([ax.sx, ax.sz, ax.xa, ax.xb, distanceTicks(ax, 'SI', 3).map((t) => t.text).join(' '), depthTicks(ax, 'SI', 2).map((t) => t.text).join(' '), sl.cells.slice(0, 3).join(' ')]);
      }
      const one = xs.every((q) => q[0] === xs[0][0] && q[1] === xs[0][1] && q[4] === xs[0][4] && q[5] === xs[0][5]), data = new Set(xs.map((q) => q[6])).size, ends = new Set(xs.map((q) => `${q[2].toFixed(2)} ${q[3].toFixed(2)}`)).size;
      if (!one || data !== 5 || (name === 'across' && ends !== 5)) bad++;
      sweeps.push(`${name}: one scale and ticks (${xs[0][4]}; ${xs[0][5]}), ${data} different cuts, A at ${xs.map((q) => q[2].toFixed(1)).join(', ')} px`);
    }
    ok(bad === 0, `the ticks: zoomed, each within the plot and within the data (the inline's 0 to ${Math.round(sec.line.L)} m, the window's depths), one round step, chosen afresh, the unit on the last: ${res.join('; ')}; five sweep steps locked: ${sweeps.join('; ')}`);
  }
  // how far in: the thin cells read plainly
  {
    const r = readableScale(geom, NA), t = [];
    for (let c = 0; c < NA; c++) { let h = 0; for (let k = 0; k < 4; k++) h += geom[c * 24 + (k + 4) * 3 + 2] - geom[c * 24 + k * 3 + 2]; t.push(h / 4); }
    t.sort((a, b) => a - b);
    const p05 = t[Math.floor(0.05 * (NA - 1))], l = surveyLine(g, 'inline', nearestNumber(g, 'inline', 0, 0)), fit = sectionAxis(cutGrid(geom, NA, ijk, l.a, l.b, tops), box, 3, datum);
    ok(Math.abs(r.t - p05) < 1e-4 && Math.abs(r.t * r.sz - 24) < 1e-9, `the zoom's limit: the 5th percentile of the active cells' thickness, ${r.t.toFixed(2)} m, drawn 24 px tall (${r.sz.toFixed(2)} px a meter down; at ×3 the inline's fit at ${box.w} px zooms in ${Math.round(r.sz / 3 / fit.sx)} times)`);
  }
}

// 7. the cost
ok(true, `a cut takes ${(msSum / tests.length).toFixed(1)} ms on average over ${tests.length} lines (Node on this Mac: a trend, never phone evidence)`);

// the locked window's stretch in a capped compact pane (D19, the review of 2.5): the 3D view's where the window fills
// the plot's width at it; else the largest round stretch under it that does, so the axes cover the plot across
{
  const box = { x: 0, y: 0, w: 256, h: 123 }, cases = [[4675, 1052, 3], [8513, 651, 5], [4675, 1052, 1], [1000, 5000, 5]];
  const got = cases.map(([L, span, ex]) => fillStretch(L, span, box, ex));
  const fills = cases.map(([L, span], i) => { const e = got[i], sx = Math.min(box.w / L, box.h / (span * e)); return Math.abs(sx * L - box.w) < 1e-9; });
  const roundUnder = cases.every(([L, span, ex], i) => got[i] <= ex && STRETCHES.includes(got[i]) && (got[i] === ex || !STRETCHES.some((s) => s > got[i] && s < ex && (box.h / span) / (box.w / L) >= s)));
  ok(got.join() === '2,5,1,1' && fills.slice(0, 3).every(Boolean) && roundUnder,
    `the locked stretch where the pane's cap holds the plot (fillStretch, a 256 × 123 px box): a 4 675 m family 1 052 m deep at ×3 takes ×${got[0]}, filling the width; 8 513 m and 651 m at ×5 keeps ×${got[1]}; at ×1 stays ×${got[2]}; a window too deep to fill it even at ×1 takes ×${got[3]}, the least; each a round stretch, the largest under the 3D view's that fills`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
