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
  model: true, young: true, youngOB: false, reid: true, drimmel: true, globulars: true, satellites: true, streams: true, grid: true,
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
const scenes = { solar: new THREE.Scene(), stars: new THREE.Scene(), galaxy: new THREE.Scene() };
const cams = {
  solar: new THREE.PerspectiveCamera(50, 1, 1e-3, 1e10),
  stars: new THREE.PerspectiveCamera(50, 1, 1e-9, 1e8),
  galaxy: new THREE.PerspectiveCamera(50, 1, 1e-9, 1e6),
};
// Made in main(), inside its try: a WebView that refuses a WebGL context (memory pressure, too
// many contexts) then gets a message instead of a loading screen that never ends.
let renderer, rig, labels;
function createRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.autoClear = false;
  renderer.info.autoReset = false;      // three passes per frame: count them all
  renderer.setClearColor(0x020308, 1);
  // Rendering is on demand: after the system drops and restores the context (iOS does for a
  // backgrounded WebView) nothing would redraw until the next touch.
  canvas.addEventListener('webglcontextrestored', () => { resize(); invalidate(); });
  rig = new Rig(canvas);
  labels = new Labels($('labels'));
}

let eph, rotation, phys, small, solar, stars, galaxy, textures, about, skyMeta;
let pose = null, pxPerRad = 1, W = 1, H = 1;
// While the info card covers part of the screen, the view is shifted so the selected object stays
// in sight: up while the card covers the bottom of a phone screen, left while it sits on the right
// of a wide one (a camera view offset; labels and taps use the same shift).
let shiftX = 0, shiftY = 0;

// ---------------------------------------------------------------- loading
const progress = (f, msg) => { $('load-bar').style.width = `${Math.round(f * 100)}%`; if (msg) $('load-msg').textContent = msg; };
function fail(err, msg) {
  console.error(err);
  const l = $('loading');
  l.classList.remove('done'); l.classList.add('error');
  $('load-msg').textContent = msg || `Could not start: ${err.message || err}. The app's data files are missing or damaged — reinstall the app.`;
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
  // Only the maps something draws: a globe in physical.json, or the Earth's night side.
  const entries = Object.entries(textures.bodies).filter(([k]) => phys.bodies[k] || k === 'earth_night');
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
  const M = galaxy.data.toIcrsMatrix;
  rig.setFrames([0, -Math.sin(eps), Math.cos(eps)], [M[2], M[6], M[10]]);
  rig.jdNow = () => S.jd;
}

