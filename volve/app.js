// Volve: the Volve field's simulation model in 3D with its seismic along a section, vanilla WebGL 2, no
// dependencies, offline. Norne Reservoir 2.3 carried to a second field (plan 0012 D10, D11, D14). The look
// is ART.md under Template/HOUSE.md; the data and its formats are NOTES.md and data/ATTRIBUTION.txt.
// Every number and date the app writes goes through js/units.js; the model is decoded by js/data.js
// (pure, tested by tools/test_decode.mjs); the player's track, which carries the signature (the cut), is
// js/track.js; the section A–A′ under the model is js/section.js, and the seismic on it js/seismic.js
// (pure, tested by tools/test_seismic_display.mjs).
//
// The frame (the scrub rule, HOUSE 4.6): input only records the WANTED report date. Each animation
// frame draws the newest wanted date (its colors decoded and uploaded in the same frame), then sets
// SHOWN to it, and everything that carries a date (the time row, the lead, the section, the card,
// the chart's cursor, the track's thumb and aria-valuenow) reads SHOWN. The loop asks for a frame
// only while something is dirty, a flight runs or play is on.

import * as U from './js/units.js';
import { regionOf, regionCount, fillValues, cellValue, propRange, norm, denorm, gasMax, openEnds, cutSeries, cutFacts, periods } from './js/data.js';
import { createTrack, CUT_SCALE } from './js/track.js';
import { cutGrid, wellsNear, fieldLines, sectionAxis, gapLayer, rimLayer, cutPath, drawCells, drawOutline, cellPx, cellAt, depthTicks, distanceTicks, surfaces, surfAt, rayToTop, columns, sweepAxis, slices, slot, sliceSection, shifts, lineAt, wellsNearPath, ownExag } from './js/section.js';
import { grid, uvOf, ilAt, xlAt, surveyLine, surveyNumbers, nearestNumber, colPlan, rowPlan, render, renderCols, ramp, horizonAt } from './js/seismic.js';
import { paneEdge } from './js/pane.js';

const $ = (id) => document.getElementById(id);
const LS_KEY = 'volve-viewer:v1';
const STORE = { state: LS_KEY, focus: `${LS_KEY}:focus`, units: `${LS_KEY}:units` };
const CREDIT = 'Data: the Volve field data set, © Equinor ASA and the former Volve license partners, under Equinor’s Terms and conditions for licence to data - Volve; not connected with, sponsored or endorsed by them';
const TEX_W = 1024;
const FOV = 40 * Math.PI / 180;
const FACES = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];
const ROLE = ['Shut', 'Producer', 'Water injector', 'Gas injector'];
const DOING = ['Shut', 'Producing', 'Injecting water', 'Injecting gas'];
const ROLE_KEY = ['shut', 'producer', 'waterInjector', 'gasInjector'];
const FILES = 12;                             // config.json, model.json, the five binaries, the seismic (seismic.json, seismic.bin), horizons.bin, validation.json and ATTRIBUTION.txt

let cfg, cfgText = '', model, gl;
const G = { stats: { colorPasses: 0, faceRebuilds: 0, draws: 0, frames: 0, colorMs: 0, faceMs: 0 } };   // data + GL objects; stats for the test hook
const D = {};                                 // the decoded model, as js/data.js reads it
const S = {                                   // the view, saved to localStorage
  prop: null, frame: 0,
  cut: { i0: 1, i1: 108, j0: 1, j1: 100, k0: 1, k1: 63 },
  vf: [0, 100], exag: 5, wells: true, labels: true, edges: true,
  cam: null, well: null,
  explode: { mode: 'layers', t: 0 },
  sheet: 0,                                   // the controls sheet: 0 the grip, 1 + explode and rates, 2 + cells and view
  section: { on: false, line: 'inline', a: null, b: null, at: null, size: 0 },   // the section A–A′: a survey line (inline, crossline), a line of the field's own (along, across), or one drawn (a, b in model meters); at: the survey line's number, or where the sweep took a line (a column or row of the grid for the field's lines, a step for a drawn one; null, the line itself); size: the pane, 0 compact to 1 tall
  seis: { show: 'both', colors: 'seismicGray', gain: 0, cells: 60 },   // the section's display: seismic, model or both; the ramp; the gain as a power of two; the cells' cover over the seismic, percent
};
const R = { faces: true, colors: true, draw: true, chart: true, labels: true, wells: true, step: true, legend: true, track: true, card: 0, section: false, secGeom: true, seisWork: false };   // dirty; card: 1 check the card's place, 2 place it afresh
let pick = -1, cardMode = null, playing = null, wanted = 0, shown = -1, units = 'SI', focus = false, track = null;
let raf = 0, flog = null;
const dark = matchMedia('(prefers-color-scheme: dark)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const isHex = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } };
const say = (text) => { const l = $('live'); l.textContent = ''; requestAnimationFrame(() => { l.textContent = text; }); };

/** Ask for one frame, unless one is already coming. */
function kick() { if (!raf && document.visibilityState !== 'hidden') raf = requestAnimationFrame(loop); }

main().catch((err) => fail(err));

// ---------------------------------------------------------------- loading
class DataError extends Error {}
let loaded = 0;
function counted() { loaded++; if (!model || loaded < FILES) $('stamp').textContent = `Reading the model… ${loaded} of ${FILES}`; }
async function fetchOk(url) {
  let r;
  try { r = await fetch(url, { cache: 'no-store' }); } catch { throw new DataError(`${url} could not be read.`); }
  if (!r.ok) throw new DataError(`${url} could not be read (HTTP ${r.status}).`);
  return r;
}
async function loadJSON(url) {
  const text = await (await fetchOk(url)).text();
  try { return { text, json: JSON.parse(text) }; } catch {
    throw new DataError(`${url} is not valid JSON${/^\s*</.test(text) ? '; it looks like a web page was written over it' : ''}.`);
  }
}
async function loadBin(name, want, what) {
  const buf = await (await fetchOk(`data/${name}`)).arrayBuffer();
  if (buf.byteLength !== want) throw new DataError(`data/${name} holds ${U.int(buf.byteLength)} bytes; ${what || (want === model.frames.length * model.dynamic.frameBytes ? `${model.frames.length} report dates need` : 'the model needs')} ${U.int(want)}.`);
  counted();
  return buf;
}
function fail(err) {
  if (!(err instanceof DataError)) console.error(err);
  const msg = location.protocol === 'file:' ? 'This app reads its data over Snuggery’s own server; opened as a file, the browser blocks it.'
    : err instanceof DataError ? err.message : `The model could not be shown: ${err.message}`;
  notice(msg);
  $('stamp-home').hidden = false;
  $('stamp').textContent = 'The model could not be read.';
  // an alpha:false context paints its own black buffer over the plate's CSS background: clear it to
  // the theme's --plate, and again when the theme changes, so the notice sits on the app's own ground
  if (gl) { paintPlate(); dark.addEventListener('change', paintPlate); }
}
function paintPlate() { readTheme(); gl.clearColor(...G.clear, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
function notice(text) { const e = $('error'); e.textContent = text; e.hidden = !text; }

async function main() {
  focus = (() => { try { return localStorage.getItem(STORE.focus) === '1'; } catch { return false; } })();
  if (focus) applyFocus(true, true);
  try { const u = localStorage.getItem(STORE.units); if (U.SYSTEMS.includes(u)) units = u; } catch { /* default SI */ }
  gl = $('gl').getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new DataError('This phone gave no WebGL 2, which the 3D view needs.');
  const c = await loadJSON('config.json'); cfg = c.json; cfgText = c.text; counted();
  model = (await loadJSON('data/model.json')).json; counted();
  const NA = model.NA, nf = model.frames.length;
  const want = { geometry: NA * 96, neighbours: NA * 24, ijk: NA * 3, static: NA * 4 * model.static.order.length, dynamic: nf * model.dynamic.frameBytes };
  const bufs = {};
  for (const key of ['geometry', 'neighbours', 'ijk', 'static', 'dynamic']) bufs[key] = await loadBin(model.files[key], want[key]);
  // the seismic, its horizons, the run's check against Equinor's and the data's own statement of what was changed
  G.seisMeta = (await loadJSON('data/seismic.json')).json; counted();
  const sm = G.seisMeta, nt = sm.il.count * sm.xl.count;
  G.seis = new Uint8Array(await loadBin(sm.file, nt * sm.z.count, `the seismic’s ${U.int(sm.il.count)} by ${U.int(sm.xl.count)} traces of ${U.int(sm.z.count)} samples need`));
  G.hz = new Float32Array(await loadBin(sm.horizons.file, nt * 8, 'two horizons on the seismic’s grid need'));
  G.check = (await loadJSON('data/validation.json')).json; counted();
  G.attribution = await (await fetchOk('data/ATTRIBUTION.txt')).text(); counted();
  await document.fonts.load('560 11.5px "Ysabeau Office"');   // labels and the track are measured in the face

  G.NA = NA; G.nf = nf;
  G.geom = new Float32Array(bufs.geometry);
  G.nb = new Int32Array(bufs.neighbours);
  G.ijk = new Uint8Array(bufs.ijk);
  const st = new Float32Array(bufs.static);
  const statics = {};
  model.static.order.forEach((k, i) => { statics[k] = st.subarray(i * NA, (i + 1) * NA); });
  Object.assign(D, { model, cfg, NA, ijk: G.ijk, static: statics, dyn: bufs.dynamic });
  G.vals = new Float32Array(NA);
  G.vis = new Uint8Array(NA);
  G.texH = Math.ceil(NA / TEX_W);
  G.colors = new Uint8Array(TEX_W * G.texH * 4);
  G.days = model.frames.map(U.dayNumber);
  G.per = periods(model.frames, U.dayNumber);   // the report dates' spacing, from the dates (quarterly for Volve)
  G.cut = cutSeries(model, U.dayNumber);
  G.gasMax = gasMax(D);

  S.cut = { i0: 1, i1: model.NI, j0: 1, j1: model.NJ, k0: 1, k1: model.NK };
  S.exag = cfg.verticalExaggeration || 5;
  S.prop = cfg.defaultProperty;
  if (cfg.seismic) {   // config.json's defaults for the section's display; the saved view wins
    const q = cfg.seismic;
    if (SHOWS.includes(q.show)) S.seis.show = q.show;
    if (['seismicGray', 'seismicRedBlue'].includes(q.colors)) S.seis.colors = q.colors;
    if (q.gain > 0) S.seis.gain = Math.max(-3, Math.min(3, Math.round(Math.log2(q.gain) * 4) / 4));
    if (Number.isFinite(q.cellOpacity)) S.seis.cells = Math.max(0, Math.min(100, Math.round(q.cellOpacity * 20) * 5));
  }
  restore();
  if (!propDef(S.prop)) S.prop = cfg.properties[0].key;
  wanted = Math.min(Math.max(0, S.frame | 0), nf - 1);

  for (const w of model.wells) { w.firstOpen = w.state.findIndex((s) => s > 0); const zmin = Math.min(...w.path.slice(1).map((p) => p[2])); w.path[0][2] = zmin - 70; }
  G.nReg = regionCount(D);
  computeExplode();
  // the section: the field's own two lines; the field's top and base as height fields, where a finger
  // on the 3D view meets the reservoir and the line lies on it
  G.lines = fieldLines(G.geom, NA, G.ijk, model.NI, model.NJ);
  G.cols = columns(G.geom, NA, G.ijk, model.NI, model.NJ);   // the sweep's slices: the grid's own columns and rows
  G.surf = surfaces(G.geom, NA);
  // the seismic's grid in the model's frame (the same ED50 / UTM 31N map, less model.json's center), and the
  // survey lines through the field's middle, where a survey line starts
  G.sg = grid(sm, model.center);
  G.mid = { inline: nearestNumber(G.sg, 'inline', 0, 0), crossline: nearestNumber(G.sg, 'crossline', 0, 0) };
  if (SURVEY.includes(S.section.line) && !surveyNumbers(G.sg, S.section.line).includes(S.section.at)) S.section.at = G.mid[S.section.line];
  initGL();
  initCamera();
  initUI();
  $('about-credit-line').textContent = CREDIT;
  writeStamp();
  writeAbout();
  new ResizeObserver(() => { R.draw = true; R.labels = true; R.card = 2; layoutKeys(); reframe(); kick(); }).observe($('plate'));
  new ResizeObserver(() => { R.chart = true; kick(); }).observe($('chart'));
  new ResizeObserver(() => { track.resize(); R.track = true; R.legend = true; kick(); }).observe($('slider'));
  new ResizeObserver(() => thinTicks()).observe($('legend-ticks'));   // the legend's width can change after it is written
  document.fonts.addEventListener('loadingdone', () => { track.invalidate(); R.track = true; R.labels = true; G.labelW = null; kick(); });
  // the legend's title is written last: the marketing camera waits for "Oil saturation" as the sign
  // that every file is in
  drawLegend();
  kick();
}

// ---------------------------------------------------------------- persistence
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE.state) || 'null');
    if (!s) return;
    for (const k of ['prop', 'frame', 'exag', 'wells', 'labels', 'edges', 'well']) if (k in s) S[k] = s[k];
    if (Number.isFinite(s.sheet)) S.sheet = Math.max(0, Math.min(2, s.sheet | 0));
    if (s.cut) for (const k in S.cut) if (Number.isFinite(s.cut[k])) S.cut[k] = s.cut[k];
    if (Array.isArray(s.vf)) S.vf = s.vf;
    if (s.cam && Number.isFinite(s.cam.dist) && 'sx' in s.cam) S.cam = s.cam;   // a camera saved before the fit had no lens shift: the fit replaces it
    if (s.explode && ['layers', 'regions'].includes(s.explode.mode) && Number.isFinite(s.explode.t)) S.explode = s.explode;
    if (s.section && typeof s.section === 'object') {
      const q = s.section, pt = (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
      S.section = { on: !!q.on, line: ['inline', 'crossline', 'along', 'across'].includes(q.line) ? q.line : null, a: pt(q.a) ? q.a : null, b: pt(q.b) ? q.b : null, at: Number.isInteger(q.at) ? q.at : null, size: Number.isFinite(q.size) ? Math.max(0, Math.min(1, q.size)) : 0 };
      if (!S.section.line && !(S.section.a && S.section.b)) S.section.line = 'inline';
    }
    if (s.seis && typeof s.seis === 'object') {
      const q = s.seis;
      S.seis = { show: SHOWS.includes(q.show) ? q.show : S.seis.show, colors: ['seismicGray', 'seismicRedBlue'].includes(q.colors) ? q.colors : S.seis.colors, gain: Number.isFinite(q.gain) ? Math.max(-3, Math.min(3, q.gain)) : 0, cells: Number.isFinite(q.cells) ? Math.max(0, Math.min(100, q.cells)) : S.seis.cells };
    }
    if (S.well && !model.wells.some((w) => w.name === S.well)) S.well = null;
  } catch { /* a broken saved state is ignored */ }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { S.frame = Math.max(0, shown); store(STORE.state, JSON.stringify(S)); }, 400);
}

// ---------------------------------------------------------------- properties + color
function propDef(key) { return cfg.properties.find((p) => p.key === key); }
const isDynamic = (p) => !!p.dynamic;
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
/** The theme's color scales: config.json's colormapsDark in the dark theme where it has one. */
function maps() { return (dark.matches && cfg.colormapsDark) || cfg.colormaps; }
function stopsOf(name) { const m = maps(); return (m[name] || cfg.colormaps[name] || Object.values(cfg.colormaps)[0]).filter(isHex); }
const lutCache = new Map();
function lut(name) {
  const key = `${dark.matches ? 'd' : 'l'}|${name}`;
  if (lutCache.has(key)) return lutCache.get(key);
  const stops = stopsOf(name).map(hex);
  const out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255 * (stops.length - 1), k = Math.min(Math.floor(t), stops.length - 2), f = t - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(stops[k][c] * (1 - f) + stops[k + 1][c] * f);
  }
  lutCache.set(key, out);
  return out;
}
function category(p) { return p.type === 'category'; }

/** The color pass: one report date's values, through the scale, into the cells' texture. */
function updateColors(f) {
  const t0 = performance.now(), p = propDef(S.prop), r = propRange(D, p), NA = G.NA, col = G.colors, v = G.vals;
  fillValues(D, S.prop, f, v);
  if (category(p)) {
    const pal = stopsOf(p.colormap).map(hex);
    for (let a = 0; a < NA; a++) {
      const c = pal[((Math.round(v[a]) - 1) % pal.length + pal.length) % pal.length];
      col[a * 4] = c[0]; col[a * 4 + 1] = c[1]; col[a * 4 + 2] = c[2]; col[a * 4 + 3] = 255;
    }
  } else {
    const L = lut(p.colormap);
    for (let a = 0; a < NA; a++) {
      let t = norm(p, r, v[a]);
      if (!(t >= 0)) t = 0; else if (t > 1) t = 1;
      const i = Math.round(t * 255) * 3;
      col[a * 4] = L[i]; col[a * 4 + 1] = L[i + 1]; col[a * 4 + 2] = L[i + 2]; col[a * 4 + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, G.tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEX_W, G.texH, gl.RGBA, gl.UNSIGNED_BYTE, col);
  G.stats.colorPasses++; G.stats.colorMs += performance.now() - t0;
  G.texStep = f; G.texKey = colorKey(f); G.colorsN = (G.colorsN || 0) + 1;
}
/** What the texture must hold for report date f: a static property's colors do not change with it. */
function colorKey(f) { const p = propDef(S.prop); return `${S.prop}|${isDynamic(p) ? f : '-'}|${dark.matches ? 'd' : 'l'}`; }

function valueFilterOn() { return !category(propDef(S.prop)) && (S.vf[0] > 0 || S.vf[1] < 100); }
function computeVisible() {
  const { i0, i1, j0, j1, k0, k1 } = S.cut, NA = G.NA, ijk = G.ijk, vis = G.vis;
  const vf = valueFilterOn(), p = propDef(S.prop), r = propRange(D, p);
  const lo = S.vf[0] / 100 - 1e-4, hi = S.vf[1] / 100 + 1e-4;
  for (let a = 0; a < NA; a++) {
    const i = ijk[a * 3] + 1, j = ijk[a * 3 + 1] + 1, k = ijk[a * 3 + 2] + 1;
    let ok = i >= i0 && i <= i1 && j >= j0 && j <= j1 && k >= k0 && k <= k1;
    if (ok && vf) { const t = norm(p, r, G.vals[a]); ok = t >= lo && t <= hi; }
    vis[a] = ok ? 1 : 0;
  }
}

// ---------------------------------------------------------------- regions + explode
// Volve's deck names no formations: the explode pulls apart its layers, or its eleven fluid-in-place
// regions (FIPNUM, lateral blocks through every layer), spread out from the field's middle.
function computeExplode() {
  const NA = G.NA, ijk = G.ijk, geom = G.geom, mode = S.explode.mode, t = S.explode.t / 100;
  const ex = cfg.explode || {};
  G.exOn = t > 0.001;
  if (!G.gOf) G.gOf = new Int16Array(NA);
  const gOf = G.gOf;
  let n;
  if (mode === 'regions') { n = G.nReg; for (let a = 0; a < NA; a++) gOf[a] = regionOf(D, a) - 1; }
  else { n = model.NK; for (let a = 0; a < NA; a++) gOf[a] = ijk[a * 3 + 2]; }
  const cnt = new Float64Array(n), cx = new Float64Array(n), cy = new Float64Array(n), cz = new Float64Array(n);
  let ax = 0, ay = 0;
  for (let a = 0; a < NA; a++) {
    const g = gOf[a], p = a * 24;
    const x = (geom[p] + geom[p + 21]) / 2, y = (geom[p + 1] + geom[p + 22]) / 2, z = (geom[p + 2] + geom[p + 23]) / 2;
    cnt[g]++; cx[g] += x; cy[g] += y; cz[g] += z; ax += x; ay += y;
  }
  ax /= NA; ay /= NA;
  for (let g = 0; g < n; g++) if (cnt[g]) { cx[g] /= cnt[g]; cy[g] /= cnt[g]; cz[g] /= cnt[g]; }
  const off = new Float32Array(n * 3);
  if (mode === 'regions') {
    const k = t * (ex.regionSpread ?? 0.4);
    for (let g = 0; g < n; g++) if (cnt[g]) { off[g * 3] = (cx[g] - ax) * k; off[g * 3 + 1] = (cy[g] - ay) * k; }
  } else {
    const gap = gapOf('layer', 8) * t;
    const used = []; for (let g = 0; g < n; g++) if (cnt[g]) used.push(g);
    used.forEach((g, r) => { off[g * 3 + 2] = (r - (used.length - 1) / 2) * gap; });
  }
  G.gOff = off; G.gN = n; G.gCnt = cnt; G.gCen = [cx, cy, cz];
  G.topOff = G.exOn && mode === 'layers' ? Math.min(...Array.from({ length: n }, (_, g) => (cnt[g] ? off[g * 3 + 2] : Infinity))) : 0;
}
/** An explode gap from config.json (layerGapMeters; layerGapMetres read too). */
function gapOf(kind, fallback) { const ex = cfg.explode || {}; return ex[`${kind}GapMeters`] ?? ex[`${kind}GapMetres`] ?? fallback; }

function buildWellBuffer() {
  const seg = [], SE = [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]];
  const ex = G.exOn, gOf = G.gOf, off = G.gOff, segMode = S.explode.mode === 'regions';
  const offOf = (c) => (ex && c >= 0 ? [off[gOf[c] * 3], off[gOf[c] * 3 + 1], off[gOf[c] * 3 + 2]] : [0, 0, 0]);
  G.wellHeads = [];
  G.wellPts = [];
  model.wells.forEach((w, wi) => {
    const pc = w.pathCells || [];
    const pts = w.path.map((p, s) => {
      let o = [0, 0, 0];
      if (ex && pc.length === w.path.length) o = s > 0 ? offOf(pc[s]) : segMode ? offOf(pc[1]) : [0, 0, G.topOff];
      return [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
    });
    G.wellHeads[wi] = pts[0];
    G.wellPts[wi] = pts;
    for (let s = 0; s + 1 < pts.length; s++) {
      const A = pts[s], B = pts[s + 1];
      for (const [side, end] of SE) seg.push(A[0], A[1], A[2], B[0], B[1], B[2], side, end, wi);
    }
  });
  G.wellVerts = seg.length / 9;
  gl.bindBuffer(gl.ARRAY_BUFFER, G.wellBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seg), gl.DYNAMIC_DRAW);
}

function rebuildFaces() {
  const t0 = performance.now();
  computeVisible();
  const NA = G.NA, nb = G.nb, vis = G.vis, geom = G.geom, ex = G.exOn, gOf = G.gOf, off = G.gOff;
  let n = 0;
  for (let a = 0; a < NA; a++) if (vis[a]) for (let f = 0; f < 6; f++) { const b = nb[a * 6 + f]; if (b < 0 || !vis[b] || (ex && gOf[b] !== gOf[a])) n++; }
  const need = n * 4 * 6;
  if (!G.vbuf || G.vbuf.length < need) G.vbuf = new Float32Array(Math.ceil(need * 1.25) + 24);
  const d = G.vbuf; let o = 0;
  const UV = [0, 0, 1, 0, 1, 1, 0, 1];
  for (let a = 0; a < NA; a++) {
    if (!vis[a]) continue;
    const ga = gOf[a] * 3, ox = ex ? off[ga] : 0, oy = ex ? off[ga + 1] : 0, oz = ex ? off[ga + 2] : 0;
    for (let f = 0; f < 6; f++) {
      const b = nb[a * 6 + f];
      if (b >= 0 && vis[b] && !(ex && gOf[b] !== gOf[a])) continue;
      const fc = FACES[f];
      for (let q = 0; q < 4; q++) {
        const g = (a * 8 + fc[q]) * 3;
        d[o] = geom[g] + ox; d[o + 1] = geom[g + 1] + oy; d[o + 2] = geom[g + 2] + oz;
        d[o + 3] = a; d[o + 4] = UV[q * 2]; d[o + 5] = UV[q * 2 + 1];
        o += 6;
      }
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, G.gridBuf);
  gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, o), gl.DYNAMIC_DRAW);
  G.faceCount = n;
  G.stats.faceRebuilds++; G.stats.faceMs += performance.now() - t0;
}

