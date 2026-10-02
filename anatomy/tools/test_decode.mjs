// Decode test for Anatomy (HOUSE.md section 7.3; step 19 of the pass's change list, in
// tools/DECISIONS.md). Node, no dependencies. It reads the shipped data with code of its own and checks
// the app's pure modules against it:
//   1. every vertebra's and twenty named structures' positions decoded from the .bin files (16-bit
//      positions in each part's box, geometry.json's offsets and counts): each part's decoded extent
//      equals its box within one quantization step, and every index points at a vertex;
//   2. the vertebrae, their bands, the level of a height and the span words, by this file's own
//      formulas, against js/levels.js, for every part of the body (1 752 spans) and for heights on a
//      1 mm grid down the whole body;
//   3. the height-to-column map against a projection this file makes up, its open ends, the caption's
//      sentences;
//   4. the table of ART.md section 1, which must read as it says;
//   5. js/units.js against a table of its own.
// An art pass changes no decoding; this test proves it did not.
//
//   node tools/test_decode.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LV = await import(path.join(APP, 'js/levels.js'));
const U = await import(path.join(APP, 'js/units.js'));
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const json = (f) => JSON.parse(fs.readFileSync(path.join(APP, f), 'utf8'));
const anat = json('data/anatomy.json'), geo = json('data/geometry.json');
const box = new Map(geo.parts.map((p) => [p.id, p]));
const byName = (n) => anat.parts.find((p) => p.name === n);

// 1. Positions decoded from the binaries
{
  const files = geo.files.map((f) => fs.readFileSync(path.join(APP, f.url)));
  ok(geo.files.every((f, i) => files[i].length === f.bytes), `${geo.files.length} geometry files hold the bytes geometry.json says (${geo.files.map((f) => U.int(f.bytes)).join(', ')})`);
  const SPINE = ['atlas', 'axis', 'cervical', 'thoracic', 'lumbar', 'sacrum'];
  const NAMED = ['Right kidney', 'Left kidney', 'Celiac trunk', 'Right renal artery', 'Abdominal aorta', 'Hyoid bone', 'Cricoid cartilage', 'Trachea', 'Pancreas', 'Xiphoid process',
    'Left scapula', 'Liver', 'Stomach', 'Spleen', 'Esophagus', 'Thyroid cartilage', 'Arch of aorta', 'Diaphragm', 'Urinary bladder', 'Left femur'];
  const picked = [...anat.parts.filter((p) => SPINE.includes(p.type) && p.label), ...NAMED.map(byName)];
  let worst = 0, badIdx = 0, verts = 0;
  for (const p of picked) {
    const g = box.get(p.id), buf = files[g.f || 0];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let v = 0; v < g.v; v++) for (let a = 0; a < 3; a++) {
      const q = buf.readUInt16LE(g.p + (v * 3 + a) * 2);
      const x = g.min[a] + (q * (g.max[a] - g.min[a])) / 65535;
      if (x < lo[a]) lo[a] = x;
      if (x > hi[a]) hi[a] = x;
    }
    verts += g.v;
    for (let a = 0; a < 3; a++) {
      const step = (g.max[a] - g.min[a]) / 65535 || 1e-9;
      worst = Math.max(worst, Math.abs(lo[a] - g.min[a]) / step, Math.abs(hi[a] - g.max[a]) / step);
    }
    for (let i = 0; i < g.i; i++) { const k = g.t === 16 ? buf.readUInt16LE(g.x + i * 2) : buf.readUInt32LE(g.x + i * 4); if (k >= g.v) badIdx++; }
  }
  ok(picked.length === 45 && worst <= 1 && badIdx === 0, `${picked.length} parts (the spine's 25 labeled parts, the sacrum one of them, and 20 named structures), ${U.int(verts)} vertices decoded: every extent equals its box within ${worst.toFixed(3)} of a quantization step (at most 1); ${badIdx} indices past their vertices`);
}

