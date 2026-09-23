// The camera rig: one camera and one continuous zoom, from a few hundred kilometres above a moon to
// half a megaparsec from the Sun — fifteen orders of magnitude on a single pinch.
//
// Everything here is float64 and in astronomical units, heliocentric, on ICRF axes. The render
// passes (app.js) turn that into three cameras in their own units; nothing in this file knows about
// three.js.
//
// State is a *target* (a function returning a position, so a moving planet stays centred while time
// plays), a *distance* from it, and a *direction* from the target to the camera. "Up" is not stored:
// it is a function of the distance. Close in it is the ecliptic north pole, so the planets' plane
// lies flat; far out it is the galactic north pole, so the disc of the Milky Way does; in between
// (about 0.01–1 light-year) it turns smoothly from one to the other. The direction is kept
// continuous through that turn — only the roll changes — which is what lets the solar system tilt
// by 60° against the galaxy as you leave it without the view jumping.

import { clamp, lerp, smoothstep, vadd, vcopy, vcross, vdot, vlen, vnorm, vrot, vscale, vsub, DEG } from './util.js';

const MIN_DIST = 2e-7;         // AU, ~30 km
const MAX_DIST = 1.2e11;       // AU, ~580 kpc: past the farthest satellite galaxy in the data
const UP_BLEND = [Math.log10(3e3), Math.log10(3e5)];   // AU: ecliptic → galactic "up"
const POLE_GAP = 4 * DEG;      // how close the view may get to looking straight along "up"

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Rig {
  constructor(canvas) {
    this.canvas = canvas;
    this.fov = 50 * DEG;               // vertical field of view
    this.targetFn = () => [0, 0, 0];
    this.targetId = 'sun';
    this.minDist = MIN_DIST;
    this.dist = 12;
    this.dir = vnorm([], [0.3, -0.75, 0.6]);
    this.anim = null;
    this.vel = { yaw: 0, pitch: 0, zoom: 0 };
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
    // Spherical interpolation between the two poles (62.6° apart), then normalise.
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
    // Orthogonalise up against the view direction; fall back to the last good up near the pole.
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

  // Fly to a new target. `to` = { id, fn, dist, dir?, minDist? }. The path zooms out far enough to
  // see both ends when they are far apart, then in again: log-distance follows an arch.
  flyTo(to, jd, duration) {
    const fromPos = this.target(jd).slice();
    const toPos = to.fn(jd);
    const sep = Math.hypot(toPos[0] - fromPos[0], toPos[1] - fromPos[1], toPos[2] - fromPos[2]);
    const dist = clamp(to.dist, Math.max(to.minDist || MIN_DIST, MIN_DIST), MAX_DIST);
    const l0 = Math.log(this.dist), l1 = Math.log(dist);
    const bump = Math.max(0, Math.log(Math.max(sep, 1e-12) * 1.4) - Math.max(l0, l1));
    const dir = to.dir ? vnorm([], to.dir) : this.dir.slice();
    if (!duration) duration = clamp(900 + 180 * (Math.abs(l1 - l0) + bump), 900, 3200);
    this.vel.yaw = this.vel.pitch = this.vel.zoom = 0;
    if (reduceMotion()) {
      this.setTarget(to.id, to.fn, to.minDist); this.dist = dist; vcopy(this.dir, dir);
      this.anim = null; this.emit('arrive', to.id); return;
    }
    this.anim = { t0: performance.now(), dur: duration, fromPos, fromDir: this.dir.slice(), l0, l1, bump, to, dir };
    this.setTarget('flight', (j) => this._flightPos(j), MIN_DIST);
  }

  _flightPos(jd) {
    const a = this.anim;
    if (!a) return this._target;
    const u = clamp((performance.now() - a.t0) / a.dur, 0, 1), e = easeInOut(u);
    const p1 = a.to.fn(jd);
    return [lerp(a.fromPos[0], p1[0], e), lerp(a.fromPos[1], p1[1], e), lerp(a.fromPos[2], p1[2], e)];
  }

  // Advance animations and inertia. Returns true while something is still moving.
  step(dtMs) {
    let moving = false;
    if (this.anim) {
      const a = this.anim;
      const u = clamp((performance.now() - a.t0) / a.dur, 0, 1), e = easeInOut(u);
      this.dist = Math.exp(lerp(a.l0, a.l1, e) + a.bump * Math.sin(Math.PI * u));
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

  // ----------------------------------------------------------------- gestures
  _bindGestures() {
    const el = this.canvas;
    const pts = new Map();
    let mode = null, last = null, lastT = 0, downAt = null, moved = 0, lastTap = null;
    const ROT = 0.0055;       // radians per pixel

    const span = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    const mid = () => { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.vel.yaw = this.vel.pitch = this.vel.zoom = 0;
      if (this.anim && pts.size === 1) { /* a touch during a flight lets it finish */ }
      if (pts.size === 1) {
        mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rot';
        last = { x: e.clientX, y: e.clientY }; downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0;
      } else if (pts.size === 2) {
        mode = 'pinch'; last = { span: span(), ...mid() }; moved = 99;
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
        this.vel.zoom = lerp(this.vel.zoom, Math.log(f) / dt, 0.5);
        const dx = m.x - last.x, dy = m.y - last.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) this.pan(dx, dy, this.jdNow ? this.jdNow() : 0);
        last = { span: s, ...m };
        this.emit('change');
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
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
