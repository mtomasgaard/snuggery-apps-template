// Milky Way — the Solar System, the Sun's neighbourhood and the galaxy in one continuous 3D zoom,
// from real data only, offline.
//
// This file wires the pieces together and owns the render scheduler: a frame is drawn when
// something changed, and the loop stops as soon as nothing is moving. The pieces:
//   js/view.js         the camera rig: one float64 camera in AU, one pinch from a moon to 500 kpc
//   js/solar.js        the Sun, planets, moons, rings, orbits and small bodies (units: AU)
//   js/stars.js        the stars in 3D and the Gaia sky (units: parsecs)
//   js/galaxy.js       the galaxy's measured tracers and fitted models (units: kpc)
//   js/ephem.js        JPL DE430 planets and the Moon, and the JPL satellite fits (tools/ writes it)
//   js/rotation.js     IAU rotation models for every globe (tools/ writes it)
//   js/smallbodies.js  asteroid and comet orbits, propagated on the CPU (tools/ writes it)
//   js/labels.js, js/gfx.js, js/util.js
//
// Three render passes share one camera pose. Each is drawn in its own units with its own camera,
// so float32 never has to hold a kilometre and a kiloparsec in one number: first the stars (pc)
// and the galaxy (kpc), then — after a depth clear — the Solar System, whose objects are placed
// relative to the camera's target (a floating origin) and scaled so the target is one unit away.
//
// The data files and their formats are described in tools/CONTRACT.md; their sources, licences and
// accuracy in NOTES.md, CREDITS.txt and data/about.json (the About panel).

import * as THREE from './vendor/three.module.js';
import {
  $, $$, clamp, store, fmt, sig, fmtAU, fmtRuler, fmtLightTime, fmtDays, escapeHtml,
  AU_KM, PC_AU, KPC_AU, LY_AU, DEG, vnorm, vdot, vcross, vscale, vadd, vsub, vlen, getJSON, getBin,
} from './js/util.js';
import { Rig, reduceMotion } from './js/view.js';
import * as EPH from './js/ephem.js';
import * as ROT from './js/rotation.js';
import * as SB from './js/smallbodies.js';
import { SolarSystem } from './js/solar.js';
import { Stars } from './js/stars.js';
import { Galaxy } from './js/galaxy.js';
import { Labels } from './js/labels.js';
import { loadTexture, lineUniforms } from './js/gfx.js';

const DATA = 'data/';

// ---------------------------------------------------------------- state
const DEFAULT_LAYERS = {
  orbits: true, trails: true, moons: true, small: true, venusRadar: false,
  stars: true, constellations: true, exoplanets: true, sky: true,
  model: true, young: true, reid: true, drimmel: true, globulars: true, satellites: true, streams: true, grid: true,
  labels: true,
};
const SPEEDS = [
  { label: '1 hour / s', days: 1 / 24 }, { label: '1 day / s', days: 1 }, { label: '1 week / s', days: 7 },
  { label: '1 month / s', days: 30.436875 }, { label: '1 year / s', days: 365.25 },
];
const S = {
  layers: Object.assign({}, DEFAULT_LAYERS, store.get('layers', {})),
  speed: clamp(store.get('speed', 2), 0, SPEEDS.length - 1),
  playing: false,
  jd: NaN,
  selected: null,
};

// ---------------------------------------------------------------- renderer
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.autoClear = false;
renderer.info.autoReset = false;      // three passes per frame: count them all
renderer.setClearColor(0x020308, 1);
const scenes = { solar: new THREE.Scene(), stars: new THREE.Scene(), galaxy: new THREE.Scene() };
const cams = {
  solar: new THREE.PerspectiveCamera(50, 1, 1e-3, 1e10),
  stars: new THREE.PerspectiveCamera(50, 1, 1e-9, 1e8),
  galaxy: new THREE.PerspectiveCamera(50, 1, 1e-9, 1e6),
};
const rig = new Rig(canvas);
const labels = new Labels($('labels'), (id) => select(id, true));

let eph, rotation, phys, small, solar, stars, galaxy, textures, about, skyMeta;
let pose = null, pxPerRad = 1, W = 1, H = 1;
// While the info card covers the bottom of a phone screen, the view is shifted up so the selected
// object stays in sight (a camera view offset; labels and taps use the same shift).
let shiftY = 0;

// ---------------------------------------------------------------- loading
const progress = (f, msg) => { $('load-bar').style.width = `${Math.round(f * 100)}%`; if (msg) $('load-msg').textContent = msg; };
function fail(err) {
  console.error(err);
  const l = $('loading');
  l.classList.remove('done'); l.classList.add('error');
  $('load-msg').textContent = `Could not start: ${err.message || err}. The app's data files are missing or damaged — reinstall the app.`;
}

async function load() {
  progress(0.02, 'Reading the ephemeris…');
  phys = await getJSON(DATA + 'physical.json');
  if (Math.abs(phys.constants.au_km - AU_KM) > 1e-3) throw new Error('physical.json: astronomical unit does not match the app');
  eph = await EPH.loadEphemeris(DATA, phys);
  rotation = await ROT.loadRotation(DATA, phys);
  progress(0.14, 'Reading asteroid and comet orbits…');
  small = await SB.loadSmallBodies(DATA);
  progress(0.22, 'Reading the planets’ maps…');
  textures = await getJSON(DATA + 'tex/textures.json');
  const tex = {};
  const entries = Object.entries(textures.bodies || {});
  let done = 0;
  await Promise.all(entries.map(async ([k, t]) => {
    tex[k] = await loadTexture(DATA + 'tex/' + t.file);
    done++; progress(0.22 + 0.3 * done / entries.length);
  }));
  progress(0.55, 'Reading the stars…');
  const [deepBuf, deepMeta, named, colour, constellations, exoplanets] = await Promise.all([
    getBin(DATA + 'stars/deep.bin'), getJSON(DATA + 'stars/deep.json'), getJSON(DATA + 'stars/named.json'),
    getJSON(DATA + 'stars/colour.json'), getJSON(DATA + 'stars/constellations.json'), getJSON(DATA + 'stars/exoplanets.json'),
  ]);
  progress(0.78, 'Reading the Milky Way…');
  skyMeta = await getJSON(DATA + 'sky/sky.json');
  const skyTex = await loadTexture(DATA + 'sky/' + (skyMeta.file || 'gaia-dr3-counts.jpg'));
  skyTex.wrapS = THREE.RepeatWrapping;
  const g = await getJSON(DATA + 'galaxy/galaxy.json');
  const gtex = { young: {} };
  if (g.model && g.model.file) gtex.model = await loadTexture(DATA + g.model.file);
  if (g.young && g.young.files) for (const [k, f] of Object.entries(g.young.files)) gtex.young[k] = await loadTexture(DATA + f.file);
  about = await getJSON(DATA + 'about.json').catch(() => null);
  progress(0.92, 'Building the scene…');

  solar = new SolarSystem({ eph, rotation, phys, tex, textures, small });
  stars = new Stars({ deepBuf, deepMeta, named, colour, constellations, exoplanets, skyTex, sky: skyMeta });
  galaxy = new Galaxy({ g, tex: gtex });
  scenes.solar.add(solar.root);
  scenes.stars.add(stars.root);
  scenes.galaxy.add(galaxy.root);
  if (tex.venus_radar || tex.venus) solar.venusRadarTex = tex.venus_radar || tex.venus;

  // The ecliptic pole from the J2000 obliquity; the galactic pole from the galaxy frame's z axis.
  const eps = phys.constants.obliquity_j2000_arcsec / 3600 * DEG;
  const M = galaxy.toIcrs;
  rig.setFrames([0, -Math.sin(eps), Math.cos(eps)], [M[2], M[6], M[10]]);
  rig.jdNow = () => S.jd;
}

