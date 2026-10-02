// Small geometry helpers shared by kart.js and scenery.js. three's BufferGeometryUtils is not
// vendored, so merging is done by hand: every part becomes non-indexed triangles, and their
// position / normal / color / uv arrays are concatenated.

import { BufferGeometry, Float32BufferAttribute, Color, Matrix4, Euler, Quaternion, Vector3, CanvasTexture, SRGBColorSpace, RepeatWrapping } from '../vendor/three.module.js';

const _c = new Color();

/**
 * parts: [{ geo, pos?: [x,y,z], rot?: [x,y,z], scale?: [x,y,z], color: hex|Color, uv?: [u,v] | (u, v, i) => [u, v] }]
 * A part with `uv` as a pair gets that uv on every vertex (the white patch trick); a function remaps.
 * The part's own geometry is not modified.
 */
export function mergeParts(parts, { uvs = true } = {}) {
  const P = [], N = [], C = [], U = [];
  const m = new Matrix4(), q = new Quaternion(), e = new Euler();
  for (const part of parts) {
    let g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
    q.setFromEuler(e.set(...(part.rot || [0, 0, 0])));
    m.compose(new Vector3(...(part.pos || [0, 0, 0])), q, new Vector3(...(part.scale || [1, 1, 1])));
    g.applyMatrix4(m);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position.array, nor = g.attributes.normal.array, uv = g.attributes.uv ? g.attributes.uv.array : null;
    const n = pos.length / 3;
    const perVertex = typeof part.color === 'function';
    if (!perVertex) _c.set(part.color ?? 0xffffff);
    for (let i = 0; i < n; i++) {
      P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      N.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
      if (perVertex) _c.set(part.color(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]));
      C.push(_c.r, _c.g, _c.b);
      if (uvs) {
        if (typeof part.uv === 'function') { const r = part.uv(uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0, i); U.push(r[0], r[1]); }
        else if (part.uv) U.push(part.uv[0], part.uv[1]);
        else U.push(uv ? uv[i * 2] : 0, uv ? uv[i * 2 + 1] : 0);
      }
    }
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new Float32BufferAttribute(N, 3));
  out.setAttribute('color', new Float32BufferAttribute(C, 3));
  if (uvs) out.setAttribute('uv', new Float32BufferAttribute(U, 2));
  out.computeBoundingSphere();
  return out;
}

/** A canvas texture painted by `paint(ctx, w, h)`. */
export function canvasTexture(w, h, paint, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; }
  return t;
}

/** A builder for triangle soups with colors (for strips and walls). */
export class Soup {
  constructor(withUV = false) { this.p = []; this.c = []; this.u = withUV ? [] : null; this.col = new Color(1, 1, 1); }
  color(hex) { this.col.set(hex); return this; }
  colorRGB(r, g, b) { this.col.setRGB(r, g, b); return this; }
  v(x, y, z, u = 0, w = 0) { this.p.push(x, y, z); this.c.push(this.col.r, this.col.g, this.col.b); if (this.u) this.u.push(u, w); }
  /** A quad a-b-c-d (counter-clockwise seen from the front), each [x,y,z] or [x,y,z,u,v]. */
  quad(a, b, c, d) { this.v(...a); this.v(...b); this.v(...c); this.v(...a); this.v(...c); this.v(...d); }
  tri(a, b, c) { this.v(...a); this.v(...b); this.v(...c); }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3));
    if (this.u) g.setAttribute('uv', new Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
  get count() { return this.p.length / 3; }
}
