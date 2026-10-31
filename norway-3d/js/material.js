// The terrain material: one shader for every tile, in 2D and in 3D.
//
//   the map      Kartverket's tile, or an ancestor's piece of one while it loads (uMapXf)
//   the trails   Turrutebasen's foot routes over it, when the layer is on
//   the height   per vertex (aHeight, meters), scaled by the local Mercator stretch so slopes stay
//                true (js/geo.js), lowered by the earth's curvature away from the view's center,
//                and flattened to nothing in 2D (uFlat); a tile's skirt hangs below its edges
//   the light    per fragment, from the height tile's normal map: the real sun for the date and
//                hour (js/sun.js), its cast shadows from the CPU's sweep over two nested grids
//                around the view (js/analysis.js), and the sky's light in the shade
//   viewshed     seen ground tinted, hidden ground veiled, from the tapped point
//
// Everything is computed in linear light and converted on the way out.

import * as THREE from '../vendor/three.module.js';

const VERT = /* glsl */`
  attribute float aHeight;
  attribute float aSkirt;
  uniform vec4 uTile;          // scene x of the west and east edges, z of the north and south edges
  uniform float uY0;           // the frame's origin, Mercator Y
  uniform float uC0;           // cos(latitude) at the origin
  uniform float uFlat;         // 1 in 2D
  uniform float uCurv;         // 1 to bend the ground with the earth
  uniform vec2 uTarget;        // the view's center, scene x and z
  uniform float uSkirt;        // meters a skirt hangs
  uniform float uPx;           // scene units a screen pixel covers at the view's center
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vSkirt;
  varying float vDepth;
  varying float vH;
  const float RM = 6378137.0;
  const float RE = 6371000.0;
  void main() {
    vUv = position.xz;
    // corner to corner, so a shared edge comes out bit for bit the same in both tiles (no hairline)
    vec2 xz = vec2(uTile.x * (1.0 - position.x) + uTile.y * position.x, uTile.z * (1.0 - position.z) + uTile.w * position.z);
    // flat, a skirt cannot hang: it leans out under its neighbor by two pixels instead, so a
    // T-junction between two levels never opens a hairline to the plate
    vec2 outward = step(0.999, position.xz) - step(position.xz, vec2(0.001));
    xz += outward * aSkirt * uFlat * uPx * 2.0;
    float Y = uY0 - xz.y / uC0;
    float cl = 1.0 / cosh(Y / RM);
    float vs = uC0 / cl;
    vec2 g = (xz - uTarget) * (cl / uC0);
    float drop = dot(g, g) / (2.0 * RE) * uCurv;
    float h = max(aHeight, 0.0) - aSkirt * uSkirt;
    float y = (h - drop) * vs * (1.0 - uFlat) - aSkirt * uFlat * 2.0;
    vec4 world = vec4(xz.x, y, xz.y, 1.0);
    vWorld = world.xyz;
    vSkirt = aSkirt;
    vH = aHeight;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vSkirt;
  varying float vDepth;
  varying float vH;

  uniform sampler2D uMap;   uniform vec4 uMapXf;   uniform float uMapOn;
  uniform sampler2D uTrail; uniform vec4 uTrailXf; uniform float uTrailOn;
  uniform sampler2D uNorm;  uniform vec4 uNormXf;  uniform float uNormOn;
  uniform sampler2D uSnow;  uniform vec4 uSnowXf;  uniform float uSnowTexOn;
  uniform vec3 uBase;

  uniform float uSurface;      // 0 the map, 1 relief, 2 elevation
  uniform vec3 uRelief;        // the relief's neutral ground
  uniform vec3 uWater;         // water, on the relief and elevation surfaces
  uniform sampler2D uRamp;     // the elevation table, 64 stops
  uniform vec2 uRampRange;     // meters at its two ends

  uniform float uSlopeOn;      // the steepness classes
  uniform vec3 uSlopeCol[5];
  uniform float uSnowMode;     // 0 off, 1 the seNorge model, 2 the snow line
  uniform float uSnowLine;     // meters
  uniform vec3 uSnowCol;

  uniform float uSunOn;        // the sun layer
  uniform vec3 uSunDir;        // toward the sun, scene space
  uniform float uSunAlt;       // apparent altitude, degrees
  uniform vec3 uSunCol;
  uniform vec3 uSkyCol;
  uniform vec3 uNightCol;
  uniform float uFlat;

  uniform float uShOn;
  uniform sampler2D uShCore;  uniform vec4 uCoreRect;
  uniform sampler2D uShShell; uniform vec4 uShellRect;

  uniform float uViewOn;
  uniform sampler2D uView;    uniform vec4 uViewRect;
  uniform vec3 uViewCol;
  uniform vec4 uVeil;

  uniform vec3 uFogCol;
  uniform float uFog;

  vec2 rectUV(vec2 xz, vec4 r) { return (xz - r.xy) / r.zw; }
  bool inside(vec2 uv) { return uv.x > 0.002 && uv.x < 0.998 && uv.y > 0.002 && uv.y < 0.998; }
  vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }

  void main() {
    // ---- the normal, from the height tile's normal map: the 1 m model's relief near the view
    vec3 n = vec3(0.0, 1.0, 0.0);
    if (uNormOn > 0.5) {
      vec2 e = texture2D(uNorm, uNormXf.xy + vUv * uNormXf.zw).rg * 2.0 - 1.0;
      n = normalize(vec3(e.x, sqrt(max(0.0, 1.0 - dot(e, e))), -e.y));
    }
    float slope = degrees(acos(clamp(n.y, 0.0, 1.0)));

    // ---- the surface
    vec4 m = uMapOn > 0.5 ? texture2D(uMap, uMapXf.xy + vUv * uMapXf.zw) : vec4(uBase, 0.0);
    vec3 mapCol = mix(uBase, m.rgb, m.a);
    // water: the sea at its surface, and the map's own lake and river blue where the map is in
    float water = 1.0 - smoothstep(0.05, 0.6, vH);
    if (m.a > 0.5) {
      vec3 s = m.rgb;      // linear; the topo water is light cyan, far bluer than its glacier white
      water = max(water, smoothstep(0.24, 0.34, s.b - s.r) * step(s.r, s.g));
    }
    vec3 base;
    if (uSurface < 0.5) base = mapCol;
    else if (uSurface < 1.5) base = mix(uRelief, uWater, water);
    else {
      float t = clamp((vH - uRampRange.x) / max(1.0, uRampRange.y - uRampRange.x), 0.0, 1.0);
      vec3 r = toLinear(texture2D(uRamp, vec2(t * 63.0 / 64.0 + 0.5 / 64.0, 0.5)).rgb);
      base = mix(r, uWater, water);
    }
    if (uTrailOn > 0.5) {
      vec4 t = texture2D(uTrail, uTrailXf.xy + vUv * uTrailXf.zw);
      base = mix(base, t.rgb, t.a);
    }

    // ---- snow: the seNorge model's depth, or the snow line, under the steepness and the light
    float snow = 0.0;
    if (uSnowMode > 1.5) {
      // a north face holds snow lower, a south face loses it higher; a wall sheds it
      float north = -n.z / max(0.05, length(n.xz)) * smoothstep(3.0, 15.0, slope);
      float line = uSnowLine - 140.0 * north;
      snow = smoothstep(line - 30.0, line + 30.0, vH) * (1.0 - smoothstep(48.0, 62.0, slope)) * (1.0 - water);
    } else if (uSnowMode > 0.5 && uSnowTexOn > 0.5) {
      snow = texture2D(uSnow, uSnowXf.xy + vUv * uSnowXf.zw).r * (1.0 - smoothstep(50.0, 65.0, slope)) * (1.0 - water);
    }
    base = mix(base, uSnowCol, snow * 0.92);

    // ---- steepness: the avalanche-terrain classes (27, 30, 35, 40, 45 degrees), from the normal
    if (uSlopeOn > 0.5 && slope >= 27.0) {
      int c = slope < 30.0 ? 0 : slope < 35.0 ? 1 : slope < 40.0 ? 2 : slope < 45.0 ? 3 : 4;
      base = mix(base, uSlopeCol[c], 0.72);
    }

    vec3 col = base;
    float relief = uSurface > 0.5 ? 1.0 : 0.0;
    if (uSunOn > 0.5) {
      float lam = max(dot(n, uSunDir), 0.0);
      float cast_ = 1.0;
      if (uShOn > 0.5) {
        vec2 cu = rectUV(vWorld.xz, uCoreRect);
        if (inside(cu)) cast_ = texture2D(uShCore, cu).r;
        else {
          vec2 su = rectUV(vWorld.xz, uShellRect);
          if (inside(su)) cast_ = texture2D(uShShell, su).r;
        }
      }
      // Day, twilight and night by the sun's altitude at the view's center. The sky lights what the
      // sun does not reach; the sun is added where it falls.
      float day = smoothstep(-6.0, 2.0, uSunAlt);
      vec3 sky = mix(uNightCol, uSkyCol, day) * (0.7 + 0.3 * n.y);
      // a low sun is lifted (Besseggen's curve), so flat ground in it reads as lit, never as mud,
      // while a face the mask shades stays exactly in the sky's light
      float k = pow(clamp(lam * cast_, 0.0, 1.0), 0.6) * step(0.0, uSunAlt);
      vec3 light = min(sky + uSunCol * k * 0.95, vec3(1.18));
      // in 2D the map stays a map: the light is a relief over it, not a scene (the relief and
      // elevation surfaces take it whole: they are made to be lit)
      light = mix(light, mix(vec3(1.0), light, mix(0.55, 1.0, relief)), uFlat);
      col = base * light;
    } else if (relief > 0.5 || uSlopeOn > 0.5 || uSnowMode > 0.5) {
      // no sun: the cartographer's lamp from the northwest, so the relief still reads
      float hill = max(dot(n, normalize(vec3(-0.6, 0.75, -0.6))), 0.0);
      col = base * mix(1.0, 0.45 + 0.7 * hill, relief > 0.5 ? 1.0 : 0.35);
    }

    if (uViewOn > 0.5) {
      vec2 vu = rectUV(vWorld.xz, uViewRect);
      if (inside(vu)) {
        float seen = texture2D(uView, vu).r;
        col = mix(mix(col, uVeil.rgb, uVeil.a), mix(col, uViewCol, 0.5), seen);
      }
    }

    col = mix(col, col * 0.55, vSkirt);
    float fog = 1.0 - exp(-uFog * vDepth);
    col = mix(col, uFogCol, clamp(fog, 0.0, 0.9) * (1.0 - uFlat));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** The steepness classes, as Norway's avalanche-terrain maps draw them: 27 to 30°, 30 to 35°,
 *  35 to 40°, 40 to 45° and steeper. ART.md section 2 measures them. */
export const SLOPE_COLORS = ['#fff200', '#f29a1f', '#e0382d', '#8a3d9e', '#3a3a3a'];

/** A color table as a 64 x 1 texture, from js/ramps.js's hex. */
export function rampTexture(hex) {
  const d = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i++) { for (let k = 0; k < 3; k++) d[i * 4 + k] = parseInt(hex.substr(i * 6 + k * 2, 2), 16); d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, 64, 1);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

/** Uniforms every tile shares, by reference. */
export function sharedUniforms() {
  const dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  dummy.needsUpdate = true;
  return {
    uY0: { value: 0 }, uC0: { value: 1 }, uFlat: { value: 1 }, uCurv: { value: 1 }, uPx: { value: 1 },
    uTarget: { value: new THREE.Vector2() },
    uBase: { value: new THREE.Color(0xdfe5e3) },
    uSunOn: { value: 1 }, uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.4).normalize() }, uSunAlt: { value: 30 },
    uSunCol: { value: new THREE.Color(1.0, 0.96, 0.9) },
    uSkyCol: { value: new THREE.Color(0.44, 0.48, 0.58) },
    uNightCol: { value: new THREE.Color(0.16, 0.19, 0.27) },
    uShOn: { value: 0 },
    uShCore: { value: dummy }, uCoreRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uShShell: { value: dummy }, uShellRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uViewOn: { value: 0 }, uView: { value: dummy }, uViewRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uViewCol: { value: new THREE.Color(0x3fa7a0) }, uVeil: { value: new THREE.Vector4(0.96, 0.97, 0.98, 0.4) },
    uFogCol: { value: new THREE.Color(0xdfe7ef) }, uFog: { value: 0 },
    uSurface: { value: 0 }, uRelief: { value: new THREE.Color(0xc2bdb2) }, uWater: { value: new THREE.Color(0xa9cfe0) },
    uRamp: { value: dummy }, uRampRange: { value: new THREE.Vector2(0, 2500) },
    uSlopeOn: { value: 0 }, uSlopeCol: { value: SLOPE_COLORS.map((c) => new THREE.Color(c)) },
    uSnowMode: { value: 0 }, uSnowLine: { value: 1200 }, uSnowCol: { value: new THREE.Color(0xf6f9fb) },
    _dummy: dummy,
  };
}

/** One material per tile slot: the shared uniforms by reference, its own textures beside them. */
export function tileMaterial(shared) {
  const own = {
    uTile: { value: new THREE.Vector4() }, uSkirt: { value: 20 },
    uMap: { value: shared._dummy }, uMapXf: { value: new THREE.Vector4(0, 0, 1, 1) }, uMapOn: { value: 0 },
    uTrail: { value: shared._dummy }, uTrailXf: { value: new THREE.Vector4(0, 0, 1, 1) }, uTrailOn: { value: 0 },
    uNorm: { value: shared._dummy }, uNormXf: { value: new THREE.Vector4(0, 0, 1, 1) }, uNormOn: { value: 0 },
    uSnow: { value: shared._dummy }, uSnowXf: { value: new THREE.Vector4(0, 0, 1, 1) }, uSnowTexOn: { value: 0 },
  };
  const uniforms = { ...shared, ...own };
  delete uniforms._dummy;
  return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
}
