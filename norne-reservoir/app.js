// Norne reservoir viewer — vanilla WebGL2, no dependencies, runs offline.
import { topside } from './topside.js';   // topside: the optional platform, pipeline and flow layer
const $ = (id) => document.getElementById(id);
const LS_KEY = 'norne-viewer:v1';
const TEX_W = 1024;
const FOV = 40 * Math.PI / 180;
const FACES = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ROLE = ['Shut', 'Producer', 'Water injector', 'Gas injector'];

let cfg, cfgText = '', model, gl;
const G = {};            // data + GL objects
const S = {              // UI state (saved to localStorage)
  prop: null, frame: 0,
  cut: { i0: 1, i1: 46, j0: 1, j1: 112, k0: 1, k1: 22 },
  vf: [0, 100], exag: 5, wells: true, labels: true, edges: true,
  cam: null, well: null,
  explode: { mode: 'formations', t: 0 },
  sheet: 0,               // controls sheet: 0 player, 1 + chart, 2 + section and view
};
const R = { faces: true, colors: true, draw: true, chart: true, labels: true, wells: true }; // dirty flags
let pick = -1, cardMode = null, playing = false;

main().catch((err) => fail(err));

// ---------------------------------------------------------------- loading
async function loadJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  const text = await r.text();
  return { text, json: JSON.parse(text) };
}
async function loadBin(url, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !total) return r.arrayBuffer();
  const reader = r.body.getReader();
  const out = new Uint8Array(total);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, got); got += value.length;
    onProgress(got / total);
  }
  return out.buffer;
}
function progress(p, msg) {
  $('load-bar').style.width = `${Math.round(p * 100)}%`;
  if (msg) $('load-msg').textContent = msg;
}
function fail(err) {
  console.error(err);
  $('loading').classList.remove('done');
  $('load-msg').textContent = `Could not open the model: ${err.message}. ` +
    'Open this app from Snuggery or a local web server; a file opened directly in a browser cannot load its data.';
}

async function main() {
  gl = $('gl').getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('this device has no WebGL 2, which the 3D view needs');
  progress(0.02, 'Loading settings…');
  const c = await loadJSON('config.json'); cfg = c.json; cfgText = c.text;
  model = (await loadJSON('data/model.json')).json;

  const parts = [['geometry', 'Loading grid geometry…', 0.2], ['neighbours', 'Loading cell connections…', 0.05],
    ['ijk', 'Loading cell indices…', 0.01], ['static', 'Loading rock properties…', 0.05], ['dynamic', 'Loading simulation results…', 0.6]];
  const bufs = {}; let done = 0.05;
  for (const [key, msg, w] of parts) {
    progress(done, msg);
    const base = done;
    bufs[key] = await loadBin(`data/${model.files[key]}`, (p) => progress(base + w * 0.9 * p));
    done += w * 0.9;
  }
  const NA = G.NA = model.NA;
  G.geom = new Float32Array(bufs.geometry);
  G.nb = new Int32Array(bufs.neighbours);
  G.ijk = new Uint8Array(bufs.ijk);
  G.dyn = bufs.dynamic;
  G.nf = model.frames.length;
  const st = new Float32Array(bufs.static);
  G.static = {};
  model.static.order.forEach((k, i) => { G.static[k] = st.subarray(i * NA, (i + 1) * NA); });
  G.vals = new Float32Array(NA);
  G.vis = new Uint8Array(NA);
  G.texH = Math.ceil(NA / TEX_W);
  G.colors = new Uint8Array(TEX_W * G.texH * 4);
  if (G.dyn.byteLength < G.nf * model.dynamic.frameBytes) throw new Error('simulation results file is incomplete');

  S.cut = { i0: 1, i1: model.NI, j0: 1, j1: model.NJ, k0: 1, k1: model.NK };
  S.exag = cfg.verticalExaggeration || 5;
  S.prop = cfg.defaultProperty;
  restore();
  if (!propDef(S.prop)) S.prop = cfg.properties[0].key;
  S.frame = Math.min(Math.max(0, S.frame | 0), G.nf - 1);

  for (const w of model.wells) { w.firstOpen = w.state.findIndex((s) => s > 0); const zmin = Math.min(...w.path.slice(1).map((p) => p[2])); w.path[0][2] = zmin - 70; }
  buildZones();
  computeExplode();
  initGL();
  await topside.start({ gl, model, cfg, S, R, G, api: { flyTo, defaultCam, project, projectWorld, row, sep, fmt, fmtRate, fmtDate, save, setCardMode: (m) => { cardMode = m; } } });   // topside: load and build the topside layer
  initUI();
  initCamera();
  $('field-name').textContent = model.name;
  $('field-sub').textContent = 'Norwegian Sea';
  buildWellKey();
  $('credit').textContent = model.source;
  progress(1, '');
  $('loading').classList.add('done');
  new ResizeObserver(() => { R.draw = true; R.chart = true; R.labels = true; }).observe($('stage'));
  new ResizeObserver(() => { R.chart = true; }).observe($('chart'));
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- persistence
function restore() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!s) return;
    for (const k of ['prop', 'frame', 'exag', 'wells', 'labels', 'edges', 'well']) if (k in s) S[k] = s[k];
    if (Number.isFinite(s.sheet)) S.sheet = Math.max(0, Math.min(2, s.sheet | 0));
    if (s.cut) for (const k in S.cut) if (Number.isFinite(s.cut[k])) S.cut[k] = s.cut[k];
    if (Array.isArray(s.vf)) S.vf = s.vf;
    if (s.cam && Number.isFinite(s.cam.dist)) S.cam = s.cam;
    if (s.explode && ['formations', 'layers', 'segments'].includes(s.explode.mode) && Number.isFinite(s.explode.t)) S.explode = s.explode;
    if (S.well && !model.wells.some((w) => w.name === S.well)) S.well = null;
    topside.restoreState(s);   // topside: its own toggles and the saved viewpoint, from the same blob
  } catch { /* ignore a broken saved state */ }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch { /* storage full or blocked */ }
  }, 400);
}

// ---------------------------------------------------------------- properties + colour
function propDef(key) { return cfg.properties.find((p) => p.key === key); }
function propRange(p) {
  if (p.type === 'category') {
    if (p.key === 'LAYER') return [1, model.NK];
    if (p.key === 'ZONE') return [1, Math.max(1, (cfg.zones || []).length)];
    const r = model.static.ranges[p.key]; return r ? r : [1, 1];
  }
  if (Array.isArray(p.range)) return p.range;
  if (p.key === 'PRESSURE') return model.dynamic.pressureRange;
  return model.static.ranges[p.key] || [0, 1];
}
function norm(p, r, v) {
  if (p.scale === 'log') {
    const a = Math.log10(Math.max(r[0], 1e-6)), b = Math.log10(r[1]);
    return (Math.log10(Math.max(v, 1e-6)) - a) / (b - a);
  }
  return (v - r[0]) / (r[1] - r[0]);
}
function denorm(p, r, t) {
  if (p.scale === 'log') {
    const a = Math.log10(Math.max(r[0], 1e-6)), b = Math.log10(r[1]);
    return 10 ** (a + (b - a) * t);
  }
  return r[0] + (r[1] - r[0]) * t;
}
function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const lutCache = new Map();
function lut(name) {
  if (lutCache.has(name)) return lutCache.get(name);
  const stops = (cfg.colormaps[name] || cfg.colormaps.viridis).map(hex);
  const out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255 * (stops.length - 1), k = Math.min(Math.floor(t), stops.length - 2), f = t - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(stops[k][c] * (1 - f) + stops[k + 1][c] * f);
  }
  lutCache.set(name, out);
  return out;
}
function gradCSS(name) {
  const s = cfg.colormaps[name] || cfg.colormaps.viridis;
  return `linear-gradient(90deg, ${s.join(', ')})`;
}

