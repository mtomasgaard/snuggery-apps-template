// Forward and inverse orthographic and Mollweide (DESIGN §5.3, §6), the view state, and gestures.
//
// The maths is pure and runs in Node (tools/test_proj.mjs). Angles are radians in the maths and
// degrees in the view state (which is what localStorage keeps). A unit vector (x, y, z) has
// x → 0° N 0° E, y → 0° N 90° E, z → north pole (CONTRACT §0).

import { DEG, clamp, wrap180, wrapPi } from './util.js';

export const SQ2 = Math.SQRT2;
export const MOLL_K = (2 * SQ2) / Math.PI;       // x = K · Δλ · cos θ
export const ZOOM_MIN = 1, ZOOM_MAX = 3;

/* ── orthographic ── */
/** 3 × 3 view matrix: rows give X, Y, Z of a unit vector (DESIGN §6). */
export function orthoMatrix(lam0, phi0, out = new Float64Array(9)) {
  const sl = Math.sin(lam0), cl = Math.cos(lam0), sp = Math.sin(phi0), cp = Math.cos(phi0);
  out[0] = -sl;      out[1] = cl;       out[2] = 0;       // X = cos φ sin(λ − λ0)
  out[3] = -sp * cl; out[4] = -sp * sl; out[5] = cp;      // Y = cos φ0 sin φ − sin φ0 cos φ cos(λ − λ0)
  out[6] = cp * cl;  out[7] = cp * sl;  out[8] = sp;      // Z = sin φ0 sin φ + cos φ0 cos φ cos(λ − λ0)
  return out;
}
export function orthoForward(lam, phi, lam0, phi0) {
  const cph = Math.cos(phi), d = lam - lam0;
  return {
    X: cph * Math.sin(d),
    Y: Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * cph * Math.cos(d),
    Z: Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * cph * Math.cos(d),
  };
}
/** (X, Y) in globe radii → (λ, φ), or null outside the disc. λ wrapped into (−π, π]. */
export function orthoInverse(X, Y, lam0, phi0) {
  const r2 = X * X + Y * Y;
  if (r2 > 1) return null;
  const Z = Math.sqrt(1 - r2);
  const phi = Math.asin(clamp(Z * Math.sin(phi0) + Y * Math.cos(phi0), -1, 1));
  const lam = wrapPi(lam0 + Math.atan2(X, Z * Math.cos(phi0) - Y * Math.sin(phi0)));
  return { lam, phi };
}

/* ── Mollweide ── */
/** θ with 2θ + sin 2θ = π sin φ, by Newton from θ = φ (DESIGN §6). */
export function mollTheta(phi) {
  if (Math.abs(phi) > Math.PI / 2 - 1e-9) return Math.sign(phi) * Math.PI / 2;
  const target = Math.PI * Math.sin(phi);
  let th = phi;
  for (let k = 0; k < 10; k++) {
    const d = (2 * th + Math.sin(2 * th) - target) / (2 + 2 * Math.cos(2 * th));
    th -= d;
    if (Math.abs(d) < 1e-9) break;
  }
  return th;
}
export function mollForward(lam, phi, lam0) {
  const th = mollTheta(phi);
  return { x: MOLL_K * wrapPi(lam - lam0) * Math.cos(th), y: SQ2 * Math.sin(th) };
}
/** (x, y) in Mollweide units → (λ, φ), or null outside the ellipse (the shader's formulas, §5.3). */
export function mollInverse(x, y, lam0) {
  if ((x / (2 * SQ2)) ** 2 + (y / SQ2) ** 2 > 1) return null;
  const th = Math.asin(clamp(y / SQ2, -1, 1));
  const phi = Math.asin(clamp((2 * th + Math.sin(2 * th)) / Math.PI, -1, 1));
  const lam = wrapPi(lam0 + (Math.PI * x) / (2 * SQ2 * Math.max(Math.cos(th), 1e-6)));
  return { lam, phi };
}

/* ── unit vectors ── */
export function unitVec(lonDeg, latDeg, out = [0, 0, 0]) {
  const l = lonDeg * DEG, p = latDeg * DEG, c = Math.cos(p);
  out[0] = c * Math.cos(l); out[1] = c * Math.sin(l); out[2] = Math.sin(p);
  return out;
}
export function lonLatOf(v) {
  return [Math.atan2(v[1], v[0]) / DEG, Math.asin(clamp(v[2], -1, 1)) / DEG];
}

