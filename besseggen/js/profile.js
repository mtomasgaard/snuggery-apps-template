// The elevation profile strip. An SVG built by setting innerHTML on an <svg> that already exists
// in the document, which parses in the SVG namespace — so the app never has to name a namespace
// URL, and the packager's "no scheme strings in the source" rule stays satisfied.
//
// Dragging the strip moves the marker on the terrain; moving the marker on the terrain moves the
// cursor here. Both go through the same route index, so they cannot disagree.
//
// The strip stretches to the width it is given (`preserveAspectRatio="none"`), which on a 390 px
// phone squashes a user unit to about a third of a pixel. That is right for the profile line and
// wrong for every label on it, so the geometry is emitted in user units and the labels are
// positioned in `relayout()`: each one is translated to its anchor and then counter-scaled, so
// inside its own transform one unit is one CSS pixel and the text comes out at its natural size
// whatever the strip is stretched to. Having measured them, `relayout()` also keeps them inside
// the strip and off each other.

import { clamp, escapeHtml, fmt } from './util.js';

const W = 1000, H = 132, PAD_T = 12, PAD_B = 20;

export class Profile {
  constructor(svg, onSeek) {
    this.svg = svg;
    this.onSeek = onSeek;
    this.route = null;
    this.reversed = false;
    this.cursor = 0;
    this.dragging = false;

    const toIndex = (clientX) => {
      const r = this.svg.getBoundingClientRect();
      const f = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1);
      return this.route ? this.route.indexAtDist(f * this.route.length, this.reversed) : 0;
    };
    svg.addEventListener('pointerdown', (e) => {
      if (!this.route) return;
      this.dragging = true;
      svg.setPointerCapture(e.pointerId);
      this.onSeek(toIndex(e.clientX), true);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.onSeek(toIndex(e.clientX), true);
    });
    const end = () => { this.dragging = false; };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('keydown', (e) => {
      if (!this.route) return;
      const step = e.shiftKey ? 20 : 1;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.onSeek(this.stepIndex(step), true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.onSeek(this.stepIndex(-step), true); }
    });
  }
  stepIndex(d) {
    const dir = this.reversed ? -1 : 1;
    return clamp(this.cursor + d * dir, 0, this.route.n - 1);
  }

  setRoute(route, reversed) {
    this.route = route; this.reversed = reversed;
    this.build();
  }
  setReversed(r) { this.reversed = r; this.build(); }

  build() {
    const r = this.route;
    if (!r || r.n < 2) { this.svg.innerHTML = ''; return; }
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < r.n; i++) { if (r.z[i] < zMin) zMin = r.z[i]; if (r.z[i] > zMax) zMax = r.z[i]; }
    const pad = Math.max(40, (zMax - zMin) * 0.1);
    this.zLo = Math.floor((zMin - pad) / 100) * 100;
    this.zHi = Math.ceil((zMax + pad) / 100) * 100;
    const X = (i) => (r.dirDist(i, this.reversed) / r.length) * W;
    const Y = (z) => PAD_T + (1 - (z - this.zLo) / (this.zHi - this.zLo)) * (H - PAD_T - PAD_B);
    this.X = X; this.Y = Y;

    const order = [];
    for (let i = 0; i < r.n; i++) order.push(this.reversed ? r.n - 1 - i : i);

    let d = '';
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      d += `${k ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(r.z[i]).toFixed(1)}`;
    }
    const fill = `${d}L${W} ${H - PAD_B}L0 ${H - PAD_B}Z`;

    // Steep stretches, drawn over the line so the shape of the day is readable at a glance.
    let steep = '';
    let run = null;
    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const g = Math.abs(r.gradientAt(i, 2));
      if (g >= 0.25) {
        if (!run) { run = true; steep += `M${X(i).toFixed(1)} ${Y(r.z[i]).toFixed(1)}`; }
        else steep += `L${X(i).toFixed(1)} ${Y(r.z[i]).toFixed(1)}`;
      } else run = null;
    }

    let grid = '';
    for (let z = this.zLo; z <= this.zHi; z += 200) {
      grid += `<line class="pgrid" x1="0" y1="${Y(z).toFixed(1)}" x2="${W}" y2="${Y(z).toFixed(1)}"/>`;
      grid += `<text class="plab" data-ax="0" data-ay="${(Y(z) - 3).toFixed(1)}" x="0" y="0">${z} m</text>`;
    }
    let km = '';
    for (const mk of (r.kmMarks || [])) {
      const i = clamp(mk.i | 0, 0, r.n - 1);
      const x = X(i);
      km += `<line class="pkm" x1="${x.toFixed(1)}" y1="${PAD_T}" x2="${x.toFixed(1)}" y2="${H - PAD_B}"/>`;
    }
    let wps = '';
    for (const w of (r.waypoints || [])) {
      const x = X(w.i), y = Y(r.z[w.i]);
      wps += `<circle class="pwp" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2"/>`;
      wps += `<text class="pwpt" data-ax="${x.toFixed(1)}" data-ay="${(y - 8).toFixed(1)}" x="0" y="0" text-anchor="middle">${escapeHtml(w.name)}</text>`;
    }
    let axis = '';
    const kmTotal = r.length / 1000;
    const stepKm = kmTotal > 20 ? 5 : (kmTotal > 8 ? 2 : 1);
    for (let k = 0; k <= Math.floor(kmTotal); k += stepKm) {
      const x = (k / kmTotal) * W;
      axis += `<text class="pax" data-ax="${x.toFixed(1)}" data-ay="${H - 5}" x="0" y="0" text-anchor="middle">${k}</text>`;
    }

    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.svg.innerHTML =
      `<path class="pfill" d="${fill}"/>` +
      grid + km +
      `<path class="pline" d="${d}"/>` +
      (steep ? `<path class="psteep" d="${steep}"/>` : '') +
      wps +
      `<line id="pcur" class="pcur" x1="0" y1="${PAD_T}" x2="0" y2="${H - PAD_B}"/>` +
      `<circle id="pdot" class="pdot" cx="0" cy="0" r="4.5"/>` +
      axis;
    this.cur = this.svg.querySelector('#pcur');
    this.dot = this.svg.querySelector('#pdot');
    this.labels = Array.from(this.svg.querySelectorAll('text[data-ax]'));
    this.relayout();
    this.setCursor(this.cursor);
  }

  // Place every label at its natural size, inside the strip, and off its neighbours. Called after
  // a build and again on resize, because the counter-scale depends on the width the strip got.
  relayout() {
    const svg = this.svg;
    const cw = svg.clientWidth, ch = svg.clientHeight;
    if (!cw || !ch || !this.labels || !this.labels.length) return;
    const sx = W / cw, sy = H / ch;        // undo preserveAspectRatio="none", both axes
    const PAD = 3;

    // Position one label and return its box in CSS pixels measured from the strip's top left.
    // Inside the transform one unit is one pixel, so dx and dy are pixels too.
    const put = (el, dx, dy) => {
      const ax = +el.dataset.ax, ay = +el.dataset.ay;
      el.setAttribute('transform', `translate(${ax} ${ay}) scale(${sx.toFixed(5)} ${sy.toFixed(5)})`);
      el.setAttribute('x', dx.toFixed(1));
      el.setAttribute('y', dy.toFixed(1));
      const b = el.getBBox();
      const px = ax / sx, py = ay / sy;
      return { x0: px + b.x, x1: px + b.x + b.width, y0: py + b.y, y1: py + b.y + b.height };
    };
    const inset = (box) => (box.x0 < PAD ? PAD - box.x0
      : box.x1 > cw - PAD ? (cw - PAD) - box.x1 : 0);
    const hits = (a, b) => a.x0 < b.x1 + 2 && b.x0 < a.x1 + 2 && a.y0 < b.y1 + 1 && b.y0 < a.y1 + 1;

    const wpt = this.labels.filter((e) => e.classList.contains('pwpt'));
    const rest = this.labels.filter((e) => !e.classList.contains('pwpt'));
    const placed = [];

    // The names the strip exists for go first, each pulled inside the edge if it hangs over.
    // A name that would sit on its neighbour is nudged off it — up first, so it stays clear of
    // the profile line — and only dropped if none of those places is free. The dot stays either
    // way, and every waypoint is also labelled on the terrain itself.
    const ROWS = [0, -12, 6, -18, 12];
    for (const el of wpt) {
      el.style.display = '';
      let box = put(el, 0, 0);
      const dx = inset(box);
      if (dx) box = put(el, dx, 0);
      let ok = !placed.some((p) => hits(box, p));
      for (let r = 1; !ok && r < ROWS.length; r++) {
        const cand = put(el, dx, ROWS[r]);
        if (cand.y0 < 1 || cand.y1 > ch - 14) continue;
        if (!placed.some((p) => hits(cand, p))) { box = cand; ok = true; }
      }
      if (!ok) { el.style.display = 'none'; continue; }
      placed.push(box);
    }
    // The axes yield: a metre label tries the other side of the strip, a kilometre number is
    // dropped rather than drawn through a name. The gridline itself stays either way.
    for (const el of rest) {
      el.style.display = '';
      const axis = el.classList.contains('pax');
      let box = put(el, axis ? 0 : PAD, 0);
      const dx = inset(box);
      if (dx) box = put(el, (axis ? 0 : PAD) + dx, 0);
      if (placed.some((p) => hits(box, p))) {
        if (axis) { el.style.display = 'none'; continue; }
        // box moves one for one with dx, so this lands its right edge on the right inset
        const moved = put(el, PAD + ((cw - PAD) - box.x1), 0);
        if (moved.x0 < PAD || placed.some((p) => hits(moved, p))) { el.style.display = 'none'; continue; }
        box = moved;
      }
      placed.push(box);
    }
  }

  setCursor(i) {
    if (!this.route || !this.cur) return;
    this.cursor = clamp(i | 0, 0, this.route.n - 1);
    const x = this.X(this.cursor), y = this.Y(this.route.z[this.cursor]);
    this.cur.setAttribute('x1', x.toFixed(1));
    this.cur.setAttribute('x2', x.toFixed(1));
    this.dot.setAttribute('cx', x.toFixed(1));
    this.dot.setAttribute('cy', y.toFixed(1));
    this.svg.setAttribute('aria-valuenow', Math.round(this.route.dirDist(this.cursor, this.reversed)));
    this.svg.setAttribute('aria-valuetext',
      `${fmt(this.route.dirDist(this.cursor, this.reversed) / 1000, 2)} km, ${Math.round(this.route.z[this.cursor])} metres`);
  }
}
