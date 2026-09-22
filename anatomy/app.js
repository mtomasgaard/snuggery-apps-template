import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

/* ---------- small helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
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
const KEY = 'skeleton-viewer:';
const store = {
  get(k, d) { try { const v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

/* ---------- state ---------- */
const LEVELS = { regions: [1, 0, 0], groups: [1, 1, 0], bones: [1, 1, 1] };
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
if (!LEVELS[S.level]) S.level = 'bones';
const W = new THREE.Vector3(...LEVELS[S.level]);   // current level weights (animated)
const WT = W.clone();

let anat = null, geoMeta = null;
const LAYER_DEFAULT = { skin: 'fade' };
const CORE = ['bone', 'tooth'];   // never peeled
const mode = l => S.layers[l] || LAYER_DEFAULT[l] || 'on';
const layerFactor = {};
const prevMode = store.get('layerPrev', {});
let stepping = null;
let layersById = new Map();
const parts = new Map();          // id -> { meta, mesh, dR, dG, dP }
let regionsById = new Map(), groupsById = new Map();
let meshes = [];

/* ---------- renderer ---------- */
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
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

let needsRender = true;
const requestRender = () => { needsRender = true; };
controls.addEventListener('change', requestRender);
controls.addEventListener('end', () => store.set('camera', { p: camera.position.toArray(), t: controls.target.toArray() }));

function resize() {
  const w = canvas.clientWidth, hgt = canvas.clientHeight;
  if (!w || !hgt) return;
  renderer.setSize(w, hgt, false);
  camera.aspect = w / hgt;
  camera.updateProjectionMatrix();
  requestRender();
}
new ResizeObserver(resize).observe(canvas);

/* ---------- tweens ---------- */
const tweens = new Set();
function tween(ms, step, done) {
  const t0 = performance.now();
  const tw = { step, done, t0, ms };
  tweens.add(tw);
  return () => tweens.delete(tw);
}
function runTweens(now) {
  for (const tw of tweens) {
    const k = tw.ms <= 0 ? 1 : Math.min(1, (now - tw.t0) / tw.ms);
    tw.step(ease(k), k);
    if (k >= 1) { tweens.delete(tw); tw.done && tw.done(); }
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  const hadTweens = tweens.size > 0;
  runTweens(now);
  const moved = controls.update();
  if (moved || needsRender || hadTweens) {
    renderer.render(scene, camera);
    needsRender = false;
  }
}

/* ---------- loading ---------- */
const loadBar = $('#load-bar'), loadText = $('#load-text');
async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} (${r.status})`);
  return r.json();
}
async function fetchBinary(url, expected, onProgress = () => {}) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} (${r.status})`);
  if (!r.body || !r.body.getReader) return r.arrayBuffer();
  const reader = r.body.getReader();
  const out = new Uint8Array(expected);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (got + value.length > out.length) throw new Error('geometry.bin is larger than geometry.json describes');
    out.set(value, got);
    got += value.length;
    onProgress(got);
  }
  if (got !== expected) throw new Error('geometry.bin is incomplete');
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
const materialFor = layer => new THREE.MeshStandardMaterial({
  roughness: ROUGH[layer] ?? 0.5, metalness: 0,
  side: layer === 'bone' || layer === 'tooth' ? THREE.FrontSide : THREE.DoubleSide,
});

async function load() {
  try {
    [geoMeta, anat] = await Promise.all([fetchJSON('data/geometry.json'), fetchJSON('data/anatomy.json')]);
    loadBar.style.width = '4%';
    const files = geoMeta.files || [{ url: 'data/geometry.bin', bytes: geoMeta.bytes }];
    const total = files.reduce((n, f) => n + f.bytes, 0);
    loadText.textContent = `Loading ${(total / 1048576).toFixed(0)} MB of anatomy`;
    const bufs = [];
    let done = 0;
    for (const f of files) {
      bufs.push(await fetchBinary(f.url, f.bytes, got => { loadBar.style.width = (4 + 66 * (done + got) / total).toFixed(1) + '%'; }));
      done += f.bytes;
    }
    loadText.textContent = `Building ${geoMeta.parts.length} structures`;
    const metaById = new Map(anat.parts.map(p => [p.id, p]));
    let n = 0;
    for (const gp of geoMeta.parts) {
      const meta = metaById.get(gp.id);
      if (!meta) continue;
      const geom = buildGeometry(bufs[gp.f || 0], gp);
      const mat = materialFor(meta.layer);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData.id = gp.id;
      root.add(mesh);
      parts.set(gp.id, { meta, mesh, dR: new THREE.Vector3(), dG: new THREE.Vector3(), dP: new THREE.Vector3() });
      meshes.push(mesh);
      if (++n % 40 === 0) {
        loadBar.style.width = (70 + 30 * n / geoMeta.parts.length).toFixed(1) + '%';
        await new Promise(r => setTimeout(r, 0));
      }
    }
    applyAnatomy(anat);
    start();
  } catch (err) {
    console.error(err);
    const L = $('#loader');
    L.classList.add('error');
    loadText.textContent = 'The model files could not be read. Open this app from Snuggery or a local web server; browsers block data files when index.html is opened directly. Detail: ' + err.message;
  }
}

