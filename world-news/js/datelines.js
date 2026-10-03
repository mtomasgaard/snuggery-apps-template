// The Datelines (ART.md section 1): every headline's age when the file was made, one tick per headline,
// six rows, on a fixed logarithmic scale from 1 h at the right to 60 d at the left. Pure apart from draw(),
// which builds the SVG with createElementNS and textContent; tools/test_datelines.mjs recomputes the model
// from the data with its own formulas.

import { ageLabel, count, int, spokenItem } from './units.js';

export const HOURS = 1440;                  // the scale's left end, 60 days
export const MARKS = [1, 6, 24, 168, 1440];  // labeled; hairlines through the rows at the middle three
export const ROW = 18, TOP = 4, TICK = 12, GAP = 3, MAX_PARTS = 4, REACH = 22;

/** A headline's age in hours at generatedAt, from the file alone, never the phone's clock. */
export const ageOf = (gen, iso) => (gen - Date.parse(iso)) / 36e5;

/** The plot: a label column `label` px wide, then at most 480 px of scale, 6 px kept at the right. */
export function geometry(width, label, rows) {
  const W = Math.max(60, Math.min(480, width - label - 6));
  return { x0: label, W, k: W / Math.log2(HOURS), width: label + W + 6, height: TOP + ROW * rows + 24 };
}
/** x of an age; ages past either end sit on that end. */
export const xAt = (G, h) => G.x0 + G.W - G.k * Math.log2(Math.min(HOURS, Math.max(1, h)));

/**
 * The model: per region, its ticks, newest first. A tick stands at its newest headline's place and takes each
 * older one while it stands under GAP px from there, so no headline is drawn GAP px or more from its own age
 * (a run of near ages never chains). A tick keeps every headline it holds.
 */
export function model(data, width, label) {
  const gen = Date.parse(data.generatedAt), G = geometry(width, label, data.regions.length);
  let lo = false, hi = false;
  const rows = data.regions.map((r, ri) => {
    const its = [];
    r.items.forEach((it, ii) => {
      const h = ageOf(gen, it.published);
      if (!Number.isFinite(h)) return;           // a time this app cannot read draws no tick
      if (h < 1) lo = true;
      if (h > HOURS) hi = true;
      its.push({ ri, ii, h, x: xAt(G, h), stale: !!it.stale, iso: it.published });
    });
    its.sort((a, b) => a.h - b.h);
    const ticks = [];
    for (const t of its) {
      const last = ticks[ticks.length - 1];
      if (last && last.x - t.x < GAP) last.items.push(t);
      else ticks.push({ x: t.x, items: [t] });
    }
    return { name: r.name, ticks, n: its.length, stale: its.filter((t) => t.stale).length,
      newest: its[0], oldest: its[its.length - 1] };
  });
  return { G, rows, lo, hi, gen };
}

/** The tick nearest a tap at (x, y) in drawing coordinates, within REACH px in the tapped row, or null. */
export function hit(M, x, y) {
  const ri = Math.floor((y - TOP) / ROW);
  if (ri < 0 || ri >= M.rows.length) return null;
  let best = null;
  for (const t of M.rows[ri].ticks) if (Math.abs(t.x - x) <= REACH && (!best || Math.abs(t.x - x) < Math.abs(best.x - x))) best = t;
  return best;
}

/** What VoiceOver reads for the picture: a sentence a region; a date-only stamp's age is a span (spokenItem). */
export function label(M) {
  const age = (t) => spokenItem(M.gen, t.iso);
  return M.rows.map((r) => {
    if (!r.n) return `${r.name}: no headlines.`;
    const ages = r.n === 1 ? age(r.newest) : `the newest ${age(r.newest)} and the oldest ${age(r.oldest)}`;
    const kept = r.stale ? `; ${r.stale === r.n && r.n > 1 ? 'all' : r.stale} kept from an earlier run` : '';
    return `${r.name}: ${count(r.n, 'headline')}, ${ages} before the file was made${kept}.`;
  }).join(' ');
}
export const hollows = (M) => M.rows.reduce((n, r) => n + r.stale, 0);

/**
 * Draws the model into `svg`. Rows in `chosen` (a Set of region indexes) are ink; the rest --ink-3. `sel` is
 * the selected headline, {ri, ii}, or null: its tick gets a tracer head, a 6 px ink disc ringed in --page,
 * inside its own row. A tick past MAX_PARTS headlines is drawn in MAX_PARTS parts with its count beside it.
 */
export function draw(svg, M, chosen, sel) {
  const NS = svg.namespaceURI, { G } = M, n = M.rows.length, base = TOP + ROW * n + 1;
  const add = (parent, tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.append(e);
    return e;
  };
  const px = (v) => Math.round(v);
  svg.replaceChildren();
  svg.setAttribute('width', G.width);
  svg.setAttribute('height', G.height);
  svg.setAttribute('viewBox', `0 0 ${G.width} ${G.height}`);
  for (const h of MARKS.slice(1, -1)) add(svg, 'line', { class: 'hair', x1: px(xAt(G, h)) + 0.5, x2: px(xAt(G, h)) + 0.5, y1: TOP, y2: base });
  add(svg, 'line', { class: 'scale', x1: G.x0, x2: G.x0 + G.W + 1, y1: base + 0.5, y2: base + 0.5 });
  const labs = MARKS.map((h, i) => {
    const x = px(xAt(G, h)) + 0.5;
    add(svg, 'line', { class: 'mark', x1: x, x2: x, y1: base + 1, y2: base + 5 });
    const open = (i === 0 && M.lo) ? '≤' : (i === MARKS.length - 1 && M.hi) ? '≥' : '';
    return add(svg, 'text', { class: 'lab', x, y: base + 16, 'text-anchor': i === 0 ? 'end' : i === MARKS.length - 1 ? 'start' : 'middle' }, ageLabel(h, open));
  });
  // a narrow plot (long region names) keeps both ends and drops a middle label that would touch a kept one
  try {
    const kept = [labs[0], labs[4]].map((e) => e.getBBox());
    for (const i of [2, 1, 3]) {
      const b = labs[i].getBBox();
      if (kept.some((c) => b.x < c.x + c.width + 4 && c.x < b.x + b.width + 4)) labs[i].remove(); else kept.push(b);
    }
  } catch { /* no layout: every label stays */ }
  M.rows.forEach((r, ri) => {
    const y = TOP + ri * ROW, g = add(svg, 'g', { class: chosen.has(ri) ? 'row on' : 'row' });
    add(g, 'text', { class: 'rn', x: 0, y: y + 13 }, r.name);
    // the counts first: a count's --page halo must never cover a tick
    for (const t of r.ticks) if (t.items.length > MAX_PARTS) add(g, 'text', { class: 'cnt', x: px(t.x) + 3, y: y + 13 }, int(t.items.length));
    for (const t of r.ticks) {
      const parts = t.items.slice(0, MAX_PARTS), k = parts.length, h = (TICK - (k - 1)) / k, x = px(t.x);
      parts.forEach((it, j) => {
        const top = y + 3 + j * (h + 1);
        if (it.stale) add(g, 'rect', { class: 'ho', x: x - 1.5, y: top + 0.5, width: 3, height: h - 1 });
        else add(g, 'rect', { class: 'tk', x: x - 1, y: top, width: 2, height: h });
      });
      if (sel && t.items.some((it) => it.ri === sel.ri && it.ii === sel.ii)) add(svg, 'circle', { class: 'sel', cx: x, cy: y + 3 + TICK / 2, r: 3.75 });
    }
  });
}
