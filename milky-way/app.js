// Milky Way: the Solar System, the stars around the Sun and the galaxy in one continuous 3D zoom,
// from real data only, offline. The look is ART.md under the template's house system.
//
// This file wires the pieces together (NOTES.md has the map) and draws a frame only when something
// changed. Three render passes share one camera pose, each in its own units, so float32 never holds
// a kilometer and a kiloparsec in one number: the stars (pc), the galaxy (kpc), then, after a depth
// clear, the Solar System around a floating origin at the camera's target.

import * as THREE from './vendor/three.module.js';
import {
  $, $$, clamp, store, escapeHtml, AU_KM, PC_AU, KPC_AU, DEG, vnorm, vdot, vcross, vscale, vadd, vsub, vlen, getJSON, getBin,
} from './js/util.js';
import { Rig } from './js/view.js';
import * as EPH from './js/ephem.js';
import * as ROT from './js/rotation.js';
import * as SB from './js/smallbodies.js';
import { SolarSystem } from './js/solar.js';
import { Stars } from './js/stars.js';
import { Galaxy } from './js/galaxy.js';
import { Labels } from './js/labels.js';
import { loadTexture, lineUniforms } from './js/gfx.js';
import * as U from './js/units.js';
import { createTrack } from './js/track.js';
import { createReach } from './js/rule.js';
import { PLATE } from './js/plate.js';

const DATA = 'data/';
// The credit line on screen in every mode; every source and license is in About.
const CREDITS = 'NASA/JPL, USGS, ESA/Gaia/DPAC, AT-HYG, LVDB, galstreams, Stellarium';
const NN = U.NNBSP;
const RM = matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- state
const DEFAULT_LAYERS = {
  orbits: true, trails: true, moons: true, small: true, venusRadar: false,
  stars: true, constellations: true, exoplanets: true, sky: true,
  model: true, young: true, youngOB: false, reid: true, drimmel: true, globulars: true, satellites: true, streams: true, grid: true,
  labels: true,
};
// Play speeds as exposures: one second of play is this much time.
const SPEEDS = [[1 / 24, '1', 'h', '1 hour'], [1, '1', 'd', '1 day'], [7, '7', 'd', '7 days'], [30.436875, '30.4', 'd', '30.4 days'], [365.25, '365.25', 'd', '365.25 days']]
  .map(([days, n, u, said]) => ({ days, label: `1${NN}s = ${U.withUnit(n, u)}`, said: `${said} a second` }));
const S = {
  layers: Object.assign({}, DEFAULT_LAYERS, store.get('layers', {})),
  speed: clamp(store.get('speed', 2), 0, SPEEDS.length - 1),
  focus: store.get('focus', false) === true,
  playing: false,
  jd: NaN,
  selected: null,
  sheet: null,
  shown: 0,          // the day of the shown year the last frame drew
};

// ---------------------------------------------------------------- renderer
const canvas = $('gl');
const scenes = { solar: new THREE.Scene(), stars: new THREE.Scene(), galaxy: new THREE.Scene() };
const cams = {
  solar: new THREE.PerspectiveCamera(50, 1, 1e-3, 1e10),
  stars: new THREE.PerspectiveCamera(50, 1, 1e-9, 1e8),
  galaxy: new THREE.PerspectiveCamera(50, 1, 1e-9, 1e6),
};
// Made in main(), inside its try: a web view that refuses a WebGL context then shows a sentence.
let renderer, rig, labels, track, reach;
function createRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.autoClear = false;
  renderer.info.autoReset = false;      // three passes per frame: count them all
  renderer.setClearColor(0x020308, 1);
  // Rendering is on demand: after iOS drops and restores the context nothing would redraw.
  canvas.addEventListener('webglcontextrestored', () => { resize(); invalidate(); });
  rig = new Rig(canvas);
  labels = new Labels($('labels'));
}

let eph, rotation, phys, small, solar, stars, galaxy, textures, about, skyMeta;
let pose = null, pxPerRad = 1, heldPx = 0, W = 0, H = 1;
let shiftX = 0, shiftY = 0;         // the view shift: wantedShift()

// ---------------------------------------------------------------- loading: the stamp counts
const progress = (i, msg) => { $('stamp').textContent = `${msg}… ${i} of 6`; };
function fail(err, msg) {
  console.error(err);
  const m = String(err && err.message || err).replace(/^(\S+): HTTP (\d+)$/, '$1 could not be read (HTTP $2)');
  $('notice').textContent = msg || `${m}. The app’s files are incomplete: install its ZIP again.`;
  $('notice').hidden = false;
  $('stamp').textContent = 'The sky could not be read';
  $('stamp').inert = true;         // About is built from the data: no key to it now (the notice says why)
  for (const id of ['scales', 'keys', 'player']) $(id).hidden = true;
}

let staticLogs = [], starNear = Infinity, farthest = 0;
// The least and the most of a long list (a spread of 220 000 values would overflow the call stack).
const extent = (a) => { let lo = Infinity, hi = -Infinity; for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; };
async function load() {
  progress(1, 'Reading the ephemeris');
  phys = await getJSON(DATA + 'physical.json');
  if (!phys.constants || Math.abs(phys.constants.au_km - AU_KM) > 1e-3) throw new Error('data/physical.json gives an astronomical unit that does not match the app’s');
  eph = await EPH.loadEphemeris(DATA, phys);
  rotation = await ROT.loadRotation(DATA, phys);
  progress(2, 'Reading asteroid and comet orbits');
  small = await SB.loadSmallBodies(DATA);
  progress(3, 'Reading the planets’ maps');
  textures = await getJSON(DATA + 'tex/textures.json');
  const tex = {};
  // Only the maps something draws: a globe in physical.json, or the Earth's night side.
  const entries = Object.entries(textures.bodies).filter(([k]) => phys.bodies[k] || k === 'earth_night');
  await Promise.all(entries.map(async ([k, t]) => { tex[k] = await loadTexture(DATA + 'tex/' + t.file); }));
  progress(4, 'Reading the stars');
  const [deepBuf, deepMeta, named, color, constellations, exoplanets] = await Promise.all([
    getBin(DATA + 'stars/deep.bin'), getJSON(DATA + 'stars/deep.json'), getJSON(DATA + 'stars/named.json'),
    getJSON(DATA + 'stars/colour.json'), getJSON(DATA + 'stars/constellations.json'), getJSON(DATA + 'stars/exoplanets.json'),
  ]);
  progress(5, 'Reading the Milky Way');
  skyMeta = await getJSON(DATA + 'sky/sky.json');
  const skyTex = await loadTexture(DATA + 'sky/' + (skyMeta.file || 'gaia-dr3-counts.jpg'));
  skyTex.wrapS = THREE.RepeatWrapping;
  const g = await getJSON(DATA + 'galaxy/galaxy.json');
  const gtex = { young: {} };
  if (g.model && g.model.file) gtex.model = await loadTexture(DATA + g.model.file);
  if (g.young && g.young.files) for (const [k, f] of Object.entries(g.young.files)) gtex.young[k] = await loadTexture(DATA + f.file);
  about = await getJSON(DATA + 'about.json').catch(() => null);
  progress(6, 'Building the scene');

  solar = new SolarSystem({ eph, rotation, phys, tex, textures, small });
  stars = new Stars({ deepBuf, deepMeta, named, color, constellations, exoplanets, skyTex, sky: skyMeta });
  galaxy = new Galaxy({ g, tex: gtex });
  scenes.solar.add(solar.root);
  scenes.stars.add(stars.root);
  scenes.galaxy.add(galaxy.root);
  if (tex.venus_radar || tex.venus) solar.venusRadarTex = tex.venus_radar || tex.venus;

  // The Reach's census of what lies beyond the planets, once: every star placed in 3D (the named ones
  // with a parallax, the deep catalog as int16 pc × 64), the clusters, the satellites, the streams.
  const L = (au) => Math.log10(au);
  const st = [];
  for (let k = 0; k < named.count; k++) if (!(named.flags[k] & 16)) st.push(L(Math.hypot(named.x[k], named.y[k], named.z[k]) * PC_AU));
  const dv = new DataView(deepBuf);
  for (let o = 0; o + 8 <= dv.byteLength; o += 8) st.push(L(Math.hypot(dv.getInt16(o, true), dv.getInt16(o + 2, true), dv.getInt16(o + 4, true)) / 64 * PC_AU));
  starNear = 10 ** extent(st)[0];
  const sun = g.frame.sun_kpc;
  staticLogs = [st, [...g.globulars, ...g.satellites].map((o) => L(o.dist_kpc * KPC_AU)),
    g.streams.flatMap((s) => s.points.map((p) => L(vlen(vsub([], p, sun)) * KPC_AU)))];

  // The ecliptic pole from the J2000 obliquity; the galactic pole from the galaxy frame's z axis.
  const eps = phys.constants.obliquity_j2000_arcsec / 3600 * DEG;
  const M = galaxy.data.toIcrsMatrix;
  rig.setFrames([0, -Math.sin(eps), Math.cos(eps)], [M[2], M[6], M[10]]);
  rig.jdNow = () => S.jd;
}

