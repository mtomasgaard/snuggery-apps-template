// The decode test for World Oil & Gas (HOUSE.md section 7.3; step 22 of the pass's change list, in
// tools/DECISIONS.md). Node, no dependencies. The shipped data is decoded here with formulas written in
// this file (Google's polyline algorithm, the series, the Ledger's rule-B partition, the field years) and
// js/data.js and js/units.js are compared with it, so a bug in the app cannot agree with itself. It also
// pins the two data bugs this pass fixed: B1 (a cumulative total held past its series' end) and B5
// (undated fields placed in their data year, never in every year), and plan 0012's former states on the
// map (formerUnions: the USSR's color over its successors in 1970, each successor by its own in 1995).
//
//   node tools/test_decode.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../js/data.js';
import * as U from '../js/units.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (f) => JSON.parse(fs.readFileSync(path.join(APP, f), 'utf8'));
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const NN = '\u202F', MINUS = '\u2212';
const world = json('data/world.json'), snap = json('data/snapshot.json'), fieldsFile = json('data/fields.json');
const [Y0, Y1] = snap.years;

/* ── the shapes: the shipped files pass, broken copies are refused with a sentence ── */
ok(D.checkWorld(world) === '' && D.checkSnapshot(snap) === '' && D.checkFields(fieldsFile) === '', 'the three shipped files pass their shape checks');
{
  const broken = [
    [D.checkSnapshot({ ...snap, schema: 2 }), 'schema is 2, expected 1'],
    [D.checkSnapshot({ ...snap, years: [2024] }), '"years" is not [first, last]'],
    [D.checkSnapshot({ ...snap, countries: [{ ...snap.countries[0], oil: [1, -2], gas: [1, 2] }] }), /holds a value that is not a number ≥ 0 or null/],
    [D.checkWorld({ ...world, factor: 0 }), '"factor" is missing or not a positive number'],
    [D.checkWorld({ ...world, countries: [] }), '"countries" is missing or empty'],
    [D.checkFields({ schema: 1, available: true }), '"available" is true but "fields" is not a list'],
    [D.checkFields([]), 'schema is undefined, expected 1'],
  ];
  const bad = broken.filter(([got, want]) => (want instanceof RegExp ? !want.test(got) : got !== want));
  ok(bad.length === 0, `broken copies are refused with their sentence (${broken.length} cases)${bad.length ? ': ' + bad.map((b) => `"${b[0]}"`).join(' | ') : ''}`);
}

/* ── polylines: Google's algorithm, written here again, on every country ring ── */
function decode(str, factor) {
  const out = []; let i = 0, a = 0, b = 0;
  const num = () => { let r = 0, s = 0, c; do { c = str.charCodeAt(i++) - 63; r |= (c & 31) << s; s += 5; } while (c >= 32); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < str.length) { a += num(); b += num(); out.push(a / factor, b / factor); }
  return out;
}
{
  let rings = 0, points = 0, diff = 0;
  for (const c of world.countries) for (const r of c.rings) {
    const mine = decode(r, world.factor), theirs = D.decodePolyline(r, world.factor);
    rings++; points += mine.length / 2;
    if (mine.length !== theirs.length || mine.some((v, i) => v !== theirs[i])) diff++;
  }
  let threw = '';
  try { D.decodePolyline('_p~iF~ps|U_', 1e5); } catch (e) { threw = e.message; }
  ok(diff === 0 && threw === 'a ring ends in the middle of a number', `decodePolyline equals this file's decoder on all ${rings} country rings (${points} points); a cut ring throws "${threw}"`);
}

