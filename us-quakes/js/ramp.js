// The marks (DESIGN §6, ART.md "Palette"): the depth ramp interpolated in OKLab over six stops, the rim
// chosen by the dot's own depth (dark under 60 km, light from 60 km), the size rule (each magnitude step
// doubles the area; M 2.2 and below share the 2 px floor; a hollow ring never smaller than an M 4 dot, so
// its hole shows), the volcano codes and the floors. Everything that draws a dot in 2D uses drawDot.

import { clamp } from './util.js';

export const STOPS = ['#fde28d', '#f5a231', '#dc6673', '#9a6299', '#5d47ad', '#2a3b6b'];
export const DEPTHS = [0, 10, 35, 70, 150, 300];
export const NODEPTH = '#8a9099';
export const RIM_DARK = 'rgba(16,20,24,0.55)';
export const RIM_LIGHT = 'rgba(255,255,255,0.5)';
export const RIM_KM = 60;
export const VOLCANO = { GREEN: '#4f9a5a', YELLOW: '#f2cc38', ORANGE: '#ee8a2a', RED: '#d0342c' };
export const FLOORS = [[2.5, 45], [4, 60], [5, 70], [6, 80]];

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function oklab(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => toLin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export const LABS = STOPS.map(oklab);
function rgbOf([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .map((c) => Math.round(255 * clamp(toSrgb(c), 0, 1)));
}
export function depthColor(km) {
  if (km == null) return NODEPTH;
  const d = clamp(km, 0, 300);
  let i = 0;
  while (i < 4 && d > DEPTHS[i + 1]) i++;
  const t = (d - DEPTHS[i]) / (DEPTHS[i + 1] - DEPTHS[i]);
  const c = rgbOf(LABS[i].map((v, k) => v + (LABS[i + 1][k] - v) * t));
  return `rgb(${c.join(',')})`;
}
export const dotSize = (M, k = 1) => clamp(2.2 * Math.SQRT2 ** (M - 2.5), 2, 40) * k;
// a hollow (automatic, live) ring: at least an M 4 dot's diameter, the ring max(0.9 px, 0.18 d) wide
export const HOLLOW_MIN_M = 4;
export const hollowSize = (diam, k = 1) => Math.max(diam, dotSize(HOLLOW_MIN_M, k));
export const ringWidth = (diam) => Math.max(0.9, 0.18 * diam);

export function rampBar(x, x0, y0, w, h) {
  for (let i = 0; i < w; i++) {
    const k = (i / w) * 5, j = Math.floor(k);
    x.fillStyle = depthColor(DEPTHS[j] + (DEPTHS[j + 1] - DEPTHS[j]) * (k % 1));
    x.fillRect(x0 + i, y0, 1, h);
  }
}
export function rampPos(km) {
  const d = clamp(km, 0, 300);
  let i = 0;
  while (i < 4 && d > DEPTHS[i + 1]) i++;
  return (i + (d - DEPTHS[i]) / (DEPTHS[i + 1] - DEPTHS[i])) / 5;
}

// each hole is its own full circle, a subpath of its own (an anticlockwise arc from 0 to 7 rad is not a full
// turn, and joined to the outer circle it left a notch at 3 o'clock); even-odd makes it a hole either way
export function drawDot(x, cx, cy, diam, km, hollow = false, dpr = 2, rimLight = 0.5, k = 1) {
  if (hollow) diam = hollowSize(diam, k);
  const r = diam / 2, rim = 1 / dpr, hole = (q) => { x.moveTo(cx + q, cy); x.arc(cx, cy, q, 0, 7); };
  x.beginPath(); x.arc(cx, cy, r + rim, 0, 7); hole(r);
  x.fillStyle = km != null && km >= RIM_KM ? `rgba(255,255,255,${rimLight})` : RIM_DARK; x.fill('evenodd');
  x.beginPath(); x.arc(cx, cy, r, 0, 7);
  if (hollow) hole(Math.max(0, r - ringWidth(diam)));
  x.fillStyle = depthColor(km); x.fill('evenodd');
}
