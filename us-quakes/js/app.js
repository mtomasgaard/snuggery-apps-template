// US Quakes: boot, the persisted state (uq.* keys), the dirty-flag frame scheduler, selection, the A–A′
// section's wiring, stories and their sequences, Play, the sheet's three heights, focus mode, the opening,
// arrivals and window.__uq (test hooks, inert unless called). DESIGN §5.6, §11, §22; data layouts are
// tools/CONTRACT.md's; the look and motion are ART.md's.

import { $, el, clamp, store, cssVar, sizeCanvas, lowerBound, reducedMotion, radios, mono, attrs, nums } from './util.js';
import { setUnits, utc, num, magText, depthKm, dist, yearOf, age, msOf, tenKm, rampLabel } from './units.js';
import { decodeGeo, loadJSON, loadHistory, fetchSnapshot, parseSnapshot, decodeSnapshot, join, textOf } from './data.js';
import { buildIndex, count, countNoMag, largest, perBox, inBox } from './events.js';
import { createMap, wx, wy } from './map.js';
import { createGL } from './gl.js';
import { drawBase, drawLines, strokeFault } from './base.js';
import { drawOverlay, volcanoStatus, tab } from './overlay.js';
import { drawLive, drawHist, hitLive, histGeom } from './strip.js';
import { liveWindow, histWindow, stepAt, playStep, PLAY_MS, T1600, T1900 } from './timeline.js';
import * as sheet from './sheet.js';
import { aboutPanel } from './about.js';
import { dotSize, rampBar, FLOORS } from './ramp.js';
import { sectionOf, drawCorridor, sectionRows, drawPlot } from './section.js';
import { storyCard, storyState, anchors, seqWindow, tabText } from './stories.js';
import { layersPanel, legendCard } from './layers.js';

const perf = { frames: [], load: {} }, T0 = performance.now();
const mark = (k) => { perf.load[k] = Math.round(performance.now() - T0); };
const oneOf = (...v) => (x) => v.includes(x);
const LAYERS = { relief: true, bathy: true, faults: true, volcanoes: true, states: true, labels: true };
const pt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const st = {
  mode: store.get('mode', 'live', oneOf('live', 'history')),
  liveWin: store.get('liveWindow', 'month', oneOf('day', 'week', 'month')),
  liveAll: store.get('liveAll', true, (v) => typeof v === 'boolean'),
  histWin: store.get('histWindow', 'year', oneOf('month', 'year', 'decade', 'all')),
  histAt: store.get('histAt', null, Number.isFinite),
  floor: store.get('floor', 60, oneOf(45, 60, 70, 80)),
  units: store.get('units', 'si', oneOf('si', 'us')),
  sheet: store.get('sheet', 'peek', oneOf('peek', 'half', 'full')),
  focus: store.get('focus', false, (v) => typeof v === 'boolean'),
  layers: store.get('layers', { ...LAYERS }, (v) => v && Object.keys(LAYERS).every((k) => typeof v[k] === 'boolean')),
  section: store.get('section', { on: false, a: null, b: null, hw: 50, ve: 1, hi: null },
    (v) => v && typeof v.on === 'boolean' && [25, 50, 100].includes(v.hw) && [1, 2, 5].includes(v.ve) && (v.a == null ? v.b == null : pt(v.a) && pt(v.b))),
};
setUnits(st.units);
const A = { st, C: null, I: null, G: null, about: null, stories: null, story: null, pick: null, dpr: Math.min(2, devicePixelRatio || 1),
  sel: null, list: null, vstat: volcanoStatus(null), snapErr: null, win: { label: '', t0: 0, t1: 0 } };

// the map and its five layers
const mapEl = $('map'), over = $('over');
const L2 = { base: $('base'), lines: $('lines'), over };
const rv = {};
let W = 1, H = 1, sL48 = 1500, chip = null, lastStatic = 0;
const M = createMap(over, {
  onView: () => req('gl', 'move'),
  onSettle: () => { if (sec.drag) { sec.drag = false; store.set('section', st.section); sec.key = ''; req('sheet'); } req('base', 'relief', 'lines', 'over', 'settle'); },
  onTap: (px, py, kbd) => (kbd && st.section.on && gl ? secKey(px, py) : tapAt(px, py)),
  onLong: (px, py) => pressAt(px, py),
  onLongEnd: () => pressEnd(),
  onDrag: (g, p) => secDrag(g, p),
});
const gl = createGL($('relief'), $('gl'), () => { notices.lost = true; req('notices'); },
  () => { notices.lost = !gl.live(); req('base', 'relief', 'lines', 'over', 'gl', 'notices'); });
// without WebGL 2 the panel draws no map at all, never half a map (DESIGN §3.2): no base, lines or overlay,
// no chips, legend or scale bar; the sentence and the credit line stay, and the sheet still lists
if (!gl) { $('nogl').hidden = false; over.style.pointerEvents = 'none'; for (const id of ['tools', 'chips', 'legend', 'scale']) $(id).hidden = true; }
const notices = { lost: false };

