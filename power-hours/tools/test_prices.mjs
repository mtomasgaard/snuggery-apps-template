// The decode test (HOUSE.md 7.3): data/snapshot.json read with code written here, against the app's pure modules
// js/prices.js, js/staircase.js and js/units.js; and fixtures written here for what the shipped file cannot show:
// a two-day file at 23:30 and the next morning, a day below zero, an hourly zone, the spring (92) and autumn
// (100) clock changes, a missing quarter, lastGood, broken files. The art pass changes no data; this proves the
// app reads it as the data says (ART.md section 1; tools/DECISIONS.md, item 9). Every bug on record that a pure
// module can show (B1 to B3, B9 to B12, B15, B18) is pinned here.
//
//   node tools/test_prices.mjs

process.env.TZ = 'Europe/Oslo';   // set before any Date: the phone's zone for the clock-dependent forms
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(path.join(APP, 'js/prices.js'));
const ST = await import(path.join(APP, 'js/staircase.js'));
const U = await import(path.join(APP, 'js/units.js'));
const snap = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
const apps = JSON.parse(fs.readFileSync(path.join(APP, 'data/appliances.json'), 'utf8')).appliances;
const fails = [];
let n = 0;
const ok = (cond, msg) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const NB = ' ', MI = '−';
const clone = (x) => JSON.parse(JSON.stringify(x));
const r2 = (x) => Math.round(x * 100) / 100;
const p2 = (k) => String(k).padStart(2, '0');

/* ── a decode written here: Date.parse reads the offsets, the wall clock is the string's own ── */
function decode(data) {
  const curve = data.hours && data.hours.length ? data.hours : (data.lastGood && data.lastGood.hours) || [];
  const f = data.unit === 'EUR/MWh' ? 0.1 : 1;
  const pts = curve.map((h) => ({ at: Date.parse(h.start), wall: h.start.slice(11, 16), date: h.start.slice(0, 10), v: h.price * f })).sort((a, b) => a.at - b.at);
  const gaps = pts.slice(1).map((p, i) => p.at - pts[i].at).sort((a, b) => a - b);
  const step = gaps.length ? gaps[gaps.length >> 1] : 3600e3;
  return { pts, step };
}
/** Every window of `need` intervals from `from` on that has no gap inside, its mean; the lowest, earliest first. */
function brute(d, from, hours) {
  const need = Math.ceil((hours * 3600e3) / d.step - 1e-9);
  let best = null;
  for (let a = from; a + need <= d.pts.length; a++) {
    const w = d.pts.slice(a, a + need);
    if (w.some((p, k) => k && p.at - w[k - 1].at !== d.step)) continue;
    const mean = w.reduce((s, p) => s + p.v, 0) / need;
    if (!best || mean < best.mean - 1e-12) best = { from: a, to: a + need - 1, mean };
  }
  return best;
}
const firstAhead = (d, now) => { const i = d.pts.findIndex((p) => p.at + d.step > now); return i < 0 ? 0 : i; };
/** A series of `count` intervals from instant t0, each `stepMin` long, its offset and price by index. */
function series(t0, count, stepMin, offAt, priceAt) {
  const out = [];
  for (let k = 0; k < count; k++) {
    const at = t0 + k * stepMin * 60000, off = offAt(at), w = new Date(at + off * 60000), a = Math.abs(off);
    out.push({ start: `${w.getUTCFullYear()}-${p2(w.getUTCMonth() + 1)}-${p2(w.getUTCDate())}T${p2(w.getUTCHours())}:${p2(w.getUTCMinutes())}:00${off < 0 ? '-' : '+'}${p2(Math.floor(a / 60))}:${p2(a % 60)}`, price: priceAt(k) });
  }
  return out;
}

