// The decode test (HOUSE.md section 7.3; step 20 of the pass's change list, in tools/DECISIONS.md). Node, no dependencies.
// It decodes data/ with formulas written here from data/ATTRIBUTION.txt's formats, never by importing
// the app's decoding to agree with itself, and then compares js/data.js and js/units.js with it:
//   1. the frames: saturations /255, oil as the remainder, pressure over dynamic.pressureRange, at the
//      first, a middle and the last report date for a sample of cells, through fillValues and cellValue;
//   2. the open ends: pressure 56.4 to 612.5 bar in the cells (against the 200 to 450 scale), gas to
//      0.922, the permeability counts beyond their scales, from this test's own scan of every frame;
//   3. the cut: the peak (37 144 Sm³/d in the month to 1 Nov 2000), the crossover (the month to
//      1 Jul 2004, water above oil in all 30 months from there), 69 % water in the last month,
//      67.20 and 23.29 million Sm³ over the 3 312 days, from this test's own sums;
//   4. js/units.js against a table: negatives, thousands, years, dates, both systems, spoken forms.
//
//   node tools/test_decode.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as data from '../js/data.js';
import * as U from '../js/units.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const buf = (f) => { const b = fs.readFileSync(path.join(APP, 'data', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const model = JSON.parse(fs.readFileSync(path.join(APP, 'data/model.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'config.json'), 'utf8'));
const NA = model.NA, NF = model.frames.length, FB = model.dynamic.frameBytes;
const dyn = buf('dynamic.bin'), ijk = new Uint8Array(buf('ijk.bin')), st = new Float32Array(buf('static.bin'));

/* ── this test's own decode (data/ATTRIBUTION.txt) ── */
const bytes = new Uint8Array(dyn), dv = new DataView(dyn);
const [P0, P1] = model.dynamic.pressureRange;
const own = {
  SWAT: (f, a) => bytes[f * FB + a] / 255,
  SGAS: (f, a) => bytes[f * FB + NA + a] / 255,
  SOIL: (f, a) => Math.max(0, 1 - (bytes[f * FB + a] + bytes[f * FB + NA + a]) / 255),
  PRESSURE: (f, a) => P0 + dv.getUint16(f * FB + 2 * NA + 2 * a, true) * (P1 - P0) / 65535,
};
const staticOf = (key, a) => st[model.static.order.indexOf(key) * NA + a];

const statics = {};
model.static.order.forEach((k, i) => { statics[k] = st.subarray(i * NA, (i + 1) * NA); });
const D = { model, cfg, NA, ijk, static: statics, dyn, zoneOfK: data.buildZones(cfg.zones, model.NK) };

// 1. Frames
{
  ok(dyn.byteLength === NF * FB && FB === NA * 4, `dynamic.bin: ${dyn.byteLength} bytes = ${NF} report dates × ${FB} (2 saturation bytes and a 16-bit pressure per cell)`);
  const cells = [0, 1, 777, 12345, 22215, 30001, 44430], frames = [0, 55, NF - 1];
  let worst = 0, n = 0;
  const out = new Float32Array(NA);
  for (const key of ['SWAT', 'SGAS', 'SOIL', 'PRESSURE']) for (const f of frames) {
    data.fillValues(D, key, f, out);
    for (const a of cells) {
      const want = own[key](f, a);
      worst = Math.max(worst, Math.abs(out[a] - want), Math.abs(data.cellValue(D, key, f, a) - want));
      n++;
    }
  }
  ok(worst < 1e-4, `fillValues and cellValue equal this test's decode at ${n} samples (4 properties × 3 report dates × ${cells.length} cells): worst difference ${worst.toExponential(1)}`);
  let sw = 0;
  for (const key of model.static.order) for (const a of cells) sw = Math.max(sw, Math.abs(data.cellValue(D, key, 0, a) - staticOf(key, a)));
  ok(sw === 0, `the six static properties read through cellValue equal static.bin's floats at ${cells.length} cells`);
  const seg = cells.map((a) => data.segmentOf(D, a)), fip = cells.map((a) => (Math.round(staticOf('FIPNUM', a)) - 1) % 4);
  ok(JSON.stringify(seg) === JSON.stringify(fip), `segmentOf is (FIPNUM - 1) mod 4: ${seg.join(', ')}`);
  const k1 = cells.map((a) => data.cellValue(D, 'LAYER', 0, a)), kk = cells.map((a) => ijk[a * 3 + 2] + 1);
  ok(JSON.stringify(k1) === JSON.stringify(kk), `LAYER is ijk.bin's K + 1: ${k1.join(', ')}`);
}