/* ---------- anatomy (editable data) ---------- */
function applyAnatomy(a) {
  anat = a;
  layersById = new Map((a.layers || []).map(l => [l.id, l]));
  regionsById = new Map(a.regions.map(r => [r.id, { ...r, parts: [] }]));
  groupsById = new Map(a.groups.map(g => [g.id, { ...g, parts: [] }]));
  for (const pm of a.parts) {
    const P = parts.get(pm.id);
    if (!P) continue;
    P.meta = pm;
    groupsById.get(pm.group)?.parts.push(pm.id);
    regionsById.get(pm.region)?.parts.push(pm.id);
  }
  computeExplodeVectors();
  applyVisibility();
  applyMaterials();
  buildTree();
  buildLayerRows();
  buildAbout();
  updateStatus();
  if (S.sel) renderCard();
  requestRender();
}

function boxOf(ids) {
  const b = new THREE.Box3();
  for (const id of ids) { const P = parts.get(id); if (P) b.union(P.mesh.geometry.boundingBox); }
  return b;
}
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
const tmp = new THREE.Vector3();
function applyExplode() {
  const e = S.explode;
  for (const P of parts.values()) {
    tmp.set(0, 0, 0)
      .addScaledVector(P.dR, W.x)
      .addScaledVector(P.dG, W.y)
      .addScaledVector(P.dP, W.z)
      .multiplyScalar(e);
    P.mesh.position.copy(tmp);
  }
  if (anat) applyLook('skin');
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
function isVisible(P) {
  if (mode(P.meta.layer) === 'off') return false;
  if (S.hidden.has(P.meta.id)) return false;
  if (S.isolate) return idsOf(S.isolate).includes(P.meta.id);
  return true;
}
function applyVisibility() { applyLook(); updateStatus(); }
function applyMaterials() { applyLook(); }
const colSel = new THREE.Color();
const skinFactor = () => 1 - THREE.MathUtils.smoothstep(S.explode, 0.03, 0.28);
function applyLook(onlyLayer) {
  if (!anat) return;
  const C = anat.colors || {};
  const selIds = new Set(idsOf(S.sel));
  colSel.set(darkQuery.matches ? (C.selectedDark || '#8ea2ff') : (C.selected || '#3552d6'));
  const iso = S.isolate ? new Set(idsOf(S.isolate)) : null;
  const ghosting = S.ghost && selIds.size > 0;
  for (const P of parts.values()) {
    const L = P.meta.layer;
    if (onlyLayer && L !== onlyLayer) continue;
    const lay = layersById.get(L) || {}, t = anat.types[P.meta.type] || {}, m = P.mesh.material;
    const md = mode(L);
    const shown = md !== 'off' && !S.hidden.has(P.meta.id) && (!iso || iso.has(P.meta.id));
    const isSel = selIds.has(P.meta.id);
    m.color.set(P.meta.color || (P.meta.tissue === 'connective' && lay.connectiveColor) || t.color || lay.color || '#e6d9bf');
    if (isSel) { m.color.lerp(colSel, 0.55); m.emissive.copy(colSel).multiplyScalar(0.28); }
    else m.emissive.setRGB(0, 0, 0);
    let o = md === 'fade' && !isSel ? (lay.fade ?? 0.18) : 1;
    if (ghosting && !isSel) o = Math.min(o, 0.12);
    if (L === 'skin') o *= skinFactor();
    o *= layerFactor[L] ?? 1;
    P.mesh.visible = shown && o > 0.004;
    const tr = o < 0.999;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.opacity = o;
    m.depthWrite = !tr;
    P.mesh.renderOrder = tr ? 1 : 0;
    P.solid = P.mesh.visible && !tr;
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
function uiInsets() {
  // Screen space covered by the bar at the top and the dock/card at the bottom.
  const H = canvas.clientHeight || innerHeight;
  const wide = !narrow();
  const top = wide ? 60 : 56;
  let bottom = $('#dock').getBoundingClientRect().height + 20;
  if (!wide && !card.hidden && !document.body.classList.contains('has-panel')) bottom = H - card.getBoundingClientRect().top + 8;
  if (!wide && !$('#layers').hidden) bottom = H - $('#layers').getBoundingClientRect().top + 8;
  return { top: Math.min(top, H * 0.2), bottom: Math.min(bottom, H * 0.55), H };
}
function frame(box, dir, ms = 750) {
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const d = (dir ? dir.clone() : camera.position.clone().sub(controls.target)).normalize();
  // camera basis for this direction
  const up = Math.abs(d.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, d).normalize();
  const camUp = new THREE.Vector3().crossVectors(d, right).normalize();
  let hw = 0, hh = 0, hd = 0;
  const c = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    c.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(center);
    hw = Math.max(hw, Math.abs(c.dot(right)));
    hh = Math.max(hh, Math.abs(c.dot(camUp)));
    hd = Math.max(hd, Math.abs(c.dot(d)));
  }
  const { top, bottom, H } = uiInsets();
  const usable = Math.max(0.35, (H - top - bottom) / H);
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const th = tv * camera.aspect;
  const dist = Math.max(hh / (tv * usable), hw / th) * 1.1 + hd;
  // shift the target so the model sits in the free space between bar and dock
  const shift = ((bottom - top) / 2 / H) * 2 * tv * dist;
  const target = center.clone().addScaledVector(camUp, -shift);
  // small structures: back off so the surrounding bones give context
  const finalDist = dist < 0.5 ? Math.max(dist * 1.7, 0.32) : dist;
  moveCamera(target.clone().addScaledVector(d, finalDist), target, ms);
}
let stopCam = null;
function moveCamera(pos, target, ms = 750) {
  stopCam && stopCam();
  const p0 = camera.position.clone(), t0 = controls.target.clone();
  if (reduceMotion) ms = 0;
  stopCam = tween(ms, k => {
    camera.position.lerpVectors(p0, pos, k);
    controls.target.lerpVectors(t0, target, k);
    camera.lookAt(controls.target);
    requestRender();
  }, () => store.set('camera', { p: camera.position.toArray(), t: controls.target.toArray() }));
}
let sideFlip = false;
const VIEW_DIRS = {
  front: () => new THREE.Vector3(0, 0.02, 1),
  back: () => new THREE.Vector3(0, 0.02, -1),
  side: () => { sideFlip = !sideFlip; return new THREE.Vector3(sideFlip ? 1 : -1, 0.02, 0); },
  top: () => new THREE.Vector3(0, 1, 0.012),
};
document.querySelectorAll('.views button').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.view;
  const ids = S.isolate ? idsOf(S.isolate) : null;
  frame(visibleBox(ids), v === 'fit' ? null : VIEW_DIRS[v]());
}));

