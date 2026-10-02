// Every number and unit the app writes (ART.md section 4; HOUSE.md section 6). Pure: no DOM, so
// tools/test_decode.mjs runs it in Node against a table of its own.
// SI notation: U+202F between a number and its unit and between groups of thousands (from four
// digits), a point for the decimal mark, the true minus U+2212. Labels (C5), tooth numbers (36) and
// versions (3.0) are names, not quantities, and never pass through here.

export const NNBSP = ' ';
export const MINUS = '−';

/** "3448950" to "3 448 950" (U+202F); four digits and more are grouped. */
export function group(digits) {
  const s = String(digits);
  if (s.length < 4) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i && (s.length - i) % 3 === 0) out += NNBSP;
    out += s[i];
  }
  return out;
}
/** A number with d decimals: the true minus, never a negative zero, thousands grouped. */
export function fixed(v, d = 0) {
  if (!Number.isFinite(v)) return '';
  const s = Math.abs(v).toFixed(d);
  const [i, f] = s.split('.');
  const neg = v < 0 && Number(s) !== 0;
  return (neg ? MINUS : '') + group(i) + (f ? `.${f}` : '');
}
/** A whole count, grouped: 1752 to "1 752". */
export const int = (n) => fixed(Math.round(n), 0);
/** Number and unit joined by U+202F. */
export const withUnit = (s, unit) => `${s}${NNBSP}${unit}`;
/** A count with its noun: "1 structure", "1 752 structures". */
export const count = (n, one, many = `${one}s`) => `${int(n)} ${n === 1 ? one : many}`;
/** A share (0 to 1) as a whole percent: "45 %". */
export const pct = (share) => withUnit(int(share * 100), '%');
/** The same, spoken: "45 percent". */
export const pctSpoken = (share) => `${int(share * 100)} percent`;
/** A length in meters, two places: "1.68 m"; spoken "1.68 meters". */
export const meters = (m) => withUnit(fixed(m, 2), 'm');
export const metersSpoken = (m) => `${fixed(m, 2)} meters`;
/** Bytes as megabytes, a megabyte a million bytes: whole by default ("32 MB"), or d places. */
export const megabytes = (bytes, d = 0) => withUnit(fixed(bytes / 1e6, d), 'MB');
/** A loading count: "12 of 32 MB", "800 of 1 752". */
export const ofMB = (got, total) => `${fixed(got / 1e6, 0)} of ${megabytes(total)}`;
export const ofN = (n, total) => `${int(n)} of ${int(total)}`;
