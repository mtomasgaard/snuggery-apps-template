// The seismic on the section (js/seismic.js) measured, as plan 0012 D11 asks, in Node with no dependencies.
// Every figure is worked out here from data/seismic.json and data/seismic.bin as data/ATTRIBUTION.txt
// describes them, or from a synthetic cube built here on the same grid; the app's functions are run, never
// trusted to check themselves.
//
//   node tools/test_seismic_display.mjs
//
//  1. zero kept at code 128: the decode, a trace of 128s through every row plan, and a whole section of
//     128s drawn, all exactly zero (the ramp's middle color, every pixel); the ramps symmetric about zero;
//  2. the interpolation's response on a known trace (the real cube's trace nearest the field's middle):
//     at the samples' own depths it returns the samples exactly; between them it is compared with the
//     trace's own band-limited (Fourier) interpolation; the fractional-delay kernel's amplitude response at
//     half a sample, across the band; laterally, a point midway between two traces is their mean;
//  3. the aliasing test on a dipping event: a synthetic cube holding one band-limited event dipping 30°,
//     drawn along a line oblique to the survey with rows twice as far apart as the samples, against the
//     same drawn by picking the nearest trace and sample: the energy off the event's true dip, in the
//     section's 2-D spectrum;
//  4. both data sets at their original depths: a spike at a sample's depth is drawn with its peak at that
//     depth, whatever the rows' spacing and phase (no shift anywhere in the depth path); the trace grid's
//     map points equal seismic.json's corners less the model's center (no shift laterally).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from '../js/seismic.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const meta = JSON.parse(fs.readFileSync(path.join(APP, 'data/seismic.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(APP, 'data/model.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'config.json'), 'utf8'));
const bytes = new Uint8Array(fs.readFileSync(path.join(APP, 'data', meta.file)));
const g = S.grid(meta, model.center);
const db = (x) => 10 * Math.log10(Math.max(x, 1e-30));

// 1. zero at code 128
{
  const allZero = new Uint8Array(g.nu * g.nv * g.nz).fill(128);
  const plans = [1, 2.5, 5, 7.3, 13].map((step) => S.rowPlan(g, Array.from({ length: 80 }, (_, r) => g.z0 + 100 + r * step + 0.37), step));
  let worst = 0;
  for (const rp of plans) { const out = S.traceRows(g, allZero, 5000, rp, new Float32Array(80)); for (const v of out) worst = Math.max(worst, Math.abs(v)); }
  const cols = 120, rows = 90, ln = S.surveyLine(g, 'inline', 10174);
  const cp = S.colPlan(g, cols, (c) => [[ln.a[0] + (ln.b[0] - ln.a[0]) * (c + 0.5) / cols, ln.a[1] + (ln.b[1] - ln.a[1]) * (c + 0.5) / cols]]);
  const rp = S.rowPlan(g, Array.from({ length: rows }, (_, r) => 2600 + r * 9), 9);
  let notZero = 0;
  for (const stops of [cfg.colormaps.seismicGray, cfg.colormaps.seismicRedBlue, cfg.colormapsDark.seismicGray, cfg.colormapsDark.seismicRedBlue]) {
    const lut = S.ramp(stops), { px } = S.render(g, allZero, cp, rp, lut, 4, cols, rows);
    for (let i = 0; i < cols * rows; i++) if (px[i * 4 + 3] && (px[i * 4] !== lut[255 * 4] || px[i * 4 + 1] !== lut[255 * 4 + 1] || px[i * 4 + 2] !== lut[255 * 4 + 2])) notZero++;
  }
  ok(S.amp(g, 128) === 0 && meta.amplitude.zeroCode === 128 && worst === 0 && notZero === 0,
    `zero at code 128: decode(128) = ${S.amp(g, 128)}; a trace of 128s through 5 row plans (rows 1 to 13 m apart) gives ${worst} at worst; a section of 128s drawn in all four ramps at gain ×4: ${notZero} pixels other than the ramp's zero color`);
  let sum = 0; for (const c of bytes) sum += c;
  ok(Math.abs(sum / bytes.length - 128.017) < 0.001, `the cube's mean code is ${(sum / bytes.length).toFixed(4)} (seismic.json's pipeline measured 128.017): the decode's zero is the data's middle`);
  const symm = [cfg.colormaps.seismicGray, cfg.colormaps.seismicRedBlue].every((st) => st.length % 2 === 1 && st.length === 21);
  ok(symm, 'each ramp has 21 stops over -1..1 of the clip, the 11th at zero (tools/art/palette.py checks their lightness symmetric about it)');
}

