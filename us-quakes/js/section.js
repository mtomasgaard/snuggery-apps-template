// The A–A′ section (DESIGN §9): great-circle maths in float64 (xt = asin(p·n)·R, at = atan2((a × p′)·n,
// p′·a)·R), the corridor with its ticks and ends on #over, the events inside it (found through the grid,
// tested on the sphere) and the true-scale distance–depth plot with the ramp as its axis. The shader
// repeats the corridor test in float32.

import { sizeCanvas, cssVar, clamp, mono } from './util.js';
import { drawDot, dotSize, depthColor } from './ramp.js';
import { num, lenUnit, magText, yearOf, depthKm, dist } from './units.js';
import { inBox } from './events.js';
import { tab } from './overlay.js';

export const R_KM = 6371.0088;
const rad = Math.PI / 180;
export const unit = (lon, lat) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function sectionOf(A, B, half = 50) {
  const a = unit(...A), b = unit(...B), c = cross(a, b), l = Math.hypot(...c), n = c.map((v) => v / l);
  return { a, n, t: cross(n, a), len: Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * R_KM, half };
}
export function track(sec, lon, lat) {
  const p = unit(lon, lat), pn = dot(p, sec.n);
  const q = [p[0] - pn * sec.n[0], p[1] - pn * sec.n[1], p[2] - pn * sec.n[2]];
  return [Math.atan2(dot(cross(sec.a, q), sec.n), dot(q, sec.a)) * R_KM, Math.asin(Math.max(-1, Math.min(1, pn))) * R_KM];
}
export function pointAt(S, al, h = 0) {
  const c = Math.cos(al / R_KM), s = Math.sin(al / R_KM), ch = Math.cos(h / R_KM), sh = Math.sin(h / R_KM);
  const p = [0, 1, 2].map((k) => (c * S.a[k] + s * S.t[k]) * ch + S.n[k] * sh);
  return [(Math.atan2(p[1], p[0]) / rad + 360) % 360, Math.asin(clamp(p[2], -1, 1)) / rad];
}

export function drawCorridor(x, M, S) {
  const ink = cssVar('--ink'), sc = (al, h) => M.toScreen(...pointAt(S, al, h));
  const [ax, ay] = sc(0, 0), [bx, by] = sc(S.len, 0), N = clamp(Math.round(Math.hypot(bx - ax, by - ay) / 5), 8, 256);
  const edge = (h) => { const o = []; for (let k = 0; k <= N; k++) o.push(sc((S.len * k) / N, h)); return o; };
  const L = edge(-S.half), R = edge(S.half), C = edge(0);
  const path = (P, move = true) => P.forEach((p, k) => (k || !move ? x.lineTo(...p) : x.moveTo(...p)));
  x.save(); x.strokeStyle = x.fillStyle = ink; x.lineJoin = 'round';
  x.beginPath(); path(L); path(R.slice().reverse(), false); x.closePath(); x.globalAlpha = 0.06; x.fill();
  x.globalAlpha = 1; x.lineWidth = 0.75; x.beginPath(); path(L); path(R);
  for (let d = 50; d < S.len; d += 50) {
    const p = sc(d, -S.half), q = sc(d, S.half), dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, k = Math.min(5, l / 4) / l;
    x.moveTo(...p); x.lineTo(p[0] + dx * k, p[1] + dy * k); x.moveTo(...q); x.lineTo(q[0] - dx * k, q[1] - dy * k);
  }
  x.stroke(); x.lineWidth = 1; x.beginPath(); path(C); x.stroke();
  x.font = mono(11); x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const [p, q, s] of [[C[0], C[1], 'A'], [C[N], C[N - 1], 'A′']]) {
    x.beginPath(); x.arc(p[0], p[1], 9, 0, 7); x.fillStyle = cssVar('--panel'); x.fill(); x.lineWidth = 1.5; x.stroke();
    const dx = p[0] - q[0], dy = p[1] - q[1], l = Math.hypot(dx, dy) || 1, cx = p[0] + (dx / l) * 24, cy = p[1] + (dy / l) * 24, w = x.measureText(s).width + 8;
    tab(x, cx - w / 2, cy - 8, w, 16, s); x.strokeStyle = ink;
  }
  x.restore();
  return [[ax, ay], [bx, by]];
}

export function sectionRows(A, S) {
  const C = A.C, rows = [];
  let l0 = 999, l1 = -999, a0 = 99, a1 = -99, j = 0, k10 = 0, deep = 0;
  for (let k = 0; k <= 32; k++) for (const h of [-S.half, S.half]) {
    const [lo, la] = pointAt(S, (S.len * k) / 32, h);
    l0 = Math.min(l0, lo); l1 = Math.max(l1, lo); a0 = Math.min(a0, la); a1 = Math.max(a1, la);
  }
  inBox(A.I, A.F, l0 - 0.2, a0 - 0.2, l1 + 0.2, a1 + 0.2, (i) => {
    if (C.m[i] === 255) return;
    const [al, xt] = track(S, 172 + 0.002 * C.x[i], 17 + 0.001 * C.y[i]);
    if (Math.abs(xt) > S.half || al < 0 || al > S.len) return;
    if (C.d[i] === 65535) { j++; return; }
    if (C.d[i] === 1500) k10++;
    deep = Math.max(deep, depthKm(C.d[i]));
    rows.push([i, al]);
  });
  rows.sort((p, q) => C.m[p[0]] - C.m[q[0]]);
  return { rows, n: rows.length + j, j, k10, deep };
}

