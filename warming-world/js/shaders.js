// The GLSL sources (DESIGN §5.4). One full-screen triangle; the fragment shader inverts the
// orthographic globe or the Equal Earth map per device pixel, finds the 2° cell, and reads its byte
// from the R8 array texture's layer for the step on screen — texelFetch, the nearest cell, never
// interpolated — then its color from the 256 × 1 LUT, or the hatch where the byte is 255. Outside the
// Earth it is the card, flat: no lighting, limb light, atmosphere or glow, ever (ART "Never").

// §5.2: no buffers, an empty VAO, drawArrays(TRIANGLES, 0, 3) (Earth's History's triangle).
export const VS = `#version 300 es
void main() {
  gl_Position = vec4(vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0, 0.0, 1.0);
}`;

export const FS = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2DArray;
precision highp isampler2D;
precision highp isampler2DArray;
uniform highp sampler2DArray uData;   // 180 × 90 × L, R8, row 0 = 88–90° N, column 0 = 180–178° W
uniform sampler2D uLut;               // 256 × 1 RGBA8: byte → the ramp's color (ramp.js)
uniform int uProj;                    // 0 globe, 1 map
uniform int uLayer;                   // the step on screen
uniform vec2 uCenter;                 // device px, y up (gl_FragCoord's frame)
uniform float uScale;                 // device px per globe radius, or per Equal Earth unit
uniform float uLam0, uPhi0;           // the view's centre, radians
uniform float uPanY;                  // the map's vertical pan, Equal Earth units
uniform float uDpr;                   // device px per CSS px (the hatch is laid out in CSS px)
uniform vec3 uCard;                   // --card, the ground
// plan 0012 3.3: a chosen baseline (each cell's mean over the span, tenths, −32768 for none) and the
// Absolute mode (the 1951–1980 climatology in tenths, 14 layers; its own LUT, −60.0 … +40.0 °C)
uniform highp isampler2D uBase;       // 180 × 90 R16I
uniform highp isampler2DArray uClim;  // 180 × 90 × 14 R16I
uniform sampler2D uLutAbs;            // 1024 × 1 RGBA8: entry i is (i − 600) tenths
uniform int uBaseOn, uAbs, uClimLayer;
out vec4 outColor;

const float PI = 3.141592653589793;
const float A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = 0.8660254037844386;
const float YMAX = 1.3173627591574;
const vec3 HATCH_GROUND = vec3(152.0 / 255.0);   // OKLab L 0.68
const vec3 HATCH_LINE = vec3(128.0 / 255.0);     // OKLab L 0.60

void main() {
  vec2 p = (gl_FragCoord.xy - uCenter) / uScale;
  float lam, phi, inside;
  if (uProj == 0) {
    float r2 = dot(p, p);
    float z = sqrt(max(0.0, 1.0 - r2));
    float sp = sin(uPhi0), cp = cos(uPhi0);
    phi = asin(clamp(z * sp + p.y * cp, -1.0, 1.0));
    lam = uLam0 + atan(p.x, z * cp - p.y * sp);
    inside = clamp((1.0 - sqrt(r2)) * uScale + 0.5, 0.0, 1.0);
  } else {
    float y = p.y + uPanY;
    float th = clamp(y, -YMAX, YMAX);
    float yc = th;
    for (int k = 0; k < 6; k++) {                       // Newton for θ, from θ = y (DESIGN §5.4)
      float t2 = th * th, t6 = t2 * t2 * t2;
      th -= (th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - yc) / (A1 + 3.0 * A2 * t2 + t6 * (7.0 * A3 + 9.0 * A4 * t2));
    }
    float t2 = th * th, t6 = t2 * t2 * t2;
    float dl = M * p.x * (A1 + 3.0 * A2 * t2 + t6 * (7.0 * A3 + 9.0 * A4 * t2)) / cos(th);
    lam = uLam0 + dl;
    phi = asin(clamp(sin(th) / M, -1.0, 1.0));
    float fx = abs(dl) - PI, fy = abs(y) - YMAX;        // the outline's implicit functions
    inside = clamp(0.5 - fx / max(fwidth(fx), 1e-6), 0.0, 1.0) * clamp(0.5 - fy / max(fwidth(fy), 1e-6), 0.0, 1.0);
  }
  // The cell (CONTRACT §4): longitude wrapped into [−180, 180), nearest cell, no interpolation.
  float lond = degrees(lam);
  lond -= floor((lond + 180.0) / 360.0) * 360.0;
  int col = min(179, int(floor((lond + 180.0) * 0.5)));
  int row = clamp(int(floor((90.0 - degrees(phi)) * 0.5)), 0, 89);
  int b = int(texelFetch(uData, ivec3(col, row, uLayer), 0).r * 255.0 + 0.5);
  vec3 c;
  int v = b - 127, nil = 0;                             // tenths of a degree, integers end to end
  if (b != 255 && uAbs == 1) {
    int t = texelFetch(uClim, ivec3(col, row, uClimLayer), 0).r;
    if (t == -32768) nil = 1; else v += t;
  } else if (b != 255 && uBaseOn == 1) {
    int s = texelFetch(uBase, ivec2(col, row), 0).r;
    if (s == -32768) nil = 1; else v -= s;
  }
  if (b == 255 || nil == 1) {
    // No data: a hatch fixed to the screen, 45°, 6 CSS px along a row, lines 1.5 CSS px across
    // (ART's study geometry), so absence is drawn and reads darker than the card.
    float t = mod((gl_FragCoord.x - gl_FragCoord.y) / uDpr, 6.0);
    c = t < 2.1213203 ? HATCH_LINE : HATCH_GROUND;
  } else {
    c = uAbs == 1 ? texelFetch(uLutAbs, ivec2(clamp(v + 600, 0, 1000), 0), 0).rgb : texelFetch(uLut, ivec2(clamp(v + 127, 0, 254), 0), 0).rgb;
  }
  outColor = vec4(mix(uCard, c, inside), 1.0);
}`;
