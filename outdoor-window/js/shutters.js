// The Shutters (ART.md section 1): one row per rule in use, the file's hours across each, a block of ink over
// every run of hours that rule rules out, a hollow block where the file has no value, and on the hours a rule
// lets through a thin green bar as tall as the share of its allowance the hour uses. Where no row has ink a
// clear channel runs down the stack; when it is a window, it is drawn as one: lit (--sheet), framed by ink
// jambs up the whole stack and an ink sill under it. Pure apart from draw(), which builds the SVG with
// createElementNS and textContent; tools/test_shutters.mjs recomputes the model with its own formulas.

import { NB, int, list, count, placeDay, placeClock, placeHour, placeSpan, spokenHour } from './units.js';

export const ROW = 16, PITCH = 19, BAR = 12, COUNT_W = 26, MIN_PX = 4, MAX_PX = 12, LABEL_GAP = 4, NOW_ROW = 16;
const NAMES = { rain: 'Rain chance', rainfall: 'Rainfall', gust: 'Gusts', temp: 'Temperature', dew: 'Dew point' };
/** A row's name: the scorer's label with a capital, "Daylight" or "Golden hour" for the light rule. */
export const nameOf = (c) => NAMES[c.key] || c.label.charAt(0).toUpperCase() + c.label.slice(1);

/**
 * The plot: a label column `label` px wide, then `ph` whole pixels an hour (floor of the room left, at least 4,
 * at most 12), then the count column (26 px, narrowed to what is left when 4 px an hour only just fits). A file
 * too long for 4 px an hour (more than about 60 hours at 390 px) is drawn at the fraction that fits, never
 * past the pane. With the present inside the file, a 16 px row for `now` sits over the rows.
 */
export function geometry(width, label, hours, rules, withNow = false) {
  const n = Math.max(1, hours), room = width - label, fit = Math.floor((room - COUNT_W) / n);
  const ph = fit >= MIN_PX ? Math.min(MAX_PX, fit) : MIN_PX * n <= room - 20 ? MIN_PX : (room - 20) / n;
  const W = ph * hours, countW = Math.max(20, Math.min(COUNT_W, room - W));
  const top = withNow ? NOW_ROW + 1 : 1;   // the rows' top
  const rb = top + Math.max(1, rules) * PITCH - (PITCH - ROW);   // the rows' foot
  const brY = rb + 4, base = brY + 9;   // the sills, then the axis' baseline, clear of the head's ring
  const bw = Math.max(2, Math.round(ph / 3));   // a bar's width, centered in its hour
  return { x0: label, ph, W, countW, width: label + W + countW, top, rb, brY, base, height: base + 22, bw, bx: Math.floor((ph - 1 - bw) / 2) };
}

/** Runs of consecutive hour indexes where test(i) holds, split where an hour's `past` differs from its neighbor's. */
function runs(n, test, past) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!test(i)) continue;
    const last = out[out.length - 1];
    if (last && last.to === i - 1 && last.past === past(i)) last.to = i;
    else out.push({ from: i, to: i, past: past(i) });
  }
  return out;
}

/**
 * The model, from the scored rows of the whole file (score.js), the windows over the hours still to come, the
 * place's offset, the phone's now, the content width and the measured label column. `measure(text)` gives a
 * label's width in px for the axis' collision rule (a canvas in the app, an estimate in the test).
 */
