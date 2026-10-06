// Every number, unit, date, time and span Outdoor Window writes (HOUSE.md 6.1, 6.2; ART.md section 3).
// Pure: runs in Node, and tools/test_shutters.mjs checks it. U+202F between a number and its unit, the true
// minus, 24-hour clock, day before month, fixed English words built by hand, so every locale prints the same.
//
// Two clocks. The stamp says when the file was made on the PHONE's clock (a question about the reader's own
// time). Every hour of the forecast is told on the FORECAST PLACE's clock, from its own zone, because the
// weather happens where the weather is.

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
/** "1 hour", "12 hours". */
export const count = (n, word, plural = `${word}s`) => `${int(n)} ${n === 1 ? word : plural}`;
/** "a, b and c". */
export const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

/**
 * A value at the data's own precision, as the file wrote it: 29.2, 0, −3.5 (never rounded, so 35.5 km/h
 * against a 35 km/h limit prints 35.5; ART.md B10). null for a value the file does not have.
 */
export function num(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return (v < 0 ? MINUS : '') + group(String(Math.abs(v)));
}
/** A value and its unit: "13.3 °C", "0 %", "29.2 km/h"; an empty unit prints the number alone. */
export const withUnit = (v, unit) => { const n = num(v); return n == null ? null : unit ? `${n}${NB}${unit}` : n; };

const UNIT_WORDS = { '°C': 'degrees Celsius', '°F': 'degrees Fahrenheit', 'km/h': 'kilometers an hour', 'm/s': 'meters a second', mph: 'miles an hour', kn: 'knots', '%': 'percent', mm: 'millimeters', inch: 'inches' };
/** What VoiceOver hears for a value: "minus 3.5 degrees Celsius". */
export function spokenValue(v, unit) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 'not in the file';
  return `${v < 0 ? 'minus ' : ''}${String(Math.abs(v))}${unit ? ` ${UNIT_WORDS[unit] || unit}` : ''}`;
}

/** Coordinates to two decimals, the hemisphere after U+202F: "42.37° N, 71.06° W". */
export function coords(lat, lon) {
  const one = (v, p, n) => `${Math.abs(v).toFixed(2)}°${NB}${v < 0 ? n : p}`;
  return `${one(lat, 'N', 'S')}, ${one(lon, 'E', 'W')}`;
}
/** An elevation in meters: "16 m". */
export const meters = (v) => withUnit(v, 'm');

/* ── the phone's clock: the stamp, About ── */
/** "11:35". */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
/** "21 Sep", or "21 Sep 2025" when the year is not the phone's. */
export function dayMon(ms, now = Date.now()) {
  const d = new Date(ms), y = d.getFullYear();
  return `${d.getDate()} ${MONS[d.getMonth()]}${y === new Date(now).getFullYear() ? '' : ` ${y}`}`;
}
const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
/** The stamp's time: "11:35" on the file's own day, "21 Sep, 11:35" after it. */
export const stampWhen = (ms, now = Date.now()) => (sameDay(ms, now) ? clock(ms) : `${dayMon(ms, now)}, ${clock(ms)}`);
/** The zone of an offset in minutes east of UTC: "UTC+2", "UTC−4", "UTC+5:30". */
export function zone(minutes) {
  const a = Math.abs(minutes);
  return minutes === 0 ? 'UTC' : `UTC${minutes > 0 ? '+' : MINUS}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
}
/** "Mon 21 Sep 2026, 11:35 (UTC+2)": About's full instant on the phone's clock, the zone named by its offset. */
export function full(ms) {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${zone(-d.getTimezoneOffset())})`;
}
/** A span of time, the house's words: "20 min", "5 h", "11 d" (whole units, rounded down). */
export function span(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  return m < 60 ? `${m}${NB}min` : m < 48 * 60 ? `${Math.floor(m / 60)}${NB}h` : `${Math.floor(m / 1440)}${NB}d`;
}

/* ── the forecast place's clock ──
   Open-Meteo writes a file on the one offset in force when it was fetched, so past a change of the clocks
   only the zone (Intl, offline) tells an hour as the place's clocks do (tools/DECISIONS.md, D-DST).
   A place is { zone, offset }; a bare number is a fixed offset. */
