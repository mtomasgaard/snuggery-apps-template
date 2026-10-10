// Warming World: boot, state, the scheduler, persistence and the wiring (DESIGN §4, §5.6, §10, §12).
// One requestAnimationFrame at a time, only when something changed; a frame resolves the step to draw
// (the wanted step once its layer is resident, else the one on screen), draws what is dirty, and
// writes every label from the step it drew, so the label is always the drawn step (§4.4). Play, a
// fling, a pole turn, the card's 240 ms turn, focus mode's glide, the chart drawing itself and the
// opening are the only things that keep frames coming; when all are idle nothing runs.
// window.__ww is inert unless called: it is how tools/shoot.mjs drives and reads the app.

import { $, store, clamp, cssVar, hexRGB, reducedMotion, darkOn, setText, summary, isNum, easeTurn, wrap180 } from './util.js';
import { validate, index, createDecoder, decodeAll, decodeWorld, decodePlaces, cellOf, capMean, CELLS, NONE } from './data.js';
import { createView, attachGestures, defaultLon } from './proj.js';
import { createEarth } from './earth.js';
import { createOverlay } from './overlay.js';
import { createTrack } from './track.js';
import { createCard } from './card.js';
import { renderAbout, stampText, dataTo } from './about.js';
import { buildLut, buildAbsLut, stripeRGB, STRIPES_SCALE } from './ramp.js';
import { renderYearRow, stepText, drawLegendBar, renderLegendText, notice, notices, showError } from './readout.js';
import { tenths, hundredths, degC, percent, cellBounds, monthName, roundDiv, whole, MONTH, NNBSP, MINUS } from './units.js';
import { createMeasure, checkClim, decodeClim } from './measure.js';

const PERIOD = { annual: 125, months: 250 };           // 8 years and 4 months a second (§4.3, D-7)
const STALE_MS = 75 * 86400000;                          // §12.4, D-16
const POLE_LAT = 72, POLE_MS = 600, CARD_TURN_MS = 240, FOCUS_MS = 280;   // §6.4, §8, §10; ART "Motion"
const CAP_ROWS = 13;                                     // the pole reading: 13 rows of 2° from each pole (to 64°)
const MISSING = 'The data file data/snapshot.json is missing. It ships in the ZIP and the Shortcut replaces it; reinstall the app or run the Shortcut.';

const st = {
  snap: null, idx: null, frames: null, decoder: null, resident: new Uint8Array(0), places: null, about: null, version: null,
  mode: 'annual', pos: { annual: 0, months: 0 }, wanted: -1, shown: -1, dir: 0, drawn: -1,
  playing: false, playAcc: 0, lastT: 0, fling: null, selection: null, crosshair: false,
  turn: null, seat: null, pole: null, focus: false, opening: false, perfOn: false, swallowTap: false, hintAt: 0,
  fontsReady: false, fontAtFirstText: null, failed: null, ready: false, firstDraw: null, t0: performance.now(),
};
const view = createView();
const M = createMeasure();                               // Difference or Absolute, and the baseline (plan 0012 3.3)
const absOn = () => M.abs && !!M.clim;
/** What the shader needs for layer k: the measure, the baseline's switch, the climatology's plane. */
const glm = (k) => ({ abs: absOn(), baseOn: !absOn() && M.on(k), plane: M.clim ? M.plane(k) : 0 });
const dirty = { earth: true, overlay: true, track: true, legend: true, row: true, card: true, pole: true };
let earth = null, overlay = null, track = null, card = null, world = null, dpr = 1, dpr2 = 1, ground = [190, 190, 190], raf = 0, log = null;
const perfFrames = [];

/* ── steps and modes (§4.1) ── */
const count = (m = st.mode) => (st.idx ? (m === 'annual' ? st.idx.ny : st.idx.nm) : 0);
const base = (m = st.mode) => (m === 'annual' ? 0 : st.idx.ny);
const layerOf = (m, p) => base(m) + p;

function requestRender() { if (!raf) raf = requestAnimationFrame(frame); }
function dirtyAll() { for (const k in dirty) dirty[k] = true; requestRender(); }

function setPos(p, dir = 0) {
  const n = count();
  if (!n) return;
  p = clamp(p, 0, n - 1);
  st.pos[st.mode] = p;
  st.wanted = layerOf(st.mode, p);
  st.dir = dir;
  if (st.decoder) st.decoder.prioritize(st.wanted, dir || 1);
  requestRender();
}
function setMode(m, announce = true) {
  if (m === st.mode || !st.idx) return;
  stopPlay();
  const I = st.idx;
  if (m === 'months') st.pos.months = I.nm - 1;                 // to the newest month
  else {                                                       // to the year of the month showing
    const y = +I.monthKeys[st.pos.months].slice(0, 4), i = I.years.indexOf(y);
    st.pos.annual = i >= 0 ? i : I.lastComplete;
  }
  st.mode = m;
  trackModel();
  segMark($('mode-seg'), m);
  for (const b of $('mode-seg').querySelectorAll('button')) { b.setAttribute('aria-checked', String(b.dataset.m === m)); b.tabIndex = b.dataset.m === m ? 0 : -1; }
  const unit = m === 'annual' ? 'year' : 'month';
  $('prev').setAttribute('aria-label', `Previous ${unit}`); $('next').setAttribute('aria-label', `Next ${unit}`);
  $('track-hit').setAttribute('aria-label', m === 'annual' ? 'Year' : 'Month');
  setPos(st.pos[m]);
  dirtyAll();
  layout();
  baseKeyUi();
  if (!$('base-card').hidden) baseUi();
  if (card && card.open && st.selection) bringIntoView(st.selection.row, st.selection.col);   // the months' card is taller
  settleSoon(0, announce);
}

/* ── play (§4.3): every step in order, one per period, a late frame advances by one, never more ── */
function startPlay() {
  if (!st.idx || st.failed) return;
  if (!st.opening && st.pos[st.mode] >= count() - 1) setPos(0, 1);
  st.playing = true; st.playAcc = 0; st.lastT = 0;      // the step on screen keeps its full period
  $('play').classList.add('playing'); $('play').setAttribute('aria-label', 'Pause');
  if (!st.opening) say('Playing');
  requestRender();
}
function stopPlay() {
  if (!st.playing) return;
  st.playing = false;
  $('play').classList.remove('playing'); $('play').setAttribute('aria-label', 'Play');
  dirty.row = true;
  if (st.opening) endOpening(); else say('Paused');
  settleSoon(0);
  requestRender();
}

/* ── the frame ── */
function frame(now) {
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  const t0 = performance.now();
  const dt = st.lastT ? Math.min(now - st.lastT, 250) : 0;
  st.lastT = now;
  let again = false;
  if (st.playing) {
    const p = st.pos[st.mode], end = st.opening ? st.idx.lastComplete : count() - 1;
    if (st.shown === st.wanted) {
      st.playAcc += dt;
      const per = PERIOD[st.mode];
      if (st.playAcc >= per && p < end) { st.playAcc = Math.min(st.playAcc - per, per / 2); setPos(p + 1, 1); }
    }
    if (st.pos[st.mode] >= end && st.shown === st.wanted) stopPlay(); else again = true;
  }
  if (st.fling) {
    const f = st.fling, k = Math.pow(0.92, dt / 16.67);
    view.panBy((f.vx * dt) / 1000, (f.vy * dt) / 1000);
    f.vx *= k; f.vy *= k;
    dirty.earth = dirty.overlay = dirty.pole = true;
    const degPerFrame = (Math.hypot(f.vx, f.vy) / 60 / (view.mode === 'globe' ? view.radius() : view.mapScale())) * (180 / Math.PI);
    if (degPerFrame < 0.05) { st.fling = null; settleSoon(0, false); } else again = true;
  }
  if (st.turn) again = turnStep(performance.now()) || again;
  if (st.seat) again = seatStep(performance.now()) || again;
  // the step to draw: the wanted one once it is resident; until then the one on screen stays, with its label
  if (st.wanted >= 0 && st.wanted !== st.shown && st.resident[st.wanted]) {
    st.shown = st.wanted;
    dirty.earth = dirty.track = dirty.row = dirty.legend = dirty.card = dirty.pole = true;
    if (st.opening) track.setWritten(st.shown + 1);      // the opening writes the stripes behind the index
  }
  let te = null, to = null;
  if (dirty.earth && earth && earth.supported && st.shown >= 0 && !st.failed) {
    const a = performance.now();
    if (earth.draw(view.uniforms(), st.shown, ground, glm(st.shown))) { st.drawn = st.shown; if (st.firstDraw == null) st.firstDraw = performance.now() - st.t0; }
    te = performance.now() - a;
    dirty.earth = false;
  }
  if (st.fontsReady && st.idx && !st.failed) {
    if (st.fontAtFirstText == null) st.fontAtFirstText = fontStatus();
    if (dirty.overlay && overlay && earth && earth.supported) {
      const legendTop = view.H - (wide() || $('legend').hidden ? 0 : $('legend').offsetHeight);
      to = overlay.draw({ view, limbInk: cssVar('--card-ink'), selection: st.selection, crosshair: st.crosshair, avoid: st.focus ? [[view.W - 48, 0, view.W, 48], [0, legendTop, view.W, view.H], ...cardBox()] : [[0, 0, view.W, 44], [0, legendTop, view.W, view.H], ...cardBox()] });
      dirty.overlay = false;
    }
    if (dirty.track && st.shown >= 0) { track.draw(st.shown - base()); dirty.track = false; }
    if (dirty.legend && st.shown >= 0) {
      const t = M.stats(st.shown), lead = drawLegendBar($('legend-bar'), dpr2, t.above, t.below, absOn());
      renderLegendText(st.idx, st.shown, M, lead);
      dirty.legend = false;
    }
    if (card && (dirty.card || card.drawing())) {
      if (st.shown >= 0) card.step(st.shown);
      if (card.draw()) again = true;
      dirty.card = false;
    }
  }
  if (dirty.row && st.shown >= 0 && st.idx) {
    const t = renderYearRow(st.idx, st.shown, st.playing && st.mode === 'annual' && !reducedMotion() && !st.focus, M);
    setText($('focus-name'), st.mode === 'annual' ? st.idx.name[st.shown] : st.idx.short[st.shown]);
    const hit = $('track-hit');
    hit.setAttribute('aria-valuenow', String(st.mode === 'annual' ? st.idx.years[st.shown] : st.shown - base()));
    hit.setAttribute('aria-valuetext', t.spoken);
    dirty.row = false;
  }
  if (dirty.pole && st.idx && st.shown >= 0) { poleUi(); dirty.pole = false; }
  if (log && log.length < 50000) log.push({ t: now, finger: track ? track.fingerX : null, pressed: track ? track.pressed : false, wanted: st.wanted, shown: st.shown, drawn: st.drawn, label: $('year').textContent, mode: st.mode, playing: st.playing, written: track ? track.written : null, cardP: card && card.open ? card.progress() : null });
  perfFrames.push({ earth: te, overlay: to, total: performance.now() - t0 });
  if (perfFrames.length > 120) perfFrames.shift();
  if (st.perfOn) perfReadout();
  if (again || (st.wanted !== st.shown && st.wanted >= 0)) requestRender();
  else st.lastT = 0;                                   // idle: the next frame's clock starts afresh
}
/** Draw now, in this task (a resize clears the canvases; drawing at once means they are never blank). */
function drawNow() { if (st.idx && earth) frame(performance.now()); }