export function model({ rows, windows, offset, now, width, label, ranOut, measure = (s) => s.length * 5.5 }) {
  const n = rows.length, rules = n ? rows[0].checks.map((c) => ({ key: c.key, label: c.label, name: nameOf(c) })) : [];
  const t0 = n ? rows[0].epoch : NaN, end = n ? rows[n - 1].epoch + 3600e3 : NaN;
  const past = (i) => !ranOut && rows[i].epoch + 3600e3 <= now;
  const nowAt = !ranOut && now >= t0 && now < end ? (now - t0) / 3600e3 : null;
  const G = geometry(width, label, n, rules.length, nowAt !== null);
  const R = rules.map((r, k) => {
    const c = (i) => rows[i].checks[k];
    const bars = [];
    for (let i = 0; i < n; i++) {
      if (!c(i).ok) continue;
      const h = Math.round(BAR * (1 - c(i).comfort));
      if (h >= 1) bars.push({ i, h, past: past(i) });
    }
    return { ...r, y: G.top + k * PITCH,
      blocks: runs(n, (i) => !c(i).ok && !c(i).missing, past),
      hollows: runs(n, (i) => c(i).missing, past),
      bars, out: rows.filter((_, i) => !c(i).ok).length, missing: rows.filter((_, i) => c(i).missing).length };
  });
  const brackets = windows.map((w) => ({ from: w.start.index, to: w.end.index, hours: w.hours }));
  const hourOf = (i) => placeHour(rows[i].epoch, offset);
  const mids = [], quarters = [];
  for (let i = 0; i < n; i++) {
    const h = hourOf(i);
    if (h === 0 && i > 0) mids.push(i);
    else if (h === 6 || h === 12 || h === 18) quarters.push(i);
  }
  // The axis' words, in order of priority: each midnight's day under its tick, then the first day at the left
  // end, then noon. A label that would come within LABEL_GAP px of one already placed is left out (the house
  // track's rule), and the first day's label also stops LABEL_GAP px short of the first midnight's tick, so no
  // day's name ever runs under the next day's hours (a file fetched in the evening starts a few hours before
  // its first midnight). `now` has its own row over the stack, so it never competes with a day.
  const want = [];
  for (const i of mids) want.push({ text: placeDay(rows[i].epoch, offset), x: G.x0 + i * G.ph, anchor: 'middle', kind: 'day' });
  if (n) want.push({ text: placeDay(rows[0].epoch, offset), x: G.x0, anchor: 'start', kind: 'day', stop: mids.length ? G.x0 + mids[0] * G.ph - LABEL_GAP : Infinity });
  for (const i of quarters) if (hourOf(i) === 12) want.push({ text: placeClock(rows[i].epoch, offset), x: G.x0 + i * G.ph, anchor: 'middle', kind: 'noon' });
  const labels = [];
  for (const l of want) {
    const w = measure(l.text), a = l.anchor === 'start' ? l.x : l.x - w / 2, b = a + w;
    if (a < 0 || b > G.width || b > (l.stop ?? Infinity)) continue;
    if (labels.some((p) => a < p.b + LABEL_GAP && p.a < b + LABEL_GAP)) continue;
    labels.push({ text: l.text, x: l.x, anchor: l.anchor, kind: l.kind, a, b });
  }
  return { G, n, rules: R, brackets, mids, quarters, labels, nowAt, past: rows.map((_, i) => past(i)), offset, t0 };
}

/** The hour under x (drawing coordinates). A tap off the plot picks nothing; a drag clamps to the ends. */
export function hourAt(M, x, clampIt = false) {
  const { x0, ph, W } = M.G;
  if (!clampIt && (x < x0 - ph || x > x0 + W + ph)) return null;
  return Math.max(0, Math.min(M.n - 1, Math.floor((x - x0) / ph)));
}
/** The center of an hour's column, where the tracer head stands. */
export const centerOf = (M, i) => M.G.x0 + i * M.G.ph + (M.G.ph - 1) / 2;

/** The key under the Shutters (HOUSE 4.15, 11.1 rule 6; ART.md section 1), in place of the band's how-to-read
 *  sentence: each mark drawn small with its word, as [mark, word]. A hollow block only when one is drawn; with no
 *  rule in use, the window's frame alone (the pane's statement says no rule is in use). */
export const keyItems = (M) => (!M.rules.length ? [['frame', 'Window']]
  : [['blk', 'Ruled out'], ['used', 'Share of the limit'], ...(M.rules.some((r) => r.hollows.length) ? [['ho', 'No value']] : []), ['frame', 'Window']]);

/** What VoiceOver reads as the slider's description, once: the file's span, what each rule cost, the windows. */
export function describe(M, rows, windows, offset) {
  if (!M.n) return 'No hours in the file.';
  const head = `${count(M.n, 'hour')} from ${spokenHour(rows[0].epoch, offset)}.`;
  const cost = M.rules.filter((r) => r.out).sort((a, b) => b.out - a.out);
  const free = M.rules.filter((r) => !r.out).map((r) => r.label);
  let rules = !M.rules.length ? 'No rule is in use.' : !cost.length ? 'No rule rules out an hour.'
    : `${cost.map((r, j) => (j ? `${r.label} ${int(r.out)}` : `${r.name} rules out ${count(r.out, 'hour')}`)).join(cost.length > 2 ? ', ' : ' and ').replace(/, ([^,]*)$/, ' and $1')}${free.length ? `; ${list(free)} none` : ''}.`;
  const gaps = M.rules.filter((r) => r.missing).map((r) => `${r.label} ${int(r.missing)}`);
  if (gaps.length) rules += ` Hours with no value in the file: ${list(gaps)}.`;
  const day = (ms) => spokenHour(ms, offset).split(' ')[0];
  // the end as the screen writes it (units.js placeSpan): "19:00", "24:00", or the day too when it is later
  const until = (w) => { const b = w.end.epoch + 3600e3, s = placeSpan(w.start.epoch, b, offset); return s.includes(' to ') ? `${day(b)} ${placeClock(b, offset)}` : s.slice(6); };
  const wins = windows.length ? `Windows: ${windows.map((w) => `${day(w.start.epoch)} ${placeClock(w.start.epoch, offset)} to ${until(w)}, ${count(w.hours, 'hour')}`).join('; ')}.` : 'No window.';
  return `${head} ${rules} ${wins}`;
}