/* ---------- explode UI ---------- */
const slider = $('#explode'), btnExplode = $('#btn-explode');
function syncExplodeUI() {
  const v = Math.round(S.explode * 100);
  slider.value = v;
  slider.style.setProperty('--fill', v + '%');
  slider.setAttribute('aria-valuetext', v + '%');
  btnExplode.textContent = S.explode > 0.5 ? 'Assemble' : 'Explode';
}
let stopExplode = null;
function animateExplode(to, ms = 900) {
  stopExplode && stopExplode();
  const from = S.explode;
  if (reduceMotion) ms = 0;
  stopExplode = tween(ms, k => {
    S.explode = from + (to - from) * k;
    applyExplode();
    syncExplodeUI();
  }, () => store.set('explode', S.explode));
}
slider.addEventListener('input', () => {
  stopExplode && stopExplode();
  S.explode = slider.value / 100;
  applyExplode();
  syncExplodeUI();
});
slider.addEventListener('change', () => store.set('explode', S.explode));
btnExplode.addEventListener('click', () => animateExplode(S.explode > 0.5 ? 0 : 1));

function setLevel(level, animate = true) {
  S.level = level;
  store.set('level', level);
  WT.set(...LEVELS[level]);
  $('#level').value = level;
  const from = W.clone();
  tween(animate && !reduceMotion ? 600 : 0, k => { W.lerpVectors(from, WT, k); applyExplode(); });
  if (animate && S.explode < 0.05) animateExplode(1);
}
$('#level').addEventListener('change', e => setLevel(e.target.value));