// ---------------------------------------------------------------- WebGL
const GRID_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in float aCell; layout(location=2) in vec2 aUV;
uniform mat4 uMV, uP; uniform float uExag;
out vec3 vView; out vec2 vUV; flat out int vCell;
void main(){
  vec4 v = uMV * vec4(aPos.x, -aPos.z * uExag, -aPos.y, 1.0);
  vView = v.xyz; vUV = aUV; vCell = int(aCell + 0.5);
  gl_Position = uP * v;
}`;
// The light on the faces (ART.md section 2): the cell's sRGB color times 0.42 + 0.5 lambert + 0.14
// fill; a cell edge multiplies by 0.55. The picked cell leans to the theme's far end (uHi).
const GRID_FS = `#version 300 es
precision highp float; precision highp int;
in vec3 vView; in vec2 vUV; flat in int vCell;
uniform sampler2D uTex; uniform int uMode, uPicked; uniform float uEdges; uniform vec4 uHi;
out vec4 o;
void main(){
  if (uMode == 1) { int id = vCell + 1; o = vec4(float(id & 255), float((id >> 8) & 255), float((id >> 16) & 255), 255.0) / 255.0; return; }
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  vec3 c = texelFetch(uTex, ivec2(vCell % ${TEX_W}, vCell / ${TEX_W}), 0).rgb;
  float lamb = abs(dot(n, normalize(vec3(0.35, 0.75, 0.55))));
  float fill = abs(dot(n, normalize(vec3(-0.6, -0.2, 0.8))));
  vec3 col = c * (0.42 + 0.5 * lamb + 0.14 * fill);
  vec2 w = fwidth(vUV);
  vec2 g = smoothstep(vec2(0.0), w * 1.3, vUV) * smoothstep(vec2(0.0), w * 1.3, 1.0 - vUV);
  float edge = (1.0 - min(g.x, g.y)) * uEdges * (1.0 - smoothstep(0.06, 0.28, max(w.x, w.y)));
  col = mix(col, col * 0.55, edge);
  if (vCell == uPicked) col = mix(col, uHi.rgb, uHi.a);
  o = vec4(col, 1.0);
}`;
// The wells: screen-space ribbons. uStyle per well: x 1 for a dashed (injecting) well, y its width
// factor (0.6 for a shut well). The dash is measured along the segment on screen (vS, divided by w in
// the fragment shader so it stays even under perspective), about 8 CSS px on and off.
const WELL_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aA; layout(location=1) in vec3 aB; layout(location=2) in vec2 aSE; layout(location=3) in float aWell;
uniform mat4 uMV, uP; uniform float uExag, uWidth, uAlpha, uGrow; uniform vec2 uVP; uniform vec4 uColor[64], uStyle[64], uTint; uniform int uSel;
out vec4 vC; out vec2 vS; out float vDash;
vec4 clip(vec3 p){ return uP * uMV * vec4(p.x, -p.z * uExag, -p.y, 1.0); }
void main(){
  int wi = int(aWell + 0.5);
  vec4 a = clip(aA), b = clip(aB);
  vec4 cur = aSE.y < 0.5 ? a : b;
  vec2 sa = a.xy / a.w * uVP, sb = b.xy / b.w * uVP;
  vec2 dir = sb - sa; float len = length(dir); dir = len < 1e-4 ? vec2(1.0, 0.0) : dir / len;
  float wpx = uWidth * uStyle[wi].y * (wi == uSel ? 1.9 : 1.0) + uGrow;
  cur.xy += vec2(-dir.y, dir.x) * aSE.x * wpx / uVP * cur.w;
  gl_Position = cur;
  vS = vec2((aSE.y < 0.5 ? 0.0 : len) * cur.w, cur.w);
  vDash = uStyle[wi].x;
  vec4 c = uColor[wi];
  vC = uTint.a > 0.0 ? vec4(uTint.rgb, uTint.a * step(0.01, c.a) * c.a) : c;
  vC.a *= uAlpha;
}`;
const WELL_FS = `#version 300 es
precision highp float; in vec4 vC; in vec2 vS; in float vDash; uniform float uDashPx; out vec4 o;
void main(){ if (vDash > 0.5 && mod(vS.x / vS.y, 2.0 * uDashPx) > uDashPx) discard; o = vC; }`;

function program(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('shader link: ' + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

function initGL() {
  G.grid = program(GRID_VS, GRID_FS);
  G.wellP = program(WELL_VS, WELL_FS);

  G.tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, G.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TEX_W, G.texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, G.colors);
  for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST);

  G.gridVAO = gl.createVertexArray(); gl.bindVertexArray(G.gridVAO);
  G.gridBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.gridBuf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 24, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
  const maxFaces = G.NA * 6, idx = new Uint32Array(maxFaces * 6);
  for (let f = 0; f < maxFaces; f++) { const v = f * 4, o = f * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  G.wellVAO = gl.createVertexArray(); gl.bindVertexArray(G.wellVAO);
  G.wellBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.wellBuf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 36, 32);
  gl.bindVertexArray(null);
  G.wellColors = new Float32Array(64 * 4);
  G.wellStyle = new Float32Array(64 * 4);
  readTheme();
}
/** The plate's colors for the theme: the clear color from --plate, the picked cell's lean. */
function readTheme() {
  const c = css('--plate');
  const [r, g, b] = hex(isHex(c) ? c : '#ffffff');
  G.clear = [r / 255, g / 255, b / 255];
  G.hi = dark.matches ? [1, 1, 1, 0.6] : [15 / 255, 28 / 255, 35 / 255, 0.5];
}

// ---------------------------------------------------------------- camera
const M4 = {
  persp(fy, asp, n, f) { const t = 1 / Math.tan(fy / 2), nf = 1 / (n - f); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]); },
  look(e, c) {
    const z = nrm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = nrm(crs([0, 1, 0], z)), y = crs(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
};
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function crs(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function nrm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/* The fit (the reviewer's finding, after the pass): the whole field is fitted by its projected box,
   to both of the plate's axes, less the key column or row, with room above for the well names. The
   field's points are two opposite corners of every fourth cell, moved as the explode moves them, and
   the well heads; a lens shift (sx, sy, in clip units) puts the field's middle at the middle of the
   room it was fitted to, so turning the model still turns it about its own middle. */
const FIT_PAD = { l: 12, t: 26, r: 12, b: 12 };
function fitPoints() {
  const g = G.geom, ex = G.exOn, gOf = G.gOf, off = G.gOff, out = new Float64Array(Math.ceil(G.NA / 4) * 6 + model.wells.length * 3);
  let n = 0;
  const put = (x, y, z) => { out[n++] = x; out[n++] = y; out[n++] = z; };
  for (let a = 0; a < G.NA; a += 4) {
    const o = ex ? gOf[a] * 3 : -1;
    for (const c of [0, 21]) {
      const x = g[a * 24 + c] + (o >= 0 ? off[o] : 0), y = g[a * 24 + c + 1] + (o >= 0 ? off[o + 1] : 0), z = g[a * 24 + c + 2] + (o >= 0 ? off[o + 2] : 0);
      put(x, -z * S.exag, -y);
    }
  }
  model.wells.forEach((w, i) => { const p = G.wellHeads && G.wellHeads[i] || w.path[0]; put(p[0], -p[2] * S.exag, -p[1]); });
  return out;
}
/** The rooms the field may be fitted to, in the plate's CSS px: the plate less its margins, and with
 *  the keys showing, the part below their row and the part left of their column. */
function fitRooms(W, H, plain) {
  const P = FIT_PAD, rooms = [], k = $('keys');
  if (!plain && !k.hidden && !k.closest('[hidden]')) {
    const pr = $('plate').getBoundingClientRect(), r = k.getBoundingClientRect();
    if (r.width) {
      rooms.push({ l: P.l, t: P.t, r: Math.min(W - P.r, r.left - pr.left - 6), b: H - P.b });
      // below the keys only when that field is at least a fifth larger: the field keeps the plate's middle
      rooms.push({ l: P.l, t: Math.max(P.t, r.bottom - pr.top + 22), r: W - P.r, b: H - P.b, pref: 1.2 });   // 22: a name's room
    }
  }
  if (!rooms.length) rooms.push({ l: P.l, t: P.t, r: W - P.r, b: H - P.b });
  return rooms.filter((q) => q.r - q.l > 40 && q.b - q.t > 40);
}
/** The camera that fits the field at (theta, phi) on a plate W x H: the nearest distance at which the
 *  projected field fits one of the rooms, and the shift that centers it there. */
function fitCam(theta, phi, size, pts) {
  const c = $('gl'), [W, H] = size || [c.clientWidth || 1, c.clientHeight || 1];
  pts = pts || fitPoints();
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pts.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], pts[i + k]); hi[k] = Math.max(hi[k], pts[i + k]); }
  const T = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
  const t = theta * Math.PI / 180, p = phi * Math.PI / 180;
  const z = [Math.cos(p) * Math.sin(t), Math.sin(p), Math.cos(p) * Math.cos(t)], x = nrm(crs([0, 1, 0], z)), y = crs(z, x);
  const n = pts.length / 3, A = new Float64Array(n), B = new Float64Array(n), C = new Float64Array(n);
  let cMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = [pts[i * 3] - T[0], pts[i * 3 + 1] - T[1], pts[i * 3 + 2] - T[2]];
    A[i] = dot(r, x); B[i] = dot(r, y); C[i] = dot(r, z); cMax = Math.max(cMax, C[i]);
  }
  const f = (H / 2) / Math.tan(FOV / 2);
  const box = (d, idx) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let k = 0, N = idx ? idx.length : n; k < N; k++) { const i = idx ? idx[k] : k, D = d - C[i], X = f * A[i] / D, Y = -f * B[i] / D; if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y; }
    return [x0, x1, y0, y1];
  };
  // the points that can still be the box's edge for some distance in [a, b] (each one's A / (d - C) and
  // B / (d - C) move one way as d does, so each lies between its values at a and b): the same box, exactly,
  // from far fewer points once the search has narrowed; the plate is fitted every frame its edge is dragged
  const only = (a, b) => {
    const keep = new Uint8Array(n), P = new Float64Array(n), Q = new Float64Array(n);
    let m = 0;
    for (const V of [A, B]) {
      let lo = -Infinity, hi = Infinity;
      for (let i = 0; i < n; i++) { const p = V[i] / (a - C[i]), q = V[i] / (b - C[i]); P[i] = Math.min(p, q); Q[i] = Math.max(p, q); if (P[i] > lo) lo = P[i]; if (Q[i] < hi) hi = Q[i]; }
      for (let i = 0; i < n; i++) if (!keep[i] && (Q[i] >= lo || P[i] <= hi)) { keep[i] = 1; m++; }
    }
    const idx = new Int32Array(m);
    for (let i = 0, k = 0; i < n; i++) if (keep[i]) idx[k++] = i;
    return idx;
  };
  const m = Math.hypot(...model.extent);
  let best = null;
  for (const q of fitRooms(W, H, !!size)) {
    let a = Math.max(cMax * 1.02, m * 0.05), b = m * 30, idx = null;
    for (let it = 0; it < 36; it++) {
      if (it === 8) idx = only(a, b);
      const d = Math.sqrt(a * b), [x0, x1, y0, y1] = box(d, idx);
      if (x1 - x0 <= q.r - q.l && y1 - y0 <= q.b - q.t) b = d; else a = d;
    }
    if (best && best.dist <= b * (q.pref || 1)) continue;
    const [x0, x1, y0, y1] = box(b, idx);
    const dx = (q.l + q.r) / 2 - W / 2 - (x0 + x1) / 2, dy = (q.t + q.b) / 2 - H / 2 - (y0 + y1) / 2;
    best = { dist: b, sx: 2 * dx / W, sy: -2 * dy / H };
    if (!size) G.fitAsp = (x1 - x0) / Math.max(1, y1 - y0);
  }
  if (!best) best = { dist: m * 1.6, sx: 0, sy: 0 };
  return { theta, phi, dist: best.dist, target: T, sx: best.sx, sy: best.sy };
}
/** The whole field: theta 62 and phi 36 on an upright plate; on a plate much wider than tall the eye
 *  comes down toward the horizon, so the flat field fills more of the width. */
function defaultCam(pts) {
  const c = $('gl'), asp = (c.clientWidth || 1) / (c.clientHeight || 1);
  const phi = asp <= 1.6 ? 36 : Math.max(24, 36 - (asp - 1.6) * 7);
  return { ...fitCam(62, Math.round(phi * 10) / 10, undefined, pts), fit: true };
}
/** After the plate changes size (focus mode, the sheet's stops, a turn of the phone): a camera still at
 *  the fit is fitted again; any other keeps its zoom against the fit, so the field neither crops nor
 *  shrinks to a stamp. */
function reframe() {
  const c = $('gl'), wh = [c.clientWidth, c.clientHeight];
  if (!S.cam || !model || !wh[0] || !wh[1]) return;
  const old = G.camWH; G.camWH = wh;
  if (old && old[0] === wh[0] && old[1] === wh[1]) return;
  const pts = fitPoints();
  for (const cam of G.anim ? [S.cam, G.anim.to] : [S.cam]) {
    if (cam.fit) Object.assign(cam, defaultCam(pts));
    else if (old) { const a = fitCam(cam.theta, cam.phi, old, pts), b = fitCam(cam.theta, cam.phi, wh, pts); cam.dist = clampDist(cam.dist * b.dist / a.dist); }
  }
  R.draw = true; R.labels = true;
}
/** The field's size changed (the explode, the vertical stretch): a camera at the fit follows it. */
function refitIfFitted() { if (S.cam && S.cam.fit && !G.anim) { S.cam = defaultCam(); R.draw = true; } }
function initCamera() { if (!S.cam) S.cam = defaultCam(); }
function eye() {
  const { theta, phi, dist, target } = S.cam, t = theta * Math.PI / 180, p = phi * Math.PI / 180;
  return [target[0] + dist * Math.cos(p) * Math.sin(t), target[1] + dist * Math.sin(p), target[2] + dist * Math.cos(p) * Math.cos(t)];
}

// ---------------------------------------------------------------- the frame
function loop(now) {
  raf = 0;
  G.stats.frames++;
  if (playing) {
    const k = playing.from + Math.floor((Math.max(0, now - playing.t0) * (cfg.playbackFramesPerSecond || 6)) / 1000);   // a frame's time can precede the tap's: never before the start
    wanted = Math.min(G.nf - 1, k);
    if (k >= G.nf - 1) stop();
  }
  if (G.anim) stepAnim(now);
  const step = wanted;
  const stepChanged = step !== shown;
  if (stepChanged || R.colors) {
    if (G.texKey !== colorKey(step)) { updateColors(step); if (valueFilterOn()) R.faces = true; }
    else G.texStep = step;
    R.colors = false; R.draw = true;
    if (S.section.on) R.section = true;   // the section shows the same colors, in the same frame
  }
  if (stepChanged) { shown = step; R.step = true; R.draw = true; R.labels = true; }
  if (R.section || R.secGeom) fitSection();   // before the draw: the pane's height and the plate's are set in this frame
  if (R.faces) { rebuildFaces(); R.faces = false; R.draw = true; }
  if (R.wells) { buildWellBuffer(); R.wells = false; R.draw = true; }
  if (R.draw) { layoutKeys(); reframe(); draw(); R.draw = false; R.labels = true; }
  if (R.card) { placeCard(R.card > 1); R.labels = true; }   // after the draw: the mark is where this frame shows it
  if (R.labels) { placeLabels(); updateGauge(); R.labels = false; }
  if (R.legend) { drawLegend(); R.legend = false; }
  if (R.step) { writeStep(); R.step = false; R.track = true; }
  if (R.track) { track.draw(shown); R.track = false; }
  if (R.chart) { drawChart(); R.chart = false; }
  if (R.seisWork) seisWork();
  if (R.section || R.secGeom) drawSection();
  if (G.secLog && S.section.on) { const c = $('sec-plot'), g = $('gl'), d = Math.min(window.devicePixelRatio || 1, 2), e = secDpr(); G.secLog.push({ t: now, v: +$('sec-sweep').value, at: S.section.at, drew: SEC.drawnAt, seis: SEC.seisAt, line: S.section.line, cutLine: SEC.cutLine, plot: [c.width, Math.round(c.clientWidth * e), c.height, Math.round(c.clientHeight * e)], gl: [g.width, Math.round(g.clientWidth * d), g.height, Math.round(g.clientHeight * d)], pane: $('section').getBoundingClientRect().height, size: S.section.size, mv: moving(), full: !!SEC.full, renders: G.stats.seisRenders || 0, slices: G.stats.seisSlices || 0, exag: SEC.exag }); }
  if (flog && stepChanged) flog.push({ t: now, wanted, shown, tex: G.texStep, sec: S.section.on ? G.secStep : null, label: $('valid').textContent, now: +$('slider').getAttribute('aria-valuenow') });
  if (playing || G.anim || Object.values(R).some(Boolean)) kick();
}

/** Everything that carries the report date, from SHOWN. */
function writeStep() {
  const f = shown, iso = model.frames[f], c = G.cut[f], days = G.days[f] - G.days[0];
  const lead = U.lead(days);
  setText('valid', U.date(iso));
  setText('lead', lead);
  const sl = $('slider');
  sl.setAttribute('aria-valuenow', String(f));
  sl.setAttribute('aria-valuetext', `${U.spokenDate(iso)}, ${f ? lead : 'the start of the run'}. ${f ? U.spokenUnits(`Oil ${U.liquid(c.oil, units)}, water ${U.liquid(c.water, units).replace(/\u202f\S+$/, '')}, ${U.percent(c.share)} water.`) : 'Nothing lifted yet.'}`);
  if (cardMode) { refreshCardValues(); R.card = Math.max(R.card, 1); }   // a new figure may widen the card
  updateCursor();
  save();
}
function setText(id, t) { const e = $(id); if (e.textContent !== t) e.textContent = t; }
/** The interval a rate at report date f is averaged over, in words from the dates themselves: "in the 90
 *  days to 10 Apr 2008"; at the first date, which has none, "on 31 Dec 2007". */
function interval(f) { const iso = model.frames[f]; return f ? `in the ${U.int(G.per.days[f])} days to ${U.date(iso)}` : `on ${U.date(iso)}`; }