const fontStatus = () => { try { const f = [...document.fonts].find((x) => x.family.replace(/"/g, '') === 'Archivo'); return f ? f.status : 'absent'; } catch { return 'unknown'; } };
const wide = () => matchMedia('(min-width: 700px)').matches && !st.focus;
let legendReserve = 44;
const legendH = () => ($('legend').hidden ? 0 : legendReserve);

/* ── turns (§6.4, §8): the globe's centre eased on ART's --turn; instant under Reduce Motion ── */
function turnTo(lon, lat, ms) {
  st.fling = null;
  lat = clamp(lat, -89.5, 89.5);
  if (!ms || reducedMotion()) { st.turn = null; view.globe.lon = lon; view.globe.lat = lat; view.clamp(); dirty.earth = dirty.overlay = dirty.pole = true; requestRender(); settleSoon(0, false); return; }
  st.turn = { lon0: view.globe.lon, lat0: view.globe.lat, dl: wrap180(lon - view.globe.lon), lat1: lat, t0: performance.now(), ms };
  requestRender();
}
function turnStep(now) {
  const t = st.turn, k = clamp((now - t.t0) / t.ms, 0, 1), e = easeTurn(k);
  view.globe.lon = t.lon0 + t.dl * e; view.globe.lat = t.lat0 + (t.lat1 - t.lat0) * e;
  view.clamp();
  dirty.earth = dirty.overlay = dirty.pole = true;
  if (k >= 1) { st.turn = null; settleSoon(0, false); if (st.pole) poleSay(); return false; }
  return true;
}
/** The pole's reading, said once the turn has landed (VoiceOver hears the one new number). */
function poleSay() { setTimeout(() => { const t = poleText(); if (t) say(t); }, 0); }
function seatStep(now) {
  const s = st.seat, k = clamp((now - s.t0) / s.ms, 0, 1), e = easeTurn(k);
  view.dy = s.dy0 * (1 - e); view.factor = s.f0 + (s.f1 - s.f0) * e;
  dirty.earth = dirty.overlay = true;
  if (k >= 1) { st.seat = null; view.dy = 0; view.factor = s.f1; return false; }
  return true;
}
function finishMotion() {
  if (st.turn) turnStep(st.turn.t0 + st.turn.ms);
  if (st.seat) seatStep(st.seat.t0 + st.seat.ms);
  st.fling = null;
}

/* ── the poles (§6.4): Arctic and Antarctic turn the globe to 72°; a map switches to the globe first ── */
function pole(which) {
  if (!st.idx || st.failed || !earth || !earth.supported) return;
  if (view.mode === 'map') setView('globe');
  st.pole = which;
  turnTo(view.globe.lon, which === 'n' ? POLE_LAT : -POLE_LAT, POLE_MS);
  if (!st.turn) poleSay();                                  // instant under Reduce Motion
  dirty.pole = true; requestRender();
}
const poleOn = () => (st.pole && view.mode === 'globe' && Math.abs(view.globe.lat - (st.pole === 'n' ? POLE_LAT : -POLE_LAT)) <= 2 ? st.pole : null);
/** The pole's reading for the drawn step: data.js's capMean, cached per step. */
const capCache = new Map();
function capOf(k, which) {
  const key = `${k}|${which}|${absOn()}|${M.text()}`;
  if (!capCache.has(key)) {
    if (!st.resident[k]) return null;
    let m;
    if (absOn()) {
      // Absolute: the climatology's mean over the whole cap (every cell has one) plus the cap's mean
      // anomaly against 1951–1980, the year row's method; a mean of the cells with data would make
      // a trend of coverage alone (1880's Antarctic: only the warm sea-ice edge)
      const a = capMean(st.frames, st.idx, k, which, CAP_ROWS), pl = M.plane(k) * CELLS;
      const c = capMean(null, null, k, which, CAP_ROWS, (_, cell) => { const v = M.clim.t[pl + cell]; return v === -32768 ? null : v; });
      m = { h: a.h == null || c.h == null ? null : a.h + c.h, share: a.share };
    } else m = capMean(st.frames, st.idx, k, which, CAP_ROWS, M.on(k) ? M.value : null);
    capCache.set(key, m);
  }
  return capCache.get(key);
}
function poleText() {
  const which = poleOn();
  if (!which || st.shown < 0) return '';
  const m = capOf(st.shown, which), edge = 90 - 2 * CAP_ROWS, side = which === 'n' ? `north of ${edge}° N` : `south of ${edge}° S`;
  if (!m) return '';
  if (m.h == null) return `No cell ${side} has a value in ${st.idx.name[st.shown]}.`;
  const full = Math.round(m.share * 10000) >= 10000, d = roundDiv(m.h, 100);
  const v = absOn() ? `${degC(d < 0 ? `${MINUS}${-d}` : String(d))}, estimated` : `${degC(hundredths(m.h))} vs. ${M.baseFor(st.shown)}`;
  return `Map mean ${side}: ${v}${full ? '' : `, data cover ${percent(m.share)} of it`}`;   // this app's mean of the map's cells (R-12)
}
function poleUi() {
  const on = poleOn();
  $('arctic').setAttribute('aria-pressed', String(on === 'n'));
  $('antarctic').setAttribute('aria-pressed', String(on === 's'));
  const t = poleText(), el = $('pole-read');
  el.hidden = !t;
  setText(el, t);
}

/* ── settling: accessible names, the live region and storage, once a step or view has settled ── */
let settleT = 0;
function settleSoon(ms = 400, announce = true) {
  clearTimeout(settleT);
  settleT = setTimeout(() => settle(announce), ms);
}
function settle(announce = true) {
  if (!st.idx || st.shown < 0) return;
  const t = stepText(st.idx, st.shown, M);
  $('earth').setAttribute('aria-label', earthName(t));
  if (announce && !st.playing) say(`${t.name}, ${t.meanLead.trim().toLowerCase()} ${t.meanVal}`);
  save();
}
function earthName(t) {
  const sel = st.selection ? `Selected ${cellBounds(st.selection.row, st.selection.col)}.` : 'No cell selected.';
  const pr = poleText();
  const what = absOn() ? `Estimated temperatures: each place’s ${st.idx.baseText} average plus GISS’s anomaly` : `Anomalies against each place’s ${M.baseFor(st.shown)} average`;
  return `${view.mode === 'globe' ? 'Globe' : 'Map'}, ${t.name}. ${what}. ${t.meanLead.trim()} ${t.meanVal}${t.meanTail}. ${t.cover}.${pr ? ` ${pr}.` : ''} ${sel}`;
}
let sayT = 0;
function say(text) { clearTimeout(sayT); sayT = setTimeout(() => setText($('live'), text), 50); }
function save() {
  if (!st.idx) return;
  store.set('view', view.mode);
  store.set('globe', { lon: +view.globe.lon.toFixed(3), lat: +view.globe.lat.toFixed(3), zoom: +view.globe.zoom.toFixed(3) });
  store.set('map', { lon0: +view.map.lon0.toFixed(3), y: +view.map.panY.toFixed(4), zoom: +view.map.zoom.toFixed(3) });
  store.set('mode', st.mode);
  store.set('year', st.idx.years[st.pos.annual]);
  store.set('month', st.idx.monthKeys[st.pos.months]);
  store.set('measure', M.abs ? 'abs' : 'diff');
  store.set('base', M.custom() ? M.span : null);
}
function restore() {
  const I = st.idx;
  const g = store.get('globe', null, (v) => v && isNum(v.lon) && isNum(v.lat) && isNum(v.zoom));
  if (g) view.globe = { lon: g.lon, lat: g.lat, zoom: g.zoom };
  const m = store.get('map', null, (v) => v && isNum(v.lon0) && isNum(v.y) && isNum(v.zoom));
  if (m) view.map = { lon0: m.lon0, panY: m.y, zoom: m.zoom };
  view.mode = store.get('view', 'globe', (v) => v === 'globe' || v === 'map');
  view.clamp();
  // the stored year if it is a complete year of this snapshot, else the last complete year (D-10)
  const y = I.years.indexOf(store.get('year', null, Number.isInteger));
  st.pos.annual = y >= 0 && y !== I.partial ? y : I.lastComplete;
  const mo = I.monthKeys.indexOf(store.get('month', null, (v) => typeof v === 'string'));
  st.pos.months = mo >= 0 ? mo : I.nm - 1;
  st.mode = store.get('mode', 'annual', (v) => v === 'annual' || v === 'months');
  M.abs = store.get('measure', 'diff', (v) => v === 'abs' || v === 'diff') === 'abs';
  // a stored baseline waits for every frame (decodeDone): it is a mean over decoded years
  st.wantSpan = store.get('base', null, (v) => Array.isArray(v) && v.length === 2 && v.every(Number.isInteger) && v[0] <= v[1]);
}

/* ── the track's model: GISS's global means on the ±1.5 °C scale, graduations, bracket, labels ── */
function trackModel() {
  const I = st.idx, annual = st.mode === 'annual', n = count();
  const scale = String(STRIPES_SCALE);
  // steps beyond the stripes' scale take its end color (§7.2); the caption says how many (R-11)
  let beyond = 0;
  for (let i = 0; i < n; i++) if (Math.abs(M.meanH(base() + i)) > STRIPES_SCALE * 100) beyond++;
  const m = { n, key: `${st.mode}|${I.release.id}|${st.idx.generatedAt}|${M.text()}`, partial: annual ? I.partial : -1,
    caption: `Stripes: GISS global mean, each ${annual ? 'year' : 'month'}, on a ±${scale}${NNBSP}°C scale${beyond ? `, ${beyond} beyond it` : ''}`,
    color: (i) => stripeRGB(M.meanH(base() + i) / 100), ticks: [], labels: [], bracket: null };
  if (annual) {
    const ys = I.years;
    ys.forEach((y, i) => { if (y % 10 === 0) m.ticks.push({ i, big: y % 50 === 0 }); });
    const bs = M.custom() ? M.span : I.base, b0 = ys.indexOf(bs[0]), b1 = ys.indexOf(bs[1]);   // the baseline in use
    if (b0 >= 0 && b1 >= 0) m.bracket = [b0, b1];
    if (m.bracket) m.labels.push({ bracket: true, text: `${M.text()} = 0`, strong: true });    // first: it is never dropped
    m.labels.push({ i: 0, text: String(ys[0]), align: 'left' });
    m.labels.push({ i: n - 1, text: String(ys[n - 1]), align: 'right' });
    for (const y of [1900, 2000]) if (ys.indexOf(y) >= 0) m.labels.push({ i: ys.indexOf(y), text: String(y) });
  } else {
    const ks = I.monthKeys;
    m.ticks.push({ i: 0, big: true });
    ks.forEach((k, i) => { if (k.endsWith('-01') && i) m.ticks.push({ i, big: true }); });
    if (!ks[n - 1].endsWith('-01')) m.ticks.push({ i: n - 1, big: true });
    m.labels.push({ i: 0, text: monthName(ks[0]), align: 'left' });
    m.labels.push({ i: n - 1, text: monthName(ks[n - 1]), align: 'right' });
    ks.forEach((k, i) => { if (k.endsWith('-01') && i && i < n - 1) m.labels.push({ i, text: monthName(k) }); });
  }
  track.setModel(m);
  const hit = $('track-hit');
  hit.setAttribute('aria-valuemin', String(annual ? I.years[0] : 0));
  hit.setAttribute('aria-valuemax', String(annual ? I.years[n - 1] : n - 1));
  dirty.track = true;
}

/* ── layout: the panel, the seat, the canvases; the WebGL canvas's DPR capped at 2 (§5.2), the 2D
   canvases' at 3, the device's own on every iPhone (review R-9: text and stripe edges on device pixels) ── */
function layout() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  dpr2 = Math.min(window.devicePixelRatio || 1, 3);
  // wide screens (§3.8): the legend and the card join the right column, and the Earth takes the whole panel
  const W = wide(), lg = $('legend'), cd = $('card');
  const home = W ? $('side-legend') : $('panel');
  if (lg.parentElement !== home) home.append(lg);
  const cardHome = W ? $('app') : $('panel');
  if (cd.parentElement !== cardHome) { if (W) $('app').insertBefore(cd, $('about')); else $('panel').append(cd); }
  const panel = $('panel'), r = panel.getBoundingClientRect();
  view.W = Math.max(1, r.width); view.H = Math.max(1, r.height);
  // the legend's height with its longest caption, so the seat never moves from step to step; and with
  // its credit hidden (a card open), which is where the card's foot sits
  // (per time list: the 24 months' caption is a line longer, and switching lists may move the seat)
  let cardFoot = 8;
  if (st.idx && !lg.hidden && !W) {
    const I = st.idx;
    // where the counts do not fit beside the bar they lead the caption (B-6): measure with the longest
    // such lead of the list, from the step whose counts make the longest text (in the measure on screen;
    // the focus mode's legend is the same without its first row, plan 0012: the scale stays)
    const list = st.mode === 'annual' ? [...I.years.keys()] : I.monthKeys.map((_, m) => I.ny + m);
    const len = (k) => { const t = M.stats(k); return (t.above ? String(t.above).length + 12 : 0) + (t.below ? String(t.below).length + 12 : 0); };
    const kl = list.reduce((a, k) => (len(k) > len(a) ? k : a), list[0]);
    const lead = drawLegendBar($('legend-bar'), dpr2, M.stats(kl).above, M.stats(kl).below, absOn());
    let h = 0;
    for (const k of st.mode === 'annual' ? [I.lastComplete, I.partial] : [I.ny + I.nm - 1]) if (k >= 0) { renderLegendText(I, k, M, lead); h = Math.max(h, lg.offsetHeight); }
    legendReserve = h; cardFoot = h + 6;
    if (st.shown >= 0) { const t = M.stats(st.shown); renderLegendText(I, st.shown, M, drawLegendBar($('legend-bar'), dpr2, t.above, t.below, absOn())); }
  }
  panel.style.setProperty('--card-bottom', `${cardFoot}px`);
  if (st.focus) { view.top = 8; view.bottom = Math.max(8, legendH()); view.factor = st.seat ? view.factor : 0.48; }
  else { view.top = 44; view.bottom = W ? 0 : Math.max(44, legendH()); view.factor = st.seat ? view.factor : 0.47; }
  view.clamp();
  if (earth && earth.supported) earth.resize(view.W, view.H, dpr);
  if (overlay) overlay.resize(view.W, view.H, dpr2);
  if (track) { track.resize($('track').clientWidth, dpr2); if (st.idx) trackModel(); }
  if (card) card.setDpr(dpr2);
  segMark($('view-seg'), view.mode); segMark($('mode-seg'), st.mode); segMark($('measure-seg'), M.abs ? 'abs' : 'diff');
  if (st.idx && !$('base-card').hidden) baseUi();     // the note's reserve follows the width
  dirtyAll();
  drawNow();
}
/** The switch's underline: a 1 px wide mark moved and stretched by transform only (composited). */
function segMark(seg, value) {
  const b = [...seg.querySelectorAll('button')].find((x) => (x.dataset.v || x.dataset.m || x.dataset.s) === value), mk = seg.querySelector('.mark');
  if (!b || !mk) return;
  mk.style.transform = `translateX(${b.offsetLeft}px) scaleX(${b.offsetWidth})`;
}

/* ── the selection and its card (§8) ── */
const kmText = () => { const m = /(\d[\d  ]*)\s?km/.exec((st.snap && st.snap.source && st.snap.source.detail) || ''); return m ? `${m[1].trim().replace(/ /g, NNBSP)}${NNBSP}km` : null; };
function cardCtx() {
  const a = st.snap.annual || {};
  const rules = { minMonths: isNum(a.minMonths) ? a.minMonths : null, share: isNum(a.partialCellShare) ? a.partialCellShare : null, km: kmText() };
  return { idx: st.idx, M, frames: st.frames, places: st.places, layer: st.shown, dpr: dpr2, rules };
}
/** The card's rectangle in panel px (the overlay keeps its labels out of it). */
function cardBox() {
  if (!card || !card.open || wide()) return [];
  const c = $('card'), pr = $('panel').getBoundingClientRect(), r = c.getBoundingClientRect();
  return [[r.left - pr.left, r.top - pr.top, r.right - pr.left, r.bottom - pr.top]];
}
function select(row, col, toggle = true) {
  if (toggle && st.selection && st.selection.row === row && st.selection.col === col) return clearSelection();
  st.selection = { row, col };
  dirty.overlay = dirty.legend = true; requestRender();
  const v = cellValue(st.shown, row, col);
  say(`${cellBounds(row, col)}: ${v == null ? 'no estimate' : absOn() ? `about ${degC(whole(v))}` : degC(tenths(v))} in ${st.idx.name[st.shown]}`);
  if (card && st.decoderDone()) {
    closeBase(false);
    const was = card.open;
    card.show(st.selection, cardCtx());
    $('app').classList.add('carded');
    if (!was) { if (wide()) layout(); }
    dirty.card = true;
    bringIntoView(row, col);
  }
  settleSoon(0, false);
  return st.selection;
}
function clearSelection() {
  if (!st.selection) return null;
  st.selection = null;
  if (card) card.hide();
  $('app').classList.remove('carded');
  if (wide()) layout();
  dirty.overlay = dirty.legend = true; requestRender();
  say('No cell selected');
  settleSoon(0, false);
  return null;
}
/** If the card covers the selected cell, turn the globe (240 ms) so the cell sits in the free part above. */
function bringIntoView(row, col) {
  if (wide() || !card.open) return;
  const lat = 89 - 2 * row, lon = -179 + 2 * col, cardTop = view.H - parseFloat(getComputedStyle($('panel')).getPropertyValue('--card-bottom')) - $('card').offsetHeight;
  const p = view.project(lon, lat), freeTop = st.focus ? view.top : 44, ty = (freeTop + cardTop) / 2;
  if (p[2] && p[1] < cardTop - 10) return;
  if (view.mode === 'globe') {
    const R = view.radius(), Y = (view.cy - ty) / R;
    if (Math.abs(Y) >= 0.98) return;
    turnTo(lon, lat - Math.asin(Y) * 180 / Math.PI, CARD_TURN_MS);
  } else if (view.map.zoom > 1) {
    view.map.panY -= (p[1] - ty) / view.mapScale(); view.clamp();
    dirty.earth = dirty.overlay = true; requestRender();
  }
}
function cellValue(layer, row, col) {
  if (layer < 0 || !st.resident[layer]) return null;
  return M.value(layer, row * 180 + col);
}

/* ── the Earth: gestures, keys ── */
function wireEarth() {
  const elm = $('earth');
  attachGestures(elm, {
    start() { st.fling = null; st.turn = null; if (st.pole) { st.pole = null; dirty.pole = true; } },
    pan(dx, dy) { view.panBy(dx, dy); dirty.earth = dirty.overlay = dirty.pole = true; requestRender(); },
    pinch(f, mx, my) { view.zoomBy(f, mx, my); dirty.earth = dirty.overlay = true; requestRender(); },
    release(vx, vy) {
      if (!reducedMotion() && Math.hypot(vx, vy) > 120) { st.fling = { vx, vy }; requestRender(); } else settleSoon(0, false);
    },
    tap(x, y) {
      if (st.swallowTap) { st.swallowTap = false; return; }   // that touch only stopped the opening (R-6)
      const g = view.unproject(x, y); if (g && st.idx) { const c = cellOf(g[0], g[1]); select(c.row, c.col); }
    },
    // as Photos does (R-7): at zoom 1, in by 2× about the finger; zoomed, home
    doubleTap(x, y) {
      st.swallowTap = false;
      const z = view.mode === 'globe' ? view.globe.zoom : view.map.zoom;
      if (z < 1.01) view.zoomBy(2, x, y); else view.home();
      dirty.earth = dirty.overlay = dirty.pole = true; requestRender(); settleSoon(0, false);
    },
  });
  elm.addEventListener('focus', () => {
    if (!elm.matches(':focus-visible')) return;
    st.crosshair = true; elm.setAttribute('role', 'application');
    elm.setAttribute('aria-roledescription', 'Earth');
    dirty.overlay = true; requestRender();
  });
  elm.addEventListener('blur', () => { st.crosshair = false; elm.setAttribute('role', 'img'); elm.removeAttribute('aria-roledescription'); dirty.overlay = true; requestRender(); });
  elm.addEventListener('keydown', (e) => {
    const g = view.mode === 'globe';
    const turn = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (turn) {
      st.turn = null; if (st.pole) st.pole = null;
      if (g) { view.globe.lon += turn[0]; view.globe.lat += turn[1]; } else { view.map.lon0 += turn[0]; view.map.panY += turn[1] * 0.02; }
      view.clamp();
    } else if (e.key === '+' || e.key === '=') view.zoomBy(1.25);
    else if (e.key === '-' || e.key === '_') view.zoomBy(0.8);
    else if (e.key === 'Enter') { const p = view.unproject(view.cx, view.cy); if (p) { const c = cellOf(p[0], p[1]); select(c.row, c.col); } }
    else return;
    e.preventDefault();
    dirty.earth = dirty.overlay = dirty.pole = true; requestRender(); settleSoon(400, false);
  });
}

/* ── controls ── */
function step(d) { stopPlay(); setPos(st.pos[st.mode] + d, Math.sign(d)); settleSoon(400); }
/** A key that acts once per press and, held, 8 times a second after 400 ms (§3.5). */
function holdKey(b, act) {
  let hold = 0, rep = 0, viaPointer = false;
  const stopHold = () => { clearTimeout(hold); clearInterval(rep); hold = rep = 0; };
  b.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    stopHold();
    try { b.setPointerCapture(e.pointerId); } catch { /* fine */ }
    viaPointer = true; act();
    hold = setTimeout(() => { rep = setInterval(() => (b.disabled ? stopHold() : act()), 125); }, 400);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stopHold);
  // a lift anywhere ends the hold, even where the key moved out from under the finger
  for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, stopHold, { capture: true, passive: true });
  b.addEventListener('click', () => { if (viaPointer) { viaPointer = false; return; } act(); });
}
function wireControls() {
  track = createTrack($('track'), $('track-hit'), {
    onStart() { stopPlay(); dirty.track = true; },
    onScrub(i, dir) { stopPlay(); setPos(i, dir); dirty.track = true; },
    onEnd() { dirty.track = true; requestRender(); settleSoon(0); },
    onHover() { dirty.track = true; requestRender(); },
    onKey(k) {
      const big = st.mode === 'annual' ? 10 : 6, n = count();
      if (k === 'play') { if (st.playing) stopPlay(); else startPlay(); return; }
      const p = st.pos[st.mode];
      step({ prev: -1, next: 1, pgup: big, pgdn: -big, home: -p, end: n - 1 - p }[k]);
    },
  });
  card = createCard({
    onClose: () => clearSelection(),
    onYear: (i, dir = 0) => { stopPlay(); if (st.mode !== 'annual') setMode('annual', false); setPos(i, dir); settleSoon(300); },
    onRedraw: () => { dirty.card = true; requestRender(); },
  });
  // ‹ and ›: one step per press; held, 8 a second after 400 ms (§3.5)
  for (const [id, d] of [['prev', -1], ['next', 1]]) holdKey($(id), () => step(d));
  $('play').addEventListener('click', () => { if (st.playing) stopPlay(); else startPlay(); });
  // the pressed state (§20 Q-3): a class set by pointer events, so a touch shows the plate at once on
  // every engine (WebKit gives :active to a touch only with a touch listener, and late); :active stays
  // in the CSS for a key held by the keyboard
  let down = null;
  const lift = () => { if (down) { down.classList.remove('down'); down = null; } };
  document.addEventListener('pointerdown', (e) => { lift(); const k = e.target.closest && e.target.closest('button'); if (k && !k.disabled) { down = k; k.classList.add('down'); } }, { capture: true, passive: true });
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, lift, { capture: true, passive: true });
  // the two underline switches: radio groups, arrow keys move the choice
  const radios = (seg, attr, apply) => {
    const bs = [...seg.querySelectorAll('button')];
    for (const b of bs) {
      b.addEventListener('click', () => apply(b.dataset[attr]));
      b.addEventListener('keydown', (e) => {
        const d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const nb = bs[(bs.indexOf(b) + d + bs.length) % bs.length];
        nb.focus(); apply(nb.dataset[attr]);
      });
    }
  };
  radios($('view-seg'), 'v', setView);
  radios($('mode-seg'), 'm', (m) => setMode(m));
  radios($('measure-seg'), 's', (m) => setMeasure(m === 'abs'));
  $('base-key').addEventListener('click', () => ($('base-card').hidden ? openBase() : closeBase()));
  $('base-close').addEventListener('click', () => closeBase());
  radios($('base-presets'), 'b', (y) => { const sp = PRESETS.find((p) => p[0] === +y); setSpan(sp[0] === 1951 ? null : sp); say(`Baseline ${M.text()}${sp[0] === 1951 ? ', GISS’s own' : ''}`); });
  baseSlider();
  $('arctic').addEventListener('click', () => pole('n'));
  $('antarctic').addEventListener('click', () => pole('s'));
  // focus mode's two keys: focus follows them only when they were pressed from the keyboard (US Quakes §22)
  let ptrAt = -1e9;
  for (const id of ['focus-key', 'focus-exit']) $(id).addEventListener('pointerdown', (e) => { ptrAt = e.timeStamp; });
  const byKey = (e) => e.detail === 0 || e.timeStamp - ptrAt > 1000;
  $('focus-key').addEventListener('click', (e) => setFocus(true, { kbd: byKey(e) }));
  $('focus-exit').addEventListener('click', (e) => setFocus(false, { kbd: byKey(e) }));
  $('about-key').addEventListener('click', () => openAbout());
  $('about-close').addEventListener('click', () => closeAbout());
  $('stamp').addEventListener('click', () => openAbout('ab-this-copy'));
  $('legend-caption').addEventListener('click', () => openAbout(absOn() ? 'ab-absolute' : 'ab-colors'));
  // Escape, one thing per press: About, else the selection, else focus mode (§6.5)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('about').hidden) closeAbout();
      else if (!$('base-card').hidden) closeBase();
      else if (st.selection) clearSelection();
      else if (st.focus) setFocus(false, { kbd: true });
      else return;
      e.preventDefault();
    } else if (e.key === 'Tab' && !$('about').hidden) trapTab(e);
  });
  // the opening ends at any touch, key or wheel (§3.9), wherever it lands; a touch that lands on the
  // Earth only stops it: its tap opens no card (R-6). Any later touch clears the once-only hint (R-10).
  const endIt = (e) => {
    if (e.type === 'pointerdown') {
      st.swallowTap = !!st.opening && !!(e.target && e.target.closest && e.target.closest('#earth'));
      if (st.hintAt && e.timeStamp > st.hintAt) hintOff();
    }
    if (st.opening) endOpening();
  };
  for (const ev of ['pointerdown', 'keydown', 'wheel']) document.addEventListener(ev, endIt, { capture: true, passive: true });
}
function setView(m) {
  if (!st.idx) return;
  view.setMode(m);
  if (m === 'map') st.turn = null;
  for (const b of $('view-seg').querySelectorAll('button')) { b.setAttribute('aria-checked', String(b.dataset.v === m)); b.tabIndex = b.dataset.v === m ? 0 : -1; }
  segMark($('view-seg'), m);
  dirty.earth = dirty.overlay = dirty.pole = true; requestRender();
  settleSoon(0, false);
}

