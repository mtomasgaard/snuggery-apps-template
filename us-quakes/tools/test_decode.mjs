// js/data.js against the pipeline's reference rows (CONTRACT §2.4, §3.9, §11.4; DESIGN §16):
// assets/history.bin with tools/ref/history_ref.json (1,000 seeded rows and the six known events as
// the catalogue's own CSV strings), data/snapshot.json with tools/ref/snapshot_ref.json (its first
// and last 250 rows as the sources gave them, the feed's extras included), and the join at the cutoff.
// Every value within CONTRACT §1's bounds: time to the minute (truncated), longitude 0.001°,
// latitude 0.0005°, the depth code exactly (0.005 km; code 1500 only for a depth of exactly 10, one that
// only rounds to it written 1499 or 1501, under 0.01 km), the magnitude equal to the half-up tenth of its
// text; status, type label, id and place exact; code 1500 on exactly history.json's counts.depth10km rows.
// Then refusals: broken snapshots must be refused in words.
//
//   node tools/test_decode.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeHistory, decodeSnapshot, parseSnapshot, join, magType, statusOf, textOf, liveOf } from '../js/data.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(APP, f));
const json = (f) => JSON.parse(read(f).toString('utf8'));
const fails = [];
const ok = (c, msg) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fails.push(msg); };
const EPOCH = Date.UTC(1600, 0, 1);

/** The magnitude code of a decimal text: × 10 rounded half up (away from zero), + 20 (CONTRACT §1). */
function magCode(text) {
  if (text === '' || text == null) return 255;
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error(`unexpected magnitude text ${text}`);
  const neg = text.startsWith('-'), [ip, fp = ''] = text.replace('-', '').split('.');
  const tenths = Number(ip) * 10 + Number(fp[0] || 0) + ((fp[1] || '0') >= '5' ? 1 : 0);
  return (neg ? -tenths : tenths) + 20;
}
/** The depth code of a decimal text (CONTRACT §1): (depth + 5) × 100 half up, exact in BigInt; 1500 is kept
 *  for a depth of exactly 10, and one that only rounds to it is 1499 below 10 and 1501 above. */
function depthCode(text) {
  if (text === '' || text == null) return 65535;
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(text));
  if (!m) throw new Error(`unexpected depth text ${text}`);
  const P = 10n ** BigInt((m[3] || '').length), v = (m[1] ? -1n : 1n) * (BigInt(m[2]) * P + BigInt(m[3] || '0'));
  const q = (v + 5n * P) * 100n;
  let c = q >= 0n ? (2n * q + P) / (2n * P) : -((2n * -q + P) / (2n * P));
  if (c === 1500n && v !== 10n * P) c = v < 10n * P ? 1499n : 1501n;
  return c < 0n || c > 65534n ? 65535 : Number(c);
}
const tMin = (iso) => Math.floor((Date.parse(iso) - EPOCH) / 60000);
const unwrap = (lon) => (lon < 172 ? lon + 360 : lon);

let worst = { lon: 0, lat: 0, dep: 0 };
function compare(C, i, r, where, bad) {
  const [, time, lat, lon, dep, mag, mt, st, id, place] = r;
  const why = [];
  if (C.t[i] !== tMin(time)) why.push(`time ${C.t[i]} vs ${tMin(time)}`);
  const dl = Math.abs(172 + 0.002 * C.x[i] - unwrap(Number(lon))), da = Math.abs(17 + 0.001 * C.y[i] - Number(lat));
  worst.lon = Math.max(worst.lon, dl); worst.lat = Math.max(worst.lat, da);
  if (dl > 0.001 + 1e-9) why.push(`lon off by ${dl}`);
  if (da > 0.0005 + 1e-9) why.push(`lat off by ${da}`);
  if (dep === '' || dep == null) { if (C.d[i] !== 65535) why.push('depth should be none'); } else {
    const dd = Math.abs(C.d[i] / 100 - 5 - Number(dep)); worst.dep = Math.max(worst.dep, dd);
    if (C.d[i] === 65535 || C.d[i] !== depthCode(dep) || dd >= 0.01) why.push(`depth ${C.d[i]} vs ${dep} (code ${depthCode(dep)})`);
  }
  if (C.m[i] !== magCode(mag)) why.push(`magnitude code ${C.m[i]} vs ${magCode(mag)} (${mag})`);
  if (magType(C, i) !== (mt || '')) why.push(`type ${magType(C, i)} vs ${mt}`);
  if (statusOf(C, i) !== st) why.push(`status ${statusOf(C, i)} vs ${st}`);
  const tx = textOf(C, i);
  const kept = i >= C.nh + (C.S ? C.S.liveFirst - C.skip : 0) && C.S ? true : C.m[i] >= 65 && C.m[i] !== 255;
  if (kept) { if (!tx || tx.id !== id || tx.place !== place) why.push(`text ${JSON.stringify(tx)} vs ${id} / ${place}`); } else if (tx) why.push('text kept for a row the rule leaves out');
  if (why.length) bad.push(`${where} row ${i}: ${why.join('; ')}`);
}

