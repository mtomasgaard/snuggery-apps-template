// Every number, unit and date the app writes (ART.md section 3; HOUSE.md section 6). Pure: runs in
// Node, so tools/test_decode.mjs can check it against a table of its own.
// SI notation: the true minus U+2212, U+202F between a number and its unit and between groups of
// thousands (from four digits), a point for the decimal mark. Report dates are built by hand from the
// data's own ISO dates, day before month, so every phone prints the same words.
// Two unit systems, SI first: the units key switches the whole system at once (bar or psi, meters or
// feet, Sm³/d or bbl/d for liquids, Sm³/d or Mscf/d for gas); permeability stays mD in both.

export const MINUS = '−';
export const NNBSP = '\u202f';
export const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* The two systems' constants. Standard conditions differ slightly between the two (15 °C against
   60 °F); the conversion ignores that, and About says so. */
export const PSI_PER_BAR = 14.5038;
export const FT_PER_M = 3.28084;
export const BBL_PER_SM3 = 6.28981;
export const MSCF_PER_SM3 = 0.0353147;
export const SYSTEMS = ['SI', 'US'];

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
  if (!Number.isFinite(v)) return '';
  const s = Math.abs(v).toFixed(d);
  const [i, f] = s.split('.');
  const neg = v < 0 && Number(s) !== 0;
  return (neg ? MINUS : '') + (i.length > 3 ? group(i) : i) + (f ? `.${f}` : '');
}
/** A plain integer, grouped. */
export const int = (n) => fixed(Math.round(n), 0);
/** Number and unit joined by U+202F; no unit, no space. */
export const withUnit = (s, unit) => (unit ? `${s}${NNBSP}${unit}` : String(s));
/** A scale tick: whole numbers whole, small ones to at most three places with trailing zeros dropped. */
export function tick(v) {
  if (Math.abs(v) >= 10 || Number.isInteger(v)) return fixed(Math.round(v), 0);
  return fixed(v, 3).replace(/0+$/, '').replace(/\.$/, '');
}
/** A share as a whole percent: "69 %". */
export const percent = (share) => withUnit(int(share * 100), '%');
/** The vertical exaggeration: "×5", "×2.5". */
export const times = (k) => `×${tick(Math.round(k * 10) / 10)}`;

/* ── quantities, per system ── */
/** The unit a property's value is shown in under a system. */
export function unitOf(unit, sys) {
  if (sys !== 'US') return unit || '';
  return { bar: 'psi', m: 'ft' }[unit] || unit || '';
}
/** A property's value in a system (the number only). */
export function toSystem(v, unit, sys) {
  if (sys !== 'US') return v;
  if (unit === 'bar') return v * PSI_PER_BAR;
  if (unit === 'm') return v * FT_PER_M;
  return v;
}
/** A property's value, as text without its unit: saturations and net to gross two places, porosity
 *  three, pressure and depth whole, permeability whole from 10 mD, one place below, two below 1. */
export function valueText(p, v, sys) {
  if (!Number.isFinite(v)) return 'not in the data';
  if (p.unit === 'mD') return fixed(v, v >= 10 ? 0 : v >= 1 ? 1 : 2);
  const s = toSystem(v, p.unit, sys);
  const d = p.unit === 'bar' || p.unit === 'm' ? 0 : (p.decimals ?? 2);
  return fixed(s, d);
}
/** The same with its unit: "287 bar", "4 163 psi", "0.62". */
export const valueWithUnit = (p, v, sys) => withUnit(valueText(p, v, sys), Number.isFinite(v) ? unitOf(p.unit, sys) : '');

