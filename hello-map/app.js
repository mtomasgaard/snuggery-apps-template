// Hello Map: the smallest online app the template carries. A live USGS topographic map of the
// United States, drawn on a canvas from pictures of one site, with a quadrangle's collar over it,
// a scale bar, a tapped point's coordinates, and a calm sentence when the map cannot load.
//
// What makes it an online app is one key in miniapp.json, network.resourceHosts, and the site in
// js/sources.js. Snuggery shows the pictures only after the person allows that site, and runs the
// app under a strict policy: scripts only from files in the folder (no inline script, no on…=
// attribute, no eval), and nothing but pictures and fonts from the listed site. NOTES.md says how
// to make your own from it.
//
// Modules: js/sources.js (the site, the layers, coverage), js/mercator.js (the projection),
// js/tiles.js (asking for and drawing the pictures), js/collar.js (the signature), js/units.js
// (every number and coordinate written), js/focus.js (focus mode), js/util.js.

import { $, clamp, store, text } from './js/util.js';
import * as U from './js/units.js';
import { HOSTS, LAYERS, MIN_ZOOM, MAX_ZOOM, WORLD_MAX_ZOOM, HOME, COUNTRY, covered } from './js/sources.js';
import { lonToX, latToY, xToLon, yToLat, worldPx, metersPerPx } from './js/mercator.js';
import { createTiles } from './js/tiles.js';
import { drawCollar, drawMarker, FONT } from './js/collar.js';
import { setupFocus } from './js/focus.js';

const CREDITS = 'Map: USGS The National Map.';
const OFFLINE_SENTENCE = 'No map tiles could be loaded. If this app is offline in Snuggery, allow its site to see the map.';
const OUTSIDE_SENTENCE = 'The National Map shows detail only in the United States. Zoom out, or show the whole country.';
const RM = matchMedia('(prefers-reduced-motion: reduce)');

// ── state, remembered between launches ─────────────────────────────────────────────────────────
const num = (v, lo, hi, d) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);
const S = {
  lon: num(store.get('lon'), -180, 180, HOME.lon),
  lat: num(store.get('lat'), -85, 85, HOME.lat),
  zoom: num(store.get('zoom'), MIN_ZOOM, MAX_ZOOM, HOME.zoom),
  layer: LAYERS[store.get('layer')] ? store.get('layer') : 'map',
  units: U.SYSTEMS.includes(store.get('units')) ? store.get('units') : 'si',
  marker: null,
  dialog: null,
};
let cx = lonToX(S.lon), cy = latToY(S.lat);
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    S.lon = xToLon(cx); S.lat = yToLat(cy);
    store.set('lon', Math.round(S.lon * 1e6) / 1e6); store.set('lat', Math.round(S.lat * 1e6) / 1e6);
    store.set('zoom', Math.round(S.zoom * 1000) / 1000); store.set('layer', S.layer); store.set('units', S.units);
  }, 250);
}

