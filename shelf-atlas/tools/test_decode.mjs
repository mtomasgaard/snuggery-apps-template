// The decode test (HOUSE.md section 7.3; step 21 of the pass's change list, in tools/DECISIONS.md).
// Node, no dependencies. data/ is decoded here with formulas written in this file (base64 uint16 series,
// Google polylines, the running maximum, the Latin-1 round trip) and compared with js/data.js; js/units.js
// is checked against a table written here. An art pass changes no decoding; this proves it did not.
//
//   node tools/test_decode.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../js/data.js';
import * as U from '../js/units.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snap = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(path.join(APP, 'data/geo.json'), 'utf8'));
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const NN = '\u202f';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mon = (m) => `${MON[m % 12]} ${1971 + Math.floor(m / 12)}`;
const days = (m) => new Date(Date.UTC(1971 + Math.floor(m / 12), (m % 12) + 1, 0)).getUTCDate();
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

/* ── this file's own decode ── */
const series = (s) => { const b = Buffer.from(s.b64, 'base64'); const out = []; for (let i = 0; i + 1 < b.length; i += 2) out.push(b.readUInt16LE(i) * s.scale); return { start: s.start, v: out }; };
const own = new Map(snap.fields.map((f) => [f.id, { f, liq: f.liq ? series(f.liq) : null, gas: f.gas ? series(f.gas) : null }]));
const at = (S, m) => (S && m >= S.start && m < S.start + S.v.length ? S.v[m - S.start] : 0);
const ownMonthly = (id, q, m) => { const o = own.get(id); return q === 'oe' ? at(o.liq, m) + at(o.gas, m) / 1000 : at(o[q], m); };
const ownCum = (id, q, m) => { let s = 0; for (let k = 0; k <= m; k++) s += ownMonthly(id, q, k); return s; };
const polyline = (str, factor) => {
  const pts = []; let i = 0, x = 0, y = 0;
  while (i < str.length) {
    const d = [];
    for (let c = 0; c < 2; c++) { let sh = 0, r = 0, b; do { b = str.charCodeAt(i++) - 63; r |= (b & 31) << sh; sh += 5; } while (b >= 32); d.push(r & 1 ? ~(r >> 1) : r >> 1); }
    x += d[0]; y += d[1]; pts.push([x / factor, y / factor]);
  }
  return pts;
};

/* 1. The shipped files pass the app's own shape checks; broken ones are named */
ok(D.validateGeo(geo) === null && D.validateSnap(snap) === null, 'data/geo.json and data/snapshot.json pass validateGeo and validateSnap');
ok(/schema is 2/.test(D.validateSnap({ ...snap, schema: 2 })) && /not a JSON object/.test(D.validateGeo([])) && /lastMonth/.test(D.validateSnap({ ...snap, lastMonth: 'x' })),
  'a wrong schema, a list and a bad lastMonth are each named');

/* 2. Series: js/data.js decodeSeries against this file's decode, every field */
{
  let n = 0, bad = 0;
  for (const f of snap.fields) for (const q of ['liq', 'gas']) {
    if (!f[q]) continue;
    const [v, pre] = D.decodeSeries(f[q], f.id), o = series(f[q]);
    n++;
    if (v.length !== o.v.length || o.v.some((x, i) => Math.abs(v[i] - x) > Math.max(1e-3, x * 1e-6)) || !near(pre[pre.length - 1], o.v.reduce((a, b) => a + b, 0))) bad++;
  }
  ok(n > 1500 && bad === 0, `decodeSeries equals this file's base64 uint16 × scale for all ${n} series, prefix sums included (${bad} differ)`);
}