// 2. the interpolation's response on a known trace
{
  const u0 = Math.round(S.uvOf(g, 0, 0)[0]), v0 = Math.round(S.uvOf(g, 0, 0)[1]), t = u0 * g.nv + v0;
  const trace = Array.from(bytes.subarray(t * g.nz, (t + 1) * g.nz), (c) => c - 128);
  const at = (depths, step) => S.traceRows(g, bytes, t, S.rowPlan(g, depths, step), new Float32Array(depths.length));
  const exact = at(trace.map((_, k) => S.depthOf(g, k)), g.dz);
  const e0 = Math.max(...trace.map((v, k) => Math.abs(exact[k] - v)));
  ok(e0 < 1e-4, `at the samples' own depths the windowed sinc returns trace IL ${S.ilAt(g, u0)} XL ${S.xlAt(g, v0)}'s ${g.nz} samples exactly (worst ${e0.toExponential(1)} codes)`);
  // the trace's own band-limited interpolation at half a sample: its Fourier series, the mean and a linear
  // trend removed first so the ends join; compared in the middle 80 %, away from where the window runs out
  const n = g.nz, mean = trace.reduce((a, b) => a + b, 0) / n, slope = (trace[n - 1] - trace[0]) / (n - 1);
  const d = trace.map((v, k) => v - mean - slope * (k - (n - 1) / 2));
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let f = 0; f < n; f++) for (let k = 0; k < n; k++) { const a = -2 * Math.PI * f * k / n; re[f] += d[k] * Math.cos(a); im[f] += d[k] * Math.sin(a); }
  const fourier = (x) => { let s = re[0] / n; for (let f = 1; f < n / 2; f++) { const a = 2 * Math.PI * f * x / n; s += 2 * (re[f] * Math.cos(a) - im[f] * Math.sin(a)) / n; } return s + mean + slope * (x - (n - 1) / 2); };
  const mids = []; for (let k = Math.round(n * 0.1); k < n * 0.9; k++) mids.push(k + 0.5);
  const got = at(mids.map((x) => g.z0 + x * g.dz), g.dz);
  let se = 0, ss = 0; mids.forEach((x, i) => { const w = fourier(x); se += (got[i] - w) ** 2; ss += w * w; });
  ok(10 * Math.log10(se / ss) < -30, `between the samples (half a sample off, ${mids.length} depths) the sinc differs from the trace's own band-limited interpolation by ${(10 * Math.log10(se / ss)).toFixed(1)} dB of its energy (linear interpolation: ${(() => { let e = 0; mids.forEach((x) => { const k = Math.floor(x), l = (trace[k] + trace[k + 1]) / 2, w = fourier(x); e += (l - w) ** 2; }); return (10 * Math.log10(e / ss)).toFixed(1); })()} dB)`);
  // the kernel's response at a half-sample delay, for wavelengths of 4 to 20 samples' worth (20 to 100 m)
  const resp = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4].map((f) => {
    let c = 0, s = 0; for (let k = -10; k <= 10; k++) { const w = S.sincWeight(k - 0.5, 1); c += w * Math.cos(2 * Math.PI * f * (k - 0.5)); s += w * Math.sin(2 * Math.PI * f * (k - 0.5)); }
    let sum = 0; for (let k = -10; k <= 10; k++) sum += S.sincWeight(k - 0.5, 1);
    return [f, 20 * Math.log10(Math.hypot(c, s) / sum)];
  });
  ok(resp.filter(([f]) => f <= 0.35).every(([, r]) => Math.abs(r) < 0.1), `the depth kernel at half a sample: ${resp.map(([f, r]) => `${f} cycles a sample (${Math.round(g.dz / f)} m) ${r.toFixed(3)} dB`).join(', ')}; flat within 0.1 dB to 0.35 cycles a sample (wavelengths of 14 m and more)`);
  // laterally: a point midway between two neighbor traces on an inline is their mean, and on a trace it is the trace
  const p = S.xyOf(g, u0, v0 + 0.5), cp = S.colPlan(g, 1, () => [p]), q = S.colPlan(g, 1, () => [S.xyOf(g, u0, v0)]);
  const mid = cp.taps[0].map(([tt, w]) => [tt, Math.round(w * 1e9) / 1e9]).sort((a, b) => a[0] - b[0]);
  ok(JSON.stringify(mid) === JSON.stringify([[t, 0.5], [t + 1, 0.5]]) && q.taps[0].length === 1 && q.taps[0][0][0] === t && q.taps[0][0][1] === 1,
    `laterally bilinear: midway along an inline the weights are ${JSON.stringify(mid)} (the two traces' mean); on a trace, that trace alone (${JSON.stringify(q.taps[0])})`);
}

