// Small shared helpers: DOM lookups, the localStorage wrapper, number and distance formatting, and a
// handful of float64 vector operations. No DOM framework, no dependencies.

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

// Unit conversions. AU_KM is the IAU 2012 astronomical unit; the app reads the same number from
// data/physical.json at start-up and asserts they agree. The parsec is defined from it (IAU 2015 B2).
export const AU_KM = 149597870.7;
export const PC_AU = 648000 / Math.PI;            // 206264.806… AU
export const KPC_AU = PC_AU * 1000;
export const LY_AU = 63241.07708426628;           // Julian year × c, in AU (c from the IAU 2012 AU and the SI metre)
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

export function fmt(v, dec = 0) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Three significant figures, never scientific notation, thousands separated.
export function sig(v, n = 3) {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const mag = Math.floor(Math.log10(Math.abs(v)));
  const dec = Math.max(0, n - 1 - mag);
  return fmt(v, Math.min(dec, 6));
}

// A distance given in AU, in whichever unit reads best at that size.
export function fmtAU(au) {
  if (!Number.isFinite(au)) return '—';
  const km = au * AU_KM;
  if (km < 1e6) return `${sig(km, km < 1000 ? 3 : 4)} km`;
  if (au < 2000) return `${sig(au)} AU`;
  const ly = au / LY_AU;
  if (ly < 0.1) return `${sig(au)} AU`;
  const pc = au / PC_AU;
  if (pc < 1000) return `${sig(ly)} light-years`;
  const kly = ly / 1000;
  if (kly < 1000) return `${sig(kly)} thousand light-years`;
  return `${sig(kly / 1000)} million light-years`;
}

// A short unit for the scale ruler: "1 AU", "10 000 km", "5 ly", "10 kly".
export function fmtRuler(au) {
  const km = au * AU_KM;
  if (km < 1e6) return `${fmt(km)} km`;
  if (au < 5000) return `${fmt(au, au < 1 ? 2 : 0)} AU`;
  const ly = au / LY_AU;
  if (ly < 1000) return `${fmt(ly, ly < 1 ? 2 : 0)} ly`;
  return `${fmt(ly / 1000)} kly`;
}

// Light travel time for a distance in AU.
export function fmtLightTime(au) {
  const s = au * LIGHT_S_PER_AU;
  if (s < 1) return `${sig(s * 1000)} light-milliseconds`;
  if (s < 90) return `${sig(s)} light-seconds`;
  if (s < 5400) return `${sig(s / 60)} light-minutes`;
  if (s < 86400 * 2) return `${sig(s / 3600)} light-hours`;
  if (s < 86400 * 365.25 * 0.5) return `${sig(s / 86400)} light-days`;
  return `${sig(s / (86400 * 365.25))} light-years`;
}

export function fmtDays(d) {
  if (!Number.isFinite(d)) return '—';
  const a = Math.abs(d);
  if (a < 2) return `${sig(a * 24)} hours`;
  if (a < 800) return `${sig(a)} days`;
  return `${sig(a / 365.25)} years`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------------ float64 vectors (plain arrays)
export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const vset = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
export const vcopy = (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; };
export const vadd = (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
export const vsub = (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
export const vscale = (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
export const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const vlen = (a) => Math.hypot(a[0], a[1], a[2]);
export const vdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
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
// Row-major 3×3 matrix times vector.
export function m3v(o, m, v) {
  const x = m[0] * v[0] + m[1] * v[1] + m[2] * v[2];
  const y = m[3] * v[0] + m[4] * v[1] + m[5] * v[2];
  const z = m[6] * v[0] + m[7] * v[1] + m[8] * v[2];
  o[0] = x; o[1] = y; o[2] = z; return o;
}
// Transposed: row-major 3×3 matrix ᵀ times vector.
export function m3tv(o, m, v) {
  const x = m[0] * v[0] + m[3] * v[1] + m[6] * v[2];
  const y = m[1] * v[0] + m[4] * v[1] + m[7] * v[2];
  const z = m[2] * v[0] + m[5] * v[1] + m[8] * v[2];
  o[0] = x; o[1] = y; o[2] = z; return o;
}

// Fetch helpers that fail loudly: a missing or truncated file names itself in the error.
export async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  try { return await r.json(); } catch (e) { throw new Error(`${url}: not valid JSON (${e.message})`); }
}
export async function getBin(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.arrayBuffer();
}
