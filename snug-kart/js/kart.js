// The kart model (DESIGN.md §6): one merged mesh per kart, each with its own copy of one material
// whose map is the face atlas (so a rival can fade on its own), plus all 32 wheels of the field as
// one InstancedMesh. The face painter here also paints the title screen's and the results screen's
// faces.

import {
  BoxGeometry, CylinderGeometry, SphereGeometry, Mesh, Group, InstancedMesh, MeshLambertMaterial, MeshBasicMaterial,
  PlaneGeometry, Matrix4, Quaternion, Vector3, Euler, Color, DynamicDrawUsage,
} from '../vendor/three.module.js';
import { mergeParts, canvasTexture } from './geo.js';

const TILE = 128, ATLAS_W = 512, ATLAS_H = 256;
const WHITE_UV = [4 / ATLAS_W, 1 - 4 / ATLAS_H];     // the top-left 8×8 px of tile 0 are pure white

// ---------------------------------------------------------------------------------------------
// Faces

/** Paint one racer's face into a size × size square at (x, y). Same function for atlas and menus. */
export function paintFace(ctx, x, y, size, racer, { round = false } = {}) {
  const f = racer.face, k = size / TILE;
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  if (round) { ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.clip(); }
  ctx.fillStyle = f.skin; ctx.fillRect(0, 0, TILE, TILE);
  const hair = f.hair, trim = racer.trim;
  const ell = (cx, cy, rx, ry, fill) => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  // Hair / hat across the top third.
  switch (f.style) {
    case 'fringe':
      ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(128, 0); ctx.lineTo(128, 34);
      for (let i = 8; i >= 0; i--) ctx.lineTo(i * 16, i % 2 ? 40 : 30);
      ctx.fill(); break;
    case 'bun':
      ctx.fillStyle = hair; ctx.fillRect(0, 0, 128, 24);
      ctx.beginPath(); ctx.moveTo(0, 24); ctx.quadraticCurveTo(40, 40, 64, 22); ctx.quadraticCurveTo(88, 40, 128, 24); ctx.lineTo(128, 0); ctx.lineTo(0, 0); ctx.fill(); break;
    case 'bald':
      ctx.fillStyle = hair; ctx.fillRect(0, 26, 12, 30); ctx.fillRect(116, 26, 12, 30);
      break;
    case 'goggles':
      ctx.fillStyle = hair; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(128, 0); ctx.lineTo(128, 18);
      for (let i = 10; i >= 0; i--) ctx.lineTo(i * 12.8, i % 2 ? 26 : 14); ctx.fill();
      ctx.fillStyle = '#3A3A40'; ctx.fillRect(0, 22, 128, 12);
      ell(46, 28, 14, 11, '#7FD3E8'); ell(82, 28, 14, 11, '#7FD3E8');
      ctx.strokeStyle = '#3A3A40'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(46, 28, 14, 11, 0, 0, 7); ctx.ellipse(82, 28, 14, 11, 0, 0, 7); ctx.stroke();
      break;
    case 'cap':
      ctx.fillStyle = trim; ctx.fillRect(0, 0, 128, 32);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 128; i += 10) ctx.fillRect(i, 22, 4, 10);
      break;
    case 'curls':
      ctx.fillStyle = hair; ctx.fillRect(0, 0, 128, 18);
      for (let i = 0; i < 9; i++) ell(i * 16, 22, 10, 10, hair);
      break;
    case 'sunhat':
      ctx.fillStyle = trim; ctx.fillRect(0, 0, 128, 26);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 22, 128, 5);
      break;
    case 'crop':
      ctx.fillStyle = hair; ctx.fillRect(0, 0, 128, 22);
      ctx.fillStyle = '#FFB000'; ctx.fillRect(0, 20, 128, 9);
      break;
  }
  // Blush
  ctx.globalAlpha = 0.15; ell(32, 80, 12, 9, '#E0405A'); ell(96, 80, 12, 9, '#E0405A'); ctx.globalAlpha = 1;
  // Eyes: white ellipses 22 × 26 px at 40 % and 60 % across, 45 % down, pupils looking slightly forward.
  const ex = [51, 77], ey = 57;
  for (const cx of ex) { ell(cx, ey, 11, 13, '#FFFFFF'); ell(cx, ey + 3, 5.5, 7, '#2A2622'); ell(cx + 2, ey, 1.8, 2.2, '#FFFFFF'); }
  // Brows and mouth by expression
  ctx.strokeStyle = '#3A2A20'; ctx.lineCap = 'round'; ctx.lineWidth = 4;
  const brow = (tilt) => { ctx.beginPath(); ctx.moveTo(42, 40 + tilt); ctx.lineTo(60, 40 - tilt); ctx.moveTo(68, 40 - tilt); ctx.lineTo(86, 40 + tilt); ctx.stroke(); };
  const e = f.expression;
  brow(e === 'smirk' ? -3 : e === 'focused' ? 3 : e === 'whee' ? -4 : e === 'flat' ? 0 : -1.5);
  ctx.lineWidth = 4; ctx.strokeStyle = '#6A2A2A'; ctx.fillStyle = '#7A2A30';
  ctx.beginPath();
  switch (e) {
    case 'grin': ctx.moveTo(40, 84); ctx.quadraticCurveTo(64, 112, 88, 84); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#FFF'; ctx.fillRect(46, 85, 36, 6); break;
    case 'calm': ctx.moveTo(52, 88); ctx.quadraticCurveTo(64, 96, 76, 88); ctx.stroke(); break;
    case 'flat': ctx.moveTo(52, 90); ctx.lineTo(76, 90); ctx.stroke();
      if (f.style === 'bald') { ctx.fillStyle = f.hair; ctx.beginPath(); ctx.ellipse(56, 80, 12, 5, 0.2, 0, 7); ctx.ellipse(72, 80, 12, 5, -0.2, 0, 7); ctx.fill(); }
      break;
    case 'whee': ctx.ellipse(64, 90, 8, 10, 0, 0, Math.PI * 2); ctx.fill(); break;
    case 'smile': ctx.moveTo(48, 86); ctx.quadraticCurveTo(64, 100, 80, 86); ctx.stroke(); break;
    case 'smirk': ctx.moveTo(50, 90); ctx.quadraticCurveTo(66, 94, 80, 83); ctx.stroke(); break;
    case 'bigsmile': ctx.moveTo(42, 84); ctx.quadraticCurveTo(64, 108, 86, 84); ctx.closePath(); ctx.fill(); break;
    case 'focused': ctx.moveTo(54, 89); ctx.quadraticCurveTo(64, 94, 74, 89); ctx.stroke(); break;
    default: ctx.moveTo(50, 88); ctx.quadraticCurveTo(64, 98, 78, 88); ctx.stroke();
  }
  ctx.restore();
}

