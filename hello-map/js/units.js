// Every number, unit and coordinate Hello Map writes (HOUSE.md section 6). Pure: runs in Node.
// SI first: meters and kilometers, with feet and miles one tap away on the units key. The true minus
// U+2212, U+202F between a number and its unit and in thousands, a point for the decimal mark, and a
// coordinate's hemisphere after U+202F: "37.7459° N, 119.5936° W".

export const MINUS = '−';
export const NN = ' ';

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
/** A count of things: "1 tile", "14 tiles". */
export const count = (n, one, many) => `${int(n)} ${n === 1 ? one : many}`;

// ── lengths ─────────────────────────────────────────────────────────────────────────────────────
export const FOOT = 0.3048;            // meters, exactly (the international foot)
export const MILE = 1609.344;          // meters, exactly

/** The two systems the units key cycles, SI first. */
export const SYSTEMS = ['si', 'us'];
export const systemKey = (sys) => (sys === 'us' ? 'mi' : 'km');
export const systemSpoken = (sys) => (sys === 'us' ? 'miles and feet' : 'kilometers and meters');

/** The scale bar's length: the longest 1, 2 or 5 times a power of ten that fits in maxM meters,
 *  in the system's own unit. Returns { meters, label, spoken }. */
export function scaleLength(maxM, sys) {
  const nice = (v) => { const p = 10 ** Math.floor(Math.log10(v)); let n = p; for (const k of [1, 2, 5]) if (k * p <= v) n = k * p; return n; };
  if (sys === 'us') {
    const miles = maxM / MILE;
    if (miles >= 1) { const n = nice(miles); return { meters: n * MILE, label: unit(int(n), 'mi'), spoken: `${int(n)} mile${n === 1 ? '' : 's'}` }; }
    const n = nice(maxM / FOOT);
    return { meters: n * FOOT, label: unit(int(n), 'ft'), spoken: `${int(n)} feet` };
  }
  const n = nice(maxM);
  return n >= 1000
    ? { meters: n, label: unit(int(n / 1000), 'km'), spoken: `${int(n / 1000)} kilometer${n === 1000 ? '' : 's'}` }
    : { meters: n, label: unit(int(n), 'm'), spoken: `${int(n)} meters` };
}

/** A length in the chosen system: "840 m", "2.4 km", "2 750 ft", "1.7 mi". */
export function length(m, sys) {
  if (sys === 'us') {
    const ft = m / FOOT;
    return ft < 5280 ? unit(int(ft), 'ft') : unit(fixed(m / MILE, m / MILE < 10 ? 1 : 0), 'mi');
  }
  return m < 1000 ? unit(int(m), 'm') : unit(fixed(m / 1000, m < 10000 ? 1 : 0), 'km');
}

// ── coordinates ─────────────────────────────────────────────────────────────────────────────────
const hemi = (v, p, n) => (v >= 0 ? p : n);
/** Decimal degrees, four places (about 11 m): "37.7459° N, 119.5936° W". */
export function coords(lon, lat) {
  return `${fixed(Math.abs(lat), 4)}°${NN}${hemi(lat, 'N', 'S')}, ${fixed(Math.abs(lon), 4)}°${NN}${hemi(lon, 'E', 'W')}`;
}
/** Degrees and decimal minutes, as a USGS quadrangle's collar counts them: "37° 44.754′ N". */
export function dm(v, p, n) {
  const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
  const ms = m.toFixed(3);
  return ms === '60.000' ? `${d + 1}° 0.000′${NN}${hemi(v, p, n)}` : `${d}° ${ms}′${NN}${hemi(v, p, n)}`;
}
export const dmPair = (lon, lat) => `${dm(lat, 'N', 'S')}, ${dm(lon, 'E', 'W')}`;
/** The same in words, for VoiceOver: "37.7459 degrees north, 119.5936 degrees west". */
export function coordsSpoken(lon, lat) {
  return `${fixed(Math.abs(lat), 4)} degrees ${hemi(lat, 'north', 'south')}, ${fixed(Math.abs(lon), 4)} degrees ${hemi(lon, 'east', 'west')}`;
}

/** A tick's label on the collar, for a grid whose step is stepSec seconds of arc: whole degrees
 *  "38° N", minutes "37° 45′ N" or "37° 52.5′ N", seconds "37° 44′ 30″ N". v is in degrees and
 *  sits on the grid, so it is rounded to the step before it is written. */
export function tick(v, stepSec, p, n) {
  const totalSec = Math.round(Math.abs(v) * 3600 / stepSec) * stepSec;
  const d = Math.floor(totalSec / 3600), rem = totalSec - d * 3600;
  const h = v === 0 || totalSec === 0 ? '' : `${NN}${hemi(v, p, n)}`;
  if (stepSec % 3600 === 0 || rem === 0) return `${d}°${h}`;
  if (stepSec % 60 === 0 || stepSec % 30 === 0 && stepSec >= 60) {
    const m = rem / 60;
    return `${d}° ${Number.isInteger(m) ? m : m.toFixed(1)}′${h}`;
  }
  const m = Math.floor(rem / 60), s = rem - m * 60;
  return `${d}° ${m}′ ${s}″${h}`;
}
/** The grid's step in words for the caption: "2.5′", "15″", "1°". */
export function stepWords(stepSec) {
  if (stepSec % 3600 === 0) return `${stepSec / 3600}°`;
  if (stepSec >= 60) { const m = stepSec / 60; return `${Number.isInteger(m) ? m : m.toFixed(1)}′`; }
  return `${stepSec}″`;
}
/** The same, spoken: "2.5 minutes", "15 seconds", "1 degree". */
export function stepSpoken(stepSec) {
  if (stepSec % 3600 === 0) { const d = stepSec / 3600; return `${d} degree${d === 1 ? '' : 's'}`; }
  if (stepSec >= 60) { const m = stepSec / 60; return `${Number.isInteger(m) ? m : m.toFixed(1)} minute${m === 1 ? '' : 's'}`; }
  return `${stepSec} second${stepSec === 1 ? '' : 's'}`;
}
/** A latitude for the scale's note: "true at 37.7° N". */
export const lat1 = (lat) => `${fixed(Math.abs(lat), 1)}°${NN}${hemi(lat, 'N', 'S')}`;
