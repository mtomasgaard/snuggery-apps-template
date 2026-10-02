// The camera (DESIGN.md §10): a smoothed chase rig, the countdown swoop, the title screen's glide
// along the track, and the side-on finish view. Under Reduce Motion (`still`) the title holds one
// view, the countdown starts behind the kart, the finish keeps the chase and nothing shakes.

import { Vector3 } from '../vendor/three.module.js';
import { pointAt, project } from './track.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export class ChaseCamera {
  constructor(camera) {
    this.cam = camera;
    this.pos = new Vector3(); this.look = new Vector3(); this.lookS = new Vector3();
    this.yaw = 0; this.fov = 80; this.mode = 'title'; this.glideS = 0; this.t = 0;
    this.fr = { idx: 0 }; this.P = {};
    this.shake = 0; this.still = false;
    this.tune = { back: 4.8, up: 2.7, ahead: 6, lookUp: 1.0 };
  }

  /** FOV targets: vertical, portrait 80 → 90 → 96; landscape 58 → 66 → 70. */
  fovFor(v, boosting) {
    const land = this.cam.aspect > 1;
    const [rest, top, boost] = land ? [58, 66, 70] : [80, 90, 96];
    return boosting ? boost : rest + (top - rest) * clamp(v / 30, 0, 1);
  }

  /** Snap the rig behind a kart (start of countdown: 12 m back, 7 m up). */
  snapTo(k, track, back = 12, up = 7) {
    this.yaw = k.psi;
    const dx = Math.cos(k.psi), dz = Math.sin(k.psi);
    this.pos.set(k.x - dx * back, k.y + up, k.z - dz * back);
    this.look.set(k.x + dx * this.tune.ahead, k.y + this.tune.lookUp, k.z + dz * this.tune.ahead);
    this.lookS.copy(this.look);
    this.fov = this.fovFor(0, false);
    this.fr.idx = k.fr.idx;
    this.apply();
  }

  /** Chase the kart. `ease` 0..1 blends from the countdown's start pose into the rig. */
  chase(k, track, dt, ease = 1) {
    const T = this.tune;
    // Direction: blend of velocity and heading (70 % velocity while drifting, 30 % otherwise).
    const c = Math.cos(k.psi), s = Math.sin(k.psi);
    let vx = k.v * c - k.u * s, vz = k.v * s + k.u * c;
    const sp = Math.hypot(vx, vz);
    if (sp < 1 || k.v < 0) { vx = c; vz = s; } else { vx /= sp; vz /= sp; }
    const b = k.drift ? 0.7 : 0.3;
    const dirYaw = Math.atan2(b * vz + (1 - b) * s, b * vx + (1 - b) * c);
    const spin = k.stun ? 0 : 1;                           // hold the yaw steady through a spin-out
    this.yaw += wrapAngle(dirYaw - this.yaw) * (1 - Math.exp(-5 * dt)) * spin;
    const dx = Math.cos(this.yaw), dz = Math.sin(this.yaw);
    const back = T.back + (12 - T.back) * (1 - ease), up = T.up + (7 - T.up) * (1 - ease);
    const tx = k.x - dx * back, tz = k.z - dz * back, ty = k.y + up;
    const a = 1 - Math.exp(-8 * dt);
    this.pos.x += (tx - this.pos.x) * a; this.pos.y += (ty - this.pos.y) * a; this.pos.z += (tz - this.pos.z) * a;
    // Never below the road under the camera + 1.2 m.
    project(track, this.pos.x, this.pos.z, k.fr.idx, this.fr, 40);
    if (Math.abs(this.fr.l) < track.hw[this.fr.idx] + track.verge[this.fr.idx] + 2) this.pos.y = Math.max(this.pos.y, this.fr.y + 1.2);
    this.look.set(k.x + Math.cos(k.psi) * T.ahead, k.y + T.lookUp, k.z + Math.sin(k.psi) * T.ahead);
    this.lookS.lerp(this.look, 1 - Math.exp(-14 * dt));
    this.fov += (this.fovFor(Math.abs(k.v), k.boostT > 0) - this.fov) * (1 - Math.exp(-3 * dt));
    this.shake = k.boostT > 0 && !this.still ? 0.03 : 0;
    this.apply();
  }

  /** The title screen: glide along the centerline at 8 m/s, 6 m up, looking ahead; still, 40 m past the line. */
  glide(track, dt) {
    this.glideS = this.still ? 40 : (this.glideS + 8 * dt) % track.L;
    // 6 m up per the design, looking about 10° down at the road 32 m ahead, so the horizon sits near a
    // third of the way down the plate (main.js centers the view in it with setViewOffset) and the
    // track's own scenery fills it rather than the asphalt under the camera.
    const i = Math.floor(this.glideS / track.ds) % track.N, j = (i + Math.round(32 / track.ds)) % track.N;
    pointAt(track, i, 0, 6, this.P); const px = this.P.x, py = this.P.y, pz = this.P.z;
    pointAt(track, j, 0, 0.6, this.P);
    const a = this.still ? 1 : 1 - Math.exp(-3 * dt);
    if (this.mode !== 'title') { this.pos.set(px, py, pz); this.lookS.set(this.P.x, this.P.y, this.P.z); this.mode = 'title'; }
    this.pos.x += (px - this.pos.x) * a; this.pos.y += (py - this.pos.y) * a; this.pos.z += (pz - this.pos.z) * a;
    this.lookS.x += (this.P.x - this.lookS.x) * a; this.lookS.y += (this.P.y - this.lookS.y) * a; this.lookS.z += (this.P.z - this.lookS.z) * a;
    this.fov += (this.fovFor(8, false) - this.fov) * a;
    this.shake = 0;
    this.apply();
  }

  /** After the line: swing to a side-on view of the kart. */
  finish(k, track, dt) {
    const rx = -Math.sin(k.psi), rz = Math.cos(k.psi);
    const tx = k.x + rx * 7 - Math.cos(k.psi) * 3, tz = k.z + rz * 7 - Math.sin(k.psi) * 3, ty = k.y + 2.2;
    const a = 1 - Math.exp(-2.5 * dt);
    this.pos.x += (tx - this.pos.x) * a; this.pos.y += (ty - this.pos.y) * a; this.pos.z += (tz - this.pos.z) * a;
    this.lookS.lerp(this.look.set(k.x, k.y + 0.8, k.z), 1 - Math.exp(-10 * dt));
    this.fov += (this.fovFor(0, false) - 10 - this.fov) * a;
    this.shake = 0;
    this.apply();
  }

  apply() {
    const c = this.cam;
    c.position.copy(this.pos);
    if (this.shake) c.position.set(c.position.x + (Math.random() - 0.5) * this.shake * 2, c.position.y + (Math.random() - 0.5) * this.shake * 2, c.position.z);
    c.lookAt(this.lookS);
    if (Math.abs(c.fov - this.fov) > 0.01) { c.fov = this.fov; c.updateProjectionMatrix(); }
  }
}
