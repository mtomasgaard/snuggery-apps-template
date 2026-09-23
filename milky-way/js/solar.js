// The Solar System scale: the Sun, the planets, their major moons, Saturn's rings and the small
// bodies, all at true size and at their positions for the current date.
//
// Units inside `root` are astronomical units, relative to a *floating origin* — the camera's target
// — so that a globe a few hundred kilometres from the camera is still drawn in float32 without
// jitter. `root.scale` is set by app.js so that the target sits about one unit from the camera,
// which is what the logarithmic depth buffer needs to resolve a planet against its own rings.
//
// Planets are never enlarged. A planet smaller than a few pixels is shown by a marker dot and its
// label; the globe takes over as you come close. Orbits are the osculating ellipse at the current
// date (from the ephemeris position and velocity); trails are the ephemeris path itself over the
// last part of each orbit, fading behind the body, which is what shows the motion when time plays.

import * as THREE from '../vendor/three.module.js';
import { glowPointsMaterial, globeMaterial, ringMaterial, thickLineMaterial, ThickLine } from './gfx.js';
import { AU_KM, vsub, vlen, vcross, vdot, vnorm } from './util.js';

const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

// Marker and label colours. These are interface colours for finding things, not data.
const UI_COLOUR = {
  sun: '#ffd89a', mercury: '#bdb6ad', venus: '#eadfc6', earth: '#8fbcff', moon: '#cfcfcf', mars: '#e8865c',
  jupiter: '#dccaa6', saturn: '#e6d39c', uranus: '#a6dde4', neptune: '#8aa5f5', pluto: '#cbb9a6',
};
const KIND_COLOUR = {
  mba: [0.92, 0.74, 0.48], marscrosser: [0.95, 0.6, 0.45], trojan: [0.6, 0.85, 0.55],
  centaur: [0.85, 0.6, 0.85], tno: [0.55, 0.7, 0.95], neo: [1.0, 0.62, 0.35], comet: [0.55, 0.95, 1.0],
  interstellar: [1.0, 0.45, 0.55], dwarf: [1.0, 0.92, 0.75], other: [0.6, 0.6, 0.6],
};

const hex3 = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