/* ── Difference | Absolute, and the baseline (plan 0012 3.3; measure.js) ── */
function setMeasure(abs, announce = true) {
  if (!st.idx || (abs && !M.clim) || abs === M.abs) return;
  M.abs = abs;
  for (const b of $('measure-seg').querySelectorAll('button')) { b.setAttribute('aria-checked', String((b.dataset.s === 'abs') === abs)); b.tabIndex = (b.dataset.s === 'abs') === abs ? 0 : -1; }
  measureChanged();
  if (announce) say(abs ? 'Absolute: estimated temperatures, each place’s 1951–1980 average plus GISS’s anomaly' : `Difference: anomalies against ${M.text()}`);
}
/** Everything a measure or baseline drawn: the map, the legend's reserve, the stripes, the card. */
function measureChanged() {
  capCache.clear();
  if (earth && earth.supported) earth.setBase(M.base);
  baseKeyUi();
  trackModel(); layout();
  if (card && card.open && st.selection) card.reread({ ...cardCtx(), layer: st.shown });
  if (!$('base-card').hidden) baseUi();
  dirtyAll(); settleSoon(0, false);
}
/** The key names the base in use: single months are always against GISS's 1951–1980, so in Last 24
 *  months it says so; in Absolute the map does not use it, and its name says what does. */