const walls = new Map();
const wall = (zone) => {
  if (!walls.has(zone)) {
    let f = null;
    try { f = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); } catch { /* not a zone */ }
    walls.set(zone, f);
  }
  return walls.get(zone);
};
/** Seconds east of UTC on the place's clock at `ms`. */
export function offsetAt(ms, place) {
  const f = place && place.zone ? wall(place.zone) : null;
  if (!f) return typeof place === 'number' ? place : place.offset;
  const p = {}, t = Math.floor(ms / 1000) * 1000;
  for (const { type, value } of f.formatToParts(new Date(t))) p[type] = Number(value);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - t) / 1000;
}
/** The file's place: its zone if known here and keeping the file's offset at one of `probes`, else the offset. */
export function placeOf(zone, offset, probes = []) {
  const p = { zone: typeof zone === 'string' && wall(zone) ? zone : null, offset };
  if (p.zone && probes.length && !probes.some((ms) => offsetAt(ms, p) === offset)) p.zone = null;
  return p;
}
/** The file's zone by its offsets: "UTC+2", or "UTC+2, then UTC+1" when the clocks change inside it. */
export function placeZones(a, b, place) {
  const x = zone(offsetAt(a, place) / 60), y = zone(offsetAt(b, place) / 60);
  return x === y ? x : `${x}, then ${y}`;
}
const at = (ms, off) => new Date(ms + offsetAt(ms, off) * 1000);
/** "07:00". */
export const placeClock = (ms, off) => { const d = at(ms, off); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; };
/** "Mon 21": the Shutters' day labels. */
export const placeDay = (ms, off) => { const d = at(ms, off); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()}`; };
/** "Mon 21 Sep", or "Mon 21 Sep 2025" when the year is not the phone's. */
export function placeDate(ms, off, now = Date.now()) {
  const d = at(ms, off), y = d.getUTCFullYear();
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONS[d.getUTCMonth()]}${y === new Date(now).getFullYear() ? '' : ` ${y}`}`;
}
/** "Mon 21 Sep 2026, 05:00": About's span, with the year always. */
export const placeFull = (ms, off) => { const d = at(ms, off); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${placeClock(ms, off)}`; };
/** The days a file covers: "21 to 23 Sep 2026", "30 Sep to 2 Oct 2026", "31 Dec 2026 to 1 Jan 2027". */
export function placeDays(a, b, off) {
  const x = at(a, off), y = at(b, off), d = (q) => q.getUTCDate(), m = (q) => MONS[q.getUTCMonth()], yr = (q) => q.getUTCFullYear();
  if (yr(x) !== yr(y)) return `${d(x)} ${m(x)} ${yr(x)} to ${d(y)} ${m(y)} ${yr(y)}`;
  if (m(x) !== m(y)) return `${d(x)} ${m(x)} to ${d(y)} ${m(y)} ${yr(y)}`;
  return d(x) === d(y) ? `${d(x)} ${m(x)} ${yr(x)}` : `${d(x)} to ${d(y)} ${m(y)} ${yr(y)}`;
}
/** A run of hours, its end exclusive: "07:00–19:00"; "20:00–24:00" when it ends at midnight; "10:00 to Wed
 *  05:00" when it ends on a later day, so an overnight window never reads as a backwards range. */
export function placeSpan(a, b, off) {
  const day = (ms) => Math.floor(at(ms, off) / 864e5), end = placeClock(b, off);
  return day(a) === day(b - 1) ? `${placeClock(a, off)}–${end === '00:00' ? '24:00' : end}` : `${placeClock(a, off)} to ${DAYS[at(b, off).getUTCDay()]} ${end}`;
}
/** What VoiceOver hears for an hour: "Monday 21 September, 07:00". */
export const spokenHour = (ms, off) => { const d = at(ms, off); return `${DAYNAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${placeClock(ms, off)}`; };
/** The place's local hour of day, 0 to 23 (the Shutters' midnights and quarter-day ticks). */
export const placeHour = (ms, off) => at(ms, off).getUTCHours();

/** The app's short dates in words, for the live region: "21 Sep" to "21 September", U+202F to a space. */
export const spoken = (text) => String(text).replace(/\u202f/g, ' ').replace(/\u2212/g, 'minus ')
  .replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (_, d, m) => `${d} ${MONTHS[MONS.indexOf(m)]}`);
