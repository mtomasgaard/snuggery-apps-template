// Parcels, the five household items, their hits, and how the AI uses them (DESIGN.md §4). Pure: no
// three, no DOM, so tools/sim.mjs runs the same code in Node. The view (meshes, the item button, the
// reticle) is js/items-view.js; the race calls `items.step(race, dt)` once per fixed step and
// `items.onUse(race, kart)` when a kart presses its item button.
//
// Events pushed on race.events: pickup {item}, roll (a shuffle tick, player only), use {item},
// shieldPop, hit {by: 'yarn' | 'plane'}, honeyIn, planeGone.

import { applyBoost, stunKart, PHYS } from './physics.js';
import { pointAt } from './track.js';
import { mulberry32 } from './rng.js';
import { emitter } from './race.js';

export const ITEMS = ['kettle', 'quilt', 'yarn', 'plane', 'honey'];
export const ITEM_NAMES = { kettle: 'Kettle', quilt: 'Quilt', yarn: 'Yarn Snare', plane: 'Paper Plane', honey: 'Honey Puddle' };

export const ITEM = {
  // respawn: first designed as 3.0 s, but a pack passes a row in about 2 s, so at most four of eight
  // karts got an item. pickR: first designed as 1.3 m, which leaves a 1 m gap between parcels 0.4 ×
  // half-width apart, so a kart on the center line passed between them; 1.8 m closes it. (NOTES.md,
  // Decision 23.)
  lanes: [-0.6, -0.2, 0.2, 0.6], pickR: 1.8, respawn: 1.5, shrink: 0.15, grow: 0.3, roll: 0.8,
  kettle: 1.4,
  quiltTime: 10,
  yarnBack: 2.5, yarnR: 0.9, yarnLife: 40, yarnMax: 10, yarnArm: 0.35,
  // Paper Plane: first designed to live 6 s, but at 45 m/s against a 30 m/s target a plane fired at
  // the AI's 90 m range needs 6 s just to arrive, so it lives 7 s (the leader's still fades after 2 s).
  planeV: 45, planeHome: 25, planeLat: 8, planeR: 1.2, planeLife: 7, planeLeaderLife: 2, planeLift: 1.6,
  honeyBack: 4.0, honeyR: 3.2, honeySpread: 0.4, honeyLife: 14, honeyMax: 4, honeyLinger: 0.3, honeyOwnerSafe: 1.5,
};

// Weights by the collector's place at pickup: [kettle, quilt, yarn, plane, honey].
const WEIGHTS = [
  [1, 1, [5, 25, 40, 0, 30]],
  [2, 3, [15, 20, 25, 20, 20]],
  [4, 6, [25, 15, 15, 30, 15]],
  [7, 8, [40, 15, 5, 35, 5]],
];
export function pickItem(place, r) {
  const w = (WEIGHTS.find(([a, b]) => place >= a && place <= b) || WEIGHTS[3])[2];
  let x = r * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) { x -= w[i]; if (x < 0) return ITEMS[i]; }
  return ITEMS[4];
}

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const P = {};

/** Per-track tables for AI item decisions: is the next 60 m nearly straight (|κ| < 1/120 throughout)? */
function prepare(track) {
  if (track.itemAI) return track.itemAI;
  const { N, ds, kappa } = track, look = Math.round(60 / ds);
  const straight = new Uint8Array(N);
  let run = 0;
  // run = length of the straight stretch starting at i (computed backwards, twice round the loop).
  const len = new Float32Array(N);
  for (let n = 2 * N - 1; n >= 0; n--) { const i = n % N; run = Math.abs(kappa[i]) < 1 / 120 ? run + 1 : 0; len[i] = run; }
  for (let i = 0; i < N; i++) straight[i] = len[i] >= look ? 1 : 0;
  return (track.itemAI = { straight });
}

/** Signed distance along the loop from a to b (−L/2 … L/2). */
const along = (track, sa, sb) => { let d = sb - sa; const L = track.L; if (d > L / 2) d -= L; if (d < -L / 2) d += L; return d; };

