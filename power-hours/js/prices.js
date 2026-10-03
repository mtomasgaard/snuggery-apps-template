// The prices as Power Hours reads them (ART.md section 1): pure, no DOM, so tools/test_prices.mjs can hold it
// against a decode written in the test.
//
// The intervals are every entry of hours[] (or lastGood.hours when the run fetched nothing), in order of
// their instant and indexed by position, never by wall-clock hour, so a day of 92 or 100 quarter hours (the
// clock changes) draws and searches as it is. The step is the file's median gap. A gap longer than one step
// breaks the staircase, and no run is searched across it. Each interval's wall clock and calendar day are
// read straight out of its own `start` string (`2026-10-01T14:15:00+02:00` is 14:15 on 1 Oct in the zone,
// whatever the phone thinks); Date is used only where the instant is the right comparison: which interval is
// the present in, which have ended. No `days[].label` is read: "Today" there was written when the file was
// made, and is wrong by the next morning (ART.md B1).

import { unitsOf, wall, hm, zone, weekday, dateShort, spokenDate, spokenWeekday, count, int, priced, spokenPrice, fixed, pct } from './units.js';

const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

/** One `start` string to its instant, the zone's date and wall clock, and the offset it states. */
export function parseStart(s) {
  const m = ISO.exec(String(s));
  if (!m) return null;
  const off = m[6] === 'Z' ? 0 : (m[6][0] === '-' ? -1 : 1) * (Number(m[6].slice(1, 3)) * 60 + Number(m[6].slice(-2)));
  const at = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - off * 60000;
  return Number.isFinite(at) ? { at, date: `${m[1]}-${m[2]}-${m[3]}`, h: +m[4], mi: +m[5], off } : null;
}

/** The curve to draw: this run's, or the last good one the job kept. */
export const curveOf = (data) => {
  const fresh = Array.isArray(data.hours) ? data.hours : [];
  if (fresh.length) return fresh;
  return data.lastGood && Array.isArray(data.lastGood.hours) ? data.lastGood.hours : [];
};
export const usingLastGood = (data) => !(Array.isArray(data.hours) && data.hours.length) && curveOf(data).length > 0;

/** What is wrong with a parsed snapshot, as whole sentences, or [] when it can be drawn. */
export function validate(data) {
  const f = 'data/snapshot.json';
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [`${f} is not a JSON object.`];
  const out = [];
  if (data.schema !== undefined && data.schema !== 1) out.push(`${f} says schema ${String(data.schema).slice(0, 20)}; this app reads schema 1.`);
  const curve = curveOf(data);
  if (!curve.length) out.push(`${f} has no prices: hours is empty and there is no lastGood to fall back on.`);
  else {
    const bad = curve.filter((h) => !h || typeof h.price !== 'number' || !Number.isFinite(h.price) || !parseStart(h.start)).length;
    if (bad) out.push(`${int(bad)} of ${count(curve.length, 'price')} have no number or no time.`);
  }
  return out;
}

/** The word for one interval: "quarter hour" at 15 minutes, "hour" at 60. */
export function noun(stepMin) {
  if (stepMin === 15) return ['quarter hour', 'quarter hours'];
  if (stepMin === 30) return ['half hour', 'half hours'];
  if (stepMin === 60) return ['hour', 'hours'];
  return [`${stepMin}-minute interval`, `${stepMin}-minute intervals`];
}

/**
 * The scale, one for the whole file: the smallest step of 1, 2 or 5 times a power of ten that labels the
 * lowest to the highest price in at most six ticks, from the step at or below the lowest to the step at or
 * above the highest. It need not start at zero (ART.md section 1; About says so).
 */
export function scaleOf(min, max) {
  for (let e = -3; e <= 6; e++) {
    for (const k of [1, 2, 5]) {
      const step = k * 10 ** e, eps = step * 1e-9;
      const lo = Math.floor((min + eps) / step), hi = Math.max(lo + 1, Math.ceil((max - eps) / step));
      if (hi - lo + 1 <= 6) {
        const d = Math.max(0, -e);
        const ticks = [];
        for (let i = lo; i <= hi; i++) ticks.push(Math.round(i * step * 10 ** d) / 10 ** d);
        return { lo: ticks[0], hi: ticks[ticks.length - 1], step, digits: d, ticks };
      }
    }
  }
  return { lo: min, hi: max, step: max - min, digits: 2, ticks: [min, max] };
}

/**
 * The model at the phone's present `now` (ms): the intervals, the step, where the stretch searched starts
 * (`first`, the interval holding the present, or the next one after it), the current interval (`cur`, -1
 * when the present is not inside one), history (every interval has ended), the zone's today, the days, the
 * scale and the mean ahead.
 */
