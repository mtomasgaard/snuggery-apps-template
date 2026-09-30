// Earth's History — boot, state, the scheduler, persistence, wiring (DESIGN §11).
//
// Data flow: data.js loads and checks every file against tools/CONTRACT.md; earth.js draws the
// painted maps (and the climate lenses, lut.js) with WebGL2; plates.js rotates today's crust, coasts,
// cities and pins to each map; overlay.js draws them with Canvas 2D; timeline.js owns the slider and
// the age row; curves.js the strip under it; sheet.js the bottom sheet; find.js and about.js the two
// full-height panels. Nothing is fetched from outside the app's folder. Frames are drawn only when
// something changed (§5.11). window.__eh is the test surface (inert unless called).

import { $, clamp, store, reducedMotion, hexRGB, cssVar, isNum, easeInOut, wrap180 } from './util.js';
import * as U from './units.js';
import { createLoader, climateAt, climateBytes, elevationAt } from './data.js';
import { createView, attachGestures, unitVec, lonLatOf } from './proj.js';
import { createEarth } from './earth.js';
import { createPlates, compass, distanceKm, quatAt, rotate } from './plates.js';
import { createOverlay } from './overlay.js';
import { createTimeline } from './timeline.js';
import { createCurves } from './curves.js';
import { createSheet, shortCite } from './sheet.js';
import { createFind } from './find.js';
import { createAbout } from './about.js';
import { buildLut, legendGradient, legendTicks, legendUnit, LEGEND_TEXT, LEGEND_LONG } from './lut.js';

const DEG = Math.PI / 180;
const FADE_MS = 200, PLAY_MS = 667, REST_MS = 150, TURN_MS = 400, PERF_N = 120;
// The opening (§19): the globe fades in at 750 Ma, then the 90 maps play to today; once, skippable.
const INTRO_FADE_MS = 700, INTRO_PLAY_MS = 5000, INTRO_GROW = 0.6, PIN_DROP_MS = 420;
// The view follows the continents (§19): a point of today's Africa (Kinshasa, on plate 701, the
// model's reference frame) carried to each map; the view's centre is that point's longitude and its
// latitude + 20°, held within ±40°. A turn by hand stops it; a double-tap starts it again.
const FOLLOW = 'Kinshasa', FOLLOW_LAT = 20, FOLLOW_LAT_MAX = 40, FOLLOW_TAU = 180;
const VERSION = '1.0';
const L = createLoader('data/');
const LENS_NAME = { surface: 'Surface', temperature: 'Temperature', rain: 'Rain' };
const NO_CLIMATE = 'The climate model starts at 540 million years ago — this map has no temperature or rain.';
// Two clauses, each its own line, so a separator never starts a line.
const PLATES_NOTE = ['Pieces of today\'s crust and how they moved', 'Arrows: the million years before this map'];

const S = {
  stop: 0, lens: 'surface', plates: false, coasts: true, units: 'us', sheet: 0,
  pin: null, playing: false, scrubbing: false, lost: false, perfHud: false, follow: true,
};
let track = null, followLast = null, following = false;
let manifest = null, ts = null, P = null, places = null, climate = null, elevation = null;
let story = null, about = null, curvesData = null;
let view = null, earth = null, overlay = null, tl = null, curves = null, sheet = null, find = null, aboutPanel = null;
let arrows = null, lastRotateMs = 0, climateKey = null;
const luts = {};
const dirty = { earth: true, overlay: true, curves: true };
let rafPending = false, fling = null, turn = null, playTimer = 0, restTimer = 0, hudTimer = 0;
const frames = [];
const colours = { space: [0.02, 0.027, 0.047], glow: hexRGB('#8fc0ff') };
let firstEarthFrame = null;
let intro = null, introPending = false, earthFade = 1, pinDrop = null;
const fadeMs = () => (reducedMotion() ? 0 : FADE_MS);
const wide = window.matchMedia('(min-width: 700px)');

/* ── persistence (§4.6) ── */
const validPin = (v) => v && ((v.kind === 'tap' && isNum(v.lon) && isNum(v.lat))
  || (v.kind === 'city' && Number.isInteger(v.id) && typeof v.n === 'string')
  || (v.kind === 'look' && typeof v.id === 'string'));
function restore() {
  S.stop = store.get('stop', 0, (v) => Number.isInteger(v) && v >= 0 && v < 90);
  S.plates = store.get('plates', false, (v) => typeof v === 'boolean');
  S.coasts = store.get('coasts', true, (v) => typeof v === 'boolean');
  S.units = store.get('units', 'us', (v) => v === 'us' || v === 'metric');
  S.lens = store.get('lens', 'surface', (v) => ['surface', 'temperature', 'rain'].includes(v));
  S.sheet = store.get('sheet', 0, (v) => v === 0 || v === 1 || v === 2);
  S.pin = store.get('pin', null, validPin);
  S.follow = store.get('follow', true, (v) => typeof v === 'boolean');
  U.setSystem(S.units);
  view.mode = store.get('view', 'globe', (v) => v === 'globe' || v === 'map');
  const g = store.get('globe', null, (v) => v && [v.lon, v.lat, v.zoom].every(isNum));
  if (g) Object.assign(view.globe, { lon: g.lon, lat: g.lat, zoom: g.zoom });
  const m = store.get('map', null, (v) => v && [v.lon0, v.panY, v.zoom].every(isNum));
  if (m) Object.assign(view.map, { lon0: m.lon0, panY: m.panY, zoom: m.zoom });
  view.clamp();
}
function saveView() {
  store.set('view', view.mode);
  store.set('globe', { ...view.globe });
  store.set('map', { ...view.map });
}

