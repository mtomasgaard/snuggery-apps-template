// Besseggen: an offline 3D terrain viewer for the ridge between Gjende and Bessvatnet.
//
// This file wires the pieces together and owns the render scheduler; each file in js/ says in its
// head what it holds. Nothing draws on a loop: a frame is drawn when something changed, and play
// draws one per step. The look is ART.md; what the data is, NOTES.md.

import * as THREE from './vendor/three.module.js';
import { $, $$, clamp, store, dayOfYear, daysInMonth, escapeHtml, DEG, RAD } from './js/util.js';
import * as U from './js/units.js';
import { Frame } from './js/geo.js';
import { DataSet, onRegainFocus } from './js/data.js';
import { Terrain, MAX_TILES, TRIS_PER_TILE } from './js/terrain.js';
import { makeTerrainMaterial, applyPalette, makeMaskTexture, setGridRect } from './js/material.js';
import { sunAt, dayEvents, sunVector, shadowMask, makeSeed, directSunWindow, tzOffsetHours } from './js/sun.js';
import { viewshed, lineOfSight, visiblePeaks, visibleFrom, measure } from './js/analysis.js';
import { Route, timeForSegments, paceLabel, langmuirNote } from './js/route.js';
import { Profile } from './js/profile.js';
import { CameraRig, reduceMotion } from './js/camera.js';
import { setupFocus } from './js/focus.js';
import { createTrack, STEPS } from './js/track.js';
import { PLATE } from './js/plate.js';
import { makeLineMaterial, buildLine, buildLines, lineFeatureToPoints, buildWater, makeWaterMaterial, buildMask, colorOf } from './js/overlays.js';

// The credit line on screen in every mode (owner call 8); every source in full is in About.
const CREDITS = 'Terrain, trail, lakes and names: Kartverket, CC BY 4.0';

// ---------------------------------------------------------------- state
const today = new Date();
const S = {
  sheet: store.get('sheet', 0),
  layers: Object.assign({
    sun: true, shadow: true, hillshade: true, slope: false, bands: false,
    contour20: false, contour100: true, water: true, glacier: true,
    route: true, rivers: true, viewshed: true, labels: true,
  }, store.get('layers', {})),
  date: store.get('date', { y: today.getFullYear(), mo: 6, d: 14 }),
  minutes: clamp(Math.round(store.get('minutes', 7 * 60) / 5) * 5, 0, 1435),
  exag: store.get('exag', 1),
  reversed: store.get('reversed', false),
  cursor: store.get('cursor', 0),
  marker: store.get('marker', null),
  paceModel: store.get('paceModel', null),
  paceFit: store.get('paceFit', null),
  savedViews: store.get('savedViews', []),
  eyeM: store.get('eyeM', 1.7),
  tool: null,
  card: null,          // what the card shows: 'point', or a tool's id
  dialog: null,        // 'about' or 'layers' while one is open
};
const save = () => {
  for (const k of ['sheet', 'layers', 'date', 'minutes', 'exag', 'reversed', 'cursor', 'marker', 'paceModel', 'paceFit', 'savedViews', 'eyeM']) store.set(k, S[k]);
  store.set('camera', rig ? rig.serialize() : null);
};
const say = (t) => { $('live').textContent = ''; requestAnimationFrame(() => { $('live').textContent = t; }); };
const text = (id, t) => { const e = $(id); if (e.textContent !== t) e.textContent = t; };
const attr = (e, k, v) => { if (e.getAttribute(k) !== String(v)) e.setAttribute(k, v); };

// ---------------------------------------------------------------- renderer
const canvas = $('gl');
let renderer;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 4, 140000);
const raycaster = new THREE.Raycaster();

let data, frame, terrain, mat, route, profile, rig, focus, track, waterMesh, waterMat, lineMat, routeLine,
  connLine, riverLine, toolLine, markerLine, shadowCore, shadowShell, viewshedTex,
  shadowBuf, shellBuf, viewshedInfo = null, sunInfo = null, events = null, burn = null, projErr = 0;
let scheme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const timings = { shadowMs: 0, viewshedMs: 0, selectMs: 0, frameMs: 0 };

// A problem is a sentence on the plate, never a blank screen (HOUSE.md section 4.9).
function fail(msg) {
  $('notice').textContent = msg; $('notice').hidden = false;
  text('stamp', 'Besseggen could not start.');
  for (const id of ['keys', 'sheet', 'player']) $(id).hidden = true;
}

// ---------------------------------------------------------------- the time: wanted, then shown
// The scrub rule (HOUSE.md 4.6; ART.md B3): handlers record the wanted step or date; the frame takes
// the newest, computes its sun and cast shadows, then draws: every frame shows one instant.
let want = null, play = null, held = false, logOn = false, flog = [], lit = '', playTimer = 0, sweeps = 0;
const dateKey = (d) => `${d.y}-${d.mo}-${d.d}`;
const RM = matchMedia('(prefers-reduced-motion: reduce)');

function setPlaying(on) {
  play = on ? { t0: performance.now(), from: S.minutes / 5 >= STEPS - 1 ? 0 : S.minutes / 5 } : null;
  $('t-play').setAttribute('aria-label', on ? 'Pause' : 'Play');
  // an <svg> has no `hidden` property: the attribute is what is toggled
  $('ico-play').toggleAttribute('hidden', on); $('ico-pause').toggleAttribute('hidden', !on);
  clearTimeout(playTimer);
  invalidate();
}

// ---------------------------------------------------------------- render scheduler
let queued = false, lastT = 0;
function invalidate() { if (!queued) { queued = true; requestAnimationFrame(frameLoop); } }

function frameLoop(t) {
  queued = false;
  if (S.dialog) return;                  // About and Layers cover the plate: nothing is drawn under them
  const dt = lastT ? t - lastT : 16; lastT = t;
  const t0 = performance.now();
  if (play) {
    // the day at an hour a second; under Reduce Motion in whole hours, once a second
    const e = (t0 - play.t0) / 1000, k = RM.matches ? Math.floor(e) * 12 : Math.floor(e * 12);
    want = { ...want, step: Math.min(STEPS - 1, play.from + k) };
    if (play.from + k >= STEPS - 1) setPlaying(false);
    // the next frame at the next step, not on every display refresh
    else { clearTimeout(playTimer); playTimer = setTimeout(invalidate, play.t0 + (RM.matches ? Math.floor(e) + 1 : (k + 1) / 12) * 1000 - t0); }
  }
  if (want) {
    const w = want; want = null;
    const day = w.date && dateKey(w.date) !== dateKey(S.date);
    if (day) S.date = w.date;
    if (w.step != null) S.minutes = w.step * 5;
    if (day) newDay();
    applyTime();
  }
  let busy = rig.update(dt, route, S.reversed);
  if (rig.flying) {
    // The profile cursor follows the fly-through; the state is stored again when it stops.
    const i = route.indexAtDist(rig.routeT * route.length, S.reversed);
    if (i !== S.cursor) setCursor(i, false, false);
  }

  // Adaptive near plane: precision where the camera is, without a logarithmic depth buffer that
  // every custom shader here would have to reimplement.
  const d = camera.position.distanceTo(rig.controls.target);
  const near = clamp(d * 0.0012, rig.mode === 'orbit' ? 2.5 : 1.1, 220);
  if (Math.abs(near - camera.near) > near * 0.2) { camera.near = near; camera.updateProjectionMatrix(); }

  camera.updateMatrixWorld();
  const s0 = performance.now();
  const sel = terrain.select(camera, renderer.domElement.clientHeight || 800);
  timings.selectMs = performance.now() - s0;

  renderer.render(scene, camera);
  updateLabels();
  updateGauge();
  if (S.card) placeCard();
  track.draw(S.minutes / 5);
  timings.frameMs = performance.now() - t0;
  if (logOn) flog.push({ t: t0, pressed: track.pressed, finger: track.finger, wanted: track.wanted, shown: S.minutes / 5, label: $('t-date').textContent, sun: sunInfo.key, shadow: shadowKey, playing: !!play, ms: timings.shadowMs, n: sweeps });
  if (busy || sel.pending > 0) invalidate();
}

// The instant shown: the sun, its cast shadows, the time row, the lead and the track's value.
let shadowKey = '';
function applyTime() {
  const { y, mo, d } = S.date, key = `${dateKey(S.date)} ${S.minutes}`;
  if (key === shadowKey) return;          // the instant shown already: no second sweep
  const s = sunAt(y, mo, d, S.minutes, frame.centerLat, frame.centerLon);
  s.key = key;
  sunInfo = s;
  const v = sunVector(s.az, s.elevApparent, frame.convergence);
  mat.uniforms.uSunDir.value.set(v.x, v.y, v.z).normalize();
  mat.uniforms.uSunUp.value = s.elevApparent > -0.5 ? 1 : 0;
  waterMat.uniforms.uSunDir.value.set(v.x, v.y, v.z);
  waterMat.uniforms.uSunUp.value = s.elevApparent > 0 ? 1 : 0;
  computeShadows();
  timeWords();
}
function timeWords() {
  const { y, mo, d } = S.date, s = sunInfo;
  const off = tzOffsetHours(y, mo, d, S.minutes), up = s.elevApparent > 0;
  text('t-date', `${U.date(y, mo, d)}, ${U.clock(S.minutes)}`);
  text('t-zone', `${U.NN}${U.zone(off)}`);
  text('lead-a', up ? `Sun ${U.deg(s.elevApparent)} up, ${U.wind(s.az)}` : `Sun below the horizon (${U.deg(s.elevApparent)})`);
  text('lead-b', up ? ` (${U.deg(s.az, 0)})` : '');
  const sl = $('slider');
  attr(sl, 'aria-valuenow', S.minutes / 5);
  const k = burn && burn.lit[Math.floor(S.minutes / 2)];
  lit = up ? (k ? ' The marker is in direct sun.' : ' The marker is in shadow.') : '';
  attr(sl, 'aria-valuetext', `${U.date(y, mo, d, 0, 1)}, ${U.clock(S.minutes)} ${U.zoneSpoken(off)}. ${up
    ? `Sun ${U.int(s.elevApparent)} degrees up in the ${U.wind(s.az, 1)}.` : 'The sun is below the horizon.'}${lit}`);
}