function baseKeyUi() {
  if (!st.idx) return;
  const months = st.mode === 'months', inUse = months ? st.idx.baseText : M.text();
  setText($('base-years'), inUse);
  const scope = M.custom() && months ? ` for single months; years use ${M.text()}` : M.abs ? ', for the card’s chart and the stripes; the map’s temperatures do not use it' : '';
  $('base-key').setAttribute('aria-label', `Baseline ${inUse}${scope}. Choose the years.`);
}
function setSpan(span) {
  if (!st.decoderDone()) return;
  M.setSpan(span);
  measureChanged();
}
/* the baseline's sheet (plan 0012 D22): four presets, one tap each, and a two-thumb slider over the
   complete years for any other span; a month is always against 1951–1980 (measure.js) */
const PRESETS = [[1951, 1980], [1961, 1990], [1981, 2010], [1991, 2020]];
function openBase() {
  if (!st.idx || st.failed || !st.decoderDone()) return;
  if (st.selection) clearSelection();
  const c = $('base-card');
  c.hidden = false; c.classList.add('in');
  $('base-key').setAttribute('aria-expanded', 'true');
  baseUi(); $('base-close').focus({ focusVisible: false });
  dirty.overlay = true; requestRender();
}
function closeBase(refocus = true) {
  const c = $('base-card');
  if (c.hidden) return;
  c.hidden = true; c.classList.remove('in');
  $('base-key').setAttribute('aria-expanded', 'false');
  if (refocus) $('base-key').focus({ focusVisible: false });
  dirty.overlay = true; requestRender();
}
function baseUi(sp = M.custom() ? M.span : st.idx.base) {
  const I = st.idx, note = $('base-note');
  sliderUi(sp);
  noteReserve();
  // while a thumb moves the map has not followed yet, so the note says the rule and waits (aria-busy) for
  // the count; a key or VoiceOver step holds it busy until the steps stop, so it speaks once (stepped())
  note.setAttribute('aria-busy', String(!!drag || !!stepT));
  setText(note, noteText(sp, { moving: !!drag, custom: !!drag || M.custom() }));
  setText($('b-first'), String(I.years[0])); setText($('b-last'), String(I.years[I.lastComplete]));
}
/** The note's words for a span: settled, or while a thumb moves (what follows at the lift, in this mode). */
function noteText(sp, { moving = false, custom = M.custom(), lacking = M.lacking } = {}) {
  const n = sp[1] - sp[0] + 1, need = Math.ceil((2 * n) / 3 - 1e-9), months = st.mode === 'months';
  const these = n === 1 ? `this one year, and needs a value in it` : `these ${n} years, and needs a value in ${need} of them`;
  if (moving) return `Each place is compared with its own mean over ${these}. ${months ? 'The years follow on release; single months stay against 1951–1980.' : M.abs ? 'The stripes and the card’s chart follow on release.' : 'The map follows on release.'}`;
  const fate = M.abs && !months ? ', so they have no mean over the span' : ' and are drawn as no data';
  let t = custom
    ? `Each place is compared with its own mean over ${these}: ${lacking ? `${lacking.toLocaleString('en-US').replace(/,/g, NNBSP)} cells have ${n === 1 ? 'none' : 'fewer'}${fate}` : n === 1 ? 'every cell has one' : 'every cell has them'}. The global mean and the stripes use GISS’s global means over the same years.`
    : `GISS’s own base: each place is compared with its 1951–1980 average.`;
  if (months) t += ' The span applies to years. Single months stay against 1951–1980: the app holds only the last 24 months, so it cannot average a month over other years.';
  else if (M.abs) t += ' In Absolute the map’s temperatures do not use it: it applies to the card’s chart and the stripes.';
  return t;
}
/* The note's height is held at its longest form for this width, text size, list and measure (review of
   1.2: the sheet is anchored at its foot, so a note that grew pushed the presets and the slider from
   under the finger). Measured, never painted: the forms are set and replaced in the same task. */
