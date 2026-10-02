/* Shelf Atlas: Snuggery mini-app. The North Sea's oil and gas fields, pipelines and platforms on one
 * map, with a player over every month of production since January 1971. What it shows is NOTES.md;
 * how it looks is ART.md, on the template's house system. The data contract and its decode are in
 * js/data.js; every number, unit and date the app writes goes through js/units.js; the month track is
 * js/track.js.
 *
 * HOW IT STAYS FAST. Everything that does not depend on the month is decoded
 * once per data load: every outline becomes one Path2D in world units (Web
 * Mercator, degrees), every series one dense Float32Array. A month change fills
 * typed arrays (value and state per field and per unit, and each unit's ring)
 * and redraws; nothing is rebuilt. The basemap and the pipelines are painted
 * into an offscreen canvas that is reused until the view moves, so scrubbing
 * costs the fields, the circles, the rings, the platforms and the labels only.
 *
 * RATE OR CUMULATIVE. The circles show either each unit's rate in the month
 * (the month's volume over its days) or its cumulative volume: the sum of its
 * monthly volumes from the first month of its series up to and including the
 * month shown. Each series carries a Float64Array prefix sum built when it is
 * decoded, so a cumulative is one lookup, never an estimate.
 *
 * THE PEAKS (ART.md section 1). In Rate, each unit carries a 1 px ink ring at
 * its best month so far, at the circles' own area scale: the records where its
 * running maximum rises are built once per data load, quantity and set of
 * countries shown, and the month shown finds its record by binary search.
 *
 * THE FRAME. One requestAnimationFrame chain: play moves the wanted month on a
 * clock, a held track sets it to the month under the finger, and the frame
 * computes the newest wanted month, sets `shown` to it and draws. The time
 * row, the lead, the caption, the card, the chart's cursor and aria-valuenow
 * all read `shown`, so they cannot disagree with the picture. A frame whose
 * month, view and choices have not changed draws nothing.
 *
 * NO VALUE EVER REACHES innerHTML: every piece of text is set with textContent.
 * Nothing is fetched but ./data/geo.json, ./data/snapshot.json and ./data/bathy.png.
 */
import {
  EPOCH, CC, CC_ADJ, R_MAX, RING_FLOOR, clamp, isNum, isInt, isStr, monthYear, daysIn, titleCase,
  sentenceCase, normStatus, hcLabel, fold, repaired, mercY, decodeLine, validateGeo, validateSnap,
  monthly, cumAt, reported, commonMonth, buildModel, bestRecords, bestAt, allSources, creditLine,
} from './js/data.js';
import * as U from './js/units.js';
import { createTrack } from './js/track.js';

const STORE = {
  view: 'sa.view', month: 'sa.month', qty: 'sa.qty', sys: 'sa.units', cc: 'sa.countries',
  sel: 'sa.sel', layers: 'sa.layers', mode: 'sa.mode', focus: 'sa.focus',
};
/* Map layers the viewer can switch off, stored in sa.layers. Fields, their
 * circles and the coast are always drawn; `peaks` is the key column's rings. */
const LAYERS = ['outlines', 'facs', 'pipes', 'borders', 'bathy', 'labels', 'rings'];
const layerOn = { outlines: true, facs: true, pipes: true, borders: true, bathy: true, labels: true, rings: true, peaks: true };
const Z_LABELS = 1.35;          // zoom (× the whole-sea view) at which field names appear
const Z_PIPES = 1.6;            // … pipelines
const Z_FACS = 3.2;             // … platforms and subsea structures
const Z_MIN = 0.7, Z_MAX = 400;
/* The home view is the North Sea proper, not the whole bbox: the bbox may
 * reach the Norwegian and Barents Seas, which stay a pan away. */
const HOME = [-4, 51, 10, 62];
const DOMAIN_DECADES = 3.5;     // the color scale covers this many powers of ten below the top
const PLAY_RATE = 12;           // months a second: a year a second
const STALE_DAYS = 10;          // the build runs weekly; older than this is stamped stale
const FLY_MS = 550;
const LABEL_FONT = '560 11.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const SMALL_FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const KIND = ['Fixed', 'Floating', 'Subsea'];

/* The plate, printed twice: `python3 shelf-atlas/tools/art/palette.py --json` from Template/, pasted
 * as it prints (tools/check.mjs fails while the two differ). The ramp is 17 stops from small to the
 * scale's top; depth is keyed by the bathymetry raster's gray value. */
const THEMES = {"light": {"ramp": ["#f5d1a0", "#f4c793", "#f3bd86", "#f1b378", "#efa96a", "#ee9f60", "#ec9456", "#ea894c", "#e87e42", "#e1753f", "#db6d3c", "#d56439", "#ce5b36", "#c55536", "#bc4f36", "#b34835", "#ab4235"], "circleAlpha": 0.82, "depth": [[1, "#e4edf0"], [40, "#dce7ed"], [80, "#d2e1e9"], [150, "#c7d8e3"], [255, "#bed1df"]], "sea": "#dce7ed", "land": "#eff1ef", "outside": "#dbdee0", "edge": "#c9d4d8", "coast": "#5a696f", "border": "#626a6f", "idle": "#636c71", "shutFill": "#a0a6a9", "shutAlpha": 0.6, "prodFill": "#e87e42", "prodAlpha": 0.22, "rim": "#f6f9fa", "rimAlpha": 0.9, "pipes": ["#277a40", "#8c4896", "#676b6d"], "pipeAlpha": 1.0, "chart": ["#2f8247", "#934f9e"], "fac": "#5c676c", "sub": "#6d767b", "ring": "#0c131b", "label": "#0f1c23", "halo": "#f6f9fa", "haloAlpha": 0.88}, "dark": {"ramp": ["#543601", "#5c3900", "#653b00", "#6d3e01", "#754102", "#7f4201", "#8a4300", "#934503", "#9e4501", "#a84604", "#b2470e", "#b94b1e", "#c04f29", "#c55536", "#ca5b42", "#cf614d", "#d36757"], "circleAlpha": 0.82, "depth": [[1, "#1d272c"], [40, "#182228"], [80, "#121d23"], [150, "#0c161d"], [255, "#070f15"]], "sea": "#182228", "land": "#292f32", "outside": "#0c1012", "edge": "#2a373c", "coast": "#758388", "border": "#727c81", "idle": "#707b81", "shutFill": "#484e52", "shutAlpha": 0.7, "prodFill": "#9e4501", "prodAlpha": 0.26, "rim": "#141d21", "rimAlpha": 0.9, "pipes": ["#4a9a5e", "#ad67b8", "#6b6f71"], "pipeAlpha": 1.0, "chart": ["#63b376", "#c77fd2"], "fac": "#7e8a90", "sub": "#6d767b", "ring": "#edf3fa", "label": "#e6edee", "halo": "#1c272c", "haloAlpha": 0.88}};

/* ── small helpers ───────────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function store(key, val) { try { localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val)); } catch { /* private mode */ } }
function recall(key) { try { return localStorage.getItem(key); } catch { return null; } }
function recallJSON(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; };
const say = (t) => { const e = $('live'); e.textContent = ''; setTimeout(() => { e.textContent = t; }, 30); };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
const ccName = (c) => (snap && snap.countries && snap.countries[c]) || c;
/** "NO, UK or NL". */
const orList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} or ${a[a.length - 1]}`);
const andList = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ── the map's geometry ──────────────────────────────────────────────────── */

function addLine(path, a, close) {
  if (a.length < 4) return;
  path.moveTo(a[0], a[1]);
  for (let i = 2; i < a.length; i += 2) path.lineTo(a[i], a[i + 1]);
  if (close) path.closePath();
}
function bboxOf(arrs) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const a of arrs) {
    for (let i = 0; i < a.length; i += 2) {
      if (a[i] < x0) x0 = a[i];
      if (a[i] > x1) x1 = a[i];
      if (a[i + 1] < y0) y0 = a[i + 1];
      if (a[i + 1] > y1) y1 = a[i + 1];
    }
  }
  return [x0, y0, x1, y1];
}
/* The shoelace area in world units², for ranking and for choosing the
 * smaller of two overlapping outlines on a tap. */
function ringArea(a) {
  let s = 0;
  for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) s += (a[j] + a[i]) * (a[j + 1] - a[i + 1]);
  return Math.abs(s / 2);
}
function mediumClass(m) {
  const t = String(m || '').toLowerCase();
  const oil = /oil|crude/.test(t), gas = /gas/.test(t);
  if (oil && !gas) return 0;
  if (gas && !oil) return 1;
  return 2;
}
const PIPE_W = [0.7, 0.95, 1.25];         // CSS px at the zoom where pipelines appear; never bolder than a ring's ink (ART.md 5.2, test 7)
function widthClass(d) { return !isNum(d) || d < 14 ? 0 : d < 26 ? 1 : 2; }
const FLOATING = /FPSO|FSO|FSU|FLOAT|SEMI|SHIP|TLP|SPAR|VESSEL|BUOY|MOPU/i;
/* The regulators' installation layers also carry wind turbines and geothermal
 * plants. This is an oil and gas map: those are counted in About, not drawn. */
const NOT_OIL_GAS = /WIND|GEOTHERM/i;

function buildBase(g) {
  const f = g.factor;
  const B = {
    generatedAt: g.generatedAt, bbox: g.bbox,
    X0: g.bbox[0], X1: g.bbox[2], Y0: mercY(g.bbox[3]), Y1: mercY(g.bbox[1]),
    land: new Path2D(), bathy: new Path2D(), coast: new Path2D(), borderPath: new Path2D(),
    counts: { outlines: g.fields.length, pipelines: g.pipelines.length, facilities: g.facilities.length, borders: g.borders.length },
  };
  g.land.forEach((poly, i) => poly.forEach((r, j) => addLine(B.land, decodeLine(r, f, `land[${i}][${j}]`), true)));
  g.bathy200.forEach((poly, i) => poly.forEach((r, j) => addLine(B.bathy, decodeLine(r, f, `bathy200[${i}][${j}]`), true)));
  g.coast.forEach((l, i) => addLine(B.coast, decodeLine(l, f, `coast[${i}]`), false));
  B.borders = g.borders.map((b, i) => {
    const lines = b.lines.map((l, j) => decodeLine(l, f, `borders[${i}].lines[${j}]`));
    lines.forEach((a) => addLine(B.borderPath, a, false));
    return { name: b.name, type: b.type, a: b.a, b: b.b, lines, bbox: bboxOf(lines) };
  });
  // Pipelines go into one Path2D per country × medium × width, so a frame
  // strokes at most 36 paths however many hundred pipelines there are.
  B.pipeBuckets = CC.map(() => [0, 1, 2].map(() => [0, 1, 2].map(() => new Path2D())));
  B.pipes = g.pipelines.map((p, i) => {
    const lines = p.lines.map((l, j) => decodeLine(l, f, `pipelines[${i}].lines[${j}]`));
    const cci = Math.max(0, CC.indexOf(p.country));
    const mc = mediumClass(p.medium), wc = widthClass(p.dimIn);
    lines.forEach((a) => addLine(B.pipeBuckets[cci][mc][wc], a, false));
    return { raw: repaired(p), cc: CC[cci], mc, wc, lines, bbox: bboxOf(lines) };
  });
  const n = g.facilities.length;
  B.fac = { n, skipped: 0, X: new Float32Array(n), Y: new Float32Array(n), shape: new Uint8Array(n),
    cc: new Uint8Array(n), y0: new Int16Array(n), y1: new Int16Array(n), raw: g.facilities.map(repaired) };
  g.facilities.forEach((fa, i) => {
    B.fac.X[i] = fa.lon;
    B.fac.Y[i] = mercY(fa.lat);
    B.fac.shape[i] = fa.surface === false || /subsea/i.test(fa.kind || '') ? 2 : FLOATING.test(fa.kind || '') ? 1 : 0;
    B.fac.cc[i] = Math.max(0, CC.indexOf(fa.country));
    B.fac.y0[i] = isInt(fa.startYear) ? fa.startYear : 0;
    B.fac.y1[i] = isInt(fa.endYear) ? fa.endYear : 9999;
    if (NOT_OIL_GAS.test(fa.kind || '')) { B.fac.y0[i] = 9999; B.fac.y1[i] = -1; B.fac.skipped++; }
  });
  B.outlines = new Map();
  g.fields.forEach((o, i) => {
    const rings = o.rings.map((r, j) => decodeLine(r, f, `fields[${i}].rings[${j}]`)).filter((a) => a.length >= 6);
    if (!rings.length) return;
    const path = new Path2D();
    rings.forEach((a) => addLine(path, a, true));
    B.outlines.set(o.id, { rings, path, bbox: bboxOf(rings), area: rings.reduce((s, a) => s + ringArea(a), 0) });
  });
  return B;
}

/* The optional bathymetry raster (geo.bathymetry): an 8-bit gray PNG beside
 * geo.json, 0 = land or no data, gray = 255 × √(depth / 3000 m). It is read
 * once per geo.json, kept as gray bytes, and tinted into a canvas once per
 * theme. Absent key or file: the map draws the 200 m polygons instead, and
 * says nothing, because the raster is orientation, not data. */
let bathy = null;
async function loadBathy(meta) {
  if (!meta || typeof meta !== 'object') { bathy = null; return; }
  const b = meta.bounds;
  if (!isStr(meta.file) || !/^[\w.-]+\.png$/i.test(meta.file) || !Array.isArray(b) || b.length !== 4 || !b.every(isNum)) { bathy = null; return; }
  try {
    const r = await fetch(`./data/${meta.file}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const src = await createImageBitmap(await r.blob());
    const w = src.width, h = src.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d', { willReadFrequently: true });
    c.drawImage(src, 0, 0);
    const d = c.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = d[i * 4];
    bathy = { w, h, gray, tinted: {}, X0: b[0], X1: b[2], Y0: mercY(b[3]), Y1: mercY(b[1]) };
  } catch {
    bathy = null;                // the 200 m polygons stand in; the raster is not data
  }
}
function bathyCanvas() {
  if (!bathy) return null;
  if (bathy.tinted[P.name]) return bathy.tinted[P.name];
  const stops = P.depth.map(([v, h]) => [v, ...rgb(h)]);
  const lut = new Uint32Array(256);            // little-endian RGBA packed
  for (let v = 1; v < 256; v++) {
    let j = 0;
    while (j < stops.length - 2 && v > stops[j + 1][0]) j++;
    const a = stops[j], z = stops[j + 1], t = clamp((v - a[0]) / (z[0] - a[0]), 0, 1);
    const ch = (i) => Math.round(a[i] + (z[i] - a[i]) * t);
    lut[v] = (255 << 24) | (ch(3) << 16) | (ch(2) << 8) | ch(1);
  }
  const cv = document.createElement('canvas');
  cv.width = bathy.w; cv.height = bathy.h;
  const c = cv.getContext('2d');
  const img = c.createImageData(bathy.w, bathy.h);
  const px = new Uint32Array(img.data.buffer);
  for (let i = 0; i < px.length; i++) px[i] = lut[bathy.gray[i]];
  c.putImageData(img, 0, 0);
  bathy.tinted[P.name] = cv;
  return cv;
}