export function model(data, now) {
  const u = unitsOf(data);
  const iv = curveOf(data).map((e) => {
    const p = e && typeof e.price === 'number' && Number.isFinite(e.price) ? parseStart(e.start) : null;
    return p ? { ...p, start: String(e.start), raw: e.price, v: e.price * u.factor } : null;
  }).filter(Boolean).sort((a, b) => a.at - b.at);
  const n = iv.length;
  iv.forEach((x, i) => { x.i = i; });
  const gaps = iv.slice(1).map((x, i) => x.at - iv[i].at).filter((g) => g > 0).sort((a, b) => a - b);
  const step = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 3600000, stepMin = Math.round(step / 60000);
  // joined[i]: interval i follows i − 1 with no gap, so a riser is drawn between them and a run may span them
  const joined = iv.map((x, i) => i > 0 && x.at - iv[i - 1].at <= step);
  let first = iv.findIndex((x) => x.at + step > now);
  const history = n > 0 && first < 0;
  if (history) first = 0;
  const cur = !history && n && iv[first].at <= now ? first : -1;
  const near = cur >= 0 ? iv[cur] : history ? iv[n - 1] : iv[Math.max(0, first)];
  const today = n ? wall(now, near.off).date : null;
  const days = new Map();
  for (const x of iv) { if (!days.has(x.date)) days.set(x.date, []); days.get(x.date).push(x.i); }
  // the days the clocks change on: their intervals are told with their offset, so the autumn's repeated hour reads
  const twoClocks = new Set([...days].filter(([, ix]) => new Set(ix.map((j) => iv[j].off)).size > 1).map(([d]) => d));
  const vs = iv.map((x) => x.v);
  const scale = n ? scaleOf(Math.min(...vs), Math.max(...vs)) : scaleOf(0, 1);
  const ahead = iv.slice(first);
  const meanAhead = ahead.length ? ahead.reduce((a, x) => a + x.v, 0) / ahead.length : NaN;
  return { u, iv, n, step, stepMin, noun: noun(stepMin), joined, first, cur, history, today, days, twoClocks, scale, meanAhead, now,
    min: n ? Math.min(...vs) : NaN, max: n ? Math.max(...vs) : NaN, dates: [...days.keys()] };
}

/** The scale in words: "13 to 17". */
export const scaleWords = (M) => `${fixed(M.scale.lo, M.scale.digits)} to ${fixed(M.scale.hi, M.scale.digits)}`;

/** Interval i has ended and is no longer a choice (never in history mode, where every interval has). */
export const isPast = (M, i) => !M.history && i < M.first;
/** The instant interval i ends, and the zone's wall clock there: the next interval's own clock when it follows
 *  with no gap (so the autumn change's repeated 02:00 reads right), else its own offset carried on. */
export function endWall(M, i) {
  const x = M.iv[i], next = M.iv[i + 1];
  if (next && M.joined[i + 1]) return { ...wall(next.at, next.off), at: next.at, off: next.off };
  return { ...wall(x.at + M.step, x.off), at: x.at + M.step, off: x.off };
}
export const startWall = (M, i) => ({ ...wall(M.iv[i].at, M.iv[i].off), at: M.iv[i].at, off: M.iv[i].off });

/**
 * The cheapest contiguous run of `hours` in the stretch searched: `need` = ceil(hours × 60 / step) intervals,
 * never across a gap, the lowest mean first and the earliest on a tie. Returns { from, to, need, mean } or
 * { none } with why: 'long' (longer than the whole file) or 'left' (not enough unbroken prices in the stretch).
 */
export function cheapest(M, hours) {
  const need = Math.max(1, Math.ceil((hours * 60) / M.stepMin - 1e-9));
  if (need > M.n) return { none: 'long', need };
  let best = null;
  for (let a = M.first; a + need <= M.n; a++) {
    let s = 0, ok = true;
    for (let j = a; j < a + need; j++) { if (j > a && !M.joined[j]) { ok = false; break; } s += M.iv[j].v; }
    if (ok && (best === null || s < best.sum - 1e-9)) best = { from: a, to: a + need - 1, sum: s };
  }
  return best ? { from: best.from, to: best.to, need, mean: best.sum / need } : { none: 'left', need };
}

/** 1 + the intervals in `set` priced strictly lower than interval i. */
const rankIn = (M, i, set) => 1 + set.filter((j) => M.iv[j].v < M.iv[i].v).length;
/** The rank of interval i among the stretch ahead (or the file, in history), and how many there are. */
export function rankAhead(M, i) {
  const set = [];
  for (let j = M.first; j < M.n; j++) set.push(j);
  return { rank: rankIn(M, i, set), of: set.length };
}
/** The rank of interval i within its own zone day, its day's count, and which quarter of the day it is in. */
export function rankDay(M, i) {
  const set = M.days.get(M.iv[i].date), rank = rankIn(M, i, set), of = set.length;
  return { rank, of, band: rank <= of / 4 ? 'cheapest' : rank > (3 * of) / 4 ? 'priciest' : 'middle' };
}

