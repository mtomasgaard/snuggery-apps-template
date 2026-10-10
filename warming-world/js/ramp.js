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

/* ── Absolute mode (plan 0012 D21; ART "The temperature ramp"): Global Weather's temperature colors, by
   value, so one °C reads as one color in both apps: its stops (global-weather/js/ramps.js, RAMPS.temp),
   one set per theme, interpolated in sRGB as its rampAt does. Centered on 0 °C (slate) over −50 … +50;
   below −50 the coldest stop, above +48 the warmest. tools/check.mjs pins the stops to that file. ── */
const TV = [-50, -46.25, -42.5, -38.75, -35, -31.25, -27.5, -23.75, -20, -17, -14, -11, -8, -6, -4, -2, 0, 1.5, 3, 4.5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40.5, 43, 45.5, 48];
const hexes = (s) => s.match(/.{6}/g).map((h, i) => [TV[i], [0, 2, 4].map((j) => parseInt(h.slice(j, j + 2), 16))]);
/** [°C, [r, g, b]] per theme: Global Weather's RAMPS.temp.light and .dark. */
export const ABS_STOPS = {
  light: hexes('8778d0837dd67f81db7a86e1748ae77291e86f98e96b9fea67a6ea6dade973b4e879bbe77fc3e68ec8e39dcce0acd1dcbad6d9b4d5cdadd4c2a7d2b6a1d1aaa6cc9baac78caec27cb2bc6cbbb560c3ac54caa446d09c36d49335d88b34db8233de7932dd743add6f42dc6948db644ed96256d7605dd45e64d25b6a'),
  dark: hexes('8f80d8857fd87b7ed8717dd7677bd75c7ace5078c54475bd3673b42f6ea7276a991f658c17607f2059712653632a4c562d45482d4a452d4f402c543c2c5937395b30455e2750601c5b63076a63037663008263058d6405986307a56200b26002bf5d03c45d20ca5e30cf5e3dd55e48d65f54d8615ed96268db6371'),
};
export const ABS_LO = -50, ABS_HI = 50;
/** sRGB 0..255 of the temperature ramp at v °C in the theme (dark: true), unrounded. */
export function absAt(v, dark = false) {
  const s = ABS_STOPS[dark ? 'dark' : 'light'];
  let k = 0;
  while (k < s.length - 2 && s[k + 1][0] <= v) k++;
  const [v0, c0] = s[k], [v1, c1] = s[k + 1], f = Math.max(0, Math.min(1, (v - v0) / (v1 - v0)));
  return c0.map((c, j) => c + (c1[j] - c) * f);
}
export const absRGB = (v, dark = false) => absAt(v, dark).map(Math.round);
/** 1024 × 1 RGBA for the theme: entry i is the ramp at (i − 500) tenths of a degree, so −50.0 … +50.0 °C
 *  at 0.1 °C, 0 °C at entry 500 (entries past 1000 repeat the warm end; the shader clamps first). */
export function buildAbsLut(dark = false) {
  const lut = new Uint8Array(1024 * 4);
  for (let i = 0; i < 1024; i++) lut.set([...absRGB((Math.min(i, 1000) - 500) / 10, dark), 255], i * 4);
  return lut;
}
