// The decode and card test (HOUSE.md 7.3; ART.md section 1): data/snapshot.json read with code written here, against
// the app's pure modules js/units.js and js/card.js, with the Time Card's rule re-implemented in this file (px per
// hour, the punch x of fixed instants in Europe/Oslo, both 2026 clock-change days, tails across one and two
// midnights, a tail under 1 px, a reading before the writing, the record's dedupe and its 400 cap, the stamp's five
// states and its two edges, describe()'s words, the lead's local clock for the committed file). The art pass changes
// no data; this proves the app reads it as the data says.
//
//   node tools/test_card.mjs

process.env.TZ = 'Europe/Oslo';   // set before any Date: the phone's zone for every clock-dependent form
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = await import(path.join(APP, 'js/card.js'));
const U = await import(path.join(APP, 'js/units.js'));
const raw = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
const snap = JSON.parse(raw);
const fails = [];
let n = 0;
const ok = (cond, msg) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const NB = '\u202f', MI = '\u2212';
const T = (s) => Date.parse(s);
const p2 = (k) => String(k).padStart(2, '0');

/* ── the rule, written here ── */
const PPH = (pane) => Math.max(1, Math.min(24, Math.floor((pane - 40) / 24)));
const X = (ms, pph) => { const d = new Date(ms); return 40 + Math.round((d.getHours() + d.getMinutes() / 60) * pph); };
const localDay = (ms) => { const d = new Date(ms); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const ROW = (ms, now) => localDay(now) - localDay(ms);
const Y = (k) => 16 + 14 * k + 3;   // the punch's top and the tail's row: the row's foot (y + 13) less 10
/** The tail segments of a file written at `w` and first read at `f`, on the card at `now`, as rects. */
function tailsOf(w, f, now, pph) {
  const kw = ROW(w, now), kr = ROW(f, now), R = 40 + 24 * pph, out = [];
  if (kw < 0 || kw > 6 || f < w || kr < 0) return out;
  const x = Math.min(X(w, pph), R - 2), xr = X(f, pph);
  if (kr === kw) { if (xr - x >= 1) out.push([x, xr - x, kw]); return out; }
  if (R - x >= 1) out.push([x, R - x, kw]);
  for (let k = kw - 1; k > kr; k--) out.push([40, 24 * pph, k]);
  if (xr - 40 >= 1) out.push([40, xr - 40, kr]);
  return out;
}
const flat = (tails) => tails.map((t) => [t.x, t.w, t.k].join('/')).join(' ');

/* ── 1. the shipped file, decoded here ── */
const GEN = T(snap.generatedAt);
const SAT = T('2026-10-03T10:00:00Z');   // 12:00 in Oslo on 3 Oct: what a fresh install and the marketing camera see
{
  const d = new Date(GEN);
  const utcClock = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} UTC`;
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1), doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - jan1) / 864e5) + 1;
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); thu.setUTCDate(thu.getUTCDate() + 3 - ((thu.getUTCDay() + 6) % 7));
  const week = 1 + Math.round(((thu - Date.UTC(thu.getUTCFullYear(), 0, 4)) / 864e5 - 3 + ((new Date(Date.UTC(thu.getUTCFullYear(), 0, 4)).getUTCDay() + 6) % 7)) / 7);
  const minute = d.getUTCHours() * 60 + d.getUTCMinutes();
  const rows = Object.fromEntries(snap.runs.map((r) => [r.label, r.value])), ask = Object.fromEntries(snap.ask.map((r) => [r.measure, r.value]));
  ok(!Number.isNaN(GEN) && snap.headline === utcClock, `the shipped file: generatedAt ${snap.generatedAt} parses; its UTC clock is the headline, "${snap.headline}"`);
  ok(rows['Day of year'] === String(doy) && rows.Week === String(week) && rows['Minute of day'] === String(minute), `its three rows are that instant three more ways: day ${doy}, ISO week ${week}, minute ${minute} (the file says ${rows['Day of year']}, ${rows.Week}, ${rows['Minute of day']})`);
  ok(ask['Day of year'] === doy && ask.Week === week && ask['Minute of day'] === minute && snap.ask.length === 3, `its ask table holds the same three as numbers; ${snap.ask.length} rows, never read by the app`);
  ok(U.localLead(GEN) === '03:59 on this phone’s clock' && U.full(GEN) === 'Thu 1 Oct 2026, 03:59 (UTC+2)', `the lead on the phone's clock in Oslo: "${U.localLead(GEN)}"; About's instant "${U.full(GEN)}"`);
}

/* ── 2. px per hour at the pane widths ── */
{
  const want = { 312: 10, 320: 10, 360: 12, 375: 12, 390: 13, 430: 14, 844: 24 };
  const got = Object.fromEntries(Object.keys(want).map((w) => [w, C.layout(w - 32).pph]));
  ok(Object.keys(want).every((w) => got[w] === want[w] && got[w] === PPH(w - 32)), `px per hour by screen width (pane = width − 32): ${Object.entries(got).map(([w, p]) => `${w}: ${p}`).join(', ')}`);
  const L = C.layout(358);
  ok(L.x0 === 40 && L.plot === 312 && L.width === 352 && L.height === 136, `at 390 px: the label column 40, the plot 312, the card 352 × 136`);
}

/* ── 3. the punch x of fixed instants in Oslo, both clock-change days ── */
{
  const L = C.layout(358);
  const cases = [
    ['the committed file, 03:59', GEN, 92],
    ['midnight', T('2026-10-02T22:00:00Z'), 40],
    ['23:59 (clamped inside the plot)', T('2026-10-03T21:59:00Z'), 350],
    ['25 Oct 02:30 CEST, the first pass', T('2026-10-25T00:30:00Z'), 73],
    ['25 Oct 02:30 CET, the second pass, drawn on the first', T('2026-10-25T01:30:00Z'), 73],
    ['29 Mar 01:30 CET, before the spring gap', T('2026-03-29T00:30:00Z'), 60],
    ['29 Mar 03:30 CEST, after it (02:00 to 03:00 empty)', T('2026-03-29T01:30:00Z'), 86],
  ];
  for (const [label, ms, want] of cases) {
    const G = C.geometry([[ms, ms]], ms, L);
    ok(G.punches.length === 1 && G.punches[0].x === want && G.punches[0].x === Math.min(X(ms, 13), 350) && G.punches[0].k === 0 && G.punches[0].w === 2 && G.punches[0].h === 10 && G.punches[0].y === Y(0),
      `punch x for ${label}: ${G.punches[0] && G.punches[0].x} (written here: ${Math.min(X(ms, 13), 350)}), 2 × 10 px in today's row`);
  }
  ok(C.wallHour(T('2026-10-25T00:30:00Z')) === 2.5 && C.wallHour(T('2026-10-25T01:30:00Z')) === 2.5, 'the autumn\'s repeated hour: both instants are 02:30 on the wall clock');
}

