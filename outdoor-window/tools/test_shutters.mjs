// The decode test (HOUSE.md 7.3): data/snapshot.json and data/rules.json read with formulas written here,
// against the app's pure modules js/score.js, js/shutters.js and js/units.js. The art pass changes no scoring;
// this proves it, and it is the guard PROMPT.md asked for: the app's scorer compared, row by row, with the
// snapshot's `ask` table that scripts/outdoor_window.py wrote, without touching the pipeline (ART.md
// section 1; tools/DECISIONS.md, item 13). The figures pinned below are the demo forecast's as refreshed on 2026-10-08
// (Boston Common, Thu 8 to Sat 10 Oct; plan 0012 package 4, plan 0011's owed item 1).
//
//   node tools/test_shutters.mjs

process.env.TZ = 'Europe/Oslo';   // set before any Date: the phone's zone for the clock-dependent forms
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SC = await import(path.join(APP, 'js/score.js'));
const SH = await import(path.join(APP, 'js/shutters.js'));
const U = await import(path.join(APP, 'js/units.js'));
const snap = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
const rules = JSON.parse(fs.readFileSync(path.join(APP, 'data/rules.json'), 'utf8'));
const fails = [];
let n = 0;
const ok = (cond, msg) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const NB = '\u202f', MINUS = '\u2212';
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ── a scorer written here, from the rule in js/score.js's header comment, in its own words ── */
const real = (v) => typeof v === 'number' && Number.isFinite(v);
function mine(s, r) {
  const H = s.hourly, off = s.utc_offset_seconds, t = (iso) => Date.parse(`${iso.slice(0, 16)}Z`) - off * 1000;
  const sun = {};
  (s.daily.time || []).forEach((d, i) => { sun[d] = [t(s.daily.sunrise[i]), t(s.daily.sunset[i])]; });
  const light = String(r.daylight || 'any').toLowerCase(), gold = real(r.goldenHourMinutes) ? r.goldenHourMinutes * 60000 : 0;
  return H.time.map((iso, i) => {
    const at = t(iso), [rise, set] = sun[iso.slice(0, 10)] || [NaN, NaN];
    const golden = gold > 0 && ((at >= rise && at <= rise + gold) || (at >= set - gold && at <= set));
    const parts = [];
    const atMost = (label, v, L) => {
      if (!real(L)) return;
      if (!real(v)) { parts.push([label, false, 0]); return; }
      parts.push([label, v <= L, L <= 0 ? (v <= 0 ? 1 : 0) : Math.min(1, Math.max(0, 1 - v / L))]);
    };
    const between = (label, v, B) => {
      if (!B || !real(B.min) || !real(B.max)) return;
      if (!real(v)) { parts.push([label, false, 0]); return; }
      if (B.max <= B.min) { parts.push([label, v === B.min, v === B.min ? 1 : 0]); return; }
      const w = (B.max - B.min) / 2;
      parts.push([label, v >= B.min && v <= B.max, Math.min(1, Math.max(0, 1 - Math.abs(v - (B.min + B.max) / 2) / w))]);
    };
    atMost('rain chance', H.precipitation_probability[i], r.maxRainChancePct);
    atMost('rainfall', H.precipitation[i], r.maxPrecipMm);
    atMost('gusts', H.wind_gusts_10m[i], r.maxGustKmh);
    between('temperature', H.temperature_2m[i], r.temperatureC);
    between('dew point', H.dew_point_2m[i], r.dewPointC);
    if (light === 'daylight') parts.push(['daylight', H.is_day[i] === 1, H.is_day[i] === 1 ? 1 : 0]);
    if (light === 'golden') parts.push(['golden hour', golden, golden ? 1 : 0]);
    const score = parts.length ? Math.round((100 * parts.reduce((a, p) => a + p[2], 0)) / parts.length) : 0;
    return { at, score, pass: parts.every((p) => p[1]), blocked: parts.filter((p) => !p[1]).map((p) => p[0]), comfort: parts.map((p) => p[2]), ok: parts.map((p) => p[1]),
      light: golden ? 'golden' : H.is_day[i] === 1 ? 'day' : 'night' };
  });
}

/* ── the file ── */
const H = snap.hourly, off = snap.utc_offset_seconds;
ok(H.time.length === 48 && off === -14400 && snap.hourly_units.wind_gusts_10m === 'km/h' && snap.hourly_units.temperature_2m === '°C' && snap.ask.length === 48,
  `the file: ${H.time.length} hours from ${H.time[0]} at UTC${off / 3600}, gusts in ${snap.hourly_units.wind_gusts_10m}, ${snap.ask.length} ask rows`);

