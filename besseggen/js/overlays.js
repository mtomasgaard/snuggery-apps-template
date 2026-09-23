// Everything drawn on top of the terrain: the trail, the connectors, the rivers, the lake
// surfaces, the glacier mask, and the lines the measure and line-of-sight tools draw.
//
// Lines are expanded in the vertex shader to a constant width in PIXELS. WebGL caps
// gl_LineWidth at 1 on every platform that matters, and a trail drawn as a world-space ribbon is
// either a hairline from the summit or a twelve-metre road from eye height.

import * as THREE from '../vendor/three.module.js';
import { parseColor } from './util.js';

const LINE_VERT = /* glsl */`
  attribute vec3 aPrev;
  attribute vec3 aNext;
  attribute float aSide;
  attribute float aT;
  uniform vec2 uRes;
  uniform float uWidth;
  uniform float uExag;
  uniform float uLift;
  uniform float uBias;
  varying float vT;
  vec4 toClip(vec3 p) {
    vec3 q = vec3(p.x, (p.y + uLift) * uExag, p.z);
    return projectionMatrix * modelViewMatrix * vec4(q, 1.0);
  }
  void main() {
    vec4 c = toClip(position);
    vec4 p = toClip(aPrev);
    vec4 n = toClip(aNext);
    float w = max(c.w, 1e-4);
    vec2 sc = c.xy / w * uRes;
    vec2 sp = p.xy / max(p.w, 1e-4) * uRes;
    vec2 sn = n.xy / max(n.w, 1e-4) * uRes;
    vec2 d1 = sc - sp, d2 = sn - sc;
    vec2 dir = normalize(length(d1) > 0.0001 ? (length(d2) > 0.0001 ? normalize(d1) + normalize(d2) : d1) : d2);
    if (length(dir) < 0.0001) dir = vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    c.xy += nrm * aSide * uWidth / uRes * w;
    c.z -= uBias * w;
    vT = aT;
    gl_Position = c;
  }
`;

const LINE_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uSplit;      // -1 = one colour; otherwise vT below it uses uColor
  uniform float uOpacity;
  varying float vT;
  void main() {
    vec3 c = uSplit < 0.0 ? uColor : (vT < uSplit ? uColor : uColor2);
    gl_FragColor = vec4(c, uOpacity);
    #include <colorspace_fragment>
  }
