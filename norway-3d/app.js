// Norway in 3D: Kartverket's map and terrain for the whole country, in 2D and 3D, with the marked
// trails, the mountain cabins, the real sun and its terrain shadows, a viewshed from any point and
// an elevation profile along any line.
//
// This file wires the pieces together and owns the render scheduler; each file in js/ says in its
// head what it holds. Nothing draws on a loop: a frame is drawn when something changed, while tiles
// are arriving, and while a camera move or play runs. The look is ART.md; the data, NOTES.md.

import * as THREE from './vendor/three.module.js';
import { $, $$, clamp, store, DEG, RAD } from './js/util.js';
import * as U from './js/units.js';
import { Frame, mercX, mercY, lonOf, latOf, cosLat, EARTH, NORWAY } from './js/geo.js';
import { MAP_STYLES } from './js/sources.js';
import { Loader, MAX_TOTAL } from './js/loader.js';
import { Heights, BUDGET as HEIGHTS_BUDGET } from './js/heights.js';
import { Terrain, GPU_BUDGET, MAX_NODES } from './js/terrain.js';
import { sharedUniforms } from './js/material.js';
import { Rig, reduceMotion, MODE_MS } from './js/camera.js';
import { Cabins, KIND_WORDS } from './js/cabins.js';
import { setupFocus } from './js/focus.js';
import { sunAt, sunVector, tzOffsetHours, dayEvents } from './js/sun.js';
import { createTrack, STEPS } from './js/track.js';
import { Shade } from './js/shade.js';
import { buildGrid, viewshed, profile, skyline, horizonAt, sceneRect, REFRACTION } from './js/analysis.js';
import { dayOfYear, fromDayOfYear } from './js/util.js';
import { Labels, LABEL_KIND } from './js/labels.js';
import { RAMPS } from './js/ramps.js';
import { rampTexture } from './js/material.js';
import { SNOW_CLASSES } from './js/snow.js';

// The credit line, first under Sources and credits in About (HOUSE.md section 4.15).
const CREDITS = 'Map, heights and trails: © Kartverket, CC BY 4.0; snow: seNorge, © NVE and MET Norway, NLOD; names and cabins: © OpenStreetMap contributors, ODbL 1.0';

// ---------------------------------------------------------------- state
// the first view: Besseggen and Gjende in Jotunheimen from the east, in 3D
const START = { X: mercX(8.735), Y: mercY(61.505), dist: 7500 / Math.cos(61.5 * Math.PI / 180), phi: 71 * Math.PI / 180, theta: -245 * Math.PI / 180, mode: '3d' };
const S = {
  view: store.get('view', START),
  style: MAP_STYLES[store.get('style', 'topo')] ? store.get('style', 'topo') : 'topo',
  layers: Object.assign({ trails: true, cabins: true, sun: true, names: true, slope: false, snow: false }, store.get('layers', {})),
  surface: store.get('surface', 'map'),        // 'map', 'relief' or 'elevation'
  ramp: RAMPS[store.get('ramp', 'batlow')] ? store.get('ramp', 'batlow') : 'batlow',
  range: store.get('range', 'auto'),            // 'auto' (the heights in view) or 'fixed' (0 to 2 500 m)
  snowMode: store.get('snowMode', 'model'),     // 'model' (seNorge) or 'line'
  snowLine: store.get('snowLine', 1200),
  snowBack: 0,                                  // days before today, for the seNorge day
  saveBattery: store.get('saveBattery', false) === true,   // off: moving is drawn as sharp as standing still
  card: null,
  dialog: null,
  date: store.get('date', null),
  minutes: store.get('minutes', null),
  marker: store.get('marker', null),     // { X, Y, name } a place tapped, or null: the middle of the view
  tool: null,                            // 'viewshed' or 'profile' while one waits for taps
};
// the first time: today, at the hour it is now in Norway
(() => {
  const now = new Date();
  if (!S.date) S.date = { y: now.getUTCFullYear(), mo: now.getUTCMonth() + 1, d: now.getUTCDate() };
  if (S.minutes == null) {
    const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
    S.minutes = Math.round(((utc + 60 * tzOffsetHours(S.date.y, S.date.mo, S.date.d, utc + 60)) % 1440) / 5) * 5 % 1440;
  }
})();
const save = () => {
  if (rig) store.set('view', rig.serialize());
  store.set('style', S.style);
  store.set('layers', S.layers);
  store.set('date', S.date);
  store.set('minutes', S.minutes);
  store.set('marker', S.marker);
  for (const k of ['surface', 'ramp', 'range', 'snowMode', 'snowLine', 'saveBattery']) store.set(k, S[k]);
};
const say = (t) => { $('live').textContent = ''; requestAnimationFrame(() => { $('live').textContent = t; }); };
const text = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };

// ---------------------------------------------------------------- the scene
const canvas = $('gl');
let renderer;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 1, 1e7);
const frame = new Frame(S.view.X, S.view.Y);
const shared = sharedUniforms();
let loader, heights, terrain, rig, cabins, focus, shade, track, labels = null;
let moving = false, settleTimer = 0, flat = 1, failedNote = '', placedAt = 0;
const timings = { frameMs: 0, selectMs: 0, renderMs: 0 };

function fail(msg) {
  $('notice').textContent = msg; $('notice').hidden = false;
  text('stamp', 'Norway in 3D could not start.');
}

// ---------------------------------------------------------------- render scheduler
let queued = false;
function invalidate() { if (!queued) { queued = true; requestAnimationFrame(frameLoop); } }

function frameLoop(now) {
  queued = false;
  if (S.dialog) return;                  // About and the style sheet cover the plate: nothing is drawn under them
  const t0 = performance.now();
  let busy = rig.step(now);

  // the time: play runs on the clock; the frame takes the newest wanted step and date, then draws
  // that one instant whole (the scrub rule, HOUSE.md 4.6)
  if (play) {
    const e = (t0 - play.t0) / 1000, k = RM.matches ? Math.floor(e) * 12 : Math.floor(e * 12);
    want = { ...want, step: Math.min(STEPS - 1, play.from + k) };
    if (play.from + k >= STEPS - 1) setPlaying(false);
    else { clearTimeout(playTimer); playTimer = setTimeout(invalidate, play.t0 + (RM.matches ? Math.floor(e) + 1 : (k + 1) / 12) * 1000 - t0); }
  }
  if (want) {
    const w = want; want = null;
    const day = w.date && dateKey(w.date) !== dateKey(S.date);
    if (day) S.date = w.date;
    if (w.step != null) S.minutes = w.step * 5;
    if (day) newDay();
  }

  // the origin follows the view's center, so nothing near the camera is a large float
  const t = rig.target;
  if (Math.hypot(t.x, t.z) > 20000) {
    rig.rescale(frame.rebase(frame.X(t.x), frame.Y(t.z), [t]));
    placedAt = 0;
  }
  shared.uY0.value = frame.Y0; shared.uC0.value = frame.c0;
  shared.uTarget.value.set(t.x, t.z);
  shared.uFlat.value = flat; terrain.flat = flat;
  shared.uPx.value = (2 * rig.distance * Math.tan((camera.fov * DEG) / 2)) / Math.max(1, canvas.clientHeight * renderer.getPixelRatio());

  // near and far planes from the distance: precision where the camera is
  const d = rig.distance;
  const near = clamp(d * 0.002, 1, 2000), far = Math.max(d * 60, 400000);
  if (Math.abs(near - camera.near) > near * 0.2 || Math.abs(far - camera.far) > far * 0.2) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }

  // Moving is drawn like standing still: the phone's pixel ratio (up to 2) and the same tile choice
  // (NOTES.md: Moving stays sharp). Only Save battery, off unless chosen, drops to a pixel ratio of 1
  // and a coarser choice while the view moves, as 1.1 did.
  const lite = moving && S.saveBattery;
  const dpr = Math.min(2, window.devicePixelRatio || 1), pr = lite ? Math.min(1, dpr) : dpr;
  if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); resizeRenderer(); }

  loader.frame();
  const s0 = performance.now();
  terrain.update(camera, canvas.clientHeight * renderer.getPixelRatio(), { thr: lite ? 2.0 : 1.25, target: t, ahead: S.saveBattery ? null : aheadCams() });
  timings.selectMs = performance.now() - s0;
  // what the card is about stays wanted while it is open: the 1 m heights under it
  if (cardWant) heights.want('D', 15, cardWant[0], cardWant[1], -1);
  for (const k of lineWants) heights.want('D', 15, k[0], k[1], -0.5);
  const sunOn = S.layers.sun;
  if (sunOn && !lite) shade.want(frame.X(t.x), frame.Y(t.z), rig.distance / frame.vs(frame.Y(t.z)));
  loader.pump();

  // the shadows' grids follow the view: at rest, and while it moves at most every MOVE_GRID_MS
  // (never under Save battery); the sky follows the marker, at rest
  const still = !moving && !rig.anim;
  if (sunOn && (still || (!S.saveBattery && now - shade.builtAt > MOVE_GRID_MS))) {
    const g0 = performance.now();
    if (shade.maybeBuild(frame.X(t.x), frame.Y(t.z), rig.distance / frame.vs(frame.Y(t.z)), now)) busy = true;
    timings.gridMs = shade.stats.buildMs;
    if (still && performance.now() - g0 < 30) maybeSky(now);
  }
  // a viewshed is drawn again as better heights arrive under it (at most every 1.5 s)
  if (vsInfo && vsInfo.dirty && !moving && now - (vsInfo.at || 0) > 1500) runViewshed({ X: vsInfo.X, Y: vsInfo.Y }, true);
  light(t);
  if (shade.core) shade.place(frame);
  shared.uShOn.value = sunOn && shade.core ? 1 : 0;
  if (vsInfo) sceneRect(vsInfo.grid, frame, shared.uViewRect.value);
  placeMarker(t);
  placeLine(t);
  if (cabins && (placedAt === 0 || flat < 1 || now - placedAt > 900)) { cabins.place(frame, (X, Y) => heights.heightAt(X, Y), flat, t); placedAt = now; }
  const r0 = performance.now();
  renderer.render(scene, camera);
  timings.renderMs = performance.now() - r0;
  instruments();
  status();
  floatNames(t);
  if (S.surface === 'elevation' && S.range === 'auto') autoRange();
  if (S.card) placeCard();
  track.draw(S.minutes / 5);
  timings.frameMs = performance.now() - t0;
  if (logOn) flog.push({ t: t0, pressed: track.pressed, wanted: track.wanted, shown: S.minutes / 5, label: $('t-date').textContent, instant: `${dateKey(S.date)} ${S.minutes}`, shadow: shade.tag, playing: !!play, sweepMs: shade.stats.sweepMs });
  // tiles for the view keep the frames coming; tiles ahead of it are pumped by their own arrivals
  if (busy || loader.pendingView > 0 || skyDirty) invalidate();
}

