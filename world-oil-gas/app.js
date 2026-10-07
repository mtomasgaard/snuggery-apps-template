/* World Oil & Gas: Snuggery mini-app. Every country's oil and gas production since 1900 on a world map
 * with a year player, the world's output for the year as shares under it (the Ledger), and the
 * extraction tracker's fields following the same player. What it shows is NOTES.md; how it looks is
 * ART.md, on the template's house system. The data contract, its checks and its arithmetic are in
 * js/data.js; every number, unit and date goes through js/units.js; the year track is js/track.js.
 *
 * DRAWING. Web Mercator, repeating sideways, clamped at ±85°. Every country is one Path2D built once
 * per load of world.json; a year change only changes which fill each path gets, and the per-year color
 * index of every country is worked out on first use and cached, so playing the century back is a
 * lookup and ~240 fills a frame. The sea and the borders are cached canvases redrawn only when the
 * view moves; the Ledger is its own canvas, redrawn only when its year, mode, width, theme or chosen
 * country changes.
 *
 * FIELDS AND TIME. The tracker gives one rate per unit and no series. With "Fields follow the year"
 * on, a disc's size is an estimate (js/data.js estimate()); a unit appears at discovery as a ring and
 * fills at first production (fieldYears()). disc and start are resolved once per load into p.appear and
 * p.fill, the filters into p.pass and a company's or basin's highlight into p.hl, so a frame is
 * comparisons. Outlines are decoded on first need when zoomed in.
 *
 * THE FRAME. One requestAnimationFrame chain: play moves the wanted year on a clock, a held track sets
 * it to the year under the finger, and the frame takes the newest wanted year, sets `shown` and draws.
 * The time row, the lead, the caption, the Ledger, the card, the chart's cursor and aria-valuenow all
 * read `shown`. A frame whose year, view and choices have not changed draws nothing.
 *
 * STATE persisted in localStorage (STORE) is UI state only. NO VALUE EVER REACHES innerHTML: every
 * piece of text is set with textContent. Nothing is fetched but ./data/*.json; the shading is <img>s.
 */
import {
  clamp, isStr, decodePolyline, checkWorld, checkSnapshot, checkFields, lonToX, latToY, yToLat,
  buildProd, cumOf, seriesAt, valueAt, worldAt, seriesSpan, FORMER_STATE, LEAD, historicalLabels, shortName,
  ledgerAt, fold, countryKey, buildFields, fieldYears, estimate, estRate, estCum, creditLine, formerUnions, MEMBERS,
} from './js/data.js';
import * as U from './js/units.js';
import { createTrack } from './js/track.js';

const STORE = {
  view: 'wog.view', units: 'wog.units', mode: 'wog.mode', year: 'wog.year', sel: 'wog.sel',
  fields: 'wog.fields', status: 'wog.status', labels: 'wog.labels',
  follow: 'wog.follow', accum: 'wog.accum', setting: 'wog.setting', ftype: 'wog.ftype',
  size: 'wog.size', hl: 'wog.hl', depth: 'wog.depth', terrain: 'wog.terrain', focus: 'wog.focus', rim: 'wog.rim',
};
const FILES = { world: 'data/world.json', snapshot: 'data/snapshot.json', fields: 'data/fields.json' };
const PATH_K = 4096;            // paths are built in world units × PATH_K
const MAX_SCALE = 360 * 120;    // 120 px per degree of longitude
const YEARS_PER_SEC = 8;        // playback: the century in about 15 s
const STALE_DAYS = 400;         // the snapshot is rebuilt yearly
const MODES = { oil: 'Oil', gas: 'Gas', total: 'Oil and gas' };
const ACCUM = { annual: 'Annual', cumulative: 'Cumulative' };
/* Field disc size: area ∝ rate, so radius ∝ √(boe/d). */
const FIELD_VREF = 100000;      // boe/d that gets FIELD_RREF px
const FIELD_RREF = 4;
const FIELD_RMIN = 2;
const FIELD_RMAX = 24;
const RES_VREF = 1000;          // million boe of reserves that get the radius 100 000 boe/d gets
const CUM_VREF = 2000;          // million boe to date that get it (Burgan's ~33 000 by 2024 matches its rate)
const RING_R = 3.5;             // a not-yet-producing ring while sizes are estimated
const OUTLINE_SCALE = 360 * 16; // outlines only from 16 px a degree of longitude…
const OUTLINE_MIN_PX = 12;      // …and each only once it is 12 px across on screen
const FLY_SCALE = 360 * 40;     // how far a search result zooms in
const FLY_MS = 600;
const LABEL_FONT = '560 11.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const SMALL_FONT = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const CHOSEN_FONT = '560 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const CAPTION_FONT = '400 11px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const LEAD_FONT = '400 12.5px "Ysabeau Office", system-ui, -apple-system, sans-serif';
const YEAR_FONT = '600 21px "Ysabeau Office", system-ui, -apple-system, sans-serif';

/* The plate, printed twice: `python3 world-oil-gas/tools/art/palette.py --json` from Template/, pasted
 * as it prints (tools/check.mjs fails while the two differ). */
const THEMES = {"light": {"ramp": ["#e2d9f5", "#dacff2", "#d2c6ef", "#cbbdec", "#c3b4e8", "#bbabe5", "#b3a2e1", "#ab9add", "#a391d9", "#9b89d3", "#9281cd", "#8a79c7", "#8271c2", "#7a6aba", "#7363b3", "#6b5bac", "#6454a5"], "sea": "#d5e2e8", "deep": ["#ccdce4", "#b9ccd9"], "land": "#eff1ef", "outside": "#e6e9ea", "edge": "#c9d4d8", "border": "#474e52", "borderAlpha": 0.5, "fuel": {"oil": "#f08944", "gas": "#14a3d5", "both": "#0f7845", "other": "#7a8185"}, "paleAlpha": 0.45, "tintAlpha": 0.16, "edgeAlpha": 0.85, "rim": "#f6f9fa", "rimAlpha": 0.95, "label": "#0f1c23", "halo": "#f6f9fa", "haloAlpha": 0.88, "sel": "#0f1c23", "chart": {"oil": "#b2580b", "gas": "#066d90"}, "ledger": "#1b150e", "hatchPitch": 3, "hatchWidth": 1}, "dark": {"ramp": ["#3b334a", "#423854", "#483d5f", "#4f426a", "#564875", "#5d4d80", "#63538b", "#6a5996", "#715ea2", "#7765ac", "#7d6cb6", "#8372c0", "#8a79ca", "#9080d3", "#9788db", "#9d8fe4", "#a496ed"], "sea": "#111b20", "deep": ["#0d181d", "#050c12"], "land": "#23292b", "outside": "#0f1214", "edge": "#2a373c", "border": "#abb2b6", "borderAlpha": 0.35, "fuel": {"oil": "#e58647", "gas": "#259cca", "both": "#167645", "other": "#787e82"}, "paleAlpha": 0.45, "tintAlpha": 0.18, "edgeAlpha": 0.85, "rim": "#141d21", "rimAlpha": 0.9, "label": "#e6edee", "halo": "#1c272c", "haloAlpha": 0.88, "sel": "#e6edee", "chart": {"oil": "#eb9259", "gas": "#49abd6"}, "ledger": "#f4f0e7", "hatchPitch": 3, "hatchWidth": 1}};

/* ── small helpers ───────────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: fine */ } },
};
const setText = (e, t) => { if (e.textContent !== t) e.textContent = t; };
const say = (t) => { const e = $('live'); e.textContent = ''; setTimeout(() => { e.textContent = t; }, 30); };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgba = (h, a) => `rgba(${rgb(h).join(',')},${a})`;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const noScheme = (s) => String(s).replace(/\b[a-z][a-z0-9+.-]*:\/\//gi, '');
const measure = document.createElement('canvas').getContext('2d');
const widthOf = (font, t) => { measure.font = font; return measure.measureText(t).width; };

/* ── palette ─────────────────────────────────────────────────────────────── */

const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => reducedMq.matches;
let P = null;                   // the current theme's paint, with `lut`: 256 colors across the ramp
function buildPalette() {
  const name = darkMq.matches ? 'dark' : 'light', T = THEMES[name];
  const st = T.ramp.map(rgb), lut = [];
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (st.length - 1), k = Math.min(st.length - 2, Math.floor(t)), f = t - k;
    lut.push(`rgb(${st[k].map((v, j) => Math.round(v + (st[k + 1][j] - v) * f)).join(',')})`);
  }
  P = { ...T, name, lut, borderC: rgba(T.border, T.borderAlpha), rimC: rgba(T.rim, T.rimAlpha),
    haloC: rgba(T.halo, T.haloAlpha), selHalo: rgba(T.halo, 0.9),
    // over the relief the countries go on with 'multiply' (light) or 'screen' (dark), so the ramp still reads
    comp: name === 'dark' ? 'screen' : 'multiply', dim: name === 'dark' ? rgba(T.outside, 0.45) : null };
  const s = document.documentElement.style;
  for (const k of ['oil', 'gas', 'both', 'other']) s.setProperty(`--s-${k}`, T.fuel[k]);
  s.setProperty('--s-rim', rimOn ? P.rimC : 'transparent');
  s.setProperty('--s-land', T.land);
}

/* ── state ───────────────────────────────────────────────────────────────── */

let geo = null;        // { countries: [{ iso3, name, rings, path, bbox, lw, lx, ly }], index, borders, source }
let prod = null;       // the snapshot and its lookups (js/data.js buildProd)
let fields = null;     // js/data.js buildFields, or null when the file failed
let link = null;       // polygon index ↔ series, and the mismatch lists
const raw = { world: null, snapshot: null, fields: null };   // last text read, to skip reparsing
const problems = new Map();

let mode = 'total', units = 'twh', accum = 'annual';
let year = null;       // the year wanted: play, the keys and the track move it; the frame draws it
let shown = null;      // the year last drawn; everything that carries a year reads it
let sel = null;        // { kind: 'country', iso3, at? } | { kind: 'field', id }
let showFields = true, showLabels = true, followYear = true;
let statusFilter = 'operating', settingFilter = 'all', typeFilter = 'all', sizeBy = 'prod';
let highlight = null;  // { kind: 'company' | 'basin', name }
let depthPref = false, terrainPref = false, rimOn = true;
let playing = false, focusMode = false, fontReady = false;
const stats = { frames: 0, draws: 0, fills: 0, fieldPasses: 0, ledgerDraws: 0, computes: 0 };

const view = { cx: lonToX(40), cy: latToY(25), scale: 0 };   // scale = world width in CSS px
let W = 0, H = 0, dpr = 1;
const canvas = $('map');
let ctx = canvas.getContext('2d');   // swapped briefly while a cache is painted
const wrap = $('map-wrap');
const slider = $('slider');

const isCum = () => accum === 'cumulative';
const sysOf = () => (units === 'twh' ? 'si' : 'field');
const unitSpec = () => U.unitSpec(units, isCum());
const toUnit = (gwh) => U.toUnit(gwh, units, isCum(), prod ? prod.boePerTWh : 0);
const val = (c, m, y) => valueAt(prod, c, m, y, isCum());

/* ── geometry, built once per load ───────────────────────────────────────── */

function addRing(path, xy) {
  const sub = new Path2D();
  for (let i = 0; i < xy.length; i += 2) {
    const px = xy[i] * PATH_K, py = xy[i + 1] * PATH_K;
    if (i === 0) sub.moveTo(px, py); else sub.lineTo(px, py);
  }
  sub.closePath();
  path.addPath(sub);
  return sub;
}
function buildGeo(w) {
  const borders = new Path2D();
  const countries = w.countries.map((c) => {
    const path = new Path2D(), rings = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let lw = 0;                          // widest single ring: what a label must fit in
    for (const enc of c.rings) {
      const ll = decodePolyline(enc, w.factor);
      if (ll.length < 6) continue;
      const xy = new Float32Array(ll.length);
      let rx0 = Infinity, rx1 = -Infinity;
      for (let i = 0; i < ll.length; i += 2) {
        if (!(Math.abs(ll[i]) <= 180.5 && Math.abs(ll[i + 1]) <= 90.5)) throw new Error(`${c.iso3} has a point off the globe (${ll[i]}, ${ll[i + 1]})`);
        const x = lonToX(ll[i]), y = latToY(ll[i + 1]);
        xy[i] = x; xy[i + 1] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x < rx0) rx0 = x; if (x > rx1) rx1 = x;
      }
      rings.push(xy);
      if (rx1 - rx0 > lw) lw = rx1 - rx0;
      borders.addPath(addRing(path, xy));
    }
    const hasC = Array.isArray(c.c) && Number.isFinite(c.c[0]) && Number.isFinite(c.c[1]);
    // A country split at the antimeridian (Fiji, Russia) has a bbox the width of the world, so
    // labels go by the widest ring instead.
    return { iso3: c.iso3, name: c.name, rings, path, bbox: [x0, y0, x1, y1], lw,
      lx: hasC ? lonToX(c.c[0]) : (x0 + x1) / 2, ly: hasC ? latToY(c.c[1]) : (y0 + y1) / 2 };
  });
  return { countries, index: new Map(countries.map((c, i) => [c.iso3, i])), borders, source: typeof w.source === 'string' ? w.source : '' };
}
function buildLink() {
  if (!geo || !prod) return null;
  const series = geo.countries.map((c) => prod.byIso.get(c.iso3) || null);
  const polys = new Set(geo.countries.map((c) => c.iso3));
  const hist = historicalLabels(prod.s);
  return { series,
    historical: prod.s.countries.filter((c) => !polys.has(c.iso3) && hist[c.iso3]),
    noPolygon: prod.s.countries.filter((c) => !polys.has(c.iso3) && !hist[c.iso3]),
    noData: geo.countries.filter((c, i) => !series[i]) };
}

/* ── the year's figures ──────────────────────────────────────────────────── */

/* 0–255 on the log scale of the unit's domain. */
function lutIndex(v) {
  const [lo, hi] = unitSpec().dom;
  return Math.round(clamp(Math.log(v / lo) / Math.log(hi / lo), 0, 1) * 255);
}
/* The color of every polygon for one (mode, unit, accumulation, year): idx, a LUT index, and st: 0 a
 * value, 1 zero, 2 no data, +4 partial (a total missing oil or gas). A former state holding the figure
 * colors its members that report nothing of their own (formerUnions): `of` names it per polygon, and
 * `paths` holds each one's members as one Path2D. Cached per year. */
const colorCache = new Map();
function colorsFor(y) {
  const key = `${accum}|${mode}|${units}|${y}`;
  let hit = colorCache.get(key);
  if (hit) return hit;
  stats.computes++;
  const n = geo.countries.length, idx = new Uint8Array(n), st = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = val(link.series[i], mode, y), v = toUnit(r.v);
    if (v == null) { st[i] = 2; continue; }
    if (r.partial) st[i] = 4;
    if (v <= 0) st[i] |= 1; else idx[i] = lutIndex(v);
  }
  const of = [], paths = {}, fill = {}, sig = [];
  for (const u of formerUnions(prod, mode, isCum(), y)) {
    const v = toUnit(u.v), path = new Path2D();
    for (const iso of u.members) {
      const i = geo.index.get(iso);
      if (i == null) continue;
      of[i] = u.state; st[i] = v > 0 ? 0 : 1; idx[i] = v > 0 ? lutIndex(v) : 0;
      path.addPath(geo.countries[i].path);
    }
    paths[u.state] = path; fill[u.state] = v > 0 ? lutIndex(v) : -1; sig.push(u.state, ...u.members);
  }
  hit = { idx, st, of, paths, fill, sig: sig.join() };
  if (colorCache.size > 1200) colorCache.clear();
  colorCache.set(key, hit);
  return hit;
}

