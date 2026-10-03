// The Landing (ART.md section 1): the day-ahead price drawn as the market settles it, a staircase with one
// tread per interval on one fixed, printed scale for the whole file, and laid into it the chosen appliance's
// cheapest run as an ink level as long as the run, where the staircase sits lowest for that long, at the
// height of the run's mean price, standing on two ink posts, its times bracketed under the axis. A dashed
// line is the mean of the stretch searched, so the drop from it to the level is the saving. Pure apart from
// draw(), which builds the SVG with createElementNS and textContent; tools/test_prices.mjs recomputes the
// geometry with its own formulas.

import { NB, price, int, count, hm, dayShort, spokenDate, spokenPrice, fixed, spokenLength } from './units.js';
import { runWords, startWall } from './prices.js';

/** A coordinate to the hundredth of a pixel (an attribute, never text). */
const c = (v) => Math.round(v * 100) / 100;
export const NOW_ROW = 16, BASE_GAP = 9, AXIS = 31, LABEL_GAP = 4, TICK_PAD = 6, MEAN_STEP = 12, NOW_Y = 10;

/** The tick labels of the scale, as printed at the left: "13", "13.5", "−2". */
export const tickLabels = (M) => M.scale.ticks.map((v) => fixed(v, M.scale.digits));

/**
 * The geometry and every mark, from the model `M`, the chosen run (or null), the drawing's width in CSS px,
 * the plot's height (120 upright, 96 on a phone on its side) and `measure(text)`, a label's width in the
 * face (a canvas in the app, an estimate in the test).
 */