// ---------------------------------------------------------------- loading ahead of the view
// Two more views each frame, whose tiles the terrain asks for after the view's own (js/terrain.js):
// a ring around the view (the same camera, a wider field of view), and while the view moves, where
// the hands' velocity will have carried it AHEAD_MS from now (js/camera.js, Rig.predict).
const AHEAD_MS = 700, RING_FOV = 1.45, MOVE_GRID_MS = 400;
const predCam = new THREE.PerspectiveCamera(), ringCam = new THREE.PerspectiveCamera();
function aheadCams() {
  const cams = [];
  if (rig.predict(AHEAD_MS, predCam)) cams.push(predCam);
  ringCam.copy(camera);
  ringCam.fov = Math.min(110, camera.fov * RING_FOV);
  ringCam.updateProjectionMatrix();
  cams.push(ringCam);
  return cams;
}

// ---------------------------------------------------------------- the time: wanted, then shown
let want = null, play = null, playTimer = 0, logOn = false, flog = [];
const dateKey = (d) => `${d.y}-${d.mo}-${d.d}`;
const RM = matchMedia('(prefers-reduced-motion: reduce)');
function setPlaying(on) {
  play = on ? { t0: performance.now(), from: S.minutes / 5 >= STEPS - 1 ? 0 : S.minutes / 5 } : null;
  $('t-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  // an <svg> has no `hidden` property: the attribute is what is toggled
  $('ico-play').toggleAttribute('hidden', on); $('ico-pause').toggleAttribute('hidden', !on);
  clearTimeout(playTimer);
  if (!on) save();
  invalidate();
}
function stepDay(k) {
  const t = new Date(Date.UTC(S.date.y, S.date.mo - 1, S.date.d + k));
  want = { ...want, date: { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() } };
  say(U.date(want.date.y, want.date.mo, want.date.d, true, true));
  invalidate();
}
/** A new day: its events at the marker, the date's words, the skyline's day. */
function newDay() {
  const { y, mo, d } = S.date;
  $('date-d').value = String(dayOfYear(y, mo, d));
  fill($('date-d'));
  text('date-out', U.date(y, mo, d, true));
  dayModel();
  save();
}
const fill = (el) => el.style.setProperty('--v', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);

function resizeRenderer() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  if (cabins) cabins.setSize(15, renderer.getPixelRatio());
}
function onResize() { resizeRenderer(); if (track) track.resize(); invalidate(); }

// ---------------------------------------------------------------- the sun, the sky and the haze
// The sun is computed for the middle of the view (js/sun.js); the sky's color follows its altitude.
let sun = null, sunKey = '';
const SKY_DAY = new THREE.Color(0xdfe7ef), SKY_LOW = new THREE.Color(0xe9dccb), SKY_NIGHT = new THREE.Color(0x27313c), _sky = new THREE.Color();
function light(t) {
  const X = frame.X(t.x), Y = frame.Y(t.z), lon = lonOf(X), lat = latOf(Y);
  const key = `${S.date.y}-${S.date.mo}-${S.date.d} ${S.minutes} ${lon.toFixed(2)} ${lat.toFixed(2)}`;
  // the cast shadows of this instant, swept in this frame, for the sun over the grids' center
  if (S.layers.sun && shade.core) {
    const g = shade.core, gs = sunAt(S.date.y, S.date.mo, S.date.d, S.minutes, latOf(g.cY), lonOf(g.cX));
    shade.sweep(gs.az, gs.elevApparent, `${dateKey(S.date)} ${S.minutes}`);
  }
  if (key !== sunKey) {
    sunKey = key;
    sun = sunAt(S.date.y, S.date.mo, S.date.d, S.minutes, lat, lon);
    timeWords();
    const v = sunVector(sun.az, sun.elevApparent, 0);
    shared.uSunDir.value.set(v.x, v.y, v.z).normalize();
    shared.uSunAlt.value = sun.elevApparent;
    const a = sun.elevApparent;
    _sky.copy(SKY_NIGHT).lerp(SKY_LOW, clamp((a + 8) / 10, 0, 1)).lerp(SKY_DAY, clamp((a - 2) / 14, 0, 1));
    shared.uFogCol.value.copy(_sky).convertSRGBToLinear();
  }
  shared.uSunOn.value = S.layers.sun ? 1 : 0;
  // haze: about a third gone at ten times the camera's distance, never in 2D
  shared.uFog.value = flat < 1 ? 0.04 / Math.max(500, rig.distance) : 0;
  // the sky behind the terrain is the plate's own gradient (styles.css), the haze's color at the
  // horizon; the canvas clears to transparent over it
  renderer.setClearColor(0x000000, 0);
  const plate = $('plate').style, top = skyTop(), hz = `#${_sky.getHexString()}`;
  if (plate.getPropertyValue('--sky-hz') !== hz) { plate.setProperty('--sky-hz', hz); plate.setProperty('--sky-top', top); }
  $('plate').classList.toggle('sky', flat < 0.999);
}
const _top = new THREE.Color();
function skyTop() {
  const a = sun ? sun.elevApparent : 30;
  _top.set(0x27313c).lerp(new THREE.Color(0x6b7f92), clamp((a + 8) / 12, 0, 1)).lerp(new THREE.Color(0xa9bfd2), clamp((a - 4) / 20, 0, 1));
  return `#${_top.getHexString()}`;
}

/** The time row, the lead and the track's value: all of the step shown. */
function timeWords() {
  const { y, mo, d } = S.date, s = sun, m = S.minutes;
  const off = tzOffsetHours(y, mo, d, m), up = s.elevApparent > 0;
  text('t-date', `${U.date(y, mo, d)}, ${U.clock(m)}`);
  text('t-zone', `${U.NN}${U.zone(off)}`);
  text('lead-a', up ? `Sun ${U.deg(s.elevApparent)} up, ${U.wind(s.az)}` : `Sun below the horizon (${U.deg(s.elevApparent)})`);
  text('lead-b', up ? ` (${U.deg(s.az, 0)})` : '');
  const sl = $('slider');
  if (sl.getAttribute('aria-valuenow') !== String(m / 5)) sl.setAttribute('aria-valuenow', String(m / 5));
  const lit = day && day.lit ? (day.lit[m] ? ' The marker is in direct sun.' : ' The marker is in shadow.') : '';
  sl.setAttribute('aria-valuetext', `${U.date(y, mo, d, 0, 1)}, ${U.clock(m)} ${U.zoneSpoken(off)}. ${up
    ? `Sun ${U.int(s.elevApparent)} degrees up in the ${U.wind(s.az, 1)}.` : 'The sun is below the horizon.'}${up ? lit : ''}`);
}

