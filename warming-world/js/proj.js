// Forward and inverse orthographic and Equal Earth (DESIGN §5.4, §6), the view, and gestures.
// The maths is pure and runs in Node (tools/test_proj.mjs): its inverses are the fragment shader's
// formulas in float64, and the forwards are what the overlay draws with. Angles are radians in the
// maths and degrees in the view state (what localStorage keeps). The view and attachGestures follow
// Earth's History's js/proj.js (copied, then changed: Equal Earth for Mollweide, zoom 1–4, the seat).

import { DEG, clamp, wrap180, wrapPi } from './util.js';

/* ── orthographic (Earth's History's formulas) ── */
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

/* ── Equal Earth (Šavrič, Patterson and Jenny 2018; constants as d3-geo 3.1.1's equalEarth.js) ── */
export const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
/** y(θ) and its derivative's polynomial, the two the forward and inverse share. */
const eeY = (t) => { const t2 = t * t, t6 = t2 * t2 * t2; return t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)); };
const eeD = (t) => { const t2 = t * t, t6 = t2 * t2 * t2; return A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2); };
export const EE_YMAX = eeY(Math.asin(M));            // 1.3173627…, the poles
export const EE_XMAX = Math.PI / (M * A1);           // 2.7066297…, the equator's ends
/** θ for a latitude: sin θ = M sin φ. */
export const eeTheta = (phi) => Math.asin(M * Math.sin(phi));
/** The forward: x for a longitude difference dl ∈ (−π, π], y for φ. */
export function eeForward(dl, phi) {
  const t = eeTheta(phi);
  return { x: (dl * Math.cos(t)) / (M * eeD(t)), y: eeY(t) };
}
/** x per radian of longitude at latitude φ (the overlay caches it per vertex), and y. */
export function eeFactors(phi) { const t = eeTheta(phi); return [Math.cos(t) / (M * eeD(t)), eeY(t)]; }
/** θ from y by Newton from θ = y (the shader runs 6 steps in float32; f32 rounds each step). */
export function eeNewton(y, steps = 12, f32 = null) {
  const r = f32 || ((v) => v);
  let t = r(y);
  for (let k = 0; k < steps; k++) {
    const t2 = r(t * t), t6 = r(r(t2 * t2) * t2);
    const fy = r(r(t * r(A1 + r(A2 * t2) + r(t6 * r(A3 + r(A4 * t2))))) - y);
    const fp = r(A1 + r(3 * A2 * t2) + r(t6 * r(7 * A3 + r(9 * A4 * t2))));
    t = r(t - r(fy / fp));
  }
  return t;
}
/** (x, y) in Equal Earth units → (λ, φ), or null outside the outline. λ wrapped into (−π, π]. */
export function eeInverse(x, y, lam0) {
  if (Math.abs(y) > EE_YMAX) return null;
  const t = eeNewton(y);
  const dl = (M * x * eeD(t)) / Math.cos(t);
  if (Math.abs(dl) > Math.PI + 1e-9) return null;           // the outline (a rounding ulp allowed)
  return { lam: wrapPi(lam0 + dl), phi: Math.asin(clamp(Math.sin(t) / M, -1, 1)) };
}

/* ── the view (DESIGN §3.2, §6) ── */
export const ZOOM_MIN = 1, ZOOM_MAX = 4;
/** The longitude the device's UTC offset implies, 15° per hour (Global Weather's clock trick, §3.9). */
export function defaultLon() {
  try { return wrap180(-new Date().getTimezoneOffset() / 4); } catch { return 0; }
}
/**
 * The view state: the projection, the globe's centre and zoom, the map's central meridian, vertical
 * pan (Equal Earth units, the view's centre) and zoom, and the panel in CSS px. The seat is the panel
 * less its top strip (`top`) and its foot (`bottom`); the globe's radius is `factor` · min(seat) · zoom
 * (0.47, or 0.48 in focus mode) and it is centred in the seat (`dy` offsets it while it glides there); the map fits the seat's width less 16 px at zoom 1 (§3.2).
 */
