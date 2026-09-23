// Node check of js/galaxydata.js against the galaxy files and against numbers Python computed
// independently (tools/.cache/work/galaxy_fixture.json, written by verify_galaxy.py):
//   * toIcrs / fromIcrs against astropy's Galactocentric v4.0 transformation (200 points),
//   * every globular cluster and satellite back to its LVDB RA, Dec and distance,
//   * both young-star PNGs decoded pixel by pixel (a small PNG decoder below, zlib from node) and
//     compared with the published grids, including the no-data mask and the pixel <-> kpc mapping,
//   * model.png decoded through modelSigma against the disc formula + an independent bar integral.
//
//     node tools/test_galaxy.mjs          (run verify_galaxy.py first)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { buildGalaxyData } from '../js/galaxydata.js';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'data');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
let failed = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failed += 1;
};

// Minimal PNG decoder for 8-bit gray (colour type 0) and RGBA (6), non-interlaced: enough for the
// files this step writes. Returns { width, height, channels, data: Uint8Array rows top-first }.
function decodePng(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('not a PNG');
  let p = 8, width = 0, height = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      depth = body[8]; ctype = body[9]; interlace = body[12];
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace !== 0 || (ctype !== 0 && ctype !== 6)) throw new Error(`unsupported PNG ${depth}/${ctype}/${interlace}`);
  const ch = ctype === 6 ? 4 : 1, stride = width * ch;
  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? out[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, channels: ch, data: out };
}

const json = readJson(join(dataDir, 'galaxy', 'galaxy.json'));
const fx = readJson(join(here, '.cache', 'work', 'galaxy_fixture.json'));
const G = buildGalaxyData(json);
console.log('test_galaxy');

// ---------------------------------------------------------------- frame
{
  let worst = 0, worstInv = 0;
  const { icrs, gc } = fx.frame_points;
  for (let i = 0; i < icrs.length; i++) {
    const q = G.toIcrs(gc[i]);
    worst = Math.max(worst, Math.hypot(q[0] - icrs[i][0], q[1] - icrs[i][1], q[2] - icrs[i][2]));
    const p = G.fromIcrs(icrs[i]);
    worstInv = Math.max(worstInv, Math.hypot(p[0] - gc[i][0], p[1] - gc[i][1], p[2] - gc[i][2]));
  }
  check(worst < 1e-9 && worstInv < 1e-9, `toIcrs / fromIcrs vs astropy over ${icrs.length} points: ${worst.toExponential(1)} / ${worstInv.toExponential(1)} kpc`);
  const s = G.toIcrs(G.sun);
  check(Math.hypot(...s) < 1e-9, `the Sun maps to the ICRS origin (${Math.hypot(...s).toExponential(1)} kpc)`);
  const c = G.raDecDist([0, 0, 0]);
  check(Math.abs(c.ra - 266.4051) < 1e-6 && Math.abs(c.dec + 28.936175) < 1e-6 && Math.abs(c.dist - 8.122) < 1e-9,
    `the Galactic centre seen from the Sun: RA ${c.ra.toFixed(6)}, Dec ${c.dec.toFixed(6)}, ${c.dist.toFixed(6)} kpc`);
}

// ---------------------------------------------------------------- clusters and satellites
{
  const objs = [...G.globulars, ...G.satellites];
  const ref = new Map(fx.lvdb.map((o) => [o.key, o]));
  let maxSep = 0, maxRel = 0, n = 0;
  for (const o of objs) {
    const r = ref.get(o.key);
    const v = G.raDecDist(o.xyz);
    const d2r = Math.PI / 180;
    const cosd = Math.sin(v.dec * d2r) * Math.sin(r.dec * d2r) + Math.cos(v.dec * d2r) * Math.cos(r.dec * d2r) * Math.cos((v.ra - r.ra) * d2r);
    const sep = Math.acos(Math.min(1, cosd)) / d2r * 3600;
    const lim = 0.00005 * Math.sqrt(3) / r.dist * 206265 * 1.01;
    if (sep > lim) n += 1;
    maxSep = Math.max(maxSep, sep);
    maxRel = Math.max(maxRel, Math.abs(v.dist / r.dist - 1));
  }
  check(n === 0 && objs.length === 259, `${objs.length} clusters + satellites back to LVDB RA/Dec within the 0.1-pc rounding (max ${maxSep.toFixed(2)}"), distance max relative ${maxRel.toExponential(1)}`);
}