// ── the canvases ───────────────────────────────────────────────────────────────────────────────
const plate = $('plate'), mapCv = $('map'), ovCv = $('overlay');
const mapCtx = mapCv.getContext('2d'), ovCtx = ovCv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function size() {
  const r = plate.getBoundingClientRect();
  DPR = Math.min(3, window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  for (const c of [mapCv, ovCv]) { c.width = Math.max(1, Math.round(W * DPR)); c.height = Math.max(1, Math.round(H * DPR)); }
  // a plate too short for the column (a phone on its side) takes the keys as a row along its top
  document.body.classList.toggle('keys-row', H < 230);
  clampView();
}
function clampView() {
  const Wz = worldPx(S.zoom);
  cx -= Math.floor(cx);
  const half = H / 2 / Wz;
  cy = half >= 0.5 ? 0.5 : clamp(cy, half, 1 - half);
}

let collarStyle = { ink: '#0f1c23', halo: 'rgba(246, 249, 250, 0.88)' };
function readStyle() {
  const cs = getComputedStyle(document.documentElement);
  collarStyle = { ink: cs.getPropertyValue('--collar').trim() || collarStyle.ink, halo: cs.getPropertyValue('--collar-halo').trim() || collarStyle.halo };
}

// ── drawing, once per frame at most ────────────────────────────────────────────────────────────
const tiles = createTiles({ onArrive: () => invalidate() });
let raf = 0, last = { level: 0, inView: 0, loaded: 0, pending: 0, failed: 0, outside: 0, tiles: [] }, lastCollar = null, showCollar = true;
let draws = 0, fontReady = false;
function invalidate() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
function frame() {
  raf = 0;
  if (!W || !H) return;
  draws++;
  const view = { layer: S.layer, cx, cy, z: S.zoom, w: W, h: H, dpr: DPR };
  mapCtx.setTransform(1, 0, 0, 1, 0, 0);
  mapCtx.clearRect(0, 0, mapCv.width, mapCv.height);
  last = tiles.draw(mapCtx, view);
  ovCtx.setTransform(1, 0, 0, 1, 0, 0);
  ovCtx.clearRect(0, 0, ovCv.width, ovCv.height);
  if (showCollar && fontReady) lastCollar = drawCollar(ovCtx, view, collarStyle);
  if (S.marker) drawMarker(ovCtx, view, collarStyle, S.marker.lon, S.marker.lat);
  status();
  instruments();
}

// ── the status line, the notice and the caption band ───────────────────────────────────────────
let offline = false, notice = '';
function centerOutside() {
  return S.zoom > WORLD_MAX_ZOOM + 0.5 && !covered(xToLon(cx), yToLat(cy), xToLon(cx), yToLat(cy));
}
function status() {
  const i = last;
  // the map is unreachable when nothing in view has arrived and everything asked for failed; it
  // stays said until a picture in view arrives, so a retry never makes the sentence flicker
  if (i.loaded === 0 && i.failed > 0 && i.pending === 0) offline = true;
  if (i.loaded > 0) offline = false;
  let s;
  if (offline) s = 'The map could not be loaded.';
  else if (i.pending > 0) s = `Loading ${U.count(i.pending, 'tile', 'tiles')}…`;
  else if (i.failed > 0) s = `${U.count(i.failed, 'tile', 'tiles')} could not be loaded.`;
  else s = 'Every tile in view has loaded.';
  text('stamp', s);
  const n = offline ? OFFLINE_SENTENCE : centerOutside() ? OUTSIDE_SENTENCE : '';
  if (n !== notice) {
    notice = n;
    $('notice').textContent = n;
    $('notice').hidden = !n;
  }
}
function instruments() {
  const lat = yToLat(cy), mpp = metersPerPx(lat, S.zoom);
  const len = U.scaleLength(mpp * 112, S.units);
  $('scale-bar').style.width = `${Math.round(len.meters / mpp)}px`;
  text('scale-len', len.label);
  text('scale-sub', `true at ${U.lat1(lat)}`);
  if (lastCollar) text('cap', `Ticks and crosses every ${U.stepWords(lastCollar.step)} of latitude and longitude.`);
}

// ── moving the view ────────────────────────────────────────────────────────────────────────────
let anim = null;
/** Zoom to z keeping the place under (px, py) where it is; animated unless Reduce Motion is on. */
function zoomAbout(z, px = W / 2, py = H / 2, animate = true) {
  z = clamp(z, MIN_ZOOM, MAX_ZOOM);
  const W0 = worldPx(S.zoom), ax = cx + (px - W / 2) / W0, ay = cy + (py - H / 2) / W0;
  const z0 = S.zoom;
  const apply = (zz) => {
    S.zoom = zz;
    const Wz = worldPx(zz);
    cx = ax - (px - W / 2) / Wz; cy = ay - (py - H / 2) / Wz;
    clampView(); invalidate();
  };
  endAnim();
  if (!animate || RM.matches || Math.abs(z - z0) < 1e-3) { apply(z); save(); return; }
  const t0 = performance.now(), dur = 220;
  // the house's --draw curve, cubic-bezier(0.2, 0, 0, 1), close enough for a zoom: an ease-out
  const ease = (t) => 1 - (1 - t) ** 4;
  anim = { end: () => apply(z) };
  const step = (now) => {
    if (!anim) return;
    const t = Math.min(1, (now - t0) / dur);
    apply(z0 + (z - z0) * ease(t));
    if (t < 1) anim.raf = requestAnimationFrame(step); else { anim = null; save(); }
  };
  anim.raf = requestAnimationFrame(step);
}
/** A running zoom lands at once on its final state (a touch mid-flight, a key, a hidden page). */
function endAnim() {
  if (!anim) return;
  cancelAnimationFrame(anim.raf);
  const a = anim; anim = null; a.end(); save();
}
function panBy(dx, dy) {
  const Wz = worldPx(S.zoom);
  cx -= dx / Wz; cy -= dy / Wz;
  clampView(); invalidate();
}
function fit(b) {
  const x0 = lonToX(b.w), x1 = lonToX(b.e), y0 = latToY(b.n), y1 = latToY(b.s);
  const z = Math.log2(Math.min((W - 32) / ((x1 - x0) * 256), (H - 32) / ((y1 - y0) * 256)));
  endAnim();
  cx = (x0 + x1) / 2; cy = (y0 + y1) / 2;
  S.zoom = clamp(z, MIN_ZOOM, MAX_ZOOM);
  clampView(); invalidate(); save();
}
const toWorld = (px, py) => { const Wz = worldPx(S.zoom); return { x: cx + (px - W / 2) / Wz, y: cy + (py - H / 2) / Wz }; };

// ── touch, pen and mouse on the map ────────────────────────────────────────────────────────────
const pts = new Map();
let gesture = null, lastTap = null, tapTimer = 0;
const local = (e) => { const r = mapCv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
mapCv.addEventListener('pointerdown', (e) => {
  endAnim();
  mapCv.setPointerCapture(e.pointerId);
  const p = local(e);
  pts.set(e.pointerId, p);
  if (pts.size === 1) gesture = { kind: 'pan', start: p, last: p, t: performance.now(), moved: 0 };
  else if (pts.size === 2) {
    const [a, b] = [...pts.values()];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: S.zoom, anchor: toWorld(mid.x, mid.y), moved: 99 };
  }
});
mapCv.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId) || !gesture) return;
  const p = local(e);
  pts.set(e.pointerId, p);
  if (gesture.kind === 'pan' && pts.size === 1) {
    gesture.moved = Math.max(gesture.moved, Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y));
    panBy(p.x - gesture.last.x, p.y - gesture.last.y);
    gesture.last = p;
  } else if (gesture.kind === 'pinch' && pts.size >= 2) {
    const [a, b] = [...pts.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    S.zoom = clamp(gesture.z0 + Math.log2(d / gesture.d0), MIN_ZOOM, MAX_ZOOM);
    const Wz = worldPx(S.zoom);
    cx = gesture.anchor.x - (mid.x - W / 2) / Wz; cy = gesture.anchor.y - (mid.y - H / 2) / Wz;
    clampView(); invalidate();
  }
});
function pointerEnd(e) {
  if (!pts.has(e.pointerId)) return;
  const p = local(e);
  pts.delete(e.pointerId);
  const g = gesture;
  if (pts.size === 1 && g && g.kind === 'pinch') {
    // one finger left after a pinch: it pans from where it is
    const q = [...pts.values()][0];
    gesture = { kind: 'pan', start: q, last: q, t: performance.now(), moved: 99 };
    save(); return;
  }
  if (pts.size > 0) return;
  gesture = null;
  save();
  if (!g || g.kind !== 'pan' || e.type === 'pointercancel') return;
  if (g.moved > 8 || performance.now() - g.t > 450) return;
  // a tap: two in quick succession zoom in on the place; one alone shows the place's coordinates
  const now = performance.now();
  if (lastTap && now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
    clearTimeout(tapTimer); lastTap = null;
    zoomAbout(Math.round(S.zoom) + 1, p.x, p.y);
    return;
  }
  lastTap = { t: now, x: p.x, y: p.y };
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { lastTap = null; const w = toWorld(p.x, p.y); openCard(xToLon(w.x), yToLat(w.y), false); }, 280);
}
mapCv.addEventListener('pointerup', pointerEnd);
mapCv.addEventListener('pointercancel', pointerEnd);
mapCv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const p = local(e);
  const dz = -e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025);
  zoomAbout(S.zoom + clamp(dz, -1, 1), p.x, p.y, false);
}, { passive: false });
mapCv.addEventListener('keydown', (e) => {
  const step = Math.min(W, H) / 4;
  const k = e.key;
  if (k === 'ArrowLeft') panBy(step, 0);
  else if (k === 'ArrowRight') panBy(-step, 0);
  else if (k === 'ArrowUp') panBy(0, step);
  else if (k === 'ArrowDown') panBy(0, -step);
  else if (k === '+' || k === '=') zoomAbout(Math.round(S.zoom) + 1);
  else if (k === '-' || k === '_') zoomAbout(Math.round(S.zoom) - 1);
  else if (k === 'Enter' || k === ' ') openCard(xToLon(cx), yToLat(cy), true);
  else return;
  e.preventDefault();
  save();
});

