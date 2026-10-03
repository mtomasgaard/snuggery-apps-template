// Every number, date, time and span World News writes (HOUSE.md 6.1, 6.2; ART.md section 3). Pure: runs
// in Node, and tools/test_datelines.mjs checks it. U+202F between a number and its unit, 24-hour clock, day
// before month, fixed English words built by hand, so every locale prints the same thing.

export const NB = '\u202f';
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad2 = (n) => String(n).padStart(2, '0');

/** A whole count, grouped with U+202F from four digits up. */
export function int(n) {
  const s = String(Math.round(Math.abs(n)));
  return (n < 0 && Math.round(n) ? '−' : '') + (s.length < 4 ? s : s.replace(/\B(?=(\d{3})+(?!\d))/g, NB));
}
/** "1 headline", "48 headlines". */
export const count = (n, word, plural = `${word}s`) => `${int(n)} ${n === 1 ? word : plural}`;
/** "a, b and c". */
export const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

/* Instants, in the phone's own time zone. */
/** "07:01". */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
/** "1 Oct", or "1 Oct 2025" when the year is not the phone's. */
export function dayMon(ms, now = Date.now()) {
  const d = new Date(ms), y = d.getFullYear();
  return `${d.getDate()} ${MONS[d.getMonth()]}${y === new Date(now).getFullYear() ? '' : ` ${y}`}`;
}
const sameDay = (a, b) => { const x = new Date(a), y = new Date(b); return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate(); };
/** The stamp's time: "07:01" on the file's own day, "1 Oct, 07:01" after it. */
export const stampWhen = (ms, now = Date.now()) => (sameDay(ms, now) ? clock(ms) : `${dayMon(ms, now)}, ${clock(ms)}`);
/** "Thu 1 Oct 2026, 07:01 (UTC+2)": About's full instant, the zone named by its offset. */
export function full(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off);
  const zone = off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : '−'}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${zone})`;
}

/**
 * A feed that gives a date and no time stamps it at exactly 00:00:00 or 12:00:00 UTC (UN News puts every
 * story at noon, Global Voices some at midnight). Such a headline is shown by its date alone, the UTC date
 * the feed wrote, never a time of day the feed did not give (ART.md, B11).
 */
export const isDateOnly = (iso) => /T(00|12):00:00(\.0+)?(Z|\+00:00)$/.test(String(iso));
/** A story's date: "23 Sep" for a date-only stamp, "30 Sep, 22:07" with a time; the year when not this one. */
export function itemWhen(iso, now = Date.now()) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  if (!isDateOnly(iso)) return `${dayMon(ms, now)}, ${clock(ms)}`;
  const d = new Date(ms), y = d.getUTCFullYear();
  return `${d.getUTCDate()} ${MONS[d.getUTCMonth()]}${y === new Date(now).getFullYear() ? '' : ` ${y}`}`;
}

/* Spans of age, in hours. */
/** The Datelines' scale labels: "1 h", "6 h", "1 d", "7 d", "60 d"; an end the data passes prints open. */
export function ageLabel(h, open = '') {
  const s = h < 24 ? `${int(h)}${NB}h` : `${int(h / 24)}${NB}d`;
  return open ? `${open} ${s}` : s;
}
/** What VoiceOver hears for an age: "7 days 17 hours", "15 hours", "under an hour". */
export function spokenAge(h) {
  if (!(h >= 1)) return 'under an hour';
  const d = Math.floor(h / 24), r = Math.floor(h - d * 24);
  return [d && count(d, 'day'), r && count(r, 'hour')].filter(Boolean).join(' ');
}
/**
 * A date-only stamp's age in words: the feed named a UTC day, so the story is from some time in it, and the
 * age is a span, never the hours its placeholder noon or midnight would give. Whole days as spokenAge counts
 * them: "7 or 8 days"; within a day of the file, "at most 1 day 5 hours".
 */
export function spokenDated(gen, iso) {
  const d = new Date(Date.parse(iso)), hi = (gen - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / 36e5;
  if (hi < 48) return hi < 1 ? 'under an hour' : `at most ${spokenAge(hi)}`;
  const b = Math.floor(hi / 24);
  return `${b - 1} or ${count(b, 'day')}`;
}
/** An item's age in words: spokenAge, or spokenDated for a date-only stamp. */
export const spokenItem = (gen, iso) => (isDateOnly(iso) ? spokenDated(gen, iso) : spokenAge((gen - Date.parse(iso)) / 36e5));
/** The app's short dates in words, for the live region: "23 Sep" to "23 September". */
export const spoken = (text) => String(text).replace(/\u202f/g, ' ')
  .replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (_, d, m) => `${d} ${MONTHS[MONS.indexOf(m)]}`);