`;

export function makeLineMaterial(color = 0xc0392b, width = 3.2) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRes: { value: new THREE.Vector2(1, 1) },
      uWidth: { value: width },
      uExag: { value: 1 },
      uLift: { value: 2.5 },
      uBias: { value: 0.00035 },
      uColor: { value: new THREE.Color(color) },
      uColor2: { value: new THREE.Color(color) },
      uSplit: { value: -1 },
      uOpacity: { value: 1 },
    },
    vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

// pts: flat [x, y, z, ...] already in SCENE coordinates, with y as the TRUE elevation in metres
// (the exaggeration is applied in the shader so the slider never rebuilds a line).
export function buildLine(pts, tVals) {
  const n = pts.length / 3;
  const geo = new THREE.BufferGeometry();
  if (n < 2) return geo;
  const pos = new Float32Array(n * 2 * 3);
  const prev = new Float32Array(n * 2 * 3);
  const next = new Float32Array(n * 2 * 3);
  const side = new Float32Array(n * 2);
  const tt = new Float32Array(n * 2);
  const at = (i, o) => { const k = Math.min(Math.max(i, 0), n - 1) * 3; return pts[k + o]; };
  for (let i = 0; i < n; i++) {
    for (let s = 0; s < 2; s++) {
      const v = (i * 2 + s) * 3;
      pos[v] = at(i, 0); pos[v + 1] = at(i, 1); pos[v + 2] = at(i, 2);
      prev[v] = at(i - 1, 0); prev[v + 1] = at(i - 1, 1); prev[v + 2] = at(i - 1, 2);
      next[v] = at(i + 1, 0); next[v + 1] = at(i + 1, 1); next[v + 2] = at(i + 1, 2);
      side[i * 2 + s] = s ? 1 : -1;
      tt[i * 2 + s] = tVals ? tVals[i] : i / (n - 1);
    }
  }
  const idx = new Uint32Array((n - 1) * 6);
  for (let i = 0, k = 0; i < n - 1; i++) {
    const a = i * 2;
    idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + 2;
    idx[k++] = a + 1; idx[k++] = a + 3; idx[k++] = a + 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
  geo.setAttribute('aNext', new THREE.BufferAttribute(next, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  return geo;
}

// Several polylines in one geometry. A river layer with four hundred features is four hundred
// draw calls otherwise, which on a phone costs more than the triangles do.
export function buildLines(list) {
  const runs = list.filter((p) => p.length >= 6);
  const total = runs.reduce((s, p) => s + p.length / 3, 0);
  const geo = new THREE.BufferGeometry();
  if (!total) return geo;
  const pos = new Float32Array(total * 2 * 3);
  const prev = new Float32Array(total * 2 * 3);
  const next = new Float32Array(total * 2 * 3);
  const side = new Float32Array(total * 2);
  const tt = new Float32Array(total * 2);
  let quads = 0;
  for (const p of runs) quads += p.length / 3 - 1;
  const idx = new Uint32Array(quads * 6);
  let v = 0, k = 0;
  for (const pts of runs) {
    const n = pts.length / 3, base = v;
    const at = (i, o) => pts[Math.min(Math.max(i, 0), n - 1) * 3 + o];
    for (let i = 0; i < n; i++) {
      for (let s = 0; s < 2; s++, v++) {
        pos[v * 3] = at(i, 0); pos[v * 3 + 1] = at(i, 1); pos[v * 3 + 2] = at(i, 2);
        prev[v * 3] = at(i - 1, 0); prev[v * 3 + 1] = at(i - 1, 1); prev[v * 3 + 2] = at(i - 1, 2);
        next[v * 3] = at(i + 1, 0); next[v * 3 + 1] = at(i + 1, 1); next[v * 3 + 2] = at(i + 1, 2);
        side[v] = s ? 1 : -1;
        tt[v] = n > 1 ? i / (n - 1) : 0;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      idx[k++] = a; idx[k++] = a + 1; idx[k++] = a + 2;
      idx[k++] = a + 1; idx[k++] = a + 3; idx[k++] = a + 2;
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPrev', new THREE.BufferAttribute(prev, 3));
  geo.setAttribute('aNext', new THREE.BufferAttribute(next, 3));
  geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
  return geo;
}

// GeoJSON line features -> scene points, draped on the terrain where the file carries no z.
export function lineFeatureToPoints(coords, frame, sampleH, lift = 0) {
  const out = new Float64Array(coords.length * 3);
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    out[i * 3] = frame.sx(c[0]);
    out[i * 3 + 1] = (c.length > 2 && Number.isFinite(c[2]) ? c[2] : sampleH(c[0], c[1])) + lift;
    out[i * 3 + 2] = frame.sz(c[1]);
  }
  return out;
}

// ---------------------------------------------------------------- lakes
//
// A lake is rasterised into its own small grid with the canvas fill rule (which handles holes
// for free), then the rows are merged into runs and each run becomes one quad at the lake's real
// surface level from N50. Gjende is about 1500 x 170 cells at 8 m, and comes out as a couple of
// hundred quads rather than the thousands a naive grid would make or the earcut a polygon with
// islands would need.
function ringsOf(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}
function bboxOf(geometry) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of ringsOf(geometry)) {
    for (const ring of poly) {
      for (const c of ring) {
        if (c[0] < x0) x0 = c[0];
        if (c[0] > x1) x1 = c[0];
        if (c[1] < y0) y0 = c[1];
        if (c[1] > y1) y1 = c[1];
      }
    }
  }
  return { x0, y0, x1, y1 };
}
function rasterise(geometry, res) {
  const b = bboxOf(geometry);
  if (!Number.isFinite(b.x0)) return null;
  const pad = res * 2;
  const x0 = b.x0 - pad, y1 = b.y1 + pad;
  const nx = Math.max(2, Math.ceil((b.x1 - b.x0 + pad * 2) / res));
  const ny = Math.max(2, Math.ceil((b.y1 - b.y0 + pad * 2) / res));
  if (nx * ny > 12e6) return null;
  const cv = document.createElement('canvas');
  cv.width = nx; cv.height = ny;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (const poly of ringsOf(geometry)) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const px = (ring[i][0] - x0) / res + 0.5, py = (y1 - ring[i][1]) / res + 0.5;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  }
  ctx.fill('evenodd');
  const img = ctx.getImageData(0, 0, nx, ny).data;
  const m = new Uint8Array(nx * ny);
  for (let i = 0; i < nx * ny; i++) m[i] = img[i * 4 + 3] > 110 ? 1 : 0;
  return { m, nx, ny, x0, y1, res };
}

export function buildWater(waterGeo, frame, res = 8) {
  const lakes = [];
  const positions = [];
  const indices = [];
  let base = 0;
  for (const f of (waterGeo.features || [])) {
    const p = f.properties || {};
    const level = Number(p.levelM);
    if (!Number.isFinite(level)) continue;
    const r = rasterise(f.geometry, res);
    if (!r) continue;
    let cells = 0, quads = 0;
    for (let row = 0; row < r.ny; row++) {
      let c = 0;
      while (c < r.nx) {
        if (!r.m[row * r.nx + c]) { c++; continue; }
        let e = c;
        while (e + 1 < r.nx && r.m[row * r.nx + e + 1]) e++;
        cells += e - c + 1; quads++;
        const xw = r.x0 + (c - 0.5) * r.res, xe = r.x0 + (e + 0.5) * r.res;
        const yn = r.y1 - (row - 0.5) * r.res, ys = r.y1 - (row + 0.5) * r.res;
        const sxw = frame.sx(xw), sxe = frame.sx(xe), szn = frame.sz(yn), szs = frame.sz(ys);
        positions.push(sxw, level, szn, sxe, level, szn, sxw, level, szs, sxe, level, szs);
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        base += 4;
        c = e + 1;
      }
    }
    lakes.push({
      name: p.name || null, levelM: level, areaKm2: p.areaKm2 ?? null,
      cells, quads, source: p.source || null, n50Hoyde: p.n50Hoyde ?? null,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
  geo.computeBoundingSphere();
  return { geo, lakes, triangles: indices.length / 3 };
}

const WATER_VERT = /* glsl */`
  uniform float uExag;
  uniform float uBias;
  varying vec3 vP;
  void main() {
    vec3 q = vec3(position.x, position.y * uExag, position.z);
    vP = q;
    vec4 c = projectionMatrix * modelViewMatrix * vec4(q, 1.0);
    // The lake surface and the terrain under it are the same height to within a metre, and at
    // fifteen kilometres the depth buffer cannot tell them apart. A small bias toward the camera
    // decides it in the lake's favour without letting it show through a ridge in front.
    c.z -= uBias * c.w;
    gl_Position = c;
  }