/* ── the app's scorer against this test's scorer, and against the snapshot's ask table ── */
const app = SC.scoreHours(snap, rules), here = mine(snap, rules);
{
  const diff = app.filter((row, i) => row.score !== here[i].score || row.pass !== here[i].pass || row.blocked.join() !== here[i].blocked.join() || row.light !== here[i].light
    || row.epoch !== here[i].at || row.checks.some((c, k) => c.ok !== here[i].ok[k] || Math.abs(c.comfort - here[i].comfort[k]) > 1e-12));
  ok(diff.length === 0, `js/score.js against this test's scorer: ${app.length} hours, ${diff.length} differ in score, pass, blocked rules, light or a rule's comfort`);
  const ask = snap.ask.filter((a, i) => {
    const r = app[i];
    return !(a.date === r.stamp.slice(0, 10) && a.time === r.stamp.slice(11, 16) && a.pass === (r.pass ? 'yes' : 'no') && a.score === r.score && a.blockedBy === r.blocked.join(', ') && a.daylight === r.light
      && a.tempC === r.temp && a.rainChancePct === r.rainPct && a.rainMm === r.precip && a.gustKmh === r.gust && a.dewPointC === r.dew && a.cloudPct === r.cloud);
  });
  ok(ask.length === 0, `js/score.js against the snapshot's ask table (scripts/outdoor_window.py's scorer): ${snap.ask.length} rows, ${ask.length} mismatches (the art pass measured 0 of 48 with the stock app.js)`);
  const keys = app[0].checks.map((c) => c.key).join();
  ok(keys === 'rain,rainfall,gust,temp,dew,light' && app.every((r) => r.checks.length === 6 && r.checks.every((c) => !c.missing)), `each row's checks, in the scorer's order: ${keys}; no value missing in the shipped file`);
}

/* ── the windows, the whole file (it has run out) and from Thu 8 Oct, 12:00 in Boston ── */
{
  const W = SC.findWindows(app, rules.minWindowHours);
  const say = (w) => `${U.placeDate(w.start.epoch, off, Date.UTC(2026, 9, 2))} ${U.placeClock(w.start.epoch, off)}–${U.placeClock(w.end.epoch + 3600e3, off)}, ${w.hours} h, best ${w.best}`;
  ok(W.length === 2 && say(W[0]) === 'Thu 8 Oct 12:00–14:00, 2 h, best 64' && say(W[1]) === 'Fri 9 Oct 07:00–09:00, 2 h, best 80', `the whole file's windows: ${W.map(say).join('; ')} (ART.md: Thu 12:00 to 14:00, 2 hours, best 64; Fri 07:00 to 09:00, 2 hours, best 80)`);
  const noon = Date.parse('2026-10-08T16:00:00Z'), left = app.filter((r) => r.epoch + 3600e3 > noon), W2 = SC.findWindows(left, rules.minWindowHours);
  ok(left.length === 44 && W2.length === 2 && W2[0].start.index === 4 && W2[0].hours === 2, `at noon in Boston: ${left.length} hours left, the next window from hour ${W2[0].start.index} for ${W2[0].hours} hours`);
}

