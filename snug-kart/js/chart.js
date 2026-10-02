// The Lap Chart (ART.md 1): the results sheet's chart of every racer's place at every timing line,
// and the race card's strip of your own line as it is written. 2D canvases at the device pixel
// ratio, labels in the house face.

import { GATES } from './race.js';
import { tone, token } from './palette.js';

const FONT = '"Ysabeau Office", system-ui, sans-serif';
const ROW = 16, TOP = 7, LABELS = 30;

function sized(cv, h) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth || 300;
  const W = Math.round(w * dpr), H = Math.round(h * dpr), g = cv.getContext('2d');
  cv.style.height = `${h}px`;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }   // a new backing store only when the size changes
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.lineCap = 'round'; g.lineJoin = 'round';
  return [g, w];
}
const line = (g, pts, width, color, dash) => {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.lineWidth = width; g.strokeStyle = color; g.setLineDash(dash || []); g.stroke(); g.setLineDash([]);
};
const disc = (g, x, y, d, color) => { g.beginPath(); g.arc(x, y, d / 2, 0, 7); g.fillStyle = color; g.fill(); };

/**
 * The results chart. x: the timing line, 0 (the grid) to 30 (the finish); y: the place, 1 at the top.
 * Returns what it drew, in CSS px, for the test hook.
 */
export function drawChart(cv, race) {
  const n = race.karts.length, cols = GATES * race.laps;
  const [g, w] = sized(cv, TOP + (n - 1) * ROW + LABELS);
  const ink = token('--ink'), ink2 = token('--ink-2'), ink3 = token('--ink-3'), sheet = token('--sheet');
  const first = (k) => k.racer.name.split(' ')[0];
  g.font = `620 10.5px ${FONT}`;
  const nameW = Math.max(...race.karts.map((k) => g.measureText(first(k)).width));
  const x0 = 14, x1 = w - nameW - 8;
  const X = (c) => x0 + (c * (x1 - x0)) / cols, Y = (p) => TOP + (p - 1) * ROW;
  const bottom = Y(n) + 6;
  // The axis: places 1 and last at the left, the laps under the plot.
  g.font = `400 10.5px ${FONT}`; g.textBaseline = 'middle';
  g.fillStyle = ink3; g.textAlign = 'left';
  g.fillText('1', 0, Y(1)); g.fillText(String(n), 0, Y(n));
  for (let c = 0; c <= cols; c++) {
    const lap = c % GATES === 0 && c > 0 && c < cols;
    g.globalAlpha = lap ? 1 : 0.5;
    g.fillStyle = lap ? ink2 : ink3; g.fillRect(X(c) - 0.5, bottom, 1, lap ? 7 : 3);
  }
  g.globalAlpha = 1; g.fillStyle = ink2; g.textBaseline = 'alphabetic';
  const under = bottom + 19;
  g.textAlign = 'left'; g.fillText('Grid', X(0), under);
  for (let l = 1; l < race.laps; l++) { g.textAlign = 'center'; g.fillText(`Lap ${l + 1}`, X(l * GATES), under); }
  g.textAlign = 'right'; g.fillText('Finish', X(cols), under);
  // The lines: rivals from last place to first, then yours on its casing.
  const points = {}, order = [...race.karts].sort((a, b) => b.place - a.place);
  for (const k of [...order.filter((o) => !o.isPlayer), race.player]) {
    const pts = k.gates.map((p, c) => [X(c), Y(p)]);
    points[k.racer.id] = pts;
    const color = k.isPlayer ? ink : tone(k.racer);
    const end = [X(cols), Y(k.place)];
    if (k.isPlayer) line(g, pts, 6, sheet);
    line(g, pts, k.isPlayer ? 2 : 1.5, color);
    if (k.projected) line(g, [pts[pts.length - 1], end], k.isPlayer ? 2 : 1.5, color, [2, 3]);
    if (k.isPlayer) disc(g, ...end, 5, ink);
  }
  // Each line named at its end, at its final row.
  g.textAlign = 'left'; g.textBaseline = 'middle';
  for (const k of race.karts) {
    g.font = `${k.isPlayer ? 620 : 400} 10.5px ${FONT}`;
    g.fillStyle = k.isPlayer ? ink : ink2;
    g.fillText(first(k), x1 + 6, Y(k.place));
  }
  return { points, x0, x1, top: TOP, row: ROW, cols };
}

/** The race card's strip: your line so far, its head at your distance and place. */
export function drawStrip(cv, race, k) {
  const n = race.karts.length, cols = GATES * race.laps, h = 24;
  const [g, w] = sized(cv, h);
  const X = (c) => 3 + (c * (w - 6)) / cols, Y = (p) => 3 + ((p - 1) * (h - 9)) / (n - 1);
  const ink = token('--ink'), ink3 = token('--ink-3');
  g.globalAlpha = 0.5; g.fillStyle = ink3;
  for (let l = 1; l < race.laps; l++) g.fillRect(X(l * GATES) - 0.5, h - 3, 1, 3);
  g.globalAlpha = 1;
  const head = [X(Math.min(cols, Math.max(0, k.dist) / (race.track.L / GATES))), Y(k.place)];
  line(g, [...k.gates.map((p, c) => [X(c), Y(p)]), head], 1.5, ink);
  disc(g, ...head, 5, ink);
}

/** The strip's head in whole pixels: it is redrawn only when this or the place changes. */
export const stripKey = (cv, race, k) =>
  `${Math.round((Math.min(GATES * race.laps, Math.max(0, k.dist) / (race.track.L / GATES)) * ((cv.clientWidth || 132) - 6)) / (GATES * race.laps))}:${k.place}:${k.gates.length}`;