// ── the card: a tapped point ───────────────────────────────────────────────────────────────────
function dl(id, rows) {
  $(id).replaceChildren(...rows.flatMap(([k, v]) => { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd]; }));
}
function tileAt(lon, lat) {
  const z = last.level || Math.round(S.zoom), n = 2 ** z;
  const x = Math.floor(lonToX(lon) * n) % n, y = Math.floor(latToY(lat) * n);
  const out = z > WORLD_MAX_ZOOM && !covered(lon, lat, lon, lat);
  return out ? { z: WORLD_MAX_ZOOM, x: x >> (z - WORLD_MAX_ZOOM), y: y >> (z - WORLD_MAX_ZOOM), enlarged: true } : { z, x, y, enlarged: false };
}
function openCard(lon, lat, byKey) {
  S.marker = { lon, lat };
  const t = tileAt(lon, lat);
  text('card-place', U.dmPair(lon, lat));
  text('card-fig', U.coords(lon, lat));
  dl('card-rows', [
    ['Picture', `level ${t.z}, column ${U.int(t.x)}, row ${U.int(t.y)}${t.enlarged ? ', enlarged' : ''}`],
    ['From', HOSTS.usgs],
  ]);
  const card = $('card');
  card.classList.remove('low');
  card.hidden = false;
  // never over the point it describes
  const r = card.getBoundingClientRect(), pr = plate.getBoundingClientRect();
  const W0 = worldPx(S.zoom);
  let dx = lonToX(lon) - cx; dx -= Math.round(dx);
  const px = pr.left + dx * W0 + W / 2, py = pr.top + (latToY(lat) - cy) * W0 + H / 2;
  if (px > r.left - 12 && px < r.right + 12 && py > r.top - 12 && py < r.bottom + 12) card.classList.add('low');
  say(`${U.coordsSpoken(lon, lat)}. Map picture from ${HOSTS.usgs}, level ${t.z}.`);
  if (byKey) $('card-close').focus();
  invalidate();
}
function closeCard() {
  if ($('card').hidden) return;
  $('card').hidden = true;
  S.marker = null;
  invalidate();
}
$('card-close').addEventListener('click', (e) => { closeCard(); if (e.detail === 0) mapCv.focus(); });