/* ---------- layers ---------- */
const layerPanel = $('#layers'), layerRows = $('#layer-rows'), btnPeel = $('#btn-peel');
const layerCount = id => anat.parts.filter(p => p.layer === id && parts.has(p.id)).length;
function setMode(L, m, persist = true) {
  S.layers[L] = m;
  if (persist) store.set('layerModes', S.layers);
  applyVisibility(); syncLayerUI(); buildTreeState();
}
function buildLayerRows() {
  layerRows.replaceChildren(...anat.layers.filter(l => layerCount(l.id)).map(l => {
    const row = h('div', { class: 'lrow' },
      h('span', { class: 'swatch', style: `--c:${l.color}` }),
      h('span', { class: 'lname' }, l.name, h('small', { text: String(layerCount(l.id)) })),
      h('div', { class: 'seg3', role: 'radiogroup', 'aria-label': l.name },
        ['off', 'fade', 'on'].map(md => h('button', { role: 'radio', 'data-mode': md, text: { off: 'Off', fade: 'Faded', on: 'On' }[md], onclick: () => setMode(l.id, md) }))));
    row.dataset.layer = l.id;
    return row;
  }));
  syncLayerUI();
}
const order = () => anat.layers.map(l => l.id).filter(id => layerCount(id));
function nextPeel() { return order().find(l => !CORE.includes(l) && mode(l) !== 'off'); }
function nextAdd() { return order().filter(l => mode(l) === 'off').pop(); }
function syncLayerUI() {
  if (!anat) return;
  layerRows.querySelectorAll('.lrow').forEach(r => {
    const md = mode(r.dataset.layer);
    r.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === md)));
  });
  const busy = !!stepping;
  const np = nextPeel(), na = nextAdd();
  const lp = np && layersById.get(np), la = na && layersById.get(na);
  for (const b of [btnPeel, $('#panel-peel')]) {
    b.disabled = !lp || busy;
    b.textContent = lp ? `Peel ${lp.short.toLowerCase()}` : 'Peel';
    b.setAttribute('aria-label', lp ? `Remove the ${lp.name.toLowerCase()} layer` : 'Nothing left to peel');
  }
  for (const b of [$('#btn-add'), $('#panel-add')]) {
    b.disabled = !la || busy;
    b.textContent = la ? `Add ${la.short.toLowerCase()}` : 'Add';
    b.setAttribute('aria-label', la ? `Bring back the ${la.name.toLowerCase()} layer` : 'Every layer is showing');
  }
}
function peel() {
  const L = nextPeel();
  if (!L || stepping) return;
  prevMode[L] = mode(L); store.set('layerPrev', prevMode);
  stepping = L; syncLayerUI();
  tween(reduceMotion ? 0 : 320, k => { layerFactor[L] = 1 - k; applyLook(L); },
    () => { layerFactor[L] = 1; stepping = null; setMode(L, 'off'); });
}
function addBack() {
  const L = nextAdd();
  if (!L || stepping) return;
  let m = prevMode[L] || LAYER_DEFAULT[L] || 'on';
  if (m === 'off') m = 'on';
  stepping = L;
  layerFactor[L] = 0;
  setMode(L, m);
  tween(reduceMotion ? 0 : 320, k => { layerFactor[L] = k; applyLook(L); },
    () => { layerFactor[L] = 1; stepping = null; applyLook(L); syncLayerUI(); });
}
btnPeel.addEventListener('click', peel);
$('#panel-peel').addEventListener('click', peel);
$('#btn-add').addEventListener('click', addBack);
$('#panel-add').addEventListener('click', addBack);
new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', $('#dock').offsetHeight + 'px')).observe($('#dock'));
$('#btn-layers').addEventListener('click', () => {
  layerPanel.hidden = !layerPanel.hidden;
  document.body.classList.toggle('has-panel', !layerPanel.hidden);
  $('#btn-layers').setAttribute('aria-expanded', String(!layerPanel.hidden));
});
$('#layers-close').addEventListener('click', () => { layerPanel.hidden = true; document.body.classList.remove('has-panel'); $('#btn-layers').setAttribute('aria-expanded', 'false'); });
$('#layers-all').addEventListener('click', () => { for (const l of anat.layers) S.layers[l.id] = 'on'; store.set('layerModes', S.layers); applyVisibility(); syncLayerUI(); buildTreeState(); });