function fillValues(key, f, out) {
  const NA = G.NA;
  if (G.static[key]) { out.set(G.static[key]); return; }
  if (key === 'LAYER') { for (let a = 0; a < NA; a++) out[a] = G.ijk[a * 3 + 2] + 1; return; }
  if (key === 'ZONE') { for (let a = 0; a < NA; a++) out[a] = G.zoneOfK[G.ijk[a * 3 + 2] + 1] + 1; return; }
  const base = f * model.dynamic.frameBytes;
  const sw = new Uint8Array(G.dyn, base, NA), sg = new Uint8Array(G.dyn, base + NA, NA);
  if (key === 'SWAT') for (let a = 0; a < NA; a++) out[a] = sw[a] / 255;
  else if (key === 'SGAS') for (let a = 0; a < NA; a++) out[a] = sg[a] / 255;
  else if (key === 'SOIL') for (let a = 0; a < NA; a++) out[a] = Math.max(0, 1 - (sw[a] + sg[a]) / 255);
  else if (key === 'PRESSURE') {
    const p = new Uint16Array(G.dyn, base + 2 * NA, NA);
    const [p0, p1] = model.dynamic.pressureRange, k = (p1 - p0) / 65535;
    for (let a = 0; a < NA; a++) out[a] = p0 + p[a] * k;
  } else out.fill(NaN);
}
function cellValue(key, f, a) {
  if (G.static[key]) return G.static[key][a];
  if (key === 'LAYER') return G.ijk[a * 3 + 2] + 1;
  if (key === 'ZONE') return G.zoneOfK[G.ijk[a * 3 + 2] + 1] + 1;
  const NA = G.NA, base = f * model.dynamic.frameBytes, u8 = new Uint8Array(G.dyn, base, 2 * NA);
  if (key === 'SWAT') return u8[a] / 255;
  if (key === 'SGAS') return u8[NA + a] / 255;
  if (key === 'SOIL') return Math.max(0, 1 - (u8[a] + u8[NA + a]) / 255);
  if (key === 'PRESSURE') {
    const [p0, p1] = model.dynamic.pressureRange;
    return p0 + new Uint16Array(G.dyn, base + 2 * NA, NA)[a] * (p1 - p0) / 65535;
  }
  return NaN;
}

function updateColors() {
  const p = propDef(S.prop), r = propRange(p), NA = G.NA, col = G.colors, v = G.vals;
  fillValues(S.prop, S.frame, v);
  if (p.type === 'category') {
    const pal = (cfg.colormaps[p.colormap] || cfg.colormaps.regions).map(hex);
    for (let a = 0; a < NA; a++) {
      const c = pal[((Math.round(v[a]) - 1) % pal.length + pal.length) % pal.length];
      col[a * 4] = c[0]; col[a * 4 + 1] = c[1]; col[a * 4 + 2] = c[2]; col[a * 4 + 3] = 255;
    }
  } else {
    const L = lut(p.colormap);
    for (let a = 0; a < NA; a++) {
      let t = norm(p, r, v[a]);
      if (!(t >= 0)) t = 0; else if (t > 1) t = 1;
      const i = Math.round(t * 255) * 3;
      col[a * 4] = L[i]; col[a * 4 + 1] = L[i + 1]; col[a * 4 + 2] = L[i + 2]; col[a * 4 + 3] = 255;
    }
  }
  gl.bindTexture(gl.TEXTURE_2D, G.tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TEX_W, G.texH, gl.RGBA, gl.UNSIGNED_BYTE, col);
}

function valueFilterOn() { return propDef(S.prop).type !== 'category' && (S.vf[0] > 0 || S.vf[1] < 100); }

function computeVisible() {
  const { i0, i1, j0, j1, k0, k1 } = S.cut, NA = G.NA, ijk = G.ijk, vis = G.vis;
  const vf = valueFilterOn(), p = propDef(S.prop), r = propRange(p);
  const lo = S.vf[0] / 100 - 1e-4, hi = S.vf[1] / 100 + 1e-4;
  for (let a = 0; a < NA; a++) {
    const i = ijk[a * 3] + 1, j = ijk[a * 3 + 1] + 1, k = ijk[a * 3 + 2] + 1;
    let ok = i >= i0 && i <= i1 && j >= j0 && j <= j1 && k >= k0 && k <= k1;
    if (ok && vf) { const t = norm(p, r, G.vals[a]); ok = t >= lo && t <= hi; }
    vis[a] = ok ? 1 : 0;
  }
}

// ---------------------------------------------------------------- formations + explode
function buildZones() {
  G.zoneOfK = new Int8Array(model.NK + 2).fill(-1);
  (cfg.zones || []).forEach((z, zi) => { for (let k = z.k[0]; k <= z.k[1] && k <= model.NK; k++) G.zoneOfK[k] = zi; });
}
function zoneName(k) { const z = (cfg.zones || [])[G.zoneOfK[k]]; return z ? z.name : '—'; }
function segmentOf(a) { return ((Math.round(G.static.FIPNUM[a]) - 1) % 4 + 4) % 4; }

function computeExplode() {
  const NA = G.NA, ijk = G.ijk, geom = G.geom, mode = S.explode.mode, t = S.explode.t / 100;
  const ex = cfg.explode || {};
  G.exOn = t > 0.001;
  if (!G.gOf) G.gOf = new Int16Array(NA);
  const gOf = G.gOf;
  let n;
  if (mode === 'layers') { n = model.NK; for (let a = 0; a < NA; a++) gOf[a] = ijk[a * 3 + 2]; }
  else if (mode === 'segments') { n = 4; for (let a = 0; a < NA; a++) gOf[a] = segmentOf(a); }
  else { n = Math.max(1, (cfg.zones || []).length); for (let a = 0; a < NA; a++) gOf[a] = Math.max(0, G.zoneOfK[ijk[a * 3 + 2] + 1]); }
  const cnt = new Float64Array(n), cx = new Float64Array(n), cy = new Float64Array(n), cz = new Float64Array(n);
  const bb = new Float64Array(n * 4).fill(NaN);
  let ax = 0, ay = 0;
  for (let a = 0; a < NA; a++) {
    const g = gOf[a], p = a * 24;
    const x = (geom[p] + geom[p + 21]) / 2, y = (geom[p + 1] + geom[p + 22]) / 2, z = (geom[p + 2] + geom[p + 23]) / 2;
    cnt[g]++; cx[g] += x; cy[g] += y; cz[g] += z; ax += x; ay += y;
    const q = g * 4;
    if (!(bb[q] <= x)) bb[q] = x; if (!(bb[q + 1] >= x)) bb[q + 1] = x;
    if (!(bb[q + 2] <= y)) bb[q + 2] = y; if (!(bb[q + 3] >= y)) bb[q + 3] = y;
  }
  ax /= NA; ay /= NA;
  for (let g = 0; g < n; g++) if (cnt[g]) { cx[g] /= cnt[g]; cy[g] /= cnt[g]; cz[g] /= cnt[g]; }
  const off = new Float32Array(n * 3);
  if (mode === 'segments') {
    const k = t * (ex.segmentSpread ?? 1.2);
    for (let g = 0; g < n; g++) if (cnt[g]) { off[g * 3] = (cx[g] - ax) * k; off[g * 3 + 1] = (cy[g] - ay) * k; }
  } else {
    const gap = (mode === 'layers' ? ex.layerGapMetres ?? 18 : ex.formationGapMetres ?? 70) * t;
    const used = []; for (let g = 0; g < n; g++) if (cnt[g]) used.push(g);
    used.forEach((g, r) => { off[g * 3 + 2] = (r - (used.length - 1) / 2) * gap; });
  }
  G.gOff = off; G.gN = n; G.gCnt = cnt; G.gCen = [cx, cy, cz]; G.gBox = bb;
  G.topOff = G.exOn && mode !== 'segments' ? Math.min(...Array.from({ length: n }, (_, g) => (cnt[g] ? off[g * 3 + 2] : Infinity))) : 0;
}