/* ── the scheduler (§5.11): one rAF when something is dirty; a blend, a fling or a turn keep going ── */
function requestRender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(frame);
}
function frame(now) {
  rafPending = false;
  let more = false;
  if (earth && earth.supported) {
    const was = earth.blending();
    if (earth.tick(now)) more = true;
    if (was) dirty.earth = true;
  }
  if (fling) {
    const dt = Math.min(64, now - fling.t);
    fling.t = now;
    view.panBy((fling.vx * dt) / 1000, (fling.vy * dt) / 1000);
    const k = 0.92 ** (dt / 16);
    fling.vx *= k; fling.vy *= k;
    dirty.earth = dirty.overlay = true;
    if (view.angularSpeed(fling.vx, fling.vy) < 0.02) { fling = null; saveView(); settleAria(); } else more = true;
  }
  if (intro && introTick(now)) more = true;
  else if (!turn && !fling && followTick(now)) more = true;
  if (pinDrop) {
    pinDrop.k = Math.min(1, (performance.now() - pinDrop.t0) / PIN_DROP_MS);
    dirty.overlay = true;
    if (pinDrop.k >= 1) pinDrop = null; else more = true;
  }
  if (turn) {
    const k = Math.min(1, (performance.now() - turn.t0) / TURN_MS), e = easeInOut(k);
    if (view.mode === 'globe') { view.globe.lon = turn.lon0 + turn.dlon * e; view.globe.lat = turn.lat0 + (turn.lat1 - turn.lat0) * e; } else view.map.lon0 = turn.lon0 + turn.dlon * e;
    view.clamp();
    dirty.earth = dirty.overlay = true;
    if (k >= 1) { turn = null; saveView(); settleAria(); } else more = true;
  }
  const t0 = performance.now();
  let e = 0, o = 0;
  if (dirty.earth && earth && earth.supported && !earth.lost) {
    const t = performance.now();
    earth.draw({
      mode: view.mode, cx: view.cx, cy: view.cy, scale: view.mode === 'globe' ? view.radius() : view.mapScale(),
      lam0: view.centreLon() * DEG, phi0: view.globe.lat * DEG, panY: view.map.panY,
      space: colours.space, glow: colours.glow, lens: S.lens !== 'surface', fade: earthFade,
    });
    e = performance.now() - t;
    if (!firstEarthFrame && earth.showing()) { firstEarthFrame = performance.now(); doneLoading(); }
  }
  if (dirty.overlay && overlay) {
    o = overlay.draw({ view, plates: P, coasts: S.coasts, outlines: S.plates, arrows: S.plates ? arrows : null, pins: pins(), hidden: S.lost });
    $('overlay').style.opacity = earthFade < 1 ? String(earthFade * earthFade) : '';
    placeCard();
  }
  if (dirty.curves && curves && $('curves').offsetParent) curves.draw(S.stop);
  if (e || o) {
    frames.push({ earth: +e.toFixed(3), overlay: +o.toFixed(3), total: +(performance.now() - t0).toFixed(3) });
    if (frames.length > PERF_N) frames.shift();
  }
  dirty.earth = dirty.overlay = dirty.curves = false;
  if (more) requestRender();
}
const redraw = (earthToo = true) => { if (earthToo) dirty.earth = true; dirty.overlay = true; requestRender(); };

/* ── stops ── */
function setStop(i, { fade = 0, announce = false, scrub = false, rolling = false } = {}) {
  // A tap that found no crust has no plate to ride: its pin and card belong to that one map.
  if (S.pin && S.pin.kind === 'tap' && S.pin.pi == null && S.pin.stop !== i) { S.pin = null; store.set('pin', null); }
  S.stop = i;
  tl.set(i, { announce, thumb: !scrub, rolling });
  if (earth && earth.supported) earth.show(i, fade);
  if (P) {
    lastRotateMs = P.setStop(i);
    arrows = S.plates ? P.arrows() : null;
  }
  updateClimate();
  renderReadout();
  renderNotice();
  renderLegend();
  if (sheet) sheet.render(i);
  dirty.curves = true;
  redraw();
}
/** After a step, a key, a release or a pause: persist, announce, prefetch the neighbours (§5.8). */
function settle() {
  store.set('stop', S.stop);
  if (earth && earth.supported) earth.setPrefetch(S.playing ? [S.stop - 1, S.stop - 2] : [S.stop - 1, S.stop + 1]);
  settleAria();
  if (!S.playing && !intro) announcePin();
}
function go(i) {
  endIntro();
  pause(false);
  i = clamp(i, 0, manifest.count - 1);
  if (i === S.stop) return;
  setStop(i, { fade: fadeMs(), announce: true });
  settle();
}

/* play toward today at 1.5 maps per second (§4.3) */
function play() {
  endIntro();
  if (S.playing) { pause(true); return; }
  if (S.stop === 0) setStop(manifest.count - 1, { fade: 0 });
  S.playing = true;
  tl.setPlaying(true);
  tl.setGlide(PLAY_MS);          // play reads as a time-lapse: the thumb glides, the counter rolls (§19)
  settle();
  playTimer = setTimeout(playTick, PLAY_MS);
}
function playTick() {
  if (!S.playing) return;
  setStop(S.stop - 1, { fade: fadeMs(), rolling: true });
  if (S.stop === 0) { pause(true); return; }
  earth && earth.supported && earth.setPrefetch([S.stop - 1, S.stop - 2]);
  playTimer = setTimeout(playTick, PLAY_MS);
}
function pause(announce) {
  if (!S.playing) return;
  S.playing = false;
  clearTimeout(playTimer);
  tl.setPlaying(false);
  tl.setGlide(0);
  if (announce) tl.set(S.stop, { announce: true });
  settle();
}

/* ── following the continents (§19) ── */
/** Where the followed point sits on each map, rotated with its plate as a city pin is; on maps
    older than its polygon it holds the oldest place it has. Built once the plates have loaded. */
function buildTrack() {
  const q = places && P && places.places.find((c) => c.n === FOLLOW);
  if (!q) return;
  const t = new Array(manifest.count), u = unitVec(q.lon, q.lat), out = [0, 0, 0];
  for (let i = 0; i < manifest.count; i++) {
    if (Math.fround(P.pl.times[i][0]) > q.from_ma) { t[i] = t[i - 1]; continue; }
    rotate(quatAt(P.pl, i, 0, q.pi), u[0], u[1], u[2], out, 0);
    t[i] = lonLatOf(out);
  }
  for (let i = manifest.count - 1; i >= 0; i--) if (!t[i]) t[i] = t[i + 1] || [q.lon, q.lat];
  for (let i = 1; i < manifest.count; i++) if (!t[i]) t[i] = t[i - 1];
  track = t;
}
/** The followed view centre for a stop: [lon, lat], or null before the plates arrive. */
function followAt(i) {
  if (!track) return null;
  const [lon, lat] = track[i];
  return [lon, clamp(lat + FOLLOW_LAT, -FOLLOW_LAT_MAX, FOLLOW_LAT_MAX)];
}
/** Ease the view toward the followed centre (τ 180 ms; a jump under Reduce Motion). The map view
    follows the longitude only. True while it still needs frames. */
