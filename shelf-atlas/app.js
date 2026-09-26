/* Shelf Atlas — Snuggery mini-app. The North Sea's oil and gas fields,
 * pipelines and platforms on one map, with a scrubber over every month of
 * production since January 1971.
 *
 * =============================================================================
 * DATA: two files in ./data, both written by scripts/shelf_atlas/build_north_sea.py
 * (the full contract is scripts/shelf_atlas/SCHEMA.md; this is the part the
 * app reads). Coordinates are WGS84 lon/lat. Lines and rings are Google
 * polylines, LON FIRST then lat, at the file's `factor` (10000 = 4 decimals).
 * Rings are closed. Month index mi = (year − 1971) × 12 + month − 1.
 *
 * ./data/geo.json — the basemap and every geometry (rebuilt weekly)
 * {
 *   "schema": 1, "generatedAt": "2026-09-26T18:00:00Z", "factor": 10000,
 *   "bbox": [-6, 50.5, 12, 63],                  // lon0, lat0, lon1, lat1
 *   "coast":    ["<polyline>", …],               // Natural Earth 1:10m coastline
 *   "land":     [["<ring>", …], …],              // one array of rings per polygon, outer first
 *   "bathy200": [["<ring>", …], …],              // the areas deeper than 200 m
 *   "borders":  [{ "name": "Norway - United Kingdom", "type": "Treaty", "a": "Norway",
 *                  "b": "United Kingdom", "lines": ["<polyline>", …] }, …],
 *   "fields":   [{ "id": "NO-43658", "rings": ["<ring>", …] }, …],   // absent = no outline
 *   "pipelines":[{ "id": "NO-P1", "country": "NO", "name": "Statpipe", "medium": "Gas",
 *                  "dimIn": 30, "phase": "In service", "from": "…", "to": "…", "km": 308,
 *                  "lines": ["<polyline>", …] }, …],
 *   "facilities":[{ "id": "NO-F271273", "country": "NO", "name": "STATFJORD A",
 *                  "kind": "CONCRETE STRUCTURE", "surface": true, "phase": "IN SERVICE",
 *                  "startYear": 1979, "endYear": null, "field": "STATFJORD",
 *                  "lon": 1.8532, "lat": 61.2545 }, …]    // surface:false = subsea
 * }
 *
 * ./data/snapshot.json — everything that changes with the monthly reports
 * {
 *   "schema": 1, "generatedAt": "…", "epochYear": 1971,
 *   "lastMonth": 668,                            // newest month index with any production
 *   "units": { "liq": "Sm³ per month: oil + condensate + NGL", "gas": "Sm³ per month",
 *              "oe": "1 Sm³ liquids = 1 Sm³ o.e.; 1000 Sm³ gas = 1 Sm³ o.e.",
 *              "bblPerSm3": 6.2898 },
 *   "sources": [{ "id", "name", "url", "licence", "attribution", "cadence" }, …],
 *   "countries": { "NO": "Norway", "UK": "United Kingdom", "DK": "Denmark", "NL": "Netherlands" },
 *   "fields": [{
 *     "id": "NO-43658", "country": "NO", "name": "STATFJORD", "hc": "OIL",
 *     "status": "Producing",                     // the source's current status, verbatim
 *     "statusHist": [[mi, "Producing"], …],      // optional: status from month mi on (Norway)
 *     "operator": "…", "discYear": 1974, "firstMonth": 106, "lastMonth": 668,
 *     "c": [1.85, 61.25],                        // centroid of the outline, or the source's point
 *     "group": "STATFJORD", "share": 85.47,      // optional: cross-border unit and this side's %
 *     "monthlyFrom": 564,                        // optional: before it, annual totals spread evenly
 *     "liq": { "start": 106, "scale": 61.2, "b64": "…" },   // Sm³ per month; absent = never
 *     "gas": { "start": 106, "scale": 3121.7, "b64": "…" },
 *     "peakLiq": …, "peakGas": …, "cumLiq": …, "cumGas": …
 *   }, …],
 *   "groups": [{ "id": "STATFJORD", "name": "Statfjord", "members": ["NO-43658", "UK-STATFJORD"],
 *                "note": "…" }, …],
 *   "matching": { "note": "…", "crossBorderCandidates": […], "excluded": […] },
 *   "ask": […]                                   // NEVER read by this app: it is for questions in words
 * }
 * A series is base64 of little-endian uint16: value[mi] = code[mi − start] × scale
 * for start ≤ mi < start + length, else 0.
 *
 * Both files are checked against this shape on every read. A file that is
 * missing, unparseable or the wrong shape is named on screen with what is
 * wrong; the map never draws a blank that could pass for data.
 *
 * -----------------------------------------------------------------------------
 * HOW IT STAYS FAST. Everything that does not depend on the month is decoded
 * once per data load: every outline becomes one Path2D in world units (Web
 * Mercator, degrees), every series one dense Float32Array. A month change fills
 * two typed arrays (value and state per field) and redraws; nothing is rebuilt.
 * The basemap and the pipelines are painted into an offscreen canvas that is
 * reused until the view moves, so scrubbing costs the fields, the circles, the
 * platforms and the labels only.
 *
 * NO VALUE EVER REACHES innerHTML: every piece of text is set with textContent.
 * Nothing is fetched but ./data/geo.json and ./data/snapshot.json.
 * ========================================================================== */
'use strict';

