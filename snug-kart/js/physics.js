// Kart dynamics, walls and kart-to-kart bumps (DESIGN.md §8). Pure: no three, no DOM.
// Every kart, player and AI alike, goes through stepKart with the same kind of input:
//   { steer: −1..1 (+ = right), drift: bool, brake: 0..1 }
// Units are meters, seconds, radians. Plan heading ψ uses the track's convention: forward is
// (cos ψ, sin ψ) in (x, z), and ψ increasing is a right turn (because +z is south).

import { project, pointAt } from './track.js';

export const PHYS = {
  vTop: 30, accel: 22, overDecel: 12, overDecelVerge: 16, brake: 26, vReverse: -7,
  steerRate: 6, yawK: 2.3, gripNormal: 9, gripDrift: 2.5,
  vergeK: 0.55, vergeBoostK: 0.9, honeyK: 0.5, boostAdd: 8, boostAccel: 30,
  driftMinV: 12, driftCancelV: 8, driftEnter: 0.25, driftArm: 0.4, tier1: 0.8, tier2: 1.7,
  boostTier1: 0.55, boostTier2: 1.0, driftTop: 0.97,
  // Drift yaw = dir·yawK·g(v)·(driftBase + driftAmp·σ·dir): 1.40× steering in, 0.20× steering out.
  // (First designed as 0.95 + 0.45σ, i.e. 0.50× out: the widest drift at 28 m/s was a 36 m circle,
  // so no bend on Lantern Night — 61–110 m — could be drifted. Tuned by tools/sim.mjs.)
  driftBase: 0.80, driftAmp: 0.60,
  spinCap: 8, spinDecel: 40, spinTime: 1.0, tumbleTime: 1.3, immuneTime: 1.0,
  radius: 1.0, restitution: 0.4, bumpKeep: 0.85,
  stuckV: 2, stuckTime: 2.5, wrongDot: -0.3, wrongBanner: 1.5, wrongRespawn: 4, respawnFade: 0.3,
};

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** g(v): how much of the steering authority is available at speed v (DESIGN.md §8). */
export const steerGain = (v) => {
  const a = Math.abs(v);
  return Math.min(1, a / 7) * (1 - 0.4 * clamp((a - 7) / 23, 0, 1));
};

export function createKart(index) {
  return {
    index, x: 0, y: 0, z: 0, psi: 0, v: 0, u: 0, steer: 0, vTop: PHYS.vTop,
    // track frame (from project): idx, f, s, l, y, grade
    fr: { idx: 0, f: 0, s: 0, l: 0, y: 0, grade: 0 },
    offroad: false,
    drift: false, driftDir: 0, driftCharge: 0, driftArmT: 0, driftHeld: false, driftTier: 0,
    boostT: 0, boostKind: null,
    stun: null, stunT: 0, immuneT: 0,
    shieldT: 0,          // the Quilt (js/items.js): > 0 while shielded
    honeyT: 0,           // Honey: > 0 while slowed
    wallDampT: 0, wallHitT: 0,
    stuckT: 0, wrongT: 0, wrongWay: false, respawnT: 0, respawns: 0,
    frozen: true,        // true before Go (and for an AI until its reaction time)
    landT: 0,
  };
}

/** Put a kart on the track at sample idx, lateral l, facing along the track, at speed v. */
export function placeKart(k, track, idx, l, v = 0) {
  const p = pointAt(track, idx, l);
  k.x = p.x; k.z = p.z;
  k.psi = track.theta[idx];
  k.v = v; k.u = 0; k.steer = 0;
  project(track, k.x, k.z, idx, k.fr, 2);
  k.y = k.fr.y;
}

function endDrift(k, emit, award) {
  if (!k.drift) return;
  if (award && k.driftCharge >= PHYS.tier1) {
    const tier = k.driftCharge >= PHYS.tier2 ? 2 : 1;
    applyBoost(k, tier === 2 ? PHYS.boostTier2 : PHYS.boostTier1, 'drift');
    emit && emit('miniBoost', k, { tier });
  }
  k.drift = false; k.driftDir = 0; k.driftCharge = 0; k.driftTier = 0;
}

/** Boost timers do not add: the longer one wins. */
export function applyBoost(k, seconds, kind = 'item') {
  if (seconds > k.boostT) { k.boostT = seconds; k.boostKind = kind; }
}

/** Spin-out (kind 'spin') or tumble ('tumble'). Returns false if immune or already stunned (js/items.js checks the Quilt first). */
export function stunKart(k, kind, emit) {
  if (k.immuneT > 0 || k.stun) return false;
  endDrift(k, emit, false);
  k.stun = kind;
  k.stunT = kind === 'spin' ? PHYS.spinTime : PHYS.tumbleTime;
  if (kind === 'tumble') k.v *= 0.2;
  emit && emit('stun', k, { kind });
  return true;
}

