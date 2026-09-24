// The neighbourhood scale: stars in 3D around the Sun, in parsecs on ICRS axes, the Sun at the
// origin — plus the Gaia DR3 sky as a backdrop for everything seen from near the Sun.
//
// Three star sets, all drawn by the magnitude shader in gfx.js, so a star's brightness is its real
// absolute magnitude seen from wherever the camera is:
//   deep.bin    ~209 000 stars within 500 pc with good parallaxes (AT-HYG / Gaia DR3), no names;
//   named.json  every naked-eye star, everything within 20 pc and exoplanet hosts within 100 pc,
//               with names and designations — these are the ones you can tap. They are placed at
//               their catalogue distances, a few of them out to ~3.5 kpc;
//   the constellation figures joining named stars, drawn in 3D: from the Sun they are the familiar
//   shapes, and a few light-years out they come apart, because the stars in them are not related.
// Named stars with no usable parallax (flag 16: x, y, z is a unit direction) cannot be placed in
// 3D. They and the figure lines that touch them (`lines_sky_only`) are drawn on the sky, at their
// V magnitudes, as directions seen from the Sun — only while the camera is near the Sun.
//
// deep.bin layout (tools/CONTRACT.md §7): 8 bytes per star — int16 x, y, z in pc × 64,
// uint8 absolute-magnitude code (M_V = code/10 − 8), uint8 index into colour.json.

import * as THREE from '../vendor/three.module.js';
import { starMaterial, skyMaterial, lineMaterial, glowPointsMaterial } from './gfx.js';
import { PC_AU } from './util.js';