export function createItems(race) {
  const { track } = race, { N, ds, hw } = track;
  prepare(track);
  const rnd = mulberry32(race.seed * 104729 + 7);
  const emit = emitter(race);
  let nextId = 1;

  // Parcels: rows of four at each distance in the track's "parcels" list.
  const parcels = [];
  for (const s of track.def.parcels) {
    const idx = Math.round(((s % track.L) + track.L) % track.L / ds) % N;
    for (const f of ITEM.lanes) {
      const l = f * hw[idx];
      pointAt(track, idx, l, 0, P);
      parcels.push({ idx, l, x: P.x, y: P.y, z: P.z, taken: 0, scale: 1 });
    }
  }

  const S = {
    parcels, yarns: [], honeys: [], planes: [],
    stats: { pickups: 0, uses: { kettle: 0, quilt: 0, yarn: 0, plane: 0, honey: 0 }, hits: { yarn: 0, plane: 0, honey: 0 }, blocked: 0 },
    give, onUse, step,
  };

  for (const k of race.karts) {
    k.item = null; k.itemRoll = 0; k.plane = null;
    if (k.driver) Object.assign(k.driver, { holdT: 0, heldT: 0, seen: new Set(), dodgeTarget: 0, dodgeUntil: 0 });
  }

  function give(k, id) {
    k.item = id; k.itemRoll = 0;
    if (k.driver) { k.driver.heldT = 0; k.driver.holdT = 0; }
    return true;
  }

  function collect(k) {
    const id = pickItem(k.place, rnd());
    k.item = id; k.itemRoll = ITEM.roll; k.rollTick = 0;
    S.stats.pickups++; k.pickups = (k.pickups || 0) + 1;
    const d = k.driver;
    if (d) { d.heldT = 0; d.holdT = (1.5 + 4.5 * d.rnd()) * (1.3 - (d.p.aggression ?? 0.5)); }
    emit('pickup', k, { item: id });
  }

  // Put something on the road behind a kart: returns its track frame and position.
  function behind(k, back) {
    const c = Math.cos(k.psi), s = Math.sin(k.psi);
    const x = k.x - c * back, z = k.z - s * back;
    const idx = track.wrap(k.fr.idx - Math.round(back / ds));
    const fx = track.fx[idx], fz = track.fz[idx];
    const l = clamp(-(x - track.px[idx]) * fz + (z - track.pz[idx]) * fx, -hw[idx] - track.verge[idx] + 1, hw[idx] + track.verge[idx] - 1);
    pointAt(track, idx, l, 0, P);
    return { idx, l, x: P.x, y: P.y, z: P.z, s: idx * ds };
  }

  function onUse(race, k) {
    if (!k.item || k.itemRoll > 0 || k.stun || k.respawnT > 0) return false;
    const id = k.item;
    k.item = null;
    S.stats.uses[id]++;
    if (k.driver) { k.driver.heldT = 0; }
    switch (id) {
      case 'kettle': applyBoost(k, ITEM.kettle, 'kettle'); break;
      case 'quilt': k.shieldT = ITEM.quiltTime; break;
      case 'yarn': {
        if (S.yarns.length >= ITEM.yarnMax) S.yarns.shift();
        S.yarns.push({ id: nextId++, owner: k, age: 0, ...behind(k, ITEM.yarnBack), color: k.racer.body });
        break;
      }
      case 'honey': {
        if (S.honeys.length >= ITEM.honeyMax) S.honeys.shift();
        S.honeys.push({ id: nextId++, owner: k, age: 0, r: 0, ...behind(k, ITEM.honeyBack) });
        break;
      }
      case 'plane': {
        const target = race.order ? race.order.find((o) => o.place === k.place - 1 && !o.finished) || null : null;
        const pl = { id: nextId++, owner: k, target, age: 0, dist: k.dist + 2.5, l: k.fr.l, lift: ITEM.planeLift, x: k.x, y: k.y + ITEM.planeLift, z: k.z, heading: k.psi, fade: 1 };
        S.planes.push(pl);
        k.plane = pl;
        if (target) {
          // The target learns of it now: an AI holding a Quilt raises it with probability `awareness`.
          const d = target.driver;
          if (target.item === 'quilt' && target.itemRoll === 0 && d && (!target.isPlayer || target.autopilot) && d.rnd() < (d.p.awareness ?? 0.8)) d.useItem = true;
          if (target.isPlayer) emit('incoming', target, { from: k });
        }
        break;
      }
    }
    emit('use', k, { item: id });
    return true;
  }

  /** A hazard or plane reaches kart `v`: the Quilt blocks it; otherwise stun. Returns true if it landed. */
  function hit(v, kind) {
    if (v.respawnT > 0) return false;
    if (v.shieldT > 0) { v.shieldT = 0; S.stats.blocked++; emit('shieldPop', v); return true; }
    if (stunKart(v, kind === 'plane' ? 'tumble' : 'spin', emit)) { S.stats.hits[kind]++; emit('hit', v, { by: kind }); return true; }
    return false;
  }

  function step(race, dt) {
    const karts = race.karts;
    // Parcels: shrink when taken, regrow ITEM.respawn (1.5 s) later.
    for (const p of parcels) {
      if (p.taken > 0) {
        p.taken += dt;
        const back = p.taken - ITEM.respawn;
        p.scale = back < 0 ? Math.max(0, 1 - p.taken / ITEM.shrink) : Math.min(1, back / ITEM.grow);
        if (back >= ITEM.grow) { p.taken = 0; p.scale = 1; }
        continue;
      }
      for (const k of karts) {
        // A kart already holding an item drives through a parcel without breaking it (the first
        // design had it break the parcel for nothing, which let a tight pack's front runners strip
        // every row before the midfield arrived).
        if (k.item || k.respawnT > 0 || Math.abs(k.y - p.y) > 2) continue;
        const dx = k.x - p.x, dz = k.z - p.z;
        if (dx * dx + dz * dz < ITEM.pickR * ITEM.pickR) { p.taken = 1e-6; collect(k); break; }
      }
    }
    // The shuffle on the item button: 0.8 s, four ticks.
    for (const k of karts) {
      if (k.itemRoll > 0) {
        const before = Math.ceil(k.itemRoll / 0.2);
        k.itemRoll = Math.max(0, k.itemRoll - dt);
        if (k.isPlayer && Math.ceil(k.itemRoll / 0.2) !== before) emit('roll', k, { done: k.itemRoll === 0 });
      }
    }
    // Yarn snares
    for (let i = S.yarns.length - 1; i >= 0; i--) {
      const y = S.yarns[i]; y.age += dt;
      if (y.age > ITEM.yarnLife) { S.yarns.splice(i, 1); continue; }
      if (y.age < ITEM.yarnArm) continue;
      const R = ITEM.yarnR + PHYS.radius * 0.7;
      for (const k of karts) {
        if (k.respawnT > 0 || Math.abs(k.y - y.y) > 1.5) continue;
        const dx = k.x - y.x, dz = k.z - y.z;
        if (dx * dx + dz * dz < R * R) {
          if (k.immuneT > 0 || k.stun) continue;               // recovering karts pass through it
          hit(k, 'yarn'); S.yarns.splice(i, 1); break;
        }
      }
    }
    // Honey puddles
    for (let i = S.honeys.length - 1; i >= 0; i--) {
      const h = S.honeys[i]; h.age += dt;
      h.r = ITEM.honeyR * Math.min(1, h.age / ITEM.honeySpread);
      if (h.age > ITEM.honeyLife) { S.honeys.splice(i, 1); continue; }
      for (const k of karts) {
        if (k.respawnT > 0 || Math.abs(k.y - h.y) > 1.5) continue;
        if (k === h.owner && h.age < ITEM.honeyOwnerSafe) continue;
        const dx = k.x - h.x, dz = k.z - h.z;
        if (dx * dx + dz * dz < h.r * h.r && k.shieldT <= 0) {
          if (k.honeyT <= 0) { S.stats.hits.honey++; emit('honeyIn', k); }
          k.honeyT = ITEM.honeyLinger;
        }
      }
    }
    // Paper planes: along the track at 45 m/s; within 25 m of the target, close laterally at 8 m/s
    // and down to kart height. Anyone but the thrower in the way is hit too.
    for (let i = S.planes.length - 1; i >= 0; i--) {
      const pl = S.planes[i]; pl.age += dt;
      const life = pl.target ? ITEM.planeLife : ITEM.planeLeaderLife;
      if (pl.age > life || (pl.target && pl.target.finished)) { gone(i, pl); continue; }
      if (!pl.target) pl.fade = Math.max(0, 1 - Math.max(0, pl.age - (life - 0.5)) / 0.5);
      pl.dist += ITEM.planeV * dt;
      const s = ((pl.dist % track.L) + track.L) % track.L, idx = Math.floor(s / ds) % N;
      if (pl.target) {
        const gap = pl.target.dist - pl.dist;
        if (gap < ITEM.planeHome) {
          const dl = pl.target.fr.l - pl.l;
          pl.l += clamp(dl, -ITEM.planeLat * dt, ITEM.planeLat * dt);
          pl.lift += (0.8 - pl.lift) * Math.min(1, 3 * dt);
        }
      }
      pl.l = clamp(pl.l, -track.wallLine[idx], track.wallLine[idx]);
      pointAt(track, idx, pl.l, pl.lift, P);
      pl.heading = track.theta[idx];
      pl.x = P.x; pl.y = P.y; pl.z = P.z; pl.idx = idx;
      for (const k of karts) {
        if (k === pl.owner && pl.age < 1.5) continue;
        if (k.respawnT > 0 || Math.abs(k.y + 0.8 - pl.y) > 1.6) continue;
        const dS = along(track, k.fr.s, s);
        if (Math.abs(dS) < ITEM.planeR && Math.abs(k.fr.l - pl.l) < ITEM.planeR) {
          if (k.immuneT > 0 && !k.stun) continue;
          if (k.stun) continue;
          hit(k, 'plane'); gone(i, pl, true); break;
        }
      }
    }
    // The AI's decisions for next step (the player's kart only while it is on autopilot).
    for (const k of karts) if (k.driver && (!k.isPlayer || k.autopilot) && !k.finished) aiItems(race, k, dt);
  }

  function gone(i, pl, landed = false) {
    S.planes.splice(i, 1);
    if (pl.owner.plane === pl) pl.owner.plane = null;
    if (!landed) emit('planeGone', pl.owner);
  }

  // DESIGN.md §4 "How the AI uses them", plus the dodge.
  function aiItems(race, k, dt) {
    const d = k.driver, i = k.fr.idx, ai = track.itemAI;
    // Dodging: a snare or puddle within 25 m ahead and 2 m of the line → roll awareness once for it;
    // on success shift 2.5 m away until past it.
    let want = 0, threat = false;
    for (let n = 0, ny = S.yarns.length, nt = ny + S.honeys.length; n < nt; n++) {
      const h = n < ny ? S.yarns[n] : S.honeys[n - ny];
      if (h.owner === k && h.age < 1) continue;
      if (Math.abs(h.y - k.y) > 1.5) continue;
      const ahead = along(track, k.fr.s, h.s);
      if (ahead < 0 || ahead > 25) continue;
      const dl = k.fr.l - h.l, reach = 2 + (h.r || 0);
      if (Math.abs(dl) > reach) continue;
      if (!d.seen.has(h.id)) { d.seen.add(h.id); h.dodge = h.dodge || new Map(); h.dodge.set(k, d.rnd() < (d.p.awareness ?? 0.8)); }
      if (h.dodge && h.dodge.get(k)) {
        const away = dl >= 0 ? 1 : -1;
        const room = hw[i] - 1.5;
        want = clamp(away * (reach + 0.5) - dl, -room - k.fr.l, room - k.fr.l);
        want = clamp(want, -3.5, 3.5);
      } else if (ahead < 15) threat = true;
    }
    // Seeking: with empty hands and no hazard to dodge, steer for the nearest live parcel 10–45 m ahead.
    if (!want && !k.item) {
      let best = null, bd = 1e9;
      for (const p of parcels) {
        if (p.taken) continue;
        const ahead = along(track, k.fr.s, p.idx * ds);
        if (ahead < 10 || ahead > 45) continue;
        // Leave a parcel to a kart that has claimed it and is nearer to it.
        if (p.claim && p.claim !== k && race.time - p.claimAt < 0.1 && along(track, p.claim.fr.s, p.idx * ds) < ahead) continue;
        const dl = Math.abs(p.l - k.fr.l);
        if (dl < bd) { bd = dl; best = p; }
      }
      if (best) { want = clamp(best.l - k.fr.l + d.dodgeShift, -3, 3); best.claim = k; best.claimAt = race.time; }
    }
    d.dodgeShift += (want - d.dodgeShift) * (1 - Math.exp(-5 * dt));
    if (d.seen.size > 64) d.seen.clear();

    if (!k.item || k.itemRoll > 0 || k.stun || k.respawnT > 0) return;
    d.heldT += dt;
    const held = d.heldT, ready = held >= d.holdT;
    const place = k.place;
    let use = false;
    switch (k.item) {
      case 'quilt':
        use = threat || held > 12;            // a plane aimed at it raises it at launch (onUse)
        break;
      case 'kettle':
        use = ready && (ai.straight[i] || held > 15);
        break;
      case 'yarn': {
        if (!ready) break;
        let behindKart = false;
        for (const o of race.karts) {
          if (o === k || Math.abs(o.y - k.y) >= 1.5) continue;
          const b = along(track, o.fr.s, k.fr.s);
          if (b > 3 && b < 15 && Math.abs(o.fr.l - k.fr.l) < 2) { behindKart = true; break; }
        }
        use = behindKart || (held > 8 && Math.abs(track.kappa[i]) > 1 / 60) || held > 12;
        break;
      }
      case 'plane': {
        if (!ready) break;
        const ahead = race.order && race.order.find((o) => o.place === place - 1);
        use = (ahead && ahead.dist - k.dist < 90 && ahead.dist > k.dist) || held > 8;
        break;
      }
      case 'honey': {
        if (!ready) break;
        let chaser = false;
        for (const o of race.karts) {
          if (o === k || Math.abs(o.y - k.y) >= 1.5) continue;
          const b = along(track, o.fr.s, k.fr.s);
          if (b > 2 && b < 30) { chaser = true; break; }
        }
        use = (Math.abs(track.kappa[i]) > 1 / 45 && chaser) || held > 8;
        break;
      }
    }
    if (use) d.useItem = true;
  }

  return S;
}