// ---------------------------------------------------------------- objects: ids, positions, descriptions
// Object ids: 'sun', 'earth', 'io' …; 'sb:<index>'; 'star:<row>'; 'gc:<i>', 'sat:<i>', 'stream:<i>',
// 'arm:<i>', 'gal:sun', 'gal:centre'.
const smallCache = { jd: NaN, buf: null };
function smallPos(i, jd) {
  if (!(smallCache.jd === jd)) {
    smallCache.buf ||= new Float32Array(small.count * 3);
    small.positionsAt(jd, smallCache.buf); smallCache.jd = jd;
  }
  return [smallCache.buf[i * 3], smallCache.buf[i * 3 + 1], smallCache.buf[i * 3 + 2]];
}
function positionFn(id) {
  if (id === 'point') return rig.targetFn;
  if (solar.bodies.has(id)) return (jd) => solar.positionOf(id, jd, [0, 0, 0]) || solar.positionOf(solar.bodies.get(id).parent, jd, [0, 0, 0]);
  const [kind, raw] = id.split(':'); const i = +raw;
  if (kind === 'sb') return (jd) => smallPos(i, jd);
  if (kind === 'star') { const p = [stars.namedAU[i * 3], stars.namedAU[i * 3 + 1], stars.namedAU[i * 3 + 2]]; return () => p; }
  const gp = galaxyPoint(id);
  if (gp) { const p = galaxy.toAU(gp); return () => p; }
  return null;
}
function galaxyPoint(id) {
  const [kind, raw] = id.split(':'); const i = +raw;
  if (kind === 'gc') return galaxy.globulars[i] && galaxy.globulars[i].xyz;
  if (kind === 'sat') return galaxy.satellites[i] && galaxy.satellites[i].xyz;
  if (kind === 'stream') { const s = galaxy.streams[i]; return s && s.points[Math.floor(s.points.length / 2)]; }
  if (kind === 'arm') { const a = galaxy.armLabels[i]; return a && a.p; }
  if (id === 'gal:sun') return galaxy.sun;
  if (id === 'gal:centre') return [0, 0, 0];
  return null;
}
function nameOf(id) {
  if (solar.bodies.has(id)) return solar.bodies.get(id).name;
  const [kind, raw] = id.split(':'); const i = +raw;
  if (kind === 'sb') return small.name(i);
  if (kind === 'star') return stars.label(i);
  if (kind === 'gc') return galaxy.globulars[i].name;
  if (kind === 'sat') return galaxy.satellites[i].name;
  if (kind === 'stream') return galaxy.streams[i].name;
  if (kind === 'arm') return galaxy.armLabels[i].name;
  if (id === 'gal:sun') return 'Sun';
  if (id === 'gal:centre') return 'Galactic centre';
  return id;
}
// A sensible viewing distance (AU) when flying to an object.
function arrivalDist(id) {
  if (solar.bodies.has(id)) {
    const b = solar.bodies.get(id);
    const r = b.radiusKm / AU_KM;
    if (id === 'sun') return r * 12;
    if (id === 'saturn') return r * 9;
    return r * 9;
  }
  const kind = id.split(':')[0];
  if (kind === 'sb') return 0.04;
  if (kind === 'star') return 4000;
  if (kind === 'gc') return 1.5 * KPC_AU;
  if (kind === 'sat') return 12 * KPC_AU;
  if (kind === 'stream') return 18 * KPC_AU;
  if (kind === 'arm') return 9 * KPC_AU;
  if (id === 'gal:sun') return 2.5 * KPC_AU;
  if (id === 'gal:centre') return 16 * KPC_AU;
  return rig.dist;
}
function minDistOf(id) {
  if (solar.bodies.has(id)) return solar.bodies.get(id).radiusKm / AU_KM * 1.12;
  return 2e-7;
}

function flyTo(id, dist, dir) {
  const fn = positionFn(id);
  if (!fn) return;
  rig.flyTo({ id, fn, dist: dist || arrivalDist(id), dir, minDist: minDistOf(id) }, S.jd);
  invalidate();
}

// ---------------------------------------------------------------- scale presets
function elevated(upVec, elevDeg, refDir) {
  const h = vsub([], refDir, vscale([], upVec, vdot(refDir, upVec)));
  if (vlen(h) < 1e-6) h.splice(0, 3, ...vnorm([], vcross([], upVec, [1, 0, 0])));
  vnorm(h, h);
  return vnorm([], vadd([], vscale([], h, Math.cos(elevDeg * DEG)), vscale([], upVec, Math.sin(elevDeg * DEG))));
}
function goScale(scale) {
  if (scale === 'solar') flyTo('sun', 7.5, elevated(rig.eclUp, 48, rig.dir));
  else if (scale === 'stars') flyTo('sun', 14 * PC_AU, elevated(rig.galUp, 24, rig.dir));
  else if (scale === 'galaxy') {
    const sunG = galaxy.toAU(galaxy.sun), gc = galaxy.toAU([0, 0, 0]);
    const toSun = vnorm([], vsub([], sunG, gc));
    flyTo('gal:centre', 46 * KPC_AU, elevated(rig.galUp, 42, toSun));
  }
}
function currentScale() {
  if (!pose) return 'solar';
  const ext = Math.max(pose.dist, vlen(pose.pos));
  return ext < 2e4 ? 'solar' : ext < 3e8 ? 'stars' : 'galaxy';
}

