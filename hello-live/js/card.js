// The Time Card (ART.md section 1): seven rows of days, today's at the top, each the day's 24 hours on one printed
// scale in the phone's clock; in each row a punch of ink at the minute a file this app has read was written, and
// from the punch a tail to the minute this app first read it, split at midnight into the later days' rows above
// (a file written before the seven days and read inside them draws only the part of its tail that lies inside);
// a short `now` notch at the foot of today's row, joined to its word above the card by a hairline. Pure apart from draw(), which builds the SVG with createElementNS and textContent;
// tools/test_card.mjs recomputes every figure with formulas written there.
//
// THE RECORD is an array of [written, firstRead] pairs in milliseconds, newest last, one per distinct `written`
// (the file's generatedAt), at most MAX_RECORD long. app.js keeps it under localStorage's `hello-live.card`; here it
// is only read.

import { dayTick, spoken, count } from './units.js';

export const LABEL_COL = 40;   // the day labels' column ("Wed 30" measures 33.5 px in the face at 10.5 px)
export const NOW_ROW = 16;     // the row above the days, for `now`
export const ROW_H = 14;       // a day's row, its 1 px hairline at the foot included: the least, and the default
export const ROW_MAX = 40;     // the most: the card takes the pane's free height up to this (rowFor)
export const DAYS_SHOWN = 7;
export const AXIS_H = 22;      // the axis row under the days
export const PUNCH_W = 2, PUNCH_H = 10, TAIL_H = 2, NOW_H = 9, NOW_MIN = 5;
export const MAX_PPH = 24;     // on a phone on its side
export const MAX_RECORD = 400;
export const LABEL_GAP = 4;    // between two axis labels
export const HEIGHT = NOW_ROW + ROW_H * DAYS_SHOWN + AXIS_H;   // 136, at the least row

/** The row height for a card that may be `room` CSS px tall: the whole pixels that fill it, from ROW_H to ROW_MAX. */
export function rowFor(room) {
  const h = Math.floor((room - NOW_ROW - AXIS_H) / DAYS_SHOWN);
  return Number.isFinite(h) ? Math.max(ROW_H, Math.min(ROW_MAX, h)) : ROW_H;
}

/** The card's geometry for a pane `paneWidth` CSS px wide with rows `rowH` tall: a whole number of pixels per hour,
 *  the plot's width; the punch keeps its 4 px under the row's top (10 at 14 px, 36 at 40). The notch never grows
 *  with the row, so it is never the shape of a punch: 9 px, and 9 px short of the row where the row is too low for
 *  that (5 at 14 px), so it never reaches the tail at the row's top (after review). */
export function layout(paneWidth, rowH = ROW_H) {
  const pph = Math.max(1, Math.min(MAX_PPH, Math.floor((paneWidth - LABEL_COL) / 24)));
  const row = Math.max(ROW_H, Math.min(ROW_MAX, Math.round(rowH) || ROW_H));
  return { pph, x0: LABEL_COL, plot: pph * 24, width: LABEL_COL + pph * 24, row, punchH: row - (ROW_H - PUNCH_H), nowH: Math.max(NOW_MIN, Math.min(NOW_H, row - 9)), height: NOW_ROW + row * DAYS_SHOWN + AXIS_H };
}

/** The phone's local date of `ms`, as a day number (its local midnight counted as a UTC day), so two instants on
 *  the same local date share it whatever the clock change. */
const dayNumber = (ms) => { const d = new Date(ms); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400e3); };
/** Which row `ms` falls in: 0 today, 1 yesterday, …; negative after today, 7 and more before the card. */
export const rowOf = (ms, now) => dayNumber(now) - dayNumber(ms);
/** The hour of `ms` on the phone's wall clock, with its minutes: 03:59 is 3.983…. On a clock-change day the
 *  autumn's repeated hour draws on itself and the spring's missing hour stays empty (About says so). */
export const wallHour = (ms) => { const d = new Date(ms); return d.getHours() + d.getMinutes() / 60; };
/** The x of `ms` in its row, a whole pixel. */
export const xOf = (ms, L) => L.x0 + Math.round(wallHour(ms) * L.pph);
/** The phone's local midnight `k` days before the day of `now`. */
export function dayStart(now, k) { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - k); return d.getTime(); }

