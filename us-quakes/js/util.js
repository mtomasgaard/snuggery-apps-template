// Small helpers with no DOM work at import time: elements, attributes, segmented radios, the easing curve
// (ART.md's one curve, never overshooting), binary search, canvas sizing, hatching, and the localStorage
// wrapper (DESIGN §4.6): keys "uq.*", every access in try/catch, a broken value read as the default.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const $ = (id) => document.getElementById(id);

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export const attrs = (e, o) => { for (const k in o) e.setAttribute(k, String(o[k])); return e; };
// ART.md "Type": measured values in Red Hat Mono, words in Atkinson. nums('0 to 300 km and deeper') wraps each
// number (with its sign, an "M " before it and a unit or ° N after it) in span.mono and leaves the words as text;
// a digit fused to letters (3DEP, BT2, 2010s) is a name. In prose (About, stories, the section caption) a bare
// year stays in the words, and so do "Lower 48" and whatever USGS says between “ ”
const NUM = /(?<![\p{L}\d])(?:M )?[−±+]?\d(?:[-\u202f.,:]?\d)*(?:°(?: [NSEW]\b)?| (?:km|mi|m|ft|UTC|h|min|days?|hours?)\b)?\+?(?![\p{L}\d])/gu;
export function nums(s, prose = false) {
  const f = document.createDocumentFragment(), q = [];
  s = String(s);
  if (prose) for (const m of s.matchAll(/“[^”]*”/g)) q.push([m.index, m.index + m[0].length]);
  let at = 0;
  for (const m of s.matchAll(NUM)) {
    if (prose && (/^\d{4}$/.test(m[0]) || (m[0] === '48' && s.slice(m.index - 6, m.index) === 'Lower ') || q.some(([a, b]) => m.index > a && m.index < b))) continue;
    if (m.index > at) f.append(s.slice(at, m.index));
    f.append(el('span', 'mono', m[0])); at = m.index + m[0].length;
  }
  if (at < s.length) f.append(s.slice(at));
  return f;
}
export const mono = (px) => `500 ${px}px "Red Hat Mono", ui-monospace, monospace`;
export function xBtn(label, fn) { const b = el('button', 'x', '✕'); b.setAttribute('aria-label', label); b.onclick = fn; return b; }
export function radios(label, items, cur, fn) {
  const s = el('div', 'seg seg-inline'); s.setAttribute('role', 'radiogroup'); s.setAttribute('aria-label', label);
  for (const [v, t] of items) { const b = el('button', null, t); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(v === cur)); b.onclick = () => fn(v); s.append(b); }
  return s;
}
export function reducedMotion() {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function ease(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bz = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (bz(m, 0.25, 0.3) < x) lo = m; else hi = m; }
  return bz((lo + hi) / 2, 0.8, 1);
}

export function lowerBound(a, v, lo = 0, hi = a.length) {
  while (lo < hi) { const m = (lo + hi) >>> 1; if (a[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

// localStorage: keys "uq.*", every access in try/catch, a broken value → the default
export const store = {
  get(key, fallback, valid = () => true) {
    try {
      const raw = localStorage.getItem('uq.' + key);
      if (raw == null) return fallback;
      const v = JSON.parse(raw);
      return valid(v) ? v : fallback;
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('uq.' + key, JSON.stringify(value)); } catch {}
  },
};

// the tokens change only with the color scheme, so each is read once a scheme (a read in the middle of a
// frame's writes would force the style to be computed again there)
const tokens = new Map();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => tokens.clear()); } catch { /* none */ }
export function cssVar(name) {
  if (tokens.has(name)) return tokens.get(name);
  let v = '';
  try { v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch { return ''; }
  if (v) tokens.set(name, v);
  return v;
}

export function sizeCanvas(c, w, h, r) {
  const W = Math.max(1, Math.round(w * r)), H = Math.max(1, Math.round(h * r));
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  c.style.width = w + 'px'; c.style.height = h + 'px';
  const x = c.getContext('2d');
  x.setTransform(r, 0, 0, r, 0, 0);
  return x;
}

export function hatch(x, x0, y0, w, h, color, gap = 4) {
  if (w <= 0 || h <= 0) return;
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  x.strokeStyle = color; x.lineWidth = 1; x.beginPath();
  for (let i = -h; i < w + h; i += gap) { x.moveTo(x0 + i, y0 + h); x.lineTo(x0 + i + h, y0); }
  x.stroke(); x.restore();
}