/* ── state ───────────────────────────────────────────────────────────────── */

const canvas = $('map');
const ctx = canvas.getContext('2d');
const wrap = $('map-wrap');
const slider = $('slider');
const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reducedMq.matches;

let base = null;            // geometry, from geo.json
let model = null;           // fields and series, from snapshot.json
let snap = null;            // the raw snapshot, for sources and notes
let P = null;               // the current theme's paint
let W = 1, H = 1, dpr = 1;
const view = { k: 1, tx: 0, ty: 0 };
let fitK = 1, kMin = 0.5;
let month = 0;              // the month wanted: play and the keys move it, the frame draws it
let shown = -1;             // the month last drawn; everything that carries a month reads it
let qty = 'liq';
let sys = 'si';
let mode = 'rate';          // 'rate': each month's rate; 'cum': volume produced to date
const ccOn = { NO: true, UK: true, DK: true, NL: true };
let sel = null;             // { type: 'unit'|'fac'|'pipe'|'border', … }
let playing = false;
let focusMode = false;
let fontReady = false;
const problems = new Map();
let fieldVal = new Float64Array(0), fieldState = new Uint8Array(0);
let unitVal = new Float64Array(0), unitVis = new Uint8Array(0), unitCol = new Uint8Array(0), unitGap = new Uint8Array(0);
let ringR = new Float32Array(0);
const unitOrder = [];       // units with a circle, largest first, so small circles land on top
let monthTotal = 0, monthCount = 0;
const stats = { frames: 0, draws: 0, computes: 0, ringPasses: 0, rings: 0, recordBuilds: 0 };

function buildPalette() {
  const name = darkMq.matches ? 'dark' : 'light', T = THEMES[name];
  const stops = T.ramp.map(rgb), lut = [];
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1);
    const j = Math.min(stops.length - 2, Math.floor(t)), f = t - j;
    const c = [0, 1, 2].map((k) => Math.round(stops[j][k] + (stops[j + 1][k] - stops[j][k]) * f));
    lut.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
  P = { ...T, name, lut, prod: rgba(T.prodFill, T.prodAlpha), shut: rgba(T.shutFill, T.shutAlpha),
    rimC: rgba(T.rim, T.rimAlpha), haloC: rgba(T.halo, T.haloAlpha), selHalo: rgba(T.halo, 0.9) };
  // the Layers sheet's samples are drawn in the plate's own colors
  const st = document.documentElement.style;
  const sample = { prod: P.prod, idle: T.idle, shut: P.shut, fac: T.fac, sub: T.sub, oil: T.pipes[0], gas: T.pipes[1], other: T.pipes[2], border: T.border };
  for (const k in sample) st.setProperty(`--s-${k}`, sample[k]);
}

/* ── the month ───────────────────────────────────────────────────────────── */

function domain() {
  const hi = model ? (mode === 'cum' ? model.hiCum : model.hi)[qty] : 0;
  return hi > 0 ? { lo: hi / Math.pow(10, DOMAIN_DECADES), hi } : { lo: 1, hi: 10 };
}
function statusAt(F, m) {
  if (!F.hist) return null;
  let s = null;
  for (const h of F.hist) { if (h[0] <= m) s = h; else break; }
  return s;
}
function isShut(F, m) {
  if (F.hist) { const s = statusAt(F, m); return !!s && s[1] === 'Shut down'; }
  return F.statusNorm === 'Shut down' && isInt(F.raw.lastMonth) && m > F.raw.lastMonth;
}

/* The color index of a value on the current scale; module state rather than
 * a closure so that a month change allocates nothing. */
let colL0 = 0, colSpan = 1;
function colOf(v) { return v > 0 ? Math.round(clamp((Math.log10(v) - colL0) / colSpan, 0, 1) * 255) : 0; }
const byUnitVal = (a, b) => unitVal[b] - unitVal[a];
/* A disc is never drawn under 1.6 px radius, so a small producer stays visible and tappable; but inside
 * a ring the ring already does both, and a floored disc would make the ring look fuller than it is, so
 * there the disc is drawn at its true radius however small (discR). About names both. */
function circleR(v, hi) { return v > 0 ? Math.max(1.6, R_MAX * Math.sqrt(Math.min(1, v / hi))) : 0; }
function discR(u, hi) { const v = unitVal[u]; return ringR[u] ? R_MAX * Math.sqrt(Math.min(1, v / hi)) : circleR(v, hi); }

/* The Peaks' records for the shown quantity and countries, built when either changes. */
const recCache = new Map();       // qty + countries -> records; cleared when a new model is built
let rec = null, recKey = '', recModel = null;
function records() {
  if (recModel !== model) { recCache.clear(); recModel = model; recKey = ''; }
  const key = qty + CC.map((c) => (ccOn[c] ? 1 : 0)).join('');
  if (recKey !== key) {
    rec = recCache.get(key);
    if (!rec) { rec = model.units.map((Un) => bestRecords(model, Un, qty, ccOn)); recCache.set(key, rec); stats.recordBuilds++; }
    recKey = key;
  }
  return rec;
}
function bestOf(u, m) {
  const R = records()[u], k = bestAt(R, m);
  return k < 0 ? null : { v: R.v[k], m: R.m[k] };
}

function computeMonth(m) {
  if (!model) return;
  stats.computes++;
  const nf = model.fields.length, nu = model.units.length;
  if (fieldVal.length !== nf) { fieldVal = new Float64Array(nf); fieldState = new Uint8Array(nf); }
  if (unitVal.length !== nu) {
    unitVal = new Float64Array(nu); unitVis = new Uint8Array(nu); unitCol = new Uint8Array(nu);
    unitGap = new Uint8Array(nu); ringR = new Float32Array(nu);
  }
  const y = monthYear(m), dd = daysIn(m), cum = mode === 'cum';
  const D = domain();
  colL0 = Math.log10(D.lo);
  colSpan = Math.log10(D.hi) - colL0;
  for (let i = 0; i < nf; i++) {
    const F = model.fields[i];
    let st = 0, v = 0;
    if (ccOn[F.cc]) {
      // a month the field's country has not reported has no figure, not a zero
      const rep = reported(model, F.cc, m);
      const l = rep ? monthly(F, 'liq', m) : 0, g = rep ? monthly(F, 'gas', m) : 0;
      const cl = cum && rep ? cumAt(F, 'liq', m) : 0, cg = cum && rep ? cumAt(F, 'gas', m) : 0;
      const r = (qty === 'liq' ? l : qty === 'gas' ? g : l + g / 1000) / dd;
      // Hidden until discovered, unless the source reports production
      // before its own discovery year, in which case the numbers win.
      if (l <= 0 && g <= 0 && cl <= 0 && cg <= 0 && F.disc != null && F.disc > y) st = 0;
      else if (r > 0) st = 3;
      else st = isShut(F, m) ? 2 : 1;
      // A rate belongs to a producing month only; a cumulative stays with the
      // field for good, shut or idle.
      if (cum) v = qty === 'liq' ? cl : qty === 'gas' ? cg : cl + cg / 1000;
      else if (st === 3) v = r;
    }
    fieldVal[i] = v; fieldState[i] = st;
  }
  // A unit is drawn for a month only when every shown member's country has
  // reported it, so a cross-border unit is never drawn from one side (B2).
  unitOrder.length = 0;
  monthTotal = 0; monthCount = 0;
  const peaks = !cum && layerOn.peaks, R = peaks ? records() : null, floor = model.hi[qty] * RING_FLOOR;
  if (peaks) stats.ringPasses++;
  for (let u = 0; u < nu; u++) {
    const mem = model.units[u].members;
    let v = 0, vis = 0, gap = 0;
    for (let k = 0; k < mem.length; k++) {
      const F = mem[k];
      if (!ccOn[F.cc]) continue;
      if (!reported(model, F.cc, m)) gap = 1;
      v += fieldVal[F.i];
      if (fieldState[F.i] > vis) vis = fieldState[F.i];
    }
    if (gap) v = 0;
    unitVal[u] = v; unitVis[u] = vis; unitCol[u] = colOf(v); unitGap[u] = gap;
    let rr = 0;
    if (peaks && vis && !gap) {
      const k = bestAt(R[u], m);
      if (k >= 0 && R[u].v[k] >= floor) rr = circleR(R[u].v[k], model.hi[qty]);
    }
    ringR[u] = rr;
    if (v > 0) { unitOrder.push(u); monthTotal += v; monthCount++; }
  }
  unitOrder.sort(byUnitVal);
}

/* ── view: Web Mercator, k CSS px per degree, t the screen offset ────────── */

function homeBox() {
  // the North Sea proper, cut to the data's own bbox should it ever be smaller
  const b = base.bbox;
  const lon0 = Math.max(HOME[0], b[0]), lat0 = Math.max(HOME[1], b[1]);
  const lon1 = Math.min(HOME[2], b[2]), lat1 = Math.min(HOME[3], b[3]);
  return lon1 > lon0 && lat1 > lat0 ? [lon0, mercY(lat1), lon1, mercY(lat0)] : [base.X0, base.Y0, base.X1, base.Y1];
}
function computeFit() {
  if (!base) { fitK = 1; return; }
  const h = homeBox();
  fitK = Math.min(W / (h[2] - h[0]), H / (h[3] - h[1])) * 0.98;
  // zoomed right out, the whole bbox fits, however far north it reaches
  kMin = Math.min(fitK * Z_MIN, Math.min(W / (base.X1 - base.X0), H / (base.Y1 - base.Y0)) * 0.95);
}
const zoomRel = () => view.k / fitK;
function centerOn(X, Y, k) {
  view.k = k;
  view.tx = W / 2 - X * k;
  view.ty = H / 2 - Y * k;
}
/* The home view's center: the North Sea's, moved only so that no band beyond the data's box shows on
 * an axis where the box is longer than the plate (in focus mode the plate is taller than the home
 * box at its width, and the south edge at 50.5° N would leave a strip above the caption band). */
function homeCenter() {
  const h = homeBox(), k = fitK;
  const keep = (c, half, lo, hi) => (hi - lo >= 2 * half ? clamp(c, lo + half, hi - half) : c);
  return [keep((h[0] + h[2]) / 2, W / (2 * k), base.X0, base.X1), keep((h[1] + h[3]) / 2, H / (2 * k), base.Y0, base.Y1)];
}
function home() {
  if (!base) return;
  const c = homeCenter();
  centerOn(c[0], c[1], fitK);
}
function clampView() {
  if (!base) return;
  const k = clamp(view.k, kMin, fitK * Z_MAX);
  const cx = clamp((W / 2 - view.tx) / view.k, base.X0, base.X1);
  const cy = clamp((H / 2 - view.ty) / view.k, base.Y0, base.Y1);
  centerOn(cx, cy, k);
}
function saveView() {
  if (!base) return;
  store(STORE.view, { x: (W / 2 - view.tx) / view.k, y: (H / 2 - view.ty) / view.k, z: zoomRel() });
}
function restoreView() {
  const v = recallJSON(STORE.view);
  if (v && isNum(v.x) && isNum(v.y) && isNum(v.z)) { centerOn(v.x, v.y, v.z * fitK); clampView(); } else home();
}
function zoomAt(sx, sy, f) {
  endFly();
  const X = (sx - view.tx) / view.k, Y = (sy - view.ty) / view.k;
  view.k = clamp(view.k * f, kMin, fitK * Z_MAX);
  view.tx = sx - X * view.k;
  view.ty = sy - Y * view.k;
  clampView();
  saveView();
  requestRender();
}
function panBy(dx, dy) { endFly(); view.tx += dx; view.ty += dy; clampView(); saveView(); requestRender(); }
function viewBounds(marginPx) {
  const m = (marginPx || 0) / view.k;
  return [-view.tx / view.k - m, -view.ty / view.k - m, (W - view.tx) / view.k + m, (H - view.ty) / view.k + m];
}
const inView = (b, v) => b[2] >= v[0] && b[0] <= v[2] && b[3] >= v[1] && b[1] <= v[3];

/* A flight to a field or to the whole sea: zoom in log space, center
 * linearly, 550 ms on the house's --draw curve, cubic-bezier(0.2, 0, 0, 1).
 * Any touch ends it at its destination (B13); under Reduce Motion it is a cut. */
