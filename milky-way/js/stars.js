// The neighbourhood scale: stars in 3D around the Sun, in parsecs on ICRS axes, the Sun at the
// origin — plus the Gaia DR3 sky as a backdrop for everything seen from near the Sun.
//
// Three star sets, all drawn by the magnitude shader in gfx.js, so a star's brightness is its real
// absolute magnitude seen from wherever the camera is:
//   deep.bin    ~220 000 stars within 500 pc with good parallaxes (AT-HYG / Gaia DR3), no names;
//   named.json  every naked-eye star, everything within 20 pc and exoplanet hosts within 100 pc,
//               with names and designations — these are the ones you can tap;
//   the constellation figures joining named stars, drawn in 3D: from the Sun they are the familiar
//   shapes, and a few light-years out they come apart, because the stars in them are not related.
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
    this.exo = (exoplanets && exoplanets.hosts) || {};
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
      nm[k] = placed ? named.absmag[k] : 99;
      nc.set(rgbAt(named.colour[k]), k * 3);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(np, 3));
    ng.setAttribute('absmag', new THREE.BufferAttribute(nm, 1));
    ng.setAttribute('acolor', new THREE.BufferAttribute(nc, 3));
    this.namedPts = new THREE.Points(ng, starMaterial());
    this.namedPts.frustumCulled = false; this.namedPts.renderOrder = 2;
    this.root.add(this.namedPts);

    // ---- constellation figures, in 3D
    const segs = [];
    this.constellations = [];
    for (const [abbr, c] of Object.entries(constellations)) {
      const members = new Set();
      for (const [i, j] of c.lines) {
        if ((named.flags[i] & 16) || (named.flags[j] & 16)) continue;
        segs.push(i, j); members.add(i); members.add(j);
      }
      this.constellations.push({ abbr, name: c.name, members: [...members] });
    }
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
    const hm = glowPointsMaterial({ opacity: 0.5, ring: true });
    hm.depthTest = false;
    this.hosts = new THREE.Points(hg, hm);
    this.hosts.frustumCulled = false; this.hosts.renderOrder = 4;
    this.root.add(this.hosts);

    // Label order: brightest (absolute) first, names before designations.
    this.labelOrder = [...Array(N).keys()].filter((k) => !(named.flags[k] & 16) && (named.name[k] || named.desig[k]))
      .sort((a, b) => named.vmag[a] - named.vmag[b]);
  }

  // `camPc` = camera position in pc (from the Sun); `dSunPc` its distance from the Sun.
  update(camPc, dSunPc, pxRatio, layers, extent) {
    // Deeper exposure the farther the camera is from the Sun, so the structure of the neighbourhood
    // stays readable from outside it. From the Sun the limit is the naked eye's 6.5.
    const far = Math.max(1, dSunPc / 3);
    const mLim = 6.5 + 4.2 * Math.log10(far);
    for (const p of [this.deep, this.namedPts]) {
      const u = p.material.uniforms;
      u.uPx.value = pxRatio; u.uMLim.value = mLim;
      u.uMaxSize.value = dSunPc > 2000 ? 5 : 20;
      u.uOpacity.value = dSunPc > 5000 ? Math.max(0.25, 1 - Math.log10(dSunPc / 5000)) : 1;
    }
    this.deep.visible = !!layers.stars;
    this.namedPts.visible = !!layers.stars;
    // The sky map is the view from the Sun's position. It stays right to within a few degrees for
    // a camera a few hundred parsecs out, and fades as the camera leaves.
    const skyA = layers.sky ? (1 - Math.min(1, Math.max(0, (Math.log10(Math.max(dSunPc, 1e-9)) - 2) / 1.1))) : 0;
    this.sky.visible = skyA > 0.01;
    this.sky.material.uniforms.uOpacity.value = 0.62 * skyA;
    this.sky.position.set(camPc[0], camPc[1], camPc[2]);
    // Constellation figures: faint from inside the Solar System, where they are the sky behind the
    // planets; clearer out among the stars, where their third dimension shows; gone far away.
    const inside = Math.min(1, Math.max(0, (Math.log10(Math.max(dSunPc, 1e-9)) + 3) / 2));   // 0.001 pc → 0.1 pc
    const la = layers.constellations ? (0.35 + 0.65 * inside) * Math.max(0, 1 - Math.log10(Math.max(1, dSunPc / 30)) / 1.3) : 0;
    this.lines.visible = la > 0.02;
    this.lines.material.opacity = 0.5 * la;
    // Exoplanet hosts are marked once the view is about the stars, not from among the planets.
    this.hosts.visible = !!layers.exoplanets && dSunPc > 0.3 && dSunPc < 3000;
    this.hosts.material.uniforms.uPx.value = pxRatio;
  }

  // Apparent magnitude of named star k from a camera position in pc.
  apparentMag(k, camPc) {
    const n = this.named;
    const d = Math.hypot(n.x[k] - camPc[0], n.y[k] - camPc[1], n.z[k] - camPc[2]);
    return n.absmag[k] + 5 * Math.log10(Math.max(d, 1e-9)) - 5;
  }

  label(k) {
    const n = this.named;
    return n.name[k] || n.desig[k] || n.id[k];
  }

  distSource(k) { return this.named.dist_src_labels[this.named.dist_src[k]] || '—'; }
}
