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
const PIPE_W = [0.8, 1.4, 2.2];           // CSS px at the zoom where pipelines appear
function widthClass(d) { return !isNum(d) || d < 14 ? 0 : d < 26 ? 1 : 2; }
const FLOATING = /FPSO|FSO|FSU|FLOAT|SEMI|SHIP|TLP|SPAR|VESSEL|BUOY|MOPU/i;

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
  B.fac = { n, X: new Float32Array(n), Y: new Float32Array(n), shape: new Uint8Array(n),
    cc: new Uint8Array(n), y0: new Int16Array(n), y1: new Int16Array(n), raw: g.facilities };
  g.facilities.forEach((fa, i) => {
    B.fac.X[i] = fa.lon;
    B.fac.Y[i] = mercY(fa.lat);
    B.fac.shape[i] = fa.surface === false || /subsea/i.test(fa.kind || '') ? 2 : FLOATING.test(fa.kind || '') ? 1 : 0;
    B.fac.cc[i] = Math.max(0, CC.indexOf(fa.country));
    B.fac.y0[i] = isInt(fa.startYear) ? fa.startYear : 0;
    B.fac.y1[i] = isInt(fa.endYear) ? fa.endYear : 9999;
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

function computeFit() {
  if (!base) { fitK = 1; return; }
  fitK = Math.min(W / (base.X1 - base.X0), H / (base.Y1 - base.Y0)) * 0.98;
}
function zoomRel() { return view.k / fitK; }
function centerOn(X, Y, k) {
  view.k = k;
  view.tx = W / 2 - X * k;
  view.ty = H / 2 - Y * k;
}
function home() {
  if (!base) return;
  centerOn((base.X0 + base.X1) / 2, (base.Y0 + base.Y1) / 2, fitK);
}
function clampView() {
  if (!base) return;
  const k = clamp(view.k, fitK * Z_MIN, fitK * Z_MAX);
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
  const k = clamp(view.k * f, fitK * Z_MIN, fitK * Z_MAX);
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
  c.fillStyle = P.bathy;
  c.fill(base.bathy, 'evenodd');
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
    const grow = clamp(Math.sqrt(zoomRel() / Z_PIPES), 1, 2.4);
    c.globalAlpha = 0.9;
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

function render() {
  const c = ctx;
  if (!P) buildPalette();
  if (!base) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = P.bg;
    c.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const key = staticKey();
  if (cache && cache.key === key) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(cache.canvas, 0, 0);
  } else if (gesture || fly) {
    drawStatic(c);
  } else {
    if (!cache || cache.canvas.width !== canvas.width || cache.canvas.height !== canvas.height) {
      const cv = document.createElement('canvas');
      cv.width = canvas.width;
      cv.height = canvas.height;
      cache = { canvas: cv, ctx: cv.getContext('2d'), key: null };
    }
    drawStatic(cache.ctx);
    cache.key = key;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(cache.canvas, 0, 0);
  }
  if (model) {
    drawFields(c);
    drawCircles(c);
    if (facsOn()) drawFacilities(c);
    if (zoomRel() >= Z_LABELS) drawLabels(c);
  }
  drawSelection(c);
}

function drawFields(c) {
  const k = view.k, vb = viewBounds(2);
  worldTf(c);
  c.lineJoin = 'round';
  const lw = 0.8 / k;
  const fs = model.fields;
  for (let i = 0; i < fs.length; i++) {
    const F = fs[i];
    const st = fieldState[i];
    if (!st || !F.path || !inView(F.bbox, vb)) continue;
    c.lineWidth = lw;
    if (st === 3) {
      c.globalAlpha = 0.85;
      c.fillStyle = P.lut[fieldCol[i]];
      c.fill(F.path, 'evenodd');
      c.globalAlpha = 1;
      c.strokeStyle = P.prodStroke;
    } else if (st === 2) {
      c.fillStyle = P.shutFill;
      c.fill(F.path, 'evenodd');
      c.strokeStyle = P.shutStroke;
    } else {
      c.strokeStyle = P.idle;
    }
    c.stroke(F.path);
  }
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
  const s = clamp(2.4 + (zoomRel() - Z_FACS) * 0.12, 2.4, 4.2);
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
  c.lineWidth = 1;
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
  if (pipesOn()) {
    const p = nearestPipe(sx, sy, 5);
    if (p != null) return { type: 'pipe', i: p };
  }
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