/**
 * Every mark on the card, from the record and the present. `measure(text)` is a label's width in the face (a canvas
 * in the app, an estimate in the test). Returns rows (today first), punches, tails, the now notch and its label, the
 * axis ticks and labels, hairlines, and the counts About prints.
 */
export function geometry(record, now, L, measure = (s) => s.length * 5.2) {
  const rows = [];
  for (let k = 0; k < DAYS_SHOWN; k++) {
    const start = dayStart(now, k);
    rows.push({ k, start, label: dayTick(start), y: NOW_ROW + L.row * k, today: k === 0 });
  }
  const footOf = (k) => rows[k].y + L.row - 1;             // the row's hairline (the axis baseline for the last)
  const punchY = (k) => footOf(k) - L.punchH;              // the punch rises from the foot; the tail runs at its top
  const right = L.x0 + L.plot;
  const punches = [], tails = [];
  let before = 0, latest = null, carried = 0;
  for (const [written, first] of record) {
    const kw = rowOf(written, now);
    if (kw < 0) continue;                                   // written after today on this clock: nothing honest to draw
    if (kw >= DAYS_SHOWN) {
      // written before these seven days: no punch; read inside them, the part of the tail that lies inside, from the
      // oldest row's left edge (after review: the starter pack's file is older than the card on its first launch)
      const kr = first >= written ? rowOf(first, now) : -1;
      if (kr < 0 || kr >= DAYS_SHOWN) continue;
      carried++;
      if (latest === null || written > latest.written) latest = { written, first, off: true };
      for (let k = DAYS_SHOWN - 1; k > kr; k--) tails.push({ x: L.x0, w: L.plot, y: punchY(k), k });
      const xr = xOf(first, L);
      if (xr - L.x0 >= 1) tails.push({ x: L.x0, w: xr - L.x0, y: punchY(kr), k: kr });
      continue;
    }
    const x = Math.min(xOf(written, L), right - PUNCH_W);
    punches.push({ x, y: punchY(kw), w: PUNCH_W, h: L.punchH, k: kw, written, first });
    if (latest === null || written > latest.written) latest = { written, first, off: false };
    if (first < written) { before++; continue; }            // a phone whose clock is behind the server's: no tail
    const kr = rowOf(first, now);
    if (kr < 0) continue;                                   // first read after today on this clock: nothing honest to draw
    const xr = xOf(first, L);
    if (kr === kw) { if (xr - x >= 1) tails.push({ x, w: xr - x, y: punchY(kw), k: kw }); continue; }
    if (right - x >= 1) tails.push({ x, w: right - x, y: punchY(kw), k: kw });
    for (let k = kw - 1; k > kr; k--) tails.push({ x: L.x0, w: L.plot, y: punchY(k), k });
    if (xr - L.x0 >= 1) tails.push({ x: L.x0, w: xr - L.x0, y: punchY(kr), k: kr });
  }
  // now: a short notch at the foot of today's row, its word in the row above, kept inside the plot, the two joined by
  // a 1 px hairline in the rules' tone (drawn under the ink)
  const nowX = Math.min(xOf(now, L), right - 1);
  const half = measure('now') / 2;
  const nowLabelX = Math.max(L.x0 + half, Math.min(right - half, nowX + 0.5));
  // the axis: hour ticks, 6-hourly ticks with labels (00:00 at the left edge, 24:00 at the right), by priority
  const baseline = NOW_ROW + L.row * DAYS_SHOWN;
  const ticks = [], labels = [], dropped = [];
  for (let h = 0; h <= 24; h++) ticks.push({ h, x: L.x0 + h * L.pph, major: h % 6 === 0 });
  const placed = [];
  for (const h of [0, 24, 12, 6, 18]) {
    const text = `${String(h).padStart(2, '0')}:00`, w = measure(text), x = L.x0 + h * L.pph;
    const anchor = h === 0 ? 'start' : h === 24 ? 'end' : 'middle';
    const a = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2, b = a + w;
    if (placed.some((p) => a < p.b + LABEL_GAP && p.a < b + LABEL_GAP)) { dropped.push(text); continue; }
    placed.push({ a, b });
    labels.push({ h, text, x, anchor });
  }
  labels.sort((p, q) => p.h - q.h);
  const hairs = rows.slice(0, -1).map((r) => ({ y: footOf(r.k) }));   // the last row's foot is the baseline
  const quarters = [6, 12, 18].map((h) => ({ h, x: L.x0 + h * L.pph }));
  return { L, rows, punches, tails, now: { x: nowX, y: footOf(0) - L.nowH, h: L.nowH, labelX: nowLabelX, hairY: NOW_ROW, hairH: footOf(0) - L.nowH - NOW_ROW }, baseline, ticks, labels, dropped, hairs, quarters, before, latest, carried, files: punches.length + carried };
}

