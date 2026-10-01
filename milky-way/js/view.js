// The camera rig: one camera and one continuous zoom, from a few hundred kilometers above a moon to
// half a megaparsec from the Sun: fifteen powers of ten on a single pinch. Float64, AU,
// heliocentric, ICRF; no three.js here. State is a target (a function, so a moving planet stays
// centered while time plays), a distance and a direction. "Up" is a function of the distance: the
// ecliptic pole close in, the galactic pole far out, turning between about 0.01 and 1 light-year
// with only the roll changing, so the Solar System tilts against the galaxy without a jump.

import { clamp, lerp, smoothstep, vadd, vcopy, vcross, vdot, vlen, vnorm, vrot, vscale, vsub, DEG } from './util.js';

const MIN_DIST = 2e-7;         // AU, about 30 km
const MAX_DIST = 1.2e11;       // AU, about 580 kpc: past the farthest satellite galaxy in the data
const UP_BLEND = [Math.log10(3e3), Math.log10(3e5)];   // AU: from the ecliptic "up" to the galactic one
const POLE_GAP = 4 * DEG;      // how close the view may get to looking straight along "up"
const START_DIST = 12, START_DIR = [0.3, -0.75, 0.6];

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// A flight's path (van Wijk and Nuij 2003, d3's interpolateZoom, rho √2): pull back while the target
// moves, close in over the new one, never skimming the young-star map's plane. Distances a to b, a
// move m in plate heights at unit distance; e in [0, 1] gives [share of the move, distance].
function zoomPath(a, b, m) {
  if (!(m > 1e-9 * (a + b))) return (e) => [e, a * (b / a) ** e];
  const r0 = -Math.asinh((b * b - a * a + 4 * m * m) / (4 * a * m));
  const S = -r0 - Math.asinh((b * b - a * a - 4 * m * m) / (4 * b * m));
  return (e) => { const s = S * e; return [a * Math.sinh(s) / (2 * m * Math.cosh(s + r0)), a * Math.cosh(r0) / Math.cosh(s + r0)]; };
}

export class Rig {
  constructor(canvas) {
    this.canvas = canvas;
    this.fov = 50 * DEG;               // vertical field of view
    this.targetFn = () => [0, 0, 0];
    this.targetId = 'sun';
    this.minDist = MIN_DIST;
    this.dist = START_DIST;
    this.dir = vnorm([], START_DIR);
    this.anim = null;
    this.vel = { yaw: 0, pitch: 0, zoom: 0 };
    this.touching = false;
    this.listeners = {};
    // Basis vectors in ICRF. Placeholders until setFrames() is called with the ecliptic pole (from
    // the J2000 obliquity in physical.json) and the galactic pole (from galaxy.json's frame).
    this.eclUp = [0, 0, 1];
    this.galUp = [0, 0, 1];
    this.lastUp = this.eclUp.slice();
    this._target = [0, 0, 0];
    this._bindGestures();
  }

  setFrames(eclUp, galUp) { this.eclUp = vnorm([], eclUp); this.galUp = vnorm([], galUp); this.lastUp = this.eclUp.slice(); }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  // "Up" at a given distance: the ecliptic pole near the Sun, the galactic pole far away.
  upAt(dist, out = []) {
    const s = smoothstep(UP_BLEND[0], UP_BLEND[1], Math.log10(Math.max(dist, 1e-12)));
    // Spherical interpolation between the two poles (62.6° apart), then normalize.
    const a = this.eclUp, b = this.galUp;
    const cosO = clamp(vdot(a, b), -1, 1), O = Math.acos(cosO), sO = Math.sin(O) || 1;
    const wa = Math.sin((1 - s) * O) / sO, wb = Math.sin(s * O) / sO;
    out[0] = a[0] * wa + b[0] * wb; out[1] = a[1] * wa + b[1] * wb; out[2] = a[2] * wa + b[2] * wb;
    return vnorm(out, out);
  }

  target(jd) { const p = this.targetFn(jd); vcopy(this._target, p); return this._target; }

