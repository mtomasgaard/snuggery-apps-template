// The decode test (HOUSE.md section 7.3; ART.md change list 22). Node, no dependencies. The shipped data
// is read with this folder's own tools/decode.mjs (NOTES.md's contract, NOAA's formulas, the EU clock
// rule, a ray march of its own) and the app's pure modules are compared with it:
//   1. every level decodes per NOTES.md (integer decimeters, then meters): each tile's extremes are its
//      manifest dmin and dmax, shared tile edges are equal, and js/terrain.js's heightAt and analysis
//      grids give the same meters;
//   2. js/sun.js against the closed-form NOAA at NOTES.md's three dates (03:43 / 23:08, 07:04 / 19:32,
//      05:00 / 22:01), and the position at four instants;
//   3. the Burn: js/sun.js directSunWindow, run over js/terrain.js's grids from the eye app.js uses, against
//      this file's own ray march at Veslfjellet and Bandet on 14 Jun, 20 Sep and 21 Dec;
//   4. js/units.js for a table of values;
//   5. js/route.js's walking time for the whole walk against this file's own Tobler sum.
//
//   node tools/test_decode.mjs

import fs from 'node:fs';
import path from 'node:path';
import { APP, manifest, decodeLevel, terrain, sun as mySun, riseSet, directSun } from './decode.mjs';
import { Terrain } from '../js/terrain.js';
import { Frame } from '../js/geo.js';
import { sunAt, dayEvents, directSunWindow } from '../js/sun.js';
import { Route, timeForSegments } from '../js/route.js';
import * as U from '../js/units.js';

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const J = (f) => JSON.parse(fs.readFileSync(path.join(APP, 'data', f), 'utf8'));
const hhmm = (m) => `${String(Math.floor(Math.round(m) / 60)).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;

// 1. The terrain
const bufs = manifest.levels.map((L) => { const b = fs.readFileSync(path.join(APP, 'data', L.file)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
for (const L of manifest.levels) {
  const tiles = decodeLevel(L);
  let extremes = 0, edges = 0, worst = 0;
  for (const t of tiles.values()) {
    let lo = Infinity, hi = -Infinity;
    for (const v of t.dm) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (lo !== t.dmin || hi !== t.dmax) extremes++;
    const east = tiles.get(`${t.tx + 1}:${t.ty}`), north = tiles.get(`${t.tx}:${t.ty + 1}`);
    for (let k = 0; k < 65; k++) {
      if (east) { edges++; worst = Math.max(worst, Math.abs(t.dm[k * 65 + 64] - east.dm[k * 65])); }
      if (north) { edges++; worst = Math.max(worst, Math.abs(t.dm[k] - north.dm[64 * 65 + k])); }
    }
  }
  ok(tiles.size === L.tiles.length && bufs[L.level].byteLength === L.bytes && extremes === 0 && worst === 0,
    `level ${L.level} (${L.res} m, ${L.file}): ${tiles.size} tiles, ${L.bytes} bytes; each tile's decoded extremes are its manifest dmin and dmax (${extremes} differ); ${edges} shared edge samples, worst difference ${worst} dm`);
}
const frame = new Frame(manifest);
const app = new Terrain({ manifest, levelBuffers: bufs }, frame);
app.buildAnalysisGrids();
const mine = terrain();
{
  let worst = 0, n = 0;
  const c = manifest.core;
  for (let i = 0; i < 4000; i++) {
    const x = c.x0 + ((i * 7919) % 4000) / 4000 * (c.x1 - c.x0), y = c.y0 + ((i * 104729) % 4001) / 4001 * (c.y1 - c.y0);
    worst = Math.max(worst, Math.abs(app.analysisHeight(x, y) - mine.h(x, y)));
    n++;
  }
  ok(worst < 1e-9, `js/terrain.js's analysis grids against this file's decode at ${n} points over the detailed box: worst difference ${worst} m`);
  const wp = J('waypoints.json').waypoints.find((w) => w.id === 'veslfjellet');
  const h = app.heightAt(wp.x, wp.y);
  ok(Math.abs(h - 1741) < 2, `js/terrain.js's heightAt on Veslfjellet's trail point: ${h.toFixed(2)} m (waypoints.json: ${wp.elevM} m)`);
}

// 2. The sun
const lat = frame.centerLat, lon = frame.centerLon;
ok(Math.abs(lat - 61.5044) < 1e-3 && Math.abs(lon - 8.7207) < 1e-3, `the model's center, js/geo.js: ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E (NOTES.md: 61.5044, 8.7207)`);
for (const [mo, d, want] of [[6, 14, '03:43 / 23:08'], [9, 20, '07:04 / 19:32'], [8, 3, '05:00 / 22:01']]) {
  const e = dayEvents(2026, mo, d, lat, lon), [r, s] = riseSet(2026, mo, d, lat, lon);
  ok(`${hhmm(e.sunrise)} / ${hhmm(e.sunset)}` === want && Math.abs(e.sunrise - r) < 1 && Math.abs(e.sunset - s) < 1,
    `sunrise and sunset ${d} ${mo === 6 ? 'Jun' : mo === 9 ? 'Sep' : 'Aug'} 2026: js/sun.js ${hhmm(e.sunrise)} / ${hhmm(e.sunset)}, this file ${hhmm(r)} / ${hhmm(s)}, NOTES.md ${want}`);
}
{
  let worst = 0;
  for (const [mo, d, m] of [[6, 14, 420], [9, 20, 480], [12, 21, 750], [3, 29, 1020]]) {
    const a = sunAt(2026, mo, d, m, lat, lon), b = mySun(2026, mo, d, m, lat, lon);
    worst = Math.max(worst, Math.abs(a.elevApparent - b.alt), Math.abs(((a.az - b.az + 540) % 360) - 180));
  }
  ok(worst < 0.01, `the sun's position at four instants (the day CEST begins among them): worst difference ${worst.toFixed(4)}° in altitude or azimuth`);
}

