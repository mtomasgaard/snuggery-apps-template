// The data (DESIGN §4.5, §12; CONTRACT §3–§5): validate data/snapshot.json against the contract with a
// sentence on the first failure, index its steps, and decode all 171 frames into one Uint8Array for the
// array texture — the step to be shown first, then the queue of §4.4 (wanted, read-ahead in the drag's
// direction, the rest), up to four inflates in flight, each checked to be exactly 16 200 bytes. Also
// world.json's delta rings and places.json's tiers. No DOM: tools/test_decode.mjs imports this in Node.

import { group, monthName, MON, toHundredths, si } from './units.js';

export const NX = 180, NY = 90, CELLS = NX * NY;
export const NONE = 255;
const FIRST_YEAR = 1880;

/* ── validation (DESIGN §12.1): the first failure, in words a person can act on, or null ── */
const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;
const PARTIAL = /^(\d{4}), Jan–(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \(partial\)$/;

function checkStep(s, name) {
  if (!isNum(s.globalMean)) return `${name} has no global mean`;
  if (!s.coverage || !isNum(s.coverage.area) || s.coverage.area < 0 || s.coverage.area > 1) return `${name} has no coverage between 0 and 1`;
  if (!s.beyondScale || !isInt(s.beyondScale.above) || !isInt(s.beyondScale.below) || s.beyondScale.above < 0 || s.beyondScale.below < 0) return `${name} has no count of cells beyond the scale`;
  if (!s.planes || !isStr(s.planes['anom.v'])) return `${name} has no map`;
  return null;
}

/** Returns null when the snapshot follows the contract, else the first failed check as a phrase. */
export function validate(snap, maxLayers = 256) {
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return 'it is not a JSON object';
  if (snap.schema !== 1) return `its schema is ${JSON.stringify(snap.schema)}, expected 1`;
  if (snap.app !== 'Warming World') return `it is for ${JSON.stringify(snap.app)}, not Warming World`;
  if (!isStr(snap.generatedAt) || !Number.isFinite(Date.parse(snap.generatedAt))) return 'it has no time it was made (generatedAt)';
  const g = snap.grid || {};
  if (g.nx !== NX || g.ny !== NY) return `the grid is ${g.nx} × ${g.ny} cells, expected 180 × 90`;
  if (g.lon0 !== -179 || g.lat0 !== 89 || g.dlon !== 2 || g.dlat !== -2 || g.cells !== true) return 'the grid is not 2° cells from 89° N and 179° W';
  const e = snap.encoding || {};
  if (e.compression !== 'deflate' || e.delta !== 'none' || e.none !== NONE) return 'its encoding is not deflate with no delta and 255 for no data';
  const L = snap.layers;
  if (!Array.isArray(L) || L.length !== 1 || !L[0] || L[0].key !== 'anom') return 'it does not hold the one anomaly layer';
  const v = L[0].planes && L[0].planes.v;
  if (!v || !isNum(v.offset) || v.step !== 0.1 || v.power !== 1 || v.none !== NONE) return 'its anomaly plane is not 0.1\u202f°C steps with 255 for no data';
  const r = snap.release || {};
  if (!isStr(r.id) || !isStr(r.created) || !YM.test(r.newestMonth || '') || (r.mode !== 'live' && r.mode !== 'research')) return 'its release is not described';
  if (!/^\d{4}-\d{4}$/.test(r.base || '')) return 'it does not name its base period';
  const steps = snap.steps;
  if (!Array.isArray(steps) || !steps.length) return 'it holds no years';
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i], last = i === steps.length - 1;
    if (!s || s.year !== FIRST_YEAR + i) return `year ${i + 1} is ${s && s.year}, expected ${FIRST_YEAR + i} (years run from ${FIRST_YEAR} without gaps)`;
    if (typeof s.partial !== 'boolean' || (s.partial && !last)) return `${s.year} is marked partial but is not the newest year`;
    if (!isInt(s.months) || s.months < 1 || s.months > 12) return `${s.year} has no month count`;
    if (s.partial) {
      const m = PARTIAL.exec(s.label || '');
      if (!m || +m[1] !== s.year || MON.indexOf(m[2]) + 1 !== s.months) return `the partial year's label ${JSON.stringify(s.label)} does not name its ${s.months} months`;
    } else if (s.label !== String(s.year) || s.months !== 12) return `${s.year} is not a complete year of 12 months`;
    const bad = checkStep(s, String(s.year));
    if (bad) return bad;
  }
  const months = snap.months;
  if (!Array.isArray(months) || months.length < 1 || months.length > 24) return `it holds ${Array.isArray(months) ? months.length : 'no'} months, expected 1 to 24`;
  for (let i = 0; i < months.length; i++) {
    const m = months[i], k = m && YM.exec(m.month || '');
    if (!k) return `month ${i + 1} has no YYYY-MM`;
    if (i) {
      const p = YM.exec(months[i - 1].month), want = +p[1] * 12 + +p[2];
      if (+k[1] * 12 + +k[2] !== want + 1) return `${m.month} does not follow ${months[i - 1].month}`;
    }
    const bad = checkStep(m, monthName(m.month, true));
    if (bad) return bad;
  }
  if (months[months.length - 1].month !== r.newestMonth) return `its newest month ${months[months.length - 1].month} is not the release's ${r.newestMonth}`;
  if (steps.length + months.length > maxLayers) return `it holds ${steps.length + months.length} maps, more than this device's ${maxLayers}`;
  if (!isStr(snap.source && snap.source.attribution)) return 'it has no attribution line';
  return null;
}