let fly = null;
function drawCurve(x) {
  // x(t) = 0.6 t (1 − t)² + t³, y(t) = 3t² − 2t³: x is monotonic, so bisect for t
  let a = 0, b = 1, t = x;
  for (let i = 0; i < 24; i++) { t = (a + b) / 2; if (0.6 * t * (1 - t) ** 2 + t ** 3 < x) a = t; else b = t; }
  return 3 * t * t - 2 * t * t * t;
}
function flyTo(bbox, maxZ, k) {
  if (!base) return;
  const bw = Math.max(bbox[2] - bbox[0], 1e-4), bh = Math.max(bbox[3] - bbox[1], 1e-4);
  if (k == null) k = clamp(Math.min((W - 80) / bw, (H - 80) / bh), fitK * 1.2, fitK * (maxZ || 60));
  const to = { x: (bbox[0] + bbox[2]) / 2, y: (bbox[1] + bbox[3]) / 2, k };
  fly = { t0: performance.now(), from: { x: (W / 2 - view.tx) / view.k, y: (H / 2 - view.ty) / view.k, k: view.k }, to };
  if (reduced()) endFly(); else requestRender();
}
function endFly() {
  if (!fly) return;
  const { to } = fly;
  fly = null;
  centerOn(to.x, to.y, to.k);
  clampView();
  saveView();
  if (!$('card').hidden) placeCard();
  requestRender();
}
function tickFly(now) {
  const u = Math.min(1, (now - fly.t0) / FLY_MS);
  if (u >= 1) { endFly(); return; }
  const e = drawCurve(u), { from, to } = fly;
  centerOn(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, Math.exp(Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e));
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

const pipesOn = () => layerOn.pipes && zoomRel() >= Z_PIPES;
const facsOn = () => layerOn.facs && zoomRel() >= Z_FACS;
const labelsOn = () => layerOn.labels && zoomRel() >= Z_LABELS;
const worldTf = (c) => c.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.tx, dpr * view.ty);
const screenTf = (c) => c.setTransform(dpr, 0, 0, dpr, 0, 0);

/* The basemap and the pipelines do not change with the month, so they are
 * painted once per view into an offscreen canvas and copied while scrubbing.
 * During a pan or pinch the last full frame is moved as a picture instead. */
let cache = null;
function staticKey() {
  return [view.k, view.tx, view.ty, W, H, dpr, P.name, pipesOn(), layerOn.borders, layerOn.bathy, !!bathy,
    CC.map((c) => (ccOn[c] ? 1 : 0)).join('')].join('|');
}
function drawStatic(c) {
  const k = view.k;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = P.outside;
  c.fillRect(0, 0, canvas.width, canvas.height);
  worldTf(c);
  c.fillStyle = P.sea;
  c.fillRect(base.X0, base.Y0, base.X1 - base.X0, base.Y1 - base.Y0);
  const bc = layerOn.bathy ? bathyCanvas() : null;
  if (bc) {
    // Rows are already uniform in Mercator y, so one stretch places it. (The
    // 200 m polygons are not outlined over it: Natural Earth splits them at
    // tile seams, and those seams would show as straight lines.)
    c.imageSmoothingEnabled = true;
    c.drawImage(bc, bathy.X0, bathy.Y0, bathy.X1 - bathy.X0, bathy.Y1 - bathy.Y0);
  } else if (layerOn.bathy) {
    c.fillStyle = P.depth[2][1];
    c.fill(base.bathy, 'evenodd');
  }
  c.fillStyle = P.land;
  c.fill(base.land, 'evenodd');
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = P.coast;
  c.lineWidth = 0.8 / k;
  c.stroke(base.coast);
  // the data's box ends in a 1 px --line over the outside's own tone, so a straight cut (Britain at 6° W) reads as the data's limit
  c.strokeStyle = P.edge;
  c.lineWidth = 1 / k;
  c.strokeRect(base.X0, base.Y0, base.X1 - base.X0, base.Y1 - base.Y0);
  if (layerOn.borders) {
    c.strokeStyle = P.border;
    c.lineWidth = 1.2 / k;
    c.setLineDash([5 / k, 4 / k]);
    c.stroke(base.borderPath);
    c.setLineDash([]);
  }
  if (pipesOn()) {
    const grow = clamp(Math.sqrt(zoomRel() / Z_PIPES), 1, 1.15);
    c.globalAlpha = P.pipeAlpha;
    for (let ci = 0; ci < CC.length; ci++) {
      if (!ccOn[CC[ci]]) continue;
      for (let mc = 2; mc >= 0; mc--) {
        c.strokeStyle = P.pipes[mc];
        // the third class (other or unknown medium) is dotted: its form carries it, not a hue
        c.setLineDash(mc === 2 ? [0, 2.5 / k] : []);
        for (let wc = 0; wc < 3; wc++) {
          c.lineWidth = (PIPE_W[wc] * grow) / k;
          c.stroke(base.pipeBuckets[ci][mc][wc]);
        }
      }
    }
    c.setLineDash([]);
    c.globalAlpha = 1;
  }
}

let snapFrame = null;
function takeSnapshot() {
  if (!snapFrame || snapFrame.canvas.width !== canvas.width || snapFrame.canvas.height !== canvas.height) {
    const cv = document.createElement('canvas');
    cv.width = canvas.width;
    cv.height = canvas.height;
    snapFrame = { canvas: cv, ctx: cv.getContext('2d') };
  }
  snapFrame.ctx.setTransform(1, 0, 0, 1, 0, 0);
  snapFrame.ctx.clearRect(0, 0, canvas.width, canvas.height);
  snapFrame.ctx.drawImage(canvas, 0, 0);
  snapFrame.view = { ...view };
  snapFrame.P = P.name;
}
function render() {
  const c = ctx;
  if (!base) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.sea;
    c.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (gesture && snapFrame && snapFrame.view && snapFrame.P === P.name) {
    const v0 = snapFrame.view, sc = view.k / v0.k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.outside;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.setTransform(sc, 0, 0, sc, (view.tx - sc * v0.tx) * dpr, (view.ty - sc * v0.ty) * dpr);
    c.drawImage(snapFrame.canvas, 0, 0);
    return;
  }
  const key = staticKey();
  if (!cache || cache.canvas.width !== canvas.width || cache.canvas.height !== canvas.height) {
    const cv = document.createElement('canvas');
    cv.width = canvas.width;
    cv.height = canvas.height;
    cache = { canvas: cv, ctx: cv.getContext('2d'), key: null };
  }
  if (cache.key !== key) {
    drawStatic(cache.ctx);
    cache.key = key;
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(cache.canvas, 0, 0);
  if (model) {
    drawFields(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(outlineLayer(), 0, 0);
    drawCircles(c);
    drawRings(c);
    if (facsOn()) drawFacilities(c);
    if (labelsOn() && fontReady) drawLabels(c);
  }
  drawSelection(c);
}

/* Fills change every month and are cheap; outline strokes are what costs,
 * and they barely change: a field's outline is drawn from its discovery on,
 * whatever it produces. So the strokes live in their own offscreen layer,
 * rebuilt when the view moves and otherwise only added to as fields are
 * discovered. Scrubbing backwards past a discovery rebuilds it once. */
function drawFields(c) {
  if (!layerOn.outlines) return;
  const vb = viewBounds(2);
  worldTf(c);
  const fs = model.fields;
  for (let i = 0; i < fs.length; i++) {
    const st = fieldState[i];
    if (st < 2) continue;
    const F = fs[i];
    if (!F.path || F.delineation || !inView(F.bbox, vb)) continue;
    // Status only: the rate is on the circle, not the polygon, so a big
    // field is not louder than a big producer. Danish delineations are
    // administrative areas and get no fill at all.
    c.fillStyle = st === 3 ? P.prod : P.shut;
    c.fill(F.path, 'evenodd');
  }
}
let ol = null;
function outlineLayer() {
  const key = [view.k, view.tx, view.ty, W, H, dpr, P.name, layerOn.outlines].join('|');
  const n = model.fields.length;
  if (!ol || ol.canvas.width !== canvas.width || ol.canvas.height !== canvas.height) {
    const cv = document.createElement('canvas');
    cv.width = canvas.width;
    cv.height = canvas.height;
    ol = { canvas: cv, ctx: cv.getContext('2d'), key: null, vis: null };
  }
  let full = ol.key !== key || !ol.vis || ol.vis.length !== n;
  if (!full) for (let i = 0; i < n; i++) if (ol.vis[i] && !fieldState[i]) { full = true; break; }
  const c = ol.ctx;
  if (full) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, ol.canvas.width, ol.canvas.height);
    ol.vis = new Uint8Array(n);
  }
  if (layerOn.outlines) {
    worldTf(c);
    c.lineJoin = 'round';
    c.lineWidth = 0.8 / view.k;
    c.strokeStyle = P.idle;
    const vb = viewBounds(2);
    const dashed = [];
    for (let i = 0; i < n; i++) {
      if (!fieldState[i] || ol.vis[i]) continue;
      ol.vis[i] = 1;
      const F = model.fields[i];
      if (!F.path || !inView(F.bbox, vb)) continue;
      if (F.delineation) dashed.push(F); else c.stroke(F.path);
    }
    // Danish "outlines" are the Agency's legal field delineations, drawn on
    // block corners; dashed so they do not read as reservoirs.
    if (dashed.length) {
      c.setLineDash([4 / view.k, 3 / view.k]);
      for (const F of dashed) c.stroke(F.path);
      c.setLineDash([]);
    }
  }
  ol.key = key;
  return ol.canvas;
}

const sxOf = (Un) => Un.X * view.k + view.tx, syOf = (Un) => Un.Y * view.k + view.ty;
function drawCircles(c) {
  screenTf(c);
  const hi = domain().hi, Us = model.units;
  // Fields with no outline still exist when they are not producing: a small
  // hollow dot, so a tap can find them and the map does not pretend they are not there.
  c.lineWidth = 1;
  for (let u = 0; u < Us.length; u++) {
    if (unitVal[u] > 0 || !unitVis[u] || Us[u].members.some((F) => F.path)) continue;
    const sx = sxOf(Us[u]), sy = syOf(Us[u]);
    if (sx < -5 || sy < -5 || sx > W + 5 || sy > H + 5) continue;
    c.beginPath();
    c.arc(sx, sy, 2.6, 0, Math.PI * 2);
    if (unitVis[u] === 2) { c.fillStyle = P.shut; c.fill(); }
    c.strokeStyle = P.idle;
    c.stroke();
  }
  c.strokeStyle = P.rimC;
  // In Cumulative a shut unit keeps its circle, sized by what it produced,
  // filled gray instead of by the color scale.
  const grayShut = mode === 'cum';
  for (let o = 0; o < unitOrder.length; o++) {
    const u = unitOrder[o];
    const r = discR(u, hi);
    const sx = sxOf(Us[u]), sy = syOf(Us[u]);
    if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
    c.beginPath();
    c.arc(sx, sy, r, 0, Math.PI * 2);
    if (grayShut && unitVis[u] === 2) { c.globalAlpha = 1; c.fillStyle = P.shut; } else { c.globalAlpha = P.circleAlpha; c.fillStyle = P.lut[unitCol[u]]; }
    c.fill();
    c.globalAlpha = 1;
    // a rim on a disc under the floor would cover it: the rim separates overlapping discs, and these sit inside their ring
    if (layerOn.rings && r >= 1.6) c.stroke();
  }
}
/* The Peaks: one 1 px ring in --ring per unit, at its best month so far. */
function drawRings(c) {
  if (mode === 'cum' || !layerOn.peaks) return;
  screenTf(c);
  c.strokeStyle = P.ring;
  c.lineWidth = 1;
  c.beginPath();
  let n = 0;
  const Us = model.units;
  for (let u = 0; u < Us.length; u++) {
    const r = ringR[u];
    if (!r) continue;
    const sx = sxOf(Us[u]), sy = syOf(Us[u]);
    if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
    c.moveTo(sx + r, sy);
    c.arc(sx, sy, r, 0, Math.PI * 2);
    n++;
  }
  c.stroke();
  stats.rings = n;
}

function facilityVisible(i, y) {
  const fa = base.fac;
  return ccOn[CC[fa.cc[i]]] && y >= fa.y0[i] && y <= fa.y1[i];
}
function drawFacilities(c) {
  screenTf(c);
  const fa = base.fac, y = monthYear(shown);
  const s = clamp(1.8 + (zoomRel() - Z_FACS) * 0.08, 1.8, 3.6);
  const sq = new Path2D(), tri = new Path2D(), dot = new Path2D();
  for (let i = 0; i < fa.n; i++) {
    if (!facilityVisible(i, y)) continue;
    const sx = fa.X[i] * view.k + view.tx, sy = fa.Y[i] * view.k + view.ty;
    if (sx < -8 || sy < -8 || sx > W + 8 || sy > H + 8) continue;
    const sh = fa.shape[i];
    if (sh === 0) sq.rect(sx - s, sy - s, 2 * s, 2 * s);
    else if (sh === 1) { tri.moveTo(sx, sy - s * 1.25); tri.lineTo(sx + s * 1.15, sy + s * 0.9); tri.lineTo(sx - s * 1.15, sy + s * 0.9); tri.closePath(); } else { dot.moveTo(sx + s * 0.7, sy); dot.arc(sx, sy, s * 0.7, 0, Math.PI * 2); }
  }
  c.fillStyle = P.sub;
  c.fill(dot);
  c.fillStyle = P.fac;
  c.fill(sq);
  c.fill(tri);
}

/* What labels keep out of: the card, the key column and the ghost key, in plate coordinates. Read
 * from layout once and kept, so a frame that draws names reads no layout: dropped on a resize of any
 * of them (a ResizeObserver, which also sees one hidden or shown), on the card's placement, on its
 * opening and closing, and on a focus-mode change. */
