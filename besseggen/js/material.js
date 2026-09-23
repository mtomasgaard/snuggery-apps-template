// The terrain material. One ShaderMaterial carries every switchable shading layer, so turning a
// layer on costs a uniform rather than a geometry rebuild.
//
//   height       vertical exaggeration is applied here, not on the CPU, so the slider is one
//                uniform and the tiles never rebuild
//   normal       from the stored gradient (dh/dx, dh/dy in metres per metre), scaled by the
//                exaggeration so the shading matches the shape actually drawn
//   slope layer  from the RAW gradient, so "30 degrees and steeper" stays a fact about the
//                mountain rather than about the slider
//   contours     from the interpolated true height with fwidth(), so a 20 m line is one pixel
//                wide at every zoom instead of a smear
//   shadows      sampled from a mask the CPU sweeps whenever the sun moves (js/sun.js)

import * as THREE from '../vendor/three.module.js';
import { parseColor } from './util.js';

const MAX_BANDS = 8;

const VERT = /* glsl */`
  attribute float aHeight;
  attribute vec2 aGrad;
  attribute float aSkirt;
  uniform float uExag;
  varying float vH;
  varying vec3 vN;
  varying vec2 vG;
  varying float vSkirt;
  varying vec3 vScene;
  varying float vDepth;
  void main() {
    vec3 p = vec3(position.x, aHeight * uExag, position.z);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vScene = world.xyz;
    vH = aHeight;
    vG = aGrad;
    // The gradient is already in world metres per metre, so this is the world normal and must
    // not be run through normalMatrix (the model matrix scales x and z by the cell size).
    vN = normalize(vec3(-aGrad.x * uExag, 1.0, aGrad.y * uExag));
    vSkirt = aSkirt;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying float vH;
  varying vec3 vN;
  varying vec2 vG;
  varying float vSkirt;
  varying vec3 vScene;
  varying float vDepth;

  uniform vec3 uTerrain;
  uniform vec3 uTerrainLow;
  uniform vec3 uGlacierCol;
  uniform vec3 uWaterCol;
  uniform vec3 uSunlit;
  uniform vec3 uShadowCol;
  uniform vec3 uSlope30;
  uniform vec3 uSlope40;
  uniform vec4 uC20;
  uniform vec4 uC100;
  uniform vec3 uViewshedCol;
  uniform vec3 uFogCol;

  uniform vec3 uBandCol[${MAX_BANDS}];
  uniform float uBandTop[${MAX_BANDS}];
  uniform int uBandCount;

  uniform float uElevLow;
  uniform float uElevHigh;
  uniform float uExag;

  uniform vec3 uSunDir;          // toward the sun, scene space, normalised
  uniform float uSunUp;          // 1 when the sun is above the horizon
  uniform float uLayerSun;
  uniform float uLayerHill;
  uniform float uLayerSlope;
  uniform float uLayerBands;
  uniform float uLayerC20;
  uniform float uLayerC100;
  uniform float uLayerGlacier;
  uniform float uLayerWater;
  uniform float uLayerViewshed;
  uniform float uLayerShadow;

  uniform sampler2D uShadowCore;
  uniform sampler2D uShadowShell;
  uniform sampler2D uMask;
  uniform sampler2D uViewshedTex;
  uniform vec4 uCoreRect;        // x0, zNorth, res, 0
  uniform vec2 uCoreSize;
  uniform vec4 uShellRect;
  uniform vec2 uShellSize;
  uniform vec4 uMaskRect;
  uniform vec2 uMaskSize;
  uniform float uFogDensity;
  uniform float uHasViewshed;

  vec2 gridUV(vec3 p, vec4 rect, vec2 size) {
    vec2 g = vec2((p.x - rect.x) / rect.z, (p.z - rect.y) / rect.z);
    return (g + 0.5) / size;
  }
  bool inRect(vec2 uv) { return uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0; }

  vec3 bandColor(float h) {
    vec3 c = uBandCol[0];
    for (int i = 0; i < ${MAX_BANDS}; i++) {
      if (i >= uBandCount) break;
      if (h > uBandTop[i]) c = uBandCol[min(i + 1, uBandCount - 1)];
    }
    return c;
  }

  // Contours from the interpolated TRUE height, with fwidth() so a line is about a pixel wide at
  // any zoom, and faded out once the spacing would be finer than the screen can show — otherwise
  // a 20 m interval turns into a grey wash as soon as you zoom out.
  float contour(float h, float spacing) {
    float s = h / spacing;
    float w = fwidth(s);
    if (w > 0.34) return 0.0;
    float d = abs(fract(s + 0.5) - 0.5) / max(w, 1e-5);
    return (1.0 - smoothstep(0.35, 1.1, d)) * (1.0 - smoothstep(0.16, 0.34, w));
  }

  void main() {
    vec3 n = normalize(vN);
    float slopeRad = atan(length(vG));          // TRUE slope, exaggeration excluded
    float slopeDeg = degrees(slopeRad);

    // ---- base colour
    float t = clamp((vH - uElevLow) / max(1.0, uElevHigh - uElevLow), 0.0, 1.0);
    vec3 base = mix(uTerrainLow, uTerrain, smoothstep(0.0, 0.55, t));
    base = mix(base, bandColor(vH), uLayerBands);

    vec2 maskUV = gridUV(vScene, uMaskRect, uMaskSize);
    vec4 mask = inRect(maskUV) ? texture2D(uMask, maskUV) : vec4(0.0);
    base = mix(base, uGlacierCol, mask.g * uLayerGlacier * 0.92);
    // Lidar returns the water surface, not the bed, so the ground under a lake already sits at
    // the lake's level. Tinting it here is what makes a lake read even when the flat surface
    // mesh loses a depth test to a coarse terrain tile 15 km away.
    base = mix(base, uWaterCol, mask.r * uLayerWater * 0.85);

    // ---- slope layer
    if (uLayerSlope > 0.0) {
      float g30 = smoothstep(27.0, 33.0, slopeDeg);
      float g40 = smoothstep(37.0, 43.0, slopeDeg);
      vec3 s = mix(base, uSlope30, g30 * 0.75);
      s = mix(s, uSlope40, g40 * 0.85);
      base = mix(base, s, uLayerSlope);
    }

    // ---- light
    // Hillshade is the cartographer's fixed 315/45 lamp, independent of the real sun, so the
    // relief still reads at night or when the sun layer is off.
    vec3 hillDir = normalize(vec3(-0.707, 1.0, -0.707));
    float hill = clamp(dot(n, hillDir), 0.0, 1.0);
    float hillTerm = 0.32 + 0.68 * hill;

    float lambert = max(dot(n, uSunDir), 0.0);
    vec2 cUV = gridUV(vScene, uCoreRect, uCoreSize);
    float cast_ = 1.0;
    if (uLayerShadow > 0.5) {
      cast_ = inRect(cUV)
        ? texture2D(uShadowCore, cUV).r
        : texture2D(uShadowShell, gridUV(vScene, uShellRect, uShellSize)).r;
    }
    float sunTerm = lambert * mix(1.0, cast_, uLayerShadow) * uSunUp;

    // Two lights, added rather than blended: the sky (the palette's shadow colour) is what a
    // shadowed slope is actually lit by, and the sun is what is added on top of it. A luminance
    // floor keeps a very dark palette readable without throwing the palette away.
    // The sky term carries the fixed hillshade strongly, because when the whole visible slope is
    // in shadow — a west face at seven in the morning — it is the only thing showing the relief.
    vec3 amb = uShadowCol * (0.75 + 0.85 * hillTerm);
    float lum = dot(amb, vec3(0.299, 0.587, 0.114));
    amb *= max(1.0, 0.16 / max(lum, 0.01));
    vec3 col;
    if (uLayerSun > 0.5) {
      // A low sun puts lambert near 0.3 on flat ground, which is true but renders as mud. The
      // curve lifts the mid tones without letting a shadowed face pass for a lit one: where the
      // cast-shadow mask says 0, sunTerm is exactly 0 and the fragment stays in shadow.
      float k = pow(clamp(sunTerm, 0.0, 1.0), 0.75);
      col = base * min(amb + uSunlit * k * 1.05, vec3(1.25));
      col = mix(col, col * (0.72 + 0.42 * hillTerm), uLayerHill * 0.45);
    } else if (uLayerHill > 0.5) {
      col = base * min(amb * 0.8 + uSunlit * hillTerm * 0.85, vec3(1.25));
    } else {
      col = base * 0.95;
    }

    // ---- contours, from the true height
    float c100 = contour(vH, 100.0) * uLayerC100;
    float c20 = contour(vH, 20.0) * uLayerC20 * (1.0 - c100);
    col = mix(col, uC20.rgb, c20 * uC20.a);
    col = mix(col, uC100.rgb, c100 * uC100.a);

    // ---- viewshed
    // Tint what can be seen, and take light and colour out of what cannot. A tint on its own is
    // strong on the dark palette and weak on the light one, because light terrain already sits
    // near the overlay colour: measured over the same frame, mean |dRGB| was 111 in dark and 27
    // in light. Dimming the hidden ground is the half that works the same in both.
    if (uHasViewshed > 0.5 && uLayerViewshed > 0.5 && inRect(cUV)) {
      float vis = texture2D(uViewshedTex, cUV).r;
      col = mix(col, uViewshedCol, vis * 0.42);
      float grey = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(mix(col, vec3(grey), 0.22) * 0.88, col, vis);
    }

    // The apron is never seen from above the surface. If one is glimpsed at a silhouette it
    // should read as shadow, not as a wall.
    col = mix(col, col * 0.45, vSkirt);

    float fog = 1.0 - exp(-uFogDensity * vDepth);
    col = mix(col, uFogCol, clamp(fog, 0.0, 0.85));

    gl_FragColor = vec4(col, 1.0);
    // Everything above is LINEAR light: the palette is converted out of sRGB when it is loaded,
    // and the renderer expects linear in and converts on the way out. three.js only appends that
    // conversion to its own materials, so a custom shader has to ask for it — without this line
    // the whole terrain renders about a stop and a half too dark, which is exactly what it did.
    #include <colorspace_fragment>
  }
`;