function computeShadows() {
  const s = sunInfo;
  const core = terrain.analysis.core, shell = terrain.analysis.shell;
  const t0 = performance.now();
  const gridAz = s.az - frame.convergence;
  if (s.elevApparent <= 0) {
    shadowBuf.fill(0); shellBuf.fill(0);
  } else {
    shadowMask(shell, gridAz, s.elevApparent, shellBuf);
    const seed = makeSeed(shell, core, (x, y) => terrain.gridSample(shell, x, y), gridAz, s.elevApparent);
    shadowMask(core, gridAz, s.elevApparent, shadowBuf, seed);
  }
  timings.shadowMs = performance.now() - t0;
  shadowKey = s.key; sweeps++;
  shadowCore.needsUpdate = true;
  shadowShell.needsUpdate = true;
}

// A new day: its sun events, the date's words, and the Burn for the marker.
function newDay() {
  const { y, mo, d } = S.date;
  events = dayEvents(y, mo, d, frame.centerLat, frame.centerLon);
  $('date-d').value = String(dayOfYear(y, mo, d));
  fill($('date-d'));
  text('date-out', U.date(y, mo, d, true));
  const e = events, ev = [];
  if (e.polarDay) ev.push('The sun does not set today.');
  else if (e.polarNight) ev.push('The sun does not rise today.');
  else ev.push(`Sunrise ${U.clock(e.sunrise)}, sunset ${U.clock(e.sunset)}.`);
  const g = (a) => a && a[0] != null && a[1] != null;
  if (g(e.goldenMorning) || g(e.goldenEvening)) ev.push(`Golden hour ${[e.goldenMorning, e.goldenEvening].filter(g).map(([a, b]) => U.span(a, b)).join(' and ')}.`);
  if (e.dawn == null && e.dusk == null && !e.polarNight) ev.push('Civil twilight lasts all night; it never gets fully dark.');
  else if (e.dawn != null && e.dusk != null) ev.push(`Civil twilight from ${U.clock(e.dawn)} and until ${U.clock(e.dusk)}.`);
  ev.push(`Highest ${U.deg(e.maxAlt)} at ${U.clock(e.solarNoon)}.`);
  text('sun-events', ev.join(' '));
  computeBurn();
}

// ---------------------------------------------------------------- the Burn
// Direct sun on the marker for the day shown (js/sun.js), recomputed when the marker or date moves.
const spells = (w) => w.spans;
function computeBurn() {
  if (!events || !S.marker) return;
  const { y, mo, d } = S.date, m = S.marker;
  // Never below the 16 m grid the march runs over: at a col it stands above the 2 m point.
  const z = Math.max(terrain.heightAt(m.x, m.y), terrain.analysisHeight(m.x, m.y));
  burn = directSunWindow((x, yy) => terrain.analysisHeight(x, yy), m.x, m.y, z, y, mo, d,
    frame.centerLat, frame.centerLon, frame.convergence, terrain.maxM + 5);
  track.setModel({ id: `${dateKey(S.date)} ${m.x} ${m.y}`, alt: events.altApparent, lit: burn.lit });
  const sp = spells(burn), date = U.date(y, mo, d);
  const words = !burn.totalMinutes ? null : sp.length > 2
    ? ` in ${sp.length} spells from ${U.span(sp[0][0], sp[sp.length - 1][1])}` : `, ${sp.map(([a, b]) => U.span(a, b)).join(' and ')}`;
  text('cap', words ? `The burn: direct sun at the marker${markName ? `, ${markName}` : ''}${words} (${U.hm(burn.totalMinutes / 60)}). Terrain shadow only; no cloud.`
    : `No direct sun reaches the marker${markName ? ` at ${markName}` : ''} on ${date}: the sun climbs to ${U.deg(events.maxAlt)} and the terrain hides it.`);
  text('burn-desc', words ? `Direct sun on the marker from ${sp.map(([a, b]) => U.span(a, b)).join(' and ')}, ${U.hm(burn.totalMinutes / 60, 1)}.` : `No direct sun on the marker on ${U.date(y, mo, d, 0, 1)}.`);
  if (S.card === 'point') showPoint();
  if (sunInfo) timeWords();
  invalidate();
}

