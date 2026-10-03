// Every number, unit, date and span the app writes (HOUSE.md 6.1, 6.2). Pure: runs in Node.
// The true minus U+2212, U+202F between a number and its unit and between thousands, a point for
// decimals, 24-hour clock, day before month. Dates are built by hand with fixed English words, so
// every locale prints the same thing.

export const MINUS = '\u2212';
export const NB = '\u202F';
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad2 = (n) => String(n).padStart(2, '0');

/** "11669" to "11 669" (U+202F), from four digits up. */
export function group(digits) {
  let out = '';
  for (let i = 0; i < digits.length; i++) out += (i && (digits.length - i) % 3 === 0 ? NB : '') + digits[i];
  return digits.length > 3 ? out : digits;
}
/** A number with d decimals: the true minus, never "−0.0", thousands grouped; '–' when not finite. */
export function fixed(v, d = 0) {
  if (!Number.isFinite(v)) return '–';
  const s = Math.abs(v).toFixed(d), [i, f] = s.split('.');
  return (v < 0 && Number(s) !== 0 ? MINUS : '') + group(i) + (f ? `.${f}` : '');
}
export const f0 = (v) => fixed(v, 0);
export const f1 = (v) => fixed(v, 1);
/** A signed figure: "+12", "−3", "0". */
export const signed = (v, d = 0) => (Number(fixed(Math.abs(v), d).replace(/\D/g, '')) && v > 0 ? '+' : '') + fixed(v, d);
/** Number and unit joined by U+202F. */
export const u = (s, unit) => (unit ? `${s}${NB}${unit}` : String(s));
export const km = (v) => u(f1(v), 'km');
/** Text the app did not write (the plan's "62 km"): a number and its unit joined by U+202F. */
export const si = (t) => String(t).replace(/(\d) (km|min|h|m|bpm|kg|%)(?=$|[\s,.;)])/g, '$1\u202F$2');
export const pct = (v) => u(f0(v), '%');

/** Minutes per km as "4:54"; '–' when there is none. */
export function pace(minPerKm) {
  if (!Number.isFinite(minPerKm) || minPerKm <= 0) return '–';
  let m = Math.floor(minPerKm), s = Math.round((minPerKm - m) * 60);
  if (s === 60) { m++; s = 0; }
  return `${m}:${pad2(s)}`;
}
export const perKm = (minPerKm) => u(pace(minPerKm), '/km');
/** A duration in minutes as "1 h 12 min" or "56 min". */
export function span(minutes) {
  const t = Math.round(minutes), h = Math.floor(t / 60), m = t - h * 60;
  return h ? `${u(h, 'h')}${m ? ` ${u(m, 'min')}` : ''}` : u(m, 'min');
}
/** Seconds as "12:34" or "1:02:03". */
export function mmss(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}
/** How long ago, in the app's words: "just now", "5 min ago", "3 h ago", "2 d ago". */
export function ago(ms) {
  const m = Math.round(ms / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${u(m, 'min')} ago`;
  const h = Math.round(m / 60);
  return h < 36 ? `${u(h, 'h')} ago` : `${u(Math.round(h / 24), 'd')} ago`;
}

/* Calendar dates ("2026-09-14"), read as dates, never shifted by a time zone. */
const ymd = (s) => s.split('-').map(Number);
const dow = (s) => { const [y, m, d] = ymd(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** "14 Sep". */
export const dayMon = (s) => { const [, m, d] = ymd(s); return `${d} ${MONS[m - 1]}`; };
/** "14 Sep 2026". */
export const date = (s) => `${dayMon(s)} ${ymd(s)[0]}`;
/** "Mon 14 Sep". */
export const dowDate = (s) => `${DAYS[dow(s)]} ${dayMon(s)}`;
/** "Mon 14". */
export const dowDay = (s) => `${DAYS[dow(s)]} ${ymd(s)[2]}`;
/** "Sep 2026", or "Sep" without the year. */
export const month = (s, year = true) => { const [y, m] = ymd(s); return year ? `${MONS[m - 1]} ${y}` : MONS[m - 1]; };
/** "14 September 2026", for VoiceOver. */
export const dateWords = (s) => { const [y, m, d] = ymd(s); return `${d} ${MONTHS[m - 1]} ${y}`; };

/* Instants, in the phone's own time zone. */
/** "20:20". */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
/** "30 Sep", the phone's calendar day of an instant. */
export function dayOf(ms) { const d = new Date(ms); return `${d.getDate()} ${MONS[d.getMonth()]}`; }
/** "Wed 30 Sep 2026, 20:20 (UTC+2)": About's full instants, the zone named by its offset. */
export function full(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off);
  const zone = off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : MINUS}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${zone})`;
}

/* What VoiceOver hears: the app's own unit and date forms in words. */
const SAY = [
  [/(\d) ?\/km\b/g, '$1 per kilometer'], [/\bkm\/h\b/g, 'kilometers an hour'], [/\bkJ\/kg\b/g, 'kilojoules per kilogram'],
  [/\bbpm\b/g, 'beats a minute'], [/\bspm\b/g, 'steps a minute'], [/\brpm\b/g, 'turns a minute'], [/\bkm\b/g, 'kilometers'],
  [/\bmin\b/g, 'minutes'], [/(\d) h\b/g, '$1 hours'], [/(\d) ms\b/g, '$1 milliseconds'], [/(\d) m\b/g, '$1 meters'],
  [/(\d) W\b/g, '$1 watts'], [/(\d) kg\b/g, '$1 kilograms'], [/(\d) %/g, '$1 percent'], [/°C\b/g, 'degrees Celsius'],
  [/\bm\/s\b/g, 'meters a second'], [/\bZ([1-5])\b/g, 'zone $1'],
];
export function spoken(text) {
  let s = String(text).replace(/\u202F/g, ' ').replace(/\u2212/g, 'minus ');
  s = s.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (_, d, m) => `${d} ${MONTHS[MONS.indexOf(m)]}`);
  s = s.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?=\d)/g, (m, d) => `${DAYS_FULL[DAYS.indexOf(d)]} `);
  for (const [re, w] of SAY) s = s.replace(re, w);
  return s.replace(/(\d) (?=\d{3}\b)/g, '$1');
}
