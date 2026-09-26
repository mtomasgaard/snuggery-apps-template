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
const Z_FACS = 2.4;             // … platforms and subsea structures
const Z_MIN = 0.7, Z_MAX = 400;
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
  },
  dark: {
    ramp: ['#5e2a12', '#9a3e16', '#d95926', '#f49a60', '#ffdcbd'],
    bg: '#07090d', sea: '#0f1a26', bathy: '#0a121c', land: '#1c2129', coast: '#465363',
    border: '#8793a3', idle: 'rgba(170,182,198,.55)', prodStroke: 'rgba(255,220,190,.35)',
    shutFill: 'rgba(95,104,118,.65)', shutStroke: 'rgba(150,160,175,.75)', ring: 'rgba(8,12,18,.9)',
    pipes: ['#2fae4a', '#9085e9', '#8a95a3'], fac: '#e8ecf2', facStroke: '#0f1a26', sub: '#9aa6b5',
    label: '#e8ecf2', halo: 'rgba(12,17,24,.9)', sel: '#5b8eff', grid: '#262e39', ink: '#e8ecf2', dim: '#9aa6b5',
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

/* Names arrive in the regulators' capitals. Title-case words of letters; a
 * word with a digit in it is a licence-block name (K15-FA, 35/11) and stays. */
function titleCase(s) {
  if (!s) return '';
  return String(s).split(/(\s+|-|\/)/).map((w) => {
    if (/\d/.test(w) || w.length <= 1) return w;
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
/* The same buckets the build uses for its `ask` rows, so "shut down" means
 * one thing whether it came from Sodir's history or a UK "Ceased". */
function normStatus(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (t.includes('produc') && !t.includes('unlikely') && !t.includes('not') && !t.includes('approved')) return 'Producing';
  if (/shut|abandon|ceased|decommission|removed/.test(t)) return 'Shut down';
  if (/approved|development|under/.test(t)) return 'Approved for production';
  return sentenceCase(s);
}
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