function sizeCanvas() {
  const c = $('gl'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return [w, h];
}
function matrices() {
  const [w, h] = sizeCanvas(), d = S.cam.dist;
  const P = M4.persp(FOV, w / h, d / 60, d * 20);
  P[8] = -(S.cam.sx || 0); P[9] = -(S.cam.sy || 0);   // the lens shift: the fit's middle at its room's middle
  const V = M4.look(eye(), S.cam.target);
  G.P = P; G.V = V; G.PV = M4.mul(P, V);
  return [w, h];
}
function drawGrid(mode) {
  const g = G.grid;
  gl.useProgram(g.p);
  gl.uniformMatrix4fv(g.u.uMV, false, G.V); gl.uniformMatrix4fv(g.u.uP, false, G.P);
  gl.uniform1f(g.u.uExag, S.exag); gl.uniform1i(g.u.uMode, mode);
  gl.uniform1i(g.u.uPicked, cardMode === 'cell' ? pick : G.hl ?? -1);
  gl.uniform4fv(g.u.uHi, G.hi);
  gl.uniform1f(g.u.uEdges, S.edges ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.uniform1i(g.u.uTex, 0);
  gl.bindVertexArray(G.gridVAO);
  gl.drawElements(gl.TRIANGLES, G.faceCount * 6, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
function wellColor(code) {
  const c = cfg.wellColors[ROLE_KEY[code]] || cfg.wellColors.shut;
  return hex(isHex(c) ? c : '#6f7274');
}
function draw() {
  const [w, h] = matrices();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.clearColor(...G.clear, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
  drawGrid(0);
  if (S.wells && G.wellVerts) drawWells(w, h);
  G.stats.draws++;
}
function drawWells(w, h) {
  const wp = G.wellP, sel = model.wells.findIndex((x) => x.name === S.well), f = shown;
  model.wells.forEach((wl, i) => {
    const code = wl.state[f] || 0, c = wellColor(code);
    const drilled = wl.firstOpen >= 0 && f >= wl.firstOpen;
    G.wellColors.set([c[0] / 255, c[1] / 255, c[2] / 255, !drilled ? 0 : code ? 1 : 0.5], i * 4);
    G.wellStyle.set([code >= 2 ? 1 : 0, code ? 1 : 0.6, 0, 0], i * 4);
  });
  const dpr = Math.min(window.devicePixelRatio || 1, 2), oc = hex(isHex(cfg.wellColors.outline) ? cfg.wellColors.outline : '#0f1c23');
  gl.useProgram(wp.p);
  gl.uniformMatrix4fv(wp.u.uMV, false, G.V); gl.uniformMatrix4fv(wp.u.uP, false, G.P);
  gl.uniform1f(wp.u.uExag, S.exag); gl.uniform2f(wp.u.uVP, w / 2, h / 2);
  gl.uniform1f(wp.u.uWidth, (cfg.wellWidthPixels || 3.5) * dpr / 2);
  gl.uniform1f(wp.u.uDashPx, 8 * dpr);
  gl.uniform4fv(wp.u.uColor, G.wellColors); gl.uniform4fv(wp.u.uStyle, G.wellStyle); gl.uniform1i(wp.u.uSel, sel);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(G.wellVAO);
  gl.uniform4f(wp.u.uTint, 0, 0, 0, 0); gl.uniform1f(wp.u.uGrow, 0);
  gl.disable(gl.DEPTH_TEST); gl.uniform1f(wp.u.uAlpha, 0.3);            // a faint pass seen through the rock
  gl.drawArrays(gl.TRIANGLES, 0, G.wellVerts);
  gl.enable(gl.DEPTH_TEST); gl.uniform1f(wp.u.uAlpha, 1);
  gl.depthMask(false);
  gl.uniform4f(wp.u.uTint, oc[0] / 255, oc[1] / 255, oc[2] / 255, 0.85); gl.uniform1f(wp.u.uGrow, 1.25 * dpr);   // the casing
  gl.drawArrays(gl.TRIANGLES, 0, G.wellVerts);
  gl.depthMask(true);
  gl.uniform4f(wp.u.uTint, 0, 0, 0, 0); gl.uniform1f(wp.u.uGrow, 0);    // the core
  gl.drawArrays(gl.TRIANGLES, 0, G.wellVerts);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
}

function pickAt(cx, cy) {
  const [w, h] = matrices();
  // the cells' ids are drawn once per view and kept: a second pick in the same view (a tap after a test of
  // the spot, many picks in a row) reads the kept pixels instead of drawing all 183 545 cells again
  const key = `${w}x${h}|${G.PV.join(',')}|${G.stats.faceRebuilds}|${S.exag}`;
  if (G.pickKey !== key) {
    if (!G.fbo || G.fboW !== w || G.fboH !== h) {
      if (G.fbo) { gl.deleteFramebuffer(G.fbo); gl.deleteRenderbuffer(G.rbC); gl.deleteRenderbuffer(G.rbD); }
      G.fbo = gl.createFramebuffer(); G.rbC = gl.createRenderbuffer(); G.rbD = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, G.rbC); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
      gl.bindRenderbuffer(gl.RENDERBUFFER, G.rbD); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, G.rbC);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, G.rbD);
      G.fboW = w; G.fboH = h;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    drawGrid(1);
    if (!G.pickBuf || G.pickBuf.length !== w * h * 4) G.pickBuf = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, G.pickBuf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    G.pickKey = key;
    R.draw = true; kick();
  }
  const c = $('gl'), px = G.pickBuf;
  const x = Math.min(w - 1, Math.max(0, Math.round(cx / c.clientWidth * w))), y = Math.min(h - 1, Math.max(0, Math.round((1 - cy / c.clientHeight) * h))), i = (y * w + x) * 4;
  return (px[i] | (px[i + 1] << 8) | (px[i + 2] << 16)) - 1;
}

// ---------------------------------------------------------------- names on the plate
// World space is x east, y up, z south (see the grid shader). project() takes a model point (x, y,
// depth) and converts it to that world space first.
function projectWorld(X, Y, Z) {
  const m = G.PV;
  const cx = m[0] * X + m[4] * Y + m[8] * Z + m[12], cy = m[1] * X + m[5] * Y + m[9] * Z + m[13], cw = m[3] * X + m[7] * Y + m[11] * Z + m[15];
  if (cw <= 0) return null;
  const c = $('gl');
  return [(cx / cw * 0.5 + 0.5) * c.clientWidth, (0.5 - cy / cw * 0.5) * c.clientHeight];
}
function project(p) { return projectWorld(p[0], -p[2] * S.exag, -p[1]); }
const SVGNS = document.documentElement.namespaceURI.replace('1999/xhtml', '2000/svg');   // the SVG namespace, built from the page's own
function svgEl(tag, attrs) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
function buildLabels() {
  const box = $('labels'); box.innerHTML = '';
  G.labels = model.wells.map((w) => {
    const el = document.createElement('button');
    el.className = 'wl'; el.type = 'button'; el.translate = false; el.tabIndex = -1;
    const s = svgEl('svg', { viewBox: '0 0 10 6', width: '10', height: '6', 'aria-hidden': 'true' });
    s.append(svgEl('path', { class: 'casing', d: 'M0 3h10' }), svgEl('path', { class: 'core', d: 'M0 3h10' }));
    el.append(s, document.createTextNode(w.name));
    el.setAttribute('aria-label', `Well ${w.name}`);
    el.addEventListener('click', () => selectWell(w.name, true));
    box.appendChild(el);
    return el;
  });
  // the tapped cell's mark: a ring at its middle, on the names' layer, kept out of the card like them
  G.pickMark = document.createElement('span'); G.pickMark.className = 'pickmark'; G.pickMark.setAttribute('aria-hidden', 'true');
  box.appendChild(G.pickMark);
  G.labelW = null;
}
/** What labels keep out of, in the plate's px: the card, the keys, the ghost key, the compass. Layout boxes,
 *  so the card's 4 px rise never moves them. */
function keepOut() {
  const out = [];
  for (const id of ['readout', 'keys', 'focus-exit', 'north']) {
    const e = $(id);
    if (e.hidden || e.closest('[hidden]')) continue;
    if (e.offsetWidth) out.push({ x: e.offsetLeft - 4, y: e.offsetTop - 4, w: e.offsetWidth + 8, h: e.offsetHeight + 8 });
  }
  return out;
}
function placeLabels() {
  if (!G.labels || !G.PV) return;
  placeSecLine();
  const f = Math.max(0, shown), avoid = keepOut(), names = avoid.concat((SEC.ends || []).map((p) => ({ x: p[0] - 12, y: p[1] - 12, w: 24, h: 24 })));   // names keep off the section's A and A′ too
  const clearOf = (list) => (x, y, w, h) => !list.some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y);
  const clear = clearOf(names), clearRing = clearOf(avoid);
  {
    const m = G.pickMark, w = cardMode === 'cell' && pick >= 0 ? cellWorld(pick) : null, p = w && projectWorld(w[0], w[1], w[2]);
    // placeCard keeps the card 10 px from the ring's middle; the ring hides only when its middle is under
    // the card or a key (within keepOut's 4 px), and otherwise any sliver of it goes under the card
    const ok = p && p[0] >= 0 && p[1] >= 0 && p[0] <= $('gl').clientWidth && p[1] <= $('gl').clientHeight && clearRing(p[0] - 1, p[1] - 1, 2, 2);
    m.style.display = ok ? '' : 'none';
    if (ok) m.style.transform = `translate(${Math.round(p[0])}px, ${Math.round(p[1])}px)`;
  }
  if (!G.labelW) G.labelW = G.labels.map((el) => { el.style.display = ''; return el.offsetWidth || 40; });
  const placed = [], items = [], show = S.wells && S.labels, cmp = $('north'), cR = cmp.offsetLeft + 40, cB = cmp.offsetTop + 40;
  G.labelHits = [];
  model.wells.forEach((w, i) => {
    const el = G.labels[i], code = w.state[f] || 0;
    const on = show && (code > 0 || w.name === S.well);
    const p = on ? project(G.wellHeads ? G.wellHeads[i] : w.path[0]) : null;
    el.classList.toggle('sel', w.name === S.well);   // on every label, shown or not (DECISIONS: a hidden label kept it)
    if (!p) { el.style.display = 'none'; return; }
    if (el._code !== code) {
      el._code = code;
      const c = wellColor(code);
      el.style.setProperty('--c', `rgb(${c.join(',')})`);
      el.classList.toggle('dash', code >= 2); el.classList.toggle('thin', code === 0);
    }
    items.push({ el, i, x: p[0], y: p[1], sel: w.name === S.well ? 1 : 0 });
  });
  items.sort((a, b) => (b.sel - a.sel) || (a.y - b.y));
  for (const it of items) {
    const wdt = G.labelW[it.i], hgt = 16, x = Math.round(it.x - 7);
    const taken = (y) => y < 2 || !clear(x, y, wdt, hgt) || (x + wdt / 2 - Math.max(44, wdt) / 2 < cR && y - 24 < cB) || placed.some((r) => x < r.x + r.w + 2 && x + wdt + 2 > r.x && y < r.y + r.h && y + hgt > r.y);
    let y = Math.round(it.y - hgt - 4), hit = taken(y);
    // the chosen well's name is always drawn: under its head when the card or the keys hold the place over it
    if (hit && it.sel && !taken(Math.round(it.y + 6))) { y = Math.round(it.y + 6); hit = false; }
    if (hit && !it.sel) { it.el.style.display = 'none'; continue; }
    placed.push({ x, y, w: wdt, h: hgt });
    it.el.style.display = '';
    it.el.style.transform = `translate(${x}px, ${y}px)`;
    // the label's hits (the review, after the pass): its own text padded to 24 px tall wins over the
    // rock (WCAG 2.5.8); the full 44 x 44 box is grown upward, away from the rock under the well head,
    // and counts only where no cell is under the finger
    const hw = Math.max(44, wdt), cx = x + wdt / 2;
    G.labelHits.push({ name: model.wells[it.i].name, x: cx - hw / 2, y: y + hgt + 4 - 44, w: hw, h: 44, ix: x - 2, iy: y - 4, iw: wdt + 4, ih: hgt + 8 });
  }
}
/** The well whose label's hit holds a point on the plate, the nearest if several do: `inner` asks for
 *  the name's own padded text, otherwise its 44 x 44 box. */
function labelAt(x, y, inner) {
  let best = null, bd = Infinity;
  for (const h of G.labelHits || []) {
    const [hx, hy, hw, hh] = inner ? [h.ix, h.iy, h.iw, h.ih] : [h.x, h.y, h.w, h.h];
    if (x < hx || x > hx + hw || y < hy || y > hy + hh) continue;
    const d = Math.hypot(x - (hx + hw / 2), y - (hy + hh / 2));
    if (d < bd) { bd = d; best = h.name; }
  }
  return best;
}

// ---------------------------------------------------------------- the compass + the scale
const SCALE_PX = 96;
const DIRS = ['the top', 'the top right', 'the right', 'the bottom right', 'the bottom', 'the bottom left', 'the left', 'the top left'];
// Both from the live view matrix at the camera target. North: model +y (geometry.bin is x east, y north,
// depth), world (0, 0, -1) in the grid shader. Scale: M4.look's right axis is cross(world up, view), so
// level and across the screen, the honest direction to measure along.
function updateGauge() {
  if (!G.PV || !G.V) return;
  const V = G.V, T = S.cam.target, d = Math.max(1, S.cam.dist * 0.02);
  const p0 = projectWorld(T[0], T[1], T[2]);
  if (!p0) return;
  const pE = projectWorld(T[0] + d * V[0], T[1] + d * V[4], T[2] + d * V[8]);
  const pN = projectWorld(T[0], T[1], T[2] - d);
  if (!pE || !pN) return;
  const acrossPx = Math.hypot(pE[0] - p0[0], pE[1] - p0[1]);
  const ppm = acrossPx / d;
  if (ppm > 0 && Number.isFinite(ppm)) {
    let best = 0, err = Infinity;
    for (const m of U.scaleSteps(units)) { const x = Math.abs(Math.log(m * ppm / SCALE_PX)); if (x < err) { err = x; best = m; } }
    const label = U.length(best, units), exag = U.times(S.exag);
    $('scale-bar').style.width = `${Math.max(8, Math.round(best * ppm))}px`;
    setText('scale-len', label);
    setText('scale-sub', `vertical ${exag}`);
    $('scale').setAttribute('aria-label', `Scale bar: ${U.spokenUnits(label)} across, measured level with the middle of the view. Depth is stretched ${U.tick(Math.round(S.exag * 10) / 10)} times.`);
  }
  const nx = pN[0] - p0[0], ny = pN[1] - p0[1], nl = Math.hypot(nx, ny);
  if (nl > 0.01) G.north = Math.atan2(nx, -ny) * 180 / Math.PI;
  // the needle shortens as north leans into the view, never under half; the N at its tip
  const a = G.north || 0, k = Math.max(0.5, acrossPx > 0 ? Math.min(1, nl / acrossPx) : 1), r = a * Math.PI / 180, q = 8.5 * k + 5.5;
  $('needle').setAttribute('transform', `rotate(${Math.round(a * 10) / 10}) scale(1 ${Math.round(k * 1000) / 1000})`);
  $('north-n').setAttribute('transform', `translate(${Math.round(q * Math.sin(r))} ${Math.round(-q * Math.cos(r))})`);
  $('north').setAttribute('aria-label', `North arrow: north is toward ${DIRS[((Math.round(a / 45) % 8) + 8) % 8]} of the view.`);
}

// ---------------------------------------------------------------- the caption band's legend
/** Round ticks inside a linear range, in the shown system's numbers. */
function niceStep(span, n) {
  const raw = span / n, e = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * e).reduce((a, b) => (Math.abs(Math.log(b / raw)) < Math.abs(Math.log(a / raw)) ? b : a));
}
function legendTicks(p) {
  const r = propRange(D, p), sys = units, ends = openEnds(D, p, G.gasMax), out = [];
  const toSys = (v) => U.toSystem(v, p.unit, sys), fromSys = (v) => (p.unit === 'bar' || p.unit === 'm') && sys === 'US' ? v / U.toSystem(1, p.unit, sys) : v;
  const at = (v) => norm(p, r, v);
  if (p.scale === 'log') {
    out.push({ t: 0, text: U.tick(r[0]) });
    for (let e = Math.ceil(Math.log10(r[0])); 10 ** e < r[1]; e++) if (10 ** e > r[0] * 1.0001) out.push({ t: at(10 ** e), text: U.tick(10 ** e) });
    out.push({ t: 1, text: U.tick(r[1]) });
  } else {
    const lo = toSys(r[0]), hi = toSys(r[1]), step = niceStep(hi - lo, 3), d = p.unit === 'bar' || p.unit === 'm' ? 0 : 3;
    const endText = (v) => (d ? U.tick(v) : U.int(v));
    out.push({ t: 0, text: endText(lo) });
    for (let v = Math.ceil(lo / step - 1e-9) * step; v < hi - 1e-9; v += step) {
      const t = at(fromSys(v));
      if (t > 0.08 && t < 0.92) out.push({ t, text: U.tick(Math.round(v * 1e6) / 1e6) });
    }
    out.push({ t: 1, text: endText(hi) });
  }
  out.sort((a, b) => a.t - b.t);
  if (ends.lo) out[0].text = `≤${U.NNBSP}${out[0].text}`;
  if (ends.hi) out[out.length - 1].text = `≥${U.NNBSP}${out[out.length - 1].text}`;
  out[out.length - 1].text = U.withUnit(out[out.length - 1].text, U.unitOf(p.unit, sys));
  return out;
}
function drawLegend() {
  if (!cfg || !model || !G.nReg) return;
  const p = propDef(S.prop), named = category(p), cats = $('legend-cats');
  $('legend-name').textContent = p.label;
  $('legend-scale').hidden = named;
  cats.hidden = !named;
  if (named) {
    cats.replaceChildren();
    const pal = stopsOf(p.colormap);
    const items = Array.from({ length: G.nReg }, (_, i) => [String(i + 1), pal[i % pal.length], true]);
    for (const [name, color, has] of items) {
      if (!has) continue;
      const s = document.createElement('span'), i = document.createElement('i');
      i.style.setProperty('--c', color);
      s.append(i, document.createTextNode(name));
      cats.appendChild(s);
    }
    return;
  }
  const bar = $('legend-bar'), w = Math.max(1, Math.round(bar.clientWidth * (window.devicePixelRatio || 1)));
  bar.width = w; bar.height = 1;
  const x = bar.getContext('2d'), L = lut(p.colormap), img = x.createImageData(w, 1);
  for (let i = 0; i < w; i++) { const k = Math.round((i / Math.max(1, w - 1)) * 255) * 3; img.data.set([L[k], L[k + 1], L[k + 2], 255], i * 4); }
  x.putImageData(img, 0, 0);
  const box = $('legend-ticks'); box.replaceChildren();
  const ticks = legendTicks(p);
  ticks.forEach((tk, n) => {
    const s = document.createElement('span');
    s.textContent = tk.text;
    s.style.left = `${tk.t * 100}%`;
    if (n === 0) s.className = 'first'; else if (n === ticks.length - 1) s.className = 'last';
    box.appendChild(s);
  });
  thinTicks();
}
/** Interior labels that would touch a neighbor go; the two ends always print. Run again whenever the
 *  bar's width changes after the legend was written (focus mode moves the About key onto its line). */
function thinTicks() {
  const spans = [...$('legend-ticks').children];
  if (spans.length < 3) return;
  for (const e of spans) e.hidden = false;
  const rects = spans.map((e) => e.getBoundingClientRect());
  let last = rects[0];
  for (let i = 1; i < spans.length - 1; i++) {
    if (rects[i].left < last.right + 6 || rects[i].right > rects[spans.length - 1].left - 6) spans[i].hidden = true; else last = rects[i];
  }
}

// ---------------------------------------------------------------- the stamp and About
/** Data built once (HOUSE 4.2, 4.15): once every file is in, the stamp's line hides and the About key
 *  takes its place; the edition is About's first row. */
function writeStamp() {
  $('stamp-home').hidden = true;
  $('btn-about').hidden = false;
}
function edition() { return `Volve, ${(String(model.source).match(/OPM Flow \d{4}\.\d{2}/) || ['OPM Flow'])[0]} run`; }
/** The run's period in words, from the dates: "quarter" for Volve (whose first interval is 11 days). */
function perWord(plural) { const w = G.per.word || 'interval'; return plural ? `${w}s` : w; }
/** About, written from the data: model.json, seismic.json, validation.json and ATTRIBUTION.txt. */
function writeAbout() {
  const f0 = model.frames[0], f1 = model.frames[G.nf - 1], [p0, p1] = model.dynamic.pressureRange, sm = G.seisMeta, us = units === 'US';
  const facts = cutFacts(G.cut), sc = CUT_SCALE[units], P = G.per, ft = (m) => U.valueWithUnit({ unit: 'm' }, m, units), len = (m) => U.length(m, units);
  const crsMap = String(model.crs).split(';')[0];
  $('ab-model').textContent = `The model is Equinor’s simulation model of the Volve field, in block 15/9 of the North Sea (deck VOLVE_2016.DATA), cut into ${U.int(model.NA)} active cells, ${model.NI} by ${model.NJ} by ${model.NK}. Each cell is colored by its value on the scale under the picture, at the report date in the player. Where cells go past a scale’s end, the end prints open (≤${U.NNBSP}and ≥) and those cells take the end’s color. The model and the seismic share one map frame, ${crsMap}.`;
  $('ab-explode').textContent = `${U.withUnit(U.int(gapOf('layer', 8)), 'm')} between layers, the ${G.nReg} fluid-in-place regions spread apart`;
  // the cut, in the run's own period
  const per = perWord(), scaleWords = us ? `0.25${U.NNBSP}px per 1${U.NNBSP}000${U.NNBSP}bbl/d` : `1.5${U.NNBSP}px per 1${U.NNBSP}000${U.NNBSP}Sm³/d`;
  const cross = facts.cross ? ` From the ${per} to ${U.date(facts.cross.iso)} the wells lift more water than oil in ${facts.stays === facts.of ? `all ${facts.of}` : `${facts.stays} of the ${facts.of}`} ${perWord(true)} left, and the last ${per} is ${U.percent(facts.last.share)} water.` : '';
  $('ab-cut').textContent = `Each column on the player’s track is one report date: its width is the days since the date before (${U.int(P.first)} days for the first, then ${U.int(P.min)} to ${U.int(P.max)}, a ${per}), and its height is the liquid the field’s wells lifted per day over those days, at ${scaleWords} (the tick at the track’s left end is ${sc.label}). The oil is the solid ink at the foot and the water the paler ink stacked on it. The liquid peaks at ${U.liquid(facts.peak.liquid, units)} in the ${per} to ${U.date(facts.peak.iso)}, ${U.percent(facts.peak.share)} of it water.${cross}`;
  const vol = (series) => series.reduce((s, v, f) => s + (f ? v * P.days[f] : 0), 0);
  const F = model.summary.field, Hf = (model.summary.history || {}).field || {}, oSim = vol(F.oil), oRep = Hf.oil ? vol(Hf.oil) : NaN, gor = vol(F.gas) / oSim;
  const rel = oRep === oRep ? ` Over the run it lifts ${U.percent(Math.abs(oSim / oRep - 1))} ${oSim < oRep ? 'less' : 'more'} oil than the field reported for the same ${perWord(true)} (${U.fixed(oSim / 1e6, 2)} against ${U.fixed(oRep / 1e6, 2)} million Sm³, summed over the report dates).` : '';
  $('ab-history').textContent = `It is the simulation’s field production: the run of the deck, driven by the field’s reported well rates, averaged over each interval. It is not the field’s reported production, which the rates chart under More controls draws beside it, dotted.${rel} Gas is not in it, because at the surface the field’s gas is measured in volumes about ${U.int(Math.round(gor / 5) * 5)} times the oil’s; gas and injection are in the rates chart.`;
  // the section
  const lenOf = (l) => len(Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]));
  $('ab-section').textContent = `The section shows a vertical plane along the line from A to A′, the seismic and the model on it on one depth axis in ${us ? 'feet' : 'meters'} below mean sea level, stretched as the 3D view is (Vertical exaggeration, under More controls); a pane made taller than its section stretches it more, to the round figure that fills it, and says so under it. Distance runs from A in ${us ? 'feet' : 'meters'}, and the inline and crossline of the traces nearest each end are printed by A and A′ (on a small plot, in a key beside it). Each cell the plane cuts is drawn as the block it cuts, in one color: the cell’s value on the scale under the picture at the report date in the player, unshaded and never blended with its neighbors, since a model cell holds one value. With both shown, the seismic lies under the cells, which cover it by the share set under More controls (Cells over it); the cut’s outline is drawn whatever the share. Hatching marks where the plane passes between active cells inside the model, where inactive cells hold no values. The dashed lines are the Hugin Formation’s top and base as interpreted (below). The wells that come within ${len(SEC_CORRIDOR)} of the plane are drawn on it, moved square onto it, as the 3D view draws them on that date. The explode, the cell ranges and the value range change the 3D view only. Inline and Crossline are the survey’s own lines, ${len(G.sg.spacing * (G.sg.nv - 1))} and ${len(G.sg.spacing * (G.sg.nu - 1))} long, and the slider steps through all ${G.sg.nu} inlines (${U.int(ilAt(G.sg, 0))} to ${U.int(ilAt(G.sg, G.sg.nu - 1))}) or ${G.sg.nv} crosslines (${U.int(xlAt(G.sg, 0))} to ${U.int(xlAt(G.sg, G.sg.nv - 1))}). Along is the straight line through the field, ${lenOf(G.lines.along)} long, that passes over the most of its stacks of cells (each stack the cells of one I and one J); Across is the one square to it that passes over the most (${lenOf(G.lines.across)}). The slider sweeps them through the grid itself, through its rows (each the cells of one J) or its columns (one I), whichever lies along the line. A column or row is shown as it is in the grid, not as a straight cut: its own cells, each the face midway across it, along the path through the middles of its pillars, with distance measured along that path, and the wells within ${len(SEC_CORRIDOR)} of it drawn at their nearest point on it. A line of your own is swept parallel to itself, one column’s or row’s width at a time.`;
  // the seismic: what it is, how it was cut and stored, how it is drawn, its polarity and its depths
  const a = sm.amplitude, aa = sm.antiAlias, cr = sm.crop, zEnd = sm.z.first + (sm.z.count - 1) * sm.z.step;
  // the pass band as seismic.json states it (0.20 cycles a bin: wavelengths of five bins and more)
  const passM = Number((/wavelengths of ([\d.]+) m/.exec(aa.passBand) || [])[1]) || sm.spacing.binIl / 0.2;
  $('ab-seismic').textContent = `The seismic is survey ${sm.survey}: the ${sm.product}. It was cut to the model, from ${ft(cr.verticalMarginM)} above its shallowest cell to ${ft(cr.verticalMarginM)} below its deepest and ${len(cr.lateralMarginM)} past its edge: inlines ${U.int(sm.il.first)} to ${U.int(sm.il.last)} and crosslines ${U.int(sm.xl.first)} to ${U.int(sm.xl.last)}, every second one of the survey’s ${U.exactLength(sm.spacing.binIl, units)} lines, and depths ${ft(sm.z.first)} to ${ft(zEnd)}. Before every second line was dropped, a low-pass filter ran across the inlines and the crosslines (${aa.filter}), passing wavelengths of ${U.exactLength(passM, units)} and longer within 0.05${U.NNBSP}dB and holding those at the new spacing’s Nyquist (${len(2 * sm.spacing.il)}) and shorter at least 50${U.NNBSP}dB down, so the traces now ${len(sm.spacing.il)} apart carry no dip that ${len(sm.spacing.il)} cannot. Depth keeps its ${len(sm.z.step)} samples at their original depths. The amplitudes are stored in 8 bits with zero at code ${a.zeroCode} and a symmetric clip at the ${U.fixed(a.clipPercentile, 1)}th percentile of |amplitude|, ${U.fixed(a.clip, 4)}, which ${U.withUnit(U.tick(Math.round(a.clippedFraction * 1000) / 10), '%')} of the samples reach (the largest is ${U.fixed(a.absMax, 4)}): amplitude = (code ${U.MINUS} ${a.zeroCode}) / 127 × the clip, ${a.unit}.`;
  $('ab-display').textContent = `On the section the seismic is drawn at the screen’s own pixels. Along an inline or a crossline the traces are the survey’s own, ${len(sm.spacing.il)} apart, and the display blends between neighbors as a variable-density display does; along any other line each point is bilinear between the four traces around it. Where the screen’s columns lie farther apart than half a trace spacing, each column averages points across its own width. Between samples in depth the value is a windowed sinc (a Kaiser window six samples either side), widened to the screen rows’ own Nyquist where the rows lie farther apart than the samples, so nothing aliases. While the section is dragged, resized or scrubbed, the seismic is drawn instead from its own samples, one column for every ${len(sm.spacing.il)} along the line and one row for every ${len(sm.z.step)} of depth, and smoothed by the screen; once it rests, it is resampled as above, with the windowed sinc at the screen’s own pixels. The amplitude is multiplied by the gain (Seismic gain, under More controls; ×1 puts the clip at the ramp’s ends) and drawn through a ramp symmetric about zero, gray or red and blue; no automatic gain control is applied. ${polarityWords()} The key under the section gives the signed amplitude at each end of the ramp, negative at its left and positive at its right.`;
  $('ab-polarity').textContent = `Polarity, as the contractor’s textual header states it (${sm.polaritySource.replace(/^what the contractor's textual header states, /, '')}): “${sm.polarity}” ${sm.polarityNote}`;
  $('ab-depth').textContent = `One depth axis serves both, in ${us ? 'feet' : 'meters'} below mean sea level, positive down. The model is at its own grid depths: its deck states no datum, and the pipeline measured that the cells its wells are completed in lie on the wells’ surveyed paths taken below sea level. The seismic is at its own depths as delivered: its header states no datum either, and sea level is inferred from the tidal statics in its processing list. ${sm.depthRelation} So the seismic and the model are shown as delivered, each at its own depths on the one axis, not tied to each other. The Hugin Formation’s top and base are interpretations made on another survey (ST10010, 2011 processing), converted to depth and adjusted to the wells; they agree with the Hugin top picked in the wells, are not picks on this image, and are not tied to it.`;
  // this data, the check against Equinor's run, the terms and what was changed
  const v = G.check, fld = v.field, pct = (d) => `${d > 0 ? '+' : d < 0 ? U.MINUS : ''}${U.fixed(Math.abs(d), 1)}${U.NNBSP}%`;
  let worst = null;
  for (const [w, vs] of Object.entries(v.wells)) for (const [k, r] of Object.entries(vs)) { const tol = v.tolerances[k === 'WOPT' ? 'wellOilPct' : k === 'WWPT' ? 'wellWaterPct' : 'wellInjectedPct']; if (!worst || Math.abs(r.diffPct) / tol > Math.abs(worst.d) / worst.tol) worst = { w, k, d: r.diffPct, tol }; }
  const what = { WOPT: 'oil', WWPT: 'water', WWIT: 'water injected' };
  $('about-check').textContent = `Checked against Equinor’s own run (${v.reference}), ${v.pass ? 'passed' : 'not passed'}: at ${U.date(v.end)} the run’s field oil produced differs by ${pct(fld.FOPT.diffPct)}, water by ${pct(fld.FWPT.diffPct)}, gas by ${pct(fld.FGPT.diffPct)} and water injected by ${pct(fld.FWIT.diffPct)}; field pressure differs by ${U.withUnit(U.fixed(v.pressure.meanAbsBar, 2), 'bar')} on average and ${U.withUnit(U.fixed(v.pressure.maxAbsBar, 2), 'bar')} at most; every well checked is within its tolerance, the farthest ${worst ? `${worst.w}’s ${what[worst.k]}, ${pct(worst.d)} against ${U.withUnit(U.int(worst.tol), '%')}` : 'none'}; and all ${U.int(v.static.activeCells.ours)} active cells’ depth and porosity equal Equinor’s. Equinor’s run is the deck’s, not the field’s: the field’s reported oil to ${U.date(v.end)} is ${U.fixed(fld.FOPT.observed / 1e6, 2)} million Sm³, the run’s ${U.fixed(fld.FOPT.ours / 1e6, 2)} million.`;
  $('about-source').textContent = model.source;
  $('about-terms').textContent = 'Contains data from the Volve field data set, © Equinor ASA and the former Volve license partners ExxonMobil Exploration & Production Norway AS and Bayerngas Norge AS (or their successors), used under Equinor’s “Terms and conditions for licence to data - Volve”. The data in this app is Adapted Material under those terms: shared free of charge, not for sale, and not connected with, sponsored or endorsed by Equinor or the former Volve license partners. Every recipient may use it under the same terms; the template’s MIT license covers its code only.';
  writeChanges();
  const list = $('about-list'); list.replaceChildren();
  const rows = [
    ['Edition', edition()],
    ['Field', 'Volve, block 15/9, North Sea'],
    ['Grid', `${model.NI} by ${model.NJ} by ${model.NK} cells, ${U.int(model.NA)} of them active`],
    ['Map', crsMap],
    ['Report dates', `${G.nf}, ${U.date(f0)} to ${U.date(f1)}: ${U.int(P.first)} days to the second, then a ${per} apart (${U.int(P.min)} to ${U.int(P.max)} days)`],
    ['Wells', `${model.wells.length}, ${model.wells.filter((w) => w.firstOpen >= 0).length} of them opened in the run`],
    ['Storage', `saturations to 1/255, pressure to ${U.withUnit(U.fixed((p1 - p0) / 65535, 4), 'bar')} over ${U.withUnit(U.int(p0), 'bar')} to ${U.withUnit(U.int(p1), 'bar')}`],
    ['Rates', `standard cubic meters a day, averaged over the days from one report date to the next; reported rates from the field’s history, as the run’s summary carries them`],
    ['Seismic', `${U.int(sm.il.count)} inlines by ${U.int(sm.xl.count)} crosslines of traces ${len(sm.spacing.il)} apart, ${U.int(sm.z.count)} samples ${len(sm.z.step)} apart from ${ft(sm.z.first)} to ${ft(zEnd)}`],
    ['Units', 'SI, or US units from the key at the top right: psi, feet, barrels and thousand cubic feet a day. Standard conditions differ slightly between the two; the conversion ignores that'],
  ];
  for (const [k, val] of rows) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = `${k}:`; dd.textContent = val; if (k === 'Edition') dd.translate = false; list.append(dt, dd); }
  $('ab-page').textContent = `a year (${G.per.perYear} report dates)`;
  const oilPeak = G.cut.reduce((x, c) => (c.oil > x.oil ? c : x));
  $('cut-desc').textContent = `The cut: the liquid the field lifted per day, ${per} by ${per}, from ${U.spokenMonth(f0)} to ${U.spokenMonth(f1)}. Oil peaks at ${U.spokenUnits(U.liquid(oilPeak.oil, units))} in the ${per} to ${U.spokenDate(oilPeak.iso)}.${facts.cross ? ` Water passes oil from the ${per} to ${U.spokenDate(facts.cross.iso)}.` : ''}`;
}
/** ATTRIBUTION.txt's own statement of every adaptation (its "What we changed" part), word for word: each
 *  numbered item and each of its points a paragraph, the file's line breaks joined. */