// 2. The levels by this file's own formulas, against js/levels.js
const own = (() => {
  const v = [];
  for (const p of anat.parts) {
    if (!p.label || !['atlas', 'axis', 'cervical', 'thoracic', 'lumbar', 'sacrum'].includes(p.type) || !box.has(p.id)) continue;
    const b = box.get(p.id);
    v.push({ label: p.label, c: (b.min[1] + b.max[1]) / 2, top: b.max[1], bot: b.min[1] });
  }
  v.sort((a, b) => b.c - a.c);
  const bands = v.map((e, i) => [e.label, i ? (v[i - 1].c + e.c) / 2 : e.top, i < v.length - 1 ? (v[i + 1].c + e.c) / 2 : e.bot]);
  const level = (y) => (y > bands[0][1] ? 'above C1' : y < bands[bands.length - 1][2] ? 'below the sacrum' : bands.find((b) => y >= b[2])[0]);
  const span = (lo, hi) => (level(hi) === level(lo) ? level(hi) : `${level(hi)} to ${level(lo)}`);
  return { v, bands, level, span };
})();
const V = LV.vertebrae(anat, geo), B = LV.bands(V);
{
  ok(V.length === 25 && V.map((e) => e.label).join(' ') === own.v.map((e) => e.label).join(' '), `vertebrae: ${V.length}, ${V.map((e) => e.label).join(' ')}`);
  const same = B.every((b, i) => b.label === own.bands[i][0] && Math.abs(b.hi - own.bands[i][1]) < 1e-12 && Math.abs(b.lo - own.bands[i][2]) < 1e-12);
  const mm = B.map((b) => Math.round((b.hi - b.lo) * 1000));
  ok(same, `bands equal this file's: ${B[0].hi.toFixed(3)} m to ${B[B.length - 1].lo.toFixed(3)} m (${((B[0].hi - B[B.length - 1].lo) * 100).toFixed(1)} cm), ${Math.min(...mm)} to ${Math.max(...mm.slice(0, -1))} mm a vertebra, the sacrum ${mm[mm.length - 1]} mm`);
  let diff = 0, n = 0;
  for (const p of anat.parts) { const b = box.get(p.id); if (!b) continue; n++; if (LV.spanWords(b.min[1], b.max[1], B) !== own.span(b.min[1], b.max[1])) diff++; }
  let grid = 0, gd = 0;
  for (let y = -0.02; y <= 1.7; y += 0.001) { grid++; if (LV.levelOf(y, B) !== own.level(y)) gd++; }
  ok(n === 1752 && diff === 0 && gd === 0, `span words for all ${n} parts and the level at ${grid} heights 1 mm apart equal this file's (${diff} and ${gd} differ)`);
  const regionEnds = B.map((b, i) => (LV.regionEnd(B, i) ? `${b.label}/${B[i + 1].label}` : null)).filter(Boolean);
  ok(regionEnds.join(' ') === 'C7/T1 T12/L1 L5/S1–S5', `region ends, which always keep their gap: ${regionEnds.join(', ')}`);
}

