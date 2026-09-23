// Screen labels. Every frame the scales hand over candidates — { id, text, x, y, pri, colour, cls } in
// CSS pixels, already projected — and this places as many as fit: highest priority first, each to
// the right of its point, skipped if it would overlap one already placed. Elements are pooled by id,
// so a label that stays on screen is the same element moving, not a new one.

const H = 20;            // label height, px
const GAP = 3;

export class Labels {
  constructor(root, onTap) {
    this.root = root;
    this.pool = new Map();
    this.onTap = onTap;
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
    let count = 0;
    for (const c of cands) {
      if (count >= 70) break;
      if (!(c.x > -40 && c.x < W + 40 && c.y > -20 && c.y < Hh + 20)) continue;
      const minor = c.cls === 'minor' || c.cls === 'faint';
      const w = this.width(c.text, minor);
      const x0 = c.x - 8, y0 = c.y - H / 2;
      const box = [x0, y0, x0 + w, y0 + H];
      if (c.id !== this.selected && boxes.some((b) => box[0] < b[2] + GAP && box[2] + GAP > b[0] && box[1] < b[3] + GAP && box[3] + GAP > b[1])) continue;
      boxes.push(box);
      seen.add(c.id);
      count++;
      let el = this.pool.get(c.id);
      if (!el) {
        el = document.createElement('div');
        el.innerHTML = '<i></i><span></span>';
        el.addEventListener('pointerup', (e) => { e.stopPropagation(); this.onTap(el._id); });
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.root.appendChild(el);
        this.pool.set(c.id, el);
      }
      el._id = c.id;
      const cls = 'lbl' + (c.cls ? ' ' + c.cls : '') + (c.id === this.selected ? ' sel' : '');
      if (el.className !== cls) el.className = cls;
      const span = el.lastChild;
      if (span.textContent !== c.text) span.textContent = c.text;
      if (el._c !== c.colour) { el.style.setProperty('--c', c.colour || '#dde3ea'); el._c = c.colour; }
      el.style.transform = `translate3d(${(c.x - 8).toFixed(1)}px, ${(c.y - H / 2).toFixed(1)}px, 0)`;
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