function writeChanges() {
  const box = $('about-changes');
  if (box.childElementCount) return;
  const t = G.attribution.replace(/\r/g, ''), i = t.indexOf('What we changed'), j = t.indexOf('\nFiles\n', i);
  if (i < 0) return;
  const lines = t.slice(t.indexOf('\n', i) + 1, j < 0 ? undefined : j).split('\n'), paras = [];
  for (const l of lines) {
    if (!l.trim()) continue;
    if (/^\d+\.\s/.test(l) || /^\s+-\s/.test(l)) paras.push({ sub: /^\s+-/.test(l), text: l.trim() });
    else if (paras.length) paras[paras.length - 1].text += ` ${l.trim()}`;
  }
  for (const q of paras) { const p = document.createElement('p'); p.textContent = q.text; if (q.sub) p.className = 'sub'; box.appendChild(p); }
}
let aboutFrom = null, aboutPlay = false;
function openAbout() {
  aboutFrom = document.activeElement;
  aboutPlay = !!playing; if (playing) stop();
  $('about').hidden = false;
  $('about-close').focus();
}
function closeAbout() {
  if ($('about').hidden) return;
  $('about').hidden = true;
  if (aboutFrom && aboutFrom.focus) aboutFrom.focus();
  if (aboutPlay) play();
  aboutPlay = false;
}

// ---------------------------------------------------------------- the controls sheet
const GRIP = ['Show more controls', 'Show all controls', 'Hide the extra controls'];
function applyStop() {
  const sheet = $('sheet'), grip = $('grip');
  sheet.classList.remove('s0', 's1', 's2');
  sheet.classList.add('s' + S.sheet);
  document.body.classList.toggle('raised', S.sheet > 0);   // the view keeps --view-min (style.css)
  grip.setAttribute('aria-label', GRIP[S.sheet]);
  // the raised stops are one height (the view keeps its share), so the second stop shows what it adds:
  // the sheet scrolls Cells and view up under the grip; the first stop and closed go back to the top
  const head = document.querySelector('.stop2 .sheet-head');
  const to = S.sheet === 2 && head ? sheet.scrollTop + head.getBoundingClientRect().top - sheet.getBoundingClientRect().top - sheet.clientTop - grip.offsetHeight : 0;
  sheet.scrollTo({ top: Math.max(0, to), behavior: reduced.matches || !model ? 'auto' : 'smooth' });
  R.draw = true; R.chart = true; R.labels = true; kick();
}
function setStop(n) {
  n = Math.max(0, Math.min(2, Math.round(n)));
  if (n === S.sheet) return;
  S.sheet = n; applyStop(); save();
}
// Drag the grip a stop at a time, or tap it to step through the stops.
function initSheet() {
  const grip = $('grip');
  let drag = null, skipClick = false;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    skipClick = false;
    grip.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, moved: false };
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 5) drag.moved = true;
    if (dy > 44 && S.sheet < 2) { setStop(S.sheet + 1); drag.y = e.clientY; }
    else if (dy < -44 && S.sheet > 0) { setStop(S.sheet - 1); drag.y = e.clientY; }
  });
  grip.addEventListener('pointerup', () => { if (drag && drag.moved) skipClick = true; drag = null; });
  grip.addEventListener('pointercancel', () => { drag = null; });
  grip.addEventListener('click', () => {
    if (skipClick) { skipClick = false; return; }
    setStop((S.sheet + 1) % 3);
  });
  grip.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setStop(S.sheet + 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setStop(S.sheet - 1); }
  });
  applyStop();
}
/** The keys: a column where the plate is tall enough for it (294 px with the 8 px inset); else a row along
 *  the plate's top, where the row fits its width (2.2's); else (the section beside the model) whichever of
 *  two rows (keys-wrap) and the plates side by side (keys-cols) leaves the model the larger, measured by
 *  the rooms the field is fitted to. Worked out again only when the plate's size or the keys' inset change. */
function layoutKeys() {
  const plate = $('plate'), k = $('keys'), W = plate.clientWidth, H = plate.clientHeight, shown = k.getClientRects().length > 0;
  const at = `${W} ${H} ${shown} ${document.body.classList.contains('sectioned')}`;
  if (at === G.keysAt) return;
  G.keysAt = at;
  plate.classList.toggle('narrow', W < 310);   // the card takes its compact form, Zoom under the place line
  const set = (c) => { for (const n of ['keys-row', 'keys-wrap', 'keys-cols']) plate.classList.toggle(n, n === c); };
  if (H >= 302) { set(''); return; }
  set('keys-row');
  const left = plate.getBoundingClientRect().left, fits = (d) => k.getBoundingClientRect().left >= left + d;   // the keys inside the plate
  if (!shown || fits(8)) return;
  const asp = G.fitAsp || 3;   // the field's width over its height as last fitted
  const model = () => { let s = 0, c = 0; for (const q of fitRooms(W, H)) { const w = Math.min(q.r - q.l, (q.b - q.t) * asp); if (w / (q.pref || 1) > c) { c = w / (q.pref || 1); s = w; } } return s; };
  set('keys-wrap'); const wrap = fits(0) ? model() : -1;   // two rows only where they fit (150 px: not on the 160 px strip)
  set('keys-cols'); if (wrap > model()) set('keys-wrap');
}

// ---------------------------------------------------------------- UI
/** A group of words with the tracer under the chosen one: role="radio", arrow keys move the choice. */
function radioKeys(box) {
  box.addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    const all = [...box.querySelectorAll('[role="radio"]')], i = all.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = all[(i + d + all.length) % all.length];
    next.focus(); next.click();
  });
  // one tab stop per group (a roving tabindex): the chosen word; the arrows move inside it
  const rove = () => {
    const all = [...box.querySelectorAll('[role="radio"]')], on = all.find((b) => b.getAttribute('aria-checked') === 'true') || all[0];
    for (const b of all) b.tabIndex = b === on ? 0 : -1;
  };
  new MutationObserver(rove).observe(box, { subtree: true, childList: true, attributeFilter: ['aria-checked'] });
  rove();
}
function setSliderFill(el) { el.style.setProperty('--p', `${((el.value - el.min) / (el.max - el.min || 1)) * 100}%`); }
function initUI() {
  buildWords();
  buildLabels();
  buildWellPicker();
  paintWellKey();
  track = createTrack($('slider'), $('track'), {
    onStart: () => { if (playing) stop(); R.track = true; kick(); },   // the thumb grows under the finger
    onEnd: () => { R.track = true; kick(); },
    onScrub: (k) => { wanted = k; kick(); },
    onKey: (k) => { if (playing) stop(); wanted = k === 'home' ? 0 : k === 'end' ? G.nf - 1 : Math.max(0, Math.min(G.nf - 1, shown + k)); kick(); },
    pageStep: G.per.perYear,   // Page Up and Page Down: a year of report dates (4 for Volve's quarters)
  });
  setTrackModel();
  $('slider').setAttribute('aria-valuemax', String(G.nf - 1));
  $('btn-play').addEventListener('click', () => (playing ? stop() : play()));
  const stepKey = (d) => { if (playing) stop(); wanted = Math.max(0, Math.min(G.nf - 1, shown + d)); say(`${U.spokenDate(model.frames[wanted])}.`); kick(); };
  $('btn-prev').addEventListener('click', () => stepKey(-1));
  $('btn-next').addEventListener('click', () => stepKey(1));

  for (const ax of ['i', 'j', 'k']) {
    const a = $(ax + '0'), b = $(ax + '1');
    a.max = b.max = model['N' + ax.toUpperCase()];
    a.value = S.cut[ax + '0']; b.value = S.cut[ax + '1'];
    const on = (which) => {
      let lo = +a.value, hi = +b.value;
      if (lo > hi) { if (which === 0) b.value = hi = lo; else a.value = lo = hi; }
      S.cut[ax + '0'] = lo; S.cut[ax + '1'] = hi;
      writeCutOutputs(); R.faces = true; save(); kick();
    };
    a.addEventListener('input', () => on(0)); b.addEventListener('input', () => on(1));
  }
  const v0 = $('v0'), v1 = $('v1');
  v0.value = S.vf[0]; v1.value = S.vf[1];
  const onV = (which) => {
    let lo = +v0.value, hi = +v1.value;
    if (lo > hi) { if (which === 0) v1.value = hi = lo; else v0.value = lo = hi; }
    S.vf = [lo, hi]; writeCutOutputs(); R.faces = true; save(); kick();
  };
  v0.addEventListener('input', () => onV(0)); v1.addEventListener('input', () => onV(1));
  const ex = $('exag');
  ex.value = S.exag;
  ex.addEventListener('input', () => { S.cam.target[1] *= +ex.value / S.exag; S.exag = +ex.value; refitIfFitted(); writeCutOutputs(); writeSecWords(); R.draw = true; R.section = true; save(); kick(); });

  const toggle = (id, key, after) => {
    const el = $(id);
    const show = () => el.setAttribute('aria-pressed', String(!!S[key]));
    show();
    el.addEventListener('click', () => { S[key] = !S[key]; show(); if (after) after(); R.draw = true; R.labels = true; save(); kick(); });
  };
  toggle('btn-wells', 'wells', () => { $('wellkey').hidden = !S.wells; $('sec-key-wells').hidden = !S.wells; R.section = true; });
  toggle('t-labels', 'labels');
  toggle('t-edges', 'edges');
  $('wellkey').hidden = !S.wells;
  $('sec-key-wells').hidden = !S.wells;
  $('reset-cut').addEventListener('click', () => {
    S.cut = { i0: 1, i1: model.NI, j0: 1, j1: model.NJ, k0: 1, k1: model.NK }; S.vf = [0, 100];
    for (const ax of ['i', 'j', 'k']) { $(ax + '0').value = 1; $(ax + '1').value = model['N' + ax.toUpperCase()]; }
    v0.value = 0; v1.value = 100;
    S.explode.t = 0; $('explode').value = 0; computeExplode(); refitIfFitted(); R.wells = true;
    writeCutOutputs(); R.faces = true; save(); kick();
  });
  $('fit').addEventListener('click', fitView);
  $('zoom-in').addEventListener('click', () => flyTo(S.cam.target, S.cam.dist * 0.7));
  $('zoom-out').addEventListener('click', () => flyTo(S.cam.target, S.cam.dist / 0.7));
  $('readout-zoom').addEventListener('click', () => {
    if (cardMode === 'cell' && pick >= 0) { const a = pick; closeCard(); G.hl = a; focusCell(a); }
    else if (cardMode === 'well' && S.well) { const w = S.well; closeCard(); focusWell(w); }
  });
  $('readout-close').addEventListener('click', closeCard);
  $('well-pick').addEventListener('change', (e) => selectWell(e.target.value || null, true));

  const exs = $('explode');
  exs.value = S.explode.t;
  const exModes = $('ex-mode');
  const showMode = () => { for (const b of exModes.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.mode === S.explode.mode)); };
  showMode();
  const onEx = () => { S.explode = { mode: S.explode.mode, t: +exs.value }; computeExplode(); refitIfFitted(); writeCutOutputs(); R.faces = true; R.wells = true; save(); kick(); };
  exs.addEventListener('input', onEx);
  for (const b of exModes.querySelectorAll('button')) b.addEventListener('click', () => { S.explode.mode = b.dataset.mode; showMode(); onEx(); });
  radioKeys(exModes);
  writeCutOutputs();

  $('stamp').addEventListener('click', openAbout);
  $('btn-about').addEventListener('click', openAbout);
  $('about-close').addEventListener('click', closeAbout);
  $('about-close-2').addEventListener('click', closeAbout);
  $('about').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = [...$('about').querySelectorAll('button')], i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });
  $('btn-units').addEventListener('click', () => {
    units = U.SYSTEMS[(U.SYSTEMS.indexOf(units) + 1) % U.SYSTEMS.length];
    store(STORE.units, units);
    applyUnits();
  });
  $('focus-key').addEventListener('click', (e) => setFocus(true, e.detail === 0));
  $('focus-exit').addEventListener('click', (e) => setFocus(false, e.detail === 0));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('about').hidden) { closeAbout(); return; }
    if (SEC.armed) { armDraw(false); return; }   // Draw off first, then focus mode
    if (focus) setFocus(false, true);
  });

  initSheet();
  initSection();
  initPointer();
  initChartSeek();
  applyUnits(true);
  applyProp(true);
  layoutKeys();

  dark.addEventListener('change', () => { readTheme(); track.invalidate(); R.colors = true; R.legend = true; R.track = true; R.chart = true; R.section = true; G.texKey = null; paintWellKey(); writeSeisKey(); kick(); });   // the seismic's key swatch takes the theme's ramp
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { if (playing) stop(); if (raf) cancelAnimationFrame(raf); raf = 0; G.anim = null; return; }
    R.draw = true; R.track = true; kick(); refreshConfig();
  });
  window.addEventListener('pagehide', () => { if (playing) stop(); if (raf) cancelAnimationFrame(raf); raf = 0; });
  window.addEventListener('focus', refreshConfig);
}
function writeCutOutputs() {
  for (const ax of ['i', 'j', 'k']) { $(ax + 'v').textContent = `${S.cut[ax + '0']} to ${S.cut[ax + '1']}`; setSliderFill($(ax + '1')); $(ax + '0').style.setProperty('--p', '0%'); }
  const p = propDef(S.prop), r = propRange(D, p), cat = category(p);
  $('v0').disabled = $('v1').disabled = cat;
  const bound = (t) => U.valueWithUnit(p, denorm(p, r, t / 100), units);
  $('vv').textContent = cat ? 'none' : (S.vf[0] === 0 && S.vf[1] === 100) ? 'all' : `${bound(S.vf[0])} to ${bound(S.vf[1])}`;
  $('exv2').textContent = U.times(S.exag);
  $('exv').textContent = U.withUnit(U.int(S.explode.t), '%');
  for (const id of ['exag', 'explode', 'v1']) setSliderFill($(id));
}
function setTrackModel() {
  const y0 = +model.frames[0].slice(0, 4), y1 = +model.frames[G.nf - 1].slice(0, 4), years = [];
  for (let y = y0 + 1; y <= y1; y++) years.push({ day: U.dayNumber(`${y}-01-01`), label: String(y) });
  track.setModel({ n: G.nf, days: G.days, cut: G.cut, sys: units, years });
}
function applyUnits(initial) {
  const b = $('btn-units');
  b.textContent = units;
  b.setAttribute('aria-label', units === 'US' ? 'Change units, now US: psi, feet, barrels a day' : 'Change units, now SI: bar, meters, cubic meters a day');
  setTrackModel();
  R.legend = true; R.step = true; R.track = true; R.chart = true; R.labels = true; R.section = true;
  if (!initial) { writeCutOutputs(); writeAbout(); writeSecWords(); if (model) writeSweep(); if (cardMode) refreshCard(); }
  kick();
}

function buildWords() {
  const box = $('props'); box.replaceChildren();
  let prevDynamic = false;
  for (const p of cfg.properties) {
    if (!isDynamic(p) && prevDynamic) { const d = document.createElement('span'); d.className = 'divider'; d.setAttribute('aria-hidden', 'true'); box.appendChild(d); }
    prevDynamic = isDynamic(p);
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.key = p.key;
    b.textContent = p.short || p.label;
    b.addEventListener('click', () => { if (S.prop !== p.key) { S.prop = p.key; applyProp(); save(); } });
    box.appendChild(b);
  }
  if (!box.dataset.keys) {
    radioKeys(box); box.dataset.keys = '1';
    // the row fades at its right edge while more words lie past it, so it reads as a row that scrolls
    const fade = () => box.classList.toggle('more', box.scrollLeft + box.clientWidth < box.scrollWidth - 1);
    box.addEventListener('scroll', fade, { passive: true }); new ResizeObserver(fade).observe(box);
  }
}
function applyProp(initial) {
  for (const b of $('props').querySelectorAll('[role="radio"]')) b.setAttribute('aria-checked', String(b.dataset.key === S.prop));
  const on = $('props').querySelector('[aria-checked="true"]');
  if (on && !initial) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  writeCutOutputs();
  if (!initial) { drawLegend(); writeSecWords(); }
  R.colors = true; R.faces = true; G.texKey = null;
  if (cardMode) refreshCard();
  kick();
}

function buildWellPicker() {
  const sel = $('well-pick'); sel.replaceChildren();
  const all = document.createElement('option'); all.value = ''; all.textContent = 'Whole field'; sel.appendChild(all);
  for (const n of model.wells.filter((w) => Object.keys(model.summary.wells[w.name] || {}).length).map((w) => w.name).sort()) {
    const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o);
  }
  sel.value = S.well || '';
}
function paintWellKey() {
  for (const el of $('wellkey').querySelectorAll('.core')) {
    const c = cfg.wellColors[el.dataset.role];
    if (isHex(c)) el.style.setProperty('--c', c);
  }
}

async function refreshConfig() {
  if (!cfg) return;
  let c;
  try { c = await loadJSON('config.json'); } catch (e) {
    if (!G.cfgWarned) { G.cfgWarned = true; notice(`${e.message} The settings already loaded stay.`); }
    return;
  }
  G.cfgWarned = false;
  if (c.text === cfgText) return;
  cfg = c.json; cfgText = c.text; D.cfg = cfg; lutCache.clear();
  if (!propDef(S.prop)) S.prop = cfg.properties[0].key;
  computeExplode(); buildLabels(); paintWellKey();
  buildWords(); applyProp(); R.draw = true; R.wells = true; R.legend = true; kick();
}

// ---------------------------------------------------------------- play
function play() {
  const from = shown >= G.nf - 1 ? 0 : shown;
  wanted = from;
  playing = { from, t0: performance.now() };
  showPlay();
  kick();
}
function stop() {
  if (!playing) return;
  playing = null;
  showPlay();
}
function showPlay() {
  const on = !!playing;
  $('ico-play').toggleAttribute('hidden', on);
  $('ico-pause').toggleAttribute('hidden', !on);
  $('btn-play').setAttribute('aria-label', on ? 'Pause' : 'Play production history');
}

// ---------------------------------------------------------------- focus mode
function setFocus(on, byKeyboard) {
  if (on === focus) return;
  focus = on;
  store(STORE.focus, on ? '1' : '0');
  if (on) closeCard();
  const leaving = on ? [$('head'), $('keys'), $('sheet')] : [];
  if (on && !reduced.matches) {
    for (const e of leaving) e.classList.add('leaving');
    setTimeout(() => { for (const e of leaving) e.classList.remove('leaving'); applyFocus(true); after(); }, 160);
  } else { applyFocus(on); after(); }
  function after() {
    say(on ? 'Controls hidden. Press Escape or the corner key to show them.' : 'Controls shown.');
    if (byKeyboard) (on ? $('focus-exit') : $('focus-key')).focus();
  }
}
function applyFocus(on) {
  document.body.classList.toggle('focus', on);
  for (const e of [$('head'), $('keys'), $('sheet')]) { e.hidden = on; e.inert = on; }
  $('focus-exit').hidden = !on;
  // the About key moves into the caption band as its first child, and back
  if (on) $('caption').prepend($('btn-about')); else document.querySelector('.hkeys').prepend($('btn-about'));
  if (model) { R.draw = true; R.labels = true; kick(); }
}

// ---------------------------------------------------------------- touch + mouse on the plate
function initPointer() {
  const c = $('gl'), pts = new Map();
  let down = null, pinch = null, lastTap = null;
  c.addEventListener('pointerdown', (e) => {
    if (G.anim) { S.cam = G.anim.to; G.anim = null; R.draw = true; }   // a touch ends a flight at its end
    if (!$('error').hidden && model && G.cfgWarned) notice('');
    c.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pts.size === 1) {
      down = { x: e.offsetX, y: e.offsetY, t: performance.now(), moved: false, btn: e.button, shift: e.shiftKey };
      // the section's line: with Draw on, a drag draws it; else a drag that starts on A or A′ moves that end
      const h = S.section.on && !e.button ? (SEC.armed ? 'draw' : secHandle(e.offsetX, e.offsetY)) : null;
      if (h) Object.assign(down, { sec: h, p0: mapPoint(e.offsetX, e.offsetY), was: { line: S.section.line, a: S.section.a, b: S.section.b, at: S.section.at } });
    }
    if (pts.size === 2) {
      pinch = pinchState(pts);
      if (down) { down.moved = true; if (down.sec) { SEC.drag = null; SEC.lockH = false; setLine(down.was, true); down.sec = null; } }   // two fingers: back to the view
    }
    kick();
  });
  c.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), cur = [e.offsetX, e.offsetY];
    pts.set(e.pointerId, cur);
    if (pts.size === 1 && down) {
      const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
      if (Math.hypot(e.offsetX - down.x, e.offsetY - down.y) > 6) down.moved = true;
      if (!down.moved) return;
      if (down.sec) {
        const p = mapPoint(cur[0], cur[1]);
        if (!p) return;
        if (!down.p0) down.p0 = p;
        const l = secLine(), xy = (v) => [Math.round(v[0]), Math.round(v[1])];
        const q = down.sec === 'a' ? { a: p, b: l.b } : down.sec === 'b' ? { a: l.a, b: p } : { a: down.p0, b: p };
        if (Math.hypot(q.b[0] - q.a[0], q.b[1] - q.a[1]) >= 100) { SEC.drag = true; SEC.lockH = true; setLine({ line: null, a: xy(q.a), b: xy(q.b) }); }
        return;
      }
      if (down.btn === 2 || down.shift) pan(dx, dy);
      else { S.cam.theta -= dx * 0.35; S.cam.phi = Math.max(-80, Math.min(88, S.cam.phi + dy * 0.3)); }
      S.cam.fit = false;
      R.draw = true; kick();
    } else if (pts.size === 2 && pinch) {
      const now = pinchState(pts);
      S.cam.dist = clampDist(S.cam.dist * pinch.d / Math.max(now.d, 1)); S.cam.fit = false;
      pan(now.x - pinch.x, now.y - pinch.y);
      pinch = now; R.draw = true; kick();
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0 && down && down.sec && down.moved) {
      const drawn = down.sec === 'draw' && SEC.drag, moved = !!SEC.drag;
      // the finger is off: the pane fits its section again (it was held while the line moved)
      SEC.lockH = false; R.section = true;
      if (e.type === 'pointercancel') setLine(down.was, true);
      else if (moved && (secCut(), !SEC.geom.n)) { setLine(down.was, true); say('That line misses the field.'); }   // nothing cut: the line it had
      else {
        setLine({}, true);
        if (drawn) { armDraw(false); say(`Section drawn, ${secWords()}.`); }
      }
      down = null; return;
    }
    if (pts.size === 0 && down) {
      if (!down.moved && performance.now() - down.t < 500 && e.type === 'pointerup') {
        const now = e.timeStamp;
        if (lastTap && now - lastTap.t < 380 && Math.hypot(down.x - lastTap.x, down.y - lastTap.y) < 30) { lastTap = null; focusAt(down.x, down.y); }
        else { lastTap = { t: now, x: down.x, y: down.y }; tap(down.x, down.y); }
      }
      if (down.moved && cardMode) { R.card = Math.max(R.card, 1); kick(); }   // a turn, a pan or a pinch moved the mark
      down = null; save();
    }
  };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  c.addEventListener('wheel', (e) => { e.preventDefault(); S.cam.fit = false; S.cam.dist = clampDist(S.cam.dist * Math.exp(e.deltaY * 0.0015)); R.draw = true; if (cardMode) R.card = Math.max(R.card, 1); save(); kick(); }, { passive: false });
}
function pinchState(pts) {
  const [a, b] = [...pts.values()];
  return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
}
function clampDist(d) { const m = Math.hypot(...model.extent); return Math.max(m * 0.012, Math.min(m * 6, d)); }