function buildWellBuffer() {
  const seg = [], SE = [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]];
  const ex = G.exOn, gOf = G.gOf, off = G.gOff, segMode = S.explode.mode === 'segments';
  const offOf = (c) => (ex && c >= 0 ? [off[gOf[c] * 3], off[gOf[c] * 3 + 1], off[gOf[c] * 3 + 2]] : [0, 0, 0]);
  G.wellHeads = [];
  model.wells.forEach((w, wi) => {
    const pc = w.pathCells || [];
    const pts = w.path.map((p, s) => {
      let o = [0, 0, 0];
      if (ex && pc.length === w.path.length) o = s > 0 ? offOf(pc[s]) : segMode ? offOf(pc[1]) : [0, 0, G.topOff];
      return [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
    });
    G.wellHeads[wi] = pts[0];
    (G.wellPts || (G.wellPts = []))[wi] = pts;
    for (let s = 0; s + 1 < pts.length; s++) {
      const A = pts[s], B = pts[s + 1];
      for (const [side, end] of SE) seg.push(A[0], A[1], A[2], B[0], B[1], B[2], side, end, wi);
    }
  });
  G.wellVerts = seg.length / 9;
  gl.bindBuffer(gl.ARRAY_BUFFER, G.wellBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(seg), gl.DYNAMIC_DRAW);
}

function rebuildFaces() {
  computeVisible();
  const NA = G.NA, nb = G.nb, vis = G.vis, geom = G.geom, ex = G.exOn, gOf = G.gOf, off = G.gOff;
  let n = 0;
  for (let a = 0; a < NA; a++) if (vis[a]) for (let f = 0; f < 6; f++) { const b = nb[a * 6 + f]; if (b < 0 || !vis[b] || (ex && gOf[b] !== gOf[a])) n++; }
  const need = n * 4 * 6;
  if (!G.vbuf || G.vbuf.length < need) G.vbuf = new Float32Array(Math.ceil(need * 1.25) + 24);
  const d = G.vbuf; let o = 0;
  const UV = [0, 0, 1, 0, 1, 1, 0, 1];
  for (let a = 0; a < NA; a++) {
    if (!vis[a]) continue;
    const ga = gOf[a] * 3, ox = ex ? off[ga] : 0, oy = ex ? off[ga + 1] : 0, oz = ex ? off[ga + 2] : 0;
    for (let f = 0; f < 6; f++) {
      const b = nb[a * 6 + f];
      if (b >= 0 && vis[b] && !(ex && gOf[b] !== gOf[a])) continue;
      const fc = FACES[f];
      for (let q = 0; q < 4; q++) {
        const g = (a * 8 + fc[q]) * 3;
        d[o] = geom[g] + ox; d[o + 1] = geom[g + 1] + oy; d[o + 2] = geom[g + 2] + oz;
        d[o + 3] = a; d[o + 4] = UV[q * 2]; d[o + 5] = UV[q * 2 + 1];
        o += 6;
      }
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, G.gridBuf);
  gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, o), gl.DYNAMIC_DRAW);
  G.faceCount = n;
}

// ---------------------------------------------------------------- WebGL
const GRID_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; layout(location=1) in float aCell; layout(location=2) in vec2 aUV;
uniform mat4 uMV, uP; uniform float uExag;
out vec3 vView; out vec2 vUV; flat out int vCell;
void main(){
  vec4 v = uMV * vec4(aPos.x, -aPos.z * uExag, -aPos.y, 1.0);
  vView = v.xyz; vUV = aUV; vCell = int(aCell + 0.5);
  gl_Position = uP * v;
}`;
const GRID_FS = `#version 300 es
precision highp float; precision highp int;
in vec3 vView; in vec2 vUV; flat in int vCell;
uniform sampler2D uTex; uniform int uMode, uPicked; uniform float uEdges;
out vec4 o;
void main(){
  if (uMode == 1) { int id = vCell + 1; o = vec4(float(id & 255), float((id >> 8) & 255), float((id >> 16) & 255), 255.0) / 255.0; return; }
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  vec3 c = texelFetch(uTex, ivec2(vCell % ${TEX_W}, vCell / ${TEX_W}), 0).rgb;
  float lamb = abs(dot(n, normalize(vec3(0.35, 0.75, 0.55))));
  float fill = abs(dot(n, normalize(vec3(-0.6, -0.2, 0.8))));
  vec3 col = c * (0.42 + 0.5 * lamb + 0.14 * fill);
  vec2 w = fwidth(vUV);
  vec2 g = smoothstep(vec2(0.0), w * 1.3, vUV) * smoothstep(vec2(0.0), w * 1.3, 1.0 - vUV);
  float edge = (1.0 - min(g.x, g.y)) * uEdges * (1.0 - smoothstep(0.06, 0.28, max(w.x, w.y)));
  col = mix(col, col * 0.55, edge);
  if (vCell == uPicked) col = mix(col, vec3(1.0), 0.6);
  o = vec4(col, 1.0);
}`;
const WELL_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aA; layout(location=1) in vec3 aB; layout(location=2) in vec2 aSE; layout(location=3) in float aWell;
uniform mat4 uMV, uP; uniform float uExag, uWidth, uAlpha, uGrow; uniform vec2 uVP; uniform vec4 uColor[64], uTint; uniform int uSel;
out vec4 vC;
vec4 clip(vec3 p){ return uP * uMV * vec4(p.x, -p.z * uExag, -p.y, 1.0); }
void main(){
  int wi = int(aWell + 0.5);
  vec4 a = clip(aA), b = clip(aB);
  vec4 cur = aSE.y < 0.5 ? a : b;
  vec2 sa = a.xy / a.w * uVP, sb = b.xy / b.w * uVP;
  vec2 dir = sb - sa; dir = length(dir) < 1e-4 ? vec2(1.0, 0.0) : normalize(dir);
  float wpx = uWidth * (wi == uSel ? 1.9 : 1.0) + uGrow;
  cur.xy += vec2(-dir.y, dir.x) * aSE.x * wpx / uVP * cur.w;
  gl_Position = cur;
  vec4 c = uColor[wi];
  vC = uTint.a > 0.0 ? vec4(uTint.rgb, uTint.a * step(0.01, c.a) * c.a) : c;
  vC.a *= uAlpha;
}`;
const WELL_FS = `#version 300 es
precision highp float; in vec4 vC; out vec4 o; void main(){ o = vC; }`;

function program(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('shader link: ' + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

function initGL() {
  G.grid = program(GRID_VS, GRID_FS);
  G.wellP = program(WELL_VS, WELL_FS);

  G.tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, G.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, TEX_W, G.texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, G.colors);
  for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST);

  G.gridVAO = gl.createVertexArray(); gl.bindVertexArray(G.gridVAO);
  G.gridBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.gridBuf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 24, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
  const maxFaces = G.NA * 6, idx = new Uint32Array(maxFaces * 6);
  for (let f = 0; f < maxFaces; f++) { const v = f * 4, o = f * 6; idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3; }
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  // wells: screen-space ribbons, 6 vertices per segment (filled by buildWellBuffer)
  G.wellVAO = gl.createVertexArray(); gl.bindVertexArray(G.wellVAO);
  G.wellBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.wellBuf);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 36, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 36, 24);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 36, 32);
  gl.bindVertexArray(null);
  G.wellColors = new Float32Array(64 * 4);
  setClearColor();
}

function setClearColor() {
  const c = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#DDE4E5';
  const [r, g, b] = hex(c.length === 4 ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c);
  G.clear = [r / 255, g / 255, b / 255];
}

