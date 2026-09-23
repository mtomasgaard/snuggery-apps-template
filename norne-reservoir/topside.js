// Norne topside layer — the platform, the seabed, the subsea templates, the pipelines, and the
// flow along them. Everything here is optional and off by default: with every toggle off this
// module draws nothing, sets no dirty flag, and costs one function call per frame.
//
// It never reaches into the reservoir code. app.js hands it { gl, model, cfg, S, R, G, api } and
// calls a few one-line hooks; everything else lives in this file and in data/topside.json.
//
// Coordinates. A model point is [x, y, depth] in metres: x = easting - centre, y = northing -
// centre, depth positive downwards and ABSOLUTE (0 = sea level). The app maps a model point to
// world as (x, -(depth - centre.depth) * exag, -y), so this module subtracts the centre depth
// once, on load, and then uses exactly the three components the grid and well shaders use.

const MAX_LINES = 64;          // uGate is 16 vec4s
const MARK_PERIOD = 34;        // CSS px between flow marks, screen space
const MARK_DUTY = 0.34;        // fraction of the period that is drawn
const FLOW_FPS = 30;           // cap on the animated redraw

const TOGGLES = [
  { id: 'sea', label: 'Sea surface and seabed', hint: 'true depth · sets the vertical scale to ×1' },
  { id: 'fpso', label: 'Norne FPSO', hint: 'on the water in 378 m — the hull shape is schematic' },
  { id: 'templates', label: 'Subsea templates', hint: 'B C D E F K — each from its own in-service date' },
  { id: 'flowlines', label: 'Flowlines and risers to the FPSO — schematic', hint: 'no in-field route is published' },
  { id: 'wellties', label: 'Wells up to their templates — schematic', hint: 'the drawn well paths stop about 2 km below the seabed' },
  { id: 'exportline', label: 'Gas export line', hint: '16″ · real route · drawn on the seabed plane, so the depth is schematic' },
  { id: 'oil', label: 'Oil offloading — schematic', hint: 'by shuttle tanker; no published destination' },
  { id: 'later', label: 'Later facilities (M, 2010)', hint: 'outside this history, drawn hollow' },
  { id: 'network', label: 'Export network map', hint: 'the trunk lines, the terminals and the coast' },
  { id: 'reported', label: 'Reported production (NOD)', hint: 'what the field actually made, in the chart' },
];
const FLUIDS = [
  { id: 'oil', label: 'Oil', css: '--c-oil', key: 'oil', ref: 'oil', produced: true },
  { id: 'gas', label: 'Gas', css: '--c-gas', key: 'gas', ref: 'gas', produced: true },
  { id: 'water', label: 'Water', css: '--c-water', key: 'water', ref: 'water', produced: true },
  { id: 'winj', label: 'Water injected', css: '--c-water', key: 'winj', ref: 'winj', produced: false },
  { id: 'ginj', label: 'Gas injected', css: '--c-gas', key: 'ginj', ref: 'ginj', produced: false },
];
// Which toggle switches each kind of line on. A riser is part of the flowline story.
const LINE_GROUP = {
  flowline: 'flowlines', riser: 'flowlines', tie: 'exportline',
  export: 'exportline', oilExport: 'oil', welltie: 'wellties',
};
const SHOW_FIELD = ['sea', 'fpso', 'templates', 'flowlines', 'exportline'];
const SCHEMATIC_WORDS = { route: 'the route', shape: 'the shape', heading: 'the heading', depth: 'the depth', destination: 'the destination' };

const T = {
  ok: false, err: '', D: null, gl: null, model: null, cfg: null, S: null, R: null, G: null, api: null,
  on: null, flow: null, raw: null, view: null, theme: null,
  lines: [], facs: [], byId: new Map(), wellTpl: new Map(), labels: [], labelIds: new Set(),
  geomSig: '', markSig: '', sel: null, netMod: null, net: null,
  t0: 0, lastFlow: 0, hidden: false, netOpen: false, sheetWas: null, renders: 0, ms: 0, msAvg: 0, tDraw: 0,
  tPrev: 0, fMs: 0, fMsAvg: 0, fSamples: 0,
  pxPerM: 1, pxPerWorld: 1, vp: [1, 1], flowActive: 0, flowMps: 0, dropped: 0,
  gateBuf: null, flowPlan: null, flowPlanSig: '',
  glReady: false, glFailed: false,
};

// One integer that changes whenever anything a drawn gate depends on changes. Used to keep the
// per-frame work out of draw(): with it, a frame that changes nothing re-uploads uniforms and
// draws, but recomputes no rates.
function stateBits() {
  let b = 0, i = 0;
  if (T.on.master) b |= 1 << i; i++;
  for (const t of TOGGLES) { if (T.on[t.id]) b |= 1 << i; i++; }
  if (T.flow.master) b |= 1 << i; i++;
  for (const f of FLUIDS) { if (T.flow[f.id]) b |= 1 << i; i++; }
  if (T.S.wells) b |= 1 << i;
  return b;
}

const $ = (id) => document.getElementById(id);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- shaders
const PLANE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in vec2 aUV;
uniform mat4 uMV, uP; uniform float uExag;
out vec4 vC; out vec2 vUV;
void main(){ vC = aCol; vUV = aUV; gl_Position = uP * uMV * vec4(aPos.x, -aPos.z * uExag, -aPos.y, 1.0); }`;
const PLANE_FS = `#version 300 es
precision highp float; in vec4 vC; in vec2 vUV; out vec4 o;
void main(){
  float r = max(abs(vUV.x), abs(vUV.y));
  o = vec4(vC.rgb, vC.a * (0.34 + 0.66 * (1.0 - smoothstep(0.55, 1.0, r))));
}`;

const MARK_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aCorner; layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aGeom; layout(location=4) in vec3 aRef;
uniform mat4 uMV, uP; uniform float uExag, uPxPerWorld; uniform vec2 uVP;
out vec2 vUV; out vec4 vC; flat out int vShape;
vec4 clipOf(vec3 p){ return uP * uMV * vec4(p.x, -p.z * uExag, -p.y, 1.0); }
void main(){
  vec4 c = clipOf(aPos);
  if (c.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vUV = vec2(0.0); vC = vec4(0.0); vShape = 0; return; }
  float px = max(aGeom.x * uPxPerWorld / c.w, aGeom.y);
  vec2 dir = vec2(1.0, 0.0);
  if (aGeom.w > 0.5) {
    vec4 r = clipOf(aRef);
    if (r.w > 0.0) { vec2 d = r.xy / r.w * uVP - c.xy / c.w * uVP; if (length(d) > 0.001) dir = normalize(d); }
  }
  vec2 off = vec2(aCorner.x * dir.x - aCorner.y * dir.y, aCorner.x * dir.y + aCorner.y * dir.x) * px;
  c.xy += off / uVP * c.w;
  gl_Position = c;
  vUV = aCorner; vC = aCol; vShape = int(aGeom.z + 0.5);
}`;
const MARK_FS = `#version 300 es
precision highp float; precision highp int;
in vec2 vUV; in vec4 vC; flat in int vShape;
uniform vec3 uOutline;
out vec4 o;
float shapeOf(int s, vec2 p){
  if (s == 1) return max(abs(p.x), abs(p.y)) - 0.74;                       // template
  if (s == 2) return (abs(p.x) + abs(p.y)) * 0.72 - 0.60;                  // riser base
  if (s == 3) {                                                            // ship, bow at +x
    float hw = 0.40 * clamp((1.0 - p.x) / 0.60, 0.0, 1.0);
    return max(abs(p.x) - 0.94, abs(p.y) - hw);
  }
  if (s == 4) {                                                            // arrow, point at +x
    vec2 q = p - vec2(0.85, 0.0);
    float d1 = dot(q, vec2(0.3657, 0.9309)), d2 = dot(q, vec2(0.3657, -0.9309));
    return max(max(d1, d2), -(p.x + 0.45));
  }
  return length(p) - 0.78;                                                 // 0: dot
}
void main(){
  float d = shapeOf(vShape == 5 ? 1 : vShape, vUV);
  float aa = fwidth(d) + 1e-5;
  float fill = 1.0 - smoothstep(-aa, aa, d);
  float ring = 1.0 - smoothstep(-aa, aa, abs(d + 0.13) - 0.085);
  float a = (vShape == 5 ? ring : fill) * vC.a;
  if (a < 0.006) discard;
  o = vec4(vShape == 5 ? vC.rgb : mix(vC.rgb, uOutline, ring * 0.85), a);
}`;

