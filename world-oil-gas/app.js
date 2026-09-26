/* World Oil & Gas — Snuggery mini-app.
 *
 * =============================================================================
 * THE THREE FILES IN ./data, AND THEIR SHAPES. All three are written by the
 * pipeline in scripts/shelf_atlas/ (the contract is scripts/shelf_atlas/SCHEMA.md;
 * the parts this app reads are copied here, because whatever rewrites these
 * files next year will not have read the conversation that built the app).
 * Nothing in this file, index.html or style.css needs to move when the data is
 * replaced. The app refuses a file that fails its shape and says which one.
 *
 * Coordinates are WGS84 lon/lat. Rings are packed with Google's polyline
 * algorithm, LON FIRST, then lat, at the file's `factor` (1000 = three
 * decimals). Rings are closed (the last point repeats the first).
 *
 * ── data/world.json — Natural Earth 1:110m countries (static) ──────────────
 * { "schema": 1, "factor": 1000, "encoding": "…", "source": "…",
 *   "countries": [{ "iso3": "NOR", "name": "Norway", "adm0": "NOR",
 *                   "c": [17.8, 68.5],               // label point, lon/lat
 *                   "rings": ["<ring>", …] }, …],    // all rings of the country;
 *                                                     // filled even-odd
 *   "bathymetry": [{ "depth": 10000, "rings": ["<ring>", …] }, …,   // optional; Natural
 *                  { "depth": 200,   "rings": [ … ] }] }            // Earth 1:10m depth bands,
 *   // deepest first in the file. Each band is the area DEEPER than `depth`, so
 *   // they nest; the app paints them shallowest first so the deepest tint wins.
 *
 * ── data/snapshot.json — annual production by country (rebuilt yearly) ─────
 * { "schema": 1, "generatedAt": "…", "app": "World Oil & Gas",
 *   "units": { "series": "GWh per year (integer)", "boePerTWh": 588441, "note": "…" },
 *   "years": [1900, 2024],
 *   "sources": [{ "name", "url", "licence", "attribution", "detail"? }, …],
 *   "world": { "iso3": "OWID_WRL", "name": "World", "y0": 1900, "oil": [ … ], "gas": [ … ] },
 *   "countries": [{ "iso3": "NOR", "name": "Norway", "y0": 1900,
 *                   "oil": [GWh|null, …], "gas": [GWh|null, …] }, …],
 *                                                     // includes former states with no
 *                                                     // outline: OWID_USS, OWID_CZS, OWID_YGS
 *   "historical": { "OWID_USS": "USSR (to 1991; no outline)", … },   // optional labels
 *   "patched": [{ "iso3": "NOR", "country": "Norway", "year": 1998, "series": "gas",
 *                 "note": "…" }, …],                  // optional: source holes set to null
 *   "ask": [ … ] }                                   // NEVER read by this app
 * `oil[k]` is the value for year `y0 + k`; `null` is "no data", not zero.
 * `world` is the OWID_WRL series and is what shares are measured against. Should
 * a future build write null there, the app falls back to the sum of every
 * series that has a value that year and says so wherever a share is printed.
 *
 * ── data/fields.json — GOGET extraction units (manual drop-in) ─────────────
 * { "schema": 1, "available": true|false, "generatedAt": "…",
 *   "reason": "…",                                    // only when available is false
 *   "source": { "name", "file", "release", "url", "licence": "CC BY 4.0", "attribution" },
 *   "units": { "oilBpd": "…", "gasBoepd": "…", "resOilMbbl": "…", "resGasMboe": "…", "rings": "…", "wiki": "…" },
 *   "counts": { "units", "withProduction", "withReserves", "withOutline" },
 *   "fields": [{ "id": "L…", "name": "…", "country": "…", "lat": 56.1, "lon": 2.3,
 *                "status": "operating", "fuel": "oil and gas", "type": "conventional",
 *                "operator": "…", "parents": ["…"], "disc": 1974, "fid": 1976, "start": 1979,
 *                "basin": "…", "offshore": 1|0, "approx": 1,
 *                "wiki": "https://www.gem.wiki/…",     // only when not name-with-underscores
 *                "prodYear": 2023, "oilBpd": 12000, "gasBoepd": 30000,
 *                "resOilMbbl": 120.5, "resGasMboe": 30.1, "resClass": "remaining", "resYear": 2023,
 *                "rings": ["<polyline, 3 decimals>", …] }, …] }
 * When `available` is false the fields layer prints `reason` and draws nothing.
 *
 * -----------------------------------------------------------------------------
 * UNITS. The series are GWh a year. On screen they are either TWh/yr (÷ 1000)
 * or kboe/d, energy-equivalent thousand barrels a day:
 *     boe/d = GWh / 1000 × boePerTWh / 365
 * Those barrels are an energy convention (units.note says which), not measured
 * volumes. Field points keep the file's own volumetric units (bbl/d of oil,
 * boe/d of gas at 159 Sm³ per boe) whatever the toggle says, because turning a
 * volume into energy would need a heat content per field the file does not carry.
 *
 * DRAWING. Web Mercator, repeating sideways, clamped at ±85°. Every country
 * is one Path2D built once per load of world.json; scrubbing the year only
 * changes which fill each path gets — the per-year class of every country is
 * worked out on first use and cached, so playing the century back is a lookup
 * and ~180 fills a frame. Projection, hit-testing and drawing are separate
 * sections below.
 *
 * NO VALUE EVER REACHES innerHTML. Every piece of text from a data file is set
 * with textContent or built as a DOM node; the only `.innerHTML` is `= ''`.
 * Nothing is fetched but ./data/*.json.
 * ========================================================================== */

'use strict';

const STORE = {
  view: 'wog.view', units: 'wog.units', mode: 'wog.mode', year: 'wog.year', sel: 'wog.sel',
  fields: 'wog.fields', status: 'wog.status', labels: 'wog.labels',
};
const FILES = { world: 'data/world.json', snapshot: 'data/snapshot.json', fields: 'data/fields.json' };
const MAX_LAT = 85;
const DEG = Math.PI / 180;
const PATH_K = 4096;            // paths are built in world units × PATH_K
const MAX_SCALE = 360 * 120;    // 120 px per degree of longitude
const YEARS_PER_SEC = 8;        // playback: the century in about 15 s
const STALE_DAYS = 400;         // the snapshot is rebuilt yearly
const NODATA = 255;             // class index for "null that year"

/* Class breaks in the unit on screen. Each unit gets its own round numbers
 * rather than converted ones (10 kboe/d is 6.2 TWh/yr, which nobody wants on a
 * legend); the two sets sit close enough that toggling units barely repaints
 * the map. Steps of ×3 / ×2.5–4 because production spans five orders of
 * magnitude and a linear scale would colour one country and leave the rest pale. */
const UNITS = {
  kboe: { label: 'kboe/d', long: 'thousand barrels of oil equivalent a day',
          breaks: [10, 30, 100, 300, 1000, 3000, 10000] },
  twh:  { label: 'TWh/yr', long: 'terawatt-hours a year',
          breaks: [5, 20, 50, 200, 500, 2000, 5000] },
};
const UNIT_ORDER = ['kboe', 'twh'];
const MODES = { oil: 'Oil', gas: 'Gas', total: 'Oil + Gas' };

/* Field point size: area ∝ production, so radius ∝ √(boe/d). */
const FIELD_VREF = 100000;      // boe/d that gets FIELD_RREF px
const FIELD_RREF = 4;
const FIELD_RMIN = 2;
const FIELD_RMAX = 24;

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
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

/* ── palette ─────────────────────────────────────────────────────────────── *
 * Quantity is one hue, light → dark (violet, so it cannot be mistaken for the
 * blue sea or for the fuel colours of the field points). Fuel is categorical:
 * the first three slots of the shared reference palette, checked all-pairs for
 * colour-vision deficiency in both schemes. Dark mode is its own set of steps,
 * with low values receding into the dark ground rather than glowing.          */

const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
let pal = null;
let hatch = null;               // CanvasPattern for "no data"
function buildPalette() {
  pal = darkMq.matches ? {
    outside: '#0b0e13', ocean: '#16202c', none: '#333841', border: '#0b0e13',
    // Sea: the shelf (0–200 m) is the ocean fill; deeper bands step down to
    // near-black navy. Kept low in chroma so the violet ramp stays the loudest thing.
    deep: [[22, 32, 44], [8, 12, 19]],
    nodata: '#22262e', hatchInk: 'rgba(150,162,178,0.40)', sel: '#ffffff',
    label: '#eef2f7', halo: 'rgba(11,14,19,0.85)',
    ramp: ['#3e366c', '#4f448c', '#5f53ab', '#7065c5', '#8279db', '#948eeb', '#a7a5f9', '#bcbcff'],
    fuel: { oil: '#d95926', gas: '#3987e5', both: '#199e70', other: '#8a94a1' },
    ring: 'rgba(11,14,19,0.9)', grid: 'rgba(255,255,255,0.10)',
  } : {
    outside: '#eef0f4', ocean: '#e2e9f1', none: '#f4f2ed', border: '#ffffff',
    deep: [[217, 226, 236], [170, 188, 209]],
    nodata: '#e9e7e2', hatchInk: 'rgba(84,92,108,0.45)', sel: '#14181f',
    label: '#14181f', halo: 'rgba(255,255,255,0.85)',
    ramp: ['#e5e0ff', '#c8c0f5', '#aba0e9', '#8f81da', '#7464c5', '#5a4aab', '#42328a', '#2b1e66'],
    fuel: { oil: '#eb6834', gas: '#2a78d6', both: '#1baf7a', other: '#6b7787' },
    ring: 'rgba(255,255,255,0.95)', grid: 'rgba(0,0,0,0.10)',
  };
  hatch = null;
  bathyStyles = null;
}
let bathyStyles = null;
buildPalette();