// ---------------------------------------------------------------- young-star maps
for (const key of Object.keys(G.young).sort()) {
  const im = G.image(key);
  const png = decodePng(readFileSync(join(dataDir, im.file)));
  check(png.width === im.width && png.height === im.height && png.channels === 4, `${key}: ${png.width}x${png.height} RGBA`);
  const grid = fx.young[key].grid_rows_top_first;
  const step = (im.meta.encoding.hi - im.meta.encoding.lo) / 255;
  let worst = 0, maskBad = 0, nodes = 0, uvBad = 0;
  const sunX = G.sun[0];
  for (let r = 0; r < png.height; r++) {
    for (let c = 0; c < png.width; c++) {
      const o = (r * png.width + c) * 4;
      const v = G.youngValue(key, png.data[o], png.data[o + 3]);
      const g = grid[r][c];
      if ((v === null) !== (g === 0)) maskBad += 1;
      if (v !== null) worst = Math.max(worst, Math.abs(v - g));
      const [x, y] = G.pixelCentre(key, c, r);
      // the node this pixel holds: heliocentric (-6 + 0.1 c, 6 - 0.1 r)
      if (Math.abs(x - sunX - (-6 + 0.1 * c)) > 1e-6 || Math.abs(y - (6 - 0.1 * r)) > 1e-6) nodes += 1;
      const at = G.pixelAt(key, x, y), uv = G.uv(key, x, y);
      if (!at || at.col !== c || at.row !== r || Math.abs(uv[0] - (c + 0.5) / png.width) > 1e-9 || Math.abs(uv[1] - (1 - (r + 0.5) / png.height)) > 1e-9) uvBad += 1;
    }
  }
  check(maskBad === 0, `${key}: alpha 0 exactly where the published grid is 0.0`);
  check(worst <= step / 2 + 1e-12, `${key}: every decoded pixel within half a step of the grid (max ${worst.toFixed(5)}, step ${step.toFixed(5)})`);
  check(nodes === 0 && uvBad === 0, `${key}: pixel centres = grid nodes, pixelAt and uv consistent (flipY)`);
}

// ---------------------------------------------------------------- model
{
  const im = G.image('model');
  const png = decodePng(readFileSync(join(dataDir, im.file)));
  check(png.width === im.width && png.height === im.height && png.channels === 1, `model: ${png.width}x${png.height} gray`);
  const s = json.model.stretch;
  const half = Math.pow(s.white_msun_kpc2 / s.black_msun_kpc2, 0.5 / 255) - 1;
  let worst = 0, zeroBad = 0;
  for (const [r, c, truth] of fx.model_pixels) {
    const code = png.data[r * png.width + c];
    const sig = G.modelSigma(code);
    if (code === 0) { if (truth > s.black_msun_kpc2 * (1 + half)) zeroBad += 1; } else worst = Math.max(worst, Math.abs(sig / truth - 1));
  }
  check(worst <= half + 1e-9 && zeroBad === 0, `model: modelSigma of ${fx.model_pixels.length} pixels vs the independent Sigma: ${(worst * 100).toFixed(2)} % (half a step ${(half * 100).toFixed(2)} %)`);
}

// ---------------------------------------------------------------- streams
{
  const n = G.streams.length;
  let bad = 0;
  for (let i = 0; i < n; i++) if (G.streamApproximate(i) !== G.streams[i].approximate) bad += 1;
  check(bad === 0 && n === 100, `${n} streams, approximate flag consistent`);
}

if (failed) {
  console.log(`test_galaxy: ${failed} check(s) failed`);
  process.exit(1);
}
console.log('test_galaxy: all checks passed');