// the frame scheduler: dirty flags, one frame at most, idle otherwise
const dirty = new Set();
let raf = 0;
function req(...f) { for (const k of f) dirty.add(k); if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  const f0 = performance.now(), times = {};
  const time = (k, fn) => { const a = performance.now(); fn(); times[k] = +(performance.now() - a).toFixed(2); };
  if (M.tick(now)) dirty.add('move');
  if (intro.on) introTick(now);
  // arrivals redraw every frame until the fade ends, and once more at its end, so the pen reaches the feed
  const aT = arrT();
  if (aT < 1 || arr.lastT < 1) dirty.add('gl').add('timeline');
  arr.lastT = aT;
  const moving = M.moving || M.animating();
  if (dirty.has('gl') || dirty.has('move')) { time('gl', drawGL); play.shown = true; }
  const statics = ['base', 'relief', 'lines', 'over'].filter((k) => dirty.has(k));
  if (moving && now - lastStatic > 250 && lastStatic) statics.push('base', 'relief', 'lines', 'over');
  if (A.G && gl && statics.length) {
    lastStatic = now;
    if (statics.includes('base')) time('base', () => { drawBase(ctx('base'), A.G, M, st.layers); rv.base = { ...M.v }; });
    if (statics.includes('relief') && gl) time('relief', () => { gl.drawRelief(W, H, A.dpr, { ...M.v, on: st.layers.relief, dark: +cssVar('--relief-dark'), light: +cssVar('--relief-light') }); rv.relief = { ...M.v }; });
    if (statics.includes('lines')) time('lines', () => { drawLines(ctx('lines'), A.G, M, st.layers); rv.lines = { ...M.v }; });
    if (statics.includes('over')) time('over', () => { drawOverlay(ctx('over'), A.G, M, st.layers, { volcanoes: A.vstat, sel: selMark(), extra: overlayExtra, avoid: footRects(), pickV: A.pick && A.pick.v ? String(A.pick.v.vnum) : null }); rv.over = { ...M.v }; });
  }
  moveStatics();
  if (dirty.has('move') || dirty.has('settle')) scaleBar();
  if (dirty.has('settle') && A.G) { store.set('view', M.v); if (st.mode === 'history') dirty.add('sheet'); ariaMap(); }
  if (dirty.has('timeline')) time('strip', drawStrips);
  if (dirty.has('sheet')) time('sheet', renderSheet);
  if (dirty.has('notices')) renderNotices();
  dirty.clear();
  const fr = { t: Math.round(now), ms: +(performance.now() - f0).toFixed(2), ...times };
  if (perf.frames.push(fr) > 120) perf.frames.shift();
  if (A.perfOn) perfReadout();
  if (M.animating() || intro.on || arrT() < 1) req('move');
}
const ctx = (k) => { const c = L2[k].getContext('2d'); c.setTransform(A.dpr, 0, 0, A.dpr, 0, 0); return c; };
function moveStatics() {
  for (const k of ['base', 'relief', 'lines', 'over']) {
    const c = k === 'relief' ? $('relief') : L2[k], r = rv[k];
    if (!r) continue;
    const s = M.v.s / r.s, tx = W / 2 - s * W / 2 + (r.cx - M.v.cx) * M.v.s, ty = H / 2 - s * H / 2 + (r.cy - M.v.cy) * M.v.s;
    c.style.transform = Math.abs(s - 1) < 1e-9 && Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01 ? '' : `translate(${tx}px,${ty}px) scale(${s})`;
  }
}
const inkRGB = () => { const h = cssVar('--ink').replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const kz = () => clamp((M.v.s / sL48) ** 0.2, 1, 2);
function drawGL() {
  if (!gl) return;
  const F = A.F, a = arr.from != null && A.C && A.C.S;
  gl.drawPoints(W, H, A.dpr, { ...M.v, k: kz(), ink: inkRGB(), sec: sec.S,
    t0: F ? F.t0 : 0, t1: F ? (intro.on ? Math.max(F.t0 + 1, Math.min(F.t1, intro.cut)) : F.t1) : 0, floor: F ? F.floor : 255, noMag: F ? F.noMag : false,
    live: A.C ? A.C.liveFrom : 0xffffffff, trace0: play.trace0 == null ? 0xffffffff : play.trace0, fade: st.mode === 'history' && st.histWin === 'all' ? 0 : 1,
    newFrom: a ? arr.from : 0xffffffff, newT: arrT(), newSpan: a ? A.C.S.to - arr.from + 1 : 1 });
}

// state → the filter the map, strip and lists share
let firstYear = 1638;
function filter() {
  const C = A.C;
  if (!C) { A.F = null; return; }
  if (st.mode === 'live') {
    const w = C.S ? liveWindow(C.S.to, st.liveWin) : { t0: 0, t1: 0 }, k = ['day', 'week', 'month'].indexOf(st.liveWin);
    // "the past …" only while the copy is fresh; from 48 h the window is named against the feed's minute
    A.win = { ...w, label: C.S && sheet.staleText(A) ? `the ${['24 hours', '7 days', '30 days'][k]} to ${utc(C.S.to)}` : `the past ${['day', '7 days', '30 days'][k]}` };
    A.F = { t0: w.t0, t1: w.t1, floor: st.liveAll ? 0 : 45, noMag: false };
  } else {
    if (st.histAt == null || st.histAt > C.now) st.histAt = stepAt('year', C.now, 0);
    const q = play.seq;
    A.win = q ? { t0: q.t0, t1: q.t1, label: q.label } : histWindow(st.histWin, st.histAt, C.now, firstYear, play.slide);
    A.F = { t0: A.win.t0, t1: A.win.t1, floor: st.floor, noMag: A.win.t0 < T1900 };
  }
}
A.floorText = () => FLOORS.find((f) => f[1] === st.floor)[0];
A.largest = (k) => (A.I && A.F ? largest(A.I, A.F, k) : []);
A.perBox = () => perBox(A.I, A.F);
A.hollow = (i) => (A.C.f[i] & 3) === 1 && A.C.t[i] >= A.C.liveFrom;
A.set = (patch) => {
  const prevMode = st.mode;
  Object.assign(st, patch);
  if ('units' in patch) { setUnits(st.units); legendUnits(); }
  if (patch.mode && patch.mode !== prevMode) { stopPlay(); play.trace0 = null; A.list = null; A.story = null; }
  if ('liveWin' in patch || 'liveAll' in patch || 'mode' in patch) arr.until = 0;
  for (const k of ['mode', 'liveWin', 'liveAll', 'histWin', 'histAt', 'floor', 'units', 'sheet']) if (k in patch) store.set({ liveWin: 'liveWindow', histWin: 'histWindow' }[k] || k, st[k]);
  changed();
  if (st.focus && patch.mode) { $('live-head').hidden = st.mode !== 'live'; $('hist-head').hidden = st.mode === 'live'; layout(); }
};
function changed() {
  filter(); syncControls(); req('gl', 'timeline', 'sheet', 'over', 'settle');
  if (!$('layers').hidden) layersPanel(A, $('layers'));
  if (!$('about').hidden) aboutPanel(A, $('about'));
  const lc = $('legend-card');
  if (lc) { const d = legendCard(A); d.id = 'legend-card'; lc.replaceWith(d); }
}
// the compact legend's stops follow the units, as the section's axis does (0 · 22 · 186 mi)
function legendUnits() {
  $('legend').lastElementChild.textContent = rampLabel();
  $('legend').setAttribute('aria-label', `Reading the map: depth colors, 0 to ${dist(300)}`);
}

// selection (DESIGN §8)
function selMark() {
  if (A.pick && A.pick.v) return { lon: A.pick.v.lon, lat: A.pick.v.lat, diam: 10 };
  if (A.sel == null || !A.C) return null;
  const C = A.C, i = A.sel;
  return { lon: 172 + 0.002 * C.x[i], lat: 17 + 0.001 * C.y[i], diam: C.m[i] === 255 ? 6 : dotSize((C.m[i] - 20) / 10, kz()) };
}
function near(px, py, r = 22) {
  const [l0, a1] = M.toLonLat(px - r, py - r), [l1, a0] = M.toLonLat(px + r, py + r), out = [];
  inBox(A.I, A.F, l0, a0, l1, a1, (i) => {
    const [sx, sy] = M.toScreen(172 + 0.002 * A.C.x[i], 17 + 0.001 * A.C.y[i]), d = Math.hypot(sx - px, sy - py);
    if (d <= r) out.push([i, d]);
  });
  return out;
}
function tapAt(px, py) {
  if (!A.G || !A.I) return;
  let best = null, v = null, vd = 12;
  for (const [i, d] of near(px, py)) {
    if (!best || d < best[1] - 4 || (Math.abs(d - best[1]) <= 4 && A.C.m[i] !== 255 && (A.C.m[best[0]] === 255 || A.C.m[i] > A.C.m[best[0]]))) best = [i, d];
  }
  if (st.layers.volcanoes) for (const q of A.G.volcanoes) { const [sx, sy] = M.toScreen(q.lon, q.lat), d = Math.hypot(sx - px, sy - py); if (d <= vd && !(best && best[1] < d)) { vd = d; v = q; } }
  if (v) return pick({ v });
  if (best) return A.select(best[0], false);
  const [lon, lat] = M.toLonLat(px, py), f = st.layers.faults && sheet.nearestFault(A.G, lon, lat, (12 * 2 * Math.PI * 6371.0088 * Math.cos((lat * Math.PI) / 180)) / M.v.s);
  if (f) pick({ f: f.g }); else A.closeCard();
}
function pick(p) { A.pick = p; A.sel = null; A.list = null; toTop = 1; lift(); req('sheet', 'over', 'timeline'); }
// a long press lists at 500 ms but lifts the sheet only on release, so nothing slides under the held finger;
// the click that follows the release is swallowed (a press is never also a tap on what lies under it)
function pressAt(px, py) {
  if (!A.I) return;
  const rows = near(px, py).map((r) => r[0]).sort((a, b) => (A.C.m[b] === 255 ? -1 : A.C.m[b]) - (A.C.m[a] === 255 ? -1 : A.C.m[a]));
  if (!rows.length) return;
  A.list = rows; A.sel = null; A.pick = null; toTop = 1;
  req('sheet', 'over', 'timeline');
}
function pressEnd() {
  const t = performance.now(), swallow = (e) => { removeEventListener('click', swallow, true); if (performance.now() - t < 400) { e.stopPropagation(); e.preventDefault(); } };
  addEventListener('click', swallow, true);
  setTimeout(() => removeEventListener('click', swallow, true), 400);
  if (A.list) lift();
}
// fly: always move to it (a list row); still: neither lift the sheet nor move the view (a strip drag)
A.select = (i, fly, still) => {
  A.sel = i; A.list = null; A.pick = null; toTop = 1;
  req('timeline');
  if (still) { announceSel(i); req('sheet', 'over'); return; }
  lift();
  const [lon, lat] = sheet.lonLat(A.C, i), r = { ...M.visible() }, py = M.toScreen(lon, lat)[1];
  if (st.focus) r.y1 -= Math.min(260, 0.45 * H);
  if (fly || py > r.y1 - 24 || py < r.y0 + 8) {
    const s = fly ? Math.max(M.v.s, sL48 * 1.5) : M.v.s;
    if (fly) { chip = null; syncControls(); }
    M.flyTo({ s, cx: fly ? wx(lon) : M.v.cx, cy: wy(lat) - ((r.y0 + r.y1) / 2 - H / 2) / s }, 450);
  }
  announceSel(i);
  req('sheet', 'over');
};
function announceSel(i) {
  const C = A.C, km = depthKm(C.d[i]), tx = textOf(C, i);
  $('announce').textContent = `Magnitude ${magText(C.m[i]) || 'not given'}, ${utc(C.t[i], false)}, ${km == null ? 'no depth given' : `depth ${dist(km, 0)}`}${tx ? `, ${tx.place}` : ''}`;
}
A.closeCard = () => { A.sel = null; A.list = null; A.pick = null; req('sheet', 'over', 'timeline'); };

// the A–A′ section (DESIGN §9)
const sec = { S: null, D: null, el: null, key: '', ms: 0, drag: false, ends: null, kA: null };
function secGeom() { const q = st.section; sec.S = q.on && q.a ? Object.assign(sectionOf(q.a, q.b, q.hw), { ve: q.ve }) : null; }
A.secSet = (patch, save = true) => {
  st.section = { ...st.section, ...patch }; secGeom();
  if (save) { store.set('section', st.section); sec.key = ''; req('sheet'); }
  syncControls(); req('gl', 'over', 'notices');
};
A.toggleSection = () => { const on = !st.section.on; sec.kA = null; A.secSet(on ? { on } : { on, a: null, b: null, hi: null }); if (on && st.sheet === 'peek') setSheet('half'); ariaMap(); };
// the keyboard's way to draw one (Web Interface Guidelines): with the map focused and Section on, Enter
// places A at the map's center, the arrow keys move the map, and Enter again places A′ there
function secKey(px, py) {
  const ll = M.toLonLat(px, py);
  if (!sec.kA) { sec.kA = ll; $('announce').textContent = 'A placed at the center of the map. Move the map with the arrow keys, then press Enter to place A′.'; }
  else if (sectionOf(sec.kA, ll).len >= 1) { A.secSet({ a: sec.kA, b: ll, hi: null }); sec.kA = null; $('announce').textContent = `Section drawn, ${dist(sectionOf(st.section.a, st.section.b).len)} long.`; }
  req('over');
}
function secDrag(g, p) {
  if (!st.section.on || !A.G) return false;
  if (!g.sec) {
    const d = (q) => (q ? Math.hypot(q[0] - g.start[0], q[1] - g.start[1]) : 99);
    g.sec = sec.S && sec.ends && d(sec.ends[0]) <= 22 ? 'a' : sec.S && sec.ends && d(sec.ends[1]) <= 22 ? 'b' : 'n';
    g.a0 = M.toLonLat(...g.start);
  }
  const ll = M.toLonLat(p[0], p[1]), q = g.sec === 'a' ? { a: ll, b: st.section.b } : g.sec === 'b' ? { a: st.section.a, b: ll } : { a: g.a0, b: ll, hi: null };
  if (sectionOf(q.a, q.b).len < 1) return true;
  A.secSet(q, false); sec.drag = true; sec.kA = null;          // a drawn section ends a keyboard A still pending
  if (sec.cv && sec.cv.isConnected && sec.ms < 12) secDraw();
  return true;
}
const hiRow = () => { const id = st.section.hi, j = id && A.C ? A.C.ids.indexOf(id) : -1; return j < 0 ? null : A.C.textRows[j]; };
function secDraw() {
  const t = performance.now();
  sec.D = sectionRows(A, sec.S);
  sec.P = drawPlot(sec.cv, A, sec.S, sec.D, stripW(), hiRow());
  const D = sec.D;
  // code 1500 is the catalog's 10 km and nothing else (CONTRACT §1): "listed at 10 km" counts exactly those rows
  sec.cap.textContent = '';
  sec.cap.append(nums(`${num(D.n)} earthquakes within ±${dist(sec.S.half)} · ${A.win.label} · ${st.mode === 'live' && st.liveAll ? 'all sizes' : `M ${st.mode === 'live' ? 2.5 : A.floorText()}+`} · ${num(D.k10)} listed at ${tenKm()} · ${num(D.j)} without depth, not plotted`, true));
  sec.ms = performance.now() - t;
}
function secPanel() {
  const w = stripW(), k = JSON.stringify([st.section, A.F, A.win.label, st.units, w, cssVar('--bg')]);
  if (sec.el && sec.key === k) return sec.el;
  sec.key = k;
  const d = sec.el = el('div', 'sec'), q = st.section;
  const row = el('div', 'row3');
  row.append(radios('Corridor half-width', [25, 50, 100].map((v) => [v, `±${dist(v)}`]), q.hw, (hw) => A.secSet({ hw })),
    radios('Depth stretch', [[1, '1×'], [2, '2×'], [5, '5×']], q.ve, (ve) => A.secSet({ ve })));
  for (const b of row.querySelectorAll('button')) { const t = b.textContent; b.textContent = ''; b.append(nums(t)); }
  const pre = A.G ? A.G.sections : [], cur = pre.find((p) => pt(q.a) && p.a.join() === q.a.join() && p.b.join() === q.b.join());
  d.append(el('h2', null, 'Section A–A′'), row, radios('Presets', pre.map((p) => [p.key, p.label]), cur && cur.key, (key) => A.preset(key)));
  if (!sec.S) { d.append(el('p', 'note', 'Drag across the map to draw a section, or choose a preset.')); return d; }
  sec.cv = el('canvas', 'plot'); sec.cap = el('p', 'note');
  const fx = A.about && A.about.fields && A.about.fields.fixedDepth, key = el('p', 'quote');
  key.append(el('i', 'dash'), el('span', 'mono', tenKm()), fx && fx.more ? ` — USGS: “${fx.more.quote}”` : '');
  d.append(sec.cv, key, sec.cap);
  secDraw();
  attrs(sec.cv, { role: 'img', 'aria-label': `Cross-section, distance against depth at true scale: ${sec.cap.textContent}` });
  sec.cv.onclick = (e) => {
    const r = sec.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let b = null, bd = 12;
    for (const [i, px, py] of sec.P.pts) { const dd = Math.hypot(px - x, py - y); if (dd <= bd) { bd = dd; b = i; } }
    if (b != null) A.select(b, true);
  };
  return d;
}
A.preset = (key) => {
  const p = A.G.sections.find((s) => s.key === key);
  A.set({ mode: 'history', histWin: 'all', floor: 45 });
  A.secSet({ on: true, a: p.a, b: p.b, hi: p.highlight || null });
  lift();
  const r = M.visible(), vis = (ll) => { const [x, y] = M.toScreen(...ll); return x > 24 && x < W - 24 && y > r.y0 + 24 && y < r.y1 - 24; };
  if (!vis(p.a) || !vis(p.b)) M.flyTo(fit({ west: Math.min(p.a[0], p.b[0]) - 1.5, east: Math.max(p.a[0], p.b[0]) + 1.5, south: Math.min(p.a[1], p.b[1]) - 1, north: Math.max(p.a[1], p.b[1]) + 1 }), 450);
};

// stories (DESIGN §7.6)
A.openStory = (id) => {
  const s = A.stories && A.stories.stories.find((q) => q.id === id);
  if (!s) return;
  stopPlay(); play.trace0 = null;                     // a running Play or another story's sequence ends here
  A.set({ mode: 'history', ...storyState(s) });
  A.story = s; store.set('story', id);
  const an = anchors(A.C, s);
  A.sel = an.length ? an[0] : null; A.pick = null; A.list = null;
  lift();
  const v = A.G.views.find((q) => q.key === s.view);
  if (v) { chip = v.key; syncControls(); M.flyTo(fit(v), 600); }
  toTop = 1; req('sheet', 'over');
};
A.closeStory = () => { A.story = null; store.set('story', null); stopPlay(); req('sheet', 'over'); };
A.seqOn = (s = A.story) => !!(play.seq && play.seq.timer && play.seq.s === s);
A.playSeq = (s) => {
  if (A.seqOn(s)) { clearTimeout(play.seq.timer); play.seq.timer = 0; req('sheet'); return; }
  stopPlay(); play.trace0 = null;
  const q = play.seq = { s, k: 0, timer: 0 };
  play.shown = true;
  const tick = () => {
    if (!play.shown) { q.timer = setTimeout(tick, 40); return; }
    play.shown = false;
    Object.assign(q, seqWindow(s, ++q.k));
    q.timer = q.done ? 0 : setTimeout(tick, 300);
    filter(); req('gl', 'timeline', 'sheet', 'over');
  };
  tick();
};
function annotate(x) {
  const s = A.story, i = A.sel;
  if (!s || i == null || !A.I || !anchors(A.C, s).includes(i)) return;
  const [px, py] = M.toScreen(...sheet.lonLat(A.C, i)), r = M.visible();
  if (px < 0 || px > W || py < r.y0 || py > r.y1) return;
  const t = tabText(A.C, i), rad = selMark().diam / 2 + 4;
  x.font = mono(10.5);
  const w = x.measureText(t).width + 10;
  let q = [1, -1], best = 1e9;
  for (const [dx, dy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]]) {
    const [l0, a0] = M.toLonLat(Math.min(px, px + dx * 90), Math.max(py, py + dy * 90)), [l1, a1] = M.toLonLat(Math.max(px, px + dx * 90), Math.min(py, py + dy * 90));
    let n = 0; inBox(A.I, A.F, l0, a0, l1, a1, () => n++);
    const e = px + dx * (48 + w), off = e < 4 || e > W - 52 || py + dy * 36 < r.y0 + 12 || py + dy * 36 > r.y1 - 12;
    if (n + (off ? 1e6 : 0) < best) { best = n + (off ? 1e6 : 0); q = [dx, dy]; }
  }
  const tx = px + q[0] * 44 - (q[0] < 0 ? w : 0), ty = py + q[1] * 36 - 9;
  x.strokeStyle = cssVar('--ink'); x.lineWidth = 1; x.beginPath(); x.moveTo(px + q[0] * rad * 0.71, py + q[1] * rad * 0.71); x.lineTo(px + q[0] * 44, ty + 9); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'middle'; tab(x, tx, ty, w, 18, t);
}
function overlayExtra(x) {
  if (A.pick && A.pick.f != null) strokeFault(x, A.G, M, A.pick.f);
  sec.ends = sec.S ? drawCorridor(x, M, sec.S) : null;
  if (sec.kA && st.section.on) { const [px, py] = M.toScreen(...sec.kA); x.font = mono(11); x.textAlign = 'center'; x.textBaseline = 'middle'; tab(x, px - 8, py - 8, 16, 16, 'A'); }
  annotate(x);
}
// the foot's glass (scale bar, legend, credit line, notices), in map coordinates, for the labels to avoid
function footRects() {
  const m = mapEl.getBoundingClientRect(), out = [];
  for (const e of [$('scale'), $('legend'), $('credit'), ...$('notices').children]) {
    const r = e.getBoundingClientRect();
    if (r.width) out.push([r.left - m.left - 2, r.top - m.top - 2, r.right - m.left + 2, r.bottom - m.top + 2]);
  }
  return out;
}