// ---------------------------------------------------------------- the marker and its skyline
// The skyline (ART.md section 1) is for the marker: a place tapped, or else the middle of the view.
// It is recomputed when the marker moves, when the day changes, and when the view rests over a new
// middle or new heights have arrived (at most every 2 s).
let sky = null, skyAt = null, skyTime = 0, skyDirty = true, day = null;
function markerXY() {
  if (S.marker) return [S.marker.X, S.marker.Y];
  const t = rig.target;
  return [frame.X(t.x), frame.Y(t.z)];
}
function maybeSky(now) {
  const [X, Y] = markerXY();
  const moved = !skyAt || Math.hypot(X - skyAt[0], Y - skyAt[1]) * cosLat(Y) > 25;
  if (!moved && !(skyDirty && now - skyTime > 2000)) return;
  if (!heights.heightAt(X, Y) && heights.count === 0) return;
  const t0 = performance.now();
  sky = skyline(heights.sampler(), X, Y);
  timings.skyMs = performance.now() - t0;
  skyAt = [X, Y]; skyTime = now; skyDirty = false;
  dayModel();
}
/** The day at the marker: the sun's altitude and azimuth each minute, the skyline in its direction,
 *  and the spells of direct sun, the caption's figures. */
function dayModel() {
  if (!sky || !skyAt) { day = null; track.setModel({ id: `none ${dateKey(S.date)}`, alt: dayAlt(), hor: null }); return; }
  const { y, mo, d } = S.date, [X, Y] = skyAt;
  const ev = dayEvents(y, mo, d, latOf(Y), lonOf(X));
  const hor = new Float32Array(1441), lit = new Uint8Array(1441);
  for (let i = 0; i <= 1440; i++) { hor[i] = horizonAt(sky, ev.az[i]); lit[i] = ev.altApparent[i] > 0 && ev.altApparent[i] > hor[i] ? 1 : 0; }
  const spans = [];
  let s = -1, total = 0;
  for (let i = 0; i <= 1440; i++) {
    if (lit[i] && s < 0) s = i;
    if (s >= 0 && (!lit[i] || i === 1440)) { const e = lit[i] ? 1440 : i; spans.push([s, e]); total += e - s; s = -1; }
  }
  day = { ev, hor, lit, spans, total, maxAlt: ev.maxAlt };
  track.setModel({ id: `${dateKey(S.date)} ${X} ${Y} ${sky.samples}`, alt: ev.altApparent, hor });
  skyCaption();
  if (sun) timeWords();
  invalidate();
}
function dayAlt() {
  const [X, Y] = markerXY(), ev = dayEvents(S.date.y, S.date.mo, S.date.d, latOf(Y), lonOf(X));
  return ev.altApparent;
}
function skyCaption() {
  if (S.tool) return;
  const where = S.marker ? (S.marker.name || 'the marker') : 'the middle of the view';
  const dt = U.date(S.date.y, S.date.mo, S.date.d);
  let s;
  if (!day) s = '';
  else if (!day.total) s = day.maxAlt < -0.833 ? `The sun stays below the horizon at ${where} on ${dt}.` : `Skyline at ${where}: no direct sun on ${dt}; the sun climbs to ${U.deg(day.maxAlt)} and the terrain hides it.`;
  else if (day.total >= 1440) s = `Skyline at ${where}: direct sun all day and all night (24${U.NN}h).`;
  else {
    const sp = day.spans;
    const w = sp.length > 2 ? `in ${sp.length} spells from ${U.span(sp[0][0], sp[sp.length - 1][1])}` : sp.map(([a, b]) => U.span(a, b)).join(' and ');
    s = `Skyline at ${where}: direct sun ${w} (${U.hm(day.total / 60)}).`;
  }
  text('cap', s);
  text('sky-desc', day ? (day.total ? `Direct sun on the marker from ${day.spans.map(([a, b]) => U.span(a, b)).join(' and ')}, ${U.hm(day.total / 60, 1)}.` : 'No direct sun on the marker on this day.') : '');
}

// The marker on the ground: a ring on a pale casing, standing on the terrain in 3D.
let markerPts = null;
function makeMarker() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e12);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: 18 } },
    vertexShader: 'uniform float uSize; void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize; }',
    fragmentShader: 'precision highp float; uniform float uSize; void main() { float r = length(gl_PointCoord - 0.5) * uSize; float px = 1.0; if (r > uSize * 0.5) discard; float ink = 1.0 - smoothstep(uSize * 0.5 - 3.5, uSize * 0.5 - 2.5, r); float hole = 1.0 - smoothstep(uSize * 0.18, uSize * 0.18 + px, r); vec3 c = mix(vec3(0.965, 0.976, 0.98), vec3(0.059, 0.11, 0.137), ink * (1.0 - hole)); gl_FragColor = vec4(c, 0.95); }',
    transparent: true, depthTest: false, depthWrite: false,
  });
  markerPts = new THREE.Points(geo, mat);
  markerPts.frustumCulled = false; markerPts.renderOrder = 7; markerPts.visible = false;
  scene.add(markerPts);
}
function placeMarker() {
  if (!markerPts) return;
  markerPts.visible = !!S.marker;
  if (!S.marker) return;
  const sx = frame.sx(S.marker.X), sz = frame.sz(S.marker.Y);
  markerPts.geometry.attributes.position.array.set([sx, groundY(sx, sz), sz]);
  markerPts.geometry.attributes.position.needsUpdate = true;
  markerPts.material.uniforms.uSize.value = 18 * renderer.getPixelRatio();
}

// ---------------------------------------------------------------- the status line and the caption band
let lastStatus = '';
function status() {
  const p = loader.pendingView, st = loader.stats;
  let s;
  if (st.started > 8 && st.loaded === 0 && st.failed > 4) s = 'The map could not be loaded.';
  else if (p > 0) s = `Loading ${U.count(p, 'tile', 'tiles')}…`;
  else s = 'Every tile in view has loaded.';
  if (s !== lastStatus) { lastStatus = s; text('stamp', s); }
  const note = st.loaded === 0 && st.failed >= 4
    ? 'No map tiles could be loaded. If this app is offline in Snuggery, allow its sites to see the map.' : '';
  if (note !== failedNote) { failedNote = note; $('notice').textContent = note; $('notice').hidden = !note; }
}

const SCALE_STEPS = [1, 2, 5];
const CABIN_MAX_MPP = 160;
function instruments() {
  // north: the needle turns with the view's heading
  const hd = rig.heading;
  $('needle').setAttribute('transform', `rotate(${(-hd).toFixed(1)} 12 12)`);
  $('cn').setAttribute('transform', `rotate(${(-hd).toFixed(1)} 12 12)`);
  // the scale at the middle of the view: ground meters per CSS pixel there
  const h = canvas.clientHeight || 1;
  const scenePerPx = (2 * rig.distance * Math.tan((camera.fov * DEG) / 2)) / h;
  const t = rig.target, Y = frame.Y(t.z);
  const mPerPx = scenePerPx / frame.vs(Y);
  const maxM = mPerPx * 110;
  const p = 10 ** Math.floor(Math.log10(maxM));
  let len = p;
  for (const k of SCALE_STEPS) if (k * p <= maxM) len = k * p;
  const px = len / mPerPx;
  $('scale-bar').style.width = `${Math.round(px)}px`;
  text('scale-len', len < 1000 ? U.m(len) : U.unit(U.int(len / 1000), 'km'));
  text('scale-sub', rig.mode === 'map' ? `true at ${U.fixed(latOf(Y), 1)}°${U.NN}N` : `at ${U.dist(rig.distance / frame.vs(Y))} from the camera`);
  // the cabins are drawn from about 1:300 000; above that they would only cover the map
  const show = S.layers.cabins && mPerPx < CABIN_MAX_MPP;
  if (cabins && cabins.points.visible !== show) { cabins.points.visible = show; captionLine(); invalidate(); }
  $('compass').setAttribute('aria-label', `Compass: north is ${hd < 1 || hd > 359 ? 'up' : `${U.int(hd)} degrees to the left of up`}.`);
}

function captionLine() {
  const parts = [];
  if (S.layers.cabins && cabins && !cabins.points.visible) parts.push('Zoom in to see the cabins.');
  text('cap', parts.join(' '));
}

