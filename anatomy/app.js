// Anatomy: a human body in 3D under the template's house system (ART.md; NOTES.md for the data).
// The plate is the body in its own colors; at its left edge the Levels, this body's vertebrae drawn
// as the rule a height in the trunk is read by (js/levels.js holds the math). Everything the app
// reads is in data/; every number it writes goes through js/units.js.

import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import * as U from './js/units.js';
import * as LV from './js/levels.js';

const CREDIT = 'BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP and CC BY 4.0';
const EDITION = 'BodyParts3D 3.0 and 4.0';

/* ---------- small helpers ---------- */
const $ = (id) => document.getElementById(id);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
};
const svgNS = document.querySelector('svg').namespaceURI;   // the page's own inline marks carry it
/** A drawn mark: an <svg> of the given box holding the given path data. */
const mark = (w, hgt, d, cls) => {
  const s = document.createElementNS(svgNS, 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${hgt}`); s.setAttribute('width', w); s.setAttribute('height', hgt); s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  for (const [c, p] of d) { const e = document.createElementNS(svgNS, 'path'); e.setAttribute('d', p); if (c) e.setAttribute('class', c); s.append(e); }
  return s;
};
const KEY = 'skeleton-viewer:';
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};
const FOCUS_KEY = KEY + 'focus';
/** The house's --draw curve, cubic-bezier(0.2, 0, 0, 1), for motion that answers a touch. */
const ease = (t) => {
  let lo = 0, hi = 1, s = t;
  for (let i = 0; i < 24; i++) { const x = 3 * (1 - s) ** 2 * s * 0.2 + s ** 3; if (x < t) lo = s; else hi = s; s = (lo + hi) / 2; }
  return 3 * (1 - s) * s * s + s ** 3;
};
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const say = (t) => { const l = $('live'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 50); };

/* ---------- state ---------- */
// How Explode moves the parts: the weights of the region, group and part offsets.
const EXPLODE_BY = { regions: [1, 0, 0], groups: [1, 1, 0], bones: [1, 1, 1] };
const BY_WORD = { regions: 'region', groups: 'group', bones: 'part' };
// Per-level spread, per axis (x = lateral, y = vertical, z = front/back)
const SPREAD = {
  R: new THREE.Vector3(1.4, 0.7, 0.9),
  G: new THREE.Vector3(1.7, 0.8, 1.1),
  P: new THREE.Vector3(1.05, 1.05, 1.05),
};
const S = {
  explode: store.get('explode', 0),
  level: store.get('level', 'bones'),
  layers: store.get('layerModes', {}),   // layer id -> 'on' | 'fade' | 'off'
  hidden: new Set(store.get('hidden', [])),
  isolate: store.get('isolate', null),
  ghost: store.get('ghost', false),
  sel: null,
};
if (!EXPLODE_BY[S.level]) S.level = 'bones';
const W = new THREE.Vector3(...EXPLODE_BY[S.level]);   // current level weights (animated)
const WT = W.clone();

let anat = null, geoMeta = null, started = false, focus = false;
const LAYER_DEFAULT = { skin: 'fade' };
const CORE = ['bone', 'tooth'];   // never peeled
const mode = (l) => S.layers[l] || LAYER_DEFAULT[l] || 'on';
const layerFactor = {};
const prevMode = store.get('layerPrev', {});
let stepping = null;
let layersById = new Map();
const parts = new Map();          // id -> { meta, mesh, dR, dG, dP }
const geoBox = new Map();         // id -> geometry.json's box, the data's own
let regionsById = new Map(), groupsById = new Map();
let meshes = [];
let V = [], B = [];               // the vertebrae and their bands (js/levels.js)
const stats = { frames: 0, renders: 0, levels: 0 };

/* ---------- notices ---------- */
function notice(text) { const n = $('notice'); n.textContent = text; n.hidden = !text; }
if (location.protocol === 'file:') notice('This app reads its data over Snuggery’s own server; opened as a file, the browser blocks it.');

/* ---------- renderer ---------- */
const canvas = $('view'), plate = $('plate');
let renderer = null;
try {
  // the stencil buffer keeps the selection's outline outside the selection's own silhouette (the outline below)
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true, powerPreference: 'high-performance' });
} catch { notice('This phone gave no WebGL, which the 3D view needs.'); }
if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
}

const scene = new THREE.Scene();
if (renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
}
scene.environmentIntensity = 0.75;
const key = new THREE.DirectionalLight(0xfff6ea, 1.55);
key.position.set(-1.2, 2.4, 2.2);
scene.add(key);
const rim = new THREE.DirectionalLight(0xdfe8ff, 0.7);
rim.position.set(1.6, 1.2, -2.0);
scene.add(rim);
const root = new THREE.Group();
scene.add(root);

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 60);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.rotateSpeed = 0.85;
controls.zoomSpeed = 0.9;
controls.minDistance = 0.08;
controls.maxDistance = 12;
controls.screenSpacePanning = true;

/* ---------- the loop: it asks for a frame only while something moves ---------- */
let raf = 0, dirty = true;
function kick() { if (!raf && started && renderer && document.visibilityState !== 'hidden') raf = requestAnimationFrame(loop); }
const requestRender = () => { dirty = true; kick(); };
controls.addEventListener('change', requestRender);
controls.addEventListener('start', () => { tapAt = null; });
controls.addEventListener('end', () => { keepFit(); saveCamera(); placeCard(); });
// `fit` says the camera still stands where a fit put it (turned, but not moved in or across), so a
// change of the explode can fit the body again (refitIfFitted); stored with the camera.
const saveCamera = () => store.set('camera', { p: camera.position.toArray(), t: controls.target.toArray(), fit: fitted });

function loop(now) {
  raf = 0;
  stats.frames++;
  const had = tweens.size > 0;
  runTweens(now);
  const moved = controls.update();
  if (moved || dirty || had) {
    renderer.render(scene, camera);
    stats.renders++;
    dirty = false;
    drawLevels();
  }
  if (tweens.size || moved) kick();
}

const levelsCanvas = $('levels');
/** The safe-area insets in CSS px, read from a probe padded by env(safe-area-inset-*) on every resize:
 *  the camera's fit keeps the body out of them (room()). Headless browsers report 0; a phone does not. */
const SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
function readSafe() {
  const cs = getComputedStyle($('safe-probe'));
  SAFE.top = parseFloat(cs.paddingTop) || 0; SAFE.right = parseFloat(cs.paddingRight) || 0;
  SAFE.bottom = parseFloat(cs.paddingBottom) || 0; SAFE.left = parseFloat(cs.paddingLeft) || 0;
}
function resize() {
  const w = plate.clientWidth, hgt = plate.clientHeight;
  if (!w || !hgt || !renderer) return;
  readSafe();
  tapAt = null;
  renderer.setSize(w, hgt, false);
  camera.aspect = w / hgt;
  camera.updateProjectionMatrix();
  const r = Math.min(devicePixelRatio || 1, 2);
  levelsCanvas.width = Math.round(levelsCanvas.clientWidth * r);
  levelsCanvas.height = Math.round(hgt * r);
  for (const m of hullMats) m.uniforms.res.value.set(w, hgt);
  layoutKeys();
  // a camera still at a fit fits the new plate at once (focus mode, the Layers sheet, a turn of the phone)
  if (fitted && started && !camTween) fitWhole(null, 0);
  placeCard();
  requestRender();
}
new ResizeObserver(resize).observe(plate);
/** The key column needs about 196 px; on a shorter plate the keys run as a row along its top. */
function layoutKeys() { plate.classList.toggle('keys-row', plate.clientHeight < 212); }

/* ---------- tweens ---------- */
const tweens = new Set();
function tween(ms, step, done) {
  const tw = { step, done, t0: performance.now(), ms };
  if (reduced.matches) tw.ms = 0;
  tweens.add(tw);
  kick();
  return {
    stop: () => tweens.delete(tw),
    finish: () => { if (tweens.delete(tw)) { tw.step(1, 1); tw.done && tw.done(); requestRender(); } },
  };
}
function runTweens(now) {
  for (const tw of tweens) {
    const k = tw.ms <= 0 ? 1 : Math.min(1, (now - tw.t0) / tw.ms);
    tw.step(ease(k), k);
    if (k >= 1) { tweens.delete(tw); tw.done && tw.done(); }
  }
}
/** Every running tween lands on its end: a hidden page, or Reduce Motion turned on. */
function landTweens() {
  // a tween's end can start another (an explode that ends refits the camera), so land until none is left
  for (let n = 0; tweens.size && n < 8; n++) for (const tw of [...tweens]) { tweens.delete(tw); tw.step(1, 1); tw.done && tw.done(); }
  requestRender();
}
reduced.addEventListener('change', () => { if (reduced.matches) landTweens(); });

/* ---------- loading ---------- */
const stamp = $('stamp');
async function readJSON(url) {
  let r;
  try { r = await fetch(url, { cache: 'no-store' }); } catch { throw new Error(`${url} could not be read.`); }
  if (!r.ok) throw new Error(`${url} could not be read (HTTP ${r.status}).`);
  const text = await r.text();
  try { return JSON.parse(text); } catch {
    throw new Error(/^\s*</.test(text) ? `${url} is not valid JSON; it looks like a web page was written over it.` : `${url} is not valid JSON.`);
  }
}
async function readBinary(url, expected, onProgress) {
  let r;
  try { r = await fetch(url, { cache: 'no-store' }); } catch { throw new Error(`${url} could not be read.`); }
  if (!r.ok) throw new Error(`${url} could not be read (HTTP ${r.status}).`);
  const short = (got) => new Error(`${url} holds ${U.int(got)} bytes; data/geometry.json says ${U.int(expected)}.`);
  if (!r.body || !r.body.getReader) { const b = await r.arrayBuffer(); if (b.byteLength !== expected) throw short(b.byteLength); return b; }
  const reader = r.body.getReader(), out = new Uint8Array(expected);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > out.length) { got += value.length; for (;;) { const n = await reader.read(); if (n.done) break; got += n.value.length; } throw short(got); }
    out.set(value, got);
    got += value.length;
    onProgress(got);
  }
  if (got !== expected) throw short(got);
  return out.buffer;
}

function buildGeometry(buf, p) {
  const q = new Uint16Array(buf, p.p, p.v * 3);
  const pos = new Float32Array(p.v * 3);
  const s0 = (p.max[0] - p.min[0]) / 65535, s1 = (p.max[1] - p.min[1]) / 65535, s2 = (p.max[2] - p.min[2]) / 65535;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = p.min[0] + q[i] * s0;
    pos[i + 1] = p.min[1] + q[i + 1] * s1;
    pos[i + 2] = p.min[2] + q[i + 2] * s2;
  }
  const idx = p.t === 16 ? new Uint16Array(buf, p.x, p.i) : new Uint32Array(buf, p.x, p.i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx.slice(), 1));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

const ROUGH = { bone: 0.62, cartilage: 0.34, tooth: 0.28, skin: 0.58, muscle: 0.5, organ: 0.4, artery: 0.36, vein: 0.36, nerve: 0.62 };
// A selected part writes 1 into the stencil buffer wherever it is drawn (applyLook() switches
// stencilWrite on for it); the outline's hulls draw only where the stencil is not 1.
const materialFor = (layer) => new THREE.MeshStandardMaterial({
  roughness: ROUGH[layer] ?? 0.5, metalness: 0,
  side: layer === 'bone' || layer === 'tooth' ? THREE.FrontSide : THREE.DoubleSide,
  stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
});

async function load() {
  if (!renderer || location.protocol === 'file:') return;
  try {
    [geoMeta, anat] = await Promise.all([readJSON('data/geometry.json'), readJSON('data/anatomy.json')]);
    if (!Array.isArray(geoMeta.parts) || !Array.isArray(anat.parts) || !Array.isArray(anat.layers)) throw new Error('data/geometry.json or data/anatomy.json does not hold the parts this app reads.');
    const files = geoMeta.files || [{ url: 'data/geometry.bin', bytes: geoMeta.bytes }];
    const total = files.reduce((n, f) => n + f.bytes, 0);
    const bufs = [];
    let done = 0;
    stamp.textContent = `Reading the geometry… ${U.ofMB(0, total)}`;
    for (const f of files) {
      bufs.push(await readBinary(f.url, f.bytes, (got) => { stamp.textContent = `Reading the geometry… ${U.ofMB(done + got, total)}`; }));
      done += f.bytes;
    }
    const metaById = new Map(anat.parts.map((p) => [p.id, p]));
    const todo = geoMeta.parts.filter((gp) => metaById.has(gp.id));
    let n = 0;
    for (const gp of todo) {
      const meta = metaById.get(gp.id);
      geoBox.set(gp.id, gp);
      const mesh = new THREE.Mesh(buildGeometry(bufs[gp.f || 0], gp), materialFor(meta.layer));
      mesh.userData.id = gp.id;
      root.add(mesh);
      parts.set(gp.id, { meta, mesh, dR: new THREE.Vector3(), dG: new THREE.Vector3(), dP: new THREE.Vector3() });
      meshes.push(mesh);
      if (++n % 40 === 0) {
        stamp.textContent = `Building the structures… ${U.ofN(n, todo.length)}`;
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    // Parts the data hides by default start hidden the first time this device sees them, including
    // parts added to the data later; after that the person's own choice is kept.
    const defaults = anat.parts.filter((p) => p.defaultHidden && parts.has(p.id)).map((p) => p.id);
    const applied = new Set(store.get('defaultsApplied', []));
    const fresh = defaults.filter((id) => !applied.has(id));
    if (fresh.length) {
      for (const id of fresh) S.hidden.add(id);
      store.set('hidden', [...S.hidden]);
      store.set('defaultsApplied', [...new Set([...applied, ...defaults])]);
    }
    await document.fonts.load('560 10.5px "Ysabeau Office"');
    applyAnatomy(anat);
    start();
  } catch (err) {
    stamp.textContent = 'The model could not be read.';
    notice(err.message);
  }
}

/* ---------- anatomy (editable data) ---------- */
function applyAnatomy(a) {
  anat = a;
  layersById = new Map((a.layers || []).map((l) => [l.id, l]));
  regionsById = new Map((a.regions || []).map((r) => [r.id, { ...r, parts: [] }]));
  groupsById = new Map((a.groups || []).map((g) => [g.id, { ...g, parts: [] }]));
  for (const pm of a.parts) {
    const P = parts.get(pm.id);
    if (!P) continue;
    P.meta = pm;
    groupsById.get(pm.group)?.parts.push(pm.id);
    regionsById.get(pm.region)?.parts.push(pm.id);
  }
  V = LV.vertebrae(a, geoMeta);
  B = LV.bands(V);
  stamp.replaceChildren(h('span', { translate: 'no', text: EDITION }), `, ${U.count(parts.size, 'structure')}`);
  computeExplodeVectors();
  buildDepth();
  buildLayerRows();
  buildTree();
  buildAbout();
  applyLook();
  updateStatus();
  syncLayerUI();
  if (S.sel && !idsOf(S.sel).length) S.sel = null;
  if (S.sel) renderCard();
  requestRender();
}

function boxOf(ids) {
  const b = new THREE.Box3();
  for (const id of ids) { const P = parts.get(id); if (P) b.union(P.mesh.geometry.boundingBox); }
  return b;
}
const tmp = new THREE.Vector3();
function computeExplodeVectors() {
  const all = boxOf(parts.keys());
  const cB = all.getCenter(new THREE.Vector3());
  const cR = new Map(), cG = new Map();
  for (const [id, r] of regionsById) cR.set(id, boxOf(r.parts).getCenter(new THREE.Vector3()));
  for (const [id, g] of groupsById) cG.set(id, boxOf(g.parts).getCenter(new THREE.Vector3()));
  for (const P of parts.values()) {
    const c = P.mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    const r = cR.get(P.meta.region) || cB, g = cG.get(P.meta.group) || r;
    P.dR.subVectors(r, cB).multiply(SPREAD.R);
    const bias = regionsById.get(P.meta.region)?.explodeBias;
    if (Array.isArray(bias)) P.dR.add(tmp.fromArray(bias));
    P.dG.subVectors(g, r).multiply(SPREAD.G);
    P.dP.subVectors(c, g).multiply(SPREAD.P);
  }
  applyExplode();
}
function applyExplode() {
  const e = S.explode;
  for (const P of parts.values()) {
    tmp.set(0, 0, 0).addScaledVector(P.dR, W.x).addScaledVector(P.dG, W.y).addScaledVector(P.dP, W.z).multiplyScalar(e);
    P.mesh.position.copy(tmp);
  }
  if (anat) applyLook('skin');
  setCaption();
  requestRender();
}

/* ---------- selection helpers ---------- */
function idsOf(ref) {
  if (!ref) return [];
  if (ref.kind === 'part') return parts.has(ref.id) ? [ref.id] : [];
  if (ref.kind === 'group') return groupsById.get(ref.id)?.parts || [];
  if (ref.kind === 'region') return regionsById.get(ref.id)?.parts || [];
  return [];
}
function refName(ref) {
  if (!ref) return '';
  if (ref.kind === 'part') return parts.get(ref.id)?.meta.name || '';
  if (ref.kind === 'group') {
    const g = groupsById.get(ref.id);
    if (!g) return '';
    const r = regionsById.get(g.region);
    return /^(left|right)/i.test(r?.name || '') && !/(left|right)/i.test(g.name) ? `${g.name}, ${r.name.toLowerCase()}` : g.name;
  }
  return regionsById.get(ref.id)?.name || '';
}
/** The selection's height, from the data's own boxes: { lo, hi } in meters. */
function restSpan(ids) {
  let lo = Infinity, hi = -Infinity;
  for (const id of ids) { const b = geoBox.get(id); if (b) { lo = Math.min(lo, b.min[1]); hi = Math.max(hi, b.max[1]); } }
  return lo <= hi ? { lo, hi } : null;
}
const spanOf = (ref) => { const s = restSpan(idsOf(ref)); return s && B.length ? LV.spanWords(s.lo, s.hi, B) : ''; };
function isVisible(P) {
  if (mode(P.meta.layer) === 'off') return false;
  if (S.hidden.has(P.meta.id)) return false;
  if (S.isolate) return idsOf(S.isolate).includes(P.meta.id);
  return true;
}
const applyVisibility = () => { applyLook(); updateStatus(); };
const colSel = new THREE.Color();
const skinFactor = () => 1 - THREE.MathUtils.smoothstep(S.explode, 0.03, 0.28);
function applyLook(onlyLayer) {
  if (!anat) return;
  const C = anat.colors || {};
  const selIds = new Set(idsOf(S.sel));
  colSel.set(darkQuery.matches ? (C.selectedDark || '#8ea2ff') : (C.selected || '#3552d6'));
  const iso = S.isolate ? new Set(idsOf(S.isolate)) : null;
  const ghosting = S.ghost && selIds.size > 0;
  // up to OUTLINE_MAX parts the ink outline alone marks the selection, and the structure keeps its own
  // color; a larger group or region (no outline) takes the data's selection color at 0.3 (ART.md section 2)
  const outlined = selIds.size > 0 && selIds.size <= OUTLINE_MAX;
  for (const P of parts.values()) {
    const L = P.meta.layer;
    if (onlyLayer && L !== onlyLayer) continue;
    const lay = layersById.get(L) || {}, t = anat.types[P.meta.type] || {}, m = P.mesh.material;
    const md = mode(L);
    const shown = md !== 'off' && !S.hidden.has(P.meta.id) && (!iso || iso.has(P.meta.id));
    const isSel = selIds.has(P.meta.id);
    m.color.set(P.meta.color || (P.meta.tissue === 'connective' && lay.connectiveColor) || t.color || lay.color || '#e6d9bf');
    if (isSel && !outlined) m.color.lerp(colSel, TINT);
    m.stencilWrite = isSel && outlined;
    let o = md === 'fade' && !isSel ? (lay.fade ?? 0.18) : 1;
    if (ghosting && !isSel) o = Math.min(o, 0.12);
    if (L === 'skin') o *= skinFactor();
    o *= layerFactor[L] ?? 1;
    P.mesh.visible = shown && o > 0.004;
    const tr = o < 0.999;
    // Under X-ray the selection is drawn after the see-through layers, over them, so it keeps its own
    // color: the 12 % layers in front of it would otherwise wash it toward the plate. It stays opaque
    // (alpha 1, writing depth and, outlined, the stencil) and pickable; only its place in the order moves.
    const over = ghosting && isSel;
    if (m.transparent !== (tr || over)) { m.transparent = tr || over; m.needsUpdate = true; }
    m.opacity = o;
    m.depthWrite = !tr;
    P.mesh.renderOrder = over ? 2 : tr ? 1 : 0;
    P.solid = P.mesh.visible && !tr;
  }
  requestRender();
}

/* ---------- the selection's outline: the house's ink mark around the silhouette (ART.md section 2) ---------- */
// Two back-face hulls per selected part, sharing its geometry, each vertex pushed along its normal by
// a constant number of screen pixels: the halo at 3 px, then the ink at 1.5 px over it. A hull's back
// faces lie at the surface's own depth, so on a thin or double-sided mesh they would z-fight with it
// and scribble inside the silhouette; the stencil test keeps every hull pixel outside the selection.
const OUTLINE_MAX = 60;
const TINT = 0.3;
const HULL_VS = `uniform float px; uniform vec2 res;
void main() {
  vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 n = projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0);
  float l = length(n.xy);
  if (l > 1e-6) c.xy += n.xy / l * px * 2.0 / res * c.w;
  gl_Position = c;
}`;
const HULL_FS = 'uniform vec3 color; uniform float alpha; void main() { gl_FragColor = vec4(color, alpha); }';
const hullMat = (px) => new THREE.ShaderMaterial({
  uniforms: { px: { value: px }, res: { value: new THREE.Vector2(1, 1) }, color: { value: new THREE.Vector3() }, alpha: { value: 1 } },
  vertexShader: HULL_VS, fragmentShader: HULL_FS, side: THREE.BackSide, transparent: true, depthWrite: false,
  stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc,
});
const hullMats = [hullMat(3), hullMat(1.5)];
let hulls = [];
/** A CSS color ("#0f1c23" or "rgba(r, g, b, a)") as sRGB numbers 0 to 1 and an alpha. */
function rgbaOf(s) {
  const m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [[0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255), 1];
  const v = (s.match(/rgba?\(([^)]+)\)/) || ['', '0,0,0,1'])[1].split(',').map(Number);
  return [v.slice(0, 3).map((c) => c / 255), v[3] ?? 1];
}
function themeHulls() {
  const [halo, ha] = rgbaOf(css('--select-halo')), [ink] = rgbaOf(css('--ink'));
  hullMats[0].uniforms.color.value.set(...halo); hullMats[0].uniforms.alpha.value = ha;
  hullMats[1].uniforms.color.value.set(...ink);
}
function outline() {
  for (const m of hulls) m.parent && m.parent.remove(m);
  hulls = [];
  const ids = idsOf(S.sel);
  if (!ids.length || ids.length > OUTLINE_MAX) { requestRender(); return; }
  themeHulls();
  for (const id of ids) {
    const P = parts.get(id);
    hullMats.forEach((mat, i) => { const m = new THREE.Mesh(P.mesh.geometry, mat); m.renderOrder = 10 + i; m.raycast = () => {}; P.mesh.add(m); hulls.push(m); });
  }
  requestRender();
}

/* ---------- camera ---------- */
function visibleBox(ids) {
  const b = new THREE.Box3(), bb = new THREE.Box3();
  root.updateMatrixWorld(true);
  for (const id of ids || parts.keys()) {
    const P = parts.get(id);
    if (!P || !P.mesh.visible) continue;
    bb.copy(P.mesh.geometry.boundingBox).applyMatrix4(P.mesh.matrixWorld);
    b.union(bb);
  }
  return b;
}
/** The room on the plate the body is fitted into: the plate less the Levels at the left, the keys at
 *  the right (or along the top) and the status plate at the foot, each with its safe-area inset (in
 *  focus mode the plate runs up under the status bar); and, when the selection itself is framed, less
 *  the card, so the card never covers what it describes. */
function room(forSel) {
  const W0 = plate.clientWidth, H0 = plate.clientHeight, row = plate.classList.contains('keys-row');
  const r = { left: 50 + SAFE.left, right: (row || focus ? 8 : 54) + SAFE.right, top: row && !focus ? 52 : focus ? 8 + SAFE.top : 8, bottom: $('status').hidden ? 8 : 52, W: W0, H: H0 };
  const card = $('card');
  if (forSel && !card.hidden && card.offsetTop < H0 / 2) r.top = Math.max(r.top, card.offsetTop + card.offsetHeight + 8);
  else if (forSel && !card.hidden) r.bottom = Math.max(r.bottom, H0 - card.offsetTop + 8);
  if (H0 - r.top - r.bottom < H0 * 0.35) { r.top = 8; r.bottom = 8; }
  return r;
}
function frame(box, dir, ms = 750, forSel = false) {
  if (box.isEmpty()) return null;
  const center = box.getCenter(new THREE.Vector3());
  const d = (dir ? dir.clone() : camera.position.clone().sub(controls.target)).normalize();
  const up = Math.abs(d.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, d).normalize();
  const camUp = new THREE.Vector3().crossVectors(d, right).normalize();
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const R = room(forSel), rw = R.W - R.left - R.right, rh = R.H - R.top - R.bottom;
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), th = tv * camera.aspect;
  // the target sits off the box's center so the center lands in the middle of the room, not of the plate
  const aim = (D) => { const k = (2 * D * tv) / R.H; return center.clone().addScaledVector(right, -(R.left + rw / 2 - R.W / 2) * k).addScaledVector(camUp, (R.top + rh / 2 - R.H / 2) * k); };
  // the nearest distance at which all eight corners of the box project inside the room, 4 % to spare
  const fits = (D) => {
    const t = aim(D), eye = t.clone().addScaledVector(d, D), v = new THREE.Vector3();
    return corners.every((c) => {
      v.subVectors(c, eye); const z = -v.dot(d);
      if (z <= camera.near) return false;
      const x = R.W / 2 + (v.dot(right) / (z * th)) * (R.W / 2), y = R.H / 2 - (v.dot(camUp) / (z * tv)) * (R.H / 2);
      return x >= R.left + rw * 0.04 && x <= R.W - R.right - rw * 0.04 && y >= R.top + rh * 0.04 && y <= R.H - R.bottom - rh * 0.04;
    });
  };
  let lo = 0.05, hi = 40;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
  // small structures: back off so the surrounding bones give context
  const D = hi < 0.5 ? Math.max(hi * 1.7, 0.32) : hi;
  const target = aim(D), pos = target.clone().addScaledVector(d, D);
  moveCamera(pos, target, ms);
  return { pos, target };
}
let camTween = null;
function moveCamera(pos, target, ms = 750) {
  camTween && camTween.stop();
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  camTween = tween(ms, (k) => {
    camera.position.lerpVectors(p0, pos, k);
    controls.target.lerpVectors(t0, target, k);
    camera.lookAt(controls.target);
    requestRender();
  }, () => { camTween = null; if (fitted) lastFit = { t: controls.target.clone(), d: camera.position.distanceTo(controls.target) }; saveCamera(); placeCard(); });
}
const VIEW_DIRS = {
  front: new THREE.Vector3(0, 0.02, 1),
  back: new THREE.Vector3(0, 0.02, -1),
  left: new THREE.Vector3(1, 0.02, 0),     // the body's own left is +X
  right: new THREE.Vector3(-1, 0.02, 0),
  top: new THREE.Vector3(0, 1, 0.012),
};
/** The box a fit frames: every part that is not hidden (or the isolated ones), as drawn, whatever its
 *  layer's mode, so removing a layer never moves the camera's fit and a fit after the explode returns
 *  to 0 is the opening's. */
function fitBox() {
  const b = new THREE.Box3(), bb = new THREE.Box3(), iso = S.isolate ? new Set(idsOf(S.isolate)) : null;
  root.updateMatrixWorld(true);
  for (const [id, P] of parts) {
    if (S.hidden.has(id) || (iso && !iso.has(id))) continue;
    bb.copy(P.mesh.geometry.boundingBox).applyMatrix4(P.mesh.matrixWorld);
    b.union(bb);
  }
  return b;
}
let fitted = false, lastFit = null;
const fitWhole = (dir, ms) => { frame(fitBox(), dir, ms); fitted = true; lastFit = null; };
/** After a drag: a turn keeps the fit; a pinch or a pan (the distance or the target moved) ends it. */
function keepFit() {
  const t = controls.target, d = camera.position.distanceTo(t);
  if (!fitted) return;
  if (!lastFit) { lastFit = { t: t.clone(), d }; return; }
  if (lastFit.t.distanceTo(t) > 1e-4 || Math.abs(lastFit.d - d) > 1e-4) fitted = false;
}
function refitIfFitted() { if (fitted && started) fitWhole(null); }
for (const b of document.querySelectorAll('#views button')) b.addEventListener('click', () => fitWhole(VIEW_DIRS[b.dataset.view]));
$('fit').addEventListener('click', () => fitWhole(null));
function zoom(f) {
  fitted = false;
  const off = camera.position.clone().sub(controls.target);
  const len = THREE.MathUtils.clamp(off.length() * f, controls.minDistance, controls.maxDistance);
  moveCamera(controls.target.clone().addScaledVector(off.normalize(), len), controls.target.clone());
}
$('zoom-in').addEventListener('click', () => zoom(0.7));
$('zoom-out').addEventListener('click', () => zoom(1 / 0.7));

/* ---------- explode ---------- */
const slider = $('explode'), btnExplode = $('btn-explode');
function syncExplodeUI() {
  const v = Math.round(S.explode * 100);
  slider.value = v;
  slider.style.setProperty('--fill', v + '%');
  slider.setAttribute('aria-valuetext', `${U.pctSpoken(v / 100)}, by ${BY_WORD[S.level]}`);
  btnExplode.textContent = S.explode > 0.5 ? 'Assemble' : 'Explode';
}
let explodeTween = null;
function animateExplode(to, ms = 900) {
  explodeTween && explodeTween.stop();
  const from = S.explode;
  explodeTween = tween(ms, (k) => { S.explode = from + (to - from) * k; applyExplode(); syncExplodeUI(); }, () => { explodeTween = null; store.set('explode', S.explode); refitIfFitted(); });
}
slider.addEventListener('input', () => {
  explodeTween && explodeTween.stop();
  S.explode = slider.value / 100;
  applyExplode();
  syncExplodeUI();
});
slider.addEventListener('change', () => { store.set('explode', S.explode); refitIfFitted(); });
btnExplode.addEventListener('click', () => animateExplode(S.explode > 0.5 ? 0 : 1));

function setLevel(level, animate = true) {
  S.level = level;
  store.set('level', level);
  WT.set(...EXPLODE_BY[level]);
  for (const b of $('ex-by').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.level === level));
  radioTabs($('ex-by'));
  syncExplodeUI();
  const from = W.clone();
  // the words set how the body comes apart; Explode and the track do the moving
  tween(animate ? 600 : 0, (k) => { W.lerpVectors(from, WT, k); applyExplode(); }, () => { if (!explodeTween) refitIfFitted(); });
}
for (const b of $('ex-by').querySelectorAll('button')) b.addEventListener('click', () => setLevel(b.dataset.level));

/** A radio group: one tab stop (the chosen), the arrow keys move the choice. */
function radioTabs(g) {
  const bs = [...g.querySelectorAll('[role="radio"]')], on = bs.find((b) => b.getAttribute('aria-checked') === 'true') || bs[0];
  for (const b of bs) b.tabIndex = b === on ? 0 : -1;
}
function radioKeys(g) {
  g.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    const bs = [...g.querySelectorAll('[role="radio"]')], i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const n = bs[(i + step + bs.length) % bs.length];
    n.focus(); n.click();
  });
}
radioKeys($('ex-by'));

/* ---------- layers: the depth words, the step keys, the Layers sheet ---------- */
const layerRows = $('layer-rows'), btnPeel = $('btn-peel'), btnAdd = $('btn-add');
const layerCount = (id) => anat.parts.filter((p) => p.layer === id && parts.has(p.id)).length;
const order = () => anat.layers.map((l) => l.id).filter((id) => layerCount(id));
function setMode(L, m) {
  S.layers[L] = m;
  store.set('layerModes', S.layers);
  applyVisibility(); syncLayerUI(); buildTreeState();
}
const MODES = [['off', 'Off'], ['fade', 'Faded'], ['on', 'On']];
function buildLayerRows() {
  layerRows.replaceChildren(...anat.layers.filter((l) => layerCount(l.id)).map((l) => {
    const g = h('div', { class: 'words', role: 'radiogroup', 'aria-label': l.name },
      MODES.map(([md, word]) => h('button', { type: 'button', role: 'radio', 'data-mode': md, text: word, onclick: () => setMode(l.id, md) })));
    radioKeys(g);
    const row = h('div', { class: 'lrow' }, h('span', { class: 'swatch', style: `--c:${l.color}`, 'aria-hidden': 'true' }), h('span', { class: 'lname', text: l.name }), h('span', { class: 'lcount', text: U.int(layerCount(l.id)) }), g);
    row.dataset.layer = l.id;
    return row;
  }));
}
/** The depth words: the data's short names in peel order, teeth left out (they are never peeled). */
function buildDepth() {
  const g = $('depth');
  g.replaceChildren(...order().filter((id) => id !== 'tooth').map((id) => {
    const b = h('button', { type: 'button', role: 'radio', text: layersById.get(id).short, onclick: () => setDepth(id) });
    b.dataset.layer = id;
    return b;
  }));
}
radioKeys($('depth'));
const nextPeel = () => order().find((l) => !CORE.includes(l) && mode(l) !== 'off');
const nextAdd = () => order().filter((l) => mode(l) === 'off').pop();
function syncLayerUI() {
  if (!anat) return;
  for (const r of layerRows.querySelectorAll('.lrow')) {
    const md = mode(r.dataset.layer);
    for (const b of r.querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.mode === md));
    radioTabs(r);
  }
  const outer = order().find((l) => l !== 'tooth' && mode(l) !== 'off');
  for (const b of $('depth').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.layer === outer));
  radioTabs($('depth'));
  const busy = !!stepping, lp = nextPeel() && layersById.get(nextPeel()), la = nextAdd() && layersById.get(nextAdd());
  // The visible words begin the accessible name (WCAG 2.5.3); the names are the camera's (HOUSE 7.4).
  btnPeel.disabled = !lp || busy;
  btnPeel.textContent = lp ? `Remove the ${lp.short.toLowerCase()}` : CORE.every((l) => mode(l) !== 'off') ? 'Only bone and teeth are left' : 'Nothing more to remove';
  btnPeel.setAttribute('aria-label', lp ? `Remove the ${lp.name.toLowerCase()} layer` : btnPeel.textContent);
  btnAdd.disabled = !la || busy;
  btnAdd.textContent = la ? `Bring back the ${la.short.toLowerCase()}` : 'Every layer is showing';
  btnAdd.setAttribute('aria-label', la ? `Bring back the ${la.name.toLowerCase()} layer` : 'Every layer is showing');
}
function peel() {
  const L = nextPeel();
  if (!L || stepping) return;
  prevMode[L] = mode(L); store.set('layerPrev', prevMode);
  stepping = L; syncLayerUI();
  tween(320, (k) => { layerFactor[L] = 1 - k; applyLook(L); },
    () => { layerFactor[L] = 1; stepping = null; setMode(L, 'off'); say(`${layersById.get(L).name} removed.`); });
}
function addBack() {
  const L = nextAdd();
  if (!L || stepping) return;
  let m = prevMode[L] || LAYER_DEFAULT[L] || 'on';
  if (m === 'off') m = 'on';
  stepping = L;
  layerFactor[L] = 0;
  setMode(L, m);
  tween(320, (k) => { layerFactor[L] = k; applyLook(L); },
    () => { layerFactor[L] = 1; stepping = null; applyLook(L); syncLayerUI(); say(`${layersById.get(L).name} brought back.`); });
}
/** A depth word: the body from that layer in. Every layer outside it goes off, remembered as Remove
 *  remembers it; it and every layer inside it that is off comes back in the mode it had. */
function setDepth(L) {
  if (stepping) return;
  const ids = order(), at = ids.indexOf(L);
  const off = ids.slice(0, at).filter((l) => mode(l) !== 'off');
  const on = ids.slice(at).filter((l) => mode(l) === 'off');
  if (!off.length && !on.length) return;
  for (const l of off) prevMode[l] = mode(l);
  store.set('layerPrev', prevMode);
  for (const l of on) { let m = prevMode[l] || LAYER_DEFAULT[l] || 'on'; if (m === 'off') m = 'on'; S.layers[l] = m; layerFactor[l] = 0; }
  stepping = L;
  store.set('layerModes', S.layers);
  applyVisibility(); syncLayerUI();
  tween(320, (k) => {
    for (const l of off) layerFactor[l] = 1 - k;
    for (const l of on) layerFactor[l] = k;
    applyLook();
  }, () => {
    for (const l of [...off, ...on]) layerFactor[l] = 1;
    for (const l of off) S.layers[l] = 'off';
    stepping = null;
    store.set('layerModes', S.layers);
    applyVisibility(); syncLayerUI(); buildTreeState();
    const names = (ls) => ls.map((l) => layersById.get(l).name).join(', ');
    say([off.length ? `${names(off)} removed.` : '', on.length ? `${names(on)} brought back.` : ''].filter(Boolean).join(' '));
  });
}
btnPeel.addEventListener('click', peel);
btnAdd.addEventListener('click', addBack);
const layersSheet = $('layers');
function showLayers(on) {
  if (on && focus) return;
  layersSheet.hidden = !on;
  document.body.classList.toggle('has-layers', on);
  $('btn-layers').setAttribute('aria-expanded', String(on));
}
$('btn-layers').addEventListener('click', () => showLayers(layersSheet.hidden));
$('layers-close').addEventListener('click', (e) => { showLayers(false); if (e.detail === 0) $('btn-layers').focus(); });
$('layers-all').addEventListener('click', () => { for (const l of anat.layers) S.layers[l.id] = 'on'; store.set('layerModes', S.layers); applyVisibility(); syncLayerUI(); buildTreeState(); });

/* ---------- status (hidden / isolated) ---------- */
function updateStatus() {
  const el = $('status'), txt = $('status-text'), was = el.hidden;
  if (S.isolate) txt.textContent = `Showing only ${refName(S.isolate)}`;
  else {
    // Structures the data hides by default (reference pieces) are not the person's doing, so they are not counted.
    const n = [...S.hidden].filter((id) => !parts.get(id)?.meta.defaultHidden).length;
    if (n) txt.textContent = `${U.count(n, 'structure')} hidden`;
    el.hidden = !n;
    if (was !== el.hidden) placeCard();
    return;
  }
  el.hidden = false;
  if (was) placeCard();
}
$('status-reset').addEventListener('click', () => {
  S.isolate = null; S.hidden.clear();
  persistVis(); syncLayerUI(); applyVisibility(); buildTreeState();
  if (S.sel) renderCard();
});
function persistVis() {
  store.set('hidden', [...S.hidden]);
  store.set('isolate', S.isolate);
  store.set('layerModes', S.layers);
}

/* ---------- the card ---------- */
const card = $('card');
const sameRef = (a, b) => !!a && !!b && a.kind === b.kind && a.id === b.id;
// X-ray turned on because a flight landed on a structure the layers in front hide (revealFrom); it
// belongs to that selection and goes off with it. X-ray pressed by hand is kept, as it always was.
let autoGhost = false;
function select(ref, { fly = false, spoken = true, at = null } = {}) {
  const was = S.sel;
  tapAt = at;
  S.sel = ref && idsOf(ref).length ? ref : null;
  if (autoGhost && !sameRef(was, S.sel)) { autoGhost = false; S.ghost = false; }
  applyLook();
  outline();
  renderCard(!was);
  markTreeSelection();
  setCaption();
  const note = S.sel && fly ? flyToSel() : '';
  if (S.sel && spoken) {
    const words = spanOf(S.sel), m = S.sel.kind === 'part' ? parts.get(S.sel.id).meta : null;
    const what = m ? layersById.get(m.layer)?.short || '' : U.count(idsOf(S.sel).length, 'structure');
    say(`${refName(S.sel)}. ${what}.${words ? ` Levels ${words}.` : ''}${note}`);
  }
}
/** Fly to the selection; when it lands where the layers in front hide it, X-ray goes on. Returns the
 *  sentence that says so, or ''. */
function flyToSel() {
  fitted = false;
  const to = frame(visibleBox(idsOf(S.sel)), null, 750, true);
  return to ? revealFrom(to.pos) : '';
}
function revealFrom(eye) {
  if (S.ghost) return '';
  const blocker = blockerOf(idsOf(S.sel), eye);
  if (!blocker) return '';
  S.ghost = true; autoGhost = true;
  applyLook();
  $('c-ghost').setAttribute('aria-pressed', 'true');
  const layer = layersById.get(parts.get(blocker).meta.layer);
  return ` X-ray on, so it shows through the ${(layer?.short || 'layers').toLowerCase()}.`;
}
/** The part that stands in front of the selection when the camera is at `eye`, or null when the
 *  selection can be seen: rays from `eye` to eight of its vertices, spread over its parts; the first
 *  ray that meets the selection before anything else settles it as seen. */
const rayTo = new THREE.Vector3();
function blockerOf(ids, eye) {
  root.updateMatrixWorld(true);
  const sel = new Set(ids), solid = meshes.filter((m) => parts.get(m.userData.id).solid);
  const shown = ids.filter((id) => parts.get(id)?.mesh.visible);
  let blocker = null;
  for (let k = 0; k < 8 && shown.length; k++) {
    const P = parts.get(shown[Math.floor((k * shown.length) / 8)]), pos = P.mesh.geometry.attributes.position;
    const p = new THREE.Vector3().fromBufferAttribute(pos, Math.floor(((k + 0.5) / 8) * pos.count)).applyMatrix4(P.mesh.matrixWorld);
    const dist = p.distanceTo(eye);
    ray.set(eye, rayTo.subVectors(p, eye).normalize());
    const hit = ray.intersectObjects(solid, false)[0];
    if (!hit) continue;
    if (sel.has(hit.object.userData.id)) return null;
    if (hit.distance < dist - 1e-3) blocker = blocker || hit.object.userData.id;
  }
  return blocker;
}
function renderCard(fresh = false) {
  if (!S.sel) { card.hidden = true; card.classList.remove('compact'); return; }
  const ref = S.sel, where = $('c-where');
  let name = refName(ref), latin = '', desc = '', note = '', layer = '', label = '', tooth = '';
  const keyTo = (text, to) => h('button', { type: 'button', text, onclick: () => select(to) });
  if (ref.kind === 'part') {
    const m = parts.get(ref.id).meta, t = anat.types[m.type] || {};
    latin = m.latin || t.latin || ''; desc = m.description || t.description || layersById.get(m.layer)?.description || ''; note = m.note || '';
    layer = layersById.get(m.layer)?.name || '';
    label = m.label || ''; tooth = m.fdi ? String(m.fdi) : '';
    const g = groupsById.get(m.group), r = regionsById.get(m.region);
    where.replaceChildren(...[g && keyTo(g.name, { kind: 'group', id: g.id }), g && r && ', ', r && keyTo(r.name, { kind: 'region', id: r.id })].filter(Boolean));
  } else {
    const obj = ref.kind === 'group' ? groupsById.get(ref.id) : regionsById.get(ref.id);
    desc = obj.description || '';
    const r = ref.kind === 'group' && regionsById.get(obj.region);
    where.replaceChildren(U.count(obj.parts.length, 'structure'), ...(r ? [', ', keyTo(r.name, { kind: 'region', id: r.id })] : []));
  }
  $('c-name').textContent = name;
  const set = (id, v) => { $(id).textContent = v; };
  set('c-latin', latin); $('c-latin').hidden = !latin;
  set('c-layer', layer); $('r-layer').hidden = !layer;
  set('c-levels', spanOf(ref)); $('r-levels').hidden = !B.length;
  set('c-label', label); $('r-label').hidden = !label;
  set('c-tooth', tooth); $('r-tooth').hidden = !tooth;
  set('c-desc', desc); $('c-desc').hidden = !desc;
  set('c-note', note); $('c-note').hidden = !note;
  const iso = S.isolate && S.isolate.kind === ref.kind && S.isolate.id === ref.id;
  $('c-isolate').textContent = iso ? 'Show all' : 'Isolate';
  $('c-ghost').setAttribute('aria-pressed', String(!!S.ghost));
  if (fresh || card.hidden) { card.hidden = false; card.style.animation = 'none'; void card.offsetWidth; card.style.animation = ''; }
  $('card-body').scrollTop = 0;
  placeCard();
}
/** Where the card goes (HOUSE 4.7): beside the Levels at the plate's top-left, or at its bottom-left,
 *  whichever keeps it clear of the point the opening tap touched, so it never opens under the finger,
 *  and covers less of the selection's projected box. Where neither place clears the finger, it narrows
 *  to end left of it, or else shrinks into the taller band above or below it. As wide as the room left
 *  of the key column; in focus mode level with the ghost key and ending 8 px before it, or under it on
 *  a plate too narrow for that. At most 55 % of the plate's height, 80 % in the compact form. */
const FINGER = 24;   // CSS px kept clear around a tapped point: half a fingertip
let tapAt = null;    // the plate point of the tap that opened or changed the card, until the view moves
function placeCard() {
  if (card.hidden || !started) return;
  const W0 = plate.clientWidth, H0 = plate.clientHeight, row = plate.classList.contains('keys-row'), g = $('focus-exit');
  const left = card.offsetLeft, compact = H0 < 420, maxH = Math.floor(H0 * (compact ? 0.8 : 0.55)) - 8;
  let top = row ? 52 : 8, right = W0 - (row ? 8 : 54) - SAFE.right;
  if (focus) {
    top = g.offsetTop; right = W0 - 8 - SAFE.right;
    if (g.offsetLeft - 8 - left >= 180) right = g.offsetLeft - 8; else top += g.offsetHeight + 8;
  }
  let w = Math.max(180, Math.min(280, right - left));
  card.classList.toggle('compact', compact);
  card.style.width = `${w}px`;
  card.style.maxHeight = `${maxH}px`;
  const st = $('status'), foot = H0 - 8 - (st.hidden ? 0 : st.offsetHeight + 8), box = selRect();
  const finger = tapAt && { left: tapAt.x - FINGER, right: tapAt.x + FINGER, top: tapAt.y - FINGER, bottom: tapAt.y + FINGER };
  let ch = card.offsetHeight, y = top;
  /** How much of a rectangle the card would cover with its top at y, in px². */
  const cover = (at, r) => (r ? Math.max(0, Math.min(left + w, r.right) - Math.max(left, r.left)) * Math.max(0, Math.min(at + ch, r.bottom) - Math.max(at, r.top)) : 0);
  const spots = [top, Math.max(top, foot - ch)].filter((at) => !cover(at, finger));
  if (spots.length) y = spots.reduce((a, b) => (cover(b, box) < cover(a, box) ? b : a));
  else if (finger.left - 8 - left >= 180) { w = Math.min(w, finger.left - 8 - left); card.style.width = `${w}px`; }
  else {
    const above = finger.top - 8 - top, below = foot - finger.bottom - 8;
    card.style.maxHeight = `${Math.max(0, Math.min(maxH, Math.max(above, below)))}px`;
    ch = card.offsetHeight;
    y = above >= below ? top : foot - ch;
  }
  card.style.top = `${Math.round(y)}px`;
  const body = $('card-body');
  body.classList.toggle('more', body.scrollHeight > body.clientHeight + 1);
}
/** The selection's box as drawn, projected onto the plate in CSS px, or null (nothing shown, or a corner
 *  behind the camera). */
function selRect() {
  const ids = idsOf(S.sel), b = ids.length ? visibleBox(ids) : null;
  if (!b || b.isEmpty()) return null;
  const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let i = 0; i < 8; i++) {
    tmp.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
    if (tmp.z > 1) return null;
    const x = (tmp.x + 1) / 2 * plate.clientWidth, y = (1 - tmp.y) / 2 * plate.clientHeight;
    r.left = Math.min(r.left, x); r.right = Math.max(r.right, x); r.top = Math.min(r.top, y); r.bottom = Math.max(r.bottom, y);
  }
  return r;
}
/** The selection's center on the plate, in CSS px, or null. */
function selCenter() {
  const ids = idsOf(S.sel);
  if (!ids.length) return null;
  const b = visibleBox(ids);
  if (b.isEmpty()) return null;
  b.getCenter(tmp).project(camera);
  if (tmp.z > 1) return null;
  return { x: (tmp.x + 1) / 2 * plate.clientWidth, y: (1 - tmp.y) / 2 * plate.clientHeight };
}
$('c-close').addEventListener('click', () => select(null));
$('c-zoom').addEventListener('click', () => { if (!S.sel) return; const note = flyToSel(); if (note) say(note.trim()); });
$('c-isolate').addEventListener('click', () => {
  if (!S.sel) return;
  const same = S.isolate && S.isolate.kind === S.sel.kind && S.isolate.id === S.sel.id;
  S.isolate = same ? null : { ...S.sel };
  if (!same) for (const id of idsOf(S.sel)) S.hidden.delete(id);
  persistVis(); applyVisibility(); renderCard(); buildTreeState();
  if (same) fitWhole(null); else { fitted = false; frame(visibleBox(idsOf(S.sel)), null, 750, true); }
});
$('c-ghost').addEventListener('click', () => {
  S.ghost = !S.ghost; autoGhost = false; store.set('ghost', S.ghost);
  applyLook(); $('c-ghost').setAttribute('aria-pressed', String(S.ghost));
});
$('c-hide').addEventListener('click', () => {
  if (!S.sel) return;
  for (const id of idsOf(S.sel)) S.hidden.add(id);
  if (S.isolate && idsOf(S.isolate).every((id) => S.hidden.has(id))) S.isolate = null;
  persistVis(); select(null, { spoken: false }); applyVisibility(); buildTreeState();
});

/* ---------- picking ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map();
let tap = null, lastTap = { id: null, t: 0 };
// A touch's click comes after its pointerup, at the same point, to whatever stands there by then: the
// tap that opens the card must not also press a key on it. The card opens clear of the finger
// (placeCard); this swallows that one click should it reach the card anyway. The next touch or key
// press disarms it, so a deliberate tap on the card always counts.
let swallowUntil = 0;
card.addEventListener('click', (e) => { if (performance.now() < swallowUntil) { swallowUntil = 0; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
for (const t of ['pointerdown', 'keydown']) addEventListener(t, () => { swallowUntil = 0; }, true);
canvas.addEventListener('pointerdown', (e) => {
  if (camTween) camTween.finish();               // a touch ends a flight at its destination
  if (!$('notice').hidden && started) notice('');
  pointers.set(e.pointerId, e);
  tap = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
});
canvas.addEventListener('pointermove', (e) => {
  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 7) tap = null;
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (!tap || e.type !== 'pointerup') { if (!pointers.size) tap = null; return; }
  const dt = performance.now() - tap.t;
  tap = null;
  if (dt <= 500) pick(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
function pick(x, y) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(meshes.filter((m) => parts.get(m.userData.id).solid), false);
  if (!hits.length) { if (S.sel) select(null, { spoken: false }); return; }
  const id = hits[0].object.userData.id, now = performance.now();
  const dbl = lastTap.id === id && now - lastTap.t < 380;
  lastTap = { id, t: now };
  if (S.sel && S.sel.kind === 'part' && S.sel.id === id && !dbl) return;
  swallowUntil = now + 600;
  select({ kind: 'part', id }, { fly: dbl, spoken: !dbl || !S.sel || S.sel.id !== id, at: { x: x - r.left, y: y - r.top } });
}

/* ---------- Find and About: full-height dialogs ---------- */
const findDlg = $('find'), aboutDlg = $('about'), tree = $('tree'), search = $('search');
let dialogFrom = null;
// While a dialog is open the page behind it is inert, so VoiceOver and Tab stay inside the dialog;
// closing it gives every band back the state it had (focus mode keeps its own inert bands).
const behind = new Map();
function openDialog(d, byKeyboard) {
  dialogFrom = document.activeElement;
  for (const e of document.body.children) if (e !== d && e.id !== 'live' && e.tagName !== 'SCRIPT' && !behind.has(e)) { behind.set(e, e.inert); e.inert = true; }
  d.hidden = false;
  const first = d === findDlg && (byKeyboard || matchMedia('(min-width: 720px)').matches) ? search : d.querySelector('.dialog-head button');
  first.focus({ preventScroll: true });
}
function closeDialog(d) {
  if (d.hidden) return;
  d.hidden = true;
  for (const [e, was] of behind) e.inert = was;
  behind.clear();
  if (dialogFrom && dialogFrom.focus && document.contains(dialogFrom)) dialogFrom.focus({ preventScroll: true });
  dialogFrom = null;
}
for (const d of [findDlg, aboutDlg]) d.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const f = [...d.querySelectorAll('button, input, [tabindex="0"]')].filter((x) => x.offsetParent !== null);
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
});
$('btn-find').addEventListener('click', (e) => openDialog(findDlg, e.detail === 0));
$('find-close').addEventListener('click', () => closeDialog(findDlg));
stamp.addEventListener('click', (e) => { if (started) openDialog(aboutDlg, e.detail === 0); });
$('about-close').addEventListener('click', () => closeDialog(aboutDlg));
$('about-close-2').addEventListener('click', () => closeDialog(aboutDlg));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!findDlg.hidden) { closeDialog(findDlg); return; }
  if (!aboutDlg.hidden) { closeDialog(aboutDlg); return; }
  if (!layersSheet.hidden) { showLayers(false); return; }
  if (focus) { setFocus(false, true); return; }
  if (S.sel) select(null, { spoken: false });
});

function choosePart(id) {
  const P = parts.get(id);
  if (!P) return;
  let changed = false;
  if (mode(P.meta.layer) === 'off') { S.layers[P.meta.layer] = 'on'; changed = true; }
  if (S.hidden.delete(id)) changed = true;
  if (S.isolate && !idsOf(S.isolate).includes(id)) { S.isolate = null; changed = true; }
  if (changed) { persistVis(); applyVisibility(); syncLayerUI(); buildTreeState(); }
  closeDialog(findDlg);
  select({ kind: 'part', id }, { fly: true });
}
function chooseRef(ref) { closeDialog(findDlg); select(ref, { fly: true }); }
function setVisible(ids, on) {
  for (const id of ids) on ? S.hidden.delete(id) : S.hidden.add(id);
  if (S.isolate && idsOf(S.isolate).every((id) => S.hidden.has(id))) S.isolate = null;
  persistVis(); applyVisibility(); buildTreeState();
}
const CHECK = [['box', 'M2.75 2.75h10.5v10.5H2.75z'], ['tick', 'M5 8.25 7 10.25l4-4.5'], ['bar', 'M5 8h6']];
/** A visibility box: a drawn 16 x 16 box in a 44 x 44 hit, named for what it shows. */
function visBox(ids, name) {
  const b = h('button', { type: 'button', class: 'vis', role: 'checkbox', 'aria-label': `Show ${name}` }, mark(16, 16, CHECK.map(([c, d]) => [c, d])));
  b.dataset.ids = ids.join(',');
  b.addEventListener('click', (e) => { e.stopPropagation(); setVisible(ids, b.getAttribute('aria-checked') !== 'true'); });
  return b;
}
const chevron = () => mark(10, 10, [['', 'M3.5 1.5 7 5 3.5 8.5']], 'chev');
function partButton(id, withWhere = false) {
  const m = parts.get(id).meta, t = anat.types[m.type] || {}, g = groupsById.get(m.group), r = regionsById.get(m.region);
  const b = h('button', { type: 'button', class: 't-part', onclick: () => choosePart(id) },
    h('span', { class: 'p-name' }, m.name, h('span', { class: 'sr p-hidden', text: ', hidden' }),
      withWhere ? h('span', { class: 'p-where', text: [g && g.name, r && r.name.toLowerCase()].filter(Boolean).join(', ') }) : null),
    h('span', { class: 'p-latin', lang: 'la', translate: 'no', text: m.latin || t.latin || '' }));
  b.dataset.id = id;
  return b;
}
/** An opening row: a toggle with its chevron, the parts built the first time it opens. */
function opener(label, head, build) {
  let body = null;
  const t = h('button', { type: 'button', class: 't-toggle', 'aria-expanded': 'false', ...label }, chevron(), ...head);
  const wrap = h('div', { class: 't-open' });
  t.addEventListener('click', () => {
    const open = t.getAttribute('aria-expanded') !== 'true';
    t.setAttribute('aria-expanded', String(open));
    if (open && !body) { body = build(); wrap.append(body); buildTreeState(); }
    if (body) body.hidden = !open;
  });
  return [t, wrap];
}
function buildTree() {
  const q = search.value.trim().toLowerCase();
  if (q) {
    const terms = q.split(/\s+/);
    const hay = (m) => [m.name, m.latin, anat.types[m.type]?.latin, layersById.get(m.layer)?.name, m.label, m.fdi && 'tooth ' + m.fdi, m.source, groupsById.get(m.group)?.name, regionsById.get(m.region)?.name].filter(Boolean).join(' ').toLowerCase();
    const res = anat.parts.filter((m) => parts.has(m.id) && terms.every((t) => hay(m).includes(t)));
    tree.replaceChildren(res.length ? h('div', { class: 'results' }, res.slice(0, 120).map((m) => partButton(m.id, true)))
      : h('p', { class: 'empty', text: `Nothing matches “${search.value.trim()}”. Try a bone name, a Latin term, a vertebra like T7, or a tooth number like 36.` }));
    buildTreeState();
    return;
  }
  const rIndex = new Map([...regionsById.keys()].map((id, i) => [id, i]));
  const gOrder = [...groupsById.values()].map((g, i) => [g, i]).sort((a, b) => (rIndex.get(a[0].region) - rIndex.get(b[0].region)) || (a[1] - b[1])).map((x) => x[0]);
  const blocks = [];
  for (const L of anat.layers) {
    const ids = anat.parts.filter((p) => p.layer === L.id && parts.has(p.id)).map((p) => p.id);
    if (!ids.length) continue;
    const skeletal = ['bone', 'cartilage', 'tooth'].includes(L.id);
    const [t, wrap] = opener({}, [h('span', { class: 'swatch', style: `--c:${L.color}`, 'aria-hidden': 'true' }), h('span', { class: 't-name', text: L.name }), h('span', { class: 't-count', text: U.int(ids.length) })], () =>
      h('div', { class: 't-groups' }, (skeletal ? [...groupsById.values()] : gOrder).map((g) => {
        const gids = g.parts.filter((id) => parts.get(id).meta.layer === L.id);
        if (!gids.length) return null;
        const gname = g.short || g.name;
        const [gt, gw] = opener({ 'aria-label': `Parts of ${gname}` }, [], () => h('div', { class: 't-parts' }, gids.map((id) => partButton(id))));
        return h('div', { class: 't-group' },
          h('div', { class: 't-group-head' }, gt, h('button', { type: 'button', class: 't-link', text: gname, onclick: () => chooseRef({ kind: 'group', id: g.id }) }), visBox(gids, gname)), gw);
      })));
    blocks.push(h('div', { class: 't-layer' }, h('div', { class: 't-layer-head' }, t, visBox(ids, L.name)), wrap));
  }
  tree.replaceChildren(...blocks);
  buildTreeState();
}
function buildTreeState() {
  for (const c of tree.querySelectorAll('.vis')) {
    const ids = c.dataset.ids.split(','), on = ids.filter((id) => !S.hidden.has(id)).length;
    c.setAttribute('aria-checked', on === ids.length ? 'true' : on ? 'mixed' : 'false');
  }
  for (const b of tree.querySelectorAll('.t-part')) {
    const hid = !isVisible(parts.get(b.dataset.id));
    b.classList.toggle('is-hidden', hid);
    b.querySelector('.p-hidden').hidden = !hid;
  }
  markTreeSelection();
}
function markTreeSelection() {
  const sel = S.sel && S.sel.kind === 'part' ? S.sel.id : null;
  for (const b of tree.querySelectorAll('.t-part')) b.classList.toggle('selected', b.dataset.id === sel);
}
const searchClear = $('search-clear');
const syncClear = () => { searchClear.hidden = !search.value; };
search.addEventListener('input', () => { syncClear(); buildTree(); });
searchClear.addEventListener('click', () => { search.value = ''; syncClear(); buildTree(); search.focus(); });

/* ---------- About ---------- */
function buildAbout() {
  const ab = anat.about || {};
  $('ab-intro').textContent = ab.intro || '';
  $('ab-intro').hidden = !ab.intro;
  // The data's first two source paragraphs, verbatim. Its third is the app's rendering and type credit,
  // which index.html writes word for word under them, so it is not printed twice (tools/DECISIONS.md,
  // B13 and the follow-up's data text pass; tools/check.mjs holds the two equal).
  $('ab-sources').replaceChildren(...(ab.sources || []).slice(0, 2).map((t) => h('p', { text: t })));
  $('ab-gaps').replaceChildren(...(ab.gaps || []).map((t) => h('li', { text: t })));
  const skin = restSpan(anat.parts.filter((p) => p.layer === 'skin').map((p) => p.id));
  const files = geoMeta.files || [];
  const rows = [
    ['Structures', U.int(parts.size)],
    ...anat.layers.filter((l) => layerCount(l.id)).map((l) => [l.name, U.int(layerCount(l.id))]),
    ['Triangles', `${U.int(geoMeta.triangles)}, simplified from the source data`],
    skin && ['Height, sole to crown', U.meters(skin.hi - skin.lo)],
    ['Geometry', `${U.megabytes(files.reduce((n, f) => n + f.bytes, 0), 1)} in ${files.length} files`],
    ['Levels on the spine', V.length ? `${V.length}, ${V[0].label} to ${V[V.length - 1].label}, the sacrum as one` : 'none named'],
    ['Coordinates', 'meters, Y up, +Z the body’s front, +X its left'],
  ].filter(Boolean);
  $('about-list').replaceChildren(...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]));
}

/* ---------- the Levels: this body's spine as the rule beside it (ART.md section 1) ---------- */
const LV_STATE = { drawn: false, reason: 'none', blocks: [], labels: [], bar: null };
const levelsCtx = levelsCanvas.getContext('2d');
// the column's ink and halo, read from the stylesheet once per theme (themeLevels), not per frame
const LV_INK = { ink: '', halo: '' };
const themeLevels = () => { LV_INK.ink = css('--level'); LV_INK.halo = css('--level-halo'); };
const lvAt = new THREE.Vector3();
const REGION_ENDS = (i) => i === 0 || i === B.length - 1 || LV.regionEnd(B, i) || (i > 0 && LV.regionEnd(B, i - 1));
function drawLevels() {
  stats.levels++;
  const r = levelsCanvas.height / Math.max(1, plate.clientHeight), H0 = plate.clientHeight, ctx = levelsCtx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, levelsCanvas.width, levelsCanvas.height);
  ctx.setTransform(r, 0, 0, r, 0, 0);
  Object.assign(LV_STATE, { drawn: false, blocks: [], labels: [], bar: null });
  if (!V.length) { LV_STATE.reason = 'none'; setCaption(); return; }
  const proj = (v, y) => { const P = parts.get(v.id); lvAt.set(v.x, y, v.z); if (P) lvAt.add(P.mesh.position); lvAt.project(camera); return (1 - lvAt.y) / 2 * H0; };
  const scr = { top: proj(V[0], V[0].top), centers: V.map((v) => proj(v, v.center)), bottom: proj(V[V.length - 1], V[V.length - 1].bottom) };
  // Pulled apart by group, one group of vertebrae can rise past its neighbor (T1 past C7): the column
  // keeps the spine's order, and the block between the two flattens.
  for (let i = 1; i < scr.centers.length; i++) scr.centers[i] = Math.max(scr.centers[i], scr.centers[i - 1]);
  scr.top = Math.min(scr.top, scr.centers[0]); scr.bottom = Math.max(scr.bottom, scr.centers[scr.centers.length - 1]);
  // Two reasons there is no column, each with its own sentence: the camera looks too steeply down (or
  // up) the spine, or the spine is drawn too short to read. On a short plate (a phone on its side) the
  // spine of the whole body projects at 88 px, so the column is kept down to 80 px there.
  const dir = camera.getWorldDirection(lvAt);
  const steep = Math.abs(dir.y) > 0.9, least = H0 < 300 ? 80 : 120;
  if (steep || scr.bottom - scr.top < least) {
    LV_STATE.reason = steep ? 'steep' : 'small'; setCaption(); return;
  }
  LV_STATE.drawn = true; LV_STATE.reason = 'drawn';
  if (!LV_INK.ink) themeLevels();
  const { ink, halo } = LV_INK;
  const col = B.map((b) => ({ label: b.label, y0: LV.toColumn(b.hi, B, scr).y, y1: LV.toColumn(b.lo, B, scr).y }));
  // the halo under the whole column, then each block, its foot left as a 1 px gap (the disc)
  ctx.fillStyle = halo;
  ctx.fillRect(33, Math.max(-3, col[0].y0 - 3), 11, Math.min(H0 + 6, col[col.length - 1].y1 + 3) - Math.max(-3, col[0].y0 - 3));
  ctx.fillStyle = ink;
  col.forEach((c, i) => {
    const gap = c.y1 - c.y0 >= 4 || LV.regionEnd(B, i) ? 1 : 0;
    if (c.y1 < 0 || c.y0 > H0) return;
    ctx.fillRect(36, c.y0, 5, Math.max(0.5, c.y1 - c.y0 - gap));
    LV_STATE.blocks.push({ label: c.label, top: c.y0, bottom: c.y1 });
  });
  // labels: every block taller than 12 px; otherwise the region ends, then the topmost and
  // bottommost blocks in view, each skipped within 12 px of a label already placed
  const placed = [], mid = (c) => (c.y0 + c.y1) / 2, inView = (c) => mid(c) > 6 && mid(c) < H0 - 6;
  const tryPlace = (i) => { const c = col[i]; if (!inView(c) || placed.some((p) => Math.abs(mid(col[p]) - mid(c)) < 12)) return; placed.push(i); };
  col.forEach((c, i) => { if (c.y1 - c.y0 > 12) tryPlace(i); });
  col.forEach((c, i) => { if (REGION_ENDS(i)) tryPlace(i); });
  const vis = col.map((c, i) => i).filter((i) => inView(col[i]));
  if (vis.length) { tryPlace(vis[0]); tryPlace(vis[vis.length - 1]); }
  ctx.font = '560 10.5px "Ysabeau Office", system-ui, sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.lineWidth = 3; ctx.strokeStyle = halo;
  for (const i of placed) { const y = mid(col[i]); ctx.strokeText(col[i].label, 32, y); }
  ctx.fillStyle = ink;
  for (const i of placed.sort((a, b) => a - b)) { const y = mid(col[i]); ctx.fillText(col[i].label, 32, y); LV_STATE.labels.push({ label: col[i].label, y }); }
  // the selection's bar: from its box's top to its bottom, placed by the same map as the blocks
  const span = S.sel && restSpan(idsOf(S.sel));
  if (span && !(span.lo > B[0].hi) && !(span.hi < B[B.length - 1].lo)) {
    const a = LV.toColumn(span.hi, B, scr), z = LV.toColumn(span.lo, B, scr);
    const y0 = a.y, y1 = Math.max(z.y, a.y + 2);
    ctx.fillStyle = halo;
    ctx.fillRect(44, y0 - 6, 8, y1 - y0 + 12);
    ctx.fillStyle = ink;
    ctx.fillRect(45, y0, 2, y1 - y0);
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [y, open, s] of [[y0, a.open, -1], [y1, z.open, 1]]) {
      if (open) { ctx.moveTo(43, y - s * 1); ctx.lineTo(46, y + s * 3); ctx.lineTo(49, y - s * 1); } else { ctx.moveTo(45, y); ctx.lineTo(50, y); }
    }
    ctx.stroke();
    LV_STATE.bar = { top: y0, bottom: y1, openTop: a.open, openBottom: z.open };
  }
  setCaption();
}
document.fonts.addEventListener('loadingdone', requestRender);

/* ---------- the caption line ---------- */
function setCaption() {
  let t;
  if (!B.length) t = anat ? LV.NO_RULE : '';
  else if (S.sel) t = LV.spanSentence(spanOf(S.sel), B, LV_STATE.drawn || !started, LV_STATE.reason);
  else if (LV_STATE.reason === 'steep' || LV_STATE.reason === 'small') t = LV.HIDDEN_RULE[LV_STATE.reason];
  else if (S.explode >= 0.01) t = LV.explodedSentence(U.pct(S.explode), BY_WORD[S.level]);
  else t = LV.ruleSentence(B);
  const c = $('capline');
  if (c.textContent !== t) c.textContent = t;
}

/* ---------- focus mode ---------- */
function setFocus(on, byKeyboard) {
  if (on === focus) return;
  focus = on;
  try { localStorage.setItem(FOCUS_KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
  if (on) { select(null, { spoken: false }); showLayers(false); }
  const leaving = on ? [$('head'), $('keys'), $('drow-explode')] : [];
  if (on && !reduced.matches) {
    for (const e of leaving) e.classList.add('leaving');
    setTimeout(() => { for (const e of leaving) e.classList.remove('leaving'); applyFocus(true); after(); }, 160);
  } else { applyFocus(on); after(); }
  function after() {
    say(on ? 'Controls hidden. Press Escape or the corner key to show them.' : 'Controls shown.');
    if (byKeyboard) (on ? $('focus-exit') : $('focus-key')).focus();
  }
}
/** What leaves in focus mode: the header, the key column, the Layers sheet and the explode row. What
 *  stays of the controls is the one the view needs, the step keys, which take the body apart a layer at
 *  a time and put it back (ART.md section 3). */
function applyFocus(on) {
  document.body.classList.toggle('focus', on);
  for (const e of [$('head'), $('keys'), layersSheet, $('drow-explode')]) { e.hidden = on || (e === layersSheet && $('btn-layers').getAttribute('aria-expanded') !== 'true'); e.inert = on; }
  $('focus-exit').hidden = !on;
  // the stamp keeps its words, and moves into the caption band as its first line
  if (on) $('caption').prepend(stamp); else $('stamp-home').appendChild(stamp);
  requestRender();
}
$('focus-key').addEventListener('click', (e) => setFocus(true, e.detail === 0));
$('focus-exit').addEventListener('click', (e) => setFocus(false, e.detail === 0));

/* ---------- theme, refresh, hidden ---------- */
darkQuery.addEventListener('change', () => { themeLevels(); if (anat) { applyLook(); outline(); } requestRender(); });
let refreshWarned = false;
async function refreshAnatomy() {
  if (!started) return;
  try {
    const a = await readJSON('data/anatomy.json');
    refreshWarned = false;
    if (JSON.stringify(a) !== JSON.stringify(anat)) applyAnatomy(a);
  } catch (err) {
    if (!refreshWarned) notice(`${err.message} The text already loaded stays.`);
    refreshWarned = true;
  }
}
addEventListener('focus', refreshAnatomy);
document.addEventListener('visibilitychange', () => {
  // hidden: the loop stops and every tween lands on its end, so a return never shows a stale frame
  if (document.visibilityState === 'hidden') { landTweens(); if (raf) cancelAnimationFrame(raf); raf = 0; return; }
  requestRender();
  refreshAnatomy();
});
addEventListener('pagehide', () => { if (raf) cancelAnimationFrame(raf); raf = 0; });

/* ---------- start ---------- */
function start() {
  $('credits').textContent = CREDIT;
  for (const b of $('ex-by').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.level === S.level));
  radioTabs($('ex-by'));
  if (S.isolate && !idsOf(S.isolate).length) S.isolate = null;
  started = true;
  resize();
  applyVisibility();
  syncExplodeUI();
  const saved = store.get('camera', null);
  if (saved && Array.isArray(saved.p) && Array.isArray(saved.t)) {
    camera.position.fromArray(saved.p);
    controls.target.fromArray(saved.t);
    camera.lookAt(controls.target);
    fitted = !!saved.fit;
    lastFit = fitted ? { t: controls.target.clone(), d: camera.position.distanceTo(controls.target) } : null;
  } else {
    const e = S.explode;
    S.explode = 0; applyExplode();
    fitWhole(new THREE.Vector3(0.42, 0.1, 1), 0);
    landTweens();
    S.explode = e; applyExplode();
  }
  setCaption();
  requestRender();
}

focus = (() => { try { return localStorage.getItem(FOCUS_KEY) === '1'; } catch { return false; } })();
if (focus) applyFocus(true);
$('credits').textContent = CREDIT;

/* ---------- the test hook: inert, read by tools/shoot.mjs, never called by the app ---------- */
window.__anatomy = {
  ready: () => started,
  stats: () => ({ ...stats, raf: !!raf, tweens: tweens.size, hulls: hulls.length }),
  camera: () => {
    camera.updateMatrixWorld();
    return { view: [...camera.matrixWorldInverse.elements], proj: [...camera.projectionMatrix.elements], pos: camera.position.toArray(), target: controls.target.toArray(), w: plate.clientWidth, h: plate.clientHeight };
  },
  offsets: (ids) => ids.map((id) => (parts.get(id) ? parts.get(id).mesh.position.toArray() : null)),
  levels: () => JSON.parse(JSON.stringify(LV_STATE)),
  selection: () => (S.sel ? { ...S.sel, ids: idsOf(S.sel).length, center: selCenter(), rect: selRect() } : null),
  focus: () => focus,
};

load();
