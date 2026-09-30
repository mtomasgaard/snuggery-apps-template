// About (DESIGN §10.4): the full-height panel over map and sheet. It prints assets/about.json in order
// (intro, reading keys, notes with their USGS quotes), the Oklahoma statement from stories.json's quoted
// sources, the data's dates, every source (the snapshot's too) with license, changes, citation and address
// as plain text, the pages quoted, the fonts, the units and the version line (five taps: frame times).

import { el, xBtn, nums } from './util.js';
import { utc, num } from './units.js';
import { KEYS, unitsSeg } from './layers.js';

const iso = (s) => (s ? s.replace('T', ' ').replace(/(:\d\d)?Z$/, ' UTC') : 'unknown');
export function aboutPanel(A, box) {
  const ab = A.about, add = (...n) => box.append(...n), p = (t, c) => el('p', c, t);
  // measured values in mono, words, years and USGS's quoted words in Atkinson (ART.md "Type")
  const pn = (t, prose = true) => { const e = el('p'); e.append(nums(t, prose)); return e; };
  const h2 = (t, id) => { const h = el('h2', null, t); if (id) h.id = id; return h; };
  box.textContent = '';
  const head = el('div', 'l1');
  head.append(el('h2', null, ab ? ab.title : 'About US Quakes'));
  head.append(xBtn('Close About', () => A.closeAbout()));
  add(head);
  if (!ab) { add(p('assets/about.json could not be read.')); return; }
  add(pn(ab.intro), h2('Units'), unitsSeg(A), h2('Reading the map'));
  const keyOf = { sizes: 'sizes', colours: 'ramp', hollow: 'hollow', grey: 'grey', cross: 'grey' };
  for (const r of ab.reading) {
    const q = el('p', keyOf[r.id] ? 'krow' : null);
    if (keyOf[r.id]) q.append(KEYS[keyOf[r.id]](A));
    const s = el('span'); s.append(el('b', null, r.title + '. '), nums(r.text, true)); q.append(s); add(q);
  }
  const cited = (id) => (ab.cited || []).concat(A.stories ? A.stories.sources : []).find((c) => c.id === id);
  const quote = (q, id) => { const c = cited(id); add(p(`USGS: “${q}”${c ? ` (${c.title})` : ''}`, 'quote')); };
  for (const n of ab.notes) { add(h2(n.title), pn(n.text)); if (n.quote) quote(n.quote, n.source); }
  const ok = A.stories && A.stories.sources.filter((s) => /oklahoma/.test(s.id));
  if (ok && ok.length) { add(h2(ok[0].title)); for (const s of ok) add(p(`USGS: “${s.quote}”`, 'quote')); }
  add(h2(ab.notShown.title), pn(ab.notShown.text));
  const C = A.C, S = C && C.S, H = C && C.H;
  add(h2('The data in this copy'));
  if (H) add(pn(`History: ${num(H.n)} earthquakes to ${H.meta.cutoff}, as retrieved ${H.meta.retrieved}.`, false));
  add(pn(S ? `Live: the USGS feed of ${iso(S.feed.generated)}; this snapshot written ${iso(S.generatedAt)}; ${num(S.n)} rows from ${utc(S.from, false)}.` : 'Live: no snapshot in this copy.', false));
  if (S && S.volcanoes) add(pn(`Volcano status: read ${iso(S.volcanoes.readAt)}${S.volcanoes.ok === false ? ', not available' : ''}.`, false));
  add(h2('Sources', 'about-sources'));
  const src = (t, ...lines) => { add(el('h3', null, t)); for (const l of lines.flat()) if (l) add(p(l, /^[a-z]+\.[a-z]/.test(l) || /:\/\//.test(l) ? 'addr' : 'note')); };
  if (S) for (const s of S.sources) src(s.name, s.owner, s.licence, s.attribution, s.url, `Read ${iso(s.readAt)}.`);
  for (const s of ab.sources) src(s.title, s.owner, s.licence, s.licence_quote, (s.adaptations || []).map((a) => `Changed here: ${a}`), s.cite, s.attribution, s.url, `Retrieved ${s.retrieved}.`);
  add(h2('Pages quoted'));
  for (const c of (ab.cited || []).concat(A.stories ? A.stories.sources.filter((s) => s.quote) : [])) src(c.title, c.owner, c.note, c.url, `Retrieved ${c.retrieved}.`);
  add(h2('Software and fonts'), p(ab.software.text, 'note'), p(ab.software.fonts, 'note'));
  const v = el('button', 'ver', `Version ${ab.version}`);
  v.setAttribute('aria-label', `Version ${ab.version}. Five taps show the frame-time readout.`);
  let taps = [];
  v.onclick = () => { const t = performance.now(); taps = taps.filter((q) => t - q < 3000).concat(t); if (taps.length >= 5) { taps = []; A.togglePerf(); } };
  add(v);
}
