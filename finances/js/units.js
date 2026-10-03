// Every number, amount, percent, date and span the app writes (HOUSE.md 6.1, 6.2; ART.md section 8,
// item 3). Pure: runs in Node, and tools/test_balance.mjs checks it. The true minus U+2212, U+202F
// between a number and its unit and between thousands, a point for decimals, 24-hour clock, day before
// month. Dates are built by hand with fixed English words, so every locale prints the same thing.

export const MINUS = '−';
export const NB = ' ';
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad2 = (n) => String(n).padStart(2, '0');

/** "11669" to "11 669" (U+202F), from four digits up. */
export function group(digits) {
  if (digits.length < 4) return digits;
  let out = '';
  for (let i = 0; i < digits.length; i++) out += (i && (digits.length - i) % 3 === 0 ? NB : '') + digits[i];
  return out;
}
/** A number with d decimals: the true minus, never "−0", thousands grouped; '–' when not finite. */
export function fixed(v, d = 0) {
  if (!Number.isFinite(v)) return '–';
  const s = Math.abs(v).toFixed(d), [i, f] = s.split('.');
  return (v < 0 && Number(s) !== 0 ? MINUS : '') + group(i) + (f ? `.${f}` : '');
}
/** A signed figure: "+12", "−3", "0". */
export const signed = (v, d = 0) => (v > 0 && Number(Math.abs(v).toFixed(d)) !== 0 ? '+' : '') + fixed(v, d);
/** Number and unit joined by U+202F. */
export const u = (s, unit) => (unit ? `${s}${NB}${unit}` : String(s));

/** The unit an amount is written in: "kr" for kroner, the ISO code for any other currency. */
export const unitOf = (currency) => (!currency || currency === 'NOK' ? 'kr' : currency);
/** "5 059 605 kr", "−86.49 kr". */
export const money = (v, currency, d = 0) => u(fixed(v, d), unitOf(currency));
/** "+16 492 kr". */
export const moneySigned = (v, currency, d = 0) => u(signed(v, d), unitOf(currency));
/** A share as a percent: pct(0.103) is "10.3 %". */
export const pct = (x, d = 1) => u(fixed(x * 100, d), '%');
/** Fund units: "513.9718 units". */
export const units = (n) => `${fixed(n, 4)} units`;
/** A count of things: "1 payment", "20 payments". */
export const count = (n, word, plural = `${word}s`) => `${fixed(n, 0)} ${n === 1 ? word : plural}`;

/** Decimals that write `step` exactly (at most four): 0.25 needs 2, 0.5 needs 1, 2 needs none. */
function decimalsOf(step) {
  for (let d = 0; d < 4; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
  return 4;
}
/** A 1, 2, 2.5 or 5 times a power of ten, the first at or above raw. */
export function niceStep(raw) {
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw * (1 - 1e-9));
}
/**
 * A value axis for money: ticks on round steps from at or below lo to at or above hi, so the last
 * gridline is past the largest value (B20), and labels whose decimals come from the step, so no two
 * ticks share a label (B1, B2). The unit goes above the plot: "million kr", "thousand kr" or "kr".
 */
export function axis(lo, hi, currency, count = 4) {
  if (!(hi > lo)) { const p = Math.abs(hi) * 0.05 || 1; lo -= p; hi += p; }
  const step = niceStep((hi - lo) / count);
  const first = Math.floor(lo / step + 1e-9) * step, last = Math.ceil(hi / step - 1e-9) * step;
  // millions while a step is at least 10 000, thousands while it is at least 10: never a run of zeros
  const top = Math.max(Math.abs(first), Math.abs(last)), div = top >= 1e6 && step >= 1e4 ? 1e6 : top >= 1e4 && step >= 10 ? 1e3 : 1;
  const name = div === 1e6 ? 'million ' : div === 1e3 ? 'thousand ' : '';
  const d = decimalsOf(step / div), ticks = [];
  for (let v = first; v <= last + step * 1e-6; v += step) {
    const r = Math.round(v / step) * step;
    ticks.push({ v: r, label: fixed(r / div, d) });
  }
  return { unit: `${name}${unitOf(currency)}`, ticks, lo: first, hi: last, step };
}

