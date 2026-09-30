// The bottom sheet (DESIGN §3.6): three heights (peek, half, full) moved by its grip — a tap cycles,
// a drag moves one height per 44 px, ↑ / ↓ on the focused grip — and its content, rebuilt for the
// map on screen: the period card and its text (story.json), "This map" quoting Scotese's Table 1
// row, the tiles against today (manifest tiles, CONTRACT §1 and §18), the Sun's brightness (Gough
// 1981), events within ±5 Myr, the Look-for pins, and every source used, expanded. Text from the
// data files only ever goes in through textContent; URLs and DOIs are printed, never linked.

import { el, reducedMotion } from './util.js';
import * as U from './units.js';
import { icsLine } from './timeline.js';

export const HEIGHTS = ['peek', 'half', 'full'];
const GRIP_LABEL = ['Show more about this map', 'Show the whole sheet', 'Show the Earth again'];
const EVENT_WINDOW_MA = 5;

/** "Foster et al. 2017", "Bond & Grasby 2017", "Hatcher 2010" — from a cite "Surname, I., … (year)." */
export function shortCite(cite) {
  const m = /^(.*?)\s*\((\d{4})\)/.exec(cite);
  if (!m) return cite.split('.')[0];
  const authors = m[1], year = m[2];
  const parts = authors.split(/(?<=\.),\s+/);
  const n = /et al\./.test(authors) ? 3 : parts.length + (/ & /.test(authors) ? 1 : 0);
  const surname = (s) => s.split(',')[0].trim();
  if (!authors.includes(',')) return `${authors} ${year}`;
  if (n === 1) return `${surname(parts[0])} ${year}`;
  if (n === 2) return `${surname(parts[0])} & ${surname(authors.split(' & ')[1])} ${year}`;
  return `${surname(parts[0])} et al. ${year}`;
}

/**
 * els: { app, sheet, grip, head, body }
 * D: { manifest, ts, story, about }
 * h: { height(n) — after a height change; look(item) — a Look-for tapped; units(system) }
 */
