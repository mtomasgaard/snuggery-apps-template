// Snug Kart — boot, screens, the loop and the window.__sk test hook (DESIGN.md §12, §15, §16, §17).
//
// Items, sound and tilt plug in through `hooks` below (js/items-view.js, js/audio.js, js/tilt.js).
// Each is optional: with a hook set to null the rest of the game still runs.

import {
  WebGLRenderer, Scene, PerspectiveCamera, SRGBColorSpace, NoToneMapping, PCFShadowMap,
} from '../vendor/three.module.js';
import { loadTracks } from './track.js';
import { createRace, stepRace, finishRace, STEP, COUNTDOWN } from './race.js';
import { Field, paintFace } from './kart.js';
import { buildScenery } from './scenery.js';
import { ChaseCamera } from './camera.js';
import { Hud, fmtTime, ordinal } from './hud.js';
import { Input } from './input.js';
import { Sparks } from './fx.js';
import * as store from './store.js';
import { itemsHook } from './items-view.js';
import { audioHook } from './audio.js';
import { tiltHook } from './tilt.js';

/**
 * The three optional modules, each behind one small interface:
 *   hooks.audio = { unlock(), setEnabled(on), onEvent(event, race), frame(race, dt), suspend(), resume() }
 *   hooks.items = { attach(race, scene) → { step(race, dt), onUse(race, kart) }, frame(race, dt, camera), give(race, kart, id), detach() }
 *   hooks.tilt  = { request() → Promise<boolean>, start(input), stop(), calibrate(race) }
 */
export const hooks = { audio: audioHook, items: itemsHook, tilt: tiltHook };

const $ = (id) => document.getElementById(id);
const PR = { high: [2, 1.7, 1.4], low: [1.25, 1.0] };

const G = {
  screen: 'loading', tracks: [], racers: [], settings: store.load('settings', store.DEFAULT_SETTINGS),
  race: null, titleRace: null, scenery: null, sceneryKey: '', track: null,
  running: false, raf: 0, last: 0, acc: 0, frozen: false, paused: false, time: 0,
  prLevel: 0, frameLog: new Float64Array(240), frameN: 0, judgeAt: 0, adaptive: true,
  stats: { fps: 60, js: 0, buildMs: 0 }, finishView: 0,
  view: { camera: null, player: null, countdown: false },
  lines: { op: 0, streaks: [] },
};

// ---------------------------------------------------------------------------------------------
// Boot

const canvas = $('gl');
let renderer, scene, camera, chase, field, hud, input, sparks;
const inp = { steer: 0, drift: false, brake: 0, useItem: false };

boot().catch((e) => failLoad(e && e.message ? e.message : String(e)));

async function boot() {
  const [tj, rj] = await Promise.all([fetchJSON('data/tracks.json'), fetchJSON('data/racers.json')]);
  G.tracks = loadTracks(tj);
  G.racers = checkRacers(rj);
  if (!G.tracks.some((t) => t.id === G.settings.track)) G.settings.track = G.tracks[0].id;
  if (!G.racers.some((r) => r.id === G.settings.racer)) G.settings.racer = G.racers[0].id;

  renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.info.autoReset = true;
  scene = new Scene();
  camera = new PerspectiveCamera(80, 1, 0.3, 270);
  chase = new ChaseCamera(camera);
  G.view.camera = camera;
  field = new Field(G.racers);
  scene.add(field.group);
  sparks = new Sparks(G.settings.quality === 'high' ? 400 : 150);
  scene.add(sparks.points);
  hud = new Hud({
    root: $('hud'), posN: $('pos-n'), posSuf: $('pos-suf'), lap: $('lap'), time: $('rtime'), last: $('last'),
    map: $('minimap'), count: $('count'), banner: $('banner'), diag: $('diag'), drift: $('btn-drift'),
  });
  input = new Input({ layer: $('touch'), pad: $('pad'), knob: $('pad-knob'), ghost: $('pad-ghost'), drift: $('btn-drift'), item: $('btn-item'), onPause: () => togglePause() });
  input.setMode(G.settings.controls);
  hooks.audio.setEnabled(G.settings.sound);          // the context itself waits for a tap
  if (G.settings.tilt) hooks.tilt.start(input);      // steers once readings arrive; the pad until then
  wireScreens();
  // iOS: audio may start only from a gesture, and a context can be suspended behind our back (a
  // call, another app). Any tap while Sound is on creates or resumes it.
  document.addEventListener('pointerdown', () => { if (G.settings.sound && !G.paused) hooks.audio.unlock(); }, { capture: true, passive: true });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onContextLost(); });
  canvas.addEventListener('webglcontextrestored', () => onContextRestored());
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  document.addEventListener('visibilitychange', () => (document.hidden ? onHidden() : onVisible()));
  window.addEventListener('pagehide', onHidden);
  onResize();
  await showTitle();
  const l = $('loading'); l.classList.add('done'); l.hidden = true;
}

