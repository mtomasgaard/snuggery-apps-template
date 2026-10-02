// One race: the grid, the countdown, laps and checkpoints, positions, the finish and projected times
// (DESIGN.md §5.1, §8.4, §8.5, §12). Pure: no three, no DOM. The fixed step is 1/120 s (§7).
//
// Items plug in as `race.items` (js/items.js: step(race, dt) and onUse(race, kart)); every race event
// goes on `race.events` ({ type, kart, ...data }), which the HUD and the audio drain each frame.

import { createKart, placeKart, stepKart, resolveBumps, headingDot, PHYS } from './physics.js';
import { prepareAI, createDriver, drive, aiTopSpeed, PACE } from './ai.js';
import { mulberry32 } from './rng.js';

export const STEP = 1 / 120;
export const LAPS = 3;
export const COUNTDOWN = 3;
export const GATES = 10;              // timing lines a lap, for the Lap Chart (ART.md 1)
const FINISH_BANNER = 2, FINISH_WAIT = 8;

/**
 * opts: { track, racers (the eight rows of racers.json), player (racer id), seed, pace ('standard'…) }
 */
export function createRace(opts) {
  const { track, racers, player, seed = 1 } = opts;
  prepareAI(track);
  const rnd = mulberry32(seed * 7919 + 17);
  const pace = PACE[opts.pace] || PACE.standard;
  // Grid (§8.5): two columns at ±3 m, four rows 5 m apart, the front row 8 m behind the line.
  // The player starts 5th (third row, left); the AI order is shuffled per race.
  const others = racers.filter((r) => r.id !== player);
  for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
  const order = [...others.slice(0, 4), racers.find((r) => r.id === player) || racers[0], ...others.slice(4)];
  const karts = order.map((r, slot) => {
    const k = createKart(slot);
    k.racer = r; k.isPlayer = r.id === player;
    const row = Math.floor(slot / 2), col = slot % 2;
    const s = track.L - 8 - 5 * row, idx = Math.round(s / track.ds) % track.N;
    placeKart(k, track, idx, col === 0 ? -3 : 3, 0);
    k.gridSlot = slot;
    k.lapsDone = -1; k.cp = 3;            // behind the line: the first crossing starts lap 1
    k.lapStart = 0; k.lapTimes = []; k.bestLap = null;
    k.finished = false; k.finishTime = null; k.projected = false;
    k.dist = -(track.L - k.fr.s);         // race distance = lapsDone·L + s
    k.hist = [];                          // race distance every 0.5 s, for projected times
    k.reactT = k.isPlayer ? 0 : 0.05 + 0.25 * rnd();
    k.driver = createDriver(r.ai || { lane: 0, skill: 1, drift: 0.5, aggression: 0.5, awareness: 0.8 }, seed * 131 + slot * 977 + 3);
    k.autopilot = false;
    k.item = null;                        // the held item (js/items.js)
    k.aiInput = {};                       // the AI's input, reused every step
    k.place = slot + 1;
    k.gates = [slot + 1];                 // the place at every timing line crossed; the grid first
    return k;
  });
  const race = {
    track, karts, player: karts.find((k) => k.isPlayer), pace, laps: LAPS, seed,
    phase: 'countdown', countdown: COUNTDOWN, lastCount: COUNTDOWN + 1,
    time: 0, finishT: 0, events: [], items: null, histT: 0, done: false,
    order: karts.slice(),                 // karts by place, re-sorted in place every step
  };
  race.emit = emitter(race);
  race.aiCtx = { track, karts, dt: STEP };
  return race;
}

export function emitter(race) {
  return (type, kart, data) => race.events.push({ type, kart, ...(data || {}) });
}

