/* World Oil & Gas: the data contract, its checks and its arithmetic. Pure (no DOM), so
 * tools/test_decode.mjs runs it in Node against the shipped files. Moved from app.js, not rewritten,
 * with two fixes (ART.md section 8: B1, a cumulative total held past its series' end; B5, undated
 * fields placed in their data year) and the Ledger's partition (ledgerAt, ART.md section 1).
 *
 * =============================================================================
 * THE THREE FILES IN ./data, AND THEIR SHAPES. All three are written by the
 * pipeline in scripts/shelf_atlas/ (the contract is scripts/shelf_atlas/SCHEMA.md;
 * the parts this app reads are copied here, because whatever rewrites these
 * files next year will not have read the conversation that built the app).
 * The app refuses a file that fails its shape and says which one.
 *
 * Coordinates are WGS84 lon/lat. Rings are packed with Google's polyline
 * algorithm, LON FIRST, then lat, at the file's `factor` (1000 = three
 * decimals). Rings are closed (the last point repeats the first).
 *
 * ── data/world.json: Natural Earth 1:10m countries (static) ────────────────
 * { "schema": 1, "factor": 1000, "encoding": "…", "source": "…",
 *   "countries": [{ "iso3": "NOR", "name": "Norway", "adm0": "NOR",
 *                   "c": [17.8, 68.5],               // label point, lon/lat
 *                   "rings": ["<ring>", …] }, …] }   // filled even-odd
 *   // the shading is not here: data/shade.json names two plate carrée gray images of the whole world
 *   // ("file", the sea; "land", the relief) and finer sea "tiles" with their "bounds" [w, s, e, n]
 *
 * ── data/snapshot.json: annual production by country (rebuilt yearly) ──────
 * { "schema": 1, "generatedAt": "…", "app": "World Oil & Gas",
 *   "units": { "series": "GWh per year (integer)", "boePerTWh": 588441, "note": "…" },
 *   "years": [1900, 2024],
 *   "sources": [{ "name", "url", "licence", "attribution", "detail"? }, …],
 *   "world": { "iso3": "OWID_WRL", "name": "World", "y0": 1900, "oil": [ … ], "gas": [ … ] },
 *   "countries": [{ "iso3": "NOR", "name": "Norway", "y0": 1900,
 *                   "oil": [GWh|null, …], "gas": [GWh|null, …] }, …],
 *                   // includes former states with no outline: OWID_USS, OWID_CZS, OWID_YGS
 *   "historical": { "OWID_USS": "USSR (to 1991; no outline)", … },   // optional labels
 *   "patched": [{ "iso3", "country", "year", "series", "note" }, …],  // optional: holes set to null
 *   "ask": [ … ] }                                                    // NEVER read by this app
 * `oil[k]` is the value for year `y0 + k`; `null` is "no data", not zero. `world` is what shares
 * are measured against; should a build write null there, the app falls back to the sum of every
 * series that has a value that year and says so wherever a share is printed. (`licence` is the
 * data's own key and keeps its spelling.)
 *
 * ── data/fields.json: GOGET extraction units (manual drop-in) ──────────────
 * { "schema": 1, "available": true|false, "generatedAt": "…",
 *   "reason": "…",                                    // only when available is false
 *   "source": { "name", "file", "release", "url", "licence", "attribution" },
 *   "units": { "oilBpd": "…", "gasBoepd": "…", … }, "counts": { … },
 *   "fields": [{ "id": "L…", "name": "…", "country": "…", "lat": 56.1, "lon": 2.3,
 *                "status": "operating", "fuel": "oil and gas", "type": "conventional",
 *                "operator": "…", "parents": ["…"], "disc": 1974, "fid": 1976, "start": 1979,
 *                "basin": "…", "offshore": 1|0, "approx": 1,
 *                "wiki": "<the tracker's wiki address>",   // only when not name-with-underscores
 *                "prodYear": 2023, "oilBpd": 12000, "gasBoepd": 30000,
 *                "resOilMbbl": 120.5, "resGasMboe": 30.1, "resClass": "remaining", "resYear": 2023,
 *                "rings": ["<polyline, 3 decimals>", …] }, …] }
 * When `available` is false the fields layer prints `reason` and draws nothing.
 * ========================================================================== */

export const MAX_LAT = 85;
const DEG = Math.PI / 180;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNumOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

/* Google's algorithm, pairs (lon, lat). Throws on a character outside the alphabet or a string that
 * stops mid-number, so a truncated file is caught here rather than drawn as a stray spike. */
