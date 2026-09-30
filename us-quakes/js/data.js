// Loading and validating every data file against tools/CONTRACT.md, and nothing that touches the DOM:
// history.json and history.bin (one column decoder, each section at its own offset since N is odd), the
// snapshot (base64 of zlib inflated by DecompressionStream into exactly the declared size), the join at
// the cutoff, the text table, geo.json's polylines and views, and the X/Y of the map's axis.

import { lowerBound } from './util.js';
import { minOf } from './units.js';

const TYPED = { uint8: Uint8Array, uint16: Uint16Array, uint32: Uint32Array, utf8: Uint8Array };
const WIDTH = { uint8: 1, uint16: 2, uint32: 4, utf8: 1 };
export const COLS = { t: 'uint32', x: 'uint16', y: 'uint16', d: 'uint16', m: 'uint8', f: 'uint8' };
const LIVE = { felt: 'uint16', alert: 'uint8', tsunami: 'uint8', sig: 'uint16', updated: 'uint32' };
const X_MAX = 62000, Y_MAX = 55000;
const fail = (why) => { throw new Error(why); };
const utf8Lines = (bytes) => (bytes.length ? new TextDecoder('utf-8', { fatal: true }).decode(bytes).split('\n') : []);

// inflate (DESIGN §11.2): DecompressionStream into exactly the declared size, refusing more
async function inflateNative(bytes, cap) {
  const out = new Uint8Array(cap);
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
  let n = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (n + value.length > cap) { reader.cancel().catch(() => {}); throw new RangeError('the compressed data expands past its declared size'); }
    out.set(value, n); n += value.length;
  }
  return out.subarray(0, n);
}
export async function inflate(bytes, cap) {
  if (typeof DecompressionStream !== 'function') fail('this device cannot decompress it (no DecompressionStream)');
  try { return await inflateNative(bytes, cap); } catch (e) { fail(e instanceof RangeError ? e.message : 'the compressed data is not zlib'); }
}

// history.bin + history.json (CONTRACT §2)
export function decodeHistory(meta, buf) {
  if (!meta || meta.schema !== 1 || meta.file !== 'history.bin') fail('assets/history.json is not the catalog\'s index');
  if (buf.byteLength !== meta.bytes) fail(`assets/history.bin is ${buf.byteLength} bytes, not the ${meta.bytes} its index states`);
  const n = meta.count, sec = meta.sections;
  const view = (name, type) => {
    const s = sec[name];
    if (!s || s.type !== type || s.offset % 4 || s.offset + s.count * WIDTH[type] > buf.byteLength) fail(`assets/history.bin: section ${name} is not where the contract puts it`);
    return new TYPED[type](buf, s.offset, s.count);
  };
  const cols = {};
  for (const [k, type] of Object.entries(COLS)) { cols[k] = view(k, type); if (cols[k].length !== n) fail(`assets/history.bin: column ${k} has the wrong length`); }
  checkCols(cols, n, meta.magTypes.length, 'assets/history.bin');
  const cutoff = minOf(Date.parse(meta.cutoff + 'T00:00:00Z'));
  if (n && cols.t[n - 1] >= cutoff) fail('assets/history.bin holds rows after its cutoff');
  const rows = view('text_row', 'uint32');
  const ids = utf8Lines(view('id_text', 'utf8')), places = utf8Lines(view('place_text', 'utf8'));
  checkText(rows, ids, places, n, 'assets/history.bin');
  return { n, cols, magTypes: meta.magTypes, status: meta.status, cutoff, boxes: meta.boxes, text: { rows, ids, places }, meta };
}

function checkCols(c, n, nTypes, where) {
  const { t, x, y, f } = c;
  for (let i = 0; i < n; i++) {
    if (x[i] > X_MAX || y[i] > Y_MAX) fail(`${where}: row ${i} lies outside the map's axis`);
    const mt = f[i] >> 2;
    if (mt !== 63 && mt >= nTypes) fail(`${where}: row ${i} names a magnitude type the file does not list`);
    if (i && t[i] < t[i - 1]) fail(`${where}: the times are not sorted`);
  }
}
function checkText(rows, ids, places, n, where) {
  if (ids.length !== rows.length || places.length !== rows.length) fail(`${where}: the id and place tables do not match their rows`);
  for (let i = 0; i < rows.length; i++) if (rows[i] >= n || (i && rows[i] <= rows[i - 1])) fail(`${where}: the text rows are out of order`);
}

