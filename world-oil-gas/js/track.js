// The year track (ART.md section 3; Global Weather's js/track.js as Shelf Atlas adapted it): the app's
// own slider, so a touch anywhere on it lands on the year under the finger, with no slop and no thumb to
// find. The element is role="slider"; this draws its canvas: the baseline, the years so far in ink, a
// short tick every fifth year, a longer one at each decade, a label every 25 years (and the last year
// where it clears the one before), and the tracer-head thumb at the SHOWN year, never gliding. No tick
// per year (125 at 1.7 px) and no `now` notch (the data ends before today). The handlers only record
// what the finger wants; app.js's frame draws it.

export const PAD = 10;                    // CSS px from each end of the element to the first and last year
export const TRACK_H = 58;
const BASE_Y = 24, FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createTrack(el, canvas, { onScrub, onStart, onEnd, onKey } = {}) {
  const ctx = canvas.getContext('2d');
  const T = { pressed: false, wanted: null, builds: 0 };
  let W = 1, dpr = 1, n = 0, y0 = 1900, cache = null, cacheKey = '', tokens = null;

  T.xOf = (k) => PAD + (n > 1 ? (k / (n - 1)) * (W - 2 * PAD) : 0);
  /** The step (years since the first) under a client x, clamped. */
  T.stepAt = (clientX) => {
    if (!n) return 0;
    const r = el.getBoundingClientRect();
    const k = Math.round(((clientX - r.left - PAD) / Math.max(1, r.width - 2 * PAD)) * (n - 1));
    return Math.max(0, Math.min(n - 1, k));
  };
  T.resize = () => {
    const r = el.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.round(W * dpr), ch = Math.round(TRACK_H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    cacheKey = '';
  };
  /** The number of years and the first. */
  T.setModel = (count, firstYear) => { n = count; y0 = firstYear; cacheKey = ''; };
  /** The theme or the face changed: the tokens are read again on the next draw. */
  T.invalidate = () => { cacheKey = ''; tokens = null; };

  function build() {
    const c = cache || (cache = document.createElement('canvas'));
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, W, TRACK_H);
    const { lineStrong, ink2, ink3 } = tokens;
    const at = (k) => Math.round(T.xOf(k) * dpr) / dpr;
    x.fillStyle = lineStrong;
    x.fillRect(PAD, BASE_Y - 0.5, W - 2 * PAD, 1);
    x.fillStyle = ink3; x.globalAlpha = 0.5;
    for (let k = 0; k < n; k++) if ((y0 + k) % 5 === 0 && (y0 + k) % 10) x.fillRect(at(k) - 0.5, BASE_Y + 1, 1, 3);
    x.globalAlpha = 1;
    x.fillStyle = ink2;
    for (let k = 0; k < n; k++) if ((y0 + k) % 10 === 0) x.fillRect(at(k) - 0.5, BASE_Y + 1, 1, 7);
    // labels every 25 years, and the last year where it clears the label before it; never grouped
    x.font = FONT; x.textBaseline = 'top'; x.textAlign = 'center';
    let placed = -Infinity;
    const label = (k) => {
      const t = String(y0 + k), w = x.measureText(t).width, mx = Math.min(Math.max(at(k), w / 2), W - w / 2);
      if (mx - w / 2 < placed + 8) return;
      x.fillText(t, mx, BASE_Y + 12);
      placed = mx + w / 2;
    };
    for (let k = 0; k < n; k++) if ((y0 + k) % 25 === 0) label(k);
    if ((y0 + n - 1) % 25) label(n - 1);
    cacheKey = key();
    T.builds++;
  }
  const key = () => `${n}|${y0}|${W}|${dpr}`;

  /** The track with its thumb at step `shown`. */
  T.draw = (shown) => {
    if (!n) return;
    if (!tokens) {
      tokens = { lineStrong: css('--line-strong'), ink2: css('--ink-2'), ink3: css('--ink-3'), ink: css('--ink'), page: css('--page') };
      cacheKey = '';
    }
    if (cacheKey !== key()) build();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { ink, page } = tokens, tx = Math.round(T.xOf(shown) * dpr) / dpr;
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, BASE_Y - 1, Math.max(0, tx - PAD), 2);          // the years so far
    ctx.fillRect(tx - 0.75, BASE_Y - 9, 1.5, 18);                        // the rule through the head
    const r = T.pressed ? 5 : 4;
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r + 3, 0, Math.PI * 2); ctx.fillStyle = page; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  };

  /* The finger: a touch anywhere on the element jumps to the year under it. */
  let pid = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !n) return;
    e.preventDefault();
    pid = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (onStart) onStart();                   // first: stopping play must not undo the finger's year
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
  // ← → (and ↓ ↑) one year, Page Down and Page Up a decade (ART.md: a stated departure from eight), Home, End
  el.addEventListener('keydown', (e) => {
    const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10, Home: 'home', End: 'end' }[e.key];
    if (k === undefined || !onKey) return;
    e.preventDefault();
    onKey(k);
  });
  return T;
}
