// The decode test (HOUSE.md section 7.3), carried from Norne Reservoir to Volve. Node, no dependencies.
// It decodes data/ with formulas written here from data/ATTRIBUTION.txt's formats, never by importing
// the app's decoding to agree with itself, and then compares js/data.js and js/units.js with it:
//   1. the frames: saturations /255, oil as the remainder, pressure over dynamic.pressureRange, at the
//      first, a middle and the last report date for a sample of cells, through fillValues and cellValue;
//      the regions are FIPNUM as numbered, the layers ijk.bin's K;
//   2. the open ends: pressure 203.2 to 447.1 bar in the cells (inside the 200 to 450 scale), gas to
//      0.518 (inside 0.6), and the rock's counts beyond their scales, from this test's own scan;
//   3. the report dates' spacing (an 11-day first step, then 86 to 100 days, a quarter) and the cut: the
//      peak (10 779 Sm³/d in the quarter to 5 Jan 2011), the crossover (the quarter to 9 Jul 2010, water
//      above oil in all 26 from there), 78 % water in the last, and the averages summed over the 3 197 days
//      to the run's own totals (9.93 and 15.62 million Sm³, validation.json's FOPT and FWPT);
//   4. js/units.js against a table: negatives, thousands, dates, both systems, spoken forms, the lead.
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
const check = JSON.parse(fs.readFileSync(path.join(APP, 'data/validation.json'), 'utf8'));
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
const D = { model, cfg, NA, ijk, static: statics, dyn };

// 1. Frames
{
  ok(dyn.byteLength === NF * FB && FB === NA * 4, `dynamic.bin: ${dyn.byteLength} bytes = ${NF} report dates × ${FB} (2 saturation bytes and a 16-bit pressure per cell)`);
  const cells = [0, 1, 777, 12345, 91772, 150001, NA - 1], frames = [0, 18, NF - 1];
  let worst = 0, n = 0;
  const out = new Float32Array(NA);
  for (const key of ['SWAT', 'SGAS', 'SOIL', 'PRESSURE']) for (const f of frames) {
    data.fillValues(D, key, f, out);
    for (const a of cells) { const want = own[key](f, a); worst = Math.max(worst, Math.abs(out[a] - want), Math.abs(data.cellValue(D, key, f, a) - want)); n++; }
  }
  ok(worst < 1e-4, `fillValues and cellValue equal this test's decode at ${n} samples (4 properties × 3 report dates × ${cells.length} cells): worst difference ${worst.toExponential(1)}`);
  let sw = 0;
  for (const key of model.static.order) for (const a of cells) sw = Math.max(sw, Math.abs(data.cellValue(D, key, 0, a) - staticOf(key, a)));
  ok(sw === 0, `the six static properties read through cellValue equal static.bin's floats at ${cells.length} cells`);
  const reg = cells.map((a) => data.cellValue(D, 'REGION', 0, a)), fip = cells.map((a) => Math.round(staticOf('FIPNUM', a)));
  ok(JSON.stringify(reg) === JSON.stringify(fip) && data.regionCount(D) === 11, `REGION is FIPNUM as the deck numbers it (${reg.join(', ')}), ${data.regionCount(D)} regions`);
  const k1 = cells.map((a) => data.cellValue(D, 'LAYER', 0, a)), kk = cells.map((a) => ijk[a * 3 + 2] + 1);
  ok(JSON.stringify(k1) === JSON.stringify(kk), `LAYER is ijk.bin's K + 1: ${k1.join(', ')}`);
  ok(statics.NTG.every((v) => v === 1) && !cfg.properties.some((p) => p.key === 'NTG'), 'NTG is 1 in every cell (the deck has none), so the app offers no net-to-gross view');
}