let exclCache = null;
function dropExclusions() { exclCache = null; }
function exclusions() {
  if (exclCache) return exclCache;
  const w = wrap.getBoundingClientRect(), out = [];
  for (const id of ['card', 'keys', 'focus-exit']) {
    const e = $(id);
    if (e.hidden || e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect();
    if (r.width) out.push([r.left - w.left - 4, r.top - w.top - 4, r.right - w.left + 4, r.bottom - w.top + 4]);
  }
  exclCache = out;
  return out;
}
/* Labels: biggest fields first, each placed only where it collides with no
 * label already placed and with none of the plate's controls. Width is
 * measured once per name, in the house face, and remembered. */
let placedLabels = [];
function drawLabels(c) {
  screenTf(c);
  c.font = LABEL_FONT;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.lineJoin = 'round';
  c.lineWidth = 3;
  c.strokeStyle = P.haloC;
  c.fillStyle = P.label;
  const hi = domain().hi, Us = model.units, placed = exclusions().slice(), fixedN = placed.length;
  const maxLabels = Math.round(clamp(W * H / 2600, 20, 160));
  for (const u of model.rank) {
    if (!unitVis[u]) continue;
    const Un = Us[u];
    const sx = sxOf(Un), sy = syOf(Un);
    if (sx < -40 || sy < -20 || sx > W + 40 || sy > H + 20) continue;
    if (Un.lw == null) Un.lw = c.measureText(Un.name).width;
    const r = Math.max(circleR(unitVal[u], hi), ringR[u], 3);
    const y0 = sy + r + 2;
    const x0 = sx - Un.lw / 2 - 2, x1 = sx + Un.lw / 2 + 2, y1 = y0 + 14;
    if (x0 < 2 || x1 > W - 2 || y1 > H - 2) continue;
    let hit = false;
    for (const p of placed) if (x0 < p[2] && x1 > p[0] && y0 < p[3] && y1 > p[1]) { hit = true; break; }
    if (hit) continue;
    placed.push([x0, y0, x1, y1]);
    c.strokeText(Un.name, sx, y0);
    c.fillText(Un.name, sx, y0);
    if (placed.length - fixedN >= maxLabels) break;
  }
  placedLabels = placed.slice(fixedN);
}

/* The selection: the outline in ink over a halo, and a registration mark of
 * four 4 px ticks around the unit's disc or ring (never a circle, so it is
 * never read as a ring). */
function ticksAt(c, sx, sy, r) {
  c.beginPath();
  for (let a = 0; a < 4; a++) {
    const dx = Math.cos(a * Math.PI / 2), dy = Math.sin(a * Math.PI / 2);
    c.moveTo(sx + dx * (r + 2), sy + dy * (r + 2));
    c.lineTo(sx + dx * (r + 6), sy + dy * (r + 6));
  }
}
function inkOverHalo(c, w, path) {
  c.strokeStyle = P.selHalo; c.lineWidth = 3.5 * w;
  if (path) c.stroke(path); else c.stroke();
  c.strokeStyle = P.label; c.lineWidth = 1.5 * w;
  if (path) c.stroke(path); else c.stroke();
}
function drawSelection(c) {
  if (!sel || !base) return;
  const k = view.k;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (sel.type === 'unit' && model) {
    const Un = model.units[sel.u];
    if (!Un) return;
    worldTf(c);
    for (const F of Un.members) if (F.path) inkOverHalo(c, 1 / k, F.path);
    screenTf(c);
    ticksAt(c, sxOf(Un), syOf(Un), Math.max(circleR(unitVal[sel.u], domain().hi), ringR[sel.u], 3));
    inkOverHalo(c, 1);
  } else if (sel.type === 'fac') {
    screenTf(c);
    ticksAt(c, base.fac.X[sel.i] * k + view.tx, base.fac.Y[sel.i] * k + view.ty, 5);
    inkOverHalo(c, 1);
  } else {
    const lines = sel.type === 'pipe' ? base.pipes[sel.i].lines : base.borders[sel.i].lines;
    worldTf(c);
    c.beginPath();
    for (const a of lines) {
      c.moveTo(a[0], a[1]);
      for (let j = 2; j < a.length; j += 2) c.lineTo(a[j], a[j + 1]);
    }
    inkOverHalo(c, 1 / k);
  }
}

/* ── hit-testing: cheap prefilters, then exact tests on the few left ────── */

function pointInRings(rings, x, y) {
  let inside = false;
  for (const a of rings) {
    for (let i = 0, j = a.length - 2; i < a.length; j = i, i += 2) {
      const xi = a[i], yi = a[i + 1], xj = a[j], yj = a[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}
function distToLines(lines, bbox, sx, sy, tol) {
  const k = view.k;
  if (sx < bbox[0] * k + view.tx - tol || sx > bbox[2] * k + view.tx + tol
    || sy < bbox[1] * k + view.ty - tol || sy > bbox[3] * k + view.ty + tol) return Infinity;
  let best = Infinity;
  for (const a of lines) {
    let px = a[0] * k + view.tx, py = a[1] * k + view.ty;
    for (let i = 2; i < a.length; i += 2) {
      const qx = a[i] * k + view.tx, qy = a[i + 1] * k + view.ty;
      const dx = qx - px, dy = qy - py, L = dx * dx + dy * dy;
      const t = L > 0 ? clamp(((sx - px) * dx + (sy - py) * dy) / L, 0, 1) : 0;
      const d = Math.hypot(sx - (px + t * dx), sy - (py + t * dy));
      if (d < best) best = d;
      px = qx; py = qy;
    }
  }
  return best;
}
function hitTest(sx, sy) {
  if (!base) return null;
  const k = view.k, X = (sx - view.tx) / k, Y = (sy - view.ty) / k;
  if (model && facsOn()) {
    const fa = base.fac, y = monthYear(shown);
    let best = -1, bd = 13;
    for (let i = 0; i < fa.n; i++) {
      if (!facilityVisible(i, y)) continue;
      const d = Math.hypot(fa.X[i] * k + view.tx - sx, fa.Y[i] * k + view.ty - sy);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) return { type: 'fac', i: best };
  }
  // Fields come before pipelines: pipelines converge on the platforms inside
  // fields, and a tap there means the field. Circles and rings first, so an empty ring is a target:
  // every mark within reach (its radius plus 3 px, at least 9 px) is ranked by its distance over its
  // size, so the unit whose center is under the finger wins, and a small disc wins when the tap lands
  // on it. Then outlines, smallest area wins.
  if (model) {
    const hi = domain().hi, Us = model.units;
    let bu = -1, bs = Infinity;
    for (let u = 0; u < Us.length; u++) {
      if (!unitVis[u]) continue;
      const r = Math.max(circleR(unitVal[u], hi), ringR[u]) || (Us[u].members.some((F) => F.path) ? 0 : 3);
      if (!r) continue;
      const d = Math.hypot(sxOf(Us[u]) - sx, syOf(Us[u]) - sy);
      if (d > Math.max(r + 3, 9)) continue;
      const score = d / Math.max(r, 4.5);
      if (score < bs) { bs = score; bu = u; }
    }
    if (bu >= 0) return { type: 'unit', u: bu };
    let bf = null;
    if (layerOn.outlines) for (const F of model.fields) {
      if (!fieldState[F.i] || !F.rings) continue;
      const b = F.bbox;
      if (X < b[0] || X > b[2] || Y < b[1] || Y > b[3]) continue;
      if (pointInRings(F.rings, X, Y) && (!bf || F.area < bf.area)) bf = F;
    }
    if (bf) return { type: 'unit', u: bf.unit };
  }
  if (pipesOn()) {
    let bp = -1, bd = 12;
    base.pipes.forEach((p, i) => {
      if (!ccOn[p.cc]) return;
      const d = distToLines(p.lines, p.bbox, sx, sy, bd);
      if (d < bd) { bd = d; bp = i; }
    });
    if (bp >= 0) return { type: 'pipe', i: bp };
  }
  let bb = -1, bd = 12;
  if (layerOn.borders) base.borders.forEach((b, i) => {
    const d = distToLines(b.lines, b.bbox, sx, sy, bd);
    if (d < bd) { bd = d; bb = i; }
  });
  if (bb >= 0) return { type: 'border', i: bb };
  return null;
}

/* ── the stamp, the legend, the caption line, the credits ────────────────── */

function setProblem(key, msg) {
  if (msg) problems.set(key, msg); else problems.delete(key);
  const box = $('error');
  box.textContent = '';
  for (const m of problems.values()) box.append(el('div', null, m));
  box.hidden = !problems.size;
}

let readCount = 0;
function updateStamp() {
  const st = $('stamp');
  const gen = model ? model.generatedAt : base ? base.generatedAt : null;
  st.textContent = '';
  if (!gen) { st.textContent = problems.size ? 'No data could be read' : `Reading the data… ${readCount} of 2`; return; }
  const ms = Date.parse(gen);
  if ((Date.now() - ms) / 864e5 > STALE_DAYS) st.append(el('span', 'stale', 'Stale. '));
  const figures = model && model.fields.length;
  st.append(`${figures ? '' : 'Map only. '}Updated ${U.when(ms)}${figures ? `, figures to ${U.month(commonMonth(model, ccOn))}` : ''}`);
}

const measureCtx = document.createElement('canvas').getContext('2d');
function updateLegend() {
  const cum = mode === 'cum', unit = U.unitOf(qty, sys, cum), f = U.QTY[qty][sys].f;
  $('legend').hidden = !(model && model.fields.length);
  setText($('legend-name'), `${U.QTY[qty].name} ${cum ? 'to date' : 'a day'}`);
  setText($('btn-units'), unit);
  $('btn-units').setAttribute('aria-label', `Change units, now ${unit}`);
  // the bar is the circles' own colors at their alpha over the sea, so the scale under the plate is the scale on it
  const sea = rgb(P.sea), a = P.circleAlpha;
  $('legend-bar').style.background = `linear-gradient(to right, ${P.ramp.map((h, i) => {
    const c = rgb(h).map((v, j) => Math.round(v * a + sea[j] * (1 - a)));
    return `rgb(${c.join(',')}) ${(i / (P.ramp.length - 1)) * 100}%`;
  }).join(', ')})`;
  const box = $('legend-ticks');
  box.textContent = '';
  if (!model) return;
  const D = domain(), L0 = Math.log10(D.lo), span = Math.log10(D.hi) - L0;
  const bw = $('legend-bar').clientWidth || 190;
  measureCtx.font = SMALL_FONT;
  const wOf = (t) => measureCtx.measureText(t).width;
  const first = `≤${U.NNBSP}${U.tick(D.lo * f)}`, last = `≥${U.NNBSP}${U.tick(D.hi * f)}${U.NNBSP}${unit}`;
  const labels = [[first, 0, 'first']];
  let edge = wOf(first) + 8;
  const endEdge = bw - wOf(last) - 8;
  for (let e = Math.ceil(Math.log10(D.lo * f)); e <= Math.floor(Math.log10(D.hi * f)); e++) {
    const v = 10 ** e, t = U.tick(v), x = ((Math.log10(v / f) - L0) / span) * bw, w = wOf(t);
    if (x - w / 2 > edge && x + w / 2 < endEdge) { labels.push([t, x / bw, '']); edge = x + w / 2 + 8; }
  }
  labels.push([last, 1, 'last']);
  for (const [t, p, cls] of labels) {
    const s = el('span', cls, t);
    s.style.left = `${p * 100}%`;
    box.append(s);
  }
}

/** The caption line for month m: what the picture is, led by what is missing that month. */
function readline(m) {
  if (!model || !model.fields.length) return '';
  const on = CC.filter((c) => ccOn[c]);
  if (!on.length) return 'No country is shown; turn one on in Map layers.';
  const cum = mode === 'cum', rings = !cum && layerOn.peaks;
  const late = on.filter((c) => model.ccLast[c] != null && m > model.ccLast[c]);
  const early = on.filter((c) => model.ccFirst[c] != null && m < model.ccFirst[c]).sort((a, b) => model.ccFirst[a] - model.ccFirst[b]);
  let note = late.length ? `No ${orList(late)} figures for ${U.month(m)} yet. ` : '';
  if (early.length === 1) note += `${CC_ADJ[early[0]]} figures start in ${U.month(model.ccFirst[early[0]])}. `;
  else if (early.length) note += `No ${orList(early.map((c) => CC_ADJ[c]))} figures yet. `;
  if (note) return note + (cum ? 'Circles: produced to date.' : rings ? 'Circles: the month\'s rate; rings: best month so far.' : 'Circles: the month\'s rate.');
  if (cum) return 'Circles: what each field has produced to date; gray ones have shut down. Rings show with Rate.';
  if (!rings) return 'Circles: the month\'s rate of each field.';
  return `Circles: the month's rate. Rings: each field's best month so far, drawn from a best of ${U.amount(model.hi[qty] * RING_FLOOR, qty, sys, false)}.`;
}
function lead(m) {
  if (!model || !model.fields.length) return '';
  const on = CC.filter((c) => ccOn[c]);
  if (!on.length) return 'No country shown';
  const who = on.length === CC.length ? '' : `${on.join(', ')}: `;
  if (!monthCount) return `${who}${on.every((c) => !reported(model, c, m)) ? 'no figures' : 'nothing produced'}`;
  return `${who}${U.amount(monthTotal, qty, sys, mode === 'cum')}, ${U.int(monthCount)} field${monthCount === 1 ? '' : 's'}`;
}
const missing = (m) => CC.filter((c) => ccOn[c] && model.ccLast[c] != null && m > model.ccLast[c]);

/* Everything that carries the month, written for the month just drawn. */
/* With no production figures the transport and the Peaks key stand down, dimmed and aria-disabled,
 * and the caption line says why in place of the reading. */
const hasFigures = () => !!(model && model.fields.length);
function syncTransport() {
  const off = String(!hasFigures());
  for (const id of ['btn-play', 'btn-back', 'btn-fwd']) if ($(id).getAttribute('aria-disabled') !== off) $(id).setAttribute('aria-disabled', off);
  const pk = String(mode === 'cum' || !hasFigures());
  if ($('btn-peaks').getAttribute('aria-disabled') !== pk) $('btn-peaks').setAttribute('aria-disabled', pk);
}
function syncTime() {
  syncTransport();
  if (!hasFigures()) {
    setText($('valid-time'), '–');
    setText($('lead'), '');
    setText($('readline'), base ? 'No production figures to show; the notice above says why.' : '');
    return;
  }
  setText($('valid-time'), U.month(shown));
  setText($('lead'), lead(shown));
  setText($('readline'), readline(shown));
  slider.setAttribute('aria-valuenow', String(shown));
  const late = missing(shown);
  slider.setAttribute('aria-valuetext', `${U.monthLong(shown)}${late.length ? `, no ${orList(late)} figures yet` : ''}`);
  track.draw(shown);
  if (cardDyn) cardDyn();
  if (detailsDyn) detailsDyn();
}

/* ── the card: the tapped field, platform, pipeline or boundary ──────────── */

let cardDyn = null, cardAct = null;
function selKey(s) {
  if (!s) return null;
  if (s.type === 'unit') { const Un = model.units[s.u]; return Un.kind === 'group' ? `g:${Un.g.id}` : `f:${Un.f.id}`; }
  if (s.type === 'fac') return `fac:${base.fac.raw[s.i].id}`;
  if (s.type === 'pipe') return `pipe:${base.pipes[s.i].raw.id}`;
  return `border:${s.i}:${base.borders[s.i].name}`;
}
function resolveSel(key) {
  if (!key || !base) return null;
  const at = key.indexOf(':'), t = key.slice(0, at), id = key.slice(at + 1);
  if (t === 'f' && model && model.byId.has(id)) return { type: 'unit', u: model.byId.get(id).unit };
  if (t === 'g' && model && model.groupById.has(id)) return { type: 'unit', u: model.groupById.get(id).unit };
  if (t === 'fac') { const i = base.fac.raw.findIndex((f) => f.id === id); return i >= 0 ? { type: 'fac', i } : null; }
  if (t === 'pipe') { const i = base.pipes.findIndex((p) => p.raw.id === id); return i >= 0 ? { type: 'pipe', i } : null; }
  if (t === 'border') {
    const j = id.indexOf(':'), i = Number(id.slice(0, j));
    return base.borders[i] && base.borders[i].name === id.slice(j + 1) ? { type: 'border', i } : null;
  }
  return null;
}
/** Where on the plate the selection is, for keeping the card off it. */
function selPoint() {
  if (!sel) return null;
  if (sel.type === 'unit') { const Un = model.units[sel.u]; return [sxOf(Un), syOf(Un)]; }
  if (sel.type === 'fac') return [base.fac.X[sel.i] * view.k + view.tx, base.fac.Y[sel.i] * view.k + view.ty];
  return sel.at ? [(sel.at[0] - sel.at[2].tx) / sel.at[2].k * view.k + view.tx, (sel.at[1] - sel.at[2].ty) / sel.at[2].k * view.k + view.ty] : null;
}

function select(s, { announce = false, keepSheet = false } = {}) {
  sel = s;
  store(STORE.sel, selKey(s) || '');
  if (!s && !$('details').hidden) closeSheets();
  else if (s && !keepSheet && !$('layers').hidden) closeSheets();
  if (s && s.type === 'unit' && !$('details').hidden) renderDetails();
  else if (s && !$('details').hidden) closeSheets();
  renderCard(announce);
  requestRender();
}

function dlRow(dl, k, v) {
  if (v == null || v === '') return null;
  dl.append(el('dt', null, k));
  const dd = el('dd', null, String(v));
  dl.append(dd);
  return dd;
}
function unitByName(name, cc) {
  const key = fold(name).replace(/[^a-z0-9]/g, '');
  let hit = null;
  for (const F of model.fields) {
    if (fold(F.raw.name).replace(/[^a-z0-9]/g, '') === key) { if (F.cc === cc) return F.unit; hit = hit == null ? F.unit : hit; }
  }
  return hit;
}
const uniq = (a) => [...new Set(a.filter(Boolean))];

function renderCard(announce) {
  const box = $('card'), rows = $('card-rows'), act = $('card-act');
  cardDyn = null; cardAct = null;
  dropExclusions();
  if (!sel || !$('details').hidden || !$('layers').hidden) { box.hidden = true; return; }
  rows.textContent = '';
  $('card-name').hidden = true;
  $('card-main').hidden = true;
  setText($('card-sub'), '');
  act.hidden = true;
  let sentence = '';
  if (sel.type === 'unit') {
    const Un = model.units[sel.u], ccs = uniq(Un.members.map((F) => F.cc));
    const where = `${Un.name}, ${andList(ccs.map(ccName))}${Un.kind === 'group' ? ', cross-border unit' : ''}`;
    setText($('card-where'), where);
    $('card-main').hidden = false;
    const best = dlRow(rows, 'Best month so far', '–');
    const F0 = Un.members[0];
    dlRow(rows, 'Hydrocarbon', hcLabel(F0.hc));
    dlRow(rows, 'Status today', uniq(Un.members.map((F) => sentenceCase(F.raw.status))).join(', '));
    dlRow(rows, 'Operator', uniq(Un.members.map((F) => F.raw.operator)).join(', '));
    const F1 = Un.members.reduce((a, F) => (F.first != null && (!a || F.first < a.first) ? F : a), null);
    if (F1) dlRow(rows, 'First month reported', firstReported(F1));
    act.textContent = 'Details';
    act.hidden = false;
    cardAct = openDetails;
    cardDyn = () => {
      const cum = mode === 'cum', late = Un.members.filter((F) => ccOn[F.cc] && !reported(model, F.cc, shown));
      let value, unit = '', sub;
      if (late.length) { value = 'No figures'; sub = `No ${orList(uniq(late.map((F) => F.cc)))} figures for ${U.month(shown)}.`; }
      else {
        value = U.sig3(unitVal[sel.u] * U.QTY[qty][sys].f); unit = `${U.NNBSP}${U.unitOf(qty, sys, cum)}`;
        sub = `${U.QTY[qty].name} ${cum ? 'to' : 'in'} ${U.month(shown)}.`;
      }
      setText($('card-value'), value); setText($('card-unit'), unit); setText($('card-sub'), sub);
      const b = bestOf(sel.u, shown);
      setText(best, b ? `${U.amount(b.v, qty, sys, false)}, ${U.month(b.m)}` : 'None yet');
      return { value, unit, b };
    };
    const now = cardDyn();
    sentence = `${where}. ${now.unit ? `${U.QTY[qty].name} ${mode === 'cum' ? 'to' : 'in'} ${U.monthLong(shown)}: ${U.amountSpoken(unitVal[sel.u], qty, sys, mode === 'cum')}` : now.value}.`
      + `${now.b ? ` Best month so far: ${U.amountSpoken(now.b.v, qty, sys, false)}, ${U.monthLong(now.b.m)}.` : ''}`;
  } else if (sel.type === 'fac') {
    const fa = base.fac.raw[sel.i], name = titleCase(fa.name) || 'Unnamed installation';
    setText($('card-where'), `${KIND[base.fac.shape[sel.i]]}, ${ccName(fa.country)}`);
    setText($('card-name'), name);
    $('card-name').hidden = false;
    dlRow(rows, 'Phase', fa.phase ? sentenceCase(fa.phase) : null);
    dlRow(rows, 'In place from', fa.startYear);
    dlRow(rows, 'Until', fa.endYear);
    dlRow(rows, 'Field', fa.field ? titleCase(fa.field) : null);
    dlRow(rows, 'Operator', fa.operator);
    dlRow(rows, 'Position', U.coord(fa.lat, fa.lon));
    dlRow(rows, 'Id', fa.id);
    const u = fa.field && model ? unitByName(fa.field, fa.country) : null;
    if (u != null) { act.textContent = `Show ${model.units[u].name}`; act.hidden = false; cardAct = () => pickUnit(u); }
    sentence = `${$('card-where').textContent}. ${name}.`;
  } else if (sel.type === 'pipe') {
    const r = base.pipes[sel.i].raw;
    const name = r.name ? titleCase(r.name) : r.from && r.to ? `${titleCase(r.from)} to ${titleCase(r.to)}` : 'Unnamed pipeline';
    setText($('card-where'), `Pipeline, ${ccName(base.pipes[sel.i].cc)}`);
    setText($('card-name'), name);
    $('card-name').hidden = false;
    dlRow(rows, 'Medium', r.medium ? sentenceCase(r.medium) : 'Not reported');
    dlRow(rows, 'Diameter', isNum(r.dimIn) ? U.diameter(r.dimIn, sys) : 'Not reported');
    dlRow(rows, 'From', r.from ? titleCase(r.from) : null);
    dlRow(rows, 'To', r.to ? titleCase(r.to) : null);
    dlRow(rows, 'Phase', r.phase ? sentenceCase(r.phase) : null);
    dlRow(rows, 'Length', isNum(r.km) ? U.km(r.km) : null);
    dlRow(rows, 'Id', r.id);
    sentence = `Pipeline. ${name}.`;
  } else {
    const br = base.borders[sel.i];
    setText($('card-where'), 'Maritime boundary');
    setText($('card-name'), br.name || 'Maritime boundary');
    $('card-name').hidden = false;
    dlRow(rows, 'Between', [br.a, br.b].filter(Boolean).join(' and '));
    dlRow(rows, 'Type', br.type);
    setText($('card-sub'), 'Maritime boundaries: Flanders Marine Institute, Maritime Boundaries Geodatabase, marineregions.org (CC BY 4.0).');
    sentence = `Maritime boundary. ${br.name || ''}.`;
  }
  box.hidden = false;
  placeCard();
  if (announce) say(sentence);
}
/* The card sits at the plate's top left, and moves to the bottom left whenever it would cover what was
 * tapped (and stays at the top if both would). */
function placeCard() {
  const box = $('card'), p = selPoint();
  dropExclusions();
  if (box.hidden) return;
  const covers = () => p && p[0] > box.offsetLeft - 12 && p[0] < box.offsetLeft + box.offsetWidth + 12
    && p[1] > box.offsetTop - 12 && p[1] < box.offsetTop + box.offsetHeight + 12;
  box.classList.remove('low');
  if (covers()) {
    box.classList.add('low');
    if (covers()) box.classList.remove('low');
  }
}

/* ── the sheet's slot: a field's details, or the map's layers ────────────── */

let detailsDyn = null;
function openSheet(id) {
  closeSheets(true);
  $(id).hidden = false;
  document.body.classList.add('side');
  $('btn-layers').setAttribute('aria-expanded', String(id === 'layers'));
  renderCard();
}
function closeSheets(quiet) {
  const was = !$('details').hidden || !$('layers').hidden;
  $('details').hidden = true;
  $('layers').hidden = true;
  detailsDyn = null;
  document.body.classList.remove('side');
  $('btn-layers').setAttribute('aria-expanded', 'false');
  if (was && !quiet) renderCard();
}
function openDetails() {
  if (!sel || sel.type !== 'unit') return;
  openSheet('details');
  renderDetails();
  $('details-close').focus({ preventScroll: true });
}

function unitSeries(Un) {
  // Per-day liquids and gas over the unit's whole life: liquids as Sm³, gas
  // as oil equivalent on the same axis, so the two lines share one scale honestly.
  let x0 = Infinity;
  for (const F of Un.members) if (F.first != null) x0 = Math.min(x0, F.first);
  if (!Number.isFinite(x0)) return null;
  const x1 = model.lastMonth, n = x1 - x0 + 1;
  const liq = new Float32Array(n), gas = new Float32Array(n), cl = new Float64Array(n), cg = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const m = x0 + j, d = daysIn(m);
    let l = 0, g = 0, a = 0, b = 0;
    for (const F of Un.members) { l += monthly(F, 'liq', m); g += monthly(F, 'gas', m); a += cumAt(F, 'liq', m); b += cumAt(F, 'gas', m); }
    liq[j] = l / d; gas[j] = g / d; cl[j] = a; cg[j] = b;
  }
  return { x0, x1, liq, gas, cl, cg };
}

let tok = null;
const tokens = () => tok || (tok = { ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), line: css('--line'), liq: css('--chart-liq'), gas: css('--chart-gas') });
function drawChart(cv, S) {
  const w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight);
  const r = Math.min(3, window.devicePixelRatio || 1), T = tokens();
  if (cv.width !== Math.round(w * r)) cv.width = Math.round(w * r);
  if (cv.height !== Math.round(h * r)) cv.height = Math.round(h * r);
  const c = cv.getContext('2d');
  c.setTransform(r, 0, 0, r, 0, 0);
  c.clearRect(0, 0, w, h);
  // Rate draws the rates; Cumulative the rising volumes to date.
  const cum = mode === 'cum', LQ = cum ? S.cl : S.liq, GS = cum ? S.cg : S.gas;
  const pl = 2, pr = 2, pt = 16, pb = 14, iw = w - pl - pr, ih = h - pt - pb;
  let ymax = 0;
  for (let j = 0; j < LQ.length; j++) ymax = Math.max(ymax, LQ[j], GS[j] / 1000);
  ymax = ymax || 1;
  const n = S.x1 - S.x0;
  const X = (m) => pl + (n > 0 ? ((m - S.x0) / n) * iw : iw / 2);
  const Y = (v) => pt + ih - (v / ymax) * ih;
  c.font = SMALL_FONT;
  c.fillStyle = T.line;
  c.fillRect(pl, pt, iw, 1);
  c.fillRect(pl, pt + ih, iw, 1);
  c.fillStyle = T.ink3;
  c.textBaseline = 'bottom';
  c.textAlign = 'left';
  c.fillText(U.amount(ymax, 'oe', sys, cum), pl, pt - 2);
  c.fillStyle = T.ink2;
  c.textBaseline = 'top';
  const y0 = monthYear(S.x0), y1 = monthYear(S.x1);
  c.fillText(String(y0), pl, pt + ih + 2);
  c.textAlign = 'right';
  c.fillText(String(y1), w - pr, pt + ih + 2);
  c.textAlign = 'center';
  for (let y = Math.ceil((y0 + 1) / 10) * 10; y < y1 - 3; y += 10) {
    const x = X((y - EPOCH) * 12);
    if (x > pl + 30 && x < w - pr - 30) c.fillText(String(y), x, pt + ih + 2);
  }
  c.lineJoin = 'round';
  c.lineWidth = 1.5;
  const line = (arr, div, col) => {
    c.strokeStyle = col;
    c.beginPath();
    for (let j = 0; j < arr.length; j++) { const x = X(S.x0 + j), y = Y(arr[j] / div); if (j) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  };
  line(GS, 1000, T.gas);
  line(LQ, 1, T.liq);
  if (shown >= S.x0 && shown <= S.x1) {
    const x = Math.round(X(shown)) + 0.5, j = shown - S.x0;
    c.fillStyle = T.ink;
    c.fillRect(x - 0.5, pt, 1, ih);
    for (const [v, col] of [[GS[j] / 1000, T.gas], [LQ[j], T.liq]]) {
      c.fillStyle = col;
      c.beginPath(); c.arc(x, Y(v), 3, 0, Math.PI * 2); c.fill();
    }
  }
}

/* The first month of a field's series is not its first production when the series starts late (data.js
 * sets lateStart): the value says so in the words cumNotes() uses. */
function firstReported(F) {
  const t = U.month(F.first);
  if (F.lateStart === 'series') return `${t}, when the ${CC_ADJ[F.cc]} series starts`;
  if (F.lateStart === 'field') return `${t}; earlier months are not in the series`;
  return t;
}
/* Cumulative: how the sum compares with the regulator's own total, and where it starts. */
function cumNotes(F) {
  const out = [];
  if (F.first == null) return out;
  const q = qty;
  const rl = isNum(F.raw.cumLiq) ? F.raw.cumLiq : null, rg = isNum(F.raw.cumGas) ? F.raw.cumGas : null;
  const reg = q === 'liq' ? rl : q === 'gas' ? rg
    : (rl != null || rg != null) && (rl != null || !F.liq) && (rg != null || !F.gas) ? (rl || 0) + (rg || 0) / 1000 : null;
  const s0 = q === 'liq' ? (F.liq ? F.liqS : null) : q === 'gas' ? (F.gas ? F.gasS : null) : F.first;
  if (reg != null && s0 != null) {
    out.push(`The regulator's total to date is ${U.amount(reg, q, sys, true)}; this series sums to ${U.amount(cumAt(F, q, 1e9), q, sys, true)} from ${U.month(s0)}.`);
  }
  const ctry = ccName(F.cc);
  let t = `The sum starts in ${U.month(F.first)}, the first month of this field's ${ctry} series.`;
  if (F.lateStart === 'series') t += ` The ${ctry} series itself begins then, so production before ${U.month(F.first)} is not included.`;
  else if (F.lateStart === 'field') t += ` The field was discovered in ${F.raw.discYear}, long before; if it produced before ${U.month(F.first)}, that is not in the series and not included.`;
  if (isInt(F.raw.monthlyFrom) && F.first < F.raw.monthlyFrom) t += ` Before ${U.month(F.raw.monthlyFrom)} it grows in equal monthly steps, because each year's total is spread evenly over its months.`;
  out.push(t);
  return out;
}
function peakOf(F) {
  if (F.first == null) return null;
  let best = 0, bm = -1;
  for (let m = F.first; m < F.end; m++) {
    const v = monthly(F, qty, m) / daysIn(m);
    if (v > best) { best = v; bm = m; }
  }
  return bm >= 0 ? { v: best, m: bm } : null;
}

function renderDetails() {
  const b = $('details-body');
  b.textContent = '';
  detailsDyn = null;
  if (!sel || sel.type !== 'unit') return;
  const Un = model.units[sel.u], isG = Un.kind === 'group';
  setText($('details-title'), Un.name);
  const S = unitSeries(Un);
  let cv = null, keyL = null, keyG = null;
  if (S) {
    cv = el('canvas', 'chart');
    cv.setAttribute('role', 'img');
    const key = el('div', 'chart-key');
    keyL = el('span', 'liq'); keyG = el('span', 'gas');
    key.append(keyL, keyG);
    b.append(cv, key);
    // a touch or a drag on the chart sets the month, as the track does
    const scrub = (e) => {
      const r = cv.getBoundingClientRect();
      const t = clamp((e.clientX - r.left - 2) / Math.max(1, r.width - 4), 0, 1);
      if (playing) setPlaying(false);
      setMonth(S.x0 + t * (S.x1 - S.x0));
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } cv.drag = true; scrub(e); });
    cv.addEventListener('pointermove', (e) => { if (cv.drag) scrub(e); });
    const end = () => { cv.drag = false; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  } else b.append(el('p', 'sheet-note', 'No production is reported for this field.'));
  const memberCells = [];
  let sumCell = null;
  if (isG) {
    b.append(el('h3', null, 'Cross-border unit'));
    const tbl = el('table', 'members');
    for (const F of Un.members) {
      const tr = el('tr'), td = el('td');
      tr.append(el('td', null, `${CC_ADJ[F.cc]} side`), el('td', null, isNum(F.raw.share) ? `${U.percent(F.raw.share)} share` : 'Share not published'), td);
      tbl.append(tr);
      memberCells.push([F, td]);
    }
    const tr = el('tr', 'sum');
    tr.append(el('td', null, 'Unit total'), el('td'), (sumCell = el('td')));
    tbl.append(tr);
    b.append(tbl);
    if (Un.g.note) b.append(el('p', 'sheet-note', `${Un.g.note}.`));
  }
  const statusCells = [];
  for (const F of Un.members) {
    b.append(el('h3', null, isG ? `${CC_ADJ[F.cc]} side, ${F.id}` : 'Details'));
    const dl = el('dl');
    dlRow(dl, 'Operator', F.raw.operator);
    dlRow(dl, 'Hydrocarbon', hcLabel(F.hc));
    dlRow(dl, 'Status today', F.raw.status ? sentenceCase(F.raw.status) : 'Not reported');
    if (F.hist) { const dd = dlRow(dl, 'Status then', '–'); statusCells.push([F, dd, dd.previousSibling]); }
    dlRow(dl, 'Discovered', F.raw.discYear);
    if (F.first != null) {
      dlRow(dl, 'First month reported', firstReported(F));
      if (F.end - 1 < (model.ccLast[F.cc] ?? model.lastMonth)) dlRow(dl, 'Last production', U.month(F.end - 1));
    }
    const pk = peakOf(F);
    if (pk) dlRow(dl, `Best month on record, ${U.QTY[qty].name.toLowerCase()}`, `${U.amount(pk.v, qty, sys, false)}, ${U.month(pk.m)}`);
    if (isNum(F.raw.cumLiq)) dlRow(dl, 'Liquids to date', U.amount(F.raw.cumLiq, 'liq', sys, true));
    if (isNum(F.raw.cumGas)) dlRow(dl, 'Gas to date', U.amount(F.raw.cumGas, 'gas', sys, true));
    if (isNum(F.raw.share) && !isG) dlRow(dl, 'National share', U.percent(F.raw.share));
    dlRow(dl, 'Regulator id', F.id);
    b.append(dl);
    if (F.delineation) b.append(el('p', 'sheet-note', 'The outline is the Danish Energy Agency\'s field delineation: an administrative area drawn on block corners, not the shape of the reservoir. Denmark publishes no reservoir outlines.'));
    if (isInt(F.raw.monthlyFrom)) b.append(el('p', 'sheet-note', `Before ${U.month(F.raw.monthlyFrom)} the ${ccName(F.cc)} figures are annual totals spread evenly over the months, so month-to-month changes before then are not real.`));
    if (mode === 'cum') for (const t of cumNotes(F)) b.append(el('p', 'sheet-note', t));
  }
  detailsDyn = () => {
    const cum = mode === 'cum', dd = daysIn(shown);
    if (S) {
      drawChart(cv, S);
      const n = S.liq.length, j = shown - S.x0, inR = j >= 0 && j < n;
      const lv = cum ? (j >= 0 ? S.cl[Math.min(j, n - 1)] : 0) : inR ? S.liq[j] : 0;
      const gv = cum ? (j >= 0 ? S.cg[Math.min(j, n - 1)] : 0) : inR ? S.gas[j] : 0;
      setText(keyL, `Liquids ${U.amount(lv, 'liq', sys, cum)}`);
      setText(keyG, `Gas ${U.amount(gv, 'gas', sys, cum)}`);
      if (!keyL.firstChild || keyL.firstChild.nodeName !== 'I') { keyL.prepend(el('i')); keyG.prepend(el('i')); }
      cv.setAttribute('aria-label', `${cum ? 'Cumulative production' : 'Production history'} from ${monthYear(S.x0)} to ${monthYear(S.x1)}, liquids and gas as oil equivalent on one scale. ${U.monthLong(shown)}: ${keyL.textContent}, ${keyG.textContent}.`);
    }
    const cellOf = (F) => (cum ? cumAt(F, qty, shown) : monthly(F, qty, shown) / dd);
    for (const [F, td] of memberCells) setText(td, reported(model, F.cc, shown) ? U.amount(cellOf(F), qty, sys, cum) : 'No figures');
    if (sumCell) setText(sumCell, Un.members.every((F) => reported(model, F.cc, shown)) ? U.amount(Un.members.reduce((a, F) => a + cellOf(F), 0), qty, sys, cum) : 'No figures');
    for (const [F, dd2, dt] of statusCells) {
      const h = statusAt(F, shown);
      setText(dt, `Status in ${U.month(shown)}`);
      setText(dd2, h ? sentenceCase(h[2]) : 'Not yet in the register');
    }
  };
  detailsDyn();
}

/* ── Find and About: full-height panels, focus held inside, Escape closes ── */

let panelFrom = null;
const panelOpen = () => !$('about').hidden || !$('find').hidden;
const BEHIND = ['head', 'map-wrap', 'caption', 'details', 'layers', 'player'];
function openPanel(id) {
  panelFrom = document.activeElement;
  $(id).hidden = false;
  for (const b of BEHIND) $(b).inert = true;
}
function closePanel(id) {
  if ($(id).hidden) return;
  $(id).hidden = true;
  for (const b of BEHIND) $(b).inert = false;
  const back = panelFrom && panelFrom.isConnected && !panelFrom.closest('[hidden]') ? panelFrom : $('stamp');
  try { back.focus({ preventScroll: true }); } catch { /* fine */ }
  schedule();
}
for (const id of ['about', 'find']) {
  $(id).addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const keys = [...$(id).querySelectorAll('button:not([hidden]), input')];
    const i = keys.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); keys[keys.length - 1].focus(); }
    else if (!e.shiftKey && i === keys.length - 1) { e.preventDefault(); keys[0].focus(); }
  });
}