// a region's fit: the box centered in the map that is free, above the foot's scale bar, legend and credit
// line, and clear of the key column at the top right only when the box would reach it (DESIGN §4.4)
function fit(b) {
  const r = M.visible(), m = mapEl.getBoundingClientRect(), fr = document.querySelector('.foot-row').getBoundingClientRect();
  const pad = { top: 8, right: 16, bottom: Math.max(12, $('foot').getBoundingClientRect().bottom - fr.top + 8), left: 16 };
  let v = M.fitView(b, pad);
  const k = $(st.focus ? 'focus-exit' : 'tools').getBoundingClientRect();
  if (k.height && (wy(b.north) - v.cy) * v.s + H / 2 < k.bottom - m.top + 8) v = M.fitView(b, { ...pad, right: 60 });
  return v;
}

// the view that puts lon/lat c at the free map's center at scale s
function centered(c, s) { const r = M.visible(); return { s, cx: wx(c[0]) - ((r.x0 + r.x1) / 2 - W / 2) / s, cy: wy(c[1]) - ((r.y0 + r.y1) / 2 - H / 2) / s }; }

// the sheet: three heights (DESIGN §3.3); in focus mode, the head's band only (§22)
const HEIGHTS = ['peek', 'half', 'full'];
let sab = 0, sat = 0, toTop = 0;
const wide = () => matchMedia('(min-width: 700px)').matches;
function sheetPx() {
  if (st.focus) return Math.ceil($('head').getBoundingClientRect().height) + 6;
  if (wide()) return 0;
  const full = innerHeight - $('top').getBoundingClientRect().height;
  return { peek: 152 + sab, half: Math.min(full, 400 + sab), full }[st.sheet];
}
function setSheet(h) { A.set({ sheet: h }); layout(); }
const lift = () => !st.focus && st.sheet === 'peek' && setSheet('half');
// when the map itself changes size (a rotation, the wide layout), the view follows the region: a marked
// chip is fitted again, and otherwise the place at the free map's center stays there at the same scale
function layout() {
  const r = mapEl.getBoundingClientRect(), sh = sheetPx(), W0 = W, H0 = H;
  const r0 = M.visible(), c = M.toLonLat((r0.x0 + r0.x1) / 2, (r0.y0 + r0.y1) / 2);
  document.documentElement.style.setProperty('--sheet-h', `${sh}px`);
  W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
  A.dpr = Math.min(2, devicePixelRatio || 1);
  for (const k of ['base', 'lines', 'over']) sizeCanvas(L2[k], W, H, A.dpr);
  M.resize(W, H, { top: st.focus ? sat + 4 : 42, right: 0, bottom: sh, key: st.focus ? [W - 52, 0, W, sat + 52] : null });
  if (A.G) sL48 = fit(A.G.views[0]).s;
  if (A.G && W0 > 1 && (W !== W0 || H !== H0)) {
    const v = chip && A.G.views.find((q) => q.key === chip);
    M.set(v ? fit(v) : centered(c, M.v.s));
  }
  $('grip').setAttribute('aria-label', `Sheet height: ${st.sheet}. Tap or use the arrow keys to change it.`);
  sec.key = '';
  req('base', 'relief', 'lines', 'over', 'gl', 'timeline', 'settle', 'sheet');
}
function gripInit() {
  const g = $('grip');
  let y0 = null;
  const step = (k) => setSheet(HEIGHTS[clamp(HEIGHTS.indexOf(st.sheet) + k, 0, 2)]);
  g.addEventListener('pointerdown', (e) => { y0 = e.clientY; g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointerup', (e) => {
    if (y0 == null) return;
    const dy = e.clientY - y0; y0 = null;
    if (Math.abs(dy) < 8) setSheet(HEIGHTS[(HEIGHTS.indexOf(st.sheet) + 1) % 3]);
    else step(-Math.round(dy / 44) || -Math.sign(dy));
  });
  g.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') step(1); else if (e.key === 'ArrowDown') step(-1);
    else if (e.key === 'Enter' || e.key === ' ') setSheet(HEIGHTS[(HEIGHTS.indexOf(st.sheet) + 1) % 3]); else return;
    e.preventDefault();
  });
}