/* 3. The model: monthly, cumAt, the reporting months, every cross-border unit */
const M = D.buildModel(snap);
{
  const sample = [...snap.fields.filter((f, i) => i % 37 === 0), ...snap.fields.filter((f) => f.group)];
  let bad = 0;
  for (const f of sample) {
    const F = M.byId.get(f.id);
    const ms = [F.first ?? 0, Math.floor(((F.first ?? 0) + (F.end ?? 1)) / 2), (F.end ?? 1) - 1, M.lastMonth];
    for (const q of ['liq', 'gas', 'oe']) for (const m of ms) {
      if (!near(D.monthly(F, q, m), ownMonthly(f.id, q, m)) || Math.abs(D.cumAt(F, q, m) - ownCum(f.id, q, m)) > 1e-6 * Math.max(1, ownCum(f.id, q, m)) + 1) bad++;
    }
  }
  ok(bad === 0, `monthly and cumAt equal this file's sums for ${sample.length} fields (every 37th and every cross-border member) at the first, a middle and the last month, three quantities (${bad} differ)`);
  const last = {}, first = {};
  for (const [, o] of own) for (const S of [o.liq, o.gas]) {
    if (!S) continue;
    const c = o.f.country;
    last[c] = Math.max(last[c] ?? -1, S.start + S.v.length - 1);
    first[c] = Math.min(first[c] ?? 1e9, S.start);
  }
  ok(JSON.stringify(M.ccLast) === JSON.stringify(Object.fromEntries(Object.keys(M.ccLast).map((c) => [c, last[c]])))
    && Object.keys(first).every((c) => M.ccFirst[c] === first[c]),
  `reporting months: ${D.CC.map((c) => `${c} ${mon(M.ccFirst[c])} to ${mon(M.ccLast[c])}`).join(', ')}`);
  ok(M.ccFirst.UK === (1975 - 1971) * 12 + 5 && M.ccFirst.NL === (2003 - 1971) * 12 && M.defaultMonth === (2026 - 1971) * 12 + 6 && D.commonMonth(M, { NO: true, UK: true, DK: true, NL: true }) === M.defaultMonth,
    `About's claims hold: the UK series starts in ${mon(M.ccFirst.UK)}, the Dutch in ${mon(M.ccFirst.NL)}; the player opens and play stops at ${mon(M.defaultMonth)}`);
  const dk = snap.fields.filter((f) => D.isInt(f.monthlyFrom));
  ok(dk.length > 0 && dk.every((f) => f.country === 'DK' && f.monthlyFrom === (2018 - 1971) * 12), `About's claim holds: ${dk.length} fields carry monthlyFrom, all Danish, all ${mon((2018 - 1971) * 12)}`);
  const tern = own.get('UK-TERN');
  const tg = tern.gas.v.map((v, i) => [v, tern.gas.start + i]).sort((a, b) => b[0] - a[0]);
  ok(Math.floor(tg[0][1] / 12) + 1971 === 2000 && Math.floor(tg[1][1] / 12) + 1971 === 2000 && tg[1][0] > 50 * tg[2][0],
    `About's claim holds: Tern's two largest gas months are ${mon(tg[0][1])} and ${mon(tg[1][1])}, ${Math.round(tg[1][0] / tg[2][0])} times its third`);
  ok(M.groups.length === snap.groups.length && M.units.length === snap.fields.length - snap.groups.reduce((n, g) => n + g.members.length, 0) + snap.groups.length,
    `${M.units.length} units: ${snap.fields.length} fields, ${M.groups.length} cross-border units each counted once`);
}

/* 4. The Peaks against this file's running maximum, every unit and quantity, at three months */
{
  const all = { NO: true, UK: true, DK: true, NL: true };
  const rep = (c, m) => M.ccFirst[c] != null && m >= M.ccFirst[c] && m <= M.ccLast[c];
  const want = { liq: { 173: 33, 353: 129, 666: 205 } };
  const counts = {};
  let bad = 0;
  for (const q of ['liq', 'gas', 'oe']) {
    const floor = M.hi[q] * (3 / 17) ** 2;
    counts[q] = {};
    for (const Un of M.units) {
      const R = D.bestRecords(M, Un, q, all);
      let best = 0, bm = -1;
      for (let m = 0; m <= M.lastMonth; m++) {
        if (!Un.members.every((F) => rep(F.cc, m))) { if (m === 173 || m === 353 || m === 666) check(m); continue; }
        const v = Un.members.reduce((a, F) => a + ownMonthly(F.id, q, m), 0) / days(m);
        if (v > best) { best = v; bm = m; }
        if (m === 173 || m === 353 || m === 666) check(m);
      }
      function check(m) {
        const k = D.bestAt(R, m);
        const app = k < 0 ? null : [R.v[k], R.m[k]];
        if ((app === null) !== (bm < 0) || (app && (!near(app[0], best) || app[1] !== bm))) bad++;
        if (bm >= 0 && best >= floor) counts[q][m] = (counts[q][m] || 0) + 1;
      }
    }
  }
  ok(bad === 0, `bestRecords and bestAt equal this file's running maximum for ${M.units.length} units × 3 quantities × 3 months (${bad} differ)`);
  ok(Object.entries(want.liq).every(([m, n]) => counts.liq[m] === n),
    `rings over the floor in liquids: ${[173, 353, 666].map((m) => `${mon(m)} ${counts.liq[m]}`).join(', ')} (ART.md: 33, 129, 205)`);
  console.log(`     gas ${[173, 353, 666].map((m) => `${mon(m)} ${counts.gas[m]}`).join(', ')}; oil equivalent ${[173, 353, 666].map((m) => `${mon(m)} ${counts.oe[m]}`).join(', ')}`);
  const st = M.units.find((Un) => Un.name === 'Statfjord'), R = D.bestRecords(M, st, 'liq', all), k = D.bestAt(R, 666);
  ok(Math.round(R.v[k]) === 134273 && R.m[k] === (1986 - 1971) * 12 + 10, `Statfjord's best month so far at Jul 2026: ${Math.round(R.v[k])} Sm³/d in ${mon(R.m[k])} (ART.md: 134 273, Nov 1986)`);
  // a cross-border unit is never drawn from one side: with the UK unreported, the unit has no rate
  const g = M.units.find((Un) => Un.kind === 'group' && Un.members.some((F) => F.cc === 'UK') && Un.members.some((F) => F.cc === 'NO'));
  ok(D.unitRateAt(M, g, 'liq', M.ccLast.UK + 1, all) === null && D.unitRateAt(M, g, 'liq', M.ccLast.UK, all) !== null,
    `${g.name}: no rate in ${mon(M.ccLast.UK + 1)}, when the UK has not reported; a rate in ${mon(M.ccLast.UK)}`);
}