/* ── the view ── */
/**
 * The view state: which projection, the globe's centre and zoom, the map's central meridian,
 * vertical pan and zoom, and the panel size in CSS px. Globe: radius = 0.46 · min(W, H − 72) · zoom;
 * map: scale so the ellipse is 92 % of the width or fits the height, whichever is smaller (§5.3).
 * The Earth is seated between the controls: centred in the space from `top` (under the view and
 * layer controls) to H − `bottom` (above the lens chips and a two-line legend), so a legend or a
 * notice sits under the disc instead of on it; never lower than the panel's middle, and never so
 * high that the disc's top runs under the controls (DESIGN §19). `grow` scales the
 * globe for the opening, which runs small and grows into place.
 */
export function createView() {
  const v = {
    mode: 'globe',
    globe: { lon: defaultLon(), lat: 20, zoom: 1 },
    map: { lon0: 0, panY: 0, zoom: 1 },
    W: 1, H: 1, top: 44, bottom: 96, grow: 1,
    get cx() { return v.W / 2; },
    get cy() {
      const r0 = 0.46 * Math.max(40, Math.min(v.W, v.H - 72));
      return Math.min(v.H / 2, Math.max((v.top + v.H - v.bottom) / 2, v.top + r0));
    },
    radius() { return 0.46 * Math.max(40, Math.min(v.W, v.H - 72)) * v.globe.zoom * v.grow; },
    mapScale() { return Math.max(4, Math.min((0.92 * v.W) / (4 * SQ2), (0.92 * Math.max(40, v.H - 72)) / (2 * SQ2))) * v.map.zoom; },
    /** The centre longitude of whichever projection is showing. */
    centreLon() { return v.mode === 'globe' ? v.globe.lon : v.map.lon0; },
    setMode(m) {
      if (m === v.mode) return;
      // The view carries across: the globe's centre longitude becomes the map's central meridian and
      // back; latitude stays with the globe (DESIGN §3.2).
      if (m === 'map') v.map.lon0 = v.globe.lon; else v.globe.lon = v.map.lon0;
      v.mode = m;
      v.clamp();
    },
    clamp() {
      v.globe.lon = wrap180(v.globe.lon);
      v.globe.lat = clamp(v.globe.lat, -89.5, 89.5);
      v.globe.zoom = clamp(v.globe.zoom, ZOOM_MIN, ZOOM_MAX);
      v.map.lon0 = wrap180(v.map.lon0);
      v.map.zoom = clamp(v.map.zoom, ZOOM_MIN, ZOOM_MAX);
      const s = v.mapScale(), room = Math.max(0, SQ2 - (v.H / 2 - 8) / s);
      v.map.panY = clamp(v.map.panY, -room, room);
    },
    reset() {
      v.globe.lat = 20; v.globe.zoom = 1; v.globe.lon = defaultLon();
      v.map.lon0 = v.globe.lon; v.map.panY = 0; v.map.zoom = 1;
    },
    /** Move by a drag of (dx, dy) CSS px. */
    panBy(dx, dy) {
      if (v.mode === 'globe') {
        const per = 1 / v.radius() / DEG;                 // one CSS px at the disc centre = 1/radius rad
        v.globe.lon -= dx * per;
        v.globe.lat += dy * per;
      } else {
        const s = v.mapScale();
        v.map.lon0 -= (dx * Math.PI) / (2 * SQ2 * s) / DEG;
        v.map.panY += dy / s;
      }
      v.clamp();
    },
    /** Angular speed (rad/s) of a drag velocity in CSS px/s — the fling's stop test. */
    angularSpeed(vx, vy) {
      const r = v.mode === 'globe' ? v.radius() : (2 * SQ2 * v.mapScale()) / Math.PI;
      return Math.hypot(vx, vy) / r;
    },
    zoomBy(f) {
      const z = v.mode === 'globe' ? v.globe : v.map;
      z.zoom = clamp(z.zoom * f, ZOOM_MIN, ZOOM_MAX);
      v.clamp();
    },
    zoom() { return v.mode === 'globe' ? v.globe.zoom : v.map.zoom; },
    /** CSS px in the panel → [lonDeg, latDeg] or null off the Earth. */
    unproject(sx, sy) {
      if (v.mode === 'globe') {
        const r = v.radius(), g = orthoInverse((sx - v.cx) / r, (v.cy - sy) / r, v.globe.lon * DEG, v.globe.lat * DEG);
        return g && [g.lam / DEG, g.phi / DEG];
      }
      const s = v.mapScale(), g = mollInverse((sx - v.cx) / s, (v.cy - sy) / s + v.map.panY, v.map.lon0 * DEG);
      return g && [g.lam / DEG, g.phi / DEG];
    },
    /** [lonDeg, latDeg] → [sx, sy, visible]. */
    project(lon, lat) {
      if (v.mode === 'globe') {
        const r = v.radius(), f = orthoForward(lon * DEG, lat * DEG, v.globe.lon * DEG, v.globe.lat * DEG);
        return [v.cx + r * f.X, v.cy - r * f.Y, f.Z >= 0];
      }
      const s = v.mapScale(), f = mollForward(lon * DEG, lat * DEG, v.map.lon0 * DEG);
      return [v.cx + s * f.x, v.cy - s * (f.y - v.map.panY), true];
    },
    /** Turn so that (lon, lat) is at the centre. */
    centreOn(lon, lat) {
      if (v.mode === 'globe') { v.globe.lon = lon; v.globe.lat = lat; } else { v.map.lon0 = lon; }
      v.clamp();
    },
  };
  return v;
}