/* ── 1. the shipped file, at 10:20 in Oslo (inside the file) and on 3 Oct (every price ended) ── */
const T1020 = Date.parse('2026-10-01T08:20:00Z'), TOUT = Date.parse('2026-10-03T10:00:00Z');
{
  const d = decode(snap), M = P.model(snap, T1020);
  ok(M.n === 96 && d.pts.length === 96 && M.step === d.step && M.stepMin === 15 && M.iv.every((x, i) => x.at === d.pts[i].at && Math.abs(x.v - d.pts[i].v) < 1e-12),
    `the shipped file: ${M.n} quarter hours, step ${M.stepMin} min, every instant and price (EUR/MWh divided by 10) as decoded here`);
  ok(M.iv.every((x, i) => `${p2(x.h)}:${p2(x.mi)}` === d.pts[i].wall && x.date === d.pts[i].date), 'each interval\'s wall clock and day are its own string\'s (never the phone\'s), so no day label is read (B1)');
  const lo = Math.min(...d.pts.map((p) => p.v)), hi = Math.max(...d.pts.map((p) => p.v));
  ok(r2(lo) === 13.62 && r2(hi) === 16.12 && JSON.stringify(M.scale.ticks) === '[13,14,15,16,17]' && M.scale.step === 1, `the scale: ${r2(lo)} to ${r2(hi)} gives ticks ${M.scale.ticks.join(', ')} (1, 2 or 5 times a power of ten, at most six ticks)`);
  const f = firstAhead(d, T1020), ahead = d.pts.slice(f), mean = ahead.reduce((s, p) => s + p.v, 0) / ahead.length;
  ok(M.first === f && M.cur === 41 && !M.history && M.today === '2026-10-01' && r2(M.meanAhead) === r2(mean) && r2(mean) === 15.36,
    `at 10:20: the current interval ${M.cur} (10:15), the stretch searched from it, ${ahead.length} quarter hours, mean ${r2(mean)} (ART.md's 15.36)`);
  const want = { Dishwasher: ['13:30–15:30', 14.19], 'Washing machine': ['13:45–15:15', 14.11], 'Car charging': ['11:30–15:30', 14.43], 'Tumble dryer': ['13:30–15:30', 14.19] };
  for (const a of apps) {
    const r = P.cheapest(M, a.hours), b = brute(d, f, a.hours);
    ok(r.from === b.from && r.to === b.to && Math.abs(r.mean - b.mean) < 1e-9 && P.runWords(M, r) === want[a.name][0] && r2(r.mean) === want[a.name][1],
      `${a.name}, ${a.hours} h at 10:20: ${P.runWords(M, r)} at ${U.price(r.mean)} (decoded here: intervals ${b.from} to ${b.to}, ${r2(b.mean)})`);
  }
  const dw = P.cheapest(M, 2);
  ok(P.savingWords(M, dw) === `14.19${NB}c/kWh, 8${NB}% below the mean ahead`, `the saving against the same stretch: "${P.savingWords(M, dw).replace(/ /g, ' ')}" (never the whole day's mean once the morning has passed)`);
  const rd = P.rankDay(M, 41), sorted = d.pts.filter((p) => p.date === '2026-10-01').map((p) => p.v);
  ok(rd.rank === 1 + sorted.filter((v) => v < d.pts[41].v).length && rd.rank === 68 && rd.of === 96 && rd.band === 'middle',
    `Now at 10:15: ${r2(d.pts[41].v)}, the ${rd.rank}th lowest of the day's ${rd.of} quarter hours, the quarter's own rank and price (B11)`);
  ok(P.intervalWords(M, 57) === 'Thu 1 Oct, 14:15–14:30' && P.intervalWords(M, 95) === 'Thu 1 Oct, 23:45–24:00' && P.rankAhead(M, 57).rank === 1 && P.rankAhead(M, 57).of === 55,
    `the readout at 14:15: "${P.intervalWords(M, 57)}", the lowest of the ${P.rankAhead(M, 57).of} ahead`);
  ok(P.stretchWords(M) === '10:15 to 24:00', `the stretch in words: "${P.stretchWords(M)}"`);
  const D = ST.describe(M, dw, 'Dishwasher', 2);
  ok(D === '96 quarter hours from Thursday 1 October, 00:00. Lowest 13.62 at 01:00, highest 16.12 at 08:15. Dishwasher: cheapest 2 hours ahead 13:30 to 15:30, mean 14.19 cents a kilowatt hour, 8 percent below the mean ahead.',
    `the slider's description, ART.md's sentence: "${D.slice(0, 70)}…"`);
  ok(P.runSpoken(M, 'Dishwasher', dw) === 'Dishwasher: 13:30 to 15:30, 14.19 cents a kilowatt hour.', `pressing a row says "${P.runSpoken(M, 'Dishwasher', dw)}"`);

  const H = P.model(snap, TOUT), hr = P.cheapest(H, 2), hb = brute(d, 0, 2);
  ok(H.history && H.first === 0 && H.cur === -1 && H.today === '2026-10-03' && hr.from === hb.from && P.runWords(H, hr) === 'Thu 00:30–02:30' && r2(hr.mean) === 13.65,
    `on 3 Oct every interval has ended: history, the whole file searched, the Dishwasher's run "${P.runWords(H, hr)}" at ${U.price(hr.mean)} with its day named (B2)`);
  ok(P.savingWords(H, hr) === `13.65${NB}c/kWh, 9${NB}% below the file’s mean` && P.stretchWords(H) === 'Thu 1 Oct, 00:00 to 24:00' && !P.isPast(H, 0),
    `history's words: "${P.savingWords(H, hr).replace(/ /g, ' ')}", "${P.stretchWords(H)}"; nothing faint`);
}