// 2. Open ends, against this test's own scan of every cell at every report date
{
  let pmin = Infinity, pmax = -Infinity, gmax = 0, outside = 0, outsideDate = '';
  for (let f = 0; f < NF; f++) {
    let o = 0;
    for (let a = 0; a < NA; a++) {
      const p = own.PRESSURE(f, a), g = bytes[f * FB + NA + a];
      if (p < pmin) pmin = p; if (p > pmax) pmax = p; if (g > gmax) gmax = g;
      if (p < 200 || p > 450) o++;
    }
    if (o > outside) { outside = o; outsideDate = model.frames[f]; }
  }
  ok(Math.abs(pmin - 56.4) < 0.05 && Math.abs(pmax - 612.5) < 0.05, `pressure spans ${pmin.toFixed(1)} to ${pmax.toFixed(1)} bar in the cells against the scale's 200 to 450 (ART.md: 56.4 to 612.5); at most ${outside} cells outside it, on ${outsideDate}`);
  ok(Math.abs(gmax / 255 - data.gasMax(D)) < 1e-9 && Math.abs(gmax / 255 - 0.922) < 0.001, `gas saturation reaches ${(gmax / 255).toFixed(3)} (data.gasMax ${data.gasMax(D).toFixed(3)}) against the scale's 0.90`);
  const px = statics.PERMX.filter((v) => v < 1).length, pz0 = statics.PERMZ.filter((v) => v < 0.1).length, pz1 = statics.PERMZ.filter((v) => v > 2000).length;
  ok(px === 13 && pz0 === 101 && pz1 === 5, `permeability beyond its scale: ${px} cells under 1 mD horizontal, ${pz0} under 0.1 and ${pz1} over 2 000 mD vertical (ART.md: 13, 101, 5)`);
  const prop = (k) => cfg.properties.find((p) => p.key === k);
  const ends = Object.fromEntries(['PRESSURE', 'SGAS', 'PERMX', 'PERMZ', 'PORO', 'NTG', 'DEPTH', 'SOIL', 'LAYER'].map((k) => [k, data.openEnds(D, prop(k), data.gasMax(D))]));
  const want = { PRESSURE: [true, true], SGAS: [false, true], PERMX: [true, false], PERMZ: [true, true], PORO: [false, false], NTG: [false, false], DEPTH: [false, false], SOIL: [false, false], LAYER: [false, false] };
  const bad = Object.keys(want).filter((k) => ends[k].lo !== want[k][0] || ends[k].hi !== want[k][1]);
  ok(bad.length === 0, `openEnds prints open exactly where the data goes past: ${Object.entries(ends).map(([k, e]) => `${k} ${e.lo ? '≤' : '-'}${e.hi ? '≥' : '-'}`).join(', ')}`);
}

// 3. The cut, from this test's own sums of model.json's field rates
{
  const F = model.summary.field, fr = model.frames;
  const day = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
  const liq = F.oil.map((o, i) => o + F.water[i]);
  let pk = 0; for (let i = 1; i < NF; i++) if (liq[i] > liq[pk]) pk = i;
  const cross = fr.findIndex((_, i) => i > 0 && F.water[i] > F.oil[i]);
  const stays = fr.slice(cross).filter((_, j) => F.water[cross + j] > F.oil[cross + j]).length;
  let co = 0, cw = 0, days = 0;
  for (let i = 1; i < NF; i++) { const dd = day(fr[i]) - day(fr[i - 1]); co += F.oil[i] * dd; cw += F.water[i] * dd; days += dd; }
  ok(Math.round(liq[pk]) === 37144 && fr[pk] === '2000-11-01' && Math.round(F.water[pk]) === 1409, `peak liquid ${Math.round(liq[pk])} Sm³/d in the month to ${fr[pk]}, ${Math.round(F.oil[pk])} oil and ${Math.round(F.water[pk])} water`);
  ok(fr[cross] === '2004-07-01' && stays === NF - cross && stays === 30, `water passes oil first in the month to ${fr[cross]} and stays above it in ${stays} of the ${NF - cross} months from there`);
  ok(Math.round((100 * F.water[NF - 1]) / liq[NF - 1]) === 69, `the last month: oil ${Math.round(F.oil[NF - 1])}, water ${Math.round(F.water[NF - 1])}, ${Math.round((100 * F.water[NF - 1]) / liq[NF - 1])} % water`);
  ok((co / 1e6).toFixed(2) === '67.20' && (cw / 1e6).toFixed(2) === '23.29' && days === 3312, `sums of the averages: ${(co / 1e6).toFixed(2)} million Sm³ of oil, ${(cw / 1e6).toFixed(2)} of water over ${days} days`);
  const series = data.cutSeries(model, U.dayNumber), facts = data.cutFacts(series);
  const same = series.every((s, i) => s.oil === F.oil[i] && s.water === F.water[i] && s.d1 === day(fr[i]) && s.d0 === day(fr[Math.max(0, i - 1)]));
  ok(same && series[0].liquid === 0, `cutSeries: ${series.length} columns, each the month to its date (d0 the date before), the first empty (first oil on ${fr[0]})`);
  ok(facts.peak.f === pk && facts.cross.f === cross && facts.stays === 30 && facts.of === 30, `cutFacts: peak ${facts.peak.iso}, crossover ${facts.cross.iso}, ${facts.stays} of ${facts.of}`);
}

