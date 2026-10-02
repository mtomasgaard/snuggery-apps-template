/* Shelf Atlas: the data, decoded. Pure (no DOM), so tools/test_decode.mjs runs it in Node against a
 * decode of its own. Moved here from app.js by the house-system pass, not rewritten; the pass added
 * repairText(), the reporting months and the Peaks' records (ART.md section 1).
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
 *                  "lon": 1.8532, "lat": 61.2545 }, …],   // surface:false = subsea
 *   "bathymetry": { "file": "bathy.png", "bounds": [lon0, lat0, lon1, lat1], … }   // optional
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
 * for start ≤ mi < start + length, else 0. (The sources' `licence` key is the
 * data's own spelling, read as it is.)
 *
 * Both files are checked against this shape on every read. A file that is
 * missing, unparseable or the wrong shape is named on screen with what is
 * wrong; the map never draws a blank that could pass for data.
 * ========================================================================== */

export const EPOCH = 1971;
export const CC = ['NO', 'UK', 'DK', 'NL'];
export const CC_ADJ = { NO: 'Norwegian', UK: 'UK', DK: 'Danish', NL: 'Dutch' };
export const R_MAX = 17;                 // CSS px radius of the circle for the top of the rate scale
export const RING_MIN = 3;               // CSS px: a best month whose ring would be smaller is not drawn
export const RING_FLOOR = (RING_MIN / R_MAX) ** 2;   // 3.11 % of the scale's top
const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export const isInt = (v) => Number.isInteger(v);
export const isStr = (v) => typeof v === 'string';
export const monthYear = (mi) => EPOCH + Math.floor(mi / 12);
export function daysIn(mi) { return new Date(Date.UTC(monthYear(mi), (mi % 12) + 1, 0)).getUTCDate(); }

/* Names arrive in the regulators' capitals. Title-case words of letters. A
 * name that starts with a license block (K15-FA, L10-CDA) stays as it is, as
 * do words with digits and one- and two-letter words (Ekofisk VB, Nuggets N4). */