export function createSheet(els, D, h) {
  const { manifest, ts, story, about } = D;
  const cards = new Map(story.periods.map((p) => [p.ics, p]));
  const storySrc = new Map(story.sources.map((s) => [s.id, s]));
  const dataSrc = new Map(about.sources.map((s) => [s.id, s]));
  const short = (id) => {
    const d = dataSrc.get(id), s = storySrc.get(id);
    if (s) return shortCite(s.cite);
    if (d) return shortCite(d.cite.replace(/, (\d{4})\./, ' ($1).'));
    return id;
  };
  let height = 0, shown = -1, wide = false;

  /* ── heights ── */
  /* The grid changes at once (every row has its final size straight away); the rows under the
     Earth then glide from where they were to where they are, 280 ms, eased (a FLIP). The night of
     the Earth panel extends under them meanwhile, so nothing pale shows through (§19). */
  const ROWS = ['agerow', 'slider', 'curves', 'sheet'].map((id) => els.app.querySelector(`#${id}`)).filter(Boolean);
  let flipTimer = 0;
  function glide(apply) {
    if (wide || reducedMotion()) { apply(); return; }
    const before = ROWS.map((e) => (e.offsetParent ? e.getBoundingClientRect().top : null));
    apply();
    let last = 0;
    const moves = [];
    ROWS.forEach((e, j) => {
      if (!e.offsetParent) return;
      const dy = before[j] == null ? last : before[j] - e.getBoundingClientRect().top;
      last = dy;
      if (Math.abs(dy) > 0.5) moves.push([e, dy]);
    });
    if (!moves.length) return;
    els.app.classList.add('flipping');
    for (const [e, dy] of moves) { e.style.transition = 'none'; e.style.transform = `translateY(${dy.toFixed(1)}px)`; }
    void els.app.offsetWidth;
    for (const [e] of moves) { e.style.transition = 'transform 0.28s cubic-bezier(0.22, 0.61, 0.36, 1)'; e.style.transform = ''; }
    clearTimeout(flipTimer);
    flipTimer = setTimeout(() => { for (const e of ROWS) e.style.transition = ''; els.app.classList.remove('flipping'); }, 320);
  }
  function setHeight(n, { quiet = false } = {}) {
    n = Math.max(0, Math.min(2, n | 0));
    const changed = n !== height;
    height = n;
    const apply = () => {
      els.app.classList.toggle('sheet-half', n === 1);
      els.app.classList.toggle('sheet-full', n === 2);
    };
    if (changed && !quiet) glide(apply); else apply();
    els.grip.setAttribute('aria-label', GRIP_LABEL[n]);
    els.grip.setAttribute('aria-expanded', String(n > 0));
    els.body.scrollTop = n === 0 ? 0 : els.body.scrollTop;
    // At peek the body is cut off: keep its buttons out of the tab order until it opens.
    els.body.inert = n === 0 && !wide;
    if (!quiet) h.height(n);
  }
  let drag = null, skipClick = false;
  els.grip.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    skipClick = false;
    try { els.grip.setPointerCapture(e.pointerId); } catch { /* fine */ }
    drag = { y: e.clientY, moved: false };
  });
  els.grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 5) drag.moved = true;
    if (dy > 44 && height < 2) { setHeight(height + 1); drag.y = e.clientY; } else if (dy < -44 && height > 0) { setHeight(height - 1); drag.y = e.clientY; }
  });
  els.grip.addEventListener('pointerup', () => { if (drag && drag.moved) skipClick = true; drag = null; });
  els.grip.addEventListener('pointercancel', () => { drag = null; });
  els.grip.addEventListener('click', () => { if (skipClick) { skipClick = false; return; } setHeight((height + 1) % 3); });
  els.grip.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setHeight(height + 1); } else if (e.key === 'ArrowDown') { e.preventDefault(); setHeight(height - 1); }
  });
  // At peek, a tap on the sheet's two lines opens it to half.
  els.head.addEventListener('click', () => { if (height === 0 && !wide) setHeight(1); });

  /* ── content ── */
  const section = (title, cls) => { const s = el('section', 'sh-sec' + (cls ? ' ' + cls : '')); if (title) s.append(el('h3', 'sh-h', title)); return s; };
  const srcLine = (ids, used) => { ids.forEach((id) => used.add(id)); return el('p', 'sh-src', ids.length ? `Sources: ${ids.map(short).join(' · ')}` : ''); };
  const periodRange = (p) => `${U.maText(p.begin_ma)}${p.end_ma === 0 ? ' million years ago to today' : `–${U.maText(p.end_ma)} million years ago`}`;
  // The range itself is in the head; the body adds only what the head leaves out, the chart's
  // uncertainties on the two boundaries ("start ± 0.024, end ± 0.2 million years").
  const periodUnc = (p) => {
    const u = [];
    if (p.begin_unc_ma != null) u.push(`start ± ${p.begin_unc_ma}`);
    if (p.end_ma !== 0 && p.end_unc_ma != null) u.push(`end ± ${p.end_unc_ma}`);
    return u.length ? `Today’s chart: ${u.join(', ')} million years` : '';
  };

  function tile(label, value, lines, cls) {
    const t = el('div', 'tile' + (cls ? ' ' + cls : ''));
    t.append(el('p', 'tile-k', label), el('p', 'tile-v', value));
    for (const l of lines) if (l) t.append(el('p', 'tile-s', l));
    return t;
  }
  function tiles(s, used) {
    const T = s.tiles, u = manifest.units, NO = 'No data this far back';
    const out = [];
    if (T.temperature) {
      const d = T.temperature.c - u.today_temperature_c;
      const cmp = Math.abs(d) < 0.05 ? 'the same as the model’s today' : `${U.temperatureDelta(d)} ${d > 0 ? 'warmer' : 'cooler'} than the model’s today`;
      out.push(tile('Temperature', U.temperature(T.temperature.c, 1), [cmp, `climate model, ${s.climate_age_ma} Ma`]));
      used.add('phanda');
    } else out.push(tile('Temperature', NO, [], 'none'));
    if (T.co2) {
      const fit = T.co2.kind === 'proxy_fit';
      const today = fit ? u.today_co2_fit_ppm : u.today_co2_model_ppm;
      const band = fit && T.co2.lo68 != null ? `68% band ${U.fmt(T.co2.lo68)}–${U.fmt(T.co2.hi68)} ppm` : '';
      out.push(tile('CO₂', `${U.fmt(T.co2.ppm)} ppm`, [`${U.fmt(T.co2.ppm / today, 1)} × this curve at 0 Ma`, fit ? 'proxy fit' : `climate model input, ${s.climate_age_ma} Ma`, band]));
      used.add(fit ? 'foster2017' : 'phanda');
    } else out.push(tile('CO₂', NO, [], 'none'));
    if (T.sea_level) {
      const lo = Math.min(T.sea_level.min_m, T.sea_level.max_m), hi = Math.max(T.sea_level.min_m, T.sea_level.max_m);
      out.push(tile('Sea level', U.seaLevel(T.sea_level.m), [`range ${U.seaLevel(lo)} to ${U.seaLevel(hi)}`, 'relative to today']));
      used.add('vandermeer2022');
    } else out.push(tile('Sea level', NO, [], 'none'));
    if (T.land) {
      const shelf = U.isUS() ? '0–660 ft' : '0–200 m';
      out.push(tile('Land', `${U.fmt(T.land.land_pct, 1)}%`, [`${U.fmt(u.today_land_pct, 1)}% in this model today`, `Shelf seas (${shelf} deep): ${U.fmt(T.land.shelf_pct, 1)}%, today ${U.fmt(u.today_shelf_pct, 1)}%`, `PaleoDEM, ${s.elevation_age_ma} Ma`]));
      used.add('paleodem');
    } else out.push(tile('Land', NO, [], 'none'));
    out.push(tile('The Sun', `${U.fmt(U.sunPercent(s.age_ma), 1)}% of today’s brightness`, ['Gough’s (1981) formula for the young Sun'], 'wide'));
    used.add('gough1981');
    return out;
  }

  function render(stop, force = false) {
    if (stop === shown && !force) return;
    shown = stop;
    const s = manifest.slices[stop], per = ts.byId.get(s.ics.period), card = cards.get(s.ics.period);
    const used = new Set(['paleoatlas', 'ics']);

    // The two lines that show at peek.
    els.head.replaceChildren();
    const title = el('p', 'sh-title');
    const sw = el('span', 'sh-swatch'); sw.style.background = per.colour;
    // The period in Newsreader, its range beside it; the text reads "Triassic · 251.902–201.4 …".
    title.append(sw, el('span', 'nm', per.name), el('span', 'rg', ` · ${periodRange(per)}`));
    els.head.append(title, el('p', 'sh-map', `This map: Scotese map ${s.map} · ${s.label}`));

    const body = [];
    // 1. The period card
    const c1 = section(null, 'sh-card');
    const unc = periodUnc(per);
    if (unc) c1.append(el('p', 'sh-meta', unc));
    if (card) c1.append(el('p', 'sh-text', card.text), srcLine(card.sources, used));
    body.push(c1);
    if (s.ics.period === 'Tonian') {
      const pr = section(story.prologue.title, 'sh-card');
      pr.append(el('p', 'sh-text', story.prologue.text), srcLine(story.prologue.sources, used));
      body.push(pr);
    }
    // 2. This map
    const c2 = section('This map');
    c2.append(el('p', 'sh-strong', `Scotese map ${s.map} · ${s.label}`));
    // The age row already names this map's Period, Epoch and Age; the chart is quoted here only
    // where it disagrees with Scotese's label.
    if (s.ics_note) c2.append(el('p', 'sh-text', s.ics_note.text), el('p', 'sh-meta', `Today’s chart: ${icsLine(s, ts)}`));
    const parts = [`Overlays rotated to ${U.maText(s.rotation_ma)} Ma`];
    if (s.climate_age_ma != null) parts.push(`Climate: model run for ${U.maText(s.climate_age_ma)} Ma`);
    if (s.elevation_age_ma != null) parts.push(`Elevation: PaleoDEM for ${U.maText(s.elevation_age_ma)} Ma`);
    c2.append(el('p', 'sh-meta', parts.join(' · ')));
    body.push(c2);
    // 3. Then and now
    const c3 = section(null);
    const hrow = el('div', 'sh-hrow');
    hrow.append(el('h3', 'sh-h', 'Then and now'), unitsSwitch());
    const grid = el('div', 'tiles');
    grid.append(...tiles(s, used));
    c3.append(hrow, grid);
    body.push(c3);
    // 4. Around this time
    const near = story.events.filter((e) => Math.abs(e.age_ma - s.age_ma) <= EVENT_WINDOW_MA).sort((a, b) => b.age_ma - a.age_ma);
    const c4 = section('Around this time');
    if (!near.length) c4.append(el('p', 'sh-meta', `Nothing on this app’s list of events falls within ${EVENT_WINDOW_MA} million years of this map.`));
    for (const e of near) {
      const it = el('div', 'sh-item');
      it.append(el('p', 'sh-ev', e.title), el('p', 'sh-meta', e.when || U.chartAge(e.age_ma, e.age_unc_ma)), el('p', 'sh-text', e.text), srcLine(e.sources, used));
      c4.append(it);
    }
    body.push(c4);
    // 5. Look for
    const look = story.look_for.filter((p) => p.window_ma[1] <= s.age_ma && s.age_ma <= p.window_ma[0]);
    if (look.length) {
      const c5 = section('Look for');
      for (const p of look) {
        const b = el('button', 'look');
        b.type = 'button';
        b.append(el('span', 'look-dot'), el('span', 'look-label', p.label), el('span', 'look-text', p.text));
        b.setAttribute('aria-label', `${p.label}: ${p.text} Shows it on the Earth.`);
        b.addEventListener('click', () => h.look(p));
        c5.append(b, srcLine(p.sources, used));
      }
      body.push(c5);
    }
    // 6. Sources
    const c6 = section('Sources', 'sh-sources');
    const list = el('ul', 'sh-cites');
    const order = [...dataSrc.keys()].filter((id) => used.has(id)).concat([...used].filter((id) => !dataSrc.has(id)).sort());
    for (const id of order) {
      const d = dataSrc.get(id), st = storySrc.get(id);
      let text;
      if (d) text = `${d.cite} License: ${d.licence}${d.licence_uri ? ` (${d.licence_uri})` : ''}.`;
      else if (st) text = `${st.cite}${st.doi ? ` doi:${st.doi}` : ''}`;
      else text = id;
      list.append(el('li', null, text));
    }
    c6.append(list, el('p', 'sh-meta', 'Licenses, adaptations and the full credits are in About.'));
    body.push(c6);
    els.body.replaceChildren(...body);
  }

  function unitsSwitch() {
    const g = el('div', 'units-switch');
    g.setAttribute('role', 'radiogroup');
    g.setAttribute('aria-label', 'Units');
    for (const [sys, text] of [['us', 'US'], ['metric', 'Metric']]) {
      const b = el('button', null, text);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(U.getSystem() === sys));
      b.addEventListener('click', () => h.units(sys));
      g.append(b);
    }
    return g;
  }

  return {
    render,
    setHeight,
    get height() { return height; },
    /** Wide screens show the sheet at full inside the right column; the grip hides (§3.9). */
    setWide(on) { wide = on; els.body.inert = height === 0 && !wide; },
    text: () => els.sheet.innerText,
    lookItems: () => story.look_for,
  };
}