// 3. the aliasing test on a dipping event
{
  // a cube on the real grid holding one Ricker event (peak wavelength 50 m in depth) dipping 20° toward
  // azimuth 50°, oblique to both survey axes, quantized exactly as the pipeline quantizes (clip 1). It is an
  // event the delivered 25 m traces can carry (the pipeline's anti-alias filter passes 62.5 m and longer
  // across the survey; this one's lateral wavelengths are longer than that wherever it holds more than a
  // thousandth of its energy), so whatever lies off its dip in the drawing is the drawing's own aliasing.
  const peak = 1 / 50, dip = Math.tan(20 * Math.PI / 180), az = 50 * Math.PI / 180, dx = Math.sin(az), dy = Math.cos(az), zc = g.z0 + 0.5 * (g.nz - 1) * g.dz;
  const ricker = (z) => { const a = (Math.PI * peak * z) ** 2; return (1 - 2 * a) * Math.exp(-a); };
  const syn = new Uint8Array(g.nu * g.nv * g.nz);
  for (let u = 0; u < g.nu; u++) for (let v = 0; v < g.nv; v++) {
    const [x, y] = S.xyOf(g, u, v), z0 = zc + (x * dx + y * dy) * dip, base = (u * g.nv + v) * g.nz;
    for (let k = 0; k < g.nz; k++) syn[base + k] = 128 + Math.round(127 * 0.9 * ricker(g.z0 + k * g.dz - z0));
  }
  const gs = { ...g, clip: 1 };
  // a line through the middle along the dip, 2 km, drawn 256 columns by 112 rows: columns 7.8 m apart,
  // rows 15 m apart (three times the samples' spacing: the depth is resampled down by three, below the
  // event's band, as a short pane does)
  const L = 2000, cols = 256, rows = 112, a = [-dx * L / 2, -dy * L / 2], step = 15;
  const pts = (c) => [[a[0] + dx * L * (c + 0.5) / cols, a[1] + dy * L * (c + 0.5) / cols]];
  const depths = Array.from({ length: rows }, (_, r) => zc - (rows / 2) * step + (r + 0.5) * step);
  const ours = S.amplitudes(gs, syn, S.colPlan(gs, cols, pts), S.rowPlan(gs, depths, step), cols, rows);
  // the same with the rows at the samples' own 5 m (only the lateral interpolation acting), and the event
  // itself evaluated exactly at each pixel's point and depth (no lateral error, but sampled with no low-pass)
  const depths5 = depths.map((z, r) => zc - (rows / 2) * 5 + (r + 0.5) * 5);
  const ours5 = S.amplitudes(gs, syn, S.colPlan(gs, cols, pts), S.rowPlan(gs, depths5, 5), cols, rows);
  const exact = new Float32Array(cols * rows);
  for (let c = 0; c < cols; c++) { const [[x, y]] = pts(c); for (let r = 0; r < rows; r++) exact[r * cols + c] = 0.9 * ricker(depths[r] - zc - (x * dx + y * dy) * dip); }
  // the naive drawing: the nearest trace, the nearest sample
  const naive = new Float32Array(cols * rows);
  for (let c = 0; c < cols; c++) {
    const [[x, y]] = pts(c), [u, v] = S.uvOf(g, x, y), t = Math.round(u) * g.nv + Math.round(v);
    for (let r = 0; r < rows; r++) naive[r * cols + c] = (syn[t * g.nz + Math.round((depths[r] - g.z0) / g.dz)] - 128) / 127;
  }
  // the energy off the event's dip in the section's 2-D spectrum (Hann-windowed): a plane event
  // f(row - p column), p its slope in rows per column, has its spectrum along (ks, kz) = (-p, 1) t; a wedge
  // of 3 bins either side of that line holds its energy, and anything outside it is energy at a dip the event has not
  const offDip = (img, rowStep) => {
    const slope = dip * (L / cols) / rowStep;   // rows per column
    const re = new Float64Array(cols * rows), im = new Float64Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) re[r * cols + c] = img[r * cols + c] * (0.5 - 0.5 * Math.cos(2 * Math.PI * (c + 0.5) / cols)) * (0.5 - 0.5 * Math.cos(2 * Math.PI * (r + 0.5) / rows));
    const dft = (n, getr, geti, setv) => { const tr = new Float64Array(n), ti = new Float64Array(n); for (let f = 0; f < n; f++) { let sr = 0, si = 0; for (let k = 0; k < n; k++) { const ang = -2 * Math.PI * f * k / n, cr = Math.cos(ang), cs = Math.sin(ang), xr = getr(k), xi = geti(k); sr += xr * cr - xi * cs; si += xr * cs + xi * cr; } tr[f] = sr; ti[f] = si; } for (let f = 0; f < n; f++) setv(f, tr[f], ti[f]); };
    for (let r = 0; r < rows; r++) dft(cols, (k) => re[r * cols + k], (k) => im[r * cols + k], (f, a1, b1) => { re[r * cols + f] = a1; im[r * cols + f] = b1; });
    for (let c = 0; c < cols; c++) dft(rows, (k) => re[k * cols + c], (k) => im[k * cols + c], (f, a1, b1) => { re[f * cols + c] = a1; im[f * cols + c] = b1; });
    let on = 0, off = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const e = re[r * cols + c] ** 2 + im[r * cols + c] ** 2;
      // distance from the event's line in bins, (c', r') = t (-p cols, rows): within 3 bins (the window's
      // main lobe and a little) is the event; beyond, a dip the event has not
      const cb = c < cols / 2 ? c : c - cols, rb = r < rows / 2 ? r : r - rows, dist = Math.abs(cb * rows + rb * slope * cols) / Math.hypot(slope * cols, rows);
      if (dist <= 3) on += e; else off += e;
    }
    return db(off / (on + off));
  };
  const o = offDip(ours, step), o5 = offDip(ours5, 5), nv = offDip(naive, step), ex = offDip(exact, step);
  ok(o <= -20 && o <= nv - 10 && o <= ex - 6 && o - o5 <= 3,
    `a 20° dipping event drawn along a line oblique to the survey with the rows three times the samples' spacing: ${o.toFixed(1)} dB of its energy off its true dip. Of that, ${o5.toFixed(1)} dB is there with the rows at the samples' own spacing: the bilinear blend between traces whose event sits 9 m apart in depth, the cost D11's bilinear carries, not aliasing; resampling the depth to the coarser rows, band-limited, adds ${(o - o5 >= 0 ? '+' : '') + (o - o5).toFixed(1)} dB. Drawn without the band limit (the event exact at each pixel, point-sampled): ${ex.toFixed(1)} dB, aliased; the nearest trace and nearest sample: ${nv.toFixed(1)} dB`);
}

