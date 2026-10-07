// The data, decoded: pure functions with no DOM and no WebGL, so tools/test_decode.mjs can run them
// in Node against its own decode of the same files (data/ATTRIBUTION.txt gives the formats).
//
// D is the decoded model: { model, cfg, NA, ijk (Uint8Array, I J K per cell, 0-based),
// static ({ PORO, PERMX, PERMZ, NTG, FIPNUM, DEPTH } Float32Array views), dyn (ArrayBuffer of every
// report date's frame) }. Volve's deck names no formations, so nothing here groups layers; its eleven
// fluid-in-place regions (FIPNUM) are lateral blocks through every layer, and the app shows them as
// they are numbered.

/** A cell's fluid-in-place region, from 1 (FIPNUM as the deck numbers it). */
export const regionOf = (D, a) => Math.round(D.static.FIPNUM[a]);
/** How many regions the deck has: FIPNUM's largest value. */
export const regionCount = (D) => Math.round(D.model.static.ranges.FIPNUM[1]);

/** One report date's frame: water and gas saturation bytes, and pressure as 16-bit steps. */
export function frameViews(D, f) {
  const NA = D.NA, base = f * D.model.dynamic.frameBytes;
  return { sw: new Uint8Array(D.dyn, base, NA), sg: new Uint8Array(D.dyn, base + NA, NA), p: new Uint16Array(D.dyn, base + 2 * NA, NA) };
}

/** Every cell's value of a property at report date f, into out (a Float32Array of NA). */
export function fillValues(D, key, f, out) {
  const NA = D.NA, ijk = D.ijk;
  if (D.static[key]) { out.set(D.static[key]); return out; }
  if (key === 'LAYER') { for (let a = 0; a < NA; a++) out[a] = ijk[a * 3 + 2] + 1; return out; }
  if (key === 'REGION') { for (let a = 0; a < NA; a++) out[a] = regionOf(D, a); return out; }
  const { sw, sg, p } = frameViews(D, f);
  if (key === 'SWAT') for (let a = 0; a < NA; a++) out[a] = sw[a] / 255;
  else if (key === 'SGAS') for (let a = 0; a < NA; a++) out[a] = sg[a] / 255;
  else if (key === 'SOIL') for (let a = 0; a < NA; a++) out[a] = Math.max(0, 1 - (sw[a] + sg[a]) / 255);
  else if (key === 'PRESSURE') {
    const [p0, p1] = D.model.dynamic.pressureRange, k = (p1 - p0) / 65535;
    for (let a = 0; a < NA; a++) out[a] = p0 + p[a] * k;
  } else out.fill(NaN);
  return out;
}
/** One cell's value of a property at report date f. */
export function cellValue(D, key, f, a) {
  if (D.static[key]) return D.static[key][a];
  if (key === 'LAYER') return D.ijk[a * 3 + 2] + 1;
  if (key === 'REGION') return regionOf(D, a);
  const { sw, sg, p } = frameViews(D, f);
  if (key === 'SWAT') return sw[a] / 255;
  if (key === 'SGAS') return sg[a] / 255;
  if (key === 'SOIL') return Math.max(0, 1 - (sw[a] + sg[a]) / 255);
  if (key === 'PRESSURE') { const [p0, p1] = D.model.dynamic.pressureRange; return p0 + p[a] * (p1 - p0) / 65535; }
  return NaN;
}

/** A property's scale: config.json's fixed range, or the data's own where it says "auto". */
export function propRange(D, p) {
  if (p.type === 'category') return [1, p.key === 'REGION' ? regionCount(D) : 1];
  if (Array.isArray(p.range)) return p.range;
  if (p.key === 'PRESSURE') return D.model.dynamic.pressureRange;
  return D.model.static.ranges[p.key] || [0, 1];
}
/** Position on the scale, 0 to 1 inside it (log scales by decade). */
export function norm(p, r, v) {
  if (p.scale === 'log') {
    const a = Math.log10(Math.max(r[0], 1e-6)), b = Math.log10(r[1]);
    return (Math.log10(Math.max(v, 1e-6)) - a) / (b - a);
  }
  return (v - r[0]) / (r[1] - r[0]);
}
export function denorm(p, r, t) {
  if (p.scale === 'log') {
    const a = Math.log10(Math.max(r[0], 1e-6)), b = Math.log10(r[1]);
    return 10 ** (a + (b - a) * t);
  }
  return r[0] + (r[1] - r[0]) * t;
}