// ---------------------------------------------------------------- taps: a cabin, or the ground
const DOUBLE_MS = 300, SLOP = 8;
let down = null, lastTap = null, tapTimer = 0;
function wireTaps() {
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) { down = null; return; }
    down = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, multi: false };
  });
  canvas.addEventListener('pointermove', (e) => { if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > SLOP) down = null; });
  window.addEventListener('pointerdown', (e) => { if (!e.isPrimary && down) down.multi = true; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || e.pointerId !== down.id || down.multi || e.timeStamp - down.t > 400) { down = null; return; }
    const tap = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    down = null;
    if (lastTap && tap.t - lastTap.t < DOUBLE_MS && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 32) {
      clearTimeout(tapTimer); lastTap = null;
      doubleTap(tap.x, tap.y);
      return;
    }
    lastTap = tap;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => onTap(tap.x, tap.y), DOUBLE_MS);
  });
}
function doubleTap(cx, cy) {
  // In 3D a double tap flies to the place tapped, which becomes the middle of the view and the
  // point the view turns about (Anatomy's and Milky Way's double tap); on the map it zooms in on it,
  // the place staying under the finger, as maps do.
  const hit = pick(cx, cy);
  if (!hit) { rig.zoomBy(0.5); return; }
  if (rig.mode === '3d') rig.flyTo(hit.X, hit.Y, 0.5); else rig.zoomAbout(0.5, hit.X, hit.Y);
}
function onTap(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  if (S.tool) {
    const g = pick(cx, cy);
    if (!g) return;
    if (S.tool === 'viewshed') runViewshed(g); else addLinePoint(g);
    return;
  }
  if (cabins && cabins.points.visible) {
    const hit = cabins.pick(camera, rect, cx, cy);
    if (hit) { showCabin(hit.i); return; }
  }
  const g = pick(cx, cy);
  if (g) showPoint(g);
}

/** The ground under a client point: scene and Mercator coordinates, or null (the sky). */
function pick(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, dir = ray.ray.direction;
  if (flat >= 0.999) {
    if (dir.y >= 0) return null;
    const k = -o.y / dir.y, sx = o.x + dir.x * k, sz = o.z + dir.z * k;
    return { sx, sy: 0, sz, X: frame.X(sx), Y: frame.Y(sz) };
  }
  // march the ray over the heights the app holds, then bisect the crossing
  const gap = (k) => { const sx = o.x + dir.x * k, sz = o.z + dir.z * k; return o.y + dir.y * k - groundY(sx, sz); };
  let k = 0, prev = gap(0), step;
  if (prev <= 0) return null;
  const maxK = camera.far;
  while (k < maxK) {
    step = Math.max(2, prev * 0.6, k * 0.004);
    const nk = k + step, g = gap(nk);
    if (g <= 0) {
      let lo = k, hi = nk;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (gap(m) <= 0) hi = m; else lo = m; }
      const sx = o.x + dir.x * hi, sz = o.z + dir.z * hi;
      return { sx, sy: o.y + dir.y * hi, sz, X: frame.X(sx), Y: frame.Y(sz) };
    }
    k = nk; prev = g;
    if (dir.y > 0 && o.y + dir.y * k > 4e5) return null;
  }
  return null;
}
/** The scene y of the drawn ground at a scene point: the shader's formula, on the CPU. */
function groundY(sx, sz) {
  if (flat >= 0.999) return 0;
  const X = frame.X(sx), Y = frame.Y(sz);
  const h = heights.heightAt(X, Y);
  const t = rig ? rig.target : { x: 0, z: 0 };
  const g = cosLat(Y) / frame.c0, dx = (sx - t.x) * g, dz = (sz - t.z) * g;
  return (Math.max(0, h || 0) - (dx * dx + dz * dz) / (2 * EARTH)) * frame.vs(Y) * (1 - flat);
}

// ---------------------------------------------------------------- the card
let cardAt = null, cardWant = null;
function setCard(kind, num, unit, rows, note, link) {
  text('card-kind', kind);
  text('card-num', num);
  text('card-unit', unit ? `${U.NN}${unit}` : '');
  const dl = $('card-rows');
  dl.replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
  text('card-note', note || '');
  const a = $('card-link');
  if (link) { a.href = link.href; a.textContent = link.text; a.hidden = false; } else a.hidden = true;
  $('card-chart').hidden = true;
  if ($('card').hidden) { $('card').hidden = false; }
  placeCard();
}
function closeCard() {
  const kind = S.card && S.card.kind;
  if (kind === 'viewshed') { clearViewshed(); if (S.tool === 'viewshed') setTool('viewshed'); }
  if (kind === 'profile') { clearLine(); if (S.tool === 'profile') setTool('profile'); }
  if (kind === 'point' || kind === 'cabin' || kind === 'name') setMarker(null);
  S.card = null; cardAt = null; cardWant = null; $('card').hidden = true; invalidate();
}
/** The skyline's place: a tapped point or cabin, or null for the middle of the view. */
function setMarker(m) {
  S.marker = m;
  sky = null; skyAt = null; skyDirty = true;
  if (!m) skyCaption();
  save();
  invalidate();
}
function placeCard() {
  // keep the card off the place it describes: when it would cover it, it moves to the foot
  if (!cardAt) return;
  const p = projectMerc(cardAt.X, cardAt.Y, cardAt.h);
  if (!p) return;
  const r = $('card').getBoundingClientRect(), pr = $('plate').getBoundingClientRect();
  const low = $('card').classList.contains('low');
  const top = pr.top + 8, bottom = top + r.height;
  const covers = p.y > top - 12 && p.y < bottom + 12 && p.x < r.right + 12;
  if (covers !== low) $('card').classList.toggle('low', covers);
}
function projectMerc(X, Y, h) {
  const sx = frame.sx(X), sz = frame.sz(Y);
  const v = new THREE.Vector3(sx, groundY(sx, sz), sz).project(camera);
  if (v.z > 1) return null;
  const rect = canvas.getBoundingClientRect();
  return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
}

function heightWords(X, Y) {
  const src = heights.sourceAt(X, Y);
  if (!src) return null;
  return src.model === 1 ? `the 1${U.NN}m model at ${U.fixed(src.mpp, src.mpp < 2 ? 1 : 0)}${U.NN}m` : `the 10${U.NN}m model`;
}
function showCabin(i) {
  const c = cabins.items[i], p = c.p;
  S.card = { kind: 'cabin', i };
  cardAt = { X: c.X, Y: c.Y };
  if (!S.marker || S.marker.X !== c.X || S.marker.Y !== c.Y) setMarker({ X: c.X, Y: c.Y, name: p.n || null });
  // the height the terrain gives under the cabin; ask for the 1 m model there, and say which
  cardWant = tileXY(c.X, c.Y, 15);
  const h = heights.heightAt(c.X, c.Y);
  const rows = [['Type', KIND_WORDS[p.k] || 'Cabin']];
  if (p.op) rows.push(['Operator', p.dnt && !/DNT/.test(p.op) ? `${p.op} (DNT)` : p.op]);
  else if (p.dnt) rows.push(['Operator', 'DNT']);
  if (p.cap) rows.push(['Beds', U.int(p.cap)]);
  if (p.ele != null) rows.push(['Height in OpenStreetMap', U.m(p.ele)]);
  rows.push(['Position', U.pos(c.lon, c.lat)]);
  const hw = heightWords(c.X, c.Y);
  setCard(p.n || KIND_WORDS[p.k] || 'Cabin', h == null ? (p.ele != null ? U.int(p.ele) : '–') : U.int(h), 'm', rows,
    hw ? `The height is the ground under the cabin, from ${hw}.` : (p.ele != null ? 'The height is OpenStreetMap\'s until the terrain arrives.' : ''),
    p.url ? { href: p.url, text: 'Open on ut.no' } : null);
  say(`${p.n || 'A cabin'}, ${KIND_WORDS[p.k] || 'cabin'}${p.op ? `, ${p.op}` : ''}${h != null ? `, ${U.int(h)} meters` : ''}.`);
  invalidate();
}
function showPoint(g) {
  S.card = { kind: 'point', X: g.X, Y: g.Y };
  cardAt = { X: g.X, Y: g.Y };
  if (!S.marker || S.marker.X !== g.X || S.marker.Y !== g.Y) setMarker({ X: g.X, Y: g.Y, name: null });
  cardWant = tileXY(g.X, g.Y, 15);
  const h = heights.heightAt(g.X, g.Y);
  const lon = lonOf(g.X), lat = latOf(g.Y);
  const hw = heightWords(g.X, g.Y);
  const rows = [['Position', U.pos(lon, lat)]];
  if (day && skyAt && skyAt[0] === g.X && skyAt[1] === g.Y) rows.push(['Direct sun', day.total ? `${U.hm(day.total / 60)}, ${U.date(S.date.y, S.date.mo, S.date.d)}` : `none, ${U.date(S.date.y, S.date.mo, S.date.d)}`]);
  setCard('Tapped point', h == null ? '–' : U.int(h), 'm', rows,
    hw ? `From ${hw}.` : 'The heights are on their way.');
  say(`Tapped point, ${h == null ? 'height not loaded yet' : `${U.int(h)} meters`}. ${U.posSpoken(lon, lat)}.`);
  invalidate();
}
const tileXY = (X, Y, z) => { const s = 2 * Math.PI * 6378137 / 2 ** z, H = Math.PI * 6378137; return [Math.floor((X + H) / s), Math.floor((H - Y) / s)]; };