/* ── 2. the two-day file: the shipped day and a made-up Friday, made 1 Oct 16:31 UTC (B1 to B3) ── */
{
  const two = clone(snap);
  two.generatedAt = '2026-10-01T16:31:00Z';
  const fri = snap.hours.map((h, i) => ({ start: h.start.replace('2026-10-01', '2026-10-02'), price: i < 4 ? 1 : 200 }));
  two.hours = snap.hours.map((h, i) => ({ ...h, price: i >= 92 ? 1 : h.price })).concat(fri);
  two.days[1] = { date: '2026-10-02', label: 'Tomorrow', source: 'fetched', intervals: 96 };
  const d = decode(two);
  const at2230 = Date.parse('2026-10-01T20:30:00Z'), M = P.model(two, at2230), r = P.cheapest(M, 2), b = brute(d, firstAhead(d, at2230), 2);
  ok(M.n === 192 && r.from === 92 && r.to === 99 && r.from === b.from && P.runWords(M, r) === '23:00 to Fri 01:00' && P.stretchWords(M) === '22:30 to Fri 24:00',
    `at 22:30 with Friday published: the 2 h run crosses midnight, "${P.runWords(M, r)}" (the stock found nothing, B3); searched "${P.stretchWords(M)}"`);
  const at2330 = Date.parse('2026-10-01T21:30:00Z'), N = P.model(two, at2330), rn = P.cheapest(N, 2);
  ok(N.cur === 94 && rn.from === 94 && P.runWords(N, rn) === 'now to Fri 01:30' && P.runWords(N, rn, true) === 'now to Friday 01:30', `at 23:30 the run starts in the current interval: "${P.runWords(N, rn)}"; spoken "${P.runWords(N, rn, true)}"`);
  const morning = Date.parse('2026-10-02T06:00:00Z'), Q = P.model(two, morning), rq = P.cheapest(Q, 1);
  ok(Q.today === '2026-10-02' && Q.cur === 128 && Q.first === 128 && P.isPast(Q, 127) && !P.isPast(Q, 128) && P.intervalWords(Q, Q.cur) === 'Fri 2 Oct, 08:00–08:15',
    `the next morning at 08:00 (before the next refresh): today is Fri 2 Oct, the current interval ${Q.cur}, "${P.intervalWords(Q, Q.cur)}"; Thursday and the night are past (B1: the stock opened on yesterday labeled "Today")`);
  ok(rq.from >= 128 && P.rankDay(Q, 128).of === 96, `the morning's runs are searched from 08:00, never over hours that have ended (B2): ${P.runWords(Q, rq)}`);
  // below zero
  const neg = clone(two);
  neg.hours = neg.hours.map((h, i) => (i >= 150 && i < 160 ? { ...h, price: -33.1 } : h));
  const Z = P.model(neg, at2230), rz = P.cheapest(Z, 2);
  ok(rz.mean < 0 && P.savingWords(Z, rz) === `paid to run it, ${MI}3.31${NB}c/kWh` && Z.scale.ticks.includes(0) && Z.scale.lo < 0,
    `a run below zero: "${P.savingWords(Z, rz).replace(/ /g, ' ')}" (true minus, U+202F); the scale ${Z.scale.ticks.map((v) => U.fixed(v, 0)).join(', ')} holds zero`);
  const LZ = ST.layout(Z, rz, 358, 120, (t) => t.length * 5.2, ['Dishwasher']);
  const zt = LZ.grid.find((g) => g.zero);
  ok(zt && LZ.zero !== null && Math.abs(LZ.zero - zt.y) < 1e-9 && LZ.neg.split('Z').length - 1 === 10 && LZ.grid.some((g) => g.label === `${MI}10` || g.label.startsWith(MI)),
    `below zero is drawn: the zero rule labeled "0" at y ${zt && zt.y.toFixed(1)}, one fill per interval below it (${LZ.neg.split('Z').length - 1}), negative ticks with the true minus (${LZ.grid.map((g) => g.label).join(' ')})`);
}