function followTick(now) {
  const t = S.follow && followAt(S.stop);
  if (!t) { followLast = null; following = false; return false; }
  const globe = view.mode === 'globe';
  const lon0 = globe ? view.globe.lon : view.map.lon0;
  const dlon = wrap180(t[0] - lon0), dlat = globe ? t[1] - view.globe.lat : 0;
  if (Math.abs(dlon) < 0.05 && Math.abs(dlat) < 0.05) {
    if (following || dlon || dlat) {
      if (globe) { view.globe.lon = t[0]; view.globe.lat = t[1]; } else view.map.lon0 = t[0];
      view.clamp(); dirty.earth = dirty.overlay = true;
      if (following) { following = false; saveView(); settleAria(); }
    }
    followLast = null;
    return false;
  }
  const dt = followLast == null ? 16 : Math.min(64, now - followLast);
  followLast = now;
  following = true;
  const a = reducedMotion() ? 1 : 1 - Math.exp(-dt / FOLLOW_TAU);
  if (globe) { view.globe.lon = lon0 + dlon * a; view.globe.lat += dlat * a; } else view.map.lon0 = lon0 + dlon * a;
  view.clamp();
  dirty.earth = dirty.overlay = true;
  return true;
}
/** A turn by hand, a pin turned to, or a view set by a test: the view is the person's now. */
function stopFollowing() {
  following = false; followLast = null;
  if (!S.follow) return;
  S.follow = false;
  store.set('follow', false);
}
function startFollowing() {
  S.follow = true;
  store.set('follow', true);
  requestRender();
}

/* ── the opening (§19): on the very first launch only, the globe fades in at 750 Ma and the 90
   maps play to today in about five seconds — the proxy of each map in turn, as while scrubbing,
   with the counter rolling. It starts as soon as the proxy sheet is on the GPU, without waiting for
   the plates. The globe runs at 0.6 of its size, so the 256 × 128 previews are magnified less, and
   grows into place over the last fifth; it follows the continents as the view always does (the
   followed point, once the plates have arrived). Then today's full map fades in and the controls
   appear. Any touch, key or Skip ends it at once; so does hiding the page. Stored (eh.intro)
   before it starts, so it never repeats; never under Reduce Motion. ── */
function wantIntro() {
  if (reducedMotion()) return false;
  return store.get('intro', null) == null && store.get('stop', null) == null;
}
function startIntro() {
  if (!introPending) return;
  if (!earth || !earth.supported) { endIntro(); return; }
  introPending = false;
  intro = { t0: performance.now(), last: performance.now(), globe: view.mode === 'globe' };
  if (intro.globe) view.grow = INTRO_GROW;
  earth.setScrubbing(true);
  $('intro-skip').hidden = false;
  $('intro-cap').hidden = false;
  requestRender();
}
function introTick(now) {
  const t = performance.now() - intro.t0;
  earthFade = clamp(t / INTRO_FADE_MS, 0, 1);
  const k = clamp((t - INTRO_FADE_MS * 0.6) / INTRO_PLAY_MS, 0, 1), e = easeInOut(k);
  tl.placeThumb(e);
  const i = tl.nearest(e);
  if (i !== S.stop) setStop(i, { fade: 0, scrub: true, rolling: true });
  if (intro.globe) view.grow = INTRO_GROW + (1 - INTRO_GROW) * easeInOut(clamp((k - 0.8) / 0.2, 0, 1));
  followTick(now);
  dirty.earth = dirty.overlay = true;
  if (k >= 1) { endIntro(); return false; }
  return true;
}
/** End the opening (or cancel it before it starts): today, the full map fading in, the controls back. */
function endIntro() {
  if (!intro && !introPending) return false;
  intro = null; introPending = false; earthFade = 1;
  view.grow = 1;
  $('earth').classList.remove('intro');
  $('intro-skip').hidden = true;
  $('intro-cap').hidden = true;
  $('overlay').style.opacity = '';
  if (earth && earth.supported) earth.setScrubbing(false);
  if (tl) tl.stopRoll();
  setStop(0, { fade: fadeMs(), announce: true });
  settle();
  saveView();
  redraw();
  return true;
}

/* ── turning the Earth to a place (Find, Look for): 400 ms, a jump under reduced motion ── */
function turnTo(lon, lat) {
  fling = null;
  stopFollowing();
  const lon0 = view.mode === 'globe' ? view.globe.lon : view.map.lon0;
  const target = { lon0, dlon: wrap180(lon - lon0), lat0: view.globe.lat, lat1: clamp(lat, -89.5, 89.5), t0: performance.now() };
  if (reducedMotion()) {
    if (view.mode === 'globe') { view.globe.lon = lon; view.globe.lat = target.lat1; } else view.map.lon0 = lon;
    view.clamp(); saveView(); settleAria(); redraw();
    return;
  }
  turn = target;
  requestRender();
}

/* ── pins (§3.6, §3.7, §7.2, §8): a tap, a city from Find, or a Look-for anchor; each rides its plate ── */
const cityOf = (pin) => (places && pin && pin.kind === 'city' ? places.places[pin.id] : null);
const lookOf = (pin) => (story && pin && pin.kind === 'look' ? story.look_for.find((p) => p.id === pin.id) : null);
/** Is a present-day point whose polygon begins at fromMa carried back to this map? (§7.2) */
const carried = (fromMa) => fromMa == null || Math.fround(P.T) <= fromMa;
function pinPosition() {
  const pin = S.pin;
  if (!pin || !P) return null;
  if (pin.kind === 'tap') {
    if (pin.pi == null) return pin.stop === S.stop ? [pin.lon, pin.lat] : null;
    if (!P.ringValidAt(pin.ring, P.T)) return null;
    return P.place(pin.pi, pin.lon, pin.lat);
  }
  const q = pin.kind === 'city' ? cityOf(pin) : lookOf(pin);
  if (!q || !carried(q.from_ma)) return null;
  return P.place(q.pi, q.lon, q.lat);
}
function pins() {
  const p = pinPosition();
  if (!p) return [];
  const drop = pinDrop ? pinDrop.k : 1;
  if (S.pin.kind === 'city') return [{ lon: p[0], lat: p[1], kind: 'city', label: cityOf(S.pin).n, drop }];
  if (S.pin.kind === 'look') return [{ lon: p[0], lat: p[1], kind: 'look', label: lookOf(S.pin).label, drop }];
  return [{ lon: p[0], lat: p[1], kind: 'tap', drop }];
}
function setPin(pin) {
  S.pin = pin;
  store.set('pin', pin);
  // A new pin drops and settles; its card opens compact (§19).
  pinDrop = pin && !reducedMotion() ? { t0: performance.now(), k: 0 } : null;
  $('readout').classList.remove('open');
  $('readout-more').setAttribute('aria-expanded', 'false');
  $('readout-more').setAttribute('aria-label', 'Show the whole card');
  if (pin && pin.kind !== 'look') ensureGrids();
  renderReadout();
  announcePin();
  redraw(false);
}
/**
 * The card is not a live region: it is rewritten at every stop, and during play or a scrub a
 * screen reader would read all of it at every map. A short line is announced instead when a pin
 * is set and when the slider settles (§9).
 */
