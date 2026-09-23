// Node check that the star files decode in plain JavaScript exactly as CONTRACT.md section 7 says.
//
// There is no loader module for the stars yet (the app owns that); this test is the reference
// decoding a loader can copy: deep.bin read with a little-endian DataView, 8 bytes per star, and
// the column arrays of named.json indexed by row. The expected values come from
// tools/.cache/work/stars_fixture.json, which verify_stars.py writes from its own numpy decoding,
// so the two languages are checked against each other rather than against themselves.
//
//     node tools/test_stars.mjs          (run verify_stars.py first)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data', 'stars');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
let failed = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failed += 1;
};

// Decode the deep cloud: returns typed arrays, positions already in parsecs.
export function decodeDeep(meta, buffer) {
  const n = meta.count;
  const dv = new DataView(buffer);
  const xyz = new Float32Array(n * 3);
  const absmag = new Float32Array(n);
  const colour = new Uint8Array(n);
  const s = 1 / meta.units_per_pc;
  for (let i = 0, o = 0; i < n; i += 1, o += 8) {
    xyz[3 * i] = dv.getInt16(o, true) * s;
    xyz[3 * i + 1] = dv.getInt16(o + 2, true) * s;
    xyz[3 * i + 2] = dv.getInt16(o + 4, true) * s;
    absmag[i] = dv.getUint8(o + 6) / 10 - 8;
    colour[i] = dv.getUint8(o + 7);
  }
  return { count: n, xyz, absmag, colour };
}

console.log('test_stars');
const meta = readJson(join(dataDir, 'deep.json'));
const bin = readFileSync(join(dataDir, 'deep.bin'));
const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
check(buf.byteLength === meta.count * 8, `deep.bin is ${meta.count} x 8 bytes`);
const deep = decodeDeep(meta, buf);

const fx = readJson(join(here, '.cache', 'work', 'stars_fixture.json'));
check(fx.deep_count === deep.count, `record count matches the Python decode (${deep.count})`);
const dv = new DataView(buf);
for (const r of fx.deep) {
  const o = r.index * 8;
  const same = dv.getInt16(o, true) === r.x && dv.getInt16(o + 2, true) === r.y
    && dv.getInt16(o + 4, true) === r.z && dv.getUint8(o + 6) === r.absmag_code
    && dv.getUint8(o + 7) === r.colour_code;
  check(same, `record ${r.index}: (${r.x}, ${r.y}, ${r.z}) M code ${r.absmag_code}, colour ${r.colour_code}`);
}

let rmax = 0;
let rmin = Infinity;
for (let i = 0; i < deep.count; i += 1) {
  const r = Math.hypot(deep.xyz[3 * i], deep.xyz[3 * i + 1], deep.xyz[3 * i + 2]);
  rmax = Math.max(rmax, r);
  rmin = Math.min(rmin, r);
}
check(rmax <= 500.01 && rmin >= 19.98, `deep distances ${rmin.toFixed(2)} .. ${rmax.toFixed(2)} pc`);
check(deep.absmag[0] <= deep.absmag[deep.count - 1], `sorted brightest first: M_V ${deep.absmag[0].toFixed(1)} .. ${deep.absmag[deep.count - 1].toFixed(1)}`);

const colour = readJson(join(dataDir, 'colour.json'));
check(colour.srgb.length === 256 && colour.teff_k[255] === null, 'colour table: 256 entries, 255 = no colour');
let badColour = 0;
for (let i = 0; i < deep.count; i += 1) if (!colour.srgb[deep.colour[i]]) badColour += 1;
check(badColour === 0, 'every deep colour code has a table entry');

const named = readJson(join(dataDir, 'named.json'));
const cols = ['id', 'name', 'desig', 'con', 'x', 'y', 'z', 'vmag', 'absmag', 'colour', 'spect', 'dist_src', 'flags'];
check(cols.every((c) => named[c].length === named.count), `named.json: ${named.count} rows in ${cols.length} columns`);
const sirius = fx.sirius_row;
const rs = Math.hypot(named.x[sirius], named.y[sirius], named.z[sirius]);
check(named.id[sirius] === 'HIP 32349' && Math.abs(rs - fx.sirius_r_pc) < 1e-9,
  `row ${sirius}: ${named.name[sirius]} (${named.desig[sirius]}) at ${rs.toFixed(4)} pc, ${named.dist_src_labels[named.dist_src[sirius]]}`);

const cons = readJson(join(dataDir, 'constellations.json'));
let segs = 0;
let skyOnly = 0;
let badIdx = 0;
for (const c of Object.values(cons)) {
  for (const [a, b] of c.lines) { segs += 1; if (!(a < named.count && b < named.count)) badIdx += 1; }
  for (const [a, b] of c.lines_sky_only) {
    skyOnly += 1;
    if (!((named.flags[a] | named.flags[b]) & 16)) badIdx += 1;
  }
}
check(Object.keys(cons).length === 88 && badIdx === 0, `88 constellations, ${segs} segments in 3D, ${skyOnly} sky-only`);

const exo = readJson(join(dataDir, 'exoplanets.json'));
let planets = 0;
let hostFlagMismatch = 0;
for (const [row, list] of Object.entries(exo.hosts)) {
  planets += list.length;
  if (!(named.flags[Number(row)] & 1)) hostFlagMismatch += 1;
}
check(hostFlagMismatch === 0, `${Object.keys(exo.hosts).length} hosts, ${planets} planets, all flagged as hosts`);
const proxima = named.id.indexOf('HIP 70890');
const pl = (exo.hosts[String(proxima)] || []).map((p) => p[exo.fields.indexOf('name')]);
check(pl.includes('Proxima Centauri b'), `Proxima Centauri: ${pl.join(', ')}`);

if (failed) {
  console.log(`test_stars: ${failed} FAILED`);
  process.exit(1);
}
console.log('test_stars: all checks passed');