// ---------------------------------------------------------------- camera
const M4 = {
  persp(fy, asp, n, f) { const t = 1 / Math.tan(fy / 2), nf = 1 / (n - f); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]); },
  look(e, c) {
    const z = nrm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = nrm(crs([0, 1, 0], z)), y = crs(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
  },
  mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
};
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function crs(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function nrm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

function defaultCam() {
  const [ex, ey] = model.extent, c = $('gl'), asp = (c.clientWidth || 1) / (c.clientHeight || 1);
  const fx = 2 * Math.atan(Math.tan(FOV / 2) * asp);
  const dist = (Math.hypot(ex, ey) / 2) / Math.tan(Math.min(FOV, fx) / 2);
  return { theta: 62, phi: 36, dist: dist * 0.97, target: [0, 0, 0] };
}
function initCamera() { if (!S.cam) S.cam = defaultCam(); }
function eye() {
  const { theta, phi, dist, target } = S.cam, t = theta * Math.PI / 180, p = phi * Math.PI / 180;
  return [target[0] + dist * Math.cos(p) * Math.sin(t), target[1] + dist * Math.sin(p), target[2] + dist * Math.cos(p) * Math.cos(t)];
}

// ---------------------------------------------------------------- render loop
function loop(now) {
  topside.tick(now || performance.now());   // topside: the flow animation's clock, idle when it is off
  if (G.anim) stepAnim(now || performance.now());
  if (R.colors) { updateColors(); R.colors = false; R.draw = true; if (valueFilterOn()) R.faces = true; }
  if (R.faces) { rebuildFaces(); R.faces = false; R.draw = true; }
  if (R.wells) { buildWellBuffer(); R.wells = false; R.draw = true; }
  if (R.draw) { draw(); R.draw = false; R.labels = true; }
  if (R.labels) { placeLabels(); updateGauge(); R.labels = false; }
  if (R.chart) { drawChart(); R.chart = false; }
  requestAnimationFrame(loop);
}

function sizeCanvas() {
  const c = $('gl'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return [w, h];
}
function matrices() {
  const [w, h] = sizeCanvas(), d = S.cam.dist;
  const P = M4.persp(FOV, w / h, d / 60, d * 20);
  const V = M4.look(eye(), S.cam.target);
  G.P = P; G.V = V; G.PV = M4.mul(P, V);
  return [w, h];
}

function drawGrid(mode) {
  const g = G.grid;
  gl.useProgram(g.p);
  gl.uniformMatrix4fv(g.u.uMV, false, G.V); gl.uniformMatrix4fv(g.u.uP, false, G.P);
  gl.uniform1f(g.u.uExag, S.exag); gl.uniform1i(g.u.uMode, mode);
  gl.uniform1i(g.u.uPicked, cardMode === 'cell' ? pick : G.hl ?? -1);
  gl.uniform1f(g.u.uEdges, S.edges ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, G.tex); gl.uniform1i(g.u.uTex, 0);
  gl.bindVertexArray(G.gridVAO);
  gl.drawElements(gl.TRIANGLES, G.faceCount * 6, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}

function wellColor(code) {
  const wc = cfg.wellColors;
  return hex([wc.shut, wc.producer, wc.waterInjector, wc.gasInjector][code] || wc.shut);
}
function draw() {
  topside.frameStart();   // topside: starts the frame timer the debug readout reports
  const [w, h] = matrices();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.clearColor(...G.clear, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND);
  drawGrid(0);
  if (S.wells && G.wellVerts) drawWells(w, h);
  topside.draw(w, h);   // topside: sea, seabed, facilities, pipelines and flow marks
}
function drawWells(w, h) {
  const wp = G.wellP, sel = model.wells.findIndex((x) => x.name === S.well);
  model.wells.forEach((wl, i) => {
    const code = wl.state[S.frame] || 0, c = wellColor(code);
    const drilled = wl.firstOpen >= 0 && S.frame >= wl.firstOpen;
    G.wellColors.set([c[0] / 255, c[1] / 255, c[2] / 255, !drilled ? 0 : code ? 1 : 0.5], i * 4);
  });
  gl.useProgram(wp.p);
  gl.uniformMatrix4fv(wp.u.uMV, false, G.V); gl.uniformMatrix4fv(wp.u.uP, false, G.P);
  gl.uniform1f(wp.u.uExag, S.exag); gl.uniform2f(wp.u.uVP, w / 2, h / 2);
  gl.uniform1f(wp.u.uWidth, (cfg.wellWidthPixels || 3.5) * Math.min(window.devicePixelRatio || 1, 2) / 2);
  gl.uniform4fv(wp.u.uColor, G.wellColors); gl.uniform1i(wp.u.uSel, sel);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(G.wellVAO);
  const dpr = Math.min(window.devicePixelRatio || 1, 2), oc = hex(cfg.wellColors.outline || '#0E1A20');
  gl.uniform4f(wp.u.uTint, 0, 0, 0, 0); gl.uniform1f(wp.u.uGrow, 0);
  gl.disable(gl.DEPTH_TEST); gl.uniform1f(wp.u.uAlpha, 0.3);
  gl.drawArrays(gl.TRIANGLES, 0, G.wellVerts);
  gl.enable(gl.DEPTH_TEST); gl.uniform1f(wp.u.uAlpha, 1);
  gl.depthMask(false);
  gl.uniform4f(wp.u.uTint, oc[0] / 255, oc[1] / 255, oc[2] / 255, 0.85); gl.uniform1f(wp.u.uGrow, 1.25 * dpr);
  gl.drawArrays(gl.TRIANGLES, 0, G.wellVerts);
  gl.depthMask(true);
  gl.uniform4f(wp.u.uTint, 0, 0, 0, 0); gl.uniform1f(wp.u.uGrow, 0);
  gl.drawArrays(gl.TRIANGLES, 0, G.wellVerts);
  gl.bindVertexArray(null);
  gl.disable(gl.BLEND);
}

function pickAt(cx, cy) {
  const [w, h] = matrices();
  if (!G.fbo || G.fboW !== w || G.fboH !== h) {
    if (G.fbo) { gl.deleteFramebuffer(G.fbo); gl.deleteRenderbuffer(G.rbC); gl.deleteRenderbuffer(G.rbD); }
    G.fbo = gl.createFramebuffer(); G.rbC = gl.createRenderbuffer(); G.rbD = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, G.rbC); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, G.rbD); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, G.rbC);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, G.rbD);
    G.fboW = w; G.fboH = h;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo);
  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  drawGrid(1);
  const c = $('gl'), px = new Uint8Array(4);
  const x = Math.round(cx / c.clientWidth * w), y = Math.round((1 - cy / c.clientHeight) * h);
  gl.readPixels(Math.min(w - 1, Math.max(0, x)), Math.min(h - 1, Math.max(0, y)), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  R.draw = true;
  return (px[0] | (px[1] << 8) | (px[2] << 16)) - 1;
}

