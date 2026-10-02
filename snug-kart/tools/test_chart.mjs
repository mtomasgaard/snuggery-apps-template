// The Lap Chart's record, proved (ART.md 1; HOUSE.md 7.3). Not shipped. Races run in Node on the real
// js/race.js and js/items.js, set up as tools/sim.mjs sets them up (3 tracks × 5 seeds at Standard
// pace, items on, the player's kart on autopilot). Every step this test ranks the karts by its own
// rule (finished karts by finishing time, then race distance) and notes its own crossings of the ten
// timing lines a lap; it then compares that record with `kart.gates` for every kart. Half the races
// skip the wait two seconds after the player's finish, as a tap on the screen does, so projected
// finishers are tested too. Prints the figures ART.md section 1 quotes.
//
//   node tools/test_chart.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { loadTracks } = await import(path.join(APP, 'js/track.js'));
const { createRace, stepRace, finishRace, GATES, LAPS } = await import(path.join(APP, 'js/race.js'));
const { createItems } = await import(path.join(APP, 'js/items.js'));
const tracks = loadTracks(JSON.parse(fs.readFileSync(path.join(APP, 'data/tracks.json'), 'utf8')));
const racers = JSON.parse(fs.readFileSync(path.join(APP, 'data/racers.json'), 'utf8')).racers;

const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
ok(GATES === 10 && LAPS === 3, `race.js: ${GATES} timing lines a lap, ${LAPS} laps, so ${GATES * LAPS} columns after the grid`);

const rank = (karts) => {
  const order = [...karts].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.dist - a.dist;
  });
  return new Map(order.map((k, i) => [k, i + 1]));
};

const totals = { races: 0, karts: 0, same: 0, orderChanges: 0, playerChanges: 0, playerSeen: 0, crossings: 0, projected: 0 };
for (const skip of [false, true]) {
  for (const track of tracks) {
    for (let seed = 1; seed <= 5; seed++) {
      const race = createRace({ track, racers, player: 'pip', seed, pace: 'standard' });
      race.items = createItems(race); race.player.autopilot = true;
      const mine = new Map(race.karts.map((k) => [k, [k.gridSlot + 1]]));
      const w = track.L / GATES, cols = GATES * race.laps;
      let order = race.order.map((k) => k.racer.id).join(), place = race.player.place, steps = 0;
      while (!race.done && steps < 120 * 300) {
        stepRace(race, {}); steps++; race.events.length = 0;
        if (race.phase === 'countdown') continue;
        const places = rank(race.karts);
        for (const k of race.karts) {
          if (k.projected) continue;
          const g = Math.min(cols, Math.floor(Math.max(0, k.dist) / w)), rec = mine.get(k);
          while (rec.length <= g) rec.push(places.get(k));
        }
        const o = race.order.map((k) => k.racer.id).join();
        if (o !== order) { totals.orderChanges++; order = o; }
        if (race.player.place !== place) { totals.playerChanges++; place = race.player.place; }
        if (skip && race.phase === 'finished' && race.finishT >= 2) finishRace(race);
      }
      totals.races++;
      for (const k of race.karts) {
        totals.karts++;
        const a = JSON.stringify(k.gates), b = JSON.stringify(mine.get(k));
        const shape = k.projected ? k.gates.length <= cols : k.gates.length === cols + 1 && k.gates[cols] === k.place;
        if (a === b && shape) totals.same++;
        else if (fails.length < 5) fails.push(`${track.id} seed ${seed}${skip ? ' (skipped)' : ''} ${k.racer.id}: gates ${a} against the test's ${b}`);
        if (k.projected) totals.projected++;
      }
      const pg = race.player.gates;
      for (let i = 1; i < pg.length; i++) if (pg[i] !== pg[i - 1]) totals.playerSeen++;
      const ks = race.karts;
      for (let c = 1; c <= cols; c++) for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
        const A = ks[i].gates, B = ks[j].gates;
        if (A[c] != null && B[c] != null && (A[c - 1] - B[c - 1]) * (A[c] - B[c]) < 0) totals.crossings++;
      }
    }
  }
}
ok(totals.same === totals.karts, `kart.gates equals the test's own record for ${totals.same} of ${totals.karts} karts in ${totals.races} races (grid first; a finisher's 31st column its finishing place; a projected kart's record stopped where it stood)`);
ok(totals.projected > 0, `projected finishers tested: ${totals.projected} (the races that skip the wait included)`);
const per = (n) => (n / totals.races).toFixed(1);
console.log(`     per race, over ${totals.races} races: the order changes ${per(totals.orderChanges)} times, the chart shows ${per(totals.crossings)} crossings; your place changes ${per(totals.playerChanges)} times and the chart sees ${per(totals.playerSeen)}`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('\nall checks pass');
