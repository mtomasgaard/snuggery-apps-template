// The pane's edge (plan 0012 D13): a pane that shares a view with another is made taller (under it) or
// wider (beside it) by its edge. A drag on the edge moves it with the finger; a double tap toggles compact
// and tall; the arrow keys, Home and End, and VoiceOver's adjustable control (increment, decrement) step
// it. Compact is the pane as the stylesheet sets it without the class `grown`; tall leaves the other view
// its minimum strip (keep.up px of height under it, keep.side px of width beside it). The size is one
// fraction, 0 compact to 1 tall, which the app keeps with its other state; the pixels follow the screen.
// Everything about the resizing lives here and in the stylesheet's `.grown` rules, so another app's pane
// (Volve's) can take it whole. The app redraws in onSize, in the frame that follows.

/**
 * pane: the pane; edges: the elements that are its edge (role="slider"; the one shown is used); view:
 * the flex box it shares (a column under, a row beside); keep: { up, side } the other view's minimum;
 * get() and set(f): the saved fraction; onSize(): the size changed (redraw); onEnd(): a change is done
 * (save); onDrag(on): a finger began or ended a drag of the edge; label(side): the edge's name.
 */
export function paneEdge({ pane, edges, view, keep, get, set, onSize, onEnd, onDrag = () => {}, label }) {
  const side = () => getComputedStyle(view).flexDirection === 'row';
  /** Compact and tall in px, along the edge's direction, as the view stands now. */
  const range = () => {
    const s = side(), g = pane.classList.contains('grown');
    if (g) pane.classList.remove('grown');
    const c = s ? pane.offsetWidth : pane.offsetHeight;
    if (g) pane.classList.add('grown');
    return { s, c, m: Math.max(c, (s ? view.clientWidth : view.clientHeight) - (s ? keep.side : keep.up)) };
  };
  const px = (r, f) => Math.round(r.c + f * (r.m - r.c));
  function apply(r = range()) {
    const f = get(), p = px(r, f), share = Math.round((p / ((r.s ? view.clientWidth : view.clientHeight) || 1)) * 100);
    pane.classList.toggle('grown', f > 0);
    pane.style.setProperty('--pane', `${p}px`);
    for (const e of edges) {
      e.setAttribute('aria-label', label(r.s));
      e.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      // under the model the pane grows taller, beside it wider: the words say which
      e.setAttribute('aria-valuetext', f <= 0 ? 'Compact' : f >= 1 ? (r.s ? 'Wide' : 'Tall') : `${share} percent of the view’s ${r.s ? 'width' : 'height'}`);
    }
  }
  function to(f, r) {
    f = Math.max(0, Math.min(1, f));
    if (f === get()) return;
    set(f); apply(r); onSize();
  }
  const toggle = () => { to(get() > 0 ? 0 : 1); onEnd(); };
  // the tap's own click follows the lift, by then over whatever the toggle moved under the finger (a key on
  // the plate, the model): it is taken here, once, within 400 ms
  const eatClick = () => {
    const f = (e) => { e.preventDefault(); e.stopPropagation(); };
    window.addEventListener('click', f, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', f, true), 400);
  };
  for (const edge of edges) {
    let drag = null, lastTap = null;
    edge.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      e.preventDefault();
      edge.setPointerCapture(e.pointerId);
      const r = range();
      drag = { r, p: px(r, get()), at: r.s ? e.clientX : e.clientY, moved: false };
    });
    edge.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const d = drag.at - (drag.r.s ? e.clientX : e.clientY);   // up, or to the left: larger
      if (!drag.moved && Math.abs(d) < 4) return;
      if (!drag.moved) onDrag(true);
      drag.moved = true;
      const r = drag.r, p = Math.min(r.m, Math.max(r.c, drag.p + d));
      if (r.m > r.c) to((p - r.c) / (r.m - r.c), r);
    });
    const up = (e) => {
      const d = drag;
      drag = null;
      if (!d) return;
      if (d.moved) { onDrag(false); onEnd(); return; }
      if (e.type !== 'pointerup') return;
      if (lastTap && e.timeStamp - lastTap.t < 400 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap = null; toggle(); eatClick(); }
      else lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    };
    edge.addEventListener('pointerup', up);
    edge.addEventListener('pointercancel', up);
    // a click with no pointer behind it (detail 0) is an assistive activation: it toggles as a double tap does
    edge.addEventListener('click', (e) => { if (e.detail === 0) toggle(); });
    edge.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'Home' || k === 'End' || k === 'Enter' || k === ' ') { e.preventDefault(); if (k === 'Home') to(0); else if (k === 'End') to(1); else toggle(); onEnd(); return; }
      // ↑ and → make it larger, ↓ and ← smaller, on both edges (the slider convention): VoiceOver's
      // increment sends ↑ to the vertical edge under the model and → to the horizontal one beside it
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[k];
      if (!d) return;
      e.preventDefault();
      to(Math.round((get() + d * 0.1) * 10) / 10); onEnd();
    });
  }
  new ResizeObserver(() => apply()).observe(view);
  return { apply, toggle, range };
}