// heads, bodies, strips
function arrival() {
  if (arr.from == null || Date.now() > arr.until || st.mode !== 'live' || !A.I) return null;
  const n = count(A.I, { ...A.F, t0: Math.max(A.F.t0, arr.from) });
  return n ? { n, since: arr.since } : null;
}
function renderSheet() {
  const live = st.mode === 'live', body = $('body');
  $('live-head').hidden = !live; $('hist-head').hidden = live;
  if (!A.C) return;
  const top = body.scrollTop;
  body.textContent = '';
  if (live) {
    sheet.stamp(A, $('stamp'));
    const big = A.largest(1);
    sheet.largestRow(A, $('largest'), big.length ? big[0] : -1, arrival());
  } else {
    const n = count(A.I, A.F);
    let v = 0;
    const r = M.visible(), [l0, a1] = M.toLonLat(r.x0, r.y0), [l1, a0] = M.toLonLat(r.x1, r.y1);
    inBox(A.I, A.F, l0, a0, l1, a1, (i) => { if (A.C.m[i] !== 255) v++; });
    const nx = countNoMag(A.I, A.F);
    sheet.histLabel(A, $('hlabel'), n, nx, v);
    A.counts = { n, noMag: nx, inView: v };
    attrs($('timeline'), { 'aria-valuemax': yearOf(A.C.now), 'aria-valuenow': yearOf(st.histAt),
      'aria-valuetext': `${A.win.label}, ${play.seq ? 'story sequence' : `${st.histWin} window`}, magnitude ${A.floorText()} and up, ${num(n)} earthquakes` });
    const all = st.histWin === 'all';
    attrs($('play'), { 'aria-disabled': all, 'aria-label': all ? 'Choose a month, year or decade to play' : play.timer ? 'Pause' : 'Play' });
    $('play-glyph').setAttribute('d', play.timer ? 'M12 10h3v12h-3zM17 10h3v12h-3z' : 'M13 10.5v11l9-5.5z');
  }
  $('fcard')?.remove();
  let to = body;
  if (st.focus) {
    if (A.list == null && A.pick == null && A.sel == null) return;
    to = el('div', 'fcard glass'); to.id = 'fcard'; $('foot').prepend(to);
  } else if (A.story) body.append(storyCard(A, A.story));
  if (A.list) sheet.pressList(A, to, A.list);
  else if (A.pick) to.append(A.pick.v ? sheet.volcanoCard(A, A.pick.v) : sheet.faultCard(A, A.pick.f));
  else if (A.sel != null) to.append(sheet.card(A, A.sel));
  if (st.focus) return;
  if (st.section.on && gl) body.append(secPanel());
  if (live) sheet.liveBody(A, body); else sheet.histBody(A, body);
  body.scrollTop = toTop ? 0 : top; toTop = 0;
}
function stripW() { return Math.max(100, Math.round($('head').getBoundingClientRect().width - 32)); }
function drawStrips() {
  if (!A.C) return;
  const w = stripW();
  if (st.mode === 'live') {
    const x = sizeCanvas($('strip-live'), w, 56, A.dpr);
    if (!A.C.S) { x.clearRect(0, 0, w, 56); return; }
    const pb = perBox(A.I, A.F), n = count(A.I, A.F), T = arrT();
    A.liveStrip = { C: A.C, t0: A.F.t0, t1: A.F.t1, floor: A.F.floor, win: st.liveWin, ageMs: Date.now() - A.C.S.gen, dpr: A.dpr,
      cut: intro.on ? intro.cut : T < 1 ? arr.from + T * (A.C.S.to - arr.from + 1) : null, cursor: intro.on,
      countText: intro.on ? 'The last 30 days, as recorded' : `${num(n)} earthquake${n === 1 ? '' : 's'}${st.liveAll ? '' : ' · M 2.5+'}${pb.hollow ? ` · ${num(pb.hollow)} hollow` : ''}`,
      sel: A.sel };
    const { big } = drawLive(x, w, A.liveStrip);
    $('strip-live').setAttribute('aria-label', `Record strip, ${A.win.label}: ${A.liveStrip.countText}${big >= 0 ? `, largest M ${magText(A.C.m[big])}, ${age(Date.now() - msOf(A.C.t[big]))} ago` : ''}`);
  } else {
    const x = sizeCanvas($('strip-hist'), w, 56, A.dpr);
    drawHist(x, w, { I: A.I, floorIx: [0, 45, 60, 70, 80].indexOf(st.floor), t0: A.F.t0, t1: A.F.t1, now: A.C.now,
      played: play.trace0 != null ? [play.trace0, A.F.t1] : null, gap: A.C.gap, stubCount: A.about ? A.about.numbers.before1900 : num(lowerBound(A.C.t, T1900)) });
  }
}
function scaleBar() {
  const [px, label] = M.scale();
  $('scale').firstElementChild.style.width = `${Math.round(px)}px`;
  $('scale').lastElementChild.textContent = label;
}
// the map's description lives on #over (role img, a leaf), never on <main>, whose controls must stay reachable
function ariaMap() {
  if (!A.G) return;
  const live = st.mode === 'live', n = A.I && A.F ? count(A.I, A.F) : 0;
  over.setAttribute('aria-label', `Map of ${chip ? A.G.views.find((v) => v.key === chip).label : 'the map'}, ${live ? 'Live' : 'History'}, ${A.win.label}, `
    + `${live && st.liveAll ? 'all sizes' : `magnitude ${live ? 2.5 : A.floorText()} and up`}, ${num(n)} earthquakes${!live && A.counts ? `, ${num(A.counts.inView)} in view` : ''}. `
    + (st.section.on ? 'Section: press Enter to place A at the center, move the map with the arrow keys, and press Enter again to place A′.' : 'Drag to pan, pinch to zoom, tap an earthquake.'));
}
function renderNotices() {
  const n = $('notices'); n.textContent = '';
  if (notices.lost) n.append(el('p', null, 'Restoring the map…'));
  if (st.section.on && !sec.S && gl) { const p = el('p'); p.append(el('span', 'mono', 'A—A′ '), 'Drag across the map to draw a section'); n.append(p); }
  const s = A.C && sheet.staleText(A);
  if (s) n.append(el('p', null, s));
}
function perfReadout() {
  const f = perf.frames.slice(-30), med = (k) => { const v = f.map((q) => q[k] || 0).sort((a, b) => a - b); return v[v.length >> 1].toFixed(1); };
  $('perf').textContent = `frame ${med('ms')} ms · map ${med('gl')} · base ${med('base')} · over ${med('over')}`;
}