export function layout(M, run, width, plotH, measure = (s) => s.length * 5.2, names = []) {
  const n = M.n, S = M.scale;
  const tw = Math.ceil(Math.max(...tickLabels(M).map(measure))) + TICK_PAD;
  const x0 = tw, PW = width - tw;
  const xs = [];
  for (let i = 0; i <= n; i++) xs.push(x0 + Math.round((i * PW) / Math.max(1, n)));
  const top = NOW_ROW, foot = top + plotH, base = foot + BASE_GAP, height = foot + AXIS;
  const y = (v) => top + (plotH * (S.hi - v)) / (S.hi - S.lo);
  const X = (i) => xs[i];
  const G = { width, height, x0, PW, xs, top, foot, base, plotH, tw };

  // the staircase, in two paths: the intervals that have ended (40 %) and the rest; a gap breaks the line
  const path = (s, e, riser) => {
    let d = '';
    for (let i = s; i < e; i++) {
      const yi = c(y(M.iv[i].v));
      if (i === s) d += riser && i > 0 && M.joined[i] ? `M${X(i)} ${c(y(M.iv[i - 1].v))}V${yi}` : `M${X(i)} ${yi}`;
      else d += M.joined[i] ? `V${yi}` : `M${X(i)} ${yi}`;
      d += `H${X(i + 1)}`;
    }
    return d;
  };
  const past = M.history ? 0 : M.first;
  const stairs = { past: path(0, past, false), ahead: path(past, n, true) };
  // below zero: the area between the zero rule and the line
  const zy = Math.max(top, Math.min(foot, y(0)));
  let neg = '';
  for (let i = 0; i < n; i++) if (M.iv[i].v < 0) neg += `M${X(i)} ${c(zy)}H${X(i + 1)}V${c(y(M.iv[i].v))}H${X(i)}Z`;
  const grid = S.ticks.map((v, k) => ({ v, y: y(v), label: tickLabels(M)[k], zero: v === 0 }));
  const mids = [], hours = [];
  for (let i = 1; i < n; i++) if (M.iv[i].date !== M.iv[i - 1].date) mids.push(i);
  for (let i = 0; i < n; i++) if ([6, 12, 18].includes(M.iv[i].h) && M.iv[i].mi === 0 && !mids.includes(i)) hours.push(i);

  // the landing: a level at the run's mean, posts at both ends, a bracket under the axis
  const land = run && !run.none ? { from: run.from, to: run.to, x1: X(run.from), x2: X(run.to + 1), y: y(run.mean), mean: run.mean, words: runWords(M, run) } : null;
  // the mean of the stretch searched, dashed across it, labeled at its right end
  const mean = n && Number.isFinite(M.meanAhead) ? { x1: X(M.first), x2: X(n), y: y(M.meanAhead), text: `mean ${price(M.meanAhead)}` } : null;
  const nowX = M.cur >= 0 ? X(M.cur) + ((M.now - M.iv[M.cur].at) / M.step) * (X(M.cur + 1) - X(M.cur)) : null;

  // labels inside the plot, each placed at the first of its candidate spots that the staircase, the zero rule, the
  // dashed mean and the labels already placed leave clear (a 3 px halo cannot hide a line that runs between the letters):
  // the mean's at its line's right end, under it or over it, then at its left end, then along the line from its right
  // end leftwards 12 px a step, under then over; with no clear spot on the line it stands in the row above the plot,
  // which the staircase never enters, at the line's right end (or at the plot's left edge when `now` is there). The
  // appliance's name at the level's right end, level with it, over it or under it, then at its left end; a name with
  // no clear spot is left out (the list carries it).
  const stairY = (a, b) => {   // the staircase's vertical extent over x a..b, null where it draws nothing
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) if (X(i + 1) > a - 1 && X(i) < b + 1) { const v = y(M.iv[i].v); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return lo === Infinity ? null : [lo, hi];
  };
  const inPlot = [];
  const box = (text, x, yb, anchor) => { const w = measure(text), a = anchor === 'end' ? x - w : x; return { text, x, y: yb, anchor, a, b: a + w, t: yb - 8, bt: yb + 2 }; };
  const clear = (l, avoidMean) => {
    if (l.a < x0 || l.b > width || l.t < top - 2 || l.bt > foot) return false;
    const s = stairY(l.a, l.b);
    if (s && l.t - 1 < s[1] && s[0] < l.bt + 1) return false;
    if (avoidMean && mean && l.a < mean.x2 && mean.x1 < l.b && l.t - 1 < mean.y && mean.y < l.bt + 1) return false;
    if (S.lo < 0 && 0 < S.hi && l.t - 1 < y(0) && y(0) < l.bt + 1) return false;   // the zero rule
    if (land && l.a < land.x2 + 1 && land.x1 - 1 < l.b && l.t < foot && land.y - 2 < l.bt) return false;   // the level and its posts
    return !inPlot.some((p) => l.a < p.b + 2 && p.a < l.b + 2 && l.t < p.bt + 2 && p.t < l.bt + 2);
  };
  if (mean) {
    const spots = [box(mean.text, mean.x2, mean.y + 11, 'end'), box(mean.text, mean.x2, mean.y - 4, 'end'), box(mean.text, mean.x1 + 2, mean.y + 11, 'start'), box(mean.text, mean.x1 + 2, mean.y - 4, 'start')];
    for (let x = mean.x2 - MEAN_STEP; x - measure(mean.text) >= mean.x1; x -= MEAN_STEP) spots.push(box(mean.text, x, mean.y + 11, 'end'), box(mean.text, x, mean.y - 4, 'end'));
    let l = spots.find((q) => clear(q, false));
    if (!l) {
      const nw = nowX === null ? null : [nowX - measure('now') / 2, nowX + measure('now') / 2];
      const row = (x, anchor) => ({ ...box(mean.text, x, NOW_Y, anchor), row: true });
      l = [row(mean.x2, 'end'), row(x0, 'start')].find((q) => q.a >= 0 && q.b <= width && !(nw && q.a < nw[1] + LABEL_GAP && nw[0] < q.b + LABEL_GAP)) || row(mean.x2, 'end');
    }
    inPlot.push({ ...l, kind: 'mean' });
  }
  if (land && names.length) {
    const t = names.join(', ');
    const spots = [box(t, land.x2 + 4, land.y + 3.5, 'start'), box(t, land.x2 + 4, land.y - 5, 'start'), box(t, land.x2 + 4, land.y + 13, 'start'), box(t, land.x1 - 4, land.y + 3.5, 'end'), box(t, land.x1 - 4, land.y - 5, 'end')];
    const l = spots.find((q) => clear(q, true));
    if (l) inPlot.push({ ...l, kind: 'name' });
  }

  // the axis' words, in order of priority: the landing's times, each midnight's day, the first day's at the left
  // end (stopping short of the first midnight), then 06:00, 12:00 and 18:00. One that would come within
  // LABEL_GAP px of a label already placed is left out (the stock printed "12" through "13:30–15:30", B9); a midnight's
  // day first moves right of its hairline, past whatever is placed, while it stays inside its own day (a run's times
  // centered near the midnight otherwise took the day's name with them).
  const want = [];
  if (land) want.push({ text: land.words, x: (land.x1 + land.x2) / 2, anchor: 'middle', kind: 'run', clamp: true });
  mids.forEach((i, k) => want.push({ text: dayShort(startWall(M, i)), x: X(i), anchor: 'middle', kind: 'day', mid: true, stop: k + 1 < mids.length ? X(mids[k + 1]) - LABEL_GAP : Infinity }));
  if (n) want.push({ text: dayShort(startWall(M, 0)), x: x0, anchor: 'start', kind: 'day', stop: mids.length ? X(mids[0]) - LABEL_GAP : Infinity });
  for (const i of hours) want.push({ text: hm(startWall(M, i)), x: X(i), anchor: 'middle', kind: 'hour' });
  const labels = [], dropped = [];
  for (const l of want) {
    const w = measure(l.text);
    let a = l.anchor === 'start' ? l.x : l.x - w / 2, anchor = l.anchor;
    if (l.clamp) a = Math.max(0, Math.min(width - w, a));
    let b = a + w;
    if (l.mid && labels.some((p) => a < p.b + LABEL_GAP && p.a < b + LABEL_GAP)) {
      a = l.x + LABEL_GAP;
      for (let k = 0; k <= labels.length; k++) { const p = labels.find((q) => a < q.b + LABEL_GAP && q.a < a + w + LABEL_GAP); if (!p) break; a = p.b + LABEL_GAP; }
      b = a + w;
      anchor = 'start';
    }
    if (a < 0 || b > width || b > (l.stop ?? Infinity) || labels.some((p) => a < p.b + LABEL_GAP && p.a < b + LABEL_GAP)) { dropped.push(l.text); continue; }
    labels.push({ text: l.text, x: l.clamp ? a + w / 2 : anchor === 'start' ? a : l.x, anchor, kind: l.kind, a, b });
  }
  return { G, n, stairs, neg, zero: S.lo <= 0 && 0 <= S.hi ? zy : null, grid, mids, hours, land, mean, nowX, inPlot, labels, dropped, past };
}

