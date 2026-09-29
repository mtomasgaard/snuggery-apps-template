// Controls (DESIGN.md §13): the steering pad or the two screen sides, the drift and item buttons,
// and the keyboard for desktop testing. Pointer Events with per-pointerId tracking, so steering and
// drifting work with two thumbs at once. Tilt (js/tilt.js) sets `tiltSteer`.
//
// Forgiving by design: the pad takes any touch in the left 60 % below 40 % of the height, and when
// the thumb runs past the ring the ring follows it, so steering back never needs a long drag; in Pad
// mode a thumb anywhere in the lower right below the item button drifts, not only on the button.

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const DEAD = 6, PAD_RANGE = 64, BRAKE_DY = 56, DOUBLE_TAP = 250, PAD_W = 0.6, PAD_TOP = 0.4;

export class Input {
  constructor({ layer, pad, knob, ghost, drift, item, onPause }) {
    this.el = { layer, pad, knob, ghost, drift, item };
    this.onPause = onPause;
    this.mode = 'pad';
    this.enabled = false;
    this.touches = new Map();      // pointerId → { kind, x0, y0, x, y }
    this.keys = new Set();
    this.driftBtn = false;
    this.itemQueued = false;
    this.sidesDrift = 0;            // −1 / +1 while a double-tap-hold drift is held in Sides mode
    this.lastUp = { left: -1e9, right: -1e9 };
    this.touched = false;           // hides the "Steer" ghost after the first touch
    this.tiltSteer = null;          // () => steer in −1..1, or null — set by js/tilt.js
    this.lastPad = { steer: 0, brake: 0 };

    const opts = { passive: false };
    layer.addEventListener('pointerdown', (e) => this.down(e), opts);
    layer.addEventListener('pointermove', (e) => this.move(e), opts);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) layer.addEventListener(t, (e) => this.up(e), opts);
    const hold = (btn, on) => {
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch {} on(true); }, opts);
      for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) btn.addEventListener(t, () => on(false), opts);
    };
    hold(drift, (on) => { this.driftBtn = on && this.enabled; drift.classList.toggle('on', this.driftBtn); });
    item.addEventListener('pointerdown', (e) => { e.preventDefault(); if (this.enabled) this.itemQueued = true; }, opts);
    for (const b of [drift, item]) b.addEventListener('contextmenu', (e) => e.preventDefault());
    layer.addEventListener('contextmenu', (e) => e.preventDefault());

    const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Shift', 'a', 'd', 's', 'x', 'e', 'Enter', 'A', 'D', 'S', 'X', 'E'];
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { this.onPause && this.onPause(); return; }
      // Only while racing: on the menus Space and Enter must still press a focused button.
      if (KEYS.includes(e.key) && this.enabled) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      if (['x', 'e', 'X', 'E', 'Enter'].includes(e.key) && this.enabled) this.itemQueued = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
    window.addEventListener('blur', () => this.releaseAll());
  }

  setMode(mode) { this.mode = mode === 'sides' ? 'sides' : 'pad'; this.releaseAll(); document.body.dataset.controls = this.mode; }

  enable(on) {
    this.enabled = on;
    if (!on) this.releaseAll();
    this.el.ghost.hidden = !on || this.touched || this.mode !== 'pad';
  }

  releaseAll() {
    this.touches.clear(); this.driftBtn = false; this.sidesDrift = 0; this.itemQueued = false; this.keys.clear();
    this.el.drift.classList.remove('on');
    this.el.pad.hidden = true;
    this.lastPad = { steer: 0, brake: 0 };
  }

  down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const W = window.innerWidth, H = window.innerHeight, x = e.clientX, y = e.clientY;
    let kind = null;
    if (this.mode === 'pad') {
      if (x < PAD_W * W && y > PAD_TOP * H) kind = 'pad';
      else if (x >= PAD_W * W && y > this.el.item.getBoundingClientRect().bottom + 4) kind = 'drift';
    } else if (y > 0.58 * H) kind = x < W / 2 ? 'left' : 'right';
    if (!kind) return;
    if (kind === 'pad') for (const t of this.touches.values()) if (t.kind === 'pad') return;   // one pad at a time
    try { this.el.layer.setPointerCapture(e.pointerId); } catch {}
    const t = { kind, x0: x, y0: y, x, y };
    this.touches.set(e.pointerId, t);
    if (kind === 'drift') { this.el.drift.classList.add('on'); return; }
    if (kind === 'pad') {
      this.touched = true; this.el.ghost.hidden = true;
      Object.assign(this.el.pad.style, { left: `${x}px`, top: `${y}px` });
      this.el.pad.hidden = false; this.el.knob.style.transform = 'translate(-50%, -50%)';
    } else {
      // Sides: release and press the same side again within 250 ms, and hold → drift that way.
      if (performance.now() - this.lastUp[kind] < DOUBLE_TAP) { t.drift = true; this.sidesDrift = kind === 'left' ? -1 : 1; }
    }
  }

  move(e) {
    const t = this.touches.get(e.pointerId); if (!t) return;
    e.preventDefault();
    t.x = e.clientX; t.y = e.clientY;
    if (t.kind === 'pad') {
      // Past the ring, the ring follows the thumb sideways (a floating pad).
      const over = t.x - t.x0;
      if (Math.abs(over) > PAD_RANGE + 8) { t.x0 = t.x - Math.sign(over) * (PAD_RANGE + 8); this.el.pad.style.left = `${t.x0}px`; }
      const dx = clamp(t.x - t.x0, -PAD_RANGE, PAD_RANGE), dy = clamp(t.y - t.y0, -PAD_RANGE, PAD_RANGE);
      this.el.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  }

  up(e) {
    const t = this.touches.get(e.pointerId); if (!t) return;
    this.touches.delete(e.pointerId);
    if (t.kind === 'pad') this.el.pad.hidden = true;
    else if (t.kind === 'drift') { if (!this.driftBtn && ![...this.touches.values()].some((o) => o.kind === 'drift')) this.el.drift.classList.remove('on'); }
    else { this.lastUp[t.kind] = performance.now(); if (t.drift) this.sidesDrift = 0; }
  }

  /** This step's input: { steer, drift, brake, useItem }. `useItem` is true once per press. */
  read(out = {}) {
    let steer = 0, brake = 0, drift = this.driftBtn || this.sidesDrift !== 0;
    for (const t of this.touches.values()) if (t.kind === 'drift') drift = true;
    let left = false, right = false;
    for (const t of this.touches.values()) {
      if (t.kind === 'pad') {
        const dx = t.x - t.x0, dy = t.y - t.y0;
        steer = Math.abs(dx) < DEAD ? 0 : clamp(dx / PAD_RANGE, -1, 1);
        if (dy > BRAKE_DY) brake = 1;
      } else if (t.kind === 'left') left = true; else if (t.kind === 'right') right = true;
    }
    if (left && right) brake = 1;
    else if (left) steer = -1; else if (right) steer = 1;
    const k = this.keys;
    const kl = k.has('ArrowLeft') || k.has('a'), kr = k.has('ArrowRight') || k.has('d');
    if (kl || kr) steer = (kr ? 1 : 0) - (kl ? 1 : 0);
    if (k.has('ArrowDown') || k.has('s')) brake = 1;
    if (k.has(' ') || k.has('Shift')) drift = true;
    if (this.tiltSteer) { const t = this.tiltSteer(); if (t !== null && t !== undefined && !(kl || kr)) steer = t; }
    out.steer = steer; out.brake = brake; out.drift = drift;
    out.useItem = this.itemQueued; this.itemQueued = false;
    return out;
  }
}