// 4. original depths: no shift anywhere
{
  const spike = new Uint8Array(g.nu * g.nv * g.nz).fill(128), t = 70 * g.nv + 90, k = 141;
  spike[t * g.nz + k] = 255;
  const want = S.depthOf(g, k);
  let worst = 0; const seen = [];
  for (const [step, phase] of [[1, 0], [1, 0.37], [2.5, 0.11], [0.7, 0.5]]) {
    const depths = Array.from({ length: 200 }, (_, r) => want - 100 * step + (r + phase) * step);
    const v = S.traceRows(g, spike, t, S.rowPlan(g, depths, step), new Float32Array(200));
    let m = 0; for (let r = 1; r < 199; r++) if (v[r] > v[m]) m = r;
    const den = v[m - 1] - 2 * v[m] + v[m + 1], at = depths[m] + (den ? 0.5 * (v[m - 1] - v[m + 1]) / den : 0) * step;
    worst = Math.max(worst, Math.abs(at - want)); seen.push(`${step} m rows at phase ${phase}: ${at.toFixed(2)} m`);
  }
  ok(worst < 0.05, `a spike at sample ${k} (${want} m below sea level) peaks at its own depth whatever the rows: ${seen.join(', ')} (worst ${worst.toFixed(3)} m)`);
  const off = meta.corners.map((c) => { const [x, y] = S.xyOf(g, S.uOfIl(g, c.il), S.vOfXl(g, c.xl)); return Math.hypot(x + model.center[0] - c.x, y + model.center[1] - c.y); });
  ok(Math.max(...off) < 0.01 && S.depthOf(g, 0) === meta.z.first && g.dz === meta.z.step, `the traces' map points are seismic.json's own grid less the model's center: its four corners within ${Math.max(...off).toFixed(4)} m; the first sample at ${S.depthOf(g, 0)} m and ${g.dz} m apart, as delivered`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