// ---------------------------------------------------------------- boot
async function boot() {
  // Read the stored camera before anything can overwrite it: a save before the restore would hand
  // back the default camera sitting at the origin.
  const savedCam = store.get('camera', null);
  data = new DataSet();
  await data.load((msg) => text('stamp', msg));
  frame = new Frame(data.manifest);
  projErr = frame.checkProjection();

  terrain = new Terrain(data, frame);
  mat = makeTerrainMaterial();
  terrain.setMaterial(mat);
  scene.add(terrain.group);
  terrain.buildAnalysisGrids((n) => data.note(n));

  const core = terrain.analysis.core, shell = terrain.analysis.shell;
  setGridRect(mat, 'uCore', core, frame);
  setGridRect(mat, 'uShell', shell, frame);
  shadowBuf = new Uint8Array(core.nx * core.ny);
  shellBuf = new Uint8Array(shell.nx * shell.ny);
  shadowCore = makeMaskTexture(shadowBuf, core.nx, core.ny);
  shadowShell = makeMaskTexture(shellBuf, shell.nx, shell.ny);
  mat.uniforms.uShadowCore.value = shadowCore;
  mat.uniforms.uShadowShell.value = shadowShell;

  // Water and glacier mask, on the same grid as the core analysis raster.
  mat.uniforms.uMask.value = buildMask(core, data.geo.water, data.geo.glaciers);
  setGridRect(mat, 'uMask', core, frame);
  viewshedTex = makeMaskTexture(new Uint8Array(core.nx * core.ny), core.nx, core.ny);
  mat.uniforms.uViewshedTex.value = viewshedTex;
  const veil = new THREE.Color(PLATE.viewshed.veil);
  mat.uniforms.uVeil.value.set(veil.r, veil.g, veil.b, PLATE.viewshed.veil_a);
  mat.uniforms.uTint.value = PLATE.viewshed.tint;

  route = new Route(data.geo.route, data.edit.waypoints);
  S.cursor = clamp(S.cursor, 0, Math.max(0, route.n - 1));

  buildOverlays();

  rig = new CameraRig(camera, canvas, terrain, frame, invalidate);
  profile = new Profile($('profile'), (i) => { setCursor(i, true); });
  profile.setRoute(route, S.reversed);
  track = createTrack($('slider'), $('track'), {
    onStart: () => setPlaying(false),
    onScrub: (k) => { want = { ...want, step: k }; invalidate(); },
    onKey: (k) => { setPlaying(false); want = { ...want, step: clamp(k === 'home' ? 0 : k === 'end' ? STEPS - 1 : S.minutes / 5 + k, 0, STEPS - 1) }; invalidate(); },
    onEnd: () => { save(); invalidate(); },
  });

  applyScheme();
  applyExaggeration(S.exag);
  buildLayerPanel();
  buildViewpointChips();
  buildAbout();
  wireUI();

  focus = setupFocus({
    onChange: (on) => { if (on) { closeCard(); closeDialog(false); } },
    toolActive: () => !!S.tool,
    say,
    dialogOpen: () => !!S.dialog,
  });

  if (!rig.restore(savedCam)) frameRoute();
  newDay();
  setCursor(S.cursor, false);
  applyLayerUniforms();
  updatePace();
  showNotices();

  onRegainFocus(async () => {
    const changed = await data.refetchEditable();
    if (!changed.length) return;
    if (changed.includes('colors')) applyScheme();
    if (changed.includes('waypoints')) { route.setWaypointNames(data.edit.waypoints); profile.build(); updateDirLabel(); }
    if (changed.includes('viewpoints')) buildViewpointChips();
    if (changed.includes('pace')) updatePace();
    if (changed.includes('about')) buildAbout();
    showNotices();
    setCursor(S.cursor, false);
    invalidate();
  });

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    scheme = e.matches ? 'dark' : 'light';
    applyScheme();
    invalidate();
  });

  // A read-only hook for tools/shoot.mjs; nothing in the app calls it.
  const r3 = (v) => Math.round(v * 1000) / 1000;
  window.__besseggen = {
    stats: () => ({
      tilesDrawn: terrain.stats.tiles, tileCap: MAX_TILES,
      trianglesSubmitted: terrain.stats.tiles * TRIS_PER_TILE,
      trianglesDrawn: renderer.info.render.triangles,
      drawCalls: renderer.info.render.calls,
      capped: terrain.stats.capped, built: terrain.stats.built,
      coreGrid: [terrain.analysis.core.nx, terrain.analysis.core.ny],
      shellGrid: [terrain.analysis.shell.nx, terrain.analysis.shell.ny],
      levels: terrain.levels.map((L) => ({ level: L.level, res: L.res, tiles: L.tiles.length })),
      timings: { ...timings },
      projectionErrMm: r3(projErr), convergenceDeg: r3(frame.convergence),
      lat: r3(frame.centerLat), lon: r3(frame.centerLon),
      sun: { azTrue: r3(sunInfo.az), altApparent: r3(sunInfo.elevApparent) },
      events: { sunrise: events.sunrise, sunset: events.sunset, dawn: events.dawn, dusk: events.dusk, maxAlt: r3(events.maxAlt), minAlt: r3(events.minAlt) },
      route: { n: route.n, lengthM: r3(route.length), ascentM: Math.round(route.ascent), highM: Math.round(route.z[route.highIdx] || 0) },
      lakes: waterMesh.userData.lakes || [],
      waterTriangles: waterMesh.userData.triangles || 0,
      notices: data.notices,
      bytes: data.bytes,
    }),
    sunAt: (y, mo, d, min) => sunAt(y, mo, d, min, frame.centerLat, frame.centerLon),
    dayEvents: (y, mo, d) => {
      const e = dayEvents(y, mo, d, frame.centerLat, frame.centerLon);
      return { sunrise: e.sunrise, sunset: e.sunset, dawn: e.dawn, dusk: e.dusk, maxAlt: e.maxAlt, minAlt: e.minAlt, polarDay: e.polarDay };
    },
    heightAt: (x, y) => terrain.heightAt(x, y),
    camera: () => ({
      mode: rig.mode, pos: camera.position.toArray().map(r3), target: rig.controls.target.toArray().map(r3),
      fovDeg: r3(camera.fov), distM: r3(camera.position.distanceTo(rig.controls.target)),
    }),
    project: (x, y) => { const p = projectScene(frame.sx(x), terrain.heightAt(x, y), frame.sz(y)); return p && { x: p.x, y: p.y }; },
    setLayer: (id, on) => { S.layers[id] = !!on; applyLayerUniforms(); },
    applyViewpoint: (i) => {
      const list = (data.edit.viewpoints && data.edit.viewpoints.viewpoints) || [];
      if (list[i]) rig.applyViewpoint(list[i]);
      return list[i] && list[i].name;
    },
    setDateTime: (mo, d, min) => { want = { date: { ...S.date, mo, d }, step: Math.round(min / 5) }; invalidate(); },
    setMarker: (x, y) => setMarker({ x, y }, false),
    // Run a tool the way a tap would, so the verification exercises the real code path.
    runTool: (id, pts) => {
      const hits = pts.map(([x, y]) => ({ x, y, elevM: terrain.heightAt(x, y) }));
      ({ measure: runMeasure, los: runLos, viewshed: runViewshed })[id](...hits);
      return $('card').textContent.replace(/\s+/g, ' ').trim();
    },
    setEye: (m) => { S.eyeM = m; $('eye-h').value = String(m); slid($('eye-h')); },
    peaksFrom: (x, y, eye) => {
      const z = terrain.analysisHeight(x, y) + (eye ?? 1.7);
      return visiblePeaks(data.geo.places, (a, b) => terrain.analysisHeight(a, b), frame, x, y, z,
        { maxDist: 25000 }).map((k) => ({ name: k.name, elevM: Math.round(k.elevM), distM: Math.round(k.dist), bearing: Math.round(k.bearing) }));
    },
    los: (ax, ay, bx, by) => {
      const r = lineOfSight((x, y) => terrain.heightAt(x, y), ax, ay, 1.7, bx, by, 0);
      return { clear: r.clear, distM: Math.round(r.dist), worstM: Math.round(r.worst * 10) / 10, blocks: r.blocks.length };
    },
    viewshedVisible: (x, y) => cellOf(x, y, (i) => viewshedTex.image.data[i] > 0),
    shadowAt: (x, y) => cellOf(x, y, (i) => (shadowBuf[i] > 0 ? 'lit' : 'shadow')),
    burn: () => burn && { first: burn.first, last: burn.last, total: burn.totalMinutes, spans: spells(burn), lit: burn.lit.map(Number).join(''), marker: S.marker },
    shown: () => S.minutes / 5,
    wanted: () => track.wanted,
    focus: () => focus.isOn(),
    setFocus: (on) => focus.set(on),
    state: () => ({ shown: S.minutes / 5, date: { ...S.date }, playing: !!play, sheet: S.sheet, dialog: S.dialog, card: S.card, tool: S.tool, focus: focus.isOn(), sun: sunInfo.key, shadow: shadowKey, label: $('t-date').textContent, caption: $('cap').textContent }),
    log: (on) => { logOn = on; const out = flog; if (on) flog = []; return out; },
    labels: () => placedLabels,
  };

  new ResizeObserver(onResize).observe($('plate'));
  onResize();
  applyTime();
  text('stamp', `${(data.edit.about.terrain || {}).owner || 'Kartverket'} data, retrieved ${U.iso((data.edit.about.terrain || {}).retrieved || data.manifest.source.retrieved)}`);
  for (const e of $$('[data-boot]')) e.removeAttribute('hidden');
  $('player').inert = false;
  // Canvas text and the labels' widths wait for the face.
  await document.fonts.load('560 11.5px "Ysabeau Office"').catch(() => {});
  widths.clear(); profile.relayout(); track.invalidate();
  document.fonts.addEventListener('loadingdone', () => { widths.clear(); profile.relayout(); track.invalidate(); invalidate(); });
  invalidate();
}

const cellOf = (x, y, f) => {
  const g = terrain.analysis.core;
  const c = Math.round((x - g.x0) / g.res), r = Math.round((g.y1 - y) / g.res);
  return c < 0 || r < 0 || c >= g.nx || r >= g.ny ? null : f(r * g.nx + c);
};

function onResize() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  for (const m of [routeLine, connLine, riverLine, toolLine, markerLine]) m.material.uniforms.uRes.value.set(w, h);
  // the key column becomes a row along the plate's top when the plate is too short for it
  $('plate').classList.toggle('keys-row', h < 258);
  // The profile's labels are counter-scaled against the width the strip was given, so they have
  // to be measured again whenever that width changes.
  profile.relayout();
  track.resize();
  invalidate();
}

function frameWholeModel() {
  const c = data.manifest.core;
  rig.frameBox(new THREE.Box3(
    new THREE.Vector3(frame.sx(c.x0), terrain.minM, frame.sz(c.y1)),
    new THREE.Vector3(frame.sx(c.x1), terrain.maxM, frame.sz(c.y0)),
  ), 34, 200);
}

// The opening view: standing east of Gjendesheim looking west along the whole walk, which is the
// way the ridge is normally photographed and the only angle where both lakes are visible at once.
function frameRoute() {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k < route.n; k++) {
    x0 = Math.min(x0, route.x[k]); x1 = Math.max(x1, route.x[k]);
    y0 = Math.min(y0, route.y[k]); y1 = Math.max(y1, route.y[k]);
  }
  if (!Number.isFinite(x0)) { frameWholeModel(); return; }
  rig.frameBox(new THREE.Box3(
    new THREE.Vector3(frame.sx(x0 - 2000), terrain.minM, frame.sz(y1 + 2500)),
    new THREE.Vector3(frame.sx(x1 + 2000), terrain.maxM, frame.sz(y0 - 2500)),
  ), 24, 95);
}

// ---------------------------------------------------------------- overlays
// The trail, the marker's stick and the tool line sit on a pale casing (ART.md section 2).
function cased(m) {
  const u = m.uniforms, w = u.uWidth.value, c = new THREE.Color(PLATE.casing.color);
  u.uWidth.value = w + 2 * PLATE.casing.px;
  u.uCore.value = w / u.uWidth.value;
  u.uCase.value.set(c.r, c.g, c.b, PLATE.casing.alpha);
  return m;
}
const lineMesh = (geo, m, order) => { const o = new THREE.Mesh(geo, m); o.frustumCulled = false; o.renderOrder = order; scene.add(o); return o; };
const runsOf = (g) => (g && g.type === 'LineString' ? [g.coordinates] : g && g.type === 'MultiLineString' ? g.coordinates : []);

function buildOverlays() {
  const sample = (x, y) => terrain.heightAt(x, y);
  lineMat = cased(makeLineMaterial(0xc0392b, 3.4));
  routeLine = lineMesh(buildLine(lineFeatureToPoints((route.main && route.main.geometry.coordinates) || [], frame, sample, 0)), lineMat, 4);

  // Connectors and rivers are merged into one geometry each: the real rivers layer is hundreds
  // of features, and hundreds of draw calls cost a phone more than the triangles do.
  const merged = (feats) => buildLines(feats.flatMap((f) => runsOf(f.geometry).map((co) => lineFeatureToPoints(co, frame, sample, 0))));
  const connMat = makeLineMaterial(0x2c3e50, 2.0);
  connMat.uniforms.uOpacity.value = 0.85;
  connLine = lineMesh(merged(route.connectors), connMat, 3);
  const riverMat = makeLineMaterial(0x6f93b5, 1.6);
  riverMat.uniforms.uOpacity.value = 0.8;
  riverLine = lineMesh(merged(data.geo.rivers.features || []), riverMat, 2);

  const w = buildWater(data.geo.water, frame, 8);
  waterMat = makeWaterMaterial();
  waterMesh = lineMesh(w.geo, waterMat, 1);
  waterMesh.userData = w;

  const toolMat = cased(makeLineMaterial(0x111418, 2.6));
  toolMat.uniforms.uLift.value = 6;
  toolLine = lineMesh(new THREE.BufferGeometry(), toolMat, 6);
  toolLine.visible = false;
  const markMat = cased(makeLineMaterial(0x111418, 2.2));
  markMat.uniforms.uLift.value = 0;
  markerLine = lineMesh(new THREE.BufferGeometry(), markMat, 7);
  markerLine.visible = false;
}

