// Node test for js/rotation.js.
//
// Builds every body's ICRF -> body-fixed matrix from physical.json alone and compares it with
// CSPICE's pxform('J2000', 'IAU_<BODY>', et) (tipbod where CSPICE has no built-in IAU_ frame) at
// seven epochs from 1950 to 2100, exported by tools/verify_solar.py into
// tools/.cache/solar/ref_rotation.json (not shipped). Prints the worst rotation angle between the
// two per body, in arcseconds, and exits non-zero above 0.001".
//
//   node tools/test_rotation.mjs       (after verify_solar.py has run)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkRotation, bodyFrame, spinAxis, buildRotation } from '../js/rotation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.OUT_DATA || path.join(here, '..', 'data');
const CACHE = path.join(process.env.MILKYWAY_CACHE || path.join(here, '.cache'), 'solar');
const physical = linkRotation(JSON.parse(fs.readFileSync(path.join(DATA, 'physical.json'), 'utf8')));
const ref = JSON.parse(fs.readFileSync(path.join(CACHE, 'ref_rotation.json'), 'utf8'));

// Angle of the rotation A * B^T, from its antisymmetric part (well conditioned near zero).
function angleArcsec(A, B) {
  const D = new Float64Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0;
    for (let k = 0; k < 3; k++) s += A[3 * i + k] * B[3 * j + k];
    D[3 * i + j] = s;
  }
  const x = (D[7] - D[5]) / 2, y = (D[2] - D[6]) / 2, z = (D[3] - D[1]) / 2;
  return Math.asin(Math.min(1, Math.hypot(x, y, z))) * 180 / Math.PI * 3600;
}

let failures = 0, worstAll = 0, worstBody = '';
const lines = [];
for (const [key, mats] of Object.entries(ref.bodies)) {
  const body = physical.bodies[key];
  let w = 0;
  ref.epochs.forEach((jd, i) => { w = Math.max(w, angleArcsec(bodyFrame(body, jd), mats[i])); });
  lines.push(`${key} ${w.toExponential(1)}`);
  if (w > worstAll) { worstAll = w; worstBody = key; }
  if (w > 1e-3) { failures++; console.log(`  FAIL ${key}: ${w.toExponential(2)} arcsec`); }
}
console.log(`bodyFrame vs CSPICE pxform, ${Object.keys(ref.bodies).length} bodies x ${ref.epochs.length} epochs 1950-2100`);
console.log('  ' + lines.join(', '));
console.log(`  worst ${worstAll.toExponential(2)} arcsec (${worstBody}); limit 1e-3 arcsec`);

// The keyed interface the app uses gives the same matrices.
{
  const rot = buildRotation(JSON.parse(JSON.stringify(physical)));
  let w = 0;
  for (const [key, mats] of Object.entries(ref.bodies)) {
    ref.epochs.forEach((jd, i) => { w = Math.max(w, angleArcsec(rot.bodyFrame(key, jd), mats[i])); });
  }
  if (w > 1e-3) { failures++; console.log(`  FAIL buildRotation().bodyFrame: ${w} arcsec`); }
  else console.log(`  ok   buildRotation().bodyFrame(key, jd) worst ${w.toExponential(2)} arcsec`);
  if (rot.bodyFrame('hyperion', 2451545) !== null || rot.bodyFrame('charon', 2451545) !== null) {
    failures++; console.log('  FAIL keyed bodyFrame should be null for hyperion / unknown keys');
  }
}
// Bodies without a model return null rather than a made-up frame.
for (const key of ['hyperion', 'nereid']) {
  if (physical.bodies[key] && bodyFrame(physical.bodies[key], 2451545) !== null) {
    failures++; console.log(`  FAIL ${key}: expected null (no rotation model in pck00011)`);
  }
}
// Spin axes: Uranus and Venus turn backwards about the IAU pole.
const u = spinAxis(physical.bodies.uranus, 2451545), p = bodyFrame(physical.bodies.uranus, 2451545);
const dot = u[0] * p[6] + u[1] * p[7] + u[2] * p[8];
if (!(dot < -0.999)) { failures++; console.log('  FAIL uranus spin axis should be minus the IAU pole'); }
else console.log('  ok   spinAxis(uranus) = -IAU pole');

if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('test_rotation: all checks passed');
