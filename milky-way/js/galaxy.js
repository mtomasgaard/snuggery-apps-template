// The galaxy scale, in kiloparsecs, in astropy's Galactocentric frame (v4.0: the Galactic centre at
// the origin, the Sun at x = −8.122 kpc, z = +20.8 pc). `root.matrix` is the `to_icrs` matrix from
// galaxy.json, so everything here lands in the same ICRS heliocentric space as the stars.
//
// There is no photograph of our galaxy from outside, and nothing here pretends to be one. What is
// drawn is what has been measured, and each layer says what it is:
//   - globular clusters and satellite galaxies at their measured distances (Local Volume Database);
//   - stellar streams, the tracks fitted to their member stars (galstreams);
//   - where young stars crowd, measured by Gaia within about 4 kpc of the Sun (Poggio+2021,
//     Gaia DR3 / Drimmel+2023);
//   - spiral-arm *fits*: Reid+2019 to maser parallaxes, Drimmel+2024 to Cepheids — two models that
//     disagree by about 0.9 kpc near the Sun, drawn in different colours;
//   - a faint glow of the disc and bar *mass models* (McMillan 2017; Portail+2017 / Sormani+2022),
//     so the disc has a shape to hang the measurements on.

import * as THREE from '../vendor/three.module.js';
import { glowPointsMaterial, planeMaterial, ribbonMaterial, thickLineMaterial, ThickLine } from './gfx.js';
import { KPC_AU } from './util.js';
import { buildGalaxyData } from './galaxydata.js';

const REID_COLOUR = '#f1b36b';
const DRIMMEL_COLOUR = '#b58cff';

