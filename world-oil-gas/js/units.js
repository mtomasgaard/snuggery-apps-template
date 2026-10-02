// Every number, unit and date World Oil & Gas writes (ART.md section 3; HOUSE.md section 6), on Global
// Weather's and Shelf Atlas's pattern. Pure: tools/test_decode.mjs runs it in Node against a table.
// SI notation: the true minus U+2212, U+202F between a number and its unit and between groups of
// thousands (four digits up), a point for the decimal mark; years never grouped. Dates are built by
// hand with fixed English words, so every phone prints the same thing whatever its locale.
// Two systems, SI first: countries in TWh/yr (PWh to date), fields in Sm³; one press away, kboe/d
// (Gboe to date) and the tracker's own barrels.

export const MINUS = '\u2212';      // the true minus
export const NNBSP = '\u202F';      // the narrow no-break space
export const BBL = 6.2898;               // barrels per Sm³ (and boe per Sm³ o.e.)
export const GAS_SM3 = 159;              // Sm³ of gas per boe, the tracker's own factor (fields.json units)
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
/** A number with d decimals: the true minus, never a negative zero, thousands grouped. */
export function fixed(v, d = 0) {
  if (!Number.isFinite(v)) return '–';
  const s = Math.abs(v).toFixed(d);
  const [i, f] = s.split('.');
  const neg = v < 0 && Number(s) !== 0;
  return (neg ? MINUS : '') + (i.length > 3 ? group(i) : i) + (f ? `.${f}` : '');
}
export const int = (n) => fixed(Math.round(n), 0);
/** Number and unit joined by U+202F; no unit, no space. */
export const withUnit = (s, unit) => (unit ? `${s}${NNBSP}${unit}` : String(s));

const WORDS = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
/** Three significant figures: "985", "94 100", "0.712"; from a million in words, "1.02 million".
 *  `spoken` drops the group spaces, which a screen reader would read aloud. */
export function sig3(v, spoken = false) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a === 0) return '0';
  for (const [d, w] of WORDS) {
    if (a >= d * 0.9995) {
      const x = v / d, ax = Math.abs(x);
      return `${fixed(x, ax >= 99.95 ? 0 : ax >= 9.995 ? 1 : 2)} ${w}`;
    }
  }
  const e = Math.floor(Math.log10(a)), d = Math.max(0, 2 - e);
  const r = Number((Math.round(v / 10 ** (e - 2)) * 10 ** (e - 2)).toFixed(d));
  const t = fixed(r, Math.abs(r) >= 100 ? 0 : d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  return spoken ? t.replaceAll(NNBSP, '') : t;
}
/** A legend tick: "0.05", "2", "1 000", "20 000". */
export const tick = (v) => (Math.abs(v) >= 10 ? int(v) : sig3(v));
/** A share, in percent: "21.6 %"; above zero but under 0.05, "under 0.1 %". */
export const pct = (p) => (p > 0 && p < 0.05 ? `under 0.1${NNBSP}%` : withUnit(fixed(p, 1), '%'));
export const pctSpoken = (p) => (p > 0 && p < 0.05 ? 'under 0.1 percent' : `${fixed(p, 1)} percent`);
/** "1st", "2nd", "11th", "22nd". */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ── countries: the series are GWh a year ── */
// dom: the color scale's ends, a log scale (the stock app's domains, unchanged).
export const COUNTRY = {
  twh: { label: 'TWh/yr', say: 'terawatt-hours a year', dom: [2, 20000] },
  kboe: { label: 'kboe/d', say: 'thousand barrels of oil equivalent a day', dom: [3, 30000] },
};
export const COUNTRY_CUM = {
  twh: { label: 'PWh', say: 'petawatt-hours', dom: [0.05, 500] },
  kboe: { label: 'Gboe', say: 'billion barrels of oil equivalent', dom: [0.03, 300] },
};
export const UNIT_ORDER = ['twh', 'kboe'];
export const unitSpec = (u, cum) => (cum ? COUNTRY_CUM : COUNTRY)[u];
/** GWh (a year, or to date) in the unit shown: boe/d = GWh / 1000 × boePerTWh / 365. */
export function toUnit(gwh, u, cum, boePerTWh) {
  if (gwh == null) return null;
  if (cum) return u === 'twh' ? gwh / 1e6 : (gwh * boePerTWh) / 1e12;
  return u === 'twh' ? gwh / 1000 : (gwh * boePerTWh) / 365 / 1e6;
}

/* ── fields: the tracker's barrels a day (oil), boe a day (gas), million bbl and million boe ── */
// kind: 'oil' | 'gas' | 'oe', a rate (per day) or a volume. In SI: Sm³ of oil, Sm³ of gas (159 a boe),
// Sm³ o.e. (a boe is 1 / 6.2898 Sm³ o.e., for oil and gas alike).
const FIELD = {
  si: { oil: ['Sm³', 1 / BBL], gas: ['Sm³', GAS_SM3], oe: ['Sm³ o.e.', 1 / BBL] },
  field: { oil: ['bbl', 1], gas: ['boe', 1], oe: ['boe', 1] },
};
export const fieldUnit = (kind, sys, rate) => `${FIELD[sys][kind][0]}${rate ? '/d' : ''}`;
export const fieldValue = (v, kind, sys) => v * FIELD[sys][kind][1];
/** "9 070 Sm³/d", "1.19 million Sm³ o.e.". */
export const field = (v, kind, sys, rate = true) => withUnit(sig3(fieldValue(v, kind, sys)), fieldUnit(kind, sys, rate));
/** The chosen system first, the other in brackets: "9 070 Sm³/d (57 000 bbl/d)". */
export const fieldBoth = (v, kind, sys, rate = true) => `${field(v, kind, sys, rate)} (${field(v, kind, sys === 'si' ? 'field' : 'si', rate)})`;

const SAY = {
  'Sm³/d': 'standard cubic meters a day', 'Sm³': 'standard cubic meters',
  'Sm³ o.e./d': 'standard cubic meters of oil equivalent a day', 'Sm³ o.e.': 'standard cubic meters of oil equivalent',
  'bbl/d': 'barrels a day', bbl: 'barrels', 'boe/d': 'barrels of oil equivalent a day', boe: 'barrels of oil equivalent',
};
export const sayUnit = (u) => SAY[u] || u;
export const fieldSpoken = (v, kind, sys, rate = true) => `${sig3(fieldValue(v, kind, sys), true)} ${sayUnit(fieldUnit(kind, sys, rate))}`;

/* ── instants ── */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
export function dayMonth(ms) { const d = new Date(ms); return `${d.getDate()} ${MONS[d.getMonth()]}`; }
/** The stamp's instant: "08:18" today, "27 Sep, 08:18" this year, "27 Sep 2025, 08:18" before. */
export function when(ms, now = Date.now()) {
  const d = new Date(ms), n = new Date(now);
  if (d.toDateString() === n.toDateString()) return clock(ms);
  return `${dayMonth(ms)}${d.getFullYear() === n.getFullYear() ? '' : ` ${d.getFullYear()}`}, ${clock(ms)}`;
}
/** About's full instant with the zone as an offset: "Sun 27 Sep 2026, 08:18 (UTC+2)". */
export function full(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off);
  const zone = off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : MINUS}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${zone})`;
}
