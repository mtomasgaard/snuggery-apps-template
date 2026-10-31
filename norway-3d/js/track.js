// The time track with the skyline (ART.md section 1; Besseggen's js/track.js, its card replaced):
// the app's own slider over the 288 five-minute steps of the day shown, drawn as a solar site
// survey's horizon chart unrolled along the day. For each device-pixel column, the minute under
// it: the horizon the terrain makes from the marker in the direction the sun is then (filled up
// from the baseline, in the signature's ink), and the sun's altitude, a line at the same scale.
// Where the sun's line stands above the skyline, the marker is in direct sun, and the line is
// drawn bold; where the skyline or the earth hides it, a hairline. Below the level horizon the sun
// is not drawn. The handlers only record what the finger wants; app.js's frame draws it.

export const PAD = 10, TRACK_H = 58, STEPS = 288;
const BASE = 34, LEVEL = 32, PX_DEG = 0.55;
const FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
export const PX_PER_DEG = PX_DEG;
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function createTrack(el, canvas, { onScrub, onStart, onEnd, onKey } = {}) {
  const ctx = canvas.getContext('2d');
  const T = { pressed: false, finger: null, wanted: null };
  let W = 1, dpr = 1, model = null, cache = null, key = '', tok = null;

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
  /** m: { id, alt: the sun's apparent altitude per minute (1 441), hor: the skyline's altitude in
   *  the sun's direction per minute (1 441), or null while the skyline is not known } */
  T.setModel = (m) => { model = m; key = ''; };
  T.invalidate = () => { key = ''; tok = null; };

  function build() {
    const c = cache || (cache = document.createElement('canvas'));
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const { alt, hor } = model;
    const top = (deg) => Math.round((LEVEL - Math.max(0, deg) * PX_DEG) * dpr);
    const lvl = Math.round(LEVEL * dpr);
    for (let i = Math.round(PAD * dpr); i < Math.round((W - PAD) * dpr); i++) {
      const min = Math.max(0, Math.min(1440, Math.round((((i + 0.5) / dpr - PAD) / (W - 2 * PAD)) * 1440)));
      const h = hor ? hor[min] : 0;
      const a = alt[min];
      // the skyline: the terrain above level, in the signature's ink while the sun is up; while it
      // is down the skyline is the same horizon, drawn faint, so the day stands out of the night
      if (hor && h > 0) { x.fillStyle = a > 0 ? tok.sky : tok.night; x.fillRect(i, top(h), 1, lvl - top(h)); }
      if (!(a > 0)) continue;
      const lit = !hor || a > h;
      if (lit) { x.fillStyle = tok.sky; x.fillRect(i, top(a) - Math.round(dpr), 1, Math.round(2 * dpr)); }
      else { x.fillStyle = tok.ink3; x.fillRect(i, top(a), 1, Math.max(1, Math.round(dpr * 0.75))); }
    }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    // the level horizon, and the scale: 30° at the left end
    x.fillStyle = tok.lineStrong;
    x.fillRect(PAD, BASE - 0.5, W - 2 * PAD, 1);
    x.fillStyle = tok.ink3;
    x.fillRect(PAD - 4, LEVEL - 30 * PX_DEG - 0.5, 3, 1);
    x.font = FONT; x.textAlign = 'left'; x.textBaseline = 'bottom';
    x.lineWidth = 3; x.strokeStyle = tok.page; x.lineJoin = 'round';
    x.strokeText('30°', PAD - 4, LEVEL - 30 * PX_DEG - 1);
    x.fillText('30°', PAD - 4, LEVEL - 30 * PX_DEG - 1);
    x.textAlign = 'center'; x.textBaseline = 'top';
    for (let hr = 0; hr <= 24; hr++) {
      const hx = Math.round(xOf(hr * 60) * dpr) / dpr, major = hr % 6 === 0 && hr % 24;
      x.fillStyle = major ? tok.ink2 : tok.ink3;
      x.fillRect(hx - 0.5, BASE + 1, 1, major ? 7 : 3);
      if (major) x.fillText(`${hr < 10 ? '0' : ''}${hr}:00`, hx, BASE + 11);
    }
    key = `${model.id}|${W}|${dpr}`;
  }

  /** The track with its thumb at step `shown`. */
  T.draw = (shown) => {
    if (!model) return;
    if (!tok) { tok = { lineStrong: css('--line-strong'), ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), page: css('--page'), sky: css('--sky'), night: css('--sky-night') }; key = ''; }
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

  let pid = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !model) return;
    e.preventDefault();
    pid = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (onStart) onStart();
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