/* ── the Shutters, recomputed here: at 390 and 320 px, and on a phone on its side ── */
const LABEL = 64;   // the widest row name, Temperature, 55.7 px at 10.5 px in the face, plus 8 (ART.md section 1)
const runsOf = (test) => { const out = []; for (let i = 0; i < 48; i++) if (test(i)) { const l = out[out.length - 1]; if (l && l[1] === i - 1) l[1] = i; else out.push([i, i]); } return out; };
for (const [phone, width, ph, W] of [['390 px', 358, 5, 240], ['320 px', 288, 4, 192], ['on its side', 760, 12, 576], ['125 % text', 280, 4, 192], ['a 72-hour file at 390 px', 358, 274 / 72, 274]]) {
  const long = phone.startsWith('a 72');
  const rowsHere = long ? Array.from({ length: 72 }, (_, i) => ({ ...app[i % 48], epoch: app[0].epoch + i * 3600e3 })) : app;
  const M = SH.model({ rows: rowsHere, windows: long ? [] : SC.findWindows(app, rules.minWindowHours), offset: off, now: Date.parse('2026-10-20T10:00:00Z'), width, label: LABEL, ranOut: true });
  const fit = M.G.x0 + M.G.W + M.G.countW <= width + 1e-9;
  ok(Math.abs(M.G.ph - ph) < 1e-9 && Math.abs(M.G.W - W) < 1e-9 && M.G.x0 === LABEL && fit, `${phone}: ${+M.G.ph.toFixed(3)} px an hour, a ${+M.G.W.toFixed(1)} px plot from x ${M.G.x0}, the count column ${M.G.countW} px, ${+M.G.width.toFixed(1)} px in all inside ${width} (ART.md: ${long ? 'below 4 px an hour, the fraction that fits beside a 20 px count column' : `${ph}, ${W}`})`);
  if (phone !== '390 px') continue;
  const names = M.rules.map((r) => r.name).join(', ');
  ok(names === 'Rain chance, Rainfall, Gusts, Temperature, Dew point, Daylight', `rows: ${names}`);
  const H2 = here;
  const blocksOk = M.rules.every((r, k) => JSON.stringify(r.blocks.map((b) => [b.from, b.to])) === JSON.stringify(runsOf((i) => !H2[i].ok[k])) && r.hollows.length === 0);
  const day = M.rules[5].blocks.map((b) => `${b.from}–${b.to}`).join(', '), gust = M.rules[2].blocks.map((b) => `${b.from}–${b.to}`).join(', ');
  ok(blocksOk && day === '11–22, 35–46' && gust === '0–3, 6–9, 25–34', `blocks: every rule's runs of ruled-out hours as found here; Daylight ${day} (two night slabs, 24 h), Gusts ${gust} (18 h)`);
  // a bar exactly on a half pixel (12 × (1 − comfort) = n + 0.5 in exact arithmetic) may round either way by the last bit of
  // floating point: the refreshed demo of 2026-10-08 has one, Temperature at hour 29 (3.5 px, drawn 3)
  const barsOk = M.rules.every((r, k) => {
    const got = new Map(r.bars.map((b) => [b.i, b.h]));
    for (let i = 0; i < 48; i++) {
      const raw = H2[i].ok[k] ? 12 * (1 - H2[i].comfort[k]) : null, tie = raw != null && Math.abs((raw % 1) - 0.5) < 1e-9;
      const want = raw == null ? [0] : tie ? [Math.floor(raw), Math.ceil(raw)] : [Math.round(raw)];
      if (!want.includes(got.has(i) ? got.get(i) : 0)) return false;
    }
    return [...got.keys()].every((i) => H2[i].ok[k]);
  });
  const hist = (r) => r.bars.reduce((a, b) => ({ ...a, [b.h]: (a[b.h] || 0) + 1 }), {});
  const g = hist(M.rules[2]);
  ok(barsOk && M.rules.map((r) => r.bars.length).join() === '4,0,30,45,37,0' && g[7] === 9 && g[12] === 2 && Math.max(...M.rules[4].bars.map((b) => b.h)) === 10 && Math.max(...M.rules[3].bars.map((b) => b.h)) === 7,
    `bars, round(12 × (1 − comfort)) px: ${M.rules.map((r) => `${r.name} ${r.bars.length}`).join(', ')}; Gusts 9 at 7 px and 2 at 12 px; Dew point up to 10, Temperature up to 7 (ART.md)`);
  const bw = [[4, 2, 0], [5, 2, 1], [12, 4, 3]].every(([p, w, x]) => { const G = SH.geometry(LABEL + p * 48 + 26, LABEL, 48, 6); return G.ph === p && G.bw === w && G.bx === x && x + w <= p - 1 && Math.abs(x + w / 2 - (p - 1) / 2) <= 0.5; });
  ok(M.rules.every((r) => r.bars.every((b) => b.h <= 12)) && SH.ROW === 16 && SH.BAR === 12 && bw, 'a bar is never as tall as a block, at most 12 px against a 16 px block; and thin, 2 px wide at 4 and 5 px an hour and 4 px at 12, centered on its hour under the tracer head');
  const sum = app.every((row, i) => { const marks = row.checks.map((c, k) => (c.ok ? 12 * (1 - c.comfort) : 12)); return Math.abs(100 - (100 * marks.reduce((a, b) => a + b, 0)) / (12 * marks.length) - (100 * row.checks.reduce((a, c) => a + c.comfort, 0)) / row.checks.length) < 1e-9; });
  ok(sum, 'every hour\'s score is 100 minus the mean of its column\'s marks as shares of 12 px, a block counting as all of them (the sentence About prints)');
  ok(M.rules.map((r) => r.out).join() === '0,2,18,0,0,24' && M.brackets.map((b) => `${b.from}–${b.to}`).join() === '4–5,23–24', `counts at the right ${M.rules.map((r) => r.out).join(', ')}; brackets at hours ${M.brackets.map((b) => `${b.from}–${b.to}`).join(', ')}`);
  ok(M.mids.join() === '16,40' && M.quarters.join() === '4,10,22,28,34,46' && M.nowAt === null && M.past.every((p) => !p), `the axis: midnights at hours ${M.mids.join(', ')}, 06:00, 12:00 and 18:00 at ${M.quarters.join(', ')}; the file has run out, so no now and no faint hour`);
  const desc = SH.describe(M, app, SC.findWindows(app, rules.minWindowHours), off);
  ok(desc === '48 hours from Thursday 8 October, 08:00. Daylight rules out 24 hours, gusts 18 and rainfall 2; rain chance, temperature and dew point none. Windows: Thursday 12:00 to 14:00, 2 hours; Friday 07:00 to 09:00, 2 hours.', `VoiceOver's description: "${desc}"`);
  ok(JSON.stringify(SH.keyItems(M)) === JSON.stringify([['blk', 'Ruled out'], ['used', 'Share of the limit'], ['frame', 'Window']]), `the key under the Shutters, in place of the band's sentence: ${SH.keyItems(M).map((k) => k[1]).join(', ')}`);
  ok(M.G.top === 1 && M.G.rb === 1 + 6 * 19 - 3 && M.G.brY === M.G.rb + 4 && M.G.base === M.G.brY + 9, `with no present in the file the rows start at y ${M.G.top}: six 16 px rows 3 px apart, their foot at ${M.G.rb}, the sills at ${M.G.brY}, the axis at ${M.G.base}`);
  ok(SH.hourAt(M, LABEL + 7 * 5 + 2) === 7 && SH.hourAt(M, LABEL - 20) === null && SH.hourAt(M, LABEL - 20, true) === 0 && SH.hourAt(M, 999, true) === 47, 'the hour under x: inside the plot its hour; on the labels nothing for a tap, the first hour for a drag; past the end the last');
}
// inside the file: Thu 8 Oct, 16:00 UTC, noon in Boston
{
  const now = Date.parse('2026-10-08T16:00:00Z'), left = app.filter((r) => r.epoch + 3600e3 > now);
  const M = SH.model({ rows: app, windows: SC.findWindows(left, rules.minWindowHours), offset: off, now, width: 358, label: LABEL, ranOut: false });
  const faint = M.past.filter(Boolean).length, split = M.rules[5].blocks.filter((b) => b.past).length;
  ok(M.nowAt === 4 && faint === 4 && split === 0 && M.labels.some((l) => l.text === 'Fri 9') && M.brackets[0].from === 4 && M.G.top === 17, `at noon in Boston: now at hour ${M.nowAt}, in its own row over the stack (the rows from y ${M.G.top}), ${faint} hours faint (the morning, in daylight, so no night slab faint), the first window from hour ${M.brackets[0].from}; axis labels ${M.labels.map((l) => l.text).join(', ')}`);
}