function announcePin() {
  const live = $('ro-live');
  if (!S.pin || $('readout').hidden) { live.textContent = ''; return; }
  const head = $('ro-head').textContent, then = $('ro-then');
  const first = [...then.childNodes].filter((n) => !(n.classList && n.classList.contains('fn'))).map((n) => n.textContent).join('');
  const short = S.pin.kind === 'look' ? '' : first.replace(/^Then: /, '').split(' · ').slice(0, 2).join(', ');
  live.textContent = short ? `${head}: ${short}` : head;
}
/** The readout's "what was there" needs the two grids: loaded on the first tap or city (§10). */
function ensureGrids() {
  if (elevation && climate) return;
  Promise.all([L.elevation(), L.climate()]).then(([e, c]) => { elevation = e; climate = c; renderReadout(); updateClimate(); redraw(); }).catch(dataProblem);
}
function tapAt(lon, lat) {
  const hit = P ? P.lookup(lon, lat) : null;
  setPin(hit
    ? { kind: 'tap', lon: hit.present[0], lat: hit.present[1], pi: hit.pi, ring: hit.ring, plate: hit.plate }
    : { kind: 'tap', lon, lat, stop: S.stop });
}
function chooseCity(i) {
  const q = places.places[i];
  setPin({ kind: 'city', id: i, n: q.n });
  if (S.sheet === 2 && !wide.matches) sheet.setHeight(0);
  const pos = pinPosition();
  if (pos) turnTo(pos[0], pos[1]);
}
function lookFor(item) {
  setPin({ kind: 'look', id: item.id });
  if (!wide.matches) sheet.setHeight(0);
  const pos = pinPosition();
  if (pos) turnTo(pos[0], pos[1]);
}
function closeReadout() { setPin(null); }
function toggleCardMore() {
  const card = $('readout'), open = !card.classList.contains('open');
  card.classList.toggle('open', open);
  $('readout-more').setAttribute('aria-expanded', String(open));
  $('readout-more').setAttribute('aria-label', open ? 'Show less of the card' : 'Show the whole card');
  placeCard();
}
/**
 * The card is a callout anchored to its pin (§19): above it when there is room under the controls,
 * else below it, its pointer on the pin; centred under the controls when the pin is off screen, on
 * the far side of the globe or not carried back to this map.
 */
function placeCard() {
  const card = $('readout');
  if (card.hidden || !view) return;
  const W = view.W, H = view.H, w = card.offsetWidth, h = card.offsetHeight;
  const topMin = 48, botMax = H - document.querySelector('.earth-bottom').offsetHeight - 4, GAP = 13;
  const pos = pinPosition();
  let scr = null;
  if (pos && !S.lost) { const q = view.project(pos[0], pos[1]); if (q[2] && q[0] >= 0 && q[0] <= W && q[1] >= 0 && q[1] <= H) scr = q; }
  let left = (W - w) / 2, top = topMin, side = '';
  if (scr) {
    left = clamp(scr[0] - w / 2, 10, Math.max(10, W - 10 - w));
    if (scr[1] - GAP - 5 - h >= topMin) { top = scr[1] - GAP - 5 - h; side = 'above'; } else if (scr[1] + GAP + h <= botMax) { top = scr[1] + GAP; side = 'below'; } else top = clamp(scr[1] - GAP - 5 - h, topMin, Math.max(topMin, botMax - h));
    card.style.setProperty('--px', `${clamp(scr[0] - left, 14, w - 14).toFixed(1)}px`);
  }
  card.classList.toggle('above', side === 'above');
  card.classList.toggle('below', side === 'below');
  card.style.left = `${left.toFixed(1)}px`;
  card.style.top = `${top.toFixed(1)}px`;
}

/* the card (§8): every {…} filled from the data files */
/*
 * The card's text is built from segments: [text, footnote mark or '', keep on one line]. A group
 * that must not be cut ("29 °F, 27 in of rain a year") never wraps, so the collapsed card, which
 * clamps its lines, can only cut between groups; the footnote marks hide until "More" (§19).
 */
function fill(elm, segs) {
  elm.replaceChildren(...segs.flatMap(([t, fn, nw], j) => {
    const out = [];
    if (j && segs[j - 1][0] && !/^[.,]/.test(t)) out.push(' ');
    const sp = document.createElement('span'); sp.textContent = t; if (nw) sp.className = 'nw'; out.push(sp);
    if (fn) { const f = document.createElement('span'); f.className = 'fn'; f.textContent = fn; out.push(f); }
    return out;
  }));
}
function thenParts(lon, lat, s) {
  const segs = [[`${U.latText(lat)} ${U.lonText(lon)}`, '', true]], foot = [];
  if (elevation && s.elevation != null) {
    const c = elevationAt(elevation, s.elevation, lat, lon);
    if (c) { segs.push(['·', '', false], [c.name, '¹', false]); foot.push(`¹ PaleoDEM, ${s.elevation_age_ma} Ma`); }
  }
  if (climate && s.climate != null) {
    const t = climateAt(climate, 'temperature', s.climate, lat, lon), r = climateAt(climate, 'rain', s.climate, lat, lon);
    if (t != null && r != null) { segs.push(['·', '', false], [`${U.temperature(t)}, ${U.rainPerYear(r)} of rain a year`, '²', true]); foot.push(`² climate model, ${s.climate_age_ma} Ma`); }
  }
  return { segs, foot };
}
function motionSegs(pi, lon, lat) {
  const m = P.motionOf(pi, lon, lat);
  return m.speed >= 0.05 ? [['It was moving', '', false], [`${U.speedCmYr(m.speed)} a year`, '', true], [`toward the ${compass(m.bearing)}.`, '³', false]] : [];
}
const carriedOnly = (name, fromMa) => (fromMa === 0
  ? `${name} is not carried back before today in this model.`
  : `${name} is carried back only to ${U.maText(fromMa)} million years ago in this model.`);
