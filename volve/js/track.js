// The production history's track (ART.md sections 1 and 3; Global Weather's js/track.js adapted):
// the app's own slider, so a touch anywhere on it lands on the report date under the finger, with no
// slop and no thumb to find. The element is role="slider"; this draws its canvas.
//
// The track is the signature, the Cut: each report date's column stands on the baseline over its
// own interval on a linear day axis, as tall as the liquid the field's wells lifted per day over the
// interval to that date (1.5 px per 1 000 Sm³/d, or 0.25 px per 1 000 bbl/d), the oil in the cut's ink
// from the baseline up and the water stacked on it in the same ink thinned, with a 1 px --ink-3 top.
// A tick at the left end prints the scale, with its unit. Under the baseline, a tick and a year at each 1 January.
// The thumb is a tracer head at the SHOWN report date, never gliding; the handlers only record what
// the finger wants, and app.js's frame draws it. The columns are drawn once per size, theme and unit
// system into a cached canvas; a frame only copies it and draws the thumb.

export const PAD = 10;                    // CSS px from each end of the element to the first and last date
export const TRACK_H = 58;
const BASE_Y = 34, FOOT = 32;              // the baseline; the columns stand 2 px above it
const FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
/** The Cut's scale per system: px per unit of rate, the printed tick's value and its label. Volve's field
 *  peaks at 10 779 Sm³/d of liquid (the interval to 5 Jan 2011), so its scale is three times Norne's, and the
 *  tick stands over the tallest column (12 000 Sm³/d, 18 px), so its label never meets a column under it. */
export const CUT_SCALE = {
  SI: { pxPer: 1.5 / 1000, perSm3: 1, tick: 12000, label: '12\u202f000\u202fSm³/d' },
  US: { pxPer: 0.25 / 1000, perSm3: 6.28981, tick: 75000, label: '75\u202f000\u202fbbl/d' },
};
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createTrack(el, canvas, { onScrub, onStart, onEnd, onKey, pageStep = 12 } = {}) {
  const ctx = canvas.getContext('2d');
  const T = { pressed: false, wanted: null, builds: 0 };
  let W = 1, dpr = 1, model = null, cache = null, cacheKey = '', tokens = null;

  const span = () => model.days[model.n - 1] - model.days[0] || 1;
  const xOfDay = (d) => PAD + ((d - model.days[0]) / span()) * (W - 2 * PAD);
  T.xOf = (k) => xOfDay(model.days[k]);
  /** The report date nearest the finger, on the day axis. */
  T.stepAt = (clientX) => {
    if (!model) return 0;
    const r = el.getBoundingClientRect();
    const d = model.days[0] + ((clientX - r.left - PAD) / Math.max(1, r.width - 2 * PAD)) * span();
    let best = 0;
    for (let k = 1; k < model.n; k++) if (Math.abs(model.days[k] - d) < Math.abs(model.days[best] - d)) best = k;
    return best;
  };
  T.resize = () => {
    const r = el.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.round(W * dpr), ch = Math.round(TRACK_H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    cacheKey = '';
  };
  /** m: { n, days: [day number per report date], cut: js/data.js cutSeries, sys: 'SI' or 'US' } */
  T.setModel = (m) => { model = m; cacheKey = ''; };
  /** The theme or the face changed: the tokens are read again, once, on the next draw. */
  T.invalidate = () => { cacheKey = ''; tokens = null; };

  function build() {
    const c = cache || (cache = document.createElement('canvas'));
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    const { lineStrong, ink2, ink3, cut, waterA } = tokens, sc = CUT_SCALE[model.sys] || CUT_SCALE.SI;
    const dev = (v) => Math.round(v * dpr), foot = dev(FOOT);
    // the Cut: one column per report date, in device pixels, every interval drawn
    for (const s of model.cut) {
      if (!(s.liquid > 0)) continue;
      const x0 = dev(xOfDay(s.d0)), x1 = Math.max(x0 + 1, dev(xOfDay(s.d1)));
      const ho = dev(s.oil * sc.perSm3 * sc.pxPer), hl = Math.max(ho, dev(s.liquid * sc.perSm3 * sc.pxPer));
      x.fillStyle = cut;
      x.fillRect(x0, foot - ho, x1 - x0, ho);
      x.globalAlpha = waterA;
      x.fillRect(x0, foot - hl, x1 - x0, hl - ho);
      x.globalAlpha = 1;
      x.fillStyle = ink3;
      x.fillRect(x0, foot - hl - dev(1), x1 - x0, dev(1));
    }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the baseline
    x.fillStyle = lineStrong;
    x.fillRect(PAD, BASE_Y - 0.5, W - 2 * PAD, 1);
    // the scale: a 3 px tick at the printed value's true height, its figure over it
    const ty = FOOT - sc.tick * sc.pxPer;
    x.fillStyle = ink3;
    x.fillRect(PAD - 3, Math.round(ty * dpr) / dpr - 0.5, 3, 1);
    x.font = FONT; x.textBaseline = 'bottom'; x.textAlign = 'left';
    x.fillText(sc.label, 0, ty - 1);
    // each 1 January: a 7 px tick and its year under it, labels that would collide skipped
    x.fillStyle = ink2; x.textBaseline = 'top'; x.textAlign = 'center';
    let placed = -Infinity;
    for (const y of model.years) {
      const mx = Math.round(xOfDay(y.day) * dpr) / dpr;
      if (mx < PAD || mx > W - PAD) continue;
      x.fillRect(mx - 0.5, BASE_Y + 1, 1, 7);
      const w = x.measureText(y.label).width;
      if (mx - w / 2 < 0 || mx + w / 2 > W || mx - w / 2 < placed + 8) continue;
      x.fillText(y.label, mx, BASE_Y + 10);
      placed = mx + w / 2;
    }
    cacheKey = key();
    T.builds++;
  }
  const key = () => `${model && model.n}|${model && model.sys}|${W}|${dpr}`;

  /** The track with its thumb at report date `shown`. */
  T.draw = (shown) => {
    if (!model) return;
    // the colors are read from the stylesheet once per theme, never per drawn step
    if (!tokens) {
      tokens = { lineStrong: css('--line-strong'), ink2: css('--ink-2'), ink3: css('--ink-3'), ink: css('--ink'), page: css('--page'), cut: css('--cut'), waterA: Number(css('--cut-water-a')) || 0.3 };
      cacheKey = '';
    }
    if (cacheKey !== key()) build();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { ink, page } = tokens, tx = Math.round(T.xOf(shown) * dpr) / dpr;
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, BASE_Y - 1, Math.max(0, tx - PAD), 2);          // the history so far
    ctx.fillRect(tx - 0.75, BASE_Y - 9, 1.5, 18);                        // the rule through the head
    const r = T.pressed ? 5 : 4;
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r + 3, 0, Math.PI * 2); ctx.fillStyle = page; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  };

  /* The finger: a touch anywhere on the element jumps to the report date under it. */
  let pid = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !model) return;
    e.preventDefault();
    pid = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (onStart) onStart();                   // first: stopping play must not undo the finger's step
    T.pressed = true; T.wanted = T.stepAt(e.clientX);
    if (onScrub) onScrub(T.wanted);
  });
  el.addEventListener('pointermove', (e) => {
    if (!T.pressed || e.pointerId !== pid) return;
    T.wanted = T.stepAt(e.clientX);
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
    const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -pageStep, PageUp: pageStep, Home: 'home', End: 'end' }[e.key];   // pageStep: the report dates in a year
    if (k === undefined || !onKey) return;
    e.preventDefault();
    onKey(k);
  });
  return T;
}