export function makeTerrainMaterial() {
  const uniforms = {
    uExag: { value: 1 },
    uTerrain: { value: new THREE.Color(0xcfc6b4) },
    uTerrainLow: { value: new THREE.Color(0x9db183) },
    uGlacierCol: { value: new THREE.Color(0xe8eef2) },
    uWaterCol: { value: new THREE.Color(0x9fb9cf) },
    uSunlit: { value: new THREE.Color(0xfffaf0) },
    uShadowCol: { value: new THREE.Color(0x5a6b80) },
    uSlope30: { value: new THREE.Color(0xe67e22) },
    uSlope40: { value: new THREE.Color(0xc0392b) },
    uC20: { value: new THREE.Vector4(0, 0, 0, 0.1) },
    uC100: { value: new THREE.Vector4(0, 0, 0, 0.22) },
    uViewshedCol: { value: new THREE.Color(0x3fa7a0) },
    uFogCol: { value: new THREE.Color(0xdfe7ef) },
    uBandCol: { value: Array.from({ length: MAX_BANDS }, () => new THREE.Color(0x888888)) },
    uBandTop: { value: new Float32Array(MAX_BANDS) },
    uBandCount: { value: 0 },
    uElevLow: { value: 900 },
    uElevHigh: { value: 2300 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.45) },
    uSunUp: { value: 1 },
    uLayerSun: { value: 1 },
    uLayerHill: { value: 1 },
    uLayerSlope: { value: 0 },
    uLayerBands: { value: 0 },
    uLayerC20: { value: 0 },
    uLayerC100: { value: 1 },
    uLayerGlacier: { value: 1 },
    uLayerWater: { value: 1 },
    uLayerViewshed: { value: 1 },
    uLayerShadow: { value: 1 },
    uShadowCore: { value: null },
    uShadowShell: { value: null },
    uMask: { value: null },
    uViewshedTex: { value: null },
    uCoreRect: { value: new THREE.Vector4(0, 0, 16, 0) },
    uCoreSize: { value: new THREE.Vector2(1, 1) },
    uShellRect: { value: new THREE.Vector4(0, 0, 64, 0) },
    uShellSize: { value: new THREE.Vector2(1, 1) },
    uMaskRect: { value: new THREE.Vector4(0, 0, 16, 0) },
    uMaskSize: { value: new THREE.Vector2(1, 1) },
    uFogDensity: { value: 0.000018 },
    uHasViewshed: { value: 0 },
  };
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.FrontSide,
  });
}

