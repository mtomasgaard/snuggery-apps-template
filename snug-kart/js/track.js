// The track: a closed Catmull-Rom spline through the control points in data/tracks.json, sampled
// every meter of arc length, with width, bank, curvature, verge and wall limits per sample.
// Pure: imports only three.core.js and touches no DOM, so tools/sim.mjs and tools/check.mjs run it
// in Node. DESIGN.md §5.1 is the specification; the numbers here are its numbers.

import { CatmullRomCurve3, Vector3 } from '../vendor/three.core.js';
import { meters, percent, unit } from './units.js';

export const WALL_THICK = 0.6;       // barrier thickness (m)
export const WALL_HEIGHT = 1.1;      // barrier height (m)
export const KART_HALF = 0.75;       // wall line = w/2 + verge − KART_HALF
export const FLAG_BRIDGE = 1, FLAG_ROCKCUT = 2;
const SECTION_BLEND = 10;            // meters over which a section's verge fades in and out
const DEG = Math.PI / 180;

const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** Build the sampled track from one entry of tracks.json. Throws with a readable message on bad data. */
export function buildTrack(def) {
  checkDef(def);
  const pts = def.points, n = pts.length;
  const curve = new CatmullRomCurve3(pts.map(([x, z, y]) => new Vector3(x, y, z)), true, 'centripetal');
  curve.arcLengthDivisions = 8000;
  const L = curve.getLength();
  const N = Math.floor(L), ds = L / N;

  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
  const hw = new Float32Array(N), bankMag = new Float32Array(N);
  const v = new Vector3();
  for (let i = 0; i < N; i++) {
    const t = curve.getUtoTmapping(i / N);
    curve.getPoint(t, v);
    px[i] = v.x; py[i] = v.y; pz[i] = v.z;
    const p = t * n; let seg = Math.floor(p); const f = p - seg; seg %= n;
    const a = pts[seg], b = pts[(seg + 1) % n], sm = f * f * (3 - 2 * f);
    hw[i] = (a[3] + (b[3] - a[3]) * sm) / 2;
    bankMag[i] = (a[4] + (b[4] - a[4]) * sm) * DEG;
  }
  const W = (i) => ((i % N) + N) % N;

  const theta = new Float32Array(N);
  for (let i = 0; i < N; i++) theta[i] = Math.atan2(pz[W(i + 1)] - pz[W(i - 1)], px[W(i + 1)] - px[W(i - 1)]);
  const kappa = new Float32Array(N);
  for (let i = 0; i < N; i++) kappa[i] = wrapAngle(theta[W(i + 12)] - theta[W(i - 12)]) / (24 * ds);

  // Plan forward (fx, fz), plan right (rx, rz) = (−fz, fx); 3D forward T; banked lateral; normal.
  const fx = new Float32Array(N), fz = new Float32Array(N);
  const tx = new Float32Array(N), ty = new Float32Array(N), tz = new Float32Array(N);
  const bank = new Float32Array(N), sinB = new Float32Array(N), cosB = new Float32Array(N);
  const nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    fx[i] = Math.cos(theta[i]); fz[i] = Math.sin(theta[i]);
    let dx = px[W(i + 1)] - px[W(i - 1)], dy = py[W(i + 1)] - py[W(i - 1)], dz = pz[W(i + 1)] - pz[W(i - 1)];
    const len = Math.hypot(dx, dy, dz); dx /= len; dy /= len; dz /= len;
    tx[i] = dx; ty[i] = dy; tz[i] = dz;
    const b = bankMag[i] * clamp(kappa[i] * 150, -1, 1);
    bank[i] = b; sinB[i] = Math.sin(b); cosB[i] = Math.cos(b);
    // Banked lateral Rb = R·cos b − Up·sin b, with R = (−fz, 0, fx).
    const rbx = -fz[i] * cosB[i], rby = -sinB[i], rbz = fx[i] * cosB[i];
    // normal = Rb × T
    let cx = rby * dz - rbz * dy, cy = rbz * dx - rbx * dz, cz = rbx * dy - rby * dx;
    const cl = Math.hypot(cx, cy, cz); nx[i] = cx / cl; ny[i] = cy / cl; nz[i] = cz / cl;
  }

  // Verge per sample, with section overrides blended over SECTION_BLEND meters; flags per section kind.
  const verge = new Float32Array(N).fill(def.verge ?? 4);
  const flags = new Uint8Array(N);
  for (const sec of def.sections || []) {
    const kind = sec.kind === 'bridge' ? FLAG_BRIDGE : sec.kind === 'rockcut' ? FLAG_ROCKCUT : 0;
    for (let i = 0; i < N; i++) {
      const s = i * ds;
      if (s >= sec.from && s <= sec.to) flags[i] |= kind;
      if (sec.verge === undefined) continue;
      const inside = Math.min(s - sec.from, sec.to - s);   // meters inside the section (negative outside)
      const w = clamp((inside + SECTION_BLEND) / SECTION_BLEND, 0, 1);
      if (w > 0) verge[i] = verge[i] + (sec.verge - verge[i]) * w;
    }
  }
  const wallLine = new Float32Array(N);
  for (let i = 0; i < N; i++) wallLine[i] = hw[i] + verge[i] - KART_HALF;

  const track = {
    id: def.id, name: def.name, def, L, N, ds,
    px, py, pz, fx, fz, tx, ty, tz, nx, ny, nz, theta, kappa, hw, bank, sinB, cosB, verge, wallLine, flags,
    wrap: W,
  };
  track.hash = buildHash(track);
  track.bounds = bounds(track);
  return track;
}

