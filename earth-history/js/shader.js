// The GLSL source strings (DESIGN §5). One full-screen triangle; the fragment shader inverts the
// orthographic or Mollweide projection per pixel and samples the equirectangular maps.

// §5.2: no buffers, an empty VAO, drawArrays(TRIANGLES, 0, 3).
export const VS = `#version 300 es
void main() {
  gl_Position = vec4(vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0, 0.0, 1.0);
}`;

// Shared: sampling a slot (§5.5) — a full map, or a proxy cell (§5.7) when uCell.x >= 0.
const SLOT = `
uniform sampler2D uProxy;
const vec3 EMPTY = vec3(0.16, 0.22, 0.30);           // nothing loaded yet (before the proxy sheet arrives)
vec2 proxyUV(vec2 cell, vec2 uv) {
  vec2 h = 0.5 / vec2(256.0, 128.0);
  return (cell + vec2(clamp(uv.x, h.x, 1.0 - h.x), clamp(uv.y, h.y, 1.0 - h.y))) / vec2(10.0, 9.0);
}
`;

export const FS = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uCenter;        // device px, y up (gl_FragCoord's frame)
uniform float uScale;        // device px per globe radius, or per Mollweide unit
uniform int uMode;           // 0 globe, 1 map
uniform float uLam0, uPhi0;  // view centre, radians
uniform float uPanY;         // map vertical pan, Mollweide units
uniform sampler2D uTexA, uTexB;
uniform vec2 uCellA, uCellB; // proxy cell (col, row), or (-1, -1) for a full map
uniform float uHasA, uHasB;
uniform float uMix;
uniform int uLens;           // 0 Surface; 1 a climate field in uClim through uLut (§5.6)
uniform sampler2D uClim, uLut;
uniform vec3 uSpace, uGlow;
uniform float uFade;         // the Earth's opacity over the night field: 0 → 1 as the opening fades it in
${SLOT}
out vec4 outColor;
const float PI = 3.141592653589793;
const float SQ2 = 1.4142135623730951;