/* ── 3. an hourly zone, a missing quarter, the clock changes ── */
{
  const hourly = { ...clone(snap), resolutionMinutes: 60, hours: series(Date.UTC(2026, 9, 1, -2), 24, 60, () => 120, (k) => 50 + ((k * 37) % 23)) };
  const M = P.model(hourly, T1020), r = P.cheapest(M, 1.5);
  ok(M.n === 24 && M.stepMin === 60 && M.noun[1] === 'hours' && r.need === 2 && ST.caption(M).startsWith(`c/kWh, spot price per hour,`),
    `an hourly zone: 24 intervals, "${M.noun[1]}", a 1.5 h run takes ${r.need} of them, the caption "${ST.caption(M).slice(0, 34)}…"`);

  const gap = clone(snap);
  gap.hours = gap.hours.filter((h) => !h.start.includes('T14:00'));
  const d = decode(gap), G = P.model(gap, T1020), rg = P.cheapest(G, 2), b = brute(d, firstAhead(d, T1020), 2);
  const naive = (() => { let best = null; for (let a = G.first; a + 8 <= G.n; a++) { const m = G.iv.slice(a, a + 8).reduce((s, x) => s + x.v, 0) / 8; if (!best || m < best.m - 1e-12) best = { a, m }; } return best; })();
  ok(G.n === 95 && !G.joined[56] && rg.from === b.from && !(rg.from <= 55 && rg.to >= 56) && naive.a <= 55 && naive.a + 7 >= 56,
    `a missing quarter (14:00): no run is searched across it (B18): the run is ${P.runWords(G, rg)}, where a search blind to gaps would have bridged it (from interval ${naive.a})`);
  const LG = ST.layout(G, rg, 358, 120);
  ok((LG.stairs.ahead.match(/M/g) || []).length === 2, `the staircase breaks at the gap: the line ahead starts ${(LG.stairs.ahead.match(/M/g) || []).length} times, no riser across it`);

  // spring: Europe/Oslo moves from UTC+1 to UTC+2 at 01:00 UTC on 29 Mar 2026, so the day has 92 quarter hours
  const spring = { ...clone(snap), hours: series(Date.UTC(2026, 2, 28, 23), 92, 15, (t) => (t < Date.UTC(2026, 2, 29, 1) ? 60 : 120), (k) => (k >= 6 && k <= 9 ? 10 : 100)) };
  const S = P.model(spring, Date.UTC(2026, 2, 28, 22)), rs = P.cheapest(S, 1);
  ok(S.n === 92 && S.days.get('2026-03-29').length === 92 && S.joined.slice(1).every(Boolean) && P.runWords(S, rs) === 'Sun 01:30 (UTC+1) to 03:30 (UTC+2)' && P.endWall(S, 7).h === 3,
    `the spring change: one day of ${S.n} quarter hours, all joined; the run over the missing 02:00 hour reads "${P.runWords(S, rs)}"; 01:45's interval ends at 03:00`);
  // autumn: UTC+2 to UTC+1 at 01:00 UTC on 25 Oct 2026, so the day has 100 and 02:00 to 02:45 come twice (B12)
  const autumn = { ...clone(snap), hours: series(Date.UTC(2026, 9, 24, 22), 100, 15, (t) => (t < Date.UTC(2026, 9, 25, 1) ? 120 : 60), (k) => (k >= 10 && k <= 13 ? 5 : 100 + k)) };
  const A = P.model(autumn, Date.UTC(2026, 9, 24, 21)), ra = P.cheapest(A, 1);
  ok(A.n === 100 && A.days.get('2026-10-25').length === 100 && A.twoClocks.has('2026-10-25') && P.rankDay(A, 12).of === 100 && P.runWords(A, ra) === 'Sun 02:30 (UTC+2) to 02:30 (UTC+1)',
    `the autumn change: ${A.n} quarter hours in one day, each ranked of 100; the run through the repeated hour reads "${P.runWords(A, ra)}" (the stock averaged the two 02:00 hours into one bar)`);
  ok(P.intervalWords(A, 12) === 'Sun 25 Oct, 02:00–02:15 (UTC+1)' && P.intervalWords(A, 8) === 'Sun 25 Oct, 02:00–02:15 (UTC+2)' && P.intervalWords(A, 11) === 'Sun 25 Oct, 02:45 (UTC+2) to 02:00 (UTC+1)',
    `the repeated hour's intervals carry their offsets: "${P.intervalWords(A, 8)}", "${P.intervalWords(A, 12)}", "${P.intervalWords(A, 11)}"`);
}