let noteKey = '';
function noteReserve() {
  const note = $('base-note'), I = st.idx;
  const key = `${note.clientWidth}|${getComputedStyle(note).fontSize}|${st.mode}|${M.abs}`;
  if (!note.clientWidth || key === noteKey) return;
  noteKey = key;
  const all = [I.years[0], I.years[I.lastComplete]], was = note.textContent;
  note.style.minHeight = '';
  let h = 0;
  for (const t of [noteText(all, { moving: true }), noteText(all, { custom: true, lacking: CELLS }), noteText(all, { custom: true, lacking: 0 }), noteText(I.base, { custom: false })]) {
    note.textContent = t; h = Math.max(h, note.offsetHeight);
  }
  note.textContent = was;
  note.style.minHeight = `${h}px`;
}
/** The slider and the presets drawn for a span (also while a thumb moves, before the map follows). */
function sliderUi(sp) {
  const I = st.idx, first = I.years[0], last = I.years[I.lastComplete], sl = $('b-slider');
  const p = (y) => ((y - first) / Math.max(1, last - first)).toFixed(4);
  sl.style.setProperty('--p0', p(sp[0])); sl.style.setProperty('--p1', p(sp[1]));
  const [b0, b1] = [$('b0'), $('b1')];
  b0.min = first; b0.max = sp[1]; b0.value = sp[0]; b1.min = sp[0]; b1.max = last; b1.value = sp[1];
  b0.setAttribute('aria-valuetext', String(sp[0])); b1.setAttribute('aria-valuetext', String(sp[1]));
  setText($('b-span'), sp[0] === sp[1] ? String(sp[0]) : `${sp[0]}–${sp[1]}`);
  const seg = $('base-presets'), on = PRESETS.findIndex((p) => p[0] === sp[0] && p[1] === sp[1]);
  [...seg.querySelectorAll('button')].forEach((b, i) => { b.setAttribute('aria-checked', String(i === on)); b.tabIndex = i === on || (on < 0 && !i) ? 0 : -1; });
  const b = seg.querySelectorAll('button')[on], mk = seg.querySelector('.mark');
  mk.style.transform = b ? `translateX(${b.offsetLeft}px) scaleX(${b.offsetWidth})` : 'scaleX(0)';
}
/* The two thumbs: input type=range each (VoiceOver's adjustable control and the arrow keys come with it),
   invisible 44 px boxes over the drawn dots. A finger anywhere on the slider takes the nearer thumb
   (where they meet, the one its first move points to) and the span follows it; the map follows at the
   lift, since a baseline is a mean over every year of the span (measured: 8–25 ms a span on this Mac,
   more than a frame). A key or VoiceOver step is applied at the next frame. */