// a card follows its subject as its heights arrive
function refreshCard() {
  if (!S.card) return;
  if (S.card.kind === 'cabin') showCabin(S.card.i);
  else if (S.card.kind === 'point') showPoint(S.card);
  else if (S.card.kind === 'profile') showProfile();
  else if (S.card.kind === 'name') showName(S.card.it);
}

// ---------------------------------------------------------------- the surface, steepness and snow
const SURFACES = {
  map: ['Map', "Kartverket's topographic map, with its own names."],
  relief: ['Relief', 'No map: the ground shaded from the 1 m model, the water from the map. The clearest base for steepness and snow.'],
  elevation: ['Elevation', 'The ground colored by its height, over the same shading.'],
};
const RAMP_NAMES = { batlow: 'batlow', oleron: 'oleron', viridis: 'viridis' };
let rampTex = {};
function needHeights() { return rig.mode === '3d' || S.layers.sun || S.layers.slope || S.layers.snow || S.surface !== 'map'; }
function applySurface() {
  shared.uSurface.value = S.surface === 'map' ? 0 : S.surface === 'relief' ? 1 : 2;
  if (!rampTex[S.ramp]) rampTex[S.ramp] = rampTexture(RAMPS[S.ramp]);
  shared.uRamp.value = rampTex[S.ramp];
  const hex = RAMPS[S.ramp], stops = [];
  for (let i = 0; i < 64; i += 7) stops.push(`#${hex.substr(i * 6, 6)} ${((i / 63) * 100).toFixed(1)}%`);
  stops.push(`#${hex.substr(63 * 6, 6)} 100%`);
  $('lb-elev').style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
  $('lg-elev').hidden = S.surface !== 'elevation';
  if (S.range === 'fixed') setRange(0, 2500);
  terrain.wantHeights = needHeights();
  for (const r of $$('#surface-rows .style-row')) r.setAttribute('aria-checked', String(r.dataset.v === S.surface));
  for (const r of $$('#ramp-words .word')) r.setAttribute('aria-checked', String(r.dataset.v === S.ramp));
  for (const r of $$('#range-words .word')) r.setAttribute('aria-checked', String(r.dataset.v === S.range));
  $('elev-opts').hidden = S.surface !== 'elevation';
  save();
  invalidate();
}
let rangeKey = '';
function setRange(lo, hi) {
  const key = `${lo} ${hi}`;
  if (key === rangeKey) return;
  rangeKey = key;
  shared.uRampRange.value.set(lo, hi);
  text('elev-lo', U.m(lo)); text('elev-hi', `${U.int(hi)}${U.NN}m`);
}
/** The auto range: the drawn ground's lowest and highest, rounded out to 50 m, so the table spans
 *  what is on screen (the key prints it). */
function autoRange() {
  const st = terrain.stats;
  if (!(st.hHi > st.hLo)) return;
  const lo = Math.max(0, Math.floor(st.hLo / 50) * 50), hi = Math.max(lo + 100, Math.ceil(st.hHi / 50) * 50);
  setRange(lo, hi);
}

function applySnow() {
  const on = S.layers.snow;
  const model = on && S.snowMode === 'model';
  const d = new Date(Date.now() - S.snowBack * 86400000);
  const ds = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  terrain.snowDate = model ? ds : null;
  shared.uSnowMode.value = !on ? 0 : model ? 1 : 2;
  shared.uSnowLine.value = S.snowLine;
  $('key-snow').hidden = !model;
  $('row-snowline').hidden = !(on && S.snowMode === 'line');
  $('snow-credit').hidden = !model;
  $('row-snowdate').hidden = S.snowMode !== 'model';
  const day = U.date(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  text('snow-date-key', model ? `on ${day}` : '');
  text('snow-d-out', S.snowBack ? day : `Today, ${day}`);
  // seNorge's terms: the data credited beside the map, retrieved from www.senorge.no (NOTES.md)
  text('snow-credit', `Snow depth on ${day}: seNorge, modeled by NVE and MET Norway on a 1${U.NN}km grid, from www.senorge.no.`);
  $('snow-line').value = String(S.snowLine);
  fill($('snow-line'));
  text('snow-line-out', U.m(S.snowLine));
  for (const r of $$('#snow-words .word')) r.setAttribute('aria-checked', String(r.dataset.v === S.snowMode));
  terrain.wantHeights = needHeights();
  save();
  invalidate();
}
function buildSurfaceUI() {
  const rows = $('surface-rows');
  rows.replaceChildren(...Object.entries(SURFACES).map(([k, [t, note]]) => styleRow(k, t, note, k === S.surface, () => { S.surface = k; applySurface(); })));
  $('ramp-words').replaceChildren(...Object.keys(RAMP_NAMES).map((k) => wordKey(k, RAMP_NAMES[k], () => { S.ramp = k; applySurface(); })));
  $('range-words').replaceChildren(wordKey('auto', 'The heights in view', () => { S.range = 'auto'; rangeKey = ''; applySurface(); }), wordKey('fixed', `0 to 2${U.NN}500${U.NN}m`, () => { S.range = 'fixed'; applySurface(); }));
  $('snow-words').replaceChildren(wordKey('model', 'seNorge snow depth', () => { S.snowMode = 'model'; applySnow(); }), wordKey('line', 'Snow line', () => { S.snowMode = 'line'; applySnow(); }));
}
function wordKey(v, words, on) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'word'; b.setAttribute('role', 'radio'); b.dataset.v = v; b.textContent = words;
  b.addEventListener('click', on);
  return b;
}
function styleRow(v, title, note, checked, on) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'style-row'; b.setAttribute('role', 'radio'); b.dataset.v = v; b.dataset.style = v;
  b.setAttribute('aria-checked', String(checked));
  const box = document.createElement('span'); box.className = 'box';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 12 12'); svg.setAttribute('width', '12'); svg.setAttribute('height', '12'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M2.5 6.5 5 9l4.5-6');
  svg.append(path); box.append(svg);
  const words = document.createElement('span');
  const t = document.createElement('span'); t.className = 't'; t.textContent = title;
  const s2 = document.createElement('span'); s2.className = 's'; s2.textContent = note;
  words.append(t, s2);
  b.append(box, words);
  b.addEventListener('click', on);
  return b;
}

// ---------------------------------------------------------------- the floating names
// Shown in 3D, and on the map when the surface has no names of its own (relief, elevation).
function floatNames(t) {
  if (!labels) return;
  const on = S.layers.names && (flat < 0.5 || S.surface !== 'map');
  if (!on) { if (labels.stats.placed) labels.hide(); return; }
  const rect = canvas.getBoundingClientRect();
  const blocks = [];
  for (const id of ['keys', 'card', 'focus-exit', 'viewkey']) { const e = $(id); if (!e.hidden) { const r = e.getBoundingClientRect(); blocks.push({ l: r.left - 4, r: r.right + 4, t: r.top - 4, b: r.bottom + 4 }); } }
  const Y = frame.Y(t.z);
  labels.update({
    camera, rect, frame, target: t, blocks,
    distG: rig.distance / frame.vs(Y),
    mPerPx: (2 * rig.distance * Math.tan((camera.fov * DEG) / 2)) / (canvas.clientHeight || 1) / frame.vs(Y),
    heightAt: (X, Yy) => heights.heightAt(X, Yy),
    project: (X, Yy, h) => {
      const sx = frame.sx(X), sz = frame.sz(Yy);
      const v = new THREE.Vector3(sx, groundAtHeight(sx, sz, h), sz).project(camera);
      if (v.z > 1 || v.z < -1) return null;
      return { x: rect.left + (v.x + 1) / 2 * rect.width, y: rect.top + (1 - v.y) / 2 * rect.height };
    },
    occluded: (X, Yy, h) => {
      if (flat >= 0.5) return false;
      const sx = frame.sx(X), sz = frame.sz(Yy), py = groundAtHeight(sx, sz, h) + 2, o = camera.position;
      for (let i = 1; i < 14; i++) {
        const f = i / 14, x = o.x + (sx - o.x) * f, z = o.z + (sz - o.z) * f, y = o.y + (py - o.y) * f;
        if (groundY(x, z) > y + 1) return true;
      }
      return false;
    },
  });
}
/** The scene y of height h (meters) at a scene point: the shader's curvature and flattening. */
function groundAtHeight(sx, sz, h) {
  if (flat >= 0.999) return 0;
  const Y = frame.Y(sz), t = rig.target;
  const g = cosLat(Y) / frame.c0, dx = (sx - t.x) * g, dz = (sz - t.z) * g;
  return (Math.max(0, h) - (dx * dx + dz * dz) / (2 * EARTH)) * frame.vs(Y) * (1 - flat);
}
function showName(it) {
  const p = it.p;
  S.card = { kind: 'name', it };
  cardAt = { X: it.X, Y: it.Y };
  cardWant = tileXY(it.X, it.Y, 15);
  if (!S.marker || S.marker.X !== it.X || S.marker.Y !== it.Y) setMarker({ X: it.X, Y: it.Y, name: p.n });
  const h = heights.heightAt(it.X, it.Y);
  const rows = [['Kind', LABEL_KIND[p.k]]];
  if (p.e) rows.push(['Height in OpenStreetMap', U.m(p.e)]);
  if (p.p) rows.push(['Population', U.int(p.p)]);
  rows.push(['Position', U.pos(it.lon, it.lat)]);
  const hw = heightWords(it.X, it.Y);
  setCard(p.n, h == null ? (p.e ? U.int(p.e) : '–') : U.int(h), 'm', rows, hw ? `The height is the ground there, from ${hw}.` : '');
  say(`${p.n}, ${LABEL_KIND[p.k].toLowerCase()}${h != null ? `, ${U.int(h)} meters` : ''}.`);
  invalidate();
}