  // Camera position (AU, heliocentric ICRF), forward and up unit vectors, for the current state.
  pose(jd) {
    const t = this.target(jd);
    const pos = vadd([], t, vscale([], this.dir, this.dist));
    const fwd = vscale([], this.dir, -1);
    let up = this.upAt(this.dist);
    // Orthogonalize up against the view direction; fall back to the last good up near the pole.
    const d = vdot(up, fwd);
    up = [up[0] - fwd[0] * d, up[1] - fwd[1] * d, up[2] - fwd[2] * d];
    if (vlen(up) < 1e-6) up = this.lastUp.slice(); else vnorm(up, up);
    this.lastUp = up;
    return { pos, fwd, up, target: t.slice(), dist: this.dist };
  }

  setTarget(id, fn, minDist = MIN_DIST) {
    this.targetId = id; this.targetFn = fn; this.minDist = Math.max(minDist, MIN_DIST);
    if (this.dist < this.minDist) this.dist = this.minDist;
  }

  // ----------------------------------------------------------------- motion
  rotate(dyaw, dpitch) {
    const up = this.upAt(this.dist);
    vrot(this.dir, this.dir, up, dyaw);
    const right = vnorm([], vcross([], up, this.dir));
    const ang = Math.acos(clamp(vdot(this.dir, up), -1, 1));        // angle from "up"
    const next = clamp(ang - dpitch, POLE_GAP, Math.PI - POLE_GAP);
    // A positive turn about up × dir moves dir away from up, so turning by (next − ang) lands on next.
    if (vlen(right) > 1e-9) vrot(this.dir, this.dir, right, next - ang);
    vnorm(this.dir, this.dir);
  }

  zoom(factor) { this.dist = clamp(this.dist * factor, this.minDist, MAX_DIST); }

  // Move the target across the screen: it becomes a fixed point in space.
  pan(dxPx, dyPx, jd) {
    const h = this.canvas.clientHeight || 1;
    const scale = 2 * this.dist * Math.tan(this.fov / 2) / h;
    const p = this.pose(jd);
    const right = vnorm([], vcross([], p.fwd, p.up));
    const t = this.target(jd).slice();
    const off = vadd([], vscale([], right, -dxPx * scale), vscale([], p.up, dyPx * scale));
    const fixed = vadd([], t, off);
    this.setTarget('point', () => fixed, MIN_DIST);
    this.emit('free');
  }

  // Fly to a new target. `to` = { id, fn, dist, dir?, minDist? }, along zoomPath().
  flyTo(to, jd, duration) {
    const finite = (v) => !!v && v.every(Number.isFinite);
    const toPos = to.fn(jd);
    if (!finite(toPos)) return;                  // nowhere to go: stay put rather than become NaN
    // A start that is not a number (a lost target, say) would keep the whole flight NaN: start from
    // the destination instead, so the flight always lands.
    let fromPos = this.target(jd).slice();
    if (!finite(fromPos)) fromPos = toPos.slice();
    const toDir = finite(to.dir) && vlen(to.dir) > 0 ? vnorm([], to.dir) : null;
    if (!finite(this.dir) || !(vlen(this.dir) > 0)) this.dir = toDir ? toDir.slice() : vnorm([], START_DIR);
    if (!finite(this.lastUp)) this.lastUp = this.eclUp.slice();
    const want = Number.isFinite(to.dist) ? to.dist : Number.isFinite(this.dist) ? this.dist : START_DIST;
    const dist = clamp(want, Math.max(to.minDist || MIN_DIST, MIN_DIST), MAX_DIST);
    if (!Number.isFinite(this.dist)) this.dist = dist;
    const sep = Math.hypot(toPos[0] - fromPos[0], toPos[1] - fromPos[1], toPos[2] - fromPos[2]);
    const l0 = Math.log(this.dist), l1 = Math.log(dist);
    // timed as before the path changed: the camera's waits are tuned to it
    const bump = Math.max(0, Math.log(Math.max(sep, 1e-12) * 1.4) - Math.max(l0, l1));
    const dir = toDir || this.dir.slice();
    if (!duration) duration = clamp(900 + 180 * (Math.abs(l1 - l0) + bump), 900, 3200);
    this.vel.yaw = this.vel.pitch = this.vel.zoom = 0;
    if (reduceMotion()) {
      this.setTarget(to.id, to.fn, to.minDist); this.dist = dist; vcopy(this.dir, dir);
      this.anim = null; this.emit('arrive', to.id); return;
    }
    this.anim = { t0: performance.now(), dur: duration, fromPos, fromDir: this.dir.slice(), l1, to, dir, path: zoomPath(this.dist, dist, sep / (2 * Math.tan(this.fov / 2))) };
    this.setTarget('flight', (j) => this._flightPos(j), MIN_DIST);
  }

