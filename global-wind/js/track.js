// The time track (DESIGN §2, ART "The time track"): the app's own slider, so a touch anywhere on it
// lands on the step under the finger, with no slop and no thumb to find. The element is role="slider";
// this draws its canvas — the baseline, the exposure so far, a tick per step, a longer one at each local
// midnight with its day, a `now` notch, and the tracer-head thumb at the SHOWN step, never gliding.
// The handlers only record what the finger wants; app.js's frame draws it.

import { dayTick } from './units.js';

export const PAD = 10;                    // CSS px from each end of the element to the first and last step
export const TRACK_H = 58;
const BASE_Y = 24, FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createTrack(el, canvas, { onScrub, onStart, onEnd, onKey } = {}) {
  const ctx = canvas.getContext('2d');
  const T = { pressed: false, finger: null, wanted: null };
  let W = 1, dpr = 1, model = null, cache = null, cacheKey = '', tokens = null;

  const xOf = (k) => PAD + (model.n > 1 ? (k / (model.n - 1)) * (W - 2 * PAD) : 0);
  /** The step under a client x: the nearest step to the finger, clamped. */
  T.stepAt = (clientX) => {
    if (!model) return 0;
    const r = el.getBoundingClientRect();
    const k = Math.round(((clientX - r.left - PAD) / Math.max(1, r.width - 2 * PAD)) * (model.n - 1));
    return Math.max(0, Math.min(model.n - 1, k));
  };
  T.resize = () => {
    const r = el.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.round(W * dpr), ch = Math.round(TRACK_H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    cacheKey = '';
  };
  /** m: { n, valid: [ms per step], now: fractional step or null } */
  T.setModel = (m) => { model = m; cacheKey = ''; };
  /** The theme or the face changed: the tokens are read again, once, on the next draw. */
  T.invalidate = () => { cacheKey = ''; tokens = null; };

  function build() {
    const c = cache || (cache = document.createElement('canvas'));
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, TRACK_H);
    const { lineStrong, ink2, ink3 } = tokens;
    x.fillStyle = lineStrong;
    x.fillRect(PAD, BASE_Y - 0.5, W - 2 * PAD, 1);
    // a tick per step, 3 px under the baseline
    x.fillStyle = ink3; x.globalAlpha = 0.5;
    for (let k = 0; k < model.n; k++) x.fillRect(Math.round(xOf(k) * dpr) / dpr - 0.5, BASE_Y + 1, 1, 3);
    x.globalAlpha = 1;
    // each local midnight: a 7 px tick and its day under it
    const mids = [];
    const v = model.valid;
    for (let k = 1; k < model.n; k++) {
      const a = new Date(v[k - 1]), b = new Date(v[k]);
      if (a.toDateString() === b.toDateString()) continue;
      const mid = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
      mids.push({ at: k - 1 + (mid - v[k - 1]) / (v[k] - v[k - 1]), ms: mid });
    }
    x.font = FONT; x.textBaseline = 'top'; x.textAlign = 'center';
    const gap = mids.length > 1 ? xOf(mids[1].at) - xOf(mids[0].at) : W;
    const short = gap < x.measureText('Wed 30').width + 10;
    let placed = -Infinity;
    for (const m of mids) {
      const mx = Math.round(xOf(m.at) * dpr) / dpr;
      x.fillStyle = ink2;
      x.fillRect(mx - 0.5, BASE_Y + 1, 1, 7);
      const label = dayTick(m.ms, short), w = x.measureText(label).width;
      if (mx - w / 2 < 0 || mx + w / 2 > W || mx - w / 2 < placed + 6) continue;
      x.fillText(label, mx, BASE_Y + 12);
      placed = mx + w / 2;
    }
    // now: a 9 px notch above the baseline, with its word over it
    if (model.now !== null && model.now >= 0 && model.now <= model.n - 1) {
      const nx = Math.round(xOf(model.now) * dpr) / dpr;
      x.fillStyle = ink2;
      x.fillRect(nx - 0.5, BASE_Y - 9, 1, 9);
      x.fillStyle = ink3; x.textBaseline = 'bottom';
      x.fillText('now', Math.max(12, Math.min(W - 12, nx)), BASE_Y - 10);
    }
    cacheKey = key();
  }
  const key = () => `${model && model.n}|${model && model.valid[0]}|${model && model.now}|${W}|${dpr}`;

  /** The track with its thumb at step `shown` (an integer while paused, fractional during play). */
  T.draw = (shown) => {
    if (!model) return;
    // the colors are read from the stylesheet once per theme, never per drawn step
    if (!tokens) {
      tokens = { lineStrong: css('--line-strong'), ink2: css('--ink-2'), ink3: css('--ink-3'), ink: css('--ink'), page: css('--page') };
      cacheKey = '';
    }
    if (cacheKey !== key()) build();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { ink, page } = tokens, tx = Math.round(xOf(shown) * dpr) / dpr;
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, BASE_Y - 1, Math.max(0, tx - PAD), 2);          // the exposure so far
    ctx.fillRect(tx - 0.75, BASE_Y - 9, 1.5, 18);                        // the rule through the head
    const r = T.pressed ? 5 : 4;
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r + 3, 0, Math.PI * 2); ctx.fillStyle = page; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  };

  /* The finger: a touch anywhere on the element jumps to the step under it. */
  let pid = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !model) return;
    e.preventDefault();
    pid = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (onStart) onStart();                   // first: stopping play must not undo the finger's step
    T.pressed = true; T.finger = e.clientX; T.wanted = T.stepAt(e.clientX);
    if (onScrub) onScrub(T.wanted);
  });
  el.addEventListener('pointermove', (e) => {
    if (!T.pressed || e.pointerId !== pid) return;
    T.finger = e.clientX; T.wanted = T.stepAt(e.clientX);
    if (onScrub) onScrub(T.wanted);
  });
  const up = (e) => {
    if (!T.pressed || e.pointerId !== pid) return;
    T.pressed = false; pid = null;
    if (onEnd) onEnd();
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -8, PageUp: 8, Home: 'home', End: 'end' }[e.key];
    if (k === undefined || !onKey) return;
    e.preventDefault();
    onKey(k);
  });
  return T;
}