// The solar part of the census on the day shown: the planets, the Moon, the moons whose fits cover
// the date, the asteroids and comets. Computed again whenever a frame draws another day (the small
// bodies' positions are the frame's own when it has just placed them).
let censusDay = NaN, censusJd = NaN, solarLogs = [];
function solarCensus() {
  if (y0 + S.shown === censusDay) return;
  censusDay = y0 + S.shown; censusJd = S.jd;
  const out = [], p = [0, 0, 0];
  for (const id of solar.bodies.keys()) if (id !== 'sun' && solar.positionOf(id, S.jd, p)) out.push(vlen(p));
  const buf = solar._smallJd === S.jd ? solar.smallPos : small.positionsAt(S.jd);
  for (let i = 0; i < small.count; i++) out.push(Math.hypot(buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]));
  farthest = extent(out)[1];
  solarLogs = out.map((d) => Math.log10(d));
  reach.setLists([solarLogs, ...staticLogs]);
  // the catalogs' gap on the day shown, in About (HOUSE 4.15)
  text('gap-a', U.dist(farthest)); text('gap-b', U.dist(starNear));
}

// ---------------------------------------------------------------- objects: ids, positions, descriptions
// Object ids: 'sun', 'earth', 'io' …; 'sb:<index>'; 'star:<row>'; 'gc:<i>', 'sat:<i>', 'stream:<i>',
// 'arm:<i>', 'gal:sun', 'gal:centre', 'gal:model'.
const smallPos = (i, jd) => Array.from(small.position(i, jd));
// A fitted moon of a giant planet outside its 1950 to 2050 range has no position: it is not drawn,
// and anything that would follow it goes to its planet instead.
function moonMissing(id, jd = S.jd) {
  const b = solar.bodies.get(id);
  return !!b && b.kind === 'moon' && id !== 'moon' && !solar.positionOf(id, jd, [0, 0, 0]);
}
const isSkyStar = (id) => id.startsWith('star:') && stars.skyOnly(+id.split(':')[1]);
// A sky-only star (no usable parallax) as a point: its direction, at an effectively infinite distance.
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
// Where the disk-and-bar model's label sits: 4.5 kpc out along the far end of the model's bar.
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
  if (id === 'gal:centre') return 'Galactic center';
  if (id === 'gal:model') return 'Disk and bar model';
  return id;
}
// What a thing is, in the words the card and Find both use.
const bodyKind = (b) => (b.kind === 'star' ? 'Star' : b.kind === 'planet' ? 'Planet' : b.kind === 'dwarf' ? 'Dwarf planet' : `Moon of ${solar.bodies.get(b.parent).name}`);
const satKind = (o) => (o.galaxy_confirmed === false ? 'Satellite, a galaxy candidate' : 'Satellite galaxy');
const armKind = (a) => (a.layer === 'reid' ? 'Spiral-arm fit to masers' : 'Spiral-arm fit to Cepheids');
// The name on screen: an arm is a fit, and its label says so (the card says which fit).
const labelOf = (id) => (id.startsWith('arm:') ? `${nameOf(id)} (fit)` : nameOf(id));
// A sensible viewing distance (AU) when flying to an object.
function arrivalDist(id) {
  if (solar.bodies.has(id)) {
    if (moonMissing(id)) return arrivalDist(solar.bodies.get(id).parent);
    return solar.bodies.get(id).radiusKm / AU_KM * (id === 'sun' ? 12 : 9);
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
// How close the camera may come: points get a floor where their float32 positions and the render
// passes' near planes still hold (a star from parsecs, an asteroid from AU, the galaxy from kpc).
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
  if (moonMissing(id)) id = solar.bodies.get(id).parent;    // no position at this date: its planet
  const fn = positionFn(id);
  if (!fn) return;
  rig.flyTo({ id, fn, dist: dist || arrivalDist(id), dir, minDist: minDistOf(id) }, S.jd);
  invalidate();
}
// Turn the view, keeping its target and distance, until a sky-only star is in sight a little to the
// left of the target. Far from the Sun, or mid-flight, it flies back to the Sun first.
function faceSkyStar(k) {
  const s = stars.direction(k);
  const near = !rig.animating && stars.skyVisible;
  const side = vnorm([], vcross([], s, rig.upAt(near ? rig.dist : 40)));
  const fwd = vnorm([], vadd([], s, vscale([], side, 0.12)));
  if (!near) { flyTo('sun', 40, vscale([], fwd, -1)); return; }
  rig.flyTo({ id: rig.targetId, fn: rig.targetFn, dist: rig.dist, dir: vscale([], fwd, -1), minDist: rig.minDist }, S.jd);
  invalidate();
}
// When the date leaves a followed moon's range, follow its planet from no closer than four radii.
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
// The Solar System scale frames the inner planets, about 120 px to the AU on a phone held upright.
const solarDist = () => 3.2 * pxPerRad / Math.min(W, H);
function goScale(scale) {
  if (scale === 'solar') flyTo('sun', solarDist(), elevated(rig.eclUp, 48, rig.dir));
  else if (scale === 'stars') flyTo('sun', 14 * PC_AU, elevated(rig.galUp, 24, rig.dir));
  else if (scale === 'galaxy') {
    const sunG = galaxy.toAU(galaxy.sun), gc = galaxy.toAU([0, 0, 0]);
    flyTo('gal:centre', 46 * KPC_AU, elevated(rig.galUp, 42, vnorm([], vsub([], sunG, gc))));
  }
}
function currentScale() {
  if (!pose) return 'solar';
  const ext = Math.max(pose.dist, vlen(pose.pos));
  return ext < 2e4 ? 'solar' : ext < 3e8 ? 'stars' : 'galaxy';
}

// ---------------------------------------------------------------- time: the player and the track
function jdNow() { return clamp(EPH.jdFromDate(new Date()), eph.range.jdStart + 1, eph.range.jdEnd - 1); }
const clampJd = (jd) => clamp(jd, eph.range.jdStart + 0.5, eph.range.jdEnd - 0.5);
function setJd(jd) { S.jd = clampJd(jd); updateTime(); invalidate(); }
function yearBounds(y) { return [EPH.jdFromDate(new Date(Date.UTC(y, 0, 1))), EPH.jdFromDate(new Date(Date.UTC(y + 1, 0, 1)))]; }
let year = NaN, y0 = 0, nDays = 365, scrubTod = 0;
// The track's model for the year shown: its days, its months, today when today is in it.
function setYear() {
  const y = yr(S.jd);
  if (y === year) return;
  year = y;
  const [a, b] = yearBounds(y);
  y0 = a; nDays = Math.round(b - a);
  const now = EPH.jdFromDate(new Date()) - a;
  track.setModel({ n: nDays, now: now >= 0 && now < nDays ? now : null,
    months: U.MONS.map((label, m) => ({ label, at: Math.round(EPH.jdFromDate(new Date(Date.UTC(y, m, 1))) - a) })) });
  $('slider').setAttribute('aria-valuemax', String(nDays - 1));
  const r0 = yr(eph.range.jdStart + 1), r1 = yr(eph.range.jdEnd - 1);
  $('t-yprev').disabled = y <= r0; $('t-ynext').disabled = y >= r1;
}
const dayOf = () => clamp(Math.floor(S.jd - y0), 0, nDays - 1);
const text = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };
const attr = (id, a, v) => { const e = $(id); if (e.getAttribute(a) !== v) e.setAttribute(a, v); };
// The time row, the track's value and the Play key, from S.jd. Nothing in the row ever transitions.
function updateTime() {
  setYear();
  const d = EPH.dateFromJd(S.jd), c = U.clock(d);
  text('t-date', U.date(d)); text('t-clock', `, ${c}`); text('t-lclock', `${c} `);
  attr('slider', 'aria-valuenow', String(S.shown));
  attr('slider', 'aria-valuetext', U.spoken(d));
  const sp = SPEEDS[S.speed];
  text('t-speed', sp.label); attr('t-speed', 'aria-label', `Playback speed, now ${sp.label}`); text('speed-hint', sp.said);
  attr('t-play', 'aria-label', S.playing ? 'Pause' : 'Play');
  $('ico-play').toggleAttribute('hidden', S.playing); $('ico-pause').toggleAttribute('hidden', !S.playing);
}
let rmTimer = 0;
// Play runs on the clock; under Reduce Motion it jumps one unit of the speed once a second instead,
// so no frame is a blend.
function setPlaying(on) {
  S.playing = on; lastT = 0;
  clearInterval(rmTimer);
  if (on && RM.matches) rmTimer = setInterval(() => { if (!S.sheet && !document.hidden) { advance(SPEEDS[S.speed].days); invalidate(); } }, 1000);
  updateTime(); invalidate();
}
function advance(days) {
  const next = S.jd + days;
  if (next >= eph.range.jdEnd - 0.5) setPlaying(false);
  S.jd = clampJd(next);
}
const say = (t) => { $('live').textContent = t; };
function bindTime() {
  $('t-play').addEventListener('click', () => setPlaying(!S.playing));
  $('t-speed').addEventListener('click', () => { S.speed = (S.speed + 1) % SPEEDS.length; store.set('speed', S.speed); setPlaying(S.playing); });
  $('t-now').addEventListener('click', () => setJd(jdNow()));
  const stepYear = (k) => {
    const y = yr(S.jd), [a, b] = yearBounds(y), [a2, b2] = yearBounds(y + k);
    setJd(a2 + (S.jd - a) / (b - a) * (b2 - a2));
    say(U.spoken(EPH.dateFromJd(S.jd)));
  };
  $('t-yprev').addEventListener('click', () => stepYear(-1));
  $('t-ynext').addEventListener('click', () => stepYear(1));
  track = createTrack($('slider'), $('track'), {
    onStart: () => { if (S.playing) setPlaying(false); scrubTod = S.jd - y0 - dayOf(); },
    onScrub: () => invalidate(),
    onEnd: () => invalidate(),
    onKey: (k) => { const d = k === 'home' ? 0 : k === 'end' ? nDays - 1 : clamp(dayOf() + k, 0, nDays - 1); setJd(y0 + d + (S.jd - y0 - dayOf())); },
  });
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

// The plate's angular scale is held when only its height changes (focus mode, the player leaving
// with the Solar System scale), so the picture does not zoom; a width change starts again from 50°.
function resize() {
  const w = canvas.clientWidth, h = Math.max(canvas.clientHeight, 1);
  if (w !== W || !heldPx) { rig.fov = 50 * DEG; heldPx = (h / 2) / Math.tan(rig.fov / 2); }
  else rig.fov = clamp(2 * Math.atan(h / 2 / heldPx), 30 * DEG, 75 * DEG);
  W = w; H = h;
  renderer.setSize(W, H, false);
  for (const c of Object.values(cams)) { c.aspect = W / H; c.fov = rig.fov / DEG; c.updateProjectionMatrix(); }
  pxPerRad = (H / 2) / Math.tan(rig.fov / 2);
  const pr = renderer.getPixelRatio();
  lineUniforms.uRes.value.set(W * pr, H * pr); lineUniforms.uPx.value = pr;
  $('plate').classList.toggle('keys-row', $('keys').scrollHeight > H - 16);
  track.resize(); reach.resize();
  invalidate();
}

// With the card open on the object the camera is aimed at, the view shifts it to the middle of the
// plate the card leaves free (below, or right when wide): the stock view offset; project() takes it.
const aimed = () => S.selected && (rig.targetId === S.selected || rig.anim?.to.id === S.selected);
function wantedShift() {
  const c = $('card');
  if (c.hidden || !aimed()) return [0, 0];
  const x = c.offsetLeft + c.offsetWidth, y = c.offsetTop + c.offsetHeight;
  return W - x > H - y ? [-x / 2, 0] : [0, -y / 2];
}

let candidates = [];
let cardJd = NaN, cardAt = 0;       // the date the open card's figures are for, and when they were written
let cardShownAt = 0;               // when the card last appeared
let frameLog = null;               // tools/shoot.mjs: one entry per drawn frame while it listens
function frameLoop(t) {
  queued = false;
  // Hidden, or under a sheet: nothing is drawn and the clock holds still.
  if (document.hidden || S.sheet) { lastT = 0; return; }
  const dt = lastT ? Math.min(t - lastT, 100) : 16; lastT = t;
  let moving = rig.step(dt);
  const [wx, wy] = wantedShift(), k = RM.matches ? 1 : Math.min(1, dt / 90);
  if (Math.abs(wx - shiftX) + Math.abs(wy - shiftY) > 0.5) { shiftX += (wx - shiftX) * k; shiftY += (wy - shiftY) * k; moving = true; }
  else { shiftX = wx; shiftY = wy; }
  if (track.pressed && track.wanted != null) {
    // the scrub: draw the day the finger wants, keeping the time of day
    S.jd = clampJd(y0 + track.wanted + scrubTod);
    S.shown = track.wanted;
  } else {
    if (S.playing && !RM.matches) { advance(SPEEDS[S.speed].days * dt / 1000); moving = true; }
    S.shown = dayOf();
  }
  updateTime();
  keepMoonTarget();
  // The open card's figures follow the date: at once after a scrub or a step, four times a second in play.
  if (S.selected && !$('card').hidden && S.jd !== cardJd && (!S.playing || performance.now() - cardAt > 250)) refreshCard();
  draw();
  track.draw(S.playing ? clamp(S.jd - y0, 0, nDays - 1) : S.shown);
  if (frameLog) frameLog.push({ t: performance.now(), pressed: track.pressed, finger: track.finger, wanted: track.wanted, shown: S.shown, label: $('t-date').textContent, playing: S.playing, jd: S.jd });
  if (moving || (S.playing && !RM.matches)) invalidate(); else { lastT = 0; saveSoon(); }
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

  // --- stars (pc) and galaxy (kpc)
  placeCamera(cams.stars, pose.pos, pose.target, pose.up, PC_AU);
  placeCamera(cams.galaxy, pose.pos, pose.target, pose.up, KPC_AU);
  stars.update([pose.pos[0] / PC_AU, pose.pos[1] / PC_AU, pose.pos[2] / PC_AU], dSun / PC_AU, pxRatio, S.layers);
  galaxy.update(dSun / KPC_AU, pxRatio, S.layers);
  // Past the galaxy layer's own Sun marker the Solar System pass has nothing left to add.
  solar.root.visible = galaxy.fade < 0.6;

  for (const c of Object.values(cams)) if (shiftX || shiftY) c.setViewOffset(W, H, shiftX, shiftY, W, H); else if (c.view?.enabled) c.clearViewOffset();
  renderer.info.reset();
  renderer.clear(true, true, true);
  renderer.render(scenes.stars, cams.stars);
  renderer.render(scenes.galaxy, cams.galaxy);
  renderer.clearDepth();
  if (solar.root.visible) renderer.render(scenes.solar, cams.solar);

  gatherLabels(jd, dSun);
  chrome(dSun);
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
  const disks = [];
  if (solar.root.visible && !solar.far) {
    for (const b of solar.bodies.values()) {
      if (!b.valid || !b.mesh || !b.mesh.visible || !(b.px > 2)) continue;
      const q = project(b.pos, { x: 0, y: 0, z: 0 });
      if (q) disks.push({ key: b.key, x: q.x, y: q.y, z: q.z, r: b.px });
    }
  }
  const hidden = (id, q) => disks.some((d) => d.key !== id && q.z > d.z && (q.x - d.x) ** 2 + (q.y - d.y) ** 2 < d.r * d.r);
  const push = (id, text, p, pri, color, cls, dy = 0, dx = 0) => {
    const q = project(p, { x: 0, y: 0, z: 0 });
    if (!q || (id !== S.selected && hidden(id, q))) return;
    candidates.push({ id, text, x: q.x + dx, y: q.y + dy, pri: id === S.selected ? 1000 : pri, color, cls });
  };
  const L = S.layers;
  const solarPx = pxPerRad * 40 / Math.max(dSun, 1e-9);        // how big 40 AU looks from here
  for (const b of solar.bodies.values()) {
    if (!b.valid || !solar.root.visible || (solar.far && b.key !== 'sun')) continue;
    if (b.kind === 'moon' && (!L.moons || (b.sepPx || 0) < 16)) continue;       // would sit on its planet
    if (b.key === 'sun' && galaxy.fade > 0.25) continue;                        // the galaxy layer labels it
    if (b.key !== 'sun' && solarPx < (b.kind === 'planet' || b.kind === 'dwarf' ? 18 : 60)) continue;
    const pri = b.key === 'sun' ? 100 : b.key === 'earth' ? 96 : b.kind === 'planet' ? 90 : b.kind === 'dwarf' ? 70 : 55;
    // A globe more than a few pixels across gets its label above the disk; the Sun's steps aside,
    // without the point mark, which would sit where the Sun is not.
    const dx = b.key === 'sun' && b.px <= 10 ? 16 : 0;
    push(b.key, b.name, b.pos, pri, null, b.kind === 'moon' ? 'minor' : dx ? 'bare' : '', b.px > 10 ? -(b.px + 14) : 0, dx);
  }
  // Small bodies: dwarf planets and comets in the overview; named near-Earth asteroids further in.
  if (L.small && small && solarPx > 40) {
    const inner = pose.dist < 4;
    for (const i of small.labelled) {
      const k = small.kind(i);
      if (!(k === 'dwarf' || k === 'comet' || k === 'interstellar' || inner || `sb:${i}` === S.selected)) continue;
      push(`sb:${i}`, small.name(i), smallPos(i, jd), k === 'dwarf' ? 62 : 34, null, k === 'dwarf' ? 'minor' : 'faint');
    }
  }
  // Stars: the brightest as seen from here, among those on screen, more the farther out the camera is.
  if (L.stars) {
    const camPc = [pose.pos[0] / PC_AU, pose.pos[1] / PC_AU, pose.pos[2] / PC_AU];
    const maxN = dSun < 2e4 ? 10 : dSun < 1e8 ? 16 : 0;
    if (maxN) {
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
      for (const [m, k] of best.slice(0, maxN)) push(`star:${k}`, stars.label(k), starPoint(k, [0, 0, 0]), 30 - m, null, inSolar ? 'faint' : m < 1.5 ? '' : 'minor');
    }
  }
  // Galaxy: each category's point mark in its own color
  if (galaxy.fade > 0.25) {
    push('gal:sun', 'Sun', galaxy.toAU(galaxy.sun), 95, PLATE.marks.sun, '');
    push('gal:centre', 'Galactic center', galaxy.toAU([0, 0, 0]), 80, PLATE.marks.center, '');
    if (L.reid || L.drimmel) galaxy.armLabels.forEach((a, i) => { if (L[a.layer]) push(`arm:${i}`, labelOf(`arm:${i}`), galaxy.toAU(a.p), 45, a.color, 'faint'); });
    // The disk-and-bar glow is a model, and the brightest thing here: it is labeled as one.
    const mp = L.model && modelLabelPoint();
    if (mp) push('gal:model', nameOf('gal:model'), galaxy.toAU(mp), 42, null, 'faint');
    if (L.satellites) galaxy.satellites.forEach((o, i) => { if (Number.isFinite(o.mv) && o.mv < -8.5) push(`sat:${i}`, o.name, galaxy.toAU(o.xyz), 40 - o.mv * 0.5, PLATE.cat.satellites.color, 'minor'); });
    if (L.globulars) galaxy.globulars.forEach((o, i) => { if (Number.isFinite(o.mv) && o.mv < -9.3) push(`gc:${i}`, o.name, galaxy.toAU(o.xyz), 30 - o.mv * 0.3, PLATE.cat.globulars.color, 'minor'); });
  }
  if (S.selected && !candidates.some((c) => c.id === S.selected)) {
    const sel = S.selected;
    if (isSkyStar(sel)) { if (stars.skyVisible) push(sel, nameOf(sel), skyPoint(+sel.split(':')[1]), 1000, null, ''); }
    else if (!moonMissing(sel, jd)) { const fn = positionFn(sel); if (fn) push(sel, labelOf(sel), fn(jd), 1000, null, ''); }
  }
  // Keep labels off the keys, the card and the ghost key.
  const reserved = [], pr = $('plate').getBoundingClientRect();
  for (const e of [$('keys'), $('card'), $('focus-exit')]) {
    if (e.hidden) continue;
    const r = e.getBoundingClientRect();
    if (r.width) reserved.push([r.left - pr.left, r.top - pr.top, r.right - pr.left, r.bottom - pr.top]);
  }
  labels.selected = S.selected;
  labels.update(L.labels ? candidates : candidates.filter((c) => c.id === S.selected), W, H, reserved);
}

function pick(x, y) {
  const jd = S.jd;
  let best = null, bestScore = 30;
  // q: a point on screen (a label's, or one projected); radiusPx: a globe's radius there
  const near = (id, q, pri, radiusPx = 0) => {
    const d = Math.hypot(q.x - x, q.y - y) - radiusPx;
    const score = Math.max(0, d) - pri * 0.04;
    if (d < 30 && score < bestScore) { bestScore = score; best = id; }
  };
  const consider = (id, p, pri, radiusPx) => { const q = project(p, _p); if (q) near(id, q, pri, radiusPx); };
  for (const c of candidates) near(c.id, c, c.pri);
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
      // Faded out once the camera leaves the catalog behind: nothing to tap where nothing is drawn.
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

// ---------------------------------------------------------------- the card
const km = (v) => U.withUnit(U.sig(v), 'km');
// What the card says about an object: its kind, its one figure (the distance from the Sun) and the
// line under it, its rows, a note and its source.
function facts(id) {
  const jd = S.jd;
  const out = { kind: '', name: nameOf(id), rows: [], note: '', src: '', orbit: false, fig: null, sub: '' };
  const earth = solar.positionOf('earth', jd, [0, 0, 0]);
  const add = (k, v) => out.rows.push([k, v]);
  const fromSun = (au, extra) => { out.fig = U.distParts(au); out.au = au; out.sub = `from the Sun${extra ? `, ${extra}` : ''}`; };
  if (solar.bodies.has(id)) {
    const b = solar.bodies.get(id), p = b.phys, notes = [];
    // Null for a fitted moon outside 1950 to 2050: then no distances, only what does not change.
    const pos = solar.positionOf(id, jd, [0, 0, 0]);
    out.kind = bodyKind(b);
    if (pos) {
      const dE = vlen(vsub([], pos, earth));
      if (id === 'sun') { out.fig = U.distParts(dE); out.au = dE; out.sub = `from the Earth, ${U.lightTime(dE)}`; }
      else fromSun(vlen(pos));
      if (id !== 'earth' && id !== 'sun') add('From the Earth', `${U.dist(dE)}, ${U.lightTime(dE)}`);
      if (b.kind === 'moon' && b.parent !== 'earth') { const par = solar.positionOf(b.parent, jd, [0, 0, 0]); add(`From ${solar.bodies.get(b.parent).name}`, U.km(vlen(vsub([], pos, par)) * AU_KM)); }
    }
    const r = b.radii, triaxial = r[0] !== r[1];
    const dp = r.slice(0, 3).some((x) => !Number.isInteger(x)) ? 1 : 0;      // the three semi-axes at one precision
    add(triaxial ? 'Radii' : 'Radius', r[0] === r[2] ? U.withUnit(U.sig(r[0], 4), 'km') : triaxial ? `${U.fixed(r[0], dp)} × ${U.fixed(r[1], dp)} × ${U.km(r[2], dp)}` : `${U.withUnit(U.sig(r[0], 5), 'km')} equator, ${U.withUnit(U.sig(r[2], 5), 'km')} pole`);
    // Retrograde relative to its own orbit: the tilt already carries the sense of rotation.
    if (p.sidereal_rotation_h) add('Rotation', `${U.days(Math.abs(p.sidereal_rotation_h) / 24)}${p.obliquity_deg > 90 ? ', retrograde' : ''}`);
    if (Number.isFinite(p.obliquity_deg)) add('Axial tilt', U.deg(p.obliquity_deg));
    const o = solar.orbits.get(id);
    if (o && o.el && id !== 'moon') add('Orbital period', U.days(o.el.period));
    const color = textures.colours && textures.colours[id];
    if (id === 'venus' && !S.layers.venusRadar) out.src = 'Surface: none drawn, a plain disk, as no color data could be sourced; the Magellan radar map is an optional layer.';
    else if (b.meta) out.src = `Surface: ${b.meta.note || b.meta.source_id}`;
    else if (color) out.src = `Color: ${color.note || color.source}`;
    else if (b.kind === 'moon') out.src = 'Surface: no map or color could be sourced; drawn a neutral gray.';
    if (id === 'venus') notes.push(S.layers.venusRadar ? 'Shown with the Magellan radar map of the surface, which no eye can see through the clouds.' : 'Its visible face is a featureless cloud deck.');
    if (id === 'pluto') notes.push(`Drawn at the Pluto–Charon barycenter from JPL DE430. Pluto itself circles that point every 6.39 days, about ${U.km(2100)} away; Charon is not shown because no long-term ephemeris for it could be sourced.`);
    if (b.kind === 'moon' && id !== 'moon') notes.push(pos ? 'Position from JPL satellite ephemerides, fitted in windows of weeks to months (see About).' : `${b.name}’s position is available from ${span(eph.moonRange)} only, so it is not shown at this date.`);
    if (triaxial && !rotation.has(id)) notes.push('It has no rotation model in the data (pck00011), so its orientation is not modeled: it is drawn as a sphere of its mean radius.');
    out.note = notes.join(' ');
  } else {
    const [kind, raw] = id.split(':'); const i = +raw;
    if (kind === 'sb') {
      const info = (small.info && small.info(i)) || {};
      out.kind = small.kindLabel(i);
      const p = smallPos(i, jd);
      fromSun(vlen(p));
      add('From the Earth', U.dist(vlen(vsub([], p, earth))));
      const el = small.elements(i);
      if (el.e < 1) {
        add('Orbit', `${U.sig(el.q)} to ${U.withUnit(U.sig(el.a * (1 + el.e)), 'AU')} from the Sun`);
        add('Period', U.days(el.period));
      } else add('Orbit', `open (e ${U.fixed(el.e, 3)}): passes the Sun once`);
      if (Number.isFinite(info.diameter_km)) add('Diameter', km(info.diameter_km));
      if (Number.isFinite(info.H)) add('Absolute magnitude', `H ${U.fixed(info.H, 1)}`);
      out.src = info.source || '';
      // The dwarf-planet grouping note is long and belongs in About, not on a phone card.
      out.note = (info.note || '').replace(small.meta.dwarf_note || '\u0000', '').trim();
      out.orbit = true;
    } else if (kind === 'star') {
      const n = stars.named, notes = [];
      const sky = stars.skyOnly(i);           // no usable parallax: a direction only
      out.kind = n.flags[i] & 2 ? 'White dwarf' : 'Star';
      if (sky) { add('Distance', 'unknown (no usable parallax)'); out.go = false; }
      else { const au = Math.hypot(n.x[i], n.y[i], n.z[i]) * PC_AU; fromSun(au, U.ly(au)); }
      if (n.desig[i] && n.name[i]) add('Designation', n.desig[i]);
      add('Catalog', n.id[i]);
      if (Number.isFinite(n.vmag[i])) add('Brightness from Earth', `V ${U.fixed(n.vmag[i], 2)}`);
      if (Number.isFinite(n.absmag[i])) add('Absolute magnitude', U.fixed(n.absmag[i], 2));
      if (n.spect[i]) add('Spectral type', n.spect[i]);
      if (!sky) add('Distance from', stars.distSource(i));
      const pl = stars.planets(i);
      if (pl && pl.length) out.planets = pl;
      if (n.flags[i] & 4) notes.push('A companion placed at its primary star’s distance.');
      if (sky) notes.push('Not placed in 3D: with no usable parallax it is drawn only on the sky as seen from near the Sun, with the figure lines that join it.');
      else if (n.flags[i] & 8) notes.push('Parallax only 5 to 10 times its error: the distance is uncertain.');
      else if (n.flags[i] & 64) notes.push('No independent parallax error was available to check this distance against.');
      out.note = notes.join(' ');
    } else if (kind === 'gc' || kind === 'sat') {
      const o = kind === 'gc' ? galaxy.globulars[i] : galaxy.satellites[i];
      const candidate = kind === 'sat' && o.galaxy_confirmed === false;
      out.kind = kind === 'gc' ? 'Globular cluster' : satKind(o);
      fromSun(o.dist_kpc * KPC_AU, U.ly(o.dist_kpc * KPC_AU));
      add('From the Galactic center', U.withUnit(U.sig(Math.hypot(...o.xyz)), 'kpc'));
      if (Number.isFinite(o.mv)) add('Absolute magnitude, V', U.fixed(o.mv, 1));
      if (Number.isFinite(o.rhalf_pc)) add('Half-light radius', U.withUnit(U.sig(o.rhalf_pc), 'pc'));
      if (candidate) out.note = 'The Local Volume Database has not confirmed it as a galaxy: it could still be a star cluster.';
      out.src = o.ref ? `Distance: ${o.ref}` : '';
    } else if (kind === 'stream') {
      const s = galaxy.streams[i];
      out.kind = 'Stellar stream';
      const ds = s.points.map((p) => Math.hypot(...p));
      add('From the Galactic center', `${U.sig(Math.min(...ds))} to ${U.withUnit(U.sig(Math.max(...ds)), 'kpc')}`);
      add('Track', galaxy.data.streamApproximate(i) ? 'approximate' : 'measured path and distances');
      out.note = s.note || '';
      out.src = s.ref || '';
    } else if (kind === 'arm') {
      const a = galaxy.armLabels[i];
      out.kind = armKind(a);
      out.note = a.src.note || (a.layer === 'reid' ? 'A log-spiral fitted to maser parallaxes (Reid et al. 2019), drawn only over the range the fit covers. A fit, not a picture.' : 'A spiral fitted to classical Cepheids (Drimmel et al. 2024). Near the Sun it sits about 0.9\u202Fkpc from the maser fit: two models, both shown.');
    } else if (id === 'gal:sun') {
      out.kind = 'Our star'; out.fig = U.distParts(Math.hypot(...galaxy.sun) * KPC_AU); out.sub = 'from the Galactic center'; out.src = (galaxy.g.frame.refs || []).join('; ');
    } else if (id === 'gal:centre') {
      // The frame's origin, toward Galactic l = b = 0: not the radio source Sgr A*, which the data
      // does not place (tools/CONTRACT.md, Frame).
      out.kind = 'Origin of the galaxy frame'; fromSun(galaxy.g.frame.r0_kpc * KPC_AU); out.src = (galaxy.g.frame.refs || []).join('; ');
      out.note = `The center of the frame this view is drawn in (${galaxy.g.frame.name || 'Galactocentric'}), toward Galactic longitude and latitude 0.`;
    } else if (id === 'gal:model') {
      const m = galaxy.g.model;
      out.kind = 'Mass model, not a picture'; out.note = m.what || ''; out.src = (m.refs || []).join('; ');
    }
  }
  return out;
}

const el = (tag, t, cls) => { const e = document.createElement(tag); if (t != null) e.textContent = t; if (cls) e.className = cls; return e; };
// The card's date-dependent parts, updated in place: the figure, its line, the rows, the note, the source.
function fillCard(f) {
  const dl = $('card-facts');
  if (dl.childElementCount !== f.rows.length * 2 || f.rows.some(([k], i) => dl.children[i * 2].textContent !== k)) dl.replaceChildren(...f.rows.flatMap(([k, v]) => [el('dt', k), el('dd', v)]));
  else f.rows.forEach(([, v], i) => { const dd = dl.children[i * 2 + 1]; if (dd.textContent !== v) dd.textContent = v; });
  $('card-fig').hidden = !f.fig;
  text('card-num', f.fig ? f.fig[0] : ''); text('card-unit', f.fig ? `${NN}${f.fig[1]}` : ''); text('card-sub', f.sub);
  text('card-note', f.note || ''); text('card-src', f.src || '');
  cardJd = S.jd; cardAt = performance.now();
}
function refreshCard() { if (S.selected) fillCard(facts(S.selected)); }

function select(id, announce) {
  S.selected = id;
  const card = $('card');
  if (!id) { card.hidden = true; if (solar) solar.showSmallOrbit(-1); invalidate(); return; }
  const f = facts(id);
  text('card-kind', f.kind); text('card-name', f.name);
  fillCard(f);
  const pl = $('card-planets');
  pl.hidden = !f.planets;
  pl.replaceChildren(...(f.planets || []).map((p) => {
    const li = el('li'); li.append(el('span', p.name), el('span', [p.period_d ? `orbit ${U.days(p.period_d)}` : '', p.method || '', p.year ? `found ${p.year}` : ''].filter(Boolean).join(', '), 'd'));
    return li;
  }));
  $('card-go').hidden = f.go === false;
  $('card-orbit').hidden = !f.orbit || !S.layers.small;      // no orbit to draw while the layer is off
  text('card-orbit', solar.smallOrbitIdx === +id.split(':')[1] && id.startsWith('sb:') ? 'Hide orbit' : 'Show orbit');
  if (card.hidden) cardShownAt = performance.now();
  card.hidden = false;
  if (announce) say(`${f.name}, ${f.kind.charAt(0).toLowerCase()}${f.kind.slice(1)}${f.fig ? `, ${U.distSpoken(f.au)} ${f.sub.split(',')[0]}` : ''}.`);
  invalidate();
}

// ---------------------------------------------------------------- the chrome each frame
let lastScale = '';
function chrome(dSun) {
  const sc = currentScale();
  if (sc !== lastScale) {
    lastScale = sc;
    for (const b of $$('#scales button')) b.setAttribute('aria-pressed', String(b.dataset.scale === sc));
    // Nothing among the stars depends on the date, and the player goes with the Solar System scale.
    $('player').hidden = sc !== 'solar';
    if (sc !== 'solar' && S.playing) setPlaying(false);
  }
  solarCensus();
  // the caption: where you are, and how wide the screen is there
  text('cap', `You are ${U.dist(dSun)} from the Sun; the screen spans ${U.dist(W / pxPerRad * pose.dist)} there.`);
  if (!$('reach').hidden) reach.draw(dSun);
  // the card moves to the bottom when it would cover the selected object, a globe's disk included
  const card = $('card');
  if (!card.hidden) {
    const fn = isSkyStar(S.selected) ? null : positionFn(S.selected), q = fn && project(fn(S.jd), _p);
    const b = solar.bodies.get(S.selected), r = (b && b.px) || 0;
    const low = !aimed() && !!q && q.x - r < card.offsetWidth + 20 && q.y - r < card.offsetHeight + 20;
    if (card.classList.contains('low') !== low) card.classList.toggle('low', low);
  }
}
// The Reach's name in words, written when the view settles, never per frame.
function nameReach() {
  if (!pose || !solarLogs.length) return;
  const lo = 10 ** extent(solarLogs)[0], far = 10 ** Math.max(...staticLogs.map((l) => extent(l)[1]));
  $('reach').setAttribute('aria-label', `Distance from the Sun on a ruler of powers of ten. Catalog objects lie from ${U.distSpoken(lo)} to ${U.distSpoken(farthest)} and from ${U.distSpoken(starNear)} to ${U.distSpoken(far)}. You are at ${U.distSpoken(vlen(pose.pos))}.`);
}

// ---------------------------------------------------------------- focus mode
// Everything but the plate, the About key, the caption and the player leaves; the ghost key in the
// corner, or Escape, brings it back. Remembered as milkyway:focus.
function setFocus(on, byKey, now) {
  if (S.focus === on && !now) return;
  S.focus = on; store.set('focus', on);
  const gone = [$('head'), $('keys'), $('reach')];
  const quick = now || RM.matches;
  if (on) {
    select(null);
    const done = () => {
      for (const e of gone) { e.hidden = true; e.inert = true; e.classList.remove('leaving'); }
      $('caption').prepend($('btn-about'));
      document.body.classList.add('focus');
      $('focus-exit').hidden = false;
      if (byKey) $('focus-exit').focus();
    };
    if (quick) done(); else { for (const e of gone) e.classList.add('leaving'); setTimeout(done, 160); }
    if (!now) say('Controls hidden. Press Escape or the corner key to show them.');
  } else {
    for (const e of gone) { e.hidden = false; e.inert = false; e.classList.remove('leaving'); }
    $('hkeys').append($('btn-about'));
    document.body.classList.remove('focus');
    $('focus-exit').hidden = true;
    if (byKey) $('focus-key').focus();
    say('Controls shown.');
  }
  invalidate();
}

// ---------------------------------------------------------------- sheets: About, Find, Layers
const count = (list, f) => [...list].filter(f).length;
// The data's counts and year spans, written one way in Layers, About and the card.
const yr = (jd) => EPH.dateFromJd(jd).getUTCFullYear(), span = (r) => `${yr(r.jdStart + 1)} to ${yr(r.jdEnd - 1)}`;
function tally() {
  const sky = count(stars.named.flags, (f) => f & 16), conf = count(galaxy.satellites, (o) => o.galaxy_confirmed !== false);
  const measured = count(galaxy.streams, (o, i) => !galaxy.data.streamApproximate(i));
  return { sky, placed: stars.namedCount - sky + stars.deepCount, conf, cand: galaxy.satellites.length - conf, measured,
    moons: count(solar.bodies.values(), (b) => b.kind === 'moon' && b.parent !== 'earth') };
}
const LAYER_DOC = (t = tally()) => [
  ['Solar System', [
    ['orbits', 'Orbits', 'Each planet’s orbit at the date shown'],
    ['trails', 'Trails', 'The real path over the last part of each orbit'],
    ['moons', 'Moons', `The Moon (${span(eph.range)}) and ${t.moons} moons fitted to JPL ephemerides (${span(eph.moonRange)})`],
    ['small', 'Asteroids and comets', `${U.fixed(small.count)} from JPL and Minor Planet Center orbits, colored by orbit: orange near the Earth and Mars, pale in the belt, blue beyond Jupiter, cyan for comets`],
    ['venusRadar', 'Venus radar surface', 'Magellan radar instead of a plain disk'],
  ]],
  ['Stars', [
    ['stars', 'Stars', `${U.fixed(t.placed)} stars placed in 3D, most within ${U.withUnit(500, 'pc')}`],
    ['constellations', 'Constellation figures', `${stars.constellations.length} IAU constellations, drawn in 3D`],
    ['exoplanets', 'Exoplanet hosts', `${U.fixed(Object.keys(stars.exo).length)} stars with confirmed planets`],
    ['sky', 'The Milky Way sky', 'Gaia DR3 star counts, as seen from the Sun'],
  ]],
  ['Milky Way', [
    ['globulars', 'Globular clusters', `${galaxy.globulars.length} clusters at measured distances`],
    ['satellites', 'Satellite galaxies', `${t.conf} confirmed galaxies and ${t.cand} candidates at measured distances`],
    ['streams', 'Stellar streams', `${galaxy.streams.length} streams: ${t.measured} measured tracks, ${galaxy.streams.length - t.measured} approximate`],
    ['young', 'Young stars, Gaia EDR3', `Poggio et al. 2021: where young stars crowd, within about ${U.withUnit(4, 'kpc')}`],
    ['youngOB', 'OB stars, Gaia DR3', 'Drimmel et al. 2023: streaked by distance errors'],
    ['reid', 'Arm fits to masers', 'Reid et al. 2019: a fit to maser parallaxes'],
    ['drimmel', 'Arm fits to Cepheids', 'Drimmel et al. 2024: a fit to Cepheids'],
    ['model', 'Disk and bar model', 'McMillan 2017 disk, Portail 2017 bar: models'],
    ['grid', 'Distance rings', `Every ${U.withUnit(5, 'kpc')} from the center: a guide, not data`],
  ]],
  ['Everywhere', [['labels', 'Labels', 'Names on screen']]],
];
function buildLayers() {
  const root = $('layer-rows');
  root.innerHTML = LAYER_DOC().map(([g, rows]) => `<h3>${escapeHtml(g)}</h3>` + rows.map(([k, t, s]) =>
    `<label class="layer-row"><input type="checkbox" data-layer="${escapeHtml(k)}" ${S.layers[k] ? 'checked' : ''}><span class="box"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 8.5l3.25 3L13 4.5"/></svg></span>`
    + `<span><span class="t">${escapeHtml(t)}</span><span class="s">${escapeHtml(s)}</span></span></label>`).join('')).join('');
  root.addEventListener('change', (e) => {
    const k = e.target.dataset.layer; if (!k) return;
    S.layers[k] = e.target.checked; store.set('layers', S.layers);
    if (S.selected && !$('card').hidden) refreshCard();      // the Venus card says which surface is on
  });
}
// About: the reading blocks and every dataset block from data/about.json, field by field, verbatim,
// but its "Sizes and distances" and "Software and fonts", which About says in its own words.
function buildAbout() {
  const g = galaxy.g, t = tally();
  const blocks = (about && about.blocks) || [];
  const retrieved = blocks.map((b) => b.retrieved || '').sort().pop() || '';
  const list = [
    ['Edition', `JPL DE430 and Gaia DR3${retrieved ? `, retrieved ${U.isoDay(retrieved)}` : ''}`],
    ['Planets and the Moon', span(eph.range)],
    ['Moons of Mars and the giant planets', `${t.moons}, ${span(eph.moonRange)}`],
    ['Asteroids and comets', U.fixed(small.count)],
    ['Stars placed in 3D', U.fixed(t.placed)],
    ['Stars on the sky only', U.fixed(t.sky)],
    ['Globular clusters', U.fixed(g.globulars.length)],
    ['Satellite galaxies', `${t.conf} confirmed, ${t.cand} candidates`],
    ['Stellar streams', `${g.streams.length}, ${t.measured} with measured tracks`],
  ];
  $('about-list').replaceChildren(...list.flatMap(([k, v]) => [el('dt', `${k}:`), el('dd', v)]));
  const keep = (b) => b.id !== 'reading-sizes' && b.id !== 'software';
  const block = (b) => {
    const out = [el('h4', b.title)];
    for (const k of ['text', 'source', 'accuracy']) if (b[k]) out.push(el('p', b[k]));
    const dl = el('dl');
    for (const [k, label] of [['owner', 'Owner'], ['licence', 'License'], ['retrieved', 'Retrieved'], ['url', 'Address']]) {
      if (b[k]) dl.append(el('dt', `${label}:`), el('dd', k === 'url' ? b[k].replace(/^[a-z]+:\/\//i, '') : k === 'retrieved' ? U.isoDay(b[k]) : b[k]));
    }
    if (dl.childElementCount) out.push(dl);
    return out;
  };
  $('about-reading').replaceChildren(...blocks.filter((b) => b.id.startsWith('reading-') && keep(b)).flatMap(block));
  $('about-sources').replaceChildren(...(about && about.intro ? [el('p', about.intro)] : []), ...blocks.filter((b) => !b.id.startsWith('reading-') && keep(b)).flatMap(block));
  // data built once: the stamp's line hides, the About key shows (HOUSE 4.2)
  $('stamp-home').hidden = true; $('btn-about').hidden = false;
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
  for (const b of solar.bodies.values()) searchIndex.push({ id: b.key, text: b.name, kind: bodyKind(b), pri: 3 });
  for (let i = 0; i < small.count; i++) searchIndex.push({ id: `sb:${i}`, text: small.name(i), kind: small.kindLabel(i), pri: small.labelled.includes(i) ? 2 : 0 });
  const n = stars.named;
  for (let k = 0; k < stars.namedCount; k++) {
    const t = [n.name[k], n.desig[k], n.id[k]].filter(Boolean);
    const con = n.con ? n.con[k] : '';
    searchIndex.push({ id: `star:${k}`, text: t[0], alt: t.slice(1).join(', '), kind: 'Star', pri: n.name[k] ? 2 : 1, extra: [spellBayer(n.desig[k]), con, conName[con]].filter(Boolean).join(' '), abbr: con });
  }
  galaxy.globulars.forEach((o, i) => searchIndex.push({ id: `gc:${i}`, text: o.name, kind: 'Globular cluster', pri: 1, extra: `${o.key} ${names(o.other_names)}` }));
  galaxy.satellites.forEach((o, i) => searchIndex.push({ id: `sat:${i}`, text: o.name, kind: satKind(o), pri: 2, extra: `${o.key} ${names(o.other_names)}` }));
  galaxy.streams.forEach((o, i) => searchIndex.push({ id: `stream:${i}`, text: o.name, kind: 'Stellar stream', pri: 1 }));
  galaxy.armLabels.forEach((a, i) => searchIndex.push({ id: `arm:${i}`, text: a.name, kind: armKind(a), pri: 1, extra: a.layer === 'reid' ? 'fit masers Reid' : 'fit Cepheids Drimmel' }));
  searchIndex.push({ id: 'gal:centre', text: 'Galactic center', kind: 'Milky Way', pri: 2, extra: 'center' });
  if (modelLabelPoint()) searchIndex.push({ id: 'gal:model', text: nameOf('gal:model'), kind: 'Mass model', pri: 1, extra: 'disk McMillan Portail' });
  for (const e of searchIndex) { e.f = fold(e.text); e.toks = tokens([e.text, e.alt, e.extra].filter(Boolean).join(' ')); e.abbr = e.abbr ? tokens(e.abbr)[0] : ''; }
  const q = $('search-q'), res = $('search-res');
  // Every word typed must match the start of a word of the entry ('sir' finds Sirius), or, for the
  // Latin genitives no index holds, start with a star's constellation abbreviation ('centauri', Cen).
  // Ranked: the name itself starts with what was typed; every word matched forward; the rest.
  const run = () => {
    const s = fold(q.value.trim()), qt = tokens(q.value);
    if (!qt.length) { res.replaceChildren(); return; }
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
    res.replaceChildren(...(hits.length ? hits.slice(0, 40).map(([, , , e]) => {
      const b = el('button', null); b.type = 'button'; b.dataset.id = e.id;
      b.append(el('span', e.alt ? `${e.text}, ${e.alt}` : e.text), el('span', e.kind, 'k'));
      const li = el('li'); li.append(b); return li;
    }) : [el('li', 'No match. Names here are the catalogs’ own, such as “LMC” or “NGC 5139”.', 'empty')]));
  };
  q.addEventListener('input', run);
  res.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    const id = b.dataset.id;
    closeSheet(); select(id, true);
    if (isSkyStar(id)) faceSkyStar(+id.split(':')[1]); else flyTo(id);
  });
}
let opener = null;
// A sheet is a modal dialog: focus held inside, Escape closes it, focus returns to what opened it.
function openSheet(id, byKey) {
  if (S.sheet) closeSheet(false);
  opener = document.activeElement;
  S.sheet = id;
  $(id).hidden = false;
  for (const k of ['search', 'layers']) $(`btn-${k}`).setAttribute('aria-expanded', String(k === id));
  if (id === 'search') $('search-q').focus();          // in the tap, or iOS shows no keyboard
  else if (byKey) $(id).querySelector('[data-close]').focus();
}
function closeSheet(restore = true) {
  if (!S.sheet) return;
  $(S.sheet).hidden = true;
  S.sheet = null;
  for (const k of ['search', 'layers']) $(`btn-${k}`).setAttribute('aria-expanded', 'false');
  if (restore && opener && opener.focus) opener.focus({ preventScroll: true });
  invalidate();
}

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
  const kb = (e) => e.detail === 0;          // a click made by the keyboard
  $('btn-layers').addEventListener('click', (e) => (S.sheet === 'layers' ? closeSheet() : openSheet('layers', kb(e))));
  $('btn-search').addEventListener('click', (e) => (S.sheet === 'search' ? closeSheet() : openSheet('search', kb(e))));
  $('btn-about').addEventListener('click', (e) => openSheet('about', kb(e)));
  for (const b of $$('[data-close]')) b.addEventListener('click', () => closeSheet());
  for (const b of $$('#scales button')) b.addEventListener('click', () => { select(null); goScale(b.dataset.scale); });
  const zoom = (k) => { rig.finish(); if (RM.matches) rig.zoom(Math.exp(k * 1.04)); else rig.vel.zoom = k * 0.004; invalidate(); };
  // Zoom in and Zoom out: one finger or the keyboard, about 2.8 times a press
  $('zoom-in').addEventListener('click', () => zoom(-1));
  $('zoom-out').addEventListener('click', () => zoom(1));
  $('focus-key').addEventListener('click', (e) => setFocus(true, kb(e)));
  $('focus-exit').addEventListener('click', (e) => setFocus(false, kb(e)));
  // The tap that opened the card is followed by a synthesized click at the same spot, which can land
  // on the close key's hit area as the card appears: clicks that early are ignored.
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
  const local = (x, y) => { const r = canvas.getBoundingClientRect(); return [x - r.left, y - r.top]; };
  rig.on('tap', (x, y) => { [x, y] = local(x, y); select(labelAt(x, y) || pick(x, y), true); });
  rig.on('doubletap', (x, y) => { [x, y] = local(x, y); const id = labelAt(x, y) || pick(x, y); if (id) { select(id, true); flyTo(id); } else zoom(-1); });
  rig.on('change', invalidate); rig.on('interact', invalidate); rig.on('settle', () => { saveSoon(); nameReach(); });
  rig.on('arrive', () => { invalidate(); saveSoon(); nameReach(); });
  new ResizeObserver(resize).observe($('plate'));
  addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveNow(); clearInterval(rmTimer); } else { setPlaying(S.playing); invalidate(); } });
  const themed = () => { track.invalidate(); reach.invalidate(); invalidate(); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themed);
  RM.addEventListener('change', () => setPlaying(S.playing));
  document.fonts.addEventListener('loadingdone', () => { labels.widths.clear(); themed(); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (S.sheet) closeSheet(); else if (S.selected) select(null); else if (S.focus) setFocus(false, true);
      return;
    }
    if (S.sheet && e.key === 'Tab') {
      // hold Tab inside the open sheet
      const f = $$('button, input, [tabindex="0"]', $(S.sheet)).filter((x) => !x.closest('[hidden]'));
      const i = f.indexOf(document.activeElement), n = (i + (e.shiftKey ? -1 : 1) + f.length) % f.length;
      if (i < 0 || (e.shiftKey ? i === 0 : i === f.length - 1)) { f[i < 0 ? 0 : n].focus(); e.preventDefault(); }
      return;
    }
    if (e.key === ' ' && e.target === document.body && !$('player').hidden) { setPlaying(!S.playing); e.preventDefault(); }
  });
}

