// The AI driver (DESIGN.md §9). Pure: no three, no DOM. It produces exactly what a human produces —
// steer, drift, brake, useItem — and the kart then goes through the same physics as everyone else.

import { PHYS, steerGain } from './physics.js';
import { pointAt } from './track.js';
import { mulberry32 } from './rng.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const AI_BRAKE = 18;
const DRIFT_K = 1 / 90, DRIFT_LEN = 25, DRIFT_RELEASE_K = 1 / 130;

/** The pace setting on the title screen (§9). */
export const PACE = { relaxed: 0.90, standard: 0.95, fierce: 0.99 };

/** Per-track tables the AI reads every step, computed once per track. */
export function prepareAI(track) {
  if (track.ai) return track.ai;
  const { N, ds, kappa } = track;
  // vLim(κ): the largest v with 0.9 · 2.3 · g(v) ≥ v·|κ|, from a lookup over v in 0.5 m/s steps.
  const vs = []; for (let v = 0.5; v <= 45; v += 0.5) vs.push(v);
  const vLimOf = (k) => { let best = vs[0]; for (const v of vs) if (0.9 * PHYS.yawK * steerGain(v) >= v * Math.abs(k)) best = v; return best; };
  const vLim = new Float32Array(N);
  for (let i = 0; i < N; i++) vLim[i] = vLimOf(kappa[i]);
  // The speed the AI may carry here and still brake (at 18 m/s²) for everything in the next 60 m.
  const vAhead = new Float32Array(N), look = Math.round(60 / ds);
  for (let i = 0; i < N; i++) {
    let m = Infinity;
    for (let d = 0; d <= look; d++) { const j = (i + d) % N; m = Math.min(m, Math.sqrt(vLim[j] ** 2 + 2 * AI_BRAKE * d * ds)); }
    vAhead[i] = m;
  }
  // Mean curvature over [s + 10, s + 40]: the pull toward the inside of the coming bend.
  const kbar = new Float32Array(N), a = Math.round(10 / ds), b = Math.round(40 / ds);
  for (let i = 0; i < N; i++) { let sum = 0; for (let d = a; d <= b; d++) sum += kappa[(i + d) % N]; kbar[i] = sum / (b - a + 1); }
  // Length of the drift-worthy bend (|κ| > DRIFT_K) starting at each sample, for drift decisions.
  // (DESIGN.md §9 said 1/35 for 25 m; no bend on Lantern Night is tighter than 1/61, so the AI never
  // drifted there. Tuned with the wider drift of physics.js: 1/90 for 25 m, released below 1/130.)
  const bendLen = new Float32Array(N);
  for (let i = N * 2 - 1; i >= 0; i--) { const j = i % N; bendLen[j] = Math.abs(kappa[j]) > DRIFT_K ? (bendLen[(j + 1) % N] || 0) + ds : 0; }
  return (track.ai = { vLim, vAhead, kbar, bendLen });
}

/** One AI driver's private state. `p` is the racer's `ai` row from racers.json. */
export function createDriver(p, seed) {
  const rnd = mulberry32(seed);
  return {
    p, rnd,
    mistakeIn: 20 + 20 * rnd(), mistakeT: 0, mistakeLane: 0,
    passShift: 0, dodgeShift: 0,
    drifting: false, driftT: 0, lastBend: -1,
    useItem: false,   // set by js/items.js from §4's rules; pressed on the next step
  };
}

const tmp = {};
/**
 * Decide this step's input. `ctx` = { track, karts, dt }. Returns { steer, drift, brake, useItem }.
 */