function renderReadout() {
  const card = $('readout');
  const pin = S.pin;
  if (!pin || !manifest || (pin.kind === 'city' && !cityOf(pin)) || (pin.kind === 'look' && !lookOf(pin))) { card.hidden = true; return; }
  card.hidden = false;
  dirty.overlay = true;
  requestRender();
  const s = manifest.slices[S.stop];
  const pos = pinPosition();
  const head = $('ro-head'), then = $('ro-then'), now = $('ro-now'), notes = $('ro-notes');
  const phrase = U.agePhrase(s.age_ma);

  if (pin.kind === 'look') {
    const p = lookOf(pin);
    head.textContent = p.label;
    then.textContent = p.text;
    if (pos) now.textContent = `On this map it sits at ${U.latText(pos[1])} ${U.lonText(pos[0])}; it is now at ${U.latText(p.lat)} ${U.lonText(p.lon)}.`;
    else now.textContent = carriedOnly('This crust', p.from_ma);
    notes.textContent = `PALEOMAP plate ${p.plate} · ${p.sources.map((id) => shortSource(id)).join(' · ')}`;
    return;
  }
  if (pin.kind === 'city') {
    const q = cityOf(pin);
    head.textContent = `${q.n}, ${phrase}`;
    if (!pos) {
      then.textContent = carriedOnly(`${q.n}’s crust`, q.from_ma);
      now.textContent = '';
      notes.textContent = `PALEOMAP plate ${q.plate}`;
      return;
    }
    const t = thenParts(pos[0], pos[1], s);
    fill(then, [['Then:', '', false], ...t.segs]);
    fill(now, [[`${q.n} is now at`, '', false], [`${U.latText(q.lat)} ${U.lonText(q.lon)}.`, '', true], ...motionSegs(q.pi, q.lon, q.lat)]);
    t.foot.push(`³ PALEOMAP plate ${q.plate}`);
    notes.textContent = t.foot.join('  ');
    return;
  }
  head.textContent = `Here, ${phrase}`;
  if (!pos) {
    // A pin whose crust the model does not carry to this map (§7.2): hidden, and the card says so.
    head.textContent = U.ageText(s.age_ma);
    then.textContent = 'The crust you tapped is not in this reconstruction at this age.';
    now.textContent = '';
    notes.textContent = `PALEOMAP plate ${pin.plate}`;
    return;
  }
  const t = thenParts(pos[0], pos[1], s);
  fill(then, t.segs);
  if (pin.pi == null) {
    now.textContent = 'No piece of today\'s crust sits here in this reconstruction.';
  } else {
    const present = [pin.lon, pin.lat];
    let near = null;
    if (places) for (const q of places.places) { const d = distanceKm(present, [q.lon, q.lat]); if (!near || d < near.d) near = { d, q }; }
    const where = `${U.latText(present[1])} ${U.lonText(present[0])}`;
    fill(now, [['This crust is now at', '', false], [`${where},`, '', true],
      ...(near && near.d <= 1000 ? [[`${U.distanceKm(near.d)} from ${near.q.n}.`, '', true]] : [['far from any city on the list.', '', false]]),
      ...motionSegs(pin.pi, pin.lon, pin.lat)]);
    t.foot.push(`³ PALEOMAP plate ${pin.plate}`);
  }
  notes.textContent = t.foot.join('  ');
}
function shortSource(id) {
  const s = story && story.sources.find((x) => x.id === id);
  return s ? shortCite(s.cite) : id;
}

/* ── the climate lenses (§5.6) ── */
function updateClimate() {
  if (!earth || !earth.supported) return;
  const s = manifest.slices[S.stop];
  if (S.lens === 'surface' || !climate || s.climate == null) {
    if (climateKey !== null) { earth.setClimate(null); climateKey = null; dirty.earth = true; }
    return;
  }
  const key = `${S.lens}:${s.climate}`;
  if (key === climateKey) return;
  if (!luts[S.lens]) luts[S.lens] = buildLut(S.lens, climate.fields[S.lens === 'rain' ? 1 : 0]);
  earth.setClimate(climateBytes(climate, S.lens, s.climate), luts[S.lens]);
  climateKey = key;
  dirty.earth = true;
}
function renderLegend() {
  const lg = $('legend');
  const s = manifest && manifest.slices[S.stop];
  if (!s || S.lens === 'surface' || s.climate == null || !climate) { lg.hidden = true; return; }
  lg.hidden = false;
  $('legend-bar').style.background = legendGradient(S.lens);
  const ticks = legendTicks(S.lens);
  const row = $('legend-ticks');
  const spans = ticks.map((t) => Object.assign(document.createElement('span'), { textContent: t.text }));
  const marks = ticks.map((t) => { const i = document.createElement('i'); i.style.left = `${(t.pos * 100).toFixed(2)}%`; return i; });
  row.replaceChildren(...marks, ...spans);
  $('legend-text').textContent = LEGEND_TEXT[S.lens];
  layoutLegend();
  const plain = (t) => t.replace(/ (°F|°C|in|mm)$/, '');
  lg.setAttribute('aria-label', `${LEGEND_LONG[S.lens]}. Scale from ${plain(ticks[0].text)} to ${plain(ticks[ticks.length - 1].text)} ${legendUnit(S.lens)}. Switch to ${U.isUS() ? 'metric' : 'US'} units.`);
}
/**
 * Place the tick labels by their measured widths: each centred on its tick, the first flush left,
 * the last flush right, and any that would come within 5 px of a neighbour nudged apart (rain's
 * "100" and "200" once collided as "100200"). The hairline marks stay at the true positions.
 */
function layoutLegend() {
  const lg = $('legend');
  if (lg.hidden || S.lens === 'surface') return;
  const ticks = legendTicks(S.lens), row = $('legend-ticks'), spans = [...row.querySelectorAll('span')];
  const W = row.clientWidth || 184, GAP = 5;
  const ws = spans.map((sp) => sp.getBoundingClientRect().width);
  const xs = ticks.map((t, j) => clamp(t.pos * W - ws[j] / 2, 0, W - ws[j]));
  xs[0] = Math.min(xs[0], 0); xs[xs.length - 1] = W - ws[ws.length - 1];
  for (let j = 1; j < xs.length; j++) xs[j] = Math.max(xs[j], xs[j - 1] + ws[j - 1] + GAP);
  for (let j = xs.length - 2; j >= 0; j--) xs[j] = Math.min(xs[j], xs[j + 1] - ws[j] - GAP);
  spans.forEach((sp, j) => { sp.style.left = `${xs[j].toFixed(1)}px`; });
}

/* ── notices and the accessible description ── */
function renderNotice() {
  const n = $('notice');
  const lines = [];
  const s = manifest && manifest.slices[S.stop];
  if (S.lost) lines.push('Restoring the view…');
  else {
    if (s && S.lens !== 'surface' && s.climate == null) lines.push(NO_CLIMATE);
    if (S.plates) lines.push(...PLATES_NOTE);
  }
  n.replaceChildren(...lines.map((t) => { const sp = document.createElement('span'); sp.textContent = t; return sp; }));
  n.hidden = !lines.length;
}
function settleAria() {
  const s = manifest.slices[S.stop];
  const c = view.mode === 'globe' ? `centered on ${U.latText(view.globe.lat)}, ${U.lonText(view.globe.lon)}` : `centered on ${U.lonText(view.map.lon0)}`;
  const layers = [S.coasts && 'today\'s coasts shown', S.plates && 'outlines of today\'s crust shown'].filter(Boolean).join(', ');
  $('stage').setAttribute('aria-label', `${view.mode === 'globe' ? 'Globe' : 'Map'} of the Earth ${U.agePhrase(s.age_ma)}, ${LENS_NAME[S.lens]} lens, ${c}${layers ? ', ' + layers : ''}`);
}

