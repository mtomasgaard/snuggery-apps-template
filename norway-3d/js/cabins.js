// The cabins: 980 mountain cabins and huts from OpenStreetMap (data/cabins.geojson, built by
// tools/build_cabins.py), drawn as one point cloud, each a small drawn house on a pale casing:
// filled for a staffed lodge, the roof alone filled for a self-service cabin, an outline for every
// other kind. They stand on the terrain in 3D (the height the app holds there, lifted 4 m so the
// glyph is not cut by the ground it stands on) and lie on the map in 2D. A tap picks the nearest
// drawn within 22 px; the card says the rest (app.js).

import * as THREE from '../vendor/three.module.js';
import { mercX, mercY, EARTH } from './geo.js';

export const KIND_WORDS = {
  staffed: 'Staffed lodge', self: 'Self-service cabin', none: 'No-service cabin', closed: 'Closed cabin',
  emergency: 'Emergency shelter', alpine: 'Mountain hut', wild: 'Wilderness hut',
};
export const glyphOf = (k) => (k === 'staffed' ? 0 : k === 'self' ? 1 : 2);

const VERT = /* glsl */`
  attribute float aGlyph;
  uniform float uSize;
  varying float vGlyph;
  void main() {
    vGlyph = aGlyph;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize;
  }
`;
// A house in the point's square: the roof a triangle over the upper half, the body a square under
// it. Distances are in point-size units, so the casing and the stroke are whole device pixels.
const FRAG = /* glsl */`
  precision highp float;
  varying float vGlyph;
  uniform float uSize;
  uniform vec3 uInk;
  uniform vec3 uCase;
  float house(vec2 p, float grow) {
    // body: x in [0.24, 0.76], y in [0.5, 0.86]; roof: apex (0.5, 0.14), eaves at y 0.5 from 0.16 to 0.84
    float g = grow;
    float body = max(max(0.24 - g - p.x, p.x - 0.76 - g), max(0.5 - g - p.y, p.y - 0.86 - g));
    vec2 q = vec2(abs(p.x - 0.5), p.y);
    float roof = max((q.x * 0.36 / 0.34 + 0.14) - q.y - g * 1.4, q.y - 0.5 - g);
    return min(body, roof);
  }
  float roofOnly(vec2 p) { vec2 q = vec2(abs(p.x - 0.5), p.y); return max((q.x * 0.36 / 0.34 + 0.14) - q.y, q.y - 0.5); }
  float bodyIn(vec2 p, float g) { return max(max(0.24 + g - p.x, p.x - 0.76 + g), max(0.5 + g - p.y, p.y - 0.86 + g)); }
  void main() {
    vec2 p = gl_PointCoord;
    float px = 1.0 / uSize;
    float outer = house(p, 2.2 * px);
    if (outer > 0.0) discard;
    float shape = house(p, 0.0);
    vec3 col = uCase;
    float a = 0.92;
    float inShape = 1.0 - smoothstep(-0.5 * px, 0.5 * px, shape);
    float hollow = 0.0;
    if (vGlyph > 1.5) hollow = 1.0 - smoothstep(-0.5 * px, 0.5 * px, house(p, -1.6 * px));
    else if (vGlyph > 0.5) hollow = 1.0 - smoothstep(-0.5 * px, 0.5 * px, bodyIn(p, 1.6 * px));
    col = mix(uCase, uInk, inShape * (1.0 - hollow));
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

export class Cabins {
  constructor(geojson) {
    const f = (geojson && geojson.features) || [];
    this.items = f.map((ft) => {
      const [lon, lat] = ft.geometry.coordinates;
      return { lon, lat, X: mercX(lon), Y: mercY(lat), p: ft.properties, h: null, src: null };
    });
    const n = this.items.length;
    this.pos = new Float32Array(n * 3);
    const glyph = new Float32Array(n);
    this.items.forEach((c, i) => { glyph[i] = glyphOf(c.p.k); });
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aGlyph', new THREE.BufferAttribute(glyph, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e12);
    this.material = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: 15 }, uInk: { value: new THREE.Color(0x0f1c23) }, uCase: { value: new THREE.Color(0xf6f9fa) } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  /** Put every cabin in the scene: on the ground in 3D, on the map in 2D. */
  place(frame, heightAt, flat, target) {
    const p = this.pos;
    for (let i = 0; i < this.items.length; i++) {
      const c = this.items[i];
      const h = heightAt(c.X, c.Y);
      if (h != null) c.h = h;
      const x = frame.sx(c.X), z = frame.sz(c.Y);
      let y = 0;
      if (flat < 1) {
        const g = (1 / Math.cosh(c.Y / 6378137)) / frame.c0;
        const dx = (x - target.x) * g, dz = (z - target.z) * g;
        const drop = (dx * dx + dz * dz) / (2 * EARTH);
        y = ((c.h == null ? c.p.ele || 0 : Math.max(0, c.h)) + 4 - drop) * frame.vs(c.Y) * (1 - flat);
      }
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    }
    this.posAttr.needsUpdate = true;
  }
  setSize(cssPx, dpr) { this.material.uniforms.uSize.value = Math.round(cssPx * dpr); }
  /** The cabin drawn nearest to a client point, within `slop` px, in front of the camera. */
  pick(camera, rect, cx, cy, slop = 22) {
    let best = null, bd = slop * slop;
    const v = _v;
    for (let i = 0; i < this.items.length; i++) {
      v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).project(camera);
      if (v.z < -1 || v.z > 1) continue;
      const sx = rect.left + (v.x + 1) / 2 * rect.width, sy = rect.top + (1 - v.y) / 2 * rect.height - 2;
      const d = (sx - cx) ** 2 + (sy - cy) ** 2;
      if (d < bd) { bd = d; best = { i, c: this.items[i], sx, sy }; }
    }
    return best;
  }
  /** Where cabin i is on screen, in client px, or null when behind the camera. */
  screen(camera, rect, i) {
    _v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]).project(camera);
    if (_v.z < -1 || _v.z > 1) return null;
    return { x: rect.left + (_v.x + 1) / 2 * rect.width, y: rect.top + (1 - _v.y) / 2 * rect.height };
  }
}
const _v = new THREE.Vector3();