function showAbout() {
  const list = $('about-list'), notes = $('about-notes'), srcs = $('about-sources');
  list.textContent = ''; notes.textContent = ''; srcs.textContent = '';
  const row = (k, v) => list.append(el('dt', null, k), el('dd', null, v));
  const p = (t) => notes.append(el('p', null, t));
  if (model) {
    const withSeries = model.fields.filter((F) => F.liq || F.gas).length;
    row('Fields', `${U.int(model.fields.length)}: ${U.int(withSeries)} with production figures, ${U.int(model.noOutline)} without an outline (drawn as a circle or a dot)`);
    row('Cross-border units', U.int(model.groups.length));
    for (const c of CC) if (model.ccFirst[c] != null) row(ccName(c), `monthly figures from ${U.month(model.ccFirst[c])} to ${U.month(model.ccLast[c])}`);
    row('Production built', U.full(Date.parse(model.generatedAt)));
  }
  if (base) {
    row('Installations', `${U.int(base.counts.facilities)}${base.fac.skipped ? `, of which ${U.int(base.fac.skipped)} wind turbines and geothermal plants are not drawn` : ''}`);
    row('Pipelines', U.int(base.counts.pipelines));
    row('Maritime boundary lines', U.int(base.counts.borders));
    row('Map built', U.full(Date.parse(base.generatedAt)));
  }
  row('Conversions', `1${U.NNBSP}Sm³ = ${U.BBL}${U.NNBSP}bbl; 1${U.NNBSP}Sm³ of gas = ${U.SCF}${U.NNBSP}scf; 1${U.NNBSP}Sm³ of liquids or 1${U.NNBSP}000${U.NNBSP}Sm³ of gas counts as 1${U.NNBSP}Sm³ o.e. (${U.BBL}${U.NNBSP}boe)`);
  if (model) {
    const spread = new Map();
    for (const F of model.fields) if (isInt(F.raw.monthlyFrom)) {
      const e = spread.get(F.cc) || { n: 0, from: F.raw.monthlyFrom };
      e.n++; e.from = Math.min(e.from, F.raw.monthlyFrom);
      spread.set(F.cc, e);
    }
    for (const [cc, e] of spread) p(`${ccName(cc)}: annual figures are spread evenly over the months before ${U.monthLong(e.from)} (${U.int(e.n)} field${e.n === 1 ? '' : 's'}). Month-to-month changes before then are not real.`);
    const nS = model.fields.filter((F) => F.lateStart === 'series').length, nF = model.fields.filter((F) => F.lateStart === 'field').length;
    p(`Cumulative sums start where each regulator's series starts, and production before then is not included. ${U.int(nS)} field${nS === 1 ? ' was' : 's were'} already producing when ${nS === 1 ? 'its' : 'their'} series began; ${U.int(nF)} more ${nF === 1 ? 'was' : 'were'} discovered ten or more years before ${nF === 1 ? 'its' : 'their'} series starts, so ${nF === 1 ? 'its sum' : 'their sums'} may miss earlier years. Each field's details say which.`);
    if (model.groups.length) p(`Cross-border units, each side reported by its own regulator and drawn with its own share: ${model.groups.map((G) => `${G.name} (${G.members.map((F) => `${F.cc}${isNum(F.raw.share) ? ` ${U.percent(F.raw.share)}` : ''}`).join(', ')})`).join('; ')}.`);
    const mt = snap.matching || {};
    if (Array.isArray(mt.crossBorderCandidates) && mt.crossBorderCandidates.length) p(`Same name on both sides of a border but not confirmed as one field, so shown separately: ${mt.crossBorderCandidates.map((c) => titleCase(c.name)).join(', ')}.`);
  }
  for (const s of allSources(snap)) {
    const d = el('p', 'src');
    d.append(el('span', 'src-name', s.name || s.id));
    if (s.licence) d.append(el('span', 'src-term', `License: ${s.licence}`));
    if (s.attribution) d.append(el('span', null, s.attribution));
    if (s.url) d.append(el('span', 'src-term', String(s.url).replace(/^[a-z]+:\/\//i, '')));
    if (s.cadence) d.append(el('span', 'src-term', `Updated: ${s.cadence}`));
    srcs.append(d);
  }
  openPanel('about');
  $('about-body').scrollTop = 0;
  $('about-close').focus({ preventScroll: true });
}

function openFind() {
  if (!model) return;
  $('find-input').value = '';
  runSearch();
  openPanel('find');
  $('find-input').focus({ preventScroll: true });
}
let findSay = 0;
function runSearch() {
  const list = $('find-list'), q = fold($('find-input').value).trim();
  list.textContent = '';
  $('find-clear').hidden = !$('find-input').value;
  clearTimeout(findSay);
  if (!q || !model) return;
  const starts = [], within = [];
  for (const e of model.searchIndex) {
    if (e.key.startsWith(q) || e.key.split(/[\s-]/).some((w) => w.startsWith(q))) starts.push(e);
    else if (e.key.includes(q)) within.push(e);
  }
  const all = starts.length + within.length, hits = starts.concat(within).slice(0, 12);
  // VoiceOver hears the count once typing settles, not a word per keystroke
  findSay = setTimeout(() => say(!all ? 'No field by that name.'
    : `${all} ${all === 1 ? 'field matches' : 'fields match'}${all > hits.length ? `; the first ${hits.length} are listed` : ''}.`), 700);
  if (!hits.length) { list.append(el('li', 'none', 'No field by that name.')); return; }
  for (const e of hits) {
    const Un = model.units[e.u], li = el('li'), btn = el('button');
    btn.type = 'button';
    btn.append(el('span', 'name', Un.name), el('span', 'cc', e.cc.join(', ')),
      el('span', 'status', Un.kind === 'group' ? 'Cross-border unit' : normStatus(Un.f.raw.status) || ''));
    btn.addEventListener('click', () => pickUnit(e.u));
    li.append(btn);
    list.append(li);
  }
}
function pickUnit(u) {
  closePanel('find');
  const Un = model.units[u];
  let changed = false;
  for (const F of Un.members) if (!ccOn[F.cc]) { ccOn[F.cc] = true; changed = true; }
  if (changed) onFilterChange();
  // A field not yet found at the month shown would be invisible: move the
  // month to its first production (or its discovery).
  if (!unitVis[u]) {
    const F = Un.members[0];
    const m = F.first != null ? F.first : F.disc != null ? (F.disc - EPOCH) * 12 : month;
    setMonth(m);
    computeMonth(month); shown = month; dirty = true; timeDirty = true;
  }
  select({ type: 'unit', u }, { announce: true });
  let bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const F of Un.members) bb = [Math.min(bb[0], F.bbox[0]), Math.min(bb[1], F.bbox[1]), Math.max(bb[2], F.bbox[2]), Math.max(bb[3], F.bbox[3])];
  flyTo(bb, 40);
}

/* ── the month: play, the keys, the track ────────────────────────────────── */

function setMonth(m) {
  if (!model) return;
  month = clamp(Math.round(m), 0, model.lastMonth);
  track.wanted = null;
  store(STORE.month, String(month));
  schedule();
}
function setPlaying(on) {
  if (!model) on = false;
  if (on === playing) return;
  playing = on;
  // an <svg> has no `hidden` property, so the attribute itself is what is toggled
  $('ico-play').toggleAttribute('hidden', on);
  $('ico-pause').toggleAttribute('hidden', !on);
  $('btn-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  playAcc = 0; lastPlay = 0;
  if (on) {
    track.wanted = null;
    // play stops at the newest month every shown country has reported (B2); Play there starts over
    if (month >= commonMonth(model, ccOn)) month = 0;
    schedule();
  } else store(STORE.month, String(month));
}
/* The year keys keep the focus on themselves, so VoiceOver is told the new month in words (the track,
 * a role="slider", announces its own aria-valuetext when it changes). */
const stepBy = (d) => { if (!model) return; setPlaying(false); setMonth(month + d); say(U.monthLong(month)); };

const track = createTrack(slider, $('track'), {
  onStart() { if (playing) setPlaying(false); timeDirty = true; },
  onScrub() { schedule(); },
  onEnd() { if (track.wanted !== null) store(STORE.month, String(track.wanted)); timeDirty = true; schedule(); },
  onKey(k) {
    if (!model) return;
    setPlaying(false);
    setMonth(k === 'home' ? 0 : k === 'end' ? model.lastMonth : month + k);
  },
});
new ResizeObserver(() => { track.resize(); timeDirty = true; schedule(); }).observe(slider);

/* ── the frame loop ──────────────────────────────────────────────────────── */

let raf = 0, dirty = true, monthDirty = true, timeDirty = true, lastPlay = 0, playAcc = 0, logRows = null;
function schedule() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }
function requestRender() { dirty = true; schedule(); }
/** Something the month's figures depend on changed (the quantity, the mode, the countries, the rings). */
function requestMonth() { monthDirty = true; timeDirty = true; schedule(); }

function loop(now) {
  raf = 0;
  // About and Find cover the plate: nothing is drawn under them and play waits, so closing one shows
  // the month it was opened on, and play goes on from there
  if (panelOpen()) { lastPlay = 0; return; }
  stats.frames++;
  // a finger on the plate holds the play clock, as About does: the gesture draws the frame it started
  // on, so the month must not move under it; play goes on from there when the finger lifts
  if (playing && model && gesture) lastPlay = 0;
  else if (playing && model) {
    const dt = lastPlay ? Math.min(100, now - lastPlay) : 0;
    lastPlay = now;
    playAcc += (dt / 1000) * PLAY_RATE;
    if (playAcc >= 1) {
      // whole months only, under Reduce Motion or not: no frame is a blend of two months
      const n = Math.floor(playAcc), end = commonMonth(model, ccOn);
      playAcc -= n;
      if (month + n >= end) { month = Math.max(month, end); setPlaying(false); } else month += n;
    }
  }
  if (model && track.wanted !== null && track.wanted !== month) month = track.wanted;
  if (fly) { tickFly(now); dirty = true; }
  if (model && (month !== shown || monthDirty)) {
    computeMonth(month);
    shown = month;
    monthDirty = false;
    dirty = true;
    timeDirty = true;
  }
  if (dirty) { dirty = false; render(); stats.draws++; }
  if (timeDirty) { timeDirty = false; syncTime(); }
  if (logRows) logRows.push({ wanted: track.wanted ?? month, shown, label: $('valid-time').textContent, now: Number(slider.getAttribute('aria-valuenow')), pressed: track.pressed, playing });
  if (playing || fly) schedule();
}

/* ── map gestures ────────────────────────────────────────────────────────── */

const pointers = new Map();
let gesture = null;
let rect = canvas.getBoundingClientRect();
function startGesture() {
  const pts = [...pointers.values()];
  if (pts.length === 1) {
    gesture = { type: 'pan', x: pts[0].x, y: pts[0].y, sx: pts[0].x, sy: pts[0].y, moved: gesture ? gesture.moved : false, t0: performance.now() };
  } else if (pts.length >= 2) {
    const [a, b] = pts;
    const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
    gesture = { type: 'pinch', moved: true, d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k0: view.k,
      X: (mx - view.tx) / view.k, Y: (my - view.ty) / view.k };
  }
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  endFly();                 // a touch ends a flight at its destination, never midway (B13)
  rect = canvas.getBoundingClientRect();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
  if (!pointers.size) { if (raf) { cancelAnimationFrame(raf); raf = 0; loop(performance.now()); } takeSnapshot(); }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  startGesture();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || !gesture) return;
  p.x = e.clientX; p.y = e.clientY;
  if (gesture.type === 'pan' && pointers.size === 1) {
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    gesture.x = e.clientX; gesture.y = e.clientY;
    if (Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 6) gesture.moved = true;
    if (gesture.moved) { view.tx += dx; view.ty += dy; clampView(); requestRender(); }
  } else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
    view.k = clamp(gesture.k0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0, kMin, fitK * Z_MAX);
    view.tx = mx - gesture.X * view.k;
    view.ty = my - gesture.Y * view.k;
    clampView();
    requestRender();
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const wasTap = gesture && gesture.type === 'pan' && !gesture.moved && pointers.size === 1
    && performance.now() - gesture.t0 < 450 && e.type === 'pointerup';
  pointers.delete(e.pointerId);
  if (pointers.size > 0) { startGesture(); return; }
  gesture = null;
  if (wasTap) onTap(e.clientX - rect.left, e.clientY - rect.top);
  saveView();
  if (!$('card').hidden) placeCard();
  requestRender();            // once more, so the static cache is rebuilt
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
/* The map by keyboard: the arrow keys pan a quarter of the plate, plus and minus zoom about its middle. */
canvas.addEventListener('keydown', (e) => {
  const pan = { ArrowLeft: [W / 4, 0], ArrowRight: [-W / 4, 0], ArrowUp: [0, H / 4], ArrowDown: [0, -H / 4] }[e.key];
  if (pan) { e.preventDefault(); panBy(pan[0], pan[1]); } else if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(W / 2, H / 2, 2); } else if (e.key === '-') { e.preventDefault(); zoomAt(W / 2, H / 2, 0.5); }
});

/* A tap selects at once; a second tap in the same place soon after zooms in,
 * so the selection never waits on a double-tap timer. */
let lastTap = null;
function onTap(sx, sy) {
  const now = performance.now();
  if (!$('layers').hidden) { closeSheets(); return; }
  if (lastTap && now - lastTap.t < 300 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 24) {
    lastTap = null;
    zoomAt(sx, sy, 2);
    return;
  }
  lastTap = { x: sx, y: sy, t: now };
  const h = hitTest(sx, sy);
  if (h && (h.type === 'pipe' || h.type === 'border')) h.at = [sx, sy, { ...view }];
  select(h, { announce: true });
}

/* ── controls ────────────────────────────────────────────────────────────── */

function onFilterChange() {
  store(STORE.cc, ccOn);
  for (const b of $('country-rows').children) b.setAttribute('aria-pressed', String(ccOn[b.dataset.cc]));
  if (sel && sel.type === 'unit' && model.units[sel.u].members.every((F) => !ccOn[F.cc])) select(null);
  updateStamp();
  requestMonth();
  requestRender();
}
/* Radio groups: one tab stop each, the arrow keys move the choice. */
function radios(group, attr, pick) {
  const bs = [...$(group).children];
  for (const b of bs) b.addEventListener('click', () => pick(b.dataset[attr]));
  $(group).addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = bs.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const n = bs[(i + d + bs.length) % bs.length];
    pick(n.dataset[attr]);
    n.focus();
  });
}
function syncRadios() {
  for (const b of $('qty').children) { const on = b.dataset.q === qty; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
  for (const b of $('mode').children) { const on = b.dataset.m === mode; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
  const pk = $('btn-peaks');
  pk.setAttribute('aria-pressed', String(layerOn.peaks && mode === 'rate'));
  pk.setAttribute('aria-disabled', String(mode === 'cum' || !hasFigures()));
}
function onChoice() {
  syncRadios();
  updateLegend();
  requestMonth();
  requestRender();
  if (!$('details').hidden) renderDetails();
  if (sel) renderCard();
}
radios('qty', 'q', (q) => { if (q === qty) return; qty = q; store(STORE.qty, q); onChoice(); });
radios('mode', 'm', (m) => { if (m === mode) return; mode = m === 'cum' ? 'cum' : 'rate'; store(STORE.mode, mode); onChoice(); });
$('btn-units').addEventListener('click', () => { sys = sys === 'si' ? 'field' : 'si'; store(STORE.sys, sys); onChoice(); });
$('btn-peaks').addEventListener('click', () => {
  if (!hasFigures()) return;
  if (mode === 'cum') { say('Rings show with Rate.'); return; }
  layerOn.peaks = !layerOn.peaks;
  store(STORE.layers, layerOn);
  onChoice();
});
function syncLayers() {
  for (const b of $('layer-rows').children) b.setAttribute('aria-pressed', String(!!layerOn[b.dataset.layer]));
}
for (const b of $('layer-rows').children) {
  b.addEventListener('click', () => {
    const k = b.dataset.layer;
    layerOn[k] = !layerOn[k];
    store(STORE.layers, layerOn);
    syncLayers();
    if (sel && ((sel.type === 'fac' && !layerOn.facs) || (sel.type === 'pipe' && !layerOn.pipes) || (sel.type === 'border' && !layerOn.borders))) select(null, { keepSheet: true });
    requestRender();
  });
}
for (const b of $('country-rows').children) b.addEventListener('click', () => { ccOn[b.dataset.cc] = !ccOn[b.dataset.cc]; onFilterChange(); });
$('btn-layers').addEventListener('click', () => { if ($('layers').hidden) openSheet('layers'); else closeSheets(); });
$('layers-close').addEventListener('click', () => closeSheets());
$('details-close').addEventListener('click', () => closeSheets());
$('zoom-in').addEventListener('click', () => zoomAt(W / 2, H / 2, 2));
$('zoom-out').addEventListener('click', () => zoomAt(W / 2, H / 2, 0.5));
$('zoom-home').addEventListener('click', () => { if (base) { const c = homeCenter(); flyTo([c[0], c[1], c[0], c[1]], 1, fitK); } });
$('btn-find').addEventListener('click', openFind);
$('find-input').addEventListener('input', runSearch);
$('find-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = $('find-list').querySelector('button'); if (b) b.click(); } });
$('find-clear').addEventListener('click', () => { $('find-input').value = ''; runSearch(); $('find-input').focus(); });
$('find-close').addEventListener('click', () => closePanel('find'));
$('stamp').addEventListener('click', showAbout);
$('about-close').addEventListener('click', () => closePanel('about'));
$('about-close-2').addEventListener('click', () => closePanel('about'));
$('card-close').addEventListener('click', () => select(null));
$('card-act').addEventListener('click', () => { if (cardAct) cardAct(); });
$('btn-play').addEventListener('click', () => setPlaying(!playing));
$('btn-back').addEventListener('click', () => stepBy(-12));
$('btn-fwd').addEventListener('click', () => stepBy(12));
// focus follows the two focus keys only when the keyboard pressed them (a click's detail is 0)
$('focus-key').addEventListener('click', (e) => setFocus(true, { kbd: e.detail === 0 }));
$('focus-exit').addEventListener('click', (e) => setFocus(false, { kbd: e.detail === 0 }));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('about').hidden) closePanel('about');
  else if (!$('find').hidden) closePanel('find');
  else if (!$('details').hidden || !$('layers').hidden) closeSheets();
  else if (sel) select(null);
  else if (focusMode) setFocus(false, { kbd: true });
  else return;
  e.preventDefault();
});
darkMq.addEventListener('change', () => {
  buildPalette();
  tok = null;
  track.invalidate();
  updateLegend();
  timeDirty = true;
  requestRender();
});
reducedMq.addEventListener('change', () => { if (reduced()) endFly(); });