// 4. js/units.js against a table written here
{
  const N = '\u202f', M = '\u2212';
  const table = [
    [U.int(7361.1), `7${N}361`], [U.int(37143.7), `37${N}144`], [U.int(950), '950'], [U.fixed(-3.45, 1), `${M}3.5`], [U.fixed(-0.001, 2), '0.00'],
    [U.liquid(7361.1, 'SI'), `7${N}361${N}Sm³/d`], [U.liquid(7361.1, 'US'), `46${N}300${N}bbl/d`], [U.gas(412000, 'SI'), `412${N}000${N}Sm³/d`], [U.gas(412000, 'US'), `14${N}550${N}Mscf/d`],
    [U.valueWithUnit({ unit: 'bar' }, 287.4, 'SI'), `287${N}bar`], [U.valueWithUnit({ unit: 'bar' }, 287.4, 'US'), `4${N}168${N}psi`], [U.valueWithUnit({ unit: 'm' }, 2763.2, 'SI'), `2${N}763${N}m`],
    [U.valueWithUnit({ unit: 'm' }, 2763.2, 'US'), `9${N}066${N}ft`], [U.valueWithUnit({ unit: 'mD' }, 1234.5, 'US'), `1${N}235${N}mD`], [U.valueWithUnit({ unit: 'mD' }, 4.56, 'SI'), `4.6${N}mD`],
    [U.valueWithUnit({ unit: 'mD' }, 0.456, 'SI'), `0.46${N}mD`], [U.valueWithUnit({ unit: '', decimals: 2 }, 0.623, 'SI'), '0.62'], [U.valueWithUnit({ unit: '', decimals: 3 }, 0.2346, 'US'), '0.235'],
    [U.date('2006-12-01'), '1 Dec 2006'], [U.month('1997-11-06'), 'Nov 1997'], [U.spokenDate('2004-07-01'), '1 July 2004'], [U.spokenMonth('1997-11-06'), 'November 1997'],
    [U.lead(0), 'First oil'], [U.lead(25), '25 days after first oil'], [U.lead(3312), '9.1 years after first oil'],
    [U.length(3000, 'SI'), `3${N}km`], [U.length(750, 'SI'), `750${N}m`], [U.length(2 * 1609.344, 'US'), `2${N}mi`], [U.length(2000 / 3.28084, 'US'), `2${N}000${N}ft`],
    [U.times(5), '×5'], [U.times(2.5), '×2.5'], [U.percent(0.6884), `69${N}%`], [U.tick(0.25), '0.25'], [U.tick(4000), `4${N}000`], [String(2006), '2006'],
    [U.spokenUnits(`oil 7${N}361${N}Sm³/d, ${U.percent(0.69)}`), 'oil 7361 standard cubic meters a day, 69 percent'], [U.spokenUnits(`4${N}168${N}psi`), '4168 pounds per square inch'],
  ];
  const bad = table.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${table.length} cases (U+202F before units and in thousands, U+2212, no negative zero, dates by hand, both systems, spoken forms)${bad.length ? ': ' + bad.map(([a, b]) => `got "${a}" want "${b}"`).join('; ') : ''}`);
  const steps = U.scaleSteps('US').map((m) => U.length(m, 'US'));
  ok(steps.every((s) => /^\d[\d\u202f]*(\.\d+)?\u202f(ft|mi)$/.test(s)), `the US scale bar's lengths are round feet or miles (${steps.length} of them, ${steps.slice(0, 3).join(', ')} … ${steps.slice(-2).join(', ')})`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
