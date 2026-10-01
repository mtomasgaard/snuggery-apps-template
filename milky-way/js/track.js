// The time track (HOUSE.md section 4.6; Global Weather's js/track.js, adapted): the app's own slider
// over the days of the shown year, so a touch anywhere on it lands on the day under the finger, with
// no slop and no thumb to find. This draws its canvas (the baseline, the year so far, a tick and a
// label at each month, a `now` notch, the tracer-head thumb at the SHOWN day, never gliding). The
// handlers only record what the finger wants; app.js's frame draws it.

export const PAD = 10;                    // CSS px from each end of the element to the first and last day
export const TRACK_H = 58;
const BASE_Y = 24;
export const FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createTrack(el, canvas, { onScrub, onStart, onEnd, onKey } = {}) {
  const ctx = canvas.getContext('2d');
  const T = { pressed: false, finger: null, wanted: null };
  let W = 1, dpr = 1, model = null, cache = null, cacheKey = '', tokens = null;

  const xOf = (k) => PAD + (model.n > 1 ? (k / (model.n - 1)) * (W - 2 * PAD) : 0);
  /** The day under a client x: the nearest day to the finger, clamped. */
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
  /** m: { n days, months: [{ at: day, label }], now: fractional day or null } */
  T.setModel = (m) => { model = m; cacheKey = ''; };
  /** The theme or the face changed: the tokens are read again, once, on the next draw. */
  T.invalidate = () => { cacheKey = ''; tokens = null; };
  const key = () => `${model.n}|${model.months[0] && model.months[0].label}|${model.now}|${W}|${dpr}`;

  function build() {
    const c = cache || (cache = document.createElement('canvas'));
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, TRACK_H);
    const { lineStrong, ink2, ink3 } = tokens;
    x.fillStyle = lineStrong;
    x.fillRect(PAD, BASE_Y - 0.5, W - 2 * PAD, 1);
    // each month: a 7 px tick at its first day, its name in the middle of it; colliding names skipped
    x.font = FONT; x.textBaseline = 'top'; x.textAlign = 'center';
    let placed = -Infinity;
    model.months.forEach((m, i) => {
      x.fillStyle = ink2;
      x.fillRect(Math.round(xOf(m.at) * dpr) / dpr - 0.5, BASE_Y + 1, 1, 7);
      const end = i + 1 < model.months.length ? model.months[i + 1].at : model.n - 1;
      const mx = xOf((m.at + end) / 2), w = x.measureText(m.label).width;
      if (mx - w / 2 < 0 || mx + w / 2 > W || mx - w / 2 < placed + 4) return;
      x.fillText(m.label, mx, BASE_Y + 12);
      placed = mx + w / 2;
    });
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

  /** The track with its thumb at day `shown` (whole while paused or scrubbed, fractional in play). */
  T.draw = (shown) => {
    if (!model) return;
    if (!tokens) tokens = { lineStrong: css('--line-strong'), ink2: css('--ink-2'), ink3: css('--ink-3'), ink: css('--ink'), page: css('--page') };
    if (cacheKey !== key()) build();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { ink, page } = tokens, tx = Math.round(xOf(Math.max(0, Math.min(model.n - 1, shown))) * dpr) / dpr;
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, BASE_Y - 1, Math.max(0, tx - PAD), 2);          // the year so far
    ctx.fillRect(tx - 0.75, BASE_Y - 9, 1.5, 18);                        // the rule through the head
    const r = T.pressed ? 5 : 4;
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r + 3, 0, Math.PI * 2); ctx.fillStyle = page; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  };

  /* The finger: a touch anywhere on the element jumps to the day under it. */
  let pid = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !model) return;
    e.preventDefault();
    pid = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (onStart) onStart();                   // first: stopping play must not undo the finger's day
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