/* ── focus mode: the plate, the player, the stamp, the caption line and the
 * credits; everything else leaves, hidden and inert. Remembered as sa.focus. ── */

let leaveTimer = 0;
function setFocus(on, { kbd = false, boot = false } = {}) {
  if (on === focusMode && !boot) return;
  focusMode = on;
  if (!boot) store(STORE.focus, on ? '1' : '0');
  const leaving = [$('head'), $('keys'), $('legend-scale')];
  clearTimeout(leaveTimer);
  if (on && !boot) { closeSheets(true); if (sel) select(null); }   // a tap in focus mode opens the card again
  const apply = () => {
    for (const e of leaving) { e.classList.remove('leaving'); e.hidden = on; e.inert = on; }
    if (on) $('caption').prepend($('stamp')); else $('stamp-home').append($('stamp'));
    $('focus-exit').hidden = !on;
    document.body.classList.toggle('focus', on);
    dropExclusions();
    if (!on) updateLegend();
    requestRender();
    if (kbd && !boot) { const k = $(on ? 'focus-exit' : 'focus-key'); try { k.focus({ focusVisible: true }); } catch { k.focus(); } }
  };
  if (on && !boot && !reduced()) {
    for (const e of leaving) { e.inert = true; e.classList.add('leaving'); }
    leaveTimer = setTimeout(apply, 160);
  } else apply();
  if (!boot) say(on ? 'Controls hidden. Press Escape or the corner key to show them.' : 'Controls shown.');
}