// 2. Open ends, against this test's own scan of every cell at every report date
{
  let pmin = Infinity, pmax = -Infinity, gmax = 0;
  for (let f = 0; f < NF; f++) for (let a = 0; a < NA; a++) { const p = own.PRESSURE(f, a), g = bytes[f * FB + NA + a]; if (p < pmin) pmin = p; if (p > pmax) pmax = p; if (g > gmax) gmax = g; }
  ok(Math.abs(pmin - 203.2) < 0.05 && Math.abs(pmax - 447.1) < 0.05, `pressure spans ${pmin.toFixed(1)} to ${pmax.toFixed(1)} bar in the cells, inside the scale's 200 to 450`);
  ok(Math.abs(gmax / 255 - data.gasMax(D)) < 1e-9 && Math.abs(gmax / 255 - 0.518) < 0.001, `gas saturation reaches ${(gmax / 255).toFixed(3)} (data.gasMax ${data.gasMax(D).toFixed(3)}), inside the scale's 0.6`);
  const c = { poro: statics.PORO.filter((v) => v < 0.1).length, pxl: statics.PERMX.filter((v) => v < 1).length, pxh: statics.PERMX.filter((v) => v > 10000).length, pzl: statics.PERMZ.filter((v) => v < 0.1).length, pzh: statics.PERMZ.filter((v) => v > 2000).length };
  ok(c.poro === 364 && c.pxl === 1299 && c.pxh === 1746 && c.pzl === 1164 && c.pzh === 0, `beyond the scales: ${c.poro} cells under 0.1 porosity, ${c.pxl} under 1 and ${c.pxh} over 10 000 mD horizontal permeability, ${c.pzl} under 0.1 and ${c.pzh} over 2 000 mD vertical (ART.md)`);
  const prop = (k) => cfg.properties.find((p) => p.key === k);
  const keys = ['PRESSURE', 'SGAS', 'PERMX', 'PERMZ', 'PORO', 'DEPTH', 'SOIL', 'LAYER'];
  const ends = Object.fromEntries(keys.map((k) => [k, data.openEnds(D, prop(k), data.gasMax(D))]));
  const want = { PRESSURE: [false, false], SGAS: [false, false], PERMX: [true, true], PERMZ: [true, false], PORO: [true, false], DEPTH: [false, false], SOIL: [false, false], LAYER: [false, false] };
  const bad = keys.filter((k) => ends[k].lo !== want[k][0] || ends[k].hi !== want[k][1]);
  ok(bad.length === 0, `openEnds prints open exactly where the data goes past: ${keys.map((k) => `${k} ${ends[k].lo ? '≤' : '-'}${ends[k].hi ? '≥' : '-'}`).join(', ')}`);
}

// 3. The report dates' spacing and the cut, from this test's own sums of model.json's field rates
{
  const F = model.summary.field, fr = model.frames;
  const day = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
  const iv = fr.slice(1).map((s, i) => day(s) - day(fr[i]));
  const per = data.periods(fr, U.dayNumber);
  ok(per.first === iv[0] && iv[0] === 11 && per.min === Math.min(...iv.slice(1)) && per.max === Math.max(...iv.slice(1)) && per.min === 86 && per.max === 100 && per.word === 'quarter' && per.perYear === 4,
    `the report dates: the first interval ${iv[0]} days, then ${Math.min(...iv.slice(1))} to ${Math.max(...iv.slice(1))} (periods: ${per.first}, ${per.min} to ${per.max}, typical ${per.typical}, "${per.word}", ${per.perYear} a year)`);
  const liq = F.oil.map((o, i) => o + F.water[i]);
  let pk = 0; for (let i = 1; i < NF; i++) if (liq[i] > liq[pk]) pk = i;
  const cross = fr.findIndex((_, i) => i > 0 && F.water[i] > F.oil[i]);
  const stays = fr.slice(cross).filter((_, j) => F.water[cross + j] > F.oil[cross + j]).length;
  let co = 0, cw = 0, days = 0;
  for (let i = 1; i < NF; i++) { const dd = iv[i - 1]; co += F.oil[i] * dd; cw += F.water[i] * dd; days += dd; }
  ok(Math.round(liq[pk]) === 10779 && fr[pk] === '2011-01-05', `peak liquid ${Math.round(liq[pk])} Sm³/d in the quarter to ${fr[pk]}, ${Math.round(F.oil[pk])} oil and ${Math.round(F.water[pk])} water`);
  ok(fr[cross] === '2010-07-09' && stays === NF - cross && stays === 26, `water passes oil first in the quarter to ${fr[cross]} and stays above it in ${stays} of the ${NF - cross} from there`);
  ok(Math.round((100 * F.water[NF - 1]) / liq[NF - 1]) === 78, `the last quarter: oil ${Math.round(F.oil[NF - 1])}, water ${Math.round(F.water[NF - 1])}, ${Math.round((100 * F.water[NF - 1]) / liq[NF - 1])} % water`);
  ok(days === 3197 && Math.abs(co - check.field.FOPT.ours) / check.field.FOPT.ours < 1e-5 && Math.abs(cw - check.field.FWPT.ours) / check.field.FWPT.ours < 1e-5,
    `the averages summed over the ${days} days give ${(co / 1e6).toFixed(2)} million Sm³ of oil and ${(cw / 1e6).toFixed(2)} of water, the run's own totals in validation.json (${check.field.FOPT.ours}, ${check.field.FWPT.ours}): each rate is the average over the interval to its date`);
  const series = data.cutSeries(model, U.dayNumber), facts = data.cutFacts(series);
  const same = series.every((s, i) => s.oil === F.oil[i] && s.water === F.water[i] && s.d1 === day(fr[i]) && s.d0 === day(fr[Math.max(0, i - 1)]));
  ok(same && series[0].liquid === 0 && series[1].liquid === 0, `cutSeries: ${series.length} columns, each the interval to its date (d0 the date before); nothing lifted at the run's start (${fr[0]}) or in its first 11 days`);
  ok(facts.peak.f === pk && facts.cross.f === cross && facts.stays === 26 && facts.of === 26, `cutFacts: peak ${facts.peak.iso}, crossover ${facts.cross.iso}, ${facts.stays} of ${facts.of}`);
}