/* 5. The name repair (B1). Since the data follow-up (2026-10-02) the pipeline reads each DBF in the encoding
 *    its .cpg declares (UTF-8 for Sodir's three), so the shipped data has nothing to repair: repairText() finds
 *    no string to change. It stays as a guard, and it is tested on garbled samples written here (Sodir's own
 *    names as the Latin-1 read had them) so it keeps working if a double-encoded name ever returns. */
{
  const PAT = /[ÂÃ][\u0080-¿]/;
  const all = [];
  const walk = (v) => { if (typeof v === 'string') all.push(v); else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x); };
  walk(geo); walk(snap);
  let rec = 0, recChanged = 0;
  for (const k of ['pipelines', 'facilities', 'borders']) for (const o of geo[k]) {
    const r = D.repaired(o);
    for (const [key, v] of Object.entries(o)) if (typeof v === 'string') { rec++; if (r[key] !== v) recChanged++; }
  }
  const hits = all.filter((s) => PAT.test(s)).length, changed = all.filter((s) => D.repairText(s) !== s).length;
  ok(hits === 0 && changed === 0 && recChanged === 0,
    `nothing to repair: ${hits} of the ${all.length} strings in data/geo.json and data/snapshot.json carry the double-encoding pattern; repairText changes ${changed} of them, repaired() ${recChanged} of the ${rec} in the pipeline, facility and border records`);
  const G = [['Ã\u0085SGARD A', 'ÅSGARD A'], ['KÃ\u0085RSTÃ\u0098', 'KÅRSTØ'], ['VÃ¥r Energi ASA', 'Vår Energi ASA'],
    ['GJÃ\u0098A', 'GJØA'], ['42" Gas Ã\u0085SGARD ERB, KÃ\u0085RSTÃ\u0098', '42" Gas ÅSGARD ERB, KÅRSTØ'], ['Ã\u0086', 'Æ']];
  const K = ['ÅSGARD A', 'GJØA', 'STATFJORD A', 'Ã', 'Ã\u0085\u0085', 'Ã\u0085 – x', ''];   // right already; a lone Ã; not UTF-8; a character over U+00FF
  const gBad = G.filter(([g, want]) => Buffer.from(g, 'latin1').toString('utf8') !== want || D.repairText(g) !== want || D.repairText(D.repairText(g)) !== want);
  const kBad = K.filter((s) => D.repairText(s) !== s);
  ok(gBad.length === 0 && kBad.length === 0,
    `repairText still repairs: ${G.length} garbled samples written here come back as the Latin-1 round trip gives them ("${D.repairText(G[0][0])}", "${D.repairText(G[1][0])}"), a second pass changes nothing, and ${K.length} other strings stay as they are${gBad.length + kBad.length ? `; wrong: ${[...gBad.map((x) => x[0]), ...kBad].map((s) => JSON.stringify(s)).join(', ')}` : ''}`);
  const asg = geo.facilities.find((f) => f.country === 'NO' && f.name === 'ÅSGARD A');
  const gjoa = geo.facilities.find((f) => f.country === 'NO' && f.name === 'GJØA');
  const karsto = geo.pipelines.filter((p) => p.from === 'KÅRSTØ' || p.to === 'KÅRSTØ').length;
  const vaar = geo.facilities.filter((f) => f.operator === 'Vår Energi ASA').length;
  ok(asg && asg.field === 'ÅSGARD' && gjoa && gjoa.field === 'GJØA' && karsto > 0 && vaar > 0,
    `the names arrive spelled right in data/geo.json itself: the platform "${asg && asg.name}" of the field "${asg && asg.field}", "${gjoa && gjoa.name}" of "${gjoa && gjoa.field}", ${karsto} pipelines to or from "KÅRSTØ", ${vaar} facilities operated by "Vår Energi ASA"`);
}