const STORE = {
  view: 'sa.view', month: 'sa.month', qty: 'sa.qty', sys: 'sa.units', cc: 'sa.countries',
  sel: 'sa.sel', speed: 'sa.speed', key: 'sa.key',
};
const EPOCH = 1971;
const DEG = Math.PI / 180;
const CC = ['NO', 'UK', 'DK', 'NL'];
const CC_ADJ = { NO: 'Norwegian', UK: 'UK', DK: 'Danish', NL: 'Dutch' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const MON3 = MONTHS.map((m) => m.slice(0, 3));
const BBL = 6.2898;             // barrels per Sm³ (also used for boe per Sm³ o.e.)
const SCF = 35.3147;            // standard cubic feet per Sm³
const Z_LABELS = 1.35;          // zoom (× the whole-sea view) at which field names appear
const Z_PIPES = 1.6;            // … pipelines
const Z_FACS = 3.2;             // … platforms and subsea structures
const Z_MIN = 0.7, Z_MAX = 400;
/* The home view is the North Sea proper, not the whole bbox: the bbox may
 * reach the Norwegian and Barents Seas, which stay a pan away. */
const HOME = [-4, 51, 10, 62];
const R_MAX = 17;               // CSS px radius of the circle for the largest rate on the scale
const DOMAIN_DECADES = 3.5;     // the colour scale covers this many powers of ten below the peak
const SPEEDS = [3, 6, 12, 24, 48];    // months per second
const STALE_DAYS = 10;          // the build runs weekly; older than this is stamped stale

const UNITS = {
  liq: { name: 'Liquids', si: { f: 1, rate: 'Sm³/d', vol: 'Sm³' }, field: { f: BBL, rate: 'bbl/d', vol: 'bbl' } },
  gas: { name: 'Gas', si: { f: 1, rate: 'Sm³/d', vol: 'Sm³' }, field: { f: SCF, rate: 'scf/d', vol: 'scf' } },
  oe: { name: 'Oil equivalent', si: { f: 1, rate: 'Sm³ o.e./d', vol: 'Sm³ o.e.' }, field: { f: BBL, rate: 'boe/d', vol: 'boe' } },
};

/* Production is one quantity, so one hue light→dark (dark→light on the dark
 * map, where brighter must still mean more). Orange, because the sea under it
 * is blue. The pipelines are categorical and borrow green/violet so the two
 * encodings never share a hue. Circle area carries the same number as colour. */
const THEMES = {
  light: {
    ramp: ['#fbe1c9', '#f5b183', '#eb6834', '#b8431a', '#6e2408'],
    bg: '#e3e7ec', sea: '#d6e4ef', bathy: '#c4d7e8', land: '#f7f5f0', coast: '#8d99a6',
    border: '#5d6878', idle: 'rgba(60,70,85,.55)', prodStroke: 'rgba(80,35,10,.55)',
    shutFill: 'rgba(150,157,168,.6)', shutStroke: 'rgba(90,98,110,.75)', ring: 'rgba(255,255,255,.95)',
    pipes: ['#008300', '#4a3aa7', '#7d8794'], fac: '#14181f', facStroke: '#f7f5f0', sub: '#4a5162',
    label: '#14181f', halo: 'rgba(247,245,240,.92)', sel: '#2f6df6', grid: '#dfe4ec', ink: '#14181f', dim: '#4a5162',
    // depth ramp for the bathymetry raster, keyed by its grey value (√depth): pale shallows to mid blue
    depth: [[1, '#e4eef6'], [40, '#d2e2ef'], [80, '#bcd2e6'], [150, '#9cbbd9'], [255, '#7ea2c7']],
  },
  dark: {
    ramp: ['#5e2a12', '#9a3e16', '#d95926', '#f49a60', '#ffdcbd'],
    bg: '#07090d', sea: '#0f1a26', bathy: '#0a121c', land: '#1c2129', coast: '#465363',
    border: '#8793a3', idle: 'rgba(170,182,198,.55)', prodStroke: 'rgba(255,220,190,.35)',
    shutFill: 'rgba(95,104,118,.65)', shutStroke: 'rgba(150,160,175,.75)', ring: 'rgba(8,12,18,.9)',
    pipes: ['#2fae4a', '#9085e9', '#8a95a3'], fac: '#e8ecf2', facStroke: '#0f1a26', sub: '#9aa6b5',
    label: '#e8ecf2', halo: 'rgba(12,17,24,.9)', sel: '#5b8eff', grid: '#262e39', ink: '#e8ecf2', dim: '#9aa6b5',
    depth: [[1, '#182a3d'], [40, '#132336'], [80, '#0e1c2d'], [150, '#0a1523'], [255, '#060d17']],
  },
};

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
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const monthYear = (mi) => EPOCH + Math.floor(mi / 12);
const monthLabel = (mi) => `${MONTHS[mi % 12]} ${monthYear(mi)}`;
const monthShort = (mi) => `${MON3[mi % 12]} ${monthYear(mi)}`;
function daysIn(mi) { return new Date(Date.UTC(monthYear(mi), (mi % 12) + 1, 0)).getUTCDate(); }

/* Names arrive in the regulators' capitals. Title-case words of letters. A
 * name that starts with a licence block (K15-FA, L10-CDA) stays as it is, as
 * do words with digits and one- and two-letter words (Ekofisk VB, Nuggets N4). */
function titleCase(s) {
  if (!s) return '';
  if (/^\S*\d/.test(s)) return String(s);
  return String(s).split(/(\s+|-|\/)/).map((w) => {
    if (w.length <= 2 || /\d/.test(w)) return w;
    if (/^[IVX]+$/.test(w)) return w;          // roman numerals: Brent II, Gyda III
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join('');
}
function sentenceCase(s) {
  if (!s) return '';
  const t = String(s).trim();
  if (t !== t.toUpperCase()) return t;         // already mixed case: keep the source's words
  return t.charAt(0) + t.slice(1).toLowerCase();
}
/* Status words differ by regulator ("Shut down", "Production Ceased",
 * "Post-Cop", "Abandoned"); this folds them into the few the map acts on.
 * Ceased is tested before producing: "Production ceased" contains both. */
function normStatus(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (/shut|abandon|ceased|decommission|removed|post-cop|\bcop\b/.test(t)) return 'Shut down';
  if (t.includes('suspend')) return 'Suspended';
  if (/undeveloped|apprai|shelved|approved|construction|development|fdp/.test(t)) return 'Not yet producing';
  if (t.startsWith('produc')) return 'Producing';
  return sentenceCase(s);
}
/* Hydrocarbon types arrive in three languages of abbreviation. */
const HC_WORDS = { OLIE: 'Oil', 'OLIE EN GAS': 'Oil and gas', COND: 'Condensate', GAS: 'Gas', OIL: 'Oil',
  'OIL/GAS': 'Oil and gas', 'GAS/CONDENSATE': 'Gas and condensate', 'OIL/CONDENSATE': 'Oil and condensate' };
function hcLabel(h) { return h ? HC_WORDS[String(h).toUpperCase()] || sentenceCase(h) : null; }
function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a');
}

/* 3 significant figures with k / M / bn: rates and map totals. */
function fmt3(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  let d = 1, s = '';
  if (a >= 1e9) { d = 1e9; s = 'bn'; } else if (a >= 1e6) { d = 1e6; s = 'M'; } else if (a >= 1e3) { d = 1e3; s = 'k'; }
  const x = v / d;
  const ax = Math.abs(x);
  let t;
  if (d === 1) t = ax >= 10 ? String(Math.round(x)) : ax >= 1 ? x.toFixed(1) : x.toFixed(2);
  else t = ax >= 100 ? String(Math.round(x)) : ax >= 10 ? x.toFixed(1) : x.toFixed(2);
  if (t.includes('.')) t = t.replace(/\.?0+$/, '');     // 1.00k reads as 1k
  return t + s;
}
/* Volumes in words, for cumulative totals: "720 million Sm³". */
function fmtVol(v) {
  const a = Math.abs(v);
  const words = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  for (const [d, w] of words) {
    if (a >= d) {
      const x = v / d;
      return `${x >= 100 ? Math.round(x) : x >= 10 ? x.toFixed(1) : x.toFixed(2)} ${w}`;
    }
  }
  return String(Math.round(v));
}

/* ── decoding ────────────────────────────────────────────────────────────── */

/* Web Mercator in degrees: X is longitude, Y is the Mercator ordinate with its
 * sign flipped so that screen = world × k + t with no mirror in between. */
const mercY = (lat) => -Math.log(Math.tan(Math.PI / 4 + (clamp(lat, -85, 85) * DEG) / 2)) / DEG;
const unmercY = (y) => (2 * Math.atan(Math.exp(-y * DEG)) - Math.PI / 2) / DEG;

/* Google's polyline algorithm, lon first, straight into world units. */
function decodeLine(str, factor, where) {
  if (typeof str !== 'string') throw new Error(`${where} is not a string`);
  const n = str.length;
  const out = new Float32Array(Math.ceil(n / 2) * 2);   // generous; trimmed below
  let i = 0, x = 0, y = 0, k = 0;
  while (i < n) {
    for (let c = 0; c < 2; c++) {
      let shift = 0, result = 0, b;
      do {
        if (i >= n) throw new Error(`${where} is a truncated polyline`);
        b = str.charCodeAt(i++) - 63;
        if (b < 0 || b > 63) throw new Error(`${where} has a character outside the polyline alphabet`);
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = (result & 1) ? ~(result >> 1) : (result >> 1);
      if (c === 0) x += d; else y += d;
    }
    out[k++] = x / factor;
    out[k++] = mercY(y / factor);
  }
  return out.subarray(0, k);
}

function decodeSeries(s, where) {
  let bin;
  try { bin = atob(s.b64); } catch { throw new Error(`${where}.b64 is not base64`); }
  if (bin.length % 2) throw new Error(`${where}.b64 holds an odd number of bytes`);
  const n = bin.length / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) * s.scale;
  return out;
}

/* ── shape checks: say which file and what is wrong ──────────────────────── */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);
const isStr = (v) => typeof v === 'string';

function validateGeo(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return 'it is not a JSON object';
  if (g.schema !== 1) return `schema is ${JSON.stringify(g.schema)}, this app reads schema 1`;
  if (!isStr(g.generatedAt) || Number.isNaN(Date.parse(g.generatedAt))) return 'generatedAt is missing or not a date';
  if (!isNum(g.factor) || g.factor <= 0) return 'factor is missing';
  if (!Array.isArray(g.bbox) || g.bbox.length !== 4 || !g.bbox.every(isNum) || g.bbox[0] >= g.bbox[2] || g.bbox[1] >= g.bbox[3]) return 'bbox is not [lon0, lat0, lon1, lat1]';
  for (const k of ['coast', 'land', 'bathy200', 'borders', 'fields', 'pipelines', 'facilities']) {
    if (!Array.isArray(g[k])) return `"${k}" is missing or not a list`;
  }
  if (!g.coast.length || !g.land.length) return 'the basemap is empty (no coast or land)';
  for (let i = 0; i < g.land.length; i++) if (!Array.isArray(g.land[i]) || !g.land[i].every(isStr)) return `land[${i}] is not a list of rings`;
  for (let i = 0; i < g.bathy200.length; i++) if (!Array.isArray(g.bathy200[i]) || !g.bathy200[i].every(isStr)) return `bathy200[${i}] is not a list of rings`;
  if (!g.coast.every(isStr)) return 'coast holds something that is not a polyline';
  for (let i = 0; i < g.borders.length; i++) {
    const b = g.borders[i];
    if (!b || !Array.isArray(b.lines) || !b.lines.every(isStr)) return `borders[${i}].lines is not a list of polylines`;
  }
  for (let i = 0; i < g.fields.length; i++) {
    const f = g.fields[i];
    if (!f || !isStr(f.id) || !Array.isArray(f.rings) || !f.rings.every(isStr)) return `fields[${i}] needs an id and a list of rings`;
  }
  for (let i = 0; i < g.pipelines.length; i++) {
    const p = g.pipelines[i];
    if (!p || !isStr(p.id) || !Array.isArray(p.lines) || !p.lines.every(isStr)) return `pipelines[${i}] needs an id and a list of lines`;
  }
  for (let i = 0; i < g.facilities.length; i++) {
    const f = g.facilities[i];
    if (!f || !isStr(f.id) || !isNum(f.lon) || !isNum(f.lat)) return `facilities[${i}] needs an id, lon and lat`;
  }
  return null;
}

function validateSnap(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'it is not a JSON object';
  if (s.schema !== 1) return `schema is ${JSON.stringify(s.schema)}, this app reads schema 1`;
  if (!isStr(s.generatedAt) || Number.isNaN(Date.parse(s.generatedAt))) return 'generatedAt is missing or not a date';
  if (s.epochYear !== EPOCH) return `epochYear is ${JSON.stringify(s.epochYear)}, expected ${EPOCH}`;
  if (!isInt(s.lastMonth) || s.lastMonth < 0 || s.lastMonth > 2400) return 'lastMonth is not a month index';
  if (!Array.isArray(s.fields)) return '"fields" is missing or not a list';
  if (!Array.isArray(s.sources)) return '"sources" is missing or not a list';
  if (s.groups != null && !Array.isArray(s.groups)) return '"groups" is not a list';
  const ids = new Set();
  for (let i = 0; i < s.fields.length; i++) {
    const f = s.fields[i];
    const at = `fields[${i}]`;
    if (!f || typeof f !== 'object') return `${at} is not an object`;
    if (!isStr(f.id)) return `${at}.id is missing`;
    if (ids.has(f.id)) return `${at}.id "${f.id}" appears twice`;
    ids.add(f.id);
    if (!CC.includes(f.country)) return `${at} (${f.id}) has country ${JSON.stringify(f.country)}, not one of ${CC.join('/')}`;
    if (!isStr(f.name)) return `${at} (${f.id}) has no name`;
    if (!Array.isArray(f.c) || f.c.length !== 2 || !f.c.every(isNum)) return `${at} (${f.id}).c is not [lon, lat]`;
    for (const q of ['liq', 'gas']) {
      const v = f[q];
      if (v == null) continue;
      if (!isInt(v.start) || v.start < 0 || !isNum(v.scale) || v.scale < 0 || !isStr(v.b64)) return `${at} (${f.id}).${q} needs start, scale and b64`;
    }
    if (f.statusHist != null && (!Array.isArray(f.statusHist) || !f.statusHist.every((h) => Array.isArray(h) && isInt(h[0]) && isStr(h[1])))) return `${at} (${f.id}).statusHist is not [[month, status], …]`;
  }
  for (let i = 0; i < (s.groups || []).length; i++) {
    const g = s.groups[i];
    if (!g || !isStr(g.id) || !Array.isArray(g.members)) return `groups[${i}] needs an id and members`;
    for (const m of g.members) if (!ids.has(m)) return `groups[${i}] (${g.id}) names member "${m}", which is not in fields`;
  }
  return null;
}

/* ── the model: decoded once per data load ───────────────────────────────── */

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
/* Twice the shoelace area in world units², for ranking and for choosing the
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
const PIPE_W = [0.7, 1.2, 1.9];           // CSS px at the zoom where pipelines appear
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
    const bucket = B.pipeBuckets[cci][mc][wc];
    lines.forEach((a) => addLine(bucket, a, false));
    return { raw: p, cc: CC[cci], mc, wc, lines, bbox: bboxOf(lines) };
  });
  const n = g.facilities.length;
  B.fac = { n, skipped: 0, X: new Float32Array(n), Y: new Float32Array(n), shape: new Uint8Array(n),
    cc: new Uint8Array(n), y0: new Int16Array(n), y1: new Int16Array(n), raw: g.facilities };
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

/* The optional bathymetry raster (geo.bathymetry): an 8-bit grey PNG beside
 * geo.json, 0 = land or no data, grey = 255 × √(depth / 3000 m). It is read
 * once per geo.json, kept as grey bytes, and tinted into a canvas once per
 * theme. Absent key or file: the map draws the 200 m polygons instead, and
 * says nothing, because the raster is decoration, not data. */
let bathy = null;
async function loadBathy(meta) {
  if (!meta || typeof meta !== 'object') { bathy = null; return; }
  const b = meta.bounds;
  if (!isStr(meta.file) || !/^[\w.-]+\.png$/i.test(meta.file) || !Array.isArray(b) || b.length !== 4 || !b.every(isNum)) {
    console.warn('geo.json bathymetry entry is not usable; drawing without it');
    bathy = null;
    return;
  }
  try {
    const r = await fetch(`./data/${meta.file}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    let src;
    if (window.createImageBitmap) src = await createImageBitmap(blob);
    else {
      src = new Image();
      const url = URL.createObjectURL(blob);
      await new Promise((ok, no) => { src.onload = ok; src.onerror = () => no(new Error('not a PNG')); src.src = url; });
      URL.revokeObjectURL(url);
    }
    const w = src.width, h = src.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.drawImage(src, 0, 0);
    const d = c.getImageData(0, 0, w, h).data;
    const grey = new Uint8Array(w * h);
    for (let i = 0; i < grey.length; i++) grey[i] = d[i * 4];
    bathy = { w, h, grey, tinted: {}, X0: b[0], X1: b[2], Y0: mercY(b[3]), Y1: mercY(b[1]) };
  } catch (e) {
    console.warn(`data/${meta.file} could not be drawn (${e.message}); drawing without it`);
    bathy = null;
  }
}
function bathyCanvas() {
  if (!bathy) return null;
  if (bathy.tinted[P.name]) return bathy.tinted[P.name];
  const stops = P.depth.map(([v, h]) => [v, parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
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
  for (let i = 0; i < px.length; i++) px[i] = lut[bathy.grey[i]];
  c.putImageData(img, 0, 0);
  bathy.tinted[P.name] = cv;
  return cv;
}

function monthly(F, q, m) {
  if (q === 'oe') return monthly(F, 'liq', m) + monthly(F, 'gas', m) / 1000;
  const a = q === 'liq' ? F.liq : F.gas;
  if (!a) return 0;
  const j = m - (q === 'liq' ? F.liqS : F.gasS);
  return j >= 0 && j < a.length ? a[j] : 0;
}

function buildModel(s, B) {
  const M = { lastMonth: s.lastMonth, fields: [], byId: new Map(), groups: [], groupById: new Map(),
    units: [], generatedAt: s.generatedAt, noOutline: 0, orphanOutlines: 0 };
  s.fields.forEach((r, i) => {
    const F = {
      i, raw: r, id: r.id, cc: r.country, name: titleCase(r.name), hc: r.hc,
      statusNorm: normStatus(r.status),
      hist: Array.isArray(r.statusHist) && r.statusHist.length
        ? r.statusHist.map((h) => [h[0], normStatus(h[1]), h[1]]).sort((a, b) => a[0] - b[0]) : null,
      disc: isInt(r.discYear) ? r.discYear : isInt(r.firstMonth) ? monthYear(r.firstMonth) : null,
      X: r.c[0], Y: mercY(r.c[1]), liq: null, liqS: 0, gas: null, gasS: 0, group: null, unit: -1,
    };
    if (r.liq) { F.liq = decodeSeries(r.liq, `fields[${i}] (${r.id}).liq`); F.liqS = r.liq.start; }
    if (r.gas) { F.gas = decodeSeries(r.gas, `fields[${i}] (${r.id}).gas`); F.gasS = r.gas.start; }
    const o = B.outlines.get(r.id);
    if (o) { F.path = o.path; F.rings = o.rings; F.bbox = o.bbox; F.area = o.area; } else {
      F.path = null; F.rings = null; F.bbox = [F.X, F.Y, F.X, F.Y]; F.area = 0; M.noOutline++;
    }
    F.first = F.liq || F.gas ? Math.min(F.liq ? F.liqS : 1e9, F.gas ? F.gasS : 1e9) : null;
    F.end = F.liq || F.gas ? Math.max(F.liq ? F.liqS + F.liq.length : 0, F.gas ? F.gasS + F.gas.length : 0) : null;
    M.fields.push(F);
    M.byId.set(F.id, F);
  });
  for (const id of B.outlines.keys()) if (!M.byId.has(id)) M.orphanOutlines++;
  // Each regulator reports on its own lag. The newest month that every
  // country with figures has reported is where the slider starts; later
  // months are marked as partial rather than shown as a collapse.
  M.ccLast = {};
  for (const F of M.fields) if (F.end != null) M.ccLast[F.cc] = Math.max(M.ccLast[F.cc] ?? -1, F.end - 1);
  M.ccFirst = {};
  for (const F of M.fields) if (F.first != null) M.ccFirst[F.cc] = Math.min(M.ccFirst[F.cc] ?? 1e9, F.first);
  const lasts = Object.values(M.ccLast);
  M.defaultMonth = lasts.length ? clamp(Math.min(...lasts), 0, s.lastMonth) : s.lastMonth;
  for (const g of s.groups || []) {
    const members = g.members.map((id) => M.byId.get(id));
    const G = { id: g.id, name: g.name || titleCase(g.id), note: g.note, members };
    members.forEach((F) => { F.group = G; });
    M.groups.push(G);
    M.groupById.set(G.id, G);
  }
  // A unit is what gets one circle and one label: a field, or a whole
  // cross-border group, so a shared field is never counted twice.
  for (const F of M.fields) {
    if (F.group) continue;
    F.unit = M.units.length;
    M.units.push({ kind: 'field', f: F, members: [F], X: F.X, Y: F.Y, name: F.name });
  }
  for (const G of M.groups) {
    // The circle goes at the area-weighted middle of the members' outlines.
    let sx = 0, sy = 0, sw = 0;
    for (const F of G.members) { const w = F.area || 1e-9; sx += F.X * w; sy += F.Y * w; sw += w; }
    G.unit = M.units.length;
    G.members.forEach((F) => { F.unit = G.unit; });
    M.units.push({ kind: 'group', g: G, members: G.members, X: sx / sw, Y: sy / sw, name: G.name });
  }
  // Colour and circle domains: the largest daily rate any unit reached, taken
  // as each unit's SECOND-highest month so that a single mis-keyed month in a
  // source (they exist) cannot squash the whole scale. Above it colours and
  // circles saturate.
  M.hi = { liq: 0, gas: 0, oe: 0 };
  for (const U of M.units) {
    let m0 = Infinity, m1 = -Infinity;
    for (const F of U.members) if (F.first != null) { m0 = Math.min(m0, F.first); m1 = Math.max(m1, F.end); }
    const top = { liq: [0, 0], gas: [0, 0], oe: [0, 0] };
    const push = (t, v) => { if (v > t[0]) { t[1] = t[0]; t[0] = v; } else if (v > t[1]) t[1] = v; };
    for (let m = m0; m < m1; m++) {
      const d = daysIn(m);
      let l = 0, gg = 0;
      for (const F of U.members) { l += monthly(F, 'liq', m); gg += monthly(F, 'gas', m); }
      l /= d; gg /= d;
      push(top.liq, l); push(top.gas, gg); push(top.oe, l + gg / 1000);
    }
    for (const q of ['liq', 'gas', 'oe']) if (top[q][1] > M.hi[q]) M.hi[q] = top[q][1];
    U.peak = top.oe[1];
    U.area = U.members.reduce((a, F) => a + F.area, 0);
  }
  // Labels are placed biggest first: the fields that made the North Sea.
  M.rank = M.units.map((_, i) => i).sort((a, b) => (M.units[b].peak - M.units[a].peak) || (M.units[b].area - M.units[a].area));
  M.searchIndex = M.units.map((U, u) => ({ u, key: fold(U.name), cc: [...new Set(U.members.map((F) => F.cc))] }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return M;
}

/* ── state ───────────────────────────────────────────────────────────────── */

const canvas = $('map');
const ctx = canvas.getContext('2d');
const wrap = $('map-wrap');
const slider = $('slider');
const darkMq = window.matchMedia('(prefers-color-scheme: dark)');

let base = null;            // geometry, from geo.json
let model = null;           // fields and series, from snapshot.json
let snap = null;            // the raw snapshot, for sources and notes
let P = null;               // the current theme's paint
let W = 1, H = 1, dpr = 1;
const view = { k: 1, tx: 0, ty: 0 };
let fitK = 1;
let month = 0;
let qty = 'liq';
let sys = 'si';
const ccOn = { NO: true, UK: true, DK: true, NL: true };
let sel = null;             // { type: 'unit'|'fac'|'pipe'|'border', … }
let playing = false;
let speedIdx = 2;
let problems = new Map();
let fieldVal = new Float32Array(0), fieldState = new Uint8Array(0), fieldCol = new Uint8Array(0);
let unitVal = new Float32Array(0), unitVis = new Uint8Array(0), unitCol = new Uint8Array(0);
let unitOrder = [];         // producing units, largest first, so small circles land on top
let monthTotal = 0, monthCount = 0;

function buildPalette() {
  const T = darkMq.matches ? THEMES.dark : THEMES.light;
  const stops = T.ramp.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const lut = [];
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1);
    const j = Math.min(stops.length - 2, Math.floor(t)), f = t - j;
    const c = [0, 1, 2].map((k) => Math.round(stops[j][k] + (stops[j + 1][k] - stops[j][k]) * f));
    lut.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
  P = { ...T, name: darkMq.matches ? 'dark' : 'light', lut };
}

/* ── the month ───────────────────────────────────────────────────────────── */

function domain() {
  const hi = model ? model.hi[qty] : 0;
  return hi > 0 ? { lo: hi / Math.pow(10, DOMAIN_DECADES), hi } : { lo: 1, hi: 10 };
}
function isShut(F, m) {
  if (F.hist) {
    let s = null;
    for (const h of F.hist) { if (h[0] <= m) s = h[1]; else break; }
    return s === 'Shut down';
  }
  return F.statusNorm === 'Shut down' && isInt(F.raw.lastMonth) && m > F.raw.lastMonth;
}
function statusAt(F, m) {
  if (!F.hist) return null;
  let s = null;
  for (const h of F.hist) { if (h[0] <= m) s = h; else break; }
  return s;
}

function computeMonth() {
  if (!model) return;
  const nf = model.fields.length, nu = model.units.length;
  if (fieldVal.length !== nf) {
    fieldVal = new Float32Array(nf); fieldState = new Uint8Array(nf); fieldCol = new Uint8Array(nf);
  }
  if (unitVal.length !== nu) { unitVal = new Float32Array(nu); unitVis = new Uint8Array(nu); unitCol = new Uint8Array(nu); }
  const m = month, y = monthYear(m), dd = daysIn(m);
  const D = domain(), L0 = Math.log10(D.lo), span = Math.log10(D.hi) - L0;
  const col = (v) => (v > 0 ? Math.round(clamp((Math.log10(v) - L0) / span, 0, 1) * 255) : 0);
  monthTotal = 0; monthCount = 0;
  for (let i = 0; i < nf; i++) {
    const F = model.fields[i];
    let st = 0, v = 0;
    if (ccOn[F.cc]) {
      const l = monthly(F, 'liq', m), g = monthly(F, 'gas', m);
      v = (qty === 'liq' ? l : qty === 'gas' ? g : l + g / 1000) / dd;
      // Hidden until discovered — unless the source reports production
      // before its own discovery year, in which case the numbers win.
      if (l <= 0 && g <= 0 && F.disc != null && F.disc > y) st = 0;
      else if (v > 0) st = 3;
      else st = isShut(F, m) ? 2 : 1;
    }
    if (st !== 3) v = 0;
    fieldVal[i] = v; fieldState[i] = st; fieldCol[i] = col(v);
    if (v > 0) { monthTotal += v; monthCount++; }
  }
  unitOrder = [];
  for (let u = 0; u < nu; u++) {
    const U = model.units[u];
    let v = 0, vis = 0;
    for (const F of U.members) { v += fieldVal[F.i]; vis = Math.max(vis, fieldState[F.i]); }
    unitVal[u] = v; unitVis[u] = vis; unitCol[u] = col(v);
    if (v > 0) unitOrder.push(u);
  }
  unitOrder.sort((a, b) => unitVal[b] - unitVal[a]);
}

/* ── view: Web Mercator, k CSS px per degree, t the screen offset ────────── */

let kMin = 0.5;
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
function zoomRel() { return view.k / fitK; }
function centerOn(X, Y, k) {
  view.k = k;
  view.tx = W / 2 - X * k;
  view.ty = H / 2 - Y * k;
}
function home() {
  if (!base) return;
  const h = homeBox();
  centerOn((h[0] + h[2]) / 2, (h[1] + h[3]) / 2, fitK);
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
  const X = (sx - view.tx) / view.k, Y = (sy - view.ty) / view.k;
  const k = clamp(view.k * f, kMin, fitK * Z_MAX);
  view.k = k;
  view.tx = sx - X * k;
  view.ty = sy - Y * k;
  clampView();
}
function viewBounds(marginPx) {
  const m = (marginPx || 0) / view.k;
  return [-view.tx / view.k - m, -view.ty / view.k - m, (W - view.tx) / view.k + m, (H - view.ty) / view.k + m];
}
const inView = (b, v) => b[2] >= v[0] && b[0] <= v[2] && b[3] >= v[1] && b[1] <= v[3];

/* Fly-to: zoom in log space, centre linearly, 550 ms. The target leaves room
 * for the bottom sheet, so the field lands in the part of the map still seen. */
let fly = null;
function flyTo(bbox, maxZ) {
  if (!base) return;
  const sheetH = $('sheet').hidden ? 0 : Math.min(H * 0.55, $('sheet').getBoundingClientRect().height || H * 0.5);
  const availH = Math.max(80, H - sheetH - 20);
  const bw = Math.max(bbox[2] - bbox[0], 1e-4), bh = Math.max(bbox[3] - bbox[1], 1e-4);
  let k = Math.min((W - 80) / bw, (availH - 60) / bh);
  k = clamp(k, fitK * 1.2, fitK * (maxZ || 60));
  const X = (bbox[0] + bbox[2]) / 2, Y = (bbox[1] + bbox[3]) / 2;
  // centre of the visible part: shift the target down by half the sheet
  const Yc = Y + (sheetH / 2) / k;
  fly = { t0: performance.now(), from: { x: (W / 2 - view.tx) / view.k, y: (H / 2 - view.ty) / view.k, k: view.k },
    to: { x: X, y: Yc, k } };
  requestRender();
}
function tickFly(now) {
  if (!fly) return;
  const u = Math.min(1, (now - fly.t0) / 550);
  const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const k = Math.exp(Math.log(fly.from.k) + (Math.log(fly.to.k) - Math.log(fly.from.k)) * e);
  centerOn(fly.from.x + (fly.to.x - fly.from.x) * e, fly.from.y + (fly.to.y - fly.from.y) * e, k);
  if (u >= 1) { fly = null; clampView(); saveView(); }
}

/* ── drawing ─────────────────────────────────────────────────────────────── */

let rafId = 0;
let gesture = null;
function requestRender() { if (!rafId) rafId = requestAnimationFrame(frame); }
function frame(now) {
  rafId = 0;
  tickPlay(now);
  tickFly(now);
  render();
  if (playing || fly) requestRender();
}

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const pipesOn = () => zoomRel() >= Z_PIPES;
const facsOn = () => zoomRel() >= Z_FACS;
const worldTf = (c) => c.setTransform(dpr * view.k, 0, 0, dpr * view.k, dpr * view.tx, dpr * view.ty);
const screenTf = (c) => c.setTransform(dpr, 0, 0, dpr, 0, 0);

/* The basemap and the pipelines do not change with the month, so they are
 * painted once per view into an offscreen canvas and blitted while scrubbing.
 * During a pan or pinch the view changes every frame anyway, so they are drawn
 * straight onto the map instead of twice. */
let cache = null;
function staticKey() {
  return [view.k, view.tx, view.ty, W, H, dpr, P.name, pipesOn(), CC.map((c) => (ccOn[c] ? 1 : 0)).join('')].join('|');
}
function drawStatic(c) {
  const k = view.k;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = P.bg;
  c.fillRect(0, 0, canvas.width, canvas.height);
  worldTf(c);
  c.fillStyle = P.sea;
  c.fillRect(base.X0, base.Y0, base.X1 - base.X0, base.Y1 - base.Y0);
  const bc = bathyCanvas();
  if (bc) {
    // Rows are already uniform in Mercator y, so one stretch places it.
    c.imageSmoothingEnabled = true;
    // (the 200 m polygons are not outlined over it: Natural Earth splits
    // them at tile seams, and those seams would show as straight lines)
    c.drawImage(bc, bathy.X0, bathy.Y0, bathy.X1 - bathy.X0, bathy.Y1 - bathy.Y0);
  } else {
    c.fillStyle = P.bathy;
    c.fill(base.bathy, 'evenodd');
  }
  c.fillStyle = P.land;
  c.fill(base.land, 'evenodd');
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = P.coast;
  c.lineWidth = 0.8 / k;
  c.stroke(base.coast);
  c.strokeStyle = P.border;
  c.lineWidth = 1.2 / k;
  c.setLineDash([5 / k, 4 / k]);
  c.stroke(base.borderPath);
  c.setLineDash([]);
  if (pipesOn()) {
    const grow = clamp(Math.sqrt(zoomRel() / Z_PIPES), 1, 1.8);
    c.globalAlpha = 0.75;
    for (let ci = 0; ci < CC.length; ci++) {
      if (!ccOn[CC[ci]]) continue;
      for (let mc = 2; mc >= 0; mc--) {
        c.strokeStyle = P.pipes[mc];
        for (let wc = 0; wc < 3; wc++) {
          c.lineWidth = (PIPE_W[wc] * grow) / k;
          c.stroke(base.pipeBuckets[ci][mc][wc]);
        }
      }
    }
    c.globalAlpha = 1;
  }
}

/* While a finger is on the map, the last full frame is moved and scaled as
 * a picture instead of being redrawn: pan and pinch stay at display rate
 * however many outlines there are, and the map is drawn crisp again the
 * moment the gesture ends. */
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
  if (!P) buildPalette();
  if (!base) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.bg;
    c.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  if (gesture && snapFrame && snapFrame.view && snapFrame.P === P.name) {
    const v0 = snapFrame.view, sc = view.k / v0.k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.bg;
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
    if (facsOn()) drawFacilities(c);
    if (zoomRel() >= Z_LABELS) drawLabels(c);
  }
  drawSelection(c);
}

/* Fills change every month and are cheap; outline strokes are what costs
 * (stroking is several times the price of filling), and they barely change:
 * a field's outline is drawn from its discovery on, whatever it produces. So
 * the strokes live in their own offscreen layer, rebuilt when the view moves
 * and otherwise only added to as fields are discovered. Scrubbing backwards
 * past a discovery rebuilds it once. */
function drawFields(c) {
  const vb = viewBounds(2);
  worldTf(c);
  const fs = model.fields;
  for (let i = 0; i < fs.length; i++) {
    const st = fieldState[i];
    if (st < 2) continue;
    const F = fs[i];
    if (!F.path || !inView(F.bbox, vb)) continue;
    if (st === 3) {
      c.globalAlpha = 0.85;
      c.fillStyle = P.lut[fieldCol[i]];
    } else {
      c.globalAlpha = 1;
      c.fillStyle = P.shutFill;
    }
    c.fill(F.path, 'evenodd');
  }
  c.globalAlpha = 1;
}
let ol = null;
function outlineLayer() {
  const key = [view.k, view.tx, view.ty, W, H, dpr, P.name].join('|');
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
  worldTf(c);
  c.lineJoin = 'round';
  c.lineWidth = 0.8 / view.k;
  c.strokeStyle = P.idle;
  const vb = viewBounds(2);
  for (let i = 0; i < n; i++) {
    if (!fieldState[i] || ol.vis[i]) continue;
    ol.vis[i] = 1;
    const F = model.fields[i];
    if (F.path && inView(F.bbox, vb)) c.stroke(F.path);
  }
  ol.key = key;
  return ol.canvas;
}

function circleR(v, hi) { return v > 0 ? Math.max(1.6, R_MAX * Math.sqrt(Math.min(1, v / hi))) : 0; }

function drawCircles(c) {
  screenTf(c);
  const hi = domain().hi, U = model.units;
  // Fields with no outline still exist when they are not producing: a small
  // hollow dot, so a tap can find them and the map does not pretend they are not there.
  c.lineWidth = 1;
  for (let u = 0; u < U.length; u++) {
    if (unitVal[u] > 0 || !unitVis[u] || U[u].members.some((F) => F.path)) continue;
    const sx = U[u].X * view.k + view.tx, sy = U[u].Y * view.k + view.ty;
    if (sx < -5 || sy < -5 || sx > W + 5 || sy > H + 5) continue;
    c.beginPath();
    c.arc(sx, sy, 2.6, 0, Math.PI * 2);
    if (unitVis[u] === 2) { c.fillStyle = P.shutFill; c.fill(); c.strokeStyle = P.shutStroke; } else c.strokeStyle = P.idle;
    c.stroke();
  }
  c.lineWidth = 1.2;
  c.strokeStyle = P.ring;
  for (const u of unitOrder) {
    const r = circleR(unitVal[u], hi);
    const sx = U[u].X * view.k + view.tx, sy = U[u].Y * view.k + view.ty;
    if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
    c.beginPath();
    c.arc(sx, sy, r, 0, Math.PI * 2);
    c.globalAlpha = 0.82;
    c.fillStyle = P.lut[unitCol[u]];
    c.fill();
    c.globalAlpha = 1;
    c.stroke();
  }
}

function facilityVisible(i, y) {
  const fa = base.fac;
  return ccOn[CC[fa.cc[i]]] && y >= fa.y0[i] && y <= fa.y1[i];
}
function drawFacilities(c) {
  screenTf(c);
  const fa = base.fac, y = monthYear(month);
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
  c.strokeStyle = P.facStroke;
  c.lineWidth = 0.8;
  c.stroke(sq); c.fill(sq);
  c.stroke(tri); c.fill(tri);
}

/* Labels: biggest fields first, each placed only where it collides with no
 * label already placed. Width is measured once per name and remembered. */
function drawLabels(c) {
  screenTf(c);
  c.font = `600 11px ${FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.lineJoin = 'round';
  c.lineWidth = 3;
  c.strokeStyle = P.halo;
  c.fillStyle = P.label;
  const hi = domain().hi, U = model.units, placed = [];
  const maxLabels = Math.round(clamp(W * H / 2600, 20, 160));
  for (const u of model.rank) {
    if (!unitVis[u]) continue;
    const Un = U[u];
    const sx = Un.X * view.k + view.tx, sy = Un.Y * view.k + view.ty;
    if (sx < -40 || sy < -20 || sx > W + 40 || sy > H + 20) continue;
    if (Un.lw == null) Un.lw = c.measureText(Un.name).width;
    const r = circleR(unitVal[u], hi);
    const y0 = sy + Math.max(r, 3) + 2;
    const x0 = sx - Un.lw / 2 - 2, x1 = sx + Un.lw / 2 + 2, y1 = y0 + 13;
    if (x0 < 2 || x1 > W - 2 || y1 > H - 2) continue;
    let hit = false;
    for (let j = 0; j < placed.length; j += 4) {
      if (x0 < placed[j + 2] && x1 > placed[j] && y0 < placed[j + 3] && y1 > placed[j + 1]) { hit = true; break; }
    }
    if (hit) continue;
    placed.push(x0, y0, x1, y1);
    c.strokeText(Un.name, sx, y0);
    c.fillText(Un.name, sx, y0);
    if (placed.length / 4 >= maxLabels) break;
  }
}

function drawSelection(c) {
  if (!sel || !base) return;
  const k = view.k;
  c.strokeStyle = P.sel;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (sel.type === 'unit' && model) {
    const U = model.units[sel.u];
    if (!U) return;
    worldTf(c);
    c.lineWidth = 2.6 / k;
    for (const F of U.members) if (F.path) c.stroke(F.path);
    screenTf(c);
    const sx = U.X * k + view.tx, sy = U.Y * k + view.ty;
    const r = circleR(unitVal[sel.u], domain().hi);
    c.lineWidth = 2;
    c.beginPath();
    c.arc(sx, sy, Math.max(r, 3) + 3, 0, Math.PI * 2);
    c.stroke();
  } else if (sel.type === 'fac') {
    screenTf(c);
    const sx = base.fac.X[sel.i] * k + view.tx, sy = base.fac.Y[sel.i] * k + view.ty;
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(sx, sy, 9, 0, Math.PI * 2);
    c.stroke();
  } else if (sel.type === 'pipe' || sel.type === 'border') {
    const lines = sel.type === 'pipe' ? base.pipes[sel.i].lines : base.borders[sel.i].lines;
    worldTf(c);
    c.lineWidth = 3.2 / k;
    c.globalAlpha = 0.85;
    for (const a of lines) {
      c.beginPath();
      c.moveTo(a[0], a[1]);
      for (let j = 2; j < a.length; j += 2) c.lineTo(a[j], a[j + 1]);
      c.stroke();
    }
    c.globalAlpha = 1;
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
function nearestPipe(sx, sy, tol) {
  let best = null, bd = tol;
  base.pipes.forEach((p, i) => {
    if (!ccOn[p.cc]) return;
    const d = distToLines(p.lines, p.bbox, sx, sy, tol);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function hitTest(sx, sy) {
  if (!base) return null;
  const k = view.k, X = (sx - view.tx) / k, Y = (sy - view.ty) / k;
  if (model && facsOn()) {
    const fa = base.fac, y = monthYear(month);
    let best = -1, bd = 13;
    for (let i = 0; i < fa.n; i++) {
      if (!facilityVisible(i, y)) continue;
      const d = Math.hypot(fa.X[i] * k + view.tx - sx, fa.Y[i] * k + view.ty - sy);
      if (d < bd) { bd = d; best = i; }
    }
    if (best >= 0) return { type: 'fac', i: best };
  }
  // Fields come before pipelines: pipelines converge on the platforms inside
  // fields, and a tap there means the field. A pipeline is picked along its
  // run between fields, which is most of its length.
  if (model) {
    // circles first, smallest on top; then outlines, smallest area wins
    const hi = domain().hi, U = model.units;
    let bu = -1, br = Infinity;
    for (let u = 0; u < U.length; u++) {
      if (!unitVis[u]) continue;
      const r = unitVal[u] > 0 ? circleR(unitVal[u], hi) : U[u].members.some((F) => F.path) ? 0 : 3;
      if (!r) continue;
      const d = Math.hypot(U[u].X * k + view.tx - sx, U[u].Y * k + view.ty - sy);
      if (d <= Math.max(r + 3, 9) && r < br) { br = r; bu = u; }
    }
    if (bu >= 0) return { type: 'unit', u: bu };
    let bf = null;
    for (const F of model.fields) {
      if (!fieldState[F.i] || !F.rings) continue;
      const b = F.bbox;
      if (X < b[0] || X > b[2] || Y < b[1] || Y > b[3]) continue;
      if (pointInRings(F.rings, X, Y) && (!bf || F.area < bf.area)) bf = F;
    }
    if (bf) return { type: 'unit', u: bf.unit };
  }
  if (pipesOn()) {
    const p = nearestPipe(sx, sy, 12);
    if (p != null) return { type: 'pipe', i: p };
  }
  let bb = -1, bd = 12;
  base.borders.forEach((b, i) => {
    const d = distToLines(b.lines, b.bbox, sx, sy, bd);
    if (d < bd) { bd = d; bb = i; }
  });
  if (bb >= 0) return { type: 'border', i: bb };
  return null;
}

/* ── units, legend, stamp, credits ───────────────────────────────────────── */

const U_ = (q) => UNITS[q || qty][sys];
function setProblem(key, msg) {
  if (msg) problems.set(key, msg); else problems.delete(key);
  const box = $('error');
  box.textContent = '';
  for (const m of problems.values()) box.append(el('div', null, m));
  box.hidden = !problems.size;
}

function updateLegend() {
  // no production figures, no colour scale: a legend over an empty map would
  // read as "everything is zero"
  $('legend').hidden = !(model && model.fields.length);
  $('legend-q').textContent = UNITS[qty].name;
  $('legend-unit').textContent = U_().rate;
  $('btn-units').textContent = U_().rate;
  $('btn-units').setAttribute('aria-label', `Units: ${U_().rate}. Switch to ${UNITS[qty][sys === 'si' ? 'field' : 'si'].rate}`);
  const ramp = P.ramp;
  $('legend-bar').style.background = `linear-gradient(to right, ${ramp.map((c, i) => `${c} ${Math.round((i / (ramp.length - 1)) * 100)}%`).join(', ')})`;
  const box = $('legend-ticks');
  box.textContent = '';
  const D = domain(), f = U_().f;
  const L0 = Math.log10(D.lo), span = Math.log10(D.hi) - L0;
  const ticks = [];
  for (let e = Math.ceil(Math.log10(D.lo * f)); e <= Math.floor(Math.log10(D.hi * f)); e++) ticks.push(Math.pow(10, e));
  // Keep the two end labels; add decade ticks only where they clear their
  // neighbours by a label's width, measured on the bar as drawn.
  const bw = Math.max(120, ($('legend-bar').clientWidth || 190));
  const first = ['≤' + fmt3(D.lo * f), 0], last = [fmt3(D.hi * f) + '+', 1];
  const labels = [first];
  const room = (t) => 3.4 * Math.max(3, t.length) + 4;     // half-width guess in px at 10 px type
  let edge = room(first[0]) * 2;
  const endEdge = bw - room(last[0]) * 2;
  for (const v of ticks) {
    const t = fmt3(v), p = (Math.log10(v / f) - L0) / span, x = p * bw;
    if (x - room(t) > edge && x + room(t) < endEdge) { labels.push([t, p]); edge = x + room(t); }
  }
  labels.push(last);
  for (const [t, p] of labels) {
    const s = el('span', null, t);
    s.style.left = `${(p * 100).toFixed(1)}%`;
    box.append(s);
  }
  $('legend').setAttribute('aria-label', `Map key: ${UNITS[qty].name} in ${U_().rate}, from ${labels[0][0]} to ${labels[labels.length - 1][0]}; circle area is the rate. Tap for more.`);
}

function updateStamp() {
  const st = $('stamp');
  const gen = model ? model.generatedAt : base ? base.generatedAt : null;
  if (!gen) { st.textContent = problems.size ? 'No data' : 'Loading…'; st.className = 'stamp stale'; return; }
  const d = new Date(gen);
  const age = (Date.now() - d.getTime()) / 864e5;
  const pad = (n) => String(n).padStart(2, '0');
  let t = `Updated ${d.getDate()} ${MON3[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (model && model.fields.length) t = `Data to ${monthShort(model.lastMonth)} · ${t}`;
  else t = `Map only, no production · ${t}`;
  const stale = age > STALE_DAYS;
  st.textContent = stale ? `Stale · ${t}` : t;
  st.className = 'stamp' + (stale ? ' stale' : '');
}

const SHORT = { naturalearth: 'Natural Earth', marineregions: 'Marine Regions', emodnet: 'EMODnet',
  'emodnet-bathymetry': 'EMODnet', sodir: 'Sodir', nsta: 'NSTA', dea: 'Danish Energy Agency', nlog: 'NLOG' };
function shortSource(s) {
  const lic = String(s.licence || '').match(/CC BY(?:-SA)?|NLOD|OGL/);
  if (SHORT[s.id]) return lic ? `${SHORT[s.id]} ${lic[0]}` : SHORT[s.id];
  let name = String(s.name || s.id || '').split(' — ')[0];
  const par = name.match(/\(([^)]{2,8})\)/);
  name = par ? par[1] : name.replace(/\s*\(.*\)$/, '');
  const full = String(s.licence || '').match(/CC BY(?:-SA)? [\d.]+|NLOD [\d.]+|OGL/);
  return full ? `${name} (${full[0]})` : name;
}
function allSources() {
  const list = snap && Array.isArray(snap.sources) ? snap.sources.slice() : [];
  const have = new Set(list.map((s) => s.id));
  // The basemap is credited whether or not the snapshot lists it.
  if (!have.has('naturalearth')) list.unshift({ id: 'naturalearth', name: 'Natural Earth 1:10m — coastline, countries, bathymetry', url: 'https://www.naturalearthdata.com/', licence: 'Public domain', attribution: 'Basemap: Natural Earth' });
  if (!have.has('marineregions')) list.splice(1, 0, { id: 'marineregions', name: 'Marine Regions — Maritime Boundaries (Flanders Marine Institute)', url: 'https://www.marineregions.org/', licence: 'CC BY 4.0', attribution: 'Maritime boundaries: Flanders Marine Institute, marineregions.org (CC BY 4.0)' });
  return list;
}
function updateCredits() {
  // EMODnet appears twice when both its pipelines and its bathymetry are used
  $('credits').textContent = [...new Set(allSources().map(shortSource))].join(' · ');
}

function showAbout() {
  const b = $('about-body');
  b.textContent = '';
  const p = (t) => b.append(el('p', null, t));
  p('Oil and gas fields of the Norwegian, UK, Danish and Dutch shelves, coloured and sized by what they produced in the month on the slider. Rates are the month\'s volume divided by its days.');
  if (base) p(`Map geometry (data/geo.json) built ${new Date(base.generatedAt).toLocaleString()}.`);
  if (model) p(`Production (data/snapshot.json) built ${new Date(model.generatedAt).toLocaleString()}, reaching ${monthLabel(model.lastMonth)}.`);
  b.append(el('h3', null, 'Sources'));
  for (const s of allSources()) {
    const d = el('div', 'src');
    d.append(el('b', null, s.name || s.id));
    if (s.licence) d.append(el('span', null, `Licence: ${s.licence}`));
    if (s.attribution) d.append(el('span', null, s.attribution));
    if (s.url) d.append(el('span', null, s.url));
    if (s.cadence) d.append(el('span', null, `Updated: ${s.cadence}`));
    b.append(d);
  }
  if (model) {
    b.append(el('h3', null, 'Notes on the numbers'));
    const spread = new Map();
    for (const F of model.fields) if (isInt(F.raw.monthlyFrom)) {
      const e = spread.get(F.cc) || { n: 0, from: F.raw.monthlyFrom };
      e.n++; e.from = Math.min(e.from, F.raw.monthlyFrom);
      spread.set(F.cc, e);
    }
    for (const [cc, e] of spread) {
      p(`${(snap.countries && snap.countries[cc]) || cc}: annual figures spread evenly over the months before ${monthLabel(e.from)} (${e.n} field${e.n === 1 ? '' : 's'}). Month-to-month changes before then are not real.`);
    }
    const starts = CC.filter((c) => model.ccFirst[c] != null).map((c) => `${c} from ${monthLabel(model.ccFirst[c])} to ${monthLabel(model.ccLast[c])}`);
    if (starts.length) p(`Monthly figures cover ${starts.join('; ')}. Outside those months a country's fields are drawn as outlines without a value, and the line under the map says why.`);
    if (model.groups.length) {
      p(`Cross-border units, each side reported by its own regulator and drawn with its own share (never counted twice): ${model.groups.map((G) => `${G.name} (${G.members.map((F) => F.cc + (isNum(F.raw.share) ? ' ' + F.raw.share + '%' : '')).join(', ')})`).join('; ')}.`);
    }
    const m = snap.matching || {};
    if (Array.isArray(m.crossBorderCandidates) && m.crossBorderCandidates.length) {
      p(`Same name on both sides of a border but not confirmed as one field, so shown separately: ${m.crossBorderCandidates.map((c) => titleCase(c.name)).join(', ')}.`);
    }
    const withSeries = model.fields.filter((F) => F.liq || F.gas).length;
    p(`${model.fields.length} fields (${withSeries} with production figures, ${model.noOutline} without an outline, drawn as a circle or dot), ${base ? base.counts.facilities : 0} installations${base && base.fac.skipped ? ` (${base.fac.skipped} wind turbines and geothermal plants among them are not drawn)` : ''}, ${base ? base.counts.pipelines : 0} pipelines, ${base ? base.counts.borders : 0} maritime boundary lines.`);
  }
  p('Conversions: 1 Sm³ = 6.2898 bbl; 1 Sm³ of gas = 35.3147 scf; oil equivalent counts 1 Sm³ of liquids or 1000 Sm³ of gas as 1 Sm³ o.e. (6.2898 boe).');
  p('The map re-reads data/geo.json and data/snapshot.json every time it is opened and whenever new data lands while it is open. The app itself never goes online.');
  $('about').hidden = false;
  $('about-close').focus();
}

/* ── the month player ────────────────────────────────────────────────────── */

let playAcc = 0, lastTick = 0;
function tickPlay(now) {
  if (!playing || !model) { lastTick = 0; return; }
  if (!lastTick) lastTick = now;
  const dt = Math.min(0.1, (now - lastTick) / 1000);
  lastTick = now;
  playAcc += dt * SPEEDS[speedIdx];
  if (playAcc >= 1) {
    const n = Math.floor(playAcc);
    playAcc -= n;
    if (month + n >= model.lastMonth) { setMonth(model.lastMonth); setPlaying(false); } else setMonth(month + n, true);
  }
}
function setPlaying(on) {
  if (on && !model) return;
  playing = on;
  if (on && month >= model.lastMonth) setMonth(0);
  $('ico-play').hidden = on;
  $('ico-pause').hidden = !on;
  $('btn-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  playAcc = 0;
  lastTick = 0;
  if (!on) store(STORE.month, String(month));
  requestRender();
}
function setMonth(m, fromPlay) {
  if (!model) return;
  month = clamp(Math.round(m), 0, model.lastMonth);
  computeMonth();
  updateTimeUI();
  if (sheetDyn) sheetDyn();
  if (!fromPlay) store(STORE.month, String(month));
  requestRender();
}
function updateTimeUI() {
  $('month-label').textContent = model ? monthLabel(month) : '—';
  slider.value = String(month);
  slider.setAttribute('aria-valuetext', model ? monthLabel(month) : 'no data');
  const tot = $('total');
  tot.textContent = '';
  if (!model) return;
  const on = CC.filter((c) => ccOn[c]);
  const who = on.length === CC.length ? '' : on.length ? on.join('+') + ': ' : 'No country selected';
  if (!on.length) { tot.textContent = who; return; }
  // Say so when a country has no figures for this month, rather than let its
  // fields read as idle: the Dutch series start in 2003, and every regulator
  // reports the newest months on its own lag.
  const late = on.filter((c) => model.ccLast[c] != null && month > model.ccLast[c]);
  const early = on.filter((c) => model.ccFirst[c] != null && month < model.ccFirst[c]);
  const note = [late.length ? `${late.join(', ')} not reported yet` : '',
    ...early.map((c) => `${c} figures from ${monthYear(model.ccFirst[c])}`)].filter(Boolean).join(' · ');
  if (note && late.length + early.length === on.length) { tot.textContent = note; return; }
  tot.append(note ? `${note} · ` : `${who}${monthCount} producing · `);
  tot.append(el('b', null, fmt3(monthTotal * U_().f)));
  tot.append(` ${U_().rate}`);
}
function buildTicks() {
  const box = $('ticks');
  box.textContent = '';
  if (!model) return;
  slider.max = String(model.lastMonth);
  for (let y = 1980; (y - EPOCH) * 12 <= model.lastMonth; y += 10) {
    const s = el('span', null, String(y));
    s.style.left = `${(((y - EPOCH) * 12) / model.lastMonth) * 100}%`;
    box.append(s);
  }
}
function updateSpeed() {
  const sp = SPEEDS[speedIdx];
  $('btn-speed').textContent = sp === 12 ? '1×' : sp < 12 ? `${sp / 12}×`.replace('0.', '.') : `${sp / 12}×`;
  $('btn-speed').setAttribute('aria-label', `Playback speed: ${sp} months per second`);
}

/* ── the bottom sheet ────────────────────────────────────────────────────── */

let sheetDyn = null;        // refreshes the month-dependent parts in place
function selKey(s) {
  if (!s) return null;
  if (s.type === 'unit') { const U = model.units[s.u]; return U.kind === 'group' ? `g:${U.g.id}` : `f:${U.f.id}`; }
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

function select(s, keepMode) {
  sel = s;
  store(STORE.sel, selKey(s) || '');
  const sh = $('sheet');
  if (!s) {
    sh.hidden = true;
    sheetDyn = null;
  } else {
    const wasOpen = !sh.hidden;
    if (!keepMode || !wasOpen) sh.dataset.mode = s.type === 'unit' ? 'half' : 'peek';
    sh.hidden = false;
    renderSheet();
    if (!keepMode) $('sheet-body').scrollTop = 0;
  }
  requestRender();
}

function dlRow(dl, k, v) {
  if (v == null || v === '') return null;
  dl.append(el('dt', null, k));
  const dd = el('dd', null, String(v));
  dl.append(dd);
  return dd;
}
function ccChip(cc) {
  const s = el('span', 'cc', cc);
  s.setAttribute('aria-label', (snap && snap.countries && snap.countries[cc]) || cc);
  s.title = s.getAttribute('aria-label');
  return s;
}

function renderSheet() {
  const b = $('sheet-body');
  b.textContent = '';
  sheetDyn = null;
  if (!sel) return;
  if (sel.type === 'unit') renderUnitSheet(b, model.units[sel.u]);
  else if (sel.type === 'fac') renderFacSheet(b, base.fac.raw[sel.i]);
  else if (sel.type === 'pipe') renderPipeSheet(b, base.pipes[sel.i]);
  else renderBorderSheet(b, base.borders[sel.i]);
}

function sheetHead(b, title, ccs, badge) {
  const h = el('div', 'sh-head');
  h.append(el('h2', null, title));
  for (const c of ccs) h.append(ccChip(c));
  if (badge) h.append(el('span', 'badge', badge));
  b.append(h);
}

function unitSeries(U) {
  // Per-day liquids and gas over the unit's whole life, in the chosen units:
  // liquids as Sm³ (or bbl), gas as oil equivalent on the same axis, so the
  // two lines share one scale honestly.
  let x0 = Infinity;
  for (const F of U.members) if (F.first != null) x0 = Math.min(x0, F.first);
  if (!Number.isFinite(x0)) return null;
  const x1 = model.lastMonth, n = x1 - x0 + 1;
  const liq = new Float32Array(n), gas = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const m = x0 + j, d = daysIn(m);
    let l = 0, g = 0;
    for (const F of U.members) { l += monthly(F, 'liq', m); g += monthly(F, 'gas', m); }
    liq[j] = l / d; gas[j] = g / d;
  }
  return { x0, x1, liq, gas };
}

function drawSpark(cv, S) {
  const w = Math.max(10, cv.clientWidth), h = Math.max(10, cv.clientHeight);
  const r = Math.min(3, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * r)) cv.width = Math.round(w * r);
  if (cv.height !== Math.round(h * r)) cv.height = Math.round(h * r);
  const c = cv.getContext('2d');
  c.setTransform(r, 0, 0, r, 0, 0);
  c.clearRect(0, 0, w, h);
  const f = UNITS.oe[sys].f, unit = UNITS.oe[sys].rate;
  const pl = 2, pr = 2, pt = 16, pb = 14, iw = w - pl - pr, ih = h - pt - pb;
  let ymax = 0;
  for (let j = 0; j < S.liq.length; j++) ymax = Math.max(ymax, S.liq[j], S.gas[j] / 1000);
  ymax = ymax * f || 1;
  const n = S.x1 - S.x0;
  const X = (m) => pl + (n > 0 ? ((m - S.x0) / n) * iw : iw / 2);
  const Y = (v) => pt + ih - (v * f / ymax) * ih;
  c.font = `10px ${FONT}`;
  c.fillStyle = P.dim;
  c.strokeStyle = P.grid;
  c.lineWidth = 1;
  c.beginPath(); c.moveTo(pl, pt + 0.5); c.lineTo(w - pr, pt + 0.5); c.moveTo(pl, pt + ih + 0.5); c.lineTo(w - pr, pt + ih + 0.5); c.stroke();
  c.textBaseline = 'bottom';
  c.textAlign = 'left';
  const maxLab = `${fmt3(ymax)} ${unit}`;
  c.fillText(maxLab, pl, pt - 2);
  const maxW = c.measureText(maxLab).width;
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
  c.lineWidth = 1.6;
  const line = (arr, div, col) => {
    c.strokeStyle = col;
    c.beginPath();
    for (let j = 0; j < arr.length; j++) { const x = X(S.x0 + j), y = Y(arr[j] / div); if (j) c.lineTo(x, y); else c.moveTo(x, y); }
    c.stroke();
  };
  line(S.gas, 1000, P.pipes[1]);
  line(S.liq, 1, P.pipes[0]);
  if (month >= S.x0 && month <= S.x1) {
    const x = Math.round(X(month)) + 0.5, j = month - S.x0;
    c.strokeStyle = P.ink;
    c.globalAlpha = 0.7;
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, pt); c.lineTo(x, pt + ih); c.stroke();
    c.globalAlpha = 1;
    for (const [v, col] of [[S.gas[j] / 1000, P.pipes[1]], [S.liq[j], P.pipes[0]]]) {
      c.fillStyle = col;
      c.beginPath(); c.arc(x, Y(v), 3, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = P.ink;
    c.font = `600 10px ${FONT}`;
    c.textBaseline = 'bottom';
    const lab = monthShort(month), tw = c.measureText(lab).width;
    c.textAlign = 'left';
    c.fillText(lab, clamp(x - tw / 2, pl + maxW + 10, w - pr - tw), pt - 2);
  }
}

function renderUnitSheet(b, U) {
  const isG = U.kind === 'group';
  const ccs = [...new Set(U.members.map((F) => F.cc))];
  sheetHead(b, U.name, ccs, isG ? 'Cross-border unit' : null);
  const F0 = U.members[0];
  const statuses = [...new Set(U.members.map((F) => F.raw.status).filter(Boolean))];
  b.append(el('p', 'sh-sub', [hcLabel(F0.hc), statuses.map(sentenceCase).join(' / ')].filter(Boolean).join(' · ') || ' '));
  const now = el('div', 'sh-now');
  const nowV = el('b'), nowT = el('span');
  now.append(nowV, nowT);
  b.append(now);
  const S = unitSeries(U);
  let cv = null, keyL = null, keyG = null;
  if (S) {
    cv = el('canvas', 'spark');
    cv.setAttribute('role', 'img');
    b.append(cv);
    const key = el('div', 'spark-key');
    keyL = el('span'); keyG = el('span');
    key.append(keyL, keyG);
    b.append(key);
    // drag across the sparkline to scrub the month
    const scrub = (e) => {
      const r = cv.getBoundingClientRect();
      const t = clamp((e.clientX - r.left - 2) / Math.max(1, r.width - 4), 0, 1);
      if (playing) setPlaying(false);
      setMonth(S.x0 + t * (S.x1 - S.x0));
    };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } scrub(e); cv._drag = true; });
    cv.addEventListener('pointermove', (e) => { if (cv._drag) scrub(e); });
    const end = () => { cv._drag = false; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  } else {
    b.append(el('p', 'sh-note', 'No production is reported for this field.'));
  }
  let memberCells = [];
  let sumCell = null;
  if (isG) {
    b.append(el('div', 'sh-h3', 'Cross-border unit'));
    const tbl = el('table', 'members');
    for (const F of U.members) {
      const tr = el('tr');
      const td0 = el('td');
      td0.append(ccChip(F.cc), ` ${CC_ADJ[F.cc]} side`);
      const td1 = el('td', 'num', isNum(F.raw.share) ? `${F.raw.share}% share` : 'share not published');
      const td2 = el('td', 'num');
      tr.append(td0, td1, td2);
      tbl.append(tr);
      memberCells.push([F, td2]);
    }
    const tr = el('tr', 'sum');
    tr.append(el('td', null, 'Unit total'), el('td'), (sumCell = el('td', 'num')));
    tbl.append(tr);
    b.append(tbl);
    if (U.g.note) b.append(el('p', 'sh-note', U.g.note + '.'));
  }
  const statusCells = [];
  for (const F of U.members) {
    b.append(el('div', 'sh-h3', isG ? `${CC_ADJ[F.cc]} side · ${F.id}` : 'Details'));
    const dl = el('dl', 'sh-dl');
    dlRow(dl, 'Operator', F.raw.operator);
    dlRow(dl, 'Hydrocarbon', hcLabel(F.hc));
    dlRow(dl, 'Status now', F.raw.status ? sentenceCase(F.raw.status) : 'not reported');
    if (F.hist) statusCells.push([F, dlRow(dl, 'Status then', '—'), dl.lastChild.previousSibling]);
    dlRow(dl, 'Discovered', F.raw.discYear);
    if (F.first != null) {
      dlRow(dl, 'First production', monthLabel(F.first));
      if (F.end - 1 < (model.ccLast[F.cc] ?? model.lastMonth)) dlRow(dl, 'Last production', monthLabel(F.end - 1));
    }
    const pk = peakOf(F);
    if (pk) dlRow(dl, `Peak (${UNITS[qty].name.toLowerCase()})`, `${fmt3(pk.v * U_().f)} ${U_().rate} in ${monthLabel(pk.m)}`);
    const cumL = isNum(F.raw.cumLiq) ? F.raw.cumLiq : null, cumG = isNum(F.raw.cumGas) ? F.raw.cumGas : null;
    if (cumL) dlRow(dl, 'Liquids to date', `${fmtVol(cumL * UNITS.liq[sys].f)} ${UNITS.liq[sys].vol}`);
    if (cumG) dlRow(dl, 'Gas to date', `${fmtVol(cumG * UNITS.gas[sys].f)} ${UNITS.gas[sys].vol}`);
    if (isNum(F.raw.share) && !isG) dlRow(dl, 'National share', `${F.raw.share}%`);
    dlRow(dl, 'Regulator id', F.id);
    b.append(dl);
    if (isInt(F.raw.monthlyFrom)) {
      b.append(el('p', 'sh-note', `Before ${monthLabel(F.raw.monthlyFrom)} the ${(snap.countries && snap.countries[F.cc]) || F.cc} figures are annual totals spread evenly over the months, so month-to-month changes before then are not real.`));
    }
  }
  sheetDyn = () => {
    const u = U_(), dd = daysIn(month);
    const v = U.members.reduce((a, F) => a + fieldVal[F.i], 0);
    const anyVis = U.members.some((F) => fieldState[F.i]);
    const noData = U.members.filter((F) => (model.ccFirst[F.cc] != null && month < model.ccFirst[F.cc]) || (model.ccLast[F.cc] != null && month > model.ccLast[F.cc]));
    nowV.textContent = anyVis && noData.length < U.members.length ? fmt3(v * u.f) : '—';
    nowT.textContent = !anyVis ? `not yet discovered in ${monthLabel(month)}`
      : noData.length === U.members.length ? `no ${noData.map((F) => CC_ADJ[F.cc]).filter((x, i, a) => a.indexOf(x) === i).join(' or ')} figures for ${monthLabel(month)}`
        : `${u.rate} ${UNITS[qty].name.toLowerCase()} · ${monthLabel(month)}${noData.length ? ` (no ${CC_ADJ[noData[0].cc]} figures)` : ''}`;
    if (S) {
      drawSpark(cv, S);
      const j = month - S.x0, inR = j >= 0 && j < S.liq.length;
      keyL.textContent = '';
      keyG.textContent = '';
      const lI = el('i'); lI.style.background = P.pipes[0];
      const gI = el('i'); gI.style.background = P.pipes[1];
      keyL.append(lI, `Liquids ${inR ? fmt3(S.liq[j] * UNITS.liq[sys].f) : '0'} `, el('small', null, UNITS.liq[sys].rate));
      keyG.append(gI, `Gas ${inR ? fmt3(S.gas[j] * UNITS.gas[sys].f) : '0'} `, el('small', null, UNITS.gas[sys].rate));
      cv.setAttribute('aria-label', `Production history ${monthYear(S.x0)}–${monthYear(S.x1)}; liquids and gas as oil equivalent on one scale. ${monthLabel(month)}: ${keyL.textContent}, ${keyG.textContent}.`);
    }
    for (const [F, td] of memberCells) {
      const l = monthly(F, qty, month) / dd;
      td.textContent = `${fmt3(l * u.f)} ${u.rate}`;
    }
    if (sumCell) sumCell.textContent = `${fmt3(U.members.reduce((a, F) => a + monthly(F, qty, month) / dd, 0) * u.f)} ${u.rate}`;
    for (const [F, dd2, dt] of statusCells) {
      const h = statusAt(F, month);
      dt.textContent = `Status in ${monthShort(month)}`;
      dd2.textContent = h ? sentenceCase(h[2]) : 'not yet in the register';
    }
  };
  sheetDyn();
}

function peakOf(F) {
  const d = F.first;
  if (d == null) return null;
  let best = 0, bm = -1;
  for (let m = F.first; m < F.end; m++) {
    const v = monthly(F, qty, m) / daysIn(m);
    if (v > best) { best = v; bm = m; }
  }
  return bm >= 0 ? { v: best, m: bm } : null;
}

function renderFacSheet(b, fa) {
  sheetHead(b, titleCase(fa.name) || 'Unnamed installation', [fa.country], null);
  b.append(el('p', 'sh-sub', [sentenceCase(fa.kind), fa.surface === false ? 'subsea' : 'surface'].filter(Boolean).join(' · ')));
  const dl = el('dl', 'sh-dl');
  dlRow(dl, 'Phase', fa.phase ? sentenceCase(fa.phase) : null);
  dlRow(dl, 'In place from', fa.startYear);
  dlRow(dl, 'Until', fa.endYear);
  dlRow(dl, 'Field', fa.field ? titleCase(fa.field) : null);
  dlRow(dl, 'Operator', fa.operator);
  dlRow(dl, 'Position', `${fa.lat.toFixed(3)}° N, ${Math.abs(fa.lon).toFixed(3)}° ${fa.lon < 0 ? 'W' : 'E'}`);
  dlRow(dl, 'Id', fa.id);
  b.append(dl);
  const U = fa.field && model ? unitByName(fa.field, fa.country) : null;
  if (U != null) {
    const btn = el('button', 'about-close', `Show ${model.units[U].name}`);
    btn.type = 'button';
    btn.addEventListener('click', () => pickUnit(U));
    b.append(btn);
  }
}
function unitByName(name, cc) {
  const key = fold(name).replace(/[^a-z0-9]/g, '');
  let hit = null;
  for (const F of model.fields) {
    if (fold(F.raw.name).replace(/[^a-z0-9]/g, '') === key) { if (F.cc === cc) return F.unit; hit = hit == null ? F.unit : hit; }
  }
  return hit;
}

function renderPipeSheet(b, p) {
  const r = p.raw;
  const title = r.name ? titleCase(r.name) : r.from && r.to ? `${titleCase(r.from)} → ${titleCase(r.to)}` : 'Unnamed pipeline';
  sheetHead(b, title, [p.cc], null);
  b.append(el('p', 'sh-sub', [r.medium ? sentenceCase(r.medium) : 'Medium not reported', isNum(r.dimIn) ? `${r.dimIn}″` : null].filter(Boolean).join(' · ')));
  const dl = el('dl', 'sh-dl');
  dlRow(dl, 'Medium', r.medium ? sentenceCase(r.medium) : 'not reported');
  dlRow(dl, 'Diameter', isNum(r.dimIn) ? `${r.dimIn} in (${Math.round(r.dimIn * 25.4)} mm)` : 'not reported');
  dlRow(dl, 'From', r.from ? titleCase(r.from) : null);
  dlRow(dl, 'To', r.to ? titleCase(r.to) : null);
  dlRow(dl, 'Phase', r.phase ? sentenceCase(r.phase) : null);
  dlRow(dl, 'Length', isNum(r.km) ? `${r.km} km` : null);
  dlRow(dl, 'Id', r.id);
  b.append(dl);
}

function renderBorderSheet(b, br) {
  sheetHead(b, br.name || 'Maritime boundary', [], null);
  b.append(el('p', 'sh-sub', br.type ? `Maritime boundary · ${br.type}` : 'Maritime boundary'));
  const dl = el('dl', 'sh-dl');
  dlRow(dl, 'Between', [br.a, br.b].filter(Boolean).join(' and '));
  dlRow(dl, 'Type', br.type);
  b.append(dl);
  b.append(el('p', 'sh-note', 'Maritime boundaries: Flanders Marine Institute, Maritime Boundaries Geodatabase, marineregions.org (CC BY 4.0).'));
}

/* Drag the grip: up to full, down to half, further down to close. A tap on
 * the grip toggles half and full. */
(function sheetDrag() {
  const sh = $('sheet'), grip = $('sheet-grip');
  let d = null;
  grip.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    try { grip.setPointerCapture(e.pointerId); } catch { /* fine */ }
    d = { y: e.clientY, h: sh.getBoundingClientRect().height, moved: false };
    sh.classList.add('dragging');
  });
  grip.addEventListener('pointermove', (e) => {
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 5) d.moved = true;
    if (d.moved) sh.style.height = `${clamp(d.h - dy, 60, wrap.clientHeight)}px`;
  });
  const end = () => {
    if (!d) return;
    const h = sh.getBoundingClientRect().height, Hw = wrap.clientHeight;
    sh.classList.remove('dragging');
    sh.style.height = '';
    const unit = sel && sel.type === 'unit';
    if (!d.moved) sh.dataset.mode = sh.dataset.mode === 'full' ? (unit ? 'half' : 'peek') : 'full';
    else if (h < Math.min(d.h, Hw * 0.5) - 50 && h < Hw * 0.3) select(null);
    else if (h > Hw * 0.68) sh.dataset.mode = 'full';
    else sh.dataset.mode = unit ? 'half' : 'peek';
    d = null;
    if (sheetDyn) sheetDyn();
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
})();

/* ── search ──────────────────────────────────────────────────────────────── */

function openSearch(on) {
  $('search').hidden = !on;
  $('btn-search').setAttribute('aria-expanded', String(on));
  if (on) { $('search-input').value = ''; runSearch(); $('search-input').focus(); } else $('search-input').blur();
}
function runSearch() {
  const list = $('search-list');
  list.textContent = '';
  const q = fold($('search-input').value).trim();
  if (!q || !model) return;
  const starts = [], within = [];
  for (const e of model.searchIndex) {
    if (e.key.startsWith(q) || e.key.split(/[\s-]/).some((w) => w.startsWith(q))) starts.push(e);
    else if (e.key.includes(q)) within.push(e);
  }
  const hits = starts.concat(within).slice(0, 12);
  if (!hits.length) { list.append(el('li', 'none', 'No field by that name')); return; }
  for (const e of hits) {
    const U = model.units[e.u];
    const li = el('li');
    li.setAttribute('role', 'option');
    const btn = el('button');
    btn.type = 'button';
    btn.append(el('span', null, U.name));
    for (const c of e.cc) btn.append(ccChip(c));
    const st = U.kind === 'group' ? 'cross-border' : sentenceCase(U.f.raw.status || '') || '';
    btn.append(el('span', 'sub', st));
    btn.addEventListener('click', () => pickUnit(e.u));
    li.append(btn);
    list.append(li);
  }
}
function pickUnit(u) {
  openSearch(false);
  const U = model.units[u];
  let changed = false;
  for (const F of U.members) if (!ccOn[F.cc]) { ccOn[F.cc] = true; changed = true; }
  if (changed) { syncChips(); computeMonth(); updateTimeUI(); }
  // A field not yet discovered at the slider's month would be invisible:
  // move the slider to its first production (or its discovery).
  if (!unitVis[u]) {
    const F = U.members[0];
    const m = F.first != null ? F.first : F.disc != null ? (F.disc - EPOCH) * 12 : month;
    setMonth(clamp(m, 0, model.lastMonth));
  }
  select({ type: 'unit', u });
  let bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const F of U.members) bb = [Math.min(bb[0], F.bbox[0]), Math.min(bb[1], F.bbox[1]), Math.max(bb[2], F.bbox[2]), Math.max(bb[3], F.bbox[3])];
  flyTo(bb, 40);
}

/* ── map gestures ────────────────────────────────────────────────────────── */

const pointers = new Map();
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
  fly = null;
  rect = canvas.getBoundingClientRect();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* fine */ }
  if (!pointers.size) { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; render(); } takeSnapshot(); }
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
    const k = clamp(gesture.k0 * Math.hypot(a.x - b.x, a.y - b.y) / gesture.d0, kMin, fitK * Z_MAX);
    view.k = k;
    view.tx = mx - gesture.X * k;
    view.ty = my - gesture.Y * k;
    clampView();
    requestRender();
  }
});
let lastTap = null;
function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  const wasTap = gesture && gesture.type === 'pan' && !gesture.moved && pointers.size === 1
    && performance.now() - gesture.t0 < 450 && e.type === 'pointerup';
  pointers.delete(e.pointerId);
  if (pointers.size > 0) { startGesture(); return; }
  gesture = null;
  if (wasTap) onTap(e.clientX - rect.left, e.clientY - rect.top);
  saveView();
  requestRender();            // redraw once more so the static cache is rebuilt
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  saveView();
  requestRender();
}, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault());   // no page zoom in Safari
}