// The plate is drawn from colors.json's light block in both themes (owner call 2); the profile's
// steep red reads the current theme's block.
function applyScheme() {
  const colors = data.edit.colors, L = 'light';
  applyPalette(mat, colors, L, data.manifest.elevation);
  scene.background = colorOf(colors, L, 'sky', '#dfe7ef');
  lineMat.uniforms.uColor.value.copy(colorOf(colors, L, 'route', '#c0392b'));
  connLine.material.uniforms.uColor.value.copy(colorOf(colors, L, 'routeAlt', '#2c3e50'));
  riverLine.material.uniforms.uColor.value.copy(colorOf(colors, L, 'water', '#9fb9cf'));
  waterMat.uniforms.uColor.value.copy(colorOf(colors, L, 'water', '#9fb9cf'));
  markerLine.material.uniforms.uColor.value.copy(colorOf(colors, L, 'marker', '#111418'));
  toolLine.material.uniforms.uColor.value.copy(colorOf(colors, L, 'marker', '#111418'));
  const pick = (s, k, d) => ((colors && colors[s]) || {})[k] || d;
  const root = document.documentElement.style;
  root.setProperty('--trail', pick(scheme, 'route', '#c0392b'));
  root.setProperty('--route', pick(L, 'route', '#c0392b'));
  legends();
  if (track) track.invalidate();
}

function applyExaggeration(v) {
  S.exag = v;
  terrain.setExaggeration(v);
  mat.uniforms.uExag.value = v;
  waterMat.uniforms.uExag.value = v;
  for (const m of [routeLine, connLine, riverLine, toolLine, markerLine]) m.material.uniforms.uExag.value = v;
  text('exag-out', v === 1 ? 'True scale' : `×${U.fixed(v, 1)}`);
  invalidate();
}

// ---------------------------------------------------------------- cursor and marker
function setCursor(i, fromProfile, persist = true) {
  S.cursor = clamp(i | 0, 0, Math.max(0, route.n - 1));
  profile.setCursor(S.cursor);
  const r = route;
  const dist = r.dirDist(S.cursor, S.reversed);
  const t = timeForSegments(r, S.cursor, S.reversed ? 0 : r.n - 1, effectivePace());
  text('s-dist', U.dist(dist));
  text('s-elev', U.m(r.z[S.cursor]));
  text('s-grad', U.pct(r.gradientAt(S.cursor) * 100));
  text('s-time', U.hm(t.hours));
  const upto = S.reversed
    ? { up: r.descent - r.descentTo[S.cursor], down: r.ascent - r.ascentTo[S.cursor] }
    : { up: r.ascentTo[S.cursor], down: r.descentTo[S.cursor] };
  text('s-updown', `${U.m(upto.up)} up and ${U.m(upto.down)} down so far, of ${U.m(r.props.ascentM ?? r.ascent)} up in all. Red: 25${U.NN}% or steeper.`);
  if (rig && rig.mode !== 'orbit' && !rig.flying && fromProfile) {
    // routeT is measured along the direction being walked, so it mirrors with the direction.
    rig.placeOnRoute(r, S.reversed ? 1 - r.cum[S.cursor] / r.length : r.cum[S.cursor] / r.length, S.reversed, rig.eyeM, true);
  }
  setMarker({ x: r.x[S.cursor], y: r.y[S.cursor], z: r.z[S.cursor] }, false);
  if (persist) save();
  invalidate();
}

let markName = '';
function setMarker(m, updateCursor = true) {
  const moved = !S.marker || S.marker.x !== m.x || S.marker.y !== m.y;
  const was = markName;
  markName = (route.waypoints.find((w) => Math.hypot(w.x - m.x, w.y - m.y) < 30) || {}).name || '';
  S.marker = { x: m.x, y: m.y };
  const z = Number.isFinite(m.z) ? m.z : terrain.heightAt(m.x, m.y);
  const sx = frame.sx(m.x), sz = frame.sz(m.y);
  markerLine.geometry.dispose();
  markerLine.geometry = buildLine(new Float64Array([sx, z, sz, sx, z + 90, sz]));
  markerLine.visible = true;
  markerLine.userData = { x: m.x, y: m.y, z };
  if (updateCursor) {
    const near = route.n ? route.nearestIndex(m.x, m.y) : null;
    if (near && near.dist < 180) setCursor(near.i, false);
  }
  if (moved || !burn || was !== markName) computeBurn();
  invalidate();
}

function effectivePace() {
  const p = JSON.parse(JSON.stringify(data.edit.pace || {}));
  if (S.paceModel) p.model = S.paceModel;
  if (S.paceFit) p.fitnessFactor = S.paceFit;
  return p;
}