const PATH_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aA; layout(location=1) in vec3 aB; layout(location=2) in vec2 aSE;
layout(location=3) in vec2 aS; layout(location=4) in float aLine; layout(location=5) in vec4 aCol;
layout(location=6) in float aDash;
uniform mat4 uMV, uP; uniform float uExag, uWidth; uniform vec2 uVP;
uniform vec4 uGate[16]; uniform int uMode; uniform vec4 uFlowCol;
out float vS; out vec4 vC; out float vDash; out float vSpd;
vec4 clipOf(vec3 p){ return uP * uMV * vec4(p.x, -p.z * uExag, -p.y, 1.0); }
void dropIt(){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vS = 0.0; vC = vec4(0.0); vDash = 0.0; vSpd = 0.0; }
void main(){
  int li = int(aLine + 0.5);
  float g = uGate[li >> 2][li & 3];
  if (abs(g) < 1e-6 || (uMode == 0 && aDash < 0.0)) { dropIt(); return; }
  vec4 a = clipOf(aA), b = clipOf(aB);
  if (a.w <= 0.0 || b.w <= 0.0) { dropIt(); return; }
  vec4 cur = aSE.y < 0.5 ? a : b;
  vec2 sa = a.xy / a.w * uVP, sb = b.xy / b.w * uVP;
  vec2 d = sb - sa; d = length(d) < 1e-4 ? vec2(1.0, 0.0) : normalize(d);
  cur.xy += vec2(-d.y, d.x) * aSE.x * uWidth / uVP * cur.w;
  gl_Position = cur;
  vS = aSE.y < 0.5 ? aS.x : aS.y;
  vC = uMode == 1 ? uFlowCol : vec4(aCol.rgb, aCol.a * min(1.0, abs(g)));
  vDash = max(aDash, 0.0); vSpd = g;
}`;
const PATH_FS = `#version 300 es
precision highp float; precision highp int;
in float vS; in vec4 vC; in float vDash; in float vSpd;
uniform float uPxPerM, uTime, uPeriod, uDuty, uPhase; uniform int uMode;
out vec4 o;
void main(){
  float a = vC.a;
  if (uMode == 1) {
    float q = (vS * uPxPerM - uTime * vSpd + uPhase) / uPeriod;
    float w = fwidth(q);
    if (w > 0.34) a *= 0.30;                       // marks closer than a pixel: fade, never alias
    else a *= smoothstep(uDuty + w, uDuty - w, fract(q));
  } else if (vDash > 0.5) {
    float q = vS * uPxPerM / vDash;
    float w = fwidth(q);
    if (w < 0.34) a *= smoothstep(0.58 + w, 0.58 - w, fract(q));
  }
  if (a < 0.01) discard;
  o = vec4(vC.rgb, a);
}`;

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('topside shader: ' + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('topside link: ' + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function attribs(gl, list, stride) {
  let off = 0;
  for (const [loc, n] of list) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, n, gl.FLOAT, false, stride, off);
    off += n * 4;
  }
}

// ---------------------------------------------------------------- colour
function rgbOf(hexStr) {
  const h = hexStr.length === 4 ? '#' + [...hexStr.slice(1)].map((c) => c + c).join('') : hexStr;
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function cssRGB(name, fallback) {
  return rgbOf((getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback));
}
function themeColours() {
  return {
    ink: cssRGB('--ink', '#15222A'), muted: cssRGB('--muted', '#5A6A73'),
    accent: cssRGB('--accent', '#A8740F'), outline: cssRGB('--stage', '#DDE4E5'),
    oil: cssRGB('--c-oil', '#2E8B4E'), water: cssRGB('--c-water', '#2F6FC4'), gas: cssRGB('--c-gas', '#C8423A'),
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
  };
}
function theme() { return T.theme || (T.theme = themeColours()); }
function fluidColour(fl) {
  const C = theme();
  return fl.css === '--c-oil' ? C.oil : fl.css === '--c-water' ? C.water : C.gas;
}

// ---------------------------------------------------------------- state
function defaultState() { const on = { master: false }; for (const t of TOGGLES) on[t.id] = false; return on; }
function defaultFlow() { const f = { master: false }; for (const fl of FLUIDS) f[fl.id] = false; return f; }
function sanitize(raw) {
  const on = defaultState(), flow = defaultFlow();
  if (raw && typeof raw === 'object') {
    for (const k in on) if (typeof raw[k] === 'boolean') on[k] = raw[k];
    if (raw.flow && typeof raw.flow === 'object') for (const k in flow) if (typeof raw.flow[k] === 'boolean') flow[k] = raw.flow[k];
  }
  return { on, flow };
}

// ---------------------------------------------------------------- load + validate
// The data file is 13.7 KB and its fetch sits on the path to first paint, so it is started the
// moment this module is imported — while app.js is still pulling the reservoir's 25 MB of
// binaries — rather than when main() reaches the topside. The promise never rejects (a failure
// resolves to { err }), so nothing has to catch it before start() does.
const PREFETCH = (async () => {
  try {
    const r = await fetch('data/topside.json', { cache: 'no-store' });
    if (!r.ok) return { err: `data/topside.json returned ${r.status}` };
    return { json: await r.json() };
  } catch (e) { return { err: String((e && e.message) || e) }; }
})();

async function loadData() {
  const pre = await PREFETCH;
  if (pre.err) throw new Error(pre.err);
  const d = pre.json;
  const m = T.model;
  if (d.schemaVersion !== 1 || d.kind !== 'norne-topside') throw new Error('unexpected schema');
  if (d.frameCount !== m.frames.length) throw new Error(`frameCount ${d.frameCount} against ${m.frames.length} frames`);
  if (!Array.isArray(d.modelCentre)) throw new Error('no model centre');
  for (let i = 0; i < 3; i++) if (Math.abs(d.modelCentre[i] - m.center[i]) > 0.01) throw new Error('model centre does not match');
  for (const k of ['oil', 'gasSold', 'water']) {
    if (!Array.isArray(d.production[k]) || d.production[k].length !== m.frames.length) throw new Error(`production.${k} is not ${m.frames.length} long`);
  }
  if (!Array.isArray(d.facilities) || !Array.isArray(d.lines) || !d.sea) throw new Error('facilities, lines or sea missing');
  return d;
}

// ---------------------------------------------------------------- geometry
function mp(x, y, depth) { return [x, y, depth - T.model.center[2]]; }

function buildFacilities() {
  T.facs = []; T.byId.clear();
  const surface = (T.D.sea && typeof T.D.sea.surfaceDepth === 'number') ? T.D.sea.surfaceDepth : 0;
  for (const f of T.D.facilities) {
    // A facility's `depth` is the water depth under it. Everything subsea is drawn at that depth;
    // the vessel floats, so it is drawn at the sea surface — which is where the file already puts
    // the top of its riser ([x, y, 378] → [x, y, 0]) and the start of the oil leg.
    const drawDepth = f.kind === 'fpso' ? surface : f.depth;
    const rec = {
      ...f, drawDepth, p: mp(f.x, f.y, drawDepth),
      group: f.kind === 'fpso' ? 'fpso' : f.kind === 'riserBase' ? 'exportline' : f.later ? 'later' : 'templates',
      shapeId: f.kind === 'fpso' ? 3 : f.kind === 'riserBase' ? 2 : f.later ? 5 : 1,
      sizeM: f.kind === 'fpso' ? (f.lengthM || 250) : f.kind === 'riserBase' ? 90 : 120,
      minPx: f.kind === 'fpso' ? 17 : f.kind === 'riserBase' ? 8 : 11,
    };
    T.facs.push(rec); T.byId.set(f.id, rec);
  }
}

function lineColour(kind) {
  const C = theme();
  if (kind === 'oilExport') return [...C.oil, 0.95];
  if (kind === 'export') return [...C.ink, 0.8];
  if (kind === 'tie') return [...C.ink, 0.65];
  if (kind === 'welltie') return [...C.muted, 0.95];
  return [...C.muted, 0.95];                       // flowlines and risers
}

// One buffer holds every path: the published and schematic lines first (they are also the ones
// drawn statically), then one path per well for the flow marks. A line is identified by its
// index, which the gate uniform is indexed by; a segment with aDash < 0 is never drawn
// statically, which is how a well's own path can carry marks without being redrawn as a line.
function buildPaths() {
  const lines = [];
  const push = (rec) => { if (lines.length < MAX_LINES) { rec.li = lines.length; lines.push(rec); } else T.dropped++; };

  for (const L of T.D.lines) {
    const group = LINE_GROUP[L.kind];
    if (!group) continue;
    const pts = (L.pts || []).map((p) => mp(p[0], p[1], p[2]));
    if (pts.length < 2) continue;
    push({
      id: L.id, name: L.name, kind: L.kind, group, data: L, pts,
      col: lineColour(L.kind),
      dash: (L.schematic || []).includes('route') || L.kind === 'oilExport' ? 9 : 0,
      firstFrame: L.firstFrame ?? 0, endLabel: L.endLabel || '',
      flowOf: L.kind === 'flowline' ? (L.fromId || '').replace('tpl-', '')
        : L.kind === 'oilExport' ? 'oil'
          : (L.kind === 'export' || L.kind === 'tie') ? 'gasexport' : 'field',
    });
  }
  // One path per well: the drawn well path, preceded by the schematic tie to its template when
  // that toggle is on. Stored top-down, so produced fluids run at a negative speed and injected
  // at a positive one, and the geometry never changes when a well changes role.
  const wellPts = T.G.wellPts || [];
  T.model.wells.forEach((w, wi) => {
    const path = wellPts[wi]; if (!path || path.length < 2) return;
    const letter = T.wellTpl.get(w.name);
    const tpl = letter ? T.byId.get('tpl-' + letter) : null;
    const tie = !!(T.on.wellties && tpl && tpl.firstFrame >= 0);
    const pts = [];
    if (tie) pts.push(tpl.p);
    for (const p of path) pts.push([p[0], p[1], p[2]]);
    push({
      id: 'well-' + w.name, name: w.name, kind: 'welltie', group: 'wellties', well: wi, tplLetter: letter,
      pts, col: lineColour('welltie'), dash: 9, firstFrame: 0, tieSegments: tie ? 1 : 0,
      flowOf: 'well', endLabel: '',
    });
  });
  T.lines = lines;

  // pack: aA(3) aB(3) aSE(2) aS(2) aLine(1) aCol(4) aDash(1) = 16 floats per vertex
  const SE = [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]];
  const out = [];
  for (const L of lines) {
    let s = 0; const acc = [0];
    for (let i = 1; i < L.pts.length; i++) {
      const a = L.pts[i - 1], b = L.pts[i];
      s += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      acc.push(s);
    }
    L.length = s;
    L.mid = midOf(L.pts, acc, s / 2);
    for (let i = 0; i + 1 < L.pts.length; i++) {
      const A = L.pts[i], B = L.pts[i + 1];
      const dash = L.kind === 'welltie' && i >= (L.tieSegments || 0) ? -1 : L.dash;
      for (const [side, end] of SE) {
        out.push(A[0], A[1], A[2], B[0], B[1], B[2], side, end, acc[i], acc[i + 1], L.li,
          L.col[0], L.col[1], L.col[2], L.col[3], dash);
      }
    }
  }
  const gl = T.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, T.pathBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW);
  T.pathVerts = out.length / 16;
}
function midOf(pts, acc, half) {
  for (let i = 1; i < pts.length; i++) {
    if (acc[i] >= half) {
      const t = (half - acc[i - 1]) / Math.max(1e-6, acc[i] - acc[i - 1]);
      const a = pts[i - 1], b = pts[i];
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], ref: b, back: a };
    }
  }
  return { p: pts[0], ref: pts[pts.length - 1], back: pts[0] };
}

function buildPlanes() {
  const gl = T.gl, d = T.D.sea, hs = d.planeHalfSize || [5800, 6300], C = theme();
  // Both planes are translucent so the reservoir stays visible through them; an opaque seabed
  // would hide the field from every camera above it.
  const seaCol = C.dark ? [0.25, 0.47, 0.66, 0.26] : [0.36, 0.60, 0.76, 0.26];
  const bedCol = C.dark ? [0.34, 0.34, 0.30, 0.32] : [0.56, 0.52, 0.42, 0.30];
  const out = [];
  const quad = (depth, col) => {
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
      out.push(u * hs[0], v * hs[1], depth - T.model.center[2], col[0], col[1], col[2], col[3], u, v);
    }
  };
  quad(d.seabedDepth, bedCol);          // 0..6
  quad(d.surfaceDepth, seaCol);         // 6..12
  gl.bindBuffer(gl.ARRAY_BUFFER, T.planeBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.STATIC_DRAW);
}

// ---------------------------------------------------------------- per-frame state
function templatesVisible() {
  return T.facs.filter((f) => f.kind === 'template' && !f.later && f.firstFrame >= 0 && T.S.frame >= f.firstFrame).length;
}
function facVisible(f) {
  if (!T.on.master) return false;
  if (f.later) return !!T.on.later;
  if (!T.on[f.group]) return false;
  return f.firstFrame >= 0 && T.S.frame >= f.firstFrame;
}
function lineVisible(L) {
  if (!T.on.master || !T.on[L.group]) return false;
  if (L.kind === 'welltie') {
    const w = T.model.wells[L.well];
    return !!L.tieSegments && w.firstOpen >= 0 && T.S.frame >= w.firstOpen;
  }
  return L.firstFrame >= 0 && T.S.frame >= L.firstFrame;
}
// Marks ride a line only where something is drawn: a well's own ribbon is drawn by the app, so
// its flow path is eligible whenever the well is; the schematic legs follow their own toggles.
function lineFlowVisible(L) {
  if (!T.on.master) return false;
  if (L.kind === 'welltie') {
    const w = T.model.wells[L.well];
    return !!T.S.wells && w.firstOpen >= 0 && T.S.frame >= w.firstOpen;
  }
  return lineVisible(L);
}
// A well path is stored from its template downwards, everything else in the direction the fluid
// leaves the field, so one sign per line kind puts every mark on its true course.
function flowSign(L, fl) {
  return L.kind === 'welltie' ? (fl.produced ? -1 : 1) : (fl.produced ? 1 : -1);
}
function lineRate(L, fl) {
  const f = T.S.frame, sum = T.model.summary;
  if (L.flowOf === 'well') {
    const w = T.model.wells[L.well], st = w.state[f] || 0;
    if (!st) return 0;
    if (fl.id === 'winj' ? st !== 2 : fl.id === 'ginj' ? st !== 3 : st !== 1) return 0;
    const sm = sum.wells[w.name] || {};
    return (sm[fl.key] && sm[fl.key][f]) || 0;
  }
  if (L.kind === 'flowline') {
    let total = 0;
    for (const W of T.lines) if (W.flowOf === 'well' && W.tplLetter === L.flowOf) total += lineRate(W, fl);
    return total;
  }
  const fld = sum.field || {};
  if (L.flowOf === 'gasexport') return fl.id === 'gas' ? (fld.gas ? fld.gas[f] : 0) : 0;
  if (L.flowOf === 'oil') return fl.id === 'oil' ? (fld.oil ? fld.oil[f] : 0) : 0;
  return (fld[fl.key] && fld[fl.key][f]) || 0;     // the riser carries everything
}
function marksPerSecond(rate, ref) { return rate > 0 ? 0.6 + 5.4 * clamp01(rate / ref) : 0; }
function flowOn() { return !!(T.on.master && T.flow.master && FLUIDS.some((f) => T.flow[f.id])); }

// ---------------------------------------------------------------- markers
function buildMarks() {
  const C = theme(), out = [], wc = T.cfg.wellColors || {};
  const roleCol = (role) => {
    const h = role === 'waterInjector' ? wc.waterInjector : role === 'producer' ? wc.producer : null;
    return h ? rgbOf(h) : C.accent;
  };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const quad = (p, col, a, sizeM, minPx, shapeId, ref) => {
    const r = ref || [0, 0, 0], orient = ref ? 1 : 0;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
      out.push(p[0], p[1], p[2], u, v, col[0], col[1], col[2], a, sizeM, minPx, shapeId, orient, r[0], r[1], r[2]);
    }
  };
  for (const f of T.facs) {
    if (!facVisible(f)) continue;
    const sel = T.sel === f.id;
    const col = (f.kind === 'fpso' || f.kind === 'riserBase') ? C.ink : roleCol(f.role);
    quad(f.p, sel ? C.accent : col, f.later ? 0.9 : 1, f.sizeM, (f.minPx + (sel ? 4 : 0)) * dpr, f.shapeId, null);
  }
  // Direction arrows: always on the oil leg, and on every flowing path when motion is off.
  const stillFlow = flowOn() && reducedMotion();
  for (const L of T.lines) {
    if (!L.mid) continue;
    const isOil = L.kind === 'oilExport';
    if (!(isOil ? lineVisible(L) : stillFlow && lineFlowVisible(L))) continue;
    let best = null;
    for (const fl of FLUIDS) {
      if (!isOil && !T.flow[fl.id]) continue;
      const r = lineRate(L, fl);
      if (r > 0 && (!best || r > best.r)) best = { r, fl };
    }
    if (isOil && !best) best = { r: 1, fl: FLUIDS[0] };
    if (!best) continue;
    const ahead = flowSign(L, best.fl) > 0 ? L.mid.ref : L.mid.back;
    quad(L.mid.p, isOil ? C.oil : fluidColour(best.fl), 0.95, 0, 9 * dpr, 4, ahead);
  }
  const gl = T.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, T.markBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out), gl.DYNAMIC_DRAW);
  T.markVerts = out.length / 16;
}

// ---------------------------------------------------------------- labels
function syncLabels() {
  const box = $('labels'); if (!box) return;
  const want = [];
  for (const f of T.facs) want.push({ key: 'f:' + f.id, text: f.name || f.id, id: f.id, anchor: () => f.p, vis: () => facVisible(f) });
  for (const L of T.lines) if (L.endLabel) want.push({ key: 'l:' + L.id, text: L.endLabel, id: L.id, anchor: () => labelAnchor(L), vis: () => lineVisible(L) });
  for (const it of want) {
    if (T.labelIds.has(it.key)) continue;
    const el = document.createElement('button');
    el.className = 'tl' + (it.key[0] === 'l' ? ' end' : ''); el.type = 'button'; el.textContent = it.text;
    el.addEventListener('click', (e) => { e.stopPropagation(); select(it.id); });
    box.appendChild(el);
    T.labels.push({ ...it, el });
    T.labelIds.add(it.key);
  }
}
// A 128 km pipeline's far end is nowhere near the field, so its label rides the point where the
// route leaves the neighbourhood of the grid instead.
function labelAnchor(L) {
  for (const p of L.pts) if (Math.hypot(p[0], p[1]) > 7000) return p;
  return L.pts[L.pts.length - 1];
}

// ---------------------------------------------------------------- selection
function select(id) {
  T.sel = id; T.markSig = '';
  T.api.setCardMode('topside');
  topside.card();
  T.R.draw = true;
}
function segDist(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), y - (a[1] + dy * t));
}

// ---------------------------------------------------------------- drawing
// Three shader programs and four buffers, built the first time anything is actually drawn rather
// than at load. With every row off — which is how the app ships — this module compiles nothing,
// allocates no GL object and costs one function call per frame, as its header promises.
function ensureGL() {
  if (T.glReady) return true;
  if (T.glFailed) return false;
  const gl = T.gl;
  try {
    T.planeP = program(gl, PLANE_VS, PLANE_FS);
    T.markP = program(gl, MARK_VS, MARK_FS);
    T.pathP = program(gl, PATH_VS, PATH_FS);
    T.planeVAO = gl.createVertexArray(); gl.bindVertexArray(T.planeVAO);
    T.planeBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, T.planeBuf);
    attribs(gl, [[0, 3], [1, 4], [2, 2]], 36);
    T.markVAO = gl.createVertexArray(); gl.bindVertexArray(T.markVAO);
    T.markBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, T.markBuf);
    attribs(gl, [[0, 3], [1, 2], [2, 4], [3, 4], [4, 3]], 64);
    T.pathVAO = gl.createVertexArray(); gl.bindVertexArray(T.pathVAO);
    T.pathBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, T.pathBuf);
    attribs(gl, [[0, 3], [1, 3], [2, 2], [3, 2], [4, 1], [5, 4], [6, 1]], 64);
    gl.bindVertexArray(null);
    buildPlanes();
  } catch (e) {
    T.err = String((e && e.message) || e);
    T.glFailed = true;
    T.on.master = false;
    const el = $('ts-master'); if (el) el.checked = false;
    return false;
  }
  T.glReady = true;
  T.geomSig = ''; T.markSig = '';
  return true;
}

function drawAll(w, h) {
  if (!ensureGL()) return;
  const S = T.S, gl = T.gl;
  const sig = [S.explode.mode, S.explode.t, T.on.wellties ? 1 : 0].join('|');
  if (sig !== T.geomSig) { buildPaths(); T.geomSig = sig; syncLabels(); }
  const msig = [S.frame, T.sel, stateBits()].join('|');
  if (msig !== T.markSig) { buildMarks(); T.markSig = msig; }

  // metres per pixel at the camera target — the measurement the scale bar already makes
  const V = T.G.V, tg = S.cam.target, d = Math.max(1, S.cam.dist * 0.02);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const p0 = T.api.projectWorld(tg[0], tg[1], tg[2]);
  const pE = T.api.projectWorld(tg[0] + d * V[0], tg[1] + d * V[4], tg[2] + d * V[8]);
  if (p0 && pE) T.pxPerM = Math.max(1e-5, Math.hypot(pE[0] - p0[0], pE[1] - p0[1]) / d) * dpr;
  T.pxPerWorld = h / (2 * Math.tan(20 * Math.PI / 180));
  T.vp = [w / 2, h / 2];

  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  if (T.on.sea) drawPlane(0);          // the seabed, under everything topside
  drawPaths(dpr);
  drawMarks();
  if (T.on.sea) drawPlane(6);          // the sea surface, over everything
  gl.disable(gl.BLEND);
  gl.depthMask(true);
}

function drawPlane(first) {
  const gl = T.gl, p = T.planeP;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.u.uMV, false, T.G.V); gl.uniformMatrix4fv(p.u.uP, false, T.G.P);
  gl.uniform1f(p.u.uExag, T.S.exag);
  gl.bindVertexArray(T.planeVAO);
  gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES, first, 6);
  gl.depthMask(true);
  gl.bindVertexArray(null);
}

// The gate arrays depend on the frame, the toggles and the built geometry — never on the camera or
// the clock — so they are computed once per change and re-uploaded unchanged on every other frame.
// Without this, five fluids × forty-six lines of rate lookups (and a flowline sums its wells, so
// the inner count is over a thousand) ran inside every animated frame.
function flowPlan(period) {
  const sig = T.S.frame + '|' + stateBits() + '|' + period + '|' + T.geomSig;
  if (T.flowPlanSig === sig && T.flowPlan) return T.flowPlan;
  const still = T.gateBuf || (T.gateBuf = new Float32Array(MAX_LINES));
  still.fill(0);
  for (const L of T.lines) still[L.li] = lineVisible(L) ? 1 : 0;
  const passes = [];
  let active = 0, mps = 0;
  if (flowOn()) {
    FLUIDS.forEach((fl, fi) => {
      if (!T.flow[fl.id]) return;
      const ref = (T.D.flowReference && T.D.flowReference[fl.ref]) || 1;
      const gate = new Float32Array(MAX_LINES);
      let any = false;
      for (const L of T.lines) {
        if (!lineFlowVisible(L)) continue;
        const r = lineRate(L, fl);
        if (r <= 0) continue;
        const m = marksPerSecond(r, ref);
        gate[L.li] = flowSign(L, fl) * m * period;
        any = true; active++; if (m > mps) mps = m;
      }
      if (any) passes.push({ fl, phase: fi * period / FLUIDS.length, gate });
    });
  }
  T.flowPlanSig = sig;
  return (T.flowPlan = { still, passes, active, mps });
}

function drawPaths(dpr) {
  const gl = T.gl, p = T.pathP;
  if (!T.pathVerts) return;
  const period = MARK_PERIOD * dpr;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.u.uMV, false, T.G.V); gl.uniformMatrix4fv(p.u.uP, false, T.G.P);
  gl.uniform1f(p.u.uExag, T.S.exag);
  gl.uniform2f(p.u.uVP, T.vp[0], T.vp[1]);
  gl.uniform1f(p.u.uPxPerM, T.pxPerM);
  gl.uniform1f(p.u.uPeriod, period);
  gl.uniform1f(p.u.uDuty, MARK_DUTY);
  gl.bindVertexArray(T.pathVAO);
  gl.depthMask(false);

  const plan = flowPlan(period);
  gl.uniform1i(p.u.uMode, 0);
  gl.uniform1f(p.u.uWidth, 2.4 * dpr / 2);
  gl.uniform1f(p.u.uTime, 0); gl.uniform1f(p.u.uPhase, 0);
  gl.uniform4fv(p.u.uGate, plan.still);
  gl.drawArrays(gl.TRIANGLES, 0, T.pathVerts);

  if (plan.passes.length) {
    const time = reducedMotion() ? 0 : ((performance.now() - T.t0) / 1000) % 600;
    gl.uniform1i(p.u.uMode, 1);
    gl.uniform1f(p.u.uWidth, 3.0 * dpr / 2);
    gl.uniform1f(p.u.uTime, time);
    for (const pass of plan.passes) {
      const col = fluidColour(pass.fl);
      gl.uniform4f(p.u.uFlowCol, col[0], col[1], col[2], 0.98);
      gl.uniform1f(p.u.uPhase, pass.phase);
      gl.uniform4fv(p.u.uGate, pass.gate);
      gl.drawArrays(gl.TRIANGLES, 0, T.pathVerts);
    }
  }
  T.flowActive = plan.active; T.flowMps = plan.mps;
  gl.depthMask(true);
  gl.bindVertexArray(null);
}

function drawMarks() {
  const gl = T.gl, p = T.markP, C = theme();
  if (!T.markVerts) return;
  gl.useProgram(p.p);
  gl.uniformMatrix4fv(p.u.uMV, false, T.G.V); gl.uniformMatrix4fv(p.u.uP, false, T.G.P);
  gl.uniform1f(p.u.uExag, T.S.exag);
  gl.uniform2f(p.u.uVP, T.vp[0], T.vp[1]);
  gl.uniform1f(p.u.uPxPerWorld, T.pxPerWorld);
  gl.uniform3f(p.u.uOutline, C.outline[0], C.outline[1], C.outline[2]);
  gl.bindVertexArray(T.markVAO);
  gl.depthMask(false);
  gl.drawArrays(gl.TRIANGLES, 0, T.markVerts);
  gl.depthMask(true);
  gl.bindVertexArray(null);
}

// ---------------------------------------------------------------- reported production
// drawChart() draws any series that exists on model.summary.field, so the reported months only
// have to be put there; three rows in SERIES and the toggle do the rest.
function injectReported() {
  const p = T.D.production, f = T.model.summary.field;
  f.repOil = p.oil; f.repGasSold = p.gasSold; f.repWater = p.water;
}

// ---------------------------------------------------------------- UI
function buildRows() {
  const box = $('topside'); if (!box) return;
  box.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'tshead';
  const h = document.createElement('h3'); h.textContent = 'Topside';
  const about = document.createElement('button');
  about.type = 'button'; about.className = 'tsabout'; about.textContent = 'About'; about.setAttribute('aria-expanded', 'false');
  const master = document.createElement('label');
  master.className = 'tsmaster';
  const mi = document.createElement('input'); mi.type = 'checkbox'; mi.id = 'ts-master'; mi.checked = !!T.on.master;
  const ms = document.createElement('span'); ms.textContent = 'Show';
  master.append(mi, ms);
  head.append(h, about, master);
  box.appendChild(head);

  if (!T.ok) {
    const p = document.createElement('p');
    p.className = 'credit'; p.textContent = `The topside layer is not available: ${T.err || 'no data'}.`;
    box.appendChild(p);
    mi.disabled = true; about.disabled = true;
    return;
  }

  const group = document.createElement('div');
  group.className = 'tsgroup'; group.hidden = !T.on.master;
  box.appendChild(group);

  for (const t of TOGGLES) {
    const lab = document.createElement('label');
    lab.className = 'tsrow';
    const inp = document.createElement('input');
    inp.type = 'checkbox'; inp.id = 'ts-' + t.id; inp.checked = !!T.on[t.id];
    const txt = document.createElement('span'); txt.className = 'tstext';
    const strong = document.createElement('span'); strong.className = 'tslab'; strong.textContent = t.label;
    const hint = document.createElement('span'); hint.className = 'tshint'; hint.textContent = t.hint;
    txt.append(strong, hint);
    lab.append(inp, txt);
    inp.addEventListener('change', () => {
      T.on[t.id] = inp.checked;
      if (t.id === 'network') { if (inp.checked) openNetwork(); else closeNetwork(); }
      if (t.id === 'reported') T.R.chart = true;
      T.markSig = ''; T.geomSig = '';
      T.R.draw = true; T.R.labels = true;
      T.api.save();
    });
    group.appendChild(lab);
  }

  const fh = document.createElement('div'); fh.className = 'tsflowhead';
  const fl = document.createElement('label'); fl.className = 'tsmaster';
  const fi = document.createElement('input'); fi.type = 'checkbox'; fi.id = 'ts-flow'; fi.checked = !!T.flow.master;
  const fs = document.createElement('span'); fs.textContent = 'Flow animation';
  fl.append(fi, fs); fh.appendChild(fl);
  group.appendChild(fh);

  const fluids = document.createElement('div');
  fluids.className = 'tsfluids'; fluids.hidden = !T.flow.master;
  for (const f of FLUIDS) {
    const lab = document.createElement('label');
    const inp = document.createElement('input');
    inp.type = 'checkbox'; inp.id = 'ts-flow-' + f.id; inp.checked = !!T.flow[f.id];
    const sp = document.createElement('span'); sp.className = 'tsfluid'; sp.textContent = f.label;
    sp.style.setProperty('--c', `var(${f.css})`);
    lab.append(inp, sp);
    inp.addEventListener('change', () => { T.flow[f.id] = inp.checked; T.markSig = ''; T.R.draw = true; T.api.save(); if (T.net) T.net.kick(); });
    fluids.appendChild(lab);
  }
  group.appendChild(fluids);
  fi.addEventListener('change', () => {
    T.flow.master = fi.checked;
    fluids.hidden = !fi.checked;
    if (fi.checked && !FLUIDS.some((f) => T.flow[f.id])) {
      for (const id of ['oil', 'gas', 'water']) { T.flow[id] = true; const el = $('ts-flow-' + id); if (el) el.checked = true; }
    }
    T.markSig = ''; T.R.draw = true; T.api.save();
    if (T.net) T.net.kick();
  });

  const aboutBox = document.createElement('div');
  aboutBox.className = 'tsaboutbox'; aboutBox.hidden = true;
  aboutBox.append(...aboutContent());
  box.appendChild(aboutBox);
  about.addEventListener('click', () => {
    aboutBox.hidden = !aboutBox.hidden;
    about.setAttribute('aria-expanded', String(!aboutBox.hidden));
  });

  mi.addEventListener('change', () => {
    T.on.master = mi.checked;
    group.hidden = !mi.checked;
    if (mi.checked) {
      const fresh = !TOGGLES.some((t) => T.on[t.id]);
      if (fresh) for (const id of SHOW_FIELD) { T.on[id] = true; const el = $('ts-' + id); if (el) el.checked = true; }
      setExag(1);
      // ×1 flattens a 650 m reservoir to a sliver in whatever view the user had, so the first
      // switch-on also frames the whole column — the same framing the "Show the field" chip uses.
      if (fresh && viewList().some((v) => v.id === 'show-field')) applyView('show-field');
    }
    if (T.on.network) { if (mi.checked) openNetwork(); else closeNetwork(); }
    T.markSig = ''; T.geomSig = '';
    T.R.draw = true; T.R.labels = true; T.R.chart = true;
    T.api.save();
  });
}

// The retrieval date is whatever the data file says, so the credit cannot drift from the build.
function retrieved() {
  const t = (T.D.sources && T.D.sources.facilities) || '';
  const m = t.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : 'the date in data/ATTRIBUTION.txt';
}
function aboutContent() {
  const D = T.D, out = [];
  const n = (v) => Number(v).toLocaleString('en-US');
  const p = (text, cls) => { const el = document.createElement('p'); el.textContent = text; if (cls) el.className = cls; out.push(el); };
  p(`Depth is drawn true, in one scale: sea level 0 m, seabed ${D.sea.seabedDepth} m (the templates stand in `
    + `${D.sea.seabedRange[0]}–${D.sea.seabedRange[1]} m), reservoir 2,439–3,090 m. Switching the topside on sets the `
    + 'vertical scale to ×1, because at ×5 the platform would float 13.8 km above the field. Both the sea surface '
    + 'and the seabed are drawn translucent so the reservoir stays visible through them.');
  p('A well’s drawn path stops at the top of its modelled completions, about 2 km below the seabed. The dashed '
    + 'leg above it is a schematic tie to the template the simulation deck assigns that well to — not a surveyed '
    + 'trajectory.');
  p('Schematic means drawn between real end points with no published geometry: the flowlines and risers from the '
    + 'templates to the vessel, the first 500 m of the export line (no pipeline track is published within 500 m of '
    + 'a facility), the hull shape and heading of the FPSO, the legs from the wells up to their templates, and the '
    + 'oil leg — the crude leaves by shuttle tanker and no open dataset records where a cargo goes, so no line is '
    + 'drawn to any refinery, ever. The export line’s route is published; its depth is not, so it is drawn on the '
    + 'seabed plane.');
  p(`Positions are treated as ${D.datum.assumed}. ${D.datum.note}`);
  p('Template M is dated 2010, after this history; it is drawn — hollow, with its date — only while the '
    + '"Later facilities" row is on. The satellite fields tied back to the same vessel (Urd, Alve, Skuld, '
    + 'Marulk, Verdande) are not drawn at all, on any row; three of them, the Urd templates, came on stream '
    + 'in November 2005, inside this history.');
  p('Flow marks are illustrative; the rates behind them are the simulation’s own. A mark train runs at 0.6 marks '
    + `a second at the first drop and 6 a second at the 90th-percentile rate (oil ${n(D.flowReference.oil)}, water `
    + `${n(D.flowReference.water)}, gas ${n(D.flowReference.gas)}, water injected ${n(D.flowReference.winj)}, gas `
    + `injected ${n(D.flowReference.ginj)} Sm³/d), ${MARK_PERIOD} px apart on screen. A shut well does not animate, `
    + 'and with every flow row off the app redraws only when you move it, exactly as before.');
  p('The reported line is what the field actually delivered, month by month, divided by the days in each month so '
    + 'it shares the chart’s axis. Reported gas is gas sold and is zero until February 2001, when the export route '
    + 'opened; the simulation reports gas produced from the reservoir from the first month. They are not the same '
    + 'quantity.');
  p('Reservoir model: Open Database License (ODbL) 1.0 — see the credit below.', 'tscredit');
  p('Topside facilities, pipelines and reported production: contains data under the Norwegian Licence for Open '
    + 'Government Data (NLOD) 2.0 distributed by the Norwegian Offshore Directorate (sodir.no), retrieved '
    + `${retrieved()}; changed as follows: re-centred on the model `
    + 'origin, rounded to 1 m, dates converted to Norwegian local time, and the export route’s depth replaced by the '
    + 'field’s seabed plane.', 'tscredit');
  p('Coastline on the export network map: Natural Earth, public domain.', 'tscredit');
  return out;
}

// The two planes are 378 m apart on a 3,090 m column, so at the framings the app picks for itself
// they are a few pixels apart and read as one slab. The About panel states every number; this puts
// the three that matter beside the scale bar, while the row that draws them is on.
function syncDepthCaption() {
  const scale = $('scale'); if (!scale) return;
  let el = $('ts-depth');
  const want = !!(T.on && T.on.master && T.on.sea);
  if (!want) { if (el) el.hidden = true; return; }
  if (!el) {
    el = document.createElement('p');
    el.id = 'ts-depth';
    // The scale bar is role="img" with its own label, which app.js rewrites on every gauge update,
    // so this text is visual only; the same three numbers are read out in the About panel.
    el.setAttribute('aria-hidden', 'true');
    const c = T.model.center, ex = T.model.extent;
    const n = (v) => Math.round(v).toLocaleString('en-US');
    const a = document.createElement('span'), b = document.createElement('span');
    a.textContent = `sea 0 m · seabed ${T.D.sea.seabedDepth} m`;
    b.textContent = `reservoir ${n(c[2] - ex[2] / 2)}–${n(c[2] + ex[2] / 2)} m`;
    el.append(a, b);
    scale.appendChild(el);
  }
  el.hidden = false;
}

// ---------------------------------------------------------------- saved viewpoints
function viewList() {
  const v = (T.cfg && T.cfg.views) || [];
  return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && typeof x.label === 'string') : [];
}
function buildViewChips() {
  const box = $('views'); if (!box) return;
  box.innerHTML = '';
  const list = viewList();
  box.hidden = !list.length;
  for (const v of list) {
    const b = document.createElement('button');
    b.className = 'chip view'; b.type = 'button'; b.setAttribute('role', 'radio');
    b.dataset.view = v.id; b.textContent = v.label;
    b.setAttribute('aria-checked', String(T.S.view === v.id));
    b.addEventListener('click', () => applyView(v.id));
    box.appendChild(b);
  }
}
function setExag(v) {
  const el = $('exag'); if (!el || +el.value === v) return;
  el.value = v;
  el.dispatchEvent(new Event('input'));           // the app's own handler moves the camera with it
}
function applyView(id) {
  const v = viewList().find((x) => x.id === id);
  if (!v) return Promise.resolve(false);
  if (Number.isFinite(v.exag)) setExag(v.exag);
  if (Number.isFinite(v.frame)) { const t = $('time'); t.value = v.frame; t.dispatchEvent(new Event('input')); }
  for (const [key, id] of [['edges', 't-edges'], ['labels', 't-labels'], ['wells', 't-wells']]) {
    if (typeof v[key] !== 'boolean') continue;
    const el = $(id);
    if (el && el.checked !== v[key]) { el.checked = v[key]; el.dispatchEvent(new Event('change')); }
  }
  if (typeof v.prop === 'string') { const c = document.querySelector(`#props .chip[data-key="${v.prop}"]`); if (c) c.click(); }
  if (Array.isArray(v.topside) && T.ok) {
    const mi = $('ts-master');
    // An empty list means "no topside rows", not "switch the topside on with nothing in it".
    if (mi && !mi.checked && v.topside.length) { mi.checked = true; T.on.master = true; const g = document.querySelector('.tsgroup'); if (g) g.hidden = false; }
    for (const t of TOGGLES) {
      const want = v.topside.includes(t.id);
      if (T.on[t.id] !== want) {
        T.on[t.id] = want;
        const el = $('ts-' + t.id); if (el) el.checked = want;
        if (t.id === 'network') { if (want) openNetwork(); else closeNetwork(); }
      }
    }
    T.markSig = ''; T.geomSig = ''; T.R.chart = true;
  }
  const d = T.api.defaultCam();
  const target = Array.isArray(v.target) ? v.target.slice(0, 3).map(Number) : d.target;
  const dist = Number.isFinite(v.dist) ? v.dist : d.dist * (Number.isFinite(v.distFactor) ? v.distFactor : 1);
  T.api.flyTo(target, dist, { theta: Number.isFinite(v.theta) ? v.theta : d.theta, phi: Number.isFinite(v.phi) ? v.phi : d.phi });
  T.S.view = id;
  for (const b of document.querySelectorAll('#views .chip')) b.setAttribute('aria-checked', String(b.dataset.view === id));
  T.R.draw = true; T.R.labels = true;
  T.api.save();
  return new Promise((ok) => setTimeout(() => ok(true), 640));
}