// ---------------------------------------------------------------- time
function jdNow() { return clamp(EPH.jdFromDate(new Date()), eph.range.jdStart + 1, eph.range.jdEnd - 1); }
function setJd(jd) { S.jd = clamp(jd, eph.range.jdStart + 0.5, eph.range.jdEnd - 0.5); updateTimebar(); invalidate(); }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function yearBounds(y) { return [EPH.jdFromDate(new Date(Date.UTC(y, 0, 1))), EPH.jdFromDate(new Date(Date.UTC(y + 1, 0, 1)))]; }
let scrubbing = false;
function updateTimebar() {
  const d = EPH.dateFromJd(S.jd);
  const y = d.getUTCFullYear();
  $('t-date').textContent = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${y}`;
  $('t-time').textContent = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  $('t-year').textContent = String(y);
  const [a, b] = yearBounds(y);
  const f = clamp((S.jd - a) / (b - a), 0, 1);
  if (!scrubbing) $('t-scrub').value = String(Math.round(f * 1000));
  $('t-scrub').style.setProperty('--p', `${(f * 100).toFixed(2)}%`);
  const r0 = EPH.dateFromJd(eph.range.jdStart).getUTCFullYear(), r1 = EPH.dateFromJd(eph.range.jdEnd).getUTCFullYear();
  $('t-yprev').disabled = y <= r0; $('t-ynext').disabled = y >= r1 - 1;
  $('t-speed').textContent = SPEEDS[S.speed].label;
  document.body.classList.toggle('playing', S.playing);
  $('t-play').setAttribute('aria-label', S.playing ? 'Pause' : 'Play');
}
function bindTime() {
  $('t-play').addEventListener('click', () => { S.playing = !S.playing; lastT = 0; updateTimebar(); invalidate(); });
  $('t-speed').addEventListener('click', () => { S.speed = (S.speed + 1) % SPEEDS.length; store.set('speed', S.speed); updateTimebar(); });
  $('t-now').addEventListener('click', () => setJd(jdNow()));
  const stepYear = (k) => { const d = EPH.dateFromJd(S.jd); const y = d.getUTCFullYear() + k; const [a, b] = yearBounds(d.getUTCFullYear()); const f = (S.jd - a) / (b - a); const [a2, b2] = yearBounds(y); setJd(a2 + f * (b2 - a2)); };
  $('t-yprev').addEventListener('click', () => stepYear(-1));
  $('t-ynext').addEventListener('click', () => stepYear(1));
  const sc = $('t-scrub');
  sc.addEventListener('pointerdown', () => { scrubbing = true; });
  sc.addEventListener('input', () => {
    const y = EPH.dateFromJd(S.jd).getUTCFullYear(); const [a, b] = yearBounds(y);
    S.jd = clamp(a + (+sc.value / 1000) * (b - a - 1e-6), eph.range.jdStart + 0.5, eph.range.jdEnd - 0.5);
    updateTimebar(); invalidate();
  });
  const end = () => { scrubbing = false; updateTimebar(); };
  sc.addEventListener('change', end); sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
}

// ---------------------------------------------------------------- projection (float64, AU)
function project(p, out) {
  const v0 = p[0] - pose.pos[0], v1 = p[1] - pose.pos[1], v2 = p[2] - pose.pos[2];
  const z = v0 * pose.fwd[0] + v1 * pose.fwd[1] + v2 * pose.fwd[2];
  if (z <= 0) return null;
  const x = v0 * pose.right[0] + v1 * pose.right[1] + v2 * pose.right[2];
  const y = v0 * pose.up[0] + v1 * pose.up[1] + v2 * pose.up[2];
  out.x = W / 2 + (x / z) * pxPerRad; out.y = H / 2 - shiftY - (y / z) * pxPerRad; out.z = z;
  return out;
}

// ---------------------------------------------------------------- render
let queued = false, lastT = 0;
function invalidate() { if (!queued) { queued = true; requestAnimationFrame(frameLoop); } }

function resize() {
  W = canvas.clientWidth; H = canvas.clientHeight;
  renderer.setSize(W, H, false);
  for (const c of Object.values(cams)) { c.aspect = W / Math.max(H, 1); c.fov = rig.fov / DEG; c.updateProjectionMatrix(); }
  pxPerRad = (H / 2) / Math.tan(rig.fov / 2);
  const pr = renderer.getPixelRatio();
  lineUniforms.uRes.value.set(W * pr, H * pr); lineUniforms.uPx.value = pr;
  document.documentElement.style.setProperty('--dock-h', `${$('dock').offsetHeight}px`);
  invalidate();
}

let candidates = [];
function frameLoop(t) {
  queued = false;
  const dt = lastT ? Math.min(t - lastT, 100) : 16; lastT = t;
  let moving = rig.step(dt);
  const card = $('card');
  const wantShift = !card.hidden && W < 760 ? Math.min(card.offsetHeight / 2 + 8, H * 0.24) : 0;
  if (Math.abs(wantShift - shiftY) > 0.5) { shiftY += (wantShift - shiftY) * Math.min(1, dt / 90); moving = true; } else shiftY = wantShift;
  if (S.playing) {
    const next = S.jd + SPEEDS[S.speed].days * dt / 1000;
    if (next >= eph.range.jdEnd - 0.5) { S.playing = false; }
    S.jd = clamp(next, eph.range.jdStart + 0.5, eph.range.jdEnd - 0.5);
    updateTimebar();
    moving = true;
  }
  draw();
  if (moving) invalidate(); else { lastT = 0; saveSoon(); }
}

function placeCamera(cam, pos, target, up, unit) {
  cam.position.set(pos[0] / unit, pos[1] / unit, pos[2] / unit);
  cam.up.set(up[0], up[1], up[2]);
  cam.lookAt(target[0] / unit, target[1] / unit, target[2] / unit);
  cam.updateMatrixWorld(true);
}

function draw() {
  const jd = S.jd;
  pose = rig.pose(jd);
  pose.right = vnorm([], vcross([], pose.fwd, pose.up));
  const pxRatio = renderer.getPixelRatio();
  const dSun = vlen(pose.pos);

  // --- solar pass: floating origin at the target, scaled so the target is one unit away
  const origin = pose.target, s = 1 / pose.dist;
  solar.root.scale.setScalar(s);
  const venusMeta = textures.bodies && (textures.bodies.venus_radar || textures.bodies.venus);
  const v = solar.bodies.get('venus');
  if (v && solar.venusRadarTex) {
    const on = !!S.layers.venusRadar;
    v.mat.uniforms.uHasMap.value = on ? 1 : 0; v.mat.uniforms.uMap.value = solar.venusRadarTex;
    v.mat.uniforms.uGray.value = 1; if (venusMeta) v.mat.uniforms.uLonLeft.value = venusMeta.lon_left_deg;
  }
  solar.update(jd, origin, pose.pos, pxPerRad, pxRatio, S.layers, s);
  const cs = cams.solar;
  cs.position.set((pose.pos[0] - origin[0]) * s, (pose.pos[1] - origin[1]) * s, (pose.pos[2] - origin[2]) * s);
  cs.up.set(pose.up[0], pose.up[1], pose.up[2]); cs.lookAt(0, 0, 0); cs.updateMatrixWorld(true);

  for (const c of Object.values(cams)) {
    if (shiftY > 0.5) c.setViewOffset(W, H, 0, shiftY, W, H); else if (c.view && c.view.enabled) c.clearViewOffset();
  }

  // --- stars (pc) and galaxy (kpc)
  placeCamera(cams.stars, pose.pos, pose.target, pose.up, PC_AU);
  placeCamera(cams.galaxy, pose.pos, pose.target, pose.up, KPC_AU);
  stars.update([pose.pos[0] / PC_AU, pose.pos[1] / PC_AU, pose.pos[2] / PC_AU], dSun / PC_AU, pxRatio, S.layers);
  galaxy.update(dSun / KPC_AU, pxRatio, S.layers);
  // The Solar System's small bodies and orbits would be a smudge on the Sun from far out: fade them.
  solar.root.visible = dSun < 5e6;

  renderer.info.reset();
  renderer.clear(true, true, true);
  renderer.render(scenes.stars, cams.stars);
  renderer.render(scenes.galaxy, cams.galaxy);
  renderer.clearDepth();
  if (solar.root.visible) renderer.render(scenes.solar, cams.solar);

  gatherLabels(jd, dSun);
  hud(dSun);
}

// ---------------------------------------------------------------- labels and picking
const _p = { x: 0, y: 0, z: 0 };
function gatherLabels(jd, dSun) {
  candidates = [];
  const push = (id, text, p, pri, colour, cls, dy = 0, dx = 0) => {
    const q = project(p, { x: 0, y: 0, z: 0 });
    if (!q) return;
    candidates.push({ id, text, x: q.x + dx, y: q.y + dy, pri: id === S.selected ? 1000 : pri, colour, cls });
  };
  const L = S.layers;
  const solarPx = pxPerRad * 40 / Math.max(dSun, 1e-9);        // how big 40 AU looks from here
  // Solar System
  for (const b of solar.bodies.values()) {
    if (!b.valid || !solar.root.visible) continue;
    if (b.kind === 'moon' && (!L.moons || (b.sepPx || 0) < 16)) continue;       // would sit on its planet
    if (b.key === 'sun' && galaxy.fade > 0.25) continue;                        // the galaxy layer labels it
    if (b.key !== 'sun' && solarPx < (b.kind === 'planet' || b.kind === 'dwarf' ? 18 : 60)) continue;
    const pri = b.key === 'sun' ? 100 : b.key === 'earth' ? 96 : b.kind === 'planet' ? 90 : b.kind === 'dwarf' ? 70 : 55;
    // A globe more than a few pixels across gets its label above the disc, not across it.
    // The Sun's label steps aside so its glow shows.
    const dx = b.key === 'sun' && b.px <= 10 ? 16 : 0;
    push(b.key, b.name, b.pos, pri, b.ui, b.kind === 'moon' ? 'minor' : '', b.px > 10 ? -(b.px + 14) : 0, dx);
  }
  if (L.small && small && solarPx > 40) {
    for (const i of small.labelled || []) {
      const p = smallPos(i, jd);
      push(`sb:${i}`, small.name(i), p, small.kind(i) === 'dwarf' ? 62 : 35, '#cfd7e2', 'minor');
    }
  }
  // Stars: the brightest as seen from here, more of them the farther out the camera is.
  if (L.stars) {
    const camPc = [pose.pos[0] / PC_AU, pose.pos[1] / PC_AU, pose.pos[2] / PC_AU];
    const maxN = dSun < 2e4 ? 10 : dSun < 1e8 ? 26 : 0;
    let n = 0;
    if (maxN) {
      // The brightest stars as seen from the camera, among those actually on screen.
      const best = [], q = { x: 0, y: 0, z: 0 }, p = [0, 0, 0];
      const inSolar = dSun < 2e4;
      for (const k of stars.labelOrder) {
        if (inSolar && (!stars.named.name[k] || stars.named.vmag[k] > 1.5)) continue;   // from among the planets, only the brightest
        p[0] = stars.namedAU[k * 3]; p[1] = stars.namedAU[k * 3 + 1]; p[2] = stars.namedAU[k * 3 + 2];
        if (!project(p, q) || q.x < 0 || q.x > W || q.y < 0 || q.y > H) continue;
        best.push([stars.apparentMag(k, camPc), k]);
      }
      best.sort((a, b) => a[0] - b[0]);
      for (const [m, k] of best) {
        if (n >= maxN) break;
        const pp = [stars.namedAU[k * 3], stars.namedAU[k * 3 + 1], stars.namedAU[k * 3 + 2]];
        push(`star:${k}`, stars.label(k), pp, 30 - m, '#bcd4ff', inSolar ? 'faint' : m < 1.5 ? '' : 'minor');
        n++;
      }
    }
  }
  // Galaxy
  if (galaxy.fade > 0.25) {
    push('gal:sun', 'Sun', galaxy.toAU(galaxy.sun), 95, '#ffe2a8', '');
    push('gal:centre', 'Galactic centre', galaxy.toAU([0, 0, 0]), 80, '#ffffff', '');
    if (L.reid || L.drimmel) galaxy.armLabels.forEach((a, i) => { if (L[a.layer]) push(`arm:${i}`, a.name, galaxy.toAU(a.p), 45, a.colour, 'faint'); });
    if (L.satellites) galaxy.satellites.forEach((o, i) => { if (Number.isFinite(o.mv) && o.mv < -8.5) push(`sat:${i}`, o.name, galaxy.toAU(o.xyz), 40 - o.mv * 0.5, '#ff8fa3', 'minor'); });
    if (L.globulars) galaxy.globulars.forEach((o, i) => { if (Number.isFinite(o.mv) && o.mv < -9.3) push(`gc:${i}`, o.name, galaxy.toAU(o.xyz), 30 - o.mv * 0.3, '#ffd27a', 'minor'); });
  }
  if (S.selected && !candidates.some((c) => c.id === S.selected)) {
    const fn = positionFn(S.selected);
    if (fn) push(S.selected, nameOf(S.selected), fn(jd), 1000, '#f2c56f', '');
  }
  // Keep labels off the title, the round buttons, the dock and the card.
  const reserved = [];
  const box = (el) => { if (!el || el.hidden) return; const r = el.getBoundingClientRect(); if (r.width) reserved.push([r.left, r.top, r.right, r.bottom]); };
  box(document.querySelector('#head .title')); box(document.querySelector('#head .head-actions'));
  box($('dock')); box($('card')); box($('hud'));
  labels.selected = S.selected;
  labels.update(L.labels ? candidates : candidates.filter((c) => c.id === S.selected), W, H, reserved);
}

function pick(x, y) {
  const jd = S.jd;
  let best = null, bestScore = 30;
  const consider = (id, p, pri, radiusPx = 0) => {
    const q = project(p, _p);
    if (!q) return;
    const d = Math.hypot(q.x - x, q.y - y) - radiusPx;
    const score = Math.max(0, d) - pri * 0.04;
    if (d < 30 && score < bestScore) { bestScore = score; best = id; }
  };
  for (const c of candidates) { const d = Math.hypot(c.x - x, c.y - y); const sc = d - c.pri * 0.04; if (d < 30 && sc < bestScore) { bestScore = sc; best = c.id; } }
  for (const b of solar.bodies.values()) if (b.valid && (b.kind !== 'moon' || S.layers.moons)) consider(b.key, b.pos, 20, b.px || 0);
  const dSun = vlen(pose.pos);
  if (S.layers.small && dSun < 2e4) {
    const buf = new Float32Array(small.count * 3); small.positionsAt(jd, buf);
    for (let i = 0; i < small.count; i++) consider(`sb:${i}`, [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]], 0);
  }
  if (S.layers.stars) {
    const camPc = [pose.pos[0] / PC_AU, pose.pos[1] / PC_AU, pose.pos[2] / PC_AU];
    for (let k = 0; k < stars.namedCount; k++) {
      if (stars.named.flags[k] & 16) continue;
      const m = stars.apparentMag(k, camPc);
      if (m > 8 + Math.log10(Math.max(1, dSun / PC_AU)) * 3) continue;
      consider(`star:${k}`, [stars.namedAU[k * 3], stars.namedAU[k * 3 + 1], stars.namedAU[k * 3 + 2]], 4 - m * 0.5);
    }
  }
  if (galaxy.fade > 0.05) {
    if (S.layers.globulars) galaxy.globulars.forEach((o, i) => consider(`gc:${i}`, galaxy.toAU(o.xyz), 2));
    if (S.layers.satellites) galaxy.satellites.forEach((o, i) => consider(`sat:${i}`, galaxy.toAU(o.xyz), 3));
    if (S.layers.streams) galaxy.streams.forEach((s, i) => { for (let j = 0; j < s.points.length; j += 3) consider(`stream:${i}`, galaxy.toAU(s.points[j]), 0); });
  }
  return best;
}

// ---------------------------------------------------------------- info card
function facts(id) {
  const jd = S.jd;
  const out = { kind: '', name: nameOf(id), rows: [], note: '', src: '', orbit: false };
  const earth = solar.positionOf('earth', jd, [0, 0, 0]);
  const add = (k, v) => out.rows.push([k, v]);
  if (solar.bodies.has(id)) {
    const b = solar.bodies.get(id), p = b.phys;
    const pos = solar.positionOf(id, jd, [0, 0, 0]);
    out.kind = b.kind === 'star' ? 'Star' : b.kind === 'planet' ? 'Planet' : b.kind === 'dwarf' ? 'Dwarf planet' : `Moon of ${solar.bodies.get(b.parent).name}`;
    if (id !== 'sun') add('From the Sun', `${fmtAU(vlen(pos))}`);
    if (id !== 'earth') add('From the Earth', `${fmtAU(Math.hypot(pos[0] - earth[0], pos[1] - earth[1], pos[2] - earth[2]))} · ${fmtLightTime(Math.hypot(pos[0] - earth[0], pos[1] - earth[1], pos[2] - earth[2]))}`);
    if (b.kind === 'moon') { const par = solar.positionOf(b.parent, jd, [0, 0, 0]); add(`From ${solar.bodies.get(b.parent).name}`, `${fmt(Math.hypot(pos[0] - par[0], pos[1] - par[1], pos[2] - par[2]) * AU_KM)} km`); }
    const r = b.radii; add('Radius', r[0] === r[2] ? `${sig(r[0], 4)} km` : `${sig(r[0], 5)} km equator, ${sig(r[2], 5)} km pole`);
    if (p.sidereal_rotation_h) add('Rotation', `${fmtDays(Math.abs(p.sidereal_rotation_h) / 24)}${p.sidereal_rotation_h < 0 ? ', retrograde' : ''}`);
    if (Number.isFinite(p.obliquity_deg)) add('Axial tilt', `${fmt(p.obliquity_deg, 2)}°`);
    const o = solar.orbits.get(id);
    if (o && o.el && id !== 'moon') add('Orbital period', fmtDays(o.el.period));
    if (b.meta) out.src = `Surface: ${b.meta.note || b.meta.source_id}`;
    else if (textures.colours && textures.colours[id]) out.src = `Colour: ${textures.colours[id].note || textures.colours[id].source}`;
    if (id === 'venus') out.note = S.layers.venusRadar ? 'Shown with the Magellan radar map of the surface, which no eye can see through the clouds.' : 'Drawn as a plain disc: no colour data for Venus could be sourced, and its visible face is a featureless cloud deck. Layers → Venus radar surface shows the Magellan map.';
    if (id === 'pluto') out.note = 'Drawn at the Pluto–Charon barycentre from JPL DE430. Pluto itself circles that point every 6.39 days, about 2,100 km away; Charon is not shown because no long-term ephemeris for it could be sourced.';
    if (b.kind === 'moon' && id !== 'moon') out.note = solar.inMoonRange ? 'Position from JPL satellite ephemerides, fitted in windows of a few weeks (see About).' : 'Moon positions are available from 1950 to 2050 only.';
    out.orbit = false;
  } else {
    const [kind, raw] = id.split(':'); const i = +raw;
    if (kind === 'sb') {
      const info = (small.info && small.info(i)) || {};
      out.kind = small.kindLabel ? small.kindLabel(i) : small.kind(i);
      const p = smallPos(i, jd);
      add('From the Sun', fmtAU(vlen(p)));
      add('From the Earth', fmtAU(Math.hypot(p[0] - earth[0], p[1] - earth[1], p[2] - earth[2])));
      const el = small.elements ? small.elements(i) : null;
      if (el) {
        if (el.e < 1) add('Orbit', `${sig(el.q / (1 - el.e))} AU across, e ${fmt(el.e, 3)}`); else add('Orbit', `open, e ${fmt(el.e, 3)}`);
        if (el.e < 1) add('Period', fmtDays(2 * Math.PI * Math.sqrt((el.q / (1 - el.e)) ** 3) / phys.constants.k_gauss_au15_day));
      }
      if (Number.isFinite(info.diameter_km)) add('Diameter', `${sig(info.diameter_km)} km`);
      if (Number.isFinite(info.H)) add('Absolute magnitude', `H ${fmt(info.H, 1)}`);
      out.src = info.source || '';
      out.note = info.note || '';
      out.orbit = true;
    } else if (kind === 'star') {
      const n = stars.named;
      out.kind = n.flags[i] & 2 ? 'White dwarf' : 'Star';
      const dpc = Math.hypot(n.x[i], n.y[i], n.z[i]);
      add('Distance', `${sig(dpc * PC_AU / LY_AU)} light-years (${sig(dpc)} pc)`);
      if (n.desig[i] && n.name[i]) add('Designation', n.desig[i]);
      add('Catalogue', n.id[i]);
      if (Number.isFinite(n.vmag[i])) add('Brightness from Earth', `V ${fmt(n.vmag[i], 2)}`);
      if (Number.isFinite(n.absmag[i])) add('Absolute magnitude', `${fmt(n.absmag[i], 2)}`);
      if (n.spect[i]) add('Spectral type', n.spect[i]);
      add('Distance from', stars.distSource(i));
      const pl = stars.exo[i];
      if (pl && pl.length) out.planets = pl;
      if (n.flags[i] & 4) out.note = 'A companion placed at its primary star’s distance.';
      if (n.flags[i] & 8) out.note = 'Parallax only 5–10× its error: the distance is uncertain.';
    } else if (kind === 'gc' || kind === 'sat') {
      const o = kind === 'gc' ? galaxy.globulars[i] : galaxy.satellites[i];
      out.kind = kind === 'gc' ? 'Globular cluster' : 'Satellite galaxy';
      add('Distance', `${sig(o.dist_kpc * 1000 * PC_AU / LY_AU / 1000)} thousand light-years (${sig(o.dist_kpc)} kpc)`);
      add('From the Galactic centre', `${sig(Math.hypot(...o.xyz))} kpc`);
      if (Number.isFinite(o.mv)) add('Absolute magnitude', `M_V ${fmt(o.mv, 1)}`);
      if (Number.isFinite(o.rhalf_pc)) add('Half-light radius', `${sig(o.rhalf_pc)} pc`);
      out.src = o.ref ? `Distance: ${o.ref}` : '';
    } else if (kind === 'stream') {
      const s = galaxy.streams[i];
      out.kind = 'Stellar stream';
      const ds = s.points.map((p) => Math.hypot(...p));
      add('From the Galactic centre', `${sig(Math.min(...ds))}–${sig(Math.max(...ds))} kpc`);
      add('Track', s.quality === 'track' ? 'measured path and distances' : 'approximate: constant published distance');
      out.src = s.ref || '';
    } else if (kind === 'arm') {
      const a = galaxy.armLabels[i];
      out.kind = a.layer === 'reid' ? 'Spiral-arm fit · masers' : 'Spiral-arm fit · Cepheids';
      out.note = a.src.note || (a.layer === 'reid' ? 'A log-spiral fitted to maser parallaxes (Reid et al. 2019), drawn only over the range the fit covers. A fit, not a picture.' : 'A spiral fitted to classical Cepheids (Drimmel et al. 2024). It sits about 0.9 kpc from the maser fit near the Sun — two models, both shown.');
    } else if (id === 'gal:sun') {
      out.kind = 'Our star'; add('From the Galactic centre', `${fmt(Math.hypot(...galaxy.sun), 3)} kpc`); out.src = (galaxy.g.frame.refs || []).join('; ');
    } else if (id === 'gal:centre') {
      out.kind = 'Sagittarius A*'; add('From the Sun', `${fmt(galaxy.g.frame.r0_kpc, 3)} kpc`); out.src = (galaxy.g.frame.refs || []).join('; ');
    }
  }
  return out;
}

function select(id, fromLabel = false) {
  S.selected = id;
  const card = $('card');
  if (!id) { card.hidden = true; if (solar) solar.showSmallOrbit(-1); invalidate(); return; }
  const f = facts(id);
  $('card-kind').textContent = f.kind;
  $('card-name').textContent = f.name;
  $('card-facts').innerHTML = f.rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');
  const pl = $('card-planets');
  pl.hidden = !f.planets;
  pl.innerHTML = f.planets ? f.planets.map((p) => `<li><span>${escapeHtml(p.name)}</span><span class="d">${[p.period_d ? `orbit ${fmtDays(p.period_d)}` : '', p.year ? `found ${p.year}` : ''].filter(Boolean).join(' · ')}</span></li>`).join('') : '';
  $('card-note').textContent = f.note || '';
  $('card-src').textContent = f.src || '';
  $('card-orbit').hidden = !f.orbit;
  $('card-orbit').textContent = solar.smallOrbitIdx === +id.split(':')[1] && id.startsWith('sb:') ? 'Hide orbit' : 'Show orbit';
  card.hidden = false;
  invalidate();
}

// ---------------------------------------------------------------- hud
const NICE = [1, 2, 5];
function niceBelow(v) { const e = Math.floor(Math.log10(v)); const b = Math.pow(10, e); let best = b; for (const n of NICE) if (n * b <= v) best = n * b; return best; }
function hud(dSun) {
  // A ruler about 80 px long, true at the target's distance.
  const au = 80 / pxPerRad * pose.dist;
  let len, label;
  const km = au * AU_KM;
  if (km < 1e6) { len = niceBelow(km) / AU_KM; label = `${fmt(len * AU_KM)} km`; }
  else if (au < 5000) { len = niceBelow(au); label = `${fmt(len, len < 1 ? 2 : 0)} AU`; }
  else if (au / LY_AU < 1000) { const ly = niceBelow(au / LY_AU); len = ly * LY_AU; label = `${fmt(ly, ly < 1 ? 2 : 0)} ly`; }
  else { const kly = niceBelow(au / LY_AU / 1000); len = kly * 1000 * LY_AU; label = `${fmt(kly)} thousand ly`; }
  $('ruler-bar').style.width = `${(len / au * 80).toFixed(1)}px`;
  $('ruler-len').textContent = label;
  $('hud-dist').textContent = dSun < 1e-3 ? '' : `You are ${fmtAU(dSun)} from the Sun`;
  const sc = currentScale();
  for (const b of $$('#scales button')) b.setAttribute('aria-pressed', String(b.dataset.scale === sc));
  const tb = $('timebar');
  const showTime = sc === 'solar';
  if (tb.classList.contains('off') === showTime) { tb.classList.toggle('off', !showTime); requestAnimationFrame(() => document.documentElement.style.setProperty('--dock-h', `${$('dock').offsetHeight}px`)); }
  const tid = rig.targetId;
  const name = tid === 'flight' ? '' : tid === 'point' ? '' : nameOf(tid);
  $('sub').textContent = sc === 'solar' ? (name && tid !== 'sun' ? `${name} · ${$('t-date').textContent}` : `Solar System · ${$('t-date').textContent}`)
    : sc === 'stars' ? (name && tid !== 'sun' ? `${name} · the Sun's neighbourhood` : 'The Sun’s neighbourhood') : (name && tid !== 'gal:centre' ? `${name} · the Milky Way` : 'The Milky Way');
}