// ── the keys ───────────────────────────────────────────────────────────────────────────────────
$('zoom-in').addEventListener('click', () => zoomAbout(Math.round(S.zoom) + 1));
$('zoom-out').addEventListener('click', () => zoomAbout(Math.round(S.zoom) - 1));
$('btn-country').addEventListener('click', () => { closeCard(); fit(COUNTRY); say('The whole country.'); });
function setLayer(k, announce) {
  S.layer = k;
  for (const [id, key] of [['layer-map', 'map'], ['layer-imagery', 'imagery']]) $(id).setAttribute('aria-checked', String(key === k));
  if (announce) say(`${LAYERS[k].name}.`);
  invalidate(); save();
}
$('layer-map').addEventListener('click', () => setLayer('map', true));
$('layer-imagery').addEventListener('click', () => setLayer('imagery', true));
$('viewkey').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const k = S.layer === 'map' ? 'imagery' : 'map';
  setLayer(k, true);
  $(k === 'map' ? 'layer-map' : 'layer-imagery').focus();
});
function setUnits(sys, announce) {
  S.units = sys;
  $('units').textContent = U.systemKey(sys);
  $('units').setAttribute('aria-label', `Change units, now ${sys === 'us' ? 'miles' : 'kilometers'}`);
  if (announce) say(`Scale in ${U.systemSpoken(sys)}.`);
  instruments(); save();
}
$('units').addEventListener('click', () => setUnits(U.SYSTEMS[(U.SYSTEMS.indexOf(S.units) + 1) % U.SYSTEMS.length], true));

