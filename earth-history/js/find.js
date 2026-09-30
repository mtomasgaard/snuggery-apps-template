// Find (DESIGN §3.7): a full-height overlay over places.json's 300 cities. Prefix matches on the
// name, its ASCII name or the country come first, then substring matches, each ranked by Natural
// Earth's scalerank and then the file's own order; case and accents are ignored. Up to 8 rows.
// Choosing one hands the city to app.js, which turns the Earth to it, pins it and opens its card.

import { el } from './util.js';
import { latText1, lonText1 } from './units.js';

const MAX = 8;
/** Lower case, accents stripped: "São Paulo" → "sao paulo". */
export const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The ranked matches for a query: [{ i, place }], at most `max`. Pure, for the tests. */
export function search(places, query, max = MAX) {
  const q = fold(query.trim());
  if (!q) return [];
  const hits = [];
  places.forEach((p, i) => {
    const keys = [fold(p.n), fold(p.a || p.n), fold(p.c)];
    const words = keys.flatMap((k) => k.split(/[\s,.'’-]+/));
    const rank = keys.some((k) => k.startsWith(q)) ? 0 : words.some((w) => w.startsWith(q)) ? 1 : keys.some((k) => k.includes(q)) ? 2 : -1;
    if (rank >= 0) hits.push({ i, place: p, rank });
  });
  hits.sort((a, b) => a.rank - b.rank || a.place.r - b.place.r || a.i - b.i);
  return hits.slice(0, max);
}

/**
 * els: { root, input, list, empty, hint, cancel, opener }
 * h: { choose(i) }
 */
export function createFind(els, places, h) {
  let results = [];
  function render() {
    results = search(places, els.input.value);
    els.list.replaceChildren();
    for (const r of results) {
      const li = el('li');
      const b = el('button', 'find-row');
      b.type = 'button';
      const p = r.place;
      b.append(el('span', 'find-name', `${p.n} · ${p.c}`), el('span', 'find-now', `now ${latText1(p.lat)} ${lonText1(p.lon)}`));
      b.addEventListener('click', () => pick(r.i));
      li.append(b);
      els.list.append(li);
    }
    els.empty.hidden = !(els.input.value.trim() && !results.length);
    if (els.hint) els.hint.hidden = !!els.input.value.trim();
  }
  function open() {
    els.root.hidden = false;
    if (els.app) els.app.inert = true;          // the page behind is out of reach while Find is open
    els.input.value = '';
    render();
    els.input.focus();
  }
  function close(returnFocus = true) {
    if (els.root.hidden) return;
    els.root.hidden = true;
    if (els.app) els.app.inert = false;
    if (returnFocus) els.opener.focus();
  }
  function pick(i) { close(false); h.choose(i); }

  els.input.addEventListener('input', render);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && results.length) { e.preventDefault(); pick(results[0].i); }
  });
  els.cancel.addEventListener('click', () => close());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !els.root.hidden) { e.preventDefault(); close(); } });
  // A tap outside the field and the rows (on the overlay's empty part) closes Find.
  els.root.addEventListener('click', (e) => { if (e.target === els.root || e.target === els.list) close(); });

  return {
    open, close,
    get open_() { return !els.root.hidden; },
    /** For the tests: type a query and return the rows as shown. */
    type(q) { els.input.value = q; render(); return results.map((r) => ({ i: r.i, n: r.place.n, c: r.place.c })); },
    pick,
  };
}