/* ── the indexes built once per load (DESIGN §12.2) ── */
/**
 * steps: the annual entries; months: the 24; layer k < steps.length is a year, then the months.
 * Every number the app prints for a step comes from here, i.e. from the snapshot.
 */
export function index(snap) {
  const ny = snap.steps.length, nm = snap.months.length, L = ny + nm;
  const plane = snap.layers[0].planes.v;
  // byte → tenths of a degree, from the plane's own offset and step (exact for −12.7 + 0.1·b)
  const tenths = new Int16Array(256);
  for (let b = 0; b < 256; b++) tenths[b] = b === NONE ? 0 : Math.round((plane.offset + plane.step * b) * 10);
  const meanH = new Int32Array(L), area = new Float64Array(L), above = new Int32Array(L), below = new Int32Array(L);
  const name = [], short = [];
  const all = [...snap.steps, ...snap.months];
  all.forEach((s, k) => {
    meanH[k] = toHundredths(s.globalMean); area[k] = s.coverage.area;
    above[k] = s.beyondScale.above; below[k] = s.beyondScale.below;
    name.push(s.label || (k < ny ? String(s.year) : monthName(s.month, true)));
    short.push(k < ny ? String(s.year) : monthName(s.month));
  });
  const last = snap.steps[ny - 1];
  const partial = last.partial ? ny - 1 : -1;
  const lastComplete = partial >= 0 ? ny - 2 : ny - 1;
  const span = partial >= 0 ? PARTIAL.exec(last.label)[2] : null;
  return {
    ny, nm, L, tenths, meanH, area, above, below, name, short, partial, lastComplete,
    partialMonths: partial >= 0 ? last.months : 0,
    partialSpan: span ? `Jan–${span}` : '',                  // "Jan–Jul"
    years: snap.steps.map((s) => s.year), monthKeys: snap.months.map((m) => m.month),
    base: snap.release.base.split('-').map(Number), baseText: snap.release.base.replace('-', '\u2013'),   // [1951, 1980], "1951–1980"
    release: snap.release, generatedAt: snap.generatedAt, attribution: si(snap.source.attribution),
    sources: snap.sources || [],
  };
}