`;
const WATER_FRAG = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uSunUp;
  uniform float uOpacity;
  varying vec3 vP;
  void main() {
    // A flat surface, so the only shading it can honestly carry is the sky and a glint.
    float glint = pow(max(uSunDir.y, 0.0), 0.6) * uSunUp;
    gl_FragColor = vec4(uColor * (0.82 + 0.3 * glint), uOpacity);
    #include <colorspace_fragment>
  }
`;
export function makeWaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uExag: { value: 1 },
      uColor: { value: new THREE.Color(0x9fb9cf) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunUp: { value: 1 },
      uOpacity: { value: 0.72 },
      uBias: { value: 0.0009 },
    },
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
  });
}

// One RGBA mask over the core box: red is lake, green is glacier. The terrain shader reads it to
// tint wet ground and ice, which is cheaper and holds holes better than triangulating either.
export function buildMask(grid, waterGeo, glacierGeo) {
  const nx = grid.nx, ny = grid.ny, res = grid.res;
  const cv = document.createElement('canvas');
  cv.width = nx; cv.height = ny;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, nx, ny);
  const paint = (geo, style) => {
    ctx.fillStyle = style;
    for (const f of (geo.features || [])) {
      ctx.beginPath();
      for (const poly of ringsOf(f.geometry)) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length; i++) {
            const px = (ring[i][0] - grid.x0) / res + 0.5, py = (grid.y1 - ring[i][1]) / res + 0.5;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
      }
      ctx.fill('evenodd');
    }
  };
  ctx.globalCompositeOperation = 'lighter';
  paint(waterGeo, 'rgb(255,0,0)');
  paint(glacierGeo, 'rgb(0,255,0)');
  const img = ctx.getImageData(0, 0, nx, ny).data;
  const out = new Uint8Array(nx * ny * 4);
  for (let i = 0; i < nx * ny; i++) {
    out[i * 4] = img[i * 4]; out[i * 4 + 1] = img[i * 4 + 1];
    out[i * 4 + 2] = 0; out[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(out, nx, ny, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

export function colorOf(colors, scheme, key, dflt) {
  const c = parseColor(((colors && colors[scheme]) || {})[key] || dflt);
  return new THREE.Color().setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace);
}
