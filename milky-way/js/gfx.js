// Shaders and small three.js helpers shared by the three scales.
//
// Colour handling is deliberately simple: textures are sampled as the sRGB values they were saved
// as, converted to linear only where light is multiplied in (the planet globes), and written back
// as display values. The point and line layers are additive and never write depth.
//
// Every custom shader carries three.js's logarithmic-depth chunks, because the renderer is created
// with a logarithmic depth buffer: the near side of a moon and a planet a billion kilometres behind
// it share one frame.

import * as THREE from '../vendor/three.module.js';

const LOGV = /* glsl */`
#include <common>
#include <logdepthbuf_pars_vertex>
`;
const LOGF = /* glsl */`
#include <logdepthbuf_pars_fragment>
`;

// ------------------------------------------------------------------ glow points
// Per-point colour and size in CSS pixels; a soft round sprite. Used for markers, asteroids,
// clusters and anything that should stay visible however small it is.
export function glowPointsMaterial({ opacity = 1, sharp = 0.0, ring = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 }, uOpacity: { value: opacity }, uSharp: { value: sharp }, uRing: { value: ring ? 1 : 0 } },
    vertexShader: LOGV + /* glsl */`
      attribute vec3 acolor;
      attribute float asize;
      uniform float uPx;
      varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(asize * uPx, 1.0);
        vC = acolor;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGF + /* glsl */`
      uniform float uOpacity;
      uniform float uSharp;
      uniform float uRing;
      varying vec3 vC;
      void main() {
        vec2 d = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(d, d);
        if (r2 > 1.0) discard;
        float core = smoothstep(0.42, 0.18, r2);
        float halo = exp(-r2 * 5.0) * (1.0 - r2);
        float a = mix(halo * 0.75 + core * 0.55, core, uSharp);
        if (uRing > 0.5) { float r = sqrt(r2); a = smoothstep(0.62, 0.74, r) * (1.0 - smoothstep(0.86, 0.98, r)); }
        gl_FragColor = vec4(vC * a * uOpacity, 1.0);
        #include <logdepthbuf_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending,
  });
}

// ------------------------------------------------------------------ stars by magnitude
// Each star carries its absolute magnitude. The shader works out the apparent magnitude from the
// camera's actual distance to it — m = M + 5·log10(d/10 pc) — so the sky seen from the Sun has the
// real magnitudes, and flying towards a star brightens it by the inverse-square law. `uMLim` is
// the magnitude at which a star fades out; `uUnitPc` converts pass units to parsecs.
export function starMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPx: { value: 1 }, uMLim: { value: 6.5 }, uUnitPc: { value: 1 }, uGain: { value: 1 },
      uMaxSize: { value: 22 }, uOpacity: { value: 1 },
    },
    vertexShader: LOGV + /* glsl */`
      attribute float absmag;
      attribute vec3 acolor;
      uniform float uPx, uMLim, uUnitPc, uGain, uMaxSize;
      varying vec3 vC;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = max(length(mv.xyz) * uUnitPc, 1e-7);
        float m = absmag + 5.0 * log(d) / log(10.0) - 5.0;
        float f = pow(10.0, -0.4 * (m - uMLim)) * uGain;     // 1 at the limiting magnitude
        float s = clamp(2.1 * pow(max(f, 0.0), 0.21), 1.4, uMaxSize);
        gl_PointSize = s * uPx;
        vA = clamp(f * 1.6, 0.0, 1.0);
        vC = acolor;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGF + /* glsl */`
      uniform float uOpacity;
      varying vec3 vC;
      varying float vA;
      void main() {
        if (vA < 0.004) discard;
        vec2 d = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(d, d);
        if (r2 > 1.0) discard;
        float core = exp(-r2 * 14.0);
        float halo = exp(-r2 * 4.0) * (1.0 - r2) * 0.35;
        vec3 c = mix(vC, vec3(1.0), core * 0.55);
        gl_FragColor = vec4(c * (core + halo) * vA * uOpacity, 1.0);
        #include <logdepthbuf_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
}

