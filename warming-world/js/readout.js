// The year row, the legend and its counts, the notices and the errors (DESIGN §3.2, §3.3, §3.7, §7.3).
// Every number here is the snapshot's: GISS's global mean, the coverage, the beyond-scale counts, the
// release. Values are printed from integers (units.js) and cut from step to step: nothing counts up.

import { $, cssVar, setText, richText, el } from './util.js';
import { rampRGB, absRGB, css, HATCH_GROUND, HATCH_LINE, MAP_SCALE, ABS_LO, ABS_HI } from './ramp.js';
import { hundredths, tenths, degC, percent, group, temp, MINUS, NNBSP, monthName, MONTH } from './units.js';

/* ── the year row (§3.3): the step's name, and GISS's mean and the coverage for that step ── */
let rollPrev = '';
/** The step's parts for the year row and for every label that names it. M: the measure (measure.js):
 *  a difference names its baseline; a temperature is an estimate, said with GISS's ±0.5 °C. */
export function stepText(idx, k, M) {
  const months = k >= idx.ny, partial = k === idx.partial, abs = M && M.abs && M.clim;
  const meanV = abs ? degC(temp(M.absMean(k))) : degC(hundredths(M ? M.meanH(k) : idx.meanH[k]));
  const base = M ? M.baseFor(k) : idx.baseText, n = partial ? `${idx.partialMonths}\u00a0months` : '';   // no-break: "(8 months)" and "vs. 1951–1980" never split
  const baseNB = base.replace('–', '–\u2060');                                                       // nor at the en dash (U+2060, as the caption)
  return {
    figure: months ? idx.short[k] : String(idx.years[k]),
    sub: partial ? `${idx.partialSpan}, partial` : '',
    meanLead: partial ? 'Global mean so far ' : 'Global mean ',
    meanVal: meanV,
    meanTail: abs ? ` (±0.5${NNBSP}°C${n ? `, ${n}` : ''})` : ` vs.\u00a0${baseNB}${n ? ` (${n})` : ''}`,
    cover: `Data cover ${percent(M ? M.stats(k).area : idx.area[k])} of Earth’s surface`,
    name: idx.name[k],                                   // "1998", "2026, Jan–Jul (partial)", "July 2026"
    spoken: (months ? `${idx.name[k]}, global mean ${meanV}`
      : partial ? `${idx.years[k]}, partial, January to ${MONTH[idx.partialMonths - 1]}, global mean so far ${meanV}`
        : `${idx.years[k]}, global mean ${meanV}`) + (abs ? ', estimated' : M && M.custom() && !months ? ` against ${base}` : ''),
  };
}

/** Write the year row for layer k. rolling: the digits that change roll in (play only, ART moment 2). */
export function renderYearRow(idx, k, rolling, M) {
  const t = stepText(idx, k, M);
  setText($('year'), t.figure);
  setText($('year-sub'), t.sub);
  setText($('mean-lead'), t.meanLead); setText($('mean-val'), t.meanVal); setText($('mean-tail'), t.meanTail);
  setText($('cover'), t.cover);
  const fig = $('year').parentElement, roll = $('year-roll');
  if (rolling) {
    // an aria-hidden twin over the true text (Earth's History's pattern): only the digits that changed
    if (roll.hidden) { roll.hidden = false; roll.textContent = ''; rollPrev = ''; }
    fig.classList.add('rolling');
    const txt = t.figure;
    if (roll.childNodes.length !== txt.length) { roll.textContent = ''; for (const ch of txt) roll.append(el('span', '', ch)); rollPrev = txt; }
    for (let i = 0; i < txt.length; i++) {
      if (txt[i] === rollPrev[i]) continue;
      const s = el('span', 'in', txt[i]);
      roll.replaceChild(s, roll.childNodes[i]);
    }
    rollPrev = txt;
  } else if (!roll.hidden) {
    roll.hidden = true; roll.textContent = ''; rollPrev = '';
    fig.classList.remove('rolling');
  }
  return t;
}