/* ---------- status (hidden / isolated) ---------- */
function updateStatus() {
  const el = $('#status'), txt = $('#status-text');
  if (S.isolate) {
    txt.textContent = `Showing only ${refName(S.isolate)}`;
  } else if (S.hidden.size) {
    txt.textContent = S.hidden.size === 1 ? '1 structure hidden' : `${S.hidden.size} structures hidden`;
  } else { el.hidden = true; return; }
  el.hidden = false;
}
$('#status-reset').addEventListener('click', () => {
  S.isolate = null; S.hidden.clear();
  persistVis(); syncLayerUI(); applyVisibility(); buildTreeState();
  if (S.sel) renderCard();
});
function persistVis() {
  store.set('hidden', [...S.hidden]);
  store.set('isolate', S.isolate);
  store.set('layerModes', S.layers);
}

/* ---------- selection card ---------- */
const card = $('#card');
function select(ref, { focus = false } = {}) {
  S.sel = ref && idsOf(ref).length ? ref : null;
  applyMaterials();
  renderCard();
  markTreeSelection();
  if (S.sel && focus) frame(visibleBox(idsOf(S.sel)));
}
function renderCard() {
  document.body.classList.toggle('has-card', !!S.sel);
  if (!S.sel) { card.hidden = true; return; }
  card.hidden = false;
  const ref = S.sel;
  const where = $('#c-where'); where.replaceChildren();
  const note = $('#c-note');
  let name = '', latin = '', desc = '', noteText = '';
  if (ref.kind === 'part') {
    const m = parts.get(ref.id).meta, t = anat.types[m.type] || {};
    name = m.name; latin = m.latin || t.latin || ''; desc = m.description || t.description || layersById.get(m.layer)?.description || ''; noteText = m.note || '';
    const g = groupsById.get(m.group), r = regionsById.get(m.region);
    if (g) where.append(h('button', { text: g.name, onclick: () => select({ kind: 'group', id: g.id }) }));
    if (r) where.append(h('button', { text: r.name, onclick: () => select({ kind: 'region', id: r.id }) }));
  } else {
    const obj = ref.kind === 'group' ? groupsById.get(ref.id) : regionsById.get(ref.id);
    name = refName(ref);
    const n = obj.parts.length;
    latin = '';
    desc = obj.description || '';
    noteText = '';
    where.append(h('span', { text: `${n} ${n === 1 ? 'structure' : 'structures'}` }));
    if (ref.kind === 'group') {
      const r = regionsById.get(obj.region);
      if (r) where.append(h('button', { text: r.name, onclick: () => select({ kind: 'region', id: r.id }) }));
    }
  }
  $('#c-name').textContent = name;
  const lat = $('#c-latin'); lat.textContent = latin; lat.hidden = !latin;
  $('#c-desc').textContent = desc;
  note.textContent = noteText; note.hidden = !noteText;
  const iso = S.isolate && S.isolate.kind === ref.kind && S.isolate.id === ref.id;
  $('#c-isolate').textContent = iso ? 'Show all' : 'Isolate';
  $('#c-ghost').setAttribute('aria-pressed', String(!!S.ghost));
}
$('#c-close').addEventListener('click', () => select(null));
$('#c-focus').addEventListener('click', () => S.sel && frame(visibleBox(idsOf(S.sel))));
$('#c-isolate').addEventListener('click', () => {
  if (!S.sel) return;
  const same = S.isolate && S.isolate.kind === S.sel.kind && S.isolate.id === S.sel.id;
  S.isolate = same ? null : { ...S.sel };
  if (!same) for (const id of idsOf(S.sel)) S.hidden.delete(id);
  persistVis(); applyVisibility(); renderCard(); buildTreeState();
  frame(visibleBox(same ? null : idsOf(S.sel)));
});
$('#c-ghost').addEventListener('click', () => {
  S.ghost = !S.ghost; store.set('ghost', S.ghost);
  applyMaterials(); renderCard();
});
$('#c-hide').addEventListener('click', () => {
  if (!S.sel) return;
  for (const id of idsOf(S.sel)) S.hidden.add(id);
  if (S.isolate && idsOf(S.isolate).every(id => S.hidden.has(id))) S.isolate = null;
  persistVis(); select(null); applyVisibility(); buildTreeState();
});