// panels: Layers, the legend card, About
A.toggleLayers = (on = $('layers').hidden) => {
  $('layers').hidden = !on; attrs($('layers-btn'), { 'aria-expanded': on, 'aria-pressed': on });
  if (on) { layersPanel(A, $('layers')); $('layers').querySelector('.sw').focus(); }
};
A.setLayer = (k, v) => {
  st.layers[k] = v; store.set('layers', st.layers);
  if ((k === 'faults' && A.pick && A.pick.f != null) || (k === 'volcanoes' && A.pick && A.pick.v)) A.pick = null;
  layersPanel(A, $('layers')); $('layers').querySelector(`.sw:nth-of-type(${Object.keys(LAYERS).indexOf(k) + 1})`)?.focus();
  req('base', 'relief', 'lines', 'over', 'sheet');
};
function toggleLegend(on = !$('legend-card')) {
  const c = $('legend-card');
  if (c) c.remove();
  if (on) { const d = legendCard(A); d.id = 'legend-card'; $('foot').prepend(d); }
  $('legend').setAttribute('aria-expanded', String(on));
}
A.openAbout = (id) => {
  const b = $('about');
  aboutPanel(A, b); b.hidden = false; $('about-btn').setAttribute('aria-expanded', 'true');
  b.scrollTop = id ? $(id).offsetTop - 8 : 0; b.focus();
};
A.closeAbout = () => { $('about').hidden = true; $('about-btn').setAttribute('aria-expanded', 'false'); $('about-btn').focus(); };
A.togglePerf = () => { A.perfOn = !A.perfOn; $('perf').hidden = !A.perfOn; if (A.perfOn) perfReadout(); };