/* ── the legend (§7.3, ART): 81 graduated steps with pointed ends, ticks, labels, the hatch key ── */
function font(x, weight = 400) {
  x.font = `semi-condensed ${weight} 10.5px Archivo, system-ui, -apple-system, sans-serif`;
  if ('fontStretch' in x) x.fontStretch = 'semi-condensed';
}
/**
 * Lines 1–2 on the canvas: the bar (one step per 0.1 °C byte from −4.0 to +4.0, the LUT itself),
 * its pointed ends, ticks every 0.5 °C, labels under −4, −2, 0, +2, +4, the hatch swatch and "no
 * data", and the step's beyond-scale counts (strictly beyond ±4.0, CONTRACT §3.4).
 */
export function drawLegendBar(canvas, dpr, above, below, abs = false) {
  const w = canvas.clientWidth || 358, h = 30;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const x = canvas.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  const ink = cssVar('--card-ink'), ink2 = cssVar('--card-ink-2');
  // the difference: 81 steps of 0.1 °C from −4 to +4; the temperature: 101 steps of 1 °C from −60 to +40
  const lo = abs ? ABS_LO : -MAP_SCALE, hi = abs ? ABS_HI : MAP_SCALE, per = abs ? 1 : 10, rgb = abs ? absRGB : rampRGB;
  const steps = (hi - lo) * per + 1, CW = abs ? 2.085 : 2.6, x0 = 16, y0 = 3, bh = 9, x1 = x0 + steps * CW;
  for (let k = 0; k < steps; k++) {
    x.fillStyle = css(rgb(lo + k / per));
    x.fillRect(x0 + k * CW, y0, CW + 0.03, bh);
  }
  x.fillStyle = css(rgb(lo)); x.beginPath(); x.moveTo(x0, y0); x.lineTo(x0 - 7, y0 + bh / 2); x.lineTo(x0, y0 + bh); x.fill();
  x.fillStyle = css(rgb(hi)); x.beginPath(); x.moveTo(x1, y0); x.lineTo(x1 + 7, y0 + bh / 2); x.lineTo(x1, y0 + bh); x.fill();
  const tickX = (v) => Math.round((x0 + (v - lo) * per * CW + CW / 2) * dpr) / dpr + 0.5 / dpr;
  x.strokeStyle = ink; x.lineWidth = 1;
  const tk = abs ? 10 : 0.5, big = abs ? 20 : 2;                   // ticks every 10 °C (0.5 °C), long every 20 (2)
  for (let v = lo; v <= hi + 1e-9; v += tk) {
    const b = Math.abs(Math.round(v / big) * big - v) < 1e-9;
    x.globalAlpha = b ? 0.9 : 0.45;
    x.beginPath(); x.moveTo(tickX(v), y0 + bh); x.lineTo(tickX(v), y0 + bh + (b ? 4 : 2)); x.stroke();
  }
  x.globalAlpha = 1;
  font(x); x.textBaseline = 'top'; x.fillStyle = ink;
  const ly = y0 + bh + 5;
  const sg = (v) => (v > 0 ? `+${v}` : v < 0 ? `${MINUS}${-v}` : '0');
  const label = (v, txt, anchor) => { const tw = x.measureText(anchor).width; x.fillText(txt, tickX(v) - tw / 2, ly); };
  label(lo, `≤${NNBSP}${sg(lo)}`, `≤${NNBSP}${sg(lo)}`);
  for (let v = lo + big; v < hi; v += big) label(v, sg(v), sg(v));
  label(hi, `≥${NNBSP}${sg(hi)}${NNBSP}°C`, `≥${NNBSP}${sg(hi)}`);
  // the hatch key at the right of line 1, the beyond counts at the right of line 2
  const hx = w - 14 - 4 - x.measureText('no data').width;
  x.save(); x.beginPath(); x.rect(hx, y0, 14, bh); x.clip();
  x.fillStyle = css(HATCH_GROUND); x.fillRect(hx, y0, 14, bh);
  x.strokeStyle = css(HATCH_LINE); x.lineWidth = 1.5;
  for (let s = -12; s < 24; s += 6 / Math.SQRT2) { x.beginPath(); x.moveTo(hx + s, y0 + bh); x.lineTo(hx + s + bh, y0); x.stroke(); }
  x.restore();
  x.fillStyle = ink; x.textBaseline = 'middle'; x.fillText('no data', hx + 18, y0 + bh / 2 + 0.5);
  // the counts at the right of line 2 when they clear the "≥ +4 °C" label, with their noun where it fits
  // (review nit: "846 cells above +4"); else the caption carries them
  const cl = (n) => `${group(n)} cell${n === 1 ? '' : 's'}`;
  const say = (noun) => (below && above ? `${noun(below)} below, ${group(above)} above` : below ? `${noun(below)} below ${sg(lo)}` : above ? `${noun(above)} above ${sg(hi)}` : '');
  const capEnd = tickX(hi) - x.measureText(`\u2265${NNBSP}${sg(hi)}`).width / 2 + x.measureText(`\u2265${NNBSP}${sg(hi)}${NNBSP}°C`).width;
  const room = (t) => !t || w - x.measureText(t).width >= capEnd + 8;
  let beyond = say(cl);
  if (!room(beyond)) beyond = say(group);
  const fits = room(beyond);
  if (beyond && fits) { x.fillStyle = ink2; x.textBaseline = 'top'; x.textAlign = 'right'; x.fillText(beyond, w, ly); x.textAlign = 'left'; }
  if (fits) return '';
  const cells = [];
  if (below) cells.push(`${group(below)} cell${below === 1 ? '' : 's'} below ${sg(lo)}${NNBSP}°C`);
  if (above) cells.push(`${group(above)} cell${above === 1 ? '' : 's'} above ${sg(hi)}${NNBSP}°C`);
  return `${cells.join(', ')}.`;
}