export function decodePolyline(str, factor) {
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

/* ── shape checks: an error sentence, or '' when the file is usable ── */

export function checkWorld(w) {
  if (!w || typeof w !== 'object') return 'the file is not a JSON object';
  if (w.schema !== 1) return `schema is ${JSON.stringify(w.schema)}, expected 1`;
  if (!(Number.isFinite(w.factor) && w.factor > 0)) return '"factor" is missing or not a positive number';
  if (!Array.isArray(w.countries) || !w.countries.length) return '"countries" is missing or empty';
  for (let k = 0; k < w.countries.length; k++) {
    const c = w.countries[k];
    if (!c || !isStr(c.iso3) || typeof c.name !== 'string') return `countries[${k}] has no iso3 or name`;
    if (!Array.isArray(c.rings) || !c.rings.every(isStr)) return `countries[${k}] (${c.iso3}) has no rings`;
  }
  return '';
}

export function checkSnapshot(s) {
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

export function checkFields(f) {
  if (!f || typeof f !== 'object') return 'the file is not a JSON object';
  if (f.schema !== 1) return `schema is ${JSON.stringify(f.schema)}, expected 1`;
  if (typeof f.available !== 'boolean') return '"available" is not true or false';
  if (f.available && !Array.isArray(f.fields)) return '"available" is true but "fields" is not a list';
  return '';
}

/* ── projection: world units x ∈ [0, 1) west to east from 180° W, y ∈ [0, 1] north to south (Web Mercator) ── */

export const lonToX = (lon) => (lon + 180) / 360;
export function latToY(lat) {
  const p = clamp(lat, -MAX_LAT, MAX_LAT) * DEG;
  return 0.5 - Math.log(Math.tan(Math.PI / 4 + p / 2)) / (2 * Math.PI);
}
export const yToLat = (y) => (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) / DEG;

/* ── the series ── */

export function buildProd(s) {
  const byIso = new Map();
  for (const c of s.countries) byIso.set(c.iso3, c);
  const [Y0, Y1] = s.years, n = Y1 - Y0 + 1;
  // Per-year sums of every country with a value: the fallback denominator when the file has no world series.
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
  const cumSum = {};
  for (const m of ['oil', 'gas', 'total']) {
    const a = new Float64Array(n);
    let t = 0;
    for (let i = 0; i < n; i++) { t += sum[m][i]; a[i] = t; }
    cumSum[m] = a;
  }
  return { s, byIso, Y0, Y1, boePerTWh: s.units.boePerTWh, sum, cumSum, cum: new Map(), ledger: {}, ledgerCache: new Map() };
}

/* A series' running total: null until its first value, then the sum so far, a null year adding
 * nothing, and (B1) held at its last total from the year after the series ends up to the newest
 * year, so a country whose series stops in 2016 keeps what it produced instead of going blank. */
export function cumOf(prod, c) {
  let h = prod.cum.get(c);
  if (h) return h;
  const n = Math.max(c.oil.length, prod.Y1 - c.y0 + 1), oil = new Array(n), gas = new Array(n);
  let so = 0, sg = 0, ho = false, hg = false;
  for (let i = 0; i < n; i++) {
    if (i < c.oil.length) {
      if (c.oil[i] != null) { so += c.oil[i]; ho = true; }
      if (c.gas[i] != null) { sg += c.gas[i]; hg = true; }
    }
    oil[i] = ho ? so : null;
    gas[i] = hg ? sg : null;
  }
  h = { iso3: c.iso3, name: c.name, y0: c.y0, oil, gas };
  prod.cum.set(c, h);
  return h;
}

/* One year and mode of a series, in GWh: null for "no data", with `partial` set when a total
 * adds a number to a null. */
export function seriesAt(c, m, y, out = { v: null, partial: false }) {
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
/** The value the map shows: the year's figure, or the total to that year. */
export const valueAt = (prod, c, m, y, cum, out) => seriesAt(c && cum ? cumOf(prod, c) : c, m, y, out);
/** The world's figure, or the sum of every listed series when the file has none. */
export function worldAt(prod, m, y, cum) {
  const w = prod.s.world;
  if (w) return { v: valueAt(prod, w, m, y, cum).v, label: 'world' };
  const yi = y - prod.Y0, arr = (cum ? prod.cumSum : prod.sum)[m];
  return { v: yi >= 0 && yi < arr.length ? arr[yi] : null, label: 'countries listed' };
}
/** The first and last year with any figure, or null. */
export function seriesSpan(c) {
  let first = null, last = null;
  for (let i = 0; i < c.oil.length; i++) {
    if (c.oil[i] != null || c.gas[i] != null) { if (first == null) first = c.y0 + i; last = c.y0 + i; }
  }
  return first == null ? null : [first, last];
}

/* Former states (USSR, Czechoslovakia, Yugoslavia) have series and no outline. Fixed here because the
 * data carries no successor mapping. LEAD is each one's largest member: the Ledger's rule B replaces a
 * former state by its members in any year its lead has a figure, so no barrel is counted twice. */
export const FORMER_STATE = {};
export const LEAD = { OWID_USS: 'RUS', OWID_CZS: 'CZE', OWID_YGS: 'SRB' };
export const MEMBERS = {
  OWID_USS: ['RUS', 'UKR', 'BLR', 'KAZ', 'UZB', 'TKM', 'AZE', 'GEO', 'ARM', 'KGZ', 'TJK', 'MDA', 'LTU', 'LVA', 'EST'],
  OWID_CZS: ['CZE', 'SVK'],
  OWID_YGS: ['SRB', 'HRV', 'SVN', 'BIH', 'MKD', 'MNE', 'OWID_KOS', 'KOS'],
};
for (const [state, members] of Object.entries(MEMBERS)) for (const m of members) FORMER_STATE[m] = state;
/** The map's former states in year y: each one that holds the figure (it has one and its lead member
 *  none, as rule B), with the members that report nothing of their own then (no figure, or zero), which
 *  the map draws together in its color. [{ state, v, members }]; never a year a lead reports. */
export function formerUnions(prod, m, cum, y) {
  const out = [], r = { v: null, partial: false };
  for (const st in LEAD) {
    const h = prod.byIso.get(st), v = h && valueAt(prod, h, m, y, cum).v;
    if (v == null || valueAt(prod, prod.byIso.get(LEAD[st]), m, y, cum, r).v != null) continue;
    const members = MEMBERS[st].filter((iso) => !(valueAt(prod, prod.byIso.get(iso), m, y, cum, r).v > 0));
    if (members.length) out.push({ state: st, v, members });
  }
  return out;
}

export function historicalLabels(s) {
  const h = s && s.historical, out = {};
  if (h && typeof h === 'object') for (const k in h) if (isStr(h[k])) out[k] = h[k];
  return out;
}
/** A series' short name: a former state's label without its parenthesis ("USSR"). */
export const shortName = (s, c) => (historicalLabels(s)[c.iso3] || '').replace(/\s*\(.*\)$/, '') || c.name;

/* ── the Ledger (ART.md section 1): the world's output for one year as shares, widest first ── */

const tmp = { v: null, partial: false };
const has = (c, m, y) => !!c && seriesAt(c, m, y, tmp).v != null;
/** A series' figure for one year as the Ledger counts it (rule B), in GWh; 0 when it is not counted. */
export function counted(prod, c, m, y) {
  const v = seriesAt(c, m, y, tmp).v;
  if (!v) return 0;
  if (LEAD[c.iso3] && has(prod.byIso.get(LEAD[c.iso3]), m, y)) return 0;
  const f = FORMER_STATE[c.iso3];
  if (f && has(prod.byIso.get(f), m, y) && !has(prod.byIso.get(LEAD[f]), m, y)) return 0;
  return v;
}
/* Per mode, once per snapshot: every series' counted figure per year and its running total. */
function ledgerSeries(prod, m) {
  if (prod.ledger[m]) return prod.ledger[m];
  const { Y0, Y1 } = prod, n = Y1 - Y0 + 1, rows = [];
  for (const c of prod.s.countries) {
    const a = new Float64Array(n), cum = new Float64Array(n);
    let t = 0;
    for (let i = 0; i < n; i++) { a[i] = counted(prod, c, m, Y0 + i); cum[i] = t += a[i]; }
    if (t > 0) rows.push({ c, a, cum });
  }
  return (prod.ledger[m] = rows);
}
export const LEDGER_FLOOR = 0.01;          // a block for every producer at 1 % of the world or more
/**
 * The Ledger for mode m ('oil' | 'gas' | 'total'), annual or cumulative, in year y:
 *   world: the world's figure (GWh), null when the year has none, and then no blocks;
 *   blocks: { iso3, name, value, share (of the world), width (of the strip) }, widest first;
 *   rest: the hatched end's width; listed: the counted sum over the world; scale: what the strip is.
 * The strip is scaled to the larger of the world's figure and the counted sum, so it never overflows.
 */
export function ledgerAt(prod, m, cum, y) {
  const key = `${m}|${cum ? 1 : 0}|${y}`;
  let hit = prod.ledgerCache.get(key);
  if (hit) return hit;
  const i = y - prod.Y0, rows = ledgerSeries(prod, m), w = worldAt(prod, m, y, cum).v;
  const vals = [];
  let tot = 0;
  for (const r of rows) { const v = cum ? r.cum[i] : r.a[i]; if (v > 0) { vals.push([v, r]); tot += v; } }
  hit = { world: w || null, blocks: [], rest: 0, listed: w ? tot / w : 0, scale: 0 };
  if (w > 0) {
    const scale = Math.max(w, tot);
    vals.sort((a, b) => b[0] - a[0]);
    let used = 0;
    for (const [v, r] of vals) {
      if (v / w < LEDGER_FLOOR) break;
      let name = shortName(prod.s, r.c);
      // a former state in Cumulative once its members replace it: "USSR to 1984"
      if (cum && LEAD[r.c.iso3] && !r.a[i]) { let k = i; while (k > 0 && !r.a[k]) k--; name += ` to ${prod.Y0 + k}`; }
      hit.blocks.push({ iso3: r.c.iso3, name, value: v, share: v / w, width: v / scale });
      used += v / scale;
    }
    hit.rest = Math.max(0, 1 - used);
    hit.scale = scale;
  }
  if (prod.ledgerCache.size > 2000) prod.ledgerCache.clear();
  prod.ledgerCache.set(key, hit);
  return hit;
}

/* ── names: folded for search and matching ── */

/* Lower case, no diacritics, and the few Latin letters that do not decompose spelled out. */
const FOLD = { 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i', '’': "'", '‘': "'" };
export function fold(v) {
  return String(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[øæœßłđðþı’‘]/g, (ch) => FOLD[ch]).replace(/\s+/g, ' ').trim();
}
/* The tracker's `country` against the snapshot's `name`, after folding. The 2026 files differ only in
 * the first three; the rest are the usual long forms, so a rebuilt file that spells them officially
 * still matches. */
const COUNTRY_ALIAS = {
  'republic of the congo': 'congo', 'congo-brazzaville': 'congo', 'congo (brazzaville)': 'congo',
  'turkiye': 'turkey',
  'united states of america': 'united states', 'usa': 'united states',
  'russian federation': 'russia', 'iran (islamic republic of)': 'iran', 'islamic republic of iran': 'iran',
  'venezuela (bolivarian republic of)': 'venezuela', 'syrian arab republic': 'syria',
  "lao people's democratic republic": 'laos', 'lao pdr': 'laos', 'viet nam': 'vietnam',
  'bolivia (plurinational state of)': 'bolivia', 'united republic of tanzania': 'tanzania',
  'czech republic': 'czechia', 'democratic republic of the congo': 'democratic republic of congo',
  'dr congo': 'democratic republic of congo', 'congo (kinshasa)': 'democratic republic of congo',
  'timor-leste': 'east timor', 'brunei darussalam': 'brunei', 'republic of korea': 'south korea',
  'cabo verde': 'cape verde', 'the gambia': 'gambia', 'the bahamas': 'bahamas', 'myanmar (burma)': 'myanmar',
};
export const countryKey = (name) => { const k = fold(name); return COUNTRY_ALIAS[k] || k; };

/* ── fields ── */

export function buildFields(f) {
  const out = { raw: f, available: !!f.available, points: [], byId: new Map(), byCountry: new Map(),
                companies: [], basins: [], skipped: 0,
                factor: Number.isFinite(f.factor) && f.factor > 0 ? f.factor : 1000 };
  if (!f.available) return out;
  const points = out.points;
  const int = (v) => (Number.isInteger(v) ? v : null);
  for (const x of f.fields) {
    if (!x || !Number.isFinite(x.lat) || !Number.isFinite(x.lon) || Math.abs(x.lat) > 90 || Math.abs(x.lon) > 180) {
      out.skipped++;
      continue;
    }
    const oil = Number.isFinite(x.oilBpd) ? x.oilBpd : null;
    const gas = Number.isFinite(x.gasBoepd) ? x.gasBoepd : null;
    const fuel = String(x.fuel || '').toLowerCase().trim();
    const status = String(x.status || '').toLowerCase().trim();
    points.push({
      f: x,
      id: String(x.id ?? `${x.name}|${x.lat}|${x.lon}`),
      x: lonToX(x.lon), y: latToY(x.lat),
      oil, gas, v: oil == null && gas == null ? null : (oil || 0) + (gas || 0),
      fuel: fuel === 'oil' ? 'oil' : fuel === 'gas' ? 'gas' : fuel === 'oil and gas' ? 'both' : 'other',
      status, operating: status === 'operating',
      off: x.offshore === 1 ? 1 : x.offshore === 0 ? 0 : -1,
      type: String(x.type || '').toLowerCase().trim(),
      disc: int(x.disc), start: int(x.start), prodYear: int(x.prodYear),
      parents: Array.isArray(x.parents) ? [...new Set(x.parents.filter(isStr))] : [],
      basin: isStr(x.basin) ? x.basin.trim() : null,
      rings: Array.isArray(x.rings) && x.rings.length ? x.rings : null,
      norm: fold(isStr(x.name) ? x.name : ''),
      appear: -Infinity, fill: -Infinity, undated: true, pass: 1, hl: 1, outline: undefined,
    });
  }
  // Biggest first, so the small ones are drawn last and stay tappable on top.
  points.sort((a, b) => (b.v ?? -1) - (a.v ?? -1));
  const comp = new Map(), bas = new Map();
  const add = (m, k, p) => { const a = m.get(k); if (a) a.push(p); else m.set(k, [p]); };
  for (const p of points) {
    out.byId.set(p.id, p);
    if (isStr(p.f.country)) add(out.byCountry, countryKey(p.f.country), p);
    for (const c of p.parents) add(comp, c, p);
    if (p.basin) add(bas, p.basin, p);
  }
  const group = (m) => [...m].map(([name, pts]) => ({ name, norm: fold(name), pts }));
  out.companies = group(comp);
  out.basins = group(bas);
  return out;
}

/* When each unit is on the map (appear) and filled (fill), as years:
 *   disc and start   → a ring from disc, filled from start;
 *   start only       → appears at start, filled;
 *   disc only        → a ring from disc; if it is operating and has a rate, filled from disc too;
 *                      operating without a rate, filled from its prodYear, or the newest year
 *                      when later or missing;
 *   neither (B5)     → appears filled the year before its data year (clamped to the years shown),
 *                      or in the newest year when it has no data year: never in every year, as the
 *                      stock app drew them.
 * No end year exists, so mothballed or abandoned units stay as they were. */
export function fieldYears(fields, Y0, Y1) {
  if (!fields || !fields.available) return;
  for (const p of fields.points) {
    const d = p.disc, st = p.start;
    p.undated = d == null && st == null;
    if (p.undated) { p.appear = p.fill = p.prodYear != null ? clamp(p.prodYear - 1, Y0, Y1) : Y1; continue; }
    if (st != null) { p.appear = d == null ? st : Math.min(d, st); p.fill = st; continue; }
    p.appear = d;
    p.fill = !p.operating ? Infinity : p.v != null ? d : Math.max(d, Math.min(p.prodYear ?? Y1, Y1));
  }
}

/* ── field sizes (plan 0012 D23, the owner's choice: fields as reported, no estimates) ─────────── *
 * The tracker gives ONE output figure per unit, for its prodYear, and no series. So a field is sized only
 * in Annual at the newest year, by that figure for the mode shown; in every other year, and in
 * Cumulative, it is an unsized dot. Nothing here draws or prints a field figure for a year the tracker
 * does not report it. */
/** The unit's reported figure for mode m ('oil' | 'gas' | 'total'), boe/d, or null when it reports none. */
export const fieldRate = (p, m) => (m === 'oil' ? p.oil : m === 'gas' ? p.gas : p.v);
/** Whether discs are sized in year y: Annual, at the newest year Y1, only. */
export const sizesShown = (cum, y, Y1) => !cum && y === Y1;
/** The figure a field's disc is sized by in year y: a number (0 included), or null for an unsized dot. */
export const sizeOf = (p, m, cum, y, Y1) => (sizesShown(cum, y, Y1) ? fieldRate(p, m) : null);

/* ── the credit line: one short name per source, word for word as the stock app built it ── */
export function shortSource(a) {
  if (/energy institute/i.test(a)) return /our world in data/i.test(a) ? 'Energy Institute via Our World in Data' : 'Energy Institute';
  for (const n of ['Our World in Data', 'Natural Earth', 'Global Energy Monitor']) if (a.toLowerCase().includes(n.toLowerCase())) return n;
  return a.replace(/^[^:]{1,30}:\s*/, '').replace(/\s*\([^)]*\)\s*$/, '');
}
export const creditLine = (attributions) => `Sources: ${[...new Set(attributions.map(shortSource))].join(' · ')}`;