// ---------------------------------------------------------------- the tools: viewshed and profile
// A tool waits for taps while its word is pressed; the caption says what to tap. Its result is the
// card. Pressing the word again, or closing the card, ends it.
const TOOL_WORDS = { viewshed: 'Tap a point to see the ground that can be seen from it.', profile: 'Tap points along a line; its profile grows with each tap.' };
let vsInfo = null, linePts = [], lineWants = [], lineObj = null, prof = null;
function setTool(id) {
  const next = S.tool === id ? null : id;
  if (S.tool === 'profile' && next !== 'profile') clearLine();
  S.tool = next;
  for (const w of ['viewshed', 'profile']) $(`w-${w}`).setAttribute('aria-pressed', String(S.tool === w));
  text('cap-tool', S.tool ? TOOL_WORDS[S.tool] : '');
  if (!S.tool) skyCaption();
  invalidate();
}
function runViewshed(g, quiet) {
  const t0 = performance.now();
  const t = rig.target, distG = rig.distance / frame.vs(frame.Y(t.z));
  const side = clamp(distG * 2.4, 4000, 40000);
  const grid = buildGrid(heights.sampler(), g.X, g.Y, side, 512, REFRACTION);
  const r = viewshed(grid, 1.7, side / 2 - grid.res);
  const tex = shared.uView.value && shared.uView.value.isDataTexture && shared.uView.value.image.width === 512 ? shared.uView.value : null;
  const vt = tex || new THREE.DataTexture(new Uint8Array(512 * 512), 512, 512, THREE.RedFormat, THREE.UnsignedByteType);
  vt.image.data.set(r.mask); vt.flipY = false; vt.unpackAlignment = 1; vt.magFilter = vt.minFilter = THREE.LinearFilter; vt.needsUpdate = true;
  shared.uView.value = vt; shared.uViewOn.value = 1;
  vsInfo = { grid, r, X: g.X, Y: g.Y, ms: performance.now() - t0, at: performance.now(), dirty: false };
  timings.viewshedMs = vsInfo.ms;
  $('lg-view').hidden = false;
  S.card = { kind: 'viewshed' };
  cardAt = { X: g.X, Y: g.Y }; cardWant = tileXY(g.X, g.Y, 15);
  const lon = lonOf(g.X), lat = latOf(g.Y), share = r.seenM2 / r.allM2;
  text('lt-view', `Viewshed from ${U.m(r.eyeGround)}`);
  setCard(`Viewshed from ${U.m(r.eyeGround)}`, U.fixed(r.seenM2 / 1e6, r.seenM2 < 1e7 ? 2 : 1), 'km² seen', [
    ['Within', U.dist(r.radius)],
    ['Share seen', U.pct(share * 100)],
    ['Eye', `${U.unit('1.7', 'm')} above the ground`],
    ['Position', U.pos(lon, lat)],
  ], `Seen means a person standing there could be seen, over the heights the app holds (${heightWords(g.X, g.Y) || 'the 10 m model'} at the eye), with the earth's curvature and refraction.`);
  if (!quiet) say(`Viewshed from ${U.int(r.eyeGround)} meters: ${U.fixed(r.seenM2 / 1e6, 1)} square kilometers seen within ${U.distSpoken(r.radius)}.`);
  invalidate();
}
function clearViewshed() { vsInfo = null; shared.uViewOn.value = 0; $('lg-view').hidden = true; }

function addLinePoint(g) {
  linePts.push([g.X, g.Y]);
  // the 1 m model under the line, at most forty tiles of it
  const seen = new Set(lineWants.map((k) => k.join('/')));
  for (let i = 1; i < linePts.length; i++) {
    const [aX, aY] = linePts[i - 1], [bX, bY] = linePts[i];
    const n = Math.ceil(Math.hypot(bX - aX, bY - aY) / 400) + 1;
    for (let k = 0; k <= n && lineWants.length < 40; k++) {
      const p = tileXY(aX + (bX - aX) * k / n, aY + (bY - aY) * k / n, 15), key = p.join('/');
      if (!seen.has(key)) { seen.add(key); lineWants.push(p); }
    }
  }
  if (linePts.length === 1) lineWants.push(tileXY(g.X, g.Y, 15));
  showProfile();
}
function clearLine() {
  linePts = []; lineWants = []; prof = null;
  if (lineObj) lineObj.visible = false;
  if (S.card && S.card.kind === 'profile') { S.card = null; cardAt = null; $('card').hidden = true; }
}
function showProfile() {
  if (!linePts.length) return;
  S.card = { kind: 'profile' };
  const last = linePts[linePts.length - 1];
  cardAt = { X: last[0], Y: last[1] };
  if (linePts.length < 2) {
    setCard('Profile', '–', '', [], 'Tap the next point of the line.');
    return;
  }
  prof = profile(heights.sampler(), linePts);
  const p = prof;
  setCard('Profile', U.dist(p.total).split(U.NN)[0], U.dist(p.total).split(U.NN)[1], [
    ['Up', U.m(p.up)], ['Down', U.m(p.down)], ['Highest', U.m(p.hi)], ['Lowest', U.m(p.lo)],
  ], `Every ${U.dist(p.step)} along the line${p.missing ? `; ${U.int(p.missing)} samples still without heights` : ''}. Up and down add every rise and fall at that spacing.`);
  drawChart(p);
  say(`Profile of ${U.distSpoken(p.total)}: ${U.int(p.up)} meters up, ${U.int(p.down)} meters down, highest ${U.int(p.hi)} meters.`);
  invalidate();
}
function drawChart(p) {
  const svg = $('card-chart'), W = 260, H = 84;
  const lo = Math.floor(p.lo / 50) * 50, hi = Math.max(lo + 50, Math.ceil(p.hi / 50) * 50);
  const x = (i) => (p.dist[i] / p.total) * W, y = (h) => H - ((h - lo) / (hi - lo)) * (H - 4) - 2;
  let d = '';
  for (let i = 0; i < p.n; i++) if (!Number.isNaN(p.h[i])) d += `${d ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.h[i]).toFixed(1)}`;
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.replaceChildren(mk('path', { class: 'terr', d: `${d}L${W} ${H}L0 ${H}Z` }), mk('line', { class: 'grid', x1: 0, x2: W, y1: y(hi), y2: y(hi) }), mk('line', { class: 'grid', x1: 0, x2: W, y1: y(lo), y2: y(lo) }), mk('path', { class: 'line', d }));
  svg.hidden = false;
}
function placeLine(t) {
  if (!linePts.length) return;
  if (!lineObj) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(601 * 3), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e12);
    lineObj = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x0f1c23, depthTest: false, transparent: true, opacity: 0.9 }));
    lineObj.frustumCulled = false; lineObj.renderOrder = 6;
    scene.add(lineObj);
  }
  lineObj.visible = true;
  const a = lineObj.geometry.attributes.position.array;
  const pts = prof ? prof : { n: linePts.length, X: linePts.map((q) => q[0]), Y: linePts.map((q) => q[1]) };
  const n = Math.min(601, pts.n);
  for (let i = 0; i < n; i++) { const sx = frame.sx(pts.X[i]), sz = frame.sz(pts.Y[i]); a[i * 3] = sx; a[i * 3 + 1] = groundY(sx, sz) + 3 * (1 - flat); a[i * 3 + 2] = sz; }
  lineObj.geometry.setDrawRange(0, n);
  lineObj.geometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- views, words, dialogs