/**
 * Draws the model into `svg`, the chosen hour `chosen`. Returns place(i), which moves the chosen column and the
 * tracer head to hour i without drawing anything else (the scrub's per-frame work), and press(on).
 */
export function draw(svg, M) {
  const NS = svg.namespaceURI, { G } = M;
  const add = (parent, tag, attrs, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    parent.append(e);
    return e;
  };
  svg.replaceChildren();
  svg.setAttribute('width', G.width);
  svg.setAttribute('height', G.height);
  svg.setAttribute('viewBox', `0 0 ${G.width} ${G.height}`);
  // a window's opening, lit (--sheet) from the stack's top down to its sill, under everything else
  const edges = M.brackets.map((b) => [G.x0 + b.from * G.ph, G.x0 + (b.to + 1) * G.ph - 1]);
  for (const [x1, x2] of edges) add(svg, 'rect', { class: 'lit', x: x1, y: G.top, width: x2 - x1, height: G.brY - G.top });
  const col = add(svg, 'rect', { class: 'col', x: G.x0, y: G.top - 1, width: G.ph - 1, height: G.rb - G.top + 2 });
  for (const i of M.mids) add(svg, 'line', { class: 'hair', x1: G.x0 + i * G.ph - 0.5, x2: G.x0 + i * G.ph - 0.5, y1: G.top, y2: G.rb });
  const rect = (g, cls, from, to, y, h, past) => add(g, 'rect', { class: past ? `${cls} past` : cls, x: G.x0 + from * G.ph, y, width: (to - from + 1) * G.ph - 1, height: h });
  for (const r of M.rules) {
    const g = add(svg, 'g', { class: 'r' });
    add(g, 'text', { class: 'lab', x: 0, y: r.y + 12 }, r.name);
    if (r.out) add(g, 'text', { class: 'lab', x: G.width, y: r.y + 12, 'text-anchor': 'end' }, `${int(r.out)}${NB}h`);
    for (const b of r.blocks) rect(g, 'blk', b.from, b.to, r.y, ROW, b.past);
    for (const b of r.hollows) add(g, 'rect', { class: b.past ? 'ho past' : 'ho', x: G.x0 + b.from * G.ph + 0.5, y: r.y + 0.5, width: (b.to - b.from + 1) * G.ph - 2, height: ROW - 1 });
    for (const b of r.bars) add(g, 'rect', { class: b.past ? 'u past' : 'u', x: G.x0 + b.i * G.ph + G.bx, y: r.y + ROW - b.h, width: G.bw, height: b.h });
  }
  // the frame: an ink jamb up the whole stack at each edge, in the page's gap beside the window's first and last
  // hours, and an ink sill under it that joins them
  for (const [x1, x2] of edges) {
    for (const x of [x1 - 1, x2]) add(svg, 'rect', { class: 'jb', x, y: G.top, width: 1, height: G.brY - G.top });
    add(svg, 'rect', { class: 'br', x: x1 - 1, y: G.brY, width: x2 - x1 + 2, height: 2 });
  }
  add(svg, 'rect', { class: 'base', x: G.x0, y: G.base, width: G.W, height: 1 });
  for (const i of M.mids) add(svg, 'rect', { class: 'mid', x: G.x0 + i * G.ph - 1, y: G.base + 1, width: 1, height: 7 });
  for (const i of M.quarters) add(svg, 'rect', { class: 'qt', x: G.x0 + i * G.ph - 1, y: G.base + 1, width: 1, height: 3 });
  // `now` over the stack, its notch hanging down to the rows: the house track's `now` over its notch, where the
  // tracer head, which stands on the axis under the stack, can never cover it
  if (M.nowAt !== null) {
    const x = G.x0 + M.nowAt * G.ph;
    add(svg, 'text', { class: 'lab nowl', x, y: 10, 'text-anchor': 'middle' }, 'now');
    add(svg, 'rect', { class: 'now', x: Math.round(x), y: 12, width: 1, height: G.top - 12 });
  }
  for (const l of M.labels) add(svg, 'text', { class: 'lab', x: l.x, y: G.base + 18, 'text-anchor': l.anchor }, l.text);
  const head = add(svg, 'g', { class: 'head' });
  const rule = add(head, 'rect', { x: 0, y: G.base - 8.5, width: 1.5, height: 18 });
  const ring = add(head, 'circle', { class: 'ring', cx: 0, cy: G.base + 0.5, r: 7 });
  const disc = add(head, 'circle', { cx: 0, cy: G.base + 0.5, r: 4 });
  let pressed = false;
  return {
    place(i) {
      const cx = centerOf(M, i);
      col.setAttribute('x', G.x0 + i * G.ph);
      rule.setAttribute('x', cx - 0.75);
      ring.setAttribute('cx', cx);
      disc.setAttribute('cx', cx);
    },
    press(on) {
      if (on === pressed) return;
      pressed = on;
      ring.setAttribute('r', on ? 8 : 7);
      disc.setAttribute('r', on ? 5 : 4);
    },
  };
}
