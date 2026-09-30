// The curves strip (DESIGN §3.5): three 28 px sparklines on the slider's own axis — the climate
// model's global mean temperature, carbon dioxide (Foster's LOESS fit with its 68 % band; the climate
// model's CO₂ input, dashed, where the fit has no value) and sea level relative to today (van der
// Meer's AVG with the band between the lower and the higher of MIN and MAX, CONTRACT §8). A line in
// the ink colour marks the current map. Drawn only when the map, the units, the theme or the size
// changes. The values printed are the manifest's tiles, so the strip and the sheet never disagree.

import { axisX } from './timeline.js';
import * as U from './units.js';
import { cssVar } from './util.js';

const ROW = 28, LAST_MA = 540;
const SANS = 'Atkinson, -apple-system, system-ui, sans-serif';

export function createCurves(canvas, manifest, curves) {
  const ctx = canvas.getContext('2d');
  const S = curves.series, axis = manifest.axis;
  let W = 1, H = 3 * ROW, dpr = 1;

  const lower = (a, b) => a.map((v, i) => (v == null || b[i] == null ? null : Math.min(v, b[i])));
  const upper = (a, b) => a.map((v, i) => (v == null || b[i] == null ? null : Math.max(v, b[i])));
  // The CO₂ model input is drawn where the fit is null, from the fit's last grid point on.
  const lastFit = S.co2_ppm.values.reduce((m, v, i) => (v != null ? i : m), -1);
  const modelTail = S.co2_model_ppm.values.map((v, i) => (i >= lastFit ? v : null));
  const rows = [
    { name: 'Temp', colour: '--c-temp', values: S.temperature_c.values, log: false },
    { name: 'CO₂', colour: '--c-co2', values: S.co2_ppm.values, lo: S.co2_ppm.lo68, hi: S.co2_ppm.hi68, dashed: modelTail, log: true },
    { name: 'Sea', colour: '--c-sea', values: S.sea_level_m.values, lo: lower(S.sea_level_m.min, S.sea_level_m.max), hi: upper(S.sea_level_m.min, S.sea_level_m.max), log: false },
  ];
  // Each row's vertical range: every value it draws (units only relabel, so the shape is fixed).
  for (const r of rows) {
    const all = [r.values, r.lo, r.hi, r.dashed].filter(Boolean).flat().filter((v) => v != null && (!r.log || v > 0));
    const f = r.log ? Math.log : (v) => v;
    r.min = f(Math.min(...all)); r.max = f(Math.max(...all)); r.f = f;
  }

  function resize(w, h, d) {
    W = Math.max(1, w); H = Math.max(1, h); dpr = d;
    const cw = Math.round(W * d), ch = Math.round(H * d);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  }

  const xOf = (a) => axisX(a, axis) * W;
  function yOf(r, i, v) {
    const top = i * ROW + 4, bottom = i * ROW + ROW - 3;                 // the label sits over the top, haloed
    return bottom - ((r.f(v) - r.min) / (r.max - r.min || 1)) * (bottom - top);
  }
  function runs(arrs) {
    const out = [];
    let cur = null;
    for (let a = 0; a < arrs[0].length; a++) {
      if (arrs.every((x) => x[a] != null)) { if (!cur) out.push(cur = []); cur.push(a); } else cur = null;
    }
    return out;
  }

  function label(stop) {
    const t = manifest.slices[stop].tiles;
    const temp = t.temperature ? `Temp ${U.temperature(t.temperature.c, 1)}` : 'Temp: no data';
    const co2 = t.co2 ? `CO₂ ${U.fmt(t.co2.ppm)} ppm${t.co2.kind === 'model_input' ? ', model input' : ''}` : 'CO₂: no data';
    const sea = t.sea_level ? `Sea ${U.seaLevel(t.sea_level.m)}` : 'Sea: no data';
    return [temp, co2, sea];
  }

  function draw(stop) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ink = cssVar('--ink'), ink2 = cssVar('--ink-2'), bg = cssVar('--bg'), line = cssVar('--line');
    const x540 = xOf(LAST_MA);

    // The stretch with no curves: a light hatch, labelled once.
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, x540, H); ctx.clip();
    ctx.strokeStyle = line; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -H; x < x540 + H; x += 4) { ctx.moveTo(x, H); ctx.lineTo(x + H, 0); }
    ctx.stroke();
    ctx.restore();
    ctx.font = `9.5px ${SANS}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ['no curves', 'before', '540 Ma'].forEach((s, k) => halo(s, x540 / 2, H / 2 - 11 + 11 * k, ink2, bg, 4));

    rows.forEach((r, i) => {
      const col = cssVar(r.colour) || ink;
      if (i > 0) { ctx.fillStyle = line; ctx.fillRect(x540, i * ROW, W - x540, 1); }
      if (r.lo) {
        ctx.fillStyle = col; ctx.globalAlpha = 0.18;
        for (const run of runs([r.lo, r.hi])) {
          ctx.beginPath();
          run.forEach((a, k) => { const x = xOf(a), y = yOf(r, i, r.hi[a]); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          for (let k = run.length - 1; k >= 0; k--) ctx.lineTo(xOf(run[k]), yOf(r, i, r.lo[run[k]]));
          ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      for (const [arr, dash] of [[r.values, []], [r.dashed, [3, 2.5]]]) {
        if (!arr) continue;
        ctx.setLineDash(dash);
        for (const run of runs([arr])) {
          ctx.beginPath();
          run.forEach((a, k) => { const x = xOf(a), y = yOf(r, i, arr[a]); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    });

    // The current map, across all three rows: a hairline, and on each curve a small glowing dot
    // where the drawn line crosses it (the curve's own 1-Myr point; no dot where it has none).
    const s = manifest.slices[stop], xm = Math.round(xOf(s.age_ma)) + 0.5;
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xm, 0); ctx.lineTo(xm, H); ctx.stroke();
    ctx.globalAlpha = 1;
    const a = Math.round(s.age_ma);
    rows.forEach((r, i) => {
      const v = r.values[a] != null ? r.values[a] : (r.dashed && r.dashed[a] != null ? r.dashed[a] : null);
      if (v == null) return;
      const col = cssVar(r.colour) || ink, x = xOf(a), y = yOf(r, i, v);
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 2 * Math.PI);
      ctx.fillStyle = col; ctx.fill();
      ctx.restore();
      ctx.lineWidth = 1.2; ctx.strokeStyle = bg; ctx.stroke();
    });

    // Each row's name and the value at this map, at the top left of the drawn part.
    ctx.font = `700 10.5px ${SANS}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    label(stop).forEach((text, i) => {
      const w = ctx.measureText(text).width, x = x540 + 4, y = i * ROW + 1;
      ctx.globalAlpha = 0.86; ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w + 6, 13, 3) : ctx.rect(x, y, w + 6, 13); ctx.fill();
      ctx.globalAlpha = 1; ctx.fillStyle = ink; ctx.fillText(text, x + 3, y + 10.5);
    });
  }
  function halo(text, x, y, fill, stroke, w) {
    ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }

  return { resize, draw, label };
}