/* The fields' estimate for the mode, rebuilt when the mode or a file changes. */
let est = null;
function buildEst() {
  if (!prod || !fields || !fields.available) { est = null; return; }
  if (est && est.mode === mode && est.prod === prod && est.fields === fields) return;
  est = estimate(prod, fields, mode);
}
const followOn = () => followYear && shown != null;
const estOn = () => followOn() && est != null && sizeBy !== 'res';
const fieldsDrawn = () => showFields && !!fields && fields.available && fields.points.length > 0;
const fieldVisible = (p) => p.pass === 1 && (!followOn() || p.appear <= shown);

/* The layer filters, resolved into p.pass once per change; a blank setting or type passes only All. */
function applyFilters() {
  if (!fields || !fields.available) return;
  for (const p of fields.points) {
    p.pass = (statusFilter === 'all' || p.operating)
      && (settingFilter === 'all' || p.off === (settingFilter === 'offshore' ? 1 : 0))
      && (typeFilter === 'all' || p.type === typeFilter) ? 1 : 0;
  }
  applyHighlight();
}
function applyHighlight() {
  if (!fields || !fields.available) return;
  const h = highlight;
  for (const p of fields.points) p.hl = !h ? 1 : (h.kind === 'company' ? p.parents.includes(h.name) : p.basin === h.name) ? 1 : 0;
}
/* Counts for the lead and the layers note, for the year shown. */
const fieldCounts = { pass: 0, drawn: 0, producing: 0, undated: 0 };
function countFields() {
  const c = fieldCounts;
  c.pass = c.drawn = c.producing = c.undated = 0;
  if (!fields || !fields.available) return c;
  const fy = followOn();
  for (const p of fields.points) {
    if (!p.pass) continue;
    c.pass++;
    if (fy && p.appear > shown) continue;
    c.drawn++;
    if (p.undated) c.undated++;
    if (!fy || p.fill <= shown) c.producing++;
  }
  return c;
}

/* A field's outline, decoded on first need: one Path2D and its bbox, or null. A ring is dropped when
 * a point is off the globe (one country's rings in the 2026 file are in a projected grid), when it is
 * wider than 10°, or when it lies more than 2° from its own unit's point. */
const outlineStats = { decoded: 0, paths: 0, dropped: 0, drawn: 0 };
function outlineOf(p) {
  if (p.outline !== undefined) return p.outline;
  p.outline = null;
  if (!p.rings) return null;
  outlineStats.decoded++;
  const path = new Path2D();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  const lon0 = p.f.lon, lat0 = p.f.lat;
  for (const enc of p.rings) {
    let ll;
    try { ll = isStr(enc) ? decodePolyline(enc, fields.factor) : []; } catch { ll = []; }
    if (ll.length < 6) { outlineStats.dropped++; continue; }
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, ok = true;
    for (let i = 0; i < ll.length; i += 2) {
      const lo = ll[i], la = ll[i + 1];
      if (!(Math.abs(lo) <= 180 && Math.abs(la) <= 90)) { ok = false; break; }
      if (lo < a0) a0 = lo; if (lo > a1) a1 = lo; if (la < b0) b0 = la; if (la > b1) b1 = la;
    }
    if (!ok || a1 - a0 > 10 || lon0 < a0 - 2 || lon0 > a1 + 2 || lat0 < b0 - 2 || lat0 > b1 + 2) { outlineStats.dropped++; continue; }
    const xy = new Float32Array(ll.length);
    for (let i = 0; i < ll.length; i += 2) {
      const x = lonToX(ll[i]), y = latToY(ll[i + 1]);
      xy[i] = x; xy[i + 1] = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    addRing(path, xy);
    n++;
  }
  if (n) { p.outline = { path, bbox: [x0, y0, x1, y1] }; outlineStats.paths++; }
  return p.outline;
}
/* The tracker's wiki page, printed without its scheme; the file carries `wiki` only when the page is
 * not simply the unit name with underscores. */
const fieldWiki = (f) => (isStr(f.wiki) ? noScheme(f.wiki) : isStr(f.name) ? `www.gem.wiki/${f.name.trim().replace(/ /g, '_')}` : null);

/* ── view ────────────────────────────────────────────────────────────────── */

const minScale = () => Math.max(160, W);
function clampView() {
  view.scale = clamp(view.scale, minScale(), MAX_SCALE);
  view.cx -= Math.floor(view.cx);
  const half = H / (2 * view.scale);
  view.cy = view.scale <= H ? 0.5 : clamp(view.cy, half, 1 - half);
}
const screenToWorld = (sx, sy) => [view.cx + (sx - W / 2) / view.scale, view.cy + (sy - H / 2) / view.scale];
/* The nearest copy of a world point on screen. */
function worldToScreenX(wx) { let dx = wx - view.cx; dx -= Math.round(dx); return dx * view.scale + W / 2; }
const worldToScreenY = (wy) => (wy - view.cy) * view.scale + H / 2;
function worldCopies() {
  const xmin = view.cx - W / (2 * view.scale), xmax = view.cx + W / (2 * view.scale), ks = [];
  for (let k = Math.floor(xmin); k < xmax; k++) ks.push(k);
  return ks;
}
function withWorldTransform(k, fn) {
  const s = view.scale / PATH_K;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - (view.cx - k) * view.scale), dpr * (H / 2 - view.cy * view.scale));
  fn(s);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
/* First launch: 72° N to 45° S fills the height, centered on the Gulf: on a phone that is Europe,
 * Africa, the Middle East and western Russia at once. */
function fitFirst() { view.cx = lonToX(40); view.cy = latToY(25); view.scale = H / (latToY(-45) - latToY(72)); clampView(); }
function panBy(dx, dy) { endFly(); view.cx -= dx / view.scale; view.cy -= dy / view.scale; clampView(); saveView(); requestRender(); }
function zoomAround(factor, sx, sy, base = view.scale, anchor = null) {
  const [wx, wy] = anchor || screenToWorld(sx, sy);
  view.scale = clamp(base * factor, minScale(), MAX_SCALE);
  view.cx = wx - (sx - W / 2) / view.scale;
  view.cy = wy - (sy - H / 2) / view.scale;
  clampView();
}
function zoomAt(sx, sy, f) { endFly(); zoomAround(f, sx, sy); saveView(); requestRender(); }
function saveView() { store.set(STORE.view, JSON.stringify({ cx: view.cx, cy: view.cy, scale: view.scale })); }
function restoreView() {
  try {
    const v = JSON.parse(store.get(STORE.view) || 'null');
    if (v && [v.cx, v.cy, v.scale].every(Number.isFinite) && v.scale > 0) Object.assign(view, { cx: v.cx, cy: v.cy, scale: v.scale });
  } catch { /* fine */ }
}

/* A flight to a search result or a country: zoom in log space, center linearly, 600 ms on the house's
 * --draw curve. Any touch ends it at its destination (B13); under Reduce Motion it is a cut. */
let fly = null;
function drawCurve(x) {
  // cubic-bezier(0.2, 0, 0, 1): x(t) = 0.6 t (1 − t)² + t³, y(t) = 3t² − 2t³; x is monotonic, so bisect
  let a = 0, b = 1, t = x;
  for (let i = 0; i < 24; i++) { t = (a + b) / 2; if (0.6 * t * (1 - t) ** 2 + t ** 3 < x) a = t; else b = t; }
  return 3 * t * t - 2 * t * t * t;
}
function flyTo(wx, wy, scale) {
  let dx = wx - view.cx;
  dx -= Math.round(dx);
  fly = { t0: performance.now(), from: { ...view }, to: { cx: view.cx + dx, cy: wy, scale: clamp(scale, minScale(), MAX_SCALE) } };
  if (reduced()) endFly(); else requestRender();
}
function endFly() {
  if (!fly) return;
  const { to } = fly;
  fly = null;
  Object.assign(view, to);
  clampView();
  saveView();
  if (!$('card').hidden) placeCard();
  requestRender();
}
function tickFly(now) {
  const u = Math.min(1, (now - fly.t0) / FLY_MS);
  if (u >= 1) { endFly(); return; }
  const e = drawCurve(u), { from, to } = fly;
  view.scale = Math.exp(Math.log(from.scale) + (Math.log(to.scale) - Math.log(from.scale)) * e);
  view.cx = from.cx + (to.cx - from.cx) * e;
  view.cy = from.cy + (to.cy - from.cy) * e;
  clampView();
}

/* ── hit-testing ─────────────────────────────────────────────────────────── */