export function createView() {
  const v = {
    mode: 'globe',
    globe: { lon: defaultLon(), lat: 20, zoom: 1 },
    map: { lon0: 0, panY: 0, zoom: 1 },
    W: 1, H: 1, top: 44, bottom: 44, factor: 0.47, dy: 0,
    get seatW() { return v.W; },
    get seatH() { return Math.max(40, v.H - v.top - v.bottom); },
    get cx() { return v.W / 2; },
    get cy() { return v.top + v.seatH / 2 + v.dy; },
    radius() { return v.factor * Math.min(v.seatW, v.seatH) * v.globe.zoom; },
    mapScale() { return Math.max(4, Math.min((v.seatW - 16) / (2 * EE_XMAX), (v.seatH - 16) / (2 * EE_YMAX))) * v.map.zoom; },
    zoom() { return v.mode === 'globe' ? v.globe.zoom : v.map.zoom; },
    centreLon() { return v.mode === 'globe' ? v.globe.lon : v.map.lon0; },
    /** The map's centre latitude (φ at y = panY on the central meridian). */
    mapCentreLat() { const g = eeInverse(0, v.map.panY, 0); return g ? g.phi / DEG : 0; },
    clamp() {
      v.globe.lon = wrap180(v.globe.lon);
      v.globe.lat = clamp(v.globe.lat, -89.5, 89.5);
      v.globe.zoom = clamp(v.globe.zoom, ZOOM_MIN, ZOOM_MAX);
      v.map.lon0 = wrap180(v.map.lon0);
      v.map.zoom = clamp(v.map.zoom, ZOOM_MIN, ZOOM_MAX);
      const room = Math.max(0, EE_YMAX - (v.seatH / 2 - 8) / v.mapScale());
      v.map.panY = clamp(v.map.panY, -room, room);
    },
    /** Globe | Map, the view carried across (§6.3); no animation between the projections. */
    setMode(m) {
      if (m === v.mode) return;
      if (m === 'map') {
        v.map.lon0 = v.globe.lon; v.map.zoom = v.globe.zoom;
        v.map.panY = v.map.zoom > 1 ? eeForward(0, v.globe.lat * DEG).y : 0;
      } else {
        v.globe.lon = v.map.lon0; v.globe.zoom = v.map.zoom;
        if (v.map.zoom > 1) v.globe.lat = clamp(v.mapCentreLat(), -80, 80);
      }
      v.mode = m;
      v.clamp();
    },
    /** Double-tap: home (zoom 1, latitude 20°, longitude kept; the map centred). */
    home() {
      if (v.mode === 'globe') { v.globe.zoom = 1; v.globe.lat = 20; } else { v.map.zoom = 1; v.map.panY = 0; }
      v.clamp();
    },
    /** Move by a drag of (dx, dy) CSS px: one radius of drag is one radian on the globe (§6.1). */
    panBy(dx, dy) {
      if (v.mode === 'globe') {
        const per = 1 / v.radius() / DEG;
        v.globe.lon -= dx * per;
        v.globe.lat += dy * per;
      } else {
        const s = v.mapScale();
        v.map.lon0 -= (dx / s) * M * A1 / DEG;          // the equator's scale: x = dλ / (M·A1)
        if (v.map.zoom > 1) v.map.panY += dy / s;       // a vertical drag pans only when zoomed (§6.2)
      }
      v.clamp();
    },
    /** Zoom by f about the screen point (mx, my): the place under it stays under it. */
    zoomBy(f, mx, my) {
      const z = v.mode === 'globe' ? v.globe : v.map;
      const nz = clamp(z.zoom * f, ZOOM_MIN, ZOOM_MAX);
      if (nz === z.zoom) return;
      const at = mx == null ? null : v.unproject(mx, my);
      z.zoom = nz;
      v.clamp();
      if (at) for (let k = 0; k < 3; k++) {
        const p = v.project(at[0], at[1]);
        if (!p[2]) break;
        v.panBy(mx - p[0], my - p[1]);
      }
    },
    /** CSS px in the panel → [lonDeg, latDeg], or null off the Earth. */
    unproject(sx, sy) {
      if (v.mode === 'globe') {
        const r = v.radius(), g = orthoInverse((sx - v.cx) / r, (v.cy - sy) / r, v.globe.lon * DEG, v.globe.lat * DEG);
        return g && [g.lam / DEG, g.phi / DEG];
      }
      const s = v.mapScale(), g = eeInverse((sx - v.cx) / s, (v.cy - sy) / s + v.map.panY, v.map.lon0 * DEG);
      return g && [g.lam / DEG, g.phi / DEG];
    },
    /** [lonDeg, latDeg] → [sx, sy, visible]. */
    project(lon, lat) {
      if (v.mode === 'globe') {
        const r = v.radius(), f = orthoForward(lon * DEG, lat * DEG, v.globe.lon * DEG, v.globe.lat * DEG);
        return [v.cx + r * f.X, v.cy - r * f.Y, f.Z >= 0];
      }
      const s = v.mapScale(), f = eeForward(wrapPi((lon - v.map.lon0) * DEG), lat * DEG);
      return [v.cx + s * f.x, v.cy - s * (f.y - v.map.panY), true];
    },
    /** The shader's uniforms for this view (CSS px; earth.js scales them by the DPR). */
    uniforms() {
      const g = v.mode === 'globe';
      return { proj: g ? 0 : 1, cx: v.cx, cy: v.cy, scale: g ? v.radius() : v.mapScale(),
        lam0: (g ? v.globe.lon : v.map.lon0) * DEG, phi0: g ? v.globe.lat * DEG : 0, panY: g ? 0 : v.map.panY };
    },
    key() {
      return `${v.mode}|${v.W}|${v.H}|${v.top}|${v.bottom}|${v.factor}|${v.dy}|` + (v.mode === 'globe'
        ? `${v.globe.lon}|${v.globe.lat}|${v.globe.zoom}` : `${v.map.lon0}|${v.map.panY}|${v.map.zoom}`);
    },
  };
  return v;
}

/* ── gestures (Earth's History's attachGestures, copied) ── */
/**
 * Drag, pinch, tap and double-tap on one element (DESIGN §6.1). A tap is an up within 8 px and
 * 300 ms of its down; a second tap within 300 ms is a double-tap (the first tap's action waits
 * that long). Handlers: pan(dx, dy), pinch(ratio, midX, midY), tap(x, y), doubleTap(x, y),
 * release(vx, vy) with the last drag velocity in CSS px/s, start().
 */
export function attachGestures(elm, h) {
  const pointers = new Map();
  let g = null, tapTimer = 0, lastTapAt = 0, samples = [];
  const local = (x, y) => { const r = elm.getBoundingClientRect(); return [x - r.left, y - r.top]; };
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
      const d = Math.hypot(a.x - b.x, a.y - b.y), [mx, my] = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      h.pinch(d / g.d0, mx, my);
      g.d0 = Math.max(1, d);
    }
  });
  function end(e) {
    if (!pointers.has(e.pointerId)) return;
    const [lx, ly] = local(e.clientX, e.clientY);
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
  elm.addEventListener('wheel', (e) => { e.preventDefault(); const [mx, my] = local(e.clientX, e.clientY); h.pinch(Math.exp(-e.deltaY * 0.0015), mx, my); if (h.release) h.release(0, 0); }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) elm.addEventListener(ev, (e) => e.preventDefault());
}
