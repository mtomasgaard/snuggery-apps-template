// The tap card (DESIGN §8, ART "Designed objects" and signature moment 4): opaque paper with a hairline
// edge, no shadow or blur. The place line, the cell's value for the step on screen against its own
// 1951–1980 average (or "no estimate"), and the cell's line from 1880: the base-period band, the zero
// line and GISS's global mean at once, then the cell's own line drawn from the first year to the newest
// over 480 ms at a constant number of years per millisecond, with the cell's own stripes on the map's
// ±4 °C scale filling at the same pace (all at once under Reduce Motion). A step change moves only the
// year rule and the dot. In Last 24 months, the cell's 24 months as bars. Every number is the
// snapshot's: the cell's bytes from the decoded frames, GISS's means, the rules in snapshot.annual.
// The footnote says the rule behind the value on screen (a year, the partial year, one month), and is
// true for every cell, land or open water (review R-3, R-4). The global mean's key sits in the labels
// row under the stripes, never in the plot, so nothing ever cuts the cell's line (R-1). A horizontal
// drag on the chart scrubs the year, with the rule's year printed while held; a plain tap does
// nothing, so a tap meant for the globe behind the card never moves the year (R-8).

import { $, cssVar, setText, richText, reducedMotion, isNum } from './util.js';
import { rampRGB, css, HATCH_GROUND, HATCH_LINE, MAP_SCALE, ABS_LO, ABS_HI } from './ramp.js';
import { tenths, degC, whole as wholeDeg, cellBounds, monthName, MINUS, NNBSP } from './units.js';
import { CELLS, NONE, cellOf } from './data.js';

const DRAW_MS = 480;                                       // ART: the cell's line, linear in years
const NIL = -32768;
const NEAR_KM = 250;                                       // DESIGN §8: "near" a place within 250 km