// focus mode (DESIGN §22): the map and the record strip alone; the credit line never leaves
const FOCUS_HIDE = ['top', 'chips', 'tools', 'legend', 'grip', 'body', 'live-win', 'largest'];
let fT = 0;
// kbd: the change came from the keyboard (or an assistive activation with no pointer): only then does focus
// move to the other key; after a pointer it stays where it was, so no ring is drawn round a key nobody
// reached by keys (DESIGN §22)
function setFocus(on, boot, kbd = true) {
  clearTimeout(fT);
  const els = FOCUS_HIDE.map($), fx = (k) => { for (const e of els) e.classList.toggle('fx', k); };
  if (on && !gl) { st.focus = false; return; }
  if (on === st.focus && !boot) { if (!on) fx(false); return; }
  const rm = boot || reducedMotion();
  const apply = () => {
    const r0 = M.visible(), c = M.toLonLat((r0.x0 + r0.x1) / 2, (r0.y0 + r0.y1) / 2), s = M.v.s;
    st.focus = on; store.set('focus', on);
    for (const e of els) { e.hidden = on; e.inert = on; }
    $('app').classList.toggle('focus', on); $('focus-exit').hidden = !on;
    layout(); req('sheet');
    if (A.G) M.flyTo(chip ? fit(A.G.views.find((q) => q.key === chip)) : centered(c, s), rm ? 0 : 240);
  };
  if (on) {
    endIntro(); A.toggleLayers(false); toggleLegend(false); if (!$('about').hidden) A.closeAbout();
    fx(true);
    const done = () => { apply(); if (!boot && kbd) $('focus-exit').focus(); };
    if (rm) done(); else fT = setTimeout(done, 160);
  } else {
    apply(); if (kbd) $('focus-btn').focus();
    if (rm) fx(false); else requestAnimationFrame(() => requestAnimationFrame(() => fx(false)));
  }
}
A.setFocus = setFocus;

