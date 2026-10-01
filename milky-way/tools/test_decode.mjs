// The decode test (HOUSE.md section 7.3; ART.md change list 22). Node, no dependencies, no
// tools/.cache/. It proves the art pass changed no decoding, and that the Reach draws what the data holds:
//   1. js/ephem.js, js/smallbodies.js and js/galaxydata.js give, at three fixed epochs, the positions
//      recorded on 2026-10-01 before the pass began (tools/.work/pass/baseline.mjs printed them);
//   2. tools/census.mjs decodes the stars, clusters, satellites, streams, planets and small bodies with
//      its own formulas, and js/rule.js's census() inks exactly the columns this file works out, at
//      every width the shoot uses, with the gap ART.md names (160 AU to 1.30 pc on 2026-10-01);
//   3. js/units.js writes the numbers the house asks for (U+2212, U+202F, significant figures), the
//      unit and the figures chosen after rounding (99.99 is 100, 999.96 pc is 1.00 kpc).
//
//   node tools/test_decode.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEphemeris } from '../js/ephem.js';
import { buildSmallBodies } from '../js/smallbodies.js';
import { buildGalaxyData } from '../js/galaxydata.js';
import { census as ruleCensus, LO, HI } from '../js/rule.js';
import * as U from '../js/units.js';
import { census, columns, counts, QUANT } from './census.mjs';

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const json = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const bytes = (f) => { const b = fs.readFileSync(path.join(DATA, f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };

// 1. The decoders, pinned (km for the planets, au for the small bodies, kpc for the galaxy frame)
const EPOCHS = [2433282.5, 2461315.17, 2469000.5];
const HELIO = {
  mercury: [[48003190.98425041, 14888115.957540827, 2966027.7574378466], [-991180.5238831281, -61277243.82086191, -32631884.153769728], [41795820.903129235, 23473441.268717766, 8211315.583611864]],
  venus: [[14103777.951170094, 97733173.77251586, 43058807.77221319], [108065050.35092443, -6922397.559312761, -9951587.992780503], [41654931.895177186, 91716835.09060208, 38642085.87786851]],
  earth: [[-27334089.1109743, 132596416.84639026, 57505195.50742966], [148264457.10816288, 19424402.506326407, 8418702.710348709], [137402470.4165103, 53204557.77181549, 23058826.005421337]],
  moon: [[-27147577.35474588, 132909253.54117891, 57669597.89740621], [148371485.95380798, 19734567.680340882, 8588289.042246068], [137040867.95522192, 53258053.45392947, 23048561.732189093]],
  mars: [[-208771868.0449202, 120955066.76443689, 61143972.97284816], [17692778.876665577, 211569383.67888403, 96564778.58441219], [-203536351.20442343, 127806534.01812384, 64102903.21270324]],
  jupiter: [[509621059.17200845, -512521986.4455955, -232133970.0674642], [-522741986.07336664, 544524684.1530652, 246122662.96477872], [504083288.8176994, 509993734.51282, 206315320.3058918]],
  saturn: [[-1347482726.4706604, 324507885.24564075, 191888186.8840917], [1385013996.7827296, 266753492.82553142, 50534006.17604697], [108513178.99753264, -1383646438.6447093, -576281453.8917291]],
  uranus: [[-185716669.28998262, 2589565198.45283, 1136814584.939515], [1335665966.1230445, 2373386339.5326347, 1020570785.5536753], [-2515041639.563859, 978175639.0989424, 463954883.3005922]],
  neptune: [[-4352194096.126504, -1204353512.301345, -384635963.96865624], [4463618579.159623, 232331068.01029348, -16027454.850697141], [2903473368.015968, 3158349127.7011704, 1220449645.7904418]],
  pluto: [[-3969438904.3311663, 3031115991.8923736, 2141549313.568641], [2986874098.0639973, -3874420516.707567, -2108897949.8194852], [5427088691.331935, -1790264395.5146937, -2193656644.662067]],
};
const SMALL = {
  0: [[-2.1870176187430226, -1.4597499170929071, -0.24328697453753428], [0.27454239415959736, 2.426070428652051, 1.0884445714883402], [1.624576782087272, -2.0860913783792117, -1.314722473286289]],
  1: [[-2.344654772780566, -0.5215374660738238, 0.27393338454808375], [2.6807826635971392, 0.7958590877712554, -0.35301258130281865], [-0.21642074599316152, -3.1234638423386767, 0.63876929003687]],
  500: [[-0.49722516395237015, -2.9194683170218916, -1.588654995332031], [-3.2285562513055552, 0.917760126948308, -0.08471517421312735], [0.7218364555315917, 2.440003084302809, 1.3806025168903953]],
  4000: [[71.99312283777255, -19.480809769565454, 9.771911247505427], [-18.129184210481665, 16.60961582576838, -4.28151381155503], [-10.205228084727912, 45.910816301221594, -8.097860027974049]],
  9988: [[-5.319723647934828, 32.761312692979516, -7.384231567951066], [-15.505523637680868, 75.08203763884497, -16.443886737308883], [-18.210817540952682, 89.19953792669432, -19.566185886922497]],
};
const GAL = { sun: [-1.176836406102666e-14, -2.6201263381153694e-13, -1.4432899320127035e-13], gc0: [0.11569008133661357, -3.168080086550745, -1.143155311834617], sat0: [-80.34715420098426, 58.788243145552514, -74.20555791918207] };
const diff = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
{
  const eph = buildEphemeris(json('ephem.json'), bytes('ephem.bin'), json('moons.json'), bytes('moons.bin'), json('physical.json'));
  let worst = 0;
  for (const [name, rows] of Object.entries(HELIO)) EPOCHS.forEach((jd, i) => { worst = Math.max(worst, diff(eph.helio(name, jd), rows[i])); });
  ok(worst === 0, `js/ephem.js: ${Object.keys(HELIO).length} bodies at ${EPOCHS.length} epochs as recorded before the pass (largest difference ${worst} km)`);
  const sb = buildSmallBodies(json('smallbodies.json'), bytes('smallbodies.bin'));
  let w2 = 0;
  for (const [i, rows] of Object.entries(SMALL)) EPOCHS.forEach((jd, k) => { w2 = Math.max(w2, diff(sb.position(+i, jd), rows[k])); });
  ok(w2 === 0 && sb.count === 9989, `js/smallbodies.js: ${Object.keys(SMALL).length} rows at ${EPOCHS.length} epochs as recorded (largest difference ${w2} au), ${sb.count} rows`);
  const g = buildGalaxyData(json('galaxy/galaxy.json'));
  const w3 = Math.max(diff(g.toIcrs(g.sun), GAL.sun), diff(g.toIcrs(g.globulars[0].xyz), GAL.gc0), diff(g.toIcrs(g.satellites[0].xyz), GAL.sat0));
  ok(w3 === 0, `js/galaxydata.js: the frame takes the Sun, a cluster and a satellite where it did before the pass (largest difference ${w3} kpc)`);
}

// 2. The census
{
  ok(QUANT === 1 / 64, `stars/deep.json's quantization is 1/64 pc, as app.js and this file decode deep.bin (${QUANT})`);
  const jd = 2461315.17;                                       // 2026-10-01, ART.md's measurement
  const c = census(jd);
  const n = c.lists.reduce((s, l) => s + l.length, 0);
  console.log(`     census on JD ${jd}: ${c.solarCount} Solar System objects, ${counts.named} named and ${counts.deep} deep stars placed, ${counts.globulars} clusters, ${counts.satellites} satellites, ${counts.streams} streams (${counts.streamPoints} points); ${n} distances in all`);
  const gap = Math.log10(c.starNear / c.farthest);
  ok(c.farthest > 150 && c.farthest < 170 && c.starNear > 2.6e5 && c.starNear < 2.8e5 && gap > 3.2 && gap < 3.3,
    `the gap: nothing between ${U.dist(c.farthest)} (the farthest small body) and ${U.dist(c.starNear)} (the nearest placed star), ${gap.toFixed(2)} powers of ten (ART.md: 159.8 AU to 268 500 AU, 3.23)`);
  for (const cols of [576, 656, 716, 780, 1000, 1688]) {
    const mine = columns(c.lists, cols).ink, theirs = ruleCensus(c.lists, cols);
    let differ = 0, inked = 0;
    for (let k = 0; k < cols; k++) { if (mine[k] !== theirs[k]) differ++; inked += mine[k]; }
    ok(differ === 0 && theirs.length === cols, `js/rule.js census() at ${cols} columns over [${LO}, ${HI}]: ${inked} inked, ${differ} differ from this file's`);
  }
  // the gap is blank on the ruler itself: no column between the two ends is inked
  const cols = 716, theirs = ruleCensus(c.lists, cols), per = cols / (HI - LO);
  const a = Math.floor((Math.log10(c.farthest) - LO) * per) + 1, b = Math.floor((Math.log10(c.starNear) - LO) * per) - 1;
  let any = 0; for (let k = a; k <= b; k++) any += theirs[k];
  ok(any === 0 && b - a > 50, `the ruler is blank across the gap: columns ${a} to ${b} of ${cols} (${b - a + 1} device px at 358 CSS px, DPR 2), ${any} inked`);
}

// 3. The numbers
{
  const NN = ' ', M = '−';
  const cases = [
    [U.dist(9.43), `9.43${NN}AU`], [U.dist(268500), `1.30${NN}pc`], [U.dist(0.0023634), `353${NN}600${NN}km`],
    [U.dist(8e8), `3.88${NN}kpc`], [U.dist(1.5e11), `727${NN}kpc`], [U.sig(-1234.5), `${M}1${NN}230`], [U.fixed(-0.04, 1), '0.0'],
    [U.days(0.4), `9.60${NN}h`], [U.days(687), `687${NN}d`], [U.days(4332.6), `11.9${NN}years`], [U.distSpoken(268500), '1.30 parsecs'],
    [U.isoDay('2026-09-23'), '23 Sep 2026'], [U.spoken(new Date(Date.UTC(2026, 9, 1, 16, 3))), 'Thursday 1 October 2026, 16:03 UTC'],
    [U.lightTime(8.44), `70.2${NN}light-minutes`], [U.ly(268500), `4.25${NN}light-years`],
    // a value that rounds up to a power of ten: the figures, and the unit, are those of what is printed
    [U.sig(99.99), '100'], [U.sig(9.996), '10.0'], [U.sig(0.9996), '1.00'], [U.dist(0.999995), `1.00${NN}AU`],
    [U.dist(999.96 * 648000 / Math.PI), `1.00${NN}kpc`], [U.dist(19999.9), `0.0970${NN}pc`], [U.dist(999.99e3 * 648000 / Math.PI), `1.00${NN}Mpc`],
    [U.dist(999950 / 149597870.7), `0.00668${NN}AU`], [U.days(1.999), `2.00${NN}d`], [U.days(799.99), `2.19${NN}years`],
  ];
  const bad = cases.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${cases.length} cases in SI notation${bad.length ? ': ' + bad.map(([a, b]) => `${JSON.stringify(a)} not ${JSON.stringify(b)}`).join('; ') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