// ---------------------------------------------------------------- flights
function cellWorld(a) {
  const p = a * 24, g = G.geom;
  let x = 0, y = 0, z = 0;
  for (let c = 0; c < 8; c++) { x += g[p + c * 3]; y += g[p + c * 3 + 1]; z += g[p + c * 3 + 2]; }
  x /= 8; y /= 8; z /= 8;
  if (G.exOn) { const o = G.gOf[a] * 3; x += G.gOff[o]; y += G.gOff[o + 1]; z += G.gOff[o + 2]; }
  return [x, -z * S.exag, -y];
}
/** --draw's curve, cubic-bezier(0.2, 0, 0, 1), solved for x by bisection. */
function drawCurve(u) {
  const bz = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (bz(m, 0.2, 0) < u) lo = m; else hi = m; }
  return bz((lo + hi) / 2, 0, 1);
}
function flyTo(target, dist, cam) {
  const to = { theta: S.cam.theta, phi: S.cam.phi, sx: S.cam.sx || 0, sy: S.cam.sy || 0, ...(cam || {}), target: [...target], dist: clampDist(dist) };
  if (reduced.matches) { S.cam = to; G.anim = null; R.draw = true; save(); kick(); return; }
  G.anim = { from: { ...S.cam, target: [...S.cam.target] }, to, t0: performance.now(), dur: 520 };
  kick();
}
function stepAnim(now) {
  const A = G.anim; if (!A) return;
  const u = Math.min(1, (now - A.t0) / A.dur), k = drawCurve(u);
  const f = A.from, t = A.to;
  const dth = ((t.theta - f.theta) % 360 + 540) % 360 - 180;
  S.cam = {
    theta: f.theta + dth * k, phi: f.phi + (t.phi - f.phi) * k,
    dist: Math.exp(Math.log(f.dist) + (Math.log(t.dist) - Math.log(f.dist)) * k),
    sx: (f.sx || 0) + ((t.sx || 0) - (f.sx || 0)) * k, sy: (f.sy || 0) + ((t.sy || 0) - (f.sy || 0)) * k,
    target: f.target.map((v, i) => v + (t.target[i] - v) * k),
  };
  R.draw = true;
  if (u >= 1) { S.cam = { ...t, target: [...t.target] }; G.anim = null; if (cardMode) R.card = Math.max(R.card, 1); save(); }
}
function focusDist() { return Math.max(Math.hypot(...model.extent) * 0.08, S.cam.dist * 0.42); }
function focusAt(x, y) {
  const a = pickAt(x, y);
  if (a < 0 || a >= G.NA) { fitView(); return; }
  closeCard(); G.hl = a;
  flyTo(cellWorld(a), Math.min(S.cam.dist, focusDist()));
}
function focusCell(a) { flyTo(cellWorld(a), Math.min(S.cam.dist, focusDist())); }
function focusWell(name) {
  const wi = model.wells.findIndex((w) => w.name === name);
  const pts = G.wellPts && G.wellPts[wi]; if (!pts || pts.length < 2) return;
  const inner = pts.slice(1);
  const c = [0, 1, 2].map((i) => inner.reduce((s, p) => s + p[i], 0) / inner.length);
  let r = 0; for (const p of inner) r = Math.max(r, Math.hypot(p[0] - c[0], p[1] - c[1], (p[2] - c[2]) * S.exag));
  const m = Math.hypot(...model.extent);
  flyTo([c[0], -c[2] * S.exag, -c[1]], Math.max(m * 0.25, r * 4));
}
function fitView() { const d = defaultCam(); flyTo(d.target, d.dist, d); }
function pan(dx, dy) {
  const V = G.V || M4.look(eye(), S.cam.target), c = $('gl');
  const k = 2 * S.cam.dist * Math.tan(FOV / 2) / (c.clientHeight || 1);
  const right = [V[0], V[4], V[8]], up = [V[1], V[5], V[9]];
  for (let i = 0; i < 3; i++) S.cam.target[i] += (-dx * right[i] + dy * up[i]) * k;
}
/** What a tap at (x, y) on the plate opens: a well's name (its own text first), else the cell under the
 *  finger, else a well's 44 px box. */
function resolveTap(x, y) {
  const names = S.wells && S.labels;
  const inner = names ? labelAt(x, y, true) : null;
  if (inner) return { well: inner };
  const a = pickAt(x, y);
  if (a >= 0 && a < G.NA) return { cell: a };
  const outer = names ? labelAt(x, y, false) : null;
  return outer ? { well: outer } : {};
}
function tap(x, y) {
  G.hl = -1;
  // a card that must open under the finger (a plate too narrow for it to stand clear) takes no click for a
  // moment, so the click the lift makes never lands on its Zoom or Close key
  const card = $('readout'); card.style.pointerEvents = 'none'; setTimeout(() => { card.style.pointerEvents = ''; }, 350);
  const t = resolveTap(x, y), a = t.cell ?? -1;
  if (t.well) { selectWell(t.well, true, [x, y]); return; }
  if (a >= 0) {
    pick = a; cardMode = 'cell'; G.cardPt = [x, y]; refreshCard(); placeCard(); G.cardPt = null;   // the finger's spot counts for this placing only
    const p = propDef(S.prop);
    say(`${$('readout-where').textContent}. ${p.label} ${U.spokenUnits(cardFigure(p, a))} on ${U.spokenDate(model.frames[shown])}.`);
  } else closeCard();
  R.draw = true; kick();
}

// ---------------------------------------------------------------- the readout card
/** The selection's mark on the plate, padded by 10 px so its 18 px ring stays in view: the tapped
 *  cell's middle, or a well's head with its name over it (placeLabels draws the name 7 px left of the
 *  head, 16 px tall, 4 px above it); right after a tap, the spot the finger touched too. { l, t, r, b }
 *  in the plate's CSS px; null when nothing of it is on the plate. */
function markBox(withName = true) {
  const c = $('gl'), W = c.clientWidth, H = c.clientHeight, m = 10, on = (q) => q && q[0] >= 0 && q[1] >= 0 && q[0] <= W && q[1] <= H;
  let p = null, nameW = 0;
  if (cardMode === 'cell' && pick >= 0) { const w = cellWorld(pick); p = projectWorld(w[0], w[1], w[2]); }
  else if (cardMode === 'well' && S.well) {
    const i = model.wells.findIndex((w) => w.name === S.well);
    if (i >= 0) { p = project(G.wellHeads ? G.wellHeads[i] : model.wells[i].path[0]); nameW = withName && G.labelW ? G.labelW[i] : 0; }
  }
  const pts = [p, G.cardPt].filter(on);
  if (!pts.length) return null;
  const b = { l: Math.min(...pts.map((q) => q[0])) - m, t: Math.min(...pts.map((q) => q[1])) - m, r: Math.max(...pts.map((q) => q[0])) + m, b: Math.max(...pts.map((q) => q[1])) + m };
  if (nameW && on(p)) { b.l = Math.min(b.l, p[0] - 11); b.t = Math.min(b.t, p[1] - 24); b.r = Math.max(b.r, p[0] - 7 + nameW + 4); }
  return b;
}
/** Places the card (HOUSE 4.7, carried to a short plate). It goes to a corner of the room the keys and
 *  the ghost key leave, 6 px clear of their hits, never over the selection's mark: top-left, else
 *  bottom-left, else the right-hand side, top or bottom. Where the full form could not sit beside the
 *  mark wherever the mark fell (the sheet raised, a phone on its side), the card takes its compact form.
 *  What scrolls (the rows; in the compact form the figure's line and the rows) ends on a row's edge, at
 *  most 55 % of the plate with the sheet closed or in focus mode and half of it otherwise, with a
 *  --line-strong rule at its foot when more follow. fresh false (a new step, new units, the end of a
 *  turn or a flight) keeps the card where it is while that still fits. */