/** The longitude the device's UTC offset implies, 15° per hour (Global Weather's rule, §3.2). */
export function defaultLon() {
  try { return wrap180(-new Date().getTimezoneOffset() / 4); } catch { return 0; }
}

/* ── gestures ── */
/**
 * Drag, pinch, tap and double-tap on one element (DESIGN §3.2). A tap is an up within 8 px and
 * 300 ms of its down; a second tap within 300 ms is a double-tap (the first tap's action waits
 * that long). Handlers: pan(dx, dy), pinch(ratio, midX, midY), tap(x, y), doubleTap(x, y),
 * release(vx, vy) with the last drag velocity in CSS px/s, start().
 */
export function attachGestures(elm, h) {
  const pointers = new Map();
  let g = null, tapTimer = 0, lastTapAt = 0, samples = [];
  const local = (e) => { const r = elm.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function begin() {
    const pts = [...pointers.values()];
    if (pts.length === 1) {
      g = { type: 'pan', x: pts[0].x, y: pts[0].y, sx: pts[0].x, sy: pts[0].y, t0: performance.now(), moved: g ? g.moved : false };
      samples = [];
    } else if (pts.length >= 2) {
      const [a, b] = pts;
      g = { type: 'pinch', d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), moved: true };
    }
  }
  elm.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button > 0) return;
    e.preventDefault();
    try { elm.setPointerCapture(e.pointerId); } catch { /* fine */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1 && h.start) h.start();
    begin();
  });
  elm.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !g) return;
    p.x = e.clientX; p.y = e.clientY;
    if (g.type === 'pan' && pointers.size === 1) {
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      g.x = e.clientX; g.y = e.clientY;
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 8) g.moved = true;
      if (g.moved) {
        h.pan(dx, dy);
        const t = performance.now();
        samples.push([t, e.clientX, e.clientY]);
        while (samples.length > 2 && t - samples[0][0] > 100) samples.shift();
      }
    } else if (g.type === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      h.pinch(d / g.d0);
      g.d0 = Math.max(1, d);
    }
  });
  function end(e) {
    if (!pointers.has(e.pointerId)) return;
    const [lx, ly] = local(e);
    const isTap = g && g.type === 'pan' && !g.moved && pointers.size === 1 && e.type === 'pointerup'
      && performance.now() - g.t0 < 300 && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) <= 8;
    const wasPan = g && g.type === 'pan' && g.moved && pointers.size === 1;
    pointers.delete(e.pointerId);
    if (pointers.size > 0) { begin(); if (g) g.moved = true; return; }
    if (isTap) {
      const now = performance.now();
      if (now - lastTapAt < 300 && tapTimer) {
        clearTimeout(tapTimer); tapTimer = 0; lastTapAt = 0;
        if (h.doubleTap) h.doubleTap(lx, ly);
      } else {
        lastTapAt = now;
        tapTimer = setTimeout(() => { tapTimer = 0; h.tap(lx, ly); }, 300);
      }
    } else if (wasPan && h.release) {
      let vx = 0, vy = 0;
      if (samples.length >= 2) {
        const a = samples[0], b = samples[samples.length - 1], dt = (b[0] - a[0]) / 1000;
        if (dt > 0 && performance.now() - b[0] < 60) { vx = (b[1] - a[1]) / dt; vy = (b[2] - a[2]) / dt; }
      }
      h.release(vx, vy);
    } else if (h.release) h.release(0, 0);
    g = null;
  }
  elm.addEventListener('pointerup', end);
  elm.addEventListener('pointercancel', end);
  elm.addEventListener('wheel', (e) => { e.preventDefault(); h.pinch(Math.exp(-e.deltaY * 0.0015)); if (h.release) h.release(0, 0); }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) elm.addEventListener(ev, (e) => e.preventDefault());
}