// ── history
const hmeta = json('assets/history.json'), hbin = read('assets/history.bin');
const buf = hbin.buffer.slice(hbin.byteOffset, hbin.byteOffset + hbin.byteLength);
const t0 = performance.now();
const H = decodeHistory(hmeta, buf);
console.log(`decoded history.bin in ${(performance.now() - t0).toFixed(0)} ms: ${H.n.toLocaleString('en-US')} rows, ${H.text.rows.length.toLocaleString('en-US')} text rows`);
ok(H.n === 385071 && H.text.rows.length === 15664, `history: ${H.n} rows and ${H.text.rows.length} text rows (CONTRACT: 385,071 and 15,664)`);
const Ch = join(H, null);
const href = json('tools/ref/history_ref.json');
let bad = [];
for (const r of href.rows) compare(Ch, r[0], r, 'history', bad);
ok(bad.length === 0, `history: ${href.rows.length} seeded rows decode to the catalogue's strings${bad.length ? ': ' + bad.slice(0, 5).join(' | ') : ''}`);
let textRule = 0;
for (let i = 0, k = 0; i < H.n; i++) { const keep = H.cols.m[i] >= 65 && H.cols.m[i] !== 255; if (keep !== (H.text.rows[k] === i)) textRule++; if (H.text.rows[k] === i) k++; }
ok(textRule === 0, `history: the text table holds exactly the rows at M 4.5 and up by the decoded tenth (${textRule} exceptions)`);
// code 1500 means "10 km as the catalog lists it" and nothing else (CONTRACT §1, DESIGN §25)
let n1500 = 0, nNear = 0;
for (let i = 0; i < H.n; i++) { if (H.cols.d[i] === 1500) n1500++; else if (H.cols.d[i] === 1499 || H.cols.d[i] === 1501) nNear++; }
const rule = [['10', 1500], ['10.0', 1500], ['10.000', 1500], ['9.995', 1499], ['9.999', 1499], ['10.001', 1501], ['10.004', 1501], ['10.005', 1501], ['9.99', 1499], ['-3.74', 126]];
ok(n1500 === hmeta.counts.depth10km && n1500 === 23759 && rule.every(([t, c]) => depthCode(t) === c),
  `history: depth code 1500 on ${n1500.toLocaleString('en-US')} rows = history.json's counts.depth10km ${hmeta.counts.depth10km.toLocaleString('en-US')} (the catalog's exact 10 km; CONTRACT: 23,759; the file before the rule held 23,962); 9.99 or 10.01 km on ${nNear.toLocaleString('en-US')} rows; the rule on ${rule.map((r) => r.join('→')).join(', ')}`);

bad = [];
for (const k of href.known) {
  const [name, row, ...rest] = k;
  const found = Ch.ids.indexOf(k[9]);
  if (found < 0 || Ch.textRows[found] !== row) { bad.push(`${name}: id not at row ${row}`); continue; }
  compare(Ch, row, [row, ...rest], name, bad);
  const d = Ch.d[row] === 65535 ? 'none' : (Ch.d[row] / 100 - 5).toFixed(2);
  console.log(`     ${name.padEnd(26)} ${k[9].padEnd(30)} M${((Ch.m[row] - 20) / 10).toFixed(1)} ${magType(Ch, row)} depth ${d} ${statusOf(Ch, row)}`);
}
const at = (id) => Ch.textRows[Ch.ids.indexOf(id)];
const r64 = at('official19640328033616_30'), rAnc = at('ak018fcnsk91');
ok(bad.length === 0 && Ch.m[r64] === 112 && Ch.d[r64] === 3000 && statusOf(Ch, r64) === 'automatic' && Ch.d[rAnc] === 5170
  && Ch.d[at('official17000127050000000')] === 65535 && Ch.d[at('official18111216081500000')] === 65535,
  `the six known events by id: 1964 M 9.2 at 25.00 km automatic, 2018 Anchorage at 46.70 km, 1700 and 1811 without depth${bad.length ? ': ' + bad.join(' | ') : ''}`);