/* ── a reader's own file, fetched at every hour of the day (a Shortcut's file starts at the fetch hour), in Oslo
   (UTC+2), read 2 h 30 min later: every midnight's day labeled under its tick, no day's name running under a
   midnight it does not name, `now` always in its row over the stack, never where the tracer head stands ── */
{
  const p2 = (x) => String(x).padStart(2, '0'), bad = [], firsts = [];
  for (let start = 0; start < 24; start++) {
    const s = clone(snap);
    s.utc_offset_seconds = 7200;
    const t0 = Date.UTC(2026, 8, 20, start);
    s.hourly.time = s.hourly.time.map((_, i) => { const d = new Date(t0 + i * 3600e3); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:00`; });
    s.daily = { time: ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'], sunrise: Array(4).fill('2026-09-20T07:00'), sunset: Array(4).fill('2026-09-20T19:00') };
    const rows = SC.scoreHours(s, rules), now = rows[0].epoch + 2.5 * 3600e3, left = rows.filter((r) => r.epoch + 3600e3 > now);
    const width = (t) => t.length * 5.2;   // the face at 10.5 px is about 5.2 px a character for these labels
    const M = SH.model({ rows, windows: SC.findWindows(left, rules.minWindowHours), offset: 7200, now, width: 358, label: LABEL, ranOut: false, measure: width });
    const dayOf = (i) => { const d = new Date(rows[i].epoch + 7200e3); return `${U.DAYS[d.getUTCDay()]} ${d.getUTCDate()}`; };
    const ticks = M.mids.map((i) => LABEL + i * M.G.ph);
    const named = M.mids.every((i) => M.labels.some((l) => l.text === dayOf(i) && l.x === LABEL + i * M.G.ph && l.anchor === 'middle'));
    const crossing = M.labels.filter((l) => l.kind === 'day' && ticks.some((x) => l.a < x && x < l.b && x !== l.x));
    const first = M.labels.find((l) => l.anchor === 'start');
    const clear = !first || !ticks.length || first.b <= ticks[0] - SH.LABEL_GAP;
    const headTop = M.G.base - 8.5, notchFoot = M.G.top;
    if (!named || crossing.length || !clear || M.nowAt !== 2.5 || M.G.top !== 17 || !(notchFoot < headTop)) bad.push(`${p2(start)}:00 (${M.labels.map((l) => l.text).join(', ')})`);
    firsts.push(first ? 1 : 0);
  }
  ok(bad.length === 0, `a file fetched at each of the 24 hours of the day: every midnight's day under its own tick, no day's name across a midnight it does not name, the first day's name ${firsts.filter(Boolean).length} times where it ends ${SH.LABEL_GAP} px before the first midnight (left out otherwise), \`now\` in its row over the stack every time, its notch above the stack and the tracer head below it${bad.length ? `: ${bad.join(' | ')}` : ''}`);
}

/* ── a window across midnight: its span never reads backwards ── */
{
  const A = SC.scoreHours(snap, { maxRainChancePct: 100 }), W = SC.findWindows(A, 2), M = SH.model({ rows: A, windows: W, offset: off, now: 0, width: 358, label: LABEL, ranOut: true });
  const d = SH.describe(M, A, W, off);
  ok(W.length === 1 && U.placeSpan(W[0].start.epoch, W[0].end.epoch + 3600e3, off) === '08:00 to Sat 08:00' && d.endsWith('Windows: Thursday 08:00 to Saturday 08:00, 48 hours.'), `one rule that rules out nothing: one window over the whole file, "${U.placeSpan(W[0].start.epoch, W[0].end.epoch + 3600e3, off)}"; VoiceOver: "${d.slice(d.indexOf('Windows'))}"`);
  const M0 = SH.model({ rows: SC.scoreHours(snap, {}), windows: [], offset: off, now: 0, width: 358, label: LABEL, ranOut: true });
  ok(M0.rules.length === 0 && JSON.stringify(SH.keyItems(M0)) === JSON.stringify([['frame', 'Window']]), `no rule in use: no row, and the key is the window alone: ${SH.keyItems(M0).map((k) => k[1]).join(', ')}`);
}

/* ── rules files with keys left out, a band missing an end, "Golden", a value missing ── */
{
  const r1 = { ...rules };
  delete r1.maxPrecipMm;
  r1.temperatureC = { min: 2 };
  const A = SC.scoreHours(snap, r1), M = SH.model({ rows: A, windows: [], offset: off, now: 0, width: 358, label: LABEL, ranOut: true });
  ok(M.rules.map((r) => r.name).join() === 'Rain chance,Gusts,Dew point,Daylight', `rainfall left out and temperature missing its max: no row for either (the scorer does not apply them): ${M.rules.map((r) => r.name).join(', ')}`);
  const r2 = { ...rules, daylight: 'Golden' }, B = SC.scoreHours(snap, r2), mineB = mine(snap, r2);
  const M2 = SH.model({ rows: B, windows: [], offset: off, now: 0, width: 358, label: LABEL, ranOut: true });
  const gold = B.filter((r) => r.light === 'golden').map((r) => r.stamp.slice(11, 16)).join(' ');
  ok(M2.rules[5].name === 'Golden hour' && B.every((r, i) => r.pass === mineB[i].pass && r.score === mineB[i].score) && SC.lightRule(r2) === 'golden' && gold === '08:00 17:00 18:00 07:00 08:00 17:00 18:00 07:00',
    `"daylight": "Golden" is read ignoring case: the row is Golden hour, the golden hours ${gold}, every score as found here (B12)`);
  const s3 = clone(snap);
  s3.hourly.wind_gusts_10m[10] = null;
  s3.hourly.wind_gusts_10m[11] = null;
  const C = SC.scoreHours(s3, rules), M3 = SH.model({ rows: C, windows: [], offset: off, now: 0, width: 358, label: LABEL, ranOut: true });
  ok(C[10].checks[2].missing && !C[10].pass && JSON.stringify(M3.rules[2].hollows.map((b) => [b.from, b.to])) === '[[10,11]]' && !M3.rules[2].blocks.some((b) => b.from <= 11 && b.to >= 10) && SH.keyItems(M3).some((k) => k[0] === 'ho' && k[1] === 'No value'),
    'a gust missing for two hours: those hours are ruled out (no data is not a pass) and drawn as one hollow block, never ink; the key adds "No value"');
}

/* ── units: every form the screen uses ── */
{
  const cases = [
    [U.num(35.5), '35.5'], [U.num(34.9), '34.9'], [U.num(0), '0'], [U.num(-10), `${MINUS}10`], [U.num(-0), '0'], [U.num(null), null], [U.num(12345.5), `12${NB}345.5`],
    [U.withUnit(29.2, 'km/h'), `29.2${NB}km/h`], [U.withUnit(0, '%'), `0${NB}%`], [U.withUnit(-3.5, '°C'), `${MINUS}3.5${NB}°C`],
    [U.coords(42.365166, -71.0618), `42.37°${NB}N, 71.06°${NB}W`], [U.zone(-240), `UTC${MINUS}4`], [U.zone(330), 'UTC+5:30'],
    [U.span(9 * 864e5 + 3600e3), `9${NB}d`], [U.span(5 * 3600e3), `5${NB}h`], [U.span(20 * 60e3), `20${NB}min`],
    [U.placeDays(Date.parse('2026-09-21T09:00:00Z'), Date.parse('2026-09-23T08:00:00Z'), off), '21 to 23 Sep 2026'],
    [U.placeDays(Date.parse('2026-09-30T09:00:00Z'), Date.parse('2026-10-02T08:00:00Z'), off), '30 Sep to 2 Oct 2026'],
    [U.placeDate(Date.parse('2026-09-22T12:00:00Z'), off, Date.parse('2026-10-02T10:00:00Z')), 'Tue 22 Sep'],
    [U.placeDate(Date.parse('2026-09-22T12:00:00Z'), off, Date.parse('2027-01-05T10:00:00Z')), 'Tue 22 Sep 2026'],
    [U.spokenHour(Date.parse('2026-09-21T11:00:00Z'), off), 'Monday 21 September, 07:00'],
    [U.stampWhen(Date.parse(snap.generatedAt), Date.parse('2026-10-08T16:00:00Z')), '14:47'],
    [U.stampWhen(Date.parse(snap.generatedAt), Date.parse('2026-10-20T10:00:00Z')), '8 Oct, 14:47'],
    [U.full(Date.parse(snap.generatedAt)), 'Thu 8 Oct 2026, 14:47 (UTC+2)'],
    [U.spokenValue(-3.5, '°C'), 'minus 3.5 degrees Celsius'], [U.spokenValue(29.2, 'km/h'), '29.2 kilometers an hour'],
    [U.placeSpan(Date.parse('2026-09-21T11:00:00Z'), Date.parse('2026-09-21T23:00:00Z'), off), '07:00–19:00'],
    [U.placeSpan(Date.parse('2026-09-22T00:00:00Z'), Date.parse('2026-09-22T04:00:00Z'), off), '20:00–24:00'],
    [U.placeSpan(Date.parse('2026-09-21T14:00:00Z'), Date.parse('2026-09-23T09:00:00Z'), off), '10:00 to Wed 05:00'],
    [U.placeSpan(Date.parse('2026-09-22T00:00:00Z'), Date.parse('2026-09-22T06:00:00Z'), off), '20:00 to Tue 02:00'],
  ];
  const bad = cases.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `units: ${cases.length} forms, each as ART.md and HOUSE.md 6.1 give it (the data's own precision, U+202F, the true minus, 24-hour, day before month)${bad.length ? ': ' + bad.map(([a, b]) => `${a} for ${b}`).join(' | ') : ''}`);
}

console.log(fails.length ? `\n${fails.length} of ${n} failed` : `\nall ${n} checks pass`);
process.exit(fails.length ? 1 : 0);