// ---------------------------------------------------------------- the card
// One card, for the tapped point or a tool's result (HOUSE.md 4.7), moved down if it would cover it.
const row = (k, v) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`;
let cardAt = null, cardShownAt = 0;
function setCard(id, kind, num, unit, html, at) {
  const wasOpen = !!S.card;
  S.card = id; cardAt = at;
  text('card-kind', kind);
  text('card-num', num);
  text('card-unit', unit ? `${U.NN}${unit}` : '');
  $('card-body').innerHTML = html;
  $('card').hidden = false;
  if (!wasOpen) cardShownAt = performance.now();
  placeCard();
  invalidate();
}
function closeCard() { if (S.card !== 'point' && toolLine) toolLine.visible = false; S.card = null; $('card').hidden = true; invalidate(); }
function placeCard() {
  const c = $('card');
  if (c.hidden) return;
  c.classList.remove('low');
  if (!cardAt) return;
  const p = projectScene(frame.sx(cardAt.x), cardAt.z, frame.sz(cardAt.y));
  const b = c.getBoundingClientRect();
  if (p && p.x < b.width + 20 && p.y < b.height + 20) c.classList.add('low');
}
function showPoint(announce) {
  const m = S.marker, z = terrain.heightAt(m.x, m.y), { y, mo, d } = S.date;
  const near = route.nearestIndex(m.x, m.y), wps = route.waypoints, from = wps.length ? wps[S.reversed ? wps.length - 1 : 0].name : 'the start';
  const kind = near.dist < 30 ? `On the trail, ${U.dist(route.dirDist(near.i, S.reversed))} from ${from}` : 'Tapped point';
  const [lon, lat] = frame.lonLat(m.x, m.y), sp = spells(burn);
  const sun = burn.totalMinutes ? `${U.date(y, mo, d)}, ${U.span(sp[0][0], sp[sp.length - 1][1])}` : `none on ${U.date(y, mo, d)}`;
  setCard('point', kind, U.int(z), 'm', `<dl>${row('Position', U.pos(lon, lat)) + row('Direct sun', sun)
    + (burn.totalMinutes ? row('Total', U.hm(burn.totalMinutes / 60)) : '')
    + (sp.length > 1 ? row('Spells', sp.map(([a, b]) => U.span(a, b)).join(', ')) : '')}</dl>`, { x: m.x, y: m.y, z });
  if (announce) {
    say(`${kind}, ${U.int(z)} meters. ${burn.totalMinutes ? `Direct sun on ${U.date(y, mo, d, 0, 1)} from ${U.span(sp[0][0], sp[sp.length - 1][1])}.` : `No direct sun on ${U.date(y, mo, d, 0, 1)}.`}`);
  }
}

// ---------------------------------------------------------------- picking
// One finger down and up again without moving is a tap, and a tap picks. Two of those inside
// 300 ms and within a thumb's width of each other is a double-tap, which toggles focus mode.
// The first tap of a pair is never held back: it picks straight away. The second tap only
// toggles; it does not pick again, which would spend a tool's second point.
const DOUBLE_MS = 300, DOUBLE_SLOP = 32;
let tap = null, lastTap = null;
const down = new Set();
canvas.addEventListener('pointerdown', (e) => {
  down.add(e.pointerId);
  // A second finger means a pinch or a two-finger pan, and neither is a tap of any kind.
  if (down.size > 1) { tap = null; lastTap = null; return; }
  tap = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
});
canvas.addEventListener('pointerup', (e) => {
  down.delete(e.pointerId);
  if (!tap || e.pointerId !== tap.id) { tap = null; return; }
  // event times: a busy frame must not stretch a double-tap
  const moved = Math.hypot(e.clientX - tap.x, e.clientY - tap.y), now = e.timeStamp;
  const dt = now - tap.t;
  tap = null;
  if (!(moved < 10 && dt < 600)) { lastTap = null; return; }
  if (lastTap && now - lastTap.t < DOUBLE_MS
      && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_SLOP
      && focus && focus.toggle('tap')) {
    lastTap = null;
    return;
  }
  lastTap = { x: e.clientX, y: e.clientY, t: now };
  onTap(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', (e) => { down.delete(e.pointerId); tap = null; lastTap = null; });

function pickTerrain(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
  return terrain.raycast(raycaster.ray.origin, raycaster.ray.direction);
}

function onTap(cx, cy) {
  if (!route) return;
  const hit = pickTerrain(cx, cy);
  if (!hit) return;
  if (S.tool) { toolPoint(hit); return; }
  setMarker(hit, true);
  showPoint(true);
}

// ---------------------------------------------------------------- tools
const TOOLS = {
  measure: { name: 'Measure', points: 2, hint: 'Tap two points to measure between them.', next: 'Now tap the second point.' },
  los: { name: 'Line of sight', points: 2, hint: 'Tap the eye, then what you want to see.', next: 'Now tap what you want to see.' },
  viewshed: { name: 'Viewshed', points: 1, hint: 'Tap a viewpoint to see what it can see.' },
};
let picked = [], lastRun = null;

function setTool(id) {
  S.tool = S.tool === id ? null : id;
  picked = [];
  for (const b of $$('#tool-words [data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === S.tool));
  if (!S.tool) toolLine.visible = false;
  toolCaption();
  invalidate();
}
// While a tool waits for points its instruction replaces the caption.
function toolCaption(t) {
  const def = TOOLS[S.tool];
  $('cap').hidden = !!def;
  text('cap-tool', def ? t || def.hint : '');
}

function toolPoint(hit) {
  const def = TOOLS[S.tool];
  picked.push(hit);
  if (picked.length < def.points) { toolCaption(def.next); setMarker(hit, false); return; }
  ({ measure: runMeasure, los: runLos, viewshed: runViewshed })[S.tool](...picked);
  picked = [];
  toolCaption();
}

function drawToolLine(arr, t, split) {
  toolLine.geometry.dispose();
  toolLine.geometry = buildLine(arr, t);
  toolLine.material.uniforms.uSplit.value = split;
  toolLine.visible = true;
  invalidate();
}

function runMeasure(a, b) {
  const m = measure((x, y) => terrain.heightAt(x, y), a.x, a.y, b.x, b.y);
  const n = 64, arr = new Float64Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    const f = i / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    arr[i * 3] = frame.sx(x); arr[i * 3 + 1] = terrain.heightAt(x, y) + 4; arr[i * 3 + 2] = frame.sz(y);
  }
  drawToolLine(arr, null, -1);
  const bearing = frame.trueBearing(a.x, a.y, b.x, b.y);
  setCard('measure', 'Measure', ...U.dist(m.horiz).split(U.NN), '<dl>'
    + row('Straight line', U.dist(m.slant))
    + row('Height difference', U.signed(m.dz))
    + row('Average gradient', `${U.pct(m.gradient * 100)}, ${U.deg(m.angleDeg)}`)
    + row('Bearing', `${U.deg(bearing, 0)} ${U.wind(bearing)}, true`)
    + '</dl><p class="note">Horizontal distance. Heights from the finest terrain level loaded at each end.</p>', b);
}

function runLos(a, b) {
  const eyeA = S.eyeM;
  lastRun = { id: 'los', pts: [a, b] };
  const los = lineOfSight((x, y) => terrain.heightAt(x, y), a.x, a.y, eyeA, b.x, b.y, 0);
  const n = los.n, arr = new Float64Array((n + 1) * 3), tv = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const f = i / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
    arr[i * 3] = frame.sx(x); arr[i * 3 + 1] = los.sight[i]; arr[i * 3 + 2] = frame.sz(y);
    tv[i] = f;
  }
  // Solid where the sight is clear, dashed past the first blocking stretch.
  drawToolLine(arr, tv, los.clear ? -1 : los.blocks[0].from);

  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= n; i++) { lo = Math.min(lo, los.prof[i], los.sight[i]); hi = Math.max(hi, los.prof[i], los.sight[i]); }
  const W = 300, H = 88, pad = 4;
  const X = (i) => (i / n) * W;
  const Y = (z) => pad + (1 - (z - lo) / Math.max(1, hi - lo)) * (H - pad * 2);
  let terr = `M0 ${H}`;
  for (let i = 0; i <= n; i++) terr += `L${X(i).toFixed(1)} ${Y(los.prof[i]).toFixed(1)}`;
  terr += `L${W} ${H}Z`;
  const sight = `M0 ${Y(los.sight[0]).toFixed(1)}L${W} ${Y(los.sight[n]).toFixed(1)}`;
  const at = U.dist(los.worstAt * los.dist);
  setCard('los', 'Line of sight', ...U.dist(los.dist).split(U.NN), '<dl>'
    + row('Eye', `${U.m(los.az)}, ${U.unit(U.fixed(eyeA, 1), 'm')} above the ground`)
    + row('Target', U.m(los.bz))
    + row('Verdict', los.clear ? (los.grazes ? (Math.abs(los.worst) < 0.1
      ? `clear, but only just: the line grazes the ground at ${at}`
      : `clear, but only just: the line passes within ${U.m(Math.abs(los.worst))} of the ground at ${at}`) : 'clear')
      : `blocked by up to ${U.m(los.worst)} at ${at}`)
    + `</dl><svg class="xs" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Terrain cross-section with the sight line">`
    + `<path class="terr" d="${terr}"/><path class="sight${los.clear ? '' : ' blocked'}" d="${sight}"/></svg>`, b);
}

function runViewshed(p) {
  const core = terrain.analysis.core, eye = S.eyeM;
  lastRun = { id: 'viewshed', pts: [p] };
  const t0 = performance.now();
  const vs = viewshed(core, p.x, p.y, eye, Math.min(25000, (core.x1 - core.x0) * 0.75), (x, y) => terrain.analysisHeight(x, y));
  timings.viewshedMs = performance.now() - t0;
  viewshedTex.image.data.set(vs.mask);
  viewshedTex.needsUpdate = true;
  mat.uniforms.uHasViewshed.value = 1;
  S.layers.viewshed = true;
  viewshedInfo = { x: p.x, y: p.y, eyeZ: vs.eyeZ };
  applyLayerUniforms();
  toolLine.visible = false;
  const peaks = visiblePeaks(data.geo.places, (x, y) => terrain.analysisHeight(x, y), frame, p.x, p.y, vs.eyeZ, { maxDist: vs.radiusM });
  let lit = 0;
  for (let i = 0; i < vs.mask.length; i++) if (vs.mask[i]) lit++;
  setMarker(p, false);
  setCard('viewshed', 'Viewshed', U.fixed((lit / vs.mask.length) * 100, 1), '%', '<p class="note">of the detailed box is seen from here</p><dl>'
    + row('Eye', `${U.m(vs.eyeZ)}, ${U.unit(U.fixed(eye, 1), 'm')} above the ground`)
    + row('Radius', U.dist(vs.radiusM))
    + row('Rays', `${U.int(vs.nAz)} azimuths, ${U.m(core.res)} steps`)
    + row('Target', `a person ${U.m(vs.targetAboveGround)} tall standing there`)
    + '</dl>'
    + (peaks.length
      ? `<ul class="peaks">${peaks.map((k) => `<li><span translate="no">${escapeHtml(k.name || 'Unnamed')}</span><span>${escapeHtml(U.m(k.elevM))}</span>`
        + `<span>${escapeHtml(`${U.dist(k.dist)} ${U.wind(k.bearing)}`)}</span></li>`).join('')}</ul>`
      : '<p class="note">No named peak in places.geojson is visible from here.</p>')
    + `<p class="note">Marched on the ${escapeHtml(U.m(core.res))} analysis grid inside the detailed box only. Bearings are true, `
    + `corrected for the ${escapeHtml(U.deg(frame.convergence, 2))} grid convergence. A viewpoint on a convex summit hides much of `
    + 'its own slope from an eye just above the ground: that is the geometry. Raise the eye height to see how far it reaches.</p>', p);
}

// ---------------------------------------------------------------- labels
const labelBox = $('labels');
const _v = new THREE.Vector3();
function projectScene(x, y, z) {
  _v.set(x, y * S.exag, z).project(camera);
  if (_v.z > 1 || _v.z < -1) return null;
  const r = canvas.getBoundingClientRect();
  return { x: (_v.x * 0.5 + 0.5) * r.width, y: (-_v.y * 0.5 + 0.5) * r.height, z: _v.z };
}
function zoomBand() {
  const d = camera.position.distanceTo(rig.controls.target);
  return d > 25000 ? 0 : d > 9000 ? 1 : d > 3000 ? 2 : 3;
}
// A label is worth drawing only if the thing it names can actually be seen. The occlusion test
// is the same ray-march the line-of-sight tool uses, from the camera to the point, on the
// analysis grid: it stops a summit label floating over the valley in front of it.
function labelVisible(x, y, z) {
  const cx = frame.wx(camera.position.x), cy = frame.wy(camera.position.z);
  const cz = camera.position.y / Math.max(S.exag, 0.001);
  const dist = Math.hypot(x - cx, y - cy);
  if (dist < 60) return true;
  return visibleFrom((ax, ay) => terrain.analysisHeight(ax, ay), cx, cy, cz, x, y, z + 8, clamp(dist / 140, 24, 400));
}
// Widths measured in the face once it has loaded.
const widths = new Map(), mctx = document.createElement('canvas').getContext('2d');
const FONTS = { wp: '560 11.5px', peak: '400 11px', km: '400 10.5px', mark: '560 11.5px', sub: '400 10.5px' };
function textW(s, f) {
  const k = `${f}|${s}`;
  if (!widths.has(k)) { mctx.font = `${FONTS[f]} "Ysabeau Office", system-ui, sans-serif`; widths.set(k, mctx.measureText(s).width); }
  return widths.get(k);
}

