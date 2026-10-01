// The decoder against the reference (DESIGN §16, CONTRACT §9). Node 26, no dependencies:
//   1. js/data.js's validator passes the committed demo snapshot, and every one of its frames
//      inflates to 16 200 bytes through the app's own queue (DecompressionStream) and through the
//      copied fallback inflater, byte-identical to Node's own zlib;
//   2. each of tools/ref/snapshot_ref.json's cells (computed by the pipeline from GISS's integers, not
//      from the snapshot) decodes to its value exactly at 0.1 °C, or to "none";
//   3. row 0 is the north: the reference holds 64–66° N, 148–146° W and 88–90° S;
//   4. the partial step's label and the indexes the app prints (global means, coverage, counts);
//   5. the polish pass's numbers: the pole readings (north and south of 64°) equal to the pipeline's ask
//      rows in every row, a cap with values in one row rounded exactly as the integers round, About's
//      placeholders all filled from the snapshot, the card's place phrase;
//   6. deliberately broken copies fail with the expected sentence: a frame cut by one byte, a frame
//      one byte long, a wrong nx, a gap in the years, a misnamed partial year, an HTML body.
//
//   node tools/test_decode.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { validate, index, decodeAll, decodeFrame, cellOf, capMean, CELLS, NONE, decodeWorld, decodePlaces } from '../js/data.js';
import { fill } from '../js/about.js';
import { placePhrase } from '../js/card.js';
import { tenths, percent, hundredths, cellBounds, group, roundDiv } from '../js/units.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const raw = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
const ref = JSON.parse(fs.readFileSync(path.join(APP, 'tools/ref/snapshot_ref.json'), 'utf8'));
const fails = [];
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };

// 1. validate and decode
const snap = JSON.parse(raw);
const v = validate(snap);
ok(v === null, `validator: ${v === null ? 'the demo snapshot follows the contract' : v}`);
const idx = index(snap);
const own = [...snap.steps, ...snap.months].map((s) => zlib.inflateSync(Buffer.from(s.planes['anom.v'], 'base64')));
const t0 = performance.now();
const frames = await decodeAll(JSON.parse(raw));
const ms = performance.now() - t0;
ok(frames.length === idx.L * CELLS && own.every((b, k) => b.length === CELLS && Buffer.compare(b, Buffer.from(frames.subarray(k * CELLS, (k + 1) * CELLS))) === 0),
  `all ${idx.L} frames decode through the app's queue to ${group(CELLS)} B each, byte-identical to Node's zlib (${ms.toFixed(1)} ms, Node, trend only)`);
let copiedSame = true;
for (const k of [0, 77, idx.ny - 1, idx.L - 1]) {
  const s = [...snap.steps, ...snap.months][k];
  const b = await decodeFrame(s.planes['anom.v'], 'x', true);
  copiedSame = copiedSame && Buffer.compare(Buffer.from(b), own[k]) === 0;
}
ok(copiedSame, 'the copied fallback inflater gives the same bytes on 4 frames (first, 1957, the partial year, the newest month)');

// 2. reference cells
const layerOf = (name) => (/^\d{4}-\d\d$/.test(name) ? idx.ny + idx.monthKeys.indexOf(name) : idx.years.indexOf(+name));
let bad = 0, n = 0;
for (const c of ref.cells) {
  const L = layerOf(c.step);
  const b = frames[L * CELLS + c.row * 180 + c.col];
  const got = b === NONE ? null : idx.tenths[b];
  const want = c.c === null ? null : Math.round(c.c * 10);
  n++;
  if (L < 0 || got !== want) { bad++; console.log(`     ${c.step} row ${c.row} col ${c.col}: got ${got === null ? 'none' : tenths(got)}, want ${want === null ? 'none' : tenths(want)}`); }
}
ok(bad === 0 && n === ref.cells.length && ref.release === snap.release.id, `${n} reference cells (release ${ref.release}) decode to their values exactly at 0.1 °C or to none; ${bad} differ`);

// 3. orientation
const fb = ref.cells.find((c) => c.row === 12 && c.col === 16 && c.step === String(idx.years[idx.lastComplete]));
const sp = ref.cells.filter((c) => c.row === 89);
ok(!!fb && cellBounds(12, 16) === '64–66° N, 148–146° W' && sp.length >= 1 && cellBounds(89, 90) === '88–90° S, 0–2° E'
  && cellOf(-147.71, 64.84).k === 12 * 180 + 16 && cellOf(1, -89.5).k === 89 * 180 + 90,
  `row 0 is the north: Fairbanks (−147.71, 64.84) is row 12 col 16 = ${cellBounds(12, 16)}, value ${fb ? tenths(Math.round(fb.c * 10)) : '?'} in ${fb && fb.step}; ${sp.length} reference cells at 88–90° S`);

