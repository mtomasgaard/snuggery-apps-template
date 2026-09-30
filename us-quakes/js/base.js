// The 2D basemap (DESIGN §5.7), built per view from geo.json and decimated to 0.75 px: #base holds sea,
// the eight depth bands, land and lakes, and past the basemap's edge the strip's "no record" hatching; #lines,
// under the dots, holds coast, borders, state lines and faults by age class (fainter below zoom 5), and
// strokeFault draws a selected fault with its halo on #over.

import { wx, wy } from './data.js';
import { cssVar, hatch } from './util.js';

function trace(x, sh, M, close, from = 0, to = sh.p.length) {
  const { cx, cy, s } = M.v, hw = M.w / 2, hh = M.h / 2, p = sh.p;
  let lx = 1e9, ly = 1e9;
  for (let i = from; i < to; i += 2) {
    const px = (p[i] - cx) * s + hw, py = (p[i + 1] - cy) * s + hh;
    if (i === from) { x.moveTo(px, py); lx = px; ly = py; continue; }
    if (i < to - 2 && Math.abs(px - lx) < 0.75 && Math.abs(py - ly) < 0.75) continue;
    x.lineTo(px, py); lx = px; ly = py;
  }
  if (close) x.closePath();
}
function inView(bb, M, minPx = 0) {
  const { cx, cy, s } = M.v, hw = M.w / 2 / s, hh = M.h / 2 / s;
  if (bb[2] < cx - hw || bb[0] > cx + hw || bb[3] < cy - hh || bb[1] > cy + hh) return false;
  return minPx <= 0 || Math.max(bb[2] - bb[0], bb[3] - bb[1]) * s >= minPx;
}
function fillAll(x, list, M, color) {
  x.beginPath();
  for (const sh of list) if (inView(sh.bb, M, 0.75)) trace(x, sh, M, true);
  x.fillStyle = color; x.fill('evenodd');
}
function strokeAll(x, list, M, width, alpha, dash) {
  x.beginPath();
  for (const sh of list) if (inView(sh.bb, M)) trace(x, sh, M, false);
  x.lineWidth = width; x.globalAlpha = alpha; x.setLineDash(dash || []); x.stroke();
  x.globalAlpha = 1; x.setLineDash([]);
}

export function drawBase(x, G, M, L) {
  const b = G.basemap, { cx, cy, s } = M.v, X0 = wx(b.west), Y0 = wy(b.north);
  const bx = (X0 - cx) * s + M.w / 2, by = (Y0 - cy) * s + M.h / 2, bw = (wx(b.east) - X0) * s, bh = (wy(b.south) - Y0) * s;
  x.fillStyle = cssVar('--bg'); x.fillRect(0, 0, M.w, M.h);
  // past the basemap's edge (168° E–55° W, 25° S–81° N) the paper is hatched, as the strip marks "no record";
  // the view keeps the panel inside it (map.js), so this shows only where the panel is wider or taller
  if (bx > 0 || by > 0 || bx + bw < M.w || by + bh < M.h) {
    x.save(); x.beginPath(); x.rect(0, 0, M.w, M.h); x.rect(bx, by, bw, bh); x.clip('evenodd');
    hatch(x, 0, 0, M.w, M.h, cssVar('--hatch-map'), 7);
    x.restore();
    x.strokeStyle = cssVar('--line-strong'); x.lineWidth = 1; x.strokeRect(Math.round(bx) - 0.5, Math.round(by) - 0.5, Math.round(bw) + 1, Math.round(bh) + 1);
  }
  x.save();
  x.beginPath(); x.rect(bx, by, bw, bh); x.clip();
  x.fillStyle = cssVar('--sea'); x.fillRect(0, 0, M.w, M.h);
  if (L.bathy) G.bathy.forEach((b, i) => fillAll(x, b.rings, M, cssVar(`--sea-${i + 1}`)));
  fillAll(x, G.land, M, cssVar('--land'));
  fillAll(x, G.lakes, M, cssVar('--sea'));
  x.restore();
}

// faults by age class, most recent strongest (DESIGN §10.1): [width, alpha]
const AGE_STYLE = { historic: [1.4, 0.9], 'latest Quaternary': [1.1, 0.75], 'late Quaternary': [0.9, 0.6],
  'middle and late Quaternary': [0.7, 0.45], 'undifferentiated Quaternary': [0.6, 0.35], 'class B': [0.6, 0.35] };
export function faultStyle(F, g) {
  const [, , age, , , line, cls] = F.groups[g];
  const [w, a] = AGE_STYLE[F.ages[age]] || [0.6, 0.35];
  const dash = F.ages[age] === 'class B' || F.classes[cls] === 'B' ? [1, 3] : F.lineTypes[line] === 'Inferred' ? [3, 3] : null;
  return [w, a, dash];
}

export function drawLines(x, G, M, L) {
  x.clearRect(0, 0, M.w, M.h);
  x.lineJoin = 'round'; x.lineCap = 'round';
  x.strokeStyle = cssVar('--ink');
  strokeAll(x, G.coast, M, 0.9, 0.55);
  strokeAll(x, G.borders, M, 0.8, 0.45);
  if (L.states) strokeAll(x, G.states, M, 0.6, 0.3, [3, 2]);
  if (!L.faults) return;
  const F = G.faults, byStyle = new Map();
  for (let g = 0; g < F.lines.length; g++) {
    const sh = F.lines[g];
    if (!inView(sh.bb, M, 2)) continue;
    const st = faultStyle(F, g), key = st.join('|');
    if (!byStyle.has(key)) byStyle.set(key, [st, []]);
    byStyle.get(key)[1].push(g);
  }
  x.strokeStyle = cssVar('--fault');
  x.lineCap = 'butt';
  // at the wide and regional chips (zoom < 5) faults recede to 0.55–1 of their class's alpha, so the
  // earthquakes read first (ART.md "Layers"); from zoom 5 in, each class keeps its §10.1 alpha
  const fz = Math.min(1, Math.max(0.55, 0.55 + (0.45 * (Math.log2(M.v.s / M.sMin()) - 3)) / 2));
  for (const [[w, a0, dash], gs] of byStyle.values()) {
    const a = a0 * fz;
    x.beginPath();
    for (const g of gs) {
      const sh = F.lines[g];
      let at = 0;
      for (const c of sh.counts) { trace(x, sh, M, false, at, at + 2 * c); at += 2 * c; }
    }
    x.lineWidth = w; x.globalAlpha = a; x.setLineDash(dash || []); x.stroke();
  }
  x.globalAlpha = 1; x.setLineDash([]);
}

export function strokeFault(x, G, M, g) {
  const sh = G.faults.lines[g];
  let at = 0;
  x.beginPath();
  for (const c of sh.counts) { trace(x, sh, M, false, at, at + 2 * c); at += 2 * c; }
  x.lineJoin = x.lineCap = 'round';
  x.lineWidth = 5; x.strokeStyle = cssVar('--panel'); x.stroke(); x.lineWidth = 2; x.strokeStyle = cssVar('--ink'); x.stroke();
}
