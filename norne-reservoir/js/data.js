// The data, decoded: pure functions with no DOM and no WebGL, so tools/test_decode.mjs can run them
// in Node against its own decode of the same files (data/ATTRIBUTION.txt gives the formats).
//
// D is the decoded model: { model, cfg, NA, ijk (Uint8Array, I J K per cell, 0-based),
// static ({ PORO, PERMX, PERMZ, NTG, FIPNUM, DEPTH } Float32Array views), dyn (ArrayBuffer of every
// report date's frame), zoneOfK (Int8Array, formation index per 1-based K, -1 for none) }.

/** The formation index of each 1-based layer K, from config.json's zones. */
export function buildZones(zones, NK) {
  const z = new Int8Array(NK + 2).fill(-1);
  (zones || []).forEach((zone, zi) => { for (let k = zone.k[0]; k <= zone.k[1] && k <= NK; k++) z[k] = zi; });
  return z;
}
/** The fault segment of a cell, 0 to 3: the fluid-in-place regions are formation by segment, so
 *  FIPNUM 1, 5, 9 and 13 are segment 1, and so on (ART.md section 2, measured by ranges.py). */
export const segmentOf = (D, a) => ((Math.round(D.static.FIPNUM[a]) - 1) % 4 + 4) % 4;

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
  if (key === 'ZONE') { for (let a = 0; a < NA; a++) out[a] = D.zoneOfK[ijk[a * 3 + 2] + 1] + 1; return out; }
  if (key === 'SEGMENT') { for (let a = 0; a < NA; a++) out[a] = segmentOf(D, a) + 1; return out; }
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
  if (key === 'ZONE') return D.zoneOfK[D.ijk[a * 3 + 2] + 1] + 1;
  if (key === 'SEGMENT') return segmentOf(D, a) + 1;
  const { sw, sg, p } = frameViews(D, f);
  if (key === 'SWAT') return sw[a] / 255;
  if (key === 'SGAS') return sg[a] / 255;
  if (key === 'SOIL') return Math.max(0, 1 - (sw[a] + sg[a]) / 255);
  if (key === 'PRESSURE') { const [p0, p1] = D.model.dynamic.pressureRange; return p0 + p[a] * (p1 - p0) / 65535; }
  return NaN;
}

/** A property's scale: config.json's fixed range, or the data's own where it says "auto". */
export function propRange(D, p) {
  if (p.type === 'category') {
    if (p.key === 'ZONE') return [1, Math.max(1, (D.cfg.zones || []).length)];
    if (p.key === 'SEGMENT') return [1, 4];
    return [1, 1];
  }
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

/** The Cut's series (ART.md section 1): per report date f, the field's liquid in the month to that
 *  date (the interval from date f - 1 to date f, which is how pipeline/extract.py averages the rates),
 *  oil and water in Sm³ a day, their sum, the water share, and the interval's first and last day. */
export function cutSeries(model, dayNumber) {
  const fr = model.frames, F = model.summary.field, days = fr.map(dayNumber);
  return fr.map((iso, f) => {
    const oil = F.oil[f] || 0, water = F.water[f] || 0, liquid = oil + water;
    return { f, iso, oil, water, liquid, share: liquid > 0 ? water / liquid : 0, d0: f ? days[f - 1] : days[0], d1: days[f] };
  });
}
/** The figures a stranger remembers: the peak month, the first month water passes oil, and how many
 *  months from there on it stays above. */
export function cutFacts(series) {
  let peak = series[0];
  for (const s of series) if (s.liquid > peak.liquid) peak = s;
  const cross = series.find((s) => s.f > 0 && s.water > s.oil) || null;
  const after = cross ? series.filter((s) => s.f >= cross.f) : [];
  return { peak, cross, stays: after.filter((s) => s.water > s.oil).length, of: after.length, last: series[series.length - 1] };
}