/* 6. Polylines: decodeLine against this file's decode, a sample of every kind */
{
  let bad = 0, n = 0;
  const lines = [...geo.coast.slice(0, 40), ...geo.borders.flatMap((b) => b.lines), ...geo.pipelines.slice(0, 80).flatMap((p) => p.lines)];
  for (const s of lines) {
    const a = D.decodeLine(s, geo.factor, 'x'), p = polyline(s, geo.factor);
    n++;
    if (a.length !== p.length * 2 || p.some(([x, y], i) => Math.abs(a[2 * i] - x) > 1e-5 || Math.abs(D.unmercY(a[2 * i + 1]) - y) > 1e-4)) bad++;
  }
  ok(bad === 0, `decodeLine equals this file's polyline decode for ${n} lines (coast, every border, 80 pipelines) (${bad} differ)`);
}

/* 7. The credit line, built from the sources */
ok(D.creditLine(snap) === 'Natural Earth · Marine Regions CC BY · EMODnet CC BY · Sodir NLOD · NSTA · Danish Energy Agency · NLOG', `the credit line: "${D.creditLine(snap)}"`);

/* 8. js/units.js against a table written here */
{
  const T = [
    [U.sig3(134273), `134${NN}000`], [U.sig3(985), '985'], [U.sig3(4178.4), `4${NN}180`], [U.sig3(0.7123), '0.712'],
    [U.sig3(42.4), '42.4'], [U.sig3(10.04), '10'], [U.sig3(1019999), '1.02 million'], [U.sig3(82.94e9), '82.9 billion'],
    [U.sig3(408259.7), `408${NN}000`], [U.sig3(134273, true), '134000'], [U.tick(42.43), '42'], [U.tick(134174), `134${NN}000`],
    [U.tick(1000), `1${NN}000`], [U.tick(1e7), '10 million'], [U.tick(713140917), '713 million'], [U.tick(2.5), '2.5'], [U.fixed(-0.04, 1), '0.0'], [U.fixed(-12.5, 1), '−12.5'],
    [U.amount(408259.7, 'liq', 'si', false), `408${NN}000${NN}Sm³/d`], [U.amount(408259.7, 'liq', 'field', false), `2.57 million${NN}bbl/d`],
    [U.amount(1.19e9, 'oe', 'si', true), `1.19 billion${NN}Sm³ o.e.`], [U.amount(1e6, 'gas', 'field', false), `35.3 million${NN}scf/d`],
    [U.amountSpoken(985, 'liq', 'si', false), '985 standard cubic meters a day'], [U.amountSpoken(1000, 'oe', 'field', true), '6290 barrels of oil equivalent'],
    [U.percent(85.47), `85.47${NN}%`], [U.percent(14.53), `14.53${NN}%`], [U.percent(50), `50${NN}%`],
    [U.coord(65.0641, 6.7253), `65.064°${NN}N, 6.725°${NN}E`], [U.coord(53.2, -1.5), `53.200°${NN}N, 1.500°${NN}W`],
    [U.km(1308.4), `1${NN}308${NN}km`], [U.diameter(30, 'si'), `762${NN}mm (30${NN}in)`], [U.diameter(30, 'field'), `30${NN}in (762${NN}mm)`],
    [U.diameter(8.625, 'si'), `219${NN}mm (8.6${NN}in)`], [U.month(665), 'Jun 2026'], [U.monthLong(190), 'November 1986'], [U.month(0), 'Jan 1971'],
    [U.unitOf('oe', 'si', false), 'Sm³ o.e./d'], [U.unitOf('gas', 'field', true), 'scf'],
  ];
  const bad = T.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${T.length} forms as this file writes them${bad.length ? ': ' + bad.map(([a, b]) => `"${a}" (want "${b}")`).join(', ') : ''}`);
  const ms = Date.UTC(2026, 8, 26, 17, 56);
  ok(/^\d\d:\d\d$/.test(U.when(ms, ms)) && /^\d{1,2} Sep, \d\d:\d\d$/.test(U.when(ms, ms + 3 * 864e5)) && /^(Sat|Sun) \d{1,2} Sep 2026, \d\d:\d\d \(UTC([+−]\d{1,2}(:\d\d)?)?\)$/.test(U.full(ms)),
    `dates by hand: "${U.when(ms, ms)}" the same day, "${U.when(ms, ms + 3 * 864e5)}" another, "${U.full(ms)}" in About`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