// ---------------------------------------------------------------- sheets: layers, search, about
const LAYER_DOC = () => [
  ['Solar System', [
    ['orbits', 'Orbits', 'Each planet’s orbit at the current date'],
    ['trails', 'Trails', 'The real path over the last part of each orbit'],
    ['moons', 'Moons', `${[...solar.bodies.values()].filter((b) => b.kind === 'moon').length} major moons · JPL ephemerides, 1950–2050`],
    ['small', 'Asteroids and comets', `${fmt(small.count)} objects · JPL and Minor Planet Center orbits`],
    ['venusRadar', 'Venus radar surface', 'Magellan radar instead of a plain disc'],
  ]],
  ['Stars', [
    ['stars', 'Stars', `${fmt(stars.deepCount + stars.namedCount)} stars within 500 pc, in 3D`],
    ['constellations', 'Constellation figures', `${stars.constellations.length} IAU constellations, drawn in 3D`],
    ['exoplanets', 'Exoplanet hosts', `${fmt(Object.keys(stars.exo).length)} stars with confirmed planets`],
    ['sky', 'The Milky Way sky', 'Gaia DR3 star counts, as seen from the Sun'],
  ]],
  ['Milky Way', [
    ['globulars', 'Globular clusters', `${galaxy.globulars.length} clusters at measured distances`],
    ['satellites', 'Satellite galaxies', `${galaxy.satellites.length} galaxies at measured distances`],
    ['streams', 'Stellar streams', `${galaxy.streams.length} streams traced through the halo`],
    ['young', 'Young stars (Gaia)', 'Where young stars crowd, measured within ~4 kpc'],
    ['reid', 'Arm fits · masers', 'Reid et al. 2019 — a fit to maser parallaxes'],
    ['drimmel', 'Arm fits · Cepheids', 'Drimmel et al. 2024 — a fit to Cepheids'],
    ['model', 'Disc and bar model', 'McMillan 2017 disc, Portail 2017 bar — models'],
    ['grid', 'Distance rings', 'Every 5 kpc from the centre — a guide, not data'],
  ]],
  ['Everywhere', [['labels', 'Labels', 'Names on screen']]],
];
function buildLayers() {
  const root = $('layer-rows');
  root.innerHTML = LAYER_DOC().map(([g, rows]) => `<p class="layer-group">${escapeHtml(g)}</p>` + rows.map(([k, t, s]) =>
    `<label class="layer-row"><span><span class="t">${escapeHtml(t)}</span><span class="s">${escapeHtml(s)}</span></span>`
    + `<span class="switch"><input type="checkbox" data-layer="${k}" ${S.layers[k] ? 'checked' : ''}><span></span></span></label>`).join('')).join('');
  root.addEventListener('change', (e) => {
    const k = e.target.dataset.layer; if (!k) return;
    S.layers[k] = e.target.checked; store.set('layers', S.layers); invalidate();
  });
}
function buildAbout() {
  const body = $('about-body');
  if (!about) { body.innerHTML = '<p>About text is missing from this build.</p>'; return; }
  const blocks = about.blocks || about;
  body.innerHTML = (about.intro ? `<p>${escapeHtml(about.intro)}</p>` : '') + blocks.map((b) =>
    `<h3>${escapeHtml(b.title)}</h3>`
    + (b.text ? `<p>${escapeHtml(b.text)}</p>` : '')
    + (b.source ? `<p>${escapeHtml(b.source)}</p>` : '')
    + (b.accuracy ? `<p class="acc">${escapeHtml(b.accuracy)}</p>` : '')
    + (b.licence ? `<p class="lic">${escapeHtml(b.owner ? b.owner + ' · ' : '')}${escapeHtml(b.licence)}${b.retrieved ? ' · retrieved ' + escapeHtml(b.retrieved) : ''}</p>` : '')).join('');
}
let searchIndex = null;
function buildSearch() {
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  searchIndex = [];
  for (const b of solar.bodies.values()) searchIndex.push({ id: b.key, text: b.name, kind: b.kind === 'moon' ? `Moon of ${solar.bodies.get(b.parent).name}` : b.kind === 'star' ? 'Star' : b.kind === 'dwarf' ? 'Dwarf planet' : 'Planet', pri: 3 });
  for (let i = 0; i < small.count; i++) searchIndex.push({ id: `sb:${i}`, text: small.name(i), kind: small.kindLabel ? small.kindLabel(i) : small.kind(i), pri: (small.labelled || []).includes(i) ? 2 : 0 });
  const n = stars.named;
  for (let k = 0; k < stars.namedCount; k++) {
    if (n.flags[k] & 16) continue;
    const t = [n.name[k], n.desig[k], n.id[k]].filter(Boolean);
    searchIndex.push({ id: `star:${k}`, text: t[0], alt: t.slice(1).join(' · '), kind: 'Star', pri: n.name[k] ? 2 : 1, extra: t.join(' ') });
  }
  galaxy.globulars.forEach((o, i) => searchIndex.push({ id: `gc:${i}`, text: o.name, kind: 'Globular cluster', pri: 1, extra: o.key }));
  galaxy.satellites.forEach((o, i) => searchIndex.push({ id: `sat:${i}`, text: o.name, kind: 'Satellite galaxy', pri: 2, extra: o.key }));
  galaxy.streams.forEach((o, i) => searchIndex.push({ id: `stream:${i}`, text: o.name, kind: 'Stellar stream', pri: 1 }));
  for (const e of searchIndex) e.f = fold([e.text, e.alt, e.extra].filter(Boolean).join(' '));
  const q = $('search-q'), res = $('search-res');
  const run = () => {
    const s = fold(q.value.trim());
    if (!s) { res.innerHTML = ''; return; }
    const hits = [];
    for (const e of searchIndex) { const at = e.f.indexOf(s); if (at >= 0) hits.push([at === 0 ? 0 : 1, -e.pri, e.text.length, e]); }
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    res.innerHTML = hits.length ? hits.slice(0, 40).map(([, , , e]) => `<li data-id="${escapeHtml(e.id)}"><span>${escapeHtml(e.text)}${e.alt ? ` <span class="k">${escapeHtml(e.alt)}</span>` : ''}</span><span class="k">${escapeHtml(e.kind)}</span></li>`).join('') : '<li class="empty">Nothing by that name in this app’s data.</li>';
  };
  q.addEventListener('input', run);
  res.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    closeSheets(); select(li.dataset.id); flyTo(li.dataset.id);
  });
}
function openSheet(id) {
  for (const s of ['layers', 'search', 'about']) { $(s).hidden = s !== id; $(`btn-${s}`).setAttribute('aria-expanded', String(s === id)); }
  if (id === 'search') setTimeout(() => $('search-q').focus(), 60);
}
function closeSheets() { for (const s of ['layers', 'search', 'about']) { $(s).hidden = true; $(`btn-${s}`).setAttribute('aria-expanded', 'false'); } }