/* ── the series ── */
const prod = D.buildProd(snap);
const by = new Map(snap.countries.map((c) => [c.iso3, c]));
const at = (c, m, y) => {
  const i = y - c.y0;
  if (i < 0 || i >= c.oil.length) return null;
  const o = c.oil[i], g = c.gas[i];
  if (m === 'oil') return o;
  if (m === 'gas') return g;
  return o == null && g == null ? null : (o || 0) + (g || 0);
};
const lastYear = (c) => { let l = null; for (let i = 0; i < c.oil.length; i++) if (c.oil[i] != null || c.gas[i] != null) l = c.y0 + i; return l; };
/** The total to year y: every year from the first with a figure added up, null before the first. */
function cumMine(c, m, y) {
  let t = 0, any = false;
  for (let k = c.y0; k <= y; k++) { const v = at(c, m, k); if (v != null) { t += v; any = true; } }
  return any ? t : null;
}
{
  const sample = ['USA', 'NOR', 'SAU', 'RUS', 'OWID_USS', 'FRA', 'ESP', 'SWE', 'IRL', 'DEU', 'NLD', 'GBR', 'QAT', 'CHN', 'OWID_YGS'];
  let n = 0, bad = [];
  for (const iso of sample) {
    const c = by.get(iso);
    for (const m of ['oil', 'gas', 'total']) for (let y = Y0; y <= Y1; y += 3) {
      const a = D.valueAt(prod, c, m, y, false).v, b = at(c, m, y);
      const ca = D.valueAt(prod, c, m, y, true).v, cb = cumMine(c, m, y);
      n += 2;
      if (a !== b) bad.push(`${iso} ${m} ${y} annual ${a} vs ${b}`);
      if (!(ca === cb || Math.abs(ca - cb) < 1e-6 * Math.max(1, cb))) bad.push(`${iso} ${m} ${y} cumulative ${ca} vs ${cb}`);
    }
  }
  ok(bad.length === 0, `valueAt for ${sample.length} series, three modes, annual and cumulative, every third year: ${n} values equal this file's${bad.length ? ': ' + bad.slice(0, 4).join('; ') : ''}`);
  const w = by.get('USA') && snap.world;
  let wbad = 0;
  for (const m of ['oil', 'gas', 'total']) for (let y = Y0; y <= Y1; y++) {
    if (D.worldAt(prod, m, y, false).v !== at(w, m, y)) wbad++;
    if (Math.abs(D.worldAt(prod, m, y, true).v - cumMine(w, m, y)) > 1e-6 * cumMine(w, m, y)) wbad++;
  }
  ok(wbad === 0, `worldAt equals the file's World series (${snap.world.iso3}) in every year and mode, annual and cumulative`);
}
// B1: a series that has ended keeps its total in Cumulative
{
  const ended = snap.countries.filter((c) => lastYear(c) != null && lastYear(c) < Y1);
  const by16 = ended.filter((c) => lastYear(c) === 2016).length;
  const held = ended.filter((c) => { const l = lastYear(c); return ['oil', 'gas', 'total'].every((m) => D.valueAt(prod, c, m, Y1, true).v === D.valueAt(prod, c, m, l, true).v && (cumMine(c, m, l) == null || D.valueAt(prod, c, m, Y1, true).v != null)); });
  const four = ['FRA', 'ESP', 'SWE', 'IRL'].map((iso) => { const c = by.get(iso); return [iso, D.valueAt(prod, c, 'total', 2024, true).v, D.valueAt(prod, c, 'total', 2016, true).v]; });
  const fra = four[0][1] / 1e6;
  ok(held.length === ended.length && four.every(([, a, b]) => a != null && a === b) && Math.abs(fra - 4.08) < 0.005,
    `B1: all ${ended.length} series that end before ${Y1} (${by16} of them in 2016) hold their total to ${Y1}; France, Spain, Sweden and Ireland to 2024 equal their totals to 2016 (France ${fra.toFixed(2)} PWh)`);
  ok(D.valueAt(prod, by.get('FRA'), 'total', 2024, false).v === null, 'B1: the annual figure past a series\' end is still "no figure" (France, 2024)');
}