/** The interval under x (drawing coordinates). A tap off the plot picks nothing; a drag clamps to the ends. */
export function indexAt(L, x, clamp = false) {
  const { xs, x0, PW } = L.G;
  if (!clamp && (x < x0 - 2 || x > x0 + PW + 2)) return null;
  let lo = 0, hi = L.n - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (xs[m] <= x) lo = m; else hi = m - 1; }
  return Math.max(0, Math.min(L.n - 1, lo));
}
/** The center of interval i's column, where the tracer head stands. */
export const centerOf = (L, i) => (L.G.xs[i] + L.G.xs[i + 1]) / 2;

/** The caption line (two lines below 640 px, one from 640). */
export const caption = (M) => `${M.u.label}, spot price per ${M.stepMin === 60 ? 'hour' : `${M.stepMin}${NB}min`}, before grid rent, tax and VAT. Ink: the chosen run at its mean price.`;

/** What VoiceOver reads once as the slider's description: the file's span, its lowest and highest, the run. */
export function describe(M, run, name, hours) {
  if (!M.n) return 'No prices in the file.';
  const a = startWall(M, 0), many = M.dates.length > 1;
  const at = (i) => { const w = startWall(M, i); return `${many ? `${spokenDate(w)}, ` : ''}${hm(w)}`; };
  const lo = M.iv.findIndex((x) => x.v === M.min), hi = M.iv.findIndex((x) => x.v === M.max);
  const head = `${count(M.n, M.noun[0], M.noun[1])} from ${spokenDate(a)}, ${hm(a)}. Lowest ${price(M.min)} at ${at(lo)}, highest ${price(M.max)} at ${at(hi)}.`;
  if (!run || run.none) return `${head} ${name}: no run of ${spokenLength(hours)} fits.`;
  const p = M.meanAhead > 0 ? Math.round(((M.meanAhead - run.mean) / M.meanAhead) * 100) : null;
  const where = M.history ? 'in the file' : 'ahead';
  const vs = run.mean < 0 ? ', paid to run it' : p === null ? '' : p === 0 ? `, level with the mean ${where}` : `, ${int(Math.abs(p))} percent ${p > 0 ? 'below' : 'above'} the mean ${where}`;
  return `${head} ${name}: cheapest ${spokenLength(hours)} ${where} ${runWords(M, run, true)}, mean ${spokenPrice(run.mean, M.u)}${vs}.`;
}

