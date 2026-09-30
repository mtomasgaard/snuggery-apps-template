// About (DESIGN §3.8): a full-height panel built from data/about.json — how to read the app, the
// honesty caveats, what is not shown and why, every data source with its owner, licence, what this
// app changed and its retrieval date, the references for the text, then the units setting and the
// version line. URLs and licence URIs are printed as text, never made into links. Five taps on the
// version line within three seconds toggle the frame-time readout for a phone check (§10).

import { el } from './util.js';
import { getSystem } from './units.js';
import { shortCite } from './sheet.js';

/**
 * els: { root, body, done, opener }
 * h: { units(system), perfToggle() }
 */
export function createAbout(els, about, story, version, h) {
  const cites = new Map();
  for (const s of story.sources) cites.set(s.id, shortCite(s.cite));
  for (const r of about.references || []) cites.set(r.id, shortCite(r.cite));
  for (const s of about.sources) if (!cites.has(s.id)) cites.set(s.id, shortCite(s.cite.replace(/, (\d{4})\./, ' ($1).')));
  const srcs = (ids) => (ids && ids.length ? el('p', 'ab-src', `Sources: ${ids.map((id) => cites.get(id) || id).join(' · ')}`) : null);
  const sec = (title) => { const s = el('section', 'ab-sec'); s.append(el('h3', null, title)); return s; };
  let unitsGroup = null;

  function build() {
    const out = [el('p', 'ab-intro', about.intro)];

    const read = sec('How to read it');
    for (const r of about.reading) read.append(el('h4', null, r.title), el('p', null, r.text), srcs(r.sources) || '');
    out.push(read);

    const cav = sec('What to keep in mind');
    for (const c of about.caveats) cav.append(el('h4', null, c.title), el('p', null, c.text), srcs(c.sources) || '');
    out.push(cav);

    const not = sec(about.not_shown.title);
    not.append(el('p', null, about.not_shown.text));
    out.push(not);

    const data = sec('Data sources and licenses');
    for (const s of about.sources) {
      const d = el('div', 'ab-source');
      d.append(el('h4', null, s.title));
      const row = (k, v) => { if (v) d.append(el('p', 'ab-kv', `${k}: ${v}`)); };
      row('Owner', s.owner);
      row('License', `${s.licence}${s.licence_uri ? ` · ${s.licence_uri}` : ''}`);
      row('Credit', s.attribution);
      row('What this app changed', s.adaptations);
      row('Accuracy', s.accuracy);
      row('Source', Array.isArray(s.source) ? s.source.join(' ') : s.source);
      row('Address', Array.isArray(s.url) ? s.url.join(' ') : s.url);
      row('Retrieved', s.retrieved);
      row('Cite', s.cite);
      data.append(d);
    }
    out.push(data);

    const refs = sec('References for the text');
    const ul = el('ul', 'ab-refs');
    const all = [...story.sources, ...(about.references || []).filter((r) => !story.sources.some((s) => s.id === r.id))];
    for (const r of all) ul.append(el('li', null, `${r.cite}${r.doi ? ` doi:${r.doi}` : ''}`));
    refs.append(ul);
    out.push(refs);

    const sw = sec('Software');
    sw.append(el('p', null, about.software.text));
    out.push(sw);

    const units = sec('Units');
    unitsGroup = el('div', 'units-switch big');
    unitsGroup.setAttribute('role', 'radiogroup');
    unitsGroup.setAttribute('aria-label', 'Units');
    for (const [sys, text] of [['us', 'US (°F, ft, mi, in)'], ['metric', 'Metric (°C, m, km, mm)']]) {
      const b = el('button', null, text);
      b.type = 'button'; b.dataset.sys = sys;
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => { h.units(sys); syncUnits(); });
      unitsGroup.append(b);
    }
    units.append(unitsGroup);
    out.push(units);

    // The version line: five taps within 3 s toggle the frame-time readout.
    const v = el('p', 'ab-version', `Earth’s History ${version} · data retrieved ${about.retrieved}`);
    let taps = [];
    v.addEventListener('click', () => {
      const t = performance.now();
      taps = taps.filter((x) => t - x < 3000).concat(t);
      if (taps.length >= 5) { taps = []; h.perfToggle(); }
    });
    out.push(v);
    els.body.replaceChildren(...out);
    syncUnits();
  }
  function syncUnits() {
    if (!unitsGroup) return;
    for (const b of unitsGroup.children) b.setAttribute('aria-checked', String(b.dataset.sys === getSystem()));
  }

  let built = false;
  function open() {
    if (!built) { build(); built = true; }
    syncUnits();
    els.root.hidden = false;
    if (els.app) els.app.inert = true;          // the page behind is out of reach while About is open
    els.body.scrollTop = 0;
    els.done.focus();
  }
  function close() {
    if (els.root.hidden) return;
    els.root.hidden = true;
    if (els.app) els.app.inert = false;
    els.opener.focus();
  }
  els.done.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !els.root.hidden) { e.preventDefault(); close(); } });
  return { open, close, syncUnits, get isOpen() { return !els.root.hidden; } };
}