/* ---------- picking ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointers = new Map();
let tap = null, lastTap = { id: null, t: 0 };
canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, e);
  tap = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
});
canvas.addEventListener('pointermove', e => {
  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 7) tap = null;
});
const endPointer = e => {
  pointers.delete(e.pointerId);
  if (!tap || e.type !== 'pointerup') { if (!pointers.size) tap = null; return; }
  const dt = performance.now() - tap.t;
  tap = null;
  if (dt > 500) return;
  pick(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

function pick(x, y) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const vis = meshes.filter(m => parts.get(m.userData.id).solid);
  const hits = ray.intersectObjects(vis, false);
  if (!hits.length) { select(null); return; }
  const id = hits[0].object.userData.id;
  const now = performance.now();
  const dbl = lastTap.id === id && now - lastTap.t < 380;
  lastTap = { id, t: now };
  if (S.sel && S.sel.kind === 'part' && S.sel.id === id && !dbl) return;
  select({ kind: 'part', id }, { focus: dbl });
}

/* ---------- structure list ---------- */
const sheetList = $('#list'), sheetAbout = $('#about'), tree = $('#tree'), search = $('#search');
function openSheet(s) { s.hidden = false; if (s === sheetList && matchMedia('(min-width: 720px)').matches) search.focus(); }
function closeSheets() { sheetList.hidden = true; sheetAbout.hidden = true; }
$('#btn-list').addEventListener('click', () => sheetList.hidden ? openSheet(sheetList) : closeSheets());
$('#btn-about').addEventListener('click', () => sheetAbout.hidden ? openSheet(sheetAbout) : closeSheets());
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
addEventListener('keydown', e => { if (e.key === 'Escape') { if (!sheetList.hidden || !sheetAbout.hidden) closeSheets(); else select(null); } });