const LABEL_LIMIT = 26;
let placedLabels = [];
function updateLabels() {
  if (!S.layers.labels) { if (labelBox.childElementCount) labelBox.textContent = ''; placedLabels = []; return; }
  const band = zoomBand();
  const items = [];
  for (const w of route.waypoints) items.push({ cls: 'wp', name: w.name, sub: U.m(w.elevM), x: w.x, y: w.y, z: w.elevM, pri: 1000 });
  for (const f of (data.geo.places.features || [])) {
    const p = f.properties || {};
    if ((p.showAt ?? 3) > band) continue;
    const c = f.geometry.coordinates;
    items.push({
      cls: 'peak', name: p.name, sub: p.kind === 'peak' || p.kind === 'ridge' ? U.m(p.elevM ?? c[2]) : '',
      x: c[0], y: c[1], z: c[2] ?? terrain.heightAt(c[0], c[1]), pri: (p.relief1kmM ?? 0) + (p.elevM ?? 0) / 20,
    });
  }
  if (band >= 2) {
    for (const mk of (route.kmMarks || [])) {
      const i = clamp(mk.i | 0, 0, route.n - 1);
      const km = S.reversed ? Math.round((route.length - route.cum[i]) / 1000) : mk.km;
      items.push({ cls: 'km', name: U.unit(km, 'km'), sub: '', x: route.x[i], y: route.y[i], z: route.z[i], pri: 5 });
    }
  }
  if (markerLine.visible) {
    const m = markerLine.userData;
    items.push({ cls: 'mark', name: markName ? `${markName}, ${U.m(m.z)}` : U.m(m.z), sub: '', x: m.x, y: m.y, z: m.z + 90, pri: 2000, noOcclude: true });
  }
  items.sort((a, b) => b.pri - a.pri);

  // Labels keep out of the card, the keys and the ghost key (HOUSE.md section 4.7; ART.md B1).
  const r = canvas.getBoundingClientRect(), keep = [];
  for (const id of ['card', 'keys', 'focus-exit']) {
    const e = $(id), b = e.getBoundingClientRect();
    if (!e.hidden && b.width) keep.push({ x: (b.left + b.right) / 2 - r.left, y: (b.top + b.bottom) / 2 - r.top, w: b.width + 8, h: b.height + 8 });
  }
  const placed = [];
  let html = '', n = 0, tested = 0;
  for (const it of items) {
    if (n >= LABEL_LIMIT || tested > 90) break;
    const p = projectScene(frame.sx(it.x), it.z, frame.sz(it.y));
    if (!p) continue;
    if (p.x < 6 || p.y < 6 || p.x > r.width - 6 || p.y > r.height - 6) continue;
    const name = String(it.name || '');
    const w = Math.max(textW(name, it.cls), it.sub ? textW(it.sub, 'sub') : 0) + (it.cls === 'wp' ? 21 : 12);
    const h = it.sub ? 30 : 18;
    // Slide a label back inside the frame rather than dropping it.
    if (w < r.width - 12) p.x = clamp(p.x, w / 2 + 4, r.width - w / 2 - 4);
    p.y = clamp(p.y, h + 4, r.height - 4);
    const box = { x: p.x, y: p.y - h / 2, w, h };
    const hit = (q) => Math.abs(q.x - box.x) * 2 < q.w + w && Math.abs(q.y - box.y) * 2 < q.h + h;
    if (placed.some(hit) || keep.some(hit)) continue;
    tested++;
    if (!it.noOcclude && !labelVisible(it.x, it.y, it.z)) continue;
    placed.push(box);
    n++;
    html += `<span class="lbl ${it.cls}" translate="no" style="transform:translate(${Math.round(p.x)}px,${Math.round(p.y)}px) translate(-50%,-100%)">`
      + `<span>${escapeHtml(name)}</span>${it.sub ? `<small>${escapeHtml(it.sub)}</small>` : ''}</span>`;
  }
  placedLabels = placed;
  labelBox.innerHTML = html;
}

// ---------------------------------------------------------------- the instrument line: north and the scale
const SCALE_STEPS = [1, 1.5, 2, 2.5, 3, 5, 7.5];
// A scale bar in a perspective view is only true at one depth, so the depth has to be the ground
// the viewer is looking at: the center of the screen. If the center ray misses the terrain
// (looking at the sky) the orbit target is the fallback.
function gaugeReference() {
  const r = canvas.getBoundingClientRect();
  const hit = pickTerrain(r.left + r.width / 2, r.top + r.height / 2);
  if (hit) return { x: frame.sx(hit.x), y: hit.elevM, z: frame.sz(hit.y), onGround: true };
  const t = rig.controls.target;
  return { x: t.x, y: t.y / Math.max(S.exag, 0.001), z: t.z, onGround: false };
}

function updateGauge() {
  const ref = gaugeReference();
  const camDist = Math.hypot(camera.position.x - ref.x, camera.position.y - ref.y * S.exag, camera.position.z - ref.z);
  const d = Math.max(1, camDist * 0.02);
  const p0 = projectScene(ref.x, ref.y, ref.z);
  if (!p0) return;
  const pe = projectScene(ref.x + d, ref.y, ref.z);
  // Grid north is -Z; true north is that turned by the grid convergence.
  const cv = frame.convergence * DEG;
  const pnT = projectScene(ref.x - d * Math.sin(cv), ref.y, ref.z - d * Math.cos(cv));
  const pnG = projectScene(ref.x, ref.y, ref.z - d);
  if (!pe || !pnT || !pnG) return;
  const acrossPx = Math.hypot(pe.x - p0.x, pe.y - p0.y);
  const ppm = acrossPx / d;
  if (ppm > 0 && Number.isFinite(ppm)) {
    let best = 0, err = Infinity;
    for (let e = -1; e <= 5; e++) {
      for (const st of SCALE_STEPS) {
        const m = st * 10 ** e, x = Math.abs(Math.log(m * ppm / 80));
        if (x < err) { err = x; best = m; }
      }
    }
    const short = (v) => U.fixed(v, Number.isInteger(v) ? 0 : Number.isInteger(v * 10) ? 1 : 2);
    text('scale-len', best >= 1000 ? U.unit(short(best / 1000), 'km') : U.unit(short(best), 'm'));
    attr($('scale-bar'), 'style', `width:${Math.max(8, Math.round(best * ppm))}px`);
    // Say where the bar is true: one scale cannot hold across a perspective view.
    text('scale-sub', `${ref.onGround ? `at ${U.dist(camDist)}, ` : ''}vertical ×${U.fixed(S.exag, 1)}`);
  }
  const ang = (p, el) => {
    const dx = p.x - p0.x, dy = p.y - p0.y;
    const a = Math.atan2(dx, -dy) * RAD;
    const k = clamp(Math.hypot(dx, dy) / Math.max(acrossPx, 0.001), 0.3, 1);
    attr(el, 'transform', `translate(12 12) rotate(${Math.round(a)}) scale(1 ${Math.round(k * 100) / 100}) translate(-12 -12)`);
    return a;
  };
  const aT = ang(pnT, $('needle'));
  ang(pnG, $('gridn'));
  attr($('cn'), 'x', Math.round(120 + 95 * Math.sin(aT * DEG)) / 10);
  attr($('cn'), 'y', Math.round(120 - 95 * Math.cos(aT * DEG)) / 10);
  attr($('compass'), 'aria-label', `Compass: true north is ${U.int(((-aT % 360) + 360) % 360)} degrees from the top of the view. `
    + `The dashed arm is UTM grid north, ${U.fixed(Math.abs(frame.convergence), 1)} degrees away.`);
}

