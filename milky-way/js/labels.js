// Screen labels. Every frame the scales hand over candidates — { id, text, x, y, pri, colour, cls } in
// CSS pixels, already projected — and this places as many as fit: highest priority first, each to
// the right of its point, skipped if it would overlap one already placed or cross the screen edge.
// Elements are pooled by id, so a label that stays on screen is the same element moving, not a new
// one. Labels take no pointer events: app.js hit-tests taps against `placed` ({ id, box } in CSS px).

const H = 20;            // label height, px
const GAP = 3;
const EDGE = 2;          // kept clear at the screen edges, px

export class Labels {
  constructor(root) {
    this.root = root;
    this.pool = new Map();
    this.selected = null;
    this.placed = [];
    this._canvas = document.createElement('canvas').getContext('2d');
    this._canvas.font = '700 11px Atkinson, system-ui, sans-serif';
    this.widths = new Map();
  }

  width(text, minor) {
    const key = (minor ? 'm:' : 'b:') + text;
    let w = this.widths.get(key);
    if (w == null) {
      this._canvas.font = minor ? '400 10.5px Atkinson, system-ui, sans-serif' : '700 11px Atkinson, system-ui, sans-serif';
      w = Math.ceil(this._canvas.measureText(text).width) + 25;
      this.widths.set(key, w);
    }
    return w;
  }

  update(cands, W, Hh, reserved = []) {
    cands.sort((a, b) => b.pri - a.pri);
    const boxes = reserved.slice();
    const seen = new Set();
    this.placed = [];
    const hits = (bx) => boxes.some((b) => bx[0] < b[2] + GAP && bx[2] + GAP > b[0] && bx[1] < b[3] + GAP && bx[3] + GAP > b[1]);
    const inside = (bx) => bx[0] >= EDGE && bx[2] <= W - EDGE && bx[1] >= EDGE && bx[3] <= Hh - EDGE;
    let count = 0;
    for (const c of cands) {
      if (count >= 70) break;
      if (!(c.x > -40 && c.x < W + 40 && c.y > -20 && c.y < Hh + 20)) continue;
      const minor = c.cls === 'minor' || c.cls === 'faint';
      const w = this.width(c.text, minor);
      const y0 = c.y - H / 2;
      // Two places to try: the label's dot on the point with the name to the right (the usual one),
      // or the name to the left with the dot at its right end. Then, for important labels, the same
      // two nudged just above or below the point. The first that is inside the screen and clear of
      // the placed labels and the interface wins; if none is, the label is skipped. The selected
      // label, failing that, is also tried pushed back inside the screen.
      const clampIn = (bx) => {
        const x = Math.min(Math.max(bx[0], EDGE), W - EDGE - w), y = Math.min(Math.max(bx[1], EDGE), Hh - EDGE - H);
        return [x, y, x + w, y + H];
      };
      const alts = [[c.x - 8, 0, false], [c.x + 8 - w, 0, true]];
      if (c.pri >= 80) alts.push([c.x - 8, -H + 2, false], [c.x - 8, H - 2, false], [c.x + 8 - w, -H + 2, true], [c.x + 8 - w, H - 2, true]);
      let box = null, left = false;
      for (const clamped of c.id === this.selected ? [false, true] : [false]) {
        for (const [x, dy, l] of alts) {
          let bx = [x, y0 + dy, x + w, y0 + dy + H];
          if (clamped) bx = clampIn(bx);
          if (inside(bx) && !hits(bx)) { box = bx; left = l; break; }
        }
        if (box) break;
      }
      if (!box) continue;
      boxes.push(box);
      seen.add(c.id);
      count++;
      let el = this.pool.get(c.id);
      if (!el) {
        el = document.createElement('div');
        el.innerHTML = '<i></i><span></span>';
        this.root.appendChild(el);
        this.pool.set(c.id, el);
      }
      const cls = 'lbl' + (c.cls ? ' ' + c.cls : '') + (c.id === this.selected ? ' sel' : '') + (left ? ' left' : '');
      if (el.className !== cls) el.className = cls;
      const span = el.lastChild;
      if (span.textContent !== c.text) span.textContent = c.text;
      if (el._c !== c.colour) { el.style.setProperty('--c', c.colour || '#dde3ea'); el._c = c.colour; }
      el.style.transform = `translate3d(${box[0].toFixed(1)}px, ${box[1].toFixed(1)}px, 0)`;
      el.style.opacity = c.alpha == null ? '' : String(c.alpha);
      el.hidden = false;
      this.placed.push({ id: c.id, box });
    }
    for (const [id, el] of this.pool) {
      if (!seen.has(id)) {
        if (!el.hidden) el.hidden = true;
      }
    }
    // Drop long-hidden elements now and then so the pool cannot grow without bound.
    if (this.pool.size > 400) {
      for (const [id, el] of this.pool) if (el.hidden) { el.remove(); this.pool.delete(id); }
    }
  }
}