  _flightPos(jd) {
    const a = this.anim;
    if (!a) return this._target;
    const f = a.path(easeInOut(clamp((performance.now() - a.t0) / a.dur, 0, 1)))[0];
    const p1 = a.to.fn(jd);
    return [lerp(a.fromPos[0], p1[0], f), lerp(a.fromPos[1], p1[1], f), lerp(a.fromPos[2], p1[2], f)];
  }

  // Advance animations and inertia. Returns true while something is still moving.
  step(dtMs) {
    let moving = false;
    if (this.anim) {
      const a = this.anim;
      const u = clamp((performance.now() - a.t0) / a.dur, 0, 1), e = easeInOut(u);
      this.dist = a.path(e)[1];
      // Slerp the view direction.
      const c = clamp(vdot(a.fromDir, a.dir), -1, 1), O = Math.acos(c);
      if (O > 1e-6) {
        const s = Math.sin(O), wa = Math.sin((1 - e) * O) / s, wb = Math.sin(e * O) / s;
        for (let i = 0; i < 3; i++) this.dir[i] = a.fromDir[i] * wa + a.dir[i] * wb;
        vnorm(this.dir, this.dir);
      }
      if (u >= 1) {
        const to = a.to; this.anim = null;
        this.setTarget(to.id, to.fn, to.minDist);
        this.dist = clamp(this.dist, this.minDist, MAX_DIST);
        this.emit('arrive', to.id);
      }
      moving = true;
    }
    // Inertia runs only once the fingers are off the glass; while they are down they drive the view.
    if (this.touching) return moving;
    const k = Math.exp(-dtMs / 260);      // inertia decay
    if (Math.abs(this.vel.yaw) + Math.abs(this.vel.pitch) > 1e-5) {
      this.rotate(this.vel.yaw * dtMs, this.vel.pitch * dtMs);
      this.vel.yaw *= k; this.vel.pitch *= k; moving = true;
    } else { this.vel.yaw = this.vel.pitch = 0; }
    if (Math.abs(this.vel.zoom) > 1e-5) {
      this.zoom(Math.exp(this.vel.zoom * dtMs));
      this.vel.zoom *= k; moving = true;
    } else { this.vel.zoom = 0; }
    return moving;
  }

  get animating() { return !!this.anim; }
  // Land the flight in progress at its destination now (a touch mid-flight lands at the final state).
  finish() {
    const a = this.anim;
    if (!a) return;
    this.anim = null;
    this.setTarget(a.to.id, a.to.fn, a.to.minDist);
    this.dist = Math.min(Math.max(Math.exp(a.l1), this.minDist), MAX_DIST); vcopy(this.dir, a.dir);
    this.emit('arrive', a.to.id);
  }

