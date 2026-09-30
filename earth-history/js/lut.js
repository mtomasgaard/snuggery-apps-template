// The Temperature and Rain lenses: their ramps, the 256-entry lookup tables the shader reads, and
// the legend (DESIGN §5.6). The ramps are display choices, not copied from any published palette;
// the values each byte stands for come from climate.json's encoding (CONTRACT §6), never from here.

import { fmt, isUS, MM_PER_IN, DAYS_PER_YEAR } from './units.js';

/** Value → colour knots. Temperature in °C (white at freezing), rain in mm/day. */
export const RAMPS = {
  temperature: [[-50, '#2b3a8f'], [-30, '#3f6fb5'], [-15, '#7fb0d8'], [0, '#eef0f0'], [10, '#f5d08a'], [20, '#ec9a4c'], [30, '#d4552b'], [40, '#8f1d1d']],
  rain: [[0, '#f4efe4'], [0.5, '#d9e6c3'], [1, '#a8d2b0'], [2, '#6fb8b0'], [4, '#3f93b5'], [8, '#2c63a3'], [16, '#28347a']],
};
/** The legend's one-line caption, and the full definition its accessible name carries (§19). */
export const LEGEND_TEXT = {
  temperature: 'Air temperature, yearly mean · climate model',
  rain: 'Rain and snow in an average year · climate model',
};
export const LEGEND_LONG = {
  temperature: 'Annual mean air temperature 1.5 m (5 ft) above the surface, from a climate model',
  rain: 'Rain and snow in an average year, from a climate model',
};

const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

/** The ramp's colour at value v, [r, g, b] 0–255, linear between knots and clamped outside them. */
export function rampColour(lens, v) {
  const k = RAMPS[lens];
  if (!(v > k[0][0])) return rgb(k[0][1]);
  for (let j = 1; j < k.length; j++) {
    if (v <= k[j][0]) {
      const t = (v - k[j - 1][0]) / (k[j][0] - k[j - 1][0]), a = rgb(k[j - 1][1]), b = rgb(k[j][1]);
      return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * t));
    }
  }
  return rgb(k[k.length - 1][1]);
}

/**
 * The 256 × 1 RGBA table for a lens: entry k is the ramp's colour at the value byte k decodes to
 * (field.offset + field.step · k ^ field.power, climate.json), entry `nodata` transparent.
 */
export function buildLut(lens, field) {
  const lut = new Uint8Array(256 * 4);
  for (let k = 0; k < 256; k++) {
    if (k === field.nodata) continue;
    const c = rampColour(lens, field.offset + field.step * k ** field.power);
    lut.set([c[0], c[1], c[2], 255], 4 * k);
  }
  return lut;
}

/**
 * Where a value sits on the legend bar, 0–1. Temperature is linear in °C over the ramp; rain is
 * spaced evenly per knot (0, 0.5, 1, 2, 4, 8, 16 mm/day), so the wet end does not squash the dry.
 */
export function legendPos(lens, v) {
  const k = RAMPS[lens];
  if (lens === 'temperature') return Math.max(0, Math.min(1, (v - k[0][0]) / (k[k.length - 1][0] - k[0][0])));
  if (v <= k[0][0]) return 0;
  for (let j = 1; j < k.length; j++) if (v <= k[j][0]) return (j - 1 + (v - k[j - 1][0]) / (k[j][0] - k[j - 1][0])) / (k.length - 1);
  return 1;
}
/** A CSS linear-gradient for the legend bar, one stop per knot. */
export function legendGradient(lens) {
  return `linear-gradient(to right, ${RAMPS[lens].map(([v, c]) => `${c} ${(legendPos(lens, v) * 100).toFixed(2)}%`).join(', ')})`;
}
/**
 * Legend ticks in the current units: [{ pos, text }], the unit set on the last number ("100 °F",
 * "200 in"); the caption says "a year" for rain. Temperature: °F or °C; rain: yearly totals (the
 * rate × 365.25 days, as the readout gives them). The lists are chosen so no two labels meet on
 * the 184 px bar (rain's 100 in / 2,000 mm sat 26 px from its neighbour and collided; 70 °F sat
 * 6 px from "100 °F", so the US scale marks 60 °F); app.js
 * also measures them and nudges any that still would.
 */
export function legendTicks(lens) {
  const us = isUS();
  const unit = (list, text) => list.map((t, j) => (j === list.length - 1 ? { ...t, text: `${t.text} ${text}` } : t));
  if (lens === 'temperature') {
    const list = us ? [-40, 0, 32, 60, 100] : [-40, -20, 0, 20, 40];
    return unit(list.map((t) => ({ pos: legendPos(lens, us ? (t - 32) * 5 / 9 : t), text: fmt(t) })), us ? '°F' : '°C');
  }
  const list = us ? [0, 10, 50, 200] : [0, 250, 1000, 5000];
  return unit(list.map((y) => ({ pos: legendPos(lens, (us ? y * MM_PER_IN : y) / DAYS_PER_YEAR), text: fmt(y) })), us ? 'in' : 'mm');
}
/** The unit in words, for the legend's accessible name. */
export const legendUnit = (lens) => (lens === 'temperature' ? (isUS() ? 'degrees Fahrenheit' : 'degrees Celsius') : (isUS() ? 'inches a year' : 'millimeters a year'));