/** The card's accessible name, from the record: what it holds and the latest file's two instants, in words. A file
 *  written before the seven days and read inside them counts, and the name says where its writing lies; `no file
 *  read` is kept for an empty record (after review). */
export function describe(record, now) {
  const G = geometry(record, now, layout(390));
  if (!G.files) return `Time card, ${DAYS_SHOWN} days: ${record.length ? `no file read in these ${DAYS_SHOWN} days` : 'no file read'}.`;
  const l = G.latest;
  return `Time card, ${DAYS_SHOWN} days: ${count(G.files, 'file')} read; the latest written ${spoken(l.written)}${l.off ? `, before these ${DAYS_SHOWN} days,` : ','} first read here ${spoken(l.first)}.`;
}

/** The record with `written` added at `now` unless it is already there; the oldest dropped past MAX_RECORD. The
 *  same array back means nothing changed. */
export function remember(record, written, now) {
  if (record.some(([w]) => w === written)) return record;
  const next = record.concat([[written, now]]);
  return next.length > MAX_RECORD ? next.slice(next.length - MAX_RECORD) : next;
}

/** What storage held, as a record: pairs of finite numbers only, in order, at most MAX_RECORD; anything else is an
 *  empty record. */
export function sanitize(value) {
  if (!Array.isArray(value)) return [];
  const out = value.filter((e) => Array.isArray(e) && e.length === 2 && Number.isFinite(e[0]) && Number.isFinite(e[1])).map((e) => [e[0], e[1]]);
  return out.length > MAX_RECORD ? out.slice(out.length - MAX_RECORD) : out;
}

/** Draws the geometry into `svg`, replacing its children once per draw. Rects sit on whole pixels. */
export function draw(svg, G) {
  const NS = svg.namespaceURI, { L } = G;
  const add = (tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    svg.append(e);
    return e;
  };
  svg.replaceChildren();
  svg.setAttribute('width', L.width);
  svg.setAttribute('height', L.height);
  svg.setAttribute('viewBox', `0 0 ${L.width} ${L.height}`);
  const today = G.rows[0];
  add('rect', { class: 'today', x: 0, y: today.y, width: L.width, height: L.row });
  for (const q of G.quarters) add('rect', { class: 'hair', x: q.x, y: NOW_ROW, width: 1, height: L.row * DAYS_SHOWN });
  for (const h of G.hairs) add('rect', { class: 'hair', x: L.x0, y: h.y, width: L.plot, height: 1 });
  if (G.now.hairH >= 1) add('rect', { class: 'hair nowhair', x: G.now.x, y: G.now.hairY, width: 1, height: G.now.hairH });
  for (const r of G.rows) add('text', { class: 'day', x: 0, y: r.y + Math.floor(L.row / 2) + 3.5 }, r.label);   // 10.5 at 14 px: the row's middle
  for (const t of G.tails) add('rect', { class: 'tail', x: t.x, y: t.y, width: t.w, height: TAIL_H });
  for (const p of G.punches) add('rect', { class: 'punch', x: p.x, y: p.y, width: p.w, height: p.h });
  add('rect', { class: 'now', x: G.now.x, y: G.now.y, width: 1, height: G.now.h });
  add('text', { class: 'nowl', x: G.now.labelX, y: 12, 'text-anchor': 'middle' }, 'now');
  add('rect', { class: 'axis', x: L.x0, y: G.baseline, width: L.plot, height: 1 });
  for (const t of G.ticks) add('rect', { class: t.major ? 'tick6' : 'tick', x: Math.min(t.x, L.x0 + L.plot - 1), y: G.baseline + 1, width: 1, height: t.major ? 7 : 3 });
  for (const l of G.labels) add('text', { class: 'lab', x: l.x, y: G.baseline + 19, 'text-anchor': l.anchor }, l.text);
}
