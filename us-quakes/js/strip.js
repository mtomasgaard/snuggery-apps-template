// The record strip (ART.md "The signature control"), 56 px: label 0–10, plot 12–44, baseline 44, axis
// 47–56, a 22 px gutter. Live: a stem per earthquake by magnitude against time, ink by size, heads from
// M 4.5, the hatched tail since the feed, and the hit test. History: a bar per year at the floor, the stub
// before 1900, the window's bracket and the thumb.

import { cssVar, hatch, lowerBound, clamp, mono } from './util.js';
import { drawDot, dotSize } from './ramp.js';
import { num, msOf, minOfYMD, MONTHS, age, depthKm } from './units.js';

const TOP = 12, BASE = 44, GUT = 22;
const MONO = mono(10);
export const STUB = 25, STUB_GAP = 5;

// Live
export function liveGeom(w, t0, t1, ageMin) {
  let tail = 0;
  if (ageMin > 0) tail = clamp(((ageMin / (t1 - t0)) * (w - GUT)) / (1 + ageMin / (t1 - t0)), 6, w * 0.25);
  const pw = w - GUT - tail;
  return { tail, pw, X: (t) => GUT + ((t - t0) / (t1 - t0)) * pw };
}

export function drawLive(x, w, L) {
  const { C, t0, t1, floor, win, ageMs, dpr } = L;
  x.clearRect(0, 0, w, 56);
  const ageMin = ageMs / 60000, g = liveGeom(w, t0, t1, ageMin), X = g.X;
  const lo = lowerBound(C.t, t0), hi = lowerBound(C.t, L.cut != null ? Math.min(t1, L.cut) : t1);
  let big = -1;
  for (let i = lo; i < hi; i++) { const m = C.m[i]; if (m !== 255 && m >= floor && (big < 0 || m >= C.m[big])) big = i; }
  const mBot = floor === 0 ? -1 : 2.5, mTop = Math.max(6, big >= 0 ? Math.ceil((C.m[big] - 20) / 10) : 6);
  const Y = (M) => BASE - ((clamp(M, mBot, mTop) - mBot) / (mTop - mBot)) * (BASE - TOP);
  const rule = cssVar('--rule'), ink = cssVar('--ink'), ink2 = cssVar('--ink-2');
  x.strokeStyle = rule; x.lineWidth = 1;
  const step = win === 'day' ? 60 : 1440, first = Math.ceil(t0 / step) * step, labels = [];
  for (let t = first, k = 0; t < t1; t += step, k++) {
    const d = new Date(msOf(t)), full = win === 'day' ? d.getUTCHours() % 6 === 0 : win === 'week' || (k % 7 === 0);
    const xx = Math.round(X(t)) + 0.5;
    x.globalAlpha = full ? 1 : 0.45; x.beginPath(); x.moveTo(xx, TOP - 2); x.lineTo(xx, BASE); x.stroke();
    if (full) labels.push([xx, win === 'day' ? String(d.getUTCHours()).padStart(2, '0') : (labels.length && d.getUTCDate() !== 1 ? String(d.getUTCDate()) : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`)]);
  }
  x.globalAlpha = 1; x.setLineDash([1, 2]);
  const every = (BASE - TOP) / (mTop - mBot) >= 4 ? 1 : 2;
  for (let M = Math.ceil(mBot); M <= mTop; M += every) { const yy = Math.round(Y(M)) + 0.5; x.beginPath(); x.moveTo(GUT, yy); x.lineTo(GUT + g.pw, yy); x.stroke(); }
  x.setLineDash([]);
  x.strokeStyle = ink; x.beginPath(); x.moveTo(GUT, BASE + 0.5); x.lineTo(GUT + g.pw, BASE + 0.5); x.stroke();
  x.lineWidth = 1 / dpr;
  const heads = [];
  let n = 0;
  for (const [a, lo2, hi2] of [[0.28, 0, 45], [0.45, 45, 60], [1, 60, 255]]) {
    x.globalAlpha = a; x.beginPath();
    for (let i = lo; i < hi; i++) {
      const m = C.m[i];
      if (m === 255 || m < floor || m < lo2 || m >= hi2) continue;
      n++;
      const xx = Math.round(X(C.t[i]) * dpr) / dpr + 0.5 / dpr;
      x.moveTo(xx, BASE); x.lineTo(xx, Y((m - 20) / 10));
      if (m >= 65) heads.push(i);
    }
    x.stroke();
  }
  x.globalAlpha = 1; x.lineWidth = 1;
  // the pen: the opening's cursor, or the selected stem (a 1 px ink line the height of the plot band); its nib
  // starts 2 px below the ticks' tops, clear of the count label's baseline, and under the label's words it
  // drops to the plot band, clear of their descenders too (the label's glyphs end at 9.8 px)
  const pen = L.cursor ? L.cut : L.sel != null && C.t[L.sel] >= t0 && C.t[L.sel] < t1 && C.m[L.sel] !== 255 && C.m[L.sel] >= floor ? C.t[L.sel] : null;
  if (pen != null) {
    const px = Math.round(X(pen)) + 0.5;
    x.font = MONO;
    const n0 = px > w - x.measureText(L.countText).width - 5 ? TOP : TOP - 3;
    x.strokeStyle = x.fillStyle = ink; x.beginPath(); x.moveTo(px, TOP); x.lineTo(px, BASE); x.stroke();
    if (!L.cursor) { x.beginPath(); x.moveTo(px - 3, n0); x.lineTo(px + 3, n0); x.lineTo(px, n0 + 4); x.closePath(); x.fill(); }
  }
  heads.sort((a, b) => C.m[a] - C.m[b]);
  for (const i of heads) {
    const M = (C.m[i] - 20) / 10;
    drawDot(x, X(C.t[i]), Y(M), dotSize(Math.min(M, 5.5)) * 0.8, depthKm(C.d[i]), (C.f[i] & 3) === 1 && C.t[i] >= C.liveFrom, dpr);
  }
  x.font = MONO; x.textBaseline = 'middle';
  if (big >= 0) {
    const bx = X(C.t[big]), s = `M ${num((C.m[big] - 20) / 10, 1)}`, tw = x.measureText(s).width;
    x.fillStyle = ink; x.textAlign = bx + 7 + tw > GUT + g.pw ? 'right' : 'left';
    x.fillText(s, x.textAlign === 'right' ? bx - 6 : bx + 6, Math.max(TOP + 5, Y((C.m[big] - 20) / 10)));
  }
  x.fillStyle = ink2; x.textBaseline = 'bottom'; x.textAlign = 'left';
  for (const M of floor === 0 ? [2, 6] : [4, 6]) if (M <= mTop) x.fillText(`M ${M}`, 0, Y(M) + 4);
  x.textBaseline = 'top';
  x.textAlign = 'right'; x.fillText(L.countText, w, 0);
  x.textAlign = 'left';
  let last = -99;
  const tailText = g.tail > 0 ? age(ageMs) : '', right = w - (tailText ? x.measureText(tailText).width + 6 : 0);
  for (const [xx, s] of labels) {
    const tw = x.measureText(s).width;
    if (xx - last > 26 && xx - 3 + tw < right) { x.fillText(s, xx - (last < 0 ? 0 : 3), BASE + 3); last = xx; }
  }
  if (tailText) {
    hatch(x, GUT + g.pw, TOP - 2, g.tail, BASE - TOP + 2, cssVar('--hatch'));
    x.textAlign = 'right'; x.fillText(tailText, w, BASE + 3);
  }
  return { n, big };
}

export function hitLive(px, w, L) {
  const { C, t0, t1, floor, ageMs } = L, g = liveGeom(w, t0, t1, ageMs / 60000);
  const tA = t0 + ((px - 12 - GUT) / g.pw) * (t1 - t0), tB = t0 + ((px + 12 - GUT) / g.pw) * (t1 - t0);
  let best = -1, bd = 99;
  for (let i = lowerBound(C.t, Math.max(t0, tA)), e = lowerBound(C.t, Math.min(t1, tB + 1)); i < e; i++) {
    const m = C.m[i];
    if (m === 255 || m < floor) continue;
    const d = Math.abs(g.X(C.t[i]) - px);
    if (d > 12) continue;
    if (best < 0 || d < bd - 3 || (Math.abs(d - bd) <= 3 && m > C.m[best])) { best = i; bd = d; }
  }
  return best;
}

// History
export function histGeom(w, now) {
  const a = minOfYMD(1900), x0 = STUB + STUB_GAP, pw = w - x0 - 6;
  return { x0, pw, X: (t) => (t < a ? (Math.max(0, t - minOfYMD(1600)) / (a - minOfYMD(1600))) * STUB : x0 + ((t - a) / (now - a)) * pw),
    T: (px) => (px < x0 - STUB_GAP / 2 ? minOfYMD(1600) + (px / STUB) * (a - minOfYMD(1600)) : a + ((px - x0) / pw) * (now - a)) };
}

export function drawHist(x, w, S) {
  const { I, floorIx, t0, t1, now, played, gap, stubCount } = S;
  x.clearRect(0, 0, w, 56);
  const g = histGeom(w, now), X = g.X, ink = cssVar('--ink'), ink2 = cssVar('--ink-2'), hc = cssVar('--hatch');
  const counts = I.years[floorIx], nY = counts.length;
  let max = 1, maxY = 1900;
  for (let k = 0; k < nY; k++) if (counts[k] > max) { max = counts[k]; maxY = 1900 + k; }
  hatch(x, 0, TOP + 12, STUB, BASE - TOP - 12, hc, 3);
  x.strokeStyle = ink; x.lineWidth = 1;
  x.beginPath(); x.moveTo(0, BASE + 0.5); x.lineTo(STUB, BASE + 0.5); x.moveTo(g.x0, BASE + 0.5); x.lineTo(w, BASE + 0.5);
  x.moveTo(STUB - 1, BASE + 4); x.lineTo(STUB + 2, BASE - 3); x.moveTo(STUB + 2, BASE + 4); x.lineTo(STUB + 5, BASE - 3); x.stroke();
  const wa = X(t0), wb = Math.max(X(t1), wa + 1);
  x.fillStyle = ink; x.globalAlpha = 0.07; x.fillRect(wa, TOP - 4, wb - wa, BASE - TOP + 4); x.globalAlpha = 1;
  const nowYear = new Date(msOf(now)).getUTCFullYear();
  for (let k = 0; k < nY; k++) {
    const ys = I.yearStart[k], ye = I.yearStart[k + 1];
    const bx = X(ys), bw = Math.max(0.6, X(Math.min(ye, now)) - bx - 0.6), h = (counts[k] / max) * (BASE - TOP);
    if (!h) continue;
    const inWin = ye > t0 && ys < t1, wasPlayed = played && ys >= played[0] && ys < played[1];
    if (1900 + k === nowYear && ye > now) { hatch(x, bx, BASE - h, bw, h, ink, 2); continue; }
    x.globalAlpha = inWin ? 1 : wasPlayed ? 0.7 : 0.42;
    x.fillRect(bx, BASE - h, bw, h);
  }
  x.globalAlpha = 1;
  if (gap) hatch(x, X(gap.from), TOP, Math.max(2, X(gap.to) - X(gap.from)), BASE - TOP, hc, 3);
  const a = Math.round(wa - 1) + 0.5, b = Math.round(wb + 1) - 0.5;
  x.strokeStyle = ink; x.lineWidth = 1; x.beginPath();
  x.moveTo(a + 3, TOP - 4.5); x.lineTo(a, TOP - 4.5); x.lineTo(a, BASE); x.moveTo(b - 3, TOP - 4.5); x.lineTo(b, TOP - 4.5); x.lineTo(b, BASE); x.stroke();
  x.beginPath(); x.arc((wa + wb) / 2, BASE + 0.5, 6, 0, 7); x.fillStyle = cssVar('--panel'); x.fill(); x.lineWidth = 2; x.stroke();
  x.font = MONO; x.fillStyle = ink2; x.textBaseline = 'top'; x.textAlign = 'left';
  x.fillText(`max ${num(max)} · ${maxY}`, g.x0, 0);
  x.textAlign = 'center'; x.fillText(stubCount, STUB / 2, TOP + 1);
  x.textAlign = 'left'; x.fillText('1900', g.x0, BASE + 5);
  x.textAlign = 'center';
  for (const yy of [1950, 2000]) if (X(minOfYMD(yy)) < w - 40) x.fillText(String(yy), X(minOfYMD(yy)), BASE + 5);
  x.textAlign = 'right'; x.fillText(String(nowYear), w, BASE + 5);
  return { max, maxY };
}