// ---------------------------------------------------------------- objects: ids, positions, descriptions
// Object ids: 'sun', 'earth', 'io' …; 'sb:<index>'; 'star:<row>'; 'gc:<i>', 'sat:<i>', 'stream:<i>',
// 'arm:<i>', 'gal:sun', 'gal:centre', 'gal:model'.
const smallPos = (i, jd) => Array.from(small.position(i, jd));
// A fitted moon of a giant planet outside its 1950–2050 range has no position: it is not drawn, and
// anything that would follow it goes to its planet instead.
function moonMissing(id, jd = S.jd) {
  const b = solar.bodies.get(id);
  return !!b && b.kind === 'moon' && id !== 'moon' && !solar.positionOf(id, jd, [0, 0, 0]);
}
const isSkyStar = (id) => id.startsWith('star:') && stars.skyOnly(+id.split(':')[1]);
// A sky-only star (no usable parallax) as a point for labels and taps: its direction from the Sun,
// at an effectively infinite distance from the camera.
const skyPoint = (k) => vadd([], pose.pos, vscale([], stars.direction(k), 1e12));
function positionFn(id) {
  if (id === 'point') return rig.targetFn;
  if (solar.bodies.has(id)) return (jd) => solar.positionOf(id, jd, [0, 0, 0]) || solar.positionOf(solar.bodies.get(id).parent, jd, [0, 0, 0]);
  const [kind, raw] = id.split(':'); const i = +raw;
  if (kind === 'sb') return (jd) => smallPos(i, jd);
  if (kind === 'star') {
    if (stars.skyOnly(i)) return null;          // a direction, not a place: nowhere to fly to
    const p = [stars.namedAU[i * 3], stars.namedAU[i * 3 + 1], stars.namedAU[i * 3 + 2]]; return () => p;
  }
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
  if (id === 'gal:model') return modelLabelPoint();
  return null;
}
// Where the disc-and-bar model's label sits: 4.5 kpc out along the far end of the model's bar.
function modelLabelPoint() {
  const m = galaxy.g.model;
  if (!m || !Number.isFinite(m.bar_angle_deg)) return null;
  const a = m.bar_angle_deg * DEG;
  return [4.5 * Math.cos(a), 4.5 * Math.sin(a), 0];
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
  if (id === 'gal:model') return 'Disc & bar model';
  return id;
}
// The name on screen: an arm is a fit, and its label says so (the card says which fit).
const labelOf = (id) => (id.startsWith('arm:') ? `${nameOf(id)} · fit` : nameOf(id));
// A sensible viewing distance (AU) when flying to an object.
function arrivalDist(id) {
  if (solar.bodies.has(id)) {
    if (moonMissing(id)) return arrivalDist(solar.bodies.get(id).parent);
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
  if (id === 'gal:centre' || id === 'gal:model') return 16 * KPC_AU;
  return rig.dist;
}
// How close the camera may come. Points get a floor where their float32 positions and the render
// passes' near planes still hold: a star is drawn from parsecs (a float32 step is ~0.05 AU at
// Sirius), an asteroid from AU, a galaxy object from kiloparsecs.
function minDistOf(id) {
  if (solar.bodies.has(id)) {
    if (moonMissing(id)) return minDistOf(solar.bodies.get(id).parent);
    return solar.bodies.get(id).radiusKm / AU_KM * 1.12;
  }
  const kind = id.split(':')[0];
  if (kind === 'star') return 100;
  if (kind === 'sb') return 1e-4;
  if (id === 'gal:sun') return minDistOf('sun');     // the galaxy's Sun is the Sun: zoom on in
  if (['gc', 'sat', 'stream', 'arm', 'gal'].includes(kind)) return PC_AU;
  return 2e-7;
}

function flyTo(id, dist, dir) {
  // A moon with no position at this date: fly to its planet (the card says why).
  if (moonMissing(id)) id = solar.bodies.get(id).parent;
  const fn = positionFn(id);
  if (!fn) return;
  rig.flyTo({ id, fn, dist: dist || arrivalDist(id), dir, minDist: minDistOf(id) }, S.jd);
  invalidate();
}
// Turn the view, keeping its target and distance, until a sky-only star is in sight a little to
// the left of the target (it is a direction, so there is nowhere to fly to).
// Far from the Sun, or mid-flight, it flies back to the Sun first, looking past it at the star.
function faceSkyStar(k) {
  const s = stars.direction(k);
  const near = !rig.animating && stars.skyVisible;
  const side = vnorm([], vcross([], s, rig.upAt(near ? rig.dist : 40)));
  const fwd = vnorm([], vadd([], s, vscale([], side, 0.12)));
  if (!near) { flyTo('sun', 40, vscale([], fwd, -1)); return; }
  rig.flyTo({ id: rig.targetId, fn: rig.targetFn, dist: rig.dist, dir: vscale([], fwd, -1), minDist: rig.minDist }, S.jd);
  invalidate();
}
// When the date leaves a followed moon's range (play, scrub, year step), follow its planet from no
// closer than four planet radii, so the camera is not left inside the globe.
function keepMoonTarget() {
  const a = rig.anim;
  if (a && solar.bodies.has(a.to.id) && moonMissing(a.to.id)) { flyTo(solar.bodies.get(a.to.id).parent); return; }
  const id = rig.targetId;
  if (!solar.bodies.has(id) || !moonMissing(id)) return;
  const par = solar.bodies.get(id).parent;
  const d = Math.max(rig.dist, 4 * solar.bodies.get(par).radiusKm / AU_KM);
  rig.setTarget(par, positionFn(par), minDistOf(par));
  rig.dist = d;
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
  // The first and last years that can be shown (the range's ends are midnight TDB, which is the
  // evening before in UTC, so take the years a day inside them).
  const r0 = EPH.dateFromJd(eph.range.jdStart + 1).getUTCFullYear(), r1 = EPH.dateFromJd(eph.range.jdEnd - 1).getUTCFullYear();
  $('t-yprev').disabled = y <= r0; $('t-ynext').disabled = y >= r1;
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
  out.x = W / 2 - shiftX + (x / z) * pxPerRad; out.y = H / 2 - shiftY - (y / z) * pxPerRad; out.z = z;
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

// The view shift that keeps the selected object clear of the card: with the card on the right of a
// wide screen, the middle of the free area to its left, above the dock; with the card along the
// bottom, the middle of the free area between the title and the card (within a limit, for very
// short screens).
function wantedShift() {
  const card = $('card');
  if (card.hidden) return [0, 0];
  const r = card.getBoundingClientRect();
  const top = $('head').getBoundingClientRect().bottom;
  if (r.left > W * 0.4) return [Math.max(0, W / 2 - r.left / 2), clamp(H / 2 - (top + $('dock').getBoundingClientRect().top) / 2, 0, H * 0.36)];
  return [0, clamp(H / 2 - (top + r.top) / 2, 0, H * 0.36)];
}

let candidates = [];
let cardJd = NaN, cardAt = 0;       // the date the open card's figures are for, and when they were written
let cardShownAt = 0;               // when the card last appeared
function frameLoop(t) {
  queued = false;
  const dt = lastT ? Math.min(t - lastT, 100) : 16; lastT = t;
  let moving = rig.step(dt);
  const [wx, wy] = wantedShift();
  if (Math.abs(wx - shiftX) + Math.abs(wy - shiftY) > 0.5) {
    const k = Math.min(1, dt / 90);
    shiftX += (wx - shiftX) * k; shiftY += (wy - shiftY) * k; moving = true;
  } else { shiftX = wx; shiftY = wy; }
  if (S.playing) {
    const next = S.jd + SPEEDS[S.speed].days * dt / 1000;
    if (next >= eph.range.jdEnd - 0.5) { S.playing = false; }
    S.jd = clamp(next, eph.range.jdStart + 0.5, eph.range.jdEnd - 0.5);
    updateTimebar();
    moving = true;
  }
  keepMoonTarget();
  // The open card's distances follow the date: at once after a scrub or a step, four times a second
  // while time plays.
  if (S.selected && !$('card').hidden && S.jd !== cardJd && (!S.playing || performance.now() - cardAt > 250)) refreshCard();
  draw();
  if (moving) invalidate(); else { lastT = 0; saveSoon(); }
}

function placeCamera(cam, pos, target, up, unit) {
  cam.position.set(pos[0] / unit, pos[1] / unit, pos[2] / unit);
  cam.up.set(up[0], up[1], up[2]);
  cam.lookAt(target[0] / unit, target[1] / unit, target[2] / unit);
  cam.updateMatrixWorld(true);
}

const timing = { update: 0, render: 0, labels: 0 };
function draw() {
  const t0 = performance.now();
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
    if (shiftX > 0.5 || shiftY > 0.5) c.setViewOffset(W, H, shiftX, shiftY, W, H); else if (c.view && c.view.enabled) c.clearViewOffset();
  }

  // --- stars (pc) and galaxy (kpc)
  placeCamera(cams.stars, pose.pos, pose.target, pose.up, PC_AU);
  placeCamera(cams.galaxy, pose.pos, pose.target, pose.up, KPC_AU);
  stars.update([pose.pos[0] / PC_AU, pose.pos[1] / PC_AU, pose.pos[2] / PC_AU], dSun / PC_AU, pxRatio, S.layers);
  galaxy.update(dSun / KPC_AU, pxRatio, S.layers);
  // Past the galaxy layer's own Sun marker the Solar System pass has nothing left to add.
  solar.root.visible = galaxy.fade < 0.6;

  const t1 = performance.now();
  renderer.info.reset();
  renderer.clear(true, true, true);
  renderer.render(scenes.stars, cams.stars);
  renderer.render(scenes.galaxy, cams.galaxy);
  renderer.clearDepth();
  if (solar.root.visible) renderer.render(scenes.solar, cams.solar);

  const t2 = performance.now();
  gatherLabels(jd, dSun);
  hud(dSun);
  const t3 = performance.now();
  // Smoothed per-frame costs in ms, for the debug hook (the render figure is only the CPU side of
  // issuing the draw calls; the GPU works asynchronously).
  timing.update += (t1 - t0 - timing.update) * 0.1;
  timing.render += (t2 - t1 - timing.render) * 0.1;
  timing.labels += (t3 - t2 - timing.labels) * 0.1;
}

// ---------------------------------------------------------------- labels and picking
const _p = { x: 0, y: 0, z: 0 };
// Named star k as a point in AU: its place, or for a sky-only star its direction from the camera.
function starPoint(k, out) {
  if (stars.skyOnly(k)) return skyPoint(k);
  out[0] = stars.namedAU[k * 3]; out[1] = stars.namedAU[k * 3 + 1]; out[2] = stars.namedAU[k * 3 + 2];
  return out;
}
function gatherLabels(jd, dSun) {
  candidates = [];
  // Globes big enough to hide things: a label whose point is behind one of them is not shown.
  const discs = [];
  if (solar.root.visible && !solar.far) {
    for (const b of solar.bodies.values()) {
      if (!b.valid || !b.mesh || !b.mesh.visible || !(b.px > 2)) continue;
      const q = project(b.pos, { x: 0, y: 0, z: 0 });
      if (q) discs.push({ key: b.key, x: q.x, y: q.y, z: q.z, r: b.px });
    }
  }
  const hidden = (id, q) => discs.some((d) => d.key !== id && q.z > d.z && (q.x - d.x) ** 2 + (q.y - d.y) ** 2 < d.r * d.r);
  const push = (id, text, p, pri, colour, cls, dy = 0, dx = 0) => {
    const q = project(p, { x: 0, y: 0, z: 0 });
    if (!q || (id !== S.selected && hidden(id, q))) return;
    candidates.push({ id, text, x: q.x + dx, y: q.y + dy, pri: id === S.selected ? 1000 : pri, colour, cls });
  };
  const L = S.layers;
  const solarPx = pxPerRad * 40 / Math.max(dSun, 1e-9);        // how big 40 AU looks from here
  // Solar System
  for (const b of solar.bodies.values()) {
    if (!b.valid || !solar.root.visible || (solar.far && b.key !== 'sun')) continue;
    if (b.kind === 'moon' && (!L.moons || (b.sepPx || 0) < 16)) continue;       // would sit on its planet
    if (b.key === 'sun' && galaxy.fade > 0.25) continue;                        // the galaxy layer labels it
    if (b.key !== 'sun' && solarPx < (b.kind === 'planet' || b.kind === 'dwarf' ? 18 : 60)) continue;
    const pri = b.key === 'sun' ? 100 : b.key === 'earth' ? 96 : b.kind === 'planet' ? 90 : b.kind === 'dwarf' ? 70 : 55;
    // A globe more than a few pixels across gets its label above the disc, not across it.
    // The Sun's label steps aside so its glow shows.
    const dx = b.key === 'sun' && b.px <= 10 ? 16 : 0;
    push(b.key, b.name, b.pos, pri, b.ui, b.kind === 'moon' ? 'minor' : '', b.px > 10 ? -(b.px + 14) : 0, dx);
  }
  // Small bodies: dwarf planets and comets in the overview; the named near-Earth asteroids and the
  // rest once the view is down to the inner system.
  if (L.small && small && solarPx > 40) {
    const inner = pose.dist < 4;
    for (const i of small.labelled) {
      const k = small.kind(i);
      if (!(k === 'dwarf' || k === 'comet' || k === 'interstellar' || inner || `sb:${i}` === S.selected)) continue;
      push(`sb:${i}`, small.name(i), smallPos(i, jd), k === 'dwarf' ? 62 : 34, '#cfd7e2', k === 'dwarf' ? 'minor' : 'faint');
    }
  }
  // Stars: the brightest as seen from here, more of them the farther out the camera is.
  if (L.stars) {
    const camPc = [pose.pos[0] / PC_AU, pose.pos[1] / PC_AU, pose.pos[2] / PC_AU];
    const maxN = dSun < 2e4 ? 10 : dSun < 1e8 ? 16 : 0;
    let n = 0;
    if (maxN) {
      // The brightest stars as seen from the camera, among those actually on screen.
      const best = [], q = { x: 0, y: 0, z: 0 }, p = [0, 0, 0];
      const inSolar = dSun < 2e4;
      for (const k of stars.labelOrder) {
        if (stars.skyOnly(k) && !stars.skyVisible) continue;
        if (inSolar && (!stars.named.name[k] || !(stars.named.vmag[k] <= 1.5))) continue;   // from among the planets, only the brightest
        if (!project(starPoint(k, p), q) || q.x < 0 || q.x > W || q.y < 0 || q.y > H) continue;
        const m = stars.apparentMag(k, camPc);
        if (Number.isFinite(m)) best.push([m, k]);        // no magnitude: not drawn as a star
      }
      best.sort((a, b) => a[0] - b[0]);
      for (const [m, k] of best) {
        if (n >= maxN) break;
        push(`star:${k}`, stars.label(k), starPoint(k, [0, 0, 0]), 30 - m, '#bcd4ff', inSolar ? 'faint' : m < 1.5 ? '' : 'minor');
        n++;
      }
    }
  }
  // Galaxy
  if (galaxy.fade > 0.25) {
    push('gal:sun', 'Sun', galaxy.toAU(galaxy.sun), 95, '#ffe2a8', '');
    push('gal:centre', 'Galactic centre', galaxy.toAU([0, 0, 0]), 80, '#ffffff', '');
    if (L.reid || L.drimmel) galaxy.armLabels.forEach((a, i) => { if (L[a.layer]) push(`arm:${i}`, labelOf(`arm:${i}`), galaxy.toAU(a.p), 45, a.colour, 'faint'); });
    // The disc-and-bar glow is a model, and the brightest thing here: it is labelled as one.
    const mp = L.model && modelLabelPoint();
    if (mp) push('gal:model', nameOf('gal:model'), galaxy.toAU(mp), 42, '#e6cfa8', 'faint');
    if (L.satellites) galaxy.satellites.forEach((o, i) => { if (Number.isFinite(o.mv) && o.mv < -8.5) push(`sat:${i}`, o.name, galaxy.toAU(o.xyz), 40 - o.mv * 0.5, '#ff8fa3', 'minor'); });
    if (L.globulars) galaxy.globulars.forEach((o, i) => { if (Number.isFinite(o.mv) && o.mv < -9.3) push(`gc:${i}`, o.name, galaxy.toAU(o.xyz), 30 - o.mv * 0.3, '#ffd27a', 'minor'); });
  }
  if (S.selected && !candidates.some((c) => c.id === S.selected)) {
    const sel = S.selected;
    if (isSkyStar(sel)) { if (stars.skyVisible) push(sel, nameOf(sel), skyPoint(+sel.split(':')[1]), 1000, '#f2c56f', ''); }
    else if (!moonMissing(sel, jd)) { const fn = positionFn(sel); if (fn) push(sel, labelOf(sel), fn(jd), 1000, '#f2c56f', ''); }
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
  for (const b of solar.bodies.values()) {
    if (!b.valid || (b.kind === 'moon' && !S.layers.moons) || (solar.far && b.key !== 'sun')) continue;
    consider(b.key, b.pos, 20, b.px || 0);
  }
  const dSun = vlen(pose.pos);
  if (S.layers.small && dSun < 2e4) {
    const buf = new Float32Array(small.count * 3); small.positionsAt(jd, buf);
    for (let i = 0; i < small.count; i++) consider(`sb:${i}`, [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]], 0);
  }
  if (S.layers.stars) {
    const camPc = [pose.pos[0] / PC_AU, pose.pos[1] / PC_AU, pose.pos[2] / PC_AU];
    const mMax = 8 + Math.log10(Math.max(1, dSun / PC_AU)) * 3;
    for (let k = 0; k < stars.namedCount; k++) {
      const m = stars.apparentMag(k, camPc);
      if (stars.skyOnly(k)) {
        if (stars.skyVisible && m <= mMax) consider(`star:${k}`, skyPoint(k), 4 - m * 0.5);
        continue;
      }
      // Faded out once the camera leaves the catalogue behind: nothing to tap where nothing is drawn.
      if (!stars.namedPts.visible || stars.namedPts.material.uniforms.uOpacity.value < 0.15) continue;
      if (!Number.isFinite(m)) {
        // No magnitude, so not drawn as a star: only an exoplanet host's ring marker, while shown.
        if (stars.hosts.visible && stars.exo[k]) consider(`star:${k}`, starPoint(k, [0, 0, 0]), 2);
        continue;
      }
      if (m > mMax) continue;
      consider(`star:${k}`, starPoint(k, [0, 0, 0]), 4 - m * 0.5);
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
    const b = solar.bodies.get(id), p = b.phys, notes = [];
    // Null for a fitted moon outside 1950–2050: then no distances, only what does not change.
    const pos = solar.positionOf(id, jd, [0, 0, 0]);
    out.kind = b.kind === 'star' ? 'Star' : b.kind === 'planet' ? 'Planet' : b.kind === 'dwarf' ? 'Dwarf planet' : `Moon of ${solar.bodies.get(b.parent).name}`;
    if (pos) {
      const dE = Math.hypot(pos[0] - earth[0], pos[1] - earth[1], pos[2] - earth[2]);
      if (id !== 'sun') add('From the Sun', `${fmtAU(vlen(pos))}`);
      if (id !== 'earth') add('From the Earth', `${fmtAU(dE)} · ${fmtLightTime(dE)}`);
      // (The Moon's planet is the Earth, given just above.)
      if (b.kind === 'moon' && b.parent !== 'earth') { const par = solar.positionOf(b.parent, jd, [0, 0, 0]); add(`From ${solar.bodies.get(b.parent).name}`, `${fmt(Math.hypot(pos[0] - par[0], pos[1] - par[1], pos[2] - par[2]) * AU_KM)} km`); }
    }
    const r = b.radii, triaxial = r[0] !== r[1];
    const dp = r.slice(0, 3).some((v) => !Number.isInteger(v)) ? 1 : 0;
    const km = (v) => fmt(v, dp);      // the three semi-axes, as catalogued, at one precision
    add(triaxial ? 'Radii' : 'Radius', r[0] === r[2] ? `${sig(r[0], 4)} km` : triaxial ? `${km(r[0])} × ${km(r[1])} × ${km(r[2])} km` : `${sig(r[0], 5)} km equator, ${sig(r[2], 5)} km pole`);
    // Retrograde relative to its own orbit: the tilt already carries the sense of rotation.
    if (p.sidereal_rotation_h) add('Rotation', `${fmtDays(Math.abs(p.sidereal_rotation_h) / 24)}${p.obliquity_deg > 90 ? ', retrograde' : ''}`);
    if (Number.isFinite(p.obliquity_deg)) add('Axial tilt', `${fmt(p.obliquity_deg, 2)}°`);
    const o = solar.orbits.get(id);
    if (o && o.el && id !== 'moon') add('Orbital period', fmtDays(o.el.period));
    const colour = textures.colours && textures.colours[id];
    if (id === 'venus' && !S.layers.venusRadar) out.src = 'Surface: none drawn — a plain disc, as no colour data could be sourced; the Magellan radar map is an optional layer.';
    else if (b.meta) out.src = `Surface: ${b.meta.note || b.meta.source_id}`;
    else if (colour) out.src = `Colour: ${colour.note || colour.source}`;
    else if (b.kind === 'moon') out.src = 'Surface: no map or colour could be sourced; drawn neutral grey';
    if (id === 'venus') notes.push(S.layers.venusRadar ? 'Shown with the Magellan radar map of the surface, which no eye can see through the clouds.' : 'Its visible face is a featureless cloud deck.');
    if (id === 'pluto') notes.push('Drawn at the Pluto–Charon barycentre from JPL DE430. Pluto itself circles that point every 6.39 days, about 2,100 km away; Charon is not shown because no long-term ephemeris for it could be sourced.');
    if (b.kind === 'moon' && id !== 'moon') notes.push(pos ? 'Position from JPL satellite ephemerides, fitted in windows of weeks to months (see About).' : `${b.name}’s position is available from 1950 to 2050 only, so it is not shown at this date.`);
    if (triaxial && !rotation.has(id)) notes.push('It has no rotation model in the data (pck00011), so its orientation is not modelled: it is drawn as a sphere of its mean radius.');
    out.note = notes.join(' ');
    out.orbit = false;
  } else {
    const [kind, raw] = id.split(':'); const i = +raw;
    if (kind === 'sb') {
      const info = (small.info && small.info(i)) || {};
      out.kind = small.kindLabel(i);
      const p = smallPos(i, jd);
      add('From the Sun', fmtAU(vlen(p)));
      add('From the Earth', fmtAU(Math.hypot(p[0] - earth[0], p[1] - earth[1], p[2] - earth[2])));
      const el = small.elements(i);
      if (el.e < 1) {
        add('Orbit', `${sig(el.q)}–${sig(el.a * (1 + el.e))} AU from the Sun`);
        add('Period', fmtDays(el.period));
      } else add('Orbit', `open (e ${fmt(el.e, 3)}): passes the Sun once`);
      if (Number.isFinite(info.diameter_km)) add('Diameter', `${sig(info.diameter_km)} km`);
      if (Number.isFinite(info.H)) add('Absolute magnitude', `H ${fmt(info.H, 1)}`);
      out.src = info.source || '';
      // The dwarf-planet grouping note is long and belongs in About, not on a phone card.
      out.note = (info.note || '').replace(small.meta.dwarf_note || '\u0000', '').trim();
      out.orbit = true;
    } else if (kind === 'star') {
      const n = stars.named, notes = [];
      const sky = stars.skyOnly(i);           // no usable parallax: a direction only
      out.kind = n.flags[i] & 2 ? 'White dwarf' : 'Star';
      if (sky) { add('Distance', 'unknown (no usable parallax)'); out.go = false; }
      else { const dpc = Math.hypot(n.x[i], n.y[i], n.z[i]); add('Distance', `${sig(dpc * PC_AU / LY_AU)} light-years (${sig(dpc)} pc)`); }
      if (n.desig[i] && n.name[i]) add('Designation', n.desig[i]);
      add('Catalogue', n.id[i]);
      if (Number.isFinite(n.vmag[i])) add('Brightness from Earth', `V ${fmt(n.vmag[i], 2)}`);
      if (Number.isFinite(n.absmag[i])) add('Absolute magnitude', `${fmt(n.absmag[i], 2)}`);
      if (n.spect[i]) add('Spectral type', n.spect[i]);
      if (!sky) add('Distance from', stars.distSource(i));
      const pl = stars.planets(i);
      if (pl && pl.length) out.planets = pl;
      if (n.flags[i] & 4) notes.push('A companion placed at its primary star’s distance.');
      if (sky) notes.push('Not placed in 3D: with no usable parallax it is drawn only on the sky as seen from near the Sun, with the figure lines that join it.');
      else if (n.flags[i] & 8) notes.push('Parallax only 5–10× its error: the distance is uncertain.');
      else if (n.flags[i] & 64) notes.push('No independent parallax error was available to check this distance against.');
      out.note = notes.join(' ');
    } else if (kind === 'gc' || kind === 'sat') {
      const o = kind === 'gc' ? galaxy.globulars[i] : galaxy.satellites[i];
      const candidate = kind === 'sat' && o.galaxy_confirmed === false;
      out.kind = kind === 'gc' ? 'Globular cluster' : candidate ? 'Satellite · galaxy candidate' : 'Satellite galaxy';
      add('Distance', `${sig(o.dist_kpc * 1000 * PC_AU / LY_AU / 1000)} thousand light-years (${sig(o.dist_kpc)} kpc)`);
      add('From the Galactic centre', `${sig(Math.hypot(...o.xyz))} kpc`);
      if (Number.isFinite(o.mv)) add('Absolute magnitude', `M_V ${fmt(o.mv, 1)}`);
      if (Number.isFinite(o.rhalf_pc)) add('Half-light radius', `${sig(o.rhalf_pc)} pc`);
      if (candidate) out.note = 'The Local Volume Database has not confirmed it as a galaxy: it could still be a star cluster.';
      out.src = o.ref ? `Distance: ${o.ref}` : '';
    } else if (kind === 'stream') {
      const s = galaxy.streams[i];
      out.kind = 'Stellar stream';
      const ds = s.points.map((p) => Math.hypot(...p));
      add('From the Galactic centre', `${sig(Math.min(...ds))}–${sig(Math.max(...ds))} kpc`);
      add('Track', galaxy.data.streamApproximate(i) ? 'approximate' : 'measured path and distances');
      out.note = s.note || '';
      out.src = s.ref || '';
    } else if (kind === 'arm') {
      const a = galaxy.armLabels[i];
      out.kind = a.layer === 'reid' ? 'Spiral-arm fit · masers' : 'Spiral-arm fit · Cepheids';
      out.note = a.src.note || (a.layer === 'reid' ? 'A log-spiral fitted to maser parallaxes (Reid et al. 2019), drawn only over the range the fit covers. A fit, not a picture.' : 'A spiral fitted to classical Cepheids (Drimmel et al. 2024). It sits about 0.9 kpc from the maser fit near the Sun — two models, both shown.');
    } else if (id === 'gal:sun') {
      out.kind = 'Our star'; add('From the Galactic centre', `${fmt(Math.hypot(...galaxy.sun), 3)} kpc`); out.src = (galaxy.g.frame.refs || []).join('; ');
    } else if (id === 'gal:centre') {
      // The frame's origin, in the direction of Galactic l = b = 0: not the radio source Sgr A*,
      // which the data does not place (tools/CONTRACT.md, Frame).
      out.kind = 'Origin of the galaxy frame'; add('From the Sun', `${fmt(galaxy.g.frame.r0_kpc, 3)} kpc`); out.src = (galaxy.g.frame.refs || []).join('; ');
      out.note = `The centre of the frame this view is drawn in (${galaxy.g.frame.name || 'Galactocentric'}), in the direction of Galactic longitude and latitude 0.`;
    } else if (id === 'gal:model') {
      const m = galaxy.g.model;
      out.kind = 'Mass model · not a picture'; out.note = m.what || ''; out.src = (m.refs || []).join('; ');
    }
  }
  return out;
}

// The card's date-dependent parts: the figures, the note and the source line.
function fillCard(f) {
  $('card-facts').innerHTML = f.rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('');
  $('card-note').textContent = f.note || '';
  $('card-src').textContent = f.src || '';
  cardJd = S.jd; cardAt = performance.now();
}
function refreshCard() { if (S.selected) fillCard(facts(S.selected)); }

function select(id) {
  S.selected = id;
  const card = $('card');
  if (!id) { card.hidden = true; if (solar) solar.showSmallOrbit(-1); invalidate(); return; }
  const f = facts(id);
  $('card-kind').textContent = f.kind;
  $('card-name').textContent = f.name;
  fillCard(f);
  const pl = $('card-planets');
  pl.hidden = !f.planets;
  pl.innerHTML = f.planets ? f.planets.map((p) => `<li><span>${escapeHtml(p.name)}</span><span class="d">${[p.period_d ? `orbit ${fmtDays(p.period_d)}` : '', p.method || '', p.year ? `found ${p.year}` : ''].filter(Boolean).join(' · ')}</span></li>`).join('') : '';
  $('card-go').hidden = f.go === false;
  $('card-orbit').hidden = !f.orbit || !S.layers.small;      // no orbit to draw while the layer is off
  $('card-orbit').textContent = solar.smallOrbitIdx === +id.split(':')[1] && id.startsWith('sb:') ? 'Hide orbit' : 'Show orbit';
  if (card.hidden) cardShownAt = performance.now();
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
  // Nothing out among the stars depends on the date, and the pause button goes with the time bar:
  // playing on would only move the date unseen and keep redrawing the galaxy.
  if (!showTime && S.playing) { S.playing = false; updateTimebar(); }
  const tid = rig.targetId;
  const name = tid === 'flight' ? '' : tid === 'point' ? '' : nameOf(tid);
  $('sub').textContent = sc === 'solar' ? (name && tid !== 'sun' ? `${name} · ${$('t-date').textContent}` : `Solar System · ${$('t-date').textContent}`)
    : sc === 'stars' ? (name && tid !== 'sun' ? `${name} · the Sun's neighbourhood` : 'The Sun’s neighbourhood') : (name && tid !== 'gal:centre' ? `${name} · our galaxy` : 'Our galaxy: measurements and models');
}

// ---------------------------------------------------------------- sheets: layers, search, about
const count = (list, f) => [...list].filter(f).length;
const LAYER_DOC = () => [
  ['Solar System', [
    ['orbits', 'Orbits', 'Each planet’s orbit at the current date'],
    ['trails', 'Trails', 'The real path over the last part of each orbit'],
    ['moons', 'Moons', `The Moon (1900–2100) and ${count(solar.bodies.values(), (b) => b.kind === 'moon' && b.parent !== 'earth')} moons fitted to JPL ephemerides (1950–2050)`],
    ['small', 'Asteroids and comets', `${fmt(small.count)} objects · JPL and Minor Planet Center orbits`],
    ['venusRadar', 'Venus radar surface', 'Magellan radar instead of a plain disc'],
  ]],
  ['Stars', [
    ['stars', 'Stars', `${fmt(stars.drawnCount)} stars in 3D, most within 500 pc`],
    ['constellations', 'Constellation figures', `${stars.constellations.length} IAU constellations, drawn in 3D`],
    ['exoplanets', 'Exoplanet hosts', `${fmt(Object.keys(stars.exo).length)} stars with confirmed planets`],
    ['sky', 'The Milky Way sky', 'Gaia DR3 star counts, as seen from the Sun'],
  ]],
  ['Milky Way', [
    ['globulars', 'Globular clusters', `${galaxy.globulars.length} clusters at measured distances`],
    ['satellites', 'Satellite galaxies', `${count(galaxy.satellites, (o) => o.galaxy_confirmed !== false)} confirmed galaxies and ${count(galaxy.satellites, (o) => o.galaxy_confirmed === false)} candidates at measured distances`],
    ['streams', 'Stellar streams', `${galaxy.streams.length} streams (${count(galaxy.streams, (o, i) => !galaxy.data.streamApproximate(i))} measured tracks, ${count(galaxy.streams, (o, i) => galaxy.data.streamApproximate(i))} approximate)`],
    ['young', 'Young stars · Gaia EDR3', 'Poggio et al. 2021 — where young stars crowd, within ~4 kpc'],
    ['youngOB', 'OB stars · Gaia DR3', 'Drimmel et al. 2023 — streaked by distance errors'],
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
    S.layers[k] = e.target.checked; store.set('layers', S.layers);
    if (S.selected && !$('card').hidden) refreshCard();      // the Venus card says which surface is on
    invalidate();
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
// Bayer letters spelled out, as a phone keyboard types them: 'α¹ Cen' is also 'alpha1', 'alpha'.
const GREEK = {
  α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu',
  ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega',
};
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function spellBayer(desig) {
  const m = /^([α-ω])([⁰¹²³⁴-⁹]*)\s/.exec(desig || '');
  const w = m && GREEK[m[1]];
  if (!w) return '';
  const d = [...m[2]].map((c) => SUPERSCRIPT.indexOf(c)).join('');
  return d ? `${w}${d} ${w}` : w;
}
function buildSearch() {
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tokens = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const names = (v) => (Array.isArray(v) ? v.join(' ') : v || '');      // LVDB other names, where given
  const conName = Object.fromEntries(stars.constellations.map((c) => [c.abbr, c.name]));
  searchIndex = [];
  for (const b of solar.bodies.values()) searchIndex.push({ id: b.key, text: b.name, kind: b.kind === 'moon' ? `Moon of ${solar.bodies.get(b.parent).name}` : b.kind === 'star' ? 'Star' : b.kind === 'dwarf' ? 'Dwarf planet' : 'Planet', pri: 3 });
  for (let i = 0; i < small.count; i++) searchIndex.push({ id: `sb:${i}`, text: small.name(i), kind: small.kindLabel ? small.kindLabel(i) : small.kind(i), pri: (small.labelled || []).includes(i) ? 2 : 0 });
  const n = stars.named;
  for (let k = 0; k < stars.namedCount; k++) {
    const t = [n.name[k], n.desig[k], n.id[k]].filter(Boolean);
    const con = n.con ? n.con[k] : '';
    searchIndex.push({ id: `star:${k}`, text: t[0], alt: t.slice(1).join(' · '), kind: 'Star', pri: n.name[k] ? 2 : 1, extra: [spellBayer(n.desig[k]), con, conName[con]].filter(Boolean).join(' '), abbr: con });
  }
  galaxy.globulars.forEach((o, i) => searchIndex.push({ id: `gc:${i}`, text: o.name, kind: 'Globular cluster', pri: 1, extra: `${o.key} ${names(o.other_names)}` }));
  galaxy.satellites.forEach((o, i) => searchIndex.push({ id: `sat:${i}`, text: o.name, kind: o.galaxy_confirmed === false ? 'Satellite · galaxy candidate' : 'Satellite galaxy', pri: 2, extra: `${o.key} ${names(o.other_names)}` }));
  galaxy.streams.forEach((o, i) => searchIndex.push({ id: `stream:${i}`, text: o.name, kind: 'Stellar stream', pri: 1 }));
  galaxy.armLabels.forEach((a, i) => searchIndex.push({ id: `arm:${i}`, text: a.name, kind: a.layer === 'reid' ? 'Spiral-arm fit · masers' : 'Spiral-arm fit · Cepheids', pri: 1, extra: a.layer === 'reid' ? 'fit masers Reid' : 'fit Cepheids Drimmel' }));
  searchIndex.push({ id: 'gal:centre', text: 'Galactic centre', kind: 'Milky Way', pri: 2, extra: 'center' });
  if (modelLabelPoint()) searchIndex.push({ id: 'gal:model', text: nameOf('gal:model'), kind: 'Mass model', pri: 1, extra: 'disk McMillan Portail' });
  for (const e of searchIndex) { e.f = fold(e.text); e.toks = tokens([e.text, e.alt, e.extra].filter(Boolean).join(' ')); e.abbr = e.abbr ? tokens(e.abbr)[0] : ''; }
  const q = $('search-q'), res = $('search-res');
  // Every word typed must match a word of the entry: the start of it ('sir' → Sirius), or — for the
  // Latin genitives no index holds — a star's constellation abbreviation may start the word typed
  // ('centauri' ← 'Cen', 'ceti' ← 'Cet').
  // Ranked: the name itself starts with what was typed; every word matched forward; the rest.
  const run = () => {
    const s = fold(q.value.trim()), qt = tokens(q.value);
    if (!qt.length) { res.innerHTML = ''; return; }
    const hits = [];
    for (const e of searchIndex) {
      let rank = e.f.startsWith(s) ? 0 : 1;
      for (const t of qt) {
        let m = 0;
        for (const u of e.toks) { if (u.startsWith(t)) { m = 2; break; } }
        if (!m && e.abbr && t.startsWith(e.abbr)) m = 1;
        if (!m) { rank = -1; break; }
        if (m === 1 && rank) rank = 2;
      }
      if (rank >= 0) hits.push([rank, -e.pri, e.text.length, e]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    res.innerHTML = hits.length ? hits.slice(0, 40).map(([, , , e]) => `<li data-id="${escapeHtml(e.id)}"><span>${escapeHtml(e.text)}${e.alt ? ` <span class="k">${escapeHtml(e.alt)}</span>` : ''}</span><span class="k">${escapeHtml(e.kind)}</span></li>`).join('') : '<li class="empty">No match. Names here are the catalogues’ own, such as “LMC” or “NGC 5139”.</li>';
  };
  q.addEventListener('input', run);
  res.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]'); if (!li) return;
    const id = li.dataset.id;
    closeSheets(); select(id);
    if (isSkyStar(id)) faceSkyStar(+id.split(':')[1]); else flyTo(id);
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
  // The tap that opened the card is followed by a synthesized click at the same spot, which can land
  // on the close button's enlarged hit area as the card appears: ignore clicks that early.
  $('card-close').addEventListener('click', () => { if (performance.now() - cardShownAt > 450) select(null); });
  $('card-go').addEventListener('click', () => { if (S.selected) flyTo(S.selected); });
  $('card-orbit').addEventListener('click', () => {
    if (!S.selected || !S.selected.startsWith('sb:')) return;
    const i = +S.selected.split(':')[1];
    if (solar.smallOrbitIdx === i) solar.showSmallOrbit(-1); else solar.showSmallOrbit(i, S.jd);
    select(S.selected);
  });
  // Labels take no pointer events (a drag or pinch that starts on one must still turn the view):
  // a tap on a label's box selects its object, before anything near the point is considered.
  const labelAt = (x, y) => { const p = labels.placed.find(({ box: b }) => x >= b[0] - 2 && x <= b[2] + 2 && y >= b[1] - 2 && y <= b[3] + 2); return p ? p.id : null; };
  rig.on('tap', (x, y) => { const id = labelAt(x, y) || pick(x, y); select(id); });
  rig.on('doubletap', (x, y) => { const id = labelAt(x, y) || pick(x, y); if (id) { select(id); flyTo(id); } else { rig.vel.zoom = -0.004; invalidate(); } });
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
  const finite = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
  // The saved target must still exist in this build's data (a row index past the end of a rebuilt
  // catalogue would leave the camera at NaN) and have a position.
  const valid = (id) => {
    if (!id || !(solar.bodies.has(id) || /^(sb|star|gc|sat|stream|arm):\d+$/.test(id) || id === 'gal:sun' || id === 'gal:centre' || id === 'gal:model')) return false;
    const [kind, raw] = id.split(':'); const i = +raw;
    if ((kind === 'sb' && !(i < small.count)) || (kind === 'star' && !(i < stars.namedCount))) return false;
    const fn = positionFn(id);
    return !!fn && finite(fn(S.jd), 3);
  };
  const dirOk = c && finite(c.dir, 3) && vlen(c.dir) > 0 && c.dist > 0 && Number.isFinite(c.dist);
  if (dirOk && valid(c.id)) {
    rig.setTarget(c.id, positionFn(c.id), minDistOf(c.id)); rig.dist = Math.max(c.dist, rig.minDist); rig.dir = vnorm([], c.dir);
  } else if (dirOk && finite(c.point, 3)) {
    const p = c.point.slice(); rig.setTarget('point', () => p); rig.dist = c.dist; rig.dir = vnorm([], c.dir);
  } else {
    rig.setTarget('sun', positionFn('sun'), minDistOf('sun'));
    rig.dist = 7.5; rig.dir = elevated(rig.eclUp, 48, [0.35, -0.9, 0.2]);
  }
}

(async function main() {
  try {
    createRenderer();
  } catch (e) { fail(e, 'Could not start: this device did not provide 3D graphics (WebGL 2) just now. Close other apps and open Milky Way again.'); return; }
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
    timing: () => ({ ...timing }),
    stats: () => ({ ...renderer.info.render, programs: renderer.info.programs.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
  };
})();