// 3. The height-to-column map, its open ends, the sentences
{
  // a made-up camera: screen y = 900 - 400 * height, plus a wobble per vertebra, as a turned body gives
  const wob = (i) => Math.sin(i * 1.7) * 3;
  const scr = { top: 900 - 400 * B[0].hi, centers: B.map((b, i) => 900 - 400 * b.center + wob(i)), bottom: 900 - 400 * B[B.length - 1].lo };
  let bad = 0;
  B.forEach((b, i) => { if (Math.abs(LV.toColumn(b.center, B, scr).y - scr.centers[i]) > 1e-9) bad++; });
  // between two centers the map is linear: halfway in height is halfway on the column
  for (let i = 1; i < B.length; i++) {
    const y = (B[i - 1].center + B[i].center) / 2, want = (scr.centers[i - 1] + scr.centers[i]) / 2;
    if (Math.abs(LV.toColumn(y, B, scr).y - want) > 1e-9) bad++;
  }
  const up = LV.toColumn(2, B, scr), down = LV.toColumn(0.1, B, scr), edge = LV.toColumn(B[0].hi, B, scr);
  ok(bad === 0 && up.open === 'up' && up.y === scr.top && down.open === 'down' && down.y === scr.bottom && edge.open === null,
    `toColumn: every center lands on its own screen height and every band edge halfway between (${bad} off); past the top "${up.open}" at the top, past the foot "${down.open}" at the foot`);
  const s = [LV.ruleSentence(B), LV.spanSentence('T12 to L3', B, true), LV.spanSentence('T12', B, true), LV.spanSentence('T12 to L3', B, false, 'steep'), LV.spanSentence('below the sacrum', B, true),
    LV.spanSentence('above C1', B, true), LV.HIDDEN_RULE.steep, LV.HIDDEN_RULE.small, LV.spanSentence('T12 to L3', B, false, 'small'), LV.NO_RULE, LV.explodedSentence(U.pct(1), 'region')];
  ok(s[0] === 'Levels: this body’s spine in 25 levels, C1 to S1–S5, drawn beside it where the camera sees them.' && s[1] === 'The selection spans T12 to L3 on this body’s spine: the bar beside the levels.'
    && s[3] === 'The selection spans T12 to L3; turn the body upright to see its bar.' && s[8] === 'The selection spans T12 to L3; come closer to see its bar.'
    && s[6] === 'Levels: turn the body upright to read its vertebrae beside it.' && s[7] === 'Levels: come closer to read this body’s vertebrae beside it.'
    && s[4] === 'The selection lies below the sacrum, under the spine.' && s.every((t) => t.length <= 100),
  `the caption's ${s.length} sentences, the longest ${Math.max(...s.map((t) => t.length))} characters: ${s.map((t) => `"${t}"`).join(' | ')}`);
}

// 4. ART.md section 1's table, read off this body's own spine
{
  const TABLE = [['Right kidney', 'T12 to L3'], ['Left kidney', 'T11 to L2'], ['Celiac trunk', 'T12'], ['Right renal artery', 'L1 to L2'], ['Abdominal aorta', 'T10 to L4'],
    ['Hyoid bone', 'C3 to C4'], ['Cricoid cartilage', 'C5 to C6'], ['Trachea', 'C5 to T5'], ['Pancreas', 'T12 to L2'], ['Xiphoid process', 'T8 to T9'], ['Left scapula', 'T2 to T8'],
    ['Urinary bladder', 'S1–S5 to below the sacrum'], ['Cerebellum', 'above C1']];
  for (const [n, want] of TABLE) {
    const b = box.get(byName(n).id), got = LV.spanWords(b.min[1], b.max[1], B);
    ok(got === want, `${n}: ${got} (${b.min[1].toFixed(3)} to ${b.max[1].toFixed(3)} m)`);
  }
  const inside = anat.parts.filter((p) => { const b = box.get(p.id); return b && b.max[1] <= B[0].hi && b.min[1] >= B[B.length - 1].lo; }).length;
  ok(inside === 869, `${inside} of 1 752 structures lie wholly within the spine's range (ART.md: 869)`);
}

// 5. js/units.js against a table of its own
{
  const N = ' ';
  const T = [
    [U.group('1752'), `1${N}752`], [U.group('752'), '752'], [U.int(3448950), `3${N}448${N}950`], [U.count(1, 'structure'), '1 structure'], [U.count(1752, 'structure'), `1${N}752 structures`],
    [U.pct(0.45), `45${N}%`], [U.pctSpoken(0.45), '45 percent'], [U.meters(1.655), `1.66${N}m`], [U.megabytes(31962192, 1), `32.0${N}MB`], [U.megabytes(31962192), `32${N}MB`],
    [U.ofMB(12e6, 31962192), `12 of 32${N}MB`], [U.ofN(800, 1752), `800 of 1${N}752`], [U.fixed(-0.0001, 2), '0.00'], [U.fixed(-12.5, 1), '−12.5'],
  ];
  const bad = T.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${T.length} cases${bad.length ? ': ' + bad.map(([a, b]) => `"${a}" ≠ "${b}"`).join(', ') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