/* ── 4. the rows and the tails: the committed file at 12:00 Oslo on 3 Oct (two midnights), one midnight, none ── */
{
  const L = C.layout(358);
  const G = C.geometry([[GEN, SAT]], SAT, L);
  ok(G.rows.map((r) => r.label).join() === 'Sat 3,Fri 2,Thu 1,Wed 30,Tue 29,Mon 28,Sun 27' && G.rows.every((r, k) => r.y === 16 + 14 * k) && G.rows[0].today, `the rows at 12:00 on Sat 3 Oct: ${G.rows.map((r) => r.label).join(', ')}, today at the top`);
  ok(G.punches.length === 1 && G.punches[0].k === 2 && G.punches[0].x === 92 && G.punches[0].y === Y(2), `the committed file's punch in Thursday's row (k 2) at x 92, y ${Y(2)}`);
  const want = tailsOf(GEN, SAT, SAT, 13);
  ok(flat(G.tails) === want.map((t) => t.join('/')).join(' ') && G.tails.length === 3 && G.tails[0].x === 92 && G.tails[0].w === 260 && G.tails[1].w === 312 && G.tails[2].x === 40 && G.tails[2].w === 156,
    `its tail across two midnights: Thu 92 to 352, Fri the whole row, Sat 40 to 196 (12:00) — ${flat(G.tails)}`);
  ok(G.now.x === 196 && G.now.y === 16 + 13 - 5 && G.now.h === 5 && G.now.labelX === 196.5 && G.now.hairY === 16 && G.now.hairH === 8, `now at 12:00: a 1 × 5 notch at x 196 at the foot of today's 14 px row (never a punch's 10), joined to its word by a hairline 16 to 24, its word centered on it (${G.now.labelX})`);
  ok(G.files === 1 && G.before === 0 && G.latest.written === GEN, 'counts: 1 file in the seven days, none read before its writing');
  // one midnight: written Fri 23:30, read Sat 02:30
  const w1 = T('2026-10-02T21:30:00Z'), f1 = T('2026-10-03T00:30:00Z');
  const G1 = C.geometry([[w1, f1]], SAT, L);
  ok(flat(G1.tails) === flat(tailsOf(w1, f1, SAT, 13).map(([x, w, k]) => ({ x, w, k }))) && G1.tails.length === 2 && G1.tails[0].x === 346 && G1.tails[0].w === 6 && G1.tails[1].x === 40 && G1.tails[1].w === 33,
    `one midnight: Fri 346 to 352, then Sat 40 to 73 (02:30) — ${flat(G1.tails)}`);
  // the clock-change night: written Sat 24 Oct 23:30 CEST, read Sun 25 Oct 02:30 CET (the second 02:30), seen Mon 26
  const MON = T('2026-10-26T11:00:00Z'), w2 = T('2026-10-24T21:30:00Z'), f2 = T('2026-10-25T01:30:00Z');
  const G2 = C.geometry([[w2, f2]], MON, L);
  ok(G2.rows[0].label === 'Mon 26' && G2.punches[0].k === 2 && G2.tails.length === 2 && G2.tails[1].k === 1 && G2.tails[1].w === 33, `across the autumn clock change: the punch in Saturday's row (k 2), the tail into Sunday's to 02:30 (x 73) — ${flat(G2.tails)}`);
  // a same-day tail, and one under 1 px not drawn
  const G3 = C.geometry([[GEN, GEN + 31 * 60000]], T('2026-10-01T02:30:00Z'), L);
  ok(G3.punches[0].k === 0 && G3.tails.length === 1 && G3.tails[0].x === 92 && G3.tails[0].w === 7, `the fresh state (read 31 minutes after the writing): one tail in today's row, 92 to 99 (${flat(G3.tails)})`);
  const G4 = C.geometry([[GEN, GEN + 2 * 60000]], GEN + 2 * 60000, L);
  ok(G4.punches.length === 1 && G4.tails.length === 0, 'a file read two minutes after its writing: a bare punch, the tail under 1 px not drawn');
  // a reading before the writing: no tail, counted
  const G5 = C.geometry([[GEN, GEN - 600000]], SAT, L);
  ok(G5.punches.length === 1 && G5.tails.length === 0 && G5.before === 1, 'a first reading before the writing (a phone behind the server): the punch, no tail, counted for About');
  // written before the seven days and read inside them (after review): no punch, the tail's part inside, from the
  // oldest row's left edge; written and read before them, or written after today: nothing
  const G6 = C.geometry([[T('2026-09-26T10:00:00Z'), SAT], [T('2026-09-20T10:00:00Z'), T('2026-09-21T10:00:00Z')], [SAT + 864e5, SAT + 864e5]], SAT, L);
  const want6 = [6, 5, 4, 3, 2, 1].map((k) => `40/312/${k}`).concat(['40/156/0']).join(' ');
  ok(G6.punches.length === 0 && flat(G6.tails) === want6 && G6.files === 1 && G6.carried === 1 && G6.latest.off,
    `a file written before the card's seven days and read on its last: no punch, the tail through the six older rows and today's to 12:00 (${flat(G6.tails)}); one written and read before them, and one after today, draw nothing`);
  // the starter pack nine days on: the committed file first read on Sat 10 Oct, 10:00 in Oslo
  const NINE = T('2026-10-10T08:00:00Z'), G8 = C.geometry([[GEN, NINE]], NINE, L);
  ok(G8.punches.length === 0 && G8.tails.length === 7 && G8.tails[6].k === 0 && G8.tails[6].w === 130 && G8.files === 1 && G8.rows[6].label === 'Sun 4',
    `the starter pack's file nine days old: rows Sat 10 to Sun 4, no punch, 7 tail pieces ending at 10:00 in today's row (x 170) — ${flat(G8.tails)}`);
  // the record empty
  const G7 = C.geometry([], SAT, L);
  ok(G7.punches.length === 0 && G7.tails.length === 0 && G7.rows.length === 7 && G7.now.x === 196, 'an empty record: seven empty rows and the now notch');
  // the axis
  ok(G.baseline === 114 && G.ticks.length === 25 && G.ticks.filter((t) => t.major).length === 5 && G.labels.map((l) => l.text).join() === '00:00,06:00,12:00,18:00,24:00' && G.labels[0].anchor === 'start' && G.labels[4].anchor === 'end' && G.labels[4].x === 352 && G.dropped.length === 0,
    `the axis: a baseline at y 114, 25 hour ticks (5 of them 6-hourly), labels ${G.labels.map((l) => l.text).join(' ')} (00:00 at the left edge, 24:00 at the right), none dropped`);
  ok(G.hairs.length === 6 && G.hairs[0].y === 29 && G.hairs[5].y === 99 && G.quarters.map((q) => q.x).join() === '118,196,274', 'six row hairlines (the last row\'s foot is the baseline) and the quarter-day hairlines at 06:00, 12:00, 18:00');
  const narrow = C.geometry([], SAT, C.layout(160));
  ok(narrow.L.pph === 5 && narrow.dropped.join() === '06:00,18:00' && narrow.labels.map((l) => l.text).join() === '00:00,12:00,24:00', `a plot too narrow for five labels (5 px an hour): 06:00 and 18:00 dropped, ${narrow.labels.map((l) => l.text).join(' ')} kept`);
}

