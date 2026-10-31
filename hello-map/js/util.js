// Small shared helpers. No framework, no dependencies.

export const $ = (id) => document.getElementById(id);
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// localStorage, wrapped so a private window or a full quota never breaks the app. Every key this app
// keeps starts with the prefix, so a copy that renames itself keeps its own.
const KEY = 'hellomap:';
export const store = {
  get(k, d) {
    try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* full or blocked */ }
  },
};

/** Text into an element by id, only when it changed (no layout work for the same words). */
export function text(id, s) {
  const e = $(id);
  if (e && e.textContent !== s) e.textContent = s;
}