/* ── loading ─────────────────────────────────────────────────────────────── */

async function fetchJSON(name) {
  try {
    const r = await fetch(`./data/${name}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`data/${name} could not be read (HTTP ${r.status}).`);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      throw new Error(`data/${name} is not valid JSON${text.trim().startsWith('<') ? '; it looks like a web page was written over it' : ''}.`);
    }
    return { data, sig: `${data && data.generatedAt}|${text.length}` };
  } finally { readCount++; if (!model) updateStamp(); }
}

let loadGen = 0, loaded = false;
async function loadAll() {
  const gen = ++loadGen;
  readCount = 0;
  const [gr, sr] = await Promise.allSettled([fetchJSON('geo.json'), fetchJSON('snapshot.json')]);
  if (gen !== loadGen) return;
  let baseChanged = false;
  if (gr.status === 'rejected') {
    setProblem('geo', gr.reason.message + (base ? ' Showing the map as last read.' : ''));
  } else if (!base || base.sig !== gr.value.sig) {
    const why = validateGeo(gr.value.data);
    if (why) setProblem('geo', `data/geo.json is not a Shelf Atlas map: ${why}.${base ? ' Showing the map as last read.' : ''}`);
    else {
      try {
        const B = buildBase(gr.value.data);
        B.sig = gr.value.sig;
        base = B;
        baseChanged = true;
        cache = null;
        loadBathy(gr.value.data.bathymetry).then(() => { cache = null; requestRender(); });
        setProblem('geo', null);
      } catch (e) { setProblem('geo', `data/geo.json is not a Shelf Atlas map: ${e.message}.`); }
    }
  } else setProblem('geo', null);

  if (sr.status === 'rejected') {
    setProblem('snapshot', sr.reason.message + (model ? ' Showing production as last read.' : ''));
  } else if (base && (baseChanged || !model || model.sig !== sr.value.sig)) {
    const s = sr.value.data;
    const why = validateSnap(s);
    if (why) setProblem('snapshot', `data/snapshot.json is not a Shelf Atlas snapshot: ${why}.${model ? ' Showing production as last read.' : ''}`);
    else {
      try {
        const keep = sel ? selKey(sel) : recall(STORE.sel);
        const M = buildModel(s, base.outlines);
        M.sig = sr.value.sig;
        model = M;
        snap = s;
        recKey = '';
        setProblem('snapshot', M.fields.length ? null
          : 'data/snapshot.json holds no fields yet: only the basemap has been built. Production appears when the next build lands.');
        track.setModel(M.lastMonth + 1, EPOCH);
        slider.setAttribute('aria-valuemax', String(M.lastMonth));
        const stored = recall(STORE.month);
        month = clamp(!loaded && stored != null && isInt(Number(stored)) ? Number(stored) : loaded ? month : M.defaultMonth, 0, M.lastMonth);
        computeMonth(month);
        shown = month;
        monthDirty = false;
        timeDirty = true;
        sel = null;
        const r = resolveSel(keep);
        if (r) select(r, { keepSheet: true }); else closeSheets();
        $('credits').textContent = creditLine(snap);
      } catch (e) { setProblem('snapshot', `data/snapshot.json is not a Shelf Atlas snapshot: ${e.message}.`); }
    }
  } else if (sr.status === 'fulfilled' && model) {
    if (problems.get('snapshot') && model.fields.length) setProblem('snapshot', null);
  }
  if (baseChanged && !loaded) { computeFit(); restoreView(); }
  if (base || model) loaded = true;
  if (!snap) $('credits').textContent = creditLine(null);
  updateStamp();
  updateLegend();
  timeDirty = true;
  requestRender();
}

/* Live means re-render in place: Snuggery fires visibilitychange when a Shortcut delivers new data
 * while the app is open, and a return re-reads both files. Hidden, play stops and the loop rests. */
function onHidden() {
  setPlaying(false);
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) onHidden(); else { loadAll(); schedule(); } });
window.addEventListener('pagehide', onHidden);

/* ── boot ────────────────────────────────────────────────────────────────── */

/* The key column, on a plate too short for it (a phone on its side, a sheet open), becomes a row along
 * the top, so it never wraps into a second column over the map. */
function layoutKeys() {
  wrap.classList.toggle('keys-row', 6 * 44 + 2 * 8 + 6 + 16 > H);
}
function resize() {
  const r = wrap.getBoundingClientRect();
  const oldCenter = base && loaded ? { x: (W / 2 - view.tx) / view.k, y: (H / 2 - view.ty) / view.k, z: zoomRel() } : null;
  // a view at home stays at home (focus mode, a turn of the phone): the home view is fitted to the plate
  const atHome = oldCenter && Math.abs(oldCenter.z - 1) < 1e-6 && (() => { const c = homeCenter(); return Math.abs(c[0] - oldCenter.x) < 1e-6 && Math.abs(c[1] - oldCenter.y) < 1e-6; })();
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  layoutKeys();
  dropExclusions();
  computeFit();
  if (atHome) home();
  else if (oldCenter) { centerOn(oldCenter.x, oldCenter.y, oldCenter.z * fitK); clampView(); }
  cache = null;
  updateLegend();
  // drawn now, not next frame: resizing a canvas clears it, and a blank frame would show
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  dirty = true; timeDirty = true;
  loop(performance.now());
  if (!$('card').hidden) placeCard();
}

(function restoreUI() {
  const q = recall(STORE.qty);
  if (q && U.QTY[q]) qty = q;
  if (recall(STORE.sys) === 'field') sys = 'field';
  if (recall(STORE.mode) === 'cum') mode = 'cum';
  const cc = recallJSON(STORE.cc);
  if (cc && typeof cc === 'object') for (const c of CC) if (typeof cc[c] === 'boolean') ccOn[c] = cc[c];
  const ly = recallJSON(STORE.layers);
  if (ly && typeof ly === 'object') for (const k of [...LAYERS, 'peaks']) if (typeof ly[k] === 'boolean') layerOn[k] = ly[k];
  focusMode = recall(STORE.focus) === '1';
})();
buildPalette();
syncRadios();
syncLayers();
for (const b of $('country-rows').children) b.setAttribute('aria-pressed', String(ccOn[b.dataset.cc]));
if (focusMode) setFocus(true, { boot: true });           // restored before the first draw
updateStamp();
track.resize();
new ResizeObserver(resize).observe(wrap);
{
  const ro = new ResizeObserver(() => { dropExclusions(); requestRender(); });
  for (const id of ['card', 'keys', 'focus-exit']) ro.observe($(id));
}
resize();
/* Field names, the track and the chart are drawn in the app's face, so the canvas waits for it, and
 * every name's width is measured again once it is in. */
const faceIn = () => { fontReady = true; if (model) for (const Un of model.units) Un.lw = null; track.invalidate(); updateLegend(); timeDirty = true; requestRender(); };
document.fonts.load(LABEL_FONT).then(faceIn, faceIn);
document.fonts.addEventListener('loadingdone', faceIn);
loadAll();

/* For tests and a browser console, never for the app itself. */
window.__sa = {
  ready: () => !!model && !!base && fontReady && shown >= 0,
  render() { const t0 = performance.now(); render(); return performance.now() - t0; },
  renderCold() { cache = null; const t0 = performance.now(); render(); return performance.now() - t0; },
  get state() {
    return { month, shown, qty, sys, mode, ccOn: { ...ccOn }, layers: { ...layerOn }, playing, focus: focusMode, zoom: zoomRel(), sel: sel ? selKey(sel) : null,
      fields: model ? model.fields.length : 0, units: model ? model.units.length : 0, problems: [...problems.values()],
      total: monthTotal, producing: monthCount, hi: model ? model.hi : null, hiCum: model ? model.hiCum : null, W, H };
  },
  stats: () => ({ ...stats, playing, raf: !!raf }),
  wanted: () => (track.wanted ?? month),
  shown: () => shown,
  setMonth(m) { setPlaying(false); setMonth(m); },
  setMode(m) { mode = m === 'cum' ? 'cum' : 'rate'; onChoice(); },
  setQty(q) { qty = q; onChoice(); },
  val(name) { const e = model.searchIndex.find((x) => x.key === fold(name)); return e ? unitVal[e.u] : null; },
  best(name) { const e = model.searchIndex.find((x) => x.key === fold(name)); const b = e ? bestOf(e.u, shown) : null; return b ? { value: b.v, month: b.m } : null; },
  rings() { const hi = model && domain().hi; return model ? model.units.map((Un, u) => (ringR[u] ? [Un.name, ringR[u], sxOf(Un), syOf(Un), unitVal[u] > 0 ? discR(u, hi) : 0] : null)).filter(Boolean) : []; },
  /** A shown unit's center on the plate and its drawn disc's radius, by name; null when it is not drawn. */
  at(name) { const e = model.searchIndex.find((x) => x.key === fold(name)); if (!e || !unitVis[e.u]) return null; const Un = model.units[e.u]; return [sxOf(Un), syOf(Un), unitVal[e.u] > 0 ? discR(e.u, domain().hi) : 0, ringR[e.u]]; },
  setLayer(k, on) { layerOn[k] = !!on; syncLayers(); onChoice(); },
  pick(name) { const e = model.searchIndex.find((x) => x.key === fold(name)); if (e) pickUnit(e.u); return !!e; },
  project(lon, lat) { return [lon * view.k + view.tx, mercY(lat) * view.k + view.ty]; },
  zoomTo(lon, lat, z) { fly = null; centerOn(lon, mercY(lat), z * fitK); clampView(); requestRender(); },
  home() { fly = null; home(); requestRender(); },
  hit(sx, sy) { const h = hitTest(sx, sy); return h ? selKey(h) : null; },
  reload: loadAll,
  focus: (on, kbd = false) => setFocus(!!on, { kbd }),
  flying: () => !!fly,
  labels: () => placedLabels.map((p) => p.slice()),
  log(on) { if (on) { logRows = []; return null; } const r = logRows; logRows = null; return r; },
  anchor(type, i) {
    const k = view.k, sc = (x, y) => [x * k + view.tx, y * k + view.ty];
    if (type === 'fac') return sc(base.fac.X[i], base.fac.Y[i]);
    const a = (type === 'pipe' ? base.pipes[i] : base.borders[i]).lines[0], j = (a.length / 4 | 0) * 2;
    return sc(a[j], a[j + 1]);
  },
  find(type, re) {
    const r = new RegExp(re, 'i');
    if (type === 'fac') return base.fac.raw.findIndex((f) => r.test(f.name));
    if (type === 'pipe') return base.pipes.findIndex((p) => r.test(p.raw.name || ''));
    return base.borders.findIndex((b) => r.test(b.name || ''));
  },
};