// ---------------------------------------------------------------- the network panel (stage 2)
// The row that opens the map lives at the sheet's third stop, where the stage — and so the map —
// is 227 px tall. At that size the whole 816 km route is 52 px long and Mongstad's marker lands
// within three pixels of it, which reads as a destination it is not. Collapsing the sheet gives
// the map the full stage; closing it puts the sheet back where the user had it.
function sheetStop(n) {
  const sheet = $('sheet'), grip = $('grip');
  if (!sheet || !grip) return;
  for (let i = 0; i < 3 && !sheet.classList.contains('s' + n); i++) grip.click();
}
async function openNetwork() {
  if (!T.ok) return false;
  const off = () => { T.on.network = false; const el = $('ts-network'); if (el) el.checked = false; };
  if (!T.netMod) {
    try { T.netMod = await import('./topside-network.js'); } catch { off(); return false; }
  }
  if (!T.net) {
    T.net = await T.netMod.createNetwork({
      model: T.model, api: T.api,
      flow: () => ({ on: flowOn(), fluids: FLUIDS.filter((f) => T.flow[f.id]).map((f) => f.id) }),
      // off() only unticks the row — setting .checked fires no change event — so the panel has to be
      // closed here too, or the map's own × leaves it on screen with its row switched off.
      onClose: () => { off(); closeNetwork(); T.api.save(); },
    });
  }
  if (!T.net) { off(); return false; }
  if (!T.netOpen) { T.sheetWas = T.S.sheet; sheetStop(0); }
  T.net.open(T.S.frame);
  T.netOpen = true;
  return true;
}
function closeNetwork() {
  if (T.netOpen && Number.isFinite(T.sheetWas)) sheetStop(T.sheetWas);
  T.sheetWas = null;
  T.netOpen = false;
  if (T.net) T.net.close();
}

