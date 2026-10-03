// The Block and the formats, tested against this file's own decode of data/snapshot.json (HOUSE.md 7.3;
// ART.md section 8, item 32). Node, no dependencies. js/block.js and js/units.js are imported only to be
// compared with what is worked out here; nothing below trusts them.
//
//   node tools/test_block.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blockWeeks, blockLayout, blockSay, blockCard, SCALE, GUTTER } from '../js/block.js';
import * as U from '../js/units.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snap = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
let failed = 0, n = 0;
const ok = (cond, msg) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failed++; };
const close = (a, b) => Math.abs(a - b) < 1e-9;

/* ── this file's decode: Mondays by hand, running kilometers by the snapshot's contract ── */
const DAY = 86400000;
const t = (s) => Date.parse(`${s}T00:00:00Z`);
const d = (ms) => new Date(ms).toISOString().slice(0, 10);
const monday = (s) => d(t(s) - ((new Date(t(s)).getUTCDay() + 6) % 7) * DAY);
const running = (a) => (typeof a.runKm === 'number' ? a.runKm : a.km);   // walk breaks out (app.js header)

function decode(acts, plan, today) {
  const now = monday(today);
  const hz = (plan && plan.horizon) || [];
  const planned = hz.some((h) => h.w >= now);
  const weeks = [];
  for (let k = planned ? 11 : 15; k >= 1; k--) weeks.push(d(t(now) - 7 * k * DAY));
  weeks.push(now);
  if (planned) for (const h of [...hz].sort((a, b) => a.w.localeCompare(b.w))) if (h.w > now && !weeks.includes(h.w) && weeks.length < 12 + 26) weeks.push(h.w);
  return weeks.map((w) => {
    const runs = acts.filter((a) => a.sport === 'run' && monday(a.d) === w && w <= now)
      .sort((a, b) => (a.d === b.d ? String(a.t || '').localeCompare(String(b.t || '')) : a.d.localeCompare(b.d))).map(running);
    let target = null, low = null;
    if (planned && w >= now) {
      const wk = (plan.weeks || []).find((x) => x.start === w);
      const m = wk && /(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/.exec(wk.targetKm || '');
      if (m) { low = Number(m[1]); target = Number(m[2]); } else { const h = hz.find((x) => x.w === w); if (h) target = h.km; }
    }
    return { w, runs, target, low };
  });
}
const same = (B, mine) => B.columns.length === mine.length && B.columns.every((c, i) => c.week === mine[i].w && c.target === mine[i].target && c.low === mine[i].low
  && c.runs.length === mine[i].runs.length && c.runs.every((v, k) => close(v, mine[i].runs[k])));

/* ── the demo, on 1 Oct 2026 ── */
const today = '2026-10-01';
const B = blockWeeks(snap.activities, snap.plan, today);
const mine = decode(snap.activities, snap.plan, today);
ok(same(B, mine), `the demo's Block on ${today}: ${B.columns.length} columns (${B.now + 1} run, ${B.columns.length - B.now - 1} planned), every run and target as this file decodes them`);
const sums = mine.map((c) => c.runs.reduce((s, v) => s + v, 0));
ok(B.columns.every((c, i) => close(c.km, sums[i])), `weekly running: ${sums.slice(0, B.now + 1).map((v) => v.toFixed(1)).join(', ')} km`);
ok(B.columns[B.now].week === '2026-09-28' && B.columns[B.now].target === 62 && B.columns.slice(B.now + 1).map((c) => c.target).join(',') === '76,62,48,49',
  `this week 28 Sep inside a 62 km outline, then outlines of ${B.columns.slice(B.now + 1).map((c) => c.target).join(', ')} km`);
ok(B.race && B.race.name === snap.plan.goal.race.name && B.columns[B.race.idx].week === monday(snap.plan.goal.race.date) && close(B.race.day, (6 + 0.5) / 7),
  `the race, ${B.race && B.race.name}, marks the week of ${monday(snap.plan.goal.race.date)} on its Sunday`);
ok(B.columns.slice(0, B.now).every((c) => c.target == null), 'no outline before this week: past plans are not in the data, and the Block does not invent them');

/* ── the drawing: a fixed, printed scale; edges on whole pixels; a 1 px gap of the page between runs ── */
for (const [pane, scale] of [['Now', SCALE.now], ['Plan', SCALE.plan]]) {
  const W = 358, L = blockLayout(B, W, scale);
  const tallest = Math.max(...B.columns.map((c, i) => Math.max(sums[i], c.target || 0)));
  const topKm = Math.max(80, Math.ceil(tallest / 20) * 20);
  const slot = (W - GUTTER) / B.columns.length;
  let good = L.topKm === topKm && close(L.base - L.top, topKm * scale) && L.height === L.base + 17;
  const msgs = [];
  B.columns.forEach((c, i) => {
    const ps = L.points.filter((p) => p[4] === i);
    const x0 = Math.round(i * slot), w = Math.round((i + 1) * slot) - x0 - 4;
    if (ps.length !== c.runs.length) { good = false; msgs.push(`column ${i}: ${ps.length} blocks for ${c.runs.length} runs`); }
    if (ps.some((p) => p[0] !== x0 || p[2] !== w)) { good = false; msgs.push(`column ${i}: x or width`); }
    if (ps.length) {
      const top = Math.min(...ps.map((p) => p[1]));
      if (top !== L.base - Math.round(sums[i] * scale)) { good = false; msgs.push(`column ${i}: top ${top}`); }
      // each block's own height plus the 1 px gap above every block but the first is its kilometers at the scale, ±1 px of rounding
      ps.forEach((p, k) => { const want = c.runs[k] * scale; if (p[3] >= 1 && Math.abs(p[3] + (k ? 1 : 0) - want) > 1.01 && want >= 2) { good = false; msgs.push(`column ${i} block ${k}: ${p[3]} px for ${want.toFixed(1)}`); } });
    }
    const o = L.outlines.find((x) => x[4] === i);
    if ((c.target != null) !== !!o || (o && (o[3] !== Math.round(c.target * scale) || o[1] !== L.base - o[3]))) { good = false; msgs.push(`column ${i}: outline`); }
  });
  ok(good, `${pane}: ${scale} px per km, a ${topKm} km plot ${L.base - L.top} px tall, ${L.points.length} blocks and ${L.outlines.length} outlines where this file puts them${msgs.length ? ': ' + msgs.slice(0, 4).join('; ') : ''}`);
}

/* ── the plan's tint (the owner, 2026-10-03): inside every outline, from its top down to the ink, so only
   the part of a week still to run is tinted; a week run past its target keeps its outline and no tint ── */
for (const [pane, scale] of [['Now', SCALE.now], ['Plan', SCALE.plan]]) {
  const L = blockLayout(B, 358, scale), bad = [];
  B.columns.forEach((c, i) => {
    const o = L.outlines.find((x) => x[4] === i), tn = L.tints.find((x) => x[4] === i);
    const ink = L.base - Math.round(sums[i] * scale), want = o && ink > o[1] ? [o[0], o[1], o[2], ink - o[1]] : null;
    if (JSON.stringify(want) !== JSON.stringify(tn ? tn.slice(0, 4) : null)) bad.push(`column ${i}: ${JSON.stringify(tn)} for ${JSON.stringify(want)}`);
  });
  const now = L.tints.find((x) => x[4] === B.now);
  ok(bad.length === 0 && L.tints.length === L.outlines.length, `${pane}: ${L.tints.length} tints, each from its outline's top down to the ink (this week ${now && now[3]} px over its ${sums[B.now].toFixed(1)} km, the planned weeks whole)${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);
}
{
  const plan = { ...snap.plan, weeks: [], horizon: snap.plan.horizon.map((h) => (h.w === '2026-09-28' ? { ...h, km: 20 } : h)) };
  const B2 = blockWeeks(snap.activities, plan, today), L2 = blockLayout(B2, 358, SCALE.now);
  ok(L2.outlines.some((x) => x[4] === B2.now) && !L2.tints.some((x) => x[4] === B2.now) && L2.tints.length === L2.outlines.length - 1,
    `a week run past its target (${sums[B.now].toFixed(1)} km against 20): its outline kept, no tint`);
}

/* ── without a plan, and with a plan whose week is a range ── */
{
  const B0 = blockWeeks(snap.activities, null, today);
  ok(same(B0, decode(snap.activities, null, today)) && B0.columns.length === 16 && B0.columns.every((c) => c.target == null) && !B0.race && !B0.planned,
    'without a plan: fifteen weeks back and this one, ink only, no race');
  const plan = { ...snap.plan, weeks: [{ ...snap.plan.weeks[0], targetKm: '26–30 km' }] };
  const B1 = blockWeeks(snap.activities, plan, today), c = B1.columns[B1.now];
  const L1 = blockLayout(B1, 358, SCALE.now), tick = L1.ticks.find((x) => x[3] === B1.now);
  ok(c.target === 30 && c.low === 26 && c.range === '26–30 km' && tick && tick[1] === L1.base - Math.round(26 * SCALE.now) && blockCard(B1, B1.now).rows.some(([l, v]) => l === 'Plan' && v === '26–30 km'),
    "a week given as a range: the outline to 30, a tick at 26, the card printing the range as written");
  const old = blockWeeks(snap.activities, snap.plan, '2027-03-01');
  ok(!old.planned && old.columns.length === 16, 'a plan whose horizon ended before this week: ink only, sixteen columns');
}

/* ── the card and what VoiceOver hears ── */
{
  const i = B.columns.findIndex((c) => c.week === '2026-09-14'), c = blockCard(B, i);
  ok(c.place === 'Week of 14 Sep 2026' && c.value === sums[i].toFixed(1) && c.unit === 'km' && c.rows[0][1] === String(mine[i].runs.length)
    && c.say === `Week of 14 September 2026. ${sums[i].toFixed(1)} kilometers in ${mine[i].runs.length} runs, longest ${Math.max(...mine[i].runs).toFixed(1)} kilometers.`,
    `the card for 14 Sep: "${c.place}", ${c.value} km, said as "${c.say}"`);
  const t0 = blockCard(B, B.now);
  ok(t0.rows[0][0] === 'So far' && t0.rows[0][1] === `${sums[B.now].toFixed(1)}\u202Fkm of 62\u202Fkm planned`, `this week's card: "So far ${t0.rows[0][1]}"`);
  const say = blockSay(B);
  ok(say.startsWith(`Weekly running, 13 July to the week of 26 October 2026: 12 weeks run, the latest ${sums[9].toFixed(1)}, ${sums[10].toFixed(1)} and so far ${sums[11].toFixed(1)} kilometers; 4 weeks planned, 76, 62, 48 and 49 kilometers; Copenhagen Half Marathon on 1 November.`),
    `the drawing's label: "${say}"`);
}

/* ── js/units.js: the house's notation (HOUSE.md 6.1, 6.2) ── */
{
  const NN = '\u202F', MI = '\u2212';
  const cases = [
    [U.f0(11669), `11${NN}669`], [U.f1(1013.04), `1${NN}013.0`], [U.f0(999), '999'], [U.fixed(-0.04, 1), '0.0'], [U.f0(-12), `${MI}12`],
    [U.signed(3), '+3'], [U.signed(-3), `${MI}3`], [U.signed(0.04, 1), '0.0'], [U.km(24), `24.0${NN}km`], [U.pct(12.4), `12${NN}%`],
    [U.pace(4.9), '4:54'], [U.pace(4.999), '5:00'], [U.perKm(5.5), `5:30${NN}/km`], [U.span(72), `1${NN}h 12${NN}min`], [U.span(56), `56${NN}min`], [U.span(120), `2${NN}h`],
    [U.mmss(754), '12:34'], [U.mmss(3723), '1:02:03'], [U.date('2026-09-14'), '14 Sep 2026'], [U.dayMon('2026-11-01'), '1 Nov'], [U.dowDate('2026-09-30'), 'Wed 30 Sep'],
    [U.dowDay('2026-09-28'), 'Mon 28'], [U.month('2026-07-13'), 'Jul 2026'], [U.month('2026-08-03', false), 'Aug'], [U.si('62 km'), `62${NN}km`], [U.si('26–30 km easy'), `26–30${NN}km easy`],
    [U.ago(30 * 60000), `30${NN}min ago`], [U.ago(60000), 'just now'], [U.ago(3 * 86400000), `3${NN}d ago`],
    [U.spoken(`Week of 14 Sep 2026. 78.0${NN}km, 4:54${NN}/km, 157${NN}bpm, 12${NN}%, ${MI}3, 1${NN}013${NN}m`), 'Week of 14 September 2026. 78.0 kilometers, 4:54 per kilometer, 157 beats a minute, 12 percent, minus 3, 1013 meters'],
  ];
  const bad = cases.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${cases.length} cases (the true minus, U+202F before units and between thousands, no "−0", hand-built dates, spoken forms)${bad.length ? ': ' + bad.map(([a, b]) => `"${a}" for "${b}"`).join('; ') : ''}`);
  const c = new Date(Date.UTC(2026, 8, 30, 18, 20));
  ok(/^\d\d:\d\d$/.test(U.clock(c)) && /^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} 2026, \d\d:\d\d \(UTC([+\u2212]\d+(:\d\d)?)?\)$/.test(U.full(c)), `instants: clock ${U.clock(c)}, About's "${U.full(c)}" (this machine's zone)`);
}

console.log(failed ? `\n${failed} of ${n} failed` : `\nall ${n} pass`);
process.exit(failed ? 1 : 0);