function checkDef(def) {
  const bad = (msg) => { throw new Error(`Track "${def && def.id}": ${msg}`); };
  if (!def || typeof def !== 'object') throw new Error('A track entry is not an object.');
  if (typeof def.id !== 'string' || typeof def.name !== 'string') bad('it needs an "id" and a "name".');
  if (!Array.isArray(def.points) || def.points.length < 4) bad('"points" needs at least four [x, z, y, width, bank] entries.');
  def.points.forEach((p, i) => {
    if (!Array.isArray(p) || p.length !== 5 || !p.every(Number.isFinite)) bad(`point ${i} is not five numbers [x, z, y, width, bank].`);
    if (p[3] < 8 || p[3] > 30) bad(`point ${i} has a road width of ${unit(p[3], 'm')}; it must be between 8 and 30.`);
    if (p[4] < 0 || p[4] > 20) bad(`point ${i} has a bank of ${p[4]}°; it must be between 0 and 20 (the sign is worked out).`);
  });
  if (!Array.isArray(def.parcels)) bad('"parcels" must be a list of distances along the lap.');
  if (def.sections && !Array.isArray(def.sections)) bad('"sections" must be a list.');
  if (!def.palette || typeof def.palette !== 'object') bad('it needs a "palette".');
}

// ---------------------------------------------------------------------------------------------
// Queries

/**
 * Project a plan point onto the track, searching only ±30 samples around `hint` — continuity, never
 * "whichever road is nearer", so the Lantern Night crossover resolves correctly. Writes into `out`:
 * idx (nearest sample), f (fraction toward idx+1, may be negative toward idx−1), s, l (plan lateral,
 * + = right), y (surface height at that point).
 */
export function project(track, x, z, hint, out, span = 30) {
  const { N, px, pz } = track;
  let best = hint, bd = Infinity;
  for (let k = -span; k <= span; k++) {
    const i = ((hint + k) % N + N) % N;
    const dx = x - px[i], dz = z - pz[i], d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return frame(track, best, x, z, out);
}

/** Global nearest sample via the spatial hash (for placing things, never for karts). */
export function nearest(track, x, z) {
  const h = track.hash, cx = Math.floor((x - h.x0) / h.cell), cz = Math.floor((z - h.z0) / h.cell);
  let best = -1, bd = Infinity;
  for (let r = 0; r < 64; r++) {
    for (let gx = cx - r; gx <= cx + r; gx++) for (let gz = cz - r; gz <= cz + r; gz++) {
      if (Math.max(Math.abs(gx - cx), Math.abs(gz - cz)) !== r) continue;
      const list = h.cells.get(gx * 100003 + gz); if (!list) continue;
      for (const i of list) { const dx = x - track.px[i], dz = z - track.pz[i], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = i; } }
    }
    // Anything in ring r+1 is at least r·cell away; stop once the best is closer than that.
    if (best >= 0 && Math.sqrt(bd) <= r * h.cell) break;
  }
  return { idx: best, d: Math.sqrt(bd) };
}

/** Fill `out` from a known nearest sample. */
export function frame(track, i, x, z, out) {
  const { N, px, py, pz, fx, fz, ty, sinB, cosB, ds } = track;
  const dx = x - px[i], dz = z - pz[i];
  const along = dx * fx[i] + dz * fz[i];
  const l = -dx * fz[i] + dz * fx[i];
  const f = along / ds;
  // Height: interpolate the centerline along, then drop by the bank across (plan lateral → tan b).
  const j = f >= 0 ? (i + 1) % N : (i - 1 + N) % N, a = Math.min(1, Math.abs(f));
  const cy = py[i] + (py[j] - py[i]) * a;
  out.idx = i; out.f = f; out.l = l;
  out.s = ((i + f) * ds + track.L) % track.L;
  out.y = cy - l * (sinB[i] / cosB[i]);
  out.grade = ty[i];
  return out;
}