/* ── controls ── */
function setView(mode) {
  turn = null;
  view.setMode(mode);
  for (const b of document.querySelectorAll('.segmented button')) b.setAttribute('aria-checked', String(b.dataset.view === mode));
  saveView();
  settleAria();
  redraw();
}
function setLayer(layer, on) {
  if (layer === 'plates') {
    S.plates = on;
    arrows = on && P ? P.arrows() : null;
    $('tg-plates').setAttribute('aria-pressed', String(on));
    store.set('plates', on);
    renderNotice();
  } else if (layer === 'coasts') {
    S.coasts = on;
    $('tg-coasts').setAttribute('aria-pressed', String(on));
    store.set('coasts', on);
  }
  settleAria();
  redraw(false);
}
function setLens(lens) {
  const chip = document.querySelector(`.chip[data-lens="${lens}"]`);
  if (!chip || chip.disabled) return false;
  S.lens = lens;
  for (const b of document.querySelectorAll('.chip')) b.setAttribute('aria-checked', String(b.dataset.lens === lens));
  store.set('lens', lens);
  if (lens !== 'surface' && !climate) {
    // climate.bin (1.5 MB) is loaded on the first climate lens or tap (§10).
    L.climate().then((c) => { climate = c; updateClimate(); renderLegend(); redraw(); }).catch(dataProblem);
  }
  updateClimate();
  renderLegend();
  renderNotice();
  if (manifest && view) settleAria();
  redraw();
  return true;
}
function setUnits(u) {
  U.setSystem(u);
  S.units = U.getSystem();
  store.set('units', S.units);
  renderReadout();
  renderLegend();
  if (sheet) sheet.render(S.stop, true);
  if (aboutPanel) aboutPanel.syncUnits();
  dirty.curves = true;
  requestRender();
  return S.units;
}

/* ── the frame-time readout for a phone check (§10): five taps on About's version line ── */
function togglePerfHud(on = !S.perfHud) {
  S.perfHud = on;
  const hud = $('perf-hud');
  hud.hidden = !on;
  clearInterval(hudTimer);
  if (!on) return;
  const upd = () => {
    const p = window.__eh.perf(), sm = p.summary, c = p.cache;
    const f = (x) => (x == null ? '–' : x.toFixed(1));
    hud.textContent = `frame ${f(sm.total.median)} ms · p95 ${f(sm.total.p95)} · max ${f(sm.total.max)}\n`
      + `gl ${f(sm.earth.median)} · overlay ${f(sm.overlay.median)} · rotate ${f(p.rotateMs)} ms\n`
      + (c ? `maps ${c.cached.length} · ${c.gpuMiB} MiB · decodes ${c.decodes} · fallback ${c.fallbackDecodes}` : 'no WebGL');
  };
  upd();
  hudTimer = setInterval(upd, 500);
}

function wire() {
  for (const b of document.querySelectorAll('.segmented button')) b.addEventListener('click', () => setView(b.dataset.view));
  $('tg-plates').addEventListener('click', () => setLayer('plates', !S.plates));
  $('tg-coasts').addEventListener('click', () => setLayer('coasts', !S.coasts));
  for (const b of document.querySelectorAll('.chip')) b.addEventListener('click', () => setLens(b.dataset.lens));
  $('legend').addEventListener('click', () => setUnits(U.isUS() ? 'metric' : 'us'));
  $('readout-close').addEventListener('click', closeReadout);
  $('readout-more').addEventListener('click', toggleCardMore);
  $('intro-skip').addEventListener('click', () => endIntro());
  // Any touch or key during the opening ends it: the app is itself at once.
  document.addEventListener('pointerdown', (e) => { if ((intro || introPending) && e.target !== $('intro-skip')) endIntro(); }, true);
  document.addEventListener('keydown', () => { if (intro || introPending) endIntro(); }, true);

  const stage = $('stage');
  attachGestures(stage, {
    start() { fling = null; turn = null; },
    pan(dx, dy) { stopFollowing(); view.panBy(dx, dy); redraw(); },
    pinch(ratio) { view.zoomBy(ratio); redraw(); },
    release(vx, vy) {
      if (!reducedMotion() && (vx || vy) && view.angularSpeed(vx, vy) >= 0.02) { fling = { vx, vy, t: performance.now() }; requestRender(); } else { saveView(); settleAria(); }
    },
    tap(x, y) { const ll = view.unproject(x, y); if (ll) tapAt(ll[0], ll[1]); else if (S.pin) closeReadout(); },
    doubleTap() {
      fling = null; turn = null; view.reset();
      startFollowing();
      const f = followAt(S.stop);                 // back to the usual view: the one that follows the continents
      if (f) { if (view.mode === 'globe') { view.globe.lon = f[0]; view.globe.lat = f[1]; } else view.map.lon0 = f[0]; view.clamp(); }
      saveView(); settleAria(); redraw();
    },
  });
  stage.addEventListener('keydown', (e) => {
    const t = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] }[e.key];
    if (t) {
      e.preventDefault();
      stopFollowing();
      if (view.mode === 'globe') { view.globe.lon += t[0]; view.globe.lat += t[1]; } else view.map.lon0 += t[0];
      view.clamp(); saveView(); settleAria(); redraw();
    } else if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
      e.preventDefault();
      view.zoomBy(e.key === '+' || e.key === '=' ? 1.25 : 0.8); saveView(); redraw();
    }
  });
  // Arrow keys step through the maps when nothing in particular has focus (desktop).
  document.addEventListener('keydown', (e) => {
    if (e.target !== document.body || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(S.stop + 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(S.stop - 1); } else if (e.key === ' ') { e.preventDefault(); play(); }
  });
  // Hidden (another app, the lock screen): stop playing and every animation; nothing runs in the background.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    pause(false); fling = null; turn = null; pinDrop = null;
    endIntro();
    if (tl) tl.stopRoll();
    if (S.perfHud) clearInterval(hudTimer);
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.perfHud) togglePerfHud(true); });

  new ResizeObserver(() => resize()).observe($('earth'));
  new ResizeObserver(() => resizeCurves()).observe($('curves'));
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = () => {
    const c = cssVar('--space'), g = cssVar('--glow');
    if (/^#[0-9a-f]{6}$/i.test(c)) colours.space = hexRGB(c);
    if (/^#[0-9a-f]{6}$/i.test(g)) colours.glow = hexRGB(g);
    dirty.curves = true; redraw();
  };
  // Canvas text (the curves' values, pin labels) and the measured legend follow the fonts once they load.
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { layoutLegend(); dirty.curves = true; redraw(false); });
  if (mq.addEventListener) mq.addEventListener('change', theme);
  if (wide.addEventListener) wide.addEventListener('change', () => { if (sheet) sheet.setWide(wide.matches); });
  theme();
}
function resize() {
  const r = $('earth').getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  view.W = Math.max(1, r.width); view.H = Math.max(1, r.height);
  view.clamp();
  if (earth && earth.supported) earth.resize(view.W, view.H, dpr);
  overlay.resize(view.W, view.H, dpr);
  redraw();
}
function resizeCurves() {
  if (!curves) return;
  const c = $('curves-canvas').getBoundingClientRect();
  if (c.width < 2) return;
  curves.resize(c.width, c.height, Math.min(window.devicePixelRatio || 1, 2));
  dirty.curves = true;
  requestRender();
}