// 4. the partial step and the numbers the app prints — the span is read from the release, so the test
//    survives the demo's yearly rebuild (build-warming-world.yml) and the monthly branch
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nmYear = Number(snap.release.newestMonth.slice(0, 4)), nmIdx = Number(snap.release.newestMonth.slice(5, 7));
const last = snap.steps[snap.steps.length - 1];
ok(idx.partial === snap.steps.length - 1 && last.label === ref.partialLabel && idx.partialSpan === `Jan–${MON[nmIdx - 1]}` && idx.partialMonths === nmIdx,
  `partial step ${JSON.stringify(last.label)} = reference ${JSON.stringify(ref.partialLabel)}; span ${idx.partialSpan}, ${idx.partialMonths} months; last complete ${idx.years[idx.lastComplete]}`);
ok(ref.counts.steps === idx.ny && ref.counts.months === idx.nm, `counts: ${idx.ny} steps, ${idx.nm} months (reference ${ref.counts.steps}, ${ref.counts.months})`);
const k25 = idx.years.indexOf(2025);
ok(hundredths(idx.meanH[k25]) === '+1.19' && percent(idx.area[k25]) === '99 %' && percent(idx.area[0]) === '83 %' && percent(idx.area[0], 1) === '82.7 %'
  && idx.above[k25] === 846 && hundredths(idx.meanH[0]) === '−0.18',
  `printed from the snapshot: 2025 global mean ${hundredths(idx.meanH[k25])} °C, cover ${percent(idx.area[k25])}, ${idx.above[k25]} above +4; 1880 ${hundredths(idx.meanH[0])} °C, cover ${percent(idx.area[0])} (${percent(idx.area[0], 1)})`);
const wj = JSON.parse(fs.readFileSync(path.join(APP, 'assets/world.json'), 'utf8')), w = decodeWorld(wj);
const ringsIn = (polys) => polys.reduce((n, p) => n + p.length, 0);
const pl = decodePlaces(JSON.parse(fs.readFileSync(path.join(APP, 'assets/places.json'), 'utf8')));
ok(wj.land.length === 1420 && w.land.n === ringsIn(wj.land) && wj.lakes.length === 36 && w.lakes.n === ringsIn(wj.lakes) && w.borders.n === 391 && pl.length === 1251,
  `world.json: ${wj.land.length} land polygons (${w.land.n} rings), ${wj.lakes.length} lakes (${w.lakes.n} rings), ${w.borders.n} border lines; places.json: ${pl.length} places`);

