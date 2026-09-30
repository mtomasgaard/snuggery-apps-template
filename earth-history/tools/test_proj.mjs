// DESIGN §13: the JS forward and inverse of both projections round-trip on a 1° grid to < 1e−9 rad,
// and agree with the formulas of §5.3 (the shader's inverse) evaluated here in float64.
//   node tools/test_proj.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = await import(path.join(APP, 'js/proj.js'));
const D = Math.PI / 180, SQ2 = Math.SQRT2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dLam = (a, b) => Math.abs(wrap(a - b));

// §5.3 transcribed from the GLSL, independently of js/proj.js.
function shaderGlobe(px, py, lam0, phi0) {
  const r2 = px * px + py * py, z = Math.sqrt(Math.max(0, 1 - r2));
  return { phi: Math.asin(Math.max(-1, Math.min(1, z * Math.sin(phi0) + py * Math.cos(phi0)))), lam: lam0 + Math.atan2(px, z * Math.cos(phi0) - py * Math.sin(phi0)) };
}
function shaderMoll(qx, qy, lam0) {
  const th = Math.asin(Math.max(-1, Math.min(1, qy / SQ2)));
  return { phi: Math.asin(Math.max(-1, Math.min(1, (2 * th + Math.sin(2 * th)) / Math.PI))), lam: lam0 + Math.PI * qx / (2 * SQ2 * Math.max(Math.cos(th), 1e-6)) };
}
// §6 forward, transcribed.
function fwdGlobe(lam, phi, lam0, phi0) {
  return { X: Math.cos(phi) * Math.sin(lam - lam0), Y: Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam - lam0), Z: Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam - lam0) };
}

const centres = [[0, 0], [20, 20], [-100, 45], [150, -60], [179.5, 89], [-179.5, -89.5]];
let orthoRT = 0, orthoShader = 0, orthoFwd = 0, orthoMat = 0, nO = 0;
for (const [l0, p0] of centres) {
  const lam0 = l0 * D, phi0 = p0 * D, M = P.orthoMatrix(lam0, phi0);
  for (let lat = -89; lat <= 89; lat++) for (let lon = -180; lon < 180; lon++) {
    const lam = lon * D, phi = lat * D;
    const f = P.orthoForward(lam, phi, lam0, phi0), g = fwdGlobe(lam, phi, lam0, phi0);
    orthoFwd = Math.max(orthoFwd, Math.abs(f.X - g.X), Math.abs(f.Y - g.Y), Math.abs(f.Z - g.Z));
    const u = [Math.cos(phi) * Math.cos(lam), Math.cos(phi) * Math.sin(lam), Math.sin(phi)];
    orthoMat = Math.max(orthoMat, Math.abs(M[0] * u[0] + M[1] * u[1] + M[2] * u[2] - f.X), Math.abs(M[3] * u[0] + M[4] * u[1] + M[5] * u[2] - f.Y), Math.abs(M[6] * u[0] + M[7] * u[1] + M[8] * u[2] - f.Z));
    if (f.Z < 1e-3) continue;                    // the visible hemisphere, off the very rim
    nO++;
    const inv = P.orthoInverse(f.X, f.Y, lam0, phi0), sh = shaderGlobe(f.X, f.Y, lam0, phi0);
    const e = Math.max(Math.abs(inv.phi - phi), Math.abs(lat) < 89.9 ? dLam(inv.lam, lam) * Math.cos(phi) : 0);
    orthoRT = Math.max(orthoRT, e);
    orthoShader = Math.max(orthoShader, Math.abs(inv.phi - sh.phi), dLam(inv.lam, sh.lam));
  }
}
let mollRT = 0, mollShader = 0, nM = 0, mollRTlam = 0;
for (const l0 of [0, 37, -120, 180]) {
  const lam0 = l0 * D;
  for (let lat = -89; lat <= 89; lat++) for (let lon = -180; lon < 180; lon++) {
    const lam = lon * D, phi = lat * D;
    if (Math.abs(P.wrapPi ? 0 : 0) > 0) continue;
    const dl = Math.abs(wrap(lam - lam0));
    if (dl > Math.PI - 1e-9) continue;          // the ellipse's own edge meridian is two places at once
    const f = P.mollForward(lam, phi, lam0);
    const inv = P.mollInverse(f.x, f.y, lam0), sh = shaderMoll(f.x, f.y, lam0);
    nM++;
    mollRT = Math.max(mollRT, Math.abs(inv.phi - phi));
    mollRTlam = Math.max(mollRTlam, dLam(inv.lam, lam));
    mollShader = Math.max(mollShader, Math.abs(inv.phi - sh.phi), dLam(inv.lam, sh.lam));
  }
}
const lines = [
  [`orthographic forward vs §6 formulas`, orthoFwd, 1e-12],
  [`orthographic 3×3 matrix vs forward`, orthoMat, 1e-12],
  [`orthographic round trip (${nO} points, 6 centres; longitude error × cos φ)`, orthoRT, 1e-9],
  [`orthographic inverse vs §5.3 shader formulas`, orthoShader, 1e-12],
  [`Mollweide round trip latitude (${nM} points, 4 central meridians)`, mollRT, 1e-9],
  [`Mollweide round trip longitude`, mollRTlam, 1e-9],
  [`Mollweide inverse vs §5.3 shader formulas`, mollShader, 1e-12],
];
let ok = true;
for (const [what, v, lim] of lines) { const pass = v < lim; ok &&= pass; console.log(`${pass ? 'ok  ' : 'FAIL'} ${what}: max ${v.toExponential(2)} rad (limit ${lim.toExponential(0)})`); }
// The Newton solve: iterations used at the worst latitude.
console.log(`Mollweide θ(89°) = ${P.mollTheta(89 * D).toFixed(12)}; θ(90°) = ${P.mollTheta(90 * D).toFixed(12)}`);
console.log(ok ? 'test_proj: OK' : 'test_proj: FAIL');
process.exit(ok ? 0 : 1);