// data/snapshot.json (CONTRACT §3)
const b64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
async function unpack(sec, type, count, name) {
  if (!sec || sec.type !== type || typeof sec.data !== 'string') fail(`section ${name} is missing or of the wrong type`);
  const bytes = count * WIDTH[type];
  if (type === 'utf8' ? !(sec.bytes >= 0 && sec.bytes <= 16e6) : sec.bytes !== bytes) fail(`section ${name} declares ${sec.bytes} bytes for ${count} rows`);
  let raw;
  try { raw = await inflate(b64(sec.data), sec.bytes); } catch (e) { fail(`section ${name}: ${e.message}`); }
  if (raw.length !== sec.bytes) fail(`section ${name} inflates to ${raw.length} bytes, not ${sec.bytes}`);
  return type === 'utf8' ? raw : new TYPED[type](raw.buffer, raw.byteOffset, count);
}

export function parseSnapshot(text) {
  let s;
  try { s = JSON.parse(text); } catch {
    fail('data/snapshot.json is not valid JSON' + (text.trim().startsWith('<') ? ' — it looks like a web page was written over it' : ''));
  }
  if (s && typeof s === 'object' && 'message' in s && !s.rows) {
    fail(`the file holds a service's reply (“${String(s.message).slice(0, 80)}”) instead of earthquake data — check the token in the Shortcut`);
  }
  return s;
}

export async function decodeSnapshot(s) {
  const bad = (why) => fail(`data/snapshot.json is not a US Quakes snapshot: ${why}`);
  if (!s || s.schema !== 1 || s.app !== 'US Quakes') bad('its schema or app name is wrong');
  const gen = Date.parse(s.feed && s.feed.generated), made = Date.parse(s.generatedAt);
  if (!Number.isFinite(gen) || !Number.isFinite(made)) bad('generatedAt or feed.generated is missing');
  const r = s.rows;
  if (!r || r.compression !== 'zlib' || r.encoding !== 'base64' || !Array.isArray(r.magTypes)) bad('its rows are not base64 of zlib');
  const n = r.count, int = (v) => Number.isInteger(v) && v >= 0;
  if (!int(n) || n > 2e6 || !int(r.liveFirst) || r.liveFirst > n || ![r.from, r.liveFrom, r.to].every(int) || !(r.from <= r.liveFrom && r.liveFrom <= r.to)) bad('its row counts or time bounds are not consistent');
  const cols = {};
  try {
    for (const [k, type] of Object.entries(COLS)) cols[k] = await unpack(r.columns && r.columns[k], type, n, k);
    checkCols(cols, n, r.magTypes.length, 'the rows');
    for (let i = 0; i < n; i++) {
      if (cols.t[i] < r.from || cols.t[i] > r.to) fail(`row ${i} lies outside the file's own time bounds`);
      if (i < r.liveFirst && (cols.m[i] < 45 || cols.m[i] === 255)) fail(`row ${i} is below magnitude 2.5 before the live part`);
    }
    if (r.liveFirst < n && cols.t[r.liveFirst] < r.liveFrom) fail('the live part starts before liveFrom');
    const T = r.text || {};
    const rows = await unpack(T.text_row, 'uint32', T.rows, 'text_row');
    const ids = utf8Lines(await unpack(T.id_text, 'utf8', 0, 'id_text'));
    const places = utf8Lines(await unpack(T.place_text, 'utf8', 0, 'place_text'));
    checkText(rows, ids, places, n, 'the text table');
    const live = {};
    for (const [k, type] of Object.entries(LIVE)) live[k] = await unpack(r.live && r.live[k], type, n - r.liveFirst, k);
    return {
      n, cols, magTypes: r.magTypes, status: r.status, from: r.from, liveFrom: r.liveFrom, to: r.to,
      liveFirst: r.liveFirst, gen, generatedAt: s.generatedAt, cutoff: s.cutoff, feed: s.feed,
      text: { rows, ids, places }, live, volcanoes: s.volcanoes || null, sources: Array.isArray(s.sources) ? s.sources : [],
    };
  } catch (e) { return bad(e.message); }
}