/* ── the Ledger: this file's own rule-B partition against ledgerAt ── */
const LEAD = { OWID_USS: 'RUS', OWID_CZS: 'CZE', OWID_YGS: 'SRB' };
const MEMBERS = { OWID_USS: ['RUS', 'UKR', 'BLR', 'KAZ', 'UZB', 'TKM', 'AZE', 'GEO', 'ARM', 'KGZ', 'TJK', 'MDA', 'LTU', 'LVA', 'EST'], OWID_CZS: ['CZE', 'SVK'], OWID_YGS: ['SRB', 'HRV', 'SVN', 'BIH', 'MKD', 'MNE', 'OWID_KOS', 'KOS'] };
const stateOf = {};
for (const [s, ms] of Object.entries(MEMBERS)) for (const m of ms) stateOf[m] = s;
function counted(c, m, y) {
  const v = at(c, m, y);
  if (!v) return 0;
  if (LEAD[c.iso3] && at(by.get(LEAD[c.iso3]), m, y) != null) return 0;
  const f = stateOf[c.iso3];
  if (f && by.has(f) && at(by.get(f), m, y) != null && at(by.get(LEAD[f]), m, y) == null) return 0;
  return v;
}
const hist = snap.historical || {};
const nameOf = (c) => (hist[c.iso3] || c.name).split(' (')[0];
function partition(m, y, cum) {
  const w = cum ? cumMine(snap.world, m, y) : at(snap.world, m, y);
  const vals = [];
  for (const c of snap.countries) {
    let v = 0;
    if (cum) for (let k = Y0; k <= y; k++) v += counted(c, m, k); else v = counted(c, m, y);
    if (v > 0) vals.push([v, c]);
  }
  vals.sort((a, b) => b[0] - a[0]);
  const tot = vals.reduce((s, [v]) => s + v, 0), scale = Math.max(w, tot);
  const blocks = vals.filter(([v]) => v / w >= 0.01).map(([v, c]) => ({ iso3: c.iso3, name: nameOf(c), share: v / w, width: v / scale }));
  return { w, tot, blocks, rest: Math.max(0, 1 - blocks.reduce((s, b) => s + b.width, 0)) };
}
const YEARS = [1900, 1920, 1950, 1973, 1985, 1991, 2000, 2016, 2017, 2024];
{
  let n = 0;
  const bad = [];
  for (const cum of [false, true]) for (const m of ['total', 'oil', 'gas']) for (const y of YEARS) {
    const mine = partition(m, y, cum), L = D.ledgerAt(prod, m, cum, y);
    n++;
    const same = L.blocks.length === mine.blocks.length && L.blocks.every((b, i) => b.iso3 === mine.blocks[i].iso3 && Math.abs(b.share - mine.blocks[i].share) < 1e-9 && Math.abs(b.width - mine.blocks[i].width) < 1e-9)
      && Math.abs(L.rest - mine.rest) < 1e-9 && Math.abs(L.listed - mine.tot / mine.w) < 1e-9;
    if (!same) bad.push(`${cum ? 'cumulative' : 'annual'} ${m} ${y}: ${L.blocks.length} vs ${mine.blocks.length}`);
  }
  ok(bad.length === 0, `ledgerAt equals this file's rule-B partition at ${YEARS.length} years in all six mode and accumulation pairs (${n} cases: the blocks, their order, shares, widths and the hatched end)${bad.length ? ': ' + bad.slice(0, 4).join('; ') : ''}`);
  const counts = [1900, 1920, 1950, 1973, 2024].map((y) => D.ledgerAt(prod, 'total', false, y).blocks.length);
  const us = [1900, 1920, 1950, 1973, 2024].map((y) => (D.ledgerAt(prod, 'total', false, y).blocks.find((b) => b.iso3 === 'USA').share * 100).toFixed(1));
  ok(counts.join(',') === '4,5,9,15,21' && us.join(',') === '55.9,68.7,61.4,26.3,21.6',
    `the Ledger's figures in ART.md: oil and gas, annual, 1900/1920/1950/1973/2024: ${counts.join(', ')} blocks; the United States ${us.join(', ')} %`);
  const cumUS = D.ledgerAt(prod, 'total', true, 2024).blocks[0], ussr = D.ledgerAt(prod, 'total', true, 2024).blocks.find((b) => b.iso3 === 'OWID_USS');
  ok(cumUS.iso3 === 'USA' && (cumUS.share * 100).toFixed(1) === '21.6' && ussr && ussr.name === 'USSR to 1984',
    `Cumulative 2024: the United States holds ${(cumUS.share * 100).toFixed(1)} % of all the oil and gas produced; the former state's block is labeled "${ussr && ussr.name}"`);
  // the counted sum against the world, every year and mode: the strip never overflows, the hatched end never negative
  let lo = Infinity, hi = -Infinity, neg = 0;
  for (const cum of [false, true]) for (const m of ['total', 'oil', 'gas']) for (let y = Y0; y <= Y1; y++) {
    const L = D.ledgerAt(prod, m, cum, y);
    if (!L.world) continue;
    lo = Math.min(lo, L.listed); hi = Math.max(hi, L.listed);
    if (L.rest < 0 || L.blocks.reduce((s, b) => s + b.width, 0) > 1 + 1e-12) neg++;
  }
  ok((lo * 100).toFixed(2) === '98.14' && (hi * 100).toFixed(2) === '100.64' && neg === 0, `rule B over every year, mode and accumulation: the counted sum is ${(lo * 100).toFixed(2)} % to ${(hi * 100).toFixed(2)} % of the world (ART.md: 98.14 to 100.64); the strip never overflows`);
  // the first block's holders, oil and gas, annual (ART.md section 1)
  const runs = [];
  for (let y = Y0; y <= Y1; y++) {
    const first = partition('total', y, false).blocks[0], L = D.ledgerAt(prod, 'total', false, y).blocks[0];
    if (first.iso3 !== L.iso3) runs.push(`MISMATCH ${y}`);
    if (!runs.length || runs[runs.length - 1][0] !== first.name) runs.push([first.name, y, y]); else runs[runs.length - 1][2] = y;
  }
  const story = runs.map((r) => (Array.isArray(r) ? `${r[0]} ${r[1]}–${r[2]}` : r)).join(', ');
  ok(story === 'United States 1900–1979, USSR 1980–1984, Russia 1985–1993, United States 1994–2000, Russia 2001–2013, United States 2014–2024', `the first block's holders: ${story}`);
}