/* ── 4b. the rows taking the pane's free height (after QA): 14 px at the least, 40 at the most, whole pixels ── */
{
  ok(C.rowFor(136) === 14 && C.rowFor(80) === 14 && C.rowFor(NaN) === 14 && C.rowFor(38 + 7 * 27 + 6) === 27 && C.rowFor(318) === 40 && C.rowFor(900) === 40,
    `rowFor(): 136 px of room 14, less still 14, NaN 14, 233 px 27 (the remainder dropped), 318 px 40, 900 px still 40`);
  const T40 = C.layout(358, 40), G = C.geometry([[GEN, SAT]], SAT, T40);
  ok(T40.row === 40 && T40.punchH === 36 && T40.nowH === 9 && C.layout(358, 16).nowH === 7 && C.layout(358, 18).nowH === 9 && T40.height === 16 + 280 + 22 && C.layout(358).row === 14 && C.layout(358, 99).row === 40 && C.layout(358, 3).row === 14,
    `layout() with 40 px rows: the punch 36, the notch 9 (7 at 16 px rows, 9 from 18), never a punch's shape, the card ${T40.height} px tall; the default 14; asked for 99 it gives 40, for 3 it gives 14`);
  ok(G.rows.every((r, k) => r.y === 16 + 40 * k) && G.punches[0].k === 2 && G.punches[0].y === 16 + 40 * 2 + 39 - 36 && G.punches[0].h === 36 && G.punches[0].x === 92 && G.baseline === 16 + 280 && G.now.y === 16 + 39 - 9 && G.now.hairH === 39 - 9 && G.hairs[0].y === 55,
    `at 40 px the same marks at the same x: rows every 40 px, the punch from Thursday's foot (y ${G.punches[0].y}, 36 tall), the baseline at ${G.baseline}, the now notch from today's foot`);
  ok(flat(G.tails) === flat(C.geometry([[GEN, SAT]], SAT, C.layout(358)).tails) && G.tails.map((t) => t.y).join() === [2, 1, 0].map((k) => 16 + 40 * k + 3).join(),
    `the tails at 40 px: the same pieces as at 14 (${flat(G.tails)}), each at its punch's top, 3 px under the row's top (y ${G.tails.map((t) => t.y).join(', ')})`);
}