/** The 512 × 256 face atlas: eight 128 px tiles, top row then bottom row. */
export function buildAtlas(racers) {
  return canvasTexture(ATLAS_W, ATLAS_H, (ctx) => {
    racers.forEach((r, i) => paintFace(ctx, (i % 4) * TILE, Math.floor(i / 4) * TILE, TILE, r));
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 8, 8);
  });
}

// ---------------------------------------------------------------------------------------------
// Kart body

function tileUV(i, tx, ty) {
  const col = i % 4, row = Math.floor(i / 4);
  return [(col * TILE + tx * TILE) / ATLAS_W, 1 - (row * TILE + ty * TILE) / ATLAS_H];
}

/** The merged geometry of one kart (local frame: +z forward, origin on the ground under its center). */
export function kartGeometry(racer, atlasIndex) {
  const body = racer.body, trim = racer.trim, hair = racer.face.hair;
  const W = WHITE_UV;
  const parts = [
    { geo: new BoxGeometry(1.40, 0.12, 2.10), pos: [0, 0.28, 0], color: '#2B2D33', uv: W },
    { geo: new BoxGeometry(1.30, 0.32, 1.50), pos: [0, 0.50, -0.10], color: body, uv: W },
    { geo: new BoxGeometry(1.00, 0.24, 0.60), pos: [0, 0.44, 0.95], color: body, uv: W },
    { geo: new BoxGeometry(0.90, 0.08, 0.50), pos: [0, 0.58, 0.88], rot: [-0.25, 0, 0], color: body, uv: W },
    { geo: new CylinderGeometry(0.09, 0.09, 1.36, 8), pos: [0, 0.30, 1.22], rot: [0, 0, Math.PI / 2], color: trim, uv: W },
    { geo: new BoxGeometry(0.80, 0.55, 0.12), pos: [0, 0.85, -0.55], color: trim, uv: W },
    { geo: new BoxGeometry(0.80, 0.40, 0.45), pos: [0, 0.55, -1.05], color: '#5C6068', uv: W },
    { geo: new CylinderGeometry(0.07, 0.07, 0.35, 8), pos: [0.25, 0.62, -1.35], rot: [Math.PI / 2, 0, 0], color: '#9EA3AB', uv: W },
    { geo: new CylinderGeometry(0.07, 0.07, 0.35, 8), pos: [-0.25, 0.62, -1.35], rot: [Math.PI / 2, 0, 0], color: '#9EA3AB', uv: W },
    { geo: new CylinderGeometry(0.03, 0.03, 0.5, 6), pos: [0, 0.78, 0.42], rot: [-0.5, 0, 0], color: '#1E1F24', uv: W },
    { geo: new CylinderGeometry(0.18, 0.18, 0.04, 12), pos: [0, 0.96, 0.24], rot: [Math.PI / 2 - 0.52, 0, 0], color: '#1E1F24', uv: W },
    { geo: new CylinderGeometry(0.30, 0.34, 0.55, 10), pos: [0, 0.95, -0.25], color: body, uv: W },
  ];
  // Head: sphere r 0.30, its UVs remapped so the face covers the front half of the wrap (u ∈ [0, 0.5]
  // of three's sphere, which is centered on +z) and the back and crown sample hair or skin.
  parts.push({
    geo: new SphereGeometry(0.30, 16, 12), pos: [0, 1.45, -0.20], color: '#FFFFFF',
    uv: (u, v) => {
      const down = 1 - v;                                     // 0 at the crown, 1 at the chin
      if (u <= 0.5) return tileUV(atlasIndex, Math.min(0.98, Math.max(0.02, u * 2)), Math.min(0.98, Math.max(0.03, (down - 0.1) / 0.72)));
      return down < 0.5 ? tileUV(atlasIndex, 0.5, 0.06) : tileUV(atlasIndex, 0.04, 0.96);
    },
  });
  const style = racer.face.style;
  const cap = (color, theta, back = 0.35) => ({ geo: new SphereGeometry(0.315, 14, 6, 0, Math.PI * 2, 0, theta), pos: [0, 1.45, -0.20], rot: [-back, 0, 0], color, uv: W });
  switch (style) {
    case 'fringe': parts.push(cap(hair, 1.0)); break;
    case 'bun': parts.push(cap(hair, 0.9), { geo: new SphereGeometry(0.13, 8, 6), pos: [0, 1.80, -0.30], color: hair, uv: W }); break;
    case 'bald':
      parts.push({ geo: new SphereGeometry(0.09, 6, 5), pos: [0.29, 1.43, -0.25], color: hair, uv: W },
        { geo: new SphereGeometry(0.09, 6, 5), pos: [-0.29, 1.43, -0.25], color: hair, uv: W }); break;
    case 'goggles': parts.push(cap(hair, 0.85, 0.5), { geo: new CylinderGeometry(0.318, 0.318, 0.07, 14, 1, true), pos: [0, 1.63, -0.22], rot: [0.3, 0, 0], color: '#3A3A40', uv: W }); break;
    case 'cap': parts.push(cap(trim, 1.1, 0.25), { geo: new SphereGeometry(0.08, 6, 5), pos: [0, 1.78, -0.26], color: trim, uv: W }); break;
    case 'curls':
      parts.push(cap(hair, 0.9));
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; parts.push({ geo: new SphereGeometry(0.1, 6, 4), pos: [Math.cos(a) * 0.22, 1.66, -0.2 + Math.sin(a) * 0.22 - 0.05], color: hair, uv: W }); }
      break;
    case 'sunhat':
      parts.push({ geo: new CylinderGeometry(0.52, 0.52, 0.03, 16), pos: [0, 1.66, -0.20], color: trim, uv: W },
        { geo: new CylinderGeometry(0.24, 0.29, 0.2, 12), pos: [0, 1.76, -0.20], color: trim, uv: W }); break;
    case 'crop':
      parts.push(cap(hair, 0.8, 0.45), { geo: new BoxGeometry(0.42, 0.03, 0.22), pos: [0, 1.62, 0.08], rot: [-0.15, 0, 0], color: '#FFB000', uv: W }); break;
  }
  const g = mergeParts(parts);
  for (const p of parts) p.geo.dispose();
  return g;
}

