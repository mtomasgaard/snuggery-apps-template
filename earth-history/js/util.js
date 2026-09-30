// Small helpers shared by every module, and the one wrapper around localStorage (DESIGN §4.6).
// Nothing here touches the DOM at import time, so tools/*.mjs can import modules that import this.

export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const $ = (id) => document.getElementById(id);

/** Longitude in degrees wrapped into [-180, 180). */
export const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
/** An angle in radians wrapped into (-π, π]. */
export function wrapPi(a) {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
/** The app's one motion curve, cubic-bezier(0.22, 0.61, 0.36, 1) (ART.md "Motion"), for motion drawn in JS. */
export function ease(x) {
  const c = (a, b) => [3 * a, 3 * (b - a) - 3 * a, 1 - 3 * b + 3 * a];     // B(t) = ((C·t + B)·t + A)·t
  const [ax, bx, cx] = c(0.22, 0.36), [ay, by, cy] = c(0.61, 1);
  let t = clamp(x, 0, 1);
  for (let k = 0; k < 8; k++) {                                             // Newton on x(t) = x
    const d = ((cx * t + bx) * t + ax) * t - x, dx = (3 * cx * t + 2 * bx) * t + ax;
    if (Math.abs(d) < 1e-6 || !dx) break;
    t = clamp(t - d / dx, 0, 1);
  }
  return ((cy * t + by) * t + ay) * t;
}

export function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Create an element with an optional class and text (text only ever through textContent). */
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* ── localStorage: keys prefixed "eh.", every access in try/catch, a broken value → the default ── */
const PREFIX = 'eh.';
export const store = {
  get(key, fallback, valid = () => true) {
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      if (raw == null) return fallback;
      const v = JSON.parse(raw);
      return valid(v) ? v : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try {
      if (value == null) window.localStorage.removeItem(PREFIX + key);
      else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch { /* private mode or blocked storage: the app works without it */ }
  },
};

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** '#rrggbb' → [r, g, b] in 0..1. */
export function hexRGB(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** A CSS custom property of :root, read at call time (the theme can change while the app runs). */
export function cssVar(name) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch { return ''; }
}
