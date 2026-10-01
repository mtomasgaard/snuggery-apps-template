// Screen labels. Every frame the scales hand over candidates ({ id, text, x, y, pri, color, cls }) in
// CSS pixels, already projected, and this places as many as fit: highest priority first, each to
// the right of its point, skipped if it would overlap one already placed or cross the screen edge.
// Elements are pooled by id, so a label that stays on screen is the same element moving, not a new
// one. Labels take no pointer events: app.js hit-tests taps against `placed` ({ id, box } in CSS px).

const H = 20;            // label height, px
const GAP = 3;
const EDGE = 2;          // kept clear at the screen edges, px
// The label's weight and size by class: a major name, a minor one (moons, dwarfs), a faint one
// (comets, stars seen from among the planets), and the selected one.
const FONTS = { '': '560 11.5px', minor: '400 11px', faint: '400 10.5px', sel: '620 11.5px' };

export class Labels {
  constructor(root) {
    this.root = root;
    this.pool = new Map();
    this.selected = null;
    this.placed = [];
    this._canvas = document.createElement('canvas').getContext('2d');
    this.widths = new Map();
  }

  // Widths are measured in the face the label is set in (styles.css .lbl), once it has loaded; app.js
  // clears the cache when document.fonts says it has.
  width(text, cls) {
    const key = cls + ':' + text;
    let w = this.widths.get(key);
    if (w == null) {
      this._canvas.font = `${FONTS[cls] || FONTS['']} "Ysabeau Office", system-ui, sans-serif`;
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
      const w = this.width(c.text, c.id === this.selected ? 'sel' : c.cls || '');
      const y0 = c.y - H / 2;
      // Two places to try: the label's dot on the point with the name to the right (the usual one),
      // or the name to the left with the dot at its right end. Then, for important labels, the same
      // two nudged just above or below the point, then a label's height further without the dot (so
      // crowded inner planets keep their names). The first that is inside the screen and clear of
      // the placed labels and the interface wins; if none is, the label is skipped. The selected
      // label and the important ones, failing that, are also tried pushed back inside the screen.
      const clampIn = (bx) => {
        const x = Math.min(Math.max(bx[0], EDGE), W - EDGE - w), y = Math.min(Math.max(bx[1], EDGE), Hh - EDGE - H);
        return [x, y, x + w, y + H];
      };
      const alts = [[c.x - 8, 0, false], [c.x + 8 - w, 0, true]];
      if (c.pri >= 80) for (const dy of [-H + 2, H - 2, -2 * H, 2 * H]) alts.push([c.x - 8, dy, false], [c.x + 8 - w, dy, true]);
      let box = null, left = false, far = false;
      for (const clamped of c.id === this.selected || c.pri >= 80 ? [false, true] : [false]) {
        for (const [x, dy, l] of alts) {
          let bx = [x, y0 + dy, x + w, y0 + dy + H];
          if (clamped) bx = clampIn(bx);
          if (inside(bx) && !hits(bx)) { box = bx; left = l; far = Math.abs(dy) > H; break; }
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
      const cls = 'lbl' + (c.cls ? ' ' + c.cls : '') + (c.id === this.selected ? ' sel' : '') + (left ? ' left' : '') + (far ? ' bare' : '');
      if (el.className !== cls) el.className = cls;
      const span = el.lastChild;
      if (span.textContent !== c.text) span.textContent = c.text;
      // the point's mark: a category's color where the point is one (arms, clusters, satellites)
      if (el._c !== c.color) { if (c.color) el.style.setProperty('--c', c.color); else el.style.removeProperty('--c'); el._c = c.color; }
      el.style.transform = `translate3d(${box[0].toFixed(1)}px, ${box[1].toFixed(1)}px, 0)`;
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