/**
 * Draws the layout into `svg`. Returns place(i), which moves the chosen column and the tracer head to interval
 * i without drawing anything else (the scrub's per-frame work), and press(on).
 */
export function draw(svg, L) {
  const NS = svg.namespaceURI, { G } = L, X = (i) => G.xs[i];
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
  const col = add(svg, 'rect', { class: 'col', x: X(0), y: G.top, width: 1, height: G.plotH });
  for (const t of L.grid) {
    add(svg, 'rect', { class: t.zero ? 'zero' : 'grid', x: G.x0, y: Math.round(t.y) - (t.zero ? 0.5 : 0.5), width: G.PW, height: 1 });
    add(svg, 'text', { class: 'tl', x: G.x0 - TICK_PAD, y: c(t.y + 3.5), 'text-anchor': 'end' }, t.label);
  }
  if (L.neg) add(svg, 'path', { class: 'neg', d: L.neg });
  for (const i of L.mids) add(svg, 'rect', { class: 'hair', x: X(i) - 0.5, y: G.top, width: 1, height: G.plotH });
  if (L.stairs.past) add(svg, 'path', { class: 'st past', d: L.stairs.past });
  if (L.stairs.ahead) add(svg, 'path', { class: 'st', d: L.stairs.ahead });
  if (L.mean) add(svg, 'line', { class: 'mean', x1: L.mean.x1, x2: L.mean.x2, y1: c(L.mean.y), y2: c(L.mean.y) });
  const landing = add(svg, 'g', { class: 'landing' });
  if (L.land) {
    const { x1, x2, y } = L.land;
    add(landing, 'rect', { class: 'lvl', x: x1, y: c(y - 1), width: x2 - x1, height: 2 });
    for (const x of [x1, x2 - 1]) add(landing, 'rect', { class: 'post', x, y: c(y + 1), width: 1, height: c(Math.max(0, G.foot - y - 1)) });
    add(landing, 'rect', { class: 'brk', x: x1, y: G.base + 3, width: x2 - x1, height: 2 });
    for (const x of [x1, x2 - 1]) add(landing, 'rect', { class: 'brk', x, y: G.base + 1, width: 1, height: 4 });
  }
  for (const l of L.inPlot) add(svg, 'text', { class: `halo ${l.kind}`, x: l.x, y: c(l.y), 'text-anchor': l.anchor }, l.text);
  if (L.nowX !== null) {
    add(svg, 'text', { class: 'lab nowl', x: c(L.nowX), y: NOW_Y, 'text-anchor': 'middle' }, 'now');
    add(svg, 'rect', { class: 'now', x: Math.round(L.nowX), y: 11, width: 1, height: G.top - 11 });
  }
  add(svg, 'rect', { class: 'base', x: G.x0, y: G.base, width: G.PW, height: 1 });
  for (const i of L.mids) add(svg, 'rect', { class: 'mt', x: X(i) - 0.5, y: G.base + 1, width: 1, height: 7 });
  for (const i of L.hours) add(svg, 'rect', { class: 'ht', x: X(i) - 0.5, y: G.base + 1, width: 1, height: 3 });
  for (const l of L.labels) add(svg, 'text', { class: l.kind === 'run' ? 'lab run' : 'lab', x: c(l.x), y: G.base + 18, 'text-anchor': l.anchor }, l.text);
  const head = add(svg, 'g', { class: 'head' });
  const rule = add(head, 'rect', { x: 0, y: G.base - 8.5, width: 1.5, height: 18 });
  const ring = add(head, 'circle', { class: 'ring', cx: 0, cy: G.base + 0.5, r: 7 });
  const disc = add(head, 'circle', { cx: 0, cy: G.base + 0.5, r: 4 });
  let pressed = false;
  return {
    place(i) {
      const cx = centerOf(L, i);
      col.setAttribute('x', X(i));
      col.setAttribute('width', X(i + 1) - X(i));
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