/* ── the fields: B5, and the years every unit appears and fills ── */
{
  const F = D.buildFields(fieldsFile);
  D.fieldYears(F, Y0, Y1);
  const undated = F.points.filter((p) => p.disc == null && p.start == null);
  const wrong = undated.filter((p) => p.appear !== p.fill || p.appear !== (p.prodYear != null ? Math.min(Y1, Math.max(Y0, p.prodYear - 1)) : Y1));
  const in1906 = undated.filter((p) => p.appear <= 1906).length;
  const op = undated.filter((p) => p.operating).length;
  const found1906 = F.points.filter((p) => !p.undated && p.appear <= 1906).length;
  ok(undated.length === 1748 && op === 1628 && wrong.length === 0 && in1906 === 0 && F.points.every((p) => Number.isFinite(p.appear) || p.appear === Infinity),
    `B5: ${undated.length} undated units (${op} operating) each appear, filled, the year before their data year (or ${Y1} without one); none in 1906, where ${found1906} dated units are found; no unit at −Infinity`);
  const dated = F.points.filter((p) => !p.undated);
  const rule = dated.filter((p) => {
    const d = p.disc, s = p.start;
    if (s != null) return p.appear === (d == null ? s : Math.min(d, s)) && p.fill === s;
    return p.appear === d && p.fill === (!p.operating ? Infinity : p.v != null ? d : Math.max(d, Math.min(p.prodYear ?? Y1, Y1)));
  });
  ok(rule.length === dated.length, `the ${dated.length} dated units follow the stock rules (a ring from discovery, filled from production start)`);
  const E = D.estimate(prod, F, 'total');
  const troll = F.points.find((p) => p.norm.startsWith('troll oil and gas'));
  const ratio = (y) => Math.min(3, Math.max(0, at(by.get('NOR'), 'total', y) / at(by.get('NOR'), 'total', troll.prodYear)));
  ok(E.n > 4000 && Math.abs(D.estRate(prod, troll, 2000) - troll.v * ratio(2000)) < 1e-6 && D.estRate(prod, troll, 1990) === 0,
    `the estimate: ${E.n} units sized through time; Troll in 2000 = its reported ${troll.v} boe/d × Norway's 2000 / ${troll.prodYear} output (${ratio(2000).toFixed(3)}), and 0 before its start in ${troll.start}`);
}