/* ── 4. lastGood and the broken files ── */
{
  const kept = { ...clone(snap), hours: [], lastGood: { generatedAt: '2026-09-30T14:31:00Z', days: snap.days, hours: snap.hours } };
  ok(P.usingLastGood(kept) && P.curveOf(kept).length === 96 && P.model(kept, T1020).n === 96 && P.validate(kept).length === 0 && !P.usingLastGood(snap),
    'lastGood: when hours is empty the kept curve is drawn, and the file is usable');
  const cases = [[[1, 2], ['data/snapshot.json is not a JSON object.']], [{ ...snap, schema: 2 }, ['data/snapshot.json says schema 2; this app reads schema 1.']],
    [{ ...snap, hours: [], lastGood: null }, ['data/snapshot.json has no prices: hours is empty and there is no lastGood to fall back on.']],
    [{ ...snap, hours: snap.hours.map((h, i) => (i % 8 === 0 ? { start: h.start, price: null } : h)) }, ['12 of 96 prices have no number or no time.']]];
  for (const [data, want] of cases) ok(JSON.stringify(P.validate(data)) === JSON.stringify(want), `validate: "${want[0]}"`);
  ok(P.parseStart('2026-10-01T14:15:00+02:00').at === Date.parse('2026-10-01T12:15:00Z') && P.parseStart('2026-10-01T14:15:00Z').off === 0 && P.parseStart('2026-10-01 14:15') === null,
    'a start with no offset is refused (its instant would be the phone\'s guess)');
}