let drag = null, keyT = 0, stepT = 0;
function baseSlider() {
  const sl = $('b-slider'), cur = () => [+$('b0').value, +$('b1').value];
  const yearAt = (cx) => { const I = st.idx, r = sl.getBoundingClientRect(), first = I.years[0], last = I.years[I.lastComplete];
    return clamp(Math.round(first + ((cx - r.left - 11) / Math.max(1, r.width - 22)) * (last - first)), first, last); };
  const move = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const y = yearAt(e.clientX), sp = drag.sp.slice();
    if (drag.end < 0) { if (y === sp[0]) return; drag.end = y < sp[0] ? 0 : 1; }
    sp[drag.end] = drag.end ? Math.max(sp[0], y) : Math.min(sp[1], y);
    drag.sp = sp; baseUi(sp);
  };
  sl.addEventListener('pointerdown', (e) => {
    if (drag || !st.idx || e.button > 0) return;
    e.preventDefault();
    const sp = cur(), y = yearAt(e.clientX), d0 = Math.abs(y - sp[0]), d1 = Math.abs(y - sp[1]);
    drag = { id: e.pointerId, sp, end: sp[0] === sp[1] && y === sp[0] ? -1 : y < sp[0] || d0 < d1 || (d0 === d1 && y < sp[0]) ? 0 : 1 };
    try { sl.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (e.pointerType === 'mouse') $(drag.end === 1 ? 'b1' : 'b0').focus({ focusVisible: false });   // a touch never focuses an input
    move(e);
  });
  sl.addEventListener('pointermove', move);
  const lift = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const sp = drag.sp, was = M.custom() ? M.span : st.idx.base; drag = null;
    if (sp[0] === was[0] && sp[1] === was[1]) { baseUi(); return; }   // a touch that moved nothing
    setSpan(sp); say(`Baseline ${M.text()}`);
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) sl.addEventListener(ev, lift);
  // a step speaks through the control's own value; the note is quiet until the steps stop, then speaks once
  const stepped = () => {
    const note = $('base-note');
    note.setAttribute('aria-live', 'off'); note.setAttribute('aria-busy', 'true');
    clearTimeout(stepT);
    stepT = setTimeout(() => {
      stepT = 0;
      note.setAttribute('aria-live', 'polite'); note.setAttribute('aria-busy', String(!!drag));
      const t = note.textContent; note.textContent = ''; note.textContent = t;
    }, 600);
  };
  for (const id of ['b0', 'b1']) $(id).addEventListener('input', () => {
    stepped();
    const sp = cur(); sliderUi(sp);
    cancelAnimationFrame(keyT); keyT = requestAnimationFrame(() => setSpan(cur()));
  });
}
/* ── focus mode (§10): the Earth, the stripes track with its keys, and the step's name ── */
const FOCUS_HIDE = ['top', 'strip', 'yearrow', 'mode-seg'];      // the legend stays (the owner, plan 0012: the scale stays); its first row goes
function setFocus(on, { boot = false, kbd = false } = {}) {
  if (on && (!earth || !earth.supported || st.failed)) return;
  if (on === st.focus && !boot) return;
  if (on) { endOpening(); closeBase(false); if (!$('about').hidden) closeAbout(false); }
  const still = boot || reducedMotion();
  const moving = still ? [] : ['track-row', 'controls'].map((id) => [$(id), $(id).getBoundingClientRect().top]);
  const p0 = $('panel').getBoundingClientRect(), cy0 = p0.top + view.cy, r0 = view.mode === 'globe' ? view.radius() : 0;
  finishMotion();
  st.focus = on;
  if (!boot) store.set('focus', on);
  for (const id of FOCUS_HIDE) { $(id).hidden = on; $(id).inert = on; }
  $('legend-row').inert = on;
  $('focus-name').hidden = !on;
  $('focus-exit').hidden = !on;
  $('app').classList.toggle('focus', on);
  layout();
  if (!still) {
    // FLIP: the track and the controls glide from where they were; the Earth glides to its new seat
    for (const [e, top0] of moving) {
      const d = top0 - e.getBoundingClientRect().top;
      if (!d) continue;
      e.style.transition = 'none'; e.style.transform = `translateY(${d}px)`;
      e.getBoundingClientRect();
      e.style.transition = `transform ${FOCUS_MS}ms var(--turn)`; e.style.transform = '';
      setTimeout(() => { e.style.transition = ''; }, FOCUS_MS + 40);
    }
    const p1 = $('panel').getBoundingClientRect(), f1 = view.factor;
    const fit = Math.min(view.seatW, view.seatH) * view.globe.zoom;
    st.seat = { t0: performance.now(), ms: FOCUS_MS, dy0: cy0 - (p1.top + view.cy), f0: r0 && view.mode === 'globe' ? r0 / fit : f1, f1 };
    view.dy = st.seat.dy0; view.factor = st.seat.f0;
    if (on) { const g = $('focus-exit'); g.style.opacity = '0'; g.getBoundingClientRect(); g.style.transition = `opacity ${FOCUS_MS}ms var(--settle)`; g.style.opacity = ''; setTimeout(() => { g.style.transition = ''; }, FOCUS_MS + 40); }
    dirtyAll(); drawNow();
  }
  if (kbd && !boot) { const k = $(on ? 'focus-exit' : 'focus-key'); try { k.focus({ focusVisible: true }); } catch { k.focus(); } }
  if (!boot) say(on ? 'Controls hidden. The Earth, its scale and the stripes stay.' : 'Controls shown.');
}

/* ── About (§3.6) ── */
let aboutFrom = null;
function openAbout(section) {
  aboutFrom = document.activeElement;
  closeBase(false);
  const r = renderAbout($('about-body'), { about: st.about, idx: st.idx, snap: st.snap, clim: st.climJson, version: st.version, counts: aboutCounts(), onVersion: togglePerf });
  st.aboutUnknown = r.unknown;
  $('about').hidden = false;
  $('about-key').setAttribute('aria-expanded', 'true');
  const b = $('about-body'), target = section && $(section);
  b.scrollTop = 0;
  if (target) b.scrollTop = target.getBoundingClientRect().top - b.getBoundingClientRect().top - 6;
  $('about-close').focus();
}
function closeAbout(refocus = true) {
  if ($('about').hidden) return;
  $('about').hidden = true;
  $('about-key').setAttribute('aria-expanded', 'false');
  if (refocus) (aboutFrom && aboutFrom.isConnected && !aboutFrom.closest('[hidden]') ? aboutFrom : $('about-key')).focus();
}
function trapTab(e) {
  const f = [...$('about').querySelectorAll('button, [tabindex="0"]')].filter((x) => !x.hidden);
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && (i === f.length - 1 || i < 0)) { e.preventDefault(); f[0].focus(); }
}
/** What About counts from the snapshot: cells with a value in the last complete year, and every
 *  complete year's cells beyond the scale against its cells with a value. */
let countsCache = null;
function aboutCounts() {
  const I = st.idx;
  if (!I || !st.decoderDone()) return null;
  if (countsCache && countsCache.key === I.release.id + I.generatedAt) return countsCache.v;
  let cells = 0, beyondAll = 0, valuesAll = 0;
  for (let k = 0; k <= I.lastComplete; k++) {
    let c = 0;
    const o = k * CELLS;
    for (let i = 0; i < CELLS; i++) if (st.frames[o + i] !== NONE) c++;
    valuesAll += c; beyondAll += I.above[k] + I.below[k];
    if (k === I.lastComplete) cells = c;
  }
  countsCache = { key: I.release.id + I.generatedAt, v: { cells, beyondAll, valuesAll } };
  return countsCache.v;
}
function togglePerf() { st.perfOn = !st.perfOn; $('perf').hidden = !st.perfOn; if (st.perfOn) perfReadout(); }
function perfReadout() {
  const f = perfFrames.slice(-30), med = (k) => { const s = summary(f.map((q) => q[k])); return s.n ? s.median.toFixed(1) : '–'; };
  setText($('perf'), `frame ${med('total')} ms, earth ${med('earth')} ms, overlay ${med('overlay')} ms`);
}

/* ── the opening (§3.9, ART moment 1): 1880 to the last complete year, the stripes written behind the
   index; once, never under Reduce Motion or in focus mode; any touch, key or wheel ends it ── */
function wantOpening() {
  return store.get('opened', null) == null && !reducedMotion() && !st.focus && earth && earth.supported && document.visibilityState === 'visible';
}
function startOpening() {
  const I = st.idx;
  track.setWritten(1);
  notice('opening', `Playing ${I.years[0]} to ${I.years[I.lastComplete]}, one year every eighth of a second. Touch to stop.`);
  startPlay();
}
function endOpening() {
  if (!st.opening) return;
  st.opening = false;
  track.setWritten(Infinity);
  notice('opening', null);
  if (st.playing) stopPlay();
  dirty.track = true; requestRender();
  hintOnce();
}
/* ── the one hint (R-10): once per install, when the opening ends (or on a first launch without it),
   one line that says a place can be tapped; it goes at the next touch or after 6 s ── */