function setMode(mode, animate = true) {
  if (mode === rig.mode) return;
  const to = mode === 'map' ? 1 : 0, from = flat;
  rig.setMode(mode, animate);
  terrain.wantHeights = needHeights();
  const t0 = performance.now(), dur = animate && !reduceMotion() ? MODE_MS : 0;
  const tick = () => {
    const k = dur ? clamp((performance.now() - t0) / dur, 0, 1) : 1;
    flat = from + (to - from) * (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
    placedAt = 0;
    invalidate();
    if (k < 1) requestAnimationFrame(tick);
  };
  tick();
  viewWords(mode);
  say(mode === 'map' ? 'Map, seen from straight above.' : '3D, the terrain in its true shape.');
  captionLine();
  save();
}
/** The view switch on the plate, and the plate's own description of what the hands do. */
function viewWords(mode) {
  for (const [id, m] of [['view-2d', 'map'], ['view-3d', '3d']]) $(id).setAttribute('aria-checked', String(m === mode));
  canvas.setAttribute('aria-label', mode === 'map'
    ? 'Map of Norway, from above. Drag to move, pinch to zoom, double-tap to zoom in, tap a cabin or a place for its details.'
    : 'Norway in 3D. Drag to turn and tilt, pinch to zoom, drag two fingers to move, double-tap to fly to a place, tap a cabin or a place for its details.');
}
function setLayer(name, on) {
  S.layers[name] = on;
  $(`w-${name}`).setAttribute('aria-pressed', String(on));
  if (name === 'trails') { terrain.trails = on; $('key-trails').hidden = !on; }
  if (name === 'slope') { shared.uSlopeOn.value = on ? 1 : 0; $('key-slope').hidden = !on; terrain.wantHeights = needHeights(); }
  if (name === 'snow') applySnow();
  if (name === 'names' && !on && labels) labels.hide();
  if (name === 'sun') { terrain.wantHeights = needHeights(); $('player').hidden = !on; skyCaption(); if (!on) setPlaying(false); onResize(); }
  if (name === 'cabins' || name === 'names') $('osm-credit').hidden = !(S.layers.cabins || S.layers.names);
  if (name === 'cabins') { cabins.points.visible = on; captionLine(); $('key-cabins').hidden = !on; if (!on && S.card && S.card.kind === 'cabin') closeCard(); }
  save();
  invalidate();
}

/** Save battery: while the view moves, a pixel ratio of 1, a coarser tile choice, no shadow grids
 *  and nothing loaded ahead (1.1's way). Off by default. */
function setSaveBattery(on) {
  S.saveBattery = !!on;
  $('save-battery').setAttribute('aria-checked', String(S.saveBattery));
  save();
  invalidate();
}

let opener = null;
function openDialog(id) {
  opener = document.activeElement;
  S.dialog = id;
  $(id).hidden = false;
  if (id === 'layers') $('btn-layers').setAttribute('aria-expanded', 'true');
  for (const e of [$('head'), $('plate'), $('caption'), $('player')]) e.inert = true;
  const first = $(id).querySelector('[data-close]');
  if (first) first.focus();
}
function closeDialog() {
  if (!S.dialog) return;
  const id = S.dialog;
  $(id).hidden = true;
  S.dialog = null;
  if (id === 'layers') $('btn-layers').setAttribute('aria-expanded', 'false');
  for (const e of [$('head'), $('plate'), $('caption'), $('player')]) e.inert = false;
  if (opener && opener.focus) opener.focus();
  invalidate();
}
function buildStyles() {
  const rows = $('style-rows');
  rows.replaceChildren();
  for (const [k, v] of Object.entries(MAP_STYLES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'style-row'; b.setAttribute('role', 'radio'); b.dataset.style = k;
    b.setAttribute('aria-checked', String(k === S.style));
    const box = document.createElement('span'); box.className = 'box';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 12 12'); svg.setAttribute('width', '12'); svg.setAttribute('height', '12'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', 'M2.5 6.5 5 9l4.5-6');
    svg.append(path); box.append(svg);
    const words = document.createElement('span');
    const t = document.createElement('span'); t.className = 't'; t.textContent = v.name;
    const s = document.createElement('span'); s.className = 's'; s.textContent = v.note[0].toUpperCase() + v.note.slice(1) + '.';
    words.append(t, s);
    b.append(box, words);
    b.addEventListener('click', () => {
      S.style = k; terrain.setStyle(k);
      for (const r of $$('.style-row')) r.setAttribute('aria-checked', String(r.dataset.style === k));
      save();
    });
    rows.append(b);
  }
}
function buildAbout() {
  text('about-credit-line', CREDITS);
  const rows = [
    ['Map', 'Kartverket, read live from cache.kartverket.no'],
    ['Heights near the view', 'Kartverket DTM1, 1 m laser model, read live from hoydedata.no'],
    ['Heights in the distance', 'Kartverket 10 m model, through the Terrarium tiles'],
    ['Trails', 'Turrutebasen, read live from wms.geonorge.no'],
    ['Cabins', `${U.int(cabins.items.length)} from OpenStreetMap, as of ${cabinsAsOf}`],
  ];
  $('ab-data').replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
  text('ab-cabins', `The ${U.int(cabins.items.length)} cabins and huts tagged tourism=wilderness_hut or alpine_hut inside Norway, retrieved ${cabinsAsOf}; their kind, operator, beds and ut.no page as tagged. A cabin's height on its card is the terrain under it, not OpenStreetMap's.`);
}
let cabinsAsOf = '';

function wireUI() {
  $('zoom-in').addEventListener('click', () => rig.zoomBy(0.5));
  $('zoom-out').addEventListener('click', () => rig.zoomBy(2));
  $('btn-norway').addEventListener('click', showNorway);
  $('btn-layers').addEventListener('click', () => openDialog('layers'));
  $('btn-about').addEventListener('click', () => openDialog('about'));
  $('stamp').addEventListener('click', () => openDialog('about'));
  for (const b of $$('[data-close]')) b.addEventListener('click', closeDialog);
  $('card-close').addEventListener('click', closeCard);
  $('view-2d').addEventListener('click', () => setMode('map'));
  $('view-3d').addEventListener('click', () => setMode('3d'));
  // the switch is one radio group: the arrow keys move between its two keys
  $('viewkey').addEventListener('keydown', (e) => {
    if (!/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
    e.preventDefault();
    const next = rig.mode === 'map' ? '3d' : 'map';
    setMode(next);
    $(next === 'map' ? 'view-2d' : 'view-3d').focus();
  });
  for (const name of ['trails', 'cabins', 'sun', 'names', 'slope', 'snow']) $(`w-${name}`).addEventListener('click', () => setLayer(name, !S.layers[name]));
  // the snow line scrubs live: the frame after the finger draws it
  $('snow-line').addEventListener('input', (e) => { S.snowLine = Number(e.target.value); shared.uSnowLine.value = S.snowLine; fill(e.target); text('snow-line-out', U.m(S.snowLine)); invalidate(); });
  $('snow-line').addEventListener('change', () => save());
  $('snow-d').addEventListener('input', (e) => { S.snowBack = 365 - Number(e.target.value); fill(e.target); applySnow(); });
  $('w-viewshed').addEventListener('click', () => setTool('viewshed'));
  $('w-profile').addEventListener('click', () => setTool('profile'));
  // the player
  $('t-play').addEventListener('click', () => setPlaying(!play));
  $('t-prev').addEventListener('click', () => { setPlaying(false); stepDay(-1); });
  $('t-next').addEventListener('click', () => { setPlaying(false); stepDay(1); });
  $('t-date-key').addEventListener('click', () => openDialog('layers'));
  $('date-d').addEventListener('input', (e) => { fill(e.target); want = { ...want, date: fromDayOfYear(S.date.y, Number(e.target.value)) }; text('date-out', U.date(want.date.y, want.date.mo, want.date.d, true)); });
  $('save-battery').addEventListener('click', () => setSaveBattery(!S.saveBattery));
  $('date-today').addEventListener('click', () => { const n = new Date(); want = { ...want, date: { y: n.getUTCFullYear(), mo: n.getUTCMonth() + 1, d: n.getUTCDate() } }; closeDialog(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.dialog) { e.preventDefault(); closeDialog(); }
    if (e.key === 'Tab' && S.dialog) {
      const f = $$('button, [href], input', $(S.dialog)).filter((x) => !x.hidden && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener('resize', onResize);
  new ResizeObserver(onResize).observe($('plate'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); else invalidate(); });
  window.addEventListener('pagehide', save);
}
/** Look at Mercator (X, Y) from `distMerc` Mercator meters: the origin moves there first. */
function jumpTo(X, Y, distMerc, phi, theta) {
  frame.rebase(X, Y, [rig.target]);
  rig.lookAt(X, Y, distMerc * frame.c0, phi, theta);
  placedAt = 0;
}
function showNorway() {
  const h = canvas.clientHeight || 600, w = canvas.clientWidth || 400;
  const X = mercX(15.5), Y = mercY(65.2);
  const spanY = (mercY(NORWAY.lat1 - 0.4) - mercY(NORWAY.lat0 + 0.4)) * frame.c0;
  const spanX = (mercX(NORWAY.lon1 - 1) - mercX(NORWAY.lon0 + 1)) * frame.c0;
  const need = Math.max(spanY, spanX * h / w);
  const dist = (need / 2) / Math.tan((camera.fov * DEG) / 2) * 1.04;
  jumpTo(X, Y, dist / frame.c0);
  save();
}

// ---------------------------------------------------------------- boot
const v0 = () => S.view;
async function boot() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    fail('This phone gave no 3D graphics just now. Close other apps and open Norway in 3D again.');
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  loader = new Loader(() => invalidate());
  heights = new Heights(loader, () => { placedAt = 0; skyDirty = true; if (vsInfo) vsInfo.dirty = true; if (shade) shade.dirty = true; if (S.card) refreshCard(); invalidate(); });
  terrain = new Terrain({ renderer, frame, heights, loader, shared, onTexture: invalidate });
  terrain.setStyle(S.style);
  canvas.addEventListener('webglcontextrestored', () => { terrain.resetNormals(); invalidate(); });
  terrain.trails = S.layers.trails;
  terrain.wantHeights = v0().mode === '3d' || S.layers.sun;   // 3D and the sun need heights; the bare map does not
  shade = new Shade(heights, shared);
  scene.add(terrain.group);

  rig = new Rig(camera, canvas, frame, (sx, sz) => groundY(sx, sz), (cx, cy) => pick(cx, cy), invalidate,
    $('plate'), (e) => e.target === canvas || !!(e.target.closest && e.target.closest('#flabels')));
  rig.on('start', () => { moving = true; clearTimeout(settleTimer); });
  rig.on('end', () => { clearTimeout(settleTimer); settleTimer = setTimeout(() => { moving = false; save(); invalidate(); }, 220); });
  rig.on('change', () => { if (S.card) placeCard(); });
  const v = S.view;
  rig.mode = v.mode === '3d' ? '3d' : 'map';
  rig.target.set(0, 0, 0);
  rig.place((v.dist || START.dist) * frame.c0, rig.mode === '3d' ? (v.phi ?? 0.9) : 0, rig.mode === '3d' ? (v.theta ?? 0) : 0);
  flat = rig.mode === '3d' ? 0 : 1;
  viewWords(rig.mode);

  track = createTrack($('slider'), $('track'), {
    onStart: () => { if (play) setPlaying(false); },
    onScrub: (k) => { want = { ...want, step: k }; invalidate(); },
    onEnd: () => save(),
    onKey: (k) => { setPlaying(false); const cur = S.minutes / 5; want = { ...want, step: k === 'home' ? 0 : k === 'end' ? STEPS - 1 : clamp(cur + k, 0, STEPS - 1) }; invalidate(); },
  });
  makeMarker();
  wireUI();
  wireTaps();
  focus = setupFocus({ onChange: () => { if (S.card) closeCard(); onResize(); }, say, dialogOpen: () => !!S.dialog });
  buildStyles();
  resizeRenderer();
  invalidate();

  // the cabins travel inside the app
  try {
    const r = await fetch('data/cabins.geojson');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const gj = await r.json();
    cabinsAsOf = gj.osmBase ? U.date(...gj.osmBase.slice(0, 10).split('-').map(Number), true) : 'its build';
    cabins = new Cabins(gj);
    cabins.setSize(15, renderer.getPixelRatio());
    scene.add(cabins.points);
  } catch (e) {
    cabins = new Cabins(null);
    $('notice').textContent = `data/cabins.geojson could not be read (${e.message}); the map is shown without the cabins.`;
    $('notice').hidden = false;
  }
  setLayer('trails', S.layers.trails);
  setLayer('cabins', S.layers.cabins);
  setLayer('sun', S.layers.sun);
  buildSurfaceUI();
  $('save-battery').setAttribute('aria-checked', String(S.saveBattery));
  $('snow-d').value = '365'; fill($('snow-d'));
  applySurface();
  for (const n of ['names', 'slope', 'snow']) setLayer(n, S.layers[n]);
  try {
    const r = await fetch('data/labels.geojson');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    // with Viewshed or Profile waiting for a tap, a tap on a name is a tap on its place
    labels = new Labels(await r.json(), $('flabels'), (it) => {
      if (!S.tool) { showName(it); return; }
      const g = { X: it.X, Y: it.Y, sx: frame.sx(it.X), sz: frame.sz(it.Y) };
      if (S.tool === 'viewshed') runViewshed(g); else addLinePoint(g);
    });
  } catch (e) {
    $('notice').textContent = `data/labels.geojson could not be read (${e.message}); the names are not shown.`;
    $('notice').hidden = false;
  }
  newDay();
  track.resize();
  document.fonts.load('400 10.5px "Ysabeau Office"').then(() => { track.invalidate(); invalidate(); });
  buildAbout();
  captionLine();
  for (const e of $$('[data-boot]')) e.hidden = false;
  placedAt = 0;
  invalidate();

  // An inert hook for tools/shoot.mjs; nothing in the app calls it.
  window.__norway3d = {
    S, timings, frame, camera,
    get saveBattery() { return S.saveBattery; }, set saveBattery(v) { setSaveBattery(v); },
    budgets: { gpuMB: GPU_BUDGET / 1048576, heightsMB: HEIGHTS_BUDGET / 1048576, tiles: MAX_NODES, inflight: MAX_TOTAL },
    get rig() { return rig; }, get terrain() { return terrain; }, get loader() { return loader; }, get heights() { return heights; }, get cabins() { return cabins; },
    stats: () => ({ terrain: { ...terrain.stats }, cover: { ...terrain.cover }, loader: { ...loader.stats, pending: loader.pending, inflight: loader.inflight }, heights: { count: heights.count, mb: heights.bytes / 1048576, ...heights.stats }, timings: { ...timings }, info: { ...renderer.info.render, textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries }, pixelRatio: renderer.getPixelRatio() }),
    lookAt: (lon, lat, distM, phiDeg, thetaDeg) => { const X = mercX(lon), Y = mercY(lat); frame.rebase(X, Y, [rig.target]); rig.lookAt(X, Y, distM * frame.vs(Y), phiDeg == null ? undefined : phiDeg * DEG, thetaDeg == null ? undefined : thetaDeg * DEG); placedAt = 0; },
    project: (lon, lat) => projectMerc(mercX(lon), mercY(lat)),
    // the camera in ground terms, for the gesture checks: the pivot, the distance and the eye's
    // clearance over the highest drawn ground within 80 m of it, in meters
    cam: () => {
      const t = rig.target, p = camera.position, vs = frame.vs(frame.Y(t.z));
      let g = -Infinity;
      for (const [dx, dz] of [[0, 0], [80, 0], [-80, 0], [0, 80], [0, -80]]) g = Math.max(g, groundY(p.x + dx, p.z + dz));
      const tg = groundY(t.x, t.z);
      return { mode: rig.mode, lon: lonOf(frame.X(t.x)), lat: latOf(frame.Y(t.z)), dist: rig.distance / vs, phi: rig.polar / DEG, heading: rig.heading, clearance: (p.y - g) / vs, pivotOff: (t.y - tg) / vs, anim: !!rig.anim, coasting: rig.coasting, active: rig.active, flat, stats: { ...rig.stats } };
    },
    pickAt: (x, y) => { const g = pick(x, y); return g && { lon: lonOf(g.X), lat: latOf(g.Y) }; },
    setMode, setLayer, showCabin, setTool, setMarker, setPlaying, idle: () => loader.pending === 0 && !skyDirty,
    get shade() { return shade; }, get labels() { return labels; }, applySurface, applySnow, get sky() { return sky; }, get day() { return day; }, get vs() { return vsInfo; }, get prof() { return prof; },
    setTime: (y, mo, d, minutes) => { want = { date: { y, mo, d }, step: Math.round(minutes / 5) }; invalidate(); },
    log: (on) => { logOn = on; if (on) flog = []; return flog; },
    tap: (lon, lat) => { const p = projectMerc(mercX(lon), mercY(lat)); if (p) onTap(p.x, p.y); return p; },
    // n frames of the current view drawn back to back (the tile choice untouched), each waited out on the GPU by reading a pixel back: a trend on this machine, not a phone figure
    // at pixel ratio `pr` when given (the moving frame's cost under Save battery against without), then back
    bench: (n = 30, pr = null) => { const gl = renderer.getContext(), px = new Uint8Array(4), ms = [], pr0 = renderer.getPixelRatio(); if (pr) { renderer.setPixelRatio(pr); resizeRenderer(); } for (let i = 0; i < n; i++) { const a = performance.now(); renderer.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ms.push(performance.now() - a); } if (pr) { renderer.setPixelRatio(pr0); resizeRenderer(); invalidate(); } ms.sort((a, b) => a - b); return { median: ms[n >> 1], p90: ms[Math.floor(n * 0.9)], max: ms[n - 1] }; },
  };
}

boot();