// ---------------------------------------------------------------------------------------------
// The field: eight kart meshes, one wheel InstancedMesh, and (Low) blob shadows.

const WHEELS = [ // [x, y, z, radius, width, front]
  [0.72, 0.30, 0.78, 0.30, 0.28, true], [-0.72, 0.30, 0.78, 0.30, 0.28, true],
  [0.74, 0.36, -0.78, 0.36, 0.40, false], [-0.74, 0.36, -0.78, 0.36, 0.40, false],
];

export class Field {
  constructor(racers) {
    this.racers = racers;
    this.atlas = buildAtlas(racers);
    this.group = new Group();
    // One material per kart, all eight identical (one shader program), so a rival between the camera
    // and the player can fade out on its own. alphaHash dithers instead of blending: no sorting, and
    // at opacity 1 it discards nothing.
    this.karts = racers.map((r, i) => {
      const material = new MeshLambertMaterial({ map: this.atlas, vertexColors: true, alphaHash: true });
      const outer = new Group(), body = new Mesh(kartGeometry(r, i), material);
      body.castShadow = true;
      outer.add(body); this.group.add(outer);
      return { racer: r, outer, body, material, up: new Vector3(0, 1, 0), slip: 0, spin: [0, 0, 0, 0], lean: 0 };
    });
    this.byId = new Map(this.karts.map((k) => [k.racer.id, k]));
    // Wheels: a 14-sided cylinder along x, unit radius and width, rubber with hub-colored caps.
    const wg = new CylinderGeometry(1, 1, 1, 14).rotateZ(Math.PI / 2);
    const rubber = new Color('#1C1C1E'), hub = new Color('#C9CCD1'), cols = [];
    const n = wg.attributes.normal;
    for (let i = 0; i < n.count; i++) { const c = Math.abs(n.getX(i)) > 0.9 ? hub : rubber; cols.push(c.r, c.g, c.b); }
    wg.setAttribute('color', new (wg.attributes.position.constructor)(new Float32Array(cols), 3));
    this.wheels = new InstancedMesh(wg, new MeshLambertMaterial({ vertexColors: true }), racers.length * 4);
    this.wheels.instanceMatrix.setUsage(DynamicDrawUsage);
    this.wheels.castShadow = true;
    this.wheels.frustumCulled = false;
    this.group.add(this.wheels);
    // Blob shadows (Low quality): one instanced quad per kart.
    const blobTex = canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    });
    this.blobs = new InstancedMesh(new PlaneGeometry(1.9, 2.6).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }), racers.length);
    this.blobs.frustumCulled = false;
    this.blobs.renderOrder = 1;
    this.group.add(this.blobs);
    this.wheelSpin = new Float32Array(racers.length * 4);
    this._m = new Matrix4(); this._m2 = new Matrix4(); this._q = new Quaternion(); this._e = new Euler(0, 0, 0, 'YXZ');
    this._v = new Vector3(); this._s = new Vector3(); this._x = new Vector3(); this._f = new Vector3(); this._n = new Vector3();
    this._d = new Vector3();
    this._used = new Set();
  }

  setQuality(q) { this.blobs.visible = q === 'low'; }

  /**
   * Place every kart from the simulation state. `karts` are race karts (physics state + racer),
   * `track` gives the road normal. Visual-only motion here never feeds back into physics.
   *
   * `view` (racing only) = { camera, player, countdown, still }. A rival that comes between the camera and
   * the player fades out by its depth in front of the camera — gone at 1.5 m, whole again at 4 m
   * (the player sits about 5 m in front of the chase camera) — instead of filling the lower screen
   * and then vanishing. During the countdown every rival behind the player on the grid is hidden,
   * so the swoop down from 12 m frames the player's kart, not the one behind it.
   */
  update(karts, track, dt, time, view = null) {
    const used = this._used; used.clear();
    let cx = 0, cy = 0, cz = 0, dx = 0, dy = 0, dz = 0;
    if (view) {
      const c = view.camera, d = c.getWorldDirection(this._d);
      cx = c.position.x; cy = c.position.y; cz = c.position.z; dx = d.x; dy = d.y; dz = d.z;
    }
    karts.forEach((k, slot) => {
      const vk = this.byId.get(k.racer.id); used.add(vk);
      let op = 1;
      if (view && !k.isPlayer) {
        if (view.countdown && k.dist < view.player.dist - 1) op = 0;
        else {
          const depth = (k.x - cx) * dx + (k.y + 0.8 - cy) * dy + (k.z - cz) * dz;
          const t = Math.min(1, Math.max(0, (depth - 1.5) / 2.5));
          op = t * t * (3 - 2 * t);
        }
      }
      const near = op < 0.5;              // wheels, blob and shadow go at the half-way mark
      k.nearCam = op < 0.95;              // the Quilt bubble (bigger than the kart) goes first
      if (view && view.still && k.immuneT > 0) op = Math.min(op, 0.5);   // Reduce Motion: a steady half form, no blink
      vk.outer.visible = op > 0.02;
      if (vk.material.opacity !== op) vk.material.opacity = op;
      vk.body.castShadow = !near;
      const i = k.fr.idx;
      // Up: the road normal, smoothed.
      const n = this._n.set(track.nx[i], track.ny[i], track.nz[i]);
      vk.up.lerp(n, 1 - Math.exp(-12 * dt)).normalize();
      const f = this._f.set(Math.cos(k.psi), 0, Math.sin(k.psi));
      f.addScaledVector(vk.up, -f.dot(vk.up)).normalize();
      const x = this._x.crossVectors(vk.up, f).normalize();
      this._m.makeBasis(x, vk.up, f);
      // Tumble hop and blink
      let hop = 0, roll = 0, spinYaw = 0;
      if (k.stun === 'spin') spinYaw = 4 * Math.PI * (1 - k.stunT / 1.0);
      if (k.stun === 'tumble') { const p = 1 - k.stunT / 1.3; roll = 2 * Math.PI * p; hop = Math.sin(Math.PI * p) * 1.0; }
      vk.outer.position.set(k.x, k.y + hop, k.z);
      vk.outer.quaternion.setFromRotationMatrix(this._m);
      // Drift slip toward the inside, body lean into turns.
      const slipTarget = k.drift ? k.driftDir * (0.32 + 0.14 * k.steer * k.driftDir) : 0;
      vk.slip += (slipTarget - vk.slip) * (1 - Math.exp(-10 * dt));
      const leanTarget = -0.10 * k.steer * Math.min(1, Math.abs(k.v) / 20);
      vk.lean += (leanTarget - vk.lean) * (1 - Math.exp(-8 * dt));
      // Local +x is the kart's left, so a right turn (ψ increasing) is a negative rotation about local y.
      this._e.set(0, -(vk.slip + spinYaw), -vk.lean + roll);
      vk.body.rotation.copy(this._e);
      vk.body.scale.set(1, k.landT > 0 ? 0.92 : 1, 1);
      vk.body.visible = !(k.immuneT > 0 && !(view && view.still) && Math.floor(time * 6) % 2 === 0) && !(k.respawnT > 0);   // 3 Hz
      // Blinking after a hit, fading on a respawn, or faded out at the camera: the wheels and the
      // blob go with the body (they are instances, so they are collapsed rather than hidden).
      const hidden = near || !vk.body.visible || !vk.outer.visible;
      vk.outer.updateMatrix(); vk.body.updateMatrix();
      this._m2.multiplyMatrices(vk.outer.matrix, vk.body.matrix);
      // Wheels
      for (let w = 0; w < 4; w++) {
        const [wx, wy, wz, r, wd, front] = WHEELS[w], wi = slot * 4 + w;
        this.wheelSpin[wi] += (k.v * dt) / r;
        const steerA = front ? -k.steer * 0.45 : 0;
        this._e.set(this.wheelSpin[wi], steerA, 0, 'YXZ');
        this._q.setFromEuler(this._e);
        this._m.compose(this._v.set(wx, wy, wz), this._q, this._s.set(wd, r, r));
        this._m.premultiply(this._m2);
        if (hidden) this._m.makeScale(0, 0, 0);
        this.wheels.setMatrixAt(wi, this._m);
      }
      this._e.order = 'YXZ';
      if (this.blobs.visible) {
        this._m.copy(vk.outer.matrix); this._m.setPosition(k.x, k.y + 0.04, k.z);
        if (hidden) this._m.makeScale(0, 0, 0);
        this.blobs.setMatrixAt(slot, this._m);
      }
    });
    for (const vk of this.karts) if (!used.has(vk)) vk.outer.visible = false;
    this.wheels.count = karts.length * 4;
    this.blobs.count = karts.length;
    this.wheels.instanceMatrix.needsUpdate = true;
    this.blobs.instanceMatrix.needsUpdate = true;
  }
}
