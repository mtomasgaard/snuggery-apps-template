// US / metric conversions and every number format the app prints (DESIGN §2, E10).
// SI units by default (°C, m, km, mm); US units one tap away. Thousands are grouped with a narrow
// no-break space (SI style), never a comma, so "1 732" cannot be read as a decimal. CO₂ is ppm in both; plate speeds are cm/yr, with inches
// first in the US setting. Every number comes from the data files — these functions only convert.

let system = 'metric';
export const setSystem = (s) => { system = s === 'metric' ? 'metric' : 'us'; };
export const getSystem = () => system;
export const isUS = () => system === 'us';

const MINUS = '−';
const nf = new Map();
function fmtN(n, digits = 0) {
  let f = nf.get(digits);
  if (!f) { f = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }); nf.set(digits, f); }
  const s = f.format(Math.abs(n)).replace(/,/g, '\u202f');
  // "-0" never prints: a value that rounds to zero is zero.
  return n < 0 && s.replace(/[0.\u202f]/g, '') !== '' ? MINUS + s : s;
}
export const fmt = fmtN;

/* ── conversions ── */
export const cToF = (c) => c * 9 / 5 + 32;
export const M_PER_FT = 0.3048;
export const KM_PER_MI = 1.609344;
export const MM_PER_IN = 25.4;
export const CM_PER_IN = 2.54;
/** A rate in mm/day as a yearly total: × 365.25 days (a calendar year, not the model's 360-day one). */
export const DAYS_PER_YEAR = 365.25;

/* ── formats ── */
export function temperature(c, digits = 0) {
  return isUS() ? `${fmtN(cToF(c), digits)} °F` : `${fmtN(c, digits)} °C`;
}
export function distanceKm(km) {
  return isUS() ? `${fmtN(km / KM_PER_MI)} mi` : `${fmtN(km)} km`;
}
export function rainPerYear(mmDay) {
  const mm = mmDay * DAYS_PER_YEAR;
  if (isUS()) { const inch = mm / MM_PER_IN; return `${fmtN(inch, inch < 10 ? 1 : 0)} in`; }
  return `${fmtN(mm)} mm`;
}
/** Plate speed: "1.2 in (3.1 cm)" in the US setting, "3.1 cm" in metric. */
export function speedCmYr(cm) {
  const c = fmtN(cm, 1);
  return isUS() ? `${fmtN(cm / CM_PER_IN, 1)} in (${c} cm)` : `${c} cm`;
}
export const latText = (lat) => `${fmtN(Math.abs(Math.round(lat)))}° ${Math.round(lat) < 0 ? 'S' : 'N'}`;
export function lonText(lon) {
  const r = Math.round(lon);
  if (r === 0 || Math.abs(r) === 180) return `${Math.abs(r)}°`;
  return `${Math.abs(r)}° ${r < 0 ? 'W' : 'E'}`;
}

/**
 * The map's age as Scotese's Table 1 gives it (DESIGN §3.3): "Today" for 0; ages under 0.1 Ma in
 * years rounded to the thousand ("21 000 years ago"); otherwise the number exactly as in the table.
 */
export function ageText(ageMa) {
  if (ageMa === 0) return 'Today';
  if (ageMa < 0.1) return `${fmtN(Math.round(ageMa * 1000) * 1000)} years ago`;
  return `${String(+ageMa)} million years ago`;
}
/** The same, for the middle of a sentence ("Here, 251 million years ago", "Here, today"). */
export const agePhrase = (ageMa) => (ageMa === 0 ? 'today' : ageText(ageMa));

/** The Sun's brightness relative to today, Gough (1981) eq. (1) with t☉ = 4.7 Gyr (DESIGN §4.5). */
export const sunPercent = (ageMa) => 100 / (1 + 0.4 * ageMa / 4700);

/* ── the sheet's tiles and the curves' labels (DESIGN §3.5, §3.6) ── */
/** Sea level relative to today: "+638 ft" / "+194.5 m" (whole feet; metres to 0.1). */
export function seaLevel(m) {
  const v = isUS() ? m / M_PER_FT : m, s = fmtN(v, isUS() ? 0 : 1);
  return `${v > 0 && s.replace(/[0.\u202f]/g, '') !== '' ? '+' : ''}${s} ${isUS() ? 'ft' : 'm'}`;
}
/** A length without a sign: "599 ft" / "182.5 m". */
export const depth = (m) => (isUS() ? `${fmtN(m / M_PER_FT)} ft` : `${fmtN(m, 1)} m`);
/** A temperature difference: "13.3 °F" / "7.4 °C" (no sign; the words say warmer or cooler). */
export const temperatureDelta = (dc, digits = 1) => (isUS() ? `${fmtN(Math.abs(dc) * 9 / 5, digits)} °F` : `${fmtN(Math.abs(dc), digits)} °C`);
/** Degrees to one decimal, for Find's "now 41.8° N 87.7° W". */
export const latText1 = (lat) => `${fmtN(Math.abs(lat), 1)}° ${lat < 0 ? 'S' : 'N'}`;
export const lonText1 = (lon) => `${fmtN(Math.abs(lon), 1)}° ${lon < 0 ? 'W' : 'E'}`;
/** An ICS or event age as the chart writes it, with ± where given: "251.902 ± 0.024 million years ago". */
export function chartAge(ma, unc) {
  if (ma === 0) return 'today';
  if (ma < 0.1) return `${fmtN(Math.round(ma * 1000) * 1000)} years ago`;
  return `${String(+ma)}${unc != null ? ` ± ${String(+unc)}` : ''} million years ago`;
}
/** A number of millions of years as written in the data: 1000 → "1 000", 251.902 → "251.902". */
export const maText = (ma) => (Number.isInteger(ma) ? fmtN(ma) : String(+ma));
