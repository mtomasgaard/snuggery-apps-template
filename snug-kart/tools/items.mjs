// Item rules in Node, no browser (DESIGN.md §4): each item's effect set up deterministically on the
// real race code, plus the parcels' pickup, shuffle and respawn and the distribution table.
//
//   node tools/items.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { loadTracks } = await import(path.join(APP, 'js/track.js'));
const { createRace, stepRace, STEP } = await import(path.join(APP, 'js/race.js'));
const { placeKart } = await import(path.join(APP, 'js/physics.js'));
const { createItems, pickItem, ITEM } = await import(path.join(APP, 'js/items.js'));
const tracks = loadTracks(JSON.parse(fs.readFileSync(path.join(APP, 'data/tracks.json'), 'utf8')));
const racers = JSON.parse(fs.readFileSync(path.join(APP, 'data/racers.json'), 'utf8')).racers;

const fails = [];
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails.push(m); };
const IDLE = { steer: 0, drift: false, brake: 0, useItem: false };

/** A race on Harbour Loop past the countdown, everyone frozen in place except as a test moves them. */
function setup(seed = 1) {
  const track = tracks.find((t) => t.id === 'harbour');
  const race = createRace({ track, racers, player: 'pip', seed, pace: 'standard' });
  race.items = createItems(race);
  while (race.phase === 'countdown') stepRace(race, IDLE);
  for (const k of race.karts) { k.frozen = true; k.reactT = 1e9; }
  return race;
}
const run = (race, seconds, inp = IDLE) => { for (let i = 0; i < Math.round(seconds / STEP); i++) stepRace(race, inp); };
const at = (race, k, s, l = 0, v = 0) => { placeKart(k, race.track, Math.round(s / race.track.ds) % race.track.N, l, v); k.frozen = false; k.dist = Math.max(0, k.lapsDone) * race.track.L + k.fr.s; };
const events = (race, type) => race.events.filter((e) => e.type === type);

// Distribution (§4): the leader never gets a Paper Plane; 7th–8th mostly Kettles.
{
  const n = 20000, count = (place) => { const c = {}; for (let i = 0; i < n; i++) { const it = pickItem(place, (i + 0.5) / n); c[it] = (c[it] || 0) + 1; } return c; };
  const first = count(1), last = count(8);
  ok(!first.plane && Math.abs(first.yarn / n - 0.40) < 0.01, `1st: no planes, yarn ${(first.yarn / n * 100).toFixed(0)} % (table 40 %)`);
  ok(Math.abs(last.kettle / n - 0.40) < 0.01 && Math.abs(last.plane / n - 0.35) < 0.01, `8th: kettle ${(last.kettle / n * 100).toFixed(0)} %, plane ${(last.plane / n * 100).toFixed(0)} % (table 40 / 35)`);
}

// Parcels: a kart driving through a row collects one; the shuffle takes 0.8 s; the item can't be
// used before it settles; the parcel is back 1.8 s later.
{
  const race = setup(2), P = race.player, row = race.items.parcels[1];
  at(race, P, row.idx * race.track.ds - 12, row.l, 20);
  race.events.length = 0;
  run(race, 0.8);
  ok(P.item && events(race, 'pickup').length === 1, `pickup: ${P.item} from the parcel row (${events(race, 'pickup').length} pickup event)`);
  ok(row.taken > 0, 'the parcel is taken');
  ok(P.itemRoll > 0 && !race.items.onUse(race, P), 'the item cannot be used while the button still shuffles');
  let rollT = 0; while (P.itemRoll > 0 && rollT < 2) { stepRace(race, IDLE); rollT += STEP; }
  ok(P.itemRoll === 0 && rollT <= 0.8, `the shuffle settles within 0.8 s of the pickup`);
  const ticks = events(race, 'roll').length;
  ok(ticks === 4, `four shuffle ticks (${ticks})`);
  run(race, 3.0);
  ok(row.taken === 0 && row.scale === 1, `the parcel has grown back ${(ITEM.respawn + ITEM.grow).toFixed(1)} s after it was taken (scale ${row.scale})`);
}

// Kettle: a 1.4 s boost to vTop + 8.
{
  const race = setup(3), P = race.player;
  at(race, P, 100, 0, 25);
  race.items.give(P, 'kettle');
  run(race, 0.05, { ...IDLE, useItem: true });
  ok(P.boostKind === 'kettle' && P.boostT > 1.3, `kettle: boost ${P.boostT.toFixed(2)} s (${P.boostKind})`);
  run(race, 1.0);
  ok(P.v > 31, `kettle: speed ${P.v.toFixed(1)} m/s, over the 30 m/s top speed`);
}