function ringContains(xy, x, y) {
  let inside = false;
  for (let i = 0, j = xy.length - 2; i < xy.length; j = i, i += 2) {
    const xi = xy[i], yi = xy[i + 1], xj = xy[j], yj = xy[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/* Even-odd across all the country's rings, the same rule it is filled with. */
function countryAt(sx, sy) {
  if (!geo) return -1;
  const [wx0, wy] = screenToWorld(sx, sy);
  if (wy < 0 || wy > 1) return -1;
  const wx = wx0 - Math.floor(wx0);
  for (let i = 0; i < geo.countries.length; i++) {
    const c = geo.countries[i], b = c.bbox;
    if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) continue;
    let inside = false;
    for (const r of c.rings) if (ringContains(r, wx, wy)) inside = !inside;
    if (inside) return i;
  }
  return -1;
}
let zfScale = -1, zfVal = 1;
function zoomF() {
  if (view.scale !== zfScale) { zfScale = view.scale; zfVal = clamp(Math.pow(view.scale / 1500, 0.4), 0.7, 2.2); }
  return zfVal;
}
const sizeR = (v, ref) => clamp(FIELD_RREF * Math.sqrt(v / ref) * zoomF(), FIELD_RMIN, FIELD_RMAX);
/* While sizes are estimated: a small ring before production starts, the smallest dot in a year the
 * estimate is 0, else the estimate at its scale. */
function fieldRadius(p) {
  let v = p.v, ref = FIELD_VREF;
  if (sizeBy === 'res') { v = p.rv; ref = RES_VREF; }
  else if (p.es != null && estOn()) {
    if (p.fill > shown) return RING_R;
    if (isCum()) { v = estCum(prod, p, shown); ref = CUM_VREF; } else v = estRate(prod, p, shown);
    if (!(v > 0)) return FIELD_RMIN;
  }
  if (v == null || v <= 0) return FIELD_RMIN + 0.5;
  return sizeR(v, ref);
}
/* Of the discs under the finger, the one whose center is nearest relative to its size, so a tap on
 * the middle of a big field that a small one overlaps still finds the big one; failing that, with
 * `near0`, the nearest within a finger's width. */
function fieldAt(sx, sy, near0) {
  if (!fieldsDrawn()) return null;
  let hit = null, hitScore = Infinity, near = null, nearD = Infinity;
  for (const p of fields.points) {
    if (!fieldVisible(p)) continue;
    const d = Math.hypot(worldToScreenX(p.x) - sx, worldToScreenY(p.y) - sy), r = fieldRadius(p);
    if (d <= r + 2) { const score = d / (r + 2); if (score < hitScore) { hit = p; hitScore = score; } }
    else if (near0 && d - r < 14 && d - r < nearD) { near = p; nearD = d - r; }
  }
  return hit || near;
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

function render() {
  if (!W || !H) return;
  stats.draws++;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSea();
  if (!geo) return;
  drawCountries();
  if (fieldsDrawn()) { buildEst(); drawOutlines(); drawFields(); } else outlineStats.drawn = 0;
  if (showLabels && fontReady) drawLabels(); else placedLabels = [];
  drawSelection();
}

/* The shading (tools/build_shade.py): data/shade.json names two gray images of the whole world and
 * finer sea tiles over seven oil and gas regions, all plate carrée: 'land', Natural Earth I's relief
 * as luminance (Terrain shading), and 'file', GEBCO's sea floor, darker with depth and hillshaded
 * (Depth shading). Nothing is read until a shading is on, each image only when its own key is, and
 * a tile only once the view is past the whole-world level's detail. Each is reprojected to Mercator
 * into an offscreen canvas one destination row at a time, at a power-of-two world width in device
 * pixels, for the whole world up to 2048, else the visible window plus a quarter each side. */
const shade = { status: 'none', g: null, img: [], tiles: [], gen: 0, builds: 0, ms: 0, c: [null, null] };
const IMG = /^[\w-]+(\/[\w-]+)?\.(jpe?g|png|webp)$/;
function image(file, ok, bad) {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => (im.naturalWidth ? ok() : bad());
  im.onerror = bad;
  im.src = `./data/${file}`;
  return im;
}
const shadeFail = (m) => { shade.status = 'error'; setProblem('shade', 'data/shade.json', `${m} The map is drawn without shading.`); syncLayers(); requestRender(); };
function loadShade() {
  if (shade.g) return needShade();
  if (shade.status !== 'none') return;
  shade.status = 'loading';
  fetch('./data/shade.json', { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error(` could not be read (HTTP ${r.status}).`);
    return r.text();
  }).then((t) => {
    const m = parseJson(t), g = m && m.global;
    if (!g || !IMG.test(g.file) || !IMG.test(g.land) || String(g.bounds) !== '-180,-90,180,90') throw new Error(' does not name the two whole-world images in ./data.');
    shade.tiles = (Array.isArray(m.tiles) ? m.tiles : []).filter((x) => x && IMG.test(x.file) && Array.isArray(x.bounds) && x.bounds.length === 4 && x.bounds.every(Number.isFinite))
      .map((x) => ({ file: x.file, b: x.bounds, img: null, used: 0, px: 0 }));
    shade.g = g;
    needShade();
  }).catch((e) => shadeFail(e.message));
}
function needShade() {
  [terrainPref, depthPref].forEach((on, i) => {
    const f = i ? shade.g.file : shade.g.land, im = on && !shade.img[i] && (shade.img[i] = image(f, () => {
      im.ok = 1; shade.status = 'ok'; shade.gen++; updateCredits(); syncLayers(); requestRender();
    }, () => shadeFail(` names data/${f}, which could not be read.`)));
  });
}
const shadeOn = (i) => shade.status === 'ok' && !!(shade.img[i] || {}).ok;
const terrainOn = () => terrainPref && shadeOn(0);
const depthOn = () => depthPref && shadeOn(1);
/* A tile is read when first in view, and at most four tiles' worth of pixels stay decoded. */
function wantTile(t) {
  t.img = image(t.file, () => { t.px = t.img.naturalWidth * t.img.naturalHeight; shade.gen++; requestRender(); }, () => { t.bad = true; });
  const held = shade.tiles.filter((x) => x.px).sort((a, b) => b.used - a.used);
  for (let n = 0, i = 0; i < held.length; i++) if ((n += held[i].px) > 4 * 2048 * 2048) { held[i].img = null; held[i].px = 0; }
}
/* The parts of an image covering [w, e] × [s, n] that fall in the canvas: [sx, sw, dx, dw], copies included. */
function pieces([w, , e], X0, cw, lw, iw) {
  const x0 = lonToX(w), x1 = lonToX(e), a0 = X0 / lw, a1 = (X0 + cw) / lw, out = [];
  for (let k = Math.floor(a0 - x1); k <= Math.ceil(a1 - x0); k++) {
    const a = Math.max(a0, x0 + k), b = Math.min(a1, x1 + k);
    if (b > a) out.push([((a - x0 - k) / (x1 - x0)) * iw, ((b - a) / (x1 - x0)) * iw, a * lw - X0, (b - a) * lw]);
  }
  return out;
}
function paint(g, img, box, X0, Y0, cw, ch, lw) {
  const iw = img.naturalWidth, ih = img.naturalHeight, [, s, , n] = box, ps = pieces(box, X0, cw, lw, iw);
  const srow = (py) => ((n - yToLat(clamp(py / lw, 0, 1))) / (n - s)) * ih;
  let s0 = srow(Y0);
  for (let j = 0; j < ch; j++) {
    const s1 = srow(Y0 + j + 1);
    if (s1 > 0 && s0 < ih) {
      const sh = Math.max(0.01, Math.min(s1, ih) - Math.max(s0, 0)), sy = clamp(s0, 0, ih - sh);
      for (const [sx, sw, dx, dw] of ps) g.drawImage(img, sx, sy, sw, sh, dx, j, dw, 1);
    }
    s0 = s1;
  }
}
/* Two canvases: the land's whole-world image for the relief, and the sea's with the tiles over it. */
function shadeCanvas(fine) {
  const lw = clamp(2 ** Math.round(Math.log2(view.scale * dpr)), 512, fine ? 65536 : 4096);
  const hw = W / (2 * view.scale), hh = H / (2 * view.scale);
  const u0 = (view.cx - hw) * lw, u1 = (view.cx + hw) * lw;
  const v0 = Math.max(0, (view.cy - hh) * lw), v1 = Math.min(lw, (view.cy + hh) * lw);
  const c = shade.c[+fine];
  if (c && c.lw === lw && c.gen === shade.gen) {
    const k = Math.round((c.X0 + c.w / 2 - (u0 + u1) / 2) / lw) * lw;
    if ((c.w >= lw || (c.X0 <= u0 + k && u1 + k <= c.X0 + c.w)) && c.Y0 <= v0 && v1 <= c.Y0 + c.h) return c;
  }
  let X0 = 0, Y0 = 0, w = lw, h = lw;
  if (lw > 2048) {
    const mx = (u1 - u0) / 4, my = (v1 - v0) / 4;
    X0 = Math.floor(u0 - mx); w = Math.min(lw, Math.ceil(u1 + mx) - X0);
    Y0 = Math.max(0, Math.floor(v0 - my)); h = Math.min(lw, Math.ceil(v1 + my)) - Y0;
  }
  const t0 = performance.now();
  const cv = c && c.cv.width === w && c.cv.height === h ? c.cv : document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.imageSmoothingQuality = 'high';
  paint(g, shade.img[+fine], [-180, -90, 180, 90], X0, Y0, w, h, lw);
  // past the whole-world level's 4096 px, the tiles in view, each read on first need
  if (fine && lw > 8192) for (const t of shade.tiles) {
    if (latToY(t.b[1]) * lw < Y0 || latToY(t.b[3]) * lw > Y0 + h || !pieces(t.b, X0, w, lw, 1).length) continue;
    t.used = t0;
    if (t.px) paint(g, t.img, t.b, X0, Y0, w, h, lw); else if (!t.img && !t.bad) wantTile(t);
  }
  shade.builds++;
  shade.ms = performance.now() - t0;
  return (shade.c[+fine] = { cv, lw, X0, Y0, w, h, gen: shade.gen });
}
function drawShade(fine) {
  const c = shadeCanvas(fine), f = view.scale * dpr;
  const xmin = view.cx - W / (2 * view.scale), xmax = view.cx + W / (2 * view.scale);
  const ox = c.X0 / c.lw, ow = c.w / c.lw, dy = (c.Y0 / c.lw - view.cy) * f + (H * dpr) / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  for (let k = Math.floor(xmin - ox - ow); k <= Math.ceil(xmax - ox); k++) {
    const wx = ox + k;
    if (wx + ow < xmin || wx > xmax) continue;
    ctx.drawImage(c.cv, (wx - view.cx) * f + (W * dpr) / 2, dy, ow * f + 0.5, (c.h / c.lw) * f);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* What depends only on the view and the theme is painted into offscreen canvases and reused while the
 * year, mode or unit changes: 'sea' under the countries, 'borders' over them. */
const caches = {};
function cached(slot, key, paint) {
  let c = caches[slot];
  if (!c || c.cv.width !== canvas.width || c.cv.height !== canvas.height) {
    const cv = document.createElement('canvas');
    cv.width = canvas.width; cv.height = canvas.height;
    c = caches[slot] = { cv, c: cv.getContext('2d'), key: '' };
  }
  key = [key, view.cx, view.cy, view.scale, W, H, dpr, P.name].join('|');
  if (c.key !== key || c.geo !== geo) {
    const main = ctx;
    ctx = c.c;
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.cv.width, c.cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    } finally { ctx = main; }
    c.key = key;
    c.geo = geo;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(c.cv, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawSea() {
  cached('sea', [shade.status, shade.gen, terrainOn(), depthOn()], () => {
    ctx.fillStyle = P.outside;
    ctx.fillRect(0, 0, W, H);
    const top = Math.max(0, worldToScreenY(0)), bottom = Math.min(H, worldToScreenY(1));
    ctx.fillStyle = P.sea;
    ctx.fillRect(0, top, W, bottom - top);
    // the sea floor: the gray multiplied over the sea color; the land under it is covered by the
    // countries or, with Terrain shading, by the relief
    if (depthOn()) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = P.name === 'dark' ? 0.9 : 0.45; drawShade(true); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // the relief, on land only: the countries' own rings are its mask
    if (terrainOn() && geo) {
      const m = new Path2D(), s = view.scale / PATH_K;
      for (const k of worldCopies()) m.addPath(geo.borders, new DOMMatrix([dpr * s, 0, 0, dpr * s, dpr * (W / 2 - (view.cx - k) * view.scale), dpr * (H / 2 - view.cy * view.scale)]));
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clip(m);
      drawShade(false);
      if (P.dim) { ctx.fillStyle = P.dim; ctx.fillRect(0, 0, W * dpr, H * dpr); }
      ctx.restore();
    }
    // the map ends at 85°: a 1 px line where the outside's own tone begins, so the plate never melts into the chrome
    ctx.fillStyle = P.edge;
    if (top > 0) ctx.fillRect(0, top - 1, W, 1);
    if (bottom < H) ctx.fillRect(0, bottom, W, 1);
  });
}
/* Values go on in the LUT color; zero and "no data" are both plain land: the card says which. */
function drawCountries() {
  stats.fills++;
  const cl = prod && link && shown != null ? colorsFor(shown) : null, rel = terrainOn(), cs = geo.countries;
  for (const k of worldCopies()) withWorldTransform(k, () => {
    if (!rel) { ctx.fillStyle = P.land; for (let i = 0; i < cs.length; i++) ctx.fill(cs[i].path, 'evenodd'); }
    else { ctx.globalCompositeOperation = P.comp; ctx.globalAlpha = 0.8; }
    for (let i = 0; i < cs.length; i++) {
      if (!cl || (cl.st[i] & 3) !== 0 || cl.of[i]) continue;
      ctx.fillStyle = P.lut[cl.idx[i]];
      ctx.fill(cs[i].path, 'evenodd');
    }
    // a former state's members in one fill, so no seam shows where two of them meet
    if (cl) for (const u in cl.fill) if (cl.fill[u] >= 0) { ctx.fillStyle = P.lut[cl.fill[u]]; ctx.fill(cl.paths[u]); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  });
  // a former state's members are one shape: no border inside it, its edge drawn from outside it
  const un = cl && cl.sig ? cl : null;
  cached('borders', [rel, un ? un.sig : ''], () => {
    for (const k of worldCopies()) withWorldTransform(k, (s) => {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = P.borderC;
      ctx.lineWidth = 0.6 / s;
      if (un) { ctx.save(); ctx.clip(outside(Object.values(un.paths)), 'evenodd'); }
      ctx.stroke(geo.borders);
      if (un) { ctx.lineWidth = 1.2 / s; for (const p of Object.values(un.paths)) ctx.stroke(p); ctx.restore(); }
    });
  });
}
/* Everything but the given shapes, for a clip (even-odd, in world units × PATH_K). */
function outside(paths) {
  const c = new Path2D();
  c.rect(-PATH_K, -PATH_K, 3 * PATH_K, 3 * PATH_K);
  for (const p of paths) c.addPath(p);
  return c;
}
/* The tracker's outlines under the discs, once zoomed in: only units near the view are looked at,
 * and only outlines that meet the view and span OUTLINE_MIN_PX are drawn. */
function drawOutlines() {
  outlineStats.drawn = 0;
  if (view.scale < OUTLINE_SCALE) return;
  const pts = fields.points, fy = followOn(), dim = !!highlight;
  const hw = W / (2 * view.scale), hh = H / (2 * view.scale), mx = 2 / 360, my = 0.02;
  const vy0 = view.cy - hh, vy1 = view.cy + hh, minW = OUTLINE_MIN_PX / view.scale;
  for (const k of worldCopies()) withWorldTransform(k, (s) => {
    const vx0 = view.cx - hw - k, vx1 = view.cx + hw - k;
    ctx.lineWidth = 1 / s;
    ctx.lineJoin = 'round';
    for (const p of pts) {
      if (!p.rings || !p.pass || (fy && p.appear > shown)) continue;
      if (p.x < vx0 - mx || p.x > vx1 + mx || p.y < vy0 - my || p.y > vy1 + my) continue;
      const o = outlineOf(p);
      if (!o) continue;
      const b = o.bbox;
      if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1 || (b[2] - b[0] < minW && b[3] - b[1] < minW)) continue;
      const a = dim && !p.hl ? 0.15 : 1, col = P.fuel[p.fuel];
      ctx.fillStyle = col; ctx.globalAlpha = P.tintAlpha * a; ctx.fill(o.path);
      ctx.strokeStyle = col; ctx.globalAlpha = P.edgeAlpha * a; ctx.stroke(o.path);
      outlineStats.drawn++;
    }
    ctx.globalAlpha = 1;
  });
}
/* Filled: producing. Ring: found, not yet producing in the year shown (only while the fields follow
 * the year). No figure: pale while following the year, an open ring otherwise. Every filled disc has
 * its rim (owner call 6) unless Map layers turns the rims off. With a highlight, the others go first at
 * 15 % and the highlighted on top. */
function drawFields() {
  stats.fieldPasses++;
  const res = sizeBy === 'res', pts = res ? fields.byRes : fields.points, fy = followOn(), dim = !!highlight;
  for (let pass = dim ? 0 : 1; pass < 2; pass++) {
    const alpha = pass ? 1 : 0.15;
    ctx.globalAlpha = alpha;
    for (const p of pts) {
      if (!p.pass || (dim && p.hl !== pass) || (fy && p.appear > shown)) continue;
      const r = fieldRadius(p), x = worldToScreenX(p.x), y = worldToScreenY(p.y);
      if (x < -r || x > W + r || y < -r || y > H + r) continue;
      const col = P.fuel[p.fuel];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      if (fy && p.fill > shown) { ctx.strokeStyle = col; ctx.lineWidth = 1.75; ctx.stroke(); }
      else if ((res ? p.rv : p.v) == null) {
        if (fy) { ctx.globalAlpha = alpha * P.paleAlpha; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = alpha; }
        else { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke(); }
      } else { ctx.fillStyle = col; ctx.fill(); if (rimOn) { ctx.strokeStyle = P.rimC; ctx.lineWidth = 1; ctx.stroke(); } }
    }
  }
  ctx.globalAlpha = 1;
}

/* What names keep out of: the card, the key column and the ghost key, in plate coordinates, read from
 * layout once and dropped when any of them moves, opens or closes. */
let exclCache = null;
const dropExclusions = () => { exclCache = null; };
function exclusions() {
  if (exclCache) return exclCache;
  const w = wrap.getBoundingClientRect(), out = [];
  for (const id of ['card', 'keys', 'focus-exit']) {
    const e = $(id);
    if (e.hidden || e.closest('[hidden]')) continue;
    const r = e.getBoundingClientRect();
    if (r.width) out.push([r.left - w.left - 4, r.top - w.top - 4, r.right - w.left + 4, r.bottom - w.top + 4]);
  }
  return (exclCache = out);
}
/* Names, drawn last, on halos (B6): only where they fit inside their own country, largest first, never
 * on each other or on the plate's controls. Widths are measured in the face, once it is in. */
let labelOrder = null, placedLabels = [];
function drawLabels() {
  const cs = geo.countries, cl = prod && link && shown != null ? colorsFor(shown) : null;
  if (!labelOrder || labelOrder.geo !== geo) labelOrder = { geo, order: cs.map((c, i) => i).sort((a, b) => cs[b].lw - cs[a].lw) };
  const placed = exclusions().slice(), fixed = placed.length;
  ctx.font = LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = P.haloC;
  ctx.fillStyle = P.label;
  for (const i of labelOrder.order) {
    const c = cs[i], bw = c.lw * view.scale, u = cl && cl.of[i];
    if (bw < 44) break;                                   // sorted: all the rest are smaller
    // a former state's shape is named once, at its lead member, by its own name
    if (u && LEAD[u] !== c.iso3) continue;
    const name = u ? shortName(prod.s, prod.byIso.get(u)) : c.name;
    if (c.tw == null) c.tw = ctx.measureText(c.name).width;
    const tw = u ? ctx.measureText(name).width : c.tw;
    if (tw > bw * 1.25) continue;
    const x = worldToScreenX(c.lx), y = worldToScreenY(c.ly);
    if (x - tw / 2 < 4 || x + tw / 2 > W - 4 || y < 10 || y > H - 10) continue;
    const box = [x - tw / 2 - 3, y - 8, x + tw / 2 + 3, y + 8];
    if (placed.some((b) => b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1])) continue;
    box.i = i;
    placed.push(box);
    ctx.strokeText(name, x, y);
    ctx.fillText(name, x, y);
  }
  placedLabels = placed.slice(fixed);
}
/* The selection: a country's outline in ink over a halo; a field's four 4 px registration ticks
 * around its disc (never a circle, which would read as "found, not yet producing"). */
function drawSelection() {
  if (!sel || !geo) return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (sel.kind === 'country') {
    const g = geo.countries.find((c) => c.iso3 === sel.iso3), u = !g && prod && link && shown != null && colorsFor(shown).paths[sel.iso3];
    // a former state's shape is traced from outside, so the borders inside it stay hidden
    if (g || u) for (const k of worldCopies()) withWorldTransform(k, (s) => {
      const p = g ? g.path : u, f = g ? 1 : 2;
      if (u) { ctx.save(); ctx.clip(outside([u]), 'evenodd'); }
      ctx.strokeStyle = P.selHalo; ctx.lineWidth = (3.5 * f) / s; ctx.stroke(p);
      ctx.strokeStyle = P.sel; ctx.lineWidth = (1.5 * f) / s; ctx.stroke(p);
      if (u) ctx.restore();
    });
  } else if (fieldsDrawn()) {
    const p = fields.byId.get(sel.id);
    if (!p || !fieldVisible(p)) return;
    const r = fieldRadius(p), x = worldToScreenX(p.x), y = worldToScreenY(p.y);
    ctx.beginPath();
    for (let a = 0; a < 4; a++) {
      const dx = Math.cos(a * Math.PI / 2), dy = Math.sin(a * Math.PI / 2);
      ctx.moveTo(x + dx * (r + 2), y + dy * (r + 2));
      ctx.lineTo(x + dx * (r + 6), y + dy * (r + 6));
    }
    ctx.strokeStyle = P.selHalo; ctx.lineWidth = 3.5; ctx.stroke();
    ctx.strokeStyle = P.sel; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/* ── the Ledger (ART.md section 1) ───────────────────────────────────────── *
 * Under the plate, the full width of the caption band: one ink block per producer at 1 % of the world
 * or more, widest first, each `share × width − 1` px wide and 10 px tall, a 1 px gap after it; the rest
 * hatched at 45°; the chosen country's block traced under it; labels in 10.5 px below it, placed as
 * their own comment says. ledgerAt() (js/data.js) does the arithmetic, rule B included. */
const ledgerCv = $('ledger-cv'), lctx = ledgerCv.getContext('2d');
let ledgerKey = '', ledgerW = 0, ledgerTok = null, ledgerBlocks = [];
const chosenIso = () => (sel && sel.kind === 'country' ? sel.iso3 : null);
const whose = () => (prod.s.world ? "the world's" : "all listed countries'");
function drawLedger() {
  const key = [shown, mode, accum, ledgerW, dpr, P.name, chosenIso(), fontReady, !!prod].join('|');
  if (key === ledgerKey) return;
  ledgerKey = key;
  stats.ledgerDraws++;
  const w = ledgerW, h = 30;
  if (ledgerCv.width !== Math.round(w * dpr) || ledgerCv.height !== h * dpr) { ledgerCv.width = Math.round(w * dpr); ledgerCv.height = h * dpr; }
  const c = lctx;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  ledgerBlocks = [];
  if (!prod || shown == null || !w) { setText($('ledger-say'), ''); return; }
  if (!ledgerTok) ledgerTok = { ink: css('--ink'), ink2: css('--ink-2') };
  const L = ledgerAt(prod, mode, isCum(), shown);
  if (!L.world) { setText($('ledger-say'), `No world figure for ${shown}.`); return; }
  const ink = P.ledger, top = 1, bh = 10;
  c.fillStyle = ink;
  let x = 0;
  for (const b of L.blocks) {
    const bw = b.width * w;
    c.fillRect(x, top, Math.max(1, bw - 1), bh);
    ledgerBlocks.push({ ...b, x0: x, x1: x + bw });
    x += bw;
  }
  if (L.rest > 0 && x < w - 0.5) {
    c.save();
    c.beginPath(); c.rect(x, top, w - x, bh); c.clip();
    c.strokeStyle = ink; c.lineWidth = P.hatchWidth;
    c.beginPath();
    const step = P.hatchPitch * Math.SQRT2;              // 3 px apart, measured across the lines
    for (let k = x - bh; k < w + bh; k += step) { c.moveTo(k, top + bh); c.lineTo(k + bh, top); }
    c.stroke();
    c.restore();
  }
  // the chosen country: its own block, or its former state's in a year the former state holds it
  const iso = chosenIso();
  const chosen = iso && (ledgerBlocks.find((b) => b.iso3 === iso) || ledgerBlocks.find((b) => b.iso3 === FORMER_STATE[iso])) || null;
  if (chosen) {
    const g = c.createLinearGradient(chosen.x0, 0, chosen.x1, 0);
    g.addColorStop(0, rgba(ink, 0)); g.addColorStop(1, ink);
    c.fillStyle = g;
    c.fillRect(chosen.x0, top + bh + 2, Math.max(1, chosen.x1 - chosen.x0 - 3), 2);
    c.fillStyle = ink;
    c.beginPath(); c.arc(Math.max(chosen.x0 + 2, chosen.x1 - 3), top + bh + 3, 2, 0, Math.PI * 2); c.fill();
  }
  if (fontReady) {
    const ly = top + bh + 6, boxes = [];
    const label = (b) => `${b.name} ${U.pct(b.share * 100)}`;
    const fits = (x0, x1) => x1 <= w && boxes.every(([a, z]) => x1 + 10 <= a || x0 >= z + 10);
    c.textBaseline = 'top'; c.textAlign = 'left';
    // the chosen country's label (560, --ink) at its block, then the three widest at the first free x
    // that leaves half the block, or 10 px of it, after the start; the fullest forms that fit together
    // (name and share, the name, the share), earlier first, the chosen's too; the most named wins
    const free = (b, tw) => { if (b === chosen) return clamp(b.x0, 0, Math.max(0, w - tw)); let x = b.x0; for (const [a, z] of [...boxes].sort((p, q) => p[0] - q[0])) if (x < z + 10 && x + tw + 10 > a) x = z + 10; return b.x1 - x >= Math.min((b.x1 - b.x0) / 2, 10) && x + tw <= w ? x : null; };
    const want = [...new Set([chosen, ...ledgerBlocks.slice(0, 3)])].filter(Boolean), n = want.length;
    const font = (b) => { c.font = b === chosen ? CHOSEN_FONT : SMALL_FONT; c.fillStyle = b === chosen ? ledgerTok.ink : ledgerTok.ink2; };
    const forms = want.map((b) => { font(b); return [label(b), b.name, U.pct(b.share * 100)].map((t) => [t, c.measureText(t).width]); });
    let best = [];
    for (let k = 0; k < 3 ** n && best.length < n; k++) {
      boxes.length = 0;
      const named = [];
      for (const [i, b] of want.entries()) {
        const [t, tw] = forms[i][(k / 3 ** (n - 1 - i) | 0) % 3], x = free(b, tw);
        if (x != null) { boxes.push([x, x + tw]); named.push([b, t, x, tw]); }
      }
      if (named.length > best.length) best = named;
    }
    boxes.length = 0;
    for (const [b, t, x, tw] of best) { font(b); c.fillText(t, x, ly); boxes.push([x, x + tw]); }
    font();
    for (const b of ledgerBlocks) {
      if (best.some((m) => m[0] === b)) continue;
      const t = label(b), tw = c.measureText(t).width;
      if (fits(b.x0, b.x0 + tw)) { c.fillText(t, b.x0, ly); boxes.push([b.x0, b.x0 + tw]); }
    }
  }
  const what = isCum() ? `all the ${mode === 'total' ? 'oil and gas' : mode} produced to ${shown}` : `${whose()} ${mode === 'total' ? 'oil and gas' : mode} in ${shown}`;
  setText($('ledger-say'), `Shares of ${what}: ${L.blocks.slice(0, 5).map((b) => `${b.name} ${U.pctSpoken(b.share * 100)}`).join(', ')}; `
    + `${L.blocks.length} ${L.blocks.length === 1 ? 'producer' : 'producers'} of 1 percent or more; all others ${U.pctSpoken(L.rest * 100)}.`);
}

// a tap opens the card of the block under it (VoiceOver hears the sentence; Find is the keyboard's way)
ledgerCv.addEventListener('click', (e) => {
  const x = e.clientX - ledgerCv.getBoundingClientRect().left, b = ledgerBlocks.find((k) => x >= k.x0 && x < k.x1);
  if (b) select({ kind: 'country', iso3: b.iso3 }, { announce: true });
});

/* ── the stamp, the legend, the caption line, the lead, the credits ──────── */

function setProblem(key, file, msg) {
  if (msg) problems.set(key, `${file}${msg}`); else problems.delete(key);
  const box = $('error');
  box.textContent = '';
  for (const m of problems.values()) box.append(el('div', null, m));
  box.hidden = !problems.size;
}
let readCount = 0;
function updateStamp() {
  const st = $('stamp');
  st.textContent = '';
  if (!prod) {
    st.textContent = reading ? `Reading the data… ${readCount} of 3` : geo ? 'Map only. Outlines from data/world.json.' : 'No data could be read';
    return;
  }
  const ms = Date.parse(prod.s.generatedAt);
  if ((Date.now() - ms) / 864e5 > STALE_DAYS) st.append(el('span', 'stale', 'Stale. '));
  st.append(`Updated ${U.when(ms)}, figures to ${prod.Y1}`);
}
function creditsList() {
  const out = [];
  if (prod) for (const s of prod.s.sources) if (s && isStr(s.attribution)) out.push(s.attribution);
  if (!out.some((a) => /natural earth/i.test(a)) && geo && geo.source) out.push(geo.source);
  if (depthOn()) out.push('Bathymetry: GEBCO');
  if (terrainOn()) out.push('Relief: Natural Earth I (public domain)');
  if (fieldsDrawn() && fields.raw.source && isStr(fields.raw.source.attribution)) out.push(fields.raw.source.attribution);
  return out;
}
/* The credit line, first under About's Sources and credits; each source in full follows it there. */
function updateCredits() { const l = creditsList(); setText($('about-credit-line'), l.length ? creditLine(l) : ''); }

function updateLegend() {
  const spec = unitSpec();
  setText($('btn-units'), spec.label);
  $('btn-units').setAttribute('aria-label', `Change units, now ${spec.label}`);
  $('legend').hidden = !(prod && geo);
  if (!prod) return;
  setText($('legend-name'), `${MODES[mode]} ${isCum() ? 'to date' : 'a year'}`);
  $('legend-bar').style.background = `linear-gradient(to right, ${P.ramp.join(', ')})`;
  const box = $('legend-ticks'), [lo, hi] = spec.dom, L0 = Math.log10(lo), span = Math.log10(hi) - L0;
  box.textContent = '';
  const bw = $('legend-bar').clientWidth || 190, wOf = (t) => widthOf(SMALL_FONT, t);
  const first = `≤${U.NNBSP}${U.tick(lo)}`, last = `≥${U.NNBSP}${U.tick(hi)}${U.NNBSP}${spec.label}`;
  const labels = [[first, 0, 'first']];
  let edge = wOf(first) + 8;
  const endEdge = bw - wOf(last) - 8;
  for (let e = Math.ceil(L0 + 1e-9); e <= Math.floor(Math.log10(hi) - 1e-9); e++) {
    const t = U.tick(10 ** e), x = ((e - L0) / span) * bw, tw = wOf(t);
    if (x - tw / 2 > edge && x + tw / 2 < endEdge) { labels.push([t, x / bw, '']); edge = x + tw / 2 + 8; }
  }
  labels.push([last, 1, 'last']);
  for (const [t, p, cls] of labels) { const s = el('span', cls, t); s.style.left = `${p * 100}%`; box.append(s); }
}

/* The caption line: a note when one applies, then the bar's caption with its year, and the key after
 * them (always drawn); the longest form that fits the line's fixed height with the key, measured in the
 * face (never a third line). */
let rlW = 300, rlLines = 2, keyW = 160;
const wordW = new Map();
function lineCount(t) {
  measure.font = CAPTION_FONT;
  const sp = measure.measureText(' ').width;
  let lines = 1, x = 0;
  for (const word of t.split(' ')) {
    let ww = wordW.get(word);
    if (ww == null) { ww = measure.measureText(word).width; wordW.set(word, ww); }
    if (x && x + sp + ww > rlW) { lines++; x = ww; } else x += (x ? sp : 0) + ww;
  }
  return lines;
}
function captionNote() {
  if (showFields && fields && !fields.available) return 'No field points: data/fields.json says they are not available.';
  if (fieldsDrawn()) {
    if (highlight) { let n = 0; for (const p of fields.points) if (p.hl && p.pass) n++; return `Highlighted: ${highlight.name}, ${U.int(n)} ${n === 1 ? 'field' : 'fields'}.`; }
    const bits = [settingFilter, typeFilter].filter((v) => v !== 'all');
    if (bits.length) return `Fields: ${bits.join(', ')} only.`;
  }
  return '';
}
/* Lines the caption takes with the key after it: on its last line when it fits there, else its own. */
function withKey(t) {
  const n = lineCount(t);
  return n > 1 || widthOf(CAPTION_FONT, t) + 12 + keyW > rlW ? n + 1 : 1;
}
function readline() {
  if (!prod) return geo ? 'Plain countries: no production figures could be read.' : '';
  if (!worldAt(prod, mode, shown, isCum()).v) return `No world figure for ${shown}.`;
  const what = mode === 'total' ? 'oil and gas' : mode;
  const bar = isCum() ? `Bar: shares of all the ${what} produced to ${shown}.` : `Bar: shares of ${whose()} ${what} in ${shown}.`;
  const note = captionNote();
  // a note leads, then the bar's caption with its year (HOUSE 5.2 test 3), where it fits beside the key
  const forms = note ? [`${note} ${bar}`, note] : [bar];
  return forms.find((f) => withKey(f) <= rlLines) || forms[forms.length - 1];
}
/* The lead beside the year: the world's figure, and while the fields are drawn how many produce;
 * the fields' part is read by VoiceOver but dropped from sight when the row has no room for it. */
let leadW = 200;
function lead() {
  const w = worldAt(prod, mode, shown, isCum()), spec = unitSpec();
  const world = w.v == null ? 'World: no figure' : `${w.label === 'world' ? 'World' : 'All listed'} ${U.withUnit(U.sig3(toUnit(w.v)), spec.label)}${isCum() ? ' to date' : ''}`;
  let more = '';
  if (fieldsDrawn()) {
    const c = countFields();
    more = followOn() ? `, ${U.int(c.producing)} ${c.producing === 1 ? 'field' : 'fields'} producing` : `, ${U.int(c.drawn)} fields shown`;
  }
  return [world, more];
}
const hasFigures = () => !!prod;
function syncTime() {
  const off = String(!hasFigures());
  for (const id of ['btn-play', 'btn-prev', 'btn-next']) if ($(id).getAttribute('aria-disabled') !== off) $(id).setAttribute('aria-disabled', off);
  setText($('readline'), readline());
  if (!prod || shown == null) { setText($('valid-time'), '–'); setText($('lead-world'), ''); setText($('lead-fields'), ''); drawLedger(); return; }
  setText($('valid-time'), String(shown));
  const [world, more] = lead();
  setText($('lead-world'), world);
  setText($('lead-fields'), more);
  $('lead-fields').className = more && widthOf(LEAD_FONT, world + more) > leadW ? 'sr' : '';
  slider.setAttribute('aria-valuenow', String(shown - prod.Y0));
  slider.setAttribute('aria-valuetext', shown === prod.Y1 ? `${shown}, the newest year` : String(shown));
  track.draw(shown - prod.Y0);
  drawLedger();
  if (cardDyn) cardDyn();
  if (detailsDyn) detailsDyn();
  if (!$('layers').hidden) syncLayers();
}

/* ── the card: the tapped country or field ───────────────────────────────── */

let cardDyn = null;
const tmp = { v: null, partial: false };
function rankOf(iso3, y) {
  const vals = [];
  for (const c of prod.s.countries) { const v = val(c, mode, y).v; if (v != null && v > 0) vals.push([c.iso3, v]); }
  vals.sort((a, b) => b[1] - a[1]);
  const i = vals.findIndex((v) => v[0] === iso3);
  return i < 0 ? null : { r: i + 1, n: vals.length };
}
/* A former state's name as a sentence starts it: "The USSR". */
const stateName = (c) => { const n = shortName(prod.s, c); return n === 'USSR' ? 'The USSR' : n; };
/* For a member of a former state with nothing of its own in the year shown: the state it was part of,
 * when that state has a figure then, and whether the map draws it in that state's color. For the state
 * itself, the members it is drawn over. */
function formerStateNote(iso3, y) {
  const cl = colorsFor(y), u = cl.paths[iso3] && formerUnions(prod, mode, isCum(), y).find((x) => x.state === iso3);
  if (u) {
    const on = (l) => l.filter((x) => geo.index.has(x)).length, n = on(u.members), all = on(MEMBERS[iso3]);
    return `On the map it is drawn over ${n === all ? 'its' : `${n} of its`} ${all} successor states, which report nothing of their own ${isCum() ? 'to' : 'in'} ${y}.`;
  }
  const state = FORMER_STATE[iso3], h = state && prod.byIso.get(state), r = h && val(h, mode, y);
  if (!r || r.v == null) return '';
  const name = stateName(h), the = name.replace(/^The /, 'the '), i = geo ? geo.index.get(iso3) : null;
  return `${i != null && cl.of[i] ? `Drawn as part of ${the} ${isCum() ? 'to' : 'in'} ${y}` : `No figure of its own ${isCum() ? 'to' : 'in'} ${y}: it was part of ${the} then`}. `
    + `${name}, ${MODES[mode].toLowerCase()}${isCum() ? ' to date' : ''}: ${U.withUnit(U.sig3(toUnit(r.v)), unitSpec().label)}.`;
}
const FUEL = { oil: 'Oil', gas: 'Gas', both: 'Oil and gas' };
function dlRow(dl, k, v) {
  if (v == null || v === '') return null;
  dl.append(el('dt', null, k));
  const dd = el('dd', null, String(v));
  dl.append(dd);
  return dd;
}
/* What a field's disc shows in the year: [value, unit, line under it, spoken]. */
function fieldFigure(p) {
  const sys = sysOf(), fy = followOn();
  if (fy && p.appear > shown) return ['Not yet found', '', `First on the map in ${p.appear}.`, 'not yet found'];
  if (fy && p.fill > shown && sizeBy !== 'res') return ['Not yet producing', '', `Found by ${shown}.`, 'found, not yet producing'];
  let v, kind = 'oe', rate = true, line;
  if (sizeBy === 'res') {
    if (p.rv == null) return ['No reserves reported', '', '', 'no reserves reported'];
    v = p.rv * 1e6; rate = false;
    line = `Reserves${isStr(p.f.resClass) ? `, ${p.f.resClass}` : ''}${Number.isFinite(p.f.resYear) ? `, ${p.f.resYear}` : ''}.`;
  } else if (estOn() && p.es != null) {
    const py = p.prodYear ?? 'newest';
    if (isCum()) { v = estCum(prod, p, shown) * 1e6; rate = false; line = `Estimated to ${shown} from the ${py} report.`; }
    else { v = estRate(prod, p, shown); line = py === shown ? `Reported for ${py}.` : `Estimated for ${shown} from the ${py} report.`; }
  } else {
    if (p.v == null) return ['No rate reported', '', '', 'no rate reported'];
    v = p.v; line = `Reported for ${p.prodYear ?? 'its newest data year'}.`;
  }
  return [U.sig3(U.fieldValue(v, kind, sys)), `${U.NNBSP}${U.fieldUnit(kind, sys, rate)}`, line, U.fieldSpoken(v, kind, sys, rate)];
}
function renderCard(announce) {
  const box = $('card'), rows = $('card-rows'), note = $('card-note');
  cardDyn = null;
  dropExclusions();
  if (!sel || !$('details').hidden || !$('layers').hidden) { box.hidden = true; return; }
  rows.textContent = '';
  $('card-name').hidden = true;
  let sentence = '';
  if (sel.kind === 'country') {
    if (!prod) { box.hidden = true; return; }
    const g = geo && geo.countries.find((c) => c.iso3 === sel.iso3), c = prod.byIso.get(sel.iso3) || null;
    if (!g && !c) { box.hidden = true; return; }
    const name = g ? g.name : stateName(c), span = c && seriesSpan(c);
    setText($('card-where'), name);
    const oil = dlRow(rows, 'Oil', '–'), gas = dlRow(rows, 'Gas', '–');
    dlRow(rows, 'Series', !span ? 'none' : span[1] < prod.Y1 ? `${span[0]} to ${span[1]}; later years are not in it` : `${span[0]} to ${span[1]}`);
    cardDyn = () => {
      const spec = unitSpec(), cum = isCum(), w = worldAt(prod, mode, shown, cum), of = w.label === 'world' ? 'of the world' : 'of all listed';
      const r = c ? val(c, mode, shown) : { v: null, partial: false }, v = r.v, partial = r.partial;
      setText($('card-value'), v == null ? 'No figure' : U.sig3(toUnit(v)));
      setText($('card-unit'), v == null ? '' : `${U.NNBSP}${spec.label}`);
      const rank = v ? rankOf(sel.iso3, shown) : null, late = cum && span && shown > span[1] && v != null;
      setText($('card-sub'), `${MODES[mode]} ${cum ? 'to' : 'in'} ${shown}${late ? `, with no figures after ${span[1]}` : ''}`
        + `${v != null && w.v ? `, ${U.pct((v / w.v) * 100)} ${of}` : ''}${rank ? `, ${U.ordinal(rank.r)} of ${rank.n}` : ''}.`);
      for (const [dd, m] of [[oil, 'oil'], [gas, 'gas']]) {
        const x = c ? val(c, m, shown).v : null, wm = worldAt(prod, m, shown, cum).v;
        setText(dd, x == null ? 'No figure' : `${U.withUnit(U.sig3(toUnit(x)), spec.label)}${wm ? `, ${U.pct((x / wm) * 100)}` : ''}`);
      }
      const notes = [];
      if (!c) notes.push('data/snapshot.json has no series for this country, so it is plain in every year.');
      if (partial) notes.push(`${val(c, 'oil', shown).v == null ? 'Oil' : 'Gas'} has no figure ${cum ? 'up to' : 'for'} ${shown}, so the total counts ${val(c, 'oil', shown).v == null ? 'gas' : 'oil'} only.`);
      if (!(v > 0) || !g) { const fs = formerStateNote(sel.iso3, shown); if (fs) notes.push(fs); }
      setText(note, notes.join(' '));
      note.hidden = !notes.length;
      return { v, w };
    };
    const now = cardDyn(), spec = unitSpec();
    sentence = `${name}. ${MODES[mode]} ${isCum() ? 'to' : 'in'} ${shown}: ${now.v == null ? 'no figure' : `${U.sig3(toUnit(now.v), true)} ${spec.say}`}`
      + `${now.v != null && now.w.v ? `, ${U.pctSpoken((now.v / now.w.v) * 100)} of the world` : ''}.`;
  } else {
    const p = fields && fields.byId.get(sel.id);
    if (!p) { box.hidden = true; return; }
    const f = p.f;
    setText($('card-where'), [isStr(f.country) ? f.country : 'Country not stated', f.offshore === 1 ? 'offshore' : f.offshore === 0 ? 'onshore' : ''].filter(Boolean).join(', '));
    setText($('card-name'), f.name || 'Unnamed field');
    $('card-name').hidden = false;
    dlRow(rows, 'Fuel', FUEL[p.fuel] || (isStr(f.fuel) ? f.fuel : 'Not stated'));
    dlRow(rows, 'Status', f.status);
    dlRow(rows, 'Discovered', f.disc);
    dlRow(rows, 'First production', f.start);
    dlRow(rows, 'Operator', f.operator);
    note.hidden = true;
    cardDyn = () => {
      const [v, u, line] = fieldFigure(p);
      setText($('card-value'), v); setText($('card-unit'), u); setText($('card-sub'), line);
    };
    cardDyn();
    const fig = fieldFigure(p);
    sentence = `${f.name || 'Unnamed field'}, ${$('card-where').textContent}. ${fig[2] ? `${fig[2]} ` : ''}${fig[3][0].toUpperCase()}${fig[3].slice(1)}.`;
  }
  box.hidden = false;
  placeCard();
  if (announce) say(sentence);
}
/** Where on the plate the selection is, for keeping the card off it. */
function selPoint() {
  if (!sel) return null;
  if (sel.kind === 'field') { const p = fields && fields.byId.get(sel.id); return p ? [worldToScreenX(p.x), worldToScreenY(p.y)] : null; }
  if (sel.at) return [worldToScreenX(sel.at[0]), worldToScreenY(sel.at[1])];
  const g = geo && geo.countries.find((c) => c.iso3 === sel.iso3);
  return g ? [worldToScreenX(g.lx), worldToScreenY(g.ly)] : null;
}
/* The card sits at the plate's top left and moves to the bottom left when it would cover what was
 * tapped (and stays at the top if both would). */
function placeCard() {
  const box = $('card'), p = selPoint();
  dropExclusions();
  if (box.hidden) return;
  const covers = () => p && p[0] > box.offsetLeft - 12 && p[0] < box.offsetLeft + box.offsetWidth + 12
    && p[1] > box.offsetTop - 12 && p[1] < box.offsetTop + box.offsetHeight + 12;
  box.classList.remove('low');
  if (covers()) { box.classList.add('low'); if (covers()) box.classList.remove('low'); }
}
function select(s, { announce = false, keepSheet = false } = {}) {
  sel = s;
  store.set(STORE.sel, JSON.stringify(s ? { kind: s.kind, iso3: s.iso3, id: s.id } : null));
  if (!keepSheet || !s) closeSheets(true);
  if (s && !$('details').hidden) renderDetails();
  renderCard(announce);
  requestRender();
  timeDirty = true;
}

/* ── the sheet's slot: details, or the map's layers; it shrinks the plate rather than covering it ── */

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
  if (!sel) return;
  openSheet('details');
  renderDetails();
  $('details-close').focus({ preventScroll: true });
}
let tok = null;
const tokens = () => tok || (tok = { ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), line: css('--line'), oil: css('--chart-oil'), gas: css('--chart-gas') });
/* Oil and gas as two lines on one axis in the unit shown; gaps where the file says null. */
function drawChart(cv, c0) {
  const w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight), r = Math.min(3, window.devicePixelRatio || 1), T = tokens();
  if (cv.width !== Math.round(w * r)) cv.width = Math.round(w * r);
  if (cv.height !== Math.round(h * r)) cv.height = Math.round(h * r);
  const g = cv.getContext('2d'), c = isCum() ? cumOf(prod, c0) : c0;
  g.setTransform(r, 0, 0, r, 0, 0);
  g.clearRect(0, 0, w, h);
  const pl = 2, pr = 2, pt = 16, pb = 14, iw = w - pl - pr, ih = h - pt - pb;
  let max = 0;
  for (let i = 0; i < c.oil.length; i++) for (const v of [c.oil[i], c.gas[i]]) if (v != null && v > max) max = v;
  const maxU = toUnit(max) || 1, n = prod.Y1 - prod.Y0;
  const X = (y) => pl + ((y - prod.Y0) / Math.max(1, n)) * iw, Y = (gwh) => pt + ih - (toUnit(gwh) / maxU) * ih;
  g.font = SMALL_FONT;
  g.fillStyle = T.line;
  g.fillRect(pl, pt, iw, 1);
  g.fillRect(pl, pt + ih, iw, 1);
  g.fillStyle = T.ink3; g.textBaseline = 'bottom'; g.textAlign = 'left';
  g.fillText(U.withUnit(U.sig3(maxU), unitSpec().label), pl, pt - 2);
  g.fillStyle = T.ink2; g.textBaseline = 'top';
  g.fillText(String(prod.Y0), pl, pt + ih + 2);
  g.textAlign = 'right';
  g.fillText(String(prod.Y1), w - pr, pt + ih + 2);
  g.lineJoin = 'round'; g.lineWidth = 1.5;
  for (const m of ['gas', 'oil']) {
    g.strokeStyle = T[m];
    g.beginPath();
    let pen = false;
    for (let i = 0; i < c[m].length; i++) {
      const v = c[m][i];
      if (v == null) { pen = false; continue; }
      if (pen) g.lineTo(X(c.y0 + i), Y(v)); else g.moveTo(X(c.y0 + i), Y(v));
      pen = true;
    }
    g.stroke();
  }
  const x = Math.round(X(shown)) + 0.5;
  g.fillStyle = T.ink;
  g.fillRect(x - 0.5, pt, 1, ih);
  for (const m of ['gas', 'oil']) {
    const v = seriesAt(c, m, shown, tmp).v;
    if (v == null) continue;
    g.fillStyle = T[m];
    g.beginPath(); g.arc(x, Y(v), 3, 0, Math.PI * 2); g.fill();
  }
}
function renderDetails() {
  const b = $('details-body');
  b.textContent = '';
  detailsDyn = null;
  if (!sel) return;
  if (sel.kind === 'country') countryDetails(b); else fieldDetails(b);
}
function countryDetails(b) {
  const g = geo && geo.countries.find((c) => c.iso3 === sel.iso3), c = prod && prod.byIso.get(sel.iso3);
  setText($('details-title'), g ? g.name : c ? stateName(c) : sel.iso3);
  if (!c) { b.append(el('p', 'sheet-note', 'data/snapshot.json has no series for this country, so it is plain in every year. About lists every outline without a series and every series without an outline.')); trackerSection(b, null, g && g.name); return; }
  const cv = el('canvas', 'chart'), key = el('div', 'chart-key'), ko = el('span', 'oil'), kg = el('span', 'gas');
  cv.setAttribute('role', 'img');
  key.append(ko, kg);
  b.append(cv, key);
  const notes = el('div');
  b.append(notes);
  trackerSection(b, c, g && g.name);
  detailsDyn = () => {
    drawChart(cv, c);
    const spec = unitSpec(), part = (m) => { const v = val(c, m, shown).v; return v == null ? 'no figure' : U.withUnit(U.sig3(toUnit(v)), spec.label); };
    setText(ko, `Oil ${part('oil')}`); setText(kg, `Gas ${part('gas')}`);
    if (!ko.firstChild || ko.firstChild.nodeName !== 'I') { ko.prepend(el('i')); kg.prepend(el('i')); }
    cv.setAttribute('aria-label', `${isCum() ? 'Oil and gas produced to date' : 'Oil and gas production'}, ${prod.Y0} to ${prod.Y1}, in ${spec.say}. ${shown}: ${ko.textContent}, ${kg.textContent}.`);
    notes.textContent = '';
    if (isCum()) notes.append(el('p', 'sheet-note', 'To date: every year from the first with data up to the one shown, added up; a year with no data adds nothing, and a series that has ended keeps its total.'));
    if (!prod.s.world) notes.append(el('p', 'sheet-note', 'Shares are of the sum of every country listed that year: the file has no world total.'));
  };
  detailsDyn();
}
/* "In the tracker": the units filed under this country, the five with the highest reported rate, and
 * their sum against the country's own figure for their year. */
function trackerSection(body, c, name) {
  if (!fields || !fields.available) return;
  let list = null;
  for (const n of [c && c.name, name]) if (isStr(n) && (list = fields.byCountry.get(countryKey(n)))) break;
  body.append(el('h3', null, 'In the tracker'));
  if (!list) { body.append(el('p', 'sheet-note', 'No extraction units under this country name.')); return; }
  const shownList = list.filter((p) => p.pass), rated = shownList.filter((p) => p.v != null).sort((a, b) => b.v - a.v), sys = sysOf();
  body.append(el('p', 'sheet-note', `${U.int(shownList.length)} ${shownList.length === 1 ? 'unit' : 'units'}`
    + (shownList.length !== list.length ? ` of ${U.int(list.length)} (the layer filters apply)` : '') + `, ${U.int(rated.length)} with a reported rate.`));
  if (!rated.length) return;
  const ul = el('ul', 'tlist');
  for (const p of rated.slice(0, 5)) {
    const btn = el('button');
    btn.type = 'button';
    btn.append(el('span', null, p.f.name || 'Unnamed field'), el('span', 'v', `${U.field(p.v, 'oe', sys)}${p.prodYear ? `, ${p.prodYear}` : ''}`));
    btn.addEventListener('click', () => chooseField(p));
    const li = el('li'); li.append(btn); ul.append(li);
  }
  body.append(ul);
  if (!c) return;
  // the comparison follows the Oil, Gas, Oil and gas words, in kboe/d: the one unit both files carry
  let sum = 0, n = 0;
  const years = new Map();
  for (const p of rated) {
    const o = Number.isFinite(p.f.oilBpd) ? p.f.oilBpd : null, gv = Number.isFinite(p.f.gasBoepd) ? p.f.gasBoepd : null;
    const v = mode === 'oil' ? o : mode === 'gas' ? gv : p.v;
    if (v == null) continue;
    sum += v; n++;
    if (p.prodYear != null) years.set(p.prodYear, (years.get(p.prodYear) || 0) + 1);
  }
  if (!n) return;
  let py = null, pyN = 0;
  for (const [y, k] of years) if (k > pyN) { py = y; pyN = k; }
  const cy = clamp(py ?? prod.Y1, prod.Y0, prod.Y1), r = seriesAt(c, mode, cy, tmp).v;
  const ck = r == null ? null : U.toUnit(r, 'kboe', false, prod.boePerTWh), what = MODES[mode].toLowerCase(), kb = (v) => U.withUnit(U.sig3(v), 'kboe/d');
  let t = `Summed reported rates, ${what}: ${kb(sum / 1000)}${py == null ? '' : pyN === n ? ` (for ${py})` : ` (mostly for ${py})`}. `;
  t += ck ? `The country's ${cy} figure is ${kb(ck)}, so the tracker's units come to about ${U.pct((sum / 1000 / ck) * 100)} of it. `
    : `The country has no ${what} figure for ${cy} to compare with. `;
  body.append(el('p', 'sheet-note', t + "Indicative only: the tracker's barrels are volumes, the country figure is energy-equivalent."));
}
function fieldDetails(b) {
  const p = fields && fields.byId.get(sel.id);
  if (!p) return;
  const f = p.f, sys = sysOf(), dl = el('dl');
  setText($('details-title'), f.name || 'Unnamed field');
  b.append(dl);
  const row = (k, v) => dlRow(dl, k, v);
  row('Country', isStr(f.country) ? f.country : 'Not stated');
  row('Fuel', FUEL[p.fuel] || f.fuel || 'Not stated');
  row('Type', f.type); row('Status', f.status);
  row('Setting', f.offshore === 1 ? 'Offshore' : f.offshore === 0 ? 'Onshore' : null);
  row('Basin', f.basin); row('Operator', f.operator);
  if (Array.isArray(f.parents) && f.parents.length) row('Parents', f.parents.filter(isStr).join(', '));
  row('Discovered', f.disc); row('Investment decision', f.fid); row('Production start', f.start);
  const onMap = followOn() ? row('On the map', '–') : null, estDd = estOn() && p.es != null ? row('Estimate', '–') : null;
  const oil = Number.isFinite(f.oilBpd) ? f.oilBpd : null, gas = Number.isFinite(f.gasBoepd) ? f.gasBoepd : null;
  const yr = Number.isFinite(f.prodYear) ? `, ${f.prodYear}` : '';
  if (oil == null && gas == null) row('Production', 'not reported');
  else {
    if (oil != null) row(`Oil${yr}`, U.fieldBoth(oil, 'oil', sys));
    if (gas != null) row(`Gas${yr}`, U.fieldBoth(gas, 'gas', sys));
    if (oil != null && gas != null) row('Together', U.fieldBoth(oil + gas, 'oe', sys));
  }
  const rOil = Number.isFinite(f.resOilMbbl) ? f.resOilMbbl : null, rGas = Number.isFinite(f.resGasMboe) ? f.resGasMboe : null;
  if (rOil != null || rGas != null) {
    const cls = isStr(f.resClass) ? f.resClass : 'reserves', ry = Number.isFinite(f.resYear) ? `, ${f.resYear}` : '';
    if (rOil != null) row(`Liquids ${cls}${ry}`, U.fieldBoth(rOil * 1e6, 'oil', sys, false));
    if (rGas != null) row(`Gas ${cls}${ry}`, U.fieldBoth(rGas * 1e6, 'gas', sys, false));
    const rate = (oil || 0) + (gas || 0);
    if (rate > 0) { const yrs = ((rOil || 0) + (rGas || 0)) * 1e6 / (rate * 365); row('Years of reserves at the reported rate', yrs > 500 ? 'over 500' : U.int(yrs)); }
  }
  if (f.approx === 1) row('Location', 'approximate (per the tracker)');
  if (estDd) {
    const from = p.undated ? 'the year before its data year' : p.start != null ? 'its production start' : p.disc != null ? 'its discovery (no start given)' : 'the year before its data year';
    b.append(el('p', 'sheet-note', `Estimate, not reported: the reported rate × ${p.ref}'s ${MODES[mode].toLowerCase()} output that year ÷ its output in `
      + `${clamp(p.prodYear ?? prod.Y1, prod.Y0, prod.Y1)}${p.k ? ' (at most 3×)' : ' (no figure then, so unscaled)'}, from ${from}, ${p.es}${isCum() ? ', summed year by year' : ''}.`));
  }
  const wiki = fieldWiki(f);
  if (wiki) { const n = el('p', 'sheet-note', 'Tracker page: '); n.append(el('span', null, wiki)); b.append(n); }
  b.append(el('p', 'sheet-note', `Field volumes are the tracker's own, for its newest data year: liquids (oil, condensate, NGL) in barrels a day, gas as barrels of oil equivalent a day at ${U.GAS_SM3}${U.NNBSP}Sm³ per boe. Reserves are the class the tracker gives. `
    + (followOn() ? 'The tracker has one rate per unit, not a series, so the size through time is the estimate above.' : 'The tracker has one rate per unit, not a series, so the disc is this reported rate in every year.')));
  detailsDyn = () => {
    if (onMap) setText(onMap, p.appear > shown ? `not yet found in ${shown}` : p.fill > shown ? `found, not yet producing in ${shown}` : `producing in ${shown}${p.undated ? ' (no dates: from the year before its data year)' : ''}`);
    if (estDd) setText(estDd, isCum() ? `${U.field(estCum(prod, p, shown) * 1e6, 'oe', sys, false)} to ${shown}` : `${U.field(estRate(prod, p, shown), 'oe', sys)} in ${shown}`);
  };
  detailsDyn();
}

/* ── the Map layers sheet ────────────────────────────────────────────────── */

const LAYER = { fields: () => showFields, follow: () => followYear, terrain: () => terrainPref, depth: () => depthPref, labels: () => showLabels, rim: () => rimOn };
function syncLayers() {
  for (const b of document.querySelectorAll('#layers .lrow')) b.setAttribute('aria-pressed', String(!!LAYER[b.dataset.layer]()));
  const usable = !!fields && fields.available;
  $('field-opts').hidden = !usable || !showFields;
  for (const [id, v] of [['status-seg', statusFilter], ['setting-seg', settingFilter], ['type-seg', typeFilter], ['size-seg', sizeBy]]) {
    for (const b of $(id).children) { const on = b.dataset.v === v; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
  }
  $('hl-clear').hidden = !highlight;
  const note = $('fields-note');
  if (!fields) { setText(note, 'data/fields.json could not be read; the notice on the map says why.'); return; }
  if (!fields.available) { setText(note, `Not available: ${isStr(fields.raw.reason) ? fields.raw.reason : 'data/fields.json says the fields are not available, and gives no reason.'}`); return; }
  const c = countFields(), src = fields.raw.source || {}, total = U.int(fields.points.length);
  setText(note, (followOn() ? `${U.int(c.drawn)} fields on the map by ${shown}`
    + (c.undated ? `, ${U.int(c.undated)} of them without dates (shown from their data year)` : '')
    + `; ${U.int(c.producing)} producing; ${U.int(c.pass)} of ${total} pass the filters` : `${U.int(c.drawn)} of ${total} shown`)
    + (fields.skipped ? `; ${U.int(fields.skipped)} without coordinates left out` : '') + `. ${src.name || 'GOGET'}${src.release ? `, ${src.release}` : ''}.`);
  // three size samples at the current zoom, in the system shown
  const res = sizeBy === 'res', cum = estOn() && isCum(), sys = sysOf(), vol = res || cum;
  const base = sys === 'si' ? [1e3, 1e4, 1e5] : [1e4, 1e5, 1e6];               // Sm³ o.e./d, or boe/d
  base.forEach((s, i) => {
    const boe = sys === 'si' ? s * U.BBL : s, mboe = vol ? (sys === 'si' ? [10, 100, 1000][i] * U.BBL : [100, 1000, 10000][i]) : 0;
    const r = sizeR(vol ? mboe : boe, res ? RES_VREF : cum ? CUM_VREF : FIELD_VREF), svg = $(`sz${i}`), d = Math.ceil(2 * r + 2);
    svg.setAttribute('width', d); svg.setAttribute('height', d); svg.setAttribute('viewBox', `0 0 ${d} ${d}`);
    const ci = svg.firstElementChild;
    ci.setAttribute('cx', d / 2); ci.setAttribute('cy', d / 2); ci.setAttribute('r', r);
    setText($(`szl${i}`), vol ? U.field(mboe * 1e6, 'oe', sys, false) : U.field(boe, 'oe', sys));
  });
  setText($('size-note'), res ? 'Size: remaining reserves.' : cum ? "Size: estimated production to date (the reported rate scaled by the country's series)."
    : estOn() ? "Size: the reported rate scaled by the country's output that year (an estimate)." : 'Size: the reported rate.');
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

/* The Ledger's facts About states, worked out from the data so they stay true when it is rebuilt. */
function ledgerFacts() {
  const ends = new Map();
  for (const c of prod.s.countries) { const sp = seriesSpan(c); if (sp && sp[1] < prod.Y1 && !historicalLabels(prod.s)[c.iso3]) ends.set(sp[1], (ends.get(sp[1]) || 0) + 1); }
  let cut = null, n = 0;
  for (const [y, k] of ends) if (k > n) { cut = y; n = k; }
  let lo = Infinity, hi = -Infinity, over = 0, overAt = '';
  for (const m of ['total', 'oil', 'gas']) for (let y = prod.Y0; y <= prod.Y1; y++) {
    const L = ledgerAt(prod, m, false, y);
    if (!L.world) continue;
    if (cut != null && y > cut) { lo = Math.min(lo, L.listed); hi = Math.max(hi, L.listed); }
    if (L.listed - 1 > over) { over = L.listed - 1; overAt = `${m === 'total' ? 'oil and gas' : m} in ${y}`; }
  }
  const out = [];
  if (cut != null && n > 1 && hi > 0) out.push(`${U.int(n)} series stop in ${cut}: from ${cut + 1} the source lists fewer countries, which add up to ${U.pct(lo * 100)} to ${U.pct(hi * 100)} of the world, so the hatched end also holds the countries it stopped listing. In Cumulative those countries keep their totals.`);
  if (over > 0) out.push(`In a few years the countries listed add up to more than the world's figure, by at most ${U.pct(over * 100)} (${overAt}); the strip is then scaled to their sum, so it never runs past its end.`);
  return out;
}
function showAbout() {
  const list = $('about-list'), notes = $('about-notes'), more = $('about-more'), srcs = $('about-sources');
  for (const e of [list, notes, more, srcs]) e.textContent = '';
  const row = (k, v) => list.append(el('dt', null, k), el('dd', null, v));
  const p = (box, t) => box.append(el('p', null, t));
  if (prod) {
    for (const t of ledgerFacts()) p(notes, t);
    const s = prod.s;
    row('Updated', U.full(Date.parse(s.generatedAt)));
    row('Years', `${prod.Y0} to ${prod.Y1}`);
    row('Series', `${U.int(s.countries.length)}, in ${s.units.series || 'GWh per year'}`);
    row('World total', s.world ? `the ${s.world.name || 'World'} series (${s.world.iso3 || 'world'})` : 'not in the file; shares use the sum of the countries listed');
    row('Conversions', `kboe/d = GWh ÷ 1${U.NNBSP}000 × ${U.int(s.units.boePerTWh)}${U.NNBSP}boe per TWh ÷ 365 ÷ 1${U.NNBSP}000; TWh/yr = GWh ÷ 1${U.NNBSP}000; to date in PWh or Gboe at the same factor; fields: 1${U.NNBSP}Sm³ = ${U.BBL}${U.NNBSP}bbl, gas at ${U.GAS_SM3}${U.NNBSP}Sm³ per boe`);
    if (isStr(s.units.note)) row('Barrels', s.units.note);
  }
  if (fields && fields.available) row('Fields', `${U.int(fields.points.length)} units with coordinates; ${U.int(fields.points.filter((x) => x.operating).length)} operating`);
  if (link) {
    const hist = historicalLabels(prod.s), withOutline = prod.s.countries.length - link.noPolygon.length - link.historical.length;
    more.append(el('h4', null, 'Matching countries to outlines'));
    p(more, `Series are matched to Natural Earth outlines by ISO 3166 alpha-3 code: ${withOutline} of ${prod.s.countries.length} series have an outline.`);
    if (link.historical.length) p(more, `Former states, with no outline of their own, counted in the world total, in ranks and in the Ledger by rule B: ${link.historical.map((c) => `${hist[c.iso3]} (${c.iso3})`).join(', ')}. In any year a former state has a figure and its largest member none, the map draws its successor states that report nothing of their own (no figure, or zero) as one shape in its color, and a tap there opens it; once its largest member's series begins, each is drawn by its own.`);
    if (link.noPolygon.length) p(more, `Series with no outline at this scale, in the data but not on the map: ${link.noPolygon.map((c) => `${c.name} (${c.iso3})`).join(', ')}.`);
    if (link.noData.length) p(more, `Outlines with no series, always plain: ${link.noData.map((c) => `${c.name} (${c.iso3})`).join(', ')}.`);
  }
  if (prod && Array.isArray(prod.s.patched) && prod.s.patched.length) {
    more.append(el('h4', null, 'Corrections'));
    const ps = prod.s.patched.filter((x) => x && typeof x === 'object');
    p(more, `${ps.length} source ${ps.length === 1 ? 'hole' : 'holes'} set to no data by the pipeline: ${ps.map((x) => [x.country || x.iso3, x.series, x.year].filter((v) => v != null && v !== '').join(' ') + (isStr(x.note) ? ` (${x.note})` : '')).join('; ')}.`);
  }
  if (prod) {
    const ns = dataNotes();
    if (ns.length) { more.append(el('h4', null, 'Worth knowing')); const ul = el('ul'); for (const t of ns) ul.append(el('li', null, t)); more.append(ul); }
  }
  // CC BY 4.0 asks for the creator, the license with its address, the material and whether it was changed
  const CCBY = 'creativecommons.org/licenses/by/4.0/';
  const src = (name, rows, changes) => {
    const d = el('p', 'src');
    d.append(el('span', 'src-name', name));
    const by = rows.some(([k, v]) => k === 'License' && /cc by/i.test(v || ''));
    for (const [k, v] of rows) if (isStr(v)) d.append(el('span', k === 'Attribution' ? null : 'src-term', `${k}: ${noScheme(v)}${k === 'License' && by ? ` (${CCBY})` : ''}`));
    if (by) d.append(el('span', 'src-term', `Changes: ${changes}. Used under the license; the creators do not endorse this app, and the material comes with no warranty.`));
    srcs.append(d);
  };
  if (prod) for (const s of prod.s.sources) {
    if (s) src(s.name || 'Source', [['License', s.licence], ['Attribution', s.attribution], ['Detail', s.detail], ['Address', s.url]],
      'oil and gas series converted from GWh to TWh/yr, kboe/d, PWh and Gboe, added into oil and gas, running totals and shares of the world; the holes listed under Corrections set to no data');
  }
  if (geo && geo.source) p(srcs, `Outlines in data/world.json: ${geo.source}.`);
  if (fields && fields.available && fields.raw.source) {
    const s = fields.raw.source;
    src(s.name || 'Field points', [['Release', s.release], ['File', s.file], ['License', s.licence], ['Attribution', s.attribution], ['Address', s.url]],
      "units placed by their coordinates, oil and gas rates added, outlines simplified and drawn only near their own unit; the sizes through time are this app's estimate, not the tracker's");
  } else src('Field points', [['Status', !fields ? 'data/fields.json could not be read' : `not available: ${isStr(fields.raw.reason) ? fields.raw.reason : 'no reason given'}`]]);
  openPanel('about');
  $('about-body').scrollTop = 0;
  $('about-close').focus({ preventScroll: true });
}
/* Facts about this file that change how a year should be read, worked out from the data. */
function dataNotes() {
  const notes = [], s = prod.s, hist = historicalLabels(s), late = [], early = [];
  if (!s.world) notes.push('The file carries no world series, so shares and the total beside the year are the sum of the countries listed for that year.');
  for (const c of s.countries) {
    if (hist[c.iso3]) continue;
    let peak = 0;
    for (let i = 0; i < c.oil.length; i++) peak = Math.max(peak, (c.oil[i] || 0) + (c.gas[i] || 0));
    const sp = seriesSpan(c);
    if (peak < 100000 || !sp) continue;                  // producers above 100 TWh/yr at peak
    if (sp[0] > prod.Y0 + 5) late.push(`${c.name} (${sp[0]})`);
    if (sp[1] < prod.Y1) early.push(`${c.name} (${sp[1]})`);
  }
  if (late.length) notes.push(`Major producers whose series start late (first year in brackets); earlier years are plain on the map: ${late.join(', ')}.`);
  if (early.length) notes.push(`Major producers whose series stop before ${prod.Y1}: ${early.join(', ')}. In Cumulative they keep their totals.`);
  let partial = 0;
  for (const c of s.countries) if (seriesAt(c, 'total', prod.Y1, tmp).partial) partial++;
  if (partial) notes.push(`In ${prod.Y1}, ${partial} countries have oil or gas but not both; their oil and gas total counts the part that exists.`);
  return notes;
}

function openFind() {
  $('find-input').value = '';
  runSearch();
  openPanel('find');
  $('find-input').focus({ preventScroll: true });
}
/* Folded prefix matching: the start of the name ranks first, then the start of any word in it. Fields,
 * companies and basins respect the layer filters. */
function matchRank(norm, q) {
  let i = norm.indexOf(q);
  while (i >= 0) {
    if (i === 0) return 0;
    const ch = norm.charCodeAt(i - 1);
    if (!((ch >= 97 && ch <= 122) || (ch >= 48 && ch <= 57))) return 1;
    i = norm.indexOf(q, i + 1);
  }
  return -1;
}
let countryNorms = null;
function searchResults(rawQ) {
  const q = fold(rawQ), groups = [], sys = sysOf();
  if (!q) return groups;
  if (fields && fields.available) {
    const fl = [];
    for (const p of fields.points) { if (!p.pass) continue; const r = matchRank(p.norm, q); if (r >= 0) fl.push([r, p]); }
    fl.sort((a, b) => a[0] - b[0] || (b[1].v ?? -1) - (a[1].v ?? -1));
    groups.push({ title: 'Fields', items: fl.slice(0, 8).map(([, p]) => ({
      main: p.f.name || 'Unnamed field',
      sub: [isStr(p.f.country) ? p.f.country : '', p.v != null ? `${U.field(p.v, 'oe', sys)} reported` : p.status].filter(Boolean).join(', '),
      pick: () => chooseField(p) })) });
    for (const [title, gl, kind] of [['Companies', fields.companies, 'company'], ['Basins', fields.basins, 'basin']]) {
      const hits = [];
      for (const g of gl) {
        const r = matchRank(g.norm, q);
        if (r < 0) continue;
        let n = 0;
        for (const p of g.pts) n += p.pass;
        if (n) hits.push([r, g, n]);
      }
      hits.sort((a, b) => a[0] - b[0] || b[2] - a[2]);
      groups.push({ title, items: hits.slice(0, 6).map(([, g, n]) => ({
        main: g.name, sub: `${U.int(n)} ${n === 1 ? 'field' : 'fields'}, light them up on the map`,
        pick: () => { closePanel('find'); setHighlight({ kind, name: g.name }); } })) });
    }
  }
  if (prod) {
    if (!countryNorms || countryNorms.s !== prod.s) countryNorms = { s: prod.s, list: prod.s.countries.map((c) => ({ c, norm: fold(c.name) })) };
    const hist = historicalLabels(prod.s), hits = [];
    for (const x of countryNorms.list) { const r = matchRank(x.norm, q); if (r >= 0) hits.push([r, x.c]); }
    hits.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name));
    groups.push({ title: 'Countries', items: hits.slice(0, 6).map(([, c]) => ({ main: c.name, sub: hist[c.iso3] || c.iso3, pick: () => chooseCountry(c.iso3) })) });
  }
  return groups.filter((g) => g.items.length);
}
let findSay = 0;
function runSearch() {
  const box = $('find-list'), qv = $('find-input').value;
  box.textContent = '';
  $('find-clear').hidden = !qv;
  clearTimeout(findSay);
  if (!fold(qv)) return;
  const groups = searchResults(qv), all = groups.reduce((n, g) => n + g.items.length, 0);
  const filtered = statusFilter !== 'all' || settingFilter !== 'all' || typeFilter !== 'all';
  // VoiceOver hears the count once typing settles, not a word per keystroke
  findSay = setTimeout(() => say(all ? `${all} ${all === 1 ? 'match' : 'matches'}.` : 'Nothing matches.'), 700);
  if (!groups.length) { box.append(el('p', 'none', `Nothing matches${fields && fields.available && filtered ? ' with the current field filters' : ''}.`)); return; }
  for (const g of groups) {
    box.append(el('h3', null, g.title));
    const ul = el('ul');
    for (const it of g.items) {
      const btn = el('button');
      btn.type = 'button';
      btn.append(el('span', 'name', it.main), el('span', 'sub', it.sub));
      btn.addEventListener('click', it.pick);
      const li = el('li'); li.append(btn); ul.append(li);
    }
    box.append(ul);
  }
}
function setHighlight(h) {
  highlight = h && isStr(h.name) && (h.kind === 'company' || h.kind === 'basin') ? { kind: h.kind, name: h.name } : null;
  store.set(STORE.hl, JSON.stringify(highlight));
  applyHighlight();
  syncLayers();
  timeDirty = true;
  requestRender();
}
function chooseField(p) {
  closePanel('find');
  if (!showFields) { showFields = true; store.set(STORE.fields, '1'); onFields(); }
  // a field not yet on the map at the year shown would be invisible: move the year to its first
  if (followOn() && p.appear > shown) { setYear(p.appear); shown = year; dirtyAll(); }
  select({ kind: 'field', id: p.id }, { announce: true });
  flyTo(p.x, p.y, Math.max(view.scale, FLY_SCALE));
}
function chooseCountry(iso3) {
  closePanel('find');
  select({ kind: 'country', iso3 }, { announce: true });
  const g = geo && geo.countries.find((c) => c.iso3 === iso3);
  if (!g) return;
  const [x0, y0, x1, y1] = g.bbox;
  if (x1 - x0 > 0.45) { flyTo(g.lx, g.ly, view.scale); return; }     // split at the antimeridian
  flyTo((x0 + x1) / 2, (y0 + y1) / 2, clamp(Math.min((W * 0.8) / Math.max(1e-6, x1 - x0), (H * 0.6) / Math.max(1e-6, y1 - y0)), minScale(), 360 * 30));
}

/* ── the year: play, the keys, the track ─────────────────────────────────── */

function setYear(y) {
  if (!prod) return;
  year = clamp(Math.round(y), prod.Y0, prod.Y1);
  track.wanted = null;
  store.set(STORE.year, String(year));
  schedule();
}
function setPlaying(on) {
  if (!prod) on = false;
  if (on === playing) return;
  playing = on;
  // an <svg> has no `hidden` property, so the attribute itself is what is toggled (B2)
  $('ico-play').toggleAttribute('hidden', on);
  $('ico-pause').toggleAttribute('hidden', !on);
  $('btn-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  playAcc = 0; lastPlay = 0;
  if (on) { track.wanted = null; if (year >= prod.Y1) year = prod.Y0; schedule(); } else store.set(STORE.year, String(year));
}
/* The year keys keep the focus on themselves, so VoiceOver is told the new year in words. */
const stepBy = (d) => { if (!prod) return; setPlaying(false); setYear(year + d); say(String(year)); };
const track = createTrack(slider, $('track'), {
  onStart() { if (playing) setPlaying(false); timeDirty = true; },
  onScrub() { schedule(); },
  onEnd() { if (track.wanted !== null && prod) store.set(STORE.year, String(prod.Y0 + track.wanted)); timeDirty = true; schedule(); },
  onKey(k) { if (!prod) return; setPlaying(false); setYear(k === 'home' ? prod.Y0 : k === 'end' ? prod.Y1 : year + k); },
});

/* ── the frame loop ──────────────────────────────────────────────────────── */

let raf = 0, dirty = true, timeDirty = true, lastPlay = 0, playAcc = 0, logRows = null;
function schedule() { if (!raf && !document.hidden) raf = requestAnimationFrame(loop); }
function requestRender() { dirty = true; schedule(); }
const dirtyAll = () => { dirty = true; timeDirty = true; schedule(); };
function loop(now) {
  raf = 0;
  // About and Find cover the plate: nothing is drawn under them and play waits (B3), so closing one
  // shows the year it was opened on, and play goes on from there
  if (panelOpen()) { lastPlay = 0; return; }
  stats.frames++;
  // a finger on the plate holds the play clock: the year must not move under it
  if (playing && prod && gesture) lastPlay = 0;
  else if (playing && prod) {
    // never more than 100 ms at once, so a frame after a stall never jumps the year (B3)
    const dt = lastPlay ? Math.min(100, now - lastPlay) : 0;
    lastPlay = now;
    playAcc += (dt / 1000) * YEARS_PER_SEC;
    if (playAcc >= 1) {
      // whole years only, under Reduce Motion or not: no frame is a blend of two years
      const n = Math.floor(playAcc);
      playAcc -= n;
      if (year + n >= prod.Y1) { year = prod.Y1; setPlaying(false); } else year += n;
    }
  }
  if (prod && track.wanted !== null && prod.Y0 + track.wanted !== year) year = prod.Y0 + track.wanted;
  if (fly) { tickFly(now); dirty = true; }
  if (prod && year !== shown) { shown = year; dirty = true; timeDirty = true; }
  if (dirty) { dirty = false; render(); }
  if (timeDirty) { timeDirty = false; syncTime(); }
  if (logRows) logRows.push({ wanted: track.wanted != null && prod ? prod.Y0 + track.wanted : year, shown, label: $('valid-time').textContent, now: Number(slider.getAttribute('aria-valuenow')) + (prod ? prod.Y0 : 0), ledger: ledgerKey.split('|')[0], playing });
  if (playing || fly) schedule();
}

/* ── map gestures ────────────────────────────────────────────────────────── */

const pointers = new Map();
let gesture = null, rect = canvas.getBoundingClientRect();
function startGesture() {
  const pts = [...pointers.values()];
  if (pts.length === 1) {
    gesture = { type: 'pan', x: pts[0].x, y: pts[0].y, sx: pts[0].x, sy: pts[0].y, moved: gesture ? gesture.moved : false, t0: performance.now() };
  } else if (pts.length >= 2) {
    const [a, b] = pts, mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
    gesture = { type: 'pinch', d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), moved: true, scale0: view.scale, anchor: screenToWorld(mx, my) };
  }
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  endFly();                 // a touch ends a flight at its destination, never midway (B13)
  rect = canvas.getBoundingClientRect();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
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
    if (gesture.moved) { view.cx -= dx / view.scale; view.cy -= dy / view.scale; clampView(); requestRender(); }
  } else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()], mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
    zoomAround(Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0, mx, my, gesture.scale0, gesture.anchor);
    requestRender();
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const wasTap = gesture && gesture.type === 'pan' && !gesture.moved && pointers.size === 1 && performance.now() - gesture.t0 < 450 && e.type === 'pointerup';
  pointers.delete(e.pointerId);
  if (pointers.size > 0) { startGesture(); return; }
  gesture = null;
  if (wasTap) onTap(e.clientX - rect.left, e.clientY - rect.top);
  saveView();
  if (!$('card').hidden) placeCard();
  requestRender();
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
/* A tap selects at once; a second tap in the same place soon after zooms in instead. */
let lastTap = null;
function onTap(sx, sy) {
  const now = performance.now();
  if (!$('layers').hidden) { closeSheets(); return; }
  if (lastTap && now - lastTap.t < 300 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 24) { lastTap = null; zoomAt(sx, sy, 2); return; }
  lastTap = { x: sx, y: sy, t: now };
  selectAt(sx, sy);
}
/* A drawn name opens its country; a field wins inside its disc, and near it only off any country with
 * a series or once zoomed in to the outlines. */
function selectAt(sx, sy) {
  const lb = placedLabels.find((b) => sx >= b[0] && sx <= b[2] && sy >= b[1] && sy <= b[3]);
  const i = lb ? lb.i : countryAt(sx, sy), f = !lb && fieldAt(sx, sy, i < 0 || !prod || !prod.byIso.has(geo.countries[i].iso3) || view.scale >= OUTLINE_SCALE);
  if (f) { select({ kind: 'field', id: f.id }, { announce: true }); return; }
  // a successor drawn in its former state's color opens the former state
  const u = i >= 0 && prod && link && shown != null && colorsFor(shown).of[i];
  select(i >= 0 ? { kind: 'country', iso3: u || geo.countries[i].iso3, at: screenToWorld(sx, sy) } : null, { announce: true });
}

/* ── controls ────────────────────────────────────────────────────────────── */

/* Radio groups: one tab stop each, the arrow keys move the choice. */
function radios(group, attr, pick) {
  const bs = [...$(group).children];
  for (const b of bs) b.addEventListener('click', () => pick(b.dataset[attr]));
  $(group).addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = bs.findIndex((b) => b.getAttribute('aria-checked') === 'true'), n = bs[(i + d + bs.length) % bs.length];
    pick(n.dataset[attr]);
    n.focus();
  });
}
function syncRadios() {
  for (const [id, attr, v] of [['modes', 'mode', mode], ['accum', 'accum', accum]]) {
    for (const b of $(id).children) { const on = b.dataset[attr] === v; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; }
  }
}
/* Anything that changes what the year's figures are: the mode, the accumulation, the units. */
function onChoice() {
  syncRadios();
  updateLegend();
  if (sel) renderCard();
  if (!$('details').hidden) renderDetails();
  if (!$('layers').hidden) syncLayers();
  dirtyAll();
}
radios('modes', 'mode', (m) => { if (!MODES[m] || m === mode) return; mode = m; store.set(STORE.mode, m); onChoice(); });
radios('accum', 'accum', (a) => { if (!ACCUM[a] || a === accum) return; accum = a; store.set(STORE.accum, a); onChoice(); });
$('btn-units').addEventListener('click', () => { units = U.UNIT_ORDER[(U.UNIT_ORDER.indexOf(units) + 1) % U.UNIT_ORDER.length]; store.set(STORE.units, units); onChoice(); });
/* Anything that changes which fields are drawn or how. */
function onFields() {
  applyFilters();
  updateCredits();
  if (sel && sel.kind === 'field' && !showFields) select(null, { keepSheet: true });
  else if (sel) renderCard();
  if (!$('details').hidden) renderDetails();
  syncLayers();
  if (!$('find').hidden) runSearch();
  dirtyAll();
}
function setFieldOpt(key, v) {
  if (key === 'status' && (v === 'all' || v === 'operating')) { statusFilter = v; store.set(STORE.status, v); }
  else if (key === 'setting' && ['all', 'onshore', 'offshore'].includes(v)) { settingFilter = v; store.set(STORE.setting, v); }
  else if (key === 'ftype' && ['all', 'conventional', 'unconventional'].includes(v)) { typeFilter = v; store.set(STORE.ftype, v); }
  else if (key === 'size' && (v === 'prod' || v === 'res')) { sizeBy = v; store.set(STORE.size, v); }
  else if (key === 'follow') { followYear = !!v; store.set(STORE.follow, followYear ? '1' : '0'); }
  else return;
  onFields();
}
for (const [id, key] of [['status-seg', 'status'], ['setting-seg', 'setting'], ['type-seg', 'ftype'], ['size-seg', 'size']]) radios(id, 'v', (v) => setFieldOpt(key, v));
for (const b of document.querySelectorAll('#layers .lrow')) {
  b.addEventListener('click', () => {
    const k = b.dataset.layer;
    if (k === 'fields') { showFields = !showFields; store.set(STORE.fields, showFields ? '1' : '0'); onFields(); return; }
    if (k === 'follow') { setFieldOpt('follow', !followYear); return; }
    if (k === 'terrain') { terrainPref = !terrainPref; store.set(STORE.terrain, terrainPref ? '1' : '0'); }
    else if (k === 'depth') { depthPref = !depthPref; store.set(STORE.depth, depthPref ? '1' : '0'); }
    else if (k === 'labels') { showLabels = !showLabels; store.set(STORE.labels, showLabels ? '1' : '0'); }
    else if (k === 'rim') { rimOn = !rimOn; store.set(STORE.rim, rimOn ? '1' : '0'); buildPalette(); }
    if (terrainPref || depthPref) loadShade();
    updateCredits();
    syncLayers();
    requestRender();
  });
}
$('hl-clear').addEventListener('click', () => setHighlight(null));
$('btn-layers').addEventListener('click', () => { if ($('layers').hidden) { openSheet('layers'); syncLayers(); } else closeSheets(); });
$('layers-close').addEventListener('click', () => closeSheets());
$('details-close').addEventListener('click', () => closeSheets());
$('zoom-in').addEventListener('click', () => zoomAt(W / 2, H / 2, 2));
$('zoom-out').addEventListener('click', () => zoomAt(W / 2, H / 2, 0.5));
$('zoom-home').addEventListener('click', () => flyTo(lonToX(0), 0.5, minScale()));
$('btn-find').addEventListener('click', openFind);
$('find-input').addEventListener('input', runSearch);
$('find-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const b = $('find-list').querySelector('button'); if (b) { e.preventDefault(); b.click(); } } });
$('find-clear').addEventListener('click', () => { $('find-input').value = ''; runSearch(); $('find-input').focus(); });
$('find-close').addEventListener('click', () => closePanel('find'));
$('stamp').addEventListener('click', showAbout);
$('about-close').addEventListener('click', () => closePanel('about'));
$('about-close-2').addEventListener('click', () => closePanel('about'));
$('card-close').addEventListener('click', () => select(null));
$('card-act').addEventListener('click', openDetails);
$('btn-play').addEventListener('click', () => setPlaying(!playing));
$('btn-prev').addEventListener('click', () => stepBy(-1));
$('btn-next').addEventListener('click', () => stepBy(1));
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
  tok = null; ledgerTok = null;
  track.invalidate();
  updateLegend();
  if (!$('layers').hidden) syncLayers();
  dirtyAll();
});
reducedMq.addEventListener('change', () => { if (reduced()) endFly(); });

/* ── focus mode: the plate, the player, the stamp, the Ledger and the caption line; everything else
 * leaves, hidden and inert. Remembered as wog.focus. ── */

let leaveTimer = 0;
function setFocus(on, { kbd = false, boot = false } = {}) {
  if (on === focusMode && !boot) return;
  focusMode = on;
  if (!boot) store.set(STORE.focus, on ? '1' : '0');
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

async function readText(path) {
  try {
    const r = await fetch(`./${path}`, { cache: 'no-store' });
    if (!r.ok) { await r.arrayBuffer().catch(() => null); throw new Error(` could not be read (HTTP ${r.status}). Is the file missing?`); }
    return await r.text();
  } finally { readCount++; if (!prod) updateStamp(); }
}
function parseJson(text) {
  try { return JSON.parse(text); } catch {
    throw new Error(text.trim().startsWith('<') ? ' is not JSON; it looks like a web page was written over it.' : ' is not valid JSON (unparseable or cut short).');
  }
}
/* One file: parsed only when its text changed; a broken replacement keeps what was showing and says so. */
function take(key, t, check, what, build, onFail) {
  if (t.t != null && t.t === raw[key]) return false;
  raw[key] = t.t ?? null;
  try {
    if (t.e) throw t.e;
    const d = parseJson(t.t), why = check(d);
    if (why) throw new Error(` is not ${what}: ${why}.`);
    build(d);
    return true;
  } catch (e) { onFail(e.message); return true; }
}
let loading = null, reading = false;
async function loadAll() {
  if (loading) return loading;
  loading = (async () => {
    readCount = 0;
    reading = true;
    updateStamp();
    const [tw, ts, tf] = await Promise.all(Object.values(FILES).map((f) => readText(f).then((t) => ({ t }), (e) => ({ e }))));
    let changed = take('world', tw, checkWorld, 'a world outline file', (w) => {
      geo = buildGeo(w);
      labelOrder = null; colorCache.clear(); caches.sea = caches.borders = null;
      setProblem('world', FILES.world, null);
    }, (m) => setProblem('world', FILES.world, `${m} ${geo ? 'Showing the outlines as last read.' : 'No country outlines, so nothing can be colored.'}`));
    changed = take('snapshot', ts, checkSnapshot, 'a World Oil & Gas snapshot', (s) => {
      prod = buildProd(s);
      colorCache.clear(); est = null;
      setProblem('snapshot', FILES.snapshot, null);
    }, (m) => setProblem('snapshot', FILES.snapshot, `${m} ${prod ? 'Showing the figures as last read.' : 'The map shows outlines only; no production is drawn.'}`)) || changed;
    changed = take('fields', tf, checkFields, 'a fields file', (f) => {
      fields = buildFields(f);
      est = null;
      setProblem('fields', FILES.fields, null);
    }, (m) => setProblem('fields', FILES.fields, `${m} ${fields ? 'Showing the fields as last read.' : 'Field points are not drawn; the country map is unaffected.'}`)) || changed;
    reading = false;
    if (!changed) { updateStamp(); return; }
    link = buildLink();
    if (prod) {
      fieldYears(fields, prod.Y0, prod.Y1);
      track.setModel(prod.Y1 - prod.Y0 + 1, prod.Y0);
      slider.setAttribute('aria-valuemax', String(prod.Y1 - prod.Y0));
      const stored = Number(store.get(STORE.year));
      year = clamp(year ?? (Number.isInteger(stored) && stored ? stored : prod.Y1), prod.Y0, prod.Y1);
      shown = year;
    } else setPlaying(false);
    applyFilters();
    if (highlight && fields && fields.available && !fields.points.some((p) => p.hl)) setHighlight(null);
    if (sel && sel.kind === 'field' && !(fields && fields.byId.has(sel.id))) sel = null;
    updateStamp();
    updateCredits();
    updateLegend();
    syncLayers();
    renderCard();
    if (!$('details').hidden) renderDetails();
    if (!$('find').hidden) runSearch();
    dirtyAll();
  })();
  try { await loading; } finally { loading = null; }
}

/* Live means re-render in place: Snuggery fires visibilitychange when a Shortcut delivers new data
 * while the app is open, and a return re-reads the three files. Hidden, play stops and the loop rests. */
function onHidden() {
  setPlaying(false);
  endFly();
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) onHidden(); else { loadAll(); dirtyAll(); } });
window.addEventListener('pagehide', onHidden);

