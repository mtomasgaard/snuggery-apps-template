// Every number, unit, date, time and span Power Hours writes (HOUSE.md 6.1, 6.2; ART.md section 3).
// Pure: runs in Node, and tools/test_prices.mjs checks it. U+202F between a number and its unit, the true
// minus and never −0.00, 24-hour clock, day before month, fixed English words built by hand, so every locale
// prints the same.
//
// Two clocks. The stamp says when the file was made on the PHONE's clock (a question about the reader's own
// time). Every price interval is told on the BIDDING ZONE's clock, read from the offset each interval's own
// `start` string carries, because the market settles on the zone's calendar wherever the reader is.

export const NB = '\u202f';
export const MINUS = '\u2212';
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYNAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n) => String(n).padStart(2, '0');
const group = (s) => s.replace(/^(\d+)/, (d) => (d.length < 4 ? d : d.replace(/\B(?=(\d{3})+(?!\d))/g, NB)));

/** A whole count, grouped with U+202F from four digits up. */
export const int = (n) => (Math.round(n) < 0 ? MINUS : '') + group(String(Math.abs(Math.round(n))));
/** "1 quarter hour", "55 quarter hours". */
export const count = (n, word, plural = `${word}s`) => `${int(n)} ${n === 1 ? word : plural}`;

/** A value to `d` decimals with the true minus, never "−0.00". toFixed is used here and in spokenPrice only. */
export function fixed(v, d) {
  const s = Math.abs(v).toFixed(d);
  return (v < 0 && Number(s) !== 0 ? MINUS : '') + group(s);
}
/** A price in the display unit: always two decimals, so neighboring quarters never print alike (owner call 3). */
export const price = (v) => fixed(v, 2);
/** A price and its unit: "13.69 c/kWh". */
export const priced = (v, u) => `${price(v)}${NB}${u.label}`;
/** A whole percentage: "8 %". */
export const pct = (n) => `${int(n)}${NB}%`;

/** "1st", "2nd", "68th". */
export function ordinal(n) {
  const v = n % 100, tails = ['th', 'st', 'nd', 'rd'];
  return `${int(n)}${tails[(v - 20) % 10] || tails[v] || tails[0]}`;
}
/** A run length from hours: "2 h", "1 h 30 min", "45 min". */
export function runLength(hours) {
  const m = Math.round(hours * 60), h = Math.floor(m / 60), r = m % 60;
  return h && r ? `${h}${NB}h ${r}${NB}min` : h ? `${h}${NB}h` : `${r}${NB}min`;
}
/** What VoiceOver hears for a run length: "2 hours", "1 hour 30 minutes". */
export function spokenLength(hours) {
  const m = Math.round(hours * 60), h = Math.floor(m / 60), r = m % 60;
  return [h ? count(h, 'hour') : '', r ? count(r, 'minute') : ''].filter(Boolean).join(' ');
}

/**
 * The source's unit, and what is shown instead. EUR/MWh, the market's unit, is shown as euro-cents per kWh
 * (divided by ten), the unit a household tariff is written in. Anything else is shown as it arrived.
 */
export function unitsOf(data) {
  const raw = String((data && data.unit) || '').replace(/\s+/g, '');
  if (/^EUR\/MWh$/i.test(raw)) return { factor: 0.1, label: 'c/kWh', source: 'EUR/MWh', spoken: 'cents a kilowatt hour', words: 'euro-cents per kWh' };
  const label = String((data && data.unit) || 'price');
  return { factor: 1, label, source: label, spoken: label, words: label };
}
/** "13.69 cents a kilowatt hour", "minus 3.31 cents a kilowatt hour". */
export const spokenPrice = (v, u) => `${v < 0 && Number(Math.abs(v).toFixed(2)) !== 0 ? 'minus ' : ''}${Math.abs(v).toFixed(2)} ${u.spoken}`;

/* ── the phone's clock: the stamp, About ── */
/** "11:35". */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
/** "21 Sep", or "21 Sep 2025" when the year is not the phone's. */
export function dayMon(ms, now = Date.now()) {
  const d = new Date(ms), y = d.getFullYear();
  return `${d.getDate()} ${MONS[d.getMonth()]}${y === new Date(now).getFullYear() ? '' : ` ${y}`}`;
}
const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
/** The stamp's time: "06:01" on the phone's own day, "1 Oct, 06:01" after it. */
export const stampWhen = (ms, now = Date.now()) => (sameDay(ms, now) ? clock(ms) : `${dayMon(ms, now)}, ${clock(ms)}`);
/** The zone of an offset in minutes east of UTC: "UTC+2", "UTC−4", "UTC+5:30". */
export function zone(minutes) {
  const a = Math.abs(minutes);
  return minutes === 0 ? 'UTC' : `UTC${minutes > 0 ? '+' : MINUS}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
}
/** "Thu 1 Oct 2026, 06:01 (UTC+2)": About's full instant on the phone's clock, the zone named by its offset. */
export function full(ms) {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${zone(-d.getTimezoneOffset())})`;
}
/** A span of time, the house's words: "20 min", "5 h", "11 d" (whole units, rounded down). */
export function span(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return m < 60 ? `${m}${NB}min` : m < 48 * 60 ? `${Math.floor(m / 60)}${NB}h` : `${Math.floor(m / 1440)}${NB}d`;
}

/* ── the bidding zone's clock: a wall clock is an instant and the offset the data gave for it ── */
/** The zone's wall clock at instant `ms` under an offset of `off` minutes east of UTC. */
export function wall(ms, off) {
  const d = new Date(ms + off * 60000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), dow: d.getUTCDay(), date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` };
}
/** "14:15". */
export const hm = (w) => `${pad2(w.h)}:${pad2(w.mi)}`;
/** "Fri 2": the axis' day labels. */
export const dayShort = (w) => `${DAYS[w.dow]} ${w.d}`;
/** "Fri": a day prefix on a run. */
export const weekday = (w) => DAYS[w.dow];
/** "Thu 1 Oct". */
export const dateShort = (w) => `${DAYS[w.dow]} ${w.d} ${MONS[w.mo]}`;
/** "Thu 1 Oct 2026". */
export const dateFull = (w) => `${DAYS[w.dow]} ${w.d} ${MONS[w.mo]} ${w.y}`;
/** "Thursday 1 October". */
export const spokenDate = (w) => `${DAYNAMES[w.dow]} ${w.d} ${MONTHS[w.mo]}`;
/** "Thursday" for a run's spoken day prefix. */
export const spokenWeekday = (w) => DAYNAMES[w.dow];
/** A YYYY-MM-DD as "Fri 2 Oct" (a day the file names but holds no prices for). */
export function isoDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  return m ? dateShort(wall(Date.UTC(+m[1], +m[2] - 1, +m[3]), 0)) : String(s);
}

/** The app's short forms in words, for the live region: U+202F to a space, the minus spoken, a day spelled out. */
export const spoken = (text) => String(text).replace(/\u202f/g, ' ').replace(/\u2212/g, 'minus ')
  .replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (_, d, m) => `${d} ${MONTHS[MONS.indexOf(m)]}`)
  .replace(/–/g, ' to ');