/* ── loading, and failing loudly ── */
function doneLoading() { $('loading').classList.add('done'); }
function fatal(e) {
  const box = $('loading');
  box.classList.remove('done');
  box.classList.add('error');
  $('load-msg').textContent = `This app could not start: ${e.message || e}`;
}
function dataProblem(e) {
  const n = $('notice');
  n.textContent = `Could not read ${e.message || e}`;
  n.hidden = false;
}

async function boot() {
  view = createView();
  // The text and curve files are small; they load alongside the manifest and never block the Earth.
  const extras = Promise.all([L.curves(), L.story(), L.about()]);
  extras.catch(() => {});
  manifest = await L.manifest();
  ts = await L.timescale();
  restore();
  introPending = wantIntro();
  if (introPending) {
    store.set('intro', 1);
    S.stop = manifest.count - 1;
    earthFade = 0;
    $('earth').classList.add('intro');
    // Its caption and Skip show at once, so the moments before the previews arrive are never an empty panel.
    $('intro-skip').hidden = false;
    $('intro-cap').hidden = false;
  }
  overlay = createOverlay($('overlay'));
  earth = createEarth($('gl'), {
    manifest, mapPath: L.mapPath, fadeMs,
    onChange: () => redraw(),
    onError: dataProblem,
    // While the context is lost the canvas shows nothing, so neither it nor the overlay is shown.
    onLost() { S.lost = true; climateKey = null; $('gl').style.visibility = 'hidden'; renderNotice(); redraw(false); },
    onRestored() { S.lost = false; $('gl').style.visibility = ''; updateClimate(); renderNotice(); redraw(); },
  });
  tl = createTimeline({
    slider: $('slider'), track: $('track'), thumb: $('thumb'), ticks: $('ticks'), strip: $('strip'), labels: $('labels'),
    eraband: $('eraband'), eras: $('eras'), compressed: $('compressed'), row: $('agerow'), ageRoll: $('age-roll'),
    breakMark: $('break'), swatch: $('swatch'), age: $('age'), ics: $('ics-text'), live: $('age-live'),
    prev: $('btn-prev'), play: $('btn-play'), next: $('btn-next'), extraScrub: [$('curves')],
  }, manifest, ts, {
    scrubStart() { pause(false); S.scrubbing = true; earth.supported && earth.setScrubbing(true); },
    scrub(i) {
      setStop(i, { fade: 0, scrub: true });
      clearTimeout(restTimer);
      // A finger resting for 150 ms fetches the full map (§5.7).
      restTimer = setTimeout(() => { if (S.scrubbing && earth.supported) earth.fetchCurrent(); }, REST_MS);
    },
    scrubEnd(i) {
      clearTimeout(restTimer);
      S.scrubbing = false;
      if (earth.supported) { earth.setScrubbing(false); earth.show(i, fadeMs()); }
      settle();
    },
    go: (i) => go(i),
    step: (d) => go(S.stop + d),
    play,
  });
  $('btn-find').disabled = true;
  $('btn-about').disabled = true;
  wire();
  for (const b of document.querySelectorAll('.segmented button')) b.setAttribute('aria-checked', String(b.dataset.view === view.mode));
  $('tg-plates').setAttribute('aria-pressed', String(S.plates));
  $('tg-coasts').setAttribute('aria-pressed', String(S.coasts));
  if (!setLens(S.lens)) setLens('surface');
  renderNotice();
  resize();
  setStop(S.stop, { fade: 0, announce: true });
  settleAria();

  // The opening starts as soon as the proxy sheet is on the GPU; it does not wait for the plates.
  if (!earth.supported) { $('nogl').hidden = false; doneLoading(); } else earth.loadProxy().then(() => { redraw(); startIntro(); }).catch(fatal);

  // The sheet, the curves and About (their files were fetched alongside the manifest).
  try {
    [curvesData, story, about] = await extras;
    curves = createCurves($('curves-canvas'), manifest, curvesData);
    sheet = createSheet({ app: $('app'), sheet: $('sheet'), grip: $('sheet-grip'), head: $('sheet-head'), body: $('sheet-body') },
      { manifest, ts, story, about }, { height: (n) => { S.sheet = n; store.set('sheet', n); }, look: lookFor, units: setUnits });
    sheet.setWide(wide.matches);
    sheet.setHeight(S.sheet, { quiet: true });
    sheet.render(S.stop, true);
    resizeCurves();
    aboutPanel = createAbout({ root: $('about'), body: $('about-body'), done: $('about-done'), opener: $('btn-about'), app: $('app') }, about, story, VERSION, { units: setUnits, perfToggle: () => togglePerfHud() });
    $('btn-about').disabled = false;
    $('btn-about').addEventListener('click', () => aboutPanel.open());
  } catch (e) { dataProblem(e); }

  // The overlay's geometry and the cities.
  try {
    const [pl, coast, pc] = await Promise.all([L.plates(), L.coast(), L.places()]);
    P = createPlates(pl, coast);
    places = pc;
    buildTrack();
    if (S.pin && ((S.pin.kind === 'city' && (!cityOf(S.pin) || cityOf(S.pin).n !== S.pin.n)) || (S.pin.kind === 'look' && !lookOf(S.pin)))) { S.pin = null; store.set('pin', null); }
    if (S.pin && S.pin.kind !== 'look') ensureGrids();
    find = createFind({ root: $('find'), input: $('find-q'), list: $('find-list'), empty: $('find-empty'), hint: $('find-hint'), cancel: $('find-cancel'), opener: $('btn-find'), app: $('app') }, places.places, { choose: chooseCity });
    $('btn-find').disabled = false;
    $('btn-find').addEventListener('click', () => find.open());
    if (!intro) setStop(S.stop, { fade: 0 });
    if (!introPending && !intro) settle();
  } catch (e) { dataProblem(e); }
  startIntro();
}