export function titleCase(s) {
  if (!s) return '';
  if (/^\S*\d/.test(s)) return String(s);
  return String(s).split(/(\s+|-|\/)/).map((w) => {
    if (w.length <= 2 || /\d/.test(w)) return w;
    if (/^[IVX]+$/.test(w)) return w;          // roman numerals: Brent II, Gyda III
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join('');
}
export function sentenceCase(s) {
  if (!s) return '';
  const t = String(s).trim();
  if (t !== t.toUpperCase()) return t;         // already mixed case: keep the source's words
  return t.charAt(0) + t.slice(1).toLowerCase();
}
/* Status words differ by regulator ("Shut down", "Production Ceased",
 * "Post-Cop", "Abandoned"); this folds them into the few the map acts on.
 * Ceased is tested before producing: "Production ceased" contains both. */
export function normStatus(s) {
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
export function hcLabel(h) { return h ? HC_WORDS[String(h).toUpperCase()] || sentenceCase(h) : null; }
export function fold(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a');
}

/* B1 (ART.md section 8, now tools/DECISIONS.md): the pipeline reads every
 * shapefile's DBF as Latin-1, so Sodir's UTF-8 names arrive double-encoded
 * ("Ã\x85SGARD A" for ÅSGARD A). This undoes it at display time, and only for
 * a string that carries the pattern and decodes as UTF-8, so it does nothing
 * once the pipeline is fixed. The data file is not changed. */
const MOJIBAKE = /[ÂÃ][\u0080-¿]/;
export function repairText(s) {
  if (!isStr(s) || !MOJIBAKE.test(s)) return s;
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (c > 255) return s; bytes[i] = c; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return s; }
}
/** A shallow copy of a geo.json record with every string repaired. */
export function repaired(o) {
  const r = {};
  for (const k of Object.keys(o)) r[k] = repairText(o[k]);
  return r;
}

/* ── decoding ────────────────────────────────────────────────────────────── */

/* Web Mercator in degrees: X is longitude, Y is the Mercator ordinate with its
 * sign flipped so that screen = world × k + t with no mirror in between. */
export const mercY = (lat) => -Math.log(Math.tan(Math.PI / 4 + (clamp(lat, -85, 85) * DEG) / 2)) / DEG;
export const unmercY = (y) => (2 * Math.atan(Math.exp(-y * DEG)) - Math.PI / 2) / DEG;

/* Google's polyline algorithm, lon first, straight into world units. */
export function decodeLine(str, factor, where) {
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

export function decodeSeries(s, where) {
  let bin;
  try { bin = atob(s.b64); } catch { throw new Error(`${where}.b64 is not base64`); }
  if (bin.length % 2) throw new Error(`${where}.b64 holds an odd number of bytes`);
  const n = bin.length / 2;
  // the values, and their running sum in doubles: pre[j] = value[0] + … + value[j − 1]
  const out = new Float32Array(n), pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const v = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) * s.scale;
    out[i] = v;
    pre[i + 1] = pre[i] + v;
  }
  return [out, pre];
}

/* ── shape checks: say which file and what is wrong ──────────────────────── */

export function validateGeo(g) {
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

export function validateSnap(s) {
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

/* ── the series ──────────────────────────────────────────────────────────── */

export function monthly(F, q, m) {
  if (q === 'oe') return monthly(F, 'liq', m) + monthly(F, 'gas', m) / 1000;
  const a = q === 'liq' ? F.liq : F.gas;
  if (!a) return 0;
  const j = m - (q === 'liq' ? F.liqS : F.gasS);
  return j >= 0 && j < a.length ? a[j] : 0;
}
/* The volume produced from the first month of the series up to and including
 * month m: a lookup in the prefix sum, exact to the packed series. */
export function cumAt(F, q, m) {
  if (q === 'oe') return cumAt(F, 'liq', m) + cumAt(F, 'gas', m) / 1000;
  const p = q === 'liq' ? F.liqC : F.gasC;
  if (!p) return 0;
  const j = m - (q === 'liq' ? F.liqS : F.gasS) + 1;
  return j <= 0 ? 0 : p[j < p.length ? j : p.length - 1];
}
/** Whether country cc has figures for month m: inside its series, from its first to its newest month. */
export const reported = (M, cc, m) => M.ccFirst[cc] != null && m >= M.ccFirst[cc] && m <= M.ccLast[cc];
/** The newest month every shown country with figures has reported (B2: play stops there). */
export function commonMonth(M, shown) {
  let m = Infinity;
  for (const c of CC) if (shown[c] && M.ccLast[c] != null) m = Math.min(m, M.ccLast[c]);
  return Number.isFinite(m) ? clamp(m, 0, M.lastMonth) : M.defaultMonth;
}

/* ── the model: decoded once per data load ───────────────────────────────── */

/** `outlines` maps a field id to its decoded outline ({ path, rings, bbox, area }), built by app.js
 *  (it needs Path2D); in Node an empty Map stands in, and every field is a point. */
export function buildModel(s, outlines = new Map()) {
  const M = { lastMonth: s.lastMonth, fields: [], byId: new Map(), groups: [], groupById: new Map(),
    units: [], generatedAt: s.generatedAt, noOutline: 0, orphanOutlines: 0 };
  s.fields.forEach((r, i) => {
    const F = {
      i, raw: r, id: r.id, cc: r.country, name: titleCase(r.name), hc: r.hc,
      statusNorm: normStatus(r.status),
      hist: Array.isArray(r.statusHist) && r.statusHist.length
        ? r.statusHist.map((h) => [h[0], normStatus(h[1]), h[1]]).sort((a, b) => a[0] - b[0]) : null,
      disc: isInt(r.discYear) ? r.discYear : isInt(r.firstMonth) ? monthYear(r.firstMonth) : null,
      X: r.c[0], Y: mercY(r.c[1]), liq: null, liqC: null, liqS: 0, gas: null, gasC: null, gasS: 0, group: null, unit: -1,
    };
    if (r.liq) { [F.liq, F.liqC] = decodeSeries(r.liq, `fields[${i}] (${r.id}).liq`); F.liqS = r.liq.start; }
    if (r.gas) { [F.gas, F.gasC] = decodeSeries(r.gas, `fields[${i}] (${r.id}).gas`); F.gasS = r.gas.start; }
    const o = outlines.get(r.id);
    if (o) { F.path = o.path; F.rings = o.rings; F.bbox = o.bbox; F.area = o.area; F.delineation = r.country === 'DK'; } else {
      F.path = null; F.rings = null; F.bbox = [F.X, F.Y, F.X, F.Y]; F.area = 0; M.noOutline++;
    }
    F.first = F.liq || F.gas ? Math.min(F.liq ? F.liqS : 1e9, F.gas ? F.gasS : 1e9) : null;
    F.end = F.liq || F.gas ? Math.max(F.liq ? F.liqS + F.liq.length : 0, F.gas ? F.gasS + F.gas.length : 0) : null;
    M.fields.push(F);
    M.byId.set(F.id, F);
  });
  for (const id of outlines.keys()) if (!M.byId.has(id)) M.orphanOutlines++;
  // Each regulator reports on its own lag. The newest month that every
  // country with figures has reported is where the player opens; later
  // months are named as unreported rather than shown as a collapse.
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
  // Color and circle domains: the largest daily rate any unit reached, taken
  // as each unit's SECOND-highest month so that a single mis-keyed month in a
  // source (they exist) cannot squash the whole scale. Above it colors and
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
  // The cumulative scale has its own top: the most any unit has produced by
  // the last month. The rate scale above is left as it is.
  M.hiCum = { liq: 0, gas: 0, oe: 0 };
  for (const U of M.units) {
    for (const q of ['liq', 'gas', 'oe']) {
      let v = 0;
      for (const F of U.members) v += cumAt(F, q, M.lastMonth);
      if (v > M.hiCum[q]) M.hiCum[q] = v;
    }
  }
  // Where a sum may miss production from before its series: the field's
  // first month is its country's first month and other fields share it (a
  // series that opens on many producing fields at once, like the Dutch one in
  // January 2003), or the field was found before its country's series starts
  // and appears in it ten or more years after its discovery (the UK's 1960s
  // gas fields). A country's lone first producer is its real start.
  const atFirst = {};
  for (const F of M.fields) if (F.first != null && F.first === M.ccFirst[F.cc]) atFirst[F.cc] = (atFirst[F.cc] || 0) + 1;
  for (const F of M.fields) {
    F.lateStart = null;
    if (F.first == null) continue;
    const c0 = M.ccFirst[F.cc], d = F.raw.discYear;
    if (F.first === c0 && atFirst[F.cc] >= 2) F.lateStart = 'series';
    else if (c0 >= 12 && isInt(d) && d < monthYear(c0) && monthYear(F.first) - d >= 10) F.lateStart = 'field';
  }
  // Labels are placed biggest first: the fields that made the North Sea.
  M.rank = M.units.map((_, i) => i).sort((a, b) => (M.units[b].peak - M.units[a].peak) || (M.units[b].area - M.units[a].area));
  M.searchIndex = M.units.map((U, u) => ({ u, key: fold(U.name), cc: [...new Set(U.members.map((F) => F.cc))] }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return M;
}

/* ── the Peaks (ART.md section 1): each unit's best month so far ─────────── */

/** A unit's daily rate of quantity q in month m, summed over the members whose country is shown;
 *  null when a shown member's country has not reported m, so a unit is never drawn from one side. */
export function unitRateAt(M, U, q, m, shown) {
  let v = 0, any = false;
  for (const F of U.members) {
    if (!shown[F.cc]) continue;
    if (!reported(M, F.cc, m)) return null;
    any = true;
    v += monthly(F, q, m);
  }
  return any ? v / daysIn(m) : null;
}
/** The months where a unit's running maximum rises, with their rates: { m: Int16Array, v: Float64Array }.
 *  Built once per data load, quantity and set of countries shown. */
export function bestRecords(M, U, q, shown) {
  let m0 = Infinity, m1 = -Infinity;
  for (const F of U.members) if (shown[F.cc] && F.first != null) { m0 = Math.min(m0, F.first); m1 = Math.max(m1, F.end); }
  const ms = [], vs = [];
  let best = 0;
  for (let m = m0; m < m1; m++) {
    const v = unitRateAt(M, U, q, m, shown);
    if (v != null && v > best) { best = v; ms.push(m); vs.push(v); }
  }
  return { m: Int16Array.from(ms), v: Float64Array.from(vs) };
}
/** The index of the record in force at month m (the last one at or before it), or −1: a binary search. */
export function bestAt(R, m) {
  let lo = 0, hi = R.m.length - 1, k = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (R.m[mid] <= m) { k = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return k;
}

/* ── sources and the credit line ─────────────────────────────────────────── */

const SHORT = { naturalearth: 'Natural Earth', marineregions: 'Marine Regions', emodnet: 'EMODnet',
  'emodnet-bathymetry': 'EMODnet', sodir: 'Sodir', nsta: 'NSTA', dea: 'Danish Energy Agency', nlog: 'NLOG' };
export function shortSource(s) {
  const lic = String(s.licence || '').match(/CC BY(?:-SA)?|NLOD|OGL/);
  if (SHORT[s.id]) return lic ? `${SHORT[s.id]} ${lic[0]}` : SHORT[s.id];
  let name = String(s.name || s.id || '').split(' — ')[0];
  const par = name.match(/\(([^)]{2,8})\)/);
  name = par ? par[1] : name.replace(/\s*\(.*\)$/, '');
  const full = String(s.licence || '').match(/CC BY(?:-SA)? [\d.]+|NLOD [\d.]+|OGL/);
  return full ? `${name} (${full[0]})` : name;
}
/** The snapshot's sources, with the basemap and the boundaries credited whether or not it lists them. */
export function allSources(snap) {
  const list = snap && Array.isArray(snap.sources) ? snap.sources.slice() : [];
  const have = new Set(list.map((s) => s.id));
  if (!have.has('naturalearth')) list.unshift({ id: 'naturalearth', name: 'Natural Earth 1:10m: coastline, countries, bathymetry', url: 'www.naturalearthdata.com/', licence: 'Public domain', attribution: 'Basemap: Natural Earth' });
  if (!have.has('marineregions')) list.splice(1, 0, { id: 'marineregions', name: 'Marine Regions: Maritime Boundaries (Flanders Marine Institute)', url: 'www.marineregions.org/', licence: 'CC BY 4.0', attribution: 'Maritime boundaries: Flanders Marine Institute, marineregions.org (CC BY 4.0)' });
  return list;
}
/** The credit line on the plate, from the sources (EMODnet appears once though two of its sets are used). */
export const creditLine = (snap) => [...new Set(allSources(snap).map(shortSource))].join(' · ');