/* ── 5. the record: remember(), sanitize() ── */
{
  let r = C.remember([], GEN, SAT);
  ok(r.length === 1 && r[0][0] === GEN && r[0][1] === SAT, 'remember(): the first file adds [written, firstRead]');
  const same = C.remember(r, GEN, SAT + 60000);
  ok(same === r, 'the same generatedAt again returns the same record (the first reading stands)');
  for (let i = 1; i <= 405; i++) r = C.remember(r, GEN + i * 3600e3, SAT + i);
  ok(r.length === 400 && r[399][0] === GEN + 405 * 3600e3 && r[0][0] === GEN + 6 * 3600e3, `the cap: 406 distinct files leave ${r.length}, newest last, the oldest six dropped`);
  ok(C.sanitize('x').length === 0 && C.sanitize([[1, 2], [3], ['a', 1], [4, 5]]).length === 2 && C.sanitize(null).length === 0, 'sanitize(): only pairs of finite numbers survive a read from storage');
}

/* ── 6. the stamp's states and edges (B1, B5, B6, B7) ── */
{
  const S = (made, now) => { const s = U.stamp(made, now); return `${s.lead}|${s.rest}`; };
  ok(S(GEN, T('2026-10-01T02:30:00Z')) === '|Updated 03:59', 'fresh: no lead, "Updated 03:59"');
  ok(S(GEN, GEN + 6 * 3600e3 - 1) === '|Updated 03:59' && S(GEN, GEN + 6 * 3600e3) === 'Stale.|Updated 09:59'.replace('09:59', U.clock(GEN)), `the 6 h edge: a millisecond under is fresh, at 6 h "Stale." (${S(GEN, GEN + 6 * 3600e3)})`);
  ok(S(GEN, SAT) === 'Stale.|Updated 1 Oct, 03:59', `two days on: "${S(GEN, SAT).replace('|', ' ')}" (the date, not an age)`);
  ok(S(SAT + 3600e3, SAT) === '|Updated 13:00' && S(SAT + 3600e3 + 1, SAT) === 'Made after the phone’s time.|Updated 13:00', `the 1 h edge ahead: exactly an hour is fresh, a millisecond more says "${U.stamp(SAT + 3600e3 + 1, SAT).lead}" (the stock printed "just now")`);
  ok(S(null, SAT) === 'Undated file.|' && S(NaN, SAT) === 'Undated file.|', 'an unreadable generatedAt: "Undated file." and no instant (the stock printed the raw string)');
  ok(S(T('2025-10-01T01:59:56Z'), SAT) === 'Stale.|Updated 1 Oct 2025, 03:59', `a file from another year carries it: "${S(T('2025-10-01T01:59:56Z'), SAT).split('|')[1]}"`);
}