/* ── the test surface (DESIGN §13): inert unless called ── */
const booted = boot().catch((e) => { fatal(e); throw e; });
window.__eh = {
  ready: () => booted.then(() => true),
  /** Resolves when the current stop's full map is on screen and no blend, load or turn is running. */
  settled(timeout = 20000) {
    const t0 = performance.now();
    return new Promise((res, rej) => {
      const check = () => {
        const st = earth && earth.supported ? earth.state() : null;
        const ok = (!st || (!S.lost && !st.B && st.A && st.A.kind === 'full' && st.A.stop === S.stop && st.running == null)) && !rafPending && !turn && !intro && !introPending && !pinDrop && !following;
        if (ok) res(true); else if (performance.now() - t0 > timeout) rej(new Error('not settled: ' + JSON.stringify(st))); else setTimeout(check, 30);
      };
      check();
    });
  },
  goto(i) { go(i); return S.stop; },
  step: (d) => { go(S.stop + d); return S.stop; },
  play: () => play(),
  pause: () => pause(true),
  setView: (m) => setView(m),
  setLens: (l) => setLens(l),
  toggle: (layer, on) => setLayer(layer, on == null ? !S[layer] : !!on),
  setUnits: (u) => setUnits(u),
  setSheet: (n) => { if (sheet) sheet.setHeight(n); return S.sheet; },
  /** Tap the Earth at panel CSS px (no double-tap wait) or, with three arguments, at lon/lat on this map. */
  tap(x, y, lonlat) { if (lonlat) { tapAt(x, y); return [x, y]; } const ll = view.unproject(x, y); if (ll) tapAt(ll[0], ll[1]); return ll; },
  project: (lon, lat) => view.project(lon, lat),
  /** Turn the view to (lon, lat) at a zoom at once. */
  look(lon, lat, zoom = 1) { turn = null; stopFollowing(); view.centreOn(lon, lat); if (view.mode === 'globe') view.globe.zoom = zoom; else view.map.zoom = zoom; view.clamp(); saveView(); settleAria(); redraw(); return { ...view.globe }; },
  /** A city from places.json carried to the current map: [lon, lat], or null where its crust is not carried back. */
  cityAt(name) {
    const q = places && places.places.find((c) => c.n === name);
    if (!q || !P) return null;
    if (!carried(q.from_ma)) return null;
    return P.place(q.pi, q.lon, q.lat);
  },
  /** Find: open it, type a query, return the rows; choose(i) picks row i of the last query. */
  find(q) { find.open(); return find.type(q); },
  choose(n) { const rows = find.type($('find-q').value); if (rows[n]) find.pick(rows[n].i); return rows[n] || null; },
  lookFor(id) { const p = story.look_for.find((x) => x.id === id); if (p) lookFor(p); return !!p; },
  about: (open = true) => { if (open) aboutPanel.open(); else aboutPanel.close(); return aboutPanel.isOpen; },
  perfHud: (on) => { togglePerfHud(on); return S.perfHud; },
  /** The view that follows the continents: whether it is on, and its centre for this map. */
  follow: (on) => { if (on === true) startFollowing(); else if (on === false) stopFollowing(); return { on: S.follow, at: followAt(S.stop) }; },
  state: () => ({ follow: S.follow, stop: S.stop, map: manifest && manifest.slices[S.stop].map, lens: S.lens, plates: S.plates, coasts: S.coasts, units: S.units, sheet: S.sheet, playing: S.playing, lost: S.lost, pin: S.pin, climateKey, view: { mode: view.mode, globe: { ...view.globe }, map: { ...view.map }, W: view.W, H: view.H } }),
  ageRow: () => ({ age: $('age').textContent, ics: $('ics').textContent, valuetext: $('slider').getAttribute('aria-valuetext') }),
  readout: () => ($('readout').hidden ? null : [...$('readout').querySelectorAll('p')].map((p) => p.textContent).filter(Boolean)),
  notice: () => ($('notice').hidden ? null : [...$('notice').children].map((s) => s.textContent)),
  legend: () => ($('legend').hidden ? null : { text: $('legend-text').textContent, ticks: [...$('legend-ticks').querySelectorAll('span')].map((s) => s.textContent), label: $('legend').getAttribute('aria-label') }),
  /** The tick labels' boxes on screen, [left, right] in CSS px, to prove none overlap. */
  legendBoxes: () => [...$('legend-ticks').querySelectorAll('span')].map((s) => { const r = s.getBoundingClientRect(); return [+r.left.toFixed(1), +r.right.toFixed(1)]; }),
  /** The opening: whether it is waiting or running, and whether it has been stored as seen. */
  intro: () => ({ pending: introPending, running: !!intro, stop: S.stop, fade: +earthFade.toFixed(2), rolling: $('agerow').classList.contains('rolling'), stored: store.get('intro', null) }),
  skipIntro: () => endIntro(),
  card: () => { const c = $('readout'), r = c.getBoundingClientRect(), e = $('earth').getBoundingClientRect(); return c.hidden ? null : { left: r.left - e.left, top: r.top - e.top, width: r.width, height: r.height, side: c.classList.contains('above') ? 'above' : c.classList.contains('below') ? 'below' : 'free', open: c.classList.contains('open') }; },
  curvesLabel: () => (curves ? curves.label(S.stop) : null),
  sheetHead: () => [...$('sheet-head').children].map((p) => p.textContent),
  sheetText: () => $('sheet-body').innerText,
  perf() {
    const pick = (k) => frames.map((f) => f[k]).sort((a, b) => a - b);
    const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] : null);
    const sum = {};
    for (const k of ['earth', 'overlay', 'total']) { const a = pick(k); sum[k] = { median: q(a, 0.5), p95: q(a, 0.95), max: a[a.length - 1] ?? null }; }
    return { frames: frames.slice(), n: frames.length, summary: sum, rotateMs: +lastRotateMs.toFixed(2), overlay: overlay && overlay.stats(), cache: earth && earth.supported ? earth.state() : null, firstEarthFrameMs: firstEarthFrame && Math.round(firstEarthFrame) };
  },
  resetPerf() { frames.length = 0; },
  loseContext: () => earth && earth.loseContext(),
  restoreContext: () => earth && earth.restoreContext(),
};