// controls
function seg(id, key, get) {
  $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const raw = b.dataset.v, v = get ? get(raw) : raw;
    if (key === 'histWin' || key === 'floor') { stopPlay(); play.trace0 = null; }
    A.set({ [key]: v });
  });
}
function syncControls() {
  const on = (id, v) => { for (const b of $(id).children) b.setAttribute('aria-checked', String(b.dataset.v === String(v))); };
  on('mode', st.mode); on('live-win', st.liveWin); on('hist-win', st.histWin); on('floor', st.floor);
  for (const b of $('chips').children) b.setAttribute('aria-pressed', String(b.dataset.v === chip));
  $('section-btn').setAttribute('aria-pressed', String(st.section.on));
}
function buildControls() {
  for (const [M2, code] of FLOORS) {
    const b = attrs(el('button'), { role: 'radio', 'aria-label': `Magnitude ${M2} and up` }); b.dataset.v = code;
    const d = el('i'), s = dotSize(M2); d.style.width = d.style.height = `${s}px`;
    b.append(d, `${M2}+`); $('floor').append(b);
  }
  seg('mode', 'mode'); seg('live-win', 'liveWin'); seg('hist-win', 'histWin'); seg('floor', 'floor', Number);
  $('about-btn').onclick = () => ($('about').hidden ? A.openAbout() : A.closeAbout());
  $('credit').onclick = () => A.openAbout('about-sources');
  $('legend').onclick = () => toggleLegend();
  $('layers-btn').onclick = () => A.toggleLayers();
  $('section-btn').onclick = () => A.toggleSection();
  // a click with no pointerdown on the key just before it (Enter, Space, an assistive activation) counts as keys
  let ptrAt = -1e9;
  for (const id of ['focus-btn', 'focus-exit']) $(id).addEventListener('pointerdown', (e) => { ptrAt = e.timeStamp; });
  const byKey = (e) => e.detail === 0 || e.timeStamp - ptrAt > 1000;
  $('focus-btn').onclick = (e) => setFocus(true, false, byKey(e));
  $('focus-exit').onclick = (e) => setFocus(false, false, byKey(e));
  // the foot slides with the sheet (240 ms): the labels are placed again against where it ends
  $('foot').addEventListener('transitionend', (e) => { if (e.target === e.currentTarget) req('over'); });
  const lr = $('legend-ramp'), lx = sizeCanvas(lr, 112, 6, A.dpr); rampBar(lx, 0, 0, 112, 6);
  // the Live strip: a touch or drag moves the selection along the stems without lifting the sheet or moving
  // the map, so the strip stays under the finger; on release the sheet lifts and, only if the event is off
  // the free map, the view flies to it once
  const sl = $('strip-live');
  let down = false;
  const hit = (e) => { if (!A.liveStrip) return; const r = sl.getBoundingClientRect(), i = hitLive(e.clientX - r.left, r.width, A.liveStrip); if (i >= 0 && i !== A.sel) A.select(i, false, true); };
  sl.addEventListener('pointerdown', (e) => { down = true; sl.setPointerCapture(e.pointerId); hit(e); });
  sl.addEventListener('pointermove', (e) => { if (down) hit(e); });
  const release = () => {
    if (!down) return;
    down = false;
    if (A.sel == null) return;
    const [x, y] = M.toScreen(...sheet.lonLat(A.C, A.sel)), r = M.visible();
    if (x < 8 || x > W - 8 || y < r.y0 + 8 || y > r.y1 - 24) A.select(A.sel, true); else { lift(); req('sheet'); }
  };
  sl.addEventListener('pointerup', release);
  sl.addEventListener('pointercancel', release);
  const tl = $('timeline');
  let tdown = false;
  const moveTo = (e) => {
    const r = tl.getBoundingClientRect(), g = histGeom(r.width, A.C.now);
    A.set({ histAt: clamp(Math.round(g.T(e.clientX - r.left)), T1600, A.C.now) });
  };
  tl.addEventListener('pointerdown', (e) => { if (!A.C) return; tdown = true; tl.setPointerCapture(e.pointerId); stopPlay(); play.trace0 = null; moveTo(e); });
  tl.addEventListener('pointermove', (e) => { if (tdown) moveTo(e); });
  tl.addEventListener('pointerup', () => { tdown = false; });
  tl.addEventListener('keydown', (e) => {
    if (!A.C) return;
    const k = { ArrowLeft: -1, ArrowRight: 1, PageUp: 10, PageDown: -10 }[e.key];
    let at = st.histAt;
    if (k) at = stepAt(st.histWin === 'all' ? 'year' : st.histWin, at, k);
    else if (e.key === 'Home') at = T1600; else if (e.key === 'End') at = A.C.now; else return;
    e.preventDefault(); stopPlay(); play.trace0 = null;
    A.set({ histAt: clamp(at, T1600, A.C.now) });
  });
  $('play').onclick = () => (play.timer ? stopPlay() : startPlay());
  over.addEventListener('pointerdown', () => { if (chip) { chip = null; syncControls(); } if (!$('layers').hidden) A.toggleLayers(false); if ($('legend-card')) toggleLegend(false); }, true);
  for (const t of ['pointerdown', 'keydown']) addEventListener(t, () => endIntro(), true);
  // Escape closes the innermost thing: a panel, then a keyboard A still waiting for its A′, then focus mode
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('about').hidden) A.closeAbout(); else if (!$('layers').hidden) { A.toggleLayers(false); $('layers-btn').focus(); } else if ($('legend-card')) { toggleLegend(false); $('legend').focus(); }
    else if (sec.kA) { sec.kA = null; $('announce').textContent = 'A cleared.'; req('over'); } else if (st.focus) setFocus(false);
  });
  gripInit();
}
function buildChips() {
  for (const v of A.G.views) {
    const b = el('button', null, v.label); b.dataset.v = v.key; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => { chip = v.key; syncControls(); M.flyTo(fit(v), 450); };
    $('chips').append(b);
  }
}

// Play (DESIGN §7.5)
const play = { timer: 0, trace0: null, slide: null, seq: null, shown: true };
function startPlay() {
  if (!A.C || st.mode !== 'history' || st.histWin === 'all') return;
  if (play.seq) { stopPlay(); }
  if (A.F.t1 > A.C.now) { st.histAt = T1900; play.slide = null; filter(); }
  play.trace0 = A.F.t0; play.shown = true;
  // a step waits until the last one has been drawn, so a slow frame never skips a year on screen
  const tick = () => {
    if (!play.shown) { play.timer = setTimeout(tick, 40); return; }
    if (A.F.t1 > A.C.now) { stopPlay(); return; }
    const ns = playStep(st.histWin, st.histAt, play.slide, A.C.now);
    if (!ns) { stopPlay(); return; }
    play.slide = ns.slide; play.shown = false;
    A.set({ histAt: ns.at });
    play.timer = setTimeout(tick, PLAY_MS[st.histWin]);
  };
  play.timer = setTimeout(tick, PLAY_MS[st.histWin]);
  req('sheet', 'timeline');
}
function stopPlay() {
  if (play.timer) clearTimeout(play.timer);
  play.timer = 0;
  if (play.seq) { clearTimeout(play.seq.timer); play.seq = null; filter(); }
  if (play.slide != null) { play.slide = null; filter(); }
  req('sheet', 'timeline', 'gl');
}
function pauseAll() {
  if (play.timer) stopPlay();
  if (play.seq) { clearTimeout(play.seq.timer); play.seq.timer = 0; req('sheet'); }
  endIntro(); M.stop(); arr.t0 = -1e9;
}

// the opening, once (ART.md "Signature moments" 1)
const intro = { on: false, t0: 0, cut: 0 };
function startIntro() {
  if (st.focus || store.get('intro', false) || reducedMotion() || !A.C.S || A.snapErr || document.hidden || !gl) return;
  store.set('intro', true);
  Object.assign(st, { mode: 'live', liveWin: 'month', liveAll: true }); filter();
  chip = null; syncControls();
  M.flyTo(fit({ west: 172, south: 17, east: 296, north: 72 }), 0);
  Object.assign(intro, { on: true, t0: performance.now(), cut: A.F.t0 });
  req('gl', 'timeline', 'sheet');
}
function introTick(now) {
  const k = (now - intro.t0) / 3000;
  intro.cut = A.F.t0 + k * (A.F.t1 - A.F.t0);
  if (k >= 1) { intro.on = false; chip = A.G.views[0].key; syncControls(); M.flyTo(fit(A.G.views[0]), 600); req('sheet'); }
  dirty.add('gl').add('timeline');
}
function endIntro() {
  if (!intro.on) return;
  intro.on = false; chip = A.G.views[0].key; syncControls();
  M.flyTo(fit(A.G.views[0]), 0);
  req('gl', 'timeline', 'sheet');
}