// An integer hash: Chris Wellons' "lowbias32" mixer (hash-prospector, released into the public
// domain), for the dither of the night field; seeded, so it is the same on every frame.
uint mix32(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
float hash(vec2 cell, uint seed) {
  uvec2 q = uvec2(ivec2(floor(cell)) + 65536);
  return float(mix32(q.x ^ mix32(q.y ^ mix32(seed))) >> 8u) / 16777216.0;
}

vec3 slot(sampler2D tex, vec2 cell, float has, vec2 uv, vec2 gx, vec2 gy) {
  if (has < 0.5) return EMPTY;
  if (cell.x < 0.0) return textureGrad(tex, uv, gx, gy).rgb;
  return textureLod(uProxy, proxyUV(cell, uv), 0.0).rgb;
}

void main() {
  vec2 p = (gl_FragCoord.xy - uCenter) / uScale;
  float r2 = dot(p, p);
  float lam, phi, z = 0.0, inside;
  float sp = sin(uPhi0), cp = cos(uPhi0);
  if (uMode == 0) {
    z = sqrt(max(0.0, 1.0 - r2));
    phi = asin(clamp(z * sp + p.y * cp, -1.0, 1.0));
    lam = uLam0 + atan(p.x, z * cp - p.y * sp);
    inside = clamp((1.0 - sqrt(r2)) * uScale + 0.5, 0.0, 1.0);
  } else {
    vec2 q = vec2(p.x, p.y + uPanY);
    float th = asin(clamp(q.y / SQ2, -1.0, 1.0));
    phi = asin(clamp((2.0 * th + sin(2.0 * th)) / PI, -1.0, 1.0));
    lam = uLam0 + PI * q.x / (2.0 * SQ2 * max(cos(th), 1e-6));
    float f = (q.x / (2.0 * SQ2)) * (q.x / (2.0 * SQ2)) + (q.y / SQ2) * (q.y / SQ2) - 1.0;
    inside = clamp(0.5 - f / max(fwidth(f), 1e-6), 0.0, 1.0);
  }

  // §5.4: the antimeridian seam, derivatives in uniform control flow (before any per-pixel branch).
  float u = lam / (2.0 * PI) + 0.5;
  float v = 0.5 - phi / PI;
  float u1 = fract(u);
  float u2 = fract(u + 0.5) - 0.5;
  float dux = abs(dFdx(u1)) < abs(dFdx(u2)) ? dFdx(u1) : dFdx(u2);
  float duy = abs(dFdy(u1)) < abs(dFdy(u2)) ? dFdy(u1) : dFdy(u2);
  vec2 gx = vec2(dux, dFdx(v)), gy = vec2(duy, dFdy(v));
  vec2 uv = vec2(u1, v);

  vec3 a = slot(uTexA, uCellA, uHasA, uv, gx, gy);
  vec3 b = slot(uTexB, uCellB, uHasB, uv, gx, gy);
  vec3 col = mix(a, b, uMix);

  if (uLens > 0) {
    // §5.6: nodes at texel centres; a fractional byte through the 256-entry table.
    float lonDeg = fract(lam / (2.0 * PI)) * 360.0;
    float latDeg = phi / PI * 180.0;
    vec2 cuv = vec2(lonDeg / 360.0 + 0.5 / 96.0, ((90.0 - latDeg) / 2.5 + 0.5) / 73.0);
    float byteV = textureLod(uClim, cuv, 0.0).r * 255.0;
    vec4 lens = textureLod(uLut, vec2((byteV + 0.5) / 256.0, 0.5), 0.0);
    vec3 base = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), 0.6) * 0.55;
    col = mix(base, lens.rgb, 0.72 * lens.a);
  }

  // The night field (§19): the space colour, a faint navy deepening toward the Earth, and a dither
  // of a quarter of a level so the dark gradient does not band. No stars: an atlas plate, not a sky.
  float rv = uMode == 0 ? sqrt(r2) : length(vec2(p.x / (2.0 * SQ2), (p.y + uPanY) / SQ2));
  vec3 bg = uSpace + vec3(0.016, 0.028, 0.060) * exp(-1.4 * max(rv - 0.8, 0.0));
  bg += (hash(gl_FragCoord.xy, 13u) - 0.5) / 255.0;
  if (uMode == 0) {
    // §5.9, §19: display effects, globe only — soft lambert shading kept shallow so the painted map
    // reads, and an atmosphere: a thin scattering rim on the lit side and a halo just outside it.
    // No terminator: every longitude is lit, because nothing in the data says where the Sun was.
    vec3 n = vec3(p, z);
    vec3 L = normalize(vec3(-0.45, 0.55, 0.70));
    col *= (0.82 + 0.18 * max(dot(n, L), 0.0)) * (0.90 + 0.10 * z);
    float r = sqrt(r2);
    float lit = 0.35 + 0.65 * smoothstep(-0.6, 0.9, dot(p / max(r, 1e-6), normalize(L.xy)));
    col += uGlow * pow(1.0 - z, 4.0) * 0.30 * lit;
    float d = max(r - 1.0, 0.0);
    bg += uGlow * (0.62 * exp(-d / 0.02) * lit + 0.07 * exp(-d / 0.14)) * uFade;
  }
  outColor = vec4(mix(bg, col, inside * uFade), 1.0);
}`;

// §5.5: "a change arriving mid-blend starts a new blend from the current mix frozen into A" —
// the mix rendered into an equirectangular 1024 × 512 texture that becomes slot A.
export const FREEZE_FS = `#version 300 es
precision highp float;
uniform sampler2D uTexA, uTexB;
uniform vec2 uCellA, uCellB;
uniform float uHasA, uHasB, uMix;
${SLOT}
out vec4 outColor;
vec3 slotLod(sampler2D tex, vec2 cell, float has, vec2 uv) {
  if (has < 0.5) return EMPTY;
  if (cell.x < 0.0) return textureLod(tex, uv, 0.0).rgb;
  return textureLod(uProxy, proxyUV(cell, uv), 0.0).rgb;
}
void main() {
  vec2 uv = gl_FragCoord.xy / vec2(1024.0, 512.0);    // row 0 written first = v 0 = 90° N, as the maps
  outColor = vec4(mix(slotLod(uTexA, uCellA, uHasA, uv), slotLod(uTexB, uCellB, uHasB, uv), uMix), 1.0);
}`;