// ---------------------------------------------------------------- persistence
let saveTimer = 0;
function saveNow() {
  if (!pose) return;
  const id = rig.targetId === 'flight' || rig.targetId === 'point' ? null : rig.targetId;
  store.set('camera', { id, dist: rig.dist, dir: rig.dir, point: rig.targetId === 'point' ? rig.target(S.jd) : null });
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 400); }

// ---------------------------------------------------------------- start
function bindUi() {
  $('btn-layers').addEventListener('click', () => ($('layers').hidden ? openSheet('layers') : closeSheets()));
  $('btn-search').addEventListener('click', () => ($('search').hidden ? openSheet('search') : closeSheets()));
  $('btn-about').addEventListener('click', () => ($('about').hidden ? openSheet('about') : closeSheets()));
  for (const b of $$('[data-close]')) b.addEventListener('click', closeSheets);
  for (const b of $$('#scales button')) b.addEventListener('click', () => { select(null); goScale(b.dataset.scale); });
  $('card-close').addEventListener('click', () => select(null));
  $('card-go').addEventListener('click', () => { if (S.selected) flyTo(S.selected); });
  $('card-orbit').addEventListener('click', () => {
    if (!S.selected || !S.selected.startsWith('sb:')) return;
    const i = +S.selected.split(':')[1];
    if (solar.smallOrbitIdx === i) solar.showSmallOrbit(-1); else solar.showSmallOrbit(i, S.jd);
    select(S.selected);
  });
  rig.on('tap', (x, y) => { const id = pick(x, y); select(id); });
  rig.on('doubletap', (x, y) => { const id = pick(x, y); if (id) { select(id); flyTo(id); } else { rig.vel.zoom = -0.004; invalidate(); } });
  rig.on('change', invalidate); rig.on('interact', invalidate); rig.on('settle', saveSoon);
  rig.on('arrive', () => { invalidate(); saveSoon(); });
  window.addEventListener('resize', resize);
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); else invalidate(); });
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') { S.playing = !S.playing; updateTimebar(); invalidate(); e.preventDefault(); }
    if (e.key === 'Escape') { closeSheets(); select(null); }
  });
}