function placeCard(fresh = true) {
  const card = $('readout');
  R.card = 0;
  if (card.hidden) return;
  const plate = $('plate'), pr = plate.getBoundingClientRect(), W = plate.clientWidth, H = plate.clientHeight;
  const body = $('readout-body'), dl = $('readout-all'), was = G.cardAt;
  card.classList.remove('right');
  const L = parseFloat(getComputedStyle(card).left) || 8, Rm = parseFloat(getComputedStyle($('keys')).right) || 8;
  const T = focus ? $('focus-exit').offsetTop : 8, B = H - 8, cap = H * (S.sheet === 0 || focus ? 0.55 : 0.5);
  const keep = [];                    // the keys' and the ghost key's hits; the card's Close hit reaches 4 px over its top
  for (const e of [...$('keys').querySelectorAll('button'), $('focus-exit'), $('north')]) {
    if (e.hidden || e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect(), m = e.id == 'north' ? 4 : 6;
    if (r.width) keep.push({ l: r.left - pr.left - m, t: r.top - pr.top - m, r: r.right - pr.left + m, b: r.bottom - pr.top + m });
  }
  /** The free stretches of the column x0..x1, top to bottom, beside the keys and the mark. */
  const stretches = (x0, x1, mark) => {
    let free = [{ t: T, b: B }];
    const cut = (t, b) => { free = free.flatMap((s) => (b <= s.t || t >= s.b ? [s] : [{ t: s.t, b: Math.min(s.b, t) }, { t: Math.max(s.t, b), b: s.b }])).filter((s) => s.b - s.t > 1); };
    for (const k of keep) if (k.l < x1 && k.r > x0) cut(k.t, k.b);
    const by = mark && mark.l < x1 && mark.r > x0;
    if (by) cut(mark.t, mark.b);
    return free.map((s) => ({ ...s, below: !!by && s.t >= mark.b - 0.5 }));
  };
  /** The card in a form: its width, its fixed part, what scrolls and that region's row edges. */
  const measure = (compact) => {
    card.classList.toggle('compact', compact);
    for (const e of [body, dl]) { e.style.maxHeight = ''; e.classList.remove('more'); }
    const region = compact ? body : dl, rr = region.getBoundingClientRect(), cr = card.getBoundingClientRect(), cuts = [];
    if (compact) {
      const v = $('readout-number').parentElement.getBoundingClientRect(), s = $('readout-sub').getBoundingClientRect();
      cuts.push(s.top < v.bottom - 1 ? Math.max(v.bottom, s.bottom) - rr.top : v.bottom - rr.top, s.bottom - rr.top);
    }
    for (const e of dl.children) if (e.tagName === 'DD') cuts.push(e.getBoundingClientRect().bottom - rr.top);
    const first = cuts.length ? cuts[0] : 0;   // fractional px: a rounded height let a full card reach 1 px into the mark's margin
    return { compact, region, cw: cr.width, fixed: cr.height - rr.height, full: rr.height, cuts: cuts.filter((c) => c >= first - 0.01).sort((a, b) => a - b) };
  };
  const span = (f, right) => (right ? [W - Rm - f.cw, W - Rm] : [L, L + f.cw]);
  const need = (f, k) => f.fixed + (f.cuts.length ? f.cuts[Math.min(k, f.cuts.length) - 1] + 1 : f.full);
  // the form: the full one where it sits beside a cell's mark wherever that falls in the left-hand
  // column, so a plate shows one form whatever is tapped; else the compact one
  let f = measure(false);
  const room = Math.max(0, ...stretches(...span(f, false), null).map((s) => s.b - s.t));
  if (Math.min((room - 20) / 2, cap) < need(f, 2) || $('plate').classList.contains('narrow')) f = measure(true);
  const target = Math.min(f.fixed + f.full, cap), least = need(f, 1);
  const put = (right, align, y, h) => {
    card.classList.toggle('right', right);
    // the full form's rule under rows that continue carries a 4 px margin (.readout-all.more): counted,
    // so the card ends inside its room (2.2: it overshot by up to 4 px, onto a tapped cell's ring)
    const fits = h - f.fixed, room = fits - (f.compact ? 0 : 4);
    if (f.full > fits + 0.01) {
      let end = f.cuts.length ? f.cuts[0] : Math.max(0, room - 1);
      for (const c of f.cuts) if (c + 1 <= room + 0.01) end = c;
      f.region.style.maxHeight = `${Math.round((end + 1) * 100) / 100}px`; f.region.classList.add('more');   // border-box: the foot rule
    }
    // on a whole pixel, toward the room: down from a top edge, up from a bottom one
    card.style.top = `${align === 'top' ? Math.ceil(y) : Math.floor(y - card.getBoundingClientRect().height)}px`;
    G.cardAt = { compact: f.compact, right, align, y };
  };
  // a card that still fits where it is stays there
  if (!fresh && was && was.compact === f.compact) {
    for (const s of stretches(...span(f, was.right), markBox())) {
      if (was.align === 'top' && s.t <= was.y + 0.5 && s.b - was.y >= least) return put(was.right, 'top', was.y, Math.min(target, s.b - was.y));
      if (was.align === 'bottom' && s.b >= was.y - 0.5 && was.y - s.t >= least) return put(was.right, 'bottom', was.y, Math.min(target, was.y - s.t));
    }
  }
  // else the first stretch in the house's order that holds the whole card, else the tallest; a well
  // whose head and name leave no stretch tall enough keeps its head clear and lets the card take its name
  const marks = [markBox()];
  if (cardMode === 'well' && marks[0]) marks.push(markBox(false));
  let o = null;
  for (const mark of marks) {
    const all = [false, true].flatMap((right) => stretches(...span(f, right), mark).map((s) => ({ right, s, h: s.b - s.t })));
    o = all.find((q) => q.h >= target) || all.reduce((a, q) => (!a || q.h > a.h ? q : a), null);
    if (o && o.h >= least) break;
  }
  if (o) put(o.right, o.s.below ? 'bottom' : 'top', o.s.below ? o.s.b : o.s.t, Math.min(target, Math.max(least, o.h)));
  else put(false, 'top', T, target);
}
function closeCard() { cardMode = null; pick = -1; G.cardAt = null; $('readout').hidden = true; R.draw = true; R.labels = true; R.section = S.section.on; kick(); }
function cardFigure(p, a) {
  const v = cellValue(D, p.key, shown, a);
  if (category(p)) return U.tick(v);
  return U.valueWithUnit(p, v, units);
}
const CELL_DATED = [['SOIL', 'Oil saturation'], ['SWAT', 'Water saturation'], ['SGAS', 'Gas saturation'], ['PRESSURE', 'Pressure']];
const CELL_ROCK = [['DEPTH', 'Depth'], ['PORO', 'Porosity'], ['PERMX', 'Horizontal permeability'], ['PERMZ', 'Vertical permeability'], ['FIPNUM', 'Fluid-in-place region']];
const WELL_RATES = [['oil', 'Oil produced', false], ['water', 'Water produced', false], ['gas', 'Gas produced', true], ['winj', 'Water injected', false], ['ginj', 'Gas injected', true]];
// the rates the deck sets for a well from a report date on (model.json's targets, in targetsOrder), by role
const WELL_SET = [['Oil rate set', 0, false], ['Water rate set', 1, false], ['Gas rate set', 2, true], ['Injection rate set', 3, false]];
function cardRow(dl, label, value) {
  const dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = label; dd.textContent = value; dl.append(dt, dd);
  return dd;
}
function rule(dl) { const d = document.createElement('div'); d.className = 'rule'; dl.appendChild(d); }
const pdef = (key) => propDef(key) || { key, unit: { PRESSURE: 'bar', DEPTH: 'm', PERMX: 'mD', PERMZ: 'mD' }[key] || '', decimals: key === 'PORO' ? 3 : 2 };
/** Builds the card's rows once per selection; refreshCardValues() writes the dated values in place. */
function refreshCard() {
  const dl = $('readout-all'); dl.replaceChildren();
  G.cardDyn = [];
  if (cardMode === 'cell' && pick >= 0) {
    const a = pick, i = G.ijk[a * 3] + 1, j = G.ijk[a * 3 + 1] + 1, k = G.ijk[a * 3 + 2] + 1;
    $('readout-where').textContent = `Cell I ${i}, J ${j}, K ${k}, region ${regionOf(D, a)}`;
    for (const [key, label] of CELL_DATED) G.cardDyn.push([cardRow(dl, label, ''), () => U.valueWithUnit(pdef(key), cellValue(D, key, shown, a), units)]);
    rule(dl);
    for (const [key, label] of CELL_ROCK) {
      const v = cellValue(D, key, shown, a);
      cardRow(dl, label, key === 'FIPNUM' ? U.tick(Math.round(v)) : U.valueWithUnit(pdef(key), v, units));
    }
    $('readout-zoom').textContent = 'Zoom to cell';
  } else if (cardMode === 'well' && S.well) {
    const w = model.wells.find((x) => x.name === S.well); if (!w) { closeCard(); return; }
    $('readout-where').textContent = `Well ${w.name}`;
    const firstOn = w.state.findIndex((s) => s > 0), lastOn = w.state.length - 1 - [...w.state].reverse().findIndex((s) => s > 0);
    const roles = [...new Set(w.state.filter((s) => s > 0))].map((s) => ROLE[s]).join(', ');
    const ks = w.cells.map((c) => c[2]);
    G.cardDyn.push([cardRow(dl, 'Now', ''), () => DOING[w.state[shown] || 0]]);
    const sm = model.summary.wells[w.name] || {}, hs = (model.summary.history && model.summary.history.wells[w.name]) || {};
    // each rate the run simulated, and beside it the rate the field reported over the same interval (the
    // history the run is driven by)
    for (const [key, label, isGas] of WELL_RATES) {
      if (sm[key]) G.cardDyn.push([cardRow(dl, label, ''), () => (isGas ? U.gas : U.liquid)(sm[key][shown] || 0, units)]);
      if (hs[key]) G.cardDyn.push([cardRow(dl, `${label.split(' ')[0]} reported`, ''), () => (isGas ? U.gas : U.liquid)(hs[key][shown] || 0, units)]);
    }
    if (w.targets) {
      rule(dl);
      const inj = w.state.some((c) => c >= 2), set = WELL_SET.filter(([, i]) => (inj ? i === 3 : i < 3) || w.targets.some((t) => t[i] > 0));
      for (const [label, i, isGas] of set) G.cardDyn.push([cardRow(dl, label, ''), () => (isGas ? U.gas : U.liquid)((w.targets[shown] || [])[i] || 0, units)]);
    }
    rule(dl);
    cardRow(dl, 'Roles', roles || 'never opened');
    cardRow(dl, 'Completions', `${w.cells.length} cells, layers ${Math.min(...ks)} to ${Math.max(...ks)}`);
    if (firstOn >= 0) cardRow(dl, 'Open', `${U.month(model.frames[firstOn])} to ${U.month(model.frames[lastOn])}`);
    $('readout-zoom').textContent = 'Zoom to well';
  } else { closeCard(); return; }
  $('readout').hidden = false;
  R.section = S.section.on;   // the tapped cell's outline in the section
  refreshCardValues();
  R.card = Math.max(R.card, 1); kick();   // its rows changed: placed again on the next frame, where it is if it still fits
}
function refreshCardValues() {
  for (const [dd, fn] of G.cardDyn || []) { const t = fn(); if (dd.textContent !== t) dd.textContent = t; }
  const iso = model.frames[shown];
  if (cardMode === 'cell' && pick >= 0) {
    const p = propDef(S.prop), fig = cardFigure(p, pick), m = fig.match(/^(.*?) (\S+)$/);
    setText('readout-number', m && !category(p) ? m[1] : fig);
    setText('readout-unit', m && !category(p) ? ` ${m[2]}` : '');
    setText('readout-sub', isDynamic(p) ? `${p.label} on ${U.date(iso)}` : p.label);
  } else if (cardMode === 'well' && S.well) {
    const w = model.wells.find((x) => x.name === S.well), code = w.state[shown] || 0, sm = model.summary.wells[w.name] || {};
    const main = [null, ['oil', 'Oil produced', false], ['winj', 'Water injected', false], ['ginj', 'Gas injected', true]][code];
    if (main && sm[main[0]]) {
      const t = (main[2] ? U.gas : U.liquid)(sm[main[0]][shown] || 0, units), m = t.match(/^(.*?) (\S+)$/);
      setText('readout-number', m[1]); setText('readout-unit', ` ${m[2]}`);
      setText('readout-sub', `${main[1]} ${interval(shown)}`);   // the pipeline averages each rate over the interval to the date
    } else {
      // open in a role the summary holds no rate for (C-4H on 6 Nov 1997, F-4H on 1 Sep 2001): the
      // headline says what the well was doing, as the Now row does, and that no rate was reported
      setText('readout-number', code ? DOING[code] : w.firstOpen >= 0 && shown < w.firstOpen ? 'Not yet open' : 'Shut');
      setText('readout-unit', ''); setText('readout-sub', code ? `no rate reported ${interval(shown)}` : `on ${U.date(iso)}`);
    }
  }
}
function selectWell(name, open, pt) {
  S.well = name;
  $('well-pick').value = name && [...$('well-pick').options].some((o) => o.value === name) ? name : '';
  if (name && open) {
    cardMode = 'well'; pick = -1; G.cardPt = pt || null; refreshCard();
    placeCard(); G.cardPt = null;   // clear of the well's head and name, wherever it was chosen from
    say(`Well ${name}. ${U.spokenUnits($('readout-number').textContent + $('readout-unit').textContent)}, ${$('readout-sub').textContent}.`);
  } else if (!name && cardMode === 'well') closeCard();
  R.draw = true; R.chart = true; R.labels = true; save(); kick();
}

// ---------------------------------------------------------------- the rates chart
function frameT(f) { const d = G.days; return (d[f] - d[0]) / (d[d.length - 1] - d[0] || 1); }
function niceCeil(v) { if (v <= 0) return 1; const e = 10 ** Math.floor(Math.log10(v)), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
const SERIES = {
  liquid: [['oil', 'Oil produced', 'oil', false], ['water', 'Water produced', 'water', false], ['winj', 'Water injected', 'water', true]],
  gas: [['gas', 'Gas produced', 'gas', false], ['ginj', 'Gas injected', 'gas', true]],
};
function drawChart() {
  const svg = $('chart'), W = svg.clientWidth, H = svg.clientHeight || 140;
  if (!W) return;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren();
  const src = (S.well ? model.summary.wells[S.well] : model.summary.field) || {};
  const H0 = model.summary.history || {}, hist = (S.well ? (H0.wells || {})[S.well] : H0.field) || {};   // the reported rates, beside the simulated
  $('chart-title').textContent = S.well ? `${S.well} rates` : 'Field rates';
  const X = (f) => frameT(f) * W, key = $('chart-key');
  key.replaceChildren();
  const panels = [{ key: 'liquid', y0: 16, y1: H * 0.56, conv: U.liquidIn, unit: U.liquidUnit(units) }, { key: 'gas', y0: H * 0.56 + 18, y1: H * 0.86, conv: U.gasIn, unit: U.gasUnit(units) }];
  for (const pn of panels) {
    const list = SERIES[pn.key].filter(([k]) => src[k] && src[k].some((v) => v > 0));
    const hl = SERIES[pn.key].filter(([k]) => hist[k] && hist[k].some((v) => v > 0));
    const max = niceCeil(Math.max(0, ...list.flatMap(([k]) => src[k].map((v) => pn.conv(v, units))), ...hl.flatMap(([k]) => hist[k].map((v) => pn.conv(v, units)))));
    svg.append(svgEl('line', { class: 'grid', x1: 0, x2: W, y1: pn.y1, y2: pn.y1 }), svgEl('line', { class: 'grid', x1: 0, x2: W, y1: pn.y0, y2: pn.y0, 'stroke-dasharray': '2 3' }));
    const top = svgEl('text', { x: 2, y: pn.y0 - 3, class: 'top' });
    top.textContent = list.length ? U.withUnit(U.int(max), pn.unit) : (pn.key === 'gas' ? 'No gas flow' : 'No liquid flow');
    svg.append(top);
    const line = (vals, cls, label) => {
      const d = vals.map((v, f) => `${f ? 'L' : 'M'}${Math.round(X(f) * 10) / 10} ${Math.round((pn.y1 - (pn.conv(v, units) / max) * (pn.y1 - pn.y0)) * 10) / 10}`).join('');
      svg.append(svgEl('path', { class: cls, d }));
      const s = document.createElement('span'), sample = svgEl('svg', { viewBox: '0 0 14 4', width: '14', height: '4', 'aria-hidden': 'true' });
      sample.append(svgEl('path', { class: cls, d: 'M0 2h14' }));
      s.append(sample, document.createTextNode(label));
      key.appendChild(s);
    };
    for (const [k, label, cls, inj] of list) line(src[k], `ln ${cls}${inj ? ' inj' : ''}`, label);
    // reported: the same fluid's color, dotted (the dash says injected, the dots say reported)
    for (const [k, label, cls] of hl) line(hist[k], `ln ${cls} rep`, `${label.split(' ')[0]} reported`);
  }
  const y0 = +model.frames[0].slice(0, 4), y1 = +model.frames[G.nf - 1].slice(0, 4);
  for (let y = y0 + 1; y <= y1; y += 2) {
    const t = (U.dayNumber(`${y}-01-01`) - G.days[0]) / (G.days[G.nf - 1] - G.days[0]);
    if (t < 0.03 || t > 0.97) continue;
    const x = Math.round(t * W * 10) / 10, label = svgEl('text', { x, y: H - 2, 'text-anchor': 'middle' });
    label.textContent = String(y);
    svg.append(label, svgEl('line', { class: 'grid', x1: x, x2: x, y1: H * 0.86, y2: H * 0.9 }));
  }
  // the cursor runs under the panels' top labels, which carry a --page halo
  svg.insertBefore(svgEl('line', { id: 'chart-cursor', class: 'cursor', y1: 0, y2: H * 0.88 }), svg.querySelector('text.top'));
  svg.setAttribute('aria-label', `${S.well ? `${S.well}’s` : 'The field’s'} production and injection rates over the history, simulated and reported`);
  updateCursor();
}
function updateCursor() {
  const c = document.getElementById('chart-cursor'); if (!c || shown < 0) return;
  const x = frameT(shown) * ($('chart').clientWidth || 320);
  c.setAttribute('x1', x); c.setAttribute('x2', x);
}
function initChartSeek() {
  const svg = $('chart'); let active = false;
  const seek = (e) => {
    const r = svg.getBoundingClientRect(), t = (e.clientX - r.left) / r.width;
    let best = 0, bd = 9;
    for (let f = 0; f < G.nf; f++) { const d = Math.abs(frameT(f) - t); if (d < bd) { bd = d; best = f; } }
    wanted = best; kick();
  };
  svg.addEventListener('pointerdown', (e) => { active = true; stop(); svg.setPointerCapture(e.pointerId); seek(e); });
  svg.addEventListener('pointermove', (e) => { if (active) seek(e); });
  const end = () => { active = false; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------- the section A–A′ (js/section.js, js/seismic.js)
// A vertical plane along a line on the field: an inline or a crossline of the seismic survey (its own
// traces, plan 0012 D14), a line of the field's own through the grid (Along, Across, and the grid's rows
// and columns the sweep steps through), or one drawn on the 3D view. On it, bottom to top: the ground and
// its depth guides; the seismic at its own depths (js/seismic.js), from the cube as loaded; the gaps (no
// active cell); the cells, cut from geometry.bin as loaded, each one block in the 3D view's colors for
// the shown property and report date; the Hugin horizons; the wells within SEC_CORRIDOR of the plane;
// the tapped cell; the frame and its words. One depth axis (sectionAxis), meters below sea level, the
// seismic and the model each at its own depths as delivered: nothing is shifted, stretched or tied.
const SEC_CORRIDOR = 150;                       // meters either side of the plane: the wells drawn on it
const SEC_BOX = { l: 60, t: 15, r: 8, b: 15 };  // the plot's margins in the pane: the depth axis's title and words, A and A′, distances
const SEC_GRAB_MIN = 76;   // px: the model's shorter side on the plate below which its line's ends take no touch (80 px up: 22 % or less of its cells within an end's reach; 75 down: 21 to 70 %)
const SEC_MARGIN = 150;    // meters of seismic shown above the model's shallowest cut cell and below its deepest
const SURVEY = ['inline', 'crossline'];
const SHOWS = ['seismic', 'model', 'both'];
const SEC_REST = 150;      // ms with the finger up and nothing changed before the section is drawn in full again
const SEC = { geom: null, wells: [], ax: null, hatch: null, hatchKey: '', armed: false, drag: null, ends: null, cuts: new Map(), sweep: null, exag: 0, seis: null, seisKey: '', seisAt: undefined, viewKey: '', changed: 0 };
/** A drag on the pane's edge, a line or its end, or the sweep's slider is under way: the section shows its
 *  layers as last drawn, laid on anew, and the seismic from its own samples; the full drawing waits for rest. */
const moving = () => !!(SEC.drag || SEC.lockH || SEC.edgeDrag);
/** The section's canvas at the screen's own pixels (a phone's 2 or 3 a point; the 3D view keeps its 2). */
const secDpr = () => Math.min(window.devicePixelRatio || 1, 3);
const survey = () => SURVEY.includes(S.section.line);
const seisOn = () => S.seis.show !== 'model';
const cellsOn = () => S.seis.show !== 'seismic';
/** The line the section shows: a survey line, the field's own or the drawn one, or where the sweep took it
 *  (plan 0012 D14): one of the grid's own columns or rows, cut along its own path, or the drawn line moved
 *  parallel to itself. A slice's cut is kept (a few), so a sweep back and forth cuts each once. */
function secLine() {
  const q = S.section;
  if (survey()) { const l = surveyLine(G.sg, q.line, q.at); return { a: l.a, b: l.b }; }
  const l = q.line ? G.lines[q.line] : { a: q.a, b: q.b };
  if (q.at === null) return l;
  if (!q.line) { const h = shifts(G.cols, l.a, l.b), d = q.at * h.step; return { a: [l.a[0] + h.nx * d, l.a[1] + h.ny * d].map(Math.round), b: [l.b[0] + h.nx * d, l.b[1] + h.ny * d].map(Math.round) }; }
  const sec = sliceCut(sweepAxis(G.cols, l.a, l.b), q.at);
  return { a: sec.line.a, b: sec.line.b, path: sec.line.path, s: sec.line.s, L: sec.line.L, sec };
}
function sliceCut(axis, k) {
  const key = axis + k;
  let c = SEC.cuts.get(key);
  if (!c) {
    c = sliceSection(G.geom, G.NA, G.ijk, axis, k, null);
    c.wells = wellsNearPath(model.wells.map((w) => w.path), c.line, SEC_CORRIDOR);
    SEC.cuts.set(key, c);
    if (SEC.cuts.size > 24) SEC.cuts.delete(SEC.cuts.keys().next().value);
  }
  return c;
}
function secCut() {
  const l = secLine(), key = survey() ? S.section.line + S.section.at : '';   // a survey line's cut is kept as a slice's is
  let c = l.sec || SEC.cuts.get(key);
  if (!c) {
    c = cutGrid(G.geom, G.NA, G.ijk, l.a, l.b, null);
    c.wells = wellsNear(model.wells.map((w) => w.path), c.line, SEC_CORRIDOR);
    if (key) { SEC.cuts.set(key, c); if (SEC.cuts.size > 24) SEC.cuts.delete(SEC.cuts.keys().next().value); }
  }
  SEC.geom = c; SEC.wells = c.wells;
  SEC.hatchKey = ''; SEC.cutAt = S.section.at; SEC.cutLine = S.section.line;
  G.stats.secCuts = (G.stats.secCuts || 0) + 1; G.stats.secCutMs = (G.stats.secCutMs || 0) + SEC.geom.ms;
}
/** The sweep's places for the line as chosen, in order across the field: for a survey line, every inline
 *  or crossline of the cube; for a line of the field's own, every column (Along) or row (Across) of the
 *  grid that holds an active cell, with the line itself in its place among them; for a drawn line, steps
 *  of one slice either side of it over the field. */
function sweepOf() {
  const q = S.section, l = survey() ? null : q.line ? G.lines[q.line] : { a: q.a, b: q.b }, key = survey() ? q.line : `${q.line}|${l.a}|${l.b}`;
  if (SEC.sweep && SEC.sweep.key === key) return SEC.sweep;
  if (survey()) return (SEC.sweep = { key, axis: q.line === 'inline' ? 'IL' : 'XL', at: surveyNumbers(G.sg, q.line) });
  const axis = sweepAxis(G.cols, l.a, l.b), out = { key, axis, at: [] };
  if (q.line) {
    const list = slices(G.cols, axis), i = slot(G.cols, axis, list, l);
    out.at = list.map((v) => v.k); out.at.splice(i, 0, null);
  } else {
    const h = shifts(G.cols, l.a, l.b);
    for (let j = h.lo; j <= h.hi; j++) out.at.push(j || null);
    Object.assign(out, { step: h.step, bearing: (Math.atan2(h.nx, h.ny) * 180 / Math.PI + 360) % 360 });
  }
  return (SEC.sweep = out);
}
const COMPASS = [['north', 'N'], ['northeast', 'NE'], ['east', 'E'], ['southeast', 'SE'], ['south', 'S'], ['southwest', 'SW'], ['west', 'W'], ['northwest', 'NW']];
/** The sweep's place in words: [on the pane, spoken]. */
function sweepWords(w, at) {
  const q = S.section, word = w.axis === 'I' ? 'column' : 'row';
  if (survey()) return [`${w.axis} ${at}`, `${q.line} ${at}`];
  if (q.line && at !== null) return [`${w.axis} ${at}`, `${word} ${w.axis} ${at}`];
  if (q.line) { const i = w.at.indexOf(null), p = w.at[i - 1], n = w.at[i + 1]; return [q.line === 'along' ? 'Along' : 'Across', `the field’s own line, ${p && n ? `between ${word}s ${w.axis} ${p} and ${w.axis} ${n}` : `beyond ${word} ${w.axis} ${p || n}`}`]; }
  if (at === null) return ['Drawn', 'your line, as drawn'];
  const d = U.length(Math.abs(at) * w.step, units), b = COMPASS[Math.round(((w.bearing + (at < 0 ? 180 : 0)) % 360) / 45) % 8];
  return [`${d} ${b[1]}`, `your line, moved ${U.spokenUnits(d)} ${b[0]}`];
}
/** Shows or hides the section; the line it had is kept. */
function setSection(on, byKey) {
  S.section.on = !!on;
  SEC.lockH = false;
  if (!on) armDraw(false);
  applySection(); save();
  if (byKey) say(on ? `Section shown, ${secWords()}.` : 'Section hidden.');
}
function applySection() {
  const on = S.section.on;
  document.body.classList.toggle('sectioned', on);
  $('section').hidden = !on; $('secline').toggleAttribute('hidden', !on);   // an SVG element has no hidden property
  $('btn-section').setAttribute('aria-pressed', String(on));
  for (const b of $('sec-lines').querySelectorAll('[role="radio"]')) b.setAttribute('aria-checked', String(b.dataset.line === S.section.line));
  if (SEC.edge) SEC.edge.apply();
  R.secGeom = on; R.section = on; R.labels = true; R.draw = true; kick();
}
/** The inline and crossline numbers of the traces nearest a point on the line ([x, y] in model meters),
 *  or null off the cube. */
function endNumbers(p) {
  const [u, v] = uvOf(G.sg, p[0], p[1]);
  if (u < -0.5 || v < -0.5 || u > G.sg.nu - 0.5 || v > G.sg.nv - 0.5) return null;
  return [ilAt(G.sg, Math.round(u)), xlAt(G.sg, Math.round(v))];
}
function secWords() {
  const q = S.section, l = secLine(), L = SEC.geom ? SEC.geom.line.L : l.L || Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]);
  const where = q.at !== null ? sweepWords(sweepOf(), q.at)[1] : q.line === 'across' ? 'across the field' : q.line === 'along' ? 'along the field' : 'on your line';
  return `${where}, ${U.spokenUnits(U.length(L, units))} long`;
}
/** A new line, or a change to it; a line chosen or drawn anew starts the sweep from the line itself, and a
 *  survey line chosen anew is the one through the middle of the line shown before. */
function setLine(patch, final) {
  if (!('at' in patch) && ('line' in patch || 'a' in patch)) {
    if (SURVEY.includes(patch.line)) { const l = SEC.geom ? SEC.geom.line : null, m = l ? lineAt(l, l.L / 2) : [0, 0]; patch.at = nearestNumber(G.sg, patch.line, m[0], m[1]); }
    else patch.at = null;
  }
  Object.assign(S.section, patch);
  for (const b of $('sec-lines').querySelectorAll('[role="radio"]')) b.setAttribute('aria-checked', String(b.dataset.line === S.section.line));
  R.secGeom = true; R.labels = true; if (final) { SEC.drag = null; save(); }
  kick();
}
function armDraw(on) {
  SEC.armed = !!on;
  $('sec-draw').setAttribute('aria-pressed', String(SEC.armed));
  document.body.classList.toggle('drawing', SEC.armed);
}
/** A point on the plate on the field's top, in model meters [x, y, z]: where the ray from the eye
 *  through it first meets the reservoir's top surface; off the field, where it meets the level of the
 *  top's mean depth. The ray in the camera's own basis (the lens shift undone). */
function mapPoint(x, y) {
  if (!G.V || !S.cam) return null;
  const c = $('gl'), V = G.V, k = Math.tan(FOV / 2), asp = c.clientWidth / (c.clientHeight || 1);
  const u = ((x / c.clientWidth) * 2 - 1 - (S.cam.sx || 0)) * asp * k, v = (1 - (y / c.clientHeight) * 2 - (S.cam.sy || 0)) * k;
  const d = [0, 1, 2].map((i) => u * V[i * 4] + v * V[i * 4 + 1] - V[i * 4 + 2]), e = eye();
  // world (X, Y, Z) is model (x, -z * exag, -y)
  const o = [e[0], -e[2], -e[1] / S.exag], dm = [d[0], -d[2], -d[1] / S.exag];
  const hit = rayToTop(G.surf, o, dm);
  if (hit) return hit;
  if (Math.abs(dm[2]) < 1e-12) return null;
  const t = (G.surf.topMean - o[2]) / dm[2];
  return t > 0 ? [o[0] + dm[0] * t, o[1] + dm[1] * t, G.surf.topMean] : null;
}
/** The field's top under a map point, or the top's mean depth off the field. */
function topAt(x, y) { const z = surfAt(G.surf, 'top', x, y); return z === z ? z : G.surf.topMean; }
/** The line on the 3D view: laid on the field's top (off the field, at the top's level nearby), with a faint
 *  curtain down to the field's base where the line crosses the field: the plane the section shows. */
function placeSecLine() {
  const on = S.section.on && G.PV, svg = $('secline');
  if (!on) { SEC.ends = null; return; }
  const l = secLine(), N = 64, top = [], base = [], zt = [];
  const xy = (i) => (l.path ? lineAt(l, l.L * i / N) : [l.a[0] + (l.b[0] - l.a[0]) * i / N, l.a[1] + (l.b[1] - l.a[1]) * i / N]);
  for (let i = 0; i <= N; i++) zt.push(surfAt(G.surf, 'top', ...xy(i)));
  // off the field the line keeps the level of the field's top where it last was on it (between two
  // stretches over the field, the straight line between them), so it never drops off the field's edge
  const over = zt.map((z, i) => (z === z ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i <= N; i++) {
    if (zt[i] === zt[i]) continue;
    const p = over.filter((k) => k < i).pop(), n = over.find((k) => k > i);
    zt[i] = p === undefined && n === undefined ? G.surf.topMean : p === undefined ? zt[n] : n === undefined ? zt[p] : zt[p] + (zt[n] - zt[p]) * (i - p) / (n - p);
  }
  for (let i = 0; i <= N; i++) {
    const [x, y] = xy(i), zb = surfAt(G.surf, 'base', x, y);
    top.push(project([x, y, zt[i]]));
    base.push(zb === zb ? project([x, y, zb]) : null);
  }
  if (!top[0] || !top[N] || top.some((p) => !p)) { svg.style.display = 'none'; SEC.ends = null; return; }
  svg.style.display = '';
  const f = (p) => `${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`;
  let cur = '', i = 0;
  while (i <= N) {   // one closed piece per run of the line over the field
    if (!base[i]) { i++; continue; }
    let j = i; while (j + 1 <= N && base[j + 1]) j++;
    const run = [];
    for (let k = i; k <= j; k++) run.push(top[k]);
    for (let k = j; k >= i; k--) run.push(base[k]);
    cur += `M${run.map(f).join('L')}Z`;
    i = j + 1;
  }
  $('sl-curtain').setAttribute('d', cur);
  const line = `M${top.map(f).join('L')}`;
  for (const id of ['sl-halo', 'sl-line']) $(id).setAttribute('d', line);
  $('sl-a').setAttribute('transform', `translate(${f(top[0])})`);
  $('sl-b').setAttribute('transform', `translate(${f(top[N])})`);
  SEC.ends = [top[0], top[N]];
}
/** The model's box on the plate (CSS px): its corners and well heads, projected. */
function modelBox() {
  const q = fitPoints(), b = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < q.length; i += 3) { const p = projectWorld(q[i], q[i + 1], q[i + 2]); if (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); } }
  return b;
}
/** Which end of the line a touch at (x, y) on the plate takes: 'a', 'b' or null (22 px). Where the model
 *  is drawn small (the strip a tall pane leaves it), the ends' hits would cover most of it and a turn
 *  would take an end instead: there no end is taken, one finger always turns, and Draw draws a new line.
 *  A survey line's ends are the survey's, so they take no touch either: Draw draws a line of your own. */
function secHandle(x, y) {
  if (!S.section.on || !SEC.ends || survey()) return null;
  const m = modelBox();
  if (Math.min(m[2] - m[0], m[3] - m[1]) < SEC_GRAB_MIN) return null;
  const d = SEC.ends.map((p) => Math.hypot(p[0] - x, p[1] - y));
  return d[0] <= 22 && d[0] <= d[1] ? 'a' : d[1] <= 22 ? 'b' : null;
}
function secStyle() {
  return { ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), line: css('--line'), strong: css('--line-strong'), page: css('--plate'), halo: css('--plate-halo') };
}
/** The depths the section shows, in z (model meters): with the seismic shown, the cut's own range (the
 *  field's, where the line cuts no cell) and SEC_MARGIN above and below it, inside the cube's depths;
 *  with the model alone, null (sectionAxis pads the cut's range). */
function secWindow(sec) {
  if (!seisOn()) return null;
  const g = G.sg, dz = model.center[2], [d0, d1] = model.static.ranges.DEPTH;
  const lo = sec.n ? sec.z0 : d0 - dz, hi = sec.n ? sec.z1 : d1 - dz;
  return { top: Math.max(g.z0 - dz, lo - SEC_MARGIN), bot: Math.min(g.z0 + (g.nz - 1) * g.dz - dz, hi + SEC_MARGIN) };
}
/** The plot's height the section needs at this plot width (under the model), before --sec-h caps it. */
function secNeed(bw) { return Math.max(70, Math.ceil(sectionAxis(SEC.geom, { x: 0, y: 0, w: bw, h: 1e9 }, S.exag, 0, secWindow(SEC.geom)).y1) + SEC_BOX.t + SEC_BOX.b); }
/** The section's cut and the pane's fit, before the 3D view draws: under the 3D view the compact pane is
 *  as tall as the section needs at this width, up to its cap (--sec-h), so a long, flat section leaves the
 *  rest to the model; held while a line is drawn or swept, and set in the frame that draws at it, so
 *  neither canvas is ever shown stretched. */
function fitSection() {
  if (!S.section.on || !model) return;
  if (R.secGeom || !SEC.geom) { secCut(); R.secGeom = false; R.section = true; writeSecWords(); writeSweep(); }
  const cv = $('sec-plot'), under = getComputedStyle($('view')).flexDirection === 'column';
  $('sec-sweep').parentNode.classList.toggle('narrow', cv.clientWidth < 284);   // the sweep's row: ‹ › 88, the slider 140, the word 64, less its 8 px reach
  if (SEC.drag || SEC.lockH) return;
  const want = under ? `${secNeed(Math.max(40, cv.clientWidth - SEC_BOX.l - SEC_BOX.r))}px` : '';
  if (cv.style.height !== want) { cv.style.height = want; R.draw = true; R.labels = true; R.card = Math.max(R.card, 1); }
}
/** The seismic along the section as one image at the canvas's own pixels (js/seismic.js): each column a
 *  point (or, where columns outrun the traces, points across its width) on the line, bilinear between the
 *  four traces around it; each row a depth, a windowed sinc between the samples; the amplitude times the
 *  gain over the clip, through the chosen ramp. Drawn 1:1, so nothing resamples it again. Made at rest only,
 *  a few columns a frame (seisStep), so it never holds the page; the newest place always wins. */
function seisJob(ax, dpr, sk, lk, dk) {
  const l = SEC.geom.line, g = G.sg;
  const x0 = Math.round(ax.x0 * dpr), x1 = Math.round(ax.x1 * dpr), y0 = Math.round(ax.y0 * dpr), y1 = Math.round(ax.y1 * dpr);
  const cols = Math.max(1, x1 - x0), rows = Math.max(1, y1 - y0);
  const ds = 1 / (dpr * ax.sx), k = ds > g.spacing / 2 ? Math.ceil(ds / (g.spacing / 2)) : 1;
  const sAt = (c, j) => Math.max(0, Math.min(l.L, ax.S((x0 + c + (j + 0.5) / k) / dpr)));
  const depths = new Float64Array(rows);
  for (let r = 0; r < rows; r++) depths[r] = ax.Z((y0 + r + 0.5) / dpr) + ax.datum;
  return { sk, lk, dk, ax, dpr, x0, y0, cols, rows, k, pts: (c) => Array.from({ length: k }, (_, j) => lineAt(l, sAt(c, j))), depths, rp: null, cp: { taps: new Array(cols), inside: new Uint8Array(cols) }, px: new Uint8ClampedArray(cols * rows * 4), cache: new Map(), c: 0, ms: 0, lut: ramp(stopsOf(S.seis.colors)), gain: 2 ** S.seis.gain };
}
/** Up to budget ms of a job's columns; the image once its last column is in. */
function seisStep(j, budget) {
  const t0 = performance.now(), g = G.sg;
  if (!j.rp) j.rp = rowPlan(g, j.depths, 1 / (j.dpr * j.ax.sz));
  while (j.c < j.cols && performance.now() - t0 < budget) {
    const c1 = Math.min(j.cols, j.c + 12);
    colPlan(g, j.cols, j.pts, j.c, c1, j.cp);
    renderCols(g, G.seis, j.cp, j.rp, j.lut, j.gain, j.cols, j.rows, j.px, j.c, c1, j.cache);
    j.c = c1;
  }
  j.ms += performance.now() - t0; G.stats.seisSlices = (G.stats.seisSlices || 0) + 1;
  if (j.c < j.cols) return null;
  const c = mkCanvas(j.cols, j.rows);
  c.getContext('2d').putImageData(new ImageData(j.px, j.cols, j.rows), 0, 0);
  let inside = 0; for (const v of j.cp.inside) inside += v;
  return Object.assign(c, { x0: j.x0, y0: j.y0, cols: j.cols, rows: j.rows, ms: j.ms, traces: j.cache.size, inside, k: j.k, fc: j.rp.fc, sk: j.sk, lk: j.lk, dk: j.dk, at: j.ax, ox: j.x0, oy: j.y0, pk: j.dpr });
}
/** The frame's share of the full seismic, at rest; never while the view moves. */
function seisWork() {
  const j = SEC.job;
  R.seisWork = false;
  if (!j || moving() || !S.section.on) return;
  const img = seisStep(j, 6);
  if (!img) { R.seisWork = true; return; }
  SEC.job = null; SEC.seis = img; R.section = true;
  G.stats.seisRenders = (G.stats.seisRenders || 0) + 1; G.stats.seisMs = (G.stats.seisMs || 0) + img.ms;
}
/** The seismic from its own samples, as the screen shows it while the view moves (D11's variable-density
 *  display): a column every trace spacing along the line, bilinear between the four traces around it (on a
 *  survey line, its own traces), and a row for each 5 m sample at its own depth; no supersampling and no sinc.
 *  The canvas lays it on the plot with its own bilinear filtering (relay). */
function seisPreview(ax, lk, dk) {
  const l = SEC.geom.line, g = G.sg, n = Math.max(2, Math.round(l.L / g.spacing) + 1), ds = l.L / (n - 1);
  const k0 = Math.max(0, Math.floor((ax.zTop + ax.datum - g.z0) / g.dz)), k1 = Math.min(g.nz - 1, Math.ceil((ax.zBot + ax.datum - g.z0) / g.dz)), rows = Math.max(1, k1 - k0 + 1);
  const cp = colPlan(g, n, (c) => [lineAt(l, c * ds)]), rp = { start: Int32Array.from({ length: rows }, (_, r) => k0 + r), n: new Uint8Array(rows).fill(1), w: new Float32Array(rows).fill(1), width: 1 };
  const out = render(g, G.seis, cp, rp, ramp(stopsOf(S.seis.colors)), 2 ** S.seis.gain, n, rows), c = mkCanvas(n, rows);
  c.getContext('2d').putImageData(new ImageData(out.px, n, rows), 0, 0);
  let inside = 0; for (const v of cp.inside) inside += v;
  G.stats.seisPreviews = (G.stats.seisPreviews || 0) + 1;
  return Object.assign(c, { lk, dk, inside, ox: 0, oy: 0, pk: 1, at: { x0: 0.5, sx: 1 / ds, y0: 0.5, sz: 1 / g.dz, zTop: g.z0 + k0 * g.dz - ax.datum } });
}
/** A layer drawn under one axis (img.at, img.pk px a CSS px, from device px img.ox, img.oy) laid on the plot
 *  under another (ax), by the section's own coordinates (distance along the line and depth), scaled and
 *  smoothed by the canvas. */
