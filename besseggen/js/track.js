// The time track with the Burn (ART.md section 1; Global Weather's js/track.js, adapted): the app's
// own slider over the 288 five-minute steps of the day shown, drawn as a sunshine recorder's card for
// the point under the marker. Above the baseline runs the sun's arc for the day at a fixed 0.4 px a
// degree (a 30° tick prints the scale); under it the burn is inked wherever the terrain leaves the
// marker in direct sun, and where the sun is up but a ridge hides it only the arc's outline is drawn.
// The handlers only record what the finger wants; app.js's frame draws it.

export const PAD = 10, TRACK_H = 58, STEPS = 288;
const BASE = 34, ARC0 = 32, PX_DEG = 0.4;
const FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createTrack(el, canvas, { onScrub, onStart, onEnd, onKey } = {}) {
  const ctx = canvas.getContext('2d');
  const T = { pressed: false, finger: null, wanted: null };
  let W = 1, dpr = 1, model = null, cache = null, key = '', tok = null;

  /** x of a minute of the day: 00:00 at the left inset, 24:00 at the right. */
  const xOf = (min) => PAD + (min / 1440) * (W - 2 * PAD);
  T.stepAt = (clientX) => {
    const r = el.getBoundingClientRect();
    const k = Math.round(((clientX - r.left - PAD) / Math.max(1, r.width - 2 * PAD)) * STEPS);
    return Math.max(0, Math.min(STEPS - 1, k));
  };
  T.resize = () => {
    W = Math.max(1, Math.round(el.getBoundingClientRect().width)); dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = Math.round(W * dpr), ch = Math.round(TRACK_H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    key = '';
  };
  /** m: { id, alt: apparent altitude per minute (1 441), lit: direct sun per 2-minute sample (721) } */
  T.setModel = (m) => { model = m; key = ''; };
  T.invalidate = () => { key = ''; tok = null; };

  function build() {
    const c = cache || (cache = document.createElement('canvas'));
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    // the arc and the burn, one device-pixel column at a time
    const { alt, lit } = model;
    for (let i = Math.round(PAD * dpr); i < Math.round((W - PAD) * dpr); i++) {
      const min = Math.max(0, Math.min(1440, ((i + 0.5) / dpr - PAD) / (W - 2 * PAD) * 1440));
      const a = alt[Math.round(min)];
      if (!(a > 0)) continue;
      const top = Math.round((ARC0 - a * PX_DEG) * dpr);
      if (lit && lit[Math.min(lit.length - 1, Math.floor(min / 2))]) { x.fillStyle = tok.burn; x.fillRect(i, top, 1, Math.round(ARC0 * dpr) - top); }
      else { x.fillStyle = tok.ink3; x.fillRect(i, top, 1, Math.round(dpr)); }
    }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = tok.lineStrong;
    x.fillRect(PAD, BASE - 0.5, W - 2 * PAD, 1);
    // the scale: 30° at the left end
    x.fillStyle = tok.ink3;
    x.fillRect(PAD - 4, ARC0 - 30 * PX_DEG - 0.5, 3, 1);
    x.font = FONT; x.textAlign = 'left'; x.textBaseline = 'bottom';
    x.fillText('30°', PAD - 4, ARC0 - 30 * PX_DEG - 1);
    // an hour tick under the baseline; 06:00, 12:00 and 18:00 labeled (no `now`: any day can be shown)
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (let h = 0; h <= 24; h++) {
      const hx = Math.round(xOf(h * 60) * dpr) / dpr, major = h % 6 === 0 && h % 24;
      x.fillStyle = major ? tok.ink2 : tok.ink3;
      x.fillRect(hx - 0.5, BASE + 1, 1, major ? 7 : 3);
      if (major) x.fillText(`${h < 10 ? '0' : ''}${h}:00`, hx, BASE + 11);
    }
    key = `${model.id}|${W}|${dpr}`;
  }

  /** The track with its thumb at step `shown`. */
  T.draw = (shown) => {
    if (!model) return;
    if (!tok) {
      tok = { lineStrong: css('--line-strong'), ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), page: css('--page'), burn: css('--burn') };
      key = '';
    }
    if (key !== `${model.id}|${W}|${dpr}`) build();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const tx = Math.round(xOf(shown * 5) * dpr) / dpr;
    ctx.fillStyle = tok.ink;
    ctx.fillRect(PAD, BASE - 1, Math.max(0, tx - PAD), 2);       // the day so far
    ctx.fillRect(tx - 0.75, BASE - 9, 1.5, 18);                     // the rule through the head
    const r = T.pressed ? 5 : 4;
    ctx.beginPath(); ctx.arc(tx, BASE, r + 3, 0, Math.PI * 2); ctx.fillStyle = tok.page; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, BASE, r, 0, Math.PI * 2); ctx.fillStyle = tok.ink; ctx.fill();
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
    const k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -12, PageUp: 12, Home: 'home', End: 'end' }[e.key];
    if (k === undefined || !onKey) return;
    e.preventDefault();
    onKey(k);
  });
  return T;
}