// 5. the polish pass: the pole reading, About's placeholders, the card's place phrase
{
  // the pole readings: the app's mean of the drawn 0.1 °C cells against the pipeline's north64AnomalyC and
  // south64AnomalyC, which build_snapshot.cap_mean computes from the same tenths (CONTRACT §3.8): equal in every row
  const rows = [...snap.ask.filter((r) => r.kind === 'year'), ...snap.ask.filter((r) => r.kind === 'month')];
  let worst = 0, differ = 0, nulls = 0, n = 0;
  for (let k = 0; k < idx.L; k++) for (const [w, key] of [['n', 'north64AnomalyC'], ['s', 'south64AnomalyC']]) {
    const m = capMean(frames, idx, k, w), a = rows[k][key];
    n++;
    if (m.h == null || a == null) { if ((m.h == null) !== (a == null)) nulls++; continue; }
    worst = Math.max(worst, Math.abs(m.h / 100 - a));
    if (m.h !== Math.round(a * 100)) differ++;
  }
  const k25 = idx.years.indexOf(2025), m25 = capMean(frames, idx, k25, 'n');
  ok(rows.length === idx.L && n === 2 * idx.L && differ === 0 && nulls === 0 && hundredths(m25.h) === '+2.97' && Math.round(m25.share * 10000) === 10000,
    `the pole readings against the ${rows.length} ask rows: ${n} means north and south of 64°, ${differ} differ at the second decimal (worst ${worst.toFixed(4)} °C), ${nulls} null on one side only; 2025 north reads ${hundredths(m25.h)} °C with ${percent(m25.share)} of the cap covered`);
  // a cap with values in one row only has the exact mean 10·S/C hundredths (S the row's tenths, C its cells), so it
  // must round as the integers round (roundDiv, half away from zero), ties included: floating point lands a hair below them
  let one = 0, ties = 0, bad = 0, tie = '';
  for (let k = 0; k < idx.L; k++) for (const w of ['n', 's']) {
    const used = [];
    for (let r = 0; r < 13; r++) {
      const row = w === 'n' ? r : 89 - r; let S = 0, C = 0;
      for (let c = 0; c < 180; c++) { const b = frames[k * CELLS + row * 180 + c]; if (b !== NONE) { S += idx.tenths[b]; C++; } }
      if (C) used.push([S, C]);
    }
    if (used.length !== 1) continue;
    const [S, C] = used[0], exact = roundDiv(10 * S, C), m = capMean(frames, idx, k, w);
    one++;
    if ((20 * Math.abs(S)) % C === 0 && ((20 * Math.abs(S)) / C) % 2 === 1) { ties++; if (!tie) tie = `${idx.name[k]} ${w === 'n' ? 'north' : 'south'} of 64°, ${C} cells: ${hundredths(m.h)} °C`; }
    if (m.h !== exact) bad++;
  }
  ok(bad === 0, `${one} cap readings with values in one row only round as the integers do (${bad} differ); ${ties} of them are exact ties, rounded away from zero${tie ? ` (${tie})` : ''}`);
  const s80 = capMean(frames, idx, 0, 's');
  ok(s80.share < 0.5 && s80.h != null, `south of 64° S in 1880: ${s80.h == null ? 'none' : hundredths(s80.h)} °C over ${percent(s80.share)} of the cap (the app says the share when it is under 100 %)`);
  // About: every placeholder filled, the coverage figures the snapshot's, an unknown one reported
  const ab = JSON.parse(fs.readFileSync(path.join(APP, 'assets/about.json'), 'utf8')), unknown = [];
  const text = ab.sections.flatMap((x) => x.paragraphs).map((t) => fill(t, idx, unknown)).join('\n');
  const cov = (y) => percent(idx.area[idx.years.indexOf(y)], 1);
  ok(unknown.length === 0 && !/\{[A-Za-z]+(:[0-9a-z]+)?\}/.test(text) && text.includes(`Data cover ${cov(1880)} of Earth’s surface in 1880, ${cov(1900)} in 1900, ${cov(1950)} in 1950, ${cov(1980)} in 1980 and ${cov(2025)} in 2025.`)
    && text.includes(snap.steps[snap.steps.length - 1].label) && text.includes(`release created ${snap.release.created.slice(0, 10)}, with the newest month ${MONTH[nmIdx - 1]} ${nmYear}. It was read on ${snap.release.retrieved}.`),
    `About's ${ab.sections.length} sections: every placeholder filled (${unknown.length} unknown): "Data cover ${cov(1880)} … ${cov(2025)} in 2025", the partial label, the release created ${snap.release.created.slice(0, 10)}, read ${snap.release.retrieved}`);
  const u2 = []; fill('{coverage:1700} {colour}', idx, u2);
  ok(u2.length === 2, `an unknown placeholder is reported, not filled: ${u2.join(', ')}`);
  ok(placePhrase(pl, 12, 16) === ', with Fairbanks' && placePhrase(pl, 44, 0) === '', `the card's place phrase: 64–66° N, 148–146° W${placePhrase(pl, 12, 16)}; 0–2° N, 180–178° W "${placePhrase(pl, 44, 0)}" (open ocean)`);
}

// 6. broken copies
async function fails_with(label, mutate, want) {
  let msg = null;
  try {
    let s;
    if (typeof mutate === 'string') s = JSON.parse(mutate); else { s = JSON.parse(raw); mutate(s); }
    msg = validate(s);
    if (!msg) await decodeAll(s);
  } catch (e) { msg = e instanceof SyntaxError ? 'it is not valid JSON' : e.message; }
  ok(msg !== null && msg.includes(want), `${label} fails: "${msg}"`);
}
const cut = (s, k, len) => { const b = zlib.inflateSync(Buffer.from([...s.steps, ...s.months][k].planes['anom.v'], 'base64')); [...s.steps, ...s.months][k].planes['anom.v'] = zlib.deflateSync(b.subarray(0, len)).toString('base64'); };
await fails_with('1903 cut by one byte', (s) => cut(s, 23, CELLS - 1), '1903 holds 16 199 cells, expected 16 200');
await fails_with('a month one byte long', (s) => cut(s, s.steps.length + 3, 1), 'holds 1 cell, expected 16 200');
await fails_with('a frame one byte too long', (s) => { const p = s.steps[5].planes; p['anom.v'] = zlib.deflateSync(Buffer.alloc(CELLS + 1)).toString('base64'); }, '1885 holds 16 201 cells, expected 16 200');
await fails_with('a frame that expands to 64 KB', (s) => { s.steps[6].planes['anom.v'] = zlib.deflateSync(Buffer.alloc(65536)).toString('base64'); }, '1886 holds more than 16\u202f200 cells');
await fails_with('nx 181', (s) => { s.grid.nx = 181; }, 'the grid is 181 × 90 cells, expected 180 × 90');
await fails_with('a gap in the years', (s) => { s.steps.splice(40, 1); }, 'expected 1920');
await fails_with('the partial year misnamed', (s) => { s.steps[s.steps.length - 1].label = `${nmYear}, Jan–${MON[nmIdx % 12]} (partial)`; }, `does not name its ${nmIdx} months`);
await fails_with('an HTML body', '<!doctype html><title>404</title>', 'it is not valid JSON');
await fails_with('a coverage of 1.2', (s) => { s.steps[10].coverage.area = 1.2; }, '1890 has no coverage between 0 and 1');

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