function restoreCamera() {
  const c = store.get('camera', null);
  const finite = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
  // The saved target must still exist in this build's data and have a position.
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
    rig.dist = solarDist(); rig.dir = elevated(rig.eclUp, 48, [0.35, -0.9, 0.2]);
  }
}

(async function main() {
  $('about-credit-line').textContent = CREDITS;
  try {
    createRenderer();
  } catch (e) { fail(e, 'This phone gave no 3D graphics (WebGL 2) just now. Close other apps and open Milky Way again.'); return; }
  try {
    await load();
  } catch (e) { fail(e); return; }
  reach = createReach($('reach-c'));
  S.jd = jdNow();
  bindTime(); bindUi(); buildLayers(); buildAbout(); buildSearch();
  if (S.focus) setFocus(true, false, true);
  resize(); restoreCamera();
  // Canvas text and the labels' widths wait for the face, the supplement included.
  const face = '560 11.5px "Ysabeau Office"';
  await Promise.all([document.fonts.load(face), document.fonts.load(face, 'αʻ⁴')]).catch(() => {});
  labels.widths.clear();
  resize();
  updateTime();
  invalidate();
  // An inert hook for tools/shoot.mjs, the headless check that drives the app; nothing here calls it.
  window.__mw = {
    rig, S, select, flyTo, goScale, setJd, setFocus, setPlaying,
    edgeDir: () => elevated(rig.galUp, 5, vnorm([], vsub([], galaxy.toAU([0, 10, 0]), galaxy.toAU([0, 0, 0])))),
    candidates: () => candidates.map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y), pri: c.pri })),
    placed: () => labels.placed.map((p) => ({ id: p.id, box: p.box })),
    point: (id) => { const fn = positionFn(id), q = fn && project(fn(S.jd), { x: 0, y: 0, z: 0 }); return q ? { x: q.x, y: q.y } : null; },
    state: () => ({ jd: S.jd, shown: S.shown, playing: S.playing, focus: S.focus, sheet: S.sheet, scale: lastScale, W, H, pxPerRad, dSun: pose ? vlen(pose.pos) : NaN, year, nDays, label: $('t-date').textContent, caption: $('cap').textContent }),
    log: (on) => { const l = frameLog; frameLog = on ? [] : null; return l; },
    census: () => ({ cols: reach.mask ? reach.mask.length : 0, mask: reach.mask ? Array.from(reach.mask).join('') : '', jd: censusJd, farthest, starNear, you: reach.you }),
  };
})();
