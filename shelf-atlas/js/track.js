// The month track (ART.md section 3; Global Weather's js/track.js adapted): the app's own slider, so a
// touch anywhere on it lands on the month under the finger, with no slop and no thumb to find. The
// element is role="slider"; this draws its canvas: the baseline, the months so far in ink, a short tick
// at each 1 January (every fifth year when they would stand closer than 3 px), a longer one and its
// label at each decade, and the tracer-head thumb at the SHOWN month, never gliding. There is no tick
// per month (668 of them at 0.31 px) and no `now` notch (the data ends before today). The handlers only
// record what the finger wants; app.js's frame draws it.

export const PAD = 10;                    // CSS px from each end of the element to the first and last month
export const TRACK_H = 58;
const BASE_Y = 24, FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createTrack(el, canvas, { onScrub, onStart, onEnd, onKey } = {}) {
  const ctx = canvas.getContext('2d');
  const T = { pressed: false, finger: null, wanted: null, builds: 0 };
  let W = 1, dpr = 1, n = 0, epoch = 1971, cache = null, cacheKey = '', tokens = null;

  T.xOf = (k) => PAD + (n > 1 ? (k / (n - 1)) * (W - 2 * PAD) : 0);
  /** The month under a client x: the nearest month to the finger, clamped. */
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
  /** The number of months (January of the epoch year is month 0). */
  T.setModel = (count, firstYear = 1971) => { n = count; epoch = firstYear; cacheKey = ''; };
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
    // each 1 January: a 3 px tick at half strength, every fifth year where years crowd
    const perYear = n > 1 ? (12 * (W - 2 * PAD)) / (n - 1) : W;
    const every = perYear >= 3 ? 1 : 5;
    x.fillStyle = ink3; x.globalAlpha = 0.5;
    for (let k = 0; k < n; k += 12) if ((epoch + k / 12) % every === 0) x.fillRect(Math.round(T.xOf(k) * dpr) / dpr - 0.5, BASE_Y + 1, 1, 3);
    x.globalAlpha = 1;
    // each decade: a 7 px tick and its year under it, labels that would collide skipped
    x.font = FONT; x.textBaseline = 'top'; x.textAlign = 'center';
    let placed = -Infinity;
    for (let k = 0; k < n; k += 12) {
      const y = epoch + k / 12;
      if (y % 10) continue;
      const mx = Math.round(T.xOf(k) * dpr) / dpr;
      x.fillStyle = ink2;
      x.fillRect(mx - 0.5, BASE_Y + 1, 1, 7);
      const label = String(y), w = x.measureText(label).width;
      if (mx - w / 2 < 0 || mx + w / 2 > W || mx - w / 2 < placed + 8) continue;
      x.fillText(label, mx, BASE_Y + 12);
      placed = mx + w / 2;
    }
    cacheKey = key();
    T.builds++;
  }
  const key = () => `${n}|${epoch}|${W}|${dpr}`;

  /** The track with its thumb at month `shown`. */
  T.draw = (shown) => {
    if (!n) return;
    // the colors are read from the stylesheet once per theme, never per drawn month
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
    ctx.fillRect(PAD, BASE_Y - 1, Math.max(0, tx - PAD), 2);          // the months so far
    ctx.fillRect(tx - 0.75, BASE_Y - 9, 1.5, 18);                        // the rule through the head
    const r = T.pressed ? 5 : 4;
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r + 3, 0, Math.PI * 2); ctx.fillStyle = page; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, BASE_Y, r, 0, Math.PI * 2); ctx.fillStyle = ink; ctx.fill();
  };

  /* The finger: a touch anywhere on the element jumps to the month under it. */
  let pid = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !n) return;
    e.preventDefault();
    pid = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (onStart) onStart();                   // first: stopping play must not undo the finger's month
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
    const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -12, PageUp: 12, Home: 'home', End: 'end' }[e.key];
    if (k === undefined || !onKey) return;
    e.preventDefault();
    onKey(k);
  });
  return T;
}
