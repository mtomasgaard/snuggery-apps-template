// Every number, unit, date, time and span Hello Live writes (HOUSE.md 6.1, 6.2; ART.md sections 3 and 4). Pure:
// runs in Node, and tools/test_card.mjs checks it against an implementation written there. U+202F between a number
// and its unit, the true minus, a 24-hour clock, day before month, fixed English words built by hand, so every
// locale prints the same.
//
// Two clocks. The headline is the file's own words, in UTC, as the job wrote them. Everything this module writes is
// the PHONE's clock, and offsetWord() names its offset so a reader can do the sum.

export const NB = ' ';
export const MINUS = '−';
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYNAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n) => String(n).padStart(2, '0');
const group = (s) => s.replace(/^(\d+)/, (d) => (d.length < 4 ? d : d.replace(/\B(?=(\d{3})+(?!\d))/g, NB)));

/** The stock's threshold, kept and now said in About: the job writes about hourly, so six hours without a new
 *  file means a hop has not run. */
export const STALE_MS = 6 * 3600e3;
/** A file made more than an hour after the phone's time says so (the stock printed "just now"). */
export const AHEAD_MS = 3600e3;

/** A whole count, grouped with U+202F from four digits up: "3", "16 380". */
export const int = (n) => (Math.round(n) < 0 ? MINUS : '') + group(String(Math.abs(Math.round(n))));
/** "1 file", "5 files". */
export const count = (n, word, plural = `${word}s`) => `${int(n)} ${n === 1 ? word : plural}`;
/** Text the app did not write (a row's value): a number and a known unit joined by U+202F. The committed values
 *  are bare counts, so this changes nothing today. */
export const si = (t) => String(t).replace(/(\d) (m|km|°C|%|h|min|d|s|hPa|mm|m\/s|kg|kWh|W)(?=$|[\s,.;)])/g, `$1${NB}$2`);
/** A row's value as the app prints it: a plain digit string of four digits or more (no sign, point or leading zero) is
 *  a count, grouped with U+202F as HOUSE 6.1 asks ("1000" prints "1 000"; the lead's ruling, 2026-10-08); a leading
 *  zero marks a code and stays as written; anything else goes through si(). The file's own text is not changed. */
export const rowValue = (t) => { const s = String(t); return /^[1-9]\d{3,}$/.test(s) ? group(s) : si(s); };

/* ── the phone's clock ── */
/** "03:59". */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
/** "1 Oct", or "1 Oct 2025" when the year is not the phone's. */
export function dayMon(ms, now = Date.now()) {
  const d = new Date(ms), y = d.getFullYear();
  return `${d.getDate()} ${MONS[d.getMonth()]}${y === new Date(now).getFullYear() ? '' : ` ${y}`}`;
}
const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
/** The stamp's instant: "03:59" on the phone's own day, "1 Oct, 03:59" on another. */
export const stampWhen = (ms, now = Date.now()) => (sameDay(ms, now) ? clock(ms) : `${dayMon(ms, now)}, ${clock(ms)}`);
/** "Sat 3": the card's day labels, the house's tick form. */
export function dayTick(ms) { const d = new Date(ms); return `${DAYS[d.getDay()]} ${d.getDate()}`; }
/** The phone's zone at instant `ms`, by its offset: "UTC+2", "UTC", "UTC−3:30". */
export function offsetWord(ms = Date.now()) {
  const off = -new Date(ms).getTimezoneOffset(), a = Math.abs(off);
  return off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : MINUS}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
}
/** "Thu 1 Oct 2026, 03:59 (UTC+2)": About's full instant on the phone's clock, the zone named by its offset. */
export function full(ms) {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${offsetWord(ms)})`;
}
/** "Thursday 1 October, 03:59": an instant in words, for VoiceOver (no abbreviation to spell). */
export function spoken(ms) {
  const d = new Date(ms);
  return `${DAYNAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${clock(ms)}`;
}
/** A span of time, the house's words: "20 min", "5 h", "2 d" (whole units, rounded down). */
export function span(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return m < 60 ? `${m}${NB}min` : m < 48 * 60 ? `${Math.floor(m / 60)}${NB}h` : `${Math.floor(m / 1440)}${NB}d`;
}
/** The lead beside the headline: the file's instant on the phone's clock, "03:59 on this phone’s clock". */
export const localLead = (ms) => `${clock(ms)} on this phone’s clock`;

/**
 * The stamp's words (ART.md section 3): a lead sentence in ink when there is something to say, then the instant.
 * `made` is the file's generatedAt in milliseconds, or null when it does not parse.
 *   { lead: '',                               rest: 'Updated 03:59' }           a fresh file
 *   { lead: 'Stale.',                         rest: 'Updated 1 Oct, 03:59' }    6 hours old or more
 *   { lead: 'Made after the phone’s time.',   rest: 'Updated 3 Oct, 11:59' }    more than an hour ahead of the clock
 *   { lead: 'Undated file.',                  rest: '' }                        generatedAt does not parse
 */
export function stamp(made, now = Date.now()) {
  if (made === null || made === undefined || Number.isNaN(made)) return { lead: 'Undated file.', rest: '' };
  const rest = `Updated ${stampWhen(made, now)}`;
  if (made - now > AHEAD_MS) return { lead: 'Made after the phone’s time.', rest };
  if (now - made >= STALE_MS) return { lead: 'Stale.', rest };
  return { lead: '', rest };
}