function font(x, weight = 400, size = 10.5) {
  x.font = `semi-condensed ${weight} ${size}px Archivo, system-ui, -apple-system, sans-serif`;
  if ('fontStretch' in x) x.fontStretch = 'semi-condensed';
}
function sized(canvas, w, h, dpr) {
  const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  canvas.style.height = `${h}px`;
  const x = canvas.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  return x;
}
function hatch(x, x0, y0, w, h) {
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  x.fillStyle = css(HATCH_GROUND); x.fillRect(x0, y0, w, h);
  x.strokeStyle = css(HATCH_LINE); x.lineWidth = 1.2;
  for (let s = x0 - h; s < x0 + w + h; s += 6 / Math.SQRT2) { x.beginPath(); x.moveTo(s, y0 + h); x.lineTo(s + h, y0); x.stroke(); }
  x.restore();
}
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${-n}` : '0');

/** The place phrase (DESIGN §8): a place inside the cell ("with"), else the nearest within 250 km. */
export function placePhrase(places, row, col) {
  if (!places) return '';
  let inside = null, near = null, best = Infinity;
  const lat0 = (89 - 2 * row) * Math.PI / 180, lon0 = (-179 + 2 * col) * Math.PI / 180;
  for (const q of places) {
    const c = cellOf(q.lon, q.lat);
    if (c.row === row && c.col === col) { if (!inside) inside = q; continue; }
    const la = q.lat * Math.PI / 180, dl = q.lon * Math.PI / 180 - lon0;
    const h = Math.sin((la - lat0) / 2) ** 2 + Math.cos(la) * Math.cos(lat0) * Math.sin(dl / 2) ** 2;
    const km = 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
    if (km <= NEAR_KM && km < best) { best = km; near = q; }
  }
  return inside ? `, with ${inside.n}` : near ? `, near ${near.n}` : '';
}
/** The place named by a phrase ("Fairbanks"), for translate="no". */
const placeName = (phrase) => phrase.replace(/^, (?:with|near) /, '');

/**
 * The footnote for the value on screen (R-3, R-4). rules: { minMonths, share (a partial year's cell
 * needs this share of its months), km ("1 200 km", from the snapshot's detail) }; null pieces drop out.
 */
export function footText(I, layer, rules = {}, abs = false) {
  const r = rules || {};
  let how = '';
  if (layer >= I.ny) how = 'One month’s value; the line shows annual means.';
  else if (layer === I.partial) {
    const n = I.partialMonths, need = isNum(r.share) ? Math.ceil(r.share * n - 1e-9) : null;
    how = need ? `Mean of at least ${need} of its ${n} months (${I.partialSpan}).` : `Mean of the months so far (${I.partialSpan}).`;
  } else if (isNum(r.minMonths)) how = `Annual mean of at least ${r.minMonths} of 12 months.`;
  const where = r.km ? `Land and sea ice: station anomalies spread up to ${r.km}. Open water: sea-surface anomalies.` : '';
  return [how, where, abs ? 'The temperature is an ERA5-based 1951–1980 average plus GISS’s anomaly: an estimate. The chart shows the anomaly.' : ''].filter(Boolean).join(' ');
}

export function createCard({ onClose, onYear, onRedraw } = {}) {
  const C = { open: false, sel: null };
  const root = $('card'), chart = $('c-chart'), monthsCv = $('c-months');
  let I = null, M = null, frames = null, places = null, dpr = 1, layer = -1, t0 = 0, whole = true, lastP = 1, series = null, mser = null, stats = null, outT = 0, geom = null, rules = null, held = false, cellK = 0;

  /** The cell's annual values (tenths, NIL for none) and its months, read from the decoded frames. */
  function readSeries(row, col) {
    const k = cellK = row * 180 + col;
    series = new Int16Array(I.ny); mser = new Int16Array(I.nm);
    let first = -1, lo = null, hi = null;
    for (let i = 0; i < I.ny; i++) {
      const d = M.diff(i, k);                                 // against the baseline in use (measure.js)
      series[i] = d == null ? NIL : d;
      if (series[i] === NIL) continue;
      if (first < 0) first = i;
      if (i === I.partial) continue;                          // the extremes are over complete years
      if (lo == null || series[i] < series[lo]) lo = i;
      if (hi == null || series[i] > series[hi]) hi = i;
    }
    for (let m = 0; m < I.nm; m++) { const b = frames[(I.ny + m) * CELLS + k]; mser[m] = b === NONE ? NIL : I.tenths[b]; }
    let R = 2;
    for (const v of series) if (v !== NIL) R = Math.max(R, Math.ceil(Math.abs(v) / 10));
    if (R > 4) R = 2 * Math.ceil(R / 2);
    stats = { first, lo, hi, R };
  }

  /** The value line, the beyond line, the chart's name: for the step on screen. */
  function writeText() {
    const months = layer >= I.ny, abs = M.abs && !!M.clim, v = M.value(layer, cellK);
    // Absolute's sentence adds GISS's own anomaly (against 1951–1980) to the climatology, never the chart's difference
    const g = frames[layer * CELLS + cellK], a = g === NONE ? NIL : I.tenths[g];
    const when = months ? `in ${I.name[layer]}`
      : layer === I.partial ? `in ${I.years[layer]} so far (${I.partialSpan})` : `in ${I.years[layer]}`;
    const val = $('c-value'), sent = $('c-when'), note = $('c-note'), nob = !abs && M.on(layer) && M.base[cellK] === -32768;
    if (v == null) {
      val.hidden = true;
      if (nob) {
        let c = 0;
        for (let i = I.years.indexOf(M.span[0]), e = I.years.indexOf(M.span[1]); i <= e; i++) if (frames[i * CELLS + cellK] !== NONE) c++;
        setText(sent, `No baseline for this cell in ${M.text()}.`);
        setText(note, `It has a value in ${c} of those ${M.n} years and needs ${M.need}.`);
      } else {
        setText(sent, `No estimate for this cell ${when}.`);
        setText(note, stats.first < 0 ? 'No year has data.' : `First year with data: ${I.years[stats.first]}.`);
      }
      note.hidden = false;
      root.classList.add('none');
    } else {
      val.hidden = false; root.classList.remove('none');
      setText(val, degC(abs ? wholeDeg(v) : tenths(v)));
      setText(sent, abs ? `${when}, estimated: the cell’s ${I.baseText} average plus GISS’s ${degC(tenths(a))}` : `${when}, against this cell’s ${M.baseFor(layer)} average`);
      const lo = abs ? ABS_LO * 10 : -MAP_SCALE * 10, hi = abs ? ABS_HI * 10 : MAP_SCALE * 10;
      note.hidden = v >= lo && v <= hi;
      if (!note.hidden) setText(note, `Beyond the map’s ${v > 0 ? `+${hi / 10}` : `${MINUS}${-lo / 10}`}${NNBSP}°C end; drawn in the end color.`);
    }
    setText($('c-foot'), footText(I, layer, rules, abs));
    const last = I.lastComplete, span = `from ${I.years[0]} to ${I.years[last]}${M.custom() ? `, against ${M.text()}` : ''}`;
    chart.setAttribute('aria-label', stats.first < 0 || stats.lo == null
      ? `Line chart of this cell’s annual anomaly ${span}. No year has data.`
      : `Line chart of this cell’s annual anomaly ${span}. First year with data ${I.years[stats.first]}. Lowest ${degC(tenths(series[stats.lo]))} in ${I.years[stats.lo]}, highest ${degC(tenths(series[stats.hi]))} in ${I.years[stats.hi]}.`);
  }

  /** Open on a cell: ctx = { idx, frames, places, layer, dpr, rules }. */
  C.show = (sel, ctx) => {
    I = ctx.idx; M = ctx.M; frames = ctx.frames; places = ctx.places; dpr = ctx.dpr; layer = ctx.layer; rules = ctx.rules || null;
    const fresh = !C.open || !C.sel || C.sel.row !== sel.row || C.sel.col !== sel.col;
    C.sel = sel; C.open = true;
    readSeries(sel.row, sel.col);
    const ph = placePhrase(places, sel.row, sel.col);
    richText($('c-place'), `${cellBounds(sel.row, sel.col)}${ph}`, [ph && placeName(ph)]);
    monthsCv.hidden = layer < I.ny;
    writeText();
    if (fresh) { t0 = reducedMotion() ? -1e9 : performance.now(); whole = false; }
    clearTimeout(outT);
    if (root.hidden) {
      root.hidden = false; root.classList.remove('in');
      if (reducedMotion()) root.classList.add('in'); else requestAnimationFrame(() => requestAnimationFrame(() => C.open && root.classList.add('in')));
    } else root.classList.add('in');
  };
  /** The step on screen changed: the value, the rule and the dot; never a new animation. */
  C.step = (k) => {
    if (!C.open || k === layer) return;
    const was = layer >= I.ny;
    layer = k;
    if ((k >= I.ny) !== was) monthsCv.hidden = k < I.ny;
    writeText();
  };
  /** Re-read the cell (a replaced snapshot): same cell, the new numbers, no animation. */
  C.reread = (ctx) => { if (C.open) { const s = C.sel; C.open = false; C.show(s, { ...ctx }); t0 = -1e9; whole = false; } };
  C.hide = () => {
    if (!C.open) return;
    C.open = false; C.sel = null;
    root.classList.remove('in');
    clearTimeout(outT);
    if (reducedMotion()) root.hidden = true; else outT = setTimeout(() => { if (!C.open) root.hidden = true; }, 130);
  };
  /** True until the frame that draws the whole line has run (the scheduler keeps frames coming). */
  C.drawing = () => C.open && !whole;
  /** The share of the years the last frame drew (tests). */
  C.progress = () => lastP;
  /** The plot's geometry in CSS px (tests): x0, x1, n, top, ph, R. */
  C.geom = () => (geom ? { ...geom } : null);
  /** A new device pixel ratio (a resize or a move to another screen). */
  C.setDpr = (d) => { if (d !== dpr) { dpr = d; t0 = -1e9; whole = false; } };

  /** Draw the chart (and the months row). Returns true while the line is still drawing itself. */
  C.draw = () => {
    if (!C.open || !series) return false;
    const p = Math.max(0, Math.min(1, (performance.now() - t0) / DRAW_MS));
    drawChart(p);
    if (!monthsCv.hidden) drawMonths();
    whole = p >= 1; lastP = p;
    return !whole;
  };

  function drawChart(p) {
    const W = chart.clientWidth || 330, H = 124, x = sized(chart, W, H, dpr);
    const ink = cssVar('--ink'), ink3 = cssVar('--ink-3'), n = I.ny, R = stats.R;
    font(x);
    const yl = [];
    const step = R <= 4 ? 1 : 2;
    for (let t = -R; t <= R; t += step) yl.push(t);
    const gut = Math.ceil(Math.max(...yl.map((t) => x.measureText(signed(t)).width))) + 5;
    const x0 = gut, x1 = W - 4, top = 6, ph = 88, mid = top + ph / 2, bot = top + ph;
    const X = (i) => x0 + ((i + 0.5) * (x1 - x0)) / n, Y = (t) => mid - (t / (R * 10)) * (ph / 2);
    geom = { x0, x1, n, top, ph, R };
    // the base period's band, the grid, the zero line, GISS's global mean: at once (the context)
    const bs = M.custom() ? M.span : I.base, b0 = I.years.indexOf(bs[0]), b1 = I.years.indexOf(bs[1]);
    x.globalAlpha = 0.07; x.fillStyle = ink;
    if (b0 >= 0 && b1 >= 0) x.fillRect(X(b0) - (x1 - x0) / n / 2, top, X(b1) - X(b0) + (x1 - x0) / n, ph);
    x.globalAlpha = 1;
    x.textBaseline = 'middle'; x.textAlign = 'right';
    for (const t of yl) {
      const y = Math.round(Y(t * 10)) + 0.5;
      x.strokeStyle = ink; x.globalAlpha = t === 0 ? 0.45 : 0.08; x.lineWidth = 1;
      x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke();
      x.globalAlpha = 1; x.fillStyle = ink3; x.fillText(signed(t), gut - 4, y);
    }
    x.textAlign = 'left';
    // while a finger scrubs the chart, the rule's year at its head, under every line (R-8): it never
    // hides the data
    const ri = layer < n ? layer : I.years.indexOf(+I.monthKeys[layer - n].slice(0, 4));
    if (held && ri >= 0) {
      const t = String(I.years[ri]), tw = x.measureText(t).width, rx = Math.round(X(ri)) + 0.5;
      const lx = Math.max(x0, Math.min(x1 - tw, rx + 4 + tw > x1 ? rx - 4 - tw : rx + 4));
      x.fillStyle = ink; x.textBaseline = 'top'; x.fillText(t, lx, top + 1);
    }
    x.strokeStyle = ink3; x.lineWidth = 1; x.lineJoin = 'round';
    x.beginPath();
    for (let i = 0; i < n; i++) { const y = Y(M.meanH(i) / 10); if (i) x.lineTo(X(i), y); else x.moveTo(X(i), y); }
    x.stroke();
    // the cell's own line, drawn from the first year at a constant rate; broken where a year has none
    const upto = p >= 1 ? n : Math.floor(p * n);
    x.strokeStyle = ink; x.lineWidth = 1.5; x.lineCap = 'round';
    x.beginPath();
    let pen = false;
    for (let i = 0; i < upto; i++) {
      const v = series[i];
      if (v === NIL || i === I.partial) { pen = false; continue; }
      const px = X(i), py = Y(v);
      if (pen) x.lineTo(px, py); else { x.moveTo(px, py); if (series[i + 1] === NIL || i + 1 >= upto || i + 1 === I.partial) { x.lineTo(px + 0.01, py); } }
      pen = true;
    }
    x.stroke();
    // years with no value: a hatched strip along the plot's foot
    for (let i = 0; i < upto; i++) if (series[i] === NIL) hatch(x, X(i) - (x1 - x0) / n / 2, bot - 3, (x1 - x0) / n + 0.3, 3);
    // the partial year's point is hollow
    if (I.partial >= 0 && upto > I.partial && series[I.partial] !== NIL) {
      x.beginPath(); x.arc(X(I.partial), Y(series[I.partial]), 2.6, 0, 2 * Math.PI);
      x.fillStyle = cssVar('--sheet'); x.fill(); x.lineWidth = 1.2; x.stroke();
    }
    // the rule at the step on screen (in Last 24 months, at its year), and its dot
    if (ri >= 0) {
      const rx = Math.round(X(ri)) + 0.5;
      x.globalAlpha = 0.6; x.strokeStyle = ink; x.lineWidth = 1;
      x.beginPath(); x.moveTo(rx, top); x.lineTo(rx, bot); x.stroke(); x.globalAlpha = 1;
      const v = series[ri];
      if (v !== NIL && upto > ri) {
        x.beginPath(); x.arc(X(ri), Y(v), 2.6, 0, 2 * Math.PI);
        if (ri === I.partial) { x.fillStyle = cssVar('--sheet'); x.fill(); x.lineWidth = 1.2; x.stroke(); } else { x.fillStyle = ink; x.fill(); }
      }
    }
    // the cell's own stripes, on the map's ±4 °C scale, hatched where a year has none
    const sy = bot + 4, sh = 10;
    for (let i = 0; i < upto; i++) {
      const a = Math.round((x0 + (i * (x1 - x0)) / n) * dpr) / dpr, b = Math.round((x0 + ((i + 1) * (x1 - x0)) / n) * dpr) / dpr;
      if (series[i] === NIL) hatch(x, a, sy, b - a, sh);
      else {
        x.fillStyle = css(rampRGB(series[i] / 10));
        if (i === I.partial) {                                // the partial year is open, as on the track
          const third = Math.round((sh / 3) * dpr) / dpr;
          x.fillRect(a, sy, b - a, third); x.fillRect(a, sy + sh - third, b - a, third);
        } else x.fillRect(a, sy, b - a, sh);
      }
    }
    // labels: the first year, the base period under its band, the newest year
    x.fillStyle = ink3; x.textBaseline = 'top';
    const ly = sy + sh + 2, lab = [[String(I.years[0]), x0, 'left']];
    if (b0 >= 0 && b1 >= 0) {                              // the baseline's years, kept clear of both ends
      const t = M.text(), w = x.measureText(t).width;
      lab.push([t, Math.max(x0 + w / 2, Math.min(x1 - w / 2, (X(b0) + X(b1)) / 2)), 'center']);
    }
    lab.push([String(I.years[n - 1]), x1, 'right']);
    const boxes = [], at = lab.map(([t, lx, al]) => { const w = x.measureText(t).width, a = al === 'left' ? lx : al === 'right' ? lx - w : lx - w / 2; return [a, a + w]; });
    lab.forEach(([t, lx, al], i) => {
      // an end year that would touch the baseline's label gives way to it (the label names the zero)
      if (lab.length === 3 && i !== 1 && at[i][0] < at[1][1] + 6 && at[i][1] > at[1][0] - 6) return;
      x.textAlign = al; x.fillText(t, lx, ly); boxes.push(at[i]);
    });
    // the global mean's key (R-1): a sample of its line, then its name, in the first gap that holds it
    const kt = 'global mean', kw = 12 + 4 + x.measureText(kt).width;
    let kx = null;
    for (let j = 0; j + 1 < boxes.length && kx == null; j++) if (boxes[j + 1][0] - boxes[j][1] >= kw + 16) kx = (boxes[j][1] + boxes[j + 1][0] - kw) / 2;
    if (kx != null) {
      const my = Math.round(ly + 6) + 0.5;
      x.strokeStyle = ink3; x.lineWidth = 1; x.beginPath(); x.moveTo(kx, my); x.lineTo(kx + 12, my); x.stroke();
      x.textAlign = 'left'; x.fillStyle = ink3; x.fillText(kt, kx + 16, ly);
    }
    geom.key = kx;
    x.textAlign = 'left';
  }

  function drawMonths() {
    const W = monthsCv.clientWidth || 330, H = 40, x = sized(monthsCv, W, H, dpr);
    const ink = cssVar('--ink'), ink3 = cssVar('--ink-3'), m = I.nm, gut = geom ? geom.x0 : 24, x1 = W - 4;
    const sw = (x1 - gut) / m, mid = 14, half = 11, on = layer - I.ny;
    font(x);
    x.strokeStyle = ink; x.globalAlpha = 0.45; x.lineWidth = 1;
    x.beginPath(); x.moveTo(gut, mid + 0.5); x.lineTo(x1, mid + 0.5); x.stroke(); x.globalAlpha = 1;
    for (let i = 0; i < m; i++) {
      const a = gut + i * sw + 1, w = Math.max(1, sw - 2), v = mser[i];
      if (v === NIL) { hatch(x, a, mid - half, w, 2 * half); continue; }
      const h = Math.max(1, (Math.min(Math.abs(v), MAP_SCALE * 10) / (MAP_SCALE * 10)) * half);
      x.fillStyle = css(rampRGB(v / 10));
      x.fillRect(a, v >= 0 ? mid - h : mid + 1, w, h);
    }
    if (on >= 0) { x.strokeStyle = ink; x.lineWidth = 1; x.strokeRect(Math.round(gut + on * sw) + 0.5, mid - half - 1.5, Math.round(sw) - 1, 2 * half + 3); }
    x.fillStyle = ink3; x.textBaseline = 'top';
    x.textAlign = 'left'; x.fillText(monthName(I.monthKeys[0]), gut, mid + half + 3);
    x.textAlign = 'right'; x.fillText(monthName(I.monthKeys[m - 1]), x1, mid + half + 3);
    x.textAlign = 'left'; x.fillStyle = ink3; x.textBaseline = 'middle';
    x.fillText(`±${MAP_SCALE}`, 0, mid);
  }

  $('c-close').addEventListener('click', () => onClose && onClose());
  // a horizontal drag scrubs the year (R-8); a plain tap does nothing; a vertical drag scrolls the card
  let drag = null;
  const yearAt = (clientX) => { const r = chart.getBoundingClientRect(); return Math.max(0, Math.min(geom.n - 1, Math.floor(((clientX - r.left - geom.x0) / (geom.x1 - geom.x0)) * geom.n))); };
  chart.addEventListener('pointerdown', (e) => { if ((e.button !== undefined && e.button > 0) || !geom) return; drag = { id: e.pointerId, x: e.clientX, on: false, last: -1 }; });
  chart.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || !geom || !onYear) return;
    if (!drag.on) {
      if (Math.abs(e.clientX - drag.x) < 6) return;
      drag.on = true; held = true;
      try { chart.setPointerCapture(e.pointerId); } catch { /* fine */ }
    }
    const i = yearAt(e.clientX);
    if (i !== drag.last) { onYear(i, drag.last < 0 ? 0 : Math.sign(i - drag.last)); drag.last = i; }
    if (onRedraw) onRedraw();
  });
  const lift = (e) => { if (!drag || e.pointerId !== drag.id) return; const was = drag.on; drag = null; if (was) { held = false; if (onRedraw) onRedraw(); } };
  chart.addEventListener('pointerup', lift);
  chart.addEventListener('pointercancel', lift);
  return C;
}