/* One fill per depth band: 200 m is the first step below the shelf colour,
 * 6000 m and deeper the last, linear in depth between them. */
function bathyStyle(depth) {
  const t = clamp((depth - 200) / 5800, 0, 1);
  const [a, b] = pal.deep;
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function hatchPattern() {
  if (hatch) return hatch;
  const n = Math.max(6, Math.round(7 * dpr));
  const cv = document.createElement('canvas');
  cv.width = n; cv.height = n;
  const c = cv.getContext('2d');
  c.strokeStyle = pal.hatchInk;
  c.lineWidth = Math.max(1, dpr * 0.9);
  c.beginPath();
  // Three strokes so the diagonal runs on across tile edges without a seam.
  for (const o of [-n, 0, n]) { c.moveTo(o, n); c.lineTo(o + n, 0); }
  c.stroke();
  hatch = ctx.createPattern(cv, 'repeat');
  return hatch;
}

/* ── formatting ──────────────────────────────────────────────────────────── */

const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const fmtDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtFull = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function fmtNum(v) {
  if (v == null) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1) return nf2.format(v);
  if (a < 100) return nf1.format(v);
  return nf0.format(v);
}
function fmtTick(v) {
  if (v >= 1000) return `${v / 1000}k`;
  return String(v);
}
function fmtPct(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  if (p === 0) return '0%';
  if (p < 0.1) return '<0.1%';
  return `${p < 10 ? p.toFixed(1) : p.toFixed(0)}%`;
}

/* ── polyline decoding ───────────────────────────────────────────────────── */

/* Google's algorithm, pairs are (lon, lat). Throws on a character outside the
 * alphabet or a string that stops mid-number, so a truncated file is caught
 * here rather than drawn as a stray spike. */
function decodePolyline(str, factor) {
  const out = [];
  let i = 0, lon = 0, lat = 0;
  const n = str.length;
  const next = () => {
    let result = 0, shift = 0, b;
    do {
      if (i >= n) throw new Error('a ring ends in the middle of a number');
      b = str.charCodeAt(i++) - 63;
      if (b < 0 || b > 63) throw new Error('a ring holds a character that is not polyline');
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return (result & 1) ? ~(result >> 1) : (result >> 1);
  };
  while (i < n) {
    lon += next();
    lat += next();
    out.push(lon / factor, lat / factor);
  }
  return out;
}

/* ── shape checks ────────────────────────────────────────────────────────── *
 * Each returns an error sentence, or '' when the file is usable. They check
 * what the drawing code relies on, not every key the pipeline writes.        */

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNumOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

function checkWorld(w) {
  if (!w || typeof w !== 'object') return 'the file is not a JSON object';
  if (w.schema !== 1) return `schema is ${JSON.stringify(w.schema)}, expected 1`;
  if (!(Number.isFinite(w.factor) && w.factor > 0)) return '"factor" is missing or not a positive number';
  if (!Array.isArray(w.countries) || !w.countries.length) return '"countries" is missing or empty';
  for (let k = 0; k < w.countries.length; k++) {
    const c = w.countries[k];
    if (!c || !isStr(c.iso3) || typeof c.name !== 'string') return `countries[${k}] has no iso3 or name`;
    if (!Array.isArray(c.rings) || !c.rings.every(isStr)) return `countries[${k}] (${c.iso3}) has no rings`;
  }
  if (w.bathymetry != null) {
    if (!Array.isArray(w.bathymetry)) return '"bathymetry" is not a list';
    for (let k = 0; k < w.bathymetry.length; k++) {
      const b = w.bathymetry[k];
      if (!b || !(Number.isFinite(b.depth) && b.depth > 0) || !Array.isArray(b.rings) || !b.rings.every(isStr)) {
        return `bathymetry[${k}] has no positive depth or no rings`;
      }
    }
  }
  return '';
}

function checkSnapshot(s) {
  if (!s || typeof s !== 'object') return 'the file is not a JSON object';
  if (s.schema !== 1) return `schema is ${JSON.stringify(s.schema)}, expected 1`;
  if (!isStr(s.generatedAt) || !Number.isFinite(Date.parse(s.generatedAt))) return '"generatedAt" is missing or not a date';
  if (!s.units || !(Number.isFinite(s.units.boePerTWh) && s.units.boePerTWh > 0)) return '"units.boePerTWh" is missing';
  if (!Array.isArray(s.years) || s.years.length !== 2 || !s.years.every(Number.isInteger) || s.years[0] > s.years[1]) {
    return '"years" is not [first, last]';
  }
  if (!Array.isArray(s.sources)) return '"sources" is missing';
  if (!Array.isArray(s.countries) || !s.countries.length) return '"countries" is missing or empty';
  const series = (x, what) => {
    if (!x || !isStr(x.iso3) || typeof x.name !== 'string') return `${what} has no iso3 or name`;
    if (!Number.isInteger(x.y0)) return `${what} (${x.iso3}) has no integer y0`;
    if (!Array.isArray(x.oil) || !Array.isArray(x.gas)) return `${what} (${x.iso3}) lacks oil or gas`;
    if (x.oil.length !== x.gas.length) return `${what} (${x.iso3}) has oil and gas of different lengths`;
    if (!x.oil.every(isNumOrNull) || !x.gas.every(isNumOrNull)) return `${what} (${x.iso3}) holds a value that is not a number ≥ 0 or null`;
    return '';
  };
  for (let k = 0; k < s.countries.length; k++) {
    const why = series(s.countries[k], `countries[${k}]`);
    if (why) return why;
  }
  if (s.world != null) {
    const why = series(s.world, 'world');
    if (why) return why;
  }
  if (s.historical != null && (typeof s.historical !== 'object' || Array.isArray(s.historical))) return '"historical" is not an object';
  if (s.patched != null && !Array.isArray(s.patched)) return '"patched" is not a list';
  return '';
}

function checkFields(f) {
  if (!f || typeof f !== 'object') return 'the file is not a JSON object';
  if (f.schema !== 1) return `schema is ${JSON.stringify(f.schema)}, expected 1`;
  if (typeof f.available !== 'boolean') return '"available" is not true or false';
  if (f.available && !Array.isArray(f.fields)) return '"available" is true but "fields" is not a list';
  return '';
}

/* ── projection ──────────────────────────────────────────────────────────── *
 * World units: x ∈ [0, 1) west → east from 180°W, y ∈ [0, 1] north → south.  */

const lonToX = (lon) => (lon + 180) / 360;
const xToLon = (x) => x * 360 - 180;
function latToY(lat) {
  const p = clamp(lat, -MAX_LAT, MAX_LAT) * DEG;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + p / 2)) / (2 * Math.PI);
}
function yToLat(y) {
  return (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) / DEG;
}

/* ── state ───────────────────────────────────────────────────────────────── */

let geo = null;        // { countries: [{ iso3, name, rings: Float32Array[], path, bbox, lx, ly }], borders, source }
let prod = null;       // the validated snapshot, plus lookups (see buildProd)
let fields = null;     // { raw, available, points, skipped } or null when the file failed
let link = null;       // polygon index ↔ series, and the mismatch lists (see buildLink)
const raw = { world: null, snapshot: null, fields: null };   // last text read, to skip reparsing
const problems = new Map();

let mode = 'total';
let units = 'kboe';
let year = null;
let sel = null;        // { kind: 'country', iso3 } | { kind: 'field', id }
let showFields = true;
let statusFilter = 'operating';
let showLabels = true;
let playing = false;

const view = { cx: lonToX(40), cy: latToY(25), scale: 0 };   // scale = world width in CSS px
let W = 0, H = 0, dpr = 1;
let renderPending = false;

const canvas = $('map');
let ctx = canvas.getContext('2d');   // swapped briefly while the sea cache is painted
const wrap = $('map-wrap');
const slider = $('slider');

/* ── geometry, built once per load ───────────────────────────────────────── */