// the join at the cutoff (DESIGN §7.1): no id matching, so no row twice; a stretch neither covers is a gap
export function join(H, S) {
  const cut = H.cutoff;
  const skip = S ? lowerBound(S.cols.t, cut) : 0;
  const ns = S ? S.n - skip : 0, n = H.n + ns;
  const C = { n, nh: H.n, skip, H, S };
  for (const [k, type] of Object.entries(COLS)) {
    const a = new TYPED[type](n);
    a.set(H.cols[k]);
    if (ns) a.set(S.cols[k].subarray(skip), H.n);
    C[k] = a;
  }
  const hr = H.text.rows, sr = S ? S.text.rows : [];
  const s0 = S ? lowerBound(sr, skip) : 0;
  C.textRows = new Uint32Array(hr.length + sr.length - s0);
  C.textRows.set(hr);
  for (let i = s0; i < sr.length; i++) C.textRows[hr.length + i - s0] = sr[i] - skip + H.n;
  C.ids = S ? H.text.ids.concat(S.text.ids.slice(s0)) : H.text.ids;
  C.places = S ? H.text.places.concat(S.text.places.slice(s0)) : H.text.places;
  C.gap = S && S.from > cut ? { from: cut, to: S.from } : null;
  C.stale = !!S && S.to < cut;
  C.now = S ? Math.max(S.to, cut) : cut;
  C.liveFrom = S ? S.liveFrom : 0xffffffff;
  return C;
}
export function magType(C, i) {
  const k = C.f[i] >> 2;
  if (k === 63) return '';
  return (i < C.nh ? C.H.magTypes : C.S.magTypes)[k] || '';
}
export const statusOf = (C, i) => ['reviewed', 'automatic', 'manual', 'other'][C.f[i] & 3];
export function textOf(C, i) {
  const k = lowerBound(C.textRows, i);
  return C.textRows[k] === i ? { id: C.ids[k], place: C.places[k] } : null;
}
export function liveOf(C, i) {
  if (i < C.nh || !C.S) return null;
  const k = i - C.nh + C.skip - C.S.liveFirst;
  if (k < 0) return null;
  const L = C.S.live;
  return { felt: L.felt[k] === 65535 ? null : L.felt[k], alert: ['', 'green', 'yellow', 'orange', 'red'][L.alert[k]] || null,
    tsunami: L.tsunami[k], sig: L.sig[k] === 65535 ? null : L.sig[k], updated: L.updated[k] };
}

// geo.json (CONTRACT §4): polylines → world units
export const M72 = Math.log(Math.tan(Math.PI / 4 + (72 * Math.PI) / 360));
export const wx = (lon) => (lon - 172) / 360;
export const wy = (lat) => (M72 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / (2 * Math.PI);
function polyline(s, factor) {
  const out = [];
  let i = 0, x = 0, y = 0;
  while (i < s.length) {
    for (let k = 0; k < 2; k++) {
      let shift = 0, res = 0, b;
      do { b = s.charCodeAt(i++) - 63; res |= (b & 31) << shift; shift += 5; } while (b >= 32);
      const d = res & 1 ? ~(res >> 1) : res >> 1;
      if (k) y += d; else x += d;
    }
    out.push(x / factor, y / factor);
  }
  return out;
}
function shape(lonlat) {
  const p = new Float32Array(lonlat.length);
  let x0 = 9, y0 = 9, x1 = -9, y1 = -9;
  for (let i = 0; i < lonlat.length; i += 2) {
    const X = wx(lonlat[i]), Y = wy(lonlat[i + 1]);
    p[i] = X; p[i + 1] = Y;
    if (X < x0) x0 = X; if (X > x1) x1 = X; if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
  }
  return { p, bb: [x0, y0, x1, y1] };
}
export function decodeGeo(g) {
  if (!g || g.schema !== 1 || !g.polyline) fail('assets/geo.json is not the map file');
  const f = g.polyline.factor, lines = (a) => a.map((s) => shape(polyline(s, f)));
  const G = { land: lines(g.land), lakes: lines(g.lakes), coast: lines(g.coast), borders: lines(g.borders), states: lines(g.states),
    bathy: g.bathymetry.map((b) => ({ depth: b.depth, rings: lines(b.rings) })),
    places: g.places, volcanoes: g.volcanoes, relief: g.relief, views: g.views, sections: g.sections, basemap: g.basemap || g.axis };
  const F = g.faults;
  G.faults = { ...F, lines: F.lines.map((s, i) => ({ ...shape(polyline(s, F.factor)), counts: F.counts[i] })) };
  return G;
}

// Fetching
export async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) fail(`${url} could not be read (HTTP ${r.status})`);
  return r.json();
}
export async function loadHistory() {
  const [meta, buf] = await Promise.all([loadJSON('assets/history.json'),
    fetch('assets/history.bin').then((r) => (r.ok ? r.arrayBuffer() : fail(`assets/history.bin could not be read (HTTP ${r.status})`)))]);
  return decodeHistory(meta, buf);
}
export async function fetchSnapshot() {
  let r;
  try { r = await fetch('data/snapshot.json', { cache: 'no-store' }); } catch { return null; }
  if (r.status === 404) return null;
  if (!r.ok) fail(`data/snapshot.json could not be read (HTTP ${r.status})`);
  return r.text();
}
