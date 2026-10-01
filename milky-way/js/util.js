// Small shared helpers: DOM lookups, the localStorage wrapper, unit constants and a handful of float64
// vector operations. Every number the app writes goes through js/units.js.

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;

// Unit conversions. AU_KM is the IAU 2012 astronomical unit; the app reads the same number from
// data/physical.json at start-up and asserts they agree. The parsec is defined from it (IAU 2015 B2).
export const AU_KM = 149597870.7;
export const PC_AU = 648000 / Math.PI;            // 206264.806… AU
export const KPC_AU = PC_AU * 1000;
export const LY_AU = 63241.07708426628;           // Julian year × c, in AU (c from the IAU 2012 AU and the SI meter)
export const LIGHT_S_PER_AU = 499.00478383615643;  // AU / c

// localStorage, wrapped so a private window or a full quota never breaks the app.
const KEY = 'milkyway:';
export const store = {
  get(k, d) {
    try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* full or blocked */ }
  },
};

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------------ float64 vectors (plain arrays)
export const vcopy = (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; };
export const vadd = (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
export const vsub = (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
export const vscale = (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export function vcross(o, a, b) {
  const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0];
  o[0] = x; o[1] = y; o[2] = z; return o;
}
export function vnorm(o, a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
}
// Rotate vector v about unit axis k by angle a (Rodrigues).
export function vrot(o, v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), d = vdot(k, v) * (1 - c);
  const x = v[0] * c + (k[1] * v[2] - k[2] * v[1]) * s + k[0] * d;
  const y = v[1] * c + (k[2] * v[0] - k[0] * v[2]) * s + k[1] * d;
  const z = v[2] * c + (k[0] * v[1] - k[1] * v[0]) * s + k[2] * d;
  o[0] = x; o[1] = y; o[2] = z; return o;
}
// Fetch helpers that fail in words: a missing or broken file names itself in the sentence the app shows.
async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} could not be read (HTTP ${r.status})`);
  return r;
}
export async function getJSON(url) {
  const t = await (await get(url)).text();
  try { return JSON.parse(t); } catch { throw new Error(`${url} is not valid JSON${/^\s*</.test(t) ? '; it looks like a web page was written over it' : ', or it was cut short'}`); }
}
export const getBin = async (url) => (await get(url)).arrayBuffer();
