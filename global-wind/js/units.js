// Every number, unit, date and time the app writes (DESIGN §4). Pure: runs in Node.
// SI notation: the true minus U+2212, U+202F between a number and its unit and between groups of
// thousands, 24-hour clock, day before month. Dates are built by hand from the phone's clock rather
// than by the locale, so a US phone and a UK phone print the same words (as the ask rows do).

export const MINUS = '−';
export const NNBSP = ' ';
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');

/** "16380" → "16 380" (U+202F); four digits and more are grouped. */
export function group(digits) {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i && (digits.length - i) % 3 === 0) out += NNBSP;
    out += digits[i];
  }
  return out;
}

/** A number with d decimals: the true minus, no "−0.0", thousands grouped. */
export function fixed(v, d = 0) {
  if (!Number.isFinite(v)) return '–';
  const s = Math.abs(v).toFixed(d);
  const [i, f] = s.split('.');
  const neg = v < 0 && Number(s) !== 0;
  return (neg ? MINUS : '') + (i.length > 3 ? group(i) : i) + (f ? `.${f}` : '');
}
/** A plain integer, grouped ("16 380"). */
export const int = (n) => fixed(Math.round(n), 0);
/** Number and unit joined by U+202F; no unit, no space. */
export const withUnit = (s, unit) => (unit ? `${s}${NNBSP}${unit}` : String(s));

/** A legend tick: whole numbers whole, small ones to two places at most. */
export function tick(v) {
  if (Math.abs(v) >= 10 || Number.isInteger(v)) return fixed(Math.round(v), 0);
  return fixed(v, 2).replace(/0+$/, '').replace(/\.$/, '');
}

/** "51.5° N, 0.1° W". */
export function coord(lat, lon) {
  return `${Math.abs(lat).toFixed(1)}°${NNBSP}${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(1)}°${NNBSP}${lon >= 0 ? 'E' : 'W'}`;
}

/** Text the app did not write (the snapshot's level): a number and its unit joined by U+202F. */
export const si = (t) => String(t).replace(/(\d) (m|km|°C|%|h|hPa|mm|m\/s)(?=$|[\s,.;)])/g, `$1${NNBSP}$2`);

/* ── dates and times, in the phone's own time zone ── */
/** "Wed 23 Sep, 11:00" — the valid time, the one large figure. */
export function valid(ms) {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
/** "Saturday 26 September, 23:00": the valid time in words, for VoiceOver (no abbreviation to spell). */
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function spoken(ms) {
  const d = new Date(ms);
  return `${DAYS_FULL[d.getDay()]} ${d.getDate()} ${MONS_FULL[d.getMonth()]}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
/** "04:15". */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
/** "22 Sep". */
export function dayMonth(ms) { const d = new Date(ms); return `${d.getDate()} ${MONS[d.getMonth()]}`; }
/** "Wed 23" or "Wed": a day tick on the track. */
export function dayTick(ms, short) { const d = new Date(ms); return short ? DAYS[d.getDay()] : `${DAYS[d.getDay()]} ${d.getDate()}`; }
/** "Tue 22 Sep 2026, 08:00 (UTC+2)": About's full instants, with the zone named by its offset. */
export function full(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off);
  const zone = off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : MINUS}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${zone})`;
}

/** A span of time in the app's words: "5 min", "5 h", "2 d". */
export function span(ms) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 60) return withUnit(m, 'min');
  const h = Math.round(m / 60);
  if (h < 36) return withUnit(h, 'h');
  return withUnit(Math.round(h / 24), 'd');
}
/** "5 h ago", "just now". */
export const ago = (ms) => (Math.abs(ms) < 60000 ? 'just now' : `${span(ms)} ago`);
/** The lead line: "+36 h, 8 d ago", "+30 h, now", "+54 h, in 2 d". */
export function lead(hours, rel) {
  const when = Math.abs(rel) < 1800e3 ? 'now' : rel > 0 ? `in ${span(rel)}` : `${span(rel)} ago`;
  return `+${withUnit(Math.round(hours), 'h')}, ${when}`;
}
