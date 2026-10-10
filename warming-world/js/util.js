// Small helpers shared by every module, and the one wrapper around localStorage (DESIGN §4.6).
// Nothing here touches the DOM at import time, so tools/*.mjs can import the modules that import it.
// Copied in shape from Earth's History's js/util.js (copy, never import).

export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const $ = (id) => document.getElementById(id);
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Longitude in degrees wrapped into [-180, 180). */
export const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
/** An angle in radians wrapped into (-π, π]. */
export function wrapPi(a) {
  a = (a + Math.PI) % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a - Math.PI;
}

/** A cubic-bezier(x1, y1, x2, y2) easing as a function of 0..1, solved by Newton on x(t). */
export function bezier(x1, y1, x2, y2) {
  const c = (a, b) => [3 * a, 3 * (b - a) - 3 * a, 1 - 3 * b + 3 * a];
  const [ax, bx, cx] = c(x1, x2), [ay, by, cy] = c(y1, y2);
  return (x) => {
    let t = clamp(x, 0, 1);
    for (let k = 0; k < 8; k++) {
      const d = ((cx * t + bx) * t + ax) * t - x, dx = (3 * cx * t + 2 * bx) * t + ax;
      if (Math.abs(d) < 1e-6 || !dx) break;
      t = clamp(t - d / dx, 0, 1);
    }
    return ((cy * t + by) * t + ay) * t;
  };
}
/** ART.md "Motion": --turn for the globe's moves, --settle for what lies on the card. */
export const easeTurn = bezier(0.45, 0, 0.2, 1);
export const easeSettle = bezier(0.2, 0, 0, 1);

/** The dark theme is on (Absolute's colors are Global Weather's per theme, plan 0012 D21). */
export function darkOn() {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
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
/** Set textContent only when it changed (the label is written every frame of a scrub). */
export function setText(e, t) { if (e && e.textContent !== t) e.textContent = t; }

/** Proper names a page translator must leave alone (QA pass): the agency, its product, the face. */
export const NAMES = /\b(?:NASA GISS|GISS|GISTEMP(?: v4)?|Archivo|Natural Earth)\b/g;
/**
 * Set text as setText does, with every proper name in `NAMES` (and each of `extra`, place names) in a
 * <span translate="no">, so a browser's translation never renders "GISS" or "Fairbanks" as words.
 * Text only ever through text nodes. Unchanged text is left alone.
 */
export function richText(e, t, extra = []) {
  if (!e || e.textContent === t) return;
  const names = extra.filter(Boolean);
  const re = names.length ? new RegExp(`${NAMES.source}|${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}`, 'g') : new RegExp(NAMES.source, 'g');
  e.textContent = '';
  let at = 0;
  for (const m of t.matchAll(re)) {
    if (m.index > at) e.append(t.slice(at, m.index));
    const s = document.createElement('span'); s.translate = false; s.textContent = m[0]; e.append(s);
    at = m.index + m[0].length;
  }
  if (at < t.length) e.append(t.slice(at));
}

/* ── localStorage: keys prefixed "ww.", every access in try/catch, a broken value → the default ── */
const PREFIX = 'ww.';
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

/** '#rrggbb' → [r, g, b] in 0..255. */
export function hexRGB(hex) {
  const n = parseInt(String(hex).trim().replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** A CSS custom property of :root, read at call time (the theme can change while the app runs). */
export function cssVar(name) {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch { return ''; }
}

/** Median and p95 of a list of numbers, for __ww.perf() (a trend, never phone evidence). */
export function summary(list) {
  const a = list.filter(isNum).sort((x, y) => x - y);
  if (!a.length) return { n: 0 };
  const q = (p) => +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2);
  return { n: a.length, median: q(0.5), p95: q(0.95), max: +a[a.length - 1].toFixed(2) };
}