/** World point at sample i and lateral l on the banked surface (lift = meters above it). */
export function pointAt(track, i, l, lift = 0, out = {}) {
  const { px, py, pz, fx, fz, sinB, cosB } = track;
  out.x = px[i] - fz[i] * l * cosB[i];
  out.y = py[i] - sinB[i] * l + lift;
  out.z = pz[i] + fx[i] * l * cosB[i];
  return out;
}

function buildHash(track) {
  const cell = 20, { N, px, pz } = track;
  let x0 = Infinity, z0 = Infinity;
  for (let i = 0; i < N; i++) { x0 = Math.min(x0, px[i]); z0 = Math.min(z0, pz[i]); }
  x0 -= cell; z0 -= cell;
  const cells = new Map();
  for (let i = 0; i < N; i++) {
    const k = Math.floor((px[i] - x0) / cell) * 100003 + Math.floor((pz[i] - z0) / cell);
    let list = cells.get(k); if (!list) cells.set(k, list = []); list.push(i);
  }
  return { cell, x0, z0, cells };
}

function bounds(track) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < track.N; i++) {
    minX = Math.min(minX, track.px[i]); maxX = Math.max(maxX, track.px[i]);
    minZ = Math.min(minZ, track.pz[i]); maxZ = Math.max(maxZ, track.pz[i]);
    minY = Math.min(minY, track.py[i]); maxY = Math.max(maxY, track.py[i]);
  }
  return { minX, maxX, minZ, maxZ, minY, maxY };
}

// ---------------------------------------------------------------------------------------------
// Validation (DESIGN.md §5.2) — run on every load, and by tools/check.mjs.

export function validateTrack(track) {
  const { N, ds, px, py, pz, hw, verge, kappa, L } = track;
  const problems = [];
  let minR = Infinity, minRAt = 0, maxGrade = 0, maxGradeAt = 0, minW = Infinity, maxW = 0;
  for (let i = 0; i < N; i++) {
    const r = 1 / Math.max(1e-9, Math.abs(kappa[i]));
    const need = hw[i] + verge[i] + WALL_THICK + 2;
    if (r < minR) { minR = r; minRAt = i * ds; }
    if (r < need) problems.push(`the bend at ${meters(i * ds)} is too tight for its width (radius ${meters(r, 1)}, needs ${meters(need, 1)})`);
    const g = Math.abs(py[(i + 1) % N] - py[i]) / ds;
    if (g > maxGrade) { maxGrade = g; maxGradeAt = i * ds; }
    minW = Math.min(minW, hw[i] * 2); maxW = Math.max(maxW, hw[i] * 2);
  }
  if (maxGrade > 0.12) problems.push(`the slope at ${meters(maxGradeAt)} is ${percent(maxGrade * 100)} (at most ${percent(12, 0)})`);
  // Grid: the 40 m before the line.
  for (let d = 1; d <= 40; d++) {
    const i = (N - Math.round(d / ds)) % N;
    if (Math.abs(kappa[i]) >= 1 / 80) { problems.push(`the starting grid (the ${meters(40)} before the line) is not straight enough`); break; }
  }
  // Corridors: every pair more than 60 m apart along the loop keeps its distance, unless 7 m or more apart in height.
  let crossings = 0, minClear = Infinity;
  const step = 2, sep = Math.round(60 / ds);
  let reported = 0;
  for (let i = 0; i < N; i += step) {
    for (let j = i + sep; j < N; j += step) {
      if (N - (j - i) < sep) continue;
      const d = Math.hypot(px[i] - px[j], pz[i] - pz[j]);
      const need = hw[i] + hw[j] + 2 * (Math.max(verge[i], verge[j]) + WALL_THICK) + 4;
      if (d >= need) continue;
      const dy = Math.abs(py[i] - py[j]);
      if (dy >= 7) { crossings++; minClear = Math.min(minClear, dy); continue; }
      if (reported++ < 3) problems.push(`the road at ${meters(i * ds)} comes within ${meters(d, 1)} of the road at ${meters(j * ds)} (needs ${meters(need, 1)})`);
    }
  }
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < N; i++) { minY = Math.min(minY, py[i]); maxY = Math.max(maxY, py[i]); }
  return {
    ok: problems.length === 0, problems,
    stats: { length: L, minY, maxY, minW, maxW, minRadius: minR, minRadiusAt: minRAt, maxGrade, crossover: crossings > 0, clearance: crossings ? minClear : null },
  };
}

/** Parse and validate the whole tracks.json document; throws an Error naming the problem. */
export function loadTracks(json) {
  if (!json || !Array.isArray(json.tracks) || json.tracks.length === 0) throw new Error('data/tracks.json has no "tracks" list.');
  return json.tracks.map((def) => {
    const track = buildTrack(def);
    const v = validateTrack(track);
    if (!v.ok) throw new Error(`data/tracks.json, track "${def.name}": ${v.problems[0]}.`);
    track.validation = v.stats;
    return track;
  });
}