export function drive(k, drv, ctx, out = {}) {
  const { track, karts, dt } = ctx;
  const ai = track.ai, { N, ds, hw } = track;
  const p = drv.p, i = k.fr.idx, v = Math.max(0, k.v);

  // Mistakes: every 20–40 s, with probability 0.25·(1.03 − skill)/0.06, run wide for 0.6 s.
  drv.mistakeIn -= dt;
  if (drv.mistakeIn <= 0) {
    drv.mistakeIn = 20 + 20 * drv.rnd();
    if (drv.rnd() < 0.25 * (1.03 - p.skill) / 0.06) { drv.mistakeT = 0.6; drv.mistakeLane = -Math.sign(ai.kbar[i] || 1) * 0.4; }
  }
  if (drv.mistakeT > 0) drv.mistakeT -= dt; else drv.mistakeLane = 0;

  // Passing: a kart 0–6 m ahead within 1.5 m laterally → shift 1.6 m to the side with more room.
  // Side by side (within 3 m along, 2.4 m across): ease apart so neighboring lanes do not grind.
  let pass = 0, side = 0;
  for (const o of karts) {
    if (o === k || o.respawnT > 0 || Math.abs(o.y - k.y) > 1.5) continue;
    let ds2 = o.fr.s - k.fr.s; if (ds2 < -track.L / 2) ds2 += track.L; if (ds2 > track.L / 2) ds2 -= track.L;
    const dl = k.fr.l - o.fr.l;
    if (!pass && ds2 > 0 && ds2 < 6 && Math.abs(dl) < 1.5) {
      const half = hw[i] - 1.5, roomRight = half - o.fr.l, roomLeft = o.fr.l + half;
      pass = roomRight > roomLeft ? 1.6 : -1.6;
    }
    if (Math.abs(ds2) < 3 && Math.abs(dl) < 2.4) side += (dl >= 0 ? 1 : -1) * (2.4 - Math.abs(dl));
  }
  drv.passShift += (pass - drv.passShift) * (1 - Math.exp(-4 * dt));
  drv.sideShift = (drv.sideShift || 0) + (clamp(side, -2, 2) - (drv.sideShift || 0)) * (1 - Math.exp(-6 * dt));

  // Target point: the centerline sample La ahead, at the personality's lane plus the bend pull.
  const La = 6 + 0.55 * v, j = (i + Math.round(La / ds)) % N;
  const usable = Math.max(0.5, hw[j] - 2);
  let lat = (p.lane + drv.mistakeLane) * usable + clamp(ai.kbar[i] * 25, -0.55, 0.55) * usable + drv.passShift + drv.sideShift + drv.dodgeShift;
  lat = clamp(lat, -(hw[j] - 1), hw[j] - 1);
  pointAt(track, j, lat, 0, tmp);
  const alpha = wrapAngle(Math.atan2(tmp.z - k.z, tmp.x - k.x) - k.psi);
  out.steer = clamp(2.4 * alpha, -1, 1);
  if (k.drift) {
    // While drifting the yaw rate no longer follows σ directly (physics.js: base + amp·σ·dir), so
    // aim by pure pursuit instead: the yaw rate that reaches the target point, turned back into the σ
    // that gives it. (2.4·α alone whips the kart inside at a drift's entry.)
    const Ld = Math.max(4, Math.hypot(tmp.x - k.x, tmp.z - k.z));
    const omega = v * 2 * Math.sin(alpha) / Ld;
    const need = (omega * k.driftDir) / Math.max(0.05, PHYS.yawK * steerGain(v));
    out.steer = k.driftDir * clamp((need - PHYS.driftBase) / PHYS.driftAmp, -1, 1);
  }

  // Speed: brake if above what the next 60 m allows.
  const target = Math.min(ai.vAhead[i], k.vTop);
  out.brake = k.v > target + 0.3 ? AI_BRAKE / PHYS.brake : 0;

  // Drifting: at the entry of a bend with |κ| > DRIFT_K for ≥ DRIFT_LEN m, at v > 16, with probability `drift`.
  const ahead = (i + Math.round(6 / ds)) % N;
  if (!drv.drifting && ai.bendLen[ahead] >= DRIFT_LEN && v > 16) {
    // Identify the bend by its first sample so each bend is rolled once.
    let start = ahead; for (let n = 0; n < 60 && ai.bendLen[(start - 1 + N) % N] > 0; n++) start = (start - 1 + N) % N;
    if (start !== drv.lastBend) { drv.lastBend = start; if (drv.rnd() < p.drift) { drv.drifting = true; drv.driftT = 0; } }
  }
  if (drv.drifting) {
    drv.driftT += dt;
    const done = drv.driftT > 0.3 && Math.abs(track.kappa[i]) < DRIFT_RELEASE_K;
    const failed = !k.drift && drv.driftT > 0.6;      // never started (wheel stayed near center)
    // Steering fully out of a drift is how a wide bend is held; let go only when the drift is
    // carrying the kart more than 4 m inside its line, or once a tier is banked and the wheel is
    // still hard over (take the boost rather than run inside).
    const inside = (k.fr.l - lat) * k.driftDir;
    const hardOut = k.drift && out.steer * k.driftDir < -0.9;
    const give = k.drift && (inside > 4 || (hardOut && k.driftCharge >= PHYS.tier1));
    if (done || failed || k.stun || give) drv.drifting = false;
  }
  out.drift = drv.drifting;
  out.useItem = drv.useItem; drv.useItem = false;
  return out;
}

/** Rubber-banded top speed (§9). `gap` = this AI's race distance − the player's (m); null after the player finishes. */
export function aiTopSpeed(p, pace, gap, finalLap) {
  const band = gap === null ? 1 : 1 + clamp(-gap / 150, -1, 1) * (gap < 0 ? 0.08 : 0.06);
  const skill = p.skill + (finalLap && p.finalLapSkill ? p.finalLapSkill : 0);
  return Math.min(31.5, PHYS.vTop * pace * skill * band);
}