export function stepKart(k, inp, track, dt, emit) {
  if (k.respawnT > 0) {
    k.respawnT -= dt;
    if (k.respawnT <= 0) { k.respawnT = 0; placeKart(k, track, track.wrap(k.fr.idx - Math.round(10 / track.ds)), 0, 10); }
    return;
  }
  // Timers
  k.boostT = Math.max(0, k.boostT - dt); if (k.boostT === 0) k.boostKind = null;
  k.immuneT = Math.max(0, k.immuneT - dt);
  k.shieldT = Math.max(0, k.shieldT - dt);
  k.honeyT = Math.max(0, k.honeyT - dt);
  k.wallDampT = Math.max(0, k.wallDampT - dt);
  k.wallHitT = Math.max(0, k.wallHitT - dt);
  k.landT = Math.max(0, k.landT - dt);
  if (k.stun) {
    k.stunT -= dt;
    if (k.stunT <= 0) { k.stun = null; k.stunT = 0; k.immuneT = PHYS.immuneTime; }
  }
  if (k.frozen) { k.steer += clamp((inp.steer || 0) - k.steer, -PHYS.steerRate * dt, PHYS.steerRate * dt); return; }

  // Steering input, rate-limited.
  let want = k.stun ? 0 : clamp(inp.steer || 0, -1, 1);
  if (k.wallDampT > 0) want *= 0.5;
  k.steer += clamp(want - k.steer, -PHYS.steerRate * dt, PHYS.steerRate * dt);

  // Drift (§8.1)
  const pressed = !!inp.drift && !k.stun;
  if (pressed && !k.driftHeld) k.driftArmT = PHYS.driftArm;
  k.driftHeld = pressed;
  if (!k.drift && pressed && k.driftArmT > 0 && k.v >= PHYS.driftMinV && Math.abs(k.steer) >= PHYS.driftEnter) {
    k.drift = true; k.driftDir = Math.sign(k.steer); k.driftCharge = 0; k.driftTier = 0; k.driftArmT = 0;
    emit && emit('driftStart', k);
  }
  k.driftArmT = Math.max(0, k.driftArmT - dt);
  if (k.drift) {
    if (!pressed) endDrift(k, emit, true);
    else if (k.v < PHYS.driftCancelV) endDrift(k, emit, false);
    else {
      // Full rate while the wheel is into the drift (σ·dir ≥ −0.2), half rate while steering out —
      // DESIGN.md §8.1 charged nothing when steering out, which made gentle sweepers undriftable.
      k.driftCharge += k.steer * k.driftDir >= -0.2 ? dt : 0.5 * dt;
      const tier = k.driftCharge >= PHYS.tier2 ? 2 : k.driftCharge >= PHYS.tier1 ? 1 : 0;
      if (tier !== k.driftTier) { k.driftTier = tier; emit && emit('driftTier', k, { tier }); }
    }
  }

  // Longitudinal speed
  const fr = k.fr;
  k.offroad = Math.abs(fr.l) > track.hw[fr.idx] + 0.3;
  const boosting = k.boostT > 0;
  let top = boosting ? k.vTop + PHYS.boostAdd : k.vTop;
  if (k.drift) top *= PHYS.driftTop;
  if (k.offroad) top *= boosting ? PHYS.vergeBoostK : PHYS.vergeK;
  if (k.honeyT > 0) top *= PHYS.honeyK;
  if (k.stun === 'spin') top = Math.min(top, PHYS.spinCap);
  const brake = k.stun ? 0 : clamp(inp.brake || 0, 0, 1);
  if (brake > 0) {
    if (k.v > 0.2) k.v = Math.max(0, k.v - PHYS.brake * brake * dt);
    else k.v = Math.max(PHYS.vReverse, k.v - PHYS.brake * 0.4 * brake * dt);
  } else if (k.v < top) {
    let a = PHYS.accel * (1 - k.v / top);
    if (boosting) a += PHYS.boostAccel;
    k.v = Math.min(top, k.v + a * dt);
  } else {
    // A spin-out sheds speed hard (40 m/s²) so its 8 m/s cap is reached in about 0.4 s; the normal
    // 12 m/s² over-speed easing would still be above the cap when the 1 s spin ends.
    const decel = k.stun === 'spin' ? PHYS.spinDecel : k.offroad ? PHYS.overDecelVerge : PHYS.overDecel;
    k.v = Math.max(top, k.v - decel * dt);
  }
  // Slope: the grade along the heading, halved for fun.
  const cosH = Math.cos(k.psi) * track.fx[fr.idx] + Math.sin(k.psi) * track.fz[fr.idx];
  k.v -= 9.8 * fr.grade * cosH * 0.5 * dt;

  // Yaw
  const g = steerGain(k.v);
  let omega;
  if (k.stun) omega = 0;
  else if (k.drift) omega = k.driftDir * PHYS.yawK * g * (PHYS.driftBase + PHYS.driftAmp * k.steer * k.driftDir);
  else omega = k.steer * PHYS.yawK * g * Math.sign(k.v);
  k.psi = wrapAngle(k.psi + omega * dt);
  k.u *= Math.exp(-(k.drift ? PHYS.gripDrift : PHYS.gripNormal) * dt);

  // Integrate the plan position: velocity = v·forward + u·right, right = (−sin ψ, cos ψ).
  const c = Math.cos(k.psi), s = Math.sin(k.psi);
  k.x += (k.v * c - k.u * s) * dt;
  k.z += (k.v * s + k.u * c) * dt;
  project(track, k.x, k.z, fr.idx, fr);

  // Walls (§8.2)
  const W = track.wallLine[fr.idx];
  if (Math.abs(fr.l) > W) {
    const side = Math.sign(fr.l), i = fr.idx, fx = track.fx[i], fz = track.fz[i];
    const push = fr.l - side * W;
    k.x -= -fz * push; k.z -= fx * push;
    const nxw = -fz * side, nzw = fx * side;          // outward wall normal
    let vx = k.v * c - k.u * s, vz = k.v * s + k.u * c;
    const vn = vx * nxw + vz * nzw;
    if (vn > 0) {
      const speed = Math.hypot(vx, vz) || 1, sinPhi = Math.min(1, vn / speed);
      let vt = vx * fx + vz * fz;
      vt *= 1 - 0.5 * sinPhi;
      const vn2 = -0.3 * vn;
      vx = fx * vt + nxw * vn2; vz = fz * vt + nzw * vn2;
      if (sinPhi > Math.sin(50 * Math.PI / 180)) {
        vx *= 0.35; vz *= 0.35;
        const tang = Math.atan2(fz, fx) + (vt < 0 ? Math.PI : 0);
        k.psi = wrapAngle(k.psi + 0.5 * wrapAngle(tang - k.psi));
      }
      const c2 = Math.cos(k.psi), s2 = Math.sin(k.psi);
      k.v = vx * c2 + vz * s2; k.u = -vx * s2 + vz * c2;
      if (vn > 6) endDrift(k, emit, false);
      if (vn > 3 && k.wallHitT === 0) { k.wallHitT = 0.2; emit && emit('wall', k, { speed: vn }); }
      k.wallDampT = 0.15;
    }
    project(track, k.x, k.z, fr.idx, fr, 3);
  }
  const prevY = k.y;
  k.y = fr.y;
  if (prevY - k.y > 0.25 && k.landT === 0) k.landT = 0.1;
  if (k.stun) endDrift(k, emit, false);
}

