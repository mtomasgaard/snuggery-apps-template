// The section's gestures (plan 0012 D18; Norne Reservoir 2.5's, the same in Volve): what a finger, two fingers, a mouse or a wheel do on the plot,
// turned into four calls the app answers. A tap (the pointer moved 8 px or less) is a tap at once, with no
// wait for a second; a second tap within 380 ms and 30 px of the first is a double tap as well, as on the
// 3D view (the first tap has shown its cell; the second zooms instead). Two fingers zoom about their midpoint and carry it with them: each move zooms by the change in
// their distance about where the midpoint was, then moves by how far the midpoint went, so the point under
// the fingers stays under them. One finger, or a mouse, moves the view while h.free() says it may (zoomed
// in); at the fit it does nothing. A wheel, or a trackpad's pinch (the wheel with ctrlKey), zooms about the
// pointer. h.start() opens a gesture (the app previews while it lasts) and h.end() closes it (the app draws
// in full); a wheel's gesture ends 140 ms after its last turn. Nothing here scrolls the page: the plot is
// touch-action none in the stylesheet, and the wheel is taken.

/** el: the plot; h: { tap(x, y), double(x, y), move({ k, x, y, dx, dy }), free(), start(), end() }, points
 *  in the plot's CSS px. */
export function plotGestures(el, h) {
  const pts = new Map();
  let g = null, last = null, wheel = 0;
  const at = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const pair = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }; };
  const live = () => { if (!g.live) { g.live = true; h.start(); } };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button) return;
    try { el.setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer knows: the moves still come to the plot */ }
    const p = at(e);
    pts.set(e.pointerId, p);
    if (pts.size === 1 && !g) g = { x: p[0], y: p[1], moved: false, live: false, two: null };
    else if (g) { g.moved = true; if (pts.size === 2) g.two = pair(); }
  });
  el.addEventListener('pointermove', (e) => {
    if (!g || !pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), cur = at(e);
    pts.set(e.pointerId, cur);
    if (pts.size >= 2 && g.two) {
      const q = pair(), p = g.two;
      g.two = q; live();
      h.move({ k: q.d / p.d, x: p.x, y: p.y, dx: q.x - p.x, dy: q.y - p.y });
      return;
    }
    if (!g.moved && Math.hypot(cur[0] - g.x, cur[1] - g.y) <= 8) return;
    const from = g.moved ? prev : [g.x, g.y];   // the move that passes the tap's 8 px carries the whole way from the touch
    g.moved = true;
    if (!h.free()) return;
    live();
    h.move({ k: 1, x: cur[0], y: cur[1], dx: cur[0] - from[0], dy: cur[1] - from[1] });
  });
  const up = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size === 1) { g.two = null; return; }   // one finger left: it carries on moving the view
    if (pts.size) return;
    const d = g;
    g = null;
    if (d.live) { h.end(); return; }
    if (d.moved || e.type !== 'pointerup') return;
    const now = e.timeStamp;
    if (last && now - last.t < 380 && Math.hypot(d.x - last.x, d.y - last.y) < 30) { last = null; h.double(d.x, d.y); }
    else { last = { t: now, x: d.x, y: d.y }; h.tap(d.x, d.y); }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [x, y] = at(e), dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    if (!wheel) h.start();
    clearTimeout(wheel);
    wheel = setTimeout(() => { wheel = 0; h.end(); }, 140);
    h.move({ k: Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), x, y, dx: 0, dy: 0 });
  }, { passive: false });
}