/** The credit constant (§20 Q-5; plan 0012: it is About's first line under "Sources and citations",
 *  no longer on the legend): the snapshot's attribution with its "Temperature:" label read as "Data:"
 *  and GISS's long product name shortened to its acronym. */
export function creditLine(attr) {
  return String(attr || '').replace(/^Temperature:\s*/, 'Data: ').replace(/ Surface Temperature Analysis \(/, ' (');
}

/** Line 3: the caption, one line where it fits: what the colors are, against which years. */
export function renderLegendText(idx, k, M, beyondLead = '') {
  const months = k >= idx.ny, partial = k === idx.partial, abs = M && M.abs && M.clim;
  let cap = (beyondLead ? `${beyondLead} ` : '') + (abs ? `Estimated temperature: each place’s ${idx.baseText} average plus GISS’s anomaly.`
    : `Anomaly vs. each place’s ${M ? M.baseFor(k) : idx.baseText} average, not temperature.`);
  if (months && !abs) cap += ' Single months swing further than years.';
  if (partial) cap += ` Partial year: ${idx.partialSpan}.`;
  if (idx.release.mode === 'research' && matchMedia('(max-width: 359px)').matches) cap += ' From an archived copy.';   // the stamp's tail is hidden there
  richText($('legend-caption'), cap.replace(/\u2013/g, '\u2013\u2060'));   // a word joiner: "Jan–Jul" never breaks at its dash
}

/* ── notices (§3.2): one line each on a sheet chip; never amber or red ── */
const live = new Map();
export function notice(id, text, ms = 0) {
  const box = $('notices');
  let n = live.get(id);
  if (!text) {
    if (n) { n.el.classList.remove('in'); clearTimeout(n.t); const e = n.el; setTimeout(() => e.remove(), 220); live.delete(id); }
    return;
  }
  if (!n) { n = { el: el('div', 'notice') }; n.el.dataset.id = id; box.append(n.el); live.set(id, n); requestAnimationFrame(() => requestAnimationFrame(() => n.el.classList.add('in'))); }
  richText(n.el, text);
  clearTimeout(n.t);
  if (ms) n.t = setTimeout(() => notice(id, null), ms);
}
export const notices = () => [...live.values()].map((n) => n.el.textContent);

/** The panel's sentence when the Earth cannot be shown (§3.7). */
export function showError(text) {
  const e = $('error');
  e.hidden = !text;
  setText(e, text || '');
}
