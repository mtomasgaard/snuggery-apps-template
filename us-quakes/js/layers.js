// The Layers panel (DESIGN §10.1): six switches, the units and the volcano status's reading time; and the
// legend card "Reading the map", whose keys are drawn with the map's own marks (KEYS, reused by About).
// Its words describe the app's own display, never a USGS field.

import { el, sizeCanvas, cssVar, xBtn, radios, nums } from './util.js';
import { drawDot, dotSize, rampBar, VOLCANO, HOLLOW_MIN_M } from './ramp.js';
import { triangle } from './overlay.js';
import { dist } from './units.js';

const THREATS = [['Very High Threat', 11], ['High Threat', 10], ['Moderate Threat', 9], ['Low Threat', 8], ['Very Low Threat', 7]];
function key(A, w, h, f) { const c = el('canvas'); f(sizeCanvas(c, w, h, A.dpr)); c.setAttribute('aria-hidden', 'true'); return c; }
export const KEYS = {
  sizes: (A) => key(A, 64, 22, (x) => { let cx = 3; for (const M of [3, 5, 7, 9]) { const d = dotSize(M); cx += d / 2; drawDot(x, cx, 11, d, 5, false, A.dpr); cx += d / 2 + 3; } }),
  ramp: (A) => key(A, 64, 8, (x) => rampBar(x, 0, 1, 64, 6)),
  hollow: (A) => key(A, 64, 22, (x) => { drawDot(x, 9, 11, dotSize(6), 5, true, A.dpr); drawDot(x, 24, 11, dotSize(1), 5, true, A.dpr); }),
  grey: (A) => key(A, 64, 22, (x) => {
    drawDot(x, 11, 11, dotSize(4.5), null, false, A.dpr);
    x.strokeStyle = cssVar('--ink'); x.lineWidth = 1.25; x.beginPath(); x.moveTo(29, 8); x.lineTo(35, 14); x.moveTo(35, 8); x.lineTo(29, 14); x.stroke();
  }),
  faults: (A) => key(A, 64, 22, (x) => {
    x.strokeStyle = cssVar('--fault');
    [[1.4, 0.9], [0.9, 0.6], [0.6, 0.35]].forEach(([w, a], k) => { x.globalAlpha = a; x.lineWidth = w; x.beginPath(); x.moveTo(2, 5 + k * 6); x.lineTo(62, 5 + k * 6); x.stroke(); });
    x.globalAlpha = 1;
  }),
  faultKinds: (A) => key(A, 64, 22, (x) => {
    x.strokeStyle = cssVar('--fault'); x.lineWidth = 1; x.globalAlpha = 0.9;
    [[1, 3], [3, 3]].forEach((d, k) => { x.setLineDash(d); x.beginPath(); x.moveTo(2, 7 + k * 8); x.lineTo(62, 7 + k * 8); x.stroke(); });
    x.setLineDash([]); x.globalAlpha = 1;
  }),
  // filled only when this copy has read the status: otherwise every triangle on the map is empty, and so is the key
  volcanoes: (A) => key(A, 64, 22, (x) => { let cx = 6; THREATS.forEach(([, s], k) => { triangle(x, cx, 12, s, A.vstat.known ? [VOLCANO.ORANGE, VOLCANO.GREEN, null, VOLCANO.YELLOW, null][k] : null); cx += s + 2; }); }),
  trace: (A) => key(A, 64, 22, (x) => { x.fillStyle = cssVar('--ink'); x.globalAlpha = 0.5; for (let k = 0; k < 9; k++) { x.beginPath(); x.arc(4 + k * 7, 11 + ((k * 5) % 7) - 3, 0.8, 0, 7); x.fill(); } }),
};

// every size, depth and count in the card's words is set in mono (ART.md "Type"); the volcano key says so
// when the status was never read (DESIGN §10.1)
export function legendCard(A) {
  const d = el('div', 'legend-card glass'), n = (A.about && A.about.numbers) || {};
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Reading the map');
  d.append(el('h2', null, 'Reading the map'));
  for (const [k, t] of [['sizes', `M 3 · 5 · 7 · 9: each whole magnitude doubles the area; M ${n.sizeFloor || '2.2'} and below share the smallest dot`],
    ['ramp', `Depth, 0 to ${dist(+(n.rampDeepKm || 300))} and deeper`],
    ['hollow', `Hollow: automatic, last 30 days; never smaller than an M ${HOLLOW_MIN_M} dot`], ['grey', 'Gray: no depth · ×: no magnitude'],
    ['faults', 'Faults: historic · late · undifferentiated Quaternary'], ['faultKinds', 'Dotted: class B · dashed: inferred'],
    ['volcanoes', A.vstat.known ? 'Volcanoes by threat class; filled: USGS color code; empty: not monitored' : 'Volcanoes by threat class; volcano status not available in this copy'],
    ['trace', 'Faint specks: earlier in this play']]) {
    const r = el('p', 'krow'), s = el('span'); s.append(nums(t)); r.append(KEYS[k](A), s); d.append(r);
  }
  return d;
}

const LAYERS = [['relief', 'Shaded relief'], ['bathy', 'Sea depth'], ['faults', 'Faults'], ['volcanoes', 'Volcanoes'], ['states', 'State lines'], ['labels', 'Labels']];
export function layersPanel(A, box) {
  box.textContent = '';
  const h = el('div', 'l1'); h.append(el('h2', null, 'Layers'));
  h.append(xBtn('Close Layers', () => A.toggleLayers(false)));
  box.append(h);
  for (const [k, t] of LAYERS) {
    const b = el('button', 'sw'); b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(A.st.layers[k]));
    b.append(el('span', null, t), el('i'));
    b.onclick = () => A.setLayer(k, !A.st.layers[k]);
    box.append(b);
  }
  box.append(unitsSeg(A));
  const vs = A.vstat;
  box.append(el('p', 'note', vs.known ? `Volcano status read ${vs.readAt ? vs.readAt.replace('T', ' ').slice(0, 16) + ' UTC' : 'at an unknown time'}.` : 'Volcano status not available in this copy.'));
}
export const unitsSeg = (A) => radios('Units', [['si', 'SI: km, m'], ['us', 'US: mi, ft']], A.st.units, (units) => A.set({ units }));