// ---------------------------------------------------------------- the module
export const topside = {
  restoreState(s) {                                   // hook: restore()
    T.raw = s && s.top;
    if (s && typeof s.view === 'string') T.view = s.view;
  },

  async start(ctx) {                                  // hook: main()
    Object.assign(T, ctx);
    const { on, flow } = sanitize(T.raw);
    T.on = on; T.flow = flow; on.flow = flow;
    T.S.top = on;                                     // one saved blob, as before — no new key
    T.S.view = T.view || null;
    T.t0 = performance.now();
    exposeTestSurface();
    const tStart = performance.now();
    try { T.D = await loadData(); } catch (e) { T.err = String((e && e.message) || e); return; }
    T.fetchMs = performance.now() - tStart;
    for (const k in T.D.wellTemplates || {}) T.wellTpl.set(k, T.D.wellTemplates[k]);
    buildFacilities();
    injectReported();
    T.ok = true;
    T.startMs = performance.now() - tStart;
    document.addEventListener('visibilitychange', () => {
      T.hidden = document.visibilityState !== 'visible';
      if (!T.hidden && T.net) T.net.kick();     // the map's own loop stops while hidden; restart it
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      T.theme = null; T.geomSig = ''; T.markSig = '';
      if (T.glReady) buildPlanes();
      if (T.on.master) T.R.draw = true;
    });
  },

  initUI() {                                          // hook: initUI()
    buildViewChips();
    buildRows();
    if (T.ok) { syncLabels(); if (T.on.master && T.on.network) openNetwork(); }
  },

  tick(now) {                                         // hook: loop()
    if (!T.ok || T.hidden || T.netOpen || !flowOn() || reducedMotion()) return;
    if (now - T.lastFlow < 1000 / FLOW_FPS) return;
    T.lastFlow = now;
    T.R.draw = true;
  },

  frameStart() {                                      // hook: draw(), first line
    const now = performance.now();
    // Frame *interval*, not CPU time: the wall clock between two consecutive draws. It only means
    // anything while the app is drawing continuously, so an idle gap (the app is render-on-change)
    // is discarded rather than averaged in.
    const gap = now - T.tPrev;
    if (T.tPrev && gap < 250) { T.fMs = gap; T.fMsAvg = T.fMsAvg ? T.fMsAvg * 0.85 + gap * 0.15 : gap; T.fSamples++; }
    T.tPrev = now;
    T.tDraw = now;
  },

  draw(w, h) {                                        // hook: draw(), last line
    T.renders++;
    if (T.ok && T.on.master) drawAll(w, h);
    const ms = performance.now() - (T.tDraw || performance.now());
    T.ms = ms; T.msAvg = T.msAvg ? T.msAvg * 0.85 + ms * 0.15 : ms;
  },

  placeLabels() {                                     // hook: placeLabels()
    if (!T.ok) return;
    syncDepthCaption();
    const placed = [];
    // The app's own colour scale sits over the right edge of the stage. A 140 px label that ends
    // under it loses its last word, so the usable width stops at the scale rather than at the
    // canvas edge — the label slides left instead of being hidden.
    const stage = $('gl'), lg = $('legend');
    let right = stage.clientWidth || 390;
    if (lg && !lg.hidden) {
      const sr = stage.getBoundingClientRect(), lr = lg.getBoundingClientRect();
      if (lr.width) right = Math.min(right, lr.left - sr.left - 2);
    }
    // The header band carries the field name and the well-colour key. app.js:645 hides its own well
    // labels above it and clamps the rest to it; these follow exactly the same rule, or a facility
    // near the top of the stage writes its name across the title.
    const top = $('head').offsetHeight + 4;
    for (const it of T.labels) {
      const el = it.el;
      if (!T.on.master || !it.vis()) { el.style.display = 'none'; continue; }
      const p = T.api.project(it.anchor());
      if (!p) { el.style.display = 'none'; continue; }
      el.style.display = '';
      const wdt = el._w || (el._w = el.offsetWidth || 40), hgt = 18;
      const x = Math.max(4, Math.min(right - wdt - 4, p[0] + 9));
      const raw = Math.max(4, p[1] - hgt - 6);
      const sel = T.sel === it.id;
      if (raw < top && !sel) { el.style.display = 'none'; continue; }
      const y = Math.max(raw, top);
      if (placed.some((r) => x < r.x + r.w + 3 && x + wdt + 3 > r.x && y < r.y + r.h + 2 && y + hgt + 2 > r.y)) { el.style.display = 'none'; continue; }
      placed.push({ x, y, w: wdt, h: hgt });
      el.classList.toggle('sel', T.sel === it.id);
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
  },

  tap(x, y) {                                         // hook: tap()
    if (!T.ok || !T.on.master) return false;
    let best = null, bd = 22;
    for (const f of T.facs) {
      if (!facVisible(f)) continue;
      const p = T.api.project(f.p); if (!p) continue;
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) { bd = d; best = f.id; }
    }
    if (!best) {
      bd = 12;
      for (const L of T.lines) {
        if (!lineVisible(L) || L.kind === 'welltie') continue;
        for (let i = 0; i + 1 < L.pts.length; i++) {
          const a = T.api.project(L.pts[i]), b = T.api.project(L.pts[i + 1]);
          if (!a || !b) continue;
          const d = segDist(x, y, a, b);
          if (d < bd) { bd = d; best = L.id; }
        }
      }
    }
    if (!best) return false;
    select(best);
    return true;
  },

  card() {                                            // hook: refreshCard()
    const it = T.byId.get(T.sel) || T.lines.find((L) => L.id === T.sel);
    if (!it) return;
    const dl = $('ins-list'); dl.innerHTML = ''; dl.className = '';
    $('ins-title').textContent = it.name || it.id;
    const facts = (it.data && it.data.facts) || it.facts || {};
    for (const k in facts) T.api.row(dl, k, facts[k]);
    const sch = (it.data ? it.data.schematic : it.schematic) || [];
    if (sch.length) {
      T.api.sep(dl, 'Schematic');
      T.api.row(dl, 'Not surveyed', sch.map((s) => SCHEMATIC_WORDS[s] || s).join(', '));
    }
    if (it.kind === 'template') {
      const f = T.S.frame;
      const wells = [...T.wellTpl.entries()].filter(([, l]) => 'tpl-' + l === it.id).map(([n]) => n);
      if (wells.length) {
        T.api.sep(dl, T.api.fmtDate(T.model.frames[f], true));
        const live = wells.filter((n) => { const w = T.model.wells.find((x) => x.name === n); return w && (w.state[f] || 0) > 0; });
        T.api.row(dl, 'Wells in the deck', `${wells.length}, ${live.length} flowing`);
      }
    }
    $('ins-focus').hidden = true;
    $('inspect').hidden = false;
  },

  deselect() { T.sel = null; T.markSig = ''; },       // hook: closeCard()

  onConfig(cfg) {                                     // hook: refreshConfig()
    T.cfg = cfg;
    buildViewChips();
    T.theme = null; T.markSig = ''; T.geomSig = '';
    if (T.on && T.on.master) T.R.draw = true;
  },

  // the chart asks twice: whether the reported series is on, and for a label suffix
  reported() { return !!(T.ok && T.on.master && T.on.reported); },
  label(text, isReported) { return this.reported() && !isReported ? `${text} (simulated)` : text; },
};

