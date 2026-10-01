// The stripes track (DESIGN §3.4, ART "The signature control"): the scrubber as an instrument — its
// caption with the printed ±1.5 °C scale, one stripe per step inside a 1 px frame, the decade
// graduations, the 1951–1980 bracket, the labels, the open stripe of the partial year, and a reading-
// index thumb that steps from stripe to stripe and never glides. Everything but the thumb is cached
// in a bitmap per model, size, theme and press; a frame draws that bitmap and one rule.

import { cssVar } from './util.js';
import { css } from './ramp.js';

export const TRACK_H = 64;
const TY = 17, TH = 25;                  // the track's rows 17–42 (ART)
const FONT = '400 10.5px Archivo, system-ui, -apple-system, sans-serif';

/** Canvas text at width 87.5 % (ART: instrument labels are semi-condensed). */
function font(ctx) {
  ctx.font = `semi-condensed ${FONT}`;
  if ('fontStretch' in ctx) ctx.fontStretch = 'semi-condensed';
}

export function createTrack(canvas, hit, { onScrub, onStart, onEnd, onKey, onHover } = {}) {
  const T = { pressed: false, hover: false, fingerX: null, written: Infinity };
  const ctx = canvas.getContext('2d');
  let W = 1, dpr = 1, model = null, cache = null, cacheKey = '';

  /** The stripes' inner box: inside the 1 px frame. */
  const inner = () => ({ x0: 1, w: W - 2 });
  const stripeX = (i) => { const { x0, w } = inner(); return x0 + (i * w) / model.n; };
  const snap = (x) => Math.round(x * dpr) / dpr;
  /** The centre of step i's stripe, snapped to a device pixel (the thumb stands there). */
  T.centre = (i) => snap((stripeX(i) + stripeX(i + 1)) / 2);
  /** The step under a client x: the stripe under the finger, clamped. */
  T.stepAt = (clientX) => {
    if (!model) return 0;
    const r = canvas.getBoundingClientRect(), { x0, w } = inner();
    const i = Math.floor(((clientX - r.left - x0) / w) * model.n);
    return Math.max(0, Math.min(model.n - 1, i));
  };

  T.resize = (w, d) => {
    W = Math.max(1, w); dpr = d;
    const cw = Math.round(W * d), ch = Math.round(TRACK_H * d);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    cacheKey = '';
  };
  /**
   * m: { n, color(i) → [r,g,b], partial (index or −1), caption, ticks: [{i, big}], labels: [{i, text,
   *      strong, align}], bracket: [i0, i1] | null, key (changes when any of this changes) }
   */
  T.setModel = (m) => { model = m; cacheKey = ''; };
  /** The opening writes stripes only up to here; everything is written by default. */
  T.setWritten = (n) => { T.written = n; cacheKey = ''; };
  T.invalidate = () => { cacheKey = ''; };

  function build() {
    const c = cache || (cache = document.createElement('canvas'));
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, TRACK_H);
    // the frame: --line-strong at rest, --ink-2 under a hovering pointer, --ink pressed (grays only)
    const ink = cssVar('--ink'), ink2 = cssVar('--ink-2'), frame = T.pressed ? ink : T.hover ? ink2 : cssVar('--line-strong');
    font(x);
    x.textBaseline = 'alphabetic'; x.textAlign = 'left'; x.fillStyle = ink2;
    x.fillText(model.caption, 0, 10);
    // the stripes, edges snapped to device pixels so 147 stripes never shimmer
    const n = Math.min(model.n, T.written);
    for (let i = 0; i < n; i++) {
      const a = snap(stripeX(i)), b = snap(stripeX(i + 1));
      x.fillStyle = css(model.color(i));
      if (i === model.partial) {                        // the partial year is open: top and bottom thirds
        const third = snap(TH / 3);
        x.fillRect(a, TY, b - a, third);
        x.fillRect(a, TY + TH - third, b - a, third);
      } else x.fillRect(a, TY, b - a, TH);
    }
    x.strokeStyle = frame; x.lineWidth = 1;
    x.strokeRect(0.5, TY - 0.5, W - 1, TH + 1);
    // graduations under the frame
    x.strokeStyle = ink2;
    for (const t of model.ticks) {
      const gx = T.centre(t.i) + 0.5 / dpr;
      x.globalAlpha = t.big ? 1 : 0.5;
      x.beginPath(); x.moveTo(gx, TY + TH + 1); x.lineTo(gx, TY + TH + 1 + (t.big ? 5 : 3)); x.stroke();
    }
    x.globalAlpha = 1;
    // the zero's bracket: 1951–1980, with 3 px feet
    const by = TY + TH + 8.5;
    if (model.bracket) {
      const b0 = snap(stripeX(model.bracket[0])) + 0.5, b1 = snap(stripeX(model.bracket[1] + 1)) - 0.5;
      x.strokeStyle = ink;
      x.beginPath(); x.moveTo(b0, by - 3); x.lineTo(b0, by); x.lineTo(b1, by); x.lineTo(b1, by - 3); x.stroke();
    }
    // labels, placed in priority order and dropped where they would collide
    x.textBaseline = 'top';
    const placed = [], ly = TY + TH + 11;
    for (const l of model.labels) {
      const w = x.measureText(l.text).width;
      const cx = l.bracket ? (stripeX(model.bracket[0]) + stripeX(model.bracket[1] + 1)) / 2 : T.centre(l.i);
      let x0 = l.align === 'left' ? 0 : l.align === 'right' ? W - w : cx - w / 2;
      x0 = Math.max(0, Math.min(W - w, x0));
      if (placed.some(([a, b]) => x0 < b + 6 && x0 + w > a - 6)) continue;
      placed.push([x0, x0 + w]);
      x.fillStyle = l.strong ? ink : ink2;
      x.fillText(l.text, x0, ly);
    }
    cacheKey = key();
  }
  const key = () => `${model && model.key}|${W}|${dpr}|${T.pressed}|${T.hover}|${T.written}|${cssVar('--page')}`;

  /** Draw the cached instrument and the thumb at step `shown` (−1: no thumb). */
  T.draw = (shown) => {
    if (!model) return;
    if (cacheKey !== key()) build();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    if (shown < 0 || shown >= model.n) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tx = T.centre(shown);
    ctx.fillStyle = cssVar('--page');
    ctx.fillRect(tx - 2.25, TY - 3, 4.5, TH + 6);                // the halo parts the stripes
    ctx.fillStyle = cssVar('--ink');
    ctx.fillRect(tx - 0.75, TY - 3, 1.5, TH + 6);                // the reading index
    // its head sits under the caption's baseline (y 10), so it never bites the printed scale (review nit)
    ctx.beginPath(); ctx.moveTo(tx - 3.5, TY - 6); ctx.lineTo(tx + 3.5, TY - 6); ctx.lineTo(tx, TY - 2.5); ctx.closePath(); ctx.fill();
  };

  /* ── the finger: the whole row plus 8 px; each move asks for the stripe under it ── */
  let last = -1, pid = null;
  hit.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !model) return;
    e.preventDefault();
    pid = e.pointerId;
    try { hit.setPointerCapture(e.pointerId); } catch { /* fine */ }
    T.pressed = true; T.fingerX = e.clientX;
    last = T.stepAt(e.clientX);
    if (onStart) onStart();
    if (onScrub) onScrub(last, 0);
  });
  hit.addEventListener('pointermove', (e) => {
    if (!T.pressed || e.pointerId !== pid) return;
    T.fingerX = e.clientX;
    const s = T.stepAt(e.clientX);
    if (onScrub) onScrub(s, Math.sign(s - last));
    last = s;
  });
  const up = (e) => {
    if (!T.pressed || e.pointerId !== pid) return;
    T.pressed = false; pid = null;
    if (onEnd) onEnd();
  };
  hit.addEventListener('pointerup', up);
  // hover: a mouse or a pen over the row, never a touch (a touch's press is the pressed frame)
  const hover = (on) => (e) => { if (e.pointerType === 'touch' || T.hover === on) return; T.hover = on; if (onHover) onHover(); };
  hit.addEventListener('pointerenter', hover(true));
  hit.addEventListener('pointerleave', hover(false));
  hit.addEventListener('pointercancel', up);
  hit.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: 'prev', ArrowDown: 'prev', ArrowRight: 'next', ArrowUp: 'next', PageUp: 'pgup', PageDown: 'pgdn', Home: 'home', End: 'end', ' ': 'play' }[e.key];
    if (!k || !onKey) return;
    e.preventDefault();
    onKey(k);
  });
  return T;
}
