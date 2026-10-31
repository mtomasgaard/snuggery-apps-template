// The camera: one view of Norway that is a map (2D) or a landscape (3D), and the hands that move it.
//
//   2D   straight down, north up. One finger drags the map; a pinch zooms toward the fingers; two
//        fingers dragged together move the map too; a double tap zooms in on the place tapped.
//   3D   Anatomy's and Milky Way's hands, on the ground. One finger turns (sideways) and tilts (up
//        and down) the view around the point on the ground in the middle of the screen; a pinch
//        zooms toward the ground under the fingers; two fingers dragged together carry the land
//        with them, the ground under them staying under them (Google Earth's way); a double tap
//        flies to the place tapped, which becomes the new middle. A flick keeps going and eases
//        out (Milky Way's inertia, 260 ms), never under Reduce Motion.
//   On a computer: the left button is the one finger, the right button (or Shift) moves, the wheel
//   and a trackpad pinch zoom toward the pointer.
//
// It replaced three.js's OrbitControls (2026-10-16). Set up as a map control, OrbitControls felt off
// in four ways: no inertia, so a flick stopped dead (Anatomy runs it with damping); one finger
// panned, and the turn and the tilt lived on two fingers, where a pinch's drift also turned the
// view; its pan moved a plane through a pivot it then snapped to the ground, so the land slid at a
// different speed from the finger and the camera bobbed over every ridge; and its zoom toward the
// pointer lifted the pivot off the ground, which the snap then pulled back with a lurch.
//
// The state is a pivot on the ground (`target`), a distance, a tilt from straight down (`phi`) and
// a turn (`theta`, 0 with the camera south of the pivot looking north); the camera's pose is made
// from them. After a move the pivot is found again where the line of sight meets the ground, so the
// turn is always about the ground in the middle of the view, never about a point in the air, and
// finding it changes nothing on screen. The eye stays 40 m over the highest ground within 80 m of
// it; the tilt stops at 76 degrees close in and 50 at the scale of the country, so the horizon
// stays in the upper part of the view. The frame's origin follows the pivot (js/geo.js).

import * as THREE from '../vendor/three.module.js';
import { clamp, DEG } from './util.js';
import { mercX, mercY, NORWAY } from './geo.js';

const RM = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reduceMotion = () => !!(RM && RM.matches);

export const TILT_3D = 52 * DEG;   // the tilt a switch to 3D lands on
export const MODE_MS = 420;        // the switch between 2D and 3D, on the --draw curve
const MIN_DIST = 120, MAX_DIST = 2600000;
const ROT = 0.0062;                // radians per pixel of one finger (Milky Way's 0.0055, a touch livelier)
const SLOP = 5;                    // pixels before a finger moves the view: a tap stays a tap
const PINCH_PAN_PX = 12;           // Milky Way's: a pinch only zooms until its middle has really moved
const DECAY_MS = 260;              // Milky Way's inertia
const CLEAR = 40, CLEAR_R = 80;    // the eye's clearance over the ground, and how far around it is read
const FLY_MS = 600, ZOOM_MS = 320;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** The steepest tilt at a distance: 76 degrees within 30 km, easing to 50 at 600 km and beyond. */
export function maxTilt(d) {
  const k = clamp((Math.log(Math.max(d, 1)) - Math.log(30000)) / (Math.log(600000) - Math.log(30000)), 0, 1);
  return (76 - 26 * k) * DEG;
}