// ------------------------------------------------------------------ planet globes
// The geometry is a unit sphere in the body-fixed frame (z = north pole, x = prime meridian), so the
// texture is looked up from the fragment's body-fixed direction rather than from UVs: longitude
// east-positive from the prime meridian, latitude planetocentric. `uLonLeft` is the longitude at
// the texture's left edge. Light comes from the Sun's position; `uNight` adds the city-lights map on
// the dark side of the Earth; `uRings` casts Saturn's ring shadows onto the globe.
export function globeMaterial({ map = null, night = null, color = [0.7, 0.7, 0.7], emissive = false, lonLeft = -180, gray = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uNight: { value: night }, uHasNight: { value: night ? 1 : 0 },
      uColor: { value: new THREE.Vector3(...color) }, uLonLeft: { value: lonLeft }, uGray: { value: gray ? 1 : 0 },
      uEmissive: { value: emissive ? 1 : 0 }, uSun: { value: new THREE.Vector3() },
      uRingN: { value: new THREE.Vector3(0, 0, 1) }, uCenter: { value: new THREE.Vector3() }, uKm: { value: 1 },
      uRingCount: { value: 0 }, uRingBands: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
      uAmbient: { value: 0.004 },
    },
    vertexShader: LOGV + /* glsl */`
      varying vec3 vBody;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vBody = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        // The mesh is scaled by the body's radii, unequal on an oblate or triaxial body: normals take
        // the inverse transpose, or the terminator would sit several degrees off on Saturn.
        vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGF + /* glsl */`
      uniform sampler2D uMap, uNight;
      uniform float uHasMap, uHasNight, uLonLeft, uGray, uEmissive, uKm, uAmbient;
      uniform vec3 uColor, uSun, uRingN, uCenter;
      uniform int uRingCount;
      uniform vec3 uRingBands[6];
      varying vec3 vBody;
      varying vec3 vN;
      varying vec3 vW;
      const float PI = 3.141592653589793;
      void main() {
        vec3 b = normalize(vBody);
        float lon = degrees(atan(b.y, b.x));
        float lat = asin(clamp(b.z, -1.0, 1.0));
        vec2 uv = vec2(fract((lon - uLonLeft) / 360.0), 0.5 + lat / PI);
        vec3 base = uColor;
        // Gradients taken across the longitude wrap would pick the smallest mipmap and draw a seam.
        vec2 gx = dFdx(uv), gy = dFdy(uv);
        gx.x -= floor(gx.x + 0.5); gy.x -= floor(gy.x + 0.5);
        if (uHasMap > 0.5) {
          vec3 t = textureGrad(uMap, uv, gx, gy).rgb;
          base = uGray > 0.5 ? vec3(t.r) : t;
        }
        if (uEmissive > 0.5) { gl_FragColor = vec4(base, 1.0);
          #include <logdepthbuf_fragment>
          return; }
        vec3 lin = pow(base, vec3(2.2));
        vec3 L = normalize(uSun - vW);
        vec3 N = normalize(vN);
        float ndl = dot(N, L);
        float lit = smoothstep(-0.015, 0.06, ndl) * max(ndl, 0.0) + smoothstep(-0.015, 0.06, ndl) * 0.02;
        // Ring shadow: where the ray towards the Sun crosses the ring plane inside a ring band.
        if (uRingCount > 0) {
          float dn = dot(L, uRingN);
          if (abs(dn) > 1e-5) {
            float t = dot(uCenter - vW, uRingN) / dn;
            if (t > 0.0) {
              float r = length(vW + L * t - uCenter) / uKm;
              for (int i = 0; i < 6; i++) {
                if (i >= uRingCount) break;
                vec3 bnd = uRingBands[i];
                if (r > bnd.x && r < bnd.y) lit *= (1.0 - bnd.z * 0.85);
              }
            }
          }
        }
        vec3 col = lin * (lit + uAmbient);
        if (uHasNight > 0.5) {
          float dark = 1.0 - smoothstep(-0.12, 0.04, ndl);
          vec3 nd = textureGrad(uNight, uv, gx, gy).rgb;
          // The city-lights map is composited over a blue-grey land base (red and green about 0.15)
          // and black oceans; the lights are white. Keying on red and green keeps the lights and
          // drops the base, which would otherwise tint the whole night side.
          float lamp = smoothstep(0.2, 0.5, min(nd.r, nd.g));
          col += pow(nd, vec3(2.2)) * lamp * dark * 1.5;
        }
        gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
        #include <logdepthbuf_fragment>
      }`,
  });
}

// ------------------------------------------------------------------ rings
// A flat annulus in the planet's equatorial plane, radii in km. Only the ring edges and gaps are
// data (JPL's sat425 radii); the brightness is drawn uniform, in a neutral grey, because no ring
// brightness or colour profile with a clean licence could be sourced. The planet's shadow falls on
// the rings.
export function ringMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: new THREE.Vector3() }, uCenter: { value: new THREE.Vector3() }, uN: { value: new THREE.Vector3(0, 0, 1) },
      uR: { value: 1 }, uKm: { value: 1 }, uCount: { value: 0 },
      uBands: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
      uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Vector3(0.8, 0.8, 0.8) },
    },
    vertexShader: LOGV + /* glsl */`
      varying vec3 vL;
      varying vec3 vW;
      void main() {
        vL = position;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGF + /* glsl */`
      uniform vec3 uSun, uCenter, uN, uCam, uColor;
      uniform float uR, uKm;
      uniform int uCount;
      uniform vec3 uBands[6];
      varying vec3 vL;
      varying vec3 vW;
      void main() {
        float r = length(vL.xy);         // km, in the ring plane
        float a = 0.0;
        for (int i = 0; i < 6; i++) {
          if (i >= uCount) break;
          vec3 b = uBands[i];
          float edge = max(b.y - b.x, 1.0) * 0.004;
          a = max(a, b.z * smoothstep(b.x - edge, b.x + edge, r) * (1.0 - smoothstep(b.y - edge, b.y + edge, r)));
        }
        if (a < 0.003) discard;
        vec3 L = normalize(uSun - vW);
        // Planet shadow: does the ray towards the Sun hit the globe?
        vec3 oc = vW - uCenter;
        float bq = dot(oc, L);
        float cq = dot(oc, oc) - uR * uR;
        float h = bq * bq - cq;
        float shade = (h > 0.0 && -bq - sqrt(h) > 0.0) ? 0.06 : 1.0;
        // The unlit face (camera and Sun on opposite sides of the plane) shows only light that
        // passes through; it is drawn dimmer.
        float sSun = dot(uSun - uCenter, uN), sCam = dot(uCam - uCenter, uN);
        float face = sSun * sCam > 0.0 ? 1.0 : 0.35;
        float tilt = abs(dot(L, uN));
        float light = shade * face * (0.35 + 0.65 * smoothstep(0.0, 0.25, tilt));
        gl_FragColor = vec4(uColor * light, a);
        #include <logdepthbuf_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
}

// ------------------------------------------------------------------ sky sphere
// The Gaia DR3 source-count map on the inside of a sphere centred on the camera. The texture is
// equirectangular in ICRS (RA increasing to the right from 0 at the left edge, Dec +90 at the top),
// looked up from the view direction, so no UV seam or mirroring can creep in.
export function skyMaterial(tex) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uOpacity: { value: 1 }, uTint: { value: new THREE.Vector3(0.82, 0.86, 1.0) } },
    vertexShader: /* glsl */`
      varying vec3 vD;
      void main() {
        vD = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;            // on the far plane
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec3 uTint;
      varying vec3 vD;
      const float PI = 3.141592653589793;
      void main() {
        vec3 d = normalize(vD);
        float ra = atan(d.y, d.x);
        if (ra < 0.0) ra += 2.0 * PI;
        float dec = asin(clamp(d.z, -1.0, 1.0));
        vec2 uv = vec2(ra / (2.0 * PI), 0.5 + dec / PI);
        vec2 gx = dFdx(uv), gy = dFdy(uv);
        gx.x -= floor(gx.x + 0.5); gy.x -= floor(gy.x + 0.5);
        float v = textureGrad(uMap, uv, gx, gy).r;
        // A darker black point than the file's own stretch: from among the planets the sky should
        // read as black with the Milky Way band in it, not as grey.
        v = max(v - 0.13, 0.0) / 0.87;
        vec3 c = pow(vec3(v), vec3(1.7)) * uTint;
        gl_FragColor = vec4(c * uOpacity, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, transparent: true,
  });
}

// ------------------------------------------------------------------ textured plane (galaxy layers)
// `zero` (0–1): the code value that means "nothing"; only what lies above it is lit (the young-star
// maps encode overdensity from −1 to +1.5, so their zero sits at 0.4).
export function planeMaterial(tex, { tint = [1, 1, 1], opacity = 1, alphaFromMap = false, zero = 0, gamma = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uTint: { value: new THREE.Vector3(...tint) }, uOpacity: { value: opacity }, uAlpha: { value: alphaFromMap ? 1 : 0 }, uZero: { value: zero }, uGamma: { value: gamma } },
    vertexShader: LOGV + /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGF + /* glsl */`
      uniform sampler2D uMap;
      uniform vec3 uTint;
      uniform float uOpacity, uAlpha, uZero, uGamma;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        float v = pow(clamp((t.r - uZero) / (1.0 - uZero), 0.0, 1.0), uGamma);
        if (uAlpha > 0.5) v *= t.a;
        gl_FragColor = vec4(uTint * v * uOpacity, 1.0);
        #include <logdepthbuf_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ------------------------------------------------------------------ ribbons (spiral-arm fits)
// A strip whose alpha falls off across its width as a Gaussian: the arm fits carry a fitted width,
// and a soft band of that width is the honest way to draw it.
export function ribbonMaterial(color, opacity = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(...hexToRgb01(color)) }, uOpacity: { value: opacity } },
    vertexShader: LOGV + /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGF + /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float x = vUv.y * 2.0 - 1.0;
        float a = exp(-x * x * 2.0) * uOpacity * smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x);
        gl_FragColor = vec4(uColor * a, 1.0);
        #include <logdepthbuf_fragment>
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

// ------------------------------------------------------------------ lines
// Polylines with per-vertex RGBA, for orbits, trails, arms, streams and constellation figures.
export function lineMaterial({ opacity = 1, depthTest = true, additive = true } = {}) {
  return new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity, depthWrite: false, depthTest,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

export function makeLine(points /* Float32Array xyz */, colors /* Float32Array rgba */, material, loop = false) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(points, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const l = loop ? new THREE.LineLoop(g, material) : new THREE.Line(g, material);
  l.frustumCulled = false;
  return l;
}

// A CSS hex colour as the display (sRGB) values the custom shaders write out. THREE.Color would
// convert it to linear, which draws a marker darker and more saturated than its label.
export function hexToRgb01(hex) {
  const c = new THREE.Color().setStyle(hex, THREE.NoColorSpace);
  return [c.r, c.g, c.b];
}

// A texture from an image URL, with the settings every map here wants.
export function loadTexture(url, { srgb = false } = {}) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = 4; t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      resolve(t);
    }, undefined, () => reject(new Error(`${url}: could not be loaded`)));
  });
}

// ------------------------------------------------------------------ thick lines
// WebGL draws lines one pixel wide whatever you ask, which reads as hairlines on a phone. A
// ThickLine is a polyline drawn as screen-space quads: each segment is one instance of a four-vertex
// quad, expanded perpendicular to the segment on screen by `width` CSS pixels, with anti-aliased
// edges and a colour (RGBA) per point, so trails can fade. Segments reaching behind the camera are
// clipped in clip space before the divide, so an orbit around the camera stays whole.
export const lineUniforms = { uRes: { value: new THREE.Vector2(1, 1) }, uPx: { value: 1 } };

export function thickLineMaterial({ width = 1.5, opacity = 1, depthTest = true, additive = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uRes: lineUniforms.uRes, uPx: lineUniforms.uPx, uWidth: { value: width }, uOpacity: { value: opacity } },
    vertexShader: LOGV + /* glsl */`
      attribute vec3 iA;
      attribute vec3 iB;
      attribute vec4 iCA;
      attribute vec4 iCB;
      uniform vec2 uRes;
      uniform float uPx, uWidth;
      varying vec4 vC;
      varying float vEdge;
      void main() {
        vec4 a = projectionMatrix * modelViewMatrix * vec4(iA, 1.0);
        vec4 b = projectionMatrix * modelViewMatrix * vec4(iB, 1.0);
        const float EPS = 1e-6;
        if (a.w < EPS && b.w < EPS) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vC = vec4(0.0); vEdge = 0.0; return; }
        if (a.w < EPS) a = mix(a, b, (EPS - a.w) / (b.w - a.w));
        if (b.w < EPS) b = mix(b, a, (EPS - b.w) / (a.w - b.w));
        vec2 sa = a.xy / a.w * uRes, sb = b.xy / b.w * uRes;
        vec2 d = sb - sa;
        float len = length(d);
        vec2 dir = len > 1e-6 ? d / len : vec2(1.0, 0.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        float w = uWidth * uPx + 1.0;                  // one extra pixel for the soft edge
        vec4 p = position.x < 0.5 ? a : b;
        p.xy += nrm * position.y * w / uRes * p.w;
        gl_Position = p;
        vC = position.x < 0.5 ? iCA : iCB;
        vEdge = position.y * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGF + /* glsl */`
      uniform float uOpacity, uPx, uWidth;
      varying vec4 vC;
      varying float vEdge;
      void main() {
        float half_w = uWidth * uPx * 0.5;
        float a = 1.0 - smoothstep(half_w - 0.5, half_w + 0.5, abs(vEdge) * 0.5);
        float alpha = vC.a * a * uOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vC.rgb * alpha, alpha);
        #include <logdepthbuf_fragment>
      }`,
    // The fragment writes premultiplied colour, so both modes are custom blends starting from One.
    transparent: true, depthWrite: false, depthTest, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor,
  });
}

// A polyline of up to `maxPoints` points. `pos` (xyz) and `col` (rgba) are the live arrays; call
// update(count) after writing them.
export class ThickLine {
  constructor(maxPoints, material) {
    this.max = maxPoints;
    this.pos = new Float32Array(maxPoints * 3);
    this.col = new Float32Array(maxPoints * 4);
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0], 3));
    g.setIndex([0, 2, 1, 2, 3, 1]);
    this.pb = new THREE.InstancedInterleavedBuffer(this.pos, 3, 1);
    this.cb = new THREE.InstancedInterleavedBuffer(this.col, 4, 1);
    g.setAttribute('iA', new THREE.InterleavedBufferAttribute(this.pb, 3, 0));
    g.setAttribute('iB', new THREE.InterleavedBufferAttribute(this.pb, 3, 3));
    g.setAttribute('iCA', new THREE.InterleavedBufferAttribute(this.cb, 4, 0));
    g.setAttribute('iCB', new THREE.InterleavedBufferAttribute(this.cb, 4, 4));
    g.instanceCount = 0;
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
  }
  update(count = this.max, colours = false) {
    this.count = Math.min(count, this.max);
    this.geo.instanceCount = Math.max(0, this.count - 1);
    this.pb.needsUpdate = true;
    if (colours) this.cb.needsUpdate = true;
  }
  static from(points /* [[x,y,z],…] or Float32Array */, rgba, material) {
    const n = points.length / (Array.isArray(points) ? 1 : 3);
    const l = new ThickLine(n, material);
    if (Array.isArray(points)) points.forEach((p, i) => l.pos.set(p, i * 3)); else l.pos.set(points);
    for (let i = 0; i < n; i++) l.col.set(typeof rgba === 'function' ? rgba(i, n) : rgba, i * 4);
    l.update(n, true);
    return l;
  }
}