  // ----------------------------------------------------------------- gestures
  _bindGestures() {
    const el = this.canvas;
    const pts = new Map();
    let mode = null, last = null, lastT = 0, downAt = null, moved = 0, lastTap = null, mid0 = null, span0 = 0, pinchPan = false;
    let zAcc = 0, zT = 0;
    const ROT = 0.0055;       // radians per pixel
    // A pinch only zooms, keeping its target, until its midpoint has moved this far from where it
    // began — beyond the half of the span change that a pinch with one finger held still moves it
    // by. Each pointermove brings one finger, so even a steady pinch jitters the midpoint.
    const PINCH_PAN_PX = 12;

    const span = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.touching = true;
      this.vel.yaw = this.vel.pitch = this.vel.zoom = 0;
      if (this.anim && pts.size === 1) this.finish();       // a touch during a flight lands it at once
      if (pts.size === 1) {
        mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
        last = { x: e.clientX, y: e.clientY }; downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0;
      } else if (pts.size === 2) {
        mode = 'pinch'; last = { span: span(), ...mid() }; moved = 99;
        mid0 = mid(); span0 = last.span; pinchPan = false;
        zAcc = 0; zT = performance.now();
      }
      lastT = performance.now();
      this.emit('interact');
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = performance.now(), dt = Math.max(1, now - lastT); lastT = now;
      if (this.anim) return;
      if (mode === 'rot' && pts.size === 1) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved < 4) return;
        this.rotate(-dx * ROT, dy * ROT);
        this.vel.yaw = lerp(this.vel.yaw, -dx * ROT / dt, 0.5);
        this.vel.pitch = lerp(this.vel.pitch, dy * ROT / dt, 0.5);
        last = { x: e.clientX, y: e.clientY };
        this.emit('change');
      } else if (mode === 'pan' && pts.size === 1) {
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        moved += Math.abs(dx) + Math.abs(dy);
        this.pan(dx, dy, this.jdNow ? this.jdNow() : 0);
        last = { x: e.clientX, y: e.clientY };
        this.emit('change');
      } else if (mode === 'pinch' && pts.size === 2) {
        const s = span(), m = mid();
        const f = last.span / Math.max(s, 1);
        this.zoom(f);
        // The two fingers' events arrive a millisecond apart, so the zoom speed for the fling is
        // measured over at least a frame's worth of them, not per event.
        zAcc += Math.log(f);
        if (now - zT >= 16) { this.vel.zoom = lerp(this.vel.zoom, zAcc / (now - zT), 0.5); zAcc = 0; zT = now; }
        const drift = Math.hypot(m.x - mid0.x, m.y - mid0.y) - 0.5 * Math.abs(s - span0);
        if (!pinchPan && drift > PINCH_PAN_PX) pinchPan = true;
        // While panning, a sub-pixel step is kept for the next move rather than dropped.
        const dx = m.x - last.x, dy = m.y - last.y;
        if (!pinchPan || Math.abs(dx) + Math.abs(dy) > 0.5) {
          if (pinchPan) this.pan(dx, dy, this.jdNow ? this.jdNow() : 0);
          last.x = m.x; last.y = m.y;
        }
        last.span = s;
        this.emit('change');
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      this.touching = pts.size > 0;
      const now = performance.now();
      if (now - lastT > 80) { this.vel.yaw = this.vel.pitch = 0; this.vel.zoom = 0; }
      if (mode === 'pinch') { if (Math.abs(this.vel.zoom) < 2e-4) this.vel.zoom = 0; }
      if (pts.size === 0) {
        if (downAt && moved < 8 && now - downAt.t < 400 && e.type === 'pointerup') {
          this.vel.yaw = this.vel.pitch = 0;
          const tap = { x: e.clientX, y: e.clientY, t: now };
          if (lastTap && now - lastTap.t < 320 && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 30) {
            this.emit('doubletap', tap.x, tap.y); lastTap = null;
          } else {
            this.emit('tap', tap.x, tap.y); lastTap = tap;
          }
        }
        mode = null; downAt = null;
        this.emit('settle');
      } else if (pts.size === 1) {
        const [p] = [...pts.values()]; mode = 'rot'; last = { x: p.x, y: p.y }; moved = 99;
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.anim) return;
      const k = e.ctrlKey ? 0.012 : 0.0016;           // trackpad pinch arrives as ctrl+wheel
      this.zoom(Math.exp(e.deltaY * k));
      this.emit('interact'); this.emit('change'); this.emit('settle');
    }, { passive: false });
  }
}