export class SolarSystem {
  constructor({ eph, rotation, phys, tex, textures, small }) {
    this.eph = eph; this.rotation = rotation; this.phys = phys; this.small = small;
    this.textures = textures;            // tex/textures.json
    this.root = new THREE.Group();
    this.root.name = 'solar';
    this.bodies = new Map();
    this.layers = {};
    this._orbitJd = NaN;
    this._tmp = [0, 0, 0];
    this._tmp2 = [0, 0, 0];
    this.hasMoons = new Set(['mars', 'jupiter', 'saturn', 'uranus', 'neptune'].filter((k) => eph.moons(k).length));
    const sphere = new THREE.SphereGeometry(1, 128, 64);
    sphere.rotateX(Math.PI / 2);          // three's sphere has its pole on y; the body frame has it on z
    this.sphere = sphere;

    const colours = (textures && textures.colours) || {};
    const texFor = (key) => tex[key] || null;
    const texMeta = (key) => (textures && textures.bodies && textures.bodies[key]) || null;

    // ---- the Sun, the planets and the moons
    const add = (key, kind, parent, name) => {
      const p = phys.bodies[key];
      if (!p) return null;
      const radii = p.radii_km || [p.radius_km, p.radius_km, p.radius_km];
      const meta = texMeta(key);
      let color = [0.72, 0.72, 0.72], map = null, gray = false, lonLeft = -180;
      if (meta && texFor(key)) { map = texFor(key); gray = !!meta.grayscale; lonLeft = meta.lon_left_deg; }
      if (colours[key] && colours[key].srgb) color = colours[key].srgb.map((v) => v / 255);
      const mat = globeMaterial({
        map, gray, lonLeft, color, emissive: key === 'sun',
        night: key === 'earth' ? texFor('earth_night') : null,
      });
      const mesh = new THREE.Mesh(sphere, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.root.add(mesh);
      const b = {
        key, name: name || p.name || key, kind, parent, radii, radiusKm: radii[0], mesh, mat,
        pos: [0, 0, 0], rel: [0, 0, 0], ui: UI_COLOUR[key] || (kind === 'moon' ? '#c9ccd2' : '#dddddd'),
        naif: p.naif, meta, phys: p,
      };
      this.bodies.set(key, b);
      return b;
    };
    add('sun', 'star', null, 'Sun');
    for (const k of PLANETS) add(k, k === 'pluto' ? 'dwarf' : 'planet', 'sun');
    add('moon', 'moon', 'earth', 'Moon');
    this.moonRange = eph.moonRange;
    for (const parent of ['mars', 'jupiter', 'saturn', 'uranus', 'neptune']) {
      for (const m of eph.moons(parent)) {
        const key = m.name.toLowerCase();
        const b = add(key, 'moon', parent, m.name);
        if (b) { b.moonName = m.name; b.aKm = m.aKm; }
      }
    }

    // ---- Saturn's (and Uranus's) rings: only the edges and gaps are data.
    this.rings = [];
    this.ringLines = [];
    for (const [planet, list] of Object.entries(phys.rings || {})) {
      const host = this.bodies.get(planet);
      if (!host || !list.length) continue;
      // Uranus's rings are 2–96 km wide: at true width they would be far below a pixel, so they
      // are drawn as thin circles at their measured radii (a display choice, said in the About text).
      if (planet !== 'saturn') {
        for (const r of list) {
          const N = 256, pts = new Float32Array((N + 1) * 3), col = new Float32Array((N + 1) * 4);
          const rad = r.a_km || (r.inner_km + r.outer_km) / 2;
          for (let i = 0; i <= N; i++) { const t = (i / N) * 2 * Math.PI; pts.set([rad * Math.cos(t), rad * Math.sin(t), 0], i * 3); col.set([0.75, 0.8, 0.85, r.name === 'epsilon' ? 0.55 : 0.28], i * 4); }
          const line = ThickLine.from(pts, (i) => col.subarray(i * 4, i * 4 + 4), thickLineMaterial({ width: 1 })).mesh;
          line.visible = false; line.renderOrder = 2;
          this.root.add(line);
          this.ringLines.push({ planet, host, line, rMax: rad });
        }
        continue;
      }
      const bands = list.map((r) => new THREE.Vector3(r.inner_km, r.outer_km, planet === 'saturn' ? 0.6 : 0.35)).slice(0, 6);
      const rMin = Math.min(...list.map((r) => r.inner_km)), rMax = Math.max(...list.map((r) => r.outer_km));
      const geo = new THREE.RingGeometry(rMin * 0.995, rMax * 1.005, 384, 1);
      const mat = ringMaterial();
      mat.uniforms.uCount.value = bands.length;
      bands.forEach((v, i) => mat.uniforms.uBands.value[i].copy(v));
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
      this.root.add(mesh);
      this.rings.push({ planet, host, mesh, mat, bands, rMax });
      if (planet === 'saturn') {
        host.mat.uniforms.uRingCount.value = bands.length;
        bands.forEach((v, i) => host.mat.uniforms.uRingBands.value[i].copy(v));
      }
    }

    // ---- markers: one dot per body, sized in pixels, so a planet is findable at any zoom.
    const keys = [...this.bodies.keys()];
    this.markerKeys = keys;
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keys.length * 3), 3));
    mg.setAttribute('acolor', new THREE.BufferAttribute(new Float32Array(keys.length * 3), 3));
    mg.setAttribute('asize', new THREE.BufferAttribute(new Float32Array(keys.length), 1));
    keys.forEach((k, i) => mg.attributes.acolor.array.set(hex3(this.bodies.get(k).ui), i * 3));
    this.markers = new THREE.Points(mg, glowPointsMaterial({ sharp: 0.35 }));
    this.markers.frustumCulled = false; this.markers.renderOrder = 5;
    this.root.add(this.markers);

    // The Sun's glow: a display effect so the Sun reads as a light source, not data.
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    gg.setAttribute('acolor', new THREE.BufferAttribute(new Float32Array(hex3('#ffd9a0')), 3));
    gg.setAttribute('asize', new THREE.BufferAttribute(new Float32Array([40]), 1));
    this.sunGlow = new THREE.Points(gg, glowPointsMaterial({ opacity: 0.9 }));
    this.sunGlow.frustumCulled = false; this.sunGlow.renderOrder = 6;
    this.root.add(this.sunGlow);

    // ---- orbits (osculating ellipses) and trails (the true path), planets and the Moon
    this.orbitMat = thickLineMaterial({ width: 1.2 });
    this.trailMat = thickLineMaterial({ width: 2.4 });
    this.moonOrbitMat = thickLineMaterial({ width: 1.3 });
    this.orbits = new Map();
    const ORBIT_N = 360, TRAIL_N = 120;
    for (const k of [...PLANETS, 'moon']) {
      const b = this.bodies.get(k);
      if (!b) continue;
      const col = hex3(b.ui);
      const orbitCol = new Float32Array((ORBIT_N + 1) * 4);
      const trailCol = new Float32Array(TRAIL_N * 4);
      for (let i = 0; i <= ORBIT_N; i++) orbitCol.set([col[0], col[1], col[2], 0.16], i * 4);
      for (let i = 0; i < TRAIL_N; i++) { const a = Math.pow(i / (TRAIL_N - 1), 1.6); trailCol.set([col[0], col[1], col[2], 0.9 * a], i * 4); }
      const orbit = ThickLine.from(new Float32Array((ORBIT_N + 1) * 3), (i) => orbitCol.subarray(i * 4, i * 4 + 4), this.orbitMat);
      const trail = ThickLine.from(new Float32Array(TRAIL_N * 3), (i) => trailCol.subarray(i * 4, i * 4 + 4), this.trailMat);
      orbit.mesh.renderOrder = 1; trail.mesh.renderOrder = 1;
      orbit.mesh.visible = trail.mesh.visible = false;
      this.root.add(orbit.mesh, trail.mesh);
      this.orbits.set(k, { orbit, trail, n: ORBIT_N, tn: TRAIL_N, centre: [0, 0, 0], ok: false });
    }
    // Moon orbits of the giant planets: the fitted JPL path over one revolution, fading.
    this.moonOrbits = new Map();
    for (const b of this.bodies.values()) {
      if (b.kind !== 'moon' || b.key === 'moon') continue;
      const N = 160, col = hex3('#9aa6b8');
      const c = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) c.set([col[0], col[1], col[2], 0.08 + 0.55 * Math.pow(i / (N - 1), 2)], i * 4);
      const line = ThickLine.from(new Float32Array(N * 3), (i) => c.subarray(i * 4, i * 4 + 4), this.moonOrbitMat);
      line.mesh.visible = false; line.mesh.renderOrder = 1;
      this.root.add(line.mesh);
      this.moonOrbits.set(b.key, { line, n: N });
    }

    // ---- small bodies
    if (small) {
      const n = small.count;
      this.smallPos = new Float32Array(n * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.smallPos, 3));
      const col = new Float32Array(n * 3), size = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const kind = small.kind(i);
        col.set(KIND_COLOUR[kind] || KIND_COLOUR.other, i * 3);
        const H = small.H ? small.H(i) : NaN;
        size[i] = Number.isFinite(H) ? Math.max(2.4, Math.min(5, 5.4 - 0.25 * H)) : (kind === 'comet' ? 2.6 : 2.4);
        if (kind === 'dwarf') size[i] = 4.2;
      }
      g.setAttribute('acolor', new THREE.BufferAttribute(col, 3));
      g.setAttribute('asize', new THREE.BufferAttribute(size, 1));
      this.smallPts = new THREE.Points(g, glowPointsMaterial({ opacity: 1.0, sharp: 0.3 }));
      this.smallPts.frustumCulled = false; this.smallPts.renderOrder = 3;
      this.root.add(this.smallPts);
      this._smallJd = NaN;
      this.smallOrbitLine = ThickLine.from(new Float32Array(513 * 3), [0.55, 0.95, 1.0, 0.55], thickLineMaterial({ width: 1.6 }));
      this.smallOrbit = this.smallOrbitLine.mesh;
      this.smallOrbit.visible = false; this.smallOrbit.renderOrder = 1;
      this.root.add(this.smallOrbit);
      this.smallOrbitIdx = -1;
    }
  }

  // ------------------------------------------------------------------ positions (AU, heliocentric)
  positionOf(key, jd, out = [0, 0, 0]) {
    if (key === 'sun') { out[0] = out[1] = out[2] = 0; return out; }
    const b = this.bodies.get(key);
    if (b && b.kind === 'moon' && key !== 'moon') {
      const par = this.positionOf(b.parent, jd, out);     // the planet's centre (see below)
      const m = this._tmp;
      if (!this.eph.moonFromCentre(b.moonName, jd, m)) return null;
      out[0] = par[0] + m[0] / AU_KM; out[1] = par[1] + m[1] / AU_KM; out[2] = par[2] + m[2] / AU_KM;
      return out;
    }
    const p = this.eph.helio(key, jd, this._tmp);
    out[0] = p[0] / AU_KM; out[1] = p[1] / AU_KM; out[2] = p[2] / AU_KM;
    // DE430 gives the giant planets' system barycentres; within the satellite range the planet's
    // own centre is rebuilt from its moons (up to ~300 km away for Saturn), which is where the globe
    // belongs and what the moons circle.
    if (this.hasMoons.has(key) && jd >= this.moonRange.jdStart && jd <= this.moonRange.jdEnd) {
      const c = this.eph.planetCentre(key, jd, this._tmp2);
      out[0] += c[0] / AU_KM; out[1] += c[1] / AU_KM; out[2] += c[2] / AU_KM;
    }
    return out;
  }
  // Osculating heliocentric (or geocentric, for the Moon) ellipse from position and velocity.
  _osculating(key, jd, centreKey, gm) {
    const h = 0.25;
    const p0 = this.positionOf(key, jd - h, [0, 0, 0]), p1 = this.positionOf(key, jd + h, [0, 0, 0]);
    const c0 = centreKey ? this.positionOf(centreKey, jd - h, [0, 0, 0]) : [0, 0, 0];
    const c1 = centreKey ? this.positionOf(centreKey, jd + h, [0, 0, 0]) : [0, 0, 0];
    const pc = this.positionOf(key, jd, [0, 0, 0]), cc = centreKey ? this.positionOf(centreKey, jd, [0, 0, 0]) : [0, 0, 0];
    const r = vsub([], pc, cc);
    const v = [((p1[0] - c1[0]) - (p0[0] - c0[0])) / (2 * h), ((p1[1] - c1[1]) - (p0[1] - c0[1])) / (2 * h), ((p1[2] - c1[2]) - (p0[2] - c0[2])) / (2 * h)];
    const mu = gm;                               // AU³/day²
    const rl = vlen(r), v2 = vdot(v, v);
    const hv = vcross([], r, v);
    const ev = [(v[1] * hv[2] - v[2] * hv[1]) / mu - r[0] / rl, (v[2] * hv[0] - v[0] * hv[2]) / mu - r[1] / rl, (v[0] * hv[1] - v[1] * hv[0]) / mu - r[2] / rl];
    const e = vlen(ev);
    const a = 1 / (2 / rl - v2 / mu);
    if (!(a > 0) || e >= 1) return null;
    const P = e > 1e-8 ? vnorm([], ev) : vnorm([], r);
    const Q = vnorm([], vcross([], vnorm([], hv), P));
    return { a, e, P, Q, centre: cc, period: 2 * Math.PI * Math.sqrt(a * a * a / mu) };
  }

  // ------------------------------------------------------------------ per frame
  // `origin` = floating origin (AU), `cam` = camera position (AU), `pxPerRad` = pixels per radian,
  // `S` = root.scale (world units per AU). Shader uniforms live in world units, so they carry S.
  update(jd, origin, cam, pxPerRad, pxRatio, layers, S = 1) {
    this.layers = layers;
    // Far out (beyond ~0.1 light-year) the whole Solar System is one pixel: everything but the
    // Sun's glow is hidden, and the Sun stays marked until the galaxy layer's own marker takes over.
    const dSun = Math.hypot(cam[0], cam[1], cam[2]);
    this.far = dSun > 2e4;
    const k2 = this.phys.constants.k_gauss_au15_day ** 2;
    const inMoonRange = jd >= this.moonRange.jdStart && jd <= this.moonRange.jdEnd;
    this.inMoonRange = inMoonRange;
    const sunRel = [-origin[0] * S, -origin[1] * S, -origin[2] * S];

    // Positions of every body; visibility by apparent size.
    for (const b of this.bodies.values()) {
      const p = (b.kind === 'moon' && b.key !== 'moon' && !inMoonRange) ? null : this.positionOf(b.key, jd, b.pos);
      b.valid = !!p;
      if (!p) { b.mesh.visible = false; continue; }
      vsub(b.rel, b.pos, origin);
      const d = Math.hypot(b.pos[0] - cam[0], b.pos[1] - cam[1], b.pos[2] - cam[2]);
      b.camDist = d;
      b.px = (b.radiusKm / AU_KM) / Math.max(d, 1e-12) * pxPerRad;          // apparent radius, px
      const showMoon = b.kind !== 'moon' || layers.moons;
      b.mesh.visible = showMoon && b.px > 0.35;
      if (b.mesh.visible) {
        b.mesh.position.set(b.rel[0], b.rel[1], b.rel[2]);
        const s = 1 / AU_KM;
        b.mesh.scale.set(b.radii[0] * s, b.radii[1] * s, b.radii[2] * s);
        const R = this.rotation.bodyFrame(b.key, jd);       // ICRF → body-fixed, row-major
        if (R) {
          // Mesh rotation = body-fixed → ICRF = Rᵀ; three's Matrix4.set takes row-major input.
          this._m4 ||= new THREE.Matrix4();
          this._m4.set(R[0], R[3], R[6], 0, R[1], R[4], R[7], 0, R[2], R[5], R[8], 0, 0, 0, 0, 1);
          b.mesh.quaternion.setFromRotationMatrix(this._m4);
        }
        b.mat.uniforms.uSun.value.set(sunRel[0], sunRel[1], sunRel[2]);
      }
    }

    if (this.far) {
      for (const b of this.bodies.values()) if (b.key !== 'sun') b.mesh.visible = false;
      for (const r of this.rings) r.mesh.visible = false;
      for (const r of this.ringLines) r.line.visible = false;
      this.markers.visible = false;
      for (const o of this.orbits.values()) { o.orbit.mesh.visible = false; o.trail.mesh.visible = false; }
      for (const mo of this.moonOrbits.values()) mo.line.mesh.visible = false;
      if (this.smallPts) { this.smallPts.visible = false; this.smallOrbit.visible = false; }
      const sun = this.bodies.get('sun');
      this.sunGlow.geometry.attributes.position.array.set(sun.rel);
      this.sunGlow.geometry.attributes.position.needsUpdate = true;
      this.sunGlow.geometry.attributes.asize.array[0] = 14;
      this.sunGlow.geometry.attributes.asize.needsUpdate = true;
      this.sunGlow.material.uniforms.uPx.value = pxRatio;
      return;
    }
    this.markers.visible = true;

    // Rings follow their planet's equator.
    for (const r of this.rings) {
      const h = r.host;
      const px = (r.rMax / AU_KM) / Math.max(h.camDist || 1, 1e-12) * pxPerRad;
      r.mesh.visible = h.valid && px > 1.2;
      if (!r.mesh.visible) continue;
      r.mesh.position.copy(h.mesh.position);
      r.mesh.quaternion.copy(h.mesh.quaternion);
      r.mesh.scale.setScalar(1 / AU_KM);
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(h.mesh.quaternion);
      const u = r.mat.uniforms;
      u.uSun.value.set(sunRel[0], sunRel[1], sunRel[2]);
      u.uCenter.value.copy(h.mesh.position).multiplyScalar(S); u.uN.value.copy(n);
      u.uR.value = h.radii[0] / AU_KM * S; u.uKm.value = S / AU_KM;
      u.uCam.value.set((cam[0] - origin[0]) * S, (cam[1] - origin[1]) * S, (cam[2] - origin[2]) * S);
      if (r.planet === 'saturn') {
        const hu = h.mat.uniforms;
        hu.uRingN.value.copy(n); hu.uCenter.value.copy(u.uCenter.value); hu.uKm.value = S / AU_KM;
      }
    }

    for (const r of this.ringLines) {
      const h = r.host;
      const px = (r.rMax / AU_KM) / Math.max(h.camDist || 1, 1e-12) * pxPerRad;
      r.line.visible = h.valid && px > 6;
      if (!r.line.visible) continue;
      r.line.position.copy(h.mesh.position); r.line.quaternion.copy(h.mesh.quaternion); r.line.scale.setScalar(1 / AU_KM);
    }

    // Markers: fade out as the globe grows past a few pixels.
    const mp = this.markers.geometry.attributes.position.array, ms = this.markers.geometry.attributes.asize.array;
    this.markerKeys.forEach((k, i) => {
      const b = this.bodies.get(k);
      mp[i * 3] = b.rel[0]; mp[i * 3 + 1] = b.rel[1]; mp[i * 3 + 2] = b.rel[2];
      let s = b.kind === 'star' ? 0 : b.kind === 'moon' ? 3.2 : 5.2;
      if (!b.valid || (b.kind === 'moon' && !layers.moons)) s = 0;
      if (b.kind === 'moon' && b.parent !== 'sun') {
        const par = this.bodies.get(b.parent);
        const sep = (b.aKm || 384400) / AU_KM / Math.max(par.camDist || 1, 1e-12) * pxPerRad;
        if (sep < 9) s = 0;            // the moon would sit on its planet's marker
        b.sepPx = sep;
      }
      if (b.px > 2.5) s = 0;
      ms[i] = s;
    });
    this.markers.geometry.attributes.position.needsUpdate = true;
    this.markers.geometry.attributes.asize.needsUpdate = true;
    this.markers.material.uniforms.uPx.value = pxRatio;

    // The Sun's glow.
    const sun = this.bodies.get('sun');
    this.sunGlow.geometry.attributes.position.array.set(sun.rel);
    this.sunGlow.geometry.attributes.position.needsUpdate = true;
    const glow = Math.min(Math.max(26, sun.px * 7), 900);
    this.sunGlow.geometry.attributes.asize.array[0] = glow;
    this.sunGlow.geometry.attributes.asize.needsUpdate = true;
    this.sunGlow.material.uniforms.uPx.value = pxRatio;

    // Orbits: refresh the osculating ellipses when the date has moved; trails every frame.
    const refreshOrbits = !(Math.abs(jd - this._orbitJd) < 2);
    for (const [k, o] of this.orbits) {
      const b = this.bodies.get(k);
      const centreKey = k === 'moon' ? 'earth' : null;
      // Close to a planet its own orbit is a line straight through the globe: hide it.
      const near = b.px > 14;
      o.orbit.mesh.visible = layers.orbits && b.valid && !near;
      o.trail.mesh.visible = layers.trails && b.valid && !near;
      if (k === 'moon') {
        const e = this.bodies.get('earth');
        const sep = 384400 / AU_KM / Math.max(e.camDist || 1, 1e-12) * pxPerRad;
        if (sep < 14) { o.orbit.mesh.visible = false; o.trail.mesh.visible = false; }
      }
      if (!o.orbit.mesh.visible && !o.trail.mesh.visible) continue;
      if (refreshOrbits || !o.ok) {
        const gmSun = k2, gmP = this._gmAu(k === 'moon' ? 'earth' : k), gmM = k === 'moon' ? this._gmAu('moon') : 0;
        const el = this._osculating(k, jd, centreKey, k === 'moon' ? gmP + gmM : gmSun + gmP);
        o.el = el; o.ok = !!el; o.period = el ? el.period : 365;
        if (el) {
          const arr = o.orbit.pos;
          for (let i = 0; i <= o.n; i++) {
            const E = (i / o.n) * 2 * Math.PI;
            const x = el.a * (Math.cos(E) - el.e), y = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(E);
            arr[i * 3] = x * el.P[0] + y * el.Q[0]; arr[i * 3 + 1] = x * el.P[1] + y * el.Q[1]; arr[i * 3 + 2] = x * el.P[2] + y * el.Q[2];
          }
          o.orbit.update(o.n + 1);
        }
      }
      // Orbit and trail are stored relative to their centre (the Sun, or the Earth for the Moon).
      const c = centreKey ? this.bodies.get(centreKey).pos : [0, 0, 0];
      o.orbit.mesh.position.set(c[0] - origin[0], c[1] - origin[1], c[2] - origin[2]);
      o.trail.mesh.position.copy(o.orbit.mesh.position);
      if (o.trail.mesh.visible && o.trailJd !== jd) {
        o.trailJd = jd;
        const span = Math.min((o.period || 365) * (k === 'moon' ? 0.85 : 0.22), jd - this.eph.range.jdStart);
        const arr = o.trail.pos, tmp = [0, 0, 0], ct = [0, 0, 0];
        for (let i = 0; i < o.tn; i++) {
          const t = jd - span * (1 - i / (o.tn - 1));
          this.positionOf(k, t, tmp);
          if (centreKey) this.positionOf(centreKey, t, ct); else { ct[0] = ct[1] = ct[2] = 0; }
          arr[i * 3] = tmp[0] - ct[0]; arr[i * 3 + 1] = tmp[1] - ct[1]; arr[i * 3 + 2] = tmp[2] - ct[2];
        }
        o.trail.update(o.tn);
      }
    }
    if (refreshOrbits) this._orbitJd = jd;

    // Moon orbits around the giant planets, only when their system is large on screen.
    for (const [k, mo] of this.moonOrbits) {
      const b = this.bodies.get(k), par = this.bodies.get(b.parent);
      // Shown once the orbit is a readable size on screen, and hidden again once it is so much larger
      // than the screen that only near-straight lines would cross it.
      const show = layers.moons && layers.orbits && b.valid && (b.sepPx || 0) > 18 && (b.sepPx || 0) < 1600;
      mo.line.mesh.visible = show;
      if (!show) continue;
      const P = 2 * Math.PI * Math.sqrt(((b.aKm || 1e5) / AU_KM) ** 3 / this._gmAu(b.parent));
      const arr = mo.line.pos, m = [0, 0, 0];
      for (let i = 0; i < mo.n; i++) {
        const t = jd - P * 0.97 * (1 - i / (mo.n - 1));
        if (!this.eph.moonFromCentre(b.moonName, t, m)) { m[0] = m[1] = m[2] = 0; }
        arr[i * 3] = m[0] / AU_KM; arr[i * 3 + 1] = m[1] / AU_KM; arr[i * 3 + 2] = m[2] / AU_KM;
      }
      mo.line.update(mo.n);
      mo.line.mesh.position.set(par.rel[0], par.rel[1], par.rel[2]);
    }

    // Small bodies: propagate when the date moves.
    if (this.smallPts) {
      this.smallPts.visible = !!layers.small;
      if (this.smallPts.visible) {
        if (!(Math.abs(jd - this._smallJd) < 0.05)) {
          this.small.positionsAt(jd, this.smallPos);
          this.smallPts.geometry.attributes.position.needsUpdate = true;
          this._smallJd = jd;
        }
        this.smallPts.position.set(-origin[0], -origin[1], -origin[2]);
        this.smallPts.material.uniforms.uPx.value = pxRatio;
      }
      if (this.smallOrbit.visible) this.smallOrbit.position.set(-origin[0], -origin[1], -origin[2]);
    }
  }

  showSmallOrbit(i, jd) {
    if (!this.small || i < 0) { this.smallOrbit.visible = false; this.smallOrbitIdx = -1; return; }
    const path = this.small.orbitPath(i, jd, 512);
    const arr = this.smallOrbitLine.pos;
    arr.fill(0); arr.set(path.subarray(0, Math.min(path.length, arr.length)));
    // Pad an open path by repeating its last point so no stray segment is drawn to the origin.
    const nPts = Math.min(path.length / 3, 513);
    for (let j = nPts; j < 513; j++) arr.set(path.subarray((nPts - 1) * 3, nPts * 3), j * 3);
    this.smallOrbitLine.update(513);
    this.smallOrbit.visible = true; this.smallOrbitIdx = i;
  }

  _gmAu(key) {
    // km³/s² → AU³/day²
    // The ephemeris gives system barycentres for the giant planets, so their orbits use the system's GM.
    const b = this.phys.bodies[key];
    const gm = b && (key === 'earth' || key === 'moon' ? b.gm_km3_s2 : (b.gm_system_km3_s2 || b.gm_km3_s2));
    if (!gm) return 0;
    return gm * 86400 * 86400 / (AU_KM ** 3);
  }
}