// ── About ──────────────────────────────────────────────────────────────────────────────────────
let opener = null;
function buildAbout() {
  text('about-credit-line', CREDITS);
  const st = tiles.stats;
  dl('ab-data', [
    ['Map', `USGS The National Map, read live from ${HOSTS.usgs}`],
    ['Layers', `${LAYERS.map.service} (Map) and ${LAYERS.imagery.service} (Imagery)`],
    ['Levels', `${MIN_ZOOM} to ${MAX_ZOOM}; the whole world to level ${WORLD_MAX_ZOOM}, the United States and its territories beyond it`],
    ['Pictures this session', `${U.int(st.loaded)} arrived, ${U.int(st.failed)} could not be loaded`],
  ]);
}
function openDialog(id) {
  opener = document.activeElement;
  S.dialog = id;
  endAnim();
  buildAbout();
  $(id).hidden = false;
  for (const e of [$('head'), $('plate'), $('caption')]) e.inert = true;
  const first = $(id).querySelector('[data-close]');
  if (first) first.focus();
}
function closeDialog() {
  if (!S.dialog) return;
  $(S.dialog).hidden = true;
  S.dialog = null;
  for (const e of [$('head'), $('plate'), $('caption')]) e.inert = false;
  if (opener && opener.focus) opener.focus();
  invalidate();
}
$('stamp').addEventListener('click', () => openDialog('about'));
$('btn-about').addEventListener('click', () => openDialog('about'));
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', closeDialog);
// Escape closes About and nothing else: focus mode's own Escape (js/focus.js) must not hear it too
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.dialog) { e.preventDefault(); e.stopImmediatePropagation(); closeDialog(); } });

// ── the live region ────────────────────────────────────────────────────────────────────────────
let sayTimer = 0;
function say(s) {
  const live = $('live');
  live.textContent = '';
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { live.textContent = s; }, 60);
}

// ── focus mode ─────────────────────────────────────────────────────────────────────────────────
const focus = setupFocus({
  onChange: (on, settled) => { if (on) closeCard(); if (settled) { size(); invalidate(); } },
  say,
  dialogOpen: () => !!S.dialog,
});

// ── the page's life ────────────────────────────────────────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { endAnim(); if (raf) { cancelAnimationFrame(raf); raf = 0; } save(); }
  else { tiles.retryFailed(); invalidate(); }
});
window.addEventListener('pagehide', save);
window.addEventListener('online', () => { tiles.retryFailed(); invalidate(); });
new ResizeObserver(() => { size(); invalidate(); }).observe(plate);

// the canvas text waits for the house face, so no label is ever drawn in a fallback face
document.fonts.load(FONT).then(() => { fontReady = true; invalidate(); }, () => { fontReady = true; invalidate(); });
document.fonts.addEventListener('loadingdone', () => invalidate());

readStyle();
setLayer(S.layer, false);
setUnits(S.units, false);
size();
invalidate();

// An inert hook for tools/shoot.mjs; nothing in the app calls it.
window.__hellomap = {
  state: () => ({ lon: xToLon(cx), lat: yToLat(cy), cx, cy, zoom: S.zoom, layer: S.layer, units: S.units, focus: focus.isOn(), marker: S.marker, offline, notice, step: lastCollar && lastCollar.step, labels: lastCollar && lastCollar.labels, view: { ...last, tiles: last.tiles.slice() }, w: W, h: H, dpr: DPR, draws, fontReady }),
  idle: () => !anim && !raf && last.pending === 0 && tiles.inFlight() === 0 && tiles.queued() === 0 && fontReady,
  stats: () => ({ ...tiles.stats }),
  view: (lon, lat, zoom) => { endAnim(); S.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM); cx = lonToX(lon); cy = latToY(lat); clampView(); invalidate(); save(); },
  collar: (on) => { showCollar = !!on; invalidate(); },
  credits: CREDITS,
};