// 4. js/units.js against a table written here
{
  const N = ' ', M = '−';
  const table = [
    [U.int(7361.1), `7${N}361`], [U.int(10778.7), `10${N}779`], [U.int(950), '950'], [U.fixed(-3.45, 1), `${M}3.5`], [U.fixed(-0.001, 2), '0.00'],
    [U.liquid(7361.1, 'SI'), `7${N}361${N}Sm³/d`], [U.liquid(7361.1, 'US'), `46${N}300${N}bbl/d`], [U.gas(412000, 'SI'), `412${N}000${N}Sm³/d`], [U.gas(412000, 'US'), `14${N}550${N}Mscf/d`],
    [U.valueWithUnit({ unit: 'bar' }, 287.4, 'SI'), `287${N}bar`], [U.valueWithUnit({ unit: 'bar' }, 287.4, 'US'), `4${N}168${N}psi`], [U.valueWithUnit({ unit: 'm' }, 2763.2, 'SI'), `2${N}763${N}m`],
    [U.valueWithUnit({ unit: 'm' }, 2763.2, 'US'), `9${N}066${N}ft`], [U.valueWithUnit({ unit: 'mD' }, 1234.5, 'US'), `1${N}235${N}mD`], [U.valueWithUnit({ unit: 'mD' }, 4.56, 'SI'), `4.6${N}mD`],
    [U.valueWithUnit({ unit: 'mD' }, 0.456, 'SI'), `0.46${N}mD`], [U.valueWithUnit({ unit: '', decimals: 2 }, 0.623, 'SI'), '0.62'], [U.valueWithUnit({ unit: '', decimals: 3 }, 0.2346, 'US'), '0.235'],
    [U.date('2016-10-01'), '1 Oct 2016'], [U.month('2007-12-31'), 'Dec 2007'], [U.spokenDate('2010-07-09'), '9 July 2010'], [U.spokenMonth('2007-12-31'), 'December 2007'],
    [U.lead(0), 'Start of the run'], [U.lead(11), '11 days into the run'], [U.lead(3197), '8.8 years into the run'],
    [U.length(3000, 'SI'), `3${N}km`], [U.length(750, 'SI'), `750${N}m`], [U.length(2 * 1609.344, 'US'), `2${N}mi`], [U.length(2000 / 3.28084, 'US'), `2${N}000${N}ft`],
    [U.exactLength(12.5, 'SI'), `12.5${N}m`], [U.exactLength(62.5, 'SI'), `62.5${N}m`], [U.exactLength(12.5, 'US'), `41.0${N}ft`], [U.exactLength(62.5, 'US'), `205.1${N}ft`], [U.exactLength(25, 'SI'), `25${N}m`],
    [U.times(3), '×3'], [U.times(2.5), '×2.5'], [U.percent(0.7796), `78${N}%`], [U.tick(0.105), '0.105'], [U.tick(10000), `10${N}000`],
    [U.spokenUnits(`oil 7${N}361${N}Sm³/d, ${U.percent(0.69)}`), 'oil 7361 standard cubic meters a day, 69 percent'], [U.spokenUnits(`4${N}168${N}psi`), '4168 pounds per square inch'],
  ];
  const bad = table.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${table.length} cases (U+202F before units and in thousands, U+2212, no negative zero, dates by hand, both systems, spoken forms, the lead from the run's start)${bad.length ? ': ' + bad.map(([a, b]) => `got "${a}" want "${b}"`).join('; ') : ''}`);
  const steps = U.scaleSteps('US').map((m) => U.length(m, 'US'));
  ok(steps.every((s) => /^\d[\d ]*(\.\d+)? (ft|mi)$/.test(s)), `the US scale bar's lengths are round feet or miles (${steps.length} of them, ${steps.slice(0, 3).join(', ')} … ${steps.slice(-2).join(', ')})`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