/* ── 7. the words ── */
{
  ok(C.describe([[GEN, SAT]], SAT) === 'Time card, 7 days: 1 file read; the latest written Thursday 1 October, 03:59, first read here Saturday 3 October, 12:00.', `describe(): "${C.describe([[GEN, SAT]], SAT)}"`);
  ok(C.describe([[GEN, T('2026-10-10T08:00:00Z')]], T('2026-10-10T08:00:00Z')) === 'Time card, 7 days: 1 file read; the latest written Thursday 1 October, 03:59, before these 7 days, first read here Saturday 10 October, 10:00.',
    `describe() for a file written before the seven days (after review): "${C.describe([[GEN, T('2026-10-10T08:00:00Z')]], T('2026-10-10T08:00:00Z'))}"`);
  ok(C.describe([[GEN, GEN]], T('2026-10-20T08:00:00Z')) === 'Time card, 7 days: no file read in these 7 days.', 'describe() with a record but nothing in the seven days: "no file read in these 7 days", never the empty record\'s words');
  ok(C.describe([], SAT) === 'Time card, 7 days: no file read.' && C.describe([[GEN, SAT], [GEN + 3600e3, SAT]], SAT).startsWith('Time card, 7 days: 2 files read; the latest written Thursday 1 October, 04:59,'), 'describe() with no file, and with two');
  ok(U.offsetWord(GEN) === 'UTC+2' && U.offsetWord(T('2026-12-01T12:00:00Z')) === 'UTC+1' && U.offsetWord(T('2026-10-25T01:30:00Z')) === 'UTC+1', 'the offset word: UTC+2 in summer, UTC+1 after 25 Oct 03:00');
  ok(U.span(SAT - GEN) === `2${NB}d` && U.span(6 * 3600e3) === `6${NB}h` && U.span(59 * 60000 + 59000) === `59${NB}min` && U.span(47 * 3600e3 + 59 * 60000) === `47${NB}h`, `spans: ${[U.span(SAT - GEN), U.span(6 * 3600e3), U.span(59 * 60000), U.span(47 * 3600e3)].join(', ').replace(/ /g, ' ')} (whole units, rounded down)`);
  ok(U.si('10 m') === `10${NB}m` && U.si('274') === '274' && U.si('5 h ago') === `5${NB}h ago` && U.si('40 weeks') === '40 weeks', 'si(): U+202F before a known unit, a bare count untouched');
  ok(U.int(16380) === `16${NB}380` && U.int(-3) === `${MI}3` && U.count(1, 'file') === '1 file' && U.count(400, 'file') === '400 files', 'int() groups from four digits with U+202F and uses the true minus; count() pluralizes');
  ok(U.dayTick(SAT) === 'Sat 3' && U.dayTick(T('2026-09-30T10:00:00Z')) === 'Wed 30' && U.dayMon(GEN, SAT) === '1 Oct' && U.dayMon(T('2025-10-01T01:59:56Z'), SAT) === '1 Oct 2025', 'the tick form and the stamp\'s day');
  ok(U.spoken(GEN) === 'Thursday 1 October, 03:59' && U.stampWhen(GEN, GEN + 60000) === '03:59' && U.stampWhen(GEN, SAT) === '1 Oct, 03:59', 'spoken() and stampWhen()');
  ok(U.STALE_MS === 6 * 3600e3 && U.AHEAD_MS === 3600e3 && C.MAX_RECORD === 400 && C.DAYS_SHOWN === 7 && C.HEIGHT === 136, 'the constants About and NOTES.md quote: 6 h, 1 h, 400 files, 7 days, 136 px');
}

console.log(fails.length ? `\n${fails.length} of ${n} checks failed` : `\nall ${n} checks pass`);
process.exit(fails.length ? 1 : 0);
