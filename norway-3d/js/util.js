// Small shared helpers. No DOM framework, no dependencies.

export const $ = (id) => document.getElementById(id);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

// localStorage, wrapped so a private window or a full quota never breaks the app.
const KEY = 'norway3d:';
export const store = {
  get(k, d) {
    try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* full or blocked */ }
  },
};

export function dayOfYear(y, mo, d) {
  return Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
}
export function fromDayOfYear(y, n) {
  const t = new Date(Date.UTC(y, 0, n));
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

// "#rrggbb" -> {r,g,b} in 0..1
export function parseColor(hex) {
  let s = String(hex || '#888888').trim();
  if (s[0] === '#') s = s.slice(1);
  const n = parseInt(s.slice(0, 6), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// A binary min-heap on `key`: the smallest pops first.
export class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].key <= a[i].key) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].key < a[m].key) m = l;
        if (r < a.length && a[r].key < a[m].key) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
}
