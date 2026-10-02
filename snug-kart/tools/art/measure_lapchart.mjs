// What a lap chart of this game's races holds (ART.md 1): the real race code, set up as tools/sim.mjs sets it
// up, 3 tracks x 5 seeds at Standard pace with items, the player's kart on autopilot. Not shipped.
//   node tools/art/measure_lapchart.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { loadTracks } = await import(path.join(APP, 'js/track.js'));
const { createRace, stepRace, finishRace } = await import(path.join(APP, 'js/race.js'));
const { createItems } = await import(path.join(APP, 'js/items.js'));
const tracks = loadTracks(JSON.parse(fs.readFileSync(path.join(APP, 'data/tracks.json'), 'utf8')));
const racers = JSON.parse(fs.readFileSync(path.join(APP, 'data/racers.json'), 'utf8')).racers;
for (const [G, SKIP] of [[10, false], [20, false], [10, true]]) {
  let tot = { liveChanges: 0, races: 0, missed: 0, swaps: 0, gateChanges: 0, est: 0, crossings: 0 };
  for (const track of tracks) for (let seed = 1; seed <= 5; seed++) {
    const race = createRace({ track, racers, player: 'pip', seed, pace: 'standard' });
    race.items = createItems(race); race.player.autopilot = true;
    const L = track.L, gw = L / G;
    const gates = new Map(race.karts.map((k) => [k, [k.place]]));
    let last = race.player.place, prevOrder = race.order.map((k) => k.racer.id).join();
    let steps = 0;
    while (!race.done && steps < 120 * 300) {
      stepRace(race, {}); steps++;
      const P = race.player; if (P.place !== last) { tot.liveChanges++; last = P.place; }
      const o = race.order.map((k) => k.racer.id).join(); if (o !== prevOrder) { tot.swaps++; prevOrder = o; }
      for (const k of race.karts) { const arr = gates.get(k); const g = Math.min(3 * G, Math.floor(Math.max(0, k.dist) / gw));
        while (arr.length <= g && !k.projected) arr.push(k.place); }
      race.events.length = 0;
      if (race.phase === 'finished' && race.finishT > (SKIP ? 2.0 : 8.1)) break;   // SKIP: the tap that skips the wait, 2 s after the banner
    }
    if (!race.done) finishRace(race);
    for (const k of race.karts) { if (k.projected) tot.est++; }
    // place changes between consecutive gate samples of the player
    const pg = gates.get(race.player); for (let i = 1; i < pg.length; i++) if (pg[i] !== pg[i - 1]) tot.gateChanges++;
    // crossings of lines between successive gates (pairs whose order flips)
    const ks = race.karts; for (let i = 1; i <= 3 * G; i++) for (let a = 0; a < ks.length; a++) for (let b = a + 1; b < ks.length; b++) {
      const A = gates.get(ks[a]), B = gates.get(ks[b]); if (A[i] == null || B[i] == null) continue; if ((A[i - 1] - B[i - 1]) * (A[i] - B[i]) < 0) tot.crossings++; }
    tot.races++;
  }
  console.log(`gates per lap ${G}${SKIP ? ', the wait skipped at 2 s' : ''}: ${tot.races} races; player place changes (every step) ${tot.liveChanges} = ${(tot.liveChanges / tot.races).toFixed(1)}/race; order changes (any kart) ${(tot.swaps / tot.races).toFixed(1)}/race; player place changes seen at gates ${(tot.gateChanges / tot.races).toFixed(1)}/race; line crossings ${(tot.crossings / tot.races).toFixed(1)}/race; projected finishers ${tot.est}`);
}
