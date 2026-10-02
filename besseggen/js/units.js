// Every number, unit, date and time Besseggen writes (HOUSE.md section 6). Pure: runs in Node.
// SI: the true minus U+2212, U+202F between a number and its unit and in thousands, 24-hour clock,
// day before month, Norwegian time from js/sun.js's rule, never the phone's zone or locale.

export const MINUS = '−';
export const NN = ' ';
const MONS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WINDS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const pad2 = (n) => String(n).padStart(2, '0');

/** "16380" to "16 380"; four digits and more are grouped. */
export const group = (s) => (s.length > 3 ? s.replace(/\B(?=(\d{3})+$)/g, NN) : s);
/** d decimals, the true minus, never "−0". */
export function fixed(v, d = 0) {
  if (!Number.isFinite(v)) return '–';
  const s = Math.abs(v).toFixed(d), [i, f] = s.split('.');
  return (v < 0 && Number(s) !== 0 ? MINUS : '') + group(i) + (f ? `.${f}` : '');
}
export const int = (v) => fixed(Math.round(v));
export const unit = (s, u) => `${s}${NN}${u}`;
/** A height or a short length: "1 741 m". */
export const m = (v) => unit(int(v), 'm');
/** "999 m", "5.03 km", "13.7 km". */
export const dist = (v) => (Math.abs(v) < 1000 ? m(v) : unit(fixed(v / 1000, Math.abs(v) < 10000 ? 2 : 1), 'km'));
export const distSpoken = (v) => (Math.abs(v) < 1000 ? `${int(v)} meters` : `${fixed(v / 1000, 2)} kilometers`);
export const deg = (v, d = 1) => `${fixed(v, d)}°`;
export const pct = (v) => unit(int(v), '%');
/** A signed height difference: "+12 m", "−40 m". */
export const signed = (v) => (Math.round(v) > 0 ? '+' : '') + m(v);
/** A span of hours: "4 h 33 min", "15 h", "38 min", never broken across a line. */
export function hm(h, spoken) {
  const t = Math.round(h * 60), a = Math.floor(t / 60), b = t % 60;
  const p = [a && (spoken ? `${a} hour${a > 1 ? 's' : ''}` : unit(a, 'h')), (b || !a) && (spoken ? `${b} minute${b === 1 ? '' : 's'}` : unit(b, 'min'))];
  return p.filter(Boolean).join(spoken ? ' ' : NN);
}
/** Minutes past local midnight: "07:05". */
export function clock(min) {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`;
}
export const span = (a, b) => `${clock(a)} to ${clock(b)}`;
/** "14 Jun", "14 Jun 2026"; spoken "14 June", "14 June 2026". */
export const date = (y, mo, d, withYear, spoken) => `${d} ${spoken ? MONS[mo - 1] : MONS[mo - 1].slice(0, 3)}${withYear ? ` ${y}` : ''}`;
/** "2026-09-22" to "22 Sep 2026". */
export const iso = (s) => { const [y, mo, d] = String(s).split('-').map(Number); return d ? date(y, mo, d, true) : String(s); };
export const zone = (off) => (off === 2 ? 'CEST' : 'CET');
export const zoneSpoken = (off) => `Central European${off === 2 ? ' Summer' : ''} Time`;
/** A compass point, "ENE", or in words, "east-northeast". */
export function wind(az, spoken) {
  const w = WINDS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
  if (!spoken) return w;
  const word = { N: 'north', E: 'east', S: 'south', W: 'west' };
  const parts = [...w].map((c) => word[c]);
  return w.length === 3 ? `${parts[0]}-${parts[1]}${parts[2]}` : parts.join('');
}
/** Degrees and decimal minutes, as a Norwegian paper map is gridded: "61° 29.665′ N, 8° 48.789′ E". */
export function pos(lon, lat) {
  const one = (v, p, n) => { const a = Math.abs(v), d = Math.floor(a); return `${d}° ${((a - d) * 60).toFixed(3)}′${NN}${v >= 0 ? p : n}`; };
  return `${one(lat, 'N', 'S')}, ${one(lon, 'E', 'W')}`;
}
