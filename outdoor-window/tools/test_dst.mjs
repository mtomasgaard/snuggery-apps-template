// The daylight-saving test (tools/DECISIONS.md, D-DST): the app across both of Oslo's changes of the clocks
// and Boston's, on the fixtures in tools/dst/ (written by tools/dst/make_fixtures.py from what Open-Meteo
// returned when measured on 2026-10-06: one offset per file, the one in force at the fetch, no hour repeated
// or skipped). What it proves:
//   1. js/score.js places every hour exactly an hour after the one before, on the file's one offset;
//   2. js/units.js tells every hour on the place's own clock: the repeated hour twice in autumn, the missing
//      hour missing in spring, each day's hours under the day the place's clocks were in, sunrise as the
//      clocks read it, and the zone named by both offsets;
//   3. with no zone, an unknown zone or a zone that never keeps the file's offset, the file's offset alone;
//   4. scripts/outdoor_window.py's ask table writes the same date and time for every hour as the app shows.
//
//   node tools/test_dst.mjs

process.env.TZ = 'Asia/Tokyo';   // the phone's own zone must play no part in the place's clock
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SC = await import(path.join(APP, 'js/score.js'));
const SH = await import(path.join(APP, 'js/shutters.js'));
const U = await import(path.join(APP, 'js/units.js'));
const rules = JSON.parse(fs.readFileSync(path.join(APP, 'data/rules.json'), 'utf8'));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(APP, 'tools', 'dst', `${name}.json`), 'utf8'));
const fails = [];
let n = 0;
const ok = (cond, msg) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const MINUS = '−';

/** The app's own path: scored rows, and the place derive() makes from the file. */
function load(snap) {
  const rows = SC.scoreHours(snap, rules);
  const place = U.placeOf(snap.timezone, snap.utc_offset_seconds, rows.map((r) => r.epoch).filter(Number.isFinite));
  return { rows, place };
}
const byLabel = (snap, rows, label) => rows[snap.hourly.time.indexOf(label)];
/** The hours the app prints under each day, in order: { 'Sun 25 Oct': ['00:00', ...] }. */
function days(rows, place) {
  const out = {};
  for (const r of rows) (out[U.placeDate(r.epoch, place, 0).replace(/ \d{4}$/, '')] ||= []).push(U.placeClock(r.epoch, place));
  return out;
}