export class Rig {
  /**
   * camera      the three.js PerspectiveCamera this rig poses
   * dom         the canvas the hands touch
   * frame       the scene frame (js/geo.js)
   * groundAt    (sx, sz) => scene y of the drawn ground, or null
   * pickGround  (clientX, clientY) => { sx, sy, sz } where that pixel's ray meets the ground, or null
   * area, takes the element that hears the hands (the plate), and which touches on it move the view:
   *             the canvas and the floating names, so a drag that starts on a name still turns the
   *             view (a tap on a name is still the name's), never one on a key or the card
   */
  constructor(camera, dom, frame, groundAt, pickGround, invalidate, area = dom, takes = (e) => e.target === dom) {
    this.camera = camera;
    this.dom = dom;
    this.frame = frame;
    this.groundAt = groundAt;
    this.pickGround = pickGround;
    this.invalidate = invalidate;
    this.area = area;
    this.takes = takes;
    this.mode = 'map';
    this.target = new THREE.Vector3();
    this.dist = 10000; this.phi = 0; this.theta = 0;
    this.anim = null;          // a flight, a zoom or the switch between 2D and 3D: (now) => still going
    this.modeAnim = false;
    this.vel = { yaw: 0, pitch: 0, px: 0, pz: 0, zoom: 0 };
    this.zc = new THREE.Vector3();
    this.touching = false;
    this.active = false;       // a move has started (and 'start' was sent) and not yet ended
    this.coasting = false;
    this.grabY = 0;
    this.lastStep = 0;
    this.listeners = {};
    this._rc = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3();
    this.stats = { gestures: 0, anchors: 0, lifts: 0 };
    this._bind();
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  get distance() { return this.dist; }
  get polar() { return this.phi; }
  get azimuth() { return this.theta; }
  /** Heading of the view, degrees clockwise from north: where the camera looks. */
  get heading() { return (((-this.theta / DEG) % 360) + 360) % 360; }

  /** The camera's pose from the state. */
  apply() {
    const t = this.target, s = Math.sin(this.phi);
    this.camera.position.set(t.x + this.dist * s * Math.sin(this.theta), t.y + this.dist * Math.cos(this.phi), t.z + this.dist * s * Math.cos(this.theta));
    // looking along the line to the pivot, the top of the screen toward the far side; straight down,
    // the top is the heading, so north is up in 2D without a degenerate lookAt
    this.camera.rotation.set(this.phi - Math.PI / 2, this.theta, 0, 'YXZ');
    this.camera.updateMatrixWorld();
  }

  /** Place the camera at `dist` from the pivot, at tilt `phi` and turn `theta`. */
  place(dist, phi, theta) {
    this.dist = clamp(dist, MIN_DIST, MAX_DIST);
    this.phi = clamp(phi, 0, 89 * DEG);
    this.theta = theta;
    this.keep();
  }

  /** The frame's origin moved and the scene scaled by k (js/geo.js Frame.rebase): the distance too. */
  rescale(k) { this.dist *= k; this.vel.px *= k; this.vel.pz *= k; this.grabY *= k; this.zc.multiplyScalar(k); this.apply(); }

  /** Every frame: the pivot over Norway and on the ground under it, the eye over the ground. */
  keep() {
    const t = this.target, f = this.frame;
    const X = f.X(t.x), Y = f.Y(t.z);
    const Xc = clamp(X, mercX(NORWAY.lon0), mercX(NORWAY.lon1)), Yc = clamp(Y, mercY(NORWAY.lat0), mercY(NORWAY.lat1));
    if (Xc !== X || Yc !== Y) { t.x = f.sx(Xc); t.z = f.sz(Yc); this.vel.px = this.vel.pz = 0; }
    const g = this.groundAt(t.x, t.z);
    if (g != null && Math.abs(g - t.y) > 0.01) t.y = g;
    this.apply();
    this._lift();
  }

  /** Keep the eye CLEAR over the highest ground within CLEAR_R of it: raised straight up, the
   *  pivot and the turn kept, so it slides up the mountain's face rather than into it. */
  _lift() {
    const p = this.camera.position;
    let floor = -Infinity;
    for (const [dx, dz] of [[0, 0], [CLEAR_R, 0], [-CLEAR_R, 0], [0, CLEAR_R], [0, -CLEAR_R]]) {
      const g = this.groundAt(p.x + dx, p.z + dz);
      if (g != null && g > floor) floor = g;
    }
    if (!(floor > -Infinity)) return;
    floor += CLEAR;
    if (p.y >= floor) return;
    const t = this.target, h = floor - t.y, horiz = this.dist * Math.sin(this.phi);
    this.dist = Math.hypot(horiz, h);
    this.phi = Math.atan2(horiz, h);
    this.stats.lifts++;
    this.apply();
  }

  /** The point in the middle of the screen becomes the pivot: where the line of sight meets the
   *  ground. Nothing on screen changes. */
  _anchor() {
    if (this.mode !== '3d' || this.modeAnim) return;
    const r = this.dom.getBoundingClientRect();
    const hit = this.pickGround(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit) return;
    const p = this.camera.position, d = Math.hypot(hit.sx - p.x, hit.sy - p.y, hit.sz - p.z);
    if (!(d > 1)) return;
    this.target.set(hit.sx, hit.sy, hit.sz);
    this.dist = d;
    this.stats.anchors++;
  }

  /** Where a pixel's ray meets the level plane at scene height y, or null. */
  _plane(cx, cy, y, out) {
    const r = this.dom.getBoundingClientRect();
    this._ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this._rc.setFromCamera(this._ndc, this.camera);
    const o = this._rc.ray.origin, d = this._rc.ray.direction;
    if (d.y > -1e-4) return null;
    const k = (y - o.y) / d.y;
    if (!(k > 0) || k > this.dist * 40) return null;
    return out.copy(d).multiplyScalar(k).add(o);
  }
  /** The ground under a pixel, else the level plane at the pivot's height. */
  _groundAt(cx, cy, out) {
    const h = this.pickGround(cx, cy);
    if (h) return out.set(h.sx, h.sy, h.sz);
    return this._plane(cx, cy, this.target.y, out);
  }
  /** A finger's grip: the height of the ground under it, so that ground follows the finger. */
  _grab(cx, cy) {
    const h = this.mode === '3d' ? this.pickGround(cx, cy) : null;
    this.grabY = h ? h.sy : this.target.y;
  }

  /** Carry the land from under (x0, y0) to under (x1, y1). Returns the move of the pivot. */
  _pan(x0, y0, x1, y1) {
    const a = this._plane(x0, y0, this.grabY, this._a), b = a && this._plane(x1, y1, this.grabY, this._b);
    let dx, dz;
    if (a && b) { dx = a.x - b.x; dz = a.z - b.z; }
    else {
      // near the horizon the grip is lost: move by the scale at the pivot instead
      const s = (2 * this.dist * Math.tan((this.camera.fov * DEG) / 2)) / Math.max(1, this.dom.clientHeight);
      const ux = (x1 - x0) * s, uy = (y1 - y0) * s, c = Math.cos(this.theta), n = Math.sin(this.theta);
      dx = -ux * c - uy * n; dz = ux * n - uy * c;
    }
    const m = Math.hypot(dx, dz), cap = this.dist * 2;
    if (m > cap) { dx *= cap / m; dz *= cap / m; }
    this.target.x += dx; this.target.z += dz;
    this.apply();
    return [dx, dz];
  }

  /** Zoom by f about the scene point P, which stays where it is on screen. */
  _zoomAbout(P, f) {
    const d = clamp(this.dist * f, MIN_DIST, MAX_DIST);
    f = d / this.dist;
    const t = this.target;
    t.set(P.x + (t.x - P.x) * f, P.y + (t.y - P.y) * f, P.z + (t.z - P.z) * f);
    this.dist = d;
    // zooming out eases a steep tilt down to what the new distance allows
    if (this.mode === '3d' && f > 1) this.phi = Math.min(this.phi, maxTilt(d));
    this.apply();
  }

  _rotate(dyaw, dpitch) {
    this.theta += dyaw;
    const mt = maxTilt(this.dist);
    // never past the limit, but a view already past it (a far pivot) may come back up
    this.phi = dpitch > 0 ? Math.min(this.phi + dpitch, Math.max(mt, this.phi)) : Math.max(0, this.phi + dpitch);
    this.apply();
  }

  /** After a move: the pivot found again (not while turning: a turn keeps its pivot), the limits. */
  _after(anchor = true) { if (anchor) this._anchor(); this.keep(); this.emit('change'); this.invalidate(); }
  _begin() { if (!this.active) { this.active = true; this.stats.gestures++; this.emit('start'); } }
  _end() { if (this.active) { this.active = false; this.emit('end'); } }
  stop() {
    this.vel.yaw = this.vel.pitch = this.vel.px = this.vel.pz = this.vel.zoom = 0;
    // a coast cut short ends its move, so the view is never left "moving"
    if (this.coasting) { this.coasting = false; if (!this.touching && !this.anim) this._end(); }
  }

  /** Where the view will be `ms` from now if the hands go on as they move (a drag at its present
   *  speed, a coast as it eases out), posed on `out`, a camera like this one but a little wider:
   *  the terrain asks for that view's tiles ahead of time (js/terrain.js). False when the view is
   *  still, flying, or moving too little to look ahead. */
  predict(ms, out) {
    if (!(this.active || this.coasting) || this.anim) return false;
    const v = this.vel;
    // a coast covers v * DECAY_MS * (1 - e^(-t / DECAY_MS)) of its remaining way; a drag, v * t
    const k = this.coasting && !this.touching ? DECAY_MS * (1 - Math.exp(-ms / DECAY_MS)) : ms;
    let dx = v.px * k, dz = v.pz * k;
    const m = Math.hypot(dx, dz), cap = this.dist * 3;
    if (m > cap) { dx *= cap / m; dz *= cap / m; }
    const turn = Math.abs(v.yaw * k) + Math.abs(v.pitch * k), zoom = Math.abs(v.zoom * k);
    if (turn < 0.02 && Math.min(m, cap) < this.dist * 0.05 && zoom < 0.05) return false;
    const th = this.theta + v.yaw * k, ph = clamp(this.phi + v.pitch * k, 0, Math.max(this.phi, maxTilt(this.dist)));
    const d = clamp(this.dist * Math.exp(clamp(v.zoom * k, -1.5, 1.5)), MIN_DIST, MAX_DIST);
    const t = this.target, s = Math.sin(ph);
    out.copy(this.camera);
    out.fov = this.camera.fov * 1.15;
    out.updateProjectionMatrix();
    out.position.set(t.x + dx + d * s * Math.sin(th), t.y + d * Math.cos(ph), t.z + dz + d * s * Math.cos(th));
    out.rotation.set(ph - Math.PI / 2, th, 0, 'YXZ');
    out.updateMatrixWorld();
    return true;
  }

  /** Run a pending animation or the inertia; true while either goes on. */
  step(now) {
    const dt = this.lastStep ? clamp(now - this.lastStep, 1, 64) : 16;
    this.lastStep = now;
    let busy = false;
    if (this.anim) busy = this.anim(now);
    else if (this.coasting && !this.touching) {
      const v = this.vel, k = Math.exp(-dt / DECAY_MS);
      let turn = false, move = false;
      if (Math.abs(v.yaw) + Math.abs(v.pitch) > 2e-5) { this._rotate(v.yaw * dt, v.pitch * dt); v.yaw *= k; v.pitch *= k; turn = true; } else v.yaw = v.pitch = 0;
      if (Math.hypot(v.px, v.pz) * DECAY_MS > this.dist * 0.002) {
        this.target.x += v.px * dt; this.target.z += v.pz * dt; v.px *= k; v.pz *= k; this.apply(); move = true;
      } else v.px = v.pz = 0;
      if (Math.abs(v.zoom) > 1e-5) { this._zoomAbout(this.zc, Math.exp(v.zoom * dt)); v.zoom *= k; move = true; } else v.zoom = 0;
      if (move) this._anchor();
      if (turn || move) { this.emit('change'); busy = true; } else { this.coasting = false; this._end(); }
    }
    this.keep();
    return busy;
  }

  /** An animation from now to `ms` later: `at(e)` sets the state for eased progress e. */
  _animate(ms, at, done) {
    this.stop();
    if (!ms || reduceMotion()) { at(1); this.anim = null; this.keep(); if (done) done(); this.emit('change'); this.invalidate(); return; }
    const t0 = performance.now();
    this._begin();
    this.anim = (now) => {
      const k = clamp((now - t0) / ms, 0, 1);
      at(easeInOut(k));
      this.apply();
      if (k >= 1) { this.anim = null; this.keep(); if (done) done(); this._end(); return false; }
      this.emit('change');
      return true;
    };
    this.anim.land = () => { at(1); this.anim = null; this.keep(); if (done) done(); this._end(); };
    this.invalidate();
  }
  /** Land a flight or a zoom at its end now (a touch does). */
  finish() { if (this.anim && this.anim.land) this.anim.land(); }

  /** Zoom by `f` about Mercator (X, Y) on the ground (the pivot when omitted), animated. Positions
   *  are kept in Mercator, so a move of the frame's origin during the flight changes nothing. */
  zoomAbout(f, X, Y, ms = ZOOM_MS) {
    const fr = this.frame, t = this.target;
    const pX = X ?? fr.X(t.x), pY = Y ?? fr.Y(t.z);
    const t0X = fr.X(t.x), t0Y = fr.Y(t.z), d0 = this.dist / fr.c0;
    const d1 = clamp(this.dist * f, MIN_DIST, MAX_DIST) / fr.c0, F = d1 / d0;
    this._animate(ms, (e) => {
      const s = F ** e;
      t.x = fr.sx(pX + (t0X - pX) * s); t.z = fr.sz(pY + (t0Y - pY) * s);
      this.dist = d0 * s * fr.c0;
    });
  }
  /** Fly so Mercator (X, Y) is the middle of the view, the distance times `f`, the tilt and turn kept. */
  flyTo(X, Y, f = 0.5, ms = FLY_MS) {
    const fr = this.frame, t = this.target;
    const t0X = fr.X(t.x), t0Y = fr.Y(t.z), d0 = this.dist / fr.c0;
    const d1 = clamp(this.dist * f, MIN_DIST, MAX_DIST) / fr.c0;
    this._animate(ms, (e) => {
      t.x = fr.sx(t0X + (X - t0X) * e); t.z = fr.sz(t0Y + (Y - t0Y) * e);
      this.dist = d0 * (d1 / d0) ** e * fr.c0;
    });
  }
  /** The zoom keys: a step toward or away from the middle of the view. */
  zoomBy(factor) { this.zoomAbout(factor); }

  /** The switch: 2D is straight down and north up; 3D tilts to TILT_3D about the same pivot, at the
   *  same distance, so the middle and the scale there are kept both ways. */
  setMode(mode, animate = true) {
    if (mode === this.mode) return;
    this.finish();
    this.stop();
    const from = this.phi, to = mode === 'map' ? 0 : TILT_3D;
    const th0 = this.theta, dth = mode === 'map' ? ((((-th0 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI : 0;
    this.mode = mode;
    this.modeAnim = true;
    this._animate(animate ? MODE_MS : 0, (e) => { this.phi = from + (to - from) * e; this.theta = th0 + dth * e; }, () => {
      this.modeAnim = false;
      if (mode === 'map') this.theta = 0;
      this.apply();
    });
  }

  /** Look at Mercator (X, Y) from `dist` scene units, keeping the mode's tilt. */
  lookAt(X, Y, dist, phi, theta) {
    this.finish(); this.stop();
    this.target.set(this.frame.sx(X), 0, this.frame.sz(Y));
    const g = this.groundAt(this.target.x, this.target.z);
    if (g != null) this.target.y = g;
    this.place(dist, phi ?? (this.mode === 'map' ? 0 : TILT_3D), theta ?? (this.mode === 'map' ? 0 : this.theta));
    this.invalidate();
  }

  serialize() {
    const t = this.target;
    return { mode: this.mode, X: this.frame.X(t.x), Y: this.frame.Y(t.z), dist: this.dist / this.frame.c0, phi: this.phi, theta: this.theta };
  }

  // ----------------------------------------------------------------- the hands
  // Milky Way's gesture code (js/view.js), on the ground: one pointer turns (3D) or drags (2D),
  // two pinch, and pan once their middle has moved; the fling is measured over the last moves and
  // dropped when the finger rested before it lifted.
  _bind() {
    const el = this.dom, area = this.area, pts = new Map();
    let mode = null, last = null, lastT = 0, moved = 0, mid0 = null, span0 = 0, pinchPan = false, zAcc = 0, zT = 0, anchored = false;
    const lerp = (a, b, k) => a + (b - a) * k;
    const span = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    const one = (e) => (this.mode === '3d' && !(e && (e.button === 2 || e.shiftKey)) ? 'rot' : 'pan');

    area.addEventListener('pointerdown', (e) => {
      if ((e.pointerType === 'mouse' && e.button === 1) || !this.takes(e)) return;
      // the canvas holds its pointer; a touch on a name is held by the name, and bubbles here
      if (e.target === el) try { el.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.touching = true;
      this.stop();
      if (this.anim && !this.modeAnim) this.finish();      // a touch during a flight lands it at once
      const now = performance.now();
      if (pts.size === 1) {
        mode = one(e); last = { x: e.clientX, y: e.clientY }; moved = 0; anchored = false;
        if (mode === 'pan') this._grab(e.clientX, e.clientY);
      } else if (pts.size === 2) {
        const m = mid();
        mode = 'pinch'; last = { span: span(), x: m.x, y: m.y }; mid0 = m; span0 = last.span; pinchPan = false;
        zAcc = 0; zT = now; moved = 99;
        this._grab(m.x, m.y);
      }
      lastT = now;
    });
    area.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = performance.now(), dt = Math.max(1, now - lastT);
      if (this.anim) return;
      if ((mode === 'rot' || mode === 'pan') && pts.size === 1) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved < SLOP) return;
        this._begin();
        lastT = now;
        if (mode === 'rot') {
          if (!anchored) { this._anchor(); anchored = true; }
          const dyaw = -dx * ROT, dp = -dy * ROT;
          this._rotate(dyaw, dp);
          this.vel.yaw = lerp(this.vel.yaw, dyaw / dt, 0.5); this.vel.pitch = lerp(this.vel.pitch, dp / dt, 0.5);
        } else {
          const [mx, mz] = this._pan(last.x, last.y, e.clientX, e.clientY);
          this.vel.px = lerp(this.vel.px, mx / dt, 0.5); this.vel.pz = lerp(this.vel.pz, mz / dt, 0.5);
        }
        last = { x: e.clientX, y: e.clientY };
        this._after(mode === 'pan');
      } else if (mode === 'pinch' && pts.size === 2) {
        this._begin();
        lastT = now;
        const s = span(), m = mid(), f = last.span / Math.max(s, 1);
        const P = this._groundAt(m.x, m.y, this._a);
        if (P) { this.zc.copy(P); this._zoomAbout(P, f); }
        // the fingers' events arrive a moment apart: the fling's zoom speed is measured over a frame
        zAcc += Math.log(f);
        if (now - zT >= 16) { this.vel.zoom = lerp(this.vel.zoom, zAcc / (now - zT), 0.5); zAcc = 0; zT = now; }
        const drift = Math.hypot(m.x - mid0.x, m.y - mid0.y) - 0.5 * Math.abs(s - span0);
        if (!pinchPan && drift > PINCH_PAN_PX) pinchPan = true;
        if (pinchPan) {
          const [mx, mz] = this._pan(last.x, last.y, m.x, m.y);
          this.vel.px = lerp(this.vel.px, mx / dt, 0.5); this.vel.pz = lerp(this.vel.pz, mz / dt, 0.5);
        }
        last.x = m.x; last.y = m.y; last.span = s;
        this._after();
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      const now = performance.now();
      if (pts.size === 0) {
        this.touching = false;
        // a finger that rested before it lifted throws nothing; nor does any under Reduce Motion
        if (now - lastT > 80 || e.type === 'pointercancel' || reduceMotion()) this.stop();
        if (Math.abs(this.vel.zoom) < 2e-4) this.vel.zoom = 0;
        mode = null;
        const v = this.vel;
        if (this.active && (Math.abs(v.yaw) + Math.abs(v.pitch) > 2e-5 || Math.hypot(v.px, v.pz) * DECAY_MS > this.dist * 0.002 || v.zoom)) {
          this.coasting = true; this.lastStep = 0; this.invalidate();
        } else this._end();
      } else if (pts.size === 1) {
        const [p] = [...pts.values()];
        mode = one(null); last = { x: p.x, y: p.y }; moved = 99; anchored = false;
        this.vel.yaw = this.vel.pitch = this.vel.px = this.vel.pz = this.vel.zoom = 0;
        if (mode === 'pan') this._grab(p.x, p.y);
      }
    };
    area.addEventListener('pointerup', up);
    area.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    area.addEventListener('wheel', (e) => {
      if (!this.takes(e)) return;
      e.preventDefault();
      if (this.anim) return;
      const k = e.ctrlKey ? 0.012 : 0.0016;            // a trackpad pinch arrives as ctrl + wheel
      const P = this._groundAt(e.clientX, e.clientY, this._a);
      if (!P) return;
      this._begin();
      this._zoomAbout(P, Math.exp(e.deltaY * k));
      this._after();
      this._end();
    }, { passive: false });
  }
}