// Yarn Snare dropped 2.5 m behind: the next kart through it spins out (1.0 s, speed capped at 8 m/s);
// an aware AI steers round it instead.
const { pointAt } = await import(path.join(APP, 'js/track.js'));
function snareTest(awareness) {
  const race = setup(4), P = race.player, B = race.karts.find((k) => !k.isPlayer), tr = race.track;
  at(race, P, 930, 0, 20);
  race.items.give(P, 'yarn');
  run(race, 0.02, { ...IDLE, useItem: true });
  const y = race.items.yarns[0], dropped = y && Math.abs(y.s - (P.fr.s - 2.5)) < 1.5;
  // Move it onto the chaser's own lane on the quay straight, 30 m ahead of it.
  const lane = B.driver.p.lane * (tr.hw[880] - 2);
  at(race, B, 880, lane, 20);
  y.idx = 910; y.l = lane; y.s = 910 * tr.ds; Object.assign(y, pointAt(tr, 910, lane)); y.age = 1;
  P.frozen = true;
  B.driver.useItem = false; B.driver.p = { ...B.driver.p, awareness };
  let spun = false, vMax = 0, spinT = 0;
  for (let i = 0; i < 240; i++) { stepRace(race, IDLE); if (B.stun === 'spin') { spun = true; spinT += STEP; if (spinT > 0.5) vMax = Math.max(vMax, B.v); } }
  return { dropped, spun, vMax, left: race.items.yarns.length };
}
{
  const a = snareTest(0);
  ok(a.dropped, 'yarn dropped 2.5 m behind the kart');
  ok(a.spun && a.left === 0, `a kart that does not dodge hits it and spins out (snares left ${a.left})`);
  ok(a.vMax <= 8.01, `spinning: at most ${a.vMax.toFixed(1)} m/s from 0.5 s into the spin (cap 8)`);
  const b = snareTest(1);
  ok(!b.spun && b.left === 1, `an aware AI steers round it (spun ${b.spun}, snare still down ${b.left === 1})`);
}

// Quilt: blocks the next hit and pops; honey has no effect while it is up.
{
  const race = setup(5), P = race.player, B = race.karts.find((k) => !k.isPlayer);
  at(race, P, 300, 0, 0);
  race.items.give(P, 'quilt');
  run(race, 0.02, { ...IDLE, useItem: true });
  ok(P.shieldT > 9.9, `quilt raised (${P.shieldT.toFixed(2)} s)`);
  at(race, B, 330, 0, 20);
  race.items.give(B, 'yarn'); race.items.onUse(race, B);
  const y = race.items.yarns[0]; y.x = P.x; y.z = P.z; y.y = P.y; y.age = 1;
  race.events.length = 0;
  run(race, 0.05);
  ok(!P.stun && P.shieldT === 0 && events(race, 'shieldPop').length === 1, `the quilt takes the snare and pops (stun ${P.stun}, shield ${P.shieldT})`);
}

// Paper Plane: homes on the racer one place ahead and tumbles it (1.3 s, speed × 0.2).
{
  const race = setup(6), P = race.player, T = race.karts.find((k) => !k.isPlayer);
  for (const k of race.karts) if (k !== P && k !== T) at(race, k, 900, 0, 0);
  at(race, P, 100, -3, 25); at(race, T, 150, 4, 25);
  T.driver.useItem = false;
  run(race, 0.02);
  ok(T.place === P.place - 1, `target is one place ahead (${T.place} vs ${P.place})`);
  race.items.give(P, 'plane');
  run(race, 0.02, { ...IDLE, useItem: true });
  const pl = race.items.planes[0];
  ok(pl && pl.target === T, `plane launched at ${pl && pl.target && pl.target.racer.id}`);
  let hit = false, t = 0;
  for (; t < 6 && !hit; t += STEP) { stepRace(race, IDLE); if (T.stun === 'tumble') hit = true; }
  ok(hit, `the plane lands on its target after ${t.toFixed(2)} s, 4 m of lateral offset closed`);
}

// Leader's plane: no target, fades after 2 s.
{
  const race = setup(7), P = race.player;
  for (const k of race.karts) if (k !== P) at(race, k, 100, 0, 0);
  at(race, P, 400, 0, 0);
  run(race, 0.02);
  race.items.give(P, 'plane');
  run(race, 0.02, { ...IDLE, useItem: true });
  ok(race.items.planes.length === 1 && !race.items.planes[0].target, 'a leader\'s plane has no target');
  run(race, 2.2);
  ok(race.items.planes.length === 0, 'and is gone after 2 s');
}

// Honey: spreads to 3.2 m in 0.4 s and halves top speed while inside, plus 0.3 s.
{
  const race = setup(8), P = race.player, B = race.karts.find((k) => !k.isPlayer);
  at(race, P, 500, 0, 20);
  race.items.give(P, 'honey');
  run(race, 0.02, { ...IDLE, useItem: true });
  run(race, 0.5);
  const h = race.items.honeys[0];
  ok(h && Math.abs(h.r - ITEM.honeyR) < 1e-6, `honey spread to ${h && h.r} m`);
  at(race, B, h.s - 1, h.l, 24); B.driver.useItem = false;
  let slowed = false;
  for (let i = 0; i < 60; i++) { stepRace(race, IDLE); if (B.honeyT > 0) slowed = true; }
  ok(slowed, 'a kart driving through is slowed (honeyT set)');
  B.frozen = true; B.honeyT = 0; B.v = 0; B.x = h.x; B.z = h.z; B.shieldT = 5;
  run(race, 0.2);
  ok(B.honeyT === 0, 'a shielded kart is not slowed');
}

// The AI uses what it holds: every AI with a Kettle on a straight uses it within its hold time.
{
  const race = setup(9);
  for (const k of race.karts) { k.frozen = false; k.reactT = 0; }
  race.player.autopilot = true;
  for (const k of race.karts) race.items.give(k, 'plane');
  run(race, 10);
  const left = race.karts.filter((k) => k.item === 'plane').length;
  ok(left === 0, `every AI fired its Paper Plane within 10 s (${left} still holding)`);
}

if (fails.length) { console.log(`FAIL (${fails.length})`); process.exit(1); }
console.log('items: all pass');
