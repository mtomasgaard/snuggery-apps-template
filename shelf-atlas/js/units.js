// Every number, unit and date Shelf Atlas writes (ART.md section 3; HOUSE.md section 6), on Global
// Weather's pattern. Pure: runs in Node, so tools/test_decode.mjs checks it against a table of its own.
// SI notation: the true minus U+2212, U+202F between a number and its unit and between groups of
// thousands (from four digits up), a point for the decimal mark. Months and instants are built by hand
// with fixed English words, so every phone prints the same thing whatever its locale.
// Two systems, SI first: standard cubic meters (Sm³, Sm³/d, Sm³ o.e.), and one press away the field
// units (barrels, standard cubic feet, barrels of oil equivalent), with the regulators' own factors.

export const MINUS = '−';
export const NNBSP = ' ';
export const BBL = 6.2898;               // barrels per Sm³ (and boe per Sm³ o.e.), as the snapshot states
export const SCF = 35.3147;              // standard cubic feet per Sm³
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EPOCH = 1971;
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
/** A plain integer, grouped. */
export const int = (n) => fixed(Math.round(n), 0);
/** Number and unit joined by U+202F; no unit, no space. */
export const withUnit = (s, unit) => (unit ? `${s}${NNBSP}${unit}` : String(s));

const WORDS = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
/** Three significant figures: "985", "4 180", "134 000", "0.712"; from a million in words,
 *  "1.02 million", "82.9 billion". `spoken` drops the group spaces, which a screen reader reads aloud. */
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
/** A legend's open end or a decade tick: whole from 10 up, three figures from 1 000 ("10 million", not "10.0"). */
export function tick(v) {
  const a = Math.abs(v);
  if (a >= 1000) return sig3(v).replace(/\.0+ /, ' ');
  if (a >= 10) return int(v);
  return sig3(v);
}
/** "85.47 %". */
export const percent = (v, d = 2) => withUnit(fixed(v, d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''), '%');
/** "65.064° N, 6.725° E". */
export function coord(lat, lon, d = 3) {
  return `${fixed(Math.abs(lat), d)}°${NNBSP}${lat >= 0 ? 'N' : 'S'}, ${fixed(Math.abs(lon), d)}°${NNBSP}${lon >= 0 ? 'E' : 'W'}`;
}
/** "308 km". */
export const km = (v) => withUnit(int(v), 'km');
/** A pipeline's diameter, given in inches: "762 mm (30 in)" in SI, "30 in (762 mm)" in field units. */
export function diameter(inch, sys) {
  const mm = withUnit(int(inch * 25.4), 'mm'), i = withUnit(fixed(inch, Number.isInteger(inch) ? 0 : 1), 'in');
  return sys === 'field' ? `${i} (${mm})` : `${mm} (${i})`;
}

/* ── quantities: what the circles carry, in either system ── */
export const QTY = {
  liq: { name: 'Liquids', si: { f: 1, rate: 'Sm³/d', vol: 'Sm³' }, field: { f: BBL, rate: 'bbl/d', vol: 'bbl' } },
  gas: { name: 'Gas', si: { f: 1, rate: 'Sm³/d', vol: 'Sm³' }, field: { f: SCF, rate: 'scf/d', vol: 'scf' } },
  oe: { name: 'Oil equivalent', si: { f: 1, rate: 'Sm³ o.e./d', vol: 'Sm³ o.e.' }, field: { f: BBL, rate: 'boe/d', vol: 'boe' } },
};
const SAY = {
  'Sm³/d': 'standard cubic meters a day', 'Sm³': 'standard cubic meters',
  'Sm³ o.e./d': 'standard cubic meters of oil equivalent a day', 'Sm³ o.e.': 'standard cubic meters of oil equivalent',
  'bbl/d': 'barrels a day', bbl: 'barrels', 'scf/d': 'standard cubic feet a day', scf: 'standard cubic feet',
  'boe/d': 'barrels of oil equivalent a day', boe: 'barrels of oil equivalent',
};
/** A unit in words, for VoiceOver. */
export const sayUnit = (u) => SAY[u] || u;
/** The unit of quantity q in system sys: a rate (per day) or, `cum`, a volume. */
export const unitOf = (q, sys, cum) => QTY[q][sys][cum ? 'vol' : 'rate'];
/** A value given in Sm³ (or Sm³/d) shown in system sys: "408 000 Sm³/d", "1.19 billion Sm³". */
export const amount = (v, q, sys, cum) => withUnit(sig3(v * QTY[q][sys].f), unitOf(q, sys, cum));
/** The same in words: "408000 standard cubic meters a day". */
export const amountSpoken = (v, q, sys, cum) => `${sig3(v * QTY[q][sys].f, true)} ${sayUnit(unitOf(q, sys, cum))}`;

/* ── months and instants ── */
const year = (mi) => EPOCH + Math.floor(mi / 12);
/** "Jun 2026": a month index (months since January 1971). */
export const month = (mi) => `${MONS[mi % 12]} ${year(mi)}`;
/** "June 2026", for VoiceOver and for sentences. */
export const monthLong = (mi) => `${MONTHS[mi % 12]} ${year(mi)}`;
/** "04:15". */
export function clock(ms) { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
/** "26 Sep". */
export function dayMonth(ms) { const d = new Date(ms); return `${d.getDate()} ${MONS[d.getMonth()]}`; }
/** The stamp's instant: "10:56" today, "26 Sep, 10:56" another day. */
export function when(ms, now = Date.now()) {
  return new Date(ms).toDateString() === new Date(now).toDateString() ? clock(ms) : `${dayMonth(ms)}, ${clock(ms)}`;
}
/** About's full instants with the zone as an offset: "Sat 26 Sep 2026, 10:56 (UTC−7)". */
export function full(ms) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off);
  const zone = off === 0 ? 'UTC' : `UTC${off > 0 ? '+' : MINUS}${Math.floor(a / 60)}${a % 60 ? `:${pad2(a % 60)}` : ''}`;
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]} ${d.getFullYear()}, ${clock(ms)} (${zone})`;
}