/** The highest gas saturation in any cell at any report date: one pass over the frames' bytes. */
export function gasMax(D) {
  let m = 0;
  for (let f = 0; f < D.model.frames.length; f++) { const { sg } = frameViews(D, f); for (let a = 0; a < D.NA; a++) if (sg[a] > m) m = sg[a]; }
  return m / 255;
}
/** Where the data goes past a scale's ends: { lo, hi } true for an end that must print open
 *  ("≤ 200", "≥ 450 bar"). Pressure from the 16-bit encoding's range (the run's own extremes), the
 *  static properties from model.json's ranges, gas from gasMax; saturations otherwise stay in 0 to 1. */
export function openEnds(D, p, gmax) {
  if (p.type === 'category' || !Array.isArray(p.range)) return { lo: false, hi: false };
  const [r0, r1] = p.range;
  let lo = null, hi = null;
  if (p.key === 'PRESSURE') [lo, hi] = D.model.dynamic.pressureRange;
  else if (p.key === 'SGAS') { lo = 0; hi = gmax; }
  else if (D.model.static.ranges[p.key]) [lo, hi] = D.model.static.ranges[p.key];
  else if (p.key === 'LAYER') { lo = 1; hi = D.model.NK; }
  else { lo = 0; hi = 1; }
  return { lo: lo < r0 - 1e-9, hi: hi > r1 + 1e-9 };
}

/** The Cut's series (ART.md section 1): per report date f, the field's liquid over the interval to that
 *  date (from date f - 1 to date f, which is how pipeline/extract.py averages the rates), oil and water
 *  in Sm³ a day, their sum, the water share, and the interval's first and last day. */
export function cutSeries(model, dayNumber) {
  const fr = model.frames, F = model.summary.field, days = fr.map(dayNumber);
  return fr.map((iso, f) => {
    const oil = F.oil[f] || 0, water = F.water[f] || 0, liquid = oil + water;
    return { f, iso, oil, water, liquid, share: liquid > 0 ? water / liquid : 0, d0: f ? days[f - 1] : days[0], d1: days[f] };
  });
}
/** The figures a stranger remembers: the interval of the peak, the first interval in which water passes
 *  oil, and in how many of the intervals from there on it stays above. */
export function cutFacts(series) {
  let peak = series[0];
  for (const s of series) if (s.liquid > peak.liquid) peak = s;
  const cross = series.find((s) => s.f > 0 && s.water > s.oil) || null;
  const after = cross ? series.filter((s) => s.f >= cross.f) : [];
  return { peak, cross, stays: after.filter((s) => s.water > s.oil).length, of: after.length, last: series[series.length - 1] };
}

/** The report dates' spacing, read from the dates themselves, never assumed: the days of each interval
 *  (from the date before; none before the first), the first interval, the most common length and the
 *  range of the rest, the word for it ('month' or 'quarter' where the common length is one, else null),
 *  and about how many dates make a year. Volve's run is reported quarterly (86 to 100 days) after an
 *  11-day first step. */
export function periods(frames, dayNumber) {
  const d = frames.map(dayNumber), days = d.map((v, i) => (i ? v - d[i - 1] : 0)), iv = days.slice(1), rest = iv.length > 1 ? iv.slice(1) : iv;
  const sorted = [...iv].sort((a, b) => a - b), typical = sorted.length ? sorted[sorted.length >> 1] : 0;
  const word = typical >= 28 && typical <= 31 ? 'month' : typical >= 85 && typical <= 100 ? 'quarter' : null;
  return { days, first: iv[0] || 0, typical, min: rest.length ? Math.min(...rest) : 0, max: rest.length ? Math.max(...rest) : 0, word, perYear: typical ? Math.max(1, Math.round(365.25 / typical)) : 1 };
}
