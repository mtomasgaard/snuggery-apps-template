// The anomaly ramp (ART.md "The anomaly ramp", DESIGN §7): ART's nine OKLCh stops, interpolated in
// OKLab, fixed at ±4 °C on the map and ±1.5 °C on the stripes, the same in both themes. The scales are
// constants of the app, never read from the snapshot (CONTRACT §0). tools/check.mjs asserts that STOPS
// equal ART.md's table and that the ramp meets DESIGN §7.1's constraints. Pure: runs in Node.
// The OKLab → sRGB conversion is tools/art/ramp.py's (Björn Ottosson's published matrices).

/** [°C, L, C, h°] — ART.md's table, in order. */
export const STOPS = [
  [-4, 0.440, 0.120, 262],
  [-2, 0.640, 0.105, 251],
  [-1, 0.800, 0.062, 245],
  [-0.5, 0.890, 0.030, 240],
  [0, 0.965, 0.004, 95],
  [0.5, 0.890, 0.032, 30],
  [1, 0.800, 0.068, 28],
  [2, 0.640, 0.125, 27],
  [4, 0.440, 0.125, 24],
];
/** The map's scale, ±4 °C, and the stripes' own, ±1.5 °C (DESIGN §7.1, §7.2). */
export const MAP_SCALE = 4;
export const STRIPES_SCALE = 1.5;
/** No data (DESIGN §7.4): the hatch's ground (OKLab L 0.68) and its lines (L 0.60), chroma 0. */
export const HATCH_GROUND = [152, 152, 152];
export const HATCH_LINE = [128, 128, 128];

const LABS = STOPS.map(([v, L, C, h]) => [v, L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)]);

export function oklabToLinear(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const encode = (x) => { x = Math.min(1, Math.max(0, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)); };

/** OKLab of the ramp at v °C on the map's scale (clamped to its ends). */
export function rampLab(v) {
  v = Math.max(-MAP_SCALE, Math.min(MAP_SCALE, v));
  for (let i = 0; i < LABS.length - 1; i++) {
    const p = LABS[i], n = LABS[i + 1];
    if (v <= n[0]) {
      const t = (v - p[0]) / (n[0] - p[0]);
      return [p[1] + (n[1] - p[1]) * t, p[2] + (n[2] - p[2]) * t, p[3] + (n[3] - p[3]) * t];
    }
  }
  return LABS[LABS.length - 1].slice(1);
}
/** sRGB 0..255 of the map ramp at v °C. */
export const rampRGB = (v) => oklabToLinear(...rampLab(v)).map(encode);
/** A stripe's color: GISS's global mean on the ±1.5 °C scale, through the same ramp. */
export const stripeRGB = (v) => rampRGB((Math.max(-STRIPES_SCALE, Math.min(STRIPES_SCALE, v)) * MAP_SCALE) / STRIPES_SCALE);
/** A byte's color on the map: −12.7 + 0.1·b °C, from integer tenths. */
export const byteRGB = (b) => rampRGB((b - 127) / 10);

/** The 256 × 1 RGBA LUT of DESIGN §5.3: entry b is the ramp at the byte's value; 255 is the hatch's
 *  ground (never sampled for color: the shader branches to the hatch first). */
export function buildLut() {
  const lut = new Uint8Array(256 * 4);
  for (let b = 0; b < 256; b++) {
    const c = b === 255 ? HATCH_GROUND : byteRGB(b);
    lut.set([c[0], c[1], c[2], 255], b * 4);
  }
  return lut;
}
export const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/* ── Absolute mode (plan 0012 3.3; ART "The temperature ramp"): a sequential ramp, −60 to +40 °C,
   lightness rising from the coldest to the warmest, the same in both themes. Its hues run violet,
   indigo, blue, teal, sage, sand: never the anomaly ramp's red and white, so the two maps cannot be
   read for each other. tools/check.mjs asserts the stops equal ART's table and the constraints. ── */
export const ABS_STOPS = [
  [-60, 0.270, 0.080, 305],
  [-40, 0.400, 0.120, 280],
  [-20, 0.530, 0.120, 255],
  [0, 0.665, 0.085, 220],
  [10, 0.735, 0.070, 180],
  [20, 0.805, 0.070, 125],
  [30, 0.875, 0.075, 95],
  [40, 0.945, 0.050, 85],
];
export const ABS_LO = -60, ABS_HI = 40;
const ALABS = ABS_STOPS.map(([v, L, C, h]) => [v, L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)]);
/** OKLab of the temperature ramp at v °C (clamped to −60 … +40). */
export function absLab(v) {
  v = Math.max(ABS_LO, Math.min(ABS_HI, v));
  let i = 0;
  while (i < ALABS.length - 2 && v > ALABS[i + 1][0]) i++;
  const p = ALABS[i], n = ALABS[i + 1], t = (v - p[0]) / (n[0] - p[0]);
  return [p[1] + (n[1] - p[1]) * t, p[2] + (n[2] - p[2]) * t, p[3] + (n[3] - p[3]) * t];
}
export const absRGB = (v) => oklabToLinear(...absLab(v)).map(encode);
/** 1024 × 1 RGBA: entry i is the ramp at (i − 600) tenths of a degree, so −60.0 … +40.0 °C at 0.1 °C
 *  (entries past 1000 repeat the warm end; the shader clamps first). */
export function buildAbsLut() {
  const lut = new Uint8Array(1024 * 4);
  for (let i = 0; i < 1024; i++) lut.set([...absRGB((Math.min(i, 1000) - 600) / 10), 255], i * 4);
  return lut;
}