function relay(x, img, ax, dpr) {
  const at = img.at, a = ax.sx / at.sx, c = ax.sz / at.sz, b = ax.x0 - at.x0 * a, d = ax.y0 + (at.zTop - ax.zTop) * ax.sz - at.y0 * c;
  x.save(); x.setTransform(dpr * a, 0, 0, dpr * c, dpr * b, dpr * d); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(img, img.ox / img.pk, img.oy / img.pk, img.width / img.pk, img.height / img.pk);
  x.restore();
}
/** The Hugin top or base along the section, as runs of [x, y] on the plot (CSS px): the interpretation's
 *  depths at the line's points every 3 px and at A′, bilinear on its grid, broken where it has no pick. */
function horizonRuns(ax, which) {
  const l = SEC.geom.line, runs = [];
  let cur = null;
  for (let k = 0, n = Math.ceil((ax.x1 - ax.x0) / 3 - 1e-6); k <= n; k++) {
    const X = Math.min(ax.x0 + 3 * k, ax.x1), s = Math.min(l.L, ax.S(X)), p = lineAt(l, s), d = horizonAt(G.sg, G.hz, which, p[0], p[1]);
    if (d !== d) { cur = null; continue; }
    if (!cur) runs.push(cur = []);
    cur.push([X, ax.Y(d - ax.datum)]);
  }
  return runs.filter((r) => r.length > 1);
}
const SEC_AF = '650 11.5px "Ysabeau Office", system-ui, sans-serif', SEC_EF = '400 10.5px "Ysabeau Office", system-ui, sans-serif';
/** The section's frame, laid out before it is drawn: the depth ticks, the depth axis's title and the ends'
 *  numbers (en, null at an end off the cropped cube). With key (from secKeys), the numbers go in that key
 *  beside the plot's right end. plan: the words to draw and their boxes, or null where they find no room. */
function secFrame(x, ax, box, W, H, en, key) {
  const dt = depthTicks(ax, units, H < 150 ? 2 : Math.max(3, Math.round(H / 75)));
  // the depth axis's one title, along it: the unit and the datum, on one line or, where the axis is short,
  // two; where even two outrun the axis, the title runs past its ends along the canvas's own height, and
  // where that is too short, a shorter two that still name the datum. Measured first, so the end words
  // keep clear of it.
  x.font = SEC_EF;
  const u = units === 'US' ? 'ft' : 'm', axLen = ax.y1 - ax.y0 + 8, cvLen = H - 4;
  const tForms = [[`Depth, ${u} below mean sea level`], [`Depth, ${u} below`, 'mean sea level'], [`${u} below`, 'mean sea level'], [`${u} below`, 'sea level']];
  const tLen = (f) => Math.max(...f.map((t) => x.measureText(t).width));
  const tForm = tForms.slice(0, 2).find((f) => tLen(f) <= axLen) || tForms.slice(1).find((f) => tLen(f) <= cvLen) || tForms[3];
  const tl = tLen(tForm), tc = Math.min(Math.max((ax.y0 + ax.y1) / 2, 2 + tl / 2), H - 2 - tl / 2);
  const titleBox = [0, tc - tl / 2 - 2, tForm.length > 1 ? 26 : 15, tc + tl / 2 + 2];
  x.font = SEC_AF; const wa = x.measureText('A').width + 5, wb = x.measureText('A′').width + 5;
  const taken = [[ax.x0 - 2, box.y - 15, ax.x0 + 12, box.y], [ax.x1 - 14, box.y - 15, ax.x1 + 2, box.y]];
  x.font = SEC_EF;
  const out = { dt, tForm, tc, taken, plan: null };
  if (key) {   // A's row or rows over A′'s, each led by its letter, level with the letters at the plot's top
    const left = ax.x1 + 14, items = [], r = [left - 2, box.y - 15, left + key.w + 2, box.y + 12 * (key.rows.length - 1)];
    if (r[2] > W - 2 || r[3] > H) return out;
    key.rows.forEach((row, k) => {
      const y = box.y - 3 + 12 * k;
      if (row.letter) items.push({ t: row.letter, x: left, y, al: 'left', font: SEC_AF, col: 'ink' });
      items.push({ t: row.t, x: left + key.lw, y, al: 'left', font: SEC_EF, col: 'ink2' });
    });
    out.plan = { items, rects: [r], text: key.text, form: 'key' };
    return out;
  }
  // by A and A′, the inline and crossline of the traces nearest the ends: both numbers, by A and A′ inside
  // the plot or outside it in the canvas's margin; on a survey line the one that changes along it (the
  // other is the sweep's word); or both stacked, IL over XL, in the margin or beside the letter with the
  // second line just inside the plot, on a halo. An end off the cropped cube has no trace and no numbers.
  const hit = (r, list) => list.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
  const block = [titleBox, ...dt.map((t) => { const w = x.measureText(t.text).width; return [ax.x0 - 6 - w - 2, t.y - 7, ax.x0, t.y + 7]; })];
  // one end's words at a place: 'in' beside its letter (a second line under the first, inside the plot), 'out'
  // beyond the plot's end in the canvas's margin; an end with no numbers takes none and no room
  const NONE = { items: [], r: null, text: '' };
  const lay = (end, lines, how) => {
    if (!lines) return NONE;
    const ws = lines.map((t) => x.measureText(t).width), wmax = Math.max(...ws);
    const left = end === 0 ? (how === 'in' ? ax.x0 + wa : ax.x0 - 4 - wmax) : (how === 'in' ? ax.x1 - wb - wmax : ax.x1 + 4);
    const al = (end === 0) === (how === 'in') ? 'left' : 'right';
    const items = lines.map((t, k) => ({ t, x: al === 'left' ? left : left + wmax, al, y: box.y - 3 + 12 * k, font: SEC_EF, col: 'ink2', halo: how === 'in' && k > 0 }));
    const r = [left - 2, box.y - 15, left + wmax + 2, box.y + 12 * (lines.length - 1)];
    if (r[0] < 2 || r[2] > W - 2 || r[3] > H) return null;
    if (how === 'in' && (end === 0 ? r[2] > ax.x1 - wb - 10 : r[0] < ax.x0 + wa + 10)) return null;   // 10 px clear of the other end's letter, so each reads as its own
    if (hit(r, block)) return null;
    return { items, r, text: lines.join(', ') };
  };
  const forms = [{ form: 'one line', lines: en.map((n) => (n ? [`IL ${n[0]}, XL ${n[1]}`] : null)), hows: ['in', 'out'] }];
  if (survey()) forms.push({ form: 'the changing number', lines: en.map((n) => (n ? [S.section.line === 'inline' ? `XL ${n[1]}` : `IL ${n[0]}`] : null)), hows: ['in', 'out'] });
  forms.push({ form: 'stacked', lines: en.map((n) => (n ? [`IL ${n[0]}`, `XL ${n[1]}`] : null)), hows: ['out', 'in'] });
  if (!en[0] && !en[1]) return out;
  for (const f of forms) for (const h0 of f.hows) for (const h1 of f.hows) {
    const a = lay(0, f.lines[0], h0), b = lay(1, f.lines[1], h1);
    if (!a || !b || (a.r && b.r && hit([a.r[0], a.r[1], a.r[2] + 10, a.r[3]], [b.r]))) continue;
    out.plan = { items: [...a.items, ...b.items], rects: [a.r, b.r].filter(Boolean), text: [a.text, b.text], form: `${f.form}, ${h0} and ${h1}` };
    return out;
  }
  return out;
}
/** The ends' numbers as a key (secFrame): A's over A′'s, a row each or IL over XL, each led by its letter. */
function secKeys(x, en) {
  x.font = SEC_AF; const lw = x.measureText('A′').width + 5;
  x.font = SEC_EF;
  const text = en.map((n) => (n ? `IL ${n[0]}, XL ${n[1]}` : ''));
  return [false, true].map((two) => {
    const rows = [];
    en.forEach((n, i) => { if (n) rows.push(...(two ? [{ letter: i ? 'A′' : 'A', t: `IL ${n[0]}` }, { letter: '', t: `XL ${n[1]}` }] : [{ letter: i ? 'A′' : 'A', t: text[i] }])); });
    return { rows, lw, w: lw + Math.max(0, ...rows.map((r) => x.measureText(r.t).width)), text };
  }).filter((k) => k.rows.length);
}
/** The section, drawn: in the frame that draws the date, after the color pass. */
function drawSection() {
  R.section = false;
  if (!S.section.on || !model) { R.secGeom = false; return; }
  if (R.secGeom || !SEC.geom) fitSection();
  const t0 = performance.now(), cv = $('sec-plot'), W = cv.clientWidth, H = cv.clientHeight;
  if (!W || !H) return;
  const dpr = secDpr(), cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  const sec = SEC.geom, st = secStyle(), x = cv.getContext('2d'), seis = seisOn(), cells = cellsOn();
  const bw = Math.max(40, W - SEC_BOX.l - SEC_BOX.r);
  const box = { x: SEC_BOX.l, y: SEC_BOX.t, w: bw, h: Math.max(30, H - SEC_BOX.t - SEC_BOX.b) }, win = secWindow(sec);
  // a pane made taller than compact fills with the section, at a stretch of its own that it states (D13)
  const ex = SEC.edgeDrag && SEC.exag ? SEC.exag : $('section').classList.contains('grown') ? ownExag(sec, box, S.exag, win) : S.exag;   // held while the edge is dragged (it steps between round figures)
  if (ex !== SEC.exag) { SEC.exag = ex; writeSecWords(); }
  // the frame's words laid out first: numbers with no room by either end go in a key right of the plot, moved for it
  const en = SEC.endNums = [endNumbers(lineAt(sec.line, 0)), endNumbers(lineAt(sec.line, sec.line.L))];
  let ax = sectionAxis(sec, box, ex, model.center[2], win), fr = secFrame(x, ax, box, W, H, en);
  if (!fr.plan && (en[0] || en[1])) {
    let best = null;
    for (const k of secKeys(x, en)) {
      if (box.w - k.w - 16 < 40) continue;
      const a2 = sectionAxis(sec, { ...box, w: box.w - k.w - 16 }, ex, model.center[2], win), f2 = secFrame(x, a2, box, W, H, en, k);
      if (f2.plan && (!best || a2.sx > best[0].sx * 1.001)) best = [a2, f2];
    }
    if (best) [ax, fr] = best;
  }
  SEC.ax = ax;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  x.font = '400 10.5px "Ysabeau Office", system-ui, sans-serif';
  // the seismic, at the canvas's own pixels, kept while the line, the plot, the gain and the ramp stay (a new
  // report date redraws the cells over it, never the seismic); while the view moves, the last full image laid
  // on anew (the same line) or the line's own samples (a new one); in full again at rest
  const lk = [S.section.line, S.section.at, sec.line.a, sec.line.b, sec.line.L].join('|'), dk = [S.seis.gain, S.seis.colors, dark.matches].join('|');
  const sk = [lk, dpr, ax.x0, ax.y0, ax.sx, ax.sz, ax.zTop, dk].join('|'), now = performance.now();
  if (SEC.viewKey !== sk) { SEC.viewKey = sk; SEC.changed = now; }
  const still = !moving() && now - SEC.changed >= SEC_REST, full = SEC.seis;
  let img = null;
  if (seis) {
    img = full && full.sk === sk ? full : full && full.lk === lk && full.dk === dk ? full : SEC.prev && SEC.prev.lk === lk && SEC.prev.dk === dk && SEC.prev.zt === ax.zTop ? SEC.prev : (SEC.prev = Object.assign(seisPreview(ax, lk, dk), { zt: ax.zTop }));
    if (img !== full || full.sk !== sk) {
      if (still) { if (!SEC.job || SEC.job.sk !== sk) SEC.job = seisJob(ax, dpr, sk, lk, dk); R.seisWork = true; }
      else SEC.job = null;
    }
  }
  const seen = seis && img && img.inside > 0;
  if (seen !== SEC.seen) { SEC.seen = seen; writeSecWords(); }   // the plot's spoken label says whether the line meets the seismic
  // not all in full yet with the finger up, but less than SEC_REST ago: the frame after it
  const later = () => { if (!SEC.full && !moving() && !still) { clearTimeout(SEC.restT); SEC.restT = setTimeout(() => { R.section = true; kick(); }, SEC_REST + SEC.changed - now + 1); } };
  SEC.full = !(seis && img.sk !== sk);
  if (!sec.n && !seen) {   // a line off the field and the cube cuts nothing: no axis to print, one line in the pane
    for (const id of ['sec-key-gap', 'sec-key-seis']) $(id).hidden = true;   // the horizons are named in the plot itself
    x.fillStyle = st.ink2; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '400 13.5px "Ysabeau Office", system-ui, sans-serif';
    x.fillText(seis ? 'This line misses the field and the seismic.' : 'This line misses the field.', W / 2, H / 2);
    SEC.endWords = ['', '']; SEC.endForm = null; SEC.hzNamed = []; SEC.hzBoxes = [];
    G.secStep = G.texStep; SEC.drawnAt = SEC.cutAt; SEC.seisAt = SEC.cutAt; later(); return;
  }
  // the ground: depth guides across the plot, under everything; with the seismic over them, ticks at its edge
  const dt = fr.dt;
  x.strokeStyle = st.line; x.lineWidth = 1; x.beginPath();
  for (const t of dt) { const y = Math.round(t.y) + 0.5; x.moveTo(ax.x0, y); x.lineTo(ax.x1, y); }
  x.stroke();
  $('sec-key-seis').hidden = !seen;
  if (seen) {
    if (img.sk === sk) { x.imageSmoothingEnabled = false; x.drawImage(img, img.x0 / dpr, img.y0 / dpr, img.cols / dpr, img.rows / dpr); }
    else {   // where the full image would lie, in whole device px
      const X0 = Math.round(ax.x0 * dpr) / dpr, Y0 = Math.round(ax.y0 * dpr) / dpr;
      x.save(); x.beginPath(); x.rect(X0, Y0, Math.round(ax.x1 * dpr) / dpr - X0, Math.round(ax.y1 * dpr) / dpr - Y0); x.clip(); relay(x, img, ax, dpr); x.restore();
    }
    x.strokeStyle = st.strong; x.beginPath();
    for (const t of dt) { const y = Math.round(t.y) + 0.5; x.moveTo(ax.x0 - 4, y); x.lineTo(ax.x0, y); }
    x.stroke();
  }
  SEC.seisAt = seen ? SEC.cutAt : null;
  // the gaps and the cells (where the model is shown), then the Hugin horizons; the gaps and the outline are
  // drawn afresh at rest only, and laid on anew while the view moves on the same line (on a new one, left off)
  const hk = [W, H, dpr, ex, lk, ax.zTop, ax.x0, ax.y0, ax.sx, st.ink3, st.line].join('|'), lay = (l) => { const a = { at: ax, pk: dpr, ox: 0, oy: 0, lk }; return Object.assign(l, a); };
  if (cells && SEC.hatchKey !== hk && still) { const p = cutPath(sec, ax); SEC.hatch = lay(gapLayer(sec, ax, W, H, dpr, hexToRgb(st.ink3), mkCanvas, p)); SEC.rim = lay(rimLayer(sec, ax, W, H, dpr, st.strong, mkCanvas, p)); SEC.hatchKey = hk; }
  const hx = SEC.hatch && SEC.hatchKey === hk, hs = SEC.hatch && SEC.hatch.lk === lk;
  if (cells && hx) x.drawImage(SEC.hatch, 0, 0, W, H); else if (cells && hs) relay(x, SEC.hatch, ax, dpr);
  $('sec-key-gap').hidden = !(cells && SEC.hatch && SEC.hatch.gapPx / (dpr * dpr) >= 150);   // the gap's key only where a gap shows: 150 CSS px² or more
  let relaid = false;
  if (cells) {
    // the cells in a layer of their own, laid on at their cover (60 % over the seismic by default, whole
    // with the model alone), so a block's color is one alpha over the seismic however its edges fall; then
    // the cut's outline over them, whole at any cover
    let cl = SEC.cellLayer;
    const ck = [lk, G.colorsN, st.ink].join('|'), keep = relaid = !still && !!cl && cl.ck === ck;
    if (!keep) {
      if (!cl || cl.width !== cw || cl.height !== ch) cl = SEC.cellLayer = mkCanvas(cw, ch);
      const cx = cl.getContext('2d');
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cw, ch); cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCells(cx, ax, sec, G.colors, `rgba(${hexToRgb(st.ink)}, 0.28)`);
      Object.assign(lay(cl), { ck });
    }
    x.save(); x.globalAlpha = seis ? S.seis.cells / 100 : 1;
    if (keep) relay(x, cl, ax, dpr); else { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(cl, 0, 0); }
    x.globalAlpha = 1;
    if (hx) { x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(SEC.rim, 0, 0); } else if (hs) relay(x, SEC.rim, ax, dpr);
    x.restore();
  }
  SEC.full = SEC.full && !(cells && !hx) && !relaid;
  later();
  const hz = [0, 1].map((w) => horizonRuns(ax, w));
  x.save(); x.beginPath(); x.rect(ax.x0, box.y, ax.x1 - ax.x0, box.h); x.clip();
  SEC.hz = hz;
  // the halo only over the seismic alone: over the cells it would pale the blocks the line crosses
  for (const [col, wd] of (cells ? [[st.ink, 1.25]] : [[st.halo, 3], [st.ink, 1.25]])) {
    x.strokeStyle = col; x.lineWidth = wd; x.setLineDash(wd > 2 ? [] : [5, 3]); x.lineJoin = 'round';
    x.beginPath();
    for (const runs of hz) for (const r of runs) { x.moveTo(r[0][0], r[0][1]); for (let k = 1; k < r.length; k++) x.lineTo(r[k][0], r[k][1]); }
    x.stroke();
  }
  x.setLineDash([]);
  // the wells within the corridor, as drawn in the 3D view: a casing, the role's core, injectors dashed
  const names = [];
  if (S.wells) for (const wn of SEC.wells) {
    const w = model.wells[wn.i], code = w.state[shown] || 0;
    if (!(w.firstOpen >= 0 && shown >= w.firstOpen)) continue;
    const c = wellColor(code);
    for (const [col, wd, a] of [[st.ink, code ? 4.5 : 3, 0.85], [`rgb(${c.join(',')})`, code ? 2.5 : 1.5, code ? 1 : 0.6]]) {
      x.strokeStyle = col; x.lineWidth = wd; x.globalAlpha = a; x.lineCap = 'butt'; x.lineJoin = 'round';
      x.setLineDash(code >= 2 ? [3, 2] : []);
      x.beginPath();
      for (const part of wn.parts) { x.moveTo(ax.X(part[0]), ax.Y(part[1])); for (let k = 2; k < part.length; k += 2) x.lineTo(ax.X(part[k]), ax.Y(part[k + 1])); }
      x.stroke();
    }
    x.setLineDash([]); x.globalAlpha = 1;
    let top = null;
    for (const part of wn.parts) for (let k = 0; k < part.length; k += 2) if (!top || part[k + 1] < top[1]) top = [part[k], part[k + 1]];
    names.push({ name: w.name, x: ax.X(top[0]), ty: ax.Y(top[1]), y: Math.max(box.y + 11, ax.Y(top[1]) - 3) });
  }
  x.restore();
  // the tapped cell
  const pi = cells && cardMode === 'cell' && pick >= 0 ? sec.cells.indexOf(pick) : -1;
  if (pi >= 0) drawOutline(x, ax, sec, pi, st.ink, st.halo);
  // the frame: the section's ends, A and A′ with the inline and crossline there, depth and distance words,
  // the depth axis's title, the horizons' and the wells' names
  x.strokeStyle = st.strong; x.lineWidth = 1; x.beginPath();
  for (const e of [ax.x0, ax.x1]) { const xe = Math.round(e) + 0.5; x.moveTo(xe, box.y - 2); x.lineTo(xe, box.y + box.h); }
  x.stroke();
  const halo = (t, X, Y, align, font, col) => {
    x.font = font; x.textAlign = align; x.lineJoin = 'round'; x.lineWidth = 3; x.strokeStyle = st.halo; x.strokeText(t, X, Y); x.fillStyle = col; x.fillText(t, X, Y);
  };
  x.textBaseline = 'alphabetic';
  const AF = SEC_AF, EF = SEC_EF;
  halo('A', ax.x0, box.y - 3, 'left', AF, st.ink);
  halo('A′', ax.x1, box.y - 3, 'right', AF, st.ink);
  // the ends' numbers, where secFrame laid them out (by the letters, or in the key beside the plot)
  const { tForm, tc, taken } = fr;
  SEC.endWords = fr.plan ? fr.plan.text : ['', '']; SEC.endForm = fr.plan ? fr.plan.form : null;
  if (fr.plan) {
    for (const o of fr.plan.items) {
      if (o.halo) halo(o.t, o.x, o.y, o.al, o.font, st[o.col]);
      else { x.font = o.font; x.fillStyle = st[o.col]; x.textAlign = o.al; x.fillText(o.t, o.x, o.y); }
    }
    taken.push(...fr.plan.rects);
  }
  x.fillStyle = st.ink2; x.textAlign = 'right'; x.textBaseline = 'middle'; x.font = EF;
  for (const t of dt) x.fillText(t.text, ax.x0 - 6, Math.round(t.y));   // beside the section, wherever it is centered
  x.save(); x.translate(0, tc); x.rotate(-Math.PI / 2); x.textAlign = 'center'; x.textBaseline = 'middle';
  if (tForm.length === 1) x.fillText(tForm[0], 0, 9); else { x.fillText(tForm[0], 0, 7); x.fillText(tForm[1], 0, 19); }
  x.restore();
  SEC.axisTitle = tForm;
  const xt = distanceTicks(ax, units, W < 300 ? 2 : Math.max(3, Math.round(W / 150))), yb = Math.min(H - 2, ax.y1 + 13);
  x.textBaseline = 'alphabetic';
  // the last tick carries the unit, so it always stands; where the words would touch, every other one gives
  // way (every third, …), so the axis stays even: a stride is kept only where the last tick falls on it and
  // nothing touches; else 0 at A and the last, 6 px apart (ending at, centered on or starting at its place), else the
  // last alone; no word runs left of A into the depth figures, or off the canvas
  const at = (t, al) => { const wdt = x.measureText(t.text).width, l = al === 'left' ? t.x : al === 'right' ? t.x - wdt : t.x - wdt / 2; return { t, al, l, r: l + wdt }; };
  const laid = xt.map((t, i) => at(t, i === 0 ? 'left' : i === xt.length - 1 ? 'right' : 'center'));
  const clear = (ks, gap = 8) => ks.every((k, i) => k.l >= ax.x0 - 1 && k.r <= W - 2 && (i === 0 || k.l >= ks[i - 1].r + gap) && !taken.some((q) => k.l < q[2] && k.r > q[0] && yb - 10 < q[3] && yb + 2 > q[1]));
  const lasts = xt.length ? ['right', 'center', 'left'].map((al) => at(xt[xt.length - 1], al)) : [];
  let kept = (laid.length > 1 && lasts.map((k) => [laid[0], k]).find((ks) => clear(ks, 6))) || [lasts.find((k) => clear([k])) || laid[laid.length - 1]].filter(Boolean);
  for (let s = 1; laid.length > 2 && s < laid.length - 1; s++) {
    if ((laid.length - 1) % s) continue;
    const ks = laid.filter((k, i) => i % s === 0);
    if (clear(ks)) { kept = ks; break; }
  }
  SEC.distWords = kept.map((k) => k.t.text);
  for (const k of kept) { x.textAlign = k.al; x.fillText(k.t.text, k.t.x, yb); }
  // names: the wells' over their paths, then the horizons'. Each tries its places in turn; a name that
  // would touch another, A or A′ tries the next. A well's name moved off its path's top gets a hairline
  // to it; a well left with no place is named in the key under the pane, never dropped.
  const place = (t, font, spots, anchor, occ, shift = Infinity) => {
    x.font = font;
    const w = x.measureText(t).width;
    for (const [l0, y] of spots) {
      const l = Math.min(Math.max(ax.x0 + 2, l0), ax.x1 - w - 2), r = [l - 2, y - 11, l + w + 2, y + 3];
      if (Math.abs(l - l0) > shift) continue;
      if (y < box.y + 9 || y > box.y + box.h - 1) continue;
      if (taken.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue;
      if (occ && occ(r)) continue;
      taken.push(r);
      if (anchor) {
        const px = Math.min(Math.max(anchor[0], r[0]), r[2]), py = Math.min(Math.max(anchor[1], r[1]), r[3]);
        if (Math.hypot(px - anchor[0], py - anchor[1]) > 6) { x.strokeStyle = st.ink2; x.lineWidth = 1; x.beginPath(); x.moveTo(anchor[0], anchor[1]); x.lineTo(px, py); x.stroke(); }
      }
      halo(t, l, y, 'left', font, st.ink);
      return true;
    }
    return false;
  };
  const WF = '560 10.5px "Ysabeau Office", system-ui, sans-serif', FF = '560 11.5px "Ysabeau Office", system-ui, sans-serif';
  const named = [], unnamed = [];
  for (const n of names) {
    x.font = WF;
    const w = x.measureText(n.name).width, spots = [[n.x - w / 2, n.y]];
    for (let k = 0; k < 4; k++) spots.push([n.x + 6, n.y + 13 * k], [n.x - 6 - w, n.y + 13 * k]);
    (place(n.name, WF, spots, [n.x, Math.max(box.y, n.ty)]) ? named : unnamed).push(n.name);
  }
  // the horizons' names keep off the model's cells and the wells' paths as well as off the other words: a
  // coarse mask of the plot (OCC px a square) marks each cut cell's box, where the cells are drawn, and
  // each well's path; a name with no clear place is left off (its dashes stay, and About says what they are)
  const OCC = 3, oc = Math.ceil(W / OCC), orows = Math.ceil(H / OCC), mask = new Uint8Array(oc * orows);
  const markBox = (a, b, c, d) => {
    const i0 = Math.max(0, Math.floor(a / OCC)), i1 = Math.min(oc - 1, Math.floor(c / OCC)), j0 = Math.max(0, Math.floor(b / OCC)), j1 = Math.min(orows - 1, Math.floor(d / OCC));
    for (let j = j0; j <= j1; j++) mask.fill(1, j * oc + i0, j * oc + i1 + 1);
  };
  if (cells) for (let i = 0; i < sec.n; i++) {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (let k = sec.offs[i]; k < sec.offs[i + 1]; k++) { const X = ax.X(sec.pts[k * 2]), Y = ax.Y(sec.pts[k * 2 + 1]); if (X < a) a = X; if (X > c) c = X; if (Y < b) b = Y; if (Y > d) d = Y; }
    markBox(a, b, c, d);
  }
  if (S.wells) for (const wn of SEC.wells) {
    const w = model.wells[wn.i];
    if (!(w.firstOpen >= 0 && shown >= w.firstOpen)) continue;
    for (const part of wn.parts) for (let k = 0; k < part.length; k += 2) {   // each point, and the segment to the next
      const X0 = ax.X(part[k]), Y0 = ax.Y(part[k + 1]), more = k + 3 < part.length;
      const X1 = more ? ax.X(part[k + 2]) : X0, Y1 = more ? ax.Y(part[k + 3]) : Y0, n = Math.max(1, Math.ceil(Math.hypot(X1 - X0, Y1 - Y0) / OCC));
      for (let m = 0; m <= n; m++) { const X = X0 + ((X1 - X0) * m) / n, Y = Y0 + ((Y1 - Y0) * m) / n; markBox(X - 3, Y - 3, X + 3, Y + 3); }
    }
  }
  const occupied = (r) => {
    const i0 = Math.max(0, Math.floor(r[0] / OCC)), i1 = Math.min(oc - 1, Math.floor(r[2] / OCC)), j0 = Math.max(0, Math.floor(r[1] / OCC)), j1 = Math.min(orows - 1, Math.floor(r[3] / OCC));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (mask[j * oc + i]) return true;
    return false;
  };
  // and by its own line: across the name its own dashes run beside it (within 20 px, not through it) and the
  // other's 3 px or more farther, never between; a place the plot's ends would push sideways is skipped, not moved
  const hzAt = (w, X) => {   // the line's y at X, between its own points; NaN off its runs
    for (const r of hz[w]) {
      if (X < r[0][0] || X > r[r.length - 1][0]) continue;
      let lo = 0, hi = r.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r[m][0] <= X) lo = m; else hi = m; }
      const [x0, y0] = r[lo], [x1, y1] = r[hi];
      return x1 === x0 ? y0 : y0 + ((y1 - y0) * (X - x0)) / (x1 - x0);
    }
    return NaN;
  };
  const byOwn = (r, w) => {
    const gap = (y) => (y < r[1] ? r[1] - y : y > r[3] ? y - r[3] : 0);
    for (let k = 0, n = Math.ceil((r[2] - r[0]) / 1.5); k <= n; k++) {
      const X = r[0] + ((r[2] - r[0]) * k) / n, yo = hzAt(w, X), yt = hzAt(1 - w, X);
      if (yo !== yo || (yo > r[1] + 2 && yo < r[3] - 2) || gap(yo) > 20) return false;
      if (yt === yt && gap(yt) < gap(yo) + 3) return false;
    }
    return true;
  };
  SEC.hzNamed = []; SEC.hzBoxes = [];
  const FR = [0.04, 0.5, 0.25, 0.75, 0.12, 0.2, 0.32, 0.4, 0.58, 0.66, 0.82, 0.9];
  hz.forEach((runs, which) => {
    const r = runs.slice().sort((p, q) => q.length - p.length)[0];
    if (!r) return;
    const name = which ? 'Hugin base' : 'Hugin top', at = (f) => r[Math.min(r.length - 1, Math.floor(f * (r.length - 1)))];
    x.font = FF;
    const w = x.measureText(name).width;
    // the top over its line first, the base under it first (away from the cells between); starting or ending at each point
    // set at the line's highest point across the name (over) or its lowest (under), so it hugs its line
    const side = (up) => FR.flatMap((f) => {
      const p = at(f);
      return [p[0] + 4, p[0] - 4 - w].map((l) => {
        let lo = Infinity, hi = -Infinity;
        for (let X = l - 2; X <= l + w + 2; X += 1.5) { const y = hzAt(which, X); if (y < lo) lo = y; if (y > hi) hi = y; }
        return [l, up ? lo - 4 : hi + 14];
      }).filter((q) => q[1] === q[1] && Math.abs(q[1]) < Infinity);
    });
    const over = side(true), under = side(false);
    if (place(name, FF, which ? under.concat(over) : over.concat(under), null, (q) => occupied(q) || !byOwn(q, which), 3)) { SEC.hzNamed.push(name); SEC.hzBoxes.push(taken[taken.length - 1]); }
  });
  SEC.named = named; SEC.unnamed = unnamed; SEC.taken = taken;   // the words' boxes on the plot
  const more = unnamed.length ? `, unlabeled: ${unnamed.join(', ')}` : '';
  if ($('sec-more').textContent !== more) $('sec-more').textContent = more;
  fitSeisKey();
  G.secStep = G.texStep; SEC.drawnAt = SEC.cutAt;
  G.stats.secDraws = (G.stats.secDraws || 0) + 1; G.stats.secMs = (G.stats.secMs || 0) + performance.now() - t0;
}
function hexToRgb(h) { return isHex(h) ? hex(h).join(', ') : (h.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).join(', '); }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
/** Which color a ramp gives positive amplitudes (its +1 end, config.json's last stop), in the light theme's
 *  maps or the dark's: 'dark' or 'bright' for a gray ramp, 'red' or 'blue' for a colored one. */
