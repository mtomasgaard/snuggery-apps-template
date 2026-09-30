// GLSL (DESIGN §5.2, §5.3, §6). The point shader: window, floor, view, age fade, the play trace, the
// corridor dimming and the arrivals' fade are uniforms; fill by depth in OKLab, rim by depth, hollow when
// automatic and live (never smaller than an M 4 dot), × for no magnitude. The relief shader: shade below
// neutral, light above it, faded over its edges where uEdge says (the CONUS tile).

export const POINT_VS = `#version 300 es
precision highp float; precision highp int;
layout(location=0) in uint aT; layout(location=1) in float aX; layout(location=2) in float aY;
layout(location=3) in float aD; layout(location=4) in uint aM; layout(location=5) in uint aF;
uniform uint uT0, uT1, uTrace0, uMmin, uLive, uNewFrom;
uniform int uNoMag, uFade, uSecOn;
uniform vec2 uCenter, uCanvas;
uniform float uScale, uDpr, uK, uMaxPt, uNewT, uNewSpan, uSecHalf, uSecLen;
uniform vec3 uLab[6], uInk, uSecA, uSecN;
uniform float uDep[6];
out vec4 vFill; out vec4 vRim; out float vR; out float vHole; out float vKind; out float vSize;
const float PI = 3.14159265358979;
vec3 srgb(vec3 lab) {
  float l = pow(lab.x + 0.3963377774*lab.y + 0.2158037573*lab.z, 3.0);
  float m = pow(lab.x - 0.1055613458*lab.y - 0.0638541728*lab.z, 3.0);
  float s = pow(lab.x - 0.0894841775*lab.y - 1.291485548*lab.z, 3.0);
  vec3 c = clamp(vec3(4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
    -1.2684380046*l + 2.6097574011*m - 0.3413193965*s, -0.0041960863*l - 0.7034186147*m + 1.707614701*s), 0.0, 1.0);
  return mix(12.92*c, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  bool vis = aT >= uT0 && aT < uT1 && (aM == 255u ? uNoMag == 1 : aM >= uMmin);
  bool trace = !vis && aT >= uTrace0 && aT < uT0 && aM != 255u && aM >= uMmin;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0;
  if (!vis && !trace) return;
  float lon = aX * 0.002, lat = 17.0 + aY * 0.001;
  float X = lon / 360.0;
  float Y = (log(tan(PI/4.0 + 72.0*PI/360.0)) - log(tan(PI/4.0 + lat*PI/360.0))) / (2.0*PI);
  vec2 p = (vec2(X, Y) - uCenter) * uScale;
  gl_Position = vec4(p.x / (uCanvas.x * 0.5), -p.y / (uCanvas.y * 0.5), 0.0, 1.0);
  float a = 1.0;
  if (uFade == 1) a = mix(0.30, 0.90, clamp(float(aT - uT0) / max(1.0, float(uT1 - uT0)), 0.0, 1.0));
  else if (uFade == 0) a = 0.5;
  if (uSecOn == 1) {
    float la = radians(lat), lo = radians(172.0 + lon);
    vec3 q = vec3(cos(la)*cos(lo), cos(la)*sin(lo), sin(la));
    float xt = asin(clamp(dot(q, uSecN), -1.0, 1.0)) * 6371.0088;
    vec3 pp = normalize(q - dot(q, uSecN) * uSecN);
    float at = atan(dot(cross(uSecA, pp), uSecN), dot(pp, uSecA)) * 6371.0088;
    if (abs(xt) > uSecHalf || at < 0.0 || at > uSecLen) a *= 0.25;
  }
  // arrivals fade in over 400 ms, staggered by time across 600 ms; size never changes
  if (aT >= uNewFrom) a *= clamp((uNewT * 600.0 - float(aT - uNewFrom) / uNewSpan * 200.0) / 400.0, 0.0, 1.0);
  if (trace) {
    vKind = 2.0; vSize = 1.6 * uDpr + 2.0; vR = 0.8 * uDpr; vFill = vec4(uInk, 0.14); vRim = vec4(0.0); vHole = -1.0;
  } else if (aM == 255u) {
    vKind = 1.0; vSize = 6.0 * uDpr + 2.0; vR = 3.0 * uDpr; vFill = vec4(uInk, a); vRim = vec4(0.0); vHole = -1.0;
  } else {
    float M = (float(aM) - 20.0) / 10.0;
    float d = clamp(2.2 * pow(1.41421356, M - 2.5), 2.0, 40.0) * uK * uDpr;
    bool hollow = (aF & 3u) == 1u && aT >= uLive;
    // a hollow ring is never smaller than an M 4 dot (3.70 px), so its hole shows (js/ramp.js hollowSize)
    if (hollow) d = max(d, 3.6999 * uK * uDpr);
    vKind = 0.0; vR = d * 0.5; vSize = d + 4.0;
    vec3 c;
    if (aD > 65534.5) c = vec3(0.541, 0.565, 0.600);
    else {
      float km = clamp(aD / 100.0 - 5.0, 0.0, 300.0);
      int i = 0;
      for (int k = 0; k < 4; k++) if (km > uDep[k + 1]) i = k + 1;
      float f = (km - uDep[i]) / (uDep[i + 1] - uDep[i]);
      c = srgb(mix(uLab[i], uLab[i + 1], f));
    }
    vFill = vec4(c, a);
    bool deep = aD < 65534.5 && aD / 100.0 - 5.0 >= 60.0;
    vRim = deep ? vec4(1.0, 1.0, 1.0, 0.5 * a) : vec4(0.0627, 0.0784, 0.0941, 0.55 * a);
    vHole = hollow ? vR - max(0.9 * uDpr, 0.18 * d) : -1.0;
  }
  gl_PointSize = min(vSize, uMaxPt);
}`;

