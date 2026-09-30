// #over, above the dots (DESIGN §5.7): volcanoes as triangles by threat class, filled with USGS's color
// code (empty when not monitored) and receding at wide zoom; place and volcano labels that never collide,
// with each other or with the foot's glass (volcano names from zoom 4.5, or when above Normal or chosen);
// the selection ring; glass tabs. The section corridor and story annotation are drawn by app.js's hook.

import { wx, wy } from './data.js';
import { cssVar } from './util.js';
import { VOLCANO } from './ramp.js';

const THREAT = { 'Very High Threat': 11, 'High Threat': 10, 'Moderate Threat': 9, 'Low Threat': 8, 'Very Low Threat': 7 };
const FONT = '400 11px "Atkinson Hyperlegible", system-ui, -apple-system, sans-serif';
const VFONT = '400 10.5px "Atkinson Hyperlegible", system-ui, -apple-system, sans-serif';

export function volcanoStatus(S) {
  const V = S && S.volcanoes, m = new Map();
  // a status that was never read (ok: false) fills nothing, whatever `monitored` holds (DESIGN §10.1)
  if (V && V.ok !== false && Array.isArray(V.monitored)) for (const v of V.monitored) m.set(String(v.vnum), v);
  return { known: m.size > 0, readAt: V ? V.readAt : null, byVnum: m };
}

export function tab(x, l, t, w, h, s) {
  x.fillStyle = cssVar('--glass'); x.fillRect(l, t, w, h); x.lineWidth = 1; x.strokeStyle = cssVar('--line'); x.strokeRect(l + 0.5, t + 0.5, w - 1, h - 1);
  x.fillStyle = cssVar('--ink'); x.fillText(s, l + w / 2, t + h / 2 + 0.5);
}
// k (0–1) is how far the view is zoomed in: at the Lower 48's scale a triangle is 0.65 of its size with
// thinner strokes, so volcanoes recede behind the earthquakes; from the California chip's scale, full
export function triangle(x, cx, cy, size, fill, dashed, k = 1) {
  const h = size * 0.87;
  x.beginPath(); x.moveTo(cx, cy - h * 0.62); x.lineTo(cx + size / 2, cy + h * 0.38); x.lineTo(cx - size / 2, cy + h * 0.38); x.closePath();
  x.lineJoin = 'miter';
  x.strokeStyle = cssVar('--panel'); x.lineWidth = 1.5 + 1.5 * k; x.stroke();
  if (fill) { x.fillStyle = fill; x.fill(); } else { x.fillStyle = cssVar('--glass'); x.fill(); }
  x.strokeStyle = cssVar('--ink'); x.lineWidth = 0.75 + 0.25 * k; x.setLineDash(dashed ? [2, 2] : []); x.stroke(); x.setLineDash([]);
}

export function drawOverlay(x, G, M, L, st) {
  x.clearRect(0, 0, M.w, M.h);
  const boxes = [], halo = cssVar('--bg'), ink2 = cssVar('--ink-2');
  const free = (b) => { for (const o of boxes) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return false; boxes.push(b); return true; };
  const zoom = Math.log2(M.v.s / M.sMin());
  const on = (px, py, pad = 20) => px > -pad && px < M.w + pad && py > -pad && py < M.h + pad;
  boxes.push([0, 0, M.w, M.ins.top]);
  if (M.ins.key) boxes.push(M.ins.key);
  for (const b of st.avoid || []) boxes.push(b);
  if (L.volcanoes) {
    const vs = st.volcanoes, named = [], k = Math.min(1, Math.max(0, (zoom - 1) / 2.25));
    for (const v of G.volcanoes) {
      const px = M.sx(wx(v.lon)), py = M.sy(wy(v.lat));
      if (!on(px, py)) continue;
      const m = vs.byVnum.get(String(v.vnum)), size = (THREAT[v.threat] || 7) * (0.65 + 0.35 * k);
      triangle(x, px, py, size, m ? VOLCANO[m.color] : null, !THREAT[v.threat], k);
      boxes.push([px - size / 2, py - size / 2, px + size / 2, py + size / 2]);
      if (zoom >= 4.5 || (m && (m.alert !== 'NORMAL' || m.color !== 'GREEN')) || String(v.vnum) === st.pickV) named.push([v.name, px, py]);
    }
    if (L.labels) {
      x.font = VFONT; x.textBaseline = 'middle';
      for (const [name, px, py] of named) {
        const w = x.measureText(name).width, b = [px + 7, py - 6, px + 9 + w, py + 6];
        if (b[2] <= M.w && free(b)) { x.lineWidth = 3; x.strokeStyle = halo; x.lineJoin = 'round'; x.strokeText(name, px + 8, py); x.fillStyle = ink2; x.fillText(name, px + 8, py); }
      }
    }
  }
  if (st.sel) {
    const [px, py] = M.toScreen(st.sel.lon, st.sel.lat), r = st.sel.diam / 2 + 4;
    x.beginPath(); x.arc(px, py, r, 0, 7); x.lineWidth = 3.5; x.strokeStyle = cssVar('--panel'); x.stroke();
    x.lineWidth = 1.5; x.strokeStyle = cssVar('--ink'); x.stroke();
    boxes.push([px - r, py - r, px + r, py + r]);
  }
  if (L.labels) {
    x.font = FONT; x.textBaseline = 'middle'; x.textAlign = 'left';
    const maxRank = zoom < 0.6 ? 0 : zoom < 1.5 ? 1 : zoom < 2.5 ? 2 : zoom < 3.5 ? 3 : 7;
    for (const p of G.places) {
      if (p.r > maxRank) continue;
      const px = M.sx(wx(p.lon)), py = M.sy(wy(p.lat));
      if (!on(px, py, 0)) continue;
      const name = p.n.replace(/\s+/g, ' '), w = x.measureText(name).width;
      const b = [px - 2, py - 7, px + 6 + w, py + 7];
      if (b[2] > M.w || !free(b)) continue;
      x.fillStyle = ink2; x.beginPath(); x.arc(px, py, 1.5, 0, 7); x.fill();
      x.lineWidth = 3; x.strokeStyle = halo; x.lineJoin = 'round'; x.strokeText(name, px + 5, py); x.fillText(name, px + 5, py);
    }
  }
  if (st.extra) st.extra(x, M);
}