const CASES = [
  {
    name: 'oslo-fall-2026', zone: 'UTC+2, then UTC+1', day: 'Sun 25 Oct', hours: 25,
    seq: ['00:00', '01:00', '02:00', '02:00', '03:00', '04:00'], from: '2026-10-25T00:00',
    pairs: [['2026-10-25T02:00', '02:00'], ['2026-10-25T03:00', '02:00'], ['2026-10-25T04:00', '03:00'], ['2026-10-26T00:00', '23:00'], ['2026-10-26T11:00', '10:00']],
    sunrise: ['2026-10-25', '07:24'], span: ['2026-10-25T01:00', '2026-10-25T05:00', '01:00–04:00'], late: ['2026-10-25T20:00', '2026-10-26T01:00', '19:00–24:00'],
    midnight: '2026-10-26T01:00', mon: 'Mon 26',
  },
  {
    name: 'oslo-fall-2025', zone: 'UTC+2, then UTC+1', day: 'Sun 26 Oct', hours: 25,
    seq: ['00:00', '01:00', '02:00', '02:00', '03:00', '04:00'], from: '2025-10-26T00:00',
    pairs: [['2025-10-26T03:00', '02:00'], ['2025-10-27T11:00', '10:00']],
    sunrise: ['2025-10-26', '07:24'], span: ['2025-10-26T01:00', '2025-10-26T05:00', '01:00–04:00'], late: ['2025-10-26T20:00', '2025-10-27T01:00', '19:00–24:00'],
    midnight: '2025-10-27T01:00', mon: 'Mon 27',
  },
  {
    name: 'oslo-spring-2026', zone: 'UTC+1, then UTC+2', day: 'Sun 29 Mar', hours: 23,
    seq: ['00:00', '01:00', '03:00', '04:00', '05:00'], from: '2026-03-29T00:00',
    pairs: [['2026-03-29T01:00', '01:00'], ['2026-03-29T02:00', '03:00'], ['2026-03-29T22:00', '23:00'], ['2026-03-29T23:00', '00:00'], ['2026-03-30T11:00', '12:00']],
    sunrise: ['2026-03-30', '06:48'], span: ['2026-03-29T00:00', '2026-03-29T04:00', '00:00–05:00'], late: ['2026-03-29T19:00', '2026-03-29T23:00', '20:00–24:00'],
    midnight: '2026-03-29T23:00', mon: 'Mon 30',
  },
  {
    name: 'boston-fall-2026', zone: `UTC${MINUS}4, then UTC${MINUS}5`, day: 'Sun 1 Nov', hours: 25,
    seq: ['00:00', '01:00', '01:00', '02:00', '03:00'], from: '2026-11-01T00:00',
    pairs: [['2026-11-01T01:00', '01:00'], ['2026-11-01T02:00', '01:00'], ['2026-11-01T03:00', '02:00'], ['2026-11-02T00:00', '23:00'], ['2026-11-02T11:00', '10:00']],
    sunrise: ['2026-11-02', '06:20'], span: ['2026-11-01T00:00', '2026-11-01T04:00', '00:00–03:00'], late: ['2026-11-01T20:00', '2026-11-02T01:00', '19:00–24:00'],
    midnight: '2026-11-02T01:00', mon: 'Mon 2',
  },
  {
    name: 'boston-fall-2025', zone: `UTC${MINUS}4, then UTC${MINUS}5`, day: 'Sun 2 Nov', hours: 25,
    seq: ['00:00', '01:00', '01:00', '02:00', '03:00'], from: '2025-11-02T00:00',
    pairs: [['2025-11-02T02:00', '01:00'], ['2025-11-03T11:00', '10:00']],
    sunrise: ['2025-11-03', '06:20'], span: ['2025-11-02T00:00', '2025-11-02T04:00', '00:00–03:00'], late: ['2025-11-02T20:00', '2025-11-03T01:00', '19:00–24:00'],
    midnight: '2025-11-03T01:00', mon: 'Mon 3',
  },
];