function flip(elId, on) {
  const el = $(elId);
  if (!el) return false;
  if (el.checked !== !!on) { el.checked = !!on; el.dispatchEvent(new Event('change')); }
  return true;
}

// ---------------------------------------------------------------- test surface
// Inert: it reads state and never changes it, except setView/set, which drive exactly the code
// the controls drive. No UI, and nothing outside the page can see it.
function exposeTestSurface() {
  window.__norne = {
    version: '1.4-topside',
    get ok() { return T.ok; },
    get error() { return T.err; },
    get renders() { return T.renders; },
    get msPerFrame() { return +T.msAvg.toFixed(3); },
    get lastDrawMs() { return +T.ms.toFixed(3); },
    get frameMs() { return +T.fMsAvg.toFixed(2); },          // wall clock between two draws
    get frameSamples() { return T.fSamples; },
    get frame() { return T.S.frame; },
    get exag() { return T.S.exag; },
    get templatesVisible() { return T.ok ? templatesVisible() : 0; },
    get on() { const o = { ...T.on }; delete o.flow; return o; },
    get flowState() { return { ...T.flow }; },
    get view() { return T.S.view; },
    get linesDropped() { return T.dropped; },
    get startMs() { return { total: +(T.startMs || 0).toFixed(2), fetch: +(T.fetchMs || 0).toFixed(2) }; },
    get drawn() {
      const out = { fpso: null, templates: {}, lines: {} };
      if (!T.ok) return out;
      for (const f of T.facs) {
        const v = {
          x: f.x, y: f.y, depth: f.depth, drawDepth: f.drawDepth,
          worldY: -(f.drawDepth - T.model.center[2]) * T.S.exag,   // the same y the shaders compute
          visible: facVisible(f), firstFrame: f.firstFrame,
        };
        if (f.kind === 'fpso') out.fpso = v;
        else if (f.kind === 'template') out.templates[f.id.replace('tpl-', '')] = v;
        else out[f.id] = v;
      }
      for (const L of T.lines) {
        if (L.kind === 'welltie') continue;
        out.lines[L.id] = { visible: lineVisible(L), km: +(L.length / 1000).toFixed(3), pts: L.pts.length, firstFrame: L.firstFrame };
      }
      return out;
    },
    get flow() {
      return {
        on: flowOn(), fluids: FLUIDS.filter((f) => T.flow[f.id]).map((f) => f.id),
        pathsActive: T.flowActive, marksPerSecond: +T.flowMps.toFixed(2), reducedMotion: reducedMotion(),
      };
    },
    wellFlow(name, fluid) {
      const L = T.lines.find((x) => x.id === 'well-' + name), fl = FLUIDS.find((f) => f.id === fluid);
      return L && fl ? lineRate(L, fl) : null;
    },
    // The gate the shader was last handed for one line, per fluid: a non-zero value is a moving
    // mark and its sign is the direction. Zero everywhere means that line carries no marks at all.
    gateOf(id) {
      const L = T.lines.find((x) => x.id === id) || T.lines.find((x) => x.id === 'well-' + id);
      const plan = T.flowPlan;
      if (!L || !plan) return null;
      const out = { still: plan.still[L.li] };
      for (const pass of plan.passes) out[pass.fl.id] = +pass.gate[L.li].toFixed(3);
      return out;
    },
    setView: (id) => applyView(id),
    set(id, on) {                                   // a Topside row, or 'master' / 'flow'
      return flip(id === 'master' ? 'ts-master' : id === 'flow' ? 'ts-flow' : 'ts-' + id, on);
    },
    setFlow(id, on) { return flip(id === 'master' ? 'ts-flow' : 'ts-flow-' + id, on); },
    get network() { return T.net ? T.net.state() : null; },
    netScreen(id) { return T.net ? T.net.screenOf(id) : null; },
    netProject(lon, lat) { return T.net ? T.net.project(lon, lat) : null; },
    resetCounters() { T.renders = 0; T.msAvg = 0; T.fMsAvg = 0; T.fSamples = 0; T.tPrev = 0; },
  };
}
