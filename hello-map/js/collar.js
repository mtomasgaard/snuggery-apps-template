// The signature: the quadrangle collar (ART.md). A USGS topographic quadrangle is printed inside a
// frame whose edges are ticked at whole steps of latitude and longitude, with the degrees and
// minutes written at the ticks, and small crosses where the grid's lines would meet inside the map.
// This app draws the same instrument over the live map, for the view on screen: ticks on all four
// edges, labels on the left (latitude) and the foot (longitude), crosses inside. The step is the
// smallest of the quadrangle family's (7.5′, 2.5′ and their kin) that keeps the ticks at least
// MIN_GAP CSS px apart, and the caption line prints it. Everything here is computed from the view;
// nothing is fetched, so the collar stays when the map cannot load. It is drawn in one style in
// both themes, dark ink on a pale halo, because the map under it keeps one look in both.

import { worldPx, lonToX, latToY, yToLat, LAT_MAX } from './mercator.js';
import * as U from './units.js';

/** The steps, in seconds of arc: 7.5′ and 2.5′ are the quadrangle's own, 15′, 30′ and 1° its
 *  coarser series; the rest extend the family down to a city block and up to the whole country. */
export const STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 150, 300, 450, 900, 1800, 3600, 7200, 18000, 36000, 72000];
export const MIN_GAP = 120;
const TICK = 8, CROSS = 5;
export const FONT = '560 11.5px "Ysabeau Office", system-ui, sans-serif';

/** The grid step for a zoom: the smallest whose ticks along a parallel stand MIN_GAP px apart. */
export function stepFor(z) {
  const pxPerDeg = worldPx(z) / 360;
  for (const s of STEPS) if ((s / 3600) * pxPerDeg >= MIN_GAP) return s;
  return STEPS[STEPS.length - 1];
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Draw the collar on the overlay canvas. view: { cx, cy, z, w, h, dpr }; style: { ink, halo };
 * keepClear: rectangles (CSS px, the plate's own) where no label goes, as the layer switch.
 * Returns { step, ticksX, ticksY, labels } for the caption and the test hook.
 */
export function drawCollar(ctx, view, style, keepClear = []) {
  const { cx, cy, z, w, h, dpr } = view;
  const W = worldPx(z), step = stepFor(z), sd = step / 3600;
  const lonL = (cx - w / 2 / W) * 360 - 180, lonR = (cx + w / 2 / W) * 360 - 180;
  const latT = yToLat(Math.max(0, cy - h / 2 / W)), latB = yToLat(Math.min(1, cy + h / 2 / W));
  const X = (lon) => (lonToX(lon) - cx) * W + w / 2;
  const Y = (lat) => (latToY(lat) - cy) * W + h / 2;

  const xs = [], ys = [];
  for (let i = Math.ceil(lonL / sd); i * sd <= lonR; i++) xs.push({ v: i * sd, px: X(i * sd) });
  for (let i = Math.ceil(Math.max(-LAT_MAX, latB) / sd); i * sd <= Math.min(LAT_MAX, latT); i++) ys.push({ v: i * sd, px: Y(i * sd) });

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // where the labels go: longitude along the foot, latitude along the left edge, each clear of the
  // others and of the plate's controls; a label that would collide is left out, never squeezed
  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';
  const placed = [], labels = [];
  const place = (s, x, y, kind) => {
    const bw = ctx.measureText(s).width, box = { x: x - 2, y: y - 11, w: bw + 4, h: 14 };
    if (box.x < 2 || box.x + box.w > w - 2 || box.y < 2 || box.y + box.h > h - 2) return;
    if (keepClear.some((r) => overlaps(box, r)) || placed.some((r) => overlaps(box, { x: r.x - 6, y: r.y - 2, w: r.w + 12, h: r.h + 4 }))) return;
    placed.push(box);
    labels.push({ kind, s, x, y, box });
  };
  for (const t of xs) {
    const lon = ((t.v + 540) % 360) - 180;
    const s = U.tick(Math.abs(lon) < 1e-9 ? 0 : lon, step, 'E', 'W');
    place(s, t.px - ctx.measureText(s).width / 2, h - TICK - 4, 'lon');
  }
  for (const t of ys) {
    if (t.px > h - 34) continue;          // the foot's labels own the bottom corner
    place(U.tick(t.v, step, 'N', 'S'), TICK + 4, t.px + 4, 'lat');
  }

  // the strokes: halo first, ink over it; a cross that would touch a label is left out
  const clearOfLabels = (x, y) => !placed.some((b) => x + CROSS + 3 > b.x && x - CROSS - 3 < b.x + b.w && y + CROSS + 3 > b.y && y - CROSS - 3 < b.y + b.h);
  const path = () => {
    ctx.beginPath();
    for (const t of xs) { ctx.moveTo(t.px, 0); ctx.lineTo(t.px, TICK); ctx.moveTo(t.px, h); ctx.lineTo(t.px, h - TICK); }
    for (const t of ys) { ctx.moveTo(0, t.px); ctx.lineTo(TICK, t.px); ctx.moveTo(w, t.px); ctx.lineTo(w - TICK, t.px); }
    for (const a of xs) for (const b of ys) {
      if (a.px < 18 || a.px > w - 18 || b.px < 18 || b.px > h - 18 || !clearOfLabels(a.px, b.px)) continue;
      ctx.moveTo(a.px - CROSS, b.px); ctx.lineTo(a.px + CROSS, b.px);
      ctx.moveTo(a.px, b.px - CROSS); ctx.lineTo(a.px, b.px + CROSS);
    }
  };
  path();
  ctx.strokeStyle = style.halo; ctx.lineWidth = 3.4; ctx.stroke();
  path();
  ctx.strokeStyle = style.ink; ctx.lineWidth = 1.4; ctx.stroke();
  for (const l of labels) {
    ctx.lineWidth = 3; ctx.strokeStyle = style.halo; ctx.strokeText(l.s, l.x, l.y);
    ctx.fillStyle = style.ink; ctx.fillText(l.s, l.x, l.y);
  }
  return { step, ticksX: xs.length, ticksY: ys.length, labels };
}

/** The tapped point: a ring with a dot, on the same halo. */
export function drawMarker(ctx, view, style, lon, lat) {
  const { cx, cy, z, w, h, dpr } = view;
  const W = worldPx(z);
  let dx = lonToX(lon) - cx;
  dx -= Math.round(dx);                  // the nearest copy of the world
  const x = dx * W + w / 2, y = (latToY(lat) - cy) * W + h / 2;
  if (x < -10 || x > w + 10 || y < -10 || y > h + 10) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2);
  ctx.strokeStyle = style.halo; ctx.lineWidth = 4.4; ctx.stroke();
  ctx.strokeStyle = style.ink; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = style.ink; ctx.fill();
  return { x, y };
}