const narrow = () => !matchMedia('(min-width: 720px)').matches;
function choosePart(id) {
  const P = parts.get(id);
  if (!P) return;
  let changed = false;
  if (mode(P.meta.layer) === 'off') { S.layers[P.meta.layer] = 'on'; syncLayerUI(); changed = true; }
  if (S.hidden.delete(id)) changed = true;
  if (S.isolate && !idsOf(S.isolate).includes(id)) { S.isolate = null; changed = true; }
  if (changed) { persistVis(); applyVisibility(); buildTreeState(); }
  if (narrow()) closeSheets();
  select({ kind: 'part', id }, { focus: true });
}
function chooseRef(ref) {
  if (narrow()) closeSheets();
  select(ref, { focus: true });
}
function setVisible(ids, on) {
  for (const id of ids) on ? S.hidden.delete(id) : S.hidden.add(id);
  if (S.isolate && idsOf(S.isolate).every(id => S.hidden.has(id))) S.isolate = null;
  persistVis(); applyVisibility(); buildTreeState();
}
function visBox(ids) {
  const c = h('input', { type: 'checkbox', class: 'vis', 'aria-label': 'Visible' });
  c.dataset.ids = ids.join(',');
  c.addEventListener('click', e => { e.stopPropagation(); setVisible(ids, c.checked); });
  return c;
}
function partButton(id, withWhere = false) {
  const m = parts.get(id).meta, t = anat.types[m.type] || {};
  const g = groupsById.get(m.group);
  const b = h('button', { class: 't-part', onclick: () => choosePart(id) },
    h('span', { class: 'p-name' }, m.name, withWhere ? h('span', { class: 'p-where', text: `${g ? g.name : ''}${regionsById.get(m.region) ? ', ' + regionsById.get(m.region).name.toLowerCase() : ''}` }) : null),
    h('span', { class: 'p-latin', text: m.latin || t.latin || '' }));
  b.dataset.id = id;
  return b;
}
function buildTree() {
  const q = search.value.trim().toLowerCase();
  tree.replaceChildren();
  if (q) {
    const terms = q.split(/\s+/);
    const hay = m => [m.name, m.latin, anat.types[m.type]?.latin, layersById.get(m.layer)?.name, m.label, m.fdi && 'tooth ' + m.fdi, m.source, groupsById.get(m.group)?.name, regionsById.get(m.region)?.name].filter(Boolean).join(' ').toLowerCase();
    const res = anat.parts.filter(m => parts.has(m.id) && terms.every(t => hay(m).includes(t)));
    const list = h('div', { class: 'results' }, res.slice(0, 120).map(m => partButton(m.id, true)));
    tree.append(res.length ? list : h('p', { class: 'empty', text: `Nothing matches “${search.value.trim()}”. Try a bone name, a Latin term, a vertebra like T7, or a tooth number like 36.` }));
    buildTreeState();
    return;
  }
  const rIndex = new Map([...regionsById.keys()].map((id, i) => [id, i]));
  const gOrder = [...groupsById.values()].map((g, i) => [g, i]).sort((a, b) => (rIndex.get(a[0].region) - rIndex.get(b[0].region)) || (a[1] - b[1])).map(x => x[0]);
  for (const L of anat.layers) {
    const ids = anat.parts.filter(p => p.layer === L.id && parts.has(p.id)).map(p => p.id);
    if (!ids.length) continue;
    const det = h('details', {},
      h('summary', {}, h('span', { class: 'swatch', style: `--c:${L.color}` }), h('span', { class: 't-name', text: L.name }), h('span', { class: 't-count', text: String(ids.length) }), visBox(ids)));
    const skeletal = ['bone', 'cartilage', 'tooth'].includes(L.id);
    for (const g of (skeletal ? [...groupsById.values()] : gOrder)) {
      const gids = g.parts.filter(id => parts.get(id).meta.layer === L.id);
      if (!gids.length) continue;
      det.append(h('div', { class: 't-group' },
        h('div', { class: 't-group-head' },
          h('button', { class: 't-name t-link', text: g.short || g.name, onclick: () => chooseRef({ kind: 'group', id: g.id }) }),
          visBox(gids)),
        h('div', { class: 't-parts' }, gids.map(id => partButton(id)))));
    }
    tree.append(det);
  }
  buildTreeState();
}
function buildTreeState() {
  tree.querySelectorAll('input.vis').forEach(c => {
    const ids = c.dataset.ids.split(',');
    const on = ids.filter(id => !S.hidden.has(id)).length;
    c.checked = on === ids.length;
    c.indeterminate = on > 0 && on < ids.length;
  });
  tree.querySelectorAll('.t-part').forEach(b => {
    const P = parts.get(b.dataset.id);
    b.classList.toggle('is-hidden', !isVisible(P));
  });
  markTreeSelection();
}
function markTreeSelection() {
  const sel = new Set(S.sel && S.sel.kind === 'part' ? [S.sel.id] : []);
  tree.querySelectorAll('.t-part').forEach(b => b.classList.toggle('is-selected', sel.has(b.dataset.id)));
}
search.addEventListener('input', buildTree);