/** Advance the race by one fixed step. `playerInput` = { steer, drift, brake, useItem }. */
export function stepRace(race, playerInput) {
  const dt = STEP, { track, karts, emit } = race;
  if (race.done) return;

  if (race.phase === 'countdown') {
    race.countdown -= dt;
    const n = Math.ceil(race.countdown);
    if (n < race.lastCount && n > 0) { race.lastCount = n; emit('count', null, { n }); }
    for (const k of karts) stepKart(k, k.isPlayer ? playerInput : { steer: 0 }, track, dt, emit);
    if (race.countdown <= 0) {
      race.phase = 'racing'; race.countdown = 0; emit('go', null);
      for (const k of karts) if (k.isPlayer) k.frozen = false;
    }
    return;
  }

  race.time += dt;
  const P = race.player;
  const finalLap = (k) => k.lapsDone >= race.laps - 1;
  for (const k of karts) {
    if (k.frozen && k.reactT > 0) { k.reactT -= dt; if (k.reactT <= 0) k.frozen = false; }
    let inp;
    if (k.isPlayer && !k.autopilot) inp = playerInput;
    else {
      if (!k.isPlayer) k.vTop = aiTopSpeed(k.driver.p, race.pace, P.finished ? null : k.dist - P.dist, finalLap(k));
      else k.vTop = PHYS.vTop * race.pace;           // the player's kart on autopilot drives like an even AI
      inp = drive(k, k.driver, race.aiCtx, k.aiInput);
    }
    if (inp.useItem && race.items) race.items.onUse(race, k);
    const prevS = k.fr.s;
    stepKart(k, inp, track, dt, emit);
    lapLogic(race, k, prevS, emit);
    // Stuck and wrong way (§8.4)
    if (!k.frozen && k.respawnT === 0) {
      k.stuckT = Math.abs(k.v) < PHYS.stuckV ? k.stuckT + dt : 0;
      const wrong = headingDot(k, track) < PHYS.wrongDot;
      k.wrongT = wrong ? k.wrongT + dt : 0;
      const banner = wrong && k.wrongT >= PHYS.wrongBanner && Math.abs(k.v) > 3;
      if (banner !== k.wrongWay) { k.wrongWay = banner; if (k.isPlayer) emit('wrongWay', k, { on: banner }); }
      if (k.stuckT >= PHYS.stuckTime || k.wrongT >= PHYS.wrongRespawn) {
        k.stuckT = 0; k.wrongT = 0; k.wrongWay = false; k.respawns++;
        k.respawnT = PHYS.respawnFade; k.drift = false; k.stun = null; k.boostT = 0;
        emit('respawn', k);
      }
    }
  }
  resolveBumps(karts, emit);
  if (race.items) race.items.step(race, dt);

  // History for projected times.
  race.histT += dt;
  if (race.histT >= 0.5) {
    race.histT -= 0.5;
    for (const k of karts) { k.hist.push(k.dist); if (k.hist.length > 21) k.hist.shift(); }
  }
  updatePlaces(race);
  recordGates(race);

  if (race.phase === 'finished') {
    race.finishT += dt;
    const all = karts.every((k) => k.finished);
    if ((all && race.finishT >= FINISH_BANNER) || race.finishT >= FINISH_WAIT) finishRace(race);
  }
}

function lapLogic(race, k, prevS, emit) {
  const { track } = race, L = track.L, s = k.fr.s;
  if (k.respawnT > 0) return;
  // Checkpoints at 25 %, 50 %, 75 %, in order.
  if (k.cp === 0 && s >= 0.25 * L && s < 0.5 * L) k.cp = 1;
  else if (k.cp === 1 && s >= 0.5 * L && s < 0.75 * L) k.cp = 2;
  else if (k.cp === 2 && s >= 0.75 * L) k.cp = 3;
  if (prevS > L - 40 && s < 40) {                        // crossed the line forward
    if (k.cp === 3) {
      k.cp = 0; k.lapsDone++;
      // Interpolate the crossing time inside the step.
      const frac = (L - prevS) / Math.max(1e-6, (L - prevS) + s);
      const t = race.time - STEP * (1 - frac);
      if (k.lapsDone >= 1) {
        const lap = t - k.lapStart;
        k.lapTimes.push(lap); k.lapStart = t;
        if (k.bestLap === null || lap < k.bestLap) k.bestLap = lap;
        if (k.lapsDone >= race.laps) {
          k.finished = true; k.finishTime = t; k.finishPlace = race.karts.filter((o) => o.finished).length;
          emit('finish', k, { place: k.finishPlace, time: t });
          if (k.isPlayer) { race.phase = 'finished'; race.finishT = 0; k.autopilot = true; }
        } else if (k.isPlayer) emit('lap', k, { lap: k.lapsDone + 1, final: k.lapsDone + 1 === race.laps, time: lap });
      }
    }
  } else if (prevS < 40 && s > L - 40) {                 // backed across the line
    if (k.cp === 0 && k.lapsDone >= 0 && !k.finished) { k.lapsDone--; k.cp = 3; }
  }
  k.dist = k.lapsDone * L + s;
}

const byPlace = (a, b) => {
  if (a.finished && b.finished) return a.finishTime - b.finishTime;
  if (a.finished) return -1; if (b.finished) return 1;
  return b.dist - a.dist;
};
function updatePlaces(race) {
  const order = race.order;
  order.sort(byPlace);
  for (let i = 0; i < order.length; i++) order[i].place = i + 1;
}

// The Lap Chart's record: at each tenth of a lap the place the kart crossed it in, the finish (column
// 30) included. A projected kart's record stops where it stood when the race ended.
function recordGates(race) {
  const w = race.track.L / GATES, last = GATES * race.laps;
  for (const k of race.karts) {
    if (k.projected) continue;
    const g = Math.min(last, Math.floor(Math.max(0, k.dist) / w));
    while (k.gates.length <= g) k.gates.push(k.place);
  }
}

/** End the race: anyone still racing gets a projected time (§12), shown as "about". */
export function finishRace(race) {
  if (race.done) return;
  const L = race.track.L, total = race.laps * L;
  for (const k of race.karts) {
    if (k.finished) continue;
    const h = k.hist, n = h.length;
    const avg = n >= 2 ? (h[n - 1] - h[0]) / ((n - 1) * 0.5) : 10;
    k.finishTime = race.time + Math.max(0, total - k.dist) / Math.max(avg, 10);
    k.finished = true; k.projected = true;
  }
  updatePlaces(race);
  race.done = true; race.phase = 'done';
  race.events.push({ type: 'results', kart: null });
}

/** Lap number shown on the HUD (1..laps). */
export const lapShown = (race, k) => Math.max(1, Math.min(race.laps, k.lapsDone + 1));