// 3. The Burn
{
  const wps = J('waypoints.json').waypoints, rows = [];
  let bad = 0;
  for (const id of ['veslfjellet', 'bandet']) {
    const w = wps.find((p) => p.id === id);
    for (const [mo, d] of [[6, 14], [9, 20], [12, 21]]) {
      const a = directSunWindow((x, y) => app.analysisHeight(x, y), w.x, w.y, Math.max(app.heightAt(w.x, w.y), app.analysisHeight(w.x, w.y)), 2026, mo, d, lat, lon, frame.convergence, app.maxM + 5);
      const b = directSun(w.x, w.y, 2026, mo, d, lat, lon);
      const first = b.spans.length ? b.spans[0][0] : null, last = b.spans.length ? b.spans[b.spans.length - 1][1] : null;
      const same = a.spans.length === b.spans.length && (first === null ? a.first === null : Math.abs(a.first - first) <= 4 && Math.abs(a.last - last) <= 4);
      if (!same) bad++;
      rows.push(`${w.name} ${d}.${mo}: app ${a.first == null ? 'none' : `${hhmm(a.first)} to ${hhmm(a.last)}, ${a.spans.length} spell(s), ${a.totalMinutes} min`}; this file ${first == null ? 'none' : `${hhmm(first)} to ${hhmm(last)}, ${b.spans.length}, ${b.total} min`}`);
    }
  }
  ok(bad === 0, `the Burn's direct sun against this file's own ray march (first and last within 4 minutes, the same number of spells): ${rows.join('; ')}`);
}

// 4. Units
{
  const N = ' ', M = '−';
  const cases = [
    [U.m(1741.4), `1${N}741${N}m`], [U.m(999), `999${N}m`], [U.dist(5030), `5.03${N}km`], [U.dist(13675), `13.7${N}km`], [U.dist(-12), `${M}12${N}m`],
    [U.fixed(-0.04, 1), '0.0'], [U.fixed(-5.24, 1), `${M}5.2`], [U.int(16380), `16${N}380`], [U.date(2026, 9, 22, 1), '22 Sep 2026'], [U.int(12345678), `12${N}345${N}678`],
    [U.hm(13 + 38 / 60), `13${N}h${N}38${N}min`], [U.hm(0.633), `38${N}min`], [U.hm(15), `15${N}h`], [U.hm(0), `0${N}min`], [U.hm(13 + 38 / 60, 1), '13 hours 38 minutes'], [U.hm(1 + 1 / 60, 1), '1 hour 1 minute'], [U.hm(15, 1), '15 hours'],
    [U.clock(403), '06:43'], [U.clock(1440), '00:00'], [U.span(403, 1222), '06:43 to 20:22'], [U.date(2026, 6, 14), '14 Jun'], [U.date(2026, 6, 14, 1, 1), '14 June 2026'],
    [U.iso('2026-09-22'), '22 Sep 2026'], [U.zone(2), 'CEST'], [U.zone(1), 'CET'], [U.zoneSpoken(2), 'Central European Summer Time'],
    [U.wind(73), 'ENE'], [U.wind(73, 1), 'east-northeast'], [U.wind(202, 1), 'south-southwest'], [U.wind(45, 1), 'northeast'], [U.wind(359), 'N'],
    [U.deg(17.44), '17.4°'], [U.pct(9.4), `9${N}%`], [U.signed(12.2), `+12${N}m`], [U.signed(-40), `${M}40${N}m`],
    [U.pos(8.81315, 61.49442), `61° 29.665′${N}N, 8° 48.789′${N}E`], [U.distSpoken(5030), '5.03 kilometers'],
  ];
  const bad = cases.filter(([a, b]) => a !== b);
  ok(bad.length === 0, `js/units.js: ${cases.length} values in SI (the true minus, U+202F before units and in thousands, years ungrouped, words for the voice)${bad.length ? ': ' + bad.map(([a, b]) => `"${a}" is not "${b}"`).join('; ') : ''}`);
}

// 5. The walking time
{
  const route = new Route(J('route.geojson'), J('waypoints.json'));
  const pace = J('pace.json');
  const t = timeForSegments(route, 0, route.n - 1, pace);
  const co = route.main.geometry.coordinates, cum = route.main.properties.cumM;
  let h = 0;
  for (let i = 1; i < co.length; i++) {
    const run = cum[i] - cum[i - 1], rise = co[i][2] - co[i - 1][2];
    if (run <= 0 && rise === 0) continue;
    h += Math.hypot(run, rise) / 1000 / Math.max(6 * Math.exp(-3.5 * Math.abs((run > 0 ? rise / run : Math.sign(rise) * 9) + 0.05)), 0.15);
  }
  ok(Math.abs(t.hours - h) < 1e-9, `js/route.js's walking time for the whole walk, Tobler at ${pace.models.tobler.baseKmh} km/h: ${U.hm(t.hours)} (this file's own sum ${U.hm(h)})`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