function positiveEnd(name, darkTheme) {
  const m = ((darkTheme && cfg.colormapsDark) || cfg.colormaps)[name] || cfg.colormaps[name], lo = hex(m[0]), hi = hex(m[m.length - 1]);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  if (Math.max(...hi) - Math.min(...hi) < 24 && Math.max(...lo) - Math.min(...lo) < 24) return lum(hi) < lum(lo) ? 'dark' : 'bright';
  return hi[0] > hi[2] ? 'red' : 'blue';
}
/** The polarity on screen, in About's words, from the ramps themselves. */
function polarityWords() {
  const gl = positiveEnd('seismicGray', false), gd = positiveEnd('seismicGray', true), rb = positiveEnd('seismicRedBlue', false), other = { dark: 'bright', bright: 'dark', red: 'blue', blue: 'red' };
  return `In gray, positive amplitudes are ${gl} and negative ones ${other[gl]} on a light page, ${gd === gl ? 'the same' : 'the reverse'} on a dark one; in red and blue, positive is ${rb} and negative ${other[rb]}.`;
}
/** The seismic's key under the pane: its ramp between the signed amplitudes at its ends (the clip over the
 *  gain), negative at the left, so the key says which end is positive. */
function writeSeisKey() {
  const st = stopsOf(S.seis.colors), amp = U.tick(Math.round((G.sg.clip / 2 ** S.seis.gain) * 1000) / 1000);
  $('sec-ramp').style.background = `linear-gradient(90deg, ${st.join(', ')})`;
  setText('sec-amp-lo', `${U.MINUS}${amp}`);
  setText('sec-amp', `+${amp}`);
  $('sec-key-seis').setAttribute('aria-label', `Seismic amplitude from minus ${amp} to plus ${amp}, positive ${positiveEnd(S.seis.colors, dark.matches)}`);
  SEC.keyFit = null; fitSeisKey();
}
/** Where the key's row is too narrow for the wells' word beside both signed ends, the left end keeps
 *  only its sign (− at the left of the ramp, +0.105 at its right), so the wells' word stays on the row. */
function fitSeisKey() {
  const k = $('sec-key'), fit = `${k.clientWidth}|${$('sec-amp').textContent}|${$('sec-more').textContent}`;
  if (SEC.keyFit === fit || !k.clientWidth) return;
  SEC.keyFit = fit;
  const amp = $('sec-amp').textContent.slice(1), lo = $('sec-amp-lo'), wl = $('sec-key-wells'), sk = $('sec-key-seis');
  lo.textContent = `${U.MINUS}${amp}`;
  if (!sk.hidden && !wl.hidden && wl.offsetTop > sk.offsetTop) lo.textContent = U.MINUS;
  SEC.keyCompact = lo.textContent === U.MINUS;
}
/** The pane's words that change with the line, the units or the stretch, and its description. */
function writeSecWords() {
  setText('sec-corridor', `Wells within ${U.length(SEC_CORRIDOR, units)}`);
  const ex = SEC.exag || S.exag;
  setText('sec-exag', `vertical ${U.times(ex)}`);
  if (!SEC.geom) return;
  const sec = SEC.geom, p = propDef(S.prop), win = secWindow(sec), dz = model.center[2];
  const wells = SEC.wells.map((w) => model.wells[w.i].name);
  if (!sec.n && !(seisOn() && SEC.seen)) { $('sec-plot').setAttribute('aria-label', `Section A to A prime, ${secWords()}: the line misses the field, so no cell is cut.`); return; }
  const ends = [endNumbers(lineAt(sec.line, 0)), endNumbers(lineAt(sec.line, sec.line.L))].map((n) => (n ? `inline ${n[0]}, crossline ${n[1]}` : 'off the survey'));
  const depth = (z) => U.spokenUnits(U.valueWithUnit({ unit: 'm' }, z + dz, units));
  const what = S.seis.show === 'seismic' ? 'the seismic' : S.seis.show === 'model' ? `the model's cells colored by ${p.label}` : `the seismic with the model's cells over it, colored by ${p.label}`;
  const range = win ? `from ${depth(win.top)} to ${depth(win.bot)} below sea level` : sec.n ? `from ${depth(sec.z0)} to ${depth(sec.z1)} below sea level` : '';
  $('sec-plot').setAttribute('aria-label', `Section A to A prime, ${secWords()}, from ${ends[0]} to ${ends[1]}: ${what}${cellsOn() ? `, ${sec.n} cells cut` : ''}, ${range}, depth stretched ${U.tick(Math.round(ex * 10) / 10)} times${ex !== S.exag ? `, more than the 3D view’s ${U.tick(Math.round(S.exag * 10) / 10)}` : ''}. ${wells.length ? `Wells within ${U.spokenUnits(U.length(SEC_CORRIDOR, units))}: ${wells.join(', ')}.` : 'No well comes within ' + U.spokenUnits(U.length(SEC_CORRIDOR, units)) + '.'}`);
}
/** The sweep's slider, its value in words, and the keys either side of it. */
function writeSweep() {
  const w = sweepOf(), q = S.section;
  if (!w.at.includes(q.at)) { q.at = survey() ? G.mid[q.line] : null; R.secGeom = true; kick(); }   // a place the saved state names that the grid or the cube has not
  const i = w.at.indexOf(q.at), el = $('sec-sweep'), [shownWord, spoken] = sweepWords(w, q.at);
  const unit = survey() ? q.line : q.line ? (w.axis === 'I' ? 'column' : 'row') : 'step';
  el.max = String(w.at.length - 1);
  if (+el.value !== i) el.value = String(i);
  el.style.setProperty('--p', `${(i / Math.max(1, w.at.length - 1)) * 100}%`);
  el.setAttribute('aria-valuetext', spoken);
  setText('sec-at', shownWord);
  $('sec-prev').disabled = i <= 0; $('sec-next').disabled = i >= w.at.length - 1;
  $('sec-prev').setAttribute('aria-label', `Previous ${unit}`); $('sec-next').setAttribute('aria-label', `Next ${unit}`);
}
/** The sweep to its i-th place; final once the finger is off (the pane may then fit the section again). */
function sweepTo(i, final) {
  const w = sweepOf();
  i = Math.max(0, Math.min(w.at.length - 1, i));
  if (w.at[i] !== S.section.at) { armDraw(false); S.section.at = w.at[i]; R.secGeom = true; R.labels = true; }
  SEC.lockH = !final;
  if (final) { R.section = true; save(); }
  writeSweep(); kick();
}
/** The section's display under More controls: what it shows, the gain, the cells' cover and the ramp. */
function writeSeisControls() {
  for (const b of $('sec-show').querySelectorAll('[role="radio"]')) b.setAttribute('aria-checked', String(b.dataset.show === S.seis.show));
  for (const b of $('sec-colors').querySelectorAll('[role="radio"]')) b.setAttribute('aria-checked', String(b.dataset.colors === S.seis.colors));
  const g = $('sec-gain'), c = $('sec-cells');
  if (+g.value !== S.seis.gain) g.value = String(S.seis.gain);
  if (+c.value !== S.seis.cells) c.value = String(S.seis.cells);
  setText('sec-gainv', U.times(2 ** S.seis.gain));
  setText('sec-cellsv', U.withUnit(U.int(S.seis.cells), '%'));
  g.setAttribute('aria-valuetext', `${U.tick(Math.round(2 ** S.seis.gain * 100) / 100)} times`);
  c.disabled = S.seis.show !== 'both';
  g.disabled = S.seis.show === 'model';
  for (const e of [g, c]) setSliderFill(e);
  writeSeisKey();
}
function initSection() {
  $('btn-section').addEventListener('click', (e) => setSection(!S.section.on, e.detail === 0));
  $('sec-close').addEventListener('click', (e) => { setSection(false, e.detail === 0); if (e.detail === 0) $('btn-section').focus(); });
  for (const b of $('sec-lines').querySelectorAll('[role="radio"]')) b.addEventListener('click', () => { armDraw(false); SEC.lockH = false; setLine({ line: b.dataset.line, a: null, b: null }, true); });
  radioKeys($('sec-lines'));
  { // the four words fade at the right while more lie past it, as the property words do
    const box = $('sec-lines'), fade = () => box.classList.toggle('more', box.scrollLeft + box.clientWidth < box.scrollWidth - 1);
    box.addEventListener('scroll', fade, { passive: true }); new ResizeObserver(fade).observe(box);
  }
  $('sec-draw').addEventListener('click', () => { armDraw(!SEC.armed); if (SEC.armed) say('Drag across the field to draw the section line.'); });
  const cv = $('sec-plot');
  let down = null;
  cv.addEventListener('pointerdown', (e) => { down = { x: e.offsetX, y: e.offsetY, t: performance.now() }; });
  cv.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.offsetX - down.x, e.offsetY - down.y) > 8 || !SEC.ax) { down = null; return; }
    down = null;
    const i = cellsOn() ? cellAt(SEC.geom, SEC.ax, e.offsetX, e.offsetY) : -1;
    if (i < 0) { if (cardMode === 'cell') closeCard(); return; }
    pick = SEC.geom.cells[i]; cardMode = 'cell'; G.hl = -1; refreshCard(); placeCard();
    const p = propDef(S.prop);
    say(`${$('readout-where').textContent}. ${p.label} ${U.spokenUnits(cardFigure(p, pick))} on ${U.spokenDate(model.frames[shown])}.`);
    R.draw = true; R.section = true; kick();
  });
  new ResizeObserver(() => { R.section = true; kick(); }).observe(cv);
  // the sweep (D14): the slider takes the newest place on every input, and the frame draws it, so a fast
  // scrub never queues a place already passed; the pane holds its height until the finger is off
  const sw = $('sec-sweep');
  sw.addEventListener('input', () => sweepTo(+sw.value, false));
  sw.addEventListener('change', () => sweepTo(+sw.value, true));
  for (const [id, d] of [['sec-prev', -1], ['sec-next', 1]]) $(id).addEventListener('click', () => { sweepTo(+sw.value + d, true); const t = sweepWords(sweepOf(), S.section.at)[1]; say(`${t[0].toUpperCase()}${t.slice(1)}.`); });
  // the display (More controls, Section): what it shows, the gain, the cells' cover, the ramp
  const after = () => { writeSeisControls(); writeSecWords(); R.secGeom = true; R.section = true; save(); kick(); };
  for (const b of $('sec-show').querySelectorAll('[role="radio"]')) b.addEventListener('click', () => { S.seis.show = b.dataset.show; after(); });
  for (const b of $('sec-colors').querySelectorAll('[role="radio"]')) b.addEventListener('click', () => { S.seis.colors = b.dataset.colors; after(); });
  radioKeys($('sec-show')); radioKeys($('sec-colors'));
  $('sec-gain').addEventListener('input', (e) => { S.seis.gain = +e.target.value; writeSeisControls(); R.section = true; save(); kick(); });
  $('sec-cells').addEventListener('input', (e) => { S.seis.cells = +e.target.value; writeSeisControls(); R.section = true; save(); kick(); });
  writeSeisControls();
  // the pane's edge (D13, js/pane.js): the model keeps 120 px under the pane, its keys in a row and the field
  // under them; beside it, 160 px past the screen's left inset (the pane's own left padding carries it), its
  // key plates side by side
  SEC.edge = paneEdge({
    pane: $('section'), edges: [$('sec-edge'), $('sec-side')], view: $('view'), keep: { up: 120, get side() { return 148 + parseFloat(getComputedStyle($('section')).paddingLeft); } },
    get: () => S.section.size, set: (f) => { S.section.size = f; },
    onSize: () => { R.draw = true; R.labels = true; R.card = 2; R.section = true; kick(); }, onEnd: save,
    onDrag: (on) => { SEC.edgeDrag = on; R.section = true; kick(); },
    label: (side) => (side ? 'Section width' : 'Section height'),
  });
  applySection();
}

// ---------------------------------------------------------------- the test hook
// Inert: nothing in the app calls it. tools/shoot.mjs reads the app's state through it.
window.__volve = {
  stats: () => ({ ...G.stats, texStep: G.texStep, shown, wanted, trackBuilds: track ? track.builds : 0, playing: !!playing, raf: !!raf }),
  wanted: () => wanted,
  shown: () => shown,
  pick: (x, y) => pickAt(x, y),
  cell: (a, f) => Object.fromEntries(['SOIL', 'SWAT', 'SGAS', 'PRESSURE', 'PORO', 'PERMX', 'PERMZ', 'NTG', 'DEPTH', 'FIPNUM', 'REGION', 'LAYER'].map((k) => [k, cellValue(D, k, f ?? shown, a)]).concat([['ijk', [...G.ijk.subarray(a * 3, a * 3 + 3)]]])),
  cellScreen: (a) => { const w = cellWorld(a); return projectWorld(w[0], w[1], w[2]); },
  wellScreen: (name) => { const i = model.wells.findIndex((w) => w.name === name); return i < 0 ? null : project(G.wellHeads ? G.wellHeads[i] : model.wells[i].path[0]); },
  cut: () => G.cut,
  focus: () => focus,
  cam: () => ({ ...S.cam, target: [...S.cam.target], flying: !!G.anim }),
  units: () => units,
  setFrame: (f) => { wanted = Math.max(0, Math.min(G.nf - 1, f | 0)); kick(); },
  selectWell: (n) => selectWell(n, true),
  setProp: (key) => { if (propDef(key)) { S.prop = key; applyProp(); } },
  log: (on) => { if (on) flog = []; const out = flog; if (!on) flog = null; return out; },
  secLog: (on) => { const out = G.secLog; G.secLog = on ? [] : null; return out; },
  labelHits: () => G.labelHits || [],
  resolveTap: (x, y) => resolveTap(x, y),
  ends: (key) => openEnds(D, propDef(key), G.gasMax),
  // the section: its state, a cell's middle on the pane (CSS px in the canvas), a model point on the plate
  settled: () => (moving() ? 'moving' : !S.section.on || (SEC.full && !R.section && !R.secGeom && !R.seisWork)),
  secFit: () => { const cv = $('sec-plot'); return SEC.geom ? { set: parseFloat(cv.style.height) || 0, need: secNeed(Math.max(40, cv.clientWidth - SEC_BOX.l - SEC_BOX.r)), h: cv.clientHeight, lock: !!SEC.lockH } : null; },
  section: () => (SEC.geom ? { hz: SEC.hz, words: SEC.taken, show: S.seis.show, seis: SEC.seis && { inside: SEC.seis.inside, traces: SEC.seis.traces, ms: SEC.seis.ms, k: SEC.seis.k, fc: SEC.seis.fc, x0: SEC.seis.x0, y0: SEC.seis.y0, cols: SEC.seis.cols, rows: SEC.seis.rows }, seisAt: SEC.seisAt, endWords: SEC.endWords, endNums: SEC.endNums, endForm: SEC.endForm, axisTitle: SEC.axisTitle, hzNamed: SEC.hzNamed, hzBoxes: SEC.hzBoxes, distWords: SEC.distWords, keyCompact: !!SEC.keyCompact, datum: model.center[2], on: S.section.on, line: S.section.line, a: [...SEC.geom.line.a], b: [...SEC.geom.line.b], L: SEC.geom.line.L, n: SEC.geom.n, cells: [...SEC.geom.cells], z: [SEC.geom.z0, SEC.geom.z1], wells: SEC.wells.map((w) => model.wells[w.i].name), named: SEC.named || [], unnamed: SEC.unnamed || [], step: G.secStep, at: S.section.at, drawnAt: SEC.drawnAt, sweep: sweepOf().at, axis: sweepOf().axis, size: S.section.size, exag: SEC.exag, gapPx: SEC.hatch ? SEC.hatch.gapPx : null, armed: SEC.armed, ends: SEC.ends, ax: SEC.ax && { x0: SEC.ax.x0, x1: SEC.ax.x1, y0: SEC.ax.y0, y1: SEC.ax.y1, sx: SEC.ax.sx, sz: SEC.ax.sz, zTop: SEC.ax.zTop } } : { on: S.section.on }),
  secCellPoint: (a) => { if (!SEC.geom || !SEC.ax) return null; const i = SEC.geom.cells.indexOf(a); if (i < 0) return null; let s = 0, z = 0, n = 0; for (let k = SEC.geom.offs[i]; k < SEC.geom.offs[i + 1]; k++) { s += SEC.geom.pts[k * 2]; z += SEC.geom.pts[k * 2 + 1]; n++; } return [SEC.ax.X(s / n), SEC.ax.Y(z / n)]; },
  secCellBox: (a) => { if (!SEC.geom || !SEC.ax) return null; const i = SEC.geom.cells.indexOf(a); if (i < 0) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let k = SEC.geom.offs[i]; k < SEC.geom.offs[i + 1]; k++) { const X = SEC.ax.X(SEC.geom.pts[k * 2]), Y = SEC.ax.Y(SEC.geom.pts[k * 2 + 1]); x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); } return [x0, y0, x1, y1]; },
  secCellPx: (a) => { if (!SEC.geom || !SEC.ax) return null; const i = SEC.geom.cells.indexOf(a); return i < 0 ? null : cellPx(SEC.geom, SEC.ax, i); },
  secCellAt: (x, y) => (SEC.geom && SEC.ax ? (cellAt(SEC.geom, SEC.ax, x, y) >= 0 ? SEC.geom.cells[cellAt(SEC.geom, SEC.ax, x, y)] : -1) : -1),
  mapScreen: (p) => project([p[0], p[1], topAt(p[0], p[1])]),
  // the section's one depth axis: the plot's y (CSS px) of a depth below sea level, and the depth at a y
  secY: (depth) => (SEC.ax ? SEC.ax.Y(depth - SEC.ax.datum) : null),
  secDepth: (y) => (SEC.ax ? SEC.ax.Z(y) + SEC.ax.datum : null),
  secX: (s) => (SEC.ax ? SEC.ax.X(s) : null),
  seis: () => ({ ...S.seis }),
  setSeis: (q) => { Object.assign(S.seis, q); writeSeisControls(); writeSecWords(); R.secGeom = true; R.section = true; kick(); },
  setLine: (line, at) => { setLine(at === undefined ? { line, a: null, b: null } : { line, a: null, b: null, at }, true); },
  sweep: () => sweepOf().at.slice(),
  mapPoint: (x, y) => mapPoint(x, y),
  modelBox: () => modelBox(),
  secHandle: (x, y) => secHandle(x, y),
  topAt: (p) => surfAt(G.surf, 'top', p[0], p[1]),
  cellXY: (a) => { let x = 0, y = 0; for (let k = 0; k < 8; k++) { x += G.geom[a * 24 + k * 3] / 8; y += G.geom[a * 24 + k * 3 + 1] / 8; } return [x, y]; },
};
