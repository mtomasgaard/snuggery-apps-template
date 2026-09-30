// The map (DESIGN §4): Web Mercator over the 172° → 296° axis; X = (λ − 172)/360, Y = (m(72°) − m(φ))/2π;
// screen = (X − cx)·s + w/2. It owns the view, its clamp to the basemap and fits, eased moves and the fling,
// the gestures (pan, pinch, double-tap, long press, keys) and the scale bar. Pan and zoom are similarity
// transforms, so the 2D layers and the relief can be CSS-moved during a gesture.

import { clamp, ease, reducedMotion } from './util.js';
import { M72, wx, wy } from './data.js';
import { lenUnit, num } from './units.js';

export { wx, wy };
export const BOX_W = wx(296), BOX_H = wy(17);
export const S_MAX = 180000;
export const lonOf = (X) => 172 + X * 360;
export const latOf = (Y) => (2 * Math.atan(Math.exp(M72 - Y * 2 * Math.PI)) - Math.PI / 2) * 180 / Math.PI;
const R_KM = 6371.0088;

export function createMap(el, cb) {
  const M = { v: { cx: BOX_W / 2, cy: BOX_H / 2, s: 1000 }, w: 1, h: 1, ins: { top: 0, right: 0, bottom: 0 }, moving: false };
  const vis = () => ({ x0: 0, y0: M.ins.top, x1: M.w, y1: M.h - M.ins.bottom });
  M.sx = (X) => (X - M.v.cx) * M.v.s + M.w / 2;
  M.sy = (Y) => (Y - M.v.cy) * M.v.s + M.h / 2;
  M.X = (px) => M.v.cx + (px - M.w / 2) / M.v.s;
  M.Y = (py) => M.v.cy + (py - M.h / 2) / M.v.s;
  M.toScreen = (lon, lat) => [M.sx(wx(lon)), M.sy(wy(lat))];
  M.toLonLat = (px, py) => [lonOf(M.X(px)), latOf(M.Y(py))];
  M.visible = vis;
  M.sMin = () => { const r = vis(); return Math.min((r.x1 - r.x0) / BOX_W, (r.y1 - r.y0) / BOX_H) * 0.96; };
  // the map on screen (the whole panel above the sheet, the chips row included) stays inside the basemap
  // (geo.json.basemap, DESIGN §4.2); where the panel is wider or taller than the basemap it holds all of it,
  // and the paper past its edge is hatched (base.js). Until geo.json is read, the axis box stands in.
  let B = [0, 0, BOX_W, BOX_H];
  M.setBounds = (b) => { B = [wx(b.west), wy(b.north), wx(b.east), wy(b.south)]; M.v = M.clampV(M.v); };
  M.clampV = (v) => {
    const s = clamp(v.s, M.sMin(), S_MAX);
    const keep = (c, a0, a1, half, b0, b1) => { const lo = b0 - (a0 - half) / s, hi = b1 - (a1 - half) / s; return clamp(c, Math.min(lo, hi), Math.max(lo, hi)); };
    return { s, cx: keep(v.cx, 0, M.w, M.w / 2, B[0], B[2]), cy: keep(v.cy, 0, M.h - M.ins.bottom, M.h / 2, B[1], B[3]) };
  };
  M.set = (v) => { M.v = M.clampV(v); cb.onView(); };
  M.fitView = (b, pad = { top: 50, right: 60, bottom: 44, left: 16 }) => {
    const r = vis(), x0 = r.x0 + pad.left, x1 = r.x1 - pad.right, y0 = r.y0 + pad.top, y1 = r.y1 - pad.bottom;
    const X0 = wx(b.west), X1 = wx(b.east), Y0 = wy(b.north), Y1 = wy(b.south);
    const s = clamp(Math.min((x1 - x0) / (X1 - X0), (y1 - y0) / (Y1 - Y0)), M.sMin(), S_MAX);
    return M.clampV({ s, cx: (X0 + X1) / 2 - ((x0 + x1) / 2 - M.w / 2) / s, cy: (Y0 + Y1) / 2 - ((y0 + y1) / 2 - M.h / 2) / s });
  };
  // the center stays put; the app re-fits a marked region or keeps the place at the free map's center
  M.resize = (w, h, ins) => { M.w = w; M.h = h; M.ins = ins; M.v = M.clampV(M.v); };

  // eased moves and the fling, advanced by the app's frame loop
  let anim = null;
  M.flyTo = (to, ms = 450) => {
    to = M.clampV(to);
    if (reducedMotion() || ms <= 0) { anim = null; M.v = to; cb.onView(); cb.onSettle(); return; }
    anim = { kind: 'ease', from: { ...M.v }, to, t0: performance.now(), ms };
    M.moving = true; cb.onView();
  };
  M.stop = () => { if (anim) { anim = null; M.moving = false; cb.onSettle(); } };
  M.tick = (now) => {
    if (!anim) return false;
    if (anim.kind === 'ease') {
      const k = ease((now - anim.t0) / anim.ms), a = anim.from, b = anim.to;
      const ls = Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * k, s = Math.exp(ls);
      const f = a.s === b.s ? k : (1 - a.s / s) / (1 - a.s / b.s);
      M.v = { s, cx: a.cx + (b.cx - a.cx) * (Number.isFinite(f) ? f : k), cy: a.cy + (b.cy - a.cy) * (Number.isFinite(f) ? f : k) };
      if (k >= 1) { M.v = b; anim = null; }
    } else {
      const dt = Math.min(64, now - anim.last); anim.last = now;
      const d = 0.92 ** (dt / 16);
      anim.vx *= d; anim.vy *= d;
      M.v = M.clampV({ ...M.v, cx: M.v.cx - (anim.vx * dt) / M.v.s, cy: M.v.cy - (anim.vy * dt) / M.v.s });
      if (Math.hypot(anim.vx, anim.vy) < 0.02) anim = null;
    }
    cb.onView();
    if (!anim) { M.moving = false; cb.onSettle(); }
    return !!anim;
  };
  M.animating = () => !!anim;

  // gestures (DESIGN §4.3)
  const pts = new Map();
  let g = null, lastTap = null, longTimer = 0;
  const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const pinchBase = () => {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], v: { ...M.v } };
  };
  // times are the events' own (e.timeStamp), so a long frame before the handler runs never turns a tap
  // into a press
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    const p = pos(e);
    pts.set(e.pointerId, p);
    anim = null;
    if (pts.size === 1) {
      g = { start: p, t0: e.timeStamp, last: p, moved: false, hist: [[e.timeStamp, p[0], p[1]]], long: false };
      clearTimeout(longTimer);
      longTimer = setTimeout(() => { if (g && !g.moved && pts.size === 1) { g.long = true; cb.onLong(p[0], p[1]); } }, 500);
    } else if (pts.size === 2 && g) { g.moved = true; g.pinch = pinchBase(); clearTimeout(longTimer); M.moving = true; }
  });
  el.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !g) return;
    const p = pos(e);
    pts.set(e.pointerId, p);
    if (pts.size === 1) {
      if (!g.moved && Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) > 8) { g.moved = true; clearTimeout(longTimer); M.moving = true; }
      if (!g.moved || g.long) return;
      if (cb.onDrag && cb.onDrag(g, p)) return;
      M.v = M.clampV({ ...M.v, cx: M.v.cx - (p[0] - g.last[0]) / M.v.s, cy: M.v.cy - (p[1] - g.last[1]) / M.v.s });
      g.last = p;
      g.hist.push([e.timeStamp, p[0], p[1]]);
      if (g.hist.length > 6) g.hist.shift();
      cb.onView();
    } else if (pts.size === 2 && g.pinch) {
      const q = pinchBase(), b = g.pinch;
      const s = clamp(b.v.s * (q.d / b.d), M.sMin(), S_MAX);
      const X = b.v.cx + (b.c[0] - M.w / 2) / b.v.s, Y = b.v.cy + (b.c[1] - M.h / 2) / b.v.s;
      M.v = M.clampV({ s, cx: X - (q.c[0] - M.w / 2) / s, cy: Y - (q.c[1] - M.h / 2) / s });
      cb.onView();
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    const p = pts.get(e.pointerId);
    pts.delete(e.pointerId);
    clearTimeout(longTimer);
    if (!g) return;
    if (pts.size === 1) { g.pinch = null; g.last = [...pts.values()][0]; g.hist = []; return; }
    if (pts.size) return;
    const now = e.timeStamp, wasTap = !g.moved && !g.long && now - g.t0 < 300 && e.type === 'pointerup';
    const hist = g.hist, long = g.long; g = null;
    if (long) { if (cb.onLongEnd) cb.onLongEnd(); M.moving = false; return; }
    if (wasTap) {
      if (lastTap && now - lastTap.t < 300 && Math.hypot(p[0] - lastTap.p[0], p[1] - lastTap.p[1]) < 30) {
        lastTap = null;
        const X = M.X(p[0]), Y = M.Y(p[1]), s = Math.min(S_MAX, M.v.s * 2);
        M.flyTo({ s, cx: X - (p[0] - M.w / 2) / s, cy: Y - (p[1] - M.h / 2) / s }, 250);
        return;
      }
      lastTap = { t: now, p };
      cb.onTap(p[0], p[1]);
      return;
    }
    const h0 = hist.find((h) => now - h[0] < 100) || hist[0], h1 = hist[hist.length - 1];
    if (h0 && h1 && h1[0] > h0[0] && !reducedMotion() && now - h1[0] < 60) {
      const vx = (h1[1] - h0[1]) / (h1[0] - h0[0]), vy = (h1[2] - h0[2]) / (h1[0] - h0[0]);
      if (Math.hypot(vx, vy) > 0.05) { anim = { kind: 'fling', vx, vy, last: now }; cb.onView(); return; }
    }
    M.moving = false; cb.onSettle();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (e) => {
    const k = e.key, v = M.v, r = vis(), c = [M.w / 2, (r.y0 + r.y1) / 2];
    const pan = { ArrowLeft: [-64, 0], ArrowRight: [64, 0], ArrowUp: [0, -64], ArrowDown: [0, 64] }[k];
    if (pan) M.flyTo({ ...v, cx: v.cx + pan[0] / v.s, cy: v.cy + pan[1] / v.s }, 200);
    else if (k === '+' || k === '=' || k === '-') {
      const s = clamp(v.s * (k === '-' ? 0.5 : 2), M.sMin(), S_MAX), X = M.X(c[0]), Y = M.Y(c[1]);
      M.flyTo({ s, cx: X - (c[0] - M.w / 2) / s, cy: Y - (c[1] - M.h / 2) / s }, 250);
    } else if (k === 'Enter') cb.onTap(c[0], c[1], true);
    else return;
    e.preventDefault();
  });

  M.scale = () => {
    const r = vis(), lat = latOf(M.Y((r.y0 + r.y1) / 2));
    const [perUnit, unit] = lenUnit();
    const kmPerPx = (2 * Math.PI * R_KM * Math.cos((lat * Math.PI) / 180)) / M.v.s;
    const uPerPx = kmPerPx / perUnit;
    let best = 1;
    for (let e = -2; e < 6; e++) for (const k of [1, 2, 5]) { const L = k * 10 ** e; if (L / uPerPx <= 120) best = L; }
    return [best / uPerPx, `${num(best, best < 1 ? 1 : 0)} ${unit} · at ${Math.round(Math.abs(lat))}° ${lat < -0.5 ? 'S' : 'N'}`];
  };
  return M;
}