let hintT = 0;
function hintOnce() {
  setTimeout(() => {                                        // after the touch that ended the opening
    if (store.get('hinted', null) != null || !st.idx || st.failed || st.focus || !earth || !earth.supported || document.visibilityState !== 'visible') return;
    store.set('hinted', true);
    st.hintAt = performance.now();
    notice('hint', `Tap any place for its own line since ${st.idx.years[0]}.`);
    hintT = setTimeout(hintOff, 6000);
  }, 0);
}
function hintOff() { clearTimeout(hintT); st.hintAt = 0; notice('hint', null); }

/* ── failure, in words, in place (§3.7) ── */
function fail(sentence) {
  st.failed = sentence;
  if (st.decoder) st.decoder.stop();
  endOpening();
  stopPlay();
  showError(sentence);
  $('legend').hidden = true;
  for (const b of document.querySelectorAll('.controls button, .strip button')) b.disabled = true;
  $('focus-key').hidden = true;
  $('earth').setAttribute('aria-label', sentence);
  try { const g = $('gl').getContext('webgl2'); if (g) { g.clearColor(ground[0] / 255, ground[1] / 255, ground[2] / 255, 1); g.clear(g.COLOR_BUFFER_BIT); } } catch { /* nothing to clear */ }
  const o = $('over').getContext('2d'); o.clearRect(0, 0, $('over').width, $('over').height);
  st.ready = true;
}

/* ── the fonts: canvas text waits for Archivo, and is redrawn when any face arrives (ART "Type") ── */
function loadFonts() {
  const done = () => { st.fontsReady = true; dirtyAll(); };
  try {
    document.fonts.addEventListener('loadingdone', () => { noteKey = ''; if (track) track.invalidate(); if (overlay) overlay.invalidate(); layout(); });
    const all = Promise.all(['400 12px Archivo', '600 12px Archivo', 'semi-condensed 400 12px Archivo'].map((f) => document.fonts.load(f)));
    return Promise.race([all, new Promise((r) => setTimeout(r, 3000))]).then(done, done);
  } catch { done(); return Promise.resolve(); }
}

function stamp() {
  const t = stampText(st.idx);
  setText($('stamp-1'), t.release); setText($('stamp-2'), t.tail);
  $('stamp').setAttribute('aria-label', `${t.release}, ${t.spoken}. Opens About at this copy.`);
  $('stamp').hidden = false;
}

/* ── boot (§4.5) ── */
async function boot() {
  ground = hexRGB(cssVar('--card'));
  wireControls(); wireEarth();
  overlay = createOverlay($('over'));
  const fonts = loadFonts();
  earth = createEarth($('gl'), {
    onLost() { notice('restore', 'Restoring the view…'); },
    onRestored() { notice('restore', null); dirtyAll(); },
  });
  if (!earth.supported) $('focus-key').hidden = true;
  // About's prose and the version: static files, read whatever the snapshot turns out to be
  fetch('assets/about.json').then((r) => (r.ok ? r.json() : null)).then((j) => { st.about = j && Array.isArray(j.sections) ? j : null; }).catch(() => {});
  fetch('miniapp.json').then((r) => (r.ok ? r.json() : null)).then((j) => { st.version = j && j.version ? String(j.version) : null; }).catch(() => {});
  // the 1951–1980 climatology for Absolute (plan 0012 3.3): read before the first draw, so a stored
  // Absolute opens as Absolute; without it the app shows differences and says why
  const climP = fetch('assets/climatology.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  let text;
  try {
    const res = await fetch('data/snapshot.json', { cache: 'no-store' });
    if (!res.ok) return fail(MISSING);
    text = await res.text();
  } catch { return fail(MISSING); }
  let snap;
  try { snap = JSON.parse(text); } catch { return fail('The data file could not be read: it is not valid JSON.'); }
  text = null;
  const bad = validate(snap, earth.supported ? earth.maxLayers : 256);
  if (bad) return fail(`The data file could not be read: ${bad}.`);
  st.snap = snap; st.idx = index(snap);
  M.bind(st.idx, null, null);                               // the indexes now; the frames once they exist
  restore();
  {
    const j = await climP, bad = j ? checkClim(j) : 'it is missing';
    if (!bad) { try { M.clim = await decodeClim(j, st.idx.partialMonths); st.climJson = j; } catch { M.clim = null; } }
    if (!M.clim) { M.abs = false; $('measure-seg').querySelector('[data-s="abs"]').disabled = true; notice('clim', 'The temperatures for Absolute (assets/climatology.json) could not be read; differences only.', 8000); }
  }
  for (const b of $('measure-seg').querySelectorAll('button')) { b.setAttribute('aria-checked', String((b.dataset.s === 'abs') === M.abs)); b.tabIndex = (b.dataset.s === 'abs') === M.abs ? 0 : -1; }
  // focus mode is restored before the first draw; the opening never starts in it, and never twice
  if (earth.supported && store.get('focus', false, (v) => typeof v === 'boolean')) setFocus(true, { boot: true });
  const opening = wantOpening();
  if (opening) {
    store.set('opened', true);                              // stored before it starts
    st.opening = true; st.mode = 'annual'; st.pos.annual = 0;
    view.mode = 'globe'; view.globe = { lon: defaultLon(), lat: 20, zoom: 1 };
  }
  const I = st.idx;
  st.frames = new Uint8Array(I.L * CELLS);
  if (earth.supported) { earth.setFrames(st.frames, I.L); earth.setLut(buildLut()); earth.setAbsLut(buildAbsLut(darkOn())); if (M.clim) earth.setClim(M.clim.t); }
  else { showError('This view needs WebGL 2, which this device does not offer.'); $('legend').hidden = true; for (const b of document.querySelectorAll('.strip button')) b.disabled = true; }
  st.wanted = layerOf(st.mode, st.pos[st.mode]);
  st.decoder = createDecoder(snap, st.frames, {
    delay: window.__wwSlowDecode || 0,
    onFrame(k) {
      if (earth.supported) earth.upload(k);
      if (k === st.wanted) requestRender();
      if (st.decoder && st.decoder.complete()) { if (st.wantSpan) { const w = st.wantSpan; st.wantSpan = null; setSpan(w); } else if (M.abs) measureChanged(); dirty.card = true; requestRender(); }
    },
    onError(m) { fail(`The data file could not be read: ${m}.`); },
  });
  st.resident = st.decoder.resident;
  M.bind(I, st.frames, st.resident);
  baseKeyUi();
  st.decoder.start(st.wanted);
  for (const b of $('view-seg').querySelectorAll('button')) { b.setAttribute('aria-checked', String(b.dataset.v === view.mode)); b.tabIndex = b.dataset.v === view.mode ? 0 : -1; }
  for (const b of $('mode-seg').querySelectorAll('button')) { b.setAttribute('aria-checked', String(b.dataset.m === st.mode)); b.tabIndex = b.dataset.m === st.mode ? 0 : -1; }
  if (opening) track.setWritten(0);
  layout();
  trackModel();
  staleCheck();
  stamp();
  Promise.all(['assets/world.json', 'assets/places.json'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.json(); })))
    .then(([w, p]) => { world = decodeWorld(w); st.places = decodePlaces(p); overlay.setWorld(world, st.places); dirty.overlay = true; requestRender(); })
    .catch(() => notice('world', 'The coastlines could not be read; the data are shown without them.'));
  await fonts;
  new ResizeObserver(() => layout()).observe($('panel'));
  new ResizeObserver(() => layout()).observe($('track-row'));
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { ground = hexRGB(cssVar('--card')); if (earth.supported) earth.setAbsLut(buildAbsLut(darkOn())); layout(); track.invalidate(); overlay.invalidate(); dirtyAll(); }); } catch { /* old engines */ }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
    else { endOpening(); stopPlay(); finishMotion(); }       // hidden: nothing plays or moves (§5.6)
  });
  requestRender();
  await new Promise((r) => { const w = () => (st.shown >= 0 ? r() : requestAnimationFrame(w)); w(); });
  st.ready = true;
  if (st.opening) startOpening(); else { settle(false); if (store.get('opened', null) == null) hintOnce(); }   // a first launch with no opening
}
st.decoderDone = () => !!(st.decoder ? st.decoder.complete() : st.idx);

function staleCheck() {
  const age = Date.now() - Date.parse(st.idx.generatedAt);
  notice('stale', age > STALE_MS ? `This copy of the data was made on ${st.idx.generatedAt.slice(0, 10)}. GISS publishes a release about the 10th of every month.` : null);
}