export function applyPalette(mat, colors, scheme, elevation) {
  const p = (colors && colors[scheme]) || {};
  const set = (u, key, dflt) => {
    const c = parseColor(p[key] || dflt);
    mat.uniforms[u].value.setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace);
  };
  set('uTerrain', 'terrain', '#cfc6b4');
  set('uTerrainLow', 'terrainLow', '#9db183');
  set('uGlacierCol', 'glacier', '#e8eef2');
  set('uWaterCol', 'water', '#9fb9cf');
  set('uSunlit', 'sunlit', '#fffaf0');
  set('uShadowCol', 'shadow', '#5a6b80');
  set('uSlope30', 'slope30', '#e67e22');
  set('uSlope40', 'slope40', '#c0392b');
  set('uViewshedCol', 'viewshed', '#3fa7a0');
  set('uFogCol', 'sky', '#dfe7ef');

  const c20 = parseColor(p.contour20 || '#00000018');
  const c100 = parseColor(p.contour100 || '#00000038');
  // The palette's alpha is a hint, not a final opacity: a contour drawn at the file's own alpha
  // is invisible, and multiplied without a ceiling it turns a dark theme into a wireframe.
  mat.uniforms.uC20.value.set(c20.r, c20.g, c20.b, Math.min(0.38, Math.max(c20.a, 0.06) * 3.2));
  mat.uniforms.uC100.value.set(c100.r, c100.g, c100.b, Math.min(0.5, Math.max(c100.a, 0.1) * 2.6));

  const bands = (colors && colors.elevationBands) || [];
  const n = Math.min(bands.length, MAX_BANDS);
  for (let i = 0; i < n; i++) {
    const c = parseColor(bands[i].color);
    mat.uniforms.uBandCol.value[i].setRGB(c.r, c.g, c.b, THREE.SRGBColorSpace);
    mat.uniforms.uBandTop.value[i] = bands[i].toM;
  }
  mat.uniforms.uBandCount.value = n;
  if (elevation) {
    // Ramp over the CORE's range where the manifest gives one: the shell reaches 550 m twenty
    // kilometres away, and stretching the ramp to reach it washes out the ground you look at.
    const e = elevation.core || elevation;
    mat.uniforms.uElevLow.value = e.minM;
    mat.uniforms.uElevHigh.value = e.maxM;
  }
  mat.uniformsNeedUpdate = true;
}

// A single-channel mask over a flat grid, sampled with linear filtering so a shadow edge or a
// viewshed boundary comes out soft rather than blocky.
export function makeMaskTexture(data, w, h) {
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

export function setGridRect(mat, prefix, grid, frame) {
  mat.uniforms[`${prefix}Rect`].value.set(
    grid.x0 - frame.ox, -(grid.y1 - frame.oy), grid.res, 0,
  );
  mat.uniforms[`${prefix}Size`].value.set(grid.nx, grid.ny);
}
