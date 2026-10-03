// The decode test for Finances (HOUSE.md 7.3; ART.md section 8, item 18). Node, no dependencies. It reads
// data/snapshot.json with code written here, works out the Balance by ART.md section 1's rule with its own
// arithmetic, and compares js/balance.js with it: the items and their order, the reconciliation against
// netWorth, the scale's rung, the depths, every block's rows, the groups and their labels. Then it checks
// js/units.js's forms against strings written out here by hand. An art pass changes no decoding; this test
// proves the Balance draws the data and nothing else.
//
//   node tools/test_balance.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as bal from '../js/balance.js';
import * as U from '../js/units.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let n = 0;
const ok = (cond, msg) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${n}. ${msg}`); if (!cond) fails.push(msg); };
const snap = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
const NB = ' ', MINUS = '−';

/* ── the Balance, decoded here ── */
const own = [], owe = [];
for (const a of snap.accounts.filter((x) => x.balance > 0).sort((x, y) => y.balance - x.balance)) own.push([a.name, a.balance]);
for (const f of [...(snap.investments ? snap.investments.funds : [])].sort((x, y) => y.value - x.value)) if (f.value > 0) own.push([f.name, f.value]);
if (snap.equity && !snap.equity.error && snap.equity.counted > 0) own.push([snap.equity.provider, snap.equity.counted]);
if (snap.pension && snap.pension.includeInNetWorth !== false && snap.pension.counted > 0) own.push([snap.pension.provider, snap.pension.counted]);
for (const kind of ['vehicle', 'other', 'property']) {
  for (const a of snap.assets.filter((x) => (kind === 'other' ? !['vehicle', 'property'].includes(x.kind) : x.kind === kind)).sort((x, y) => y.value - x.value)) own.push([a.name, a.value]);
}
for (const a of snap.accounts.filter((x) => x.balance < 0).sort((x, y) => x.balance - y.balance).reverse()) owe.push([a.name, -a.balance]);
for (const l of [...snap.loans].sort((x, y) => y.balance - x.balance)) owe.push([l.name, -l.balance]);
const sum = (side) => side.reduce((t, [, v]) => t + v, 0);
const nw = snap.netWorth;
const wantOwn = nw.cash + nw.investments + nw.pension + nw.assets, wantOwe = -nw.liabilities;

const B = bal.balanceItems(snap);
ok(JSON.stringify(B.own.map((i) => [i.name, i.value])) === JSON.stringify(own),
  `Own, most liquid first: ${own.map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')}`);
ok(JSON.stringify(B.owe.map((i) => [i.name, i.value])) === JSON.stringify(owe),
  `Owe, cards then loans, smallest first: ${owe.map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')}`);
ok(Math.abs(sum(own) - wantOwn) <= 1 && Math.abs(sum(owe) - wantOwe) <= 1 && !B.own.concat(B.owe).some((i) => i.kind === 'rest'),
  `the items reconcile with netWorth with no Other block: owned ${sum(own).toFixed(2)} against ${wantOwn.toFixed(2)}, owed ${sum(owe).toFixed(2)} against ${wantOwe.toFixed(2)}`);
const off = Math.abs(B.owned - B.owed - nw.total);
ok(off < 0.005 && B.total === nw.total, `owned less owed is netWorth.total to the øre: ${(B.owned - B.owed).toFixed(2)} against ${nw.total.toFixed(2)} (${off.toFixed(2)} kr off)`);

// the rung: the first of 1, 2, 2.5, 5 × 10^k that keeps the deeper side within 160 px
let rung = null;
for (let k = 0; k < 15 && rung == null; k++) for (const m of [1, 2, 2.5, 5]) if (rung == null && Math.max(sum(own), sum(owe)) / (m * 10 ** k) <= 160) rung = m * 10 ** k;
const L = bal.layout(B, 358, 108);
ok(rung === 50000 && L.scale === rung, `the scale: ${L.scale} kr a pixel (worked out here: ${rung}; ART.md: 50 000)`);
const dOwn = Math.round(sum(own) / rung), dOwe = Math.round(sum(owe) / rung);
ok(dOwn === 115 && dOwe === 60 && L.foot === L.top + 115 && L.hollow.y0 === L.top + 60 && L.hollow.y1 === L.foot && L.hollow.side === 'owe' && L.hollow.y1 - L.hollow.y0 === 55,
  `the depths: owned ${dOwn} px, owed ${dOwe} px (ART.md: 115 and 60); the hollow under the debts from ${L.hollow.y0} to the foot at ${L.hollow.y1}, 55 px for ${B.total.toFixed(2)} kr (after review: not to the double rule, 2 px below)`);

// every block: cumulative rounded positions; the top row the page unless under 2 px, then one ink row
const blocksOk = (side, items) => {
  let cum = 0;
  return items.every(([, v], i) => {
    const y0 = L.top + Math.round(cum / rung); cum += v;
    const y1 = L.top + Math.round(cum / rung), b = side.blocks[i];
    return b.y0 === y0 && b.y1 === y1 && b.rect[1] === (y1 - y0 >= 2 ? y0 + 1 : y0) && b.rect[3] === (y1 - y0 >= 2 ? y1 - y0 - 1 : 1);
  }) && side.blocks.length === items.length;
};
ok(blocksOk(L.own, own) && blocksOk(L.owe, owe), `every block's rows: ${L.own.blocks.map((b) => `${b.name} ${b.y0}–${b.y1}`).join(', ')}; ${L.owe.blocks.map((b) => `${b.name} ${b.y0}–${b.y1}`).join(', ')}`);
const totalRows = (side) => side.blocks.reduce((t, b) => t + (b.y1 - b.y0), 0);
ok(totalRows(L.own) === dOwn && totalRows(L.owe) === dOwe, `each side is exactly as deep as its total: ${totalRows(L.own)} and ${totalRows(L.owe)} px`);

// groups and labels
const labels = [...L.own.groups, ...L.owe.groups].filter((g) => g.shown).map((g) => g.label);
ok(JSON.stringify(labels) === JSON.stringify(['3 accounts, 1 fund, 2 vehicles', 'Home', 'Credit card, Car loan', 'Home loan']),
  `the labels: ${labels.join(' | ')}`);
ok(L.ruler.unit === 'million ' && L.ruler.ticks.map((t) => t.label).join(',') === '0,1,2,3,4,5' && L.ruler.ticks.every((t, i) => t.y === L.top + i * 20),
  `the ruler: ${L.ruler.ticks.map((t) => t.label).join(', ')} under "million kr", every 20 px`);
ok(L.words.beside && bal.layout(B, 288, 108).words.beside === false, 'the figure beside the hollow at 390 px wide, under the double rule at 320');

// the hit test: a tap on the home, on the shallow run, on the hollow
const home = bal.hitAt(L, L.own.x0 + 10, 90), run = bal.hitAt(L, L.own.x0 + 10, L.top + 4), hollow = bal.hitAt(L, L.owe.x0 + 10, 120), loan = bal.hitAt(L, L.owe.x0 + 10, 50);
ok(home.group && home.group.label === 'Home' && run.group && run.group.items.length === 6 && hollow.hollow && loan.group && loan.group.label === 'Home loan',
  'a tap reads the block under it: the home, the run of six, the home loan, and the hollow as net worth');

// debts beyond what is owned put the hollow on the left
const deep = bal.balanceItems({ ...snap, loans: [{ name: 'Big loan', balance: -9e6 }], netWorth: { ...nw, liabilities: -9e6 - 8761.48, total: wantOwn - 9e6 - 8761.48 } });
const LD = bal.layout(deep, 358, 108);
ok(LD.hollow.side === 'own' && !LD.words.beside && deep.total < 0, `owed beyond what is owned: the hollow under what is owned (${LD.hollow.y0} to ${LD.hollow.y1}), the words under the rule`);
// a side short of what netWorth totals gains one Other block
const short = bal.balanceItems({ ...snap, netWorth: { ...nw, cash: nw.cash + 10000 } });
ok(short.own[short.own.length - 1].name === 'Other, as the snapshot totals it' && Math.abs(short.own[short.own.length - 1].value - 10000) < 0.01, 'a side short of netWorth by 10 000 kr gains "Other, as the snapshot totals it", 10 000 kr');

ok(bal.sayBalance(B, U.dateWords('2026-09-21'), 'kroner') === 'Balance on 21 September 2026: owned 5736193 kroner, the home 5059605 of it; owed 3015929 kroner, the home loan 2871222 of it; net worth 2720264 kroner.',
  `VoiceOver's sentence: "${bal.sayBalance(B, U.dateWords('2026-09-21'), 'kroner')}"`);

/* ── js/units.js's forms, against strings written here ── */
const forms = [
  [U.money(5059605.12, 'NOK'), `5${NB}059${NB}605${NB}kr`],
  [U.money(-86.49, 'NOK', 2), `${MINUS}86.49${NB}kr`],
  [U.money(-0.2, 'NOK'), `0${NB}kr`],
  [U.moneySigned(16492.3, 'NOK'), `+16${NB}492${NB}kr`],
  [U.money(100, 'EUR'), `100${NB}EUR`],
  [U.pct(0.10273), `10.3${NB}%`],
  [U.pct(0.049, 2), `4.90${NB}%`],
  [U.units(513.9718), '513.9718 units'],
  [U.count(1, 'payment'), '1 payment'],
  [U.days(1), 'in 1 day'], [U.days(15), 'in 15 days'], [U.days(0), 'today'], [U.days(-1), '1 day ago'],
  [U.dayMon('2026-09-21'), '21 Sep'], [U.date('2026-09-21'), '21 Sep 2026'], [U.dowDateYear('2026-09-21'), 'Mon 21 Sep 2026'],
  [U.month('2026-09'), 'Sep 2026'], [U.span('2026-08-23', '2026-09-21'), '23 Aug to 21 Sep 2026'], [U.span('2025-08-18', '2026-09-21'), '18 Aug 2025 to 21 Sep 2026'],
  [U.plusDays('2026-08-22', 1), '2026-08-23'], [U.daysBetween('2026-09-21', '2026-10-06'), 15],
  [U.axis(2650000, 2720264, 'NOK').ticks.map((t) => t.label).join(','), '2.64,2.66,2.68,2.70,2.72,2.74'],
  [U.axis(2650000, 2720264, 'NOK').unit, 'million kr'],
  [U.axis(0, 61816, 'NOK').ticks.map((t) => t.label).join(',') + ' ' + U.axis(0, 61816, 'NOK').unit, '0,20,40,60,80 thousand kr'],
  [U.axis(0, 5331489, 'NOK').ticks.map((t) => t.label).join(','), '0,2,4,6'],
  [U.spoken(`Mon 21 Sep: ${MINUS}8${NB}761${NB}kr, 10.3${NB}%`), 'Monday 21 September: minus 8761 kroner, 10.3 percent'],
];
const badForms = forms.filter(([got, want]) => got !== want);
ok(badForms.length === 0, `js/units.js: ${forms.length} forms as written here (U+202F, U+2212, no −0, plurals, dates by hand, axes whose labels never repeat)${badForms.length ? ': ' + badForms.map(([g, w]) => `"${g}" ≠ "${w}"`).join('; ') : ''}`);
// "today" is the phone's calendar day, never the UTC one (B3): 00:30 in Oslo on 22 Sep is 22:30 UTC on 21 Sep
process.env.TZ = 'Europe/Oslo';
ok(U.todayIso(Date.parse('2026-09-21T22:30:00Z')) === '2026-09-22', `todayIso at 00:30 in Oslo is ${U.todayIso(Date.parse('2026-09-21T22:30:00Z'))}, the phone's day (B3)`);
// every axis in the app's range of figures labels its ticks distinctly (B2)
let dup = 0;
for (const [lo, hi] of [[0, 1234], [2.65e6, 2.651e6], [0, 5.4e6], [99000, 101000], [-3e6, 0], [1e5, 4e5]]) { const l = U.axis(lo, hi, 'NOK').ticks.map((t) => t.label); if (new Set(l).size !== l.length || U.axis(lo, hi, 'NOK').hi < hi) dup++; }
ok(dup === 0, 'six axes from 1 234 kr to 5.4 million: every tick label distinct, the last tick at or past the largest value (B2, B20)');

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