function restoreCamera() {
  const c = store.get('camera', null);
  const valid = (id) => id && (solar.bodies.has(id) || /^(sb|star|gc|sat|stream|arm):\d+$/.test(id) || id === 'gal:sun' || id === 'gal:centre') && positionFn(id);
  if (c && valid(c.id) && Number.isFinite(c.dist) && Array.isArray(c.dir)) {
    rig.setTarget(c.id, positionFn(c.id), minDistOf(c.id)); rig.dist = c.dist; rig.dir = vnorm([], c.dir);
  } else if (c && Array.isArray(c.point) && Number.isFinite(c.dist)) {
    const p = c.point.slice(); rig.setTarget('point', () => p); rig.dist = c.dist; rig.dir = vnorm([], c.dir);
  } else {
    rig.setTarget('sun', positionFn('sun'), minDistOf('sun'));
    rig.dist = 7.5; rig.dir = elevated(rig.eclUp, 48, [0.35, -0.9, 0.2]);
  }
}

(async function main() {
  try {
    await load();
  } catch (e) { fail(e); return; }
  S.jd = jdNow();
  bindUi(); bindTime(); buildLayers(); buildAbout(); buildSearch();
  restoreCamera();
  updateTimebar();
  resize();
  progress(1, '');
  $('loading').classList.add('done');
  invalidate();
  // A small hook for tools/shoot.mjs, the headless check that drives the app through its scenes.
  window.__mw = {
    rig, S, select, flyTo, goScale, setJd, invalidate,
    edgeDir: () => elevated(rig.galUp, 5, vnorm([], vsub([], galaxy.toAU([0, 10, 0]), galaxy.toAU([0, 0, 0])))),
    candidates: () => candidates.map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y), pri: c.pri })),
    placed: () => labels.placed.map((p) => p.id),
    stats: () => ({ ...renderer.info.render, programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
  };
})();