/* ── boot ────────────────────────────────────────────────────────────────── */

function resize() {
  const r = wrap.getBoundingClientRect();
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  // the key column, on a plate too short for it (a phone on its side, a sheet open), becomes a row along the top
  wrap.classList.toggle('keys-row', 5 * 44 + 2 * 8 + 6 + 16 > H);
  if (!view.scale) fitFirst(); else clampView();
  ledgerW = Math.round($('ledger').clientWidth);
  const rl = $('readbox');
  rlW = rl.clientWidth || 300; rlLines = Math.max(1, Math.round(rl.clientHeight / 15)); keyW = $('rkey').offsetWidth || keyW;
  // the lead beside the year (or under it, on its side): measured in the face, not read from the year shown
  const row = $('lead').parentElement;
  leadW = Math.max(60, row.clientWidth - (getComputedStyle(row).flexDirection === 'column' ? 8 : widthOf(YEAR_FONT, '2024') + 20));
  dropExclusions();
  updateLegend();
  // drawn now, not next frame: resizing a canvas clears it, and a blank frame would show
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  dirty = true; timeDirty = true;
  loop(performance.now());
  if (!$('card').hidden) placeCard();
}

(function restoreUI() {
  const u = store.get(STORE.units); if (U.COUNTRY[u]) units = u;
  const m = store.get(STORE.mode); if (MODES[m]) mode = m;
  const ac = store.get(STORE.accum); if (ACCUM[ac]) accum = ac;
  showFields = store.get(STORE.fields) !== '0';
  showLabels = store.get(STORE.labels) !== '0';
  followYear = store.get(STORE.follow) !== '0';
  const st = store.get(STORE.status); if (st === 'all' || st === 'operating') statusFilter = st;
  const se = store.get(STORE.setting); if (['all', 'onshore', 'offshore'].includes(se)) settingFilter = se;
  const ty = store.get(STORE.ftype); if (['all', 'conventional', 'unconventional'].includes(ty)) typeFilter = ty;
  const sz = store.get(STORE.size); if (sz === 'prod' || sz === 'res') sizeBy = sz;
  depthPref = store.get(STORE.depth) === '1';
  terrainPref = store.get(STORE.terrain) === '1';
  rimOn = store.get(STORE.rim) !== '0';
  focusMode = store.get(STORE.focus) === '1';
  try {
    const h = JSON.parse(store.get(STORE.hl) || 'null');
    if (h && isStr(h.name) && (h.kind === 'company' || h.kind === 'basin')) highlight = { kind: h.kind, name: h.name };
  } catch { /* fine */ }
  try {
    const s = JSON.parse(store.get(STORE.sel) || 'null');
    if (s && ((s.kind === 'country' && isStr(s.iso3)) || (s.kind === 'field' && isStr(s.id)))) sel = s;
  } catch { /* fine */ }
  restoreView();
})();
buildPalette();
syncRadios();
if (focusMode) setFocus(true, { boot: true });           // restored before the first draw
updateStamp();
track.resize();
new ResizeObserver(resize).observe(wrap);
new ResizeObserver(() => { track.resize(); ledgerW = Math.round($('ledger').clientWidth); timeDirty = true; schedule(); }).observe($('caption'));
new ResizeObserver(() => { track.resize(); timeDirty = true; schedule(); }).observe(slider);
{
  const ro = new ResizeObserver(() => { dropExclusions(); requestRender(); });
  for (const id of ['card', 'keys', 'focus-exit']) ro.observe($(id));
}
resize();
/* Names, the track, the Ledger and the chart are drawn in the app's face, so the canvas waits for it,
 * and every width is measured again once it is in. */