/* ── 5. the drawing's geometry and its labels (B9, B10) ── */
{
  const M = P.model(snap, T1020), run = P.cheapest(M, 2), est = (t) => t.length * 5.2;
  const L = ST.layout(M, run, 358, 120, est, ['Dishwasher', 'Tumble dryer']);
  const tw = Math.ceil(Math.max(...['13', '14', '15', '16', '17'].map(est))) + 6, y = (v) => 16 + (120 * (17 - v)) / 4;
  ok(L.G.x0 === tw && L.G.xs.length === 97 && L.G.xs.every((x, i) => x === tw + Math.round((i * (358 - tw)) / 96)) && L.G.top === 16 && L.G.foot === 136 && L.G.base === 145 && L.G.height === 167,
    `the plot: a tick column of ${tw} px, 96 columns over ${358 - tw} px, edges on whole pixels; plot 16 to 136, axis at 145, the drawing 167 px tall`);
  ok((L.stairs.past.match(/H/g) || []).length === 41 && (L.stairs.ahead.match(/H/g) || []).length === 55 && L.stairs.ahead.startsWith(`M${L.G.xs[41]} ${Math.round(y(M.iv[40].v) * 100) / 100}V`),
    'the staircase: one tread per quarter hour, 41 ended (drawn faint) and 55 ahead, the riser at now kept with the line ahead (B10: no hourly means)');
  ok(L.land.x1 === L.G.xs[54] && L.land.x2 === L.G.xs[62] && Math.abs(L.land.y - y(run.mean)) < 1e-9 && Math.abs(L.mean.y - y(M.meanAhead)) < 1e-9 && L.mean.x1 === L.G.xs[41] && L.mean.x2 === L.G.xs[96],
    `the landing from 13:30's left edge to 15:30 (x ${L.land.x1} to ${L.land.x2}) at the run's mean (y ${L.land.y.toFixed(1)}); the dashed mean across the stretch at y ${L.mean.y.toFixed(1)}, the level ${(L.land.y - L.mean.y).toFixed(0)} px under it`);
  ok(Math.abs(L.nowX - (L.G.xs[41] + ((T1020 - M.iv[41].at) / M.step) * (L.G.xs[42] - L.G.xs[41]))) < 1e-9, `now at x ${L.nowX.toFixed(2)}, 5 of 15 minutes into 10:15's column`);
  const placed = L.labels.every((a, i) => a.a >= 0 && a.b <= 358 && L.labels.every((b, j) => i === j || a.b + 4 <= b.a || b.b + 4 <= a.a));
  ok(L.labels[0].text === '13:30–15:30' && L.labels[0].kind === 'run' && placed && L.dropped.includes('12:00') && !L.labels.some((l) => l.text === '12:00'),
    `the axis' labels by priority, the run's times first, none within 4 px of another: ${L.labels.map((l) => l.text).join(', ')}; dropped ${L.dropped.join(', ')} (B9: the stock printed "12" through "13:30–15:30")`);
  const stairAt = (a, b) => { const ys = []; for (let i = 0; i < 96; i++) if (L.G.xs[i + 1] > a - 1 && L.G.xs[i] < b + 1) ys.push(y(M.iv[i].v)); return [Math.min(...ys), Math.max(...ys)]; };
  ok(L.inPlot.length >= 1 && L.inPlot[0].kind === 'mean' && L.inPlot.every((l) => { const s = stairAt(l.a, l.b); return l.bt + 1 <= s[0] || s[1] <= l.t - 1; }),
    `the in-plot labels where the staircase leaves them clear: ${L.inPlot.map((l) => `"${l.text}" at y ${l.y.toFixed(0)}`).join(', ')}`);
  ok(ST.indexAt(L, L.G.xs[57] + 1) === 57 && ST.indexAt(L, 2) === null && ST.indexAt(L, -40, true) === 0 && ST.indexAt(L, 999, true) === 95, 'the interval under a finger: 14:15\'s column picks 57; the tick column picks nothing; a drag clamps to the ends');
  const H = P.model(snap, TOUT), LH = ST.layout(H, P.cheapest(H, 2), 358, 120, est);
  ok(LH.stairs.past === '' && LH.nowX === null && LH.labels[0].text === 'Thu 00:30–02:30' && LH.labels[0].a >= 0, `history: nothing faint, no now, the run's label "${LH.labels[0].text}" kept inside the drawing at x ${LH.labels[0].a.toFixed(0)}`);
}