/* A tap selects at once; a second tap in the same place soon after zooms in,
 * so the selection never waits on a double-tap timer. */
function onTap(sx, sy) {
  const now = performance.now();
  if (!$('search').hidden) { openSearch(false); return; }
  if (lastTap && now - lastTap.t < 300 && Math.hypot(sx - lastTap.x, sy - lastTap.y) < 24) {
    lastTap = null;
    zoomAt(sx, sy, 2);
    saveView();
    requestRender();
    return;
  }
  lastTap = { x: sx, y: sy, t: now };
  select(hitTest(sx, sy));
}

/* ── controls ────────────────────────────────────────────────────────────── */

function syncChips() {
  for (const b of $('chips').children) b.setAttribute('aria-pressed', String(ccOn[b.dataset.cc]));
  store(STORE.cc, ccOn);
}
function onFilterChange() {
  computeMonth();
  updateTimeUI();
  updateLegend();
  if (sel) {
    if (sel.type === 'unit' && !unitVis[sel.u]) select(null);
    else if (sheetDyn) sheetDyn();
  }
  requestRender();
}
for (const c of CC) {
  const b = el('button', null, c);
  b.type = 'button';
  b.dataset.cc = c;
  b.setAttribute('aria-label', { NO: 'Norway', UK: 'United Kingdom', DK: 'Denmark', NL: 'Netherlands' }[c]);
  b.addEventListener('click', () => { ccOn[c] = !ccOn[c]; syncChips(); onFilterChange(); });
  $('chips').append(b);
}
function setQty(q) {
  qty = q;
  store(STORE.qty, q);
  for (const b of $('qty').children) b.setAttribute('aria-checked', String(b.dataset.q === q));
  computeMonth();
  updateLegend();
  updateTimeUI();
  if (sel && sel.type === 'unit') renderSheet();
  requestRender();
}
for (const b of $('qty').children) b.addEventListener('click', () => setQty(b.dataset.q));
$('btn-units').addEventListener('click', () => {
  sys = sys === 'si' ? 'field' : 'si';
  store(STORE.sys, sys);
  updateLegend();
  updateTimeUI();
  if (sel && sel.type === 'unit') renderSheet();
});
$('btn-search').addEventListener('click', () => openSearch($('search').hidden));
$('search-input').addEventListener('input', runSearch);
$('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') openSearch(false);
  if (e.key === 'Enter') { const b = $('search-list').querySelector('button'); if (b) b.click(); }
});
$('zoom-in').addEventListener('click', () => { fly = null; zoomAt(W / 2, H / 2, 2); saveView(); requestRender(); });
$('zoom-out').addEventListener('click', () => { fly = null; zoomAt(W / 2, H / 2, 0.5); saveView(); requestRender(); });
$('zoom-home').addEventListener('click', () => {
  if (!base) return;
  const h = homeBox();
  flyTo(h, 1);
  fly.to = { x: (h[0] + h[2]) / 2, y: (h[1] + h[3]) / 2, k: fitK };
});
$('legend').addEventListener('click', () => {
  const open = $('legend-key').hidden;
  $('legend-key').hidden = !open;
  $('legend').setAttribute('aria-expanded', String(open));
  store(STORE.key, open ? '1' : '0');
});
$('credits').addEventListener('click', showAbout);
$('stamp').addEventListener('click', showAbout);
$('about-close').addEventListener('click', () => { $('about').hidden = true; });
$('about').addEventListener('click', (e) => { if (e.target === $('about')) $('about').hidden = true; });
$('sheet-close').addEventListener('click', () => select(null));
$('btn-play').addEventListener('click', () => setPlaying(!playing));
$('btn-back').addEventListener('click', () => { setPlaying(false); setMonth(month - 12); });
$('btn-fwd').addEventListener('click', () => { setPlaying(false); setMonth(month + 12); });
$('btn-speed').addEventListener('click', () => {
  speedIdx = (speedIdx + 1) % SPEEDS.length;
  store(STORE.speed, String(speedIdx));
  updateSpeed();
});
slider.addEventListener('input', () => { if (playing) setPlaying(false); setMonth(Number(slider.value)); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('about').hidden) $('about').hidden = true;
  else if (!$('search').hidden) openSearch(false);
  else if (sel) select(null);
});
darkMq.addEventListener('change', () => {
  buildPalette();
  updateLegend();
  if (sheetDyn) sheetDyn();
  requestRender();
});