/** Kart-to-kart bumps (§8.3): circles of radius 1 m, restitution 0.4, never stopping a kart. */
export function resolveBumps(karts, emit) {
  const R2 = (2 * PHYS.radius) ** 2;
  for (let a = 0; a < karts.length; a++) {
    const A = karts[a]; if (A.respawnT > 0) continue;
    for (let b = a + 1; b < karts.length; b++) {
      const B = karts[b]; if (B.respawnT > 0) continue;
      if (Math.abs(A.y - B.y) >= 1.5) continue;
      let dx = B.x - A.x, dz = B.z - A.z; const d2 = dx * dx + dz * dz;
      if (d2 >= R2 || d2 < 1e-8) continue;
      const d = Math.sqrt(d2); dx /= d; dz /= d;
      const overlap = 2 * PHYS.radius - d;
      A.x -= dx * overlap / 2; A.z -= dz * overlap / 2;
      B.x += dx * overlap / 2; B.z += dz * overlap / 2;
      const ca = Math.cos(A.psi), sa = Math.sin(A.psi), cb = Math.cos(B.psi), sb = Math.sin(B.psi);
      let avx = A.v * ca - A.u * sa, avz = A.v * sa + A.u * ca;
      let bvx = B.v * cb - B.u * sb, bvz = B.v * sb + B.u * cb;
      const rel = (bvx - avx) * dx + (bvz - avz) * dz;
      if (rel >= 0) continue;                           // already separating
      const ma = A.shieldT > 0 ? 3 : 1, mb = B.shieldT > 0 ? 3 : 1;
      const J = -(1 + PHYS.restitution) * rel / (1 / ma + 1 / mb);
      avx -= J / ma * dx; avz -= J / ma * dz; bvx += J / mb * dx; bvz += J / mb * dz;
      const va0 = A.v, vb0 = B.v;
      A.v = avx * ca + avz * sa; A.u = -avx * sa + avz * ca;
      B.v = bvx * cb + bvz * sb; B.u = -bvx * sb + bvz * cb;
      if (va0 > 0) A.v = Math.max(A.v, PHYS.bumpKeep * va0);
      if (vb0 > 0) B.v = Math.max(B.v, PHYS.bumpKeep * vb0);
      if (-rel > 1) emit && emit('bump', A, { other: B, speed: -rel });
    }
  }
}

/** Is the kart's heading against the track? (dot with the track's forward) */
export function headingDot(k, track) {
  const i = k.fr.idx;
  return Math.cos(k.psi) * track.fx[i] + Math.sin(k.psi) * track.fz[i];
}