export const POINT_FS = `#version 300 es
precision highp float;
in vec4 vFill; in vec4 vRim; in float vR; in float vHole; in float vKind; in float vSize;
out vec4 o;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * vSize;
  if (vKind == 1.0) {
    float e = min(abs(q.x - q.y), abs(q.x + q.y)) * 0.7071;
    float c = clamp(1.25 - e, 0.0, 1.0) * step(max(abs(q.x), abs(q.y)), vR);
    if (c <= 0.0) discard;
    o = vec4(vFill.rgb, 1.0) * vFill.a * c; return;
  }
  float r = length(q);
  float fill = clamp(vR - r + 0.5, 0.0, 1.0);
  if (vHole >= 0.0) fill *= clamp(r - vHole + 0.5, 0.0, 1.0);
  float rim = clamp(vR + 1.0 - r + 0.5, 0.0, 1.0) * (1.0 - clamp(vR - r + 0.5, 0.0, 1.0));
  float fa = fill * vFill.a, ra = rim * vRim.a;
  if (fa + ra <= 0.0) discard;
  o = vec4(vFill.rgb * fa + vRim.rgb * ra * (1.0 - fa), fa + ra * (1.0 - fa));
}`;

export const RELIEF_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos; layout(location=1) in vec2 aUV;
uniform vec2 uCenter, uCanvas; uniform float uScale;
out vec2 vUV;
void main() {
  vec2 p = (aPos - uCenter) * uScale;
  gl_Position = vec4(p.x / (uCanvas.x * 0.5), -p.y / (uCanvas.y * 0.5), 0.0, 1.0);
  vUV = aUV;
}`;

export const RELIEF_FS = `#version 300 es
precision highp float;
in vec2 vUV; uniform sampler2D uTex; uniform float uN, uDark, uLight; uniform vec2 uEdge;
out vec4 o;
void main() {
  float v = texture(uTex, vUV).r;
  if (v < uN) { float d = clamp((uN - v) / uN, 0.0, 1.0) * uDark; o = vec4(0.0, 0.0, 0.0, d); }
  else { float l = clamp((v - uN) / (1.0 - uN), 0.0, 1.0) * uLight; o = vec4(l, l, l, l); }
  if (uEdge.x > 0.0) o *= smoothstep(0.0, uEdge.x, min(vUV.x, 1.0 - vUV.x)) * smoothstep(0.0, uEdge.y, min(vUV.y, 1.0 - vUV.y));
}`;