/* ---------- about ---------- */
function buildAbout() {
  const tris = geoMeta.triangles.toLocaleString('en-GB');
  const rows = anat.layers.filter(l => layerCount(l.id)).flatMap(l => [h('dt', { text: String(layerCount(l.id)) }), h('dd', { text: l.name })]);
  $('#about-body').replaceChildren(
    h('p', { text: 'A complete adult male body built from real anatomical surface models: skin, muscles, organs, the brain, the major blood vessels and every bone. Each structure is a separate object you can select, fade, hide, isolate and pull apart.' }),
    h('dl', {}, rows, h('dt', { text: tris }), h('dd', { text: 'triangles in total, simplified from about 27 million in the source data' })),
    h('h3', { text: 'Using the viewer' }),
    h('ul', {},
      h('li', { text: 'Drag to rotate, pinch or scroll to zoom, and drag with two fingers to pan.' }),
      h('li', { text: 'Peel removes the outermost layer and Add brings the last one back, so you can step in and out one layer at a time: skin, muscles, organs, arteries, veins, brain and cartilage, down to the skeleton.' }),
      h('li', { text: 'Layers sets each layer to Off, Faded or On directly. Faded layers stay visible as a see-through shell and ignore taps, so you can select what lies beneath. Add restores a layer the way it was, so a faded skin comes back faded.' }),
      h('li', { text: 'Search finds any single structure by name, Latin term, vertebra (T7) or tooth number (36), or lets you browse everything layer by layer.' }),
      h('li', { text: 'Tap a structure to select it, tap it twice quickly to zoom in on it, and tap empty space to clear the selection.' }),
      h('li', { text: 'Explode pulls the body apart. The picker next to it chooses how: by region (head, chest, limbs), by group (such as the wrist bones or the muscles of the thigh), or every part on its own. The skin fades away as the body comes apart.' }),
      h('li', { text: 'Isolate shows only the selection. X-ray fades everything else so you can see the selection inside the body.' }),
      h('li', { text: 'Your camera, layers, explode setting and hidden structures are kept between launches.' })),
    h('h3', { text: 'What is not included' }),
    h('ul', {},
      h('li', { text: 'Nerves: the brain and optic nerves are modelled, but not the spinal cord or the peripheral nerves.' }),
      h('li', { text: 'Vessels: only the major arteries and veins of the trunk and neck, the heart\u2019s own vessels and the pulmonary vessels. The limbs and head have none.' }),
      h('li', { text: 'Bones: the coccyx, the six ear ossicles and the third molars are missing from the dataset.' }),
      h('li', { text: 'The lymphatic system and female anatomy are not part of this model. Bones are outer surfaces only, without marrow.' })),
    h('h3', { text: 'Editing names and descriptions' }),
    h('p', { text: 'Names, Latin terms, descriptions, groupings, layers and colours come from data/anatomy.json. Edit it in Snuggery and the viewer picks up the changes when you return to it.' }),
    h('h3', { text: 'Sources and credits' }),
    h('p', {}, 'Geometry: BodyParts3D, \u00a9 The Database Center for Life Science (DBCLS), release 3.0. Licensed CC BY-SA 2.1 Japan; DBCLS now publishes BodyParts3D under CC BY 4.0. Mitsuhashi N. et al., BodyParts3D: 3D structure database for anatomical concepts, Nucleic Acids Research 37 (2009), doi:10.1093/nar/gkn613. ',
      h('small', { text: 'Adapted: converted from millimetres Z-up to metres Y-up, vertices welded, simplified (bones with meshoptimizer at about 0.1% maximum error, soft tissue with quadric decimation to a per-layer budget), positions quantised to 16 bits.' })),
    h('p', { text: 'Rendering: three.js (MIT licence). Type: Atkinson Hyperlegible and Newsreader (SIL Open Font Licence).' }),
    h('p', {}, h('small', { text: 'For learning and reference. Not for diagnosis or clinical use.' })),
  );
}

/* ---------- theme + refresh ---------- */
darkQuery.addEventListener('change', () => anat && applyMaterials());
async function refreshAnatomy() {
  if (!anat) return;
  try {
    const a = await fetchJSON('data/anatomy.json');
    if (JSON.stringify(a) !== JSON.stringify(anat)) applyAnatomy(a);
  } catch { /* keep the last good copy */ }
}
addEventListener('focus', refreshAnatomy);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAnatomy(); });

/* ---------- start ---------- */
function start() {
  resize();
  $('#level').value = S.level;
  if (S.isolate && !idsOf(S.isolate).length) S.isolate = null;
  applyVisibility();
  const saved = store.get('camera', null);
  const target = S.explode;
  if (saved) {
    camera.position.fromArray(saved.p);
    controls.target.fromArray(saved.t);
    camera.lookAt(controls.target);
  } else {
    S.explode = 0; applyExplode();
    const box = visibleBox();
    frame(box, new THREE.Vector3(0.42, 0.1, 1), 0);
  }
  // Opening moment: the skeleton assembles from its exploded state.
  if (!reduceMotion) {
    S.explode = Math.max(0.85, target);
    applyExplode(); syncExplodeUI();
    setTimeout(() => animateExplode(target, 1500), 250);
  } else {
    S.explode = target; applyExplode(); syncExplodeUI();
  }
  requestAnimationFrame(loop);
  $('#loader').classList.add('done');
  setTimeout(() => $('#loader').hidden = true, 600);
}

load();