/* ── a new snapshot while the app is open (§12.3): validated whole, decoded whole, swapped ── */
let refreshing = false;
async function refresh() {
  if (refreshing || !st.idx || st.failed) return;
  refreshing = true;
  const old = dataTo(st.idx);
  try {
    const res = await fetch('data/snapshot.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('the file is missing');
    let snap;
    try { snap = JSON.parse(await res.text()); } catch { throw new Error('it is damaged'); }
    if (snap && snap.generatedAt === st.idx.generatedAt && snap.release && snap.release.id === st.idx.release.id) return;
    const bad = validate(snap, earth.supported ? earth.maxLayers : 256);
    // the boot error keeps the precise phrase (§3.7); a notice over a working app says it plainly
    if (bad) throw new Error(snap && snap.app === 'Warming World' && snap.schema === 1 ? 'it is incomplete' : 'it is not a Warming World data file');
    const frames = await decodeAll(snap);
    const I0 = st.idx, name = st.mode === 'annual' ? I0.years[st.pos.annual] : I0.monthKeys[st.pos.months];
    const I = index(snap);
    st.snap = snap; st.idx = I; st.frames = frames;
    st.resident = new Uint8Array(I.L).fill(1);
    st.decoder = null; capCache.clear(); countsCache = null;
    if (earth.supported) earth.replaceFrames(frames, I.L);
    if (st.climJson) { M.clim = await decodeClim(st.climJson, I.partialMonths); if (earth.supported) earth.setClim(M.clim.t); }
    M.bind(I, frames, st.resident); if (earth.supported) earth.setBase(M.base);
    if (st.mode === 'annual') { const i = I.years.indexOf(name); st.pos.annual = i >= 0 ? i : I.lastComplete; }
    else { const i = I.monthKeys.indexOf(name); st.pos.months = i >= 0 ? i : I.nm - 1; }
    { const i = I.monthKeys.indexOf(I0.monthKeys[st.pos.months]); if (st.mode === 'annual') st.pos.months = i >= 0 ? i : I.nm - 1; }
    st.shown = -1;
    trackModel(); layout(); setPos(st.pos[st.mode]); staleCheck(); stamp();
    if (card && card.open) card.reread({ ...cardCtx(), layer: st.wanted });
    const msg = `New data: to ${monthName(I.release.newestMonth, true)}`;
    notice('new', msg, 4000); say(msg);
  } catch (e) {
    notice('new', `The new data file could not be read: ${e.message}. Still showing ${old}.`, 8000);
  } finally { refreshing = false; }
}

/* ── window.__ww: inert unless called (tools/shoot.mjs) ── */
const frameDone = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
window.__ww = {
  ready: () => st.ready,
  failed: () => st.failed,
  /** Resolves once every frame is resident and nothing moves. */
  async settled() {
    for (let k = 0; k < 600; k++) {
      if (st.failed || (st.decoderDone() && !st.playing && !st.fling && !st.turn && !st.seat && !(card && card.drawing()) && st.shown === st.wanted)) { await frameDone(); return true; }
      await frameDone();
    }
    return false;
  },
  /** A year (number), a month ("YYYY-MM"), or {mode, i}; resolves after the frame that drew it. */
  async goto(x) {
    const I = st.idx;
    stopPlay();
    if (typeof x === 'number') { if (st.mode !== 'annual') setMode('annual', false); setPos(I.years.indexOf(x)); }
    else if (typeof x === 'string') { if (st.mode !== 'months') setMode('months', false); setPos(I.monthKeys.indexOf(x)); }
    else { if (x.mode !== st.mode) setMode(x.mode, false); setPos(x.i); }
    await frameDone();
    return this.state();
  },
  /** 'globe' | 'map', or {mode, lon, lat, zoom, lon0, panY}. */
  async view(v) {
    if (typeof v === 'string') setView(v);
    else {
      if (v.mode) setView(v.mode);
      st.turn = null;
      if (v.lon != null) view.globe.lon = v.lon; if (v.lat != null) view.globe.lat = v.lat;
      if (v.zoom != null) (view.mode === 'globe' ? view.globe : view.map).zoom = v.zoom;
      if (v.lon0 != null) view.map.lon0 = v.lon0; if (v.panY != null) view.map.panY = v.panY;
      view.clamp(); dirty.earth = dirty.overlay = dirty.pole = true; requestRender();
    }
    await frameDone();
    return this.state().view;
  },
  play(on = true) { if (on) startPlay(); else stopPlay(); return st.playing; },
  mode(m) { setMode(m, false); return st.mode; },
  /** Select the cell under (lon, lat); returns its bounds and value as the app holds them. */
  tap(lon, lat) {
    const c = cellOf(lon, lat), s = select(c.row, c.col, false), v = cellValue(st.shown, c.row, c.col);
    return s && { ...s, bounds: cellBounds(c.row, c.col), tenths: v, text: v == null ? null : degC(tenths(v)) };
  },
  clear: () => clearSelection(),
  pole: (w) => pole(w),
  focus: (on, kbd = false) => setFocus(on, { kbd }),
  about: (on = true, section) => (on ? openAbout(section) : closeAbout()),
  endOpening: () => endOpening(),
  /** [lon, lat] → client px, for a real touch (null when not on the facing Earth). */
  screen(lon, lat) { const p = view.project(lon, lat), r = $('panel').getBoundingClientRect(); return p[2] ? [r.left + p[0], r.top + p[1]] : null; },
  state() {
    const I = st.idx, txt = (id) => $(id).textContent;
    return {
      ready: st.ready, failed: st.failed, mode: st.mode, pos: { ...st.pos }, wanted: st.wanted, shown: st.shown, drawn: st.drawn,
      name: I && st.shown >= 0 ? I.name[st.shown] : null, label: txt('year'), sub: txt('year-sub'),
      mean: txt('mean'), cover: txt('cover'), playing: st.playing, selection: st.selection,
      opening: st.opening, focus: st.focus, focusName: $('focus-name').hidden ? null : txt('focus-name'),
      pole: st.pole, poleOn: poleOn(), poleRead: $('pole-read').hidden ? null : txt('pole-read'), turning: !!st.turn,
      card: card && card.open ? { place: txt('c-place'), value: $('c-value').hidden ? null : txt('c-value'), when: txt('c-when'), note: $('c-note').hidden ? null : txt('c-note'), chart: $('c-chart').getAttribute('aria-label'), foot: txt('c-foot'), geom: card.geom(), months: !$('c-months').hidden, drawing: card.drawing() } : null,
      about: !$('about').hidden, aboutUnknown: st.aboutUnknown || null, stamp: $('stamp').hidden ? null : `${txt('stamp-1')}${txt('stamp-2')}`,
      view: { mode: view.mode, globe: { ...view.globe }, map: { ...view.map }, cx: view.cx, cy: view.cy, radius: view.radius(), mapScale: view.mapScale(), W: view.W, H: view.H, top: view.top, bottom: view.bottom, factor: view.factor, dy: view.dy },
      resident: st.resident.reduce((a, b) => a + b, 0), layers: I ? I.L : 0, decode: st.decoder ? { ...st.decoder.queue(), ms: st.decoder.stats.t1 ? st.decoder.stats.t1 - st.decoder.stats.t0 : null, first: st.decoder.stats.order.slice(0, 3) } : null,
      fontsReady: st.fontsReady, fontAtFirstText: st.fontAtFirstText, fontNow: fontStatus(), firstDraw: st.firstDraw,
      notices: notices(), legendCaption: txt('legend-caption'), legendRow: !$('legend-row').inert && getComputedStyle($('legend-row')).display !== 'none',
      measure: M.abs ? 'abs' : 'diff', base: M.custom() ? M.span.slice() : null, baseText: M.text(), baseKey: txt('base-key'), baseSheet: $('base-card').hidden ? null : { b0: $('b0').value, b1: $('b1').value, span: txt('b-span'), note: txt('base-note'), preset: ($('base-presets').querySelector('[aria-checked="true"]') || {}).textContent || null },
      stats: st.shown >= 0 ? M.stats(st.shown) : null, clim: M.clim ? Array.from(M.clim.gm, (g) => Math.round(g)) : null,
      track: track ? { pressed: track.pressed, centre: st.shown >= 0 ? track.centre(st.shown - base()) : null, n: count(), written: track.written } : null,
      webgl: earth ? earth.supported : null, gl: earth && earth.supported ? earth.stats() : null, dpr, dpr2, perf: st.perfOn ? txt('perf') : null,
    };
  },
  perf() {
    const pick = (k) => summary(perfFrames.map((f) => f[k]));
    return { n: perfFrames.length, earth: pick('earth'), overlay: pick('overlay'), total: pick('total'), overlayStats: overlay ? overlay.stats() : null, queue: st.decoder ? st.decoder.queue() : null, decodeMs: st.decoder && st.decoder.stats.t1 ? st.decoder.stats.t1 - st.decoder.stats.t0 : null };
  },
  /** Start (true) or stop (false) the per-frame log; stopping returns it. */
  log(on = true) { if (on) { log = []; return true; } const l = log; log = null; return l; },
  /** The pixel drawn at panel CSS (x, y), read right after a fresh draw. */
  pixel(x, y) { if (!earth || !earth.supported || st.shown < 0) return null; earth.draw(view.uniforms(), st.shown, ground, glm(st.shown)); return earth.readPixel(x, y); },
  /** 'abs' | 'diff': the measure (plan 0012 3.3); resolves after the frame that drew it. */
  async measure(m) { setMeasure(m === 'abs'); await frameDone(); return M.abs ? 'abs' : 'diff'; },
  /** [first, last] year of a baseline, or null for GISS's 1951–1980. */
  async base(span) { setSpan(span); await frameDone(); return M.custom() ? M.span.slice() : null; },
  baseSheet: (on = true) => (on ? openBase() : closeBase(false)),
  /** The cell's number on the step on screen as the app holds it: tenths (a difference or a temperature). */
  value: (lon, lat) => { const c = cellOf(lon, lat); return cellValue(st.shown, c.row, c.col); },
  loseContext: () => earth && earth.loseContext(),
  restoreContext: () => earth && earth.restoreContext(),
  _: { st, view, MONTH },
};

boot().catch((e) => fail(`The app could not start: ${e && e.message ? e.message : e}.`));