async function fetchJSON(path) {
  let res;
  try { res = await fetch(path, { cache: 'no-store' }); } catch { throw new Error(`${path} could not be read.`); }
  if (!res.ok) throw new Error(`${path} is missing (the app needs it to build the races).`);
  try { return await res.json(); } catch { throw new Error(`${path} is not valid JSON — check for a missing comma or bracket.`); }
}

function checkRacers(json) {
  const list = json && json.racers;
  if (!Array.isArray(list) || list.length !== 8) throw new Error('data/racers.json must list exactly eight racers.');
  const ids = new Set();
  for (const r of list) {
    const where = `data/racers.json, racer "${r && (r.name || r.id)}"`;
    if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') throw new Error(`${where}: needs an "id" and a "name".`);
    if (ids.has(r.id)) throw new Error(`${where}: the id "${r.id}" is used twice.`); ids.add(r.id);
    for (const c of ['body', 'trim']) if (!/^#[0-9a-f]{6}$/i.test(r[c] || '')) throw new Error(`${where}: "${c}" must be a colour like #F28C28.`);
    if (!r.face || !/^#[0-9a-f]{6}$/i.test(r.face.skin || '') || !/^#[0-9a-f]{6}$/i.test(r.face.hair || '')) throw new Error(`${where}: "face" needs "skin" and "hair" colours.`);
    const a = r.ai || {};
    for (const k of ['lane', 'skill', 'drift', 'aggression', 'awareness']) if (!Number.isFinite(a[k])) throw new Error(`${where}: "ai.${k}" must be a number.`);
    if (a.skill < 0.8 || a.skill > 1.1) throw new Error(`${where}: "ai.skill" must be between 0.8 and 1.1.`);
    if (Math.abs(a.lane) > 0.6) throw new Error(`${where}: "ai.lane" must be between −0.6 and 0.6.`);
    r.line = r.line || '';
  }
  return list;
}

function failLoad(msg) {
  const l = $('loading'); l.hidden = false; l.classList.add('error');
  $('load-msg').textContent = msg;
}

// ---------------------------------------------------------------------------------------------
// Track scenery (built once per track + quality; reused for "Race again")

async function ensureScenery(trackId, quality) {
  const key = `${trackId}:${quality}`;
  G.track = G.tracks.find((t) => t.id === trackId);
  if (G.scenery && G.sceneryKey === key) return;
  const b = $('building');
  const showing = G.screen !== 'loading';
  if (showing) { b.hidden = false; await nextFrame(); await nextFrame(); }
  if (G.scenery) G.scenery.dispose();
  G.scenery = buildScenery(G.track, quality);
  G.sceneryKey = key;
  G.stats.buildMs = G.scenery.buildMs;
  scene.add(G.scenery.group);
  scene.fog = G.scenery.fog;
  camera.far = G.scenery.far; camera.updateProjectionMatrix();
  field.setQuality(quality);
  sparks.setQuality(quality);
  b.hidden = true;
}
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function applyPixelRatio() {
  const racing = G.screen === 'race' || G.screen === 'results';
  const q = G.settings.quality;
  let pr = racing ? PR[q][Math.min(G.prLevel, PR[q].length - 1)] : 1.25;
  pr = Math.min(pr, window.devicePixelRatio || 1);
  if (renderer.getPixelRatio() !== pr) { renderer.setPixelRatio(pr); renderer.setSize(window.innerWidth, window.innerHeight, false); }
}

// ---------------------------------------------------------------------------------------------
// Screens

function show(screen) {
  G.screen = screen;
  for (const id of ['title', 'results', 'pause']) $(id).hidden = id !== screen;
  document.body.classList.toggle('racing', screen === 'race');
  hud.show(screen === 'race');
  input.enable(screen === 'race' && G.race && !G.race.player.autopilot);
  applyPixelRatio();
}

async function showTitle() {
  if (G.race) endRace();
  await ensureScenery(G.settings.track, G.settings.quality);
  G.titleRace = createRace({ track: G.track, racers: G.racers, player: G.settings.racer, seed: 1, pace: G.settings.pace });
  chase.mode = 'none';
  renderTitle();
  show('title');
  startLoop();
}

function endRace() {
  if (hooks.items && G.race && G.race.items) hooks.items.detach && hooks.items.detach();
  if (hooks.audio) hooks.audio.frame(null, 0);
  G.race = null; G.frozen = false; G.paused = false;
  sparks.clear();
  hud.hideBanner(); hud.countdown(''); $('hint').hidden = true;
  $('fade').classList.remove('on');
  clearLines();
}

function wireScreens() {
  $('track-prev').onclick = () => cycleTrack(-1);
  $('track-next').onclick = () => cycleTrack(1);
  let sx = null;
  $('track-card').addEventListener('pointerdown', (e) => { sx = e.clientX; });
  $('track-card').addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) cycleTrack(e.clientX < sx ? 1 : -1); sx = null; });
  $('btn-race').onclick = () => {
    if (G.settings.sound && hooks.audio) hooks.audio.unlock();
    // iOS asks for motion access once per visit; a tap is the only place it can be asked.
    if (G.settings.tilt && hooks.tilt && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      hooks.tilt.request().then((ok) => {
        if (ok) hooks.tilt.start(input);
        else { G.settings.tilt = false; hooks.tilt.stop(); saveSettings(); renderChips(); }   // refused: steer with the pad
      });
    }
    startRace({ track: G.settings.track, racer: G.settings.racer, seed: (Date.now() % 100000) + 1, pace: G.settings.pace });
  };
  $('btn-pause').onclick = () => pause();
  $('btn-resume').onclick = () => resume();
  $('btn-restart').onclick = () => { const r = G.race; startRace({ track: r.track.id, racer: r.player.racer.id, seed: r.seed + 1, pace: G.settings.pace }); };
  $('btn-quit').onclick = () => showTitle();
  $('btn-again').onclick = () => { const r = G.lastRace; startRace({ track: r.track.id, racer: r.player.racer.id, seed: r.seed + 1, pace: G.settings.pace }); };
  $('btn-change').onclick = () => showTitle();
  // After a context loss: a race waits behind its pause menu (drawn once, if the context is back);
  // the title and the results carry on.
  $('lost').onclick = () => {
    $('lost').hidden = true;
    if (G.screen === 'pause') { if (!renderer.getContext().isContextLost()) render(0); } else startLoop();
  };
  // After the finish banner, a tap anywhere but a button skips the wait for the stragglers. (On the
  // document: the HUD takes no touches, and the touch layer is what lies under a thumb.) The skip
  // consumes its tap: the results appear a frame later, under a finger that is still down, and the
  // browser aims the tap's click at whatever is under it when it lifts — Race again or Change.
  document.addEventListener('pointerdown', (e) => {
    if (guard.pointer !== null && e.pointerId !== guard.pointer) lifted({ pointerId: guard.pointer });   // its lift was lost
    const r = G.race;
    if (r && G.screen === 'race' && r.phase === 'finished' && r.finishT >= 2 && !(e.target.closest && e.target.closest('button'))) {
      e.preventDefault();
      guard.pointer = e.pointerId;
      guardResults(0);
      finishRace(r);
    }
  });
  const lifted = (e) => { if (e.pointerId === guard.pointer) { guard.pointer = null; guardResults(GUARD_AFTER_LIFT); } };
  document.addEventListener('pointerup', lifted, true);
  document.addEventListener('pointercancel', lifted, true);
  window.addEventListener('blur', () => { if (guard.pointer !== null) lifted({ pointerId: guard.pointer }); });
  // Belt and braces for `.settling`: a click that still reaches the panel while guarded is dropped.
  document.addEventListener('click', (e) => {
    if (guarded() && e.target.closest && e.target.closest('#results')) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
}

// The results panel ignores input while the skipping finger is down, for 0.4 s after it lifts and
// for 0.5 s after the panel appears (a tap already under way when the race ends, skip or not).
// `.settling` takes the panel out of hit-testing (pointer-events: none) for that time.
const GUARD_AFTER_LIFT = 400, GUARD_AFTER_SHOW = 500;
const guard = { pointer: null, until: 0, timer: 0 };
const guarded = () => guard.pointer !== null || performance.now() < guard.until;
function guardResults(ms) {
  guard.until = Math.max(guard.until, performance.now() + ms);
  $('results').classList.add('settling');
  settle();
}
function settle() {
  clearTimeout(guard.timer);
  if (guard.pointer !== null) return;                    // its lift calls guardResults again
  const wait = guard.until - performance.now();
  if (wait > 0) guard.timer = setTimeout(settle, wait);
  else $('results').classList.remove('settling');
}

async function cycleTrack(d) {
  const i = G.tracks.findIndex((t) => t.id === G.settings.track);
  G.settings.track = G.tracks[(i + d + G.tracks.length) % G.tracks.length].id;
  saveSettings();
  await ensureScenery(G.settings.track, G.settings.quality);
  G.titleRace = createRace({ track: G.track, racers: G.racers, player: G.settings.racer, seed: 1, pace: G.settings.pace });
  chase.mode = 'none';
  renderTitle();
}

function saveSettings() { store.save('settings', G.settings); }

function faceCanvas(racer, css) {
  const c = document.createElement('canvas'), dpr = Math.min(3, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(css * dpr);
  paintFace(c.getContext('2d'), 0, 0, c.width, racer, { round: true });
  return c;
}

function renderTitle() {
  const t = G.tracks.find((x) => x.id === G.settings.track);
  $('track-name').textContent = t.name;
  $('track-blurb').textContent = t.def.blurb || '';
  const best = store.bestFor(t.id);
  const len = `${Math.round(t.L).toLocaleString('en-US')} m`;
  $('track-meta').textContent = best && (best.lap || best.race)
    ? `${len}\nBest lap ${fmtTime(best.lap / 1000)} · Best race ${fmtTime(best.race / 1000)}`
    : `${len} · No best yet`;
  const grid = $('racer-grid');
  if (!grid.childElementCount) {
    for (const r of G.racers) {
      const b = document.createElement('button');
      b.className = 'racer'; b.setAttribute('role', 'radio'); b.dataset.id = r.id;
      b.style.setProperty('--ring', r.body);
      b.append(faceCanvas(r, 72), Object.assign(document.createElement('span'), { textContent: r.name.split(' ')[0] }));
      b.onclick = () => { G.settings.racer = r.id; saveSettings(); G.titleRace = createRace({ track: G.track, racers: G.racers, player: r.id, seed: 1, pace: G.settings.pace }); renderTitle(); };
      grid.append(b);
    }
  }
  for (const b of grid.children) b.setAttribute('aria-checked', String(b.dataset.id === G.settings.racer));
  const me = G.racers.find((r) => r.id === G.settings.racer);
  $('racer-line').textContent = `${me.name} — ${me.line}`;
  renderChips();
}

function renderChips() {
  const s = G.settings, chips = $('chips');
  const defs = [
    ['sound', 'Sound', s.sound ? 'On' : 'Off', s.sound],
    ['tilt', 'Tilt', s.tilt ? 'On' : 'Off', s.tilt],
    ['quality', 'Quality', s.quality === 'high' ? 'High' : 'Low', false],
    ['controls', 'Controls', s.controls === 'pad' ? 'Pad' : 'Sides', false],
    ['pace', 'Pace', { relaxed: 'Relaxed', standard: 'Standard', fierce: 'Fierce' }[s.pace], false],
  ];
  chips.textContent = '';
  for (const [key, label, value, on] of defs) {
    const b = document.createElement('button');
    b.className = 'chip' + (on ? ' on' : ''); b.innerHTML = `${label} <b>${value}</b>`;
    b.onclick = () => onChip(key);
    chips.append(b);
  }
}

async function onChip(key) {
  const s = G.settings;
  let note = '';
  if (key === 'sound') {
    s.sound = !s.sound;
    if (hooks.audio) { if (s.sound) hooks.audio.unlock(); hooks.audio.setEnabled(s.sound); }
    if (s.sound) note = "Uses your phone's volume. If you hear nothing, check the silent switch.";
  } else if (key === 'tilt') {
    if (s.tilt) { s.tilt = false; hooks.tilt && hooks.tilt.stop(); }
    else {
      const ok = hooks.tilt ? await hooks.tilt.request() : false;
      s.tilt = !!ok;
      if (ok) { hooks.tilt.start(input); note = 'Tilt the phone to steer. However you hold it at the countdown is straight ahead.'; }
      else note = "Tilt isn't available here.";
    }
  } else if (key === 'quality') {
    s.quality = s.quality === 'high' ? 'low' : 'high'; G.prLevel = 0;
    saveSettings(); renderChips();
    await ensureScenery(s.track, s.quality);
  } else if (key === 'controls') {
    s.controls = s.controls === 'pad' ? 'sides' : 'pad'; input.setMode(s.controls);
    note = s.controls === 'sides'
      ? 'Sides: hold the left or right of the screen to steer; tap a side twice and hold to drift.'
      : 'Pad: drag left or right to steer, pull down to brake. Hold Drift through a bend.';
  }
  else if (key === 'pace') s.pace = { relaxed: 'standard', standard: 'fierce', fierce: 'relaxed' }[s.pace];
  saveSettings(); renderChips();
  $('chip-note').textContent = note;
}

// ---------------------------------------------------------------------------------------------
// Racing

async function startRace({ track, racer, seed = 1, pace = G.settings.pace }) {
  if (G.race) endRace();
  await ensureScenery(track, G.settings.quality);
  const race = createRace({ track: G.track, racers: G.racers, player: racer, seed, pace });
  G.race = race; G.lastRace = race;
  if (hooks.items) race.items = hooks.items.attach(race, scene);
  if (hooks.audio) hooks.audio.resume();              // clears a suspend left by a hidden page
  G.acc = 0; G.frozen = false; G.paused = false; G.finishView = 0; G.prLevel = 0; G.frameN = 0; G.judgeAt = performance.now() + 3000;
  hud.setTrack(G.track);
  hud.hideBanner(); hud.countdown('');
  // The first race or two: one line under the countdown on how drifting works.
  const hinted = Number(store.loadRaw('hints')) || 0;
  $('hint').textContent = G.settings.controls === 'sides'
    ? 'Tap a side twice and hold it to drift. Let go for a boost.'
    : 'Hold Drift through a bend. Let go for a boost.';
  $('hint').hidden = hinted >= 2;
  if (hinted < 2) store.save('hints', hinted + 1);
  document.body.classList.remove('done');
  chase.snapTo(race.player, G.track, 12, 7);
  setItemButton(null);
  show('race');
  startLoop();
  return race;
}

function handleEvents(race) {
  for (const e of race.events) {
    if (hooks.audio) hooks.audio.onEvent(e, race);
    const mine = e.kart && e.kart.isPlayer;
    switch (e.type) {
      case 'count': hud.countdown(String(e.n)); break;
      case 'go': hud.countdown('Go'); $('hint').hidden = true; if (hooks.tilt && G.settings.tilt) hooks.tilt.calibrate(race); break;
      case 'lap': hud.banner(e.final ? 'Final lap' : `Lap ${e.lap}`); break;
      case 'wrongWay': if (e.on) hud.banner('Wrong way', 99); else hud.hideBanner(); break;
      case 'finish':
        if (mine) { hud.banner(`Finished ${e.place}${ordinal(e.place)}`, 2.2); input.enable(false); G.finishView = 0; document.body.classList.add('done'); }
        break;
      case 'wall': if (Math.hypot(e.kart.x - camera.position.x, e.kart.z - camera.position.z) < 60) sparks.burst(e.kart, e.speed); break;
      case 'respawn': if (mine) { $('fade').classList.add('on'); setTimeout(() => $('fade').classList.remove('on'), 320); } break;
      case 'shieldPop': sparks.pop(e.kart); break;
      case 'hit': if (mine) hud.banner(e.by === 'plane' ? 'Paper plane!' : 'Tangled!', 0.9); break;
      case 'honeyIn': if (mine) hud.banner('Sticky!', 0.7); break;
      case 'results': showResults(race); break;
    }
  }
  race.events.length = 0;
}

function setItemButton(id) {
  const btn = $('btn-item');
  btn.classList.toggle('empty', !id);
  const use = $('item-use');
  if (id) use.setAttribute('href', `#i-${id}`); else use.removeAttribute('href');
}

function showResults(race) {
  const P = race.player;
  const lapMs = P.bestLap != null ? Math.round(P.bestLap * 1000) : null;
  const raceMs = !P.projected && P.finishTime != null ? Math.round(P.finishTime * 1000) : null;
  const rec = store.recordBest(race.track.id, lapMs, raceMs, P.racer.id);
  $('res-title').textContent = `${race.track.name} — ${P.place}${ordinal(P.place)}`;
  const badges = $('res-badges'); badges.textContent = '';
  if (rec.newLap) badges.append(Object.assign(document.createElement('span'), { textContent: 'New best lap' }));
  if (rec.newRace) badges.append(Object.assign(document.createElement('span'), { textContent: 'New best race' }));
  const list = $('res-list'); list.textContent = '';
  for (const k of race.order) {
    const li = document.createElement('li'); if (k.isPlayer) li.className = 'me';
    const place = Object.assign(document.createElement('span'), { className: 'place', textContent: k.place });
    const name = Object.assign(document.createElement('span'), { textContent: k.racer.name });
    const times = document.createElement('span'); times.className = 'times';
    times.textContent = k.projected ? `${fmtTime(k.finishTime)} est.` : fmtTime(k.finishTime);
    const best = document.createElement('small'); best.textContent = k.bestLap != null ? `best lap ${fmtTime(k.bestLap)}` : 'no full lap';
    times.append(best);
    li.append(place, faceCanvas(k.racer, 30), name, times);
    list.append(li);
  }
  guardResults(GUARD_AFTER_SHOW);
  show('results');
}

// ---------------------------------------------------------------------------------------------
// Pause, visibility, resize, context loss

function pause() {
  if (!G.race || G.screen !== 'race') return;
  G.paused = true; input.releaseAll();
  if (hooks.audio) hooks.audio.suspend();
  show('pause');
  stopLoop();
  render(0);         // leave a current frame behind the panel
}
function resume() {
  if (!G.race || !G.paused) return;
  G.paused = false;
  if (hooks.audio) hooks.audio.resume();
  show('race');
  startLoop();
}
function togglePause() { if (G.screen === 'race') pause(); else if (G.screen === 'pause') resume(); }

function onHidden() {
  if (G.screen === 'race') pause();
  if (hooks.audio) hooks.audio.suspend();
  stopLoop();
}
function onVisible() {
  // A race stays paused behind its panel until Resume; the title's glide just carries on.
  if (G.screen === 'title' || G.screen === 'results') { startLoop(); if (hooks.audio) hooks.audio.resume(); }
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const lines = $('lines'), dpr = Math.min(2, window.devicePixelRatio || 1);
  lines.width = Math.round(w * dpr); lines.height = Math.round(h * dpr);
  G.linesDrawn = false;
  if (hud && hud.track) hud.base = null;
  applyPixelRatio();
  if (!G.running && G.scenery) render(0);
}

function onContextLost() {
  stopLoop();
  // three.js keeps a 'dispose' listener on every geometry, material, texture and instanced mesh it
  // uploaded; after a restore those old listeners would delete handles of the lost context (WebGL
  // warnings) when a track is later disposed. Drop them now; three adds fresh ones on re-upload.
  const clear = (x) => { if (x && x._listeners && x._listeners.dispose) x._listeners.dispose = []; };
  scene.traverse((o) => {
    clear(o); clear(o.geometry);
    for (const m of [].concat(o.material || [])) { clear(m); for (const k in m) if (m[k] && m[k].isTexture) clear(m[k]); }
    if (o.shadow && o.shadow.map) { clear(o.shadow.map); clear(o.shadow.map.texture); clear(o.shadow.map.depthTexture); }
  });
  // The race is left paused behind the panel; the panel's tap then opens the pause menu.
  if (G.screen === 'race') { G.paused = true; input.releaseAll(); show('pause'); }
  if (hooks.audio) hooks.audio.suspend();
  $('lost').hidden = false;
}
// three.js re-creates its GL state on restore and re-uploads every geometry and texture on the next
// render, so nothing is rebuilt here (disposing now would delete buffers of the lost context).
function onContextRestored() {
  if (G.screen === 'title' || G.screen === 'results') render(0);
}

// ---------------------------------------------------------------------------------------------
// The loop: requestAnimationFrame, delta clamped to 1/15 s, fixed 1/120 s steps, at most 8 a frame.

function startLoop() {
  if (G.running) return;
  G.running = true; G.last = performance.now();
  G.raf = requestAnimationFrame(frame);
}
function stopLoop() {
  G.running = false;
  if (G.raf) cancelAnimationFrame(G.raf);
  G.raf = 0;
}

function frame(now) {
  G.raf = 0;
  if (!G.running) return;
  const t0 = performance.now();
  const dt = Math.min(1 / 15, Math.max(0, (now - G.last) / 1000));
  G.last = now;
  simulate(dt);
  render(dt);
  const js = performance.now() - t0;
  G.stats.js += (js - G.stats.js) * 0.1;
  if (dt > 0) G.stats.fps += (1 / dt - G.stats.fps) * 0.05;
  adapt(now, dt);
  if (G.running) G.raf = requestAnimationFrame(frame);
}

function simulate(dt) {
  const race = G.race;
  if (!race || G.paused || G.frozen || (G.screen !== 'race' && G.screen !== 'results')) return;
  G.acc += dt;
  let n = 0;
  while (G.acc >= STEP && n < 8) { stepRace(race, input.read(inp)); if (inp.useItem && !race.items) inp.useItem = false; G.acc -= STEP; n++; }
  if (n === 8) G.acc = 0;
  handleEvents(race);
}

function render(dt, draw = true) {
  G.time += dt;
  const race = G.race && (G.screen === 'race' || G.screen === 'results' || G.screen === 'pause') ? G.race : null;
  const track = G.track;
  if (race) {
    const P = race.player;
    G.view.player = P; G.view.countdown = race.phase === 'countdown';
    field.update(race.karts, track, dt, G.time, G.view);
    if (race.phase === 'countdown') chase.chase(P, track, dt, Math.min(1, 1 - race.countdown / COUNTDOWN));
    else if (P.finished && !P.projected) { G.finishView += dt; if (G.finishView < 2.5) chase.finish(P, track, dt); else chase.chase(P, track, dt); }
    else chase.chase(P, track, dt);
    G.scenery.followShadow(P.x, P.y, P.z);
    if (hooks.items && race.items) hooks.items.frame(race, dt, camera);
    if (hooks.audio) hooks.audio.frame(race, dt);
    sparks.update(race.karts, dt, camera);
    speedLines(P, dt);
    if (G.screen === 'race') hud.update(race, dt, diagText);
  } else if (G.titleRace && track) {
    field.update(G.titleRace.karts, track, dt, G.time);
    chase.glide(track, dt);
    clearLines();
  }
  if (G.scenery) G.scenery.tick(dt, camera, G.time);
  if (draw) renderer.render(scene, camera);
}

function diagText() {
  const i = renderer.info.render, pr = renderer.getPixelRatio();
  return `${G.stats.fps.toFixed(0)} fps · ${G.stats.js.toFixed(1)} ms JS\n${i.calls} calls · ${(i.triangles / 1000).toFixed(1)}k tris · ×${pr.toFixed(2)}\nbuilt in ${G.stats.buildMs.toFixed(0)} ms`;
}

// Speed lines (High only): an accent for a boost (the Kettle or a drift's mini-boost), not a
// constant — the field of view already carries ordinary speed. Up to 18 white streaks on a 2D
// canvas over the scene, each living 0.2–0.35 s while it slides outward, kept to the left and right
// of the screen (in portrait, streaks above and below would read as rain over the sky and the
// controls). Opacity eases up to 0.25 while boosting and back to nothing after.
function speedLines(P, dt) {
  const L = G.lines, high = G.settings.quality === 'high';
  const want = high && G.screen === 'race' && P.boostT > 0 ? 0.25 : 0;
  L.op += (want - L.op) * Math.min(1, dt * (want > L.op ? 12 : 5));
  if (L.op < 0.01) { L.op = 0; L.streaks.length = 0; clearLines(); return; }
  const lines = $('lines'), g = lines.getContext('2d'), w = lines.width, h = lines.height;
  const cx = w / 2, cy = h * 0.5, R = Math.min(w, h) / 2;
  while (L.streaks.length < 18) {
    const side = L.streaks.length % 2 ? 0 : Math.PI;
    L.streaks.push({ a: side + (Math.random() - 0.5) * 1.0, r: R * (0.75 + Math.random() * 0.35), len: R * (0.18 + Math.random() * 0.2), w: 1 + Math.random() * 1.5, t: 0, life: 0.2 + Math.random() * 0.15 });
  }
  g.clearRect(0, 0, w, h);
  g.lineCap = 'round';
  for (const st of L.streaks) {
    st.t += dt; st.r += R * 3.2 * dt;
    if (st.t >= st.life) { st.t = 0; st.a = (Math.cos(st.a) < 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.0; st.r = R * (0.75 + Math.random() * 0.35); st.life = 0.2 + Math.random() * 0.15; }
    const fade = Math.sin(Math.PI * (st.t / st.life));
    g.strokeStyle = `rgba(255,255,255,${(L.op * fade).toFixed(3)})`; g.lineWidth = st.w;
    // The screen is taller than wide: stretch the ring vertically so side streaks reach the edges.
    const ca = Math.cos(st.a), sa = Math.sin(st.a) * (h / w);
    g.beginPath(); g.moveTo(cx + ca * st.r, cy + sa * st.r); g.lineTo(cx + ca * (st.r + st.len), cy + sa * (st.r + st.len)); g.stroke();
  }
  G.linesDrawn = true;
}
function clearLines() {
  if (!G.linesDrawn) return;
  const l = $('lines'); l.getContext('2d').clearRect(0, 0, l.width, l.height); G.linesDrawn = false;
  G.lines.op = 0; G.lines.streaks.length = 0;
}

// Adaptive resolution: if the 90th-percentile frame interval over 2 s exceeds 19 ms, step the pixel
// ratio down one notch and wait 3 s before judging again. Never steps up during a race.
function adapt(now, dt) {
  if (!G.adaptive || G.screen !== 'race' || !G.race || G.race.phase === 'countdown') return;
  // The last 120 frames' intervals (2 s at 60 fps) in a ring, pairs of [time, ms].
  const log = G.frameLog, cap = log.length / 2, at = (G.frameN % cap) * 2;
  log[at] = now; log[at + 1] = dt * 1000; G.frameN++;
  if (now < G.judgeAt || G.frameN < 30) return;
  const recent = [];
  for (let i = 0; i < Math.min(G.frameN, cap); i++) if (now - log[i * 2] <= 2000) recent.push(log[i * 2 + 1]);
  if (recent.length < 30) return;
  recent.sort((a, b) => a - b);
  const p90 = recent[Math.floor(recent.length * 0.9)];
  const levels = PR[G.settings.quality];
  if (p90 > 19 && G.prLevel < levels.length - 1) { G.prLevel++; applyPixelRatio(); }
  G.judgeAt = now + 3000;
}

// ---------------------------------------------------------------------------------------------
// The test hook (DESIGN.md §17.3): inert unless called, present in the shipped build so the
// headless tests exercise exactly what ships.

window.__sk = {
  hooks,
  async startRace(opts = {}) {
    if (opts.quality && opts.quality !== G.settings.quality) { G.settings.quality = opts.quality; }
    if (opts.controls) { G.settings.controls = opts.controls; input.setMode(opts.controls); }
    const r = await startRace({ track: opts.track || G.settings.track, racer: opts.racer || G.settings.racer, seed: opts.seed || 1, pace: opts.pace || G.settings.pace });
    if (opts.autopilot) r.player.autopilot = true;
    return true;
  },
  /** Simulate `seconds` at the fixed step (events handled), then render one frame. */
  advance(seconds) {
    const race = G.race; if (!race) return false;
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n && !race.done; i++) { stepRace(race, input.read(inp)); if (i % 60 === 0) handleEvents(race); }
    handleEvents(race);
    // The chase camera is smoothed in real time; after a jump in simulated time, put it back behind
    // the kart and let it settle over a few rendered frames (camera only — the race does not move).
    const P = race.player;
    if (race.phase !== 'countdown') { chase.snapTo(P, G.track, chase.tune.back, chase.tune.up); chase.fov = chase.fovFor(Math.abs(P.v), P.boostT > 0); }
    for (let i = 0; i < 19; i++) render(1 / 60, false);   // settle without queuing GPU work
    render(1 / 60);
    return true;
  },
  setAutopilot(on) { if (G.race) { G.race.player.autopilot = !!on; input.enable(!on && G.screen === 'race'); } return !!G.race; },
  giveItem(id) {
    if (!G.race) return false;
    if (hooks.items && hooks.items.give) return hooks.items.give(G.race, G.race.player, id);
    G.race.player.item = id; setItemButton(id); return true;
  },
  setDrift(tier) { const P = G.race && G.race.player; if (!P) return false; P.drift = true; P.driftDir = 1; P.driftCharge = tier >= 2 ? 1.8 : tier >= 1 ? 0.9 : 0.1; P.driftTier = tier; return true; },
  stats() {
    render(1 / 60);
    const i = renderer.info;
    return {
      calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures,
      pixelRatio: renderer.getPixelRatio(), quality: G.settings.quality, track: G.track && G.track.id,
      buildMs: Math.round(G.stats.buildMs), jsMs: +G.stats.js.toFixed(2), fps: +G.stats.fps.toFixed(1),
      size: [renderer.domElement.width, renderer.domElement.height],
    };
  },
  state() {
    const r = G.race, P = r && r.player;
    return {
      screen: G.screen, paused: G.paused, running: G.running, rafScheduled: !!G.raf,
      phase: r && r.phase, countdown: r && r.countdown, time: r && r.time, finishT: r && r.finishT,
      place: P && P.place, lap: P && P.lapsDone + 1, s: P && P.fr.s, l: P && P.fr.l, kappa: P && r.track.kappa[P.fr.idx], v: P && P.v, steer: P && P.steer, drift: P && P.drift, driftTier: P && P.driftTier,
      boost: P && P.boostT, boostKind: P && P.boostKind, item: P && P.item, itemRoll: P && P.itemRoll, shield: P && P.shieldT, honey: P && P.honeyT, stun: P && P.stun, finished: P && P.finished,
      items: r && r.items ? { parcels: r.items.parcels.filter((p) => !p.taken).length, yarns: r.items.yarns.length, honeys: r.items.honeys.length, planes: r.items.planes.length, stats: r.items.stats } : null,
      audio: hooks.audio ? hooks.audio.state() : 'none', tilt: hooks.tilt ? hooks.tilt.debug() : null, settings: { ...G.settings },
      results: r && r.done ? r.order.map((k) => ({ id: k.racer.id, place: k.place, time: k.finishTime, est: k.projected, player: k.isPlayer })) : null,
      input: { ...input.read({}) },
    };
  },
  pause, resume,
  /** Each kart as drawn: race distance, whether its mesh is shown, and its fade (1 = solid). */
  karts() {
    const r = G.race || G.titleRace; if (!r) return [];
    return r.karts.map((k) => { const vk = field.byId.get(k.racer.id); return { id: k.racer.id, player: k.isPlayer, dist: k.dist, visible: vk.outer.visible, opacity: +vk.material.opacity.toFixed(2) }; });
  },
  /** Put every kart's item in its hand at once (for profiling a crowded race). */
  giveAll(id) { const r = G.race; if (!r || !r.items) return false; for (const k of r.karts) r.items.give(k, id); return true; },
  useAll() { const r = G.race; if (!r || !r.items) return 0; let n = 0; for (const k of r.karts) if (r.items.onUse(r, k)) n++; return n; },
  freeze(on) { G.frozen = !!on; return G.frozen; },
  adaptive(on) { G.adaptive = !!on; return G.adaptive; },
  showTitle,
  camera: () => ({ fov: camera.fov, pos: camera.position.toArray(), aspect: camera.aspect }),
  lookAtKart(id, dist = 3.2) {
    // The `face` test scene: put the camera in front of one kart.
    const k = (G.race || G.titleRace).karts.find((x) => x.racer.id === id); if (!k) return false;
    const c = Math.cos(k.psi), s = Math.sin(k.psi);
    G.frozen = true; stopLoop();
    camera.position.set(k.x + c * dist, k.y + 1.6, k.z + s * dist); camera.lookAt(k.x, k.y + 1.1, k.z);
    camera.fov = 50; camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return true;
  },
};