export function drawPlot(cv, A, S, D, w, hi) {
  const C = A.C, dpr = A.dpr, [perU, unitName] = lenUnit(), ve = S.ve || 1;
  const Lm = 36, Tm = 16, dmax = Math.max(50, Math.ceil(D.deep / 50) * 50);
  let kpp = S.len / (w - Lm - 10), h = (dmax * ve) / kpp;
  if (h > 320) { kpp = (dmax * ve) / 320; h = 320; }
  const pw = S.len / kpp, H = Math.ceil(Tm + h + 8), x = sizeCanvas(cv, w, H, dpr);
  const X = (al) => Lm + al / kpp, Y = (km) => Tm + (km * ve) / kpp;
  const ink = cssVar('--ink'), ink2 = cssVar('--ink-2'), bg = cssVar('--bg');
  x.fillStyle = bg; x.fillRect(0, 0, w, H);
  x.strokeStyle = cssVar('--rule'); x.lineWidth = 1; x.setLineDash([1, 2]); x.beginPath();
  for (const d of [35, 70, 150]) if (d < dmax) { x.moveTo(Lm, Math.round(Y(d)) + 0.5); x.lineTo(Lm + pw, Math.round(Y(d)) + 0.5); }
  x.stroke(); x.setLineDash([4, 3]); x.strokeStyle = cssVar('--ink-3'); x.beginPath(); x.moveTo(Lm, Math.round(Y(10)) + 0.5); x.lineTo(Lm + pw, Math.round(Y(10)) + 0.5); x.stroke();
  x.setLineDash([]); x.strokeStyle = ink; x.beginPath(); x.moveTo(Lm, Tm + 0.5); x.lineTo(Lm + pw, Tm + 0.5); x.stroke();
  for (let yy = Tm; yy < Y(dmax); yy++) { x.fillStyle = depthColor(((yy - Tm) * kpp) / ve); x.fillRect(Lm - 8, yy, 5, 1); }
  x.font = mono(10); x.fillStyle = ink2; x.textBaseline = 'middle'; x.textAlign = 'right';
  let last = -99;
  for (const d of [0, 10, 35, 70, 150, 300, dmax]) if (d <= dmax && Y(d) - last >= 11) { x.fillText(num(d / perU), Lm - 11, Math.min(H - 5, Y(d))); last = Y(d); }
  x.textBaseline = 'top'; x.textAlign = 'left'; x.fillText(unitName, 0, 0);
  x.textAlign = 'center';
  for (let u = 100; u * perU < S.len; u += 100) if (X(u * perU) > Lm + 18 && X(u * perU) < Lm + pw - 18) x.fillText(num(u), X(u * perU), 2);
  x.fillStyle = ink; x.font = mono(11);
  x.fillText('A', Lm, 1); x.fillText('A′', Lm + pw, 1);
  const pts = [];
  for (const [i, al] of D.rows) {
    const km = depthKm(C.d[i]), px = X(al), py = Y(km);
    drawDot(x, px, py, 0.6 * dotSize((C.m[i] - 20) / 10), km, A.hollow(i), dpr, 0.3);
    pts.push([i, px, py]);
  }
  const hp = hi != null && pts.find((p) => p[0] === hi);
  if (hp) {
    const [i, px, py] = hp, r = 0.3 * dotSize((C.m[i] - 20) / 10) + 4, left = D.rows.filter((q) => q[1] < S.len / 2).length;
    const dir = left * 2 < D.rows.length ? -1 : 1, s = `M ${magText(C.m[i])} · ${yearOf(C.t[i])} · ${dist(depthKm(C.d[i]), 1)}`;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.lineWidth = 3.5; x.strokeStyle = bg; x.stroke(); x.lineWidth = 1.5; x.strokeStyle = ink; x.stroke();
    x.font = mono(10); x.textBaseline = 'middle'; x.textAlign = dir < 0 ? 'right' : 'left';
    const tw = x.measureText(s).width, tx = clamp(px + dir * 44, Lm + tw + 4, w - tw - 4), ty = clamp(py + 22, Tm + 8, H - 8);
    x.lineWidth = 1; x.beginPath(); x.moveTo(px + dir * r * 0.7, py + r * 0.7); x.lineTo(tx - dir * 3, ty); x.stroke();
    x.lineWidth = 3; x.strokeStyle = bg; x.lineJoin = 'round'; x.strokeText(s, tx, ty); x.fillStyle = ink; x.fillText(s, tx, ty);
  }
  if (ve > 1) { x.font = mono(10); x.textAlign = 'right'; x.textBaseline = 'bottom'; x.fillStyle = ink; x.fillText(`Depth stretched ${ve}×`, Lm + pw, H - 2); }
  return { pts, dmax, kpp };
}