/* ── inflate: DecompressionStream, else Global Weather's RFC 1950/1951 decoder (app.js, copied) ── */
export function b64ToBytes(s) {
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* Copied from Global Weather's app.js (inflateRaw, unzlib), unchanged in logic. The cap is the whole
   defence against a crafted plane: it never writes more than `expected` bytes (plus one, so an
   over-long frame is reported as such). */
function inflateRaw(src, expected) {
  const LENS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DISTS = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  const cap = expected + 1;
  let bitPos = 0, outLen = 0;
  const out = new Uint8Array(cap);
  const bit = () => {
    const byte = src[bitPos >> 3];
    if (byte === undefined) throw new Error('the compressed data ends mid-symbol');
    const v = (byte >> (bitPos & 7)) & 1;
    bitPos++;
    return v;
  };
  const bits = (n) => { let v = 0; for (let i = 0; i < n; i++) v |= bit() << i; return v; };
  const room = (extra) => { if (outLen + extra > cap) throw new RangeError('over'); };
  const build = (lengths, n) => {
    const count = new Int32Array(16);
    for (let i = 0; i < n; i++) count[lengths[i]]++;
    count[0] = 0;
    const offsets = new Int32Array(16);
    for (let len = 1; len < 15; len++) offsets[len + 1] = offsets[len] + count[len];
    const symbols = new Int32Array(n);
    for (let i = 0; i < n; i++) if (lengths[i]) symbols[offsets[lengths[i]]++] = i;
    return { count, symbols };
  };
  const decode = (table) => {
    let code = 0, first = 0, idx = 0;
    for (let len = 1; len < 16; len++) {
      code |= bit();
      const count = table.count[len];
      if (code - first < count) return table.symbols[idx + (code - first)];
      idx += count; first = (first + count) << 1; code <<= 1;
    }
    throw new Error('the compressed data holds an impossible code');
  };
  let fixedLit = null, fixedDist = null;
  const fixed = () => {
    if (fixedLit) return;
    const lengths = new Uint8Array(288);
    lengths.fill(8, 0, 144); lengths.fill(9, 144, 256); lengths.fill(7, 256, 280); lengths.fill(8, 280, 288);
    fixedLit = build(lengths, 288);
    fixedDist = build(new Uint8Array(30).fill(5), 30);
  };
  const block = (lit, dist) => {
    for (;;) {
      const symbol = decode(lit);
      if (symbol === 256) return;
      if (symbol < 256) { room(1); out[outLen++] = symbol; continue; }
      const s = symbol - 257;
      if (s >= LENS.length) throw new Error('the compressed data holds an invalid length');
      const length = LENS[s] + bits(LEXT[s]);
      const d = decode(dist);
      if (d >= DISTS.length) throw new Error('the compressed data holds an invalid distance');
      const distance = DISTS[d] + bits(DEXT[d]);
      if (distance > outLen) throw new Error('the compressed data points before its start');
      room(length);
      let from = outLen - distance;
      for (let i = 0; i < length; i++) out[outLen++] = out[from++];
    }
  };
  for (;;) {
    const last = bit(), type = bits(2);
    if (type === 0) {
      bitPos = (bitPos + 7) & ~7;
      const at = bitPos >> 3, length = src[at] | (src[at + 1] << 8), check = src[at + 2] | (src[at + 3] << 8);
      if ((length ^ 0xffff) !== check) throw new Error('a stored block has a bad length');
      room(length);
      out.set(src.subarray(at + 4, at + 4 + length), outLen);
      outLen += length;
      bitPos = (at + 4 + length) << 3;
    } else if (type === 1) { fixed(); block(fixedLit, fixedDist); }
    else if (type === 2) {
      const nlit = bits(5) + 257, ndist = bits(5) + 1, nclen = bits(4) + 4;
      const clen = new Uint8Array(19);
      for (let i = 0; i < nclen; i++) clen[ORDER[i]] = bits(3);
      const codeTable = build(clen, 19), lengths = new Uint8Array(nlit + ndist);
      for (let i = 0; i < nlit + ndist;) {
        const symbol = decode(codeTable);
        if (symbol < 16) lengths[i++] = symbol;
        else if (symbol === 16) {
          if (i === 0) throw new Error('the compressed data repeats nothing');
          const prev = lengths[i - 1];
          for (let n = 3 + bits(2); n > 0; n--) lengths[i++] = prev;
        } else if (symbol === 17) for (let n = 3 + bits(3); n > 0; n--) lengths[i++] = 0;
        else for (let n = 11 + bits(7); n > 0; n--) lengths[i++] = 0;
      }
      block(build(lengths.subarray(0, nlit), nlit), build(lengths.subarray(nlit), ndist));
    } else throw new Error('the compressed data holds an unknown block type');
    if (last) break;
  }
  return out.subarray(0, outLen);
}
function unzlib(bytes, expected) {
  if (bytes.length < 6) throw new Error('the compressed data is too short');
  const cmf = bytes[0], flg = bytes[1];
  if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 || flg & 0x20) throw new Error('the compressed data has a bad header');
  return inflateRaw(bytes.subarray(2), expected);
}
/* The native path, read chunk by chunk into a buffer of the frame's size plus one byte, so a frame
   that expands past it is stopped as the bytes arrive (Global Weather's inflateNative). */