const faceIn = () => {
  fontReady = true;
  if (geo) for (const c of geo.countries) c.tw = null;
  wordW.clear(); track.invalidate(); ledgerKey = ''; keyW = $('rkey').offsetWidth || keyW; updateLegend(); dirtyAll();
};
document.fonts.load(LABEL_FONT).then(faceIn, faceIn);
document.fonts.addEventListener('loadingdone', faceIn);
loadAll();
if (terrainPref || depthPref) loadShade();

/* For tests and a browser console, never for the app itself. */
window.__wog = {
  ready: () => !!prod && !!geo && fontReady && shown != null && !reading,
  render() { const t0 = performance.now(); render(); return performance.now() - t0; },
  get state() {
    return { mode, accum, units, unitLabel: unitSpec().label, year, shown, sel, showFields, statusFilter, playing, focus: focusMode, view: { ...view },
      followYear, settingFilter, typeFilter, sizeBy, highlight, W, H,
      countries: geo ? geo.countries.length : 0, series: prod ? prod.s.countries.length : 0,
      fields: fields ? { available: fields.available, points: fields.points.length } : null,
      fieldCounts: { ...countFields() }, outlines: { ...outlineStats },
      depth: depthOn(), terrain: terrainOn(), rim: rimOn,
      shade: { status: shade.status, builds: shade.builds, ms: Math.round(shade.ms * 10) / 10, tiles: shade.tiles.filter((t) => t.px).map((t) => t.file) },
      estimate: est ? { mode: est.mode, fields: est.n, on: estOn() } : null,
      worldSum: prod && shown != null ? toUnit(worldAt(prod, mode, shown, isCum()).v) : null,
      problems: [...problems.values()] };
  },
  stats: () => ({ ...stats, playing, raf: !!raf }),
  wanted: () => (track.wanted != null && prod ? prod.Y0 + track.wanted : year),
  shown: () => shown,
  setYear(y) { setPlaying(false); setYear(y); },
  setMode(m) { if (MODES[m]) { mode = m; onChoice(); } },
  setUnits(u) { if (U.COUNTRY[u]) { units = u; onChoice(); } },
  setAccum(a) { if (ACCUM[a]) { accum = a; onChoice(); } },
  setFieldOpt, setHighlight, loadAll, selectAt,
  /** The Ledger as drawn: the shown year's blocks with their x on the strip (CSS px), and its rest. */
  ledger() { const L = prod && shown != null ? ledgerAt(prod, mode, isCum(), shown) : null; return L ? { world: L.world, rest: L.rest, listed: L.listed, blocks: ledgerBlocks.map((b) => ({ iso3: b.iso3, name: b.name, share: b.share, x0: b.x0, x1: b.x1 })) } : null; },
  focus: (on, kbd = false) => setFocus(!!on, { kbd }),
  /* A field's estimate in year y for the current mode (by id or the start of its name). */
  estimate(q, y = shown) {
    buildEst();
    const p = fields && (fields.byId.get(q) || fields.points.find((x) => x.norm.startsWith(fold(q))));
    return p && p.es != null ? { id: p.id, es: p.es, ref: p.ref, rate: estRate(prod, p, y), cum: estCum(prod, p, y), latest: p.v, prodYear: p.prodYear, radius: fieldRadius(p), appear: p.appear, fill: p.fill } : null;
  },
  field(id) { const p = fields && fields.byId.get(id); return p ? { appear: p.appear, fill: p.fill, undated: p.undated, visible: fieldVisible(p), x: worldToScreenX(p.x), y: worldToScreenY(p.y) } : null; },
  lut(v) { const i = lutIndex(v); return { i, color: P.lut[i] }; },
  countryColor(iso3) {
    const i = geo ? geo.countries.findIndex((c) => c.iso3 === iso3) : -1;
    if (i < 0 || !prod) return null;
    const c = colorsFor(shown);
    return { st: c.st[i], i: c.idx[i], color: c.st[i] & 3 ? null : P.lut[c.idx[i]] };
  },
  /* The painted map and the cached sea under it (device pixels) at a lon/lat. */
  pixel(lon, lat) {
    const x = Math.round(worldToScreenX(lonToX(lon)) * dpr), y = Math.round(worldToScreenY(latToY(lat)) * dpr);
    const at = (c) => [...c.getImageData(x, y, 1, 1).data];
    return { map: at(ctx), sea: caches.sea ? at(caches.sea.c) : null, comp: terrainOn() ? P.comp : 'source-over' };
  },
  search(q) { return searchResults(q).map((g) => ({ title: g.title, items: g.items.map((i) => i.main) })); },
  pick(kind, q) { const g = searchResults(q).find((x) => x.title === kind); if (g) g.items[0].pick(); return !!g; },
  flyTo(lon, lat, scale, instant = true) { flyTo(lonToX(lon), latToY(lat), scale ?? MAX_SCALE); if (instant) endFly(); },
  home() { fly = null; view.scale = 0; fitFirst(); requestRender(); },
  project(lon, lat) { return [worldToScreenX(lonToX(lon)), worldToScreenY(latToY(lat))]; },
  flying: () => !!fly,
  labels: () => placedLabels.map((p) => p.slice()),
  log(on) { if (on) { logRows = []; return null; } const r = logRows; logRows = null; return r; },
  decodePolyline,
  unions: () => (prod && shown != null ? formerUnions(prod, mode, isCum(), shown).map((u) => ({ state: u.state, members: u.members.filter((i) => geo.index.has(i)) })) : []),
};
