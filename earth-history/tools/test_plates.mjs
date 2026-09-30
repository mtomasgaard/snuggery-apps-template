// DESIGN §13: load plates.bin/.json with js/data.js and js/plates.js and rotate the 1,000 reference
// points in tools/work/plates_ref.json (written by step 20 with pygplates, not shipped) at the 10
// slices it lists. Pass: max error ≤ 1 km, and the tap lookup (§7.4) at 0 Ma puts every one of the
// 300 places on the plate pygplates partitioned it onto.   node tools/test_plates.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { decodePlates, decodeCoast } = await import(path.join(APP, 'js/data.js'));
const { createPlates, distanceKm } = await import(path.join(APP, 'js/plates.js'));

const buf = (f) => { const b = fs.readFileSync(path.join(APP, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const json = (f) => JSON.parse(fs.readFileSync(path.join(APP, f), 'utf8'));
const refPath = path.join(APP, 'tools/work/plates_ref.json');
if (!fs.existsSync(refPath)) { console.log(`FAIL ${refPath} is missing: run tools/build_all.sh (step 20 writes it)`); process.exit(1); }

const pl = decodePlates(json('data/plates.json'), buf('data/plates.bin'));
const coast = decodeCoast(json('data/coast.json'), buf('data/coast.bin'), pl);
const P = createPlates(pl, coast);
const ref = json('tools/work/plates_ref.json');
console.log(`plates.bin: ${pl.R} rings, ${pl.V} vertices, ${pl.P} plates, ${pl.S} slices; coast.bin: ${coast.N} pieces, ${coast.V} vertices`);
console.log(`reference: ${ref.points.length} points at slices ${ref.slices.join(', ')}`);

let worst = 0, worstAt = null, n = 0;
const perSlice = new Map();
for (const s of ref.slices) {
  const ms = P.setStop(s);
  let w = 0;
  for (const p of ref.points) {
    const at = p.at.find((a) => a[0] === s);
    const [lon, lat] = P.place(p.pi, p.lon, p.lat);
    const d = distanceKm([lon, lat], [at[2], at[1]]);
    n++;
    if (d > w) w = d;
    if (d > worst) { worst = d; worstAt = { slice: s, plate: p.plate, lon: p.lon, lat: p.lat }; }
  }
  perSlice.set(s, [w, ms]);
}
for (const [s, [w, ms]] of perSlice) console.log(`  slice ${String(s).padStart(2)} (rotation_ma ${pl.times[s][0]}): max ${w.toFixed(3)} km; setStop ${ms.toFixed(1)} ms`);
console.log(`${n} rotations, max error ${worst.toFixed(3)} km (slice ${worstAt.slice}, plate ${worstAt.plate} at ${worstAt.lat}, ${worstAt.lon})`);

// Identity today: every plate's quaternion at slice 0, k = 0 is (1, 0, 0, 0) within quantisation.
const { quatAt } = await import(path.join(APP, 'js/plates.js'));
let idWorst = 0;
for (let pi = 0; pi < pl.P; pi++) { const q = quatAt(pl, 0, 0, pi); idWorst = Math.max(idWorst, 1 - q[0]); }
console.log(`rings whose anchor did not wind (fallback test): ${P.unsignedRings}`);
console.log(`slice 0: 1 − w at most ${idWorst.toExponential(2)} over ${pl.P} plates`);

// Tap lookup round trip: a present-day vertex's ring interior found again from its rotated position.
P.setStop(47);
const pts = [[-87.6352, 41.848, 'Chicago'], [18.4239, -33.9253, 'Cape Town'], [151.1852, -33.9203, 'Sydney']];
for (const [lon, lat, name] of pts) {
  P.setStop(0);
  const today = P.lookup(lon, lat);
  P.setStop(47);
  const then = P.place(today.pi, lon, lat);
  const hit = P.lookup(then[0], then[1]);
  const back = hit ? distanceKm(hit.present, [lon, lat]) : null;
  console.log(`  ${name}: today on plate ${today.plate}; at ${pl.times[47][0]} Ma at ${then[1].toFixed(2)}, ${then[0].toFixed(2)}; tap there → plate ${hit && hit.plate}, present-day within ${back == null ? '—' : back.toFixed(4)} km; moving ${hit ? hit.speed.toFixed(2) : '—'} cm/yr`);
}

// The tap lookup at 0 Ma against pygplates' partition of the 300 places (places.json, step 20).
P.setStop(0);
const places = json('data/places.json').places;
const disagree = places.filter((q) => { const h = P.lookup(q.lon, q.lat); return !h || h.plate !== q.plate; });
console.log(`tap lookup at 0 Ma: ${places.length - disagree.length} of ${places.length} places on the plate pygplates partitioned them onto${disagree.length ? ' — not: ' + disagree.map((q) => q.n).join(', ') : ''}`);

const ok = worst <= 1 && disagree.length === 0;
console.log(ok ? 'test_plates: OK' : 'test_plates: FAIL');
process.exit(ok ? 0 : 1);
