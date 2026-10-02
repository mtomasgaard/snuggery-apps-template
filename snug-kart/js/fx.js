// Effects (DESIGN.md §8.1, §15): one particle pool — drift sparks in the charge color (gold at
// tier 1, mint at tier 2), boost puffs from the exhausts and sparks off the walls — drawn as a single
// Points mesh (one draw call), at most 400 particles on High and 150 on Low. The Kettle's steam and
// a Quilt's pop use the same pool; the item models themselves are in js/items-view.js.

import { BufferGeometry, BufferAttribute, Points, PointsMaterial, Color, AdditiveBlending, DynamicDrawUsage } from '../vendor/three.module.js';
import { canvasTexture } from './geo.js';

const TIER = [new Color('#E8E2D6'), new Color('#FFC857'), new Color('#6EF0C2')];
const PUFF = new Color('#FFB060'), WALL = new Color('#FFE9A8'), STEAM = new Color('#DDEBF2'), POP = new Color('#FFC4D2');

export class Sparks {
  constructor(max = 400) {
    this.cap = 400; this.max = max; this.n = 0;
    this.pos = new Float32Array(this.cap * 3); this.col = new Float32Array(this.cap * 3);
    this.vel = new Float32Array(this.cap * 3); this.life = new Float32Array(this.cap); this.age = new Float32Array(this.cap);
    this.base = new Float32Array(this.cap * 3);
    const g = new BufferGeometry();
    this.aPos = new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage);
    this.aCol = new BufferAttribute(this.col, 3).setUsage(DynamicDrawUsage);
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol);
    g.setDrawRange(0, 0);
    const dot = canvasTexture(32, 32, (ctx) => {
      const gr = ctx.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, 32, 32);
    });
    this.points = new Points(g, new PointsMaterial({ size: 0.32, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true }));
    this.points.frustumCulled = false; this.points.renderOrder = 3;
    this.acc = new Map();
  }

  setQuality(q) { this.max = q === 'high' ? 400 : 150; if (this.n > this.max) this.n = this.max; }
  clear() { this.n = 0; this.acc.clear(); this.points.geometry.setDrawRange(0, 0); }

  emit(x, y, z, vx, vy, vz, color, life) {
    if (this.n >= this.max) return;
    const i = this.n++, k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.vel[k] = vx; this.vel[k + 1] = vy; this.vel[k + 2] = vz;
    this.base[k] = color.r; this.base[k + 1] = color.g; this.base[k + 2] = color.b;
    this.life[i] = life; this.age[i] = 0;
  }

  /** Emit for every kart from its state, then move and fade everything. */
  update(karts, dt, cam) {
    for (const k of karts) {
      if (k.respawnT > 0) continue;
      const dx = k.x - cam.position.x, dz = k.z - cam.position.z;
      if (dx * dx + dz * dz > 70 * 70) continue;
      const c = Math.cos(k.psi), s = Math.sin(k.psi);
      // Local +x (the kart's left) is (sin ψ, −cos ψ); forward is (cos ψ, sin ψ).
      const wheel = (side, back) => [k.x + side * s - back * c, k.z - side * c - back * s];
      let a = this.acc.get(k) || 0;
      if (k.drift && Math.abs(k.v) > 8) {
        a += dt * (k.driftTier ? 60 : 30);
        const col = TIER[k.driftTier];
        while (a >= 1) {
          a -= 1;
          for (const side of [0.74, -0.74]) {
            const [px, pz] = wheel(side, 0.95);
            const out = -k.driftDir * side > 0 ? 1.5 : 0.6;
            this.emit(px, k.y + 0.08, pz, -c * 2 + side * s * out + (Math.random() - 0.5), 1.5 + Math.random() * 2, -s * 2 - side * c * out + (Math.random() - 0.5), col, 0.25 + Math.random() * 0.2);
          }
        }
      } else if (k.boostT > 0 && k.boostKind === 'kettle') {
        // The Kettle: a jet of steam from the back, rising and spreading.
        a += dt * 70;
        while (a >= 1) { a -= 1; const [px, pz] = wheel((Math.random() - 0.5) * 0.4, 1.5); this.emit(px, k.y + 0.75, pz, -c * 6 + (Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 1.5, -s * 6 + (Math.random() - 0.5) * 1.5, STEAM, 0.45); }
      } else if (k.boostT > 0) {
        a += dt * 40;
        while (a >= 1) { a -= 1; for (const side of [0.25, -0.25]) { const [px, pz] = wheel(side, 1.45); this.emit(px, k.y + 0.62, pz, -c * 4 + (Math.random() - 0.5), 0.6 + Math.random(), -s * 4 + (Math.random() - 0.5), PUFF, 0.3); } }
      } else a = 0;
      this.acc.set(k, a);
    }
    // Integrate, fade, and pack the living to the front.
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) continue;
      const k = i * 3, o = w * 3;
      this.vel[k + 1] -= 9.8 * dt;
      this.pos[o] = this.pos[k] + this.vel[k] * dt; this.pos[o + 1] = this.pos[k + 1] + this.vel[k + 1] * dt; this.pos[o + 2] = this.pos[k + 2] + this.vel[k + 2] * dt;
      this.vel[o] = this.vel[k]; this.vel[o + 1] = this.vel[k + 1]; this.vel[o + 2] = this.vel[k + 2];
      this.base[o] = this.base[k]; this.base[o + 1] = this.base[k + 1]; this.base[o + 2] = this.base[k + 2];
      this.life[w] = this.life[i]; this.age[w] = this.age[i];
      const f = 1 - this.age[w] / this.life[w];
      this.col[o] = this.base[o] * f; this.col[o + 1] = this.base[o + 1] * f; this.col[o + 2] = this.base[o + 2] * f;
      w++;
    }
    this.n = w;
    this.points.geometry.setDrawRange(0, w);
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true;
  }

  /** A Quilt popping: pink flecks outward from the kart. */
  pop(k) {
    for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 3; this.emit(k.x, k.y + 0.9, k.z, Math.cos(a) * r, 1 + Math.random() * 4, Math.sin(a) * r, POP, 0.5); }
  }

  /** A burst off a wall (from the race's 'wall' event). */
  burst(k, speed) {
    const n = Math.min(16, 4 + Math.round(speed * 1.5)), side = Math.sign(k.fr.l) || 1;
    const rx = -Math.sin(k.psi) * side, rz = Math.cos(k.psi) * side;
    for (let i = 0; i < n; i++) this.emit(k.x + rx * 0.7, k.y + 0.4, k.z + rz * 0.7, -rx * 3 + (Math.random() - 0.5) * 4, 2 + Math.random() * 3, -rz * 3 + (Math.random() - 0.5) * 4, WALL, 0.35);
  }
}