function buildGeo(w) {
  const borders = new Path2D();
  const countries = w.countries.map((c) => {
    const path = new Path2D();
    const rings = [];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let lw = 0;                          // widest single ring: what a label must fit in
    for (const enc of c.rings) {
      const ll = decodePolyline(enc, w.factor);
      if (ll.length < 6) continue;                       // fewer than three points
      const xy = new Float32Array(ll.length);
      for (let i = 0; i < ll.length; i += 2) {
        if (!(Math.abs(ll[i]) <= 180.5 && Math.abs(ll[i + 1]) <= 90.5)) {
          throw new Error(`${c.iso3} has a point off the globe (${ll[i]}, ${ll[i + 1]})`);
        }
        const x = lonToX(ll[i]), y = latToY(ll[i + 1]);
        xy[i] = x; xy[i + 1] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      rings.push(xy);
      let rx0 = Infinity, rx1 = -Infinity;
      for (let i = 0; i < xy.length; i += 2) { if (xy[i] < rx0) rx0 = xy[i]; if (xy[i] > rx1) rx1 = xy[i]; }
      if (rx1 - rx0 > lw) lw = rx1 - rx0;
      const sub = new Path2D();
      for (let i = 0; i < xy.length; i += 2) {
        const px = xy[i] * PATH_K, py = xy[i + 1] * PATH_K;
        if (i === 0) sub.moveTo(px, py); else sub.lineTo(px, py);
      }
      sub.closePath();
      path.addPath(sub);
      borders.addPath(sub);
    }
    const hasC = Array.isArray(c.c) && Number.isFinite(c.c[0]) && Number.isFinite(c.c[1]);
    return {
      // A country split at the antimeridian (Fiji, Russia) has a bbox the
      // width of the world, so labels go by the widest ring instead.
      iso3: c.iso3, name: c.name, rings, path, bbox: [x0, y0, x1, y1], lw,
      lx: hasC ? lonToX(c.c[0]) : (x0 + x1) / 2,
      ly: hasC ? latToY(c.c[1]) : (y0 + y1) / 2,
    };
  });
  // The sea floor is decoration under the data: if it is broken, say so and
  // draw the countries anyway rather than refusing the whole file.
  let bathy = null, bathyError = '';
  try { bathy = buildBathy(w); } catch (e) { bathyError = e.message; }
  return { countries, borders, bathy, bathyError, source: typeof w.source === 'string' ? w.source : '' };
}

/* Depth bands, each the area DEEPER than its depth (Natural Earth's bands
 * nest: the 200 m band contains all the others). So they are painted
 * shallowest first and the deepest tint lands on top, whatever order the file
 * lists them in. One Path2D per band, built once. The file's bands are
 * already simplified (~53k points in all), and the painted sea is cached
 * between frames (see drawSea), so no level-of-detail step is needed. */
function buildBathy(w) {
  if (!Array.isArray(w.bathymetry) || !w.bathymetry.length) return null;
  const bands = [...w.bathymetry].sort((a, b) => a.depth - b.depth).map((b) => {
    const path = new Path2D();
    let points = 0;
    for (const enc of b.rings) {
      const ll = decodePolyline(enc, w.factor);
      if (ll.length < 8) continue;
      const xy = new Float32Array(ll.length);
      for (let i = 0; i < ll.length; i += 2) { xy[i] = lonToX(ll[i]); xy[i + 1] = latToY(ll[i + 1]); }
      points += addRing(path, xy);
    }
    return { depth: b.depth, path, points };
  });
  return bands;
}
function addRing(path, xy) {
  const sub = new Path2D();
  for (let i = 0; i < xy.length; i += 2) {
    const px = xy[i] * PATH_K, py = xy[i + 1] * PATH_K;
    if (i === 0) sub.moveTo(px, py); else sub.lineTo(px, py);
  }
  sub.closePath();
  path.addPath(sub);
  return xy.length / 2;
}

function buildProd(s) {
  const byIso = new Map();
  for (const c of s.countries) byIso.set(c.iso3, c);
  const [Y0, Y1] = s.years;
  const k = s.units.boePerTWh / 365 / 1e6;               // GWh/yr → kboe/d
  // Per-year sums of every country with a value, the fallback denominator
  // when the file has no world series. Computed once; 125 × 216 additions.
  const n = Y1 - Y0 + 1;
  const sum = { oil: new Float64Array(n), gas: new Float64Array(n), total: new Float64Array(n) };
  for (const c of s.countries) {
    for (let i = 0; i < c.oil.length; i++) {
      const yi = c.y0 + i - Y0;
      if (yi < 0 || yi >= n) continue;
      const o = c.oil[i], g = c.gas[i];
      if (o != null) { sum.oil[yi] += o; sum.total[yi] += o; }
      if (g != null) { sum.gas[yi] += g; sum.total[yi] += g; }
    }
  }
  return { s, byIso, Y0, Y1, kboePerGWh: k, sum, classCache: new Map() };
}

/* The same series as a value in GWh for one year and mode: null for "no data",
 * with `partial` set when a total adds a number to a null. */
const valTmp = { v: null, partial: false };
function seriesAt(c, m, y, out = valTmp) {
  out.v = null; out.partial = false;
  if (!c) return out;
  const i = y - c.y0;
  if (i < 0 || i >= c.oil.length) return out;
  const o = c.oil[i], g = c.gas[i];
  if (m === 'oil') out.v = o;
  else if (m === 'gas') out.v = g;
  else if (o != null || g != null) {
    out.v = (o || 0) + (g || 0);
    out.partial = o == null || g == null;
  }
  return out;
}
function toUnit(gwh, u = units) {
  if (gwh == null) return null;
  return u === 'twh' ? gwh / 1000 : gwh * prod.kboePerGWh;
}
function worldAt(m, y) {
  const w = prod.s.world;
  if (w) {
    const r = seriesAt(w, m, y, { v: null, partial: false });
    return { v: r.v, label: 'world' };
  }
  const yi = y - prod.Y0;
  return { v: yi >= 0 && yi < prod.sum[m].length ? prod.sum[m][yi] : null, label: 'countries listed' };
}

/* Former states (USSR, Czechoslovakia, Yugoslavia) have series and no
 * outline. They count in sums and ranks like any other series; About lists
 * them under their own heading rather than as matching failures. */
/* Which former state each outline was part of. Fixed here because the data
 * carries no successor mapping; a country not listed gets no note. */
const FORMER_STATE = {};
for (const [state, members] of Object.entries({
  OWID_USS: ['RUS', 'UKR', 'BLR', 'KAZ', 'UZB', 'TKM', 'AZE', 'GEO', 'ARM', 'KGZ', 'TJK', 'MDA', 'LTU', 'LVA', 'EST'],
  OWID_CZS: ['CZE', 'SVK'],
  OWID_YGS: ['SRB', 'HRV', 'SVN', 'BIH', 'MKD', 'MNE', 'OWID_KOS', 'KOS'],
})) for (const m of members) FORMER_STATE[m] = state;

/* For a country hatched in the chosen year: the former state it was part of,
 * if that state has a figure then. Those states have no outline to tap. */
function formerStateNote(iso3) {
  const state = FORMER_STATE[iso3];
  if (!state || !prod) return '';
  const h = prod.byIso.get(state);
  if (!h) return '';
  const r = seriesAt(h, mode, year, { v: null, partial: false });
  if (r.v == null) return '';
  const label = (historicalLabels()[state] || '').replace(/\s*\(.*\)$/, '') || h.name;
  const the = /^USSR$/.test(label) ? 'the ' : '';
  return `No ${year} figure of its own: it was part of ${the}${label} then, which has no outline on this map. `
    + `${label}, ${MODES[mode].toLowerCase()}: ${fmtNum(toUnit(r.v))} ${UNITS[units].label}.`;
}

function historicalLabels() {
  const h = prod && prod.s.historical;
  const out = {};
  if (h && typeof h === 'object') for (const k in h) if (isStr(h[k])) out[k] = h[k];
  return out;
}

function buildLink() {
  if (!geo || !prod) return null;
  const series = geo.countries.map((c) => prod.byIso.get(c.iso3) || null);
  const polys = new Set(geo.countries.map((c) => c.iso3));
  const hist = historicalLabels();
  const historical = prod.s.countries.filter((c) => !polys.has(c.iso3) && hist[c.iso3]);
  const noPolygon = prod.s.countries.filter((c) => !polys.has(c.iso3) && !hist[c.iso3]);
  const noData = geo.countries.filter((c, i) => !series[i]);
  return { series, noPolygon, noData, historical };
}

/* The class of every polygon for one (mode, unit, year): 0 none, 1–8 a ramp
 * step, NODATA. Cached, so scrubbing back over a year costs nothing. */
function classesFor(m, u, y) {
  const key = `${m}|${u}|${y}`;
  let hit = prod.classCache.get(key);
  if (hit) return hit;
  const breaks = UNITS[u].breaks;
  const n = geo.countries.length;
  const cls = new Uint8Array(n), partial = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = seriesAt(link.series[i], m, y);
    const v = toUnit(r.v, u);
    if (v == null) { cls[i] = NODATA; continue; }
    partial[i] = r.partial ? 1 : 0;
    if (v <= 0) { cls[i] = 0; continue; }
    let c = 1;
    while (c <= breaks.length && v >= breaks[c - 1]) c++;
    cls[i] = c;
  }
  hit = { cls, partial };
  if (prod.classCache.size > 600) prod.classCache.clear();
  prod.classCache.set(key, hit);
  return hit;
}

function buildFields(f) {
  if (!f.available) return { raw: f, available: false, points: [], skipped: 0 };
  const points = [];
  let skipped = 0;
  for (const x of f.fields) {
    if (!x || !Number.isFinite(x.lat) || !Number.isFinite(x.lon) || Math.abs(x.lat) > 90 || Math.abs(x.lon) > 180) {
      skipped++;
      continue;
    }
    const oil = Number.isFinite(x.oilBpd) ? x.oilBpd : null;
    const gas = Number.isFinite(x.gasBoepd) ? x.gasBoepd : null;
    const fuel = String(x.fuel || '').toLowerCase().trim();
    points.push({
      f: x,
      id: String(x.id ?? `${x.name}|${x.lat}|${x.lon}`),
      x: lonToX(x.lon), y: latToY(x.lat),
      v: oil == null && gas == null ? null : (oil || 0) + (gas || 0),
      fuel: fuel === 'oil' ? 'oil' : fuel === 'gas' ? 'gas' : fuel === 'oil and gas' ? 'both' : 'other',
      operating: String(x.status || '').toLowerCase().trim() === 'operating',
    });
  }
  // Biggest first, so the small ones are drawn last and stay tappable on top.
  points.sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  return { raw: f, available: true, points, skipped };
}

// The file carries `wiki` only when GEM's page is not simply the unit name with underscores.
function fieldWiki(f) {
  if (isStr(f.wiki)) return f.wiki;
  return isStr(f.name) ? 'https://www.gem.wiki/' + f.name.trim().replace(/ /g, '_') : null;
}

/* ── view ────────────────────────────────────────────────────────────────── */

const minScale = () => Math.max(160, W);