/* ── js/units.js against a table ── */
{
  const T = [
    [U.group('16380'), `16${NN}380`], [U.fixed(-3.21, 1), `${MINUS}3.2`], [U.fixed(-0.04, 1), '0.0'], [U.int(94076), `94${NN}076`],
    [U.sig3(94076), `94${NN}100`], [U.sig3(4059.4), `4${NN}060`], [U.sig3(0.7123), '0.712'], [U.sig3(1.0234e6), '1.02 million'], [U.sig3(120.3e6), '120 million'], [U.sig3(94076, true), '94100'],
    [U.tick(0.05), '0.05'], [U.tick(2), '2'], [U.tick(20000), `20${NN}000`], [U.pct(21.55), `21.6${NN}%`], [U.pct(0.02), `under 0.1${NN}%`], [U.pctSpoken(13.4), '13.4 percent'],
    [U.ordinal(1), '1st'], [U.ordinal(11), '11th'], [U.ordinal(22), '22nd'], [U.ordinal(103), '103rd'],
    [U.withUnit(U.sig3(U.toUnit(94076e3, 'twh', false, 588441)), 'TWh/yr'), `94${NN}100${NN}TWh/yr`],
    [U.sig3(U.toUnit(94076e3, 'kboe', false, 588441)), `152${NN}000`],
    [U.sig3(U.toUnit(4059e6, 'twh', true, 588441)), `4${NN}060`],
    [U.field(57000, 'oil', 'si'), `9${NN}060${NN}Sm³/d`], [U.field(57000, 'oil', 'field'), `57${NN}000${NN}bbl/d`],
    [U.field(754000, 'gas', 'si'), `120 million${NN}Sm³/d`], [U.fieldBoth(811000, 'oe', 'si'), `129${NN}000${NN}Sm³ o.e./d (811${NN}000${NN}boe/d)`],
    [U.field(112e6, 'oil', 'si', false), `17.8 million${NN}Sm³`], [U.fieldSpoken(811000, 'oe', 'si'), '129000 standard cubic meters of oil equivalent a day'],
  ];
  const bad = T.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${T.length} values in the house's forms (U+202F, the true minus, three figures, open ends, ordinals, both systems, spoken)${bad.length ? ': ' + bad.map(([a, b]) => `"${a}" ≠ "${b}"`).join(' | ') : ''}`);
  const ms = Date.parse(snap.generatedAt), d = new Date(ms);
  const full = U.full(ms), stamp = U.when(ms, ms + 3 * 864e5), same = U.when(ms, ms + 1000);
  ok(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}, \d\d:\d\d \(UTC([+\u2212]\d{1,2}(:\d\d)?)?\)$/.test(full) && full.includes(`${d.getDate()} `)
    && stamp === `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` && /^\d\d:\d\d$/.test(same)
    && U.when(ms, ms + 400 * 864e5).includes(` ${d.getFullYear()},`),
  `dates by hand, the same on every locale: About "${full}", the stamp "${stamp}" (another day), "${same}" (today), with the year once it is another year`);
}

