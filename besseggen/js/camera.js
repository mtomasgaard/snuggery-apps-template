// Camera modes: free orbit, saved viewpoints, first person at eye height anywhere on the route,
// and a fly-through along it.
//
// Orbit uses OrbitControls with damping OFF. Damping needs a frame loop to run out its inertia,
// and this app renders on change; a smooth tween where one is wanted (a jump to a viewpoint) is
// animated deliberately and stops when it is done.

import * as THREE from '../vendor/three.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { clamp, DEG, RAD } from './util.js';

const EYE_MIN = 2.0;        // never let the camera dip into the terrain or behind a skirt

// prefers-reduced-motion. A camera sweeping across a full-screen 3D view is exactly the motion
// this setting exists to stop, so when it is set every camera move is applied instantly and the
// fly-through is stepped rather than flown (app.js). Read live, so flipping the system setting
// takes effect on the next move without a reload.
const RM = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reduceMotion = () => !!(RM && RM.matches);

export class CameraRig {
  constructor(camera, dom, terrain, frame, invalidate) {
    this.camera = camera;
    this.terrain = terrain;
    this.frame = frame;
    this.invalidate = invalidate;
    this.mode = 'orbit';
    this.yaw = 0; this.pitch = 0;
    this.eyeM = 1.7;
    this.routeT = 0;
    this.flySpeed = 90;           // metres per second along the ground
    this.flying = false;
    this.tween = null;

    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = false;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 60;
    this.controls.maxDistance = 70000;
    this.controls.maxPolarAngle = Math.PI * 0.499;
    this.controls.zoomSpeed = 0.9;
    this.controls.rotateSpeed = 0.75;
    this.controls.addEventListener('change', () => { this.clamp(); this.invalidate(); });

    this._look = null;
    dom.addEventListener('pointerdown', (e) => {
      if (this.mode === 'orbit' || this.flying) return;
      dom.setPointerCapture(e.pointerId);
      this._look = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('pointermove', (e) => {
      if (!this._look) return;
      const dx = e.clientX - this._look.x, dy = e.clientY - this._look.y;
      this._look.x = e.clientX; this._look.y = e.clientY;
      this.yaw -= dx * 0.22;
      this.pitch = clamp(this.pitch - dy * 0.22, -85, 85);
      this.applyFirstPerson();
      this.invalidate();
    });
    // onLookEnd lets the app store the camera as soon as a look-around drag settles, rather
    // than trusting an unload event iOS may never fire.
    this.onLookEnd = null;
    const end = () => {
      if (!this._look) return;
      this._look = null;
      if (this.onLookEnd) this.onLookEnd();
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
  }

  groundAt(sx, sz) {
    const wx = this.frame.wx(sx), wy = this.frame.wy(sz);
    return this.terrain.heightAt(wx, wy) * this.terrain.exag;
  }
  clamp() {
    const p = this.camera.position;
    const g = this.groundAt(p.x, p.z) + EYE_MIN;
    if (p.y < g) { p.y = g; this.controls.target.y = Math.max(this.controls.target.y, g - 40); }
  }

  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = (mode === 'orbit');
    if (mode !== 'orbit') this.applyFirstPerson();
    this.invalidate();
  }

  // ---------- orbit ----------
  frameBox(box, pitchDeg = 38, headingDeg = 200) {
    const size = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    const dist = size * 0.9;
    const tgt = new THREE.Vector3(
      (box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2,
    );
    this.goTo(tgt, dist, headingDeg, pitchDeg, false);
  }
  goTo(target, dist, headingDeg, pitchDeg, animate = true) {
    const a = headingDeg * DEG, p = clamp(pitchDeg, 2, 88) * DEG;
    const pos = new THREE.Vector3(
      target.x + dist * Math.cos(p) * Math.sin(a),
      target.y + dist * Math.sin(p),
      target.z + dist * Math.cos(p) * Math.cos(a),
    );
    this.setOrbit(pos, target, animate);
  }
  setOrbit(pos, target, animate = true) {
    this.mode = 'orbit';
    this.controls.enabled = true;
    if (!animate || reduceMotion()) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.clamp();
      this.controls.update();
      this.invalidate();
      return;
    }
    this.tween = {
      t0: performance.now(), dur: 850,
      p0: this.camera.position.clone(), p1: pos.clone(),
      t0v: this.controls.target.clone(), t1v: target.clone(),
      fov0: this.camera.fov, fov1: this.camera.fov,
    };
    this.invalidate();
  }

  // One step of the zoom keys in focus mode, where there is no pinch to reach for. A factor
  // below 1 comes closer. Orbiting, that is a dolly along the view ray between the same limits
  // the pinch obeys; standing on the ground there is nothing to dolly towards without walking
  // into the hillside, so it becomes a lens — the same thing binoculars do.
  zoomBy(factor) {
    if (this.mode === 'orbit') {
      const v = this.camera.position.clone().sub(this.controls.target);
      const d = clamp(v.length() * factor, this.controls.minDistance, this.controls.maxDistance);
      this.camera.position.copy(this.controls.target).add(v.setLength(d));
      this.clamp();
      this.controls.update();
    } else {
      this.camera.fov = clamp(this.camera.fov * factor, 18, 75);
      this.camera.updateProjectionMatrix();
      this.applyFirstPerson();
    }
    this.invalidate();
  }

  // ---------- viewpoints and first person ----------
  applyViewpoint(vp) {
    const sx = this.frame.sx(vp.x), sz = this.frame.sz(vp.y);
    const ground = this.groundAt(sx, sz);
    const y = vp.aboveGround === false
      ? vp.eyeM * this.terrain.exag
      : ground + Math.max(vp.eyeM ?? 1.7, EYE_MIN) * this.terrain.exag;
    this.mode = 'fp';
    this.controls.enabled = false;
    this.camera.position.set(sx, y, sz);
    this.camera.fov = vp.fovDeg || 55;
    // headingDeg in the file is a TRUE bearing; the scene is on the UTM grid.
    this.yaw = (vp.headingDeg ?? 0) - this.frame.convergence;
    this.pitch = vp.pitchDeg ?? 0;
    this.applyFirstPerson();
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }
  applyFirstPerson() {
    const y = this.yaw * DEG, p = this.pitch * DEG;
    // Grid bearing 0 looks north, which is -Z in the scene.
    const dir = new THREE.Vector3(
      Math.cos(p) * Math.sin(y), Math.sin(p), -Math.cos(p) * Math.cos(y),
    );
    const t = this.camera.position.clone().add(dir.multiplyScalar(500));
    this.camera.lookAt(t);
    this.controls.target.copy(t);
  }
  headingTrue() { return (((this.yaw + this.frame.convergence) % 360) + 360) % 360; }

  // Put the eye on the route at a fraction of its length, looking the way you are walking.
  placeOnRoute(route, t, reversed, eyeM = this.eyeM, keepLook = false) {
    if (!route || !route.n) return;
    this.routeT = clamp(t, 0, 1);
    const dist = this.routeT * route.length;
    const i = route.indexAtDist(dist, reversed);
    const j = clamp(reversed ? i - 1 : i + 1, 0, route.n - 1);
    const sx = this.frame.sx(route.x[i]), sz = this.frame.sz(route.y[i]);
    const ground = this.groundAt(sx, sz);
    this.mode = this.mode === 'orbit' ? 'fp' : this.mode;
    this.controls.enabled = false;
    this.camera.position.set(sx, Math.max(ground, route.z[i] * this.terrain.exag) + eyeM * this.terrain.exag, sz);
    if (!keepLook && i !== j) {
      const dx = route.x[j] - route.x[i], dy = route.y[j] - route.y[i];
      this.yaw = Math.atan2(dx, dy) * RAD;
      const dz = route.z[j] - route.z[i], run = Math.hypot(dx, dy);
      this.pitch = clamp(Math.atan2(dz, Math.max(run, 1)) * RAD * 0.6, -25, 25);
    }
    this.applyFirstPerson();
    this.invalidate();
    return i;
  }

  // ---------- animation ----------
  update(dtMs, route, reversed) {
    let busy = false;
    if (this.tween) {
      const k = clamp((performance.now() - this.tween.t0) / this.tween.dur, 0, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.camera.position.lerpVectors(this.tween.p0, this.tween.p1, e);
      this.controls.target.lerpVectors(this.tween.t0v, this.tween.t1v, e);
      this.clamp();
      this.controls.update();
      if (k >= 1) this.tween = null;
      busy = true;
    }
    if (this.flying && route && route.length > 0) {
      // Clamped so a stalled frame cannot teleport the camera down the ridge; on a slow
      // renderer that makes the fly-through run slower than wall-clock, which is the right way
      // round.
      const dt = Math.min(dtMs, 200) / 1000;
      this.routeT += (this.flySpeed * dt) / route.length;
      if (this.routeT >= 1) { this.routeT = 1; this.flying = false; }
      if (this.onFlyEnd && !this.flying) this.onFlyEnd();
      this.placeOnRoute(route, this.routeT, reversed, this.eyeM, false);
      busy = busy || this.flying;
    }
    return busy;
  }

  serialise() {
    return {
      mode: this.mode,
      pos: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      fov: this.camera.fov, yaw: this.yaw, pitch: this.pitch,
      routeT: this.routeT, eyeM: this.eyeM,
    };
  }
  restore(s) {
    if (!s || !Array.isArray(s.pos) || !Array.isArray(s.target)) return false;
    // A camera sitting on its own target is not a view; treat it as no saved camera at all.
    const d = Math.hypot(s.pos[0] - s.target[0], s.pos[1] - s.target[1], s.pos[2] - s.target[2]);
    if (!Number.isFinite(d) || d < 1) return false;
    this.camera.position.fromArray(s.pos);
    this.controls.target.fromArray(s.target || [0, 0, 0]);
    this.camera.fov = s.fov || 55;
    this.yaw = s.yaw || 0; this.pitch = s.pitch || 0;
    this.routeT = s.routeT || 0; this.eyeM = s.eyeM || 1.7;
    this.camera.updateProjectionMatrix();
    this.setMode(s.mode === 'fly' ? 'fp' : (s.mode || 'orbit'));
    if (this.mode === 'orbit') { this.clamp(); this.controls.update(); }
    return true;
  }
}