/* Calendar dates ("2026-09-21"), read as dates, never shifted by a time zone. */
const ymd = (s) => s.split('-').map(Number);
const dow = (s) => { const [y, m, d] = ymd(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
/** "21 Sep". */
export const dayMon = (s) => { const [, m, d] = ymd(s); return `${d} ${MONS[m - 1]}`; };
/** "21 Sep 2026". */
export const date = (s) => `${dayMon(s)} ${ymd(s)[0]}`;
/** "Mon 21 Sep". */
export const dowDate = (s) => `${DAYS[dow(s)]} ${dayMon(s)}`;
/** "Mon 21 Sep 2026". */
export const dowDateYear = (s) => `${dowDate(s)} ${ymd(s)[0]}`;
/** "Sep 2026" from "2026-09" or a date; "Sep" without the year. */
export const month = (s, year = true) => { const [y, m] = ymd(s); return year ? `${MONS[m - 1]} ${y}` : MONS[m - 1]; };
/** "21 September 2026", for VoiceOver. */
export const dateWords = (s) => { const [y, m, d] = ymd(s); return `${d} ${MONTHS[m - 1]} ${y}`; };
/** "23 Aug to 21 Sep 2026", or with both years when they differ. */
export const span = (a, b) => (a.slice(0, 4) === b.slice(0, 4) ? `${dayMon(a)} to ${date(b)}` : `${date(a)} to ${date(b)}`);
/** The date n days after s. */
export const plusDays = (s, n) => { const [y, m, d] = ymd(s); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
/** Whole days from a to b. */
export const daysBetween = (a, b) => { const [y, m, d] = ymd(a), [Y, M, D] = ymd(b); return Math.round((Date.UTC(Y, M - 1, D) - Date.UTC(y, m - 1, d)) / 864e5); };

/* Instants, in the phone's own time zone. */
/** The phone's calendar day, never the UTC one (B3). */
export function todayIso(ms = Date.now()) { const t = new Date(ms); return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`; }
/** "07:12". */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
/** "21 Sep", the phone's calendar day of an instant. */
export function dayOf(ms) { const d = new Date(ms); return `${d.getDate()} ${MONS[d.getMonth()]}`; }
/** "Mon 21 Sep 2026, 07:12 (UTC+2)": About's full instants, the zone named by its offset. */
export function full(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off);
  const zone = off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : MINUS}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${zone})`;
}
/** A day relative to today, with plurals (B15): "today", "in 1 day", "in 15 days", "3 days ago". */
export function days(n) {
  if (n === 0) return 'today';
  const w = `${fixed(Math.abs(n), 0)} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
  return n > 0 ? `in ${w}` : `${w} ago`;
}
/** How long ago, in the app's words: "just now", "5 min ago", "3 h ago", "2 days ago". */
export function ago(ms) {
  const m = Math.round(ms / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${u(m, 'min')} ago`;
  const h = Math.round(m / 60);
  return h < 36 ? `${u(h, 'h')} ago` : days(-Math.round(h / 24));
}

/* What VoiceOver hears: the app's own unit and date forms in words. */
export function spoken(text) {
  let s = String(text).replace(/ /g, ' ').replace(/−/g, 'minus ');
  s = s.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (_, d, m) => `${d} ${MONTHS[MONS.indexOf(m)]}`);
  s = s.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?=\d)/g, (m, d) => `${DAYS_FULL[DAYS.indexOf(d)]} `);
  s = s.replace(/(\d) kr\b/g, '$1 kroner').replace(/(\d) %/g, '$1 percent').replace(/(\d) h\b/g, '$1 hours').replace(/\bmin\b/g, 'minutes');
  return s.replace(/(\d) (?=\d{3}\b)/g, '$1');
}