// ---------------------------------------------------------------- well labels
// World space is x east, y up, z south (see the grid shader). project() takes a model
// point (x, y, depth) and converts it to that world space first.
function projectWorld(X, Y, Z) {
  const m = G.PV;
  const cx = m[0] * X + m[4] * Y + m[8] * Z + m[12], cy = m[1] * X + m[5] * Y + m[9] * Z + m[13], cw = m[3] * X + m[7] * Y + m[11] * Z + m[15];
  if (cw <= 0) return null;
  const c = $('gl');
  return [(cx / cw * 0.5 + 0.5) * c.clientWidth, (0.5 - cy / cw * 0.5) * c.clientHeight];
}
function project(p) { return projectWorld(p[0], -p[2] * S.exag, -p[1]); }
function buildLabels() {
  const box = $('labels'); box.innerHTML = '';
  G.zoneLabels = (cfg.zones || []).map((z) => {
    const el = document.createElement('span'); el.className = 'zl'; el.textContent = z.name; box.appendChild(el); return el;
  });
  G.labels = model.wells.map((w) => {
    const el = document.createElement('button');
    el.className = 'wl'; el.textContent = w.name; el.type = 'button';
    el.addEventListener('click', (e) => { e.stopPropagation(); selectWell(w.name); });
    box.appendChild(el);
    return el;
  });
}
function placeLabels() {
  if (!G.labels || !G.PV) return;
  const showZones = G.exOn && S.explode.mode === 'formations';
  (G.zoneLabels || []).forEach((el, g) => {
    let best = null;
    if (showZones && G.gCnt && G.gCnt[g]) {
      const b = G.gBox, q = g * 4, z = G.gCen[2][g] + G.gOff[g * 3 + 2];
      for (const [x, y] of [[b[q], b[q + 2]], [b[q], b[q + 3]], [b[q + 1], b[q + 2]], [b[q + 1], b[q + 3]]]) {
        const p = project([x, y, z]);
        if (p && (!best || p[0] < best[0])) best = p;
      }
    }
    if (!best) { el.style.display = 'none'; return; }
    el.style.display = '';
    const w = el.offsetWidth || 50;
    el.style.transform = `translate(${Math.round(Math.max(4, best[0] - 8 - w))}px, ${Math.round(best[1] - 11)}px)`;
  });
  const placed = [];
  const show = S.wells && S.labels;
  const items = [];
  model.wells.forEach((w, i) => {
    const el = G.labels[i], code = w.state[S.frame] || 0;
    const on = show && (code > 0 || w.name === S.well);
    const p = on ? project(G.wellHeads ? G.wellHeads[i] : w.path[0]) : null;
    if (!p) { el.style.display = 'none'; return; }
    const c = wellColor(code);
    el.style.setProperty('--c', `rgb(${c.join(',')})`);
    el.classList.toggle('sel', w.name === S.well);
    el.style.display = '';
    items.push({ el, x: p[0], y: p[1], sel: w.name === S.well ? 1 : 0 });
  });
  items.sort((a, b) => (b.sel - a.sel) || (a.y - b.y));
  const top = $('head').offsetHeight + 4;
  for (const it of items) {
    const wdt = it.el._w || (it.el._w = it.el.offsetWidth || 40), hgt = 19;
    const x = it.x - 6, y = it.y - hgt - 4;
    const hit = y < top || placed.some((r) => x < r.x + r.w + 2 && x + wdt + 2 > r.x && y < r.y + r.h && y + hgt > r.y);
    if (hit && !it.sel) { it.el.style.display = 'none'; continue; }
    placed.push({ x, y, w: wdt, h: hgt });
    it.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(y, top))}px)`;
  }
  topside.placeLabels();   // topside: the facility and pipeline labels
}

function buildWellKey() {
  const wc = cfg.wellColors;
  $('well-key').innerHTML = [['producer', 'Producer'], ['waterInjector', 'Water injector'], ['gasInjector', 'Gas injector'], ['shut', 'Shut']]
    .map(([k, label]) => `<span><i style="background:${wc[k]}"></i>${label}</span>`).join('');
  $('well-key').hidden = !S.wells;
}

// ---------------------------------------------------------------- north arrow + scale
// Round scale-bar lengths, one decade at a time. The gaps are small enough that the
// chosen bar always lands within about 82-137 px of the 106 px it aims for.
const SCALE_STEPS = [1, 1.5, 2, 2.5, 3, 5, 7.5];
const SCALE_PX = 106;
const DIRS = ['the top', 'the top right', 'the right', 'the bottom right',
  'the bottom', 'the bottom left', 'the left', 'the top left'];

// Both readings come from the live view matrix, measured at the camera target.
//   north  data/model.json centre is easting, northing, depth, and geometry.bin is
//          x, y, depth relative to it, so model +y is north. The grid shader maps a
//          model point to world (x, -depth * exag, -y), so north is world (0, 0, -1).
//   scale  M4.look builds the camera's right axis as cross(world up, view direction),
//          so it is always horizontal in world space and always across the screen:
//          the honest direction to measure horizontal metres per pixel along.
function updateGauge() {
  if (!G.PV || !G.V) return;
  const V = G.V, T = S.cam.target, d = Math.max(1, S.cam.dist * 0.02);
  const p0 = projectWorld(T[0], T[1], T[2]);
  if (!p0) return;
  const pE = projectWorld(T[0] + d * V[0], T[1] + d * V[4], T[2] + d * V[8]);
  const pN = projectWorld(T[0], T[1], T[2] - d);
  if (!pE || !pN) return;
  const acrossPx = Math.hypot(pE[0] - p0[0], pE[1] - p0[1]);

  // scale bar
  const ppm = acrossPx / d;
  if (ppm > 0 && Number.isFinite(ppm)) {
    let best = 0, err = Infinity;
    for (let e = -1; e <= 5; e++) for (const step of SCALE_STEPS) {
      const m = step * 10 ** e, x = Math.abs(Math.log(m * ppm / SCALE_PX));
      if (x < err) { err = x; best = m; }
    }
    const label = best >= 1000 ? `${+(best / 1000).toFixed(2)} km` : `${+best.toFixed(2)} m`;
    const exag = +(+S.exag).toFixed(1);
    $('scale-bar').style.width = `${Math.max(8, Math.round(best * ppm))}px`;
    if ($('scale-len').textContent !== label) $('scale-len').textContent = label;
    $('scale-sub').textContent = `vertical ×${exag}`;
    $('scale').setAttribute('aria-label', `Scale bar: ${label} across, measured level with the middle of the view. Depth is stretched ${exag} times.`);
  }

  // north arrow: the screen direction of the model's north, squashed as it tips away
  const nx = pN[0] - p0[0], ny = pN[1] - p0[1], nl = Math.hypot(nx, ny);
  if (nl > 0.01) G.north = Math.atan2(nx, -ny) * 180 / Math.PI;
  const a = G.north || 0, k = Math.max(0.3, acrossPx > 0 ? Math.min(1, nl / acrossPx) : 1);
  $('needle').setAttribute('transform', `translate(24 24) rotate(${a.toFixed(1)}) scale(1 ${k.toFixed(3)}) translate(-24 -24)`);
  const r = 18.5, rad = a * Math.PI / 180, t = $('compass-n');
  t.setAttribute('x', (24 + r * Math.sin(rad)).toFixed(1));
  t.setAttribute('y', (24 - r * Math.cos(rad)).toFixed(1));
  $('compass').setAttribute('aria-label', `North arrow: north is toward ${DIRS[((Math.round(a / 45) % 8) + 8) % 8]} of the view.`);
}

// ---------------------------------------------------------------- controls sheet
const GRIP = ['Show more controls', 'Show all controls', 'Hide the extra controls'];
function applyStop() {
  const sheet = $('sheet'), grip = $('grip');
  sheet.classList.remove('s0', 's1', 's2');
  sheet.classList.add('s' + S.sheet);
  grip.setAttribute('aria-label', GRIP[S.sheet]);
  grip.title = GRIP[S.sheet];
  R.draw = true; R.chart = true; R.labels = true;   // the stage changes size with the sheet
}
function setStop(n) {
  n = Math.max(0, Math.min(2, Math.round(n)));
  if (n === S.sheet) return;
  S.sheet = n; applyStop(); save();
}
// Drag the handle to move a stop at a time, or tap it to step through them. The handle
// takes touch-action: none so a drag is never read as a scroll; the canvas is untouched.
function initSheet() {
  const grip = $('grip');
  let drag = null, skipClick = false;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    skipClick = false;
    grip.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, moved: false };
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 5) drag.moved = true;
    if (dy > 44 && S.sheet < 2) { setStop(S.sheet + 1); drag.y = e.clientY; }
    else if (dy < -44 && S.sheet > 0) { setStop(S.sheet - 1); drag.y = e.clientY; }
  });
  grip.addEventListener('pointerup', () => { if (drag && drag.moved) skipClick = true; drag = null; });
  grip.addEventListener('pointercancel', () => { drag = null; });
  grip.addEventListener('click', () => {
    if (skipClick) { skipClick = false; return; }
    setStop((S.sheet + 1) % 3);
  });
  grip.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setStop(S.sheet + 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setStop(S.sheet - 1); }
  });
  applyStop();
}

// ---------------------------------------------------------------- formatting
function fmt(v, dec = 2) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtProp(p, v) {
  if (p.type === 'category') return String(Math.round(v));
  if (p.scale === 'log') return fmt(v, v < 10 ? 1 : 0);
  return fmt(v, p.decimals ?? 2);
}
function fmtDate(iso, long) {
  const [y, m, d] = iso.split('-').map(Number);
  return long ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
}
function fmtRate(v) {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1e6) return `${+(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)} M`;
  if (v >= 1e4) return `${fmt(v / 1e3, 0)} k`;
  return fmt(v, 0);
}

// ---------------------------------------------------------------- UI
function initUI() {
  buildChips();
  buildLabels();
  const t = $('time');
  t.max = G.nf - 1; t.value = S.frame;
  t.addEventListener('input', () => { stop(); setFrame(+t.value); });
  $('play').addEventListener('click', () => (playing ? stop() : play()));

  for (const ax of ['i', 'j', 'k']) {
    const a = $(ax + '0'), b = $(ax + '1');
    a.max = b.max = model['N' + ax.toUpperCase()];
    a.value = S.cut[ax + '0']; b.value = S.cut[ax + '1'];
    const on = (which) => {
      let lo = +a.value, hi = +b.value;
      if (lo > hi) { if (which === 0) b.value = hi = lo; else a.value = lo = hi; }
      S.cut[ax + '0'] = lo; S.cut[ax + '1'] = hi;
      $(ax + 'v').textContent = `${lo}–${hi}`;
      R.faces = true; save();
    };
    a.addEventListener('input', () => on(0)); b.addEventListener('input', () => on(1));
    $(ax + 'v').textContent = `${S.cut[ax + '0']}–${S.cut[ax + '1']}`;
  }
  const v0 = $('v0'), v1 = $('v1');
  v0.value = S.vf[0]; v1.value = S.vf[1];
  const onV = (which) => {
    let lo = +v0.value, hi = +v1.value;
    if (lo > hi) { if (which === 0) v1.value = hi = lo; else v0.value = lo = hi; }
    S.vf = [lo, hi]; updateValueOutput(); R.faces = true; save();
  };
  v0.addEventListener('input', () => onV(0)); v1.addEventListener('input', () => onV(1));

  const ex = $('exag');
  ex.value = S.exag; $('exv').textContent = `${S.exag}×`;
  ex.addEventListener('input', () => { S.cam.target[1] *= +ex.value / S.exag; S.exag = +ex.value; $('exv').textContent = `${S.exag}×`; R.draw = true; save(); });

  for (const [id, key] of [['t-wells', 'wells'], ['t-labels', 'labels'], ['t-edges', 'edges']]) {
    const el = $(id); el.checked = S[key];
    el.addEventListener('change', () => { S[key] = el.checked; R.draw = true; $('well-key').hidden = !S.wells; save(); });
  }
  $('reset-cut').addEventListener('click', () => {
    S.cut = { i0: 1, i1: model.NI, j0: 1, j1: model.NJ, k0: 1, k1: model.NK }; S.vf = [0, 100];
    for (const ax of ['i', 'j', 'k']) { $(ax + '0').value = 1; $(ax + '1').value = model['N' + ax.toUpperCase()]; $(ax + 'v').textContent = `1–${model['N' + ax.toUpperCase()]}`; }
    v0.value = 0; v1.value = 100; updateValueOutput();
    S.explode.t = 0; $('explode').value = 0; computeExplode(); R.wells = true;
    R.faces = true; save();
  });
  $('reset-view').addEventListener('click', fitView);
  $('fit').addEventListener('click', fitView);
  $('ins-focus').addEventListener('click', () => {
    if (cardMode === 'cell' && pick >= 0) { const a = pick; closeCard(); G.hl = a; focusCell(a); }
    else if (cardMode === 'well' && S.well) { const w = S.well; closeCard(); focusWell(w); }
  });
  let hintSeen = false; try { hintSeen = !!localStorage.getItem(LS_KEY + ':hint'); } catch { /* ignore */ }
  if (!hintSeen) { $('hint').hidden = false; setTimeout(hideHint, 7000); }
  $('ins-close').addEventListener('click', closeCard);
  const sel = $('well-pick');
  sel.innerHTML = '<option value="">Whole field</option>' + model.wells
    .filter((w) => Object.keys(model.summary.wells[w.name] || {}).length).map((w) => w.name).sort()
    .map((n) => `<option value="${n}">${n}</option>`).join('');
  sel.value = S.well || '';
  sel.addEventListener('change', () => selectWell(sel.value || null));

  const exs = $('explode'), exm = $('ex-mode');
  exs.value = S.explode.t; exm.value = S.explode.mode;
  const onEx = () => {
    S.explode = { mode: exm.value, t: +exs.value };
    computeExplode(); R.faces = true; R.wells = true; save();
  };
  exs.addEventListener('input', onEx); exm.addEventListener('change', onEx);

  topside.initUI();   // topside: the saved-viewpoint chips and the Topside group
  initSheet();
  initPointer();
  initChartSeek();
  setFrame(S.frame, true);
  applyProp();

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { setClearColor(); R.draw = true; R.chart = true; drawLegend(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshConfig(); });
  window.addEventListener('focus', refreshConfig);
}

async function refreshConfig() {
  try {
    const c = await loadJSON('config.json');
    if (c.text === cfgText) return;
    cfg = c.json; cfgText = c.text; lutCache.clear();
    if (!propDef(S.prop)) S.prop = cfg.properties[0].key;
    buildZones(); computeExplode(); buildLabels(); buildWellKey();
    buildChips(); applyProp(); R.draw = true; R.wells = true;
    topside.onConfig(cfg);   // topside: re-read its saved viewpoints and colours
  } catch { /* keep the settings already loaded */ }
}

function buildChips() {
  const box = $('props'); box.innerHTML = '';
  let prevDynamic = false;
  for (const p of cfg.properties) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.key = p.key;
    b.style.setProperty('--grad', gradCSS(p.colormap));
    b.textContent = p.short || p.label;
    if (!p.dynamic && prevDynamic) { const d = document.createElement('span'); d.className = 'chip-sep'; d.setAttribute('aria-hidden', 'true'); box.appendChild(d); }
    prevDynamic = !!p.dynamic;
    b.addEventListener('click', () => { S.prop = p.key; applyProp(); save(); });
    box.appendChild(b);
  }
}
function applyProp() {
  const p = propDef(S.prop);
  for (const b of $('props').querySelectorAll('.chip')) b.setAttribute('aria-checked', String(b.dataset.key === S.prop));
  $('prop-name').textContent = p.unit ? `${p.label}, ${p.unit}` : p.label;
  const cat = p.type === 'category';
  $('v0').disabled = $('v1').disabled = cat;
  updateValueOutput(); drawLegend();
  R.colors = true; R.faces = true;
  if (cardMode) refreshCard();
}
function updateValueOutput() {
  const p = propDef(S.prop), r = propRange(p);
  $('vv').textContent = p.type === 'category' ? '—' : (S.vf[0] === 0 && S.vf[1] === 100) ? 'all'
    : `${fmtProp(p, denorm(p, r, S.vf[0] / 100))}–${fmtProp(p, denorm(p, r, S.vf[1] / 100))}`;
}
function drawLegend() {
  const p = propDef(S.prop), r = propRange(p), c = $('leg-bar'), x = c.getContext('2d'), H = c.height;
  const named = p.key === 'ZONE', cats = $('leg-cats');
  for (const id of ['leg-bar', 'leg-max', 'leg-min', 'leg-unit']) $(id).hidden = named;
  cats.hidden = !named;
  if (named) {
    const pal = cfg.colormaps[p.colormap] || cfg.colormaps.regions;
    cats.innerHTML = (cfg.zones || []).map((z, i) => `<span><i style="background:${pal[i % pal.length]}"></i>${z.name}</span>`).join('');
    return;
  }
  if (p.type === 'category') {
    const pal = cfg.colormaps[p.colormap] || cfg.colormaps.regions, n = Math.round(r[1] - r[0] + 1);
    for (let i = 0; i < n; i++) { x.fillStyle = pal[(i + Math.round(r[0]) - 1) % pal.length]; x.fillRect(0, H - (i + 1) * H / n, c.width, Math.ceil(H / n)); }
  } else {
    const L = lut(p.colormap);
    for (let y = 0; y < H; y++) { const i = Math.round((1 - y / (H - 1)) * 255) * 3; x.fillStyle = `rgb(${L[i]},${L[i + 1]},${L[i + 2]})`; x.fillRect(0, y, c.width, 1); }
  }
  $('leg-max').textContent = fmtProp(p, r[1]);
  $('leg-min').textContent = fmtProp(p, r[0]);
  $('leg-unit').textContent = p.unit || '';
}

function setFrame(f, initial) {
  S.frame = Math.max(0, Math.min(G.nf - 1, f));
  $('time').value = S.frame;
  $('date').textContent = fmtDate(model.frames[S.frame]);
  if (propDef(S.prop).dynamic || initial) R.colors = true;
  R.draw = true; R.labels = true;
  updateCursor();
  if (cardMode) refreshCard();
  if (!initial) save();
}
function play() {
  if (S.frame >= G.nf - 1) setFrame(0);
  playing = true;
  $('play-icon').setAttribute('d', 'M7 5h4v14H7zM13 5h4v14h-4z');
  $('play').setAttribute('aria-label', 'Pause');
  let last = 0;
  const step = (t) => {
    if (!playing) return;
    if (t - last >= 1000 / (cfg.playbackFramesPerSecond || 6)) {
      last = t;
      if (S.frame >= G.nf - 1) { stop(); return; }
      setFrame(S.frame + 1);
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function stop() {
  playing = false;
  $('play-icon').setAttribute('d', 'M7 5l12 7-12 7z');
  $('play').setAttribute('aria-label', 'Play production history');
}

// ---------------------------------------------------------------- touch + mouse
function initPointer() {
  const c = $('gl'), pts = new Map();
  let down = null, pinch = null;
  let lastTap = null;
  c.addEventListener('pointerdown', (e) => {
    G.anim = null;
    c.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pts.size === 1) down = { x: e.offsetX, y: e.offsetY, t: performance.now(), moved: false, btn: e.button, shift: e.shiftKey };
    if (pts.size === 2) { pinch = pinchState(pts); if (down) down.moved = true; }
  });
  c.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId), cur = [e.offsetX, e.offsetY];
    pts.set(e.pointerId, cur);
    if (pts.size === 1 && down) {
      const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
      if (Math.hypot(e.offsetX - down.x, e.offsetY - down.y) > 6) down.moved = true;
      if (!down.moved) return;
      if (down.btn === 2 || down.shift) pan(dx, dy);
      else { S.cam.theta -= dx * 0.35; S.cam.phi = Math.max(-80, Math.min(88, S.cam.phi + dy * 0.3)); }
      R.draw = true;
    } else if (pts.size === 2 && pinch) {
      const now = pinchState(pts);
      S.cam.dist = clampDist(S.cam.dist * pinch.d / Math.max(now.d, 1));
      pan(now.x - pinch.x, now.y - pinch.y);
      pinch = now; R.draw = true;
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 0 && down) {
      if (!down.moved && performance.now() - down.t < 500 && e.type === 'pointerup') {
        const now = e.timeStamp;
        if (lastTap && now - lastTap.t < 380 && Math.hypot(down.x - lastTap.x, down.y - lastTap.y) < 30) { lastTap = null; focusAt(down.x, down.y); }
        else { lastTap = { t: now, x: down.x, y: down.y }; tap(down.x, down.y); }
      }
      down = null; save();
    }
  };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  c.addEventListener('contextmenu', (e) => e.preventDefault());
  c.addEventListener('wheel', (e) => { e.preventDefault(); S.cam.dist = clampDist(S.cam.dist * Math.exp(e.deltaY * 0.0015)); R.draw = true; save(); }, { passive: false });
}
function pinchState(pts) {
  const [a, b] = [...pts.values()];
  return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
}
function clampDist(d) { const m = Math.hypot(...model.extent); return Math.max(m * 0.012, Math.min(m * 6, d)); }

// ---------------------------------------------------------------- focus + camera animation
function cellWorld(a) {
  const p = a * 24, g = G.geom;
  let x = 0, y = 0, z = 0;
  for (let c = 0; c < 8; c++) { x += g[p + c * 3]; y += g[p + c * 3 + 1]; z += g[p + c * 3 + 2]; }
  x /= 8; y /= 8; z /= 8;
  if (G.exOn) { const o = G.gOf[a] * 3; x += G.gOff[o]; y += G.gOff[o + 1]; z += G.gOff[o + 2]; }
  return [x, -z * S.exag, -y];
}
function flyTo(target, dist, cam) {
  const to = { theta: S.cam.theta, phi: S.cam.phi, ...(cam || {}), target, dist: clampDist(dist) };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { S.cam = to; R.draw = true; save(); return; }
  G.anim = { from: { ...S.cam, target: [...S.cam.target] }, to, t0: performance.now(), dur: 520 };
  hideHint();
}
function stepAnim(now) {
  const A = G.anim; if (!A) return;
  const u = Math.min(1, (now - A.t0) / A.dur), k = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  const f = A.from, t = A.to;
  let dth = ((t.theta - f.theta) % 360 + 540) % 360 - 180;
  S.cam = {
    theta: f.theta + dth * k, phi: f.phi + (t.phi - f.phi) * k,
    dist: Math.exp(Math.log(f.dist) + (Math.log(t.dist) - Math.log(f.dist)) * k),
    target: f.target.map((v, i) => v + (t.target[i] - v) * k),
  };
  R.draw = true;
  if (u >= 1) { G.anim = null; save(); }
}
function focusDist() { return Math.max(Math.hypot(...model.extent) * 0.08, S.cam.dist * 0.42); }
function focusAt(x, y) {
  const a = pickAt(x, y);
  if (a < 0 || a >= G.NA) { fitView(); return; }
  closeCard(); G.hl = a;
  flyTo(cellWorld(a), Math.min(S.cam.dist, focusDist()));
}
function focusCell(a) { flyTo(cellWorld(a), Math.min(S.cam.dist, focusDist())); }
function focusWell(name) {
  const wi = model.wells.findIndex((w) => w.name === name);
  const pts = G.wellPts && G.wellPts[wi]; if (!pts || pts.length < 2) return;
  const inner = pts.slice(1);
  const c = [0, 1, 2].map((i) => inner.reduce((s, p) => s + p[i], 0) / inner.length);
  let r = 0; for (const p of inner) r = Math.max(r, Math.hypot(p[0] - c[0], p[1] - c[1], (p[2] - c[2]) * S.exag));
  const m = Math.hypot(...model.extent);
  flyTo([c[0], -c[2] * S.exag, -c[1]], Math.max(m * 0.25, r * 4));
}
function fitView() { const d = defaultCam(); flyTo(d.target, d.dist, { theta: d.theta, phi: d.phi }); }
function hideHint() { const h = $('hint'); if (h && !h.hidden) { h.hidden = true; try { localStorage.setItem(LS_KEY + ':hint', '1'); } catch { /* ignore */ } } }
function pan(dx, dy) {
  const V = G.V || M4.look(eye(), S.cam.target), c = $('gl');
  const k = 2 * S.cam.dist * Math.tan(FOV / 2) / (c.clientHeight || 1);
  const right = [V[0], V[4], V[8]], up = [V[1], V[5], V[9]];
  for (let i = 0; i < 3; i++) S.cam.target[i] += (-dx * right[i] + dy * up[i]) * k;
}
function tap(x, y) {
  G.hl = -1;
  if (topside.tap(x, y)) { R.draw = true; return; }   // topside: a facility or pipeline wins the tap
  const a = pickAt(x, y);
  if (a >= 0 && a < G.NA) { pick = a; cardMode = 'cell'; refreshCard(); placeCard(y); }
  else closeCard();
  R.draw = true;
}
// Keep the card away from the tapped spot, and let a quick second tap fall through to the model.
function placeCard(y) {
  const card = $('inspect'), stageH = $('stage').clientHeight;
  if (y > stageH * 0.5) { card.style.top = `${$('head').offsetHeight + 6}px`; card.style.bottom = 'auto'; }
  else { card.style.top = ''; card.style.bottom = ''; }
  card.style.pointerEvents = 'none';
  clearTimeout(G.cardTimer);
  G.cardTimer = setTimeout(() => { card.style.pointerEvents = ''; }, 450);
}

// ---------------------------------------------------------------- details card
function closeCard() { cardMode = null; pick = -1; $('inspect').hidden = true; R.draw = true; topside.deselect(); }   // topside: clear its selection too
function row(dl, k, v) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
function sep(dl, text) { const d = document.createElement('div'); d.className = 'sep'; dl.appendChild(d); if (text) { const dt = document.createElement('dt'); dt.textContent = text; dt.style.gridColumn = '1 / -1'; dt.style.color = 'var(--ink)'; dl.appendChild(dt); } }
function refreshCard() {
  if (cardMode === 'topside') return topside.card();   // topside: facility and pipeline cards
  $('ins-focus').hidden = false;                       // topside: its card hides this button
  const dl = $('ins-list'); dl.innerHTML = '';
  const date = fmtDate(model.frames[S.frame], true);
  if (cardMode === 'cell' && pick >= 0) {
    const a = pick, i = G.ijk[a * 3] + 1, j = G.ijk[a * 3 + 1] + 1, k = G.ijk[a * 3 + 2] + 1, f = S.frame;
    $('ins-title').textContent = `Cell I ${i}, J ${j}, K ${k}`;
    dl.className = 'c4';
    const sv = (key) => G.static[key] ? G.static[key][a] : NaN;
    row(dl, 'Formation', zoneName(k));
    row(dl, 'Segment', String(segmentOf(a) + 1));
    row(dl, 'Depth', `${fmt(sv('DEPTH'), 0)} m`);
    row(dl, 'Porosity', fmt(sv('PORO'), 3));
    row(dl, 'Perm X', `${fmt(sv('PERMX'), sv('PERMX') < 10 ? 1 : 0)} mD`);
    row(dl, 'Perm Z', `${fmt(sv('PERMZ'), sv('PERMZ') < 10 ? 2 : 0)} mD`);
    row(dl, 'NTG', fmt(sv('NTG'), 2));
    sep(dl, date);
    row(dl, 'Oil sat.', fmt(cellValue('SOIL', f, a), 2));
    row(dl, 'Water sat.', fmt(cellValue('SWAT', f, a), 2));
    row(dl, 'Gas sat.', fmt(cellValue('SGAS', f, a), 2));
    row(dl, 'Pressure', `${fmt(cellValue('PRESSURE', f, a), 0)} bar`);
  } else if (cardMode === 'well' && S.well) {
    const w = model.wells.find((x) => x.name === S.well); if (!w) return closeCard();
    $('ins-title').textContent = w.name;
    dl.className = '';
    const firstOn = w.state.findIndex((s) => s > 0), lastOn = w.state.length - 1 - [...w.state].reverse().findIndex((s) => s > 0);
    const roles = [...new Set(w.state.filter((s) => s > 0))].map((s) => ROLE[s]).join(', ');
    const ks = w.cells.map((c) => c[2]);
    row(dl, 'Role', roles || 'Never opened');
    row(dl, 'Completions', `${w.cells.length} cells, layers ${Math.min(...ks)}–${Math.max(...ks)}`);
    if (firstOn >= 0) row(dl, 'Open', `${fmtDate(model.frames[firstOn])} to ${fmtDate(model.frames[lastOn])}`);
    sep(dl, date);
    row(dl, 'Status', ROLE[w.state[S.frame] || 0]);
    const sm = model.summary.wells[w.name] || {};
    const lab = { oil: 'Oil produced', water: 'Water produced', gas: 'Gas produced', winj: 'Water injected', ginj: 'Gas injected' };
    for (const k in lab) if (sm[k]) row(dl, lab[k], `${fmtRate(sm[k][S.frame])} Sm³/d`);
  } else return closeCard();
  $('ins-focus').textContent = cardMode === 'well' ? 'Zoom to well' : 'Zoom to cell';
  $('inspect').hidden = false;
}
function selectWell(name) {
  S.well = name;
  $('well-pick').value = name && [...$('well-pick').options].some((o) => o.value === name) ? name : '';
  if (name) { cardMode = 'well'; pick = -1; refreshCard(); } else if (cardMode === 'well') closeCard();
  R.draw = true; R.chart = true; save();
}

// ---------------------------------------------------------------- chart
// The fifth element marks a reported series: it is drawn only while the topside layer's
// "Reported production" row is on, and it puts "(simulated)" on the simulated ones.
const SERIES = {
  liquid: [['oil', 'Oil produced', 'var(--c-oil)', false], ['water', 'Water produced', 'var(--c-water)', false], ['winj', 'Water injected', 'var(--c-water)', true],
    ['repOil', 'Oil (reported, NOD)', 'var(--c-oil)', '1 3', true], ['repWater', 'Water (reported, NOD)', 'var(--c-water)', '1 3', true]],
  gas: [['gas', 'Gas produced', 'var(--c-gas)', false], ['ginj', 'Gas injected', 'var(--c-gas)', true],
    ['repGasSold', 'Gas sold (reported, NOD)', 'var(--c-gas)', '1 3', true]],
};
function frameT(f) {
  if (!G.days) { G.days = model.frames.map((iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5); }
  const d = G.days; return (d[f] - d[0]) / (d[d.length - 1] - d[0] || 1);
}
frameT.days0 = () => { frameT(0); return G.days[0]; };
frameT.days1 = () => { frameT(0); return G.days[G.days.length - 1]; };
function niceCeil(v) { if (v <= 0) return 1; const e = 10 ** Math.floor(Math.log10(v)), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
function drawChart() {
  const svg = $('chart'), W = svg.clientWidth || 320, H = svg.clientHeight || 132, nf = G.nf;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const src = (S.well ? model.summary.wells[S.well] : model.summary.field) || {};
  $('chart-title').textContent = S.well ? `${S.well} rates, Sm³/d` : 'Field rates, Sm³/d';
  const X = (f) => frameT(f) * W;
  const panels = [{ key: 'liquid', y0: H * 0.1, y1: H * 0.56 }, { key: 'gas', y0: H * 0.68, y1: H * 0.86 }];
  let html = '', keyHtml = '';
  for (const pn of panels) {
    const list = SERIES[pn.key].filter(([k, , , , rep]) => (!rep || topside.reported()) && src[k] && src[k].some((v) => v > 0));   // topside: the reported rows
    const max = niceCeil(Math.max(0, ...list.flatMap(([k]) => src[k])));
    html += `<line class="grid" x1="0" x2="${W}" y1="${pn.y1}" y2="${pn.y1}"/><line class="grid" x1="0" x2="${W}" y1="${pn.y0}" y2="${pn.y0}" stroke-dasharray="2 3"/>`;
    html += `<text x="2" y="${pn.y0 - 3}">${list.length ? fmtRate(max) : (pn.key === 'gas' ? 'No gas flow' : 'No liquid flow')}</text>`;
    for (const [k, label, color, dashed, rep] of list) {
      const d = src[k].map((v, f) => `${f ? 'L' : 'M'}${X(f).toFixed(1)} ${(pn.y1 - (v / max) * (pn.y1 - pn.y0)).toFixed(1)}`).join('');
      html += `<path class="ln" d="${d}" stroke="${color}"${dashed ? ` stroke-dasharray="${dashed === true ? '4 3' : dashed}"` : ''}/>`;   // topside: a string dash pattern for the reported rows
      keyHtml += `<span><i class="${dashed === '1 3' ? 'dot' : dashed ? 'd' : ''}" style="--c:${color}"></i>${topside.label(label, rep)}</span>`;   // topside: "(simulated)" beside a reported row, and its own dot pattern
    }
  }
  const d0 = frameT.days0(), d1 = frameT.days1();
  for (let y = 1998; y <= 2010; y += 2) {
    const t = (Date.UTC(y, 0, 1) / 864e5 - d0) / (d1 - d0);
    if (t < 0.02 || t > 0.98) continue;
    const x = (t * W).toFixed(1);
    html += `<text x="${x}" y="${H - 2}" text-anchor="middle">${y}</text><line class="grid" x1="${x}" x2="${x}" y1="${H * 0.86}" y2="${H * 0.9}"/>`;
  }
  html += `<line id="chart-cursor" class="cursor" y1="0" y2="${H * 0.88}"/>`;
  svg.innerHTML = html;
  $('chart-key').innerHTML = keyHtml;
  updateCursor();
}
function updateCursor() {
  const c = document.getElementById('chart-cursor'); if (!c) return;
  const W = $('chart').clientWidth || 320, x = frameT(S.frame) * W;
  c.setAttribute('x1', x); c.setAttribute('x2', x);
}
function initChartSeek() {
  const svg = $('chart'); let active = false;
  const seek = (e) => {
    const r = svg.getBoundingClientRect(), t = (e.clientX - r.left) / r.width;
    let best = 0, bd = 9;
    for (let f = 0; f < G.nf; f++) { const d = Math.abs(frameT(f) - t); if (d < bd) { bd = d; best = f; } }
    if (best !== S.frame) setFrame(best);
  };
  svg.addEventListener('pointerdown', (e) => { active = true; stop(); svg.setPointerCapture(e.pointerId); seek(e); });
  svg.addEventListener('pointermove', (e) => { if (active) seek(e); });
  const end = () => { active = false; };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
}