async function inflateNative(bytes, expected) {
  const cap = expected + 1, out = new Uint8Array(cap);
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  let n = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (n + value.length > cap) { reader.cancel().catch(() => {}); throw new RangeError('over'); }
    out.set(value, n); n += value.length;
  }
  return out.subarray(0, n);
}
export let inflateRoute = typeof DecompressionStream === 'function' ? 'native' : 'copied';
/** zlib bytes → exactly `expected` bytes, or a RangeError('over') / Error naming the defect. */
export async function inflate(bytes, expected, forceCopied = false) {
  if (!forceCopied && typeof DecompressionStream === 'function') {
    try { return await inflateNative(bytes, expected); } catch (e) { if (e instanceof RangeError) throw e; }
    inflateRoute = 'copied';
  }
  return unzlib(bytes, expected);
}

/** One frame: base64 → zlib → 16 200 bytes, or an Error whose message is the sentence (§3.7). */
export async function decodeFrame(b64, name, forceCopied = false) {
  let bytes;
  try { bytes = await inflate(b64ToBytes(b64), CELLS, forceCopied); } catch (e) {
    throw new Error(e instanceof RangeError ? `${name} holds more than ${group(CELLS)} cells` : `${name}'s map could not be inflated (${e.message})`);
  }
  if (bytes.length !== CELLS) throw new Error(`${name} holds ${group(bytes.length)} cell${bytes.length === 1 ? '' : 's'}, expected ${group(CELLS)}`);
  return bytes;
}

/**
 * The decode queue (DESIGN §4.4–4.5). frames: Uint8Array(L × 16 200). onFrame(layer) runs after each
 * frame is copied in (the app uploads it); onError(message) on the first bad frame, after which the
 * queue stops. prioritize(wanted, dir) reorders what is not yet started.
 */
export function createDecoder(snap, frames, { onFrame, onError, onDone, concurrency = 4, delay = 0 } = {}) {
  const all = [...snap.steps, ...snap.months];
  const L = all.length, names = all.map((s) => s.label || monthName(s.month, true));
  const b64 = all.map((s) => s.planes['anom.v']);
  const resident = new Uint8Array(L), started = new Uint8Array(L);
  let wanted = 0, dir = 1, inflight = 0, done = 0, failed = false, stopped = false;
  const stats = { decoded: 0, msTotal: 0, t0: 0, t1: 0, order: [] };
  const D = { resident, stats, L, delay };

  function next() {
    if (!started[wanted]) return wanted;
    for (let k = 1; k < L; k++) { const c = wanted + k * dir; if (c < 0 || c >= L) break; if (!started[c]) return c; }
    for (let k = 1; k < L; k++) {
      const a = wanted - k * dir, b = wanted + k * dir;
      if (a >= 0 && a < L && !started[a]) return a;
      if (b >= 0 && b < L && !started[b]) return b;
    }
    return -1;
  }
  async function run(layer) {
    started[layer] = 1; inflight++;
    const t = Date.now();
    try {
      if (D.delay) await new Promise((r) => setTimeout(r, D.delay));
      const bytes = await decodeFrame(b64[layer], names[layer]);
      if (stopped) return;
      frames.set(bytes, layer * CELLS);
      resident[layer] = 1;
      b64[layer] = null;                                   // drop the base64 string at once (§4.5 step 4)
      if (all[layer].planes) all[layer].planes = null;
      stats.decoded++; stats.msTotal += Date.now() - t; stats.order.push(layer);
      done++;
      if (onFrame) onFrame(layer);
      if (done === L) { stats.t1 = Date.now(); if (onDone) onDone(); }
    } catch (e) {
      if (!failed && !stopped) { failed = true; if (onError) onError(e.message); }
    } finally { inflight--; pump(); }
  }
  function pump() {
    while (!failed && !stopped && inflight < concurrency) {
      const k = next();
      if (k < 0) return;
      run(k);
    }
  }
  D.start = (first) => { stats.t0 = Date.now(); wanted = first; pump(); };
  D.prioritize = (w, d) => { wanted = Math.max(0, Math.min(L - 1, w)); if (d) dir = d > 0 ? 1 : -1; pump(); };
  D.stop = () => { stopped = true; };
  D.complete = () => done === L;
  D.queue = () => ({ inflight, done, L, failed });
  return D;
}