/** An interval's clock times: "14:15", "14:30"; on a day the clocks change, each with its offset. */
function clocksOf(M, i) {
  const a = startWall(M, i), b = endWall(M, i), z = M.twoClocks.has(M.iv[i].date);
  const e = b.h === 0 && b.mi === 0 ? '24:00' : hm(b);   // the day's last interval ends at its own midnight
  return { a, s: `${hm(a)}${z && a.off !== b.off ? ` (${zone(a.off)})` : ''}`, e: `${e}${z ? ` (${zone(b.off)})` : ''}`, z: z && a.off !== b.off };
}
/** An interval in words: "Thu 1 Oct, 14:15–14:30"; "Sun 25 Oct, 02:00–02:15 (UTC+1)" on the autumn night. */
export const intervalWords = (M, i) => { const c = clocksOf(M, i); return `${dateShort(c.a)}, ${c.s}${c.z ? ' to ' : '\u2013'}${c.e}`; };
/** What VoiceOver hears for it: "Thursday 1 October, 14:15 to 14:30". */
export const intervalSpoken = (M, i) => { const c = clocksOf(M, i); return `${spokenDate(c.a)}, ${c.s} to ${c.e}`; };

/** The end of intervals from..to in words: a run that ends at midnight ends at "24:00" of the day before, so
 *  `day` is the end's own day in words and `sameDay` says whether it is the start's. */
function endOf(M, from, to) {
  const a = startWall(M, from), b = endWall(M, to);
  const midnight = b.h === 0 && b.mi === 0, day = midnight ? wall(b.at - 60000, M.iv[to].off) : b;
  // across a clock change the two ends are told on different offsets, and both are named: on the autumn night
  // a run can start and end at the same wall-clock time ("02:30 (UTC+2) to 02:30 (UTC+1)")
  const z = a.off !== b.off;
  return { a, b: day, end: `${midnight ? '24:00' : hm(b)}${z ? ` (${zone(b.off)})` : ''}`, sameDay: day.date === a.date, z };
}

/**
 * A run in the landing's and the list's words: "13:30–15:30"; "23:00 to Fri 03:00" across midnight;
 * "now to 12:15" when it starts in the current interval; a day prefix, "Fri 00:30–02:30", when it does not
 * start on the zone's today; a run that ends at midnight ends at "24:00". `speak` gives the spoken form.
 */
export function runWords(M, run, speak = false) {
  const { a, b, end, sameDay, z } = endOf(M, run.from, run.to);
  const dayOf = (w) => (speak ? spokenWeekday(w) : weekday(w));
  const start = run.from === M.cur ? 'now' : `${a.date !== M.today ? `${dayOf(a)} ` : ''}${hm(a)}${z ? ` (${zone(a.off)})` : ''}`;
  if (sameDay) return `${start}${start === 'now' || speak || z ? ' to ' : '\u2013'}${end}`;
  return `${start} to ${dayOf(b)} ${end}`;
}

/** The stretch searched in words: "10:15 to 24:00", "Thu 1 Oct, 00:00 to 24:00", "10:15 to Fri 24:00". */
export function stretchWords(M) {
  if (!M.n) return '';
  const { a, b, end, sameDay, z } = endOf(M, M.first, M.n - 1);
  return `${a.date !== M.today ? `${dateShort(a)}, ` : ''}${hm(a)}${z ? ` (${zone(a.off)})` : ''} to ${sameDay ? '' : `${weekday(b)} `}${end}`;
}

/** The run's second line in the list, "14.19 c/kWh, 8 % below the mean ahead", with `pr` writing a price and `pc` a percentage. */
function saving(M, run, pr, pc) {
  const mean = M.meanAhead, against = M.history ? 'the file\u2019s mean' : 'the mean ahead';
  if (run.mean < 0) return `paid to run it, ${pr(run.mean)}`;
  if (!(mean > 0)) return pr(run.mean);
  const p = Math.round(((mean - run.mean) / mean) * 100);
  return `${pr(run.mean)}, ${p === 0 ? `level with ${against}` : `${pc(Math.abs(p))} ${p > 0 ? 'below' : 'above'} ${against}`}`;
}
export const savingWords = (M, run) => saving(M, run, (v) => priced(v, M.u), pct);
/** The same for VoiceOver: "14.19 cents a kilowatt hour, 8 percent below the mean ahead". */
export const savingSpoken = (M, run) => saving(M, run, (v) => spokenPrice(v, M.u), (p) => `${int(p)} percent`);
/** What the live region says when a row is pressed: "Dishwasher: 13:30 to 15:30, 14.19 cents a kilowatt hour." */
export const runSpoken = (M, name, run) => `${name}: ${runWords(M, run, true)}, ${spokenPrice(run.mean, M.u)}.`;