// ---------------------------------------------------------------- layers
const LAYERS = [
  ['sun', 'Sunlight', 'Lit from the real solar position for the date and time'],
  ['shadow', 'Cast shadows', 'Swept over the height grid, not a guess from the slope'],
  ['hillshade', 'Hillshade', 'The mapmaker’s fixed lamp from the northwest'],
  ['slope', 'Slope angle', '30° and 40° picked out, measured on the true surface'],
  ['bands', 'Elevation bands', 'Colors from data/colors.json'],
  ['contour20', `Contours, 20${U.NN}m`, ''],
  ['contour100', `Contours, 100${U.NN}m`, ''],
  ['water', 'Water surfaces', ''],
  ['glacier', 'Glaciers', ''],
  ['rivers', 'Rivers and streams', ''],
  ['route', 'The trail', 'Turrutebasen, draped on the terrain'],
  ['viewshed', 'Viewshed', 'Shown once the Viewshed tool has run'],
  ['labels', 'Place names', ''],
];
function buildLayerPanel() {
  const box = $('layer-rows');
  box.innerHTML = LAYERS.map(([id, name, sub]) => `<button type="button" class="layer-row" data-layer="${id}" aria-pressed="false">`
    + `<span class="box"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7"/></svg></span>`
    + `<span><span class="t">${escapeHtml(name)}</span>${sub ? `<span class="s">${escapeHtml(sub)}</span>` : ''}</span></button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-layer]');
    if (!b) return;
    S.layers[b.dataset.layer] = !S.layers[b.dataset.layer];
    applyLayerUniforms();
    save();
  });
}
function applyLayerUniforms() {
  const u = mat.uniforms, L = S.layers;
  for (const [k, id] of [['uLayerSun', 'sun'], ['uLayerShadow', 'shadow'], ['uLayerHill', 'hillshade'], ['uLayerSlope', 'slope'], ['uLayerBands', 'bands'],
    ['uLayerC20', 'contour20'], ['uLayerC100', 'contour100'], ['uLayerGlacier', 'glacier'], ['uLayerWater', 'water'], ['uLayerViewshed', 'viewshed']]) u[k].value = L[id] ? 1 : 0;
  waterMesh.visible = !!L.water;
  routeLine.visible = connLine.visible = !!L.route;
  riverLine.visible = !!L.rivers;
  for (const b of $$('#layer-rows [data-layer]')) b.setAttribute('aria-pressed', String(!!L[b.dataset.layer]));
  // The lake levels the planes are drawn at are the lidar's, with N50's whole meter beside it (B5).
  const lakes = (waterMesh.userData.lakes || []).filter((l) => l.name).slice(0, 4);
  text('layer-note', lakes.length ? `Lake surfaces are drawn at the water level the lidar reads: ${lakes.map((l) => `${l.name} ${U.unit(U.fixed(l.levelM, 1), 'm')}`
    + (l.n50Hoyde != null && Math.abs(l.n50Hoyde - l.levelM) > 0.15 ? ` (N50: ${U.m(l.n50Hoyde)})` : '')).join(', ')}.` : '');
  legends();
  invalidate();
}

// A legend row for each layer read through a color.
function legends() {
  if (!mat) return;
  const c = data.edit.colors || {}, L = c.light || {}, pct = (v) => `${Math.round(v * 1000) / 10}%`;
  const show = (id, on) => { $(id).hidden = !on; };
  show('lg-slope', S.layers.slope);
  $('lb-slope').style.background = `linear-gradient(90deg, transparent 50%, ${L.slope30} 50% 66.67%, ${L.slope40} 66.67%)`;
  const bands = c.elevationBands || [], e = data.manifest.elevation.core || data.manifest.elevation;
  const lo = Math.floor(e.minM / 10) * 10, hi = Math.ceil(e.maxM / 10) * 10, at = (v) => clamp((v - lo) / (hi - lo), 0, 1);
  show('lg-bands', S.layers.bands && bands.length > 1);
  $('lb-bands').style.background = `linear-gradient(90deg, ${bands.map((b, i) => `${b.color} ${pct(i ? at(bands[i - 1].toM) : 0)} ${pct(i === bands.length - 1 ? 1 : at(b.toM))}`).join(', ')})`;
  const ticks = $$('#lk-bands span:not([id])'), tops = bands.slice(0, -1).map((b) => b.toM);
  // a tick at every band's top; its number only where it keeps clear of the ends' numbers
  ticks.forEach((t, i) => { t.hidden = i >= tops.length; if (i < tops.length) { t.style.left = pct(at(tops[i])); t.textContent = at(tops[i]) > 0.1 && at(tops[i]) < 0.85 ? U.int(tops[i]) : ''; } });
  text('lb-lo', U.int(lo)); text('lb-hi', U.m(hi));
  $('lb-view').style.background = `linear-gradient(90deg, color-mix(in srgb-linear, ${L.viewshed} ${PLATE.viewshed.tint * 100}%, ${L.terrain}) 50%, color-mix(in srgb-linear, ${PLATE.viewshed.veil} ${PLATE.viewshed.veil_a * 100}%, ${L.terrain}) 50%)`;
  show('lg-view', S.layers.viewshed && !!viewshedInfo);
  if (viewshedInfo) text('lt-view', `Viewshed from ${U.m(viewshedInfo.eyeZ)}`);
}

// ---------------------------------------------------------------- viewpoints
function buildViewpointChips() {
  const list = [...((data.edit.viewpoints && data.edit.viewpoints.viewpoints) || []), ...S.savedViews];
  $('vp-chips').innerHTML = list.length
    ? list.map((v, i) => `<button type="button" class="word" data-vp="${i}">${escapeHtml(v.name || v.id || `View ${i + 1}`)}</button>`).join('')
    : '<span class="note">data/viewpoints.json has no viewpoints.</span>';
  $('vp-chips').onclick = (e) => {
    const b = e.target.closest('[data-vp]');
    if (!b) return;
    rig.applyViewpoint(list[+b.dataset.vp]);
    save();
  };
}

// ---------------------------------------------------------------- About
// Sections 2 and 3 from data/about.json, values verbatim.
function buildAbout() {
  const a = data.edit.about || {}, m = data.manifest, rp = route.props || {}, src = m.source || {};
  const t = a.terrain || {}, tr = a.trails || {}, md = a.mapData || {}, pn = a.placeNames || {};
  const lakes = (waterMesh.userData.lakes || []).filter((l) => l.name);
  const dl = (rows) => `<dl>${rows.filter((r) => r[1] != null && r[1] !== '').map(([k, v]) => row(k, v)).join('')}</dl>`;
  const p = (s) => (s ? `<p>${escapeHtml(s)}</p>` : '');
  const r = (t.elevationRangeM || [m.elevation.core.minM, m.elevation.core.maxM]).map(U.m).join(' to ');
  text('ab-lead', a.notNavigation || 'This is a planning tool. It has no position fix and no live weather.');
  text('ab-boat', a.boat || 'Most people take the MS Gjende boat one way. No timetable is shown here; it changes every season.');
  $('ab-gen').innerHTML = '<section><h3>This data</h3>'
    + dl([['Terrain', t.name || src.terrain], ['Source resolution', t.resolutionM && U.m(t.resolutionM)],
      ['Model resolution', `${U.m(t.modelResolutionM || 2)} along the route, ${U.m(m.levels[0].res)} at the horizon`],
      ['Surveyed', (t.projects || []).join(', ')], ['Elevation range', r]])
    + p(t.accuracy)
    + dl([['The walk', U.dist(rp.lengthM ?? route.length)], ['Ascent as shipped', `${U.m(rp.ascentM ?? route.ascent)} up, ${U.m(rp.descentM ?? route.descent)} down`],
      ['Sampling', `${U.m(rp.sampleStepM ?? 25)} steps, ${rp.smoothing || 'no smoothing stated'}`],
      ['Unsmoothed', rp.rawAscentM && `${U.m(rp.unsmoothedAscentM ?? 0)} at ${U.m(rp.sampleStepM)} steps, ${U.m(rp.rawAscentM)} on the raw vertices`],
      ['Gradient', `over 150${U.NN}m in the walk’s figures; red on the profile is 25${U.NN}% or steeper over 100${U.NN}m`]])
    + p((a.route || {}).howMeasured)
    + (lakes.length ? `<p>Lake surfaces are drawn at the water level the lidar reads, never below the whole meter N50 states, because lidar returns the surface itself: ${escapeHtml(lakes.map((l) => `${l.name} ${U.unit(U.fixed(l.levelM, 1), 'm')}`
      + (l.n50Hoyde != null && Math.abs(l.n50Hoyde - l.levelM) > 0.15 ? ` (N50: ${U.m(l.n50Hoyde)})` : '')).join(', '))}.</p>` : '')
    + dl([['Coordinates', (a.app || {}).crs || 'EPSG:25833'], ['Projection check', `${U.unit(U.fixed(projErr, 1), 'mm')} worst error against the manifest’s checkpoints`],
      ['Grid convergence', `${U.deg(frame.convergence, 2)} from true north`], ['Built', (a.app || {}).built]])
    + '</section><section><h3>Sources and credits</h3>'
    + [t, tr, md, pn].map((b) => `<h4 translate="no">${escapeHtml(b.name || '')}</h4>${dl([['Owner', b.owner], ['License', b.licence], ['Retrieved', b.retrieved], ['Updated', b.sourceUpdated]])}${p(b.note)}${p(b === tr ? b.accuracy : '')}`).join('')
    + '<p>three.js r186 renders the scene (MIT License); the copy in vendor/ is byte for byte the one the Anatomy app carries, with its license.</p>'
    + '<p>Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.</p></section>';
}

function updatePace() {
  const p = effectivePace(), f = p.fitnessFactor ?? 1;
  for (const b of $$('#pace-words [data-model]')) b.setAttribute('aria-checked', String(b.dataset.model === (p.model === 'naismith' ? 'naismith' : 'tobler')));
  $('pace-fit').value = String(f);
  slid($('pace-fit'));
  text('pace-out', paceLabel(p));
  text('pace-note', (p.model === 'naismith' && langmuirNote(p)) || 'Tobler 1993: walking speed falls off either side of a gentle downhill. Editable in data/pace.json.');
  setCursor(S.cursor, false);
}

function showNotices() {
  $('notice').hidden = !data.notices.length;
  $('notice').textContent = data.notices.join(' ');
}

// ---------------------------------------------------------------- dialogs: About and Layers
// Modal: focus held inside, Escape closes, focus returns; play waits.
let opener = null;
function openDialog(id) {
  closeDialog(false);
  opener = document.activeElement;
  S.dialog = id;
  if (play) { held = true; setPlaying(false); }
  $(id).hidden = false;
  $('btn-layers').setAttribute('aria-expanded', String(id === 'layers'));
  $(id).querySelector('[data-close]').focus({ preventScroll: true });
}
function closeDialog(restore = true) {
  if (!S.dialog) return;
  $(S.dialog).hidden = true;
  S.dialog = null;
  $('btn-layers').setAttribute('aria-expanded', 'false');
  if (held) { held = false; setPlaying(true); }
  if (restore && opener && opener.focus) opener.focus({ preventScroll: true });
  invalidate();
}

// ---------------------------------------------------------------- UI wiring
const GRIP = ['Show more controls', 'Show all controls', 'Hide the extra controls'];
function setStop(n) {
  S.sheet = clamp(Math.round(n), 0, 2);
  $('sheet').className = `sheet s${S.sheet}`;
  $('grip').setAttribute('aria-label', GRIP[S.sheet]);
  save();
}
// A native range drawn in the house's language: the value so far in ink (styles.css reads --v).
const fill = (el) => el.style.setProperty('--v', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
function slid(el) {
  fill(el);
  if (el.id === 'eye-h') text('eye-out', U.unit(U.fixed(S.eyeM, 1), 'm'));
  if (el.id === 'pace-fit') text('fit-out', `×${U.fixed(+el.value, 2)}`);
}

function wireUI() {
  setStop(S.sheet);
  const grip = $('grip');
  let drag = null, skipClick = false;
  grip.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    skipClick = false; grip.setPointerCapture(e.pointerId); drag = { y: e.clientY, moved: false };
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 5) drag.moved = true;
    if (dy > 42 && S.sheet < 2) { setStop(S.sheet + 1); drag.y = e.clientY; }
    else if (dy < -42 && S.sheet > 0) { setStop(S.sheet - 1); drag.y = e.clientY; }
  });
  grip.addEventListener('pointerup', () => { if (drag && drag.moved) skipClick = true; drag = null; });
  grip.addEventListener('pointercancel', () => { drag = null; });
  grip.addEventListener('click', () => { if (skipClick) { skipClick = false; return; } setStop((S.sheet + 1) % 3); });
  grip.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); setStop(S.sheet + 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setStop(S.sheet - 1); }
  });

  $('stamp').addEventListener('click', () => openDialog('about'));
  $('btn-layers').addEventListener('click', () => (S.dialog === 'layers' ? closeDialog() : openDialog('layers')));
  for (const b of $$('[data-close]')) b.addEventListener('click', () => closeDialog());
  // ignore the synthesized click of the tap that opened the card
  $('card-close').addEventListener('click', () => { if (performance.now() - cardShownAt > 450) closeCard(); });
  $('zoom-in').addEventListener('click', () => { rig.zoomBy(1 / 1.35); save(); });
  $('zoom-out').addEventListener('click', () => { rig.zoomBy(1.35); save(); });
  $('btn-fit').addEventListener('click', () => { frameRoute(); save(); });
  $('cam-whole').addEventListener('click', () => { frameWholeModel(); save(); });
  $('cam-route').addEventListener('click', () => { rig.setMode('fp'); rig.placeOnRoute(route, rig.routeT, S.reversed, rig.eyeM, false); save(); });

  $('t-play').addEventListener('click', () => setPlaying(!play));
  const day = (k) => {
    setPlaying(false);
    const t = new Date(Date.UTC(S.date.y, S.date.mo - 1, S.date.d + k));
    want = { ...want, date: { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() } };
    say(U.date(want.date.y, want.date.mo, want.date.d, 1, 1));
    invalidate();
  };
  $('t-prev').addEventListener('click', () => day(-1));
  $('t-next').addEventListener('click', () => day(1));
  const dateEl = $('date-d');
  dateEl.addEventListener('input', () => {
    const y = S.date.y;
    let mo = 1, d = clamp(+dateEl.value, 1, 366);
    while (d > daysInMonth(y, mo) && mo < 12) { d -= daysInMonth(y, mo); mo++; }
    want = { ...want, date: { y, mo, d: Math.min(d, 31) } };
    fill(dateEl);
    invalidate();
  });
  dateEl.addEventListener('change', save);

  $('btn-dir').addEventListener('click', () => {
    S.reversed = !S.reversed;
    profile.setReversed(S.reversed);
    updateDirLabel();
    setCursor(S.cursor, false);
    save();
  });
  updateDirLabel();

  const exagEl = $('exag');
  exagEl.value = String(S.exag);
  fill(exagEl);
  exagEl.addEventListener('input', () => { fill(exagEl); applyExaggeration(+exagEl.value); });
  exagEl.addEventListener('change', save);

  // Reduced motion: the same walk, one named point at a time, with nothing moving in between.
  const flyLabel = () => (reduceMotion() ? 'Step to the next point' : 'Fly the route');
  const stopFlying = () => { rig.flying = false; $('btn-fly').textContent = flyLabel(); };
  $('btn-fly').textContent = flyLabel();
  rig.onFlyEnd = () => { stopFlying(); save(); };
  RM.addEventListener('change', () => { if (!rig.flying) $('btn-fly').textContent = flyLabel(); if (play) setPlaying(true); });
  const stepToNextWaypoint = () => {
    const wps = (route.waypoints || []).map((w) => route.dirDist(w.i, S.reversed)).sort((a, b) => a - b);
    if (!wps.length) return;
    const next = wps.find((d) => d > rig.routeT * route.length + 5);
    rig.setMode('fp');
    const i = rig.placeOnRoute(route, (next === undefined ? wps[0] : next) / route.length, S.reversed, rig.eyeM, false);
    if (i != null) setCursor(i, false);
    save();
  };
  $('btn-fly').addEventListener('click', () => {
    if (reduceMotion()) { stopFlying(); stepToNextWaypoint(); invalidate(); return; }
    rig.flying = !rig.flying;
    if (rig.flying) {
      rig.setMode('fp');
      if (rig.routeT >= 0.999) rig.routeT = 0;
      $('btn-fly').textContent = 'Stop';
    } else { stopFlying(); save(); }
    invalidate();
  });
  $('btn-orbit').addEventListener('click', () => {
    stopFlying();
    rig.setMode('orbit');
    rig.controls.target.copy(camera.position).add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(1800));
    rig.controls.update();
    save();
  });

  $('tool-words').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id !== 'tool-clear') { setTool(b.dataset.tool); return; }
    S.tool = null; picked = []; lastRun = null; toolLine.visible = false;
    mat.uniforms.uHasViewshed.value = 0; viewshedInfo = null;
    if (S.card && S.card !== 'point') closeCard();
    setTool(null);
    legends();
  });
  const eye = $('eye-h');
  eye.value = String(S.eyeM);
  slid(eye);
  eye.addEventListener('input', () => { S.eyeM = +eye.value; slid(eye); });
  eye.addEventListener('change', () => {
    save();
    // Run again whatever visibility question was last asked, rather than making the user tap again.
    if (lastRun) (lastRun.id === 'viewshed' ? runViewshed : runLos)(...lastRun.pts);
  });

  $('pace-words').addEventListener('click', (e) => {
    const b = e.target.closest('[data-model]');
    if (b) { S.paceModel = b.dataset.model; updatePace(); save(); }
  });
  $('pace-fit').addEventListener('input', (e) => { S.paceFit = +e.target.value; updatePace(); });
  $('pace-fit').addEventListener('change', save);

  $('btn-save-vp').addEventListener('click', () => {
    const p = camera.position;
    S.savedViews.push({
      id: `mine-${Date.now()}`, name: `My view ${S.savedViews.length + 1}`,
      x: frame.wx(p.x), y: frame.wy(p.z), eyeM: p.y / Math.max(S.exag, 0.001),
      aboveGround: false, headingDeg: rig.headingTrue(), pitchDeg: rig.pitch, fovDeg: camera.fov,
    });
    buildViewpointChips(); save();
  });
  $('btn-clear-vp').addEventListener('click', () => { S.savedViews = []; buildViewpointChips(); save(); });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (S.dialog) closeDialog(); else if (S.card) closeCard(); else if (focus && focus.isOn()) focus.set(false, true);
      return;
    }
    if (S.dialog && e.key === 'Tab') {
      // hold Tab inside the open sheet
      const f = $$('button, [tabindex="0"]', $(S.dialog)).filter((x) => !x.closest('[hidden]'));
      const i = f.indexOf(document.activeElement);
      if (i < 0 || (e.shiftKey ? i === 0 : i === f.length - 1)) { f[e.shiftKey ? f.length - 1 : 0].focus(); e.preventDefault(); }
    }
  });

  // ---- persistence on the way out, and after every drag ----------------------------------
  // WebKit does not fire `beforeunload` in a WKWebView and an app killed in the background fires
  // nothing, so state is stored on `pagehide`, on a hidden `visibilitychange`, and 400 ms after a
  // camera drag settles. Hidden, play and the fly-through stop (HOUSE.md section 4.12).
  let camTimer = 0;
  const saveCameraSoon = () => {
    if (camTimer) clearTimeout(camTimer);
    camTimer = setTimeout(() => { camTimer = 0; if (!rig.flying) save(); }, 400);
  };
  rig.controls.addEventListener('end', saveCameraSoon);   // orbit drag, pinch and wheel zoom
  rig.onLookEnd = saveCameraSoon;                         // first-person look drag
  const saveNow = () => { if (camTimer) { clearTimeout(camTimer); camTimer = 0; } save(); };
  addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { invalidate(); return; }
    setPlaying(false); stopFlying(); saveNow();
  });
}

function updateDirLabel() {
  const wps = route.waypoints;
  const a = wps.length ? wps[0].name : 'the start', b = wps.length ? wps[wps.length - 1].name : 'the end';
  $('btn-dir').textContent = S.reversed ? `${b} to ${a}` : `${a} to ${b}`;
}

// Started last, so every const in this module is initialized before the first await returns.
$('credits').textContent = CREDITS;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  boot().catch((err) => { fail(err && err.message ? err.message : String(err)); console.error(err); });
} catch (err) {
  fail('This phone gave no 3D graphics just now. Close other apps and open Besseggen again.');
}