function clampView() {
  view.scale = clamp(view.scale, minScale(), MAX_SCALE);
  view.cx -= Math.floor(view.cx);
  const half = H / (2 * view.scale);
  view.cy = view.scale <= H ? 0.5 : clamp(view.cy, half, 1 - half);
}
function screenToWorld(sx, sy) {
  return [view.cx + (sx - W / 2) / view.scale, view.cy + (sy - H / 2) / view.scale];
}
/* The nearest copy of a world point on screen, as x (CSS px) and y. */
function worldToScreenX(wx) {
  let dx = wx - view.cx;
  dx -= Math.round(dx);
  return dx * view.scale + W / 2;
}
const worldToScreenY = (wy) => (wy - view.cy) * view.scale + H / 2;
function worldCopies() {
  const xmin = view.cx - W / (2 * view.scale), xmax = view.cx + W / (2 * view.scale);
  const ks = [];
  for (let k = Math.floor(xmin); k < xmax; k++) ks.push(k);
  return ks;
}
function withWorldTransform(k, fn) {
  const s = view.scale / PATH_K;
  ctx.setTransform(dpr * s, 0, 0, dpr * s,
                   dpr * (W / 2 - (view.cx - k) * view.scale), dpr * (H / 2 - view.cy * view.scale));
  fn(s);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function fitFirst() {
  // First launch: 72°N to 45°S fills the height, centred on the Gulf — on a
  // phone that is Europe, Africa, the Middle East and western Russia at once.
  view.scale = H / (latToY(-45) - latToY(72));
  clampView();
}
function panBy(dx, dy) { view.cx -= dx / view.scale; view.cy -= dy / view.scale; clampView(); }
function zoomAround(factor, sx, sy, base = view.scale, anchor = null) {
  const [wx, wy] = anchor || screenToWorld(sx, sy);
  view.scale = clamp(base * factor, minScale(), MAX_SCALE);
  view.cx = wx - (sx - W / 2) / view.scale;
  view.cy = wy - (sy - H / 2) / view.scale;
  clampView();
}
function saveView() { store.set(STORE.view, JSON.stringify(view)); }
function restoreView() {
  try {
    const v = JSON.parse(store.get(STORE.view) || 'null');
    if (v && [v.cx, v.cy, v.scale].every(Number.isFinite) && v.scale > 0) Object.assign(view, v);
  } catch { /* fine */ }
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

function fieldRadius(p) {
  if (p.v == null || p.v <= 0) return FIELD_RMIN + 0.5;
  const zf = clamp(Math.pow(view.scale / 1500, 0.4), 0.7, 2.2);
  return clamp(FIELD_RREF * Math.sqrt(p.v / FIELD_VREF) * zf, FIELD_RMIN, FIELD_RMAX);
}
function fieldVisible(p) { return statusFilter === 'all' || p.operating; }
function fieldsDrawn() { return showFields && fields && fields.available && fields.points.length > 0; }

/* Of the circles under the finger, the one whose centre is nearest relative
 * to its size — so a tap on the middle of a big field that a small one
 * overlaps still finds the big one. Failing that, the nearest within a
 * finger's width: the small ones are smaller than any fingertip. */
function fieldAt(sx, sy) {
  if (!fieldsDrawn()) return null;
  let hit = null, hitScore = Infinity, near = null, nearD = Infinity;
  for (const p of fields.points) {
    if (!fieldVisible(p)) continue;
    const x = worldToScreenX(p.x), y = worldToScreenY(p.y);
    const d = Math.hypot(x - sx, y - sy);
    const r = fieldRadius(p);
    if (d <= r + 2) {
      const score = d / (r + 2);
      if (score < hitScore) { hit = p; hitScore = score; }
    } else if (d - r < 14 && d - r < nearD) { near = p; nearD = d - r; }
  }
  return hit || near;
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

function requestRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(render);
}

function render() {
  renderPending = false;
  if (!W || !H) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawSea();
  if (!geo) return;
  drawCountries();
  if (showLabels) drawLabels();
  if (fieldsDrawn()) drawFields();
  drawFieldSelection();
}

/* The sea (background, ocean, depth bands) depends only on the view and the
 * theme, so it is painted into an offscreen canvas and reused while the year,
 * mode or unit changes: scrubbing then costs one blit plus the country fills. */
let seaCache = null;
function drawSea() {
  const key = [view.cx, view.cy, view.scale, W, H, dpr, darkMq.matches, geo ? geo.countries.length : 0,
               geo && geo.bathy ? geo.bathy.length : 0].join('|');
  if (!seaCache || seaCache.cv.width !== canvas.width || seaCache.cv.height !== canvas.height) {
    const cv = document.createElement('canvas');
    cv.width = canvas.width; cv.height = canvas.height;
    seaCache = { cv, c: cv.getContext('2d'), key: '' };
  }
  if (seaCache.key !== key || seaCache.geo !== geo) {
    const main = ctx;
    ctx = seaCache.c;                         // the drawing helpers all paint into `ctx`
    try {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = pal.outside;
      ctx.fillRect(0, 0, W, H);
      const top = Math.max(0, worldToScreenY(0)), bottom = Math.min(H, worldToScreenY(1));
      ctx.fillStyle = pal.ocean;
      ctx.fillRect(0, top, W, bottom - top);
      if (geo && geo.bathy) drawBathy();
    } finally { ctx = main; }
    seaCache.key = key;
    seaCache.geo = geo;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(seaCache.cv, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawBathy() {
  if (!bathyStyles) {
    bathyStyles = geo.bathy.map((b) => bathyStyle(b.depth));
  }
  for (const k of worldCopies()) withWorldTransform(k, () => {
    let last = pal.ocean;
    for (let i = 0; i < geo.bathy.length; i++) {
      const style = bathyStyles[i];
      if (style === last) continue;          // 7000 m+ share the 6000 m tint: nothing to add
      ctx.fillStyle = style;
      ctx.fill(geo.bathy[i].path, 'evenodd');
      last = style;
    }
  });
}

function drawCountries() {
  const colour = prod && link && year != null;
  const cl = colour ? classesFor(mode, units, year) : null;
  const pat = hatchPattern();
  const selIdx = sel && sel.kind === 'country' ? geo.countries.findIndex((c) => c.iso3 === sel.iso3) : -1;
  for (const k of worldCopies()) withWorldTransform(k, (s) => {
    // The hatch is kept a fixed size on screen whatever the zoom.
    if (pat.setTransform) pat.setTransform(new DOMMatrix([1 / (dpr * s), 0, 0, 1 / (dpr * s), 0, 0]));
    const cs = geo.countries;
    for (let i = 0; i < cs.length; i++) {
      const c = cl ? cl.cls[i] : 0;
      if (c === NODATA) {
        ctx.fillStyle = pal.nodata; ctx.fill(cs[i].path, 'evenodd');
        ctx.fillStyle = pat; ctx.fill(cs[i].path, 'evenodd');
        continue;
      }
      ctx.fillStyle = c === 0 ? pal.none : pal.ramp[c - 1];
      ctx.fill(cs[i].path, 'evenodd');
      if (cl && cl.partial[i]) { ctx.fillStyle = pat; ctx.fill(cs[i].path, 'evenodd'); }
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 0.8 / s;
    ctx.stroke(geo.borders);
    if (selIdx >= 0) {
      ctx.strokeStyle = pal.halo; ctx.lineWidth = 4 / s; ctx.stroke(cs[selIdx].path);
      ctx.strokeStyle = pal.sel; ctx.lineWidth = 2 / s; ctx.stroke(cs[selIdx].path);
    }
  });
}

/* Names only where they fit inside their own country, largest first, never
 * on top of each other. Measured text is cached per name and font. */
const textWidths = new Map();
function drawLabels() {
  const cs = geo.countries;
  const order = labelOrder();
  const placed = [];
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const i of order) {
    const c = cs[i];
    const bw = c.lw * view.scale;
    if (bw < 44) break;                                   // sorted: all the rest are smaller
    let tw = textWidths.get(c.name);
    if (tw == null) { tw = ctx.measureText(c.name).width; textWidths.set(c.name, tw); }
    if (tw > bw * 1.25) continue;
    const x = worldToScreenX(c.lx), y = worldToScreenY(c.ly);
    if (x - tw / 2 < 4 || x + tw / 2 > W - 4 || y < 10 || y > H - 10) continue;
    const box = [x - tw / 2 - 3, y - 8, x + tw / 2 + 3, y + 8];
    if (placed.some((b) => b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1])) continue;
    placed.push(box);
    ctx.strokeStyle = pal.halo; ctx.lineWidth = 3; ctx.strokeText(c.name, x, y);
    ctx.fillStyle = pal.label; ctx.fillText(c.name, x, y);
  }
}
let labelOrderCache = null;
function labelOrder() {
  if (labelOrderCache && labelOrderCache.geo === geo) return labelOrderCache.order;
  const order = geo.countries.map((c, i) => i)
    .sort((a, b) => geo.countries[b].lw - geo.countries[a].lw);
  labelOrderCache = { geo, order };
  return order;
}

function drawFields() {
  const pts = fields.points;
  ctx.lineWidth = 1;
  ctx.strokeStyle = pal.ring;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (!fieldVisible(p)) continue;
    const r = fieldRadius(p);
    const x = worldToScreenX(p.x), y = worldToScreenY(p.y);
    if (x < -r || x > W + r || y < -r || y > H + r) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    if (p.v == null) {
      // No production figure: an open ring, so it is not read as a small field.
      ctx.strokeStyle = pal.fuel[p.fuel]; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = pal.ring; ctx.lineWidth = 1;
    } else {
      ctx.fillStyle = pal.fuel[p.fuel];
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawFieldSelection() {
  if (!sel || sel.kind !== 'field' || !fieldsDrawn()) return;
  const p = fields.points.find((q) => q.id === sel.id);
  if (!p) return;
  const r = fieldRadius(p) + 4;
  const x = worldToScreenX(p.x), y = worldToScreenY(p.y);
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.strokeStyle = pal.halo; ctx.lineWidth = 4; ctx.stroke();
  ctx.strokeStyle = pal.sel; ctx.lineWidth = 2; ctx.stroke();
}

/* ── errors ──────────────────────────────────────────────────────────────── */

function setProblem(key, file, msg) {
  if (msg) problems.set(key, { file, msg }); else problems.delete(key);
  const box = $('error');
  box.innerHTML = '';                        // empty it; the text below is DOM nodes
  if (!problems.size) { box.hidden = true; return; }
  for (const p of problems.values()) {
    const d = el('div');
    d.append(el('strong', null, p.file), document.createTextNode(p.msg));
    box.append(d);
  }
  box.hidden = false;
}

/* ── stamp, credits, legend, banner ──────────────────────────────────────── */

function updateStamp() {
  const st = $('stamp');
  if (!prod) { st.textContent = 'No production data'; st.className = 'stamp stale'; return; }
  const when = new Date(prod.s.generatedAt);
  const ageDays = (Date.now() - when.getTime()) / 864e5;
  let text = `Data ${fmtDate.format(when)} · ${prod.Y0}–${prod.Y1}`;
  if (ageDays > STALE_DAYS) text = `Stale · ${text}`;
  st.textContent = text;
  st.className = 'stamp' + (ageDays > STALE_DAYS ? ' stale' : '');
}

function creditsList() {
  const out = [];
  if (prod) for (const s of prod.s.sources) if (s && isStr(s.attribution)) out.push(s.attribution);
  if (!out.some((a) => /natural earth/i.test(a)) && geo && geo.source) out.push(geo.source);
  if (geo && geo.bathy && !out.some((a) => /bathymetry/i.test(a))) out.push('Bathymetry: Natural Earth');
  if (fieldsDrawn() && fields.raw.source && isStr(fields.raw.source.attribution)) out.push(fields.raw.source.attribution);
  return out;
}
function updateCredits() {
  const c = $('credits');
  c.textContent = creditsList().join(' · ');
  c.hidden = !c.textContent;
}

function updateLegend() {
  const lg = $('legend');
  lg.hidden = !(prod && geo);
  if (lg.hidden) return;
  const u = UNITS[units];
  $('legend-title').textContent = `${MODES[mode]}, ${year}`;
  $('legend-unit').textContent = u.label;
  const bar = $('legend-bar'), ticks = $('legend-ticks');
  bar.innerHTML = ''; ticks.innerHTML = '';
  for (const c of pal.ramp) {
    const i = el('i');
    i.style.background = c;
    bar.append(i);
  }
  u.breaks.forEach((b, k) => {
    const s = el('span', null, fmtTick(b));
    s.style.left = `${((k + 1) / pal.ramp.length) * 100}%`;
    ticks.append(s);
  });
  lg.setAttribute('aria-label', `Map key: ${MODES[mode]} ${year} in ${u.long}; steps at ${u.breaks.join(', ')}`);
  const none = lg.querySelector('.sw.none'), nd = lg.querySelector('.sw.nodata');
  none.style.background = pal.none;
  nd.style.background = `repeating-linear-gradient(135deg, ${pal.hatchInk} 0 1px, ${pal.nodata} 1px 4px)`;

  const lf = $('legend-fields');
  lf.innerHTML = '';
  lf.hidden = !fieldsDrawn();
  if (!lf.hidden) {
    for (const [key, label] of [['oil', 'Oil'], ['gas', 'Gas'], ['both', 'Oil and gas']]) {
      const k = el('span', 'key');
      const d = el('i', 'dot'); d.style.background = pal.fuel[key];
      k.append(d, document.createTextNode(label));
      lf.append(k);
    }
    const sz = el('span', 'key');
    const circles = el('span', 'sizes');
    for (const v of [1e4, 1e5, 1e6]) {
      const r = clamp(FIELD_RREF * Math.sqrt(v / FIELD_VREF), FIELD_RMIN, FIELD_RMAX);
      const i = el('i'); i.style.width = i.style.height = `${(2 * r).toFixed(1)}px`;
      circles.append(i);
    }
    sz.append(circles, document.createTextNode('10k · 100k · 1M boe/d'));
    lf.append(sz);
  }
}

function updateBanner() {
  const b = $('banner');
  const unavailable = showFields && fields && !fields.available;
  b.hidden = !unavailable;
  // Short on the map; the file's reason, word for word, is in the Layers
  // panel the banner opens and in About.
  if (unavailable) {
    b.innerHTML = '';
    b.append(el('b', null, 'No field points'), document.createTextNode(' — fields.json is not available. Details'));
  }
}
function fieldsReason() {
  const r = fields && fields.raw && fields.raw.reason;
  return isStr(r) ? r : 'data/fields.json says the fields are not available, and gives no reason.';
}

function updateLayersPanel() {
  const chk = $('chk-fields'), note = $('fields-note');
  const usable = fields && fields.available;
  chk.checked = showFields;
  note.classList.remove('warn');
  if (!fields) {
    note.textContent = 'data/fields.json could not be read — see the message on the map.';
    note.classList.add('warn');
  } else if (!fields.available) {
    note.textContent = `Not available: ${fieldsReason()}`;
    note.classList.add('warn');
  } else {
    const shown = fields.points.filter(fieldVisible).length;
    const src = fields.raw.source || {};
    note.textContent = `${nf0.format(shown)} of ${nf0.format(fields.points.length)} shown`
      + (fields.skipped ? ` (${fields.skipped} without coordinates left out)` : '')
      + `. ${src.name || 'GOGET'}${src.release ? `, ${src.release}` : ''}.`;
  }
  $('status-row').hidden = !usable;
  for (const b of document.querySelectorAll('#status-seg button')) {
    b.setAttribute('aria-pressed', String(b.dataset.status === statusFilter));
  }
  $('chk-labels').checked = showLabels;
}

/* ── the year player ─────────────────────────────────────────────────────── */

function buildTicks() {
  const t = $('ticks');
  t.innerHTML = '';
  if (!prod) return;
  const span = prod.Y1 - prod.Y0;
  const step = span > 80 ? 25 : span > 30 ? 10 : 5;
  for (let y = Math.ceil(prod.Y0 / step) * step; y <= prod.Y1; y += step) {
    if (prod.Y1 - y < step * 0.4 && y !== prod.Y1) continue;
    const s = el('span', null, String(y));
    s.style.left = `${((y - prod.Y0) / Math.max(1, span)) * 100}%`;
    t.append(s);
  }
  if (prod.Y1 % step && (prod.Y1 % step) >= step * 0.6) {
    const s = el('span', null, String(prod.Y1));
    s.style.left = '100%';
    t.append(s);
  }
}

function syncYearUI() {
  for (const id of ['btn-prev', 'btn-play', 'btn-next', 'slider']) $(id).disabled = !prod;
  if (!prod) {
    $('year-label').textContent = '—';
    $('year-sum').textContent = '';
    return;
  }
  slider.value = String(year);
  slider.setAttribute('aria-valuetext', String(year));
  $('year-label').textContent = String(year);
  const w = worldAt(mode, year);
  const u = UNITS[units].label;
  $('year-sum').textContent = w.v == null
    ? `${MODES[mode]}: no world total`
    : `${MODES[mode]}, ${w.label === 'world' ? 'world' : 'all listed'}: ${fmtNum(toUnit(w.v))} ${u}`;
}

function setYear(y, persist = true) {
  if (!prod) return;
  year = clamp(Math.round(y), prod.Y0, prod.Y1);
  syncYearUI();
  updateLegend();
  updateSheet();
  if (persist) store.set(STORE.year, String(year));
  requestRender();
}

let playAcc = 0, lastFrame = 0;
function tick(now) {
  if (!playing) return;
  playAcc += lastFrame ? (now - lastFrame) / 1000 * YEARS_PER_SEC : 0;
  lastFrame = now;
  if (playAcc >= 1) {
    const step = Math.floor(playAcc);
    playAcc -= step;
    if (year + step >= prod.Y1) { setYear(prod.Y1); setPlaying(false); return; }
    setYear(year + step, false);
  }
  requestAnimationFrame(tick);
}
function setPlaying(on) {
  if (!prod) on = false;
  playing = on;
  $('ico-play').hidden = on;
  $('ico-pause').hidden = !on;
  $('btn-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  if (on) {
    if (year >= prod.Y1) setYear(prod.Y0, false);
    playAcc = 0; lastFrame = 0;
    requestAnimationFrame(tick);
  } else if (prod) {
    store.set(STORE.year, String(year));
  }
}

/* ── the sheet: a tapped country or field ────────────────────────────────── */

function closeSheet() {
  sel = null;
  store.set(STORE.sel, 'null');
  updateSheet();
  requestRender();
}
function select(next) {
  sel = next;
  store.set(STORE.sel, JSON.stringify(sel));
  updateSheet();
  requestRender();
}

function updateSheet() {
  const sheet = $('sheet'), body = $('sheet-body');
  if (!sel) { sheet.hidden = true; return; }
  if (sel.kind === 'country') {
    if (!geo || !prod) { sheet.hidden = true; return; }
    const gi = geo.countries.findIndex((c) => c.iso3 === sel.iso3);
    const series = prod.byIso.get(sel.iso3) || null;
    if (gi < 0 && !series) { sheet.hidden = true; return; }
    sheet.hidden = false;                   // shown first: the sparkline measures it
    body.innerHTML = '';
    countrySheet(body, gi >= 0 ? geo.countries[gi].name : series.name, series, sel.iso3);
  } else {
    const p = fieldsDrawn() ? fields.points.find((q) => q.id === sel.id) : null;
    if (!p) { sheet.hidden = true; return; }
    body.innerHTML = '';
    fieldSheet(body, p);
  }
  sheet.hidden = false;
}

function countrySheet(body, name, c, iso3) {
  const u = UNITS[units].label;
  body.append(el('h2', null, name));
  if (!c) {
    body.append(el('p', 'sub', 'No production series'));
    body.append(el('p', 'sheet-note',
      'data/snapshot.json has no series for this country, so it is hatched in every year. '
      + 'The About screen lists every polygon without data and every series without a polygon.'));
    const fs = formerStateNote(iso3);
    if (fs) body.append(el('p', 'sheet-note', fs));
    return;
  }
  body.append(el('p', 'sub', `${year} · ${u}`));

  const parts = {
    oil: seriesAt(c, 'oil', year, { v: null, partial: false }),
    gas: seriesAt(c, 'gas', year, { v: null, partial: false }),
    total: seriesAt(c, 'total', year, { v: null, partial: false }),
  };
  const stats = el('div', 'stats');
  for (const m of ['oil', 'gas', 'total']) {
    const box = el('div', 'stat' + (m === mode ? ' on' : ''));
    const k = el('div', 'stat-k');
    if (m !== 'total') {
      const sw = el('i', 'swatch-line');
      sw.style.background = pal.fuel[m];
      k.append(sw);
    }
    k.append(document.createTextNode(m === 'total' ? 'Oil + Gas' : MODES[m]));
    const r = parts[m];
    const v = el('div', 'stat-v' + (r.v == null ? ' nd' : ''), r.v == null ? 'no data' : fmtNum(toUnit(r.v)));
    const w = worldAt(m, year);
    const share = r.v != null && w.v ? (r.v / w.v) * 100 : null;
    const s = el('div', 'stat-s', share == null ? ' ' : `${fmtPct(share)} of ${w.label === 'world' ? 'world' : 'listed'}`);
    box.append(k, v, s);
    stats.append(box);
  }
  body.append(stats);

  const notes = [];
  const rank = rankOf(c.iso3);
  if (rank) notes.push(`${ordinal(rank.r)} of ${rank.n} producers of ${MODES[mode].toLowerCase()} in ${year}.`);
  if (parts.total.partial) {
    const missing = parts.oil.v == null ? 'Oil' : 'Gas';
    notes.push(`${missing} has no data for ${year}, so the total counts ${missing === 'Oil' ? 'gas' : 'oil'} only (hatched over its colour on the map).`);
  }
  if (!prod.s.world) notes.push('Shares are of the sum of every country listed that year: the file has no world total.');
  if (parts[mode].v == null) {
    const fs = formerStateNote(c.iso3);
    if (fs) notes.push(fs);
  }
  const span = seriesSpan(c);
  if (span) notes.push(span);

  body.append(sparkline(c));
  for (const n of notes) body.append(el('p', 'sheet-note', n));
}

function rankOf(iso3) {
  const vals = [];
  for (const c of prod.s.countries) {
    const r = seriesAt(c, mode, year);
    if (r.v != null && r.v > 0) vals.push([c.iso3, r.v]);
  }
  vals.sort((a, b) => b[1] - a[1]);
  const i = vals.findIndex((v) => v[0] === iso3);
  return i < 0 ? null : { r: i + 1, n: vals.length };
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function seriesSpan(c) {
  let first = null, last = null;
  for (let i = 0; i < c.oil.length; i++) {
    if (c.oil[i] != null || c.gas[i] != null) { if (first == null) first = c.y0 + i; last = c.y0 + i; }
  }
  if (first == null) return 'Every year of this series is "no data".';
  if (first === prod.Y0 && last === prod.Y1) return '';
  return `Data from ${first} to ${last}.`;
}

/* Oil and gas as two lines on one axis in the unit on screen; gaps where the
 * file says null. Drag across it to move the year. */
const SVG = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const n = document.createElementNS(SVG, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function sparkline(c) {
  const cw = $('sheet').clientWidth;
  const w = cw > 100 ? cw - 30 : 330, h = 96;
  const padL = 4, padR = 4, padT = 14, padB = 16;
  const x = (y) => padL + ((y - prod.Y0) / Math.max(1, prod.Y1 - prod.Y0)) * (w - padL - padR);
  let max = 0;
  for (let i = 0; i < c.oil.length; i++) {
    for (const v of [c.oil[i], c.gas[i]]) if (v != null && v > max) max = v;
  }
  const maxU = toUnit(max) || 1;
  const yOf = (gwh) => padT + (1 - toUnit(gwh) / maxU) * (h - padT - padB);
  const svg = svgEl('svg', { class: 'spark', viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img',
    'aria-label': `Oil and gas production ${prod.Y0}–${prod.Y1}, peak ${fmtNum(maxU)} ${UNITS[units].label}` });
  const ink = getComputedStyle(document.body).getPropertyValue('--ink-dim').trim() || '#888';
  const faint = getComputedStyle(document.body).getPropertyValue('--line').trim() || '#ddd';
  svg.append(svgEl('line', { x1: padL, x2: w - padR, y1: h - padB, y2: h - padB, stroke: faint, 'stroke-width': 1 }));
  svg.append(svgEl('line', { x1: padL, x2: w - padR, y1: padT, y2: padT, stroke: faint, 'stroke-width': 1, 'stroke-dasharray': '2 3' }));
  const top = svgEl('text', { x: padL, y: padT - 4, fill: ink });
  top.textContent = `${fmtNum(maxU)} ${UNITS[units].label}`;
  svg.append(top);
  for (const [txt, yr, anchor] of [[String(prod.Y0), prod.Y0, 'start'], [String(prod.Y1), prod.Y1, 'end']]) {
    const t = svgEl('text', { x: x(yr), y: h - 3, fill: ink, 'text-anchor': anchor });
    t.textContent = txt;
    svg.append(t);
  }
  for (const m of ['oil', 'gas']) {
    const arr = c[m];
    let d = '', pen = false;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] == null) { pen = false; continue; }
      const px = x(c.y0 + i).toFixed(1), py = yOf(arr[i]).toFixed(1);
      d += (pen ? 'L' : 'M') + px + ' ' + py;
      pen = true;
    }
    if (d) svg.append(svgEl('path', { d, fill: 'none', stroke: pal.fuel[m], 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }
  const mx = x(year);
  svg.append(svgEl('line', { x1: mx, x2: mx, y1: padT - 2, y2: h - padB, stroke: ink, 'stroke-width': 1 }));
  const yearLab = svgEl('text', { x: clamp(mx, 30, w - 30), y: h - 3, fill: ink, 'text-anchor': 'middle', 'font-weight': 700 });
  yearLab.textContent = String(year);
  if (year !== prod.Y0 && year !== prod.Y1 && Math.abs(mx - x(prod.Y0)) > 34 && Math.abs(mx - x(prod.Y1)) > 34) svg.append(yearLab);
  for (const m of ['oil', 'gas']) {
    const r = seriesAt(c, m, year, { v: null, partial: false });
    if (r.v == null) continue;
    svg.append(svgEl('circle', { cx: mx, cy: yOf(r.v), r: 3.5, fill: pal.fuel[m], stroke: pal.ring, 'stroke-width': 1.5 }));
  }
  const scrub = (e) => {
    const b = svg.getBoundingClientRect();
    const f = (e.clientX - b.left) / b.width * w;
    const y = prod.Y0 + ((f - padL) / (w - padL - padR)) * (prod.Y1 - prod.Y0);
    if (playing) setPlaying(false);
    setYear(y);
  };
  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    scrub(e);
    // setYear() rebuilt the sheet, so this node is gone; follow the finger on
    // the replacement by listening at the document until it lifts.
    const move = (ev) => scrub(ev);
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  });
  return svg;
}

function fieldSheet(body, p) {
  const f = p.f;
  body.append(el('h2', null, f.name || 'Unnamed field'));
  body.append(el('p', 'sub', isStr(f.country) ? f.country : 'Country not stated'));
  const dl = el('dl');
  const row = (k, v) => {
    if (v == null || v === '') return;
    dl.append(el('dt', null, k), el('dd', null, String(v)));
  };
  const fuelNames = { oil: 'Oil', gas: 'Gas', both: 'Oil and gas', other: f.fuel || 'Not stated' };
  const oil = Number.isFinite(f.oilBpd) ? f.oilBpd : null;
  const gas = Number.isFinite(f.gasBoepd) ? f.gasBoepd : null;
  row('Fuel', fuelNames[p.fuel]);
  row('Type', f.type);
  row('Status', f.status);
  row('Setting', f.offshore === 1 ? 'Offshore' : f.offshore === 0 ? 'Onshore' : null);
  row('Basin', f.basin);
  row('Operator', f.operator);
  if (Array.isArray(f.parents) && f.parents.length) row('Parents', f.parents.filter(isStr).join(', '));
  row('Discovered', f.disc);
  row('Investment decision', f.fid);
  row('Production start', f.start);
  const yr = Number.isFinite(f.prodYear) ? ` (${f.prodYear})` : '';
  if (oil == null && gas == null) row('Production', 'not reported');
  else {
    if (oil != null) row(`Oil${yr}`, `${nf0.format(oil)} bbl/d`);
    if (gas != null) row(`Gas${yr}`, `${nf0.format(gas)} boe/d`);
    if (oil != null && gas != null) row('Together', `${nf0.format(oil + gas)} boe/d`);
  }
  const rOil = Number.isFinite(f.resOilMbbl) ? f.resOilMbbl : null;
  const rGas = Number.isFinite(f.resGasMboe) ? f.resGasMboe : null;
  if (rOil != null || rGas != null) {
    const cls = isStr(f.resClass) ? f.resClass : 'reserves';
    const ry = Number.isFinite(f.resYear) ? ` (${f.resYear})` : '';
    if (rOil != null) row(`Liquids ${cls}${ry}`, `${nf1.format(rOil)} million bbl`);
    if (rGas != null) row(`Gas ${cls}${ry}`, `${nf1.format(rGas)} million boe`);
  }
  if (f.approx === 1) row('Location', 'approximate (per the tracker)');
  body.append(dl);
  const wiki = fieldWiki(f);
  if (wiki) {
    const pEl = el('p', 'sheet-note url');
    pEl.append(document.createTextNode('GEM wiki: '), el('span', null, wiki));
    body.append(pEl);
  }
  body.append(el('p', 'sheet-note', "Field volumes are the tracker's own, for its newest data year: liquids (oil, condensate, NGL) "
    + 'in barrels a day, gas as barrels of oil equivalent a day at 159 Sm³ per boe. Reserves are the class the tracker gives.'));
}

/* ── About ───────────────────────────────────────────────────────────────── */

function showAbout() {
  const b = $('about-body');
  b.innerHTML = '';
  const h3 = (t) => b.append(el('h3', null, t));
  const p = (t, cls) => { const n = el('p', cls, t); b.append(n); return n; };
  const dl = (rows) => {
    const d = el('dl');
    for (const [k, v] of rows) d.append(el('dt', null, k), el('dd', null, v));
    b.append(d);
  };

  p('Each country is coloured by its production in the chosen year, in the chosen unit. '
    + 'Hatching means the file has no figure for that country and year — which is not the same as zero. '
    + 'Tap a country for its numbers and its whole series.');

  if (prod) {
    h3('Data');
    dl([
      ['Updated', fmtFull.format(new Date(prod.s.generatedAt))],
      ['Years', `${prod.Y0}–${prod.Y1}`],
      ['Series', `${prod.s.countries.length} countries, in ${prod.s.units.series || 'GWh per year'}`],
      ['World total', prod.s.world ? `${prod.s.world.name || 'World'} series (${prod.s.world.iso3 || 'world'})` : 'not in the file; shares use the sum of listed countries'],
    ]);
    h3('Units');
    p(`kboe/d is thousands of barrels of oil equivalent a day: GWh ÷ 1000 × ${nf0.format(prod.s.units.boePerTWh)} boe per TWh ÷ 365 ÷ 1000. `
      + 'TWh/yr is GWh ÷ 1000.');
    if (isStr(prod.s.units.note)) p(prod.s.units.note, 'muted');
  }

  h3('Sources');
  const src = (name, rows) => {
    const d = el('div', 'src');
    d.append(el('b', null, name));
    for (const [k, v] of rows) if (isStr(v)) d.append(el('p', 'muted', `${k}: ${v}`));
    b.append(d);
  };
  if (prod) {
    for (const s of prod.s.sources) {
      if (!s) continue;
      src(s.name || 'Source', [['Licence', s.licence], ['Attribution', s.attribution], ['Detail', s.detail], ['Address', s.url]]);
    }
  }
  if (geo && geo.source && !(prod && prod.s.sources.some((s) => s && /natural earth/i.test(s.name || '')))) {
    src('Country outlines', [['Source', geo.source]]);
  } else if (geo && geo.source) {
    p(`Outlines${geo.bathy ? ' and sea-floor depth bands' : ''} in data/world.json: ${geo.source}.`, 'muted');
  }
  if (geo && geo.bathy) {
    p(`Bathymetry: Natural Earth. ${geo.bathy.length} depth bands from ${geo.bathy[0].depth} m to ${geo.bathy[geo.bathy.length - 1].depth} m, `
      + 'shaded under the countries for orientation only.', 'muted');
  }
  if (fields && fields.available && fields.raw.source) {
    const s = fields.raw.source;
    src(s.name || 'Field points', [['Release', s.release], ['File', s.file], ['Licence', s.licence], ['Attribution', s.attribution], ['Address', s.url]]);
  } else {
    src('Field points', [['Status', !fields ? 'data/fields.json could not be read' : `not available — ${fieldsReason()}`]]);
  }

  if (link) {
    h3('Matching countries to outlines');
    const withOutline = prod.s.countries.length - link.noPolygon.length - link.historical.length;
    p(`Series are matched to Natural Earth outlines by ISO 3166 alpha-3 code. `
      + `${withOutline} of ${prod.s.countries.length} series have an outline.`);
    if (link.historical.length) {
      const hist = historicalLabels();
      p(`Former states (${link.historical.length}) — no outline; counted in the world total and in ranks, `
        + 'while their successor states are hatched before their own series begin:', 'muted');
      p(link.historical.map((c) => `${hist[c.iso3]} (${c.iso3})`).join(', '));
    }
    if (link.noPolygon.length) {
      p(`Series with no outline at this scale (${link.noPolygon.length}) — in the data, but not on the map:`, 'muted');
      p(link.noPolygon.map((c) => `${c.name} (${c.iso3})`).join(', '));
    }
    if (link.noData.length) {
      p(`Outlines with no series (${link.noData.length}) — always hatched:`, 'muted');
      p(link.noData.map((c) => `${c.name} (${c.iso3})`).join(', '));
    }
  }

  if (prod && Array.isArray(prod.s.patched) && prod.s.patched.length) {
    const ps = prod.s.patched.filter((x) => x && typeof x === 'object');
    h3('Corrections');
    p(`${ps.length} source ${ps.length === 1 ? 'hole' : 'holes'} set to no data by the pipeline:`, 'muted');
    const ul = el('ul');
    for (const x of ps) {
      ul.append(el('li', null, [x.country || x.iso3, x.series, x.year].filter((v) => v != null && v !== '').join(' ')
        + (isStr(x.note) ? ` — ${x.note}` : '')));
    }
    b.append(ul);
  }

  if (prod) {
    const notes = dataNotes();
    if (notes.length) {
      h3('Worth knowing');
      const ul = el('ul');
      for (const n of notes) ul.append(el('li', null, n));
      b.append(ul);
    }
  }

  h3('How it updates');
  p('The app re-reads the three files in data/ every time it is opened, and again whenever new data '
    + 'lands while it is open. A scheduled job rewrites them and a Shortcut carries them in; the app '
    + 'itself never goes online.', 'muted');
  $('about').hidden = false;
  document.querySelector('.about-card').scrollTop = 0;
  $('about-close').focus({ preventScroll: true });
}

/* Facts about this particular file that change how a year should be read —
 * worked out from the data, so they stay true when the file is rebuilt. */
function dataNotes() {
  const notes = [];
  const s = prod.s;
  if (!s.world) notes.push('The file carries no world series (world is null), so shares and the total under the map are the sum of the countries listed for that year.');
  const late = [], early = [];
  const hist = historicalLabels();
  for (const c of s.countries) {
    if (hist[c.iso3]) continue;
    let peak = 0, first = null, last = null;
    for (let i = 0; i < c.oil.length; i++) {
      const t = (c.oil[i] || 0) + (c.gas[i] || 0);
      if (t > peak) peak = t;
      if (c.oil[i] != null || c.gas[i] != null) { if (first == null) first = c.y0 + i; last = c.y0 + i; }
    }
    if (peak < 100000) continue;                         // producers above 100 TWh/yr at peak
    if (first != null && first > prod.Y0 + 5) late.push(`${c.name} (${first})`);
    if (last != null && last < prod.Y1) early.push(`${c.name} (${last})`);
  }
  if (late.length) notes.push(`Major producers whose series start late (first year in brackets); earlier years are hatched on the map: ${late.join(', ')}.`);
  // The successor states' series start in 1985; if the file has no series
  // for the Soviet Union itself, its production before then is simply absent.
  const rus = prod.byIso.get('RUS');
  if (rus && rus.y0 > prod.Y0 && !prod.byIso.has('SUN') && !s.countries.some((c) => /soviet|ussr/i.test(c.name))) {
    notes.push(`There is no series for the Soviet Union, so before ${rus.y0} its production is missing from the map and from every share and sum.`);
  }
  if (early.length) notes.push(`Major producers whose series stop before ${prod.Y1}: ${early.join(', ')}.`);
  let partial = 0;
  for (const c of s.countries) {
    const r = seriesAt(c, 'total', prod.Y1);
    if (r.partial) partial++;
  }
  if (partial) notes.push(`In ${prod.Y1}, ${partial} countries have oil or gas but not both; their Oil + Gas total counts the part that exists and is hatched over its colour.`);
  return notes;
}

/* ── loading ─────────────────────────────────────────────────────────────── */

async function readText(path) {
  const r = await fetch(`./${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(` could not be read (HTTP ${r.status}). Is the file missing?`);
  return r.text();
}
function parseJson(text) {
  try { return JSON.parse(text); } catch {
    const html = text.trim().startsWith('<');
    throw new Error(html ? ' is not JSON — it looks like a web page was written over it.' : ' is not valid JSON (unparseable or cut short).');
  }
}

let loading = null;
async function loadAll() {
  if (loading) return loading;
  loading = (async () => {
    const texts = await Promise.all(Object.values(FILES).map((f) => readText(f).then((t) => ({ t }), (e) => ({ e }))));
    const [tw, ts, tf] = texts;
    let changed = false;

    if (tw.t == null || tw.t !== raw.world) {
      changed = true;
      raw.world = tw.t ?? null;
      try {
        if (tw.e) throw tw.e;
        const w = parseJson(tw.t);
        const why = checkWorld(w);
        if (why) throw new Error(` is not a world outline file: ${why}.`);
        try { geo = buildGeo(w); } catch (e) { throw new Error(` could not be decoded: ${e.message}.`); }
        labelOrderCache = null;
        bathyStyles = null;
        setProblem('world', FILES.world, geo.bathyError
          ? ` has depth bands that could not be decoded (${geo.bathyError}); the sea is drawn flat.` : null);
      } catch (e) {
        geo = null;
        setProblem('world', FILES.world, `${e.message} No country outlines, so nothing can be coloured.`);
      }
    }
    if (ts.t == null || ts.t !== raw.snapshot) {
      changed = true;
      raw.snapshot = ts.t ?? null;
      try {
        if (ts.e) throw ts.e;
        const s = parseJson(ts.t);
        const why = checkSnapshot(s);
        if (why) throw new Error(` is not a World Oil & Gas snapshot: ${why}.`);
        prod = buildProd(s);
        setProblem('snapshot', FILES.snapshot, null);
      } catch (e) {
        prod = null;
        setProblem('snapshot', FILES.snapshot, `${e.message} The map shows outlines only — no production is drawn.`);
      }
    }
    if (tf.t == null || tf.t !== raw.fields) {
      changed = true;
      raw.fields = tf.t ?? null;
      try {
        if (tf.e) throw tf.e;
        const f = parseJson(tf.t);
        const why = checkFields(f);
        if (why) throw new Error(` is not a fields file: ${why}.`);
        fields = buildFields(f);
        setProblem('fields', FILES.fields, null);
      } catch (e) {
        fields = null;
        setProblem('fields', FILES.fields, `${e.message} Field points are not drawn; the country map is unaffected.`);
      }
    }
    if (!changed) return;
    link = buildLink();
    if (prod) {
      const stored = Number(store.get(STORE.year));
      const want = year ?? (Number.isInteger(stored) && stored ? stored : prod.Y1);
      year = clamp(want, prod.Y0, prod.Y1);
      slider.min = String(prod.Y0);
      slider.max = String(prod.Y1);
    } else {
      setPlaying(false);
    }
    buildTicks();
    syncYearUI();
    updateStamp();
    updateCredits();
    updateLegend();
    updateBanner();
    updateLayersPanel();
    updateSheet();
    if (!$('about').hidden) showAbout();
    requestRender();
  })();
  try { await loading; } finally { loading = null; }
}

/* ── gestures ────────────────────────────────────────────────────────────── */

const pointers = new Map();
let gesture = null;
let rect = null;

function startGesture() {
  const pts = [...pointers.values()];
  if (pts.length === 1) {
    gesture = { type: 'pan', x: pts[0].x, y: pts[0].y, sx: pts[0].x, sy: pts[0].y,
                moved: gesture ? gesture.moved : false, t0: performance.now() };
  } else if (pts.length >= 2) {
    const [a, b] = pts;
    const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
    gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), moved: true,
                scale0: view.scale, anchor: screenToWorld(mx, my) };
  }
}
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  rect = canvas.getBoundingClientRect();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  startGesture();
  if (!$('layers').hidden) setLayersOpen(false);
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p || !gesture) return;
  p.x = e.clientX; p.y = e.clientY;
  if (gesture.type === 'pan' && pointers.size === 1) {
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    gesture.x = e.clientX; gesture.y = e.clientY;
    if (Math.hypot(e.clientX - gesture.sx, e.clientY - gesture.sy) > 6) gesture.moved = true;
    if (gesture.moved) { panBy(dx, dy); requestRender(); }
  } else if (gesture.type === 'pinch' && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
    zoomAround(Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, gesture.d0), mx, my, gesture.scale0, gesture.anchor);
    requestRender();
  }
});
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const wasTap = gesture && gesture.type === 'pan' && !gesture.moved
                 && pointers.size === 1 && performance.now() - gesture.t0 < 450 && e.type === 'pointerup';
  pointers.delete(e.pointerId);
  if (pointers.size > 0) { startGesture(); return; }
  if (wasTap) onTap(e.clientX - rect.left, e.clientY - rect.top);
  gesture = null;
  saveView();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault());       // no page zoom on iOS
}

function zoomAt(sx, sy, factor) {
  zoomAround(factor, sx, sy);
  saveView();
  requestRender();
}

/* A single tap selects after a short wait, so a second tap can turn it into
 * a double-tap zoom instead. */
let lastTap = null, tapTimer = null;
function onTap(sx, sy) {
  const now = performance.now();
  if (lastTap && now - lastTap.t < 300 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 24) {
    clearTimeout(tapTimer); tapTimer = null; lastTap = null;
    zoomAt(sx, sy, 2);
    return;
  }
  lastTap = { x: sx, y: sy, t: now };
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { tapTimer = null; selectAt(sx, sy); }, 260);
}
function selectAt(sx, sy) {
  const f = fieldAt(sx, sy);
  if (f) { select({ kind: 'field', id: f.id }); return; }
  const i = countryAt(sx, sy);
  if (i >= 0) select({ kind: 'country', iso3: geo.countries[i].iso3 });
  else closeSheet();
}

/* ── controls ────────────────────────────────────────────────────────────── */

function setMode(m) {
  if (!MODES[m]) return;
  mode = m;
  store.set(STORE.mode, m);
  for (const b of document.querySelectorAll('#modes button')) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  syncYearUI();
  updateLegend();
  updateSheet();
  requestRender();
}
function setUnits(u) {
  if (!UNITS[u]) return;
  units = u;
  store.set(STORE.units, u);
  $('btn-units').textContent = UNITS[u].label;
  $('btn-units').setAttribute('aria-label', `Units: ${UNITS[u].long}. Tap to change.`);
  syncYearUI();
  updateLegend();
  updateSheet();
  requestRender();
}
function setLayersOpen(open) {
  $('layers').hidden = !open;
  $('btn-layers').setAttribute('aria-expanded', String(open));
  if (open) updateLayersPanel();
}

for (const b of document.querySelectorAll('#modes button')) b.addEventListener('click', () => setMode(b.dataset.mode));
$('btn-units').addEventListener('click', () => setUnits(UNIT_ORDER[(UNIT_ORDER.indexOf(units) + 1) % UNIT_ORDER.length]));
$('zoom-in').addEventListener('click', () => zoomAt(W / 2, H / 2, 2));
$('zoom-out').addEventListener('click', () => zoomAt(W / 2, H / 2, 0.5));
$('zoom-home').addEventListener('click', () => {
  view.scale = minScale(); view.cx = lonToX(0); view.cy = 0.5; clampView(); saveView(); requestRender();
});
$('btn-layers').addEventListener('click', () => setLayersOpen($('layers').hidden));
$('banner').addEventListener('click', () => setLayersOpen(true));
$('chk-fields').addEventListener('change', (e) => {
  showFields = e.target.checked;
  store.set(STORE.fields, showFields ? '1' : '0');
  if (!showFields && sel && sel.kind === 'field') closeSheet();
  updateBanner(); updateLegend(); updateCredits(); updateLayersPanel(); requestRender();
});
$('chk-labels').addEventListener('change', (e) => {
  showLabels = e.target.checked;
  store.set(STORE.labels, showLabels ? '1' : '0');
  requestRender();
});
for (const b of document.querySelectorAll('#status-seg button')) {
  b.addEventListener('click', () => {
    statusFilter = b.dataset.status;
    store.set(STORE.status, statusFilter);
    updateLayersPanel();
    requestRender();
  });
}
$('stamp').addEventListener('click', showAbout);
$('about-close').addEventListener('click', () => { $('about').hidden = true; });
$('about').addEventListener('click', (e) => { if (e.target === $('about')) $('about').hidden = true; });
$('sheet-close').addEventListener('click', closeSheet);
$('btn-play').addEventListener('click', () => setPlaying(!playing));
$('btn-prev').addEventListener('click', () => { setPlaying(false); setYear(year - 1); });
$('btn-next').addEventListener('click', () => { setPlaying(false); setYear(year + 1); });
slider.addEventListener('input', () => { if (playing) setPlaying(false); setYear(Number(slider.value)); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('about').hidden) $('about').hidden = true;
    else if (!$('layers').hidden) setLayersOpen(false);
    else if (sel) closeSheet();
  }
});

darkMq.addEventListener('change', () => {
  buildPalette();
  updateLegend();
  updateSheet();
  requestRender();
});

/* Live means re-render in place: Snuggery fires this when the app comes back
 * and when a Shortcut drops new data in while it is open. Only a file whose
 * text changed is parsed again; the view, year, unit and selection stay. */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadAll();
});

/* ── boot ────────────────────────────────────────────────────────────────── */

function resize() {
  const r = wrap.getBoundingClientRect();
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  const nd = Math.min(3, window.devicePixelRatio || 1);
  if (nd !== dpr) hatch = null;
  dpr = nd;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  if (!view.scale) fitFirst(); else clampView();
  render();
  if (sel && sel.kind === 'country') updateSheet();       // the sparkline follows the width
}

(function restore() {
  const u = store.get(STORE.units); if (UNITS[u]) units = u;
  const m = store.get(STORE.mode); if (MODES[m]) mode = m;
  showFields = store.get(STORE.fields) !== '0';
  showLabels = store.get(STORE.labels) !== '0';
  const st = store.get(STORE.status); if (st === 'all' || st === 'operating') statusFilter = st;
  try {
    const s = JSON.parse(store.get(STORE.sel) || 'null');
    if (s && ((s.kind === 'country' && isStr(s.iso3)) || (s.kind === 'field' && isStr(s.id)))) sel = s;
  } catch { /* fine */ }
  restoreView();
})();
setMode(mode);
setUnits(units);
new ResizeObserver(resize).observe(wrap);
resize();
loadAll();

/* For a browser console and for tests, never for the app itself. */
window.__wog = {
  render() { const t0 = performance.now(); render(); return performance.now() - t0; },
  get state() {
    return { mode, units, year, sel, showFields, statusFilter, playing, view: { ...view },
             countries: geo ? geo.countries.length : 0, series: prod ? prod.s.countries.length : 0,
             fields: fields ? { available: fields.available, points: fields.points.length } : null,
             problems: [...problems.values()].map((p) => p.file + p.msg) };
  },
  setYear, setMode, setUnits, loadAll, selectAt,
  project(lon, lat) { return [worldToScreenX(lonToX(lon)), worldToScreenY(latToY(lat))]; },
  decodePolyline,
  get bathy() { return geo && geo.bathy ? geo.bathy.map((b) => ({ depth: b.depth, points: b.points })) : null; },
};