export class Stars {
  constructor({ deepBuf, deepMeta, named, colour, constellations, exoplanets, skyTex, sky }) {
    this.root = new THREE.Group();
    this.root.name = 'stars';
    this.named = named;
    this.exo = exoplanets.hosts;            // row -> [[name, period_d, a_au, …], …] in exoplanets.fields order
    this.exoFields = exoplanets.fields;
    this.exoMethods = exoplanets.methods;
    this.skyMeta = sky;
    // colour.json: 256 sRGB triples (0–1) by effective temperature; the last entry is neutral white
    // for stars with no colour measurement.
    const lut = colour.srgb;
    const rgbAt = (i) => lut[Math.max(0, Math.min(lut.length - 1, i))];

    // ---- the Gaia sky, centred on the camera
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), skyMaterial(skyTex));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10;
    this.root.add(this.sky);

    // ---- deep catalogue
    const n = Math.floor(deepBuf.byteLength / 8);
    const i16 = new Int16Array(deepBuf, 0, n * 4), u8 = new Uint8Array(deepBuf, 0, n * 8);
    const pos = new Float32Array(n * 3), mag = new Float32Array(n), col = new Float32Array(n * 3);
    const scale = deepMeta.quantisation_pc;           // pc per int16 step (1/64)
    for (let k = 0; k < n; k++) {
      pos[k * 3] = i16[k * 4] * scale; pos[k * 3 + 1] = i16[k * 4 + 1] * scale; pos[k * 3 + 2] = i16[k * 4 + 2] * scale;
      mag[k] = u8[k * 8 + 6] / 10 - 8;
      col.set(rgbAt(u8[k * 8 + 7]), k * 3);
    }
    this.deepCount = n;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dg.setAttribute('absmag', new THREE.BufferAttribute(mag, 1));
    dg.setAttribute('acolor', new THREE.BufferAttribute(col, 3));
    this.deep = new THREE.Points(dg, starMaterial());
    this.deep.frustumCulled = false; this.deep.renderOrder = 1;
    this.root.add(this.deep);

    // ---- named stars
    const N = named.id.length;
    this.namedCount = N;
    const np = new Float32Array(N * 3), nm = new Float32Array(N), nc = new Float32Array(N * 3);
    this.namedAU = new Float64Array(N * 3);
    for (let k = 0; k < N; k++) {
      const placed = !(named.flags[k] & 16);
      np[k * 3] = placed ? named.x[k] : 0; np[k * 3 + 1] = placed ? named.y[k] : 0; np[k * 3 + 2] = placed ? named.z[k] : 0;
      this.namedAU[k * 3] = named.x[k] * PC_AU; this.namedAU[k * 3 + 1] = named.y[k] * PC_AU; this.namedAU[k * 3 + 2] = named.z[k] * PC_AU;
      // Rows with no measured magnitude (a few exoplanet hosts known only from the Open Exoplanet
      // Catalogue) are placed but not drawn as stars: a null would read as magnitude 0, a bright star.
      nm[k] = placed && named.absmag[k] != null ? named.absmag[k] : 99;
      nc.set(rgbAt(named.colour[k]), k * 3);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
    ng.setAttribute('absmag', new THREE.BufferAttribute(nm, 1));
    ng.setAttribute('acolor', new THREE.BufferAttribute(nc, 3));
    this.namedPts = new THREE.Points(ng, starMaterial());
    this.namedPts.frustumCulled = false; this.namedPts.renderOrder = 2;
    this.root.add(this.namedPts);
    // Stars actually drawn in 3D: the deep catalogue and the placed named rows with a magnitude.
    this.drawnCount = n + nm.reduce((s, m) => s + (m < 99 ? 1 : 0), 0);

    // ---- the sky from the Sun: named stars with no usable parallax, and the figure lines that
    // touch them, as directions. A group centred on the camera holds them SKY_R pc away, so the
    // magnitude shader sees them at their V magnitudes: absmag = V + 5 − 5·log10(SKY_R).
    const SKY_R = 10;
    this.skyIdx = [...Array(N).keys()].filter((k) => named.flags[k] & 16);
    this.skyRoot = new THREE.Group();
    this.root.add(this.skyRoot);
    const dirOf = (k) => { const x = named.x[k], y = named.y[k], z = named.z[k], l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    const sp = new Float32Array(this.skyIdx.length * 3), sm = new Float32Array(this.skyIdx.length), sc = new Float32Array(this.skyIdx.length * 3);
    this.skyIdx.forEach((k, i) => {
      const d = dirOf(k);
      sp.set([d[0] * SKY_R, d[1] * SKY_R, d[2] * SKY_R], i * 3);
      sm[i] = named.vmag[k] != null ? named.vmag[k] + 5 - 5 * Math.log10(SKY_R) : 99;
      sc.set(rgbAt(named.colour[k]), i * 3);
    });
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('absmag', new THREE.BufferAttribute(sm, 1));
    sg.setAttribute('acolor', new THREE.BufferAttribute(sc, 3));
    this.skyPts = new THREE.Points(sg, starMaterial());
    this.skyPts.frustumCulled = false; this.skyPts.renderOrder = 2;
    this.skyRoot.add(this.skyPts);
    this.skyFade = 0;

    // ---- constellation figures, in 3D (and the few that need a star with no parallax, on the sky)
    const segs = [], skySegs = [];
    this.constellations = [];
    for (const [abbr, c] of Object.entries(constellations)) {
      const members = new Set();
      for (const [i, j] of c.lines) {
        if ((named.flags[i] & 16) || (named.flags[j] & 16)) continue;
        segs.push(i, j); members.add(i); members.add(j);
      }
      for (const [i, j] of c.lines_sky_only || []) skySegs.push(i, j);
      this.constellations.push({ abbr, name: c.name, members: [...members] });
    }
    const slp = new Float32Array(skySegs.length * 3), slc = new Float32Array(skySegs.length * 4);
    skySegs.forEach((i, k) => { const d = dirOf(i); slp.set([d[0] * SKY_R, d[1] * SKY_R, d[2] * SKY_R], k * 3); slc.set([0.45, 0.62, 0.95, 0.5], k * 4); });
    const slg = new THREE.BufferGeometry();
    slg.setAttribute('position', new THREE.BufferAttribute(slp, 3));
    slg.setAttribute('color', new THREE.BufferAttribute(slc, 4));
    this.skyLines = new THREE.LineSegments(slg, lineMaterial({ opacity: 0.55, depthTest: false }));
    this.skyLines.frustumCulled = false; this.skyLines.renderOrder = 3;
    this.skyRoot.add(this.skyLines);
    const lp = new Float32Array(segs.length * 3), lc = new Float32Array(segs.length * 4);
    segs.forEach((i, k) => { lp.set([np[i * 3], np[i * 3 + 1], np[i * 3 + 2]], k * 3); lc.set([0.45, 0.62, 0.95, 0.5], k * 4); });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('color', new THREE.BufferAttribute(lc, 4));
    this.lines = new THREE.LineSegments(lg, lineMaterial({ opacity: 0.55, depthTest: false }));
    this.lines.frustumCulled = false; this.lines.renderOrder = 3;
    this.root.add(this.lines);

    // ---- exoplanet hosts: a small ring marker, drawn as a sharp glow point
    const hosts = Object.keys(this.exo).map(Number).filter((k) => !(named.flags[k] & 16));
    this.hostIdx = hosts;
    const hp = new Float32Array(hosts.length * 3), hc = new Float32Array(hosts.length * 3), hs = new Float32Array(hosts.length);
    hosts.forEach((k, i) => { hp.set([np[k * 3], np[k * 3 + 1], np[k * 3 + 2]], i * 3); hc.set([0.45, 0.95, 0.75], i * 3); hs[i] = 11; });
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    hg.setAttribute('acolor', new THREE.BufferAttribute(hc, 3));
    hg.setAttribute('asize', new THREE.BufferAttribute(hs, 1));
    const hm = glowPointsMaterial({ opacity: 0.32, ring: true });
    hm.depthTest = false;
    this.hosts = new THREE.Points(hg, hm);
    this.hosts.frustumCulled = false; this.hosts.renderOrder = 4;
    this.root.add(this.hosts);

    // Label order: brightest (as seen from the Sun) first, names before designations; the sky-only
    // stars are in it too, and rows with no magnitude come last.
    const v = (k) => (named.vmag[k] != null ? named.vmag[k] : 99);
    this.labelOrder = [...Array(N).keys()].filter((k) => named.name[k] || named.desig[k]).sort((a, b) => v(a) - v(b));
  }

  // `camPc` = camera position in pc (from the Sun); `dSunPc` its distance from the Sun.
  update(camPc, dSunPc, pxRatio, layers, extent) {
    // Deeper exposure the farther the camera is from the Sun, so the structure of the neighbourhood
    // stays readable from outside it. From the Sun the limit is the naked eye's 6.5. Past the
    // catalogue's 500 pc the limit stops rising and the stars fade from ~300 pc out: otherwise the
    // summed light of the whole catalogue sphere saturates into a white ball, which is its
    // selection cut, not a structure, and hides the galaxy's young-star map and arm fits.
    const far = Math.max(1, Math.min(dSunPc, 500) / 3);
    const mLim = 6.5 + 2.6 * Math.log10(far);
    const opacity = Math.min(1, Math.max(0, 1 - Math.log10(Math.max(dSunPc, 300) / 300)));
    for (const p of [this.deep, this.namedPts, this.skyPts]) {
      const u = p.material.uniforms;
      u.uPx.value = pxRatio; u.uMLim.value = mLim;
      u.uMaxSize.value = dSunPc > 2000 ? 5 : 20;
      u.uOpacity.value = opacity;
    }
    this.deep.visible = !!layers.stars && opacity > 0.01;
    this.namedPts.visible = this.deep.visible;
    // The sky-only stars and lines are directions from the Sun: right from among the planets, and
    // gone by the time the Sun's own offset would show (fully drawn inside ~0.001 pc, none by 0.1 pc).
    const inside = Math.min(1, Math.max(0, (Math.log10(Math.max(dSunPc, 1e-9)) + 3) / 2));   // 0.001 pc → 0.1 pc
    this.skyFade = 1 - inside;
    this.skyRoot.position.set(camPc[0], camPc[1], camPc[2]);
    this.skyPts.material.uniforms.uOpacity.value = this.skyFade;
    this.skyPts.visible = !!layers.stars && this.skyFade > 0.01;
    // The sky map is the view from the Sun's position. It stays right to within a few degrees for
    // a camera a few hundred parsecs out, and fades as the camera leaves.
    const skyA = layers.sky ? (1 - Math.min(1, Math.max(0, (Math.log10(Math.max(dSunPc, 1e-9)) - 2) / 1.1))) : 0;
    this.sky.visible = skyA > 0.01;
    this.sky.material.uniforms.uOpacity.value = 0.8 * skyA;
    this.sky.position.set(camPc[0], camPc[1], camPc[2]);
    // Constellation figures: faint from inside the Solar System, where they are the sky behind the
    // planets; clearer out among the stars, where their third dimension shows; gone far away.
    const la = layers.constellations ? (0.35 + 0.65 * inside) * Math.max(0, 1 - Math.log10(Math.max(1, dSunPc / 12)) / 0.7) : 0;
    this.lines.visible = la > 0.02;
    this.lines.material.opacity = 0.5 * la;
    this.skyLines.visible = la * this.skyFade > 0.02;
    this.skyLines.material.opacity = 0.5 * la * this.skyFade;
    // Exoplanet hosts are marked once the view is about the stars, not from among the planets.
    this.hosts.visible = !!layers.exoplanets && dSunPc > 0.3 && dSunPc < 40;
    this.hosts.material.uniforms.uPx.value = pxRatio;
  }

  // Apparent magnitude of named star k from a camera position in pc: Infinity for a row with no
  // magnitude (not drawn as a star), and the V magnitude for a sky-only star (seen from the Sun).
  apparentMag(k, camPc) {
    const n = this.named;
    if (n.flags[k] & 16) return n.vmag[k] != null ? n.vmag[k] : Infinity;
    if (n.absmag[k] == null) return Infinity;
    const d = Math.hypot(n.x[k] - camPc[0], n.y[k] - camPc[1], n.z[k] - camPc[2]);
    return n.absmag[k] + 5 * Math.log10(Math.max(d, 1e-9)) - 5;
  }

  // A named star with no usable parallax: not placed in 3D, drawn on the sky from the Sun only.
  skyOnly(k) { return !!(this.named.flags[k] & 16); }

  // Unit direction of named star k from the Sun (ICRS).
  direction(k) {
    const n = this.named, l = Math.hypot(n.x[k], n.y[k], n.z[k]) || 1;
    return [n.x[k] / l, n.y[k] / l, n.z[k] / l];
  }

  // Whether the sky-only stars are drawn now (the stars layer on, the camera near the Sun).
  get skyVisible() { return this.skyPts.visible; }

  label(k) {
    const n = this.named;
    return n.name[k] || n.desig[k] || n.id[k];
  }

  distSource(k) { return this.named.dist_src_labels[this.named.dist_src[k]] || '—'; }

  // The confirmed planets of named star k, as objects.
  planets(k) {
    const rows = this.exo[k];
    if (!rows) return null;
    return rows.map((r) => {
      const o = {};
      this.exoFields.forEach((f, i) => { o[f] = r[i]; });
      if (o.method != null) o.method = this.exoMethods[o.method];
      return o;
    });
  }
}