/** A liquid rate given in Sm³/d: "7 361 Sm³/d" or "46 300 bbl/d". */
export function liquid(v, sys) { return sys === 'US' ? withUnit(int(v * BBL_PER_SM3), 'bbl/d') : withUnit(int(v), 'Sm³/d'); }
/** A gas rate given in Sm³/d: "412 000 Sm³/d" or "14 550 Mscf/d". */
export function gas(v, sys) { return sys === 'US' ? withUnit(int(v * MSCF_PER_SM3), 'Mscf/d') : withUnit(int(v), 'Sm³/d'); }
/** A rate's number only, in a system's unit. */
export const liquidIn = (v, sys) => (sys === 'US' ? v * BBL_PER_SM3 : v);
export const gasIn = (v, sys) => (sys === 'US' ? v * MSCF_PER_SM3 : v);
export const liquidUnit = (sys) => (sys === 'US' ? 'bbl/d' : 'Sm³/d');
export const gasUnit = (sys) => (sys === 'US' ? 'Mscf/d' : 'Sm³/d');

/** A horizontal length given in meters, for the scale bar: "3 km", "750 m", "2 mi", "2 000 ft". */
export function length(m, sys) {
  if (sys === 'US') {
    const ft = m * FT_PER_M;
    return ft >= 5280 ? withUnit(tick(Math.round((ft / 5280) * 100) / 100), 'mi') : withUnit(int(ft), 'ft');
  }
  return m >= 1000 ? withUnit(tick(Math.round((m / 1000) * 100) / 100), 'km') : withUnit(int(m), 'm');
}
/** The round lengths a scale bar may take, in meters, for each system. */
export function scaleSteps(sys) {
  const out = [];
  const base = [1, 1.5, 2, 2.5, 3, 5, 7.5];
  if (sys === 'US') {
    for (let e = 1; e <= 4; e++) for (const s of base) { const ft = s * 10 ** e; if (ft < 5280) out.push(ft / FT_PER_M); }
    for (let e = 0; e <= 2; e++) for (const s of base) out.push((s * 10 ** e * 5280) / FT_PER_M);
  } else {
    for (let e = -1; e <= 5; e++) for (const s of base) out.push(s * 10 ** e);
  }
  return out;
}

/* ── spoken forms, for VoiceOver ── */
const SPOKEN_UNIT = {
  bar: 'bar', psi: 'pounds per square inch', m: 'meters', ft: 'feet', mD: 'millidarcies',
  'Sm³/d': 'standard cubic meters a day', 'bbl/d': 'barrels a day', 'Mscf/d': 'thousand standard cubic feet a day',
};
/** Text with its units in words and its groups closed up: "7361 standard cubic meters a day". */
export const spokenUnits = (t) => String(t).replace(/(\d)\u202f(?=\d{3})/g, '$1')
  .replace(/\u202f(bar|psi|m|ft|mD|Sm³\/d|bbl\/d|Mscf\/d)(?=$|[\s,.;)])/g, (m0, u) => ` ${SPOKEN_UNIT[u]}`)
  .replace(/\u202f%/g, ' percent').replace(/\u202f/g, ' ').replace(MINUS, 'minus ');

/* ── report dates: ISO "2006-12-01" in the data ── */
const parts = (iso) => iso.split('-').map(Number);
/** "1 Dec 2006": the one large figure. */
export function date(iso) { const [y, m, d] = parts(iso); return `${d} ${MONS[m - 1]} ${y}`; }
/** "Nov 1997". */
export function month(iso) { const [y, m] = parts(iso); return `${MONS[m - 1]} ${y}`; }
/** "November 1997". */
export function spokenMonth(iso) { const [y, m] = parts(iso); return `${MONS_FULL[m - 1]} ${y}`; }
/** "1 December 2006". */
export function spokenDate(iso) { const [y, m, d] = parts(iso); return `${d} ${MONS_FULL[m - 1]} ${y}`; }
/** Whole days since 1970 for an ISO date (UTC), the track's linear axis. */
export function dayNumber(iso) { const [y, m, d] = parts(iso); return Date.UTC(y, m - 1, d) / 864e5; }
/** The lead beside the date: "First oil", "25 days after first oil", "9.1 years after first oil". */
export function lead(days) {
  if (days <= 0) return 'First oil';
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'} after first oil`;
  return `${fixed(days / 365.25, 1)} years after first oil`;
}