/* ── loading ─────────────────────────────────────────────────────────────── */

async function fetchJSON(name) {
  const r = await fetch(`./data/${name}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`data/${name} could not be read (HTTP ${r.status}).`);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error(`data/${name} is not valid JSON${text.trim().startsWith('<') ? ' — it looks like a web page was written over it' : ''}.`);
  }
  return { data, sig: `${data && data.generatedAt}|${text.length}` };
}

let loadGen = 0;
async function loadAll() {
  const gen = ++loadGen;
  const [gr, sr] = await Promise.allSettled([fetchJSON('geo.json'), fetchJSON('snapshot.json')]);
  if (gen !== loadGen) return;
  let baseChanged = false;
  if (gr.status === 'rejected') {
    setProblem('geo', gr.reason.message + (base ? ' Showing the map as last read.' : ''));
  } else if (!base || base.sig !== gr.value.sig) {
    const why = validateGeo(gr.value.data);
    if (why) setProblem('geo', `data/geo.json is not a Shelf Atlas map: ${why}.`);
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
    if (why) setProblem('snapshot', `data/snapshot.json is not a Shelf Atlas snapshot: ${why}.`);
    else {
      try {
        const keep = sel ? selKey(sel) : recall(STORE.sel);
        const M = buildModel(s, base);
        M.sig = sr.value.sig;
        model = M;
        snap = s;
        setProblem('snapshot', M.fields.length ? null
          : 'data/snapshot.json holds no fields yet: only the basemap has been built. Production appears when the next build lands.');
        buildTicks();
        const stored = recall(STORE.month);
        const first = !loadAll.done;
        month = clamp(first && stored != null && isInt(Number(stored)) ? Number(stored) : first ? M.defaultMonth : month, 0, M.lastMonth);
        computeMonth();
        sel = null;
        const r = resolveSel(keep);
        if (r) select(r, true); else if (!$('sheet').hidden) select(null);
      } catch (e) { setProblem('snapshot', `data/snapshot.json is not a Shelf Atlas snapshot: ${e.message}.`); }
    }
  } else if (sr.status === 'fulfilled' && model) {
    if (problems.get('snapshot') && model.fields.length) setProblem('snapshot', null);
  }
  if (baseChanged && !loadAll.done) { computeFit(); restoreView(); }
  loadAll.done = true;
  if (!model) { month = 0; }
  updateStamp();
  updateCredits();
  updateLegend();
  updateTimeUI();
  requestRender();
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAll(); });

/* ── boot ────────────────────────────────────────────────────────────────── */

function resize() {
  const r = wrap.getBoundingClientRect();
  const oldCenter = base ? { x: (W / 2 - view.tx) / view.k, y: (H / 2 - view.ty) / view.k, z: zoomRel() } : null;
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  dpr = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  computeFit();
  if (oldCenter && loadAll.done) { centerOn(oldCenter.x, oldCenter.y, oldCenter.z * fitK); clampView(); }
  cache = null;
  if (sheetDyn) sheetDyn();
  render();
}

(function restoreUI() {
  const q = recall(STORE.qty);
  if (q && UNITS[q]) qty = q;
  if (recall(STORE.sys) === 'field') sys = 'field';
  const cc = recallJSON(STORE.cc);
  if (cc && typeof cc === 'object') for (const c of CC) if (typeof cc[c] === 'boolean') ccOn[c] = cc[c];
  const sp = recall(STORE.speed) == null ? NaN : Number(recall(STORE.speed));
  if (isInt(sp) && sp >= 0 && sp < SPEEDS.length) speedIdx = sp;
  if (recall(STORE.key) === '1') { $('legend-key').hidden = false; $('legend').setAttribute('aria-expanded', 'true'); }
})();
buildPalette();
for (const b of $('qty').children) b.setAttribute('aria-checked', String(b.dataset.q === qty));
syncChips();
updateSpeed();
updateLegend();
updateStamp();
new ResizeObserver(resize).observe(wrap);
resize();
loadAll();

/* For tests and a browser console, never for the app itself. */
window.__sa = {
  render() { const t0 = performance.now(); render(); return performance.now() - t0; },
  renderCold() { cache = null; const t0 = performance.now(); render(); return performance.now() - t0; },
  get state() {
    return { month, qty, sys, ccOn: { ...ccOn }, playing, zoom: zoomRel(), sel: sel ? selKey(sel) : null,
      fields: model ? model.fields.length : 0, units: model ? model.units.length : 0, problems: [...problems.values()],
      total: monthTotal, producing: monthCount, hi: model ? model.hi : null };
  },
  setMonth(m) { setMonth(m); },
  pick(name) { const e = model.searchIndex.find((x) => x.key === fold(name)); if (e) pickUnit(e.u); return !!e; },
  project(lon, lat) { return [lon * view.k + view.tx, mercY(lat) * view.k + view.ty]; },
  zoomTo(lon, lat, z) { fly = null; centerOn(lon, mercY(lat), z * fitK); clampView(); requestRender(); },
  hit(sx, sy) { const h = hitTest(sx, sy); return h ? selKey(h) : null; },
  reload: loadAll,
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