// arrivals: rows after the last feed seen fade in over 600 ms (ART.md "The live feed")
const arr = { from: null, since: 0, t0: -1e9, until: 0, lastT: 1 };
const arrT = () => (arr.from == null || reducedMotion() ? 1 : clamp((performance.now() - arr.t0) / 600, 0, 1));

// loading (DESIGN §11.1)
async function loadRelief(meta) {
  if (!gl) return;
  const list = await Promise.all(meta.map(async (m) => {
    const r = await fetch(`assets/${m.file}`);
    if (!r.ok) throw new Error(`assets/${m.file}: HTTP ${r.status}`);
    return { blob: await r.blob(), meta: m };
  }));
  await gl.setRelief(list);
  mark('relief'); req('relief');
}
let snapText = null;
async function loadSnapshotInto(H, text) {
  let S = null;
  A.snapErr = null;
  if (text != null) {
    try { S = await decodeSnapshot(parseSnapshot(text)); } catch (e) { A.snapErr = e.message; }
  }
  const keep = A.sel != null ? keyOf(A.sel) : null, prevTo = A.C && A.C.S ? A.C.S.to : store.get('feedTo', null, Number.isFinite);
  A.C = join(H, S);
  A.I = buildIndex(A.C, H.boxes);
  A.vstat = volcanoStatus(S);
  if (gl) gl.setData(A.C, A.I);
  A.sel = keep ? findKey(keep) : null;
  A.list = null;
  if (S) {
    store.set('feedTo', S.to);
    if (prevTo != null && S.to > prevTo) {
      Object.assign(arr, { from: prevTo + 1, since: prevTo, t0: performance.now(), until: Date.now() + 600000 });
      setTimeout(() => req('sheet'), 600050);
    }
  }
  mark('indexed');
  sec.key = '';
  changed(); req('notices');
}
const keyOf = (i) => { const t = textOf(A.C, i); return t ? { id: t.id } : { t: A.C.t[i], x: A.C.x[i], y: A.C.y[i] }; };
function findKey(k) {
  const C = A.C;
  if (k.id) { const j = C.ids.indexOf(k.id); return j < 0 ? null : C.textRows[j]; }
  for (let i = lowerBound(C.t, k.t); i < C.n && C.t[i] === k.t; i++) if (C.x[i] === k.x && C.y[i] === k.y) return i;
  return null;
}
async function refreshSnapshot() {
  if (!A.C) return;
  let text;
  try { text = await fetchSnapshot(); } catch (e) { A.snapErr = e.message; req('sheet'); return; }
  if (text === snapText) { req('sheet', 'timeline', 'notices'); return; }
  snapText = text;
  await loadSnapshotInto(A.C.H, text);
}

async function boot() {
  buildControls(); syncControls(); secGeom(); legendUnits();
  const env = (k) => { const p = el('div'); p.style.cssText = `position:absolute;height:env(safe-area-inset-${k})`; document.body.append(p); const h = p.getBoundingClientRect().height; p.remove(); return h; };
  sab = env('bottom'); sat = env('top');
  if (st.focus) { st.focus = false; setFocus(true, true); }
  new ResizeObserver(() => layout()).observe(mapEl);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { rampBar(sizeCanvas($('legend-ramp'), 112, 6, A.dpr), 0, 0, 112, 6); sec.key = ''; req('base', 'relief', 'lines', 'over', 'gl', 'timeline', 'sheet'); });
  layout();
  const aboutP = loadJSON('assets/about.json').then((a) => { A.about = a; req('sheet', 'timeline'); }).catch(() => {});
  const storiesP = loadJSON('assets/stories.json').then((s) => { A.stories = s; req('sheet'); }).catch(() => {});
  try {
    const geo = await loadJSON('assets/geo.json');
    A.G = decodeGeo(geo); mark('geo');
    M.setBounds(A.G.basemap);
    buildChips();
    sL48 = fit(A.G.views[0]).s;
    const saved = store.get('view', null, (v) => v && [v.cx, v.cy, v.s].every(Number.isFinite));
    M.set(saved || fit(A.G.views[0]));
    if (!saved) chip = 'lower-48';
    syncControls();
    req('base', 'lines', 'over', 'settle');
    loadRelief(A.G.relief).catch((e) => { perf.load.reliefError = e.message; });
  } catch (e) { $('loading').textContent = `The map could not be drawn: ${e.message}`; }
  try {
    const [H, text] = await Promise.all([loadHistory(), fetchSnapshot().catch((e) => { A.snapErr = e.message; return null; })]);
    mark('history');
    firstYear = H.meta.first.slice(0, 4);
    snapText = text;
    await loadSnapshotInto(H, text);
    await Promise.all([aboutP, storiesP]);
    const sid = store.get('story', null);
    if (sid && st.mode === 'history' && A.stories) A.story = A.stories.stories.find((s) => s.id === sid) || null;
    mark('ready');
    startIntro();
  } catch (e) { $('body').textContent = ''; $('body').append(el('p', 'warn', `The catalog could not be read: ${e.message}`)); }
  document.fonts.ready.then(() => req('over', 'timeline', 'sheet'));
  document.fonts.addEventListener('loadingdone', () => req('over', 'timeline'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(); else refreshSnapshot(); });
}
boot();

// window.__uq: test hooks, inert unless called (DESIGN §16)
const settled = () => new Promise((res) => { const f = () => (raf || M.animating() || dirty.size || intro.on ? requestAnimationFrame(f) : res(true)); requestAnimationFrame(f); });
window.__uq = {
  ready: () => !!(A.C && A.G && perf.load.ready != null),
  settled,
  goto(o = {}) {
    stopPlay(); play.trace0 = null; endIntro();
    const patch = {};
    if (o.mode) patch.mode = o.mode;
    if (o.window) patch[o.mode === 'live' || (!o.mode && st.mode === 'live') ? 'liveWin' : 'histWin'] = o.window;
    if (o.floor != null) patch.floor = FLOORS.find((f) => f[0] === o.floor)[1];
    if (o.liveAll != null) patch.liveAll = o.liveAll;
    if (o.at != null) patch.histAt = Math.min(A.C.now, Math.round((Date.parse(o.at) - Date.UTC(1600, 0, 1)) / 60000));
    if (o.sheet) patch.sheet = o.sheet;
    A.sel = null; A.list = null; A.pick = null; A.story = null;
    A.set(patch);
    if (o.sheet) layout();
    if (o.view) { const v = A.G.views.find((x) => x.key === o.view); chip = v ? v.key : null; M.flyTo(v ? fit(v) : o.view, 0); syncControls(); }
    return settled();
  },
  state: () => ({ ...st, win: A.win, count: A.I && A.F ? count(A.I, A.F) : null, counts: A.counts, chip, view: M.v, drawn: gl && gl.last, playing: !!play.timer,
    seq: play.seq && { ...play.seq, s: 0 }, story: A.story && A.story.id, sel: A.sel, n: A.C && A.C.n, gap: A.C && A.C.gap, snapErr: A.snapErr, lost: notices.lost, arrival: arrival(), intro, W, H }),
  _: { A, M, sec, play, perf, gl, tapAt, pressAt, startPlay, stopPlay, endIntro, refreshSnapshot, req, secDraw, hitLive },
};
