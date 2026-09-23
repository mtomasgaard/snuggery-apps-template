// Node test for js/ephem.js.
//
// Loads the shipped files with fs (not fetch) through buildEphemeris(), then compares against
// reference values exported by the Python steps into tools/.cache/solar/ (not shipped):
//   ref_ephem.json   600 random epochs 1900-2100: DE430 heliocentric positions straight from the
//                    SPK (10_ephemeris.py)
//   ref_moons.json   300 epochs per moon 1950-2050: the satellite SPK (relative to the system
//                    barycentre), the Python evaluation of the shipped windows, and JPL's own
//                    planet-centre segment (11_moons.py)
//   ref_time.json    UTC instants and their TT Julian Dates through ERFA utctai + taitt
//                    (verify_solar.py)
// Prints the worst error per body and exits non-zero if anything is out of bounds.
//
//   node tools/test_ephem.mjs          (after the steps and verify_solar.py have run)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEphemeris, jdFromDate, dateFromJd } from '../js/ephem.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.OUT_DATA || path.join(here, '..', 'data');
const CACHE = path.join(process.env.MILKYWAY_CACHE || path.join(here, '.cache'), 'solar');
const bin = (f) => { const b = fs.readFileSync(path.join(DATA, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const json = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const eph = buildEphemeris(json(DATA, 'ephem.json'), bin('ephem.bin'), json(DATA, 'moons.json'),
  bin('moons.bin'), json(DATA, 'physical.json'));
const refE = json(CACHE, 'ref_ephem.json');
const refM = json(CACHE, 'ref_moons.json');
const refT = json(CACHE, 'ref_time.json');

let failures = 0;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function report(label, worst, limit, unit = 'km') {
  const ok = worst <= limit;
  if (!ok) failures++;
  const dp = unit === 's' ? 6 : 3;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label.padEnd(26)} worst ${worst.toFixed(dp).padStart(10)} ${unit}  (limit ${limit.toFixed(dp)})`);
}

console.log(`planets vs DE430 (SPK), ${refE.jd.length} epochs 1900-2100`);
const out = new Float64Array(3);
for (const [name, rows] of Object.entries(refE.helio)) {
  let w = 0;
  refE.jd.forEach((jd, i) => { w = Math.max(w, dist(eph.helio(name, jd, out), rows[i])); });
  const key = name === 'moon' ? 'earth' : name;         // helio moon = earth + geocentric moon
  const lim = (eph.maxErrorKm[key] + (name === 'moon' ? eph.maxErrorKm.moon : 0)) * 1.1;
  report(`helio ${name}`, w, lim);
}
{
  let w = 0;
  refE.jd.forEach((jd, i) => { w = Math.max(w, dist(eph.geoMoon(jd, out), refE.geo_moon[i])); });
  report('geoMoon', w, eph.maxErrorKm.moon * 1.1);
}

console.log('moons vs satellite SPKs (relative to the system barycentre), and vs the Python evaluation');
for (const [name, r] of Object.entries(refM.moons)) {
  let wSpk = 0, wPy = 0, inside = true;
  r.jd.forEach((jd, i) => {
    inside = eph.moon(name, jd, out) && inside;
    wSpk = Math.max(wSpk, dist(out, r.spk_bary[i]));
    wPy = Math.max(wPy, dist(out, r.model_bary[i]));
  });
  report(`${name} vs SPK`, wSpk, r.max_error_km * 1.05);
  report(`${name} vs Python`, wPy, 1e-3);
  if (!inside) { failures++; console.log(`  FAIL ${name}: moon() said out of range inside 1950-2050`); }
}
for (const [parent, rows] of Object.entries(refM.centres)) {
  const jds = refM.moons[eph.moons(parent)[0].name].jd;
  let w = 0;
  jds.forEach((jd, i) => { w = Math.max(w, dist(eph.planetCentre(parent, jd, out), rows[i])); });
  report(`${parent} centre vs SPK`, w, 1.0);
}
{
  const ok = eph.moon('Io', 2433282.5 - 10, out) === false && eph.moon('Io', 2469807.5 + 10, out) === false;
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} moon() returns false outside ${eph.moonRange.jdStart}..${eph.moonRange.jdEnd}`);
}
{
  // The frozen ellipse passes through the moon's own position at that instant.
  let w = 0;
  for (const m of ['Io', 'Titan', 'Triton', 'Nereid', 'Hyperion']) {
    const jd = 2460000.5, p = new Float64Array(3);
    eph.moonFromCentre(m, jd, p);
    const path = eph.moonOrbit(m, jd, 4096);
    let best = Infinity;
    for (let s = 0; s < path.length; s += 3) best = Math.min(best, dist(p, [path[s], path[s + 1], path[s + 2]]));
    const a = eph.moons(eph.moonByName[m.toLowerCase()].parent).find((x) => x.name === m).aKm;
    w = Math.max(w, best / a);
  }
  report('moonOrbit passes the moon', w, 2 * Math.PI / 4096, '(of a)');
}

console.log(`time: jdFromDate vs ERFA utctai+taitt, ${refT.samples.length} instants 1972-2050`);
{
  let w = 0, wr = 0;
  for (const s of refT.samples) {
    const jd = jdFromDate(new Date(s.unix_ms));
    w = Math.max(w, Math.abs(jd - s.jd_tt) * 86400);
    wr = Math.max(wr, Math.abs(dateFromJd(jd).getTime() - s.unix_ms) / 1000);
  }
  report('jdFromDate', w, 1e-3, 's');
  report('dateFromJd round trip', wr, 1e-3, 's');
}

{
  const names = ['mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  const moons = eph.moonList.map((m) => m.name);
  const N = 20000, t0 = performance.now();
  for (let i = 0; i < N; i++) {
    const jd = 2451545 + i * 0.37;
    for (const n of names) eph.helio(n, jd, out);
    for (const m of moons) eph.moon(m, jd, out);
  }
  const us = (performance.now() - t0) * 1000 / N;
  console.log(`  perf: all 10 bodies + ${moons.length} moons in ${us.toFixed(1)} microseconds per frame`);
}

if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('test_ephem: all checks passed');