export class Galaxy {
  constructor({ g, tex }) {
    this.g = g;
    this.data = buildGalaxyData(g);           // the frame and the flags, as tools/test_galaxy.mjs checks them
    this.root = new THREE.Group();
    this.root.name = 'galaxy';
    this.root.matrixAutoUpdate = false;
    this.root.matrix.set(...this.data.toIcrsMatrix);
    this.sun = g.frame.sun_kpc;

    const layer = (name) => { const o = new THREE.Group(); o.name = name; this.root.add(o); return o; };
    this.L = {
      model: layer('model'), young: layer('young'), reid: layer('reid'), drimmel: layer('drimmel'),
      grid: layer('grid'), streams: layer('streams'), globulars: layer('globulars'), satellites: layer('satellites'), marks: layer('marks'),
    };

    // ---- disc and bar model glow: a few stacked planes give it a little thickness edge-on
    if (g.model && tex.model) {
      const e = g.model.extent_kpc;               // [xmin, xmax, ymin, ymax]
      const w = e[1] - e[0], h = e[3] - e[2];
      const hz = (g.model.scale_heights_kpc && (g.model.scale_heights_kpc.thin || g.model.scale_heights_kpc.thin_disc)) || 0.3;
      const levels = [[0, 0.5], [0.45, 0.22], [-0.45, 0.22], [1.0, 0.08], [-1.0, 0.08]];
      for (const [k, a] of levels) {
        const mat = planeMaterial(tex.model, { tint: [1.0, 0.86, 0.66], opacity: a });
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        p.position.set((e[0] + e[1]) / 2, (e[2] + e[3]) / 2, k * hz);
        p.frustumCulled = false; p.renderOrder = 0; p.userData.base = a;
        this.L.model.add(p);
      }
    }
    // ---- Gaia young-star overdensity maps
    if (g.young && tex.young) {
      for (const [key, t] of Object.entries(tex.young)) {
        const meta = g.young.files[key];
        const e = meta.extent_kpc || g.young.extent_kpc;
        const enc = meta.encoding;           // overdensity = lo + code/255·(hi − lo); light only above 0
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
        const mat = planeMaterial(t, { tint: [0.32, 0.58, 1.0], opacity: 0.8, alphaFromMap: true, zero: -enc.lo / (enc.hi - enc.lo), gamma: 1.4 });
        const p = new THREE.Mesh(new THREE.PlaneGeometry(e[1] - e[0], e[3] - e[2]), mat);
        p.position.set((e[0] + e[1]) / 2, (e[2] + e[3]) / 2, meta.z_kpc || 0);
        p.frustumCulled = false; p.renderOrder = 1; p.userData.key = key;
        this.L.young.add(p);
      }
      // Two maps, two layers. On by default: Poggio+2021's upper-main-sequence map, the smoother one.
      // The Gaia DR3 OB map reaches as far but is streaked along lines of sight by distance errors.
    }

    // ---- spiral-arm fits
    // The Reid fits' band: SpiralMap draws its edges at (R_kink ± width/2)·exp(…), so at radius R the
    // band is width·R/R_kink across. Drawn with a soft falloff to its edges.
    const ribbon = (pts, widthKpc, rKink, colour, opacity) => {
      const n = pts.length;
      const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
      let len = 0; const cum = [0];
      for (let i = 1; i < n; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); cum.push(len); }
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const half = 0.5 * widthKpc * Math.hypot(pts[i][0], pts[i][1]) / rKink;
        const nx = -ty * half, ny = tx * half;
        pos.set([pts[i][0] + nx, pts[i][1] + ny, pts[i][2]], i * 6);
        pos.set([pts[i][0] - nx, pts[i][1] - ny, pts[i][2]], i * 6 + 3);
        uv.set([cum[i] / (len || 1), 1, cum[i] / (len || 1), 0], i * 4);
        if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, ribbonMaterial(colour, opacity));
      mesh.frustumCulled = false; mesh.renderOrder = 2;
      return mesh;
    };
    const centreline = (pts, colour, alpha, dashed, width = 1.6) => {
      const c = new THREE.Color(colour);
      const l = ThickLine.from(pts, (i) => [c.r, c.g, c.b, dashed ? (i % 6 < 3 ? alpha : 0) : alpha],
        thickLineMaterial({ width, depthTest: false })).mesh;
      l.renderOrder = 3;
      return l;
    };
    this.armLabels = [];
    for (const a of g.arms_reid2019 || []) {
      this.L.reid.add(ribbon(a.points, a.width_kpc, a.r_kink_kpc, REID_COLOUR, 0.34));
      this.L.reid.add(centreline(a.points, REID_COLOUR, 0.7, false));
      this.armLabels.push({ layer: 'reid', name: a.name, p: a.points[Math.floor(a.points.length * 0.55)], colour: REID_COLOUR, src: a });
    }
    for (const a of g.arms_drimmel2024 || []) {
      this.L.drimmel.add(centreline(a.points, DRIMMEL_COLOUR, 0.75, true));
      this.armLabels.push({ layer: 'drimmel', name: a.name, p: a.points[Math.floor(a.points.length * 0.5)], colour: DRIMMEL_COLOUR, src: a });
    }

    // ---- a reference grid: rings every 5 kpc around the centre (an aid, not data)
    const ringMat = thickLineMaterial({ width: 1, depthTest: false });
    for (let r = 5; r <= 25; r += 5) {
      const N = 256, p = new Float32Array((N + 1) * 3);
      for (let i = 0; i <= N; i++) { const t = (i / N) * 2 * Math.PI; p.set([r * Math.cos(t), r * Math.sin(t), 0], i * 3); }
      const l = ThickLine.from(p, [0.55, 0.62, 0.72, 0.18], ringMat).mesh; l.renderOrder = 1;
      this.L.grid.add(l);
    }

    // ---- stellar streams
    this.streams = g.streams || [];
    this.streams.forEach((s, i) => {
      const approx = this.data.streamApproximate(i);   // not a measured distance track, or a constructed great circle
      // Faint: a hundred of them cross the whole view, and they are the least certain thing here.
      const l = centreline(s.points, '#7fe0ff', approx ? 0.07 : 0.16, approx, 1.1);
      this.L.streams.add(l);
    });

    // ---- globular clusters and satellite galaxies
    const points = (list, colour, sizeOf, layerGroup) => {
      const n = list.length, p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n);
      const cc = new THREE.Color(colour);
      list.forEach((o, i) => { p.set(o.xyz, i * 3); c.set([cc.r, cc.g, cc.b], i * 3); s[i] = sizeOf(o); });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
      geo.setAttribute('acolor', new THREE.BufferAttribute(c, 3));
      geo.setAttribute('asize', new THREE.BufferAttribute(s, 1));
      const mat = glowPointsMaterial({ opacity: 1, sharp: 0.2 }); mat.depthTest = false;
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false; pts.renderOrder = 4;
      layerGroup.add(pts);
      return pts;
    };
    const magSize = (lo, hi) => (o) => Number.isFinite(o.mv) ? Math.max(lo, Math.min(hi, lo + (-(o.mv) - 4) * 0.55)) : lo;
    this.globulars = g.globulars || [];
    this.satellites = g.satellites || [];
    this.gcPts = points(this.globulars, '#ffd27a', magSize(2.4, 6.5), this.L.globulars);
    this.satPts = points(this.satellites, '#ff8fa3', magSize(3.0, 12), this.L.satellites);

    // ---- the Sun and the centre
    const marks = [{ xyz: this.sun, c: '#ffe2a8', s: 7 }, { xyz: [0, 0, 0], c: '#ffffff', s: 6 }];
    this.markPts = points(marks.map((m) => ({ xyz: m.xyz, mv: NaN })), '#ffe2a8', () => 7, this.L.marks);
    const mc = this.markPts.geometry.attributes.acolor.array;
    marks.forEach((m, i) => { const c = new THREE.Color(m.c); mc.set([c.r, c.g, c.b], i * 3); });
  }

  // Galactocentric kpc → ICRS heliocentric AU (float64), for labels and picking.
  toAU(p, out = [0, 0, 0]) {
    const q = this.data.toIcrs(p, this._q || (this._q = new Float64Array(3)));
    out[0] = q[0] * KPC_AU; out[1] = q[1] * KPC_AU; out[2] = q[2] * KPC_AU;
    return out;
  }

  // `dSunKpc` = the camera's distance from the Sun in kpc; `extentKpc` = how much the view spans.
  update(dSunKpc, pxRatio, layers) {
    // Everything here fades in once the camera is far enough out for the galaxy to be the subject.
    const a = Math.min(1, Math.max(0, (Math.log10(Math.max(dSunKpc, 1e-9)) + 0.7) / 0.9));   // 0.2 kpc → 1.6 kpc
    const b = Math.min(1, Math.max(0, (Math.log10(Math.max(dSunKpc, 1e-9)) + 1.3) / 0.8));   // halo objects a bit earlier
    this.fade = a;
    const set = (grp, on, alpha) => {
      grp.visible = on && alpha > 0.01;
      grp.traverse((o) => {
        const u = o.material && o.material.uniforms;
        if (u && u.uOpacity) { if (o.userData.base == null) o.userData.base = u.uOpacity.value; u.uOpacity.value = o.userData.base * alpha; }
        else if (o.material && o.material.isLineBasicMaterial) { o.material.opacity = alpha; }
        if (u && u.uPx) u.uPx.value = pxRatio;
      });
    };
    set(this.L.model, layers.model, a);
    set(this.L.young, layers.young || layers.youngOB, a);
    for (const p of this.L.young.children) p.visible = p.userData.key === 'gaiadr3_ob' ? !!layers.youngOB : !!layers.young;
    set(this.L.reid, layers.reid, a);
    set(this.L.drimmel, layers.drimmel, a);
    set(this.L.grid, layers.grid, a);
    set(this.L.streams, layers.streams, b);
    set(this.L.globulars, layers.globulars, b);
    set(this.L.satellites, layers.satellites, b);
    set(this.L.marks, true, a);
  }
}