// ── snapshot
const snapText = read('data/snapshot.json').toString('utf8');
const t1 = performance.now();
const S = await decodeSnapshot(parseSnapshot(snapText));
console.log(`decoded snapshot.json in ${(performance.now() - t1).toFixed(0)} ms: ${S.n.toLocaleString('en-US')} rows, live from row ${S.liveFirst}`);
const sref = json('tools/ref/snapshot_ref.json');
ok(S.n === sref.count && S.liveFirst === sref.liveFirst, `snapshot: ${S.n} rows, liveFirst ${S.liveFirst} (ref ${sref.count}, ${sref.liveFirst})`);
// Compare in the snapshot's own row order: a join that keeps every row (cutoff at the epoch).
const Cs = join({ ...H, n: 0, cols: { t: new Uint32Array(0), x: new Uint16Array(0), y: new Uint16Array(0), d: new Uint16Array(0), m: new Uint8Array(0), f: new Uint8Array(0) }, text: { rows: new Uint32Array(0), ids: [], places: [] }, cutoff: 0 }, S);
bad = [];
let extras = 0;
const ALERT = { green: 'green', yellow: 'yellow', orange: 'orange', red: 'red' };
for (const r of sref.rows) {
  compare(Cs, r[0], r, 'snapshot', bad);
  const L = liveOf(Cs, r[0]);
  if (r[0] >= S.liveFirst) {
    extras++;
    const [felt, alert, tsu, sig, upd] = r.slice(10);
    const want = { felt: felt == null ? null : Math.min(felt, 65534), alert: alert == null ? null : ALERT[alert], tsunami: tsu, sig: sig == null ? null : sig, updated: tMin(upd) };
    for (const k of Object.keys(want)) if (!L || L[k] !== want[k]) bad.push(`snapshot row ${r[0]}: ${k} ${L && L[k]} vs ${want[k]}`);
  } else if (L) bad.push(`snapshot row ${r[0]}: extras before liveFirst`);
}
ok(bad.length === 0, `snapshot: ${sref.rows.length} reference rows decode to their sources, ${extras} with the feed's felt/alert/tsunami/sig/updated${bad.length ? ': ' + bad.slice(0, 5).join(' | ') : ''}`);
console.log(`     worst |Δlon| ${worst.lon.toFixed(6)}°, |Δlat| ${worst.lat.toFixed(6)}°, |Δdepth| ${worst.dep.toFixed(4)} km`);

// ── the join at the cutoff
const C = join(H, S);
let sorted = true;
for (let i = 1; i < C.n; i++) if (C.t[i] < C.t[i - 1]) { sorted = false; break; }
const before = S.cols.t.filter((t) => t < H.cutoff).length;
ok(C.n === H.n + S.n - before && C.skip === before && sorted && !C.gap && !C.stale && C.t[C.nh] >= H.cutoff && C.t[C.nh - 1] < H.cutoff,
  `join: ${H.n} history + ${S.n - before} snapshot rows from the cutoff (${before} snapshot rows before it skipped) = ${C.n}, sorted, no gap, not stale`);
const last = C.n - 1, tl = textOf(C, last), rl = sref.rows[sref.rows.length - 1];
ok(tl && tl.id === rl[8] && liveOf(C, last).updated === tMin(rl[14]), `join: the last row keeps its id ${tl && tl.id} and its feed extras`);
// A snapshot that starts a year after the cutoff leaves a gap; one that ends before it is stale.
const Sg = { ...S, from: H.cutoff + 525600, cols: S.cols };
ok(join(H, Sg).gap && join(H, Sg).gap.from === H.cutoff, 'join: a snapshot starting after the cutoff reports the gap');
ok(join(H, { ...S, to: H.cutoff - 1 }).stale, 'join: a snapshot ending before the cutoff is reported as older than the history');

// ── refusals, each in words
const refuse = async (label, text, want) => {
  try { await decodeSnapshot(parseSnapshot(text)); ok(false, `refused: ${label}`); } catch (e) { ok(want.test(e.message), `refused: ${label} — “${e.message}”`); }
};
const orig = JSON.parse(snapText);
await refuse('a web page written over the file', '<!DOCTYPE html><html>…', /web page/);
await refuse('a service\'s reply', '{"message":"Bad credentials"}', /service's reply/);
await refuse('another app\'s snapshot', JSON.stringify({ ...orig, app: 'Global Weather' }), /not a US Quakes snapshot/);
await refuse('a column declaring the wrong size', JSON.stringify({ ...orig, rows: { ...orig.rows, columns: { ...orig.rows.columns, m: { ...orig.rows.columns.m, bytes: 10 } } } }), /declares/);
await refuse('a count larger than the columns', JSON.stringify({ ...orig, rows: { ...orig.rows, count: orig.rows.count + 1 } }), /declares|consistent/);
await refuse('generatedAt missing', JSON.stringify({ ...orig, generatedAt: undefined }), /generatedAt/);
await refuse('a zlib bomb claiming a small size', JSON.stringify({ ...orig, rows: { ...orig.rows, columns: { ...orig.rows.columns, f: { ...orig.rows.columns.f, data: orig.rows.columns.t.data } } } }), /expands|declares|inflates/);

await refuse('a column that is not zlib', JSON.stringify({ ...orig, rows: { ...orig.rows, columns: { ...orig.rows.columns, m: { ...orig.rows.columns.m, data: Buffer.from('not zlib at all').toString('base64') } } } }), /not zlib/);

// ── without DecompressionStream (the pure-JS fallback was cut for the code budget, DESIGN §21) the file is refused in words
const native = globalThis.DecompressionStream;
globalThis.DecompressionStream = undefined;
await refuse('a device without DecompressionStream', snapText, /cannot decompress/);
globalThis.DecompressionStream = native;

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