for (const c of CASES) {
  const snap = fixture(c.name), { rows, place } = load(snap), off = snap.utc_offset_seconds;
  // 1. the instants: one offset, an hour apart, none repeated
  const steps = rows.slice(1).map((r, i) => r.epoch - rows[i].epoch);
  ok(rows.length === 48 && steps.every((s) => s === 3600e3) && rows.every((r, i) => r.epoch === Date.parse(`${snap.hourly.time[i]}Z`) - off * 1000),
    `${c.name}: 48 hours from ${snap.hourly.time[0]} on the file's one offset (UTC${off >= 0 ? '+' : MINUS}${Math.abs(off) / 3600}), each exactly an hour after the last`);
  // 2. the place's clock
  ok(place.zone === snap.timezone, `${c.name}: the place is the file's own zone, ${place.zone}`);
  const d = days(rows, place), i0 = snap.hourly.time.indexOf(c.from);
  const seq = rows.slice(i0, i0 + c.seq.length).map((r) => U.placeClock(r.epoch, place));
  ok(JSON.stringify(seq) === JSON.stringify(c.seq) && (d[c.day] || []).length === c.hours,
    `${c.name}: the night prints ${seq.join(' ')}; ${c.day} holds ${(d[c.day] || []).length} hours (${c.hours} expected)`);
  const pairs = c.pairs.map(([label, want]) => [label, U.placeClock(byLabel(snap, rows, label).epoch, place), want]);
  ok(pairs.every(([, got, want]) => got === want), `${c.name}: the file's labels on the place's clock: ${pairs.map(([l, g]) => `${l.slice(5)} as ${g}`).join(', ')}`);
  const rise = SC.sunTimes(snap, off).get(c.sunrise[0]).rise;
  ok(U.placeClock(rise, place) === c.sunrise[1], `${c.name}: sunrise on ${c.sunrise[0]} (the file's ${snap.daily.sunrise[snap.daily.time.indexOf(c.sunrise[0])].slice(11)}) prints ${U.placeClock(rise, place)}, as the clocks there read it`);
  const sp = (a, b) => U.placeSpan(byLabel(snap, rows, a).epoch, byLabel(snap, rows, b).epoch, place);
  ok(sp(c.span[0], c.span[1]) === c.span[2] && sp(c.late[0], c.late[1]) === c.late[2],
    `${c.name}: spans across the change print ${sp(c.span[0], c.span[1])} and ${sp(c.late[0], c.late[1])}`);
  ok(U.placeZones(rows[0].epoch, rows[47].epoch, place) === c.zone, `${c.name}: the zone line says ${U.placeZones(rows[0].epoch, rows[47].epoch, place)}`);
  const M = SH.model({ rows, windows: SC.findWindows(rows, rules.minWindowHours), offset: place, now: 0, width: 358, label: 60, ranOut: true });
  const mid = M.mids.map((i) => snap.hourly.time[i]);
  ok(mid.includes(c.midnight) && M.mids.length === 2 && M.labels.some((l) => l.kind === 'day' && l.text === c.mon),
    `${c.name}: the Shutters' midnights fall on the file's ${mid.join(' and ')}, the place's own midnights, with ${c.mon} under its tick`);
  // 3. the fallbacks
  const same = (p) => rows.every((r, i) => U.placeClock(r.epoch, p) === snap.hourly.time[i].slice(11, 16));
  const none = clone(snap); delete none.timezone;
  const pn = load(none).place, pu = load({ ...clone(snap), timezone: 'Mars/Olympus_Mons' }).place, pw = load({ ...clone(snap), timezone: 'Asia/Tokyo' }).place;
  ok(pn.zone === null && pu.zone === null && pw.zone === null && same(pn) && same(pu) && same(pw) && same(off),
    `${c.name}: with no zone, an unknown one, or one that never keeps the file's offset (Asia/Tokyo), the file's own labels on its one offset`);
  // 4. the ask table, from the Python mirror
  const py = spawnSync('python3', ['-c', `import json,sys; sys.path.insert(0, ${JSON.stringify(path.join(APP, '..', 'scripts'))}); import outdoor_window as o; print(json.dumps(o.ask_rows(json.load(open(${JSON.stringify(path.join(APP, 'tools', 'dst', `${c.name}.json`))})), json.load(open(${JSON.stringify(path.join(APP, 'data', 'rules.json'))})))))`], { encoding: 'utf8' });
  const ask = py.status === 0 ? JSON.parse(py.stdout) : [];
  const bad = ask.filter((a, i) => {
    const r = rows[i], dd = U.placeDate(r.epoch, place, r.epoch).split(' ');
    return a.time !== U.placeClock(r.epoch, place) || a.weekday !== dd[0] || Number(a.date.slice(8)) !== Number(dd[1]) || a.pass !== (r.pass ? 'yes' : 'no') || a.score !== r.score;
  });
  ok(ask.length === 48 && bad.length === 0, `${c.name}: scripts/outdoor_window.py's ask rows give every hour the date and time the app prints, and the same pass and score (${ask.length} rows, ${bad.length} different)${py.status ? `; python3: ${py.stderr.trim().split('\n').pop()}` : ''}`);
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

if (fails.length) { console.log(`\n${fails.length} of ${n} checks failed`); process.exit(1); }
console.log(`\nall ${n} checks pass`);