/** Every frame at once (tests, and a snapshot replaced while the app is open, §12.3). */
export async function decodeAll(snap, opts = {}) {
  const L = snap.steps.length + snap.months.length, frames = new Uint8Array(L * CELLS);
  await new Promise((resolve, reject) => {
    const d = createDecoder(snap, frames, { ...opts, onDone: resolve, onError: (m) => reject(new Error(m)) });
    d.start(0);
  });
  return frames;
}

/* ── assets/world.json (CONTRACT §5.1): delta rings in hundredths of a degree ── */
/**
 * → { land, lakes, borders }, each { lon, lat (Float64Array, degrees), start, count (Int32Array),
 * cut (Uint8Array: 1 where the segment ending at this vertex is not a coastline) }. Cut segments are
 * Natural Earth's polygon seams: along the ±180° meridian and along the South Pole's line.
 */
export function decodeWorld(w) {
  if (!w || w.v !== 1 || !Array.isArray(w.land) || !Array.isArray(w.borders)) throw new Error('assets/world.json is not the expected shape');
  const pack = (lines) => {
    let n = 0;
    for (const r of lines) n += r.length / 2;
    const lon = new Float64Array(n), lat = new Float64Array(n), cut = new Uint8Array(n);
    const start = new Int32Array(lines.length), count = new Int32Array(lines.length);
    let o = 0;
    lines.forEach((r, k) => {
      start[k] = o; count[k] = r.length / 2;
      let x = 0, y = 0;
      for (let i = 0; i < r.length; i += 2, o++) {
        x += r[i]; y += r[i + 1];
        lon[o] = x / 100; lat[o] = y / 100;
        if (i && ((Math.abs(lon[o]) >= 179.99 && lon[o] === lon[o - 1]) || (lat[o] <= -89.99 && lat[o - 1] <= -89.99))) cut[o] = 1;
      }
    });
    return { lon, lat, cut, start, count, n: lines.length };
  };
  const rings = (polys) => { const out = []; for (const p of polys || []) for (const r of p) out.push(r); return out; };
  return { land: pack(rings(w.land)), lakes: pack(rings(w.lakes)), borders: pack(w.borders) };
}

/* ── assets/places.json (CONTRACT §5.2): [{n, lon, lat, r}] sorted by tier ── */
export function decodePlaces(p) {
  if (!Array.isArray(p)) throw new Error('assets/places.json is not a list');
  return p.filter((q) => q && isStr(q.n) && isNum(q.lon) && isNum(q.lat) && isInt(q.r) && q.r >= 1 && q.r <= 4);
}

/** The layer and cell under (lon, lat) — CONTRACT §4. */
export function cellOf(lon, lat) {
  const w = ((((lon + 180) % 360) + 360) % 360) - 180;
  const i = Math.min(NX - 1, Math.floor((w + 180) / 2)), j = Math.max(0, Math.min(NY - 1, Math.floor((90 - lat) / 2)));
  return { row: j, col: i, k: j * NX + i };
}

/**
 * The mean of the cells with a value in a polar cap on layer k, area-weighted (cos latitude), from the
 * frame's own 0.1 °C values: rows 0 … rows−1 for the north, 89 … 90−rows for the south. Returns the
 * mean in integer hundredths (half away from zero; null when no cell has a value) and the share of
 * the cap's area that has a value. rows 13 is 64° to the pole: the ask rows' north64AnomalyC and
 * south64AnomalyC are this mean, computed the same way by the pipeline (build_snapshot.cap_mean).
 * A tie within 1e-9 is a tie: a cap with values in one row only has an exact half-hundredth mean,
 * which floating point lands a hair below (1888 south of 64° S: 0.175 °C, +0.18, not +0.17).
 */
export function capMean(frames, idx, k, which, rows = 13, val = null) {
  let s = 0, w = 0, all = 0;
  for (let r = 0; r < rows; r++) {
    const row = which === 'n' ? r : NY - 1 - r, wt = Math.cos(((89 - 2 * row) * Math.PI) / 180), o = k * CELLS + row * NX;
    for (let c = 0; c < NX; c++) {
      all += wt;
      const v = val ? val(k, row * NX + c) : frames[o + c] === NONE ? null : idx.tenths[frames[o + c]];   // val: another measure's tenths
      if (v != null) { s += wt * v; w += wt; }
    }
  }
  const x = (Math.abs(s) / w) * 10, f = Math.floor(x);
  return { h: w ? Math.sign(s) * (x - f >= 0.5 - 1e-9 ? f + 1 : f) : null, share: all ? w / all : 0 };
}
