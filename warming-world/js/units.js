// °C only (DESIGN §2, §18 D-6): a sign, the true minus U+2212, U+202F between a number and its unit
// and between groups of thousands. Every value is printed from integers (tenths, hundredths, ten-
// thousandths), never through a float toFixed of −12.7 + 0.1·b (CONTRACT §4). Pure: runs in Node.

export const MINUS = '−';
export const NNBSP = ' ';
export const NDASH = '–';
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December'];

/** Half away from zero on integers (CONTRACT §3.6): sign(s)·⌊(2|s| + d) / (2d)⌋ for d > 0. */
export function roundDiv(s, d) {
  const q = Math.floor((2 * Math.abs(s) + d) / (2 * d));
  return s < 0 ? -q : q;
}

/** 16200 → "16 200" (U+202F). Years are never passed here. */
export function group(n) {
  const s = String(Math.abs(Math.trunc(n)));
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i && (s.length - i) % 3 === 0) out += NNBSP;
    out += s[i];
  }
  return (n < 0 ? MINUS : '') + out;
}

const signOf = (n) => (n > 0 ? '+' : n < 0 ? MINUS : '');
/** An integer number of tenths → "+3.4", "−0.4", "0.0". */
export function tenths(t) {
  const a = Math.abs(t);
  return `${signOf(t)}${Math.floor(a / 10)}.${a % 10}`;
}
/** An integer number of hundredths → "+1.19", "−0.05", "0.00". */
export function hundredths(h) {
  const a = Math.abs(h);
  return `${signOf(h)}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}
/** The SI spacing (DESIGN §2) on text the app did not write (the snapshot's credit lines): a number
 *  and °C, km or % joined by U+202F, as the app's own text already is (review R-5). */
export const si = (t) => String(t).replace(/(\d) (°C|km|%)/g, `$1${NNBSP}$2`);
/** A temperature from integer tenths: a minus when below zero, never a plus ("14.9", "−4.5"). */
export const temp = (t) => tenths(t).replace(/^\+/, '');
/** A temperature in whole degrees, half away from zero ("−2", "27"). */
export const whole = (t) => { const d = roundDiv(t, 10); return d < 0 ? `${MINUS}${-d}` : String(d); };
/** °C appended with U+202F. */
export const degC = (s) => `${s}${NNBSP}°C`;
/** A snapshot's two-decimal °C figure (GISS's global mean) → its integer hundredths. */
export const toHundredths = (v) => Math.round(v * 100);

/** A coverage share with 4 decimals (0.9922) → a whole percentage "99 %" (from ten-thousandths). */
export function percent(share, decimals = 0) {
  const k = Math.round(share * 10000);                   // exact: the file holds 4 decimals
  const one = (t) => `${Math.floor(t / 10)}.${t % 10}${NNBSP}%`;
  if (decimals === 1) return one(roundDiv(k, 10));
  const whole = roundDiv(k, 100);
  // never "100 %" while a cell is missing, nor "0 %" while one has data: one decimal, toward the truth
  if (whole === 100 && k < 10000) return one(Math.floor(k / 10));
  if (whole === 0 && k > 0) return one(Math.ceil(k / 10));
  return `${whole}${NNBSP}%`;
}

/** "2026-07" → "Jul 2026" (short) or "July 2026" (long). */
export function monthName(ym, long = false) {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  return `${(long ? MONTH : MON)[+m[2] - 1]} ${m[1]}`;
}

/** A cell's bounds as the card writes them (CONTRACT Builder's decision 19): "64–66° N, 148–146° W". */
export function cellBounds(row, col) {
  const n = 90 - 2 * row, s = 88 - 2 * row, w = -180 + 2 * col, e = -178 + 2 * col;
  const lat = s >= 0 ? `${s}${NDASH}${n}° N` : `${-n}${NDASH}${-s}° S`;
  const lon = e <= 0 ? `${-w}${NDASH}${-e}° W` : `${w}${NDASH}${e}° E`;
  return `${lat}, ${lon}`;
}