/* ── the former states on the map (plan 0012, 3.2): formerUnions against this file's own rule ── */
{
  const prod = D.buildProd(snap);
  const by = new Map(snap.countries.map((c) => [c.iso3, c]));
  // a figure, written here again: the year's value, or the running total to it from the first figure
  const fig = (c, m, y, cum) => {
    if (!c) return null;
    let t = null;
    for (let k = cum ? c.y0 : y; k <= y; k++) {
      const i = k - c.y0;
      if (i < 0 || i >= c.oil.length) continue;
      const o = c.oil[i], g = c.gas[i], v = m === 'oil' ? o : m === 'gas' ? g : o == null && g == null ? null : (o || 0) + (g || 0);
      if (v != null) t = (t || 0) + v;
    }
    return t;
  };
  const LEAD = { OWID_USS: 'RUS', OWID_CZS: 'CZE', OWID_YGS: 'SRB' };
  const MEM = {
    OWID_USS: ['RUS', 'UKR', 'BLR', 'KAZ', 'UZB', 'TKM', 'AZE', 'GEO', 'ARM', 'KGZ', 'TJK', 'MDA', 'LTU', 'LVA', 'EST'],
    OWID_CZS: ['CZE', 'SVK'], OWID_YGS: ['SRB', 'HRV', 'SVN', 'BIH', 'MKD', 'MNE', 'OWID_KOS', 'KOS'],
  };
  // the rule: a former state with a figure whose lead member has none, over the members with no figure above zero
  const mine = (m, cum, y) => Object.keys(LEAD).filter((st) => fig(by.get(st), m, y, cum) != null && fig(by.get(LEAD[st]), m, y, cum) == null)
    .map((st) => ({ state: st, v: fig(by.get(st), m, y, cum), members: MEM[st].filter((i) => !(fig(by.get(i), m, y, cum) > 0)) })).filter((u) => u.members.length);
  let n = 0;
  const bad = [];
  for (const cum of [false, true]) for (const m of ['total', 'oil', 'gas']) for (let y = Y0; y <= Y1; y++) {
    n++;
    const a = JSON.stringify(D.formerUnions(prod, m, cum, y)), b = JSON.stringify(mine(m, cum, y));
    if (a !== b) bad.push(`${m} ${cum ? 'cumulative' : 'annual'} ${y}`);
  }
  ok(bad.length === 0, `formerUnions equals this file's rule in every year, mode and accumulation (${n} cases)${bad.length ? ': ' + bad.slice(0, 5).join(', ') : ''}`);
  const u70 = D.formerUnions(prod, 'total', false, 1970), ussr = u70.find((u) => u.state === 'OWID_USS');
  ok(ussr && ussr.members.length === 15 && ussr.v === fig(by.get('OWID_USS'), 'total', 1970, false) && u70.map((u) => u.state).join() === 'OWID_USS,OWID_CZS,OWID_YGS'
    && D.formerUnions(prod, 'total', true, 1970).find((u) => u.state === 'OWID_USS').v === fig(by.get('OWID_USS'), 'total', 1970, true),
  `1970: the USSR holds the figure (${ussr && ussr.v} GWh) over all ${ussr && ussr.members.length} successors, Ukraine's zero gas included; Czechoslovakia and Yugoslavia too; Cumulative 1970 the USSR's total to then`);
  const u95 = [...D.formerUnions(prod, 'total', false, 1995), ...D.formerUnions(prod, 'total', true, 1995), ...D.formerUnions(prod, 'total', true, 2024)];
  ok(u95.length === 0 && D.formerUnions(prod, 'total', false, 1984).some((u) => u.state === 'OWID_USS') && !D.formerUnions(prod, 'total', false, 1985).some((u) => u.state === 'OWID_USS')
    && D.formerUnions(prod, 'total', false, 1992).some((u) => u.state === 'OWID_CZS') && !D.formerUnions(prod, 'total', false, 1993).length,
  'never over a member that reports: none in 1995 (Annual and Cumulative) or Cumulative 2024; the USSR to 1984 and not from 1985 (Russia\'s first year), Czechoslovakia to 1992');
}

/* ── the credit line ── */
{
  const line = D.creditLine([...snap.sources.map((s) => s.attribution), fieldsFile.source.attribution, 'Relief: Natural Earth I (public domain)']);
  const deep = D.creditLine([...snap.sources.map((s) => s.attribution), fieldsFile.source.attribution, 'Bathymetry: GEBCO']);
  ok(line === 'Sources: Energy Institute via Our World in Data · Natural Earth · Global Energy Monitor' && deep === `${line} · GEBCO`,
    `creditLine: "${line}" (the stock app's words; Natural Earth once, however many layers credit it); with Depth shading on, "… · GEBCO"`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