/* ── 6. the words and numbers (B5, B6, B15) ── */
{
  const t = [[U.price(13.6463), '13.65'], [U.price(-3.314), `${MI}3.31`], [U.price(-0.001), '0.00'], [U.fixed(1234.5, 1), `1${NB}234.5`], [U.pct(8), `8${NB}%`],
    [U.runLength(2), `2${NB}h`], [U.runLength(1.5), `1${NB}h 30${NB}min`], [U.runLength(0.75), `45${NB}min`], [U.spokenLength(1.5), '1 hour 30 minutes'],
    [[1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 68, 101, 111].map(U.ordinal).join(' '), '1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 68th 101st 111th'],
    [U.zone(120), 'UTC+2'], [U.zone(-240), `UTC${MI}4`], [U.zone(330), 'UTC+5:30'], [U.span(36 * 3600e3), `36${NB}h`], [U.span(3 * 864e5), `3${NB}d`],
    [U.stampWhen(Date.parse('2026-10-01T04:01:13Z'), T1020), '06:01'], [U.stampWhen(Date.parse('2026-10-01T04:01:13Z'), TOUT), '1 Oct, 06:01'],
    [U.full(Date.parse('2026-10-01T04:01:13Z')), 'Thu 1 Oct 2026, 06:01 (UTC+2)'], [U.isoDate('2026-10-02'), 'Fri 2 Oct'],
    [U.spokenPrice(-3.314, U.unitsOf(snap)), 'minus 3.31 cents a kilowatt hour'], [U.spoken(`Thu 1 Oct, 14:15–14:30, 13.69${NB}c/kWh`), 'Thu 1 October, 14:15 to 14:30, 13.69 c/kWh']];
  const bad = t.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${t.length} forms (two decimals, the true minus and never −0.00, U+202F before every unit, ordinals, offsets, spans, the stamp on the phone's clock, dates built by hand)${bad.length ? ': ' + bad.map(([a, b]) => `"${a}" not "${b}"`).join('; ') : ''}`);
}

/* ── 7. the labels after the review: the mean's label off the staircase, a day's name kept beside a run's times ── */
{
  const est = (t) => t.length * 5.2;
  // every in-plot label is clear of the staircase it is laid over (the layout's own extent rule, recomputed here), or
  // stands in the row above the plot
  const clearOf = (M, L) => L.inPlot.every((l) => {
    if (l.row) return l.y === ST.NOW_Y && l.t >= 0 && l.bt < L.G.top;
    const ys = [];
    for (let i = 0; i < M.n; i++) if (L.G.xs[i + 1] > l.a - 1 && L.G.xs[i] < l.b + 1) ys.push(L.G.top + (L.G.plotH * (M.scale.hi - M.iv[i].v)) / (M.scale.hi - M.scale.lo));
    return l.bt + 1 <= Math.min(...ys) || Math.max(...ys) <= l.t - 1;
  });
  // the review's two-day fixture: the shipped Thursday and a Friday whose daytime prices swing through the mean ahead
  const two = clone(snap);
  const fri = [];
  for (let k = 0; k < 96; k++) {
    const h = Math.floor(k / 4);
    const p = h >= 2 && h < 5 ? -35 + 6 * Math.sin(k / 3) : h < 2 ? 60 - 12 * (k / 8) : h < 8 ? -5 + 20 * ((k - 20) / 12) : h < 18 ? 120 + 35 * Math.sin((k - 32) / 7) + (k % 3) * 2 : 150 - 3 * (k - 72) + (k % 2) * 4;
    fri.push({ start: `2026-10-02T${p2(h)}:${p2((k % 4) * 15)}:00+02:00`, price: Math.round(p * 100) / 100 });
  }
  two.hours = snap.hours.concat(fri);
  const Mm = P.model(two, Date.parse('2026-10-02T06:00:00Z')), Lm = ST.layout(Mm, P.cheapest(Mm, 2), 358, 120, est, ['Dishwasher']);
  const ml = Lm.inPlot.find((l) => l.kind === 'mean');
  ok(ml && ml.row === true && ml.y === ST.NOW_Y && ml.anchor === 'end' && ml.x === Lm.mean.x2 && clearOf(Mm, Lm) && Lm.nowX < ml.a - ST.LABEL_GAP,
    `the review's fixture at Fri 08:00: no spot on the mean line is clear (Friday swings through ${ml && ml.text}), so the label stands in the row above the plot at the line's right end, right of now (x ${Lm.nowX.toFixed(0)}), where the stock rule printed it across the staircase`);
  // a sawtooth through the mean: the scan finds nothing, the row takes it; and now at the right end sends it to the left
  const saw = { ...clone(snap), hours: snap.hours.map((h, i) => ({ ...h, price: i % 2 ? 150 : 140 })) };
  const Ms = P.model(saw, Date.parse('2026-10-01T21:40:00Z')), Ls = ST.layout(Ms, P.cheapest(Ms, 0.5), 358, 120, est);
  const sl = Ls.inPlot.find((l) => l.kind === 'mean');
  ok(sl && sl.row && sl.anchor === 'start' && sl.a === Ls.G.x0 && Ls.nowX > sl.b + ST.LABEL_GAP,
    `a sawtooth at 23:40: nothing on the line is clear and now stands at the right end, so the mean's label takes the row's left end (x ${sl && sl.a})`);
  // the walk along the line, on a crafted day: a band swinging through the mean at both ends of the stretch (every
  // fixed spot blocked), a flat stretch from 15:00 to 20:00 between them
  const band = { ...clone(snap), hours: snap.hours.map((h, i) => ({ ...h, price: i < 41 ? h.price : i >= 60 && i < 80 ? 100 : i % 2 ? 150 : 90 })) };
  const Mb = P.model(band, T1020), Lb = ST.layout(Mb, P.cheapest(Mb, 2), 358, 120, est);
  const bl = Lb.inPlot.find((l) => l.kind === 'mean');
  ok(bl && !bl.row && bl.anchor === 'end' && bl.x <= Lb.mean.x2 - ST.MEAN_STEP && bl.a >= Lb.G.xs[60] - 1 && bl.b <= Lb.G.xs[80] + 1 && clearOf(Mb, Lb),
    `a band through the mean at both ends of the stretch: the label walks left along the line 12 px a step to x ${bl && bl.x.toFixed(0)} (the line ends at ${Lb.mean.x2}), over the flat 15:00 to 20:00 (x ${Lb.G.xs[60]} to ${Lb.G.xs[80]}), clear of the staircase`);
  for (const [label, M, L] of [['the shipped file at 10:20', ...((M) => [M, ST.layout(M, P.cheapest(M, 2), 358, 120, est, ['Dishwasher', 'Tumble dryer'])])(P.model(snap, T1020))], ['run out', ...((M) => [M, ST.layout(M, P.cheapest(M, 2), 358, 120, est, ['Dishwasher'])])(P.model(snap, TOUT))]])
    ok(clearOf(M, L) && L.inPlot.every((l) => !l.row), `${label}: every in-plot label (${L.inPlot.map((l) => `"${l.text}"`).join(', ')}) clear of the staircase, none in the row`);
  // a day's name beside a run's times: 22:00 to 24:00 Thursday with Friday published, read at 21:00
  const late = clone(snap);
  late.hours = snap.hours.map((h, i) => ({ ...h, price: i >= 88 ? 10 : h.price })).concat(snap.hours.map((h, i) => ({ start: h.start.replace('2026-10-01', '2026-10-02'), price: 120 + (i % 7) })));
  const Ml = P.model(late, Date.parse('2026-10-01T19:00:00Z')), rl = P.cheapest(Ml, 2), Ll = ST.layout(Ml, rl, 358, 120, est);
  const run = Ll.labels.find((l) => l.kind === 'run'), day = Ll.labels.find((l) => l.text === 'Fri 2');
  ok(P.runWords(Ml, rl) === '22:00\u201324:00' && run && day && day.anchor === 'start' && day.x === day.a && day.a >= run.b + ST.LABEL_GAP && day.a >= Ll.G.xs[96] + ST.LABEL_GAP && Ll.labels.every((a, i) => Ll.labels.every((b, j) => i === j || a.b + 4 <= b.a || b.b + 4 <= a.a)),
    `a run ${P.runWords(Ml, rl)} centered 7 px from midnight: "Fri 2" is kept, anchored at its start ${day && (day.a - Ll.G.xs[96]).toFixed(0)} px right of the hairline, past the run's times (the stock rule dropped it, and Friday went unnamed); none within 4 px of another`);
  const Mn = P.model(two, Date.parse('2026-10-01T21:30:00Z')), Ln = ST.layout(Mn, P.cheapest(Mn, 2), 358, 120, est);
  const dn = Ln.labels.find((l) => l.text === 'Fri 2'), rn = Ln.labels.find((l) => l.kind === 'run');
  ok(dn && rn && rn.text === 'Fri 02:45\u201304:45' && dn.a >= rn.b + ST.LABEL_GAP && !Ln.dropped.includes('Fri 2'),
    `at 23:30 under "${rn && rn.text}": "Fri 2" placed at x ${dn && dn.a.toFixed(0)} after it; dropped ${Ln.dropped.join(', ')}`);
  // the rows' spoken second line
  const M1 = P.model(snap, T1020), dw = P.cheapest(M1, 2), H = P.model(snap, TOUT);
  ok(P.savingSpoken(M1, dw) === '14.19 cents a kilowatt hour, 8 percent below the mean ahead' && P.savingSpoken(H, P.cheapest(H, 2)) === '13.65 cents a kilowatt hour, 9 percent below the file\u2019s mean',
    `a row's name for VoiceOver ends "${P.savingSpoken(M1, dw)}" (the visible "${P.savingWords(M1, dw).replace(/\u202f/g, ' ')}")`);
}

console.log(`\n${n} checks, ${fails.length ? `${fails.length} failed` : 'all pass'}`);
process.exit(fails.length ? 1 : 0);
