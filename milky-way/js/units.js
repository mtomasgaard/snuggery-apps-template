// Every number, unit, date and time the app writes (HOUSE.md section 6; Global Weather's js/units.js
// is the pattern). Pure: runs in Node. SI notation: the true minus U+2212, U+202F between a number
// and its unit and between groups of thousands, 24-hour clock, day before month. Dates are UTC, the
// ephemeris's own clock, built by hand rather than by the locale, so every phone prints the same.

import { AU_KM, PC_AU, LY_AU, LIGHT_S_PER_AU } from './util.js';

export const MINUS = '−';
export const NNBSP = '\u202F';
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pad2 = (n) => String(n).padStart(2, '0');

/** "16380" to "16 380" (U+202F); four digits and more are grouped. */
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
/** v to n significant figures: the figures and the unit are chosen from what is printed (99.96 is 100). */
const round = (v, n = 3) => Number(v.toPrecision(n));
/** n significant figures (three by default), never scientific notation. */
export function sig(v, n = 3) {
  if (!Number.isFinite(v)) return '–';
  if (v === 0) return '0';
  v = round(v, n);
  const p = n - 1 - Math.floor(Math.log10(Math.abs(v)));
  return fixed(v, Math.max(0, Math.min(6, p)));
}
/** Number and unit joined by U+202F. */
export const withUnit = (s, unit) => `${s}${NNBSP}${unit}`;

/** A distance in AU as [number, unit, spoken unit]: km below a million km, AU below 20 000 AU, then pc,
 *  kpc and Mpc below a thousand of each. */
export function distParts(au) {
  const km = au * AU_KM, pc = au / PC_AU;
  if (round(km, 4) < 1e6) return [sig(km, km < 1000 ? 3 : 4), 'km', 'kilometers'];
  if (round(au) < 2e4) return [sig(au), 'AU', 'astronomical units'];
  if (round(pc) < 1e3) return [sig(pc), 'pc', 'parsecs'];
  if (round(pc / 1e3) < 1e3) return [sig(pc / 1e3), 'kpc', 'kiloparsecs'];
  return [sig(pc / 1e6), 'Mpc', 'megaparsecs'];
}
export const dist = (au) => { const [n, u] = distParts(au); return withUnit(n, u); };
export const distSpoken = (au) => { const [n, , s] = distParts(au); return `${n.replace(/\u202F/g, '')} ${s}`; };
/** Light-years, the card's second figure for stars and the galaxy's objects. */
export const ly = (au) => withUnit(sig(au / LY_AU), 'light-years');
/** Light travel time for a distance in AU. */
export function lightTime(au) {
  const s = au * LIGHT_S_PER_AU;
  if (s < 90) return withUnit(sig(s), 'light-seconds');
  if (s < 5400) return withUnit(sig(s / 60), 'light-minutes');
  if (s < 172800) return withUnit(sig(s / 3600), 'light-hours');
  return withUnit(sig(s / 86400), 'light-days');
}
/** A duration in days: h below 2 d, d below 800 d, then years in words. */
export function days(d) {
  const a = Math.abs(d);
  if (!Number.isFinite(a)) return '–';
  if (round(a) < 2) return withUnit(sig(a * 24), 'h');
  if (round(a) < 800) return withUnit(sig(a), 'd');
  return withUnit(sig(a / 365.25), 'years');
}
export const deg = (v, d = 2) => `${fixed(v, d)}°`;
export const km = (v, d = 0) => withUnit(fixed(v, d), 'km');

/* ── dates, in UTC ── */
/** "1 Oct 2026". */
export const date = (t) => `${t.getUTCDate()} ${MONS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
/** "16:03". */
export const clock = (t) => `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
/** "Thursday 1 October 2026, 16:03 UTC", for VoiceOver. */
export const spoken = (t) => `${DAYS_FULL[t.getUTCDay()]} ${t.getUTCDate()} ${MONS_FULL[t.getUTCMonth()]} ${t.getUTCFullYear()}, ${clock(t)} UTC`;
/** "2026-09-23" (a data file's retrieval date) to "23 Sep 2026". */
export const isoDay = (s) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? `${+m[3]} ${MONS[m[2] - 1]} ${m[1]}` : ''; };
