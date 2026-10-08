// Drive Global Wind in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch), light and
// dark: Global Weather's tools/shoot.mjs, copied by hand and changed for one field and schema 1. Fails on
// any console error or warning, page error, failed request, HTTP ≥ 400, or any request outside the local
// server. Every figure it asserts is worked out here from the shipped files with Node's own zlib and
// formulas written in this file (the decode, the sampler, the kernel's expected bearing and distance,
// both projections, the sun, the Beaufort words, the number formats), never by importing js/, so a bug
// in the app cannot agree with itself.
//
// FRAME TIMES ARE HEADLESS CHROMIUM ON THIS MAC (CPU raster): a trend only, never phone evidence. The
// phone's frame rate, battery and memory are the owner's check.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs        one theme for the per-theme scenes (SCHEMES=none: only the once-scenes)
//   SCRUB=0 node tools/shoot.mjs              skip the three-speed scrub (about 70 s)
//   SCREENSHOTS=1 node tools/shoot.mjs        also copy the scenes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the stamp's "Updated", the credits in About and not on the front, the camera's controls by role and name, the
// face loaded), the flow (on by default, moving, the pair alternating, the exposure line), text contrast
// and the selection tracer, direction and speed end to end at the twelve ask cities on the map and the
// globe, the streak heads' contrast with the speed colors on and off, by day and at night, the readout
// (speed, direction and Beaufort) against this file's own decode with the flow on and off, SI in every
// visible text node, the units cycle, and the pictures. Once: the real-touch scrub at 2, 8 and 20 steps
// a second on the map and the globe, play, the frame-time readout, the plate never resizing with the
// caption, the readout card keeping clear of the tapped place and the place names under a card just
// opened, VoiceOver, a map pan carrying the trails, a globe drag clearing them, focus mode and the
// camera's way out of it, the Speed colors key, a library left by Global Wind 1.0, the whole-world
// map's bottom edge, hidden, Reduce Motion, the broken / missing / stale snapshots and a replacement
// while open, widths 320, 360, 375, 844 × 390 and 125 % zoom, and hit targets.
// Plan 0012 3.6: the credits are About's (none on the front), the stamp is one line in every state it
// can write, and the deeper zoom (120 px a degree, the rung over Lofoten, the globe's fine land against
// world.json's own rings at the deepest radius; deepest-*.png are kept in tools/.work/shots/ only).
// Pictures: tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png — never
// screenshots/app.png, the README's composite, which this script must not touch.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); } catch (e) {
  console.error(`Playwright could not be loaded (${e.code || e.message}): set PLAYWRIGHT_MODULE to a playwright/index.mjs.`); process.exit(4);
}
const chromium = pw.chromium || pw.default.chromium;
const OUT = path.join(APP, 'tools', '.work', 'shots');
const SHOTS = path.join(APP, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const KEEP = process.env.SCREENSHOTS === '1';
const schemes = (process.env.SCHEMES || 'light,dark').split(',').filter((s) => s === 'light' || s === 'dark');
const appPng = path.join(SHOTS, 'app.png');
const appPngHash = fs.existsSync(appPng) ? crypto.createHash('sha256').update(fs.readFileSync(appPng)).digest('hex') : null;

/* ── the data, decoded here ── */
const SNAP_TEXT = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
const snap = JSON.parse(SNAP_TEXT);
const G = snap.grid, NX = G.nx, NY = G.ny, N = NX * NY, STEPS = snap.steps.length, D = Math.PI / 180, R = 6371008.8;
const E = snap.encoding;
const UV = [];
{
  let prevS = null, prevD = null;
  for (const st of snap.steps) {
    const S = zlib.inflateSync(Buffer.from(st.speed, 'base64')), Dd = zlib.inflateSync(Buffer.from(st.dir, 'base64'));
    if (prevS) for (let i = 0; i < N; i++) { S[i] = (S[i] + prevS[i]) & 255; Dd[i] = (Dd[i] + prevD[i]) & 255; }
    prevS = S; prevD = Dd;
    const u = new Float64Array(N), v = new Float64Array(N);
    for (let i = 0; i < N; i++) { const s = E.speedStep * S[i], a = E.dirStep * Dd[i] * D; u[i] = -s * Math.sin(a); v[i] = -s * Math.cos(a); }
    UV.push({ u, v });
  }
}
const VALID = snap.steps.map((s) => Date.parse(s.validTime)), HOURS = snap.steps.map((s) => s.hours);
function bil(arr, lon, lat) {
  let fi = (lon - G.lon0) / G.dlon; fi -= Math.floor(fi / NX) * NX;
  const fj = Math.max(0, Math.min(NY - 1, (lat - G.lat0) / G.dlat));
  const i0 = Math.min(NX - 1, Math.floor(fi)), j0 = Math.floor(fj), i1 = (i0 + 1) % NX, j1 = Math.min(j0 + 1, NY - 1), tx = fi - i0, ty = fj - j0;
  const top = arr[j0 * NX + i0] + (arr[j0 * NX + i1] - arr[j0 * NX + i0]) * tx, bot = arr[j1 * NX + i0] + (arr[j1 * NX + i1] - arr[j1 * NX + i0]) * tx;
  return top + (bot - top) * ty;
}
const CITIES = new Map([...fs.readFileSync(path.join(APP, '..', 'scripts', 'global_wind.py'), 'utf8')
  .matchAll(/\("([^"]+)",\s*"[^"]+",\s*(-?[\d.]+),\s*(-?[\d.]+),/g)].map((m) => [m[1], [+m[2], +m[3]]]));

/* ── formats, written here again (DESIGN §4) ── */
const NN = ' ', MINUS = '−';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');
const labelAt = (ms) => { const d = new Date(ms); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONS[d.getMonth()]}, ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const msAt = (tt) => { const k0 = Math.max(0, Math.min(STEPS - 1, Math.floor(tt))), k1 = Math.min(k0 + 1, STEPS - 1), f = Math.max(0, Math.min(1, tt - k0)); return VALID[k0] + (VALID[k1] - VALID[k0]) * f; };
function num(v, d) {
  const s = Math.abs(v).toFixed(d), [i, f] = s.split('.'), neg = v < 0 && Number(s) !== 0;
  const g = i.length > 3 ? i.replace(/\B(?=(\d{3})+$)/g, NN) : i;
  return (neg ? MINUS : '') + g + (f ? `.${f}` : '');
}
/* The readout's words, written here again: the 16 points of the compass and the Beaufort bands (the ones
 * scripts/global_wind.py writes into the ask table). */
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const BFT = [[0.3, 'calm'], [1.6, 'light air'], [3.4, 'light breeze'], [5.5, 'gentle breeze'], [8, 'moderate breeze'], [10.8, 'fresh breeze'],
  [13.9, 'strong breeze'], [17.2, 'near gale'], [20.8, 'gale'], [24.5, 'strong gale'], [28.5, 'storm'], [32.7, 'violent storm'], [Infinity, 'hurricane force']];
function words(u, v) {
  const s = Math.hypot(u, v), from = (Math.atan2(-u, -v) / D + 360) % 360;
  let b = 0; while (b < BFT.length - 1 && s >= BFT[b][0]) b++;
  return `${s < 0.5 ? 'No direction' : `From ${COMPASS[Math.round(from / 22.5) % 16]} (${Math.round(from) % 360}°)`}, ${BFT[b][1]}, Beaufort ${b}`;
}

/* ── projections and the sun, written here again ── */
const merc = (lon, lat, m) => {
  let dx = (lon + 180) / 360 - m.cx; dx -= Math.round(dx);
  const y = 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * D) / 2)) / (2 * Math.PI);
  return [dx * m.scale + m.W / 2, (y - m.cy) * m.scale + m.H / 2];
};
const ortho = (lon, lat, g, W, H) => {
  const c = Math.cos(lat * D), d = (lon - g.lon) * D;
  return [W / 2 + g.r * c * Math.sin(d), H / 2 - g.r * (Math.cos(g.lat * D) * Math.sin(lat * D) - Math.sin(g.lat * D) * c * Math.cos(d)),
    Math.sin(g.lat * D) * Math.sin(lat * D) + Math.cos(g.lat * D) * c * Math.cos(d)];
};
const dist = ([l1, p1], [l2, p2]) => { const h = Math.sin((p2 - p1) * D / 2) ** 2 + Math.cos(p1 * D) * Math.cos(p2 * D) * Math.sin((l2 - l1) * D / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); };
const bearing = ([l1, p1], [l2, p2]) => { const dl = (l2 - l1) * D; return (Math.atan2(Math.sin(dl) * Math.cos(p2 * D), Math.cos(p1 * D) * Math.sin(p2 * D) - Math.sin(p1 * D) * Math.cos(p2 * D) * Math.cos(dl)) / D + 360) % 360; };
const wrap180 = (a) => ((a % 360) + 540) % 360 - 180;
/** The low-precision solar position (the Astronomical Almanac's), and the cosine of the zenith angle. */
function cosZenith(ms, lon, lat) {
  const n = ms / 86400000 - 10957.5, L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * D;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D, eps = (23.439 - 0.0000004 * n) * D;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / D;
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24, slon = (ra - gmst * 15) * D;
  return Math.sin(lat * D) * Math.sin(dec) + Math.cos(lat * D) * Math.cos(dec) * Math.cos(lon * D - slon);
}
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const pctl = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

/* ── the server: the app folder, with a replaceable data/snapshot.json ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.md': 'text/markdown' };
let snapOverride = null;                                   // { status } or { body }
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/data/snapshot.json' && snapOverride) {
    if (snapOverride.status) { res.writeHead(snapOverride.status); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(snapOverride.body); return;
  }
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
console.log(`headless Chromium ${browser.version()} — every frame time below is this browser's CPU raster on this Mac: a trend, not phone evidence`);

// The one message tolerated: Chromium's advice when THIS SCRIPT reads a canvas back (getImageData) more
// than once. The app itself never reads a canvas back.
const NOISE = /Multiple readback operations using getImageData/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  if (o.init) await ctx.addInitScript(o.init);
  const page = await ctx.newPage(), errors = [];
  const excused = (t) => NOISE.test(t) || (o.expect && o.expect.test(t));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(origin)) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${r.url().slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  if (!o.noWait) await page.waitForFunction(() => window.__gw && window.__gw.ready(), null, { timeout: 60000 });
  const ms = Date.now() - t0;
  const w = (fn, arg) => page.evaluate(fn, arg);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tapAt = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd'); };
  const tapEl = async (sel) => { const r = await w((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel); await tapAt(r.left + r.width / 2, r.top + r.height / 2); };
  const shot = async (name, keep = true) => {
    await page.waitForTimeout(200);
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    if (keep && KEEP) { if (`${name}.png` === 'app.png') throw new Error('never screenshots/app.png'); fs.copyFileSync(p, path.join(SHOTS, `${name}.png`)); }
    console.log(`      ${name}.png${keep && KEEP ? ' → screenshots/' : ''}`);
  };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, tapEl, shot };
}
const S = (w) => w(() => window.__gw.state);
const FS = (w) => w(() => window.__gw.flow.state());
const settle = (page, ms = 300) => page.waitForTimeout(ms);
/* plan 0012 3.6: land or sea at a point by world.json's own rings (even-odd, as the app fills them), and how
 * far the point is from a coast in px on a globe of radius r, so cells within 2 px of a coast are not judged. */
const WORLD = JSON.parse(fs.readFileSync(path.join(APP, 'assets/world.json'), 'utf8')).land.flat().map((enc) => {
  const p = []; let x = 0, y = 0; for (let i = 0; i < enc.length; i += 2) { x += enc[i]; y += enc[i + 1]; p.push([x / 100, y / 100]); }
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x1, y1] of p) { b[0] = Math.min(b[0], x1); b[1] = Math.min(b[1], y1); b[2] = Math.max(b[2], x1); b[3] = Math.max(b[3], y1); }
  return { p, b };
});
function landAgreement(cells, r) {
  let n = 0, bad = 0, near = 0;
  for (const c of cells) {
    let inside = false, dmin = Infinity;
    const k = Math.cos(c.lat * D);
    for (const ring of WORLD) {
      if (c.lon < ring.b[0] - 0.2 || c.lon > ring.b[2] + 0.2 || c.lat < ring.b[1] - 0.2 || c.lat > ring.b[3] + 0.2) continue;
      const q = ring.p;
      for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
        const [xi, yi] = q[i], [xj, yj] = q[j];
        if ((yi > c.lat) !== (yj > c.lat) && c.lon < (xj - xi) * (c.lat - yi) / (yj - yi) + xi) inside = !inside;
        const ax = (xj - xi) * k, ay = yj - yi, px = (c.lon - xi) * k, py = c.lat - yi, L = ax * ax + ay * ay;
        const t = L ? Math.max(0, Math.min(1, (px * ax + py * ay) / L)) : 0;
        dmin = Math.min(dmin, Math.hypot(px - t * ax, py - t * ay));
      }
    }
    if (dmin * D * r < 2) { near++; continue; }
    n++;
    if (!!c.land !== inside) bad++;
  }
  return { n, bad, near };
}
/** A cheap fingerprint of the shown flow canvas: the sum of its alpha and how many pixels have any. */
const flowPrint = (w) => w(() => {
  const st = window.__gw.flow.state(), c = document.getElementById(st.shown === 'A' ? 'flow-a' : 'flow-b');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0, lit = 0, h = 0;
  for (let i = 3; i < d.length; i += 4) { if (d[i]) { lit++; sum += d[i]; h = (h * 31 + d[i] + i) >>> 0; } }
  return { sum, lit, h, shown: st.shown };
});

/* Text contrast over every rendered DOM text style (backgrounds composited), and hit targets (US Quakes'). */
const contrastOf = (w) => w(() => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const v = m ? m[1].split(/[ ,/]+/).map(Number) : [0, 0, 0, 0]; return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
  const L = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const over = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  const ground = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } } let bg = ground; for (const c of stack.reverse()) bg = over(c, bg); return bg; };
  let worst = [99, ''], n = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!t.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const c = ratio(over(rgba(cs.color), bgOf(e)), bgOf(e));
    n++;
    if (c < worst[0]) worst = [c, `${e.id || e.className || e.tagName} "${t.textContent.trim().slice(0, 24)}"`];
  }
  return { n, worst: [+worst[0].toFixed(2), worst[1]] };
});
const hitTargets = (w) => w(() => {
  const bad = [], seen = [];
  for (const e of document.querySelectorAll('button, [role="slider"], [role="tab"]')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight || r.right > innerWidth + 1 || !at(cx, cy)) continue;
    seen.push(e.id || (e.textContent || '').trim().slice(0, 12));
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 140 && at(cx + (s * k * dx) / 2, cy + (s * k * dy) / 2); k++) n++; return n / 2; };
    const okV = r.height >= 44 || run(0, 1) >= 43.5, okH = r.width >= 44 || run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Every visible text node: a hyphen-minus before a digit, or a plain space between a number and a unit. */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[  ](°C|°F|%|m\/s|km\/h|mm\/h|in\/h|hPa|inHg|kt|mph|h|d|min|s|km)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!e || e.closest('[hidden]') || e.closest('script, style')) continue;
    // a number and its unit in two elements (the readout's value and unit): read them joined
    const text = e.id === 'readout-unit' ? (document.getElementById('readout-number').textContent + t.textContent) : t.textContent;
    n++;
    if (/(^|[^\w])-\d/.test(text) || UNIT.test(text)) bad.push(text.trim().slice(0, 40));
  }
  return { n, bad };
});

/** Streak heads against the base under them: for every visible particle, the brightest-alpha flow pixel
 *  within a device pixel of its head, composited over the base pixel there, against that base pixel. */
const headSamples = (w) => w(() => {
  const st = window.__gw.flow.state(), dpr = Math.min(2, devicePixelRatio);
  const fc = document.getElementById(st.shown === 'A' ? 'flow-a' : 'flow-b'), bc = document.getElementById('map'), tc = document.getElementById('top');
  const f = fc.getContext('2d').getImageData(0, 0, fc.width, fc.height).data;
  const b = bc.getContext('2d').getImageData(0, 0, bc.width, bc.height).data, bw = bc.width, bs = bc.width / fc.width;
  const tp = tc.getContext('2d').getImageData(0, 0, tc.width, tc.height).data;
  const out = [];
  for (const [lon, lat, x, y, vis] of window.__gw.flow.positions()) {
    if (!vis || x < 60 || y < 8 || x > innerWidth - 60 || y > fc.height / dpr - 8) continue;
    let best = -1, bi = 0, bx = 0, by = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const px = Math.round(x * dpr) + dx, py = Math.round(y * dpr) + dy, i = (py * fc.width + px) * 4;
      if (f[i + 3] > best) { best = f[i + 3]; bi = i; bx = px; by = py; }
    }
    const j = (Math.round(by * bs) * bw + Math.round(bx * bs)) * 4;
    if (tp[j + 3] > 0) continue;                                   // under a label, an arrow or the marker
    out.push({ lon, lat, a: best / 255, s: [f[bi], f[bi + 1], f[bi + 2]], base: [b[j], b[j + 1], b[j + 2]] });
  }
  return out;
});

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  await settle(page, 800);
  let s = await S(w);
  const open0 = s.map.cx;
  {
    // after review: the map opens on the reader's own longitude, from the clock, as the globe does
    const lon = await w(() => { const l = -new Date().getTimezoneOffset() / 4; return ((l + 180) % 360 + 360) % 360 - 180; });
    const want = (lon + 180) / 360, got = s.map.cx - Math.floor(s.map.cx);
    check(Math.abs(want - got) < 1e-9 || Math.abs(Math.abs(want - got) - 1) < 1e-9, `the map opens on the reader's longitude from the clock: ${lon}° (map.cx ${got.toFixed(6)}, want ${want.toFixed(6)})`);
  }

  // boot: the camera's strings and controls, the credits, the face
  {
    const roles = await Promise.all([page.getByRole('tab', { name: 'Map', exact: true }).count(), page.getByRole('tab', { name: 'Globe', exact: true }).count(),
      page.getByRole('button', { name: 'Zoom in', exact: true }).count(), page.getByRole('button', { name: 'Zoom out', exact: true }).count()]);
    // plan 0012 (HOUSE §4.15): no credit line on the front; About's first Sources and credits paragraph is the constant
    const credits = await w(() => { const e = document.getElementById('about-credit-line'), sec = e.parentElement; return { gone: !document.getElementById('credits'), t: e.textContent, first: sec.querySelector('h3').textContent === 'Sources and credits' && sec.children[1] === e }; });
    const font = await w(() => document.fonts.check('560 11.5px "Ysabeau Office"') && document.fonts.check('600 21px "Ysabeau Office"'));
    console.log(`  - boot: ready in ${A.ms} ms (headless Chromium); stamp "${s.stamp}"`);
    check(/(^|\s)Updated /.test(s.stamp) && roles.every((n) => n === 1), `the camera's hooks: the stamp shows "Updated"; one tab named Map, one Globe, one button named Zoom in, one Zoom out (${roles.join(', ')})`);
    check(credits.gone && credits.first && credits.t === 'NOAA GFS, sampled · Natural Earth · GeoNames CC BY 4.0', `the credits are About's: no #credits on the front, and About's first Sources and credits paragraph is the constant, words unchanged: "${credits.t}"`);
    check(font, 'the face is loaded before any picture: document.fonts.check(560 11.5px and 600 21px "Ysabeau Office")');
  }

  // the flow: on by default, moving, the pair alternating, its exposure
  {
    const f = await FS(w);
    const a = await flowPrint(w); await page.waitForTimeout(200); const b = await flowPrint(w);
    const shown = new Set([a.shown, b.shown]);
    for (let i = 0; i < 12 && shown.size < 2; i++) { await page.waitForTimeout(400); shown.add((await FS(w)).shown); }
    check(f.on && f.live && s.flow && !s.arrows && f.n >= 400 && f.n === f.nTarget, `the flow is on by default with the arrows off: ${f.n} particles (target ${f.nTarget} for this ${s.W} × ${s.H} map)`);
    check(a.h !== b.h && a.lit > 2000 && b.lit > 2000, `the flow moves: the shown trail canvas differs between two reads 200 ms apart (${a.lit} and ${b.lit} lit pixels)`);
    check(shown.size === 2, `the pair alternates: both trail canvases were shown within 5 s (${[...shown].join(', ')})`);
    check(f.rung === 24 && s.exposure.startsWith(`Streaks: 1${NN}s = 24${NN}h of wind at the hour shown`), `the exposure: "${s.exposure}"`);
  }

  // text contrast over every rendered text style; the selection tracer under the chosen words only
  {
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5, `text contrast: ${c.n} text nodes, the lowest ${c.worst[0]}:1 at ${c.worst[1]} (≥ 4.5)`);
    const tr = await w(() => [...document.querySelectorAll('.views button, #btn-heat')].map((b) => [b.textContent, getComputedStyle(b, '::after').content !== 'none', b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-pressed') === 'true']));
    check(tr.every(([, mark, on]) => mark === on) && tr.filter((x) => x[1]).length === 2, `the selection tracer marks exactly the chosen view and the Speed colors word while it is on: ${tr.filter((x) => x[1]).map((x) => x[0]).join(' and ')}`);
  }

  // direction and speed end to end: the twelve ask cities, one frame of the real kernel, on the map and the globe
  for (const tab of ['map', 'globe']) {
    await w((t) => { window.__gw.setTab(t); window.__gw.setTime(12); }, tab);
    await settle(page, 400);
    s = await S(w);
    const fs0 = await FS(w), k = Math.round(s.shown), rate = fs0.rung;
    const names = [...CITIES.keys()], pts = names.map((n) => CITIES.get(n));
    await w((p) => window.__gw.flow.probe(p, 1), pts);
    const before = await w(() => window.__gw.flow.positions());
    await w(() => window.__gw.flow.step(1, 1 / 60));
    const after = await w(() => window.__gw.flow.positions());
    const v = await w(() => window.__gw.view());
    let wb = 0, wd = 0, wp = 0, n = 0;
    names.forEach((name, i) => {
      const [lon, lat] = pts[i], u = bil(UV[k].u, lon, lat), vv = bil(UV[k].v, lon, lat), spd = Math.hypot(u, vv);
      const to = (Math.atan2(u, vv) / D + 360) % 360;                       // where the air goes
      const a = [after[i][0], after[i][1]];
      if (spd > 0.5) wb = Math.max(wb, Math.abs(wrap180(bearing([lon, lat], a) - to)));
      wd = Math.max(wd, Math.abs(dist([lon, lat], a) / (spd * (1 / 60) * rate * 3600) - 1));
      const want = tab === 'map' ? merc(a[0], a[1], { ...v.map, W: v.W, H: v.H }) : ortho(a[0], a[1], v.globe, v.W, v.H);
      if (tab === 'map' || want[2] > 0.11) { wp = Math.max(wp, Math.hypot(want[0] - after[i][2], want[1] - after[i][3])); n++; }
      if (Math.abs(before[i][0] - lon) > 1e-9 && Math.abs(Math.abs(before[i][0] - lon) - 360) > 1e-9) wd = Infinity;
    });
    await w(() => window.__gw.flow.probe(null, 7));
    check(wb <= 0.5 && wd <= 0.01 && wp <= 0.5, `${tab}: twelve tracers placed on the ask cities move one frame at step ${k} toward where this file's decode says the air goes (worst ${wb.toFixed(3)}°, ≤ 0.5), by speed × 1/60 s × ${rate} h (worst ${(wd * 100).toFixed(4)} %, ≤ 1 %); their screen positions equal this file's ${tab === 'map' ? 'Mercator' : 'orthographic'} projection within ${wp.toFixed(4)} px (${n} on screen, ≤ 0.5)`);
  }
  await w(() => { window.__gw.setTab('map'); window.__gw.setTime(12); });

  // streak heads over the speed colors and over the bare plate, by day and at night (Global Weather's ART:
  // ≥ 3.0:1 by day, ≥ 2.5:1 at night)
  {
    const rows = [];
    // Center the view on the evening terminator at step 12, so day and night are both in view whatever
    // run the demo carries (a fixed 0° E had no night at all for a 00Z run, and the check needs both).
    { const ms12 = msAt(12), d12 = new Date(ms12), hUTC = d12.getUTCHours() + d12.getUTCMinutes() / 60;
      let lonT = (12 - hUTC) * 15 + 90; lonT = ((lonT + 180) % 360 + 360) % 360 - 180;
      await w((x) => window.__gw.center(x, 0), lonT); }
    for (const layer of ['speed colors', 'bare plate']) {
      await w((l) => { window.__gw.setHeat(l === 'speed colors'); window.__gw.flow.reseed(11); }, layer);
      await settle(page, 1300);
      const ms = msAt((await S(w)).shown);
      const heads = await headSamples(w);
      const day = [], night = [];
      for (const h of heads) {
        if (h.a < 0.5) continue;                                      // a head still under a quarter-pixel of coverage
        const comp = [0, 1, 2].map((i) => h.s[i] * h.a + h.base[i] * (1 - h.a));
        const c = contrast(comp, h.base), z = cosZenith(ms, h.lon, h.lat);
        if (z > 0.02) day.push(c); else if (z < -0.12) night.push(c);
      }
      rows.push({ layer, n: heads.length, day, night });
    }
    const line = rows.map((r) => `${r.layer} day p10 ${pctl(r.day, 0.1).toFixed(2)} (n ${r.day.length}) night p10 ${pctl(r.night, 0.1).toFixed(2)} (n ${r.night.length})`).join('; ');
    check(rows.every((r) => r.day.length > 100 && r.night.length > 100 && pctl(r.day, 0.1) >= 3.0 && pctl(r.night, 0.1) >= 2.5),
      `streak heads against the base under them, 90 % of heads at or above 3.0:1 by day and 2.5:1 at night: ${line}`);
    console.log(`      the lowest single heads (antialiased edges and fresh spawns included): ${rows.map((r) => `${r.layer} ${Math.min(...r.day).toFixed(2)} / ${Math.min(...r.night).toFixed(2)}`).join(', ')}`);
    await w(() => window.__gw.setHeat(true));
  }

  // the readout: this file's decode, the SI formats, the same numbers with the flow on and off
  {
    await w(() => window.__gw.setTime(12));
    let worst = '', bad = 0, n = 0;
    for (const name of ['Reykjavík', 'Cairo', 'Sydney', 'Chicago']) {
      const [lon, lat] = CITIES.get(name);
      await w(([a, b]) => window.__gw.tap(a, b), [lon, lat]);
      await settle(page, 120);
      const read = () => w(() => ({ main: document.getElementById('readout-number').textContent + document.getElementById('readout-unit').textContent,
        sub: document.getElementById('readout-sub').textContent }));
      const on = await read();
      await w(() => document.getElementById('btn-flow').click()); await settle(page, 120);
      const off = await read();
      await w(() => document.getElementById('btn-flow').click()); await settle(page, 120);
      const u = bil(UV[12].u, lon, lat), v = bil(UV[12].v, lon, lat);
      const exp = { main: `${num(Math.hypot(u, v), 1)}${NN}m/s`, sub: words(u, v) };
      n++;
      if (JSON.stringify(on) !== JSON.stringify(exp) || JSON.stringify(off) !== JSON.stringify(on)) { bad++; worst = `${name}: app ${JSON.stringify(on)} want ${JSON.stringify(exp)}`; }
      if (name === 'Cairo') console.log(`      Cairo at step 12: ${on.main}; ${on.sub}`);
    }
    check(bad === 0, `the readout at ${n} cities equals this file's own bilinear sample of its own decode — the speed in SI with U+202F, where the wind comes from and its Beaufort name — and is the same with the flow off${worst ? `: ${worst}` : ''}`);
    const si = await siOf(w);
    check(si.bad.length === 0, `SI in ${si.n} visible text nodes: no hyphen-minus before a digit, U+202F before every unit${si.bad.length ? ': ' + si.bad.join(' | ') : ''}`);
  }

  // the units key cycles with SI first
  {
    const seen = [(await S(w)).unitKey], stored = [];
    for (let i = 0; i < 4; i++) { await A.tapEl('#btn-units'); await settle(page, 60); seen.push((await S(w)).unitKey); stored.push(await w(() => { try { return localStorage.getItem('gw.units'); } catch { return '?'; } })); }
    check(seen.join(' → ') === 'm/s → km/h → kt → mph → m/s' && stored.join() === 'kmh,kt,mph,ms', `the units key, by touch: ${seen.join(' → ')} (gw.units ${stored.join(', ')})`);
  }

  // the pictures
  {
    await w((cx) => { window.__gw.center(cx * 360 - 180, 0); window.__gw.tap(0, 0); document.getElementById('readout-close').click(); window.__gw.setTime(12); window.__gw.flow.reseed(3); }, open0 - Math.floor(open0));
    await settle(page, 1200); await A.shot(`map-${scheme}`);
    // the readout scene taps a city that is on this plate, clear of the key column (Global Weather's
    // review: its scene tapped Reykjavík, off the plate in the clock-longitude opening)
    const v0 = await w(() => window.__gw.view());
    const onPlate = [...CITIES.entries()].map(([n, [lon, lat]]) => [n, lon, lat, merc(lon, lat, { ...v0.map, W: v0.W, H: v0.H })])
      .filter(([, , , p]) => p[0] > 60 && p[0] < v0.W - 90 && p[1] > 60 && p[1] < v0.H - 60)
      .sort((a, b) => Math.hypot(a[3][0] - v0.W / 2, a[3][1] - v0.H / 2) - Math.hypot(b[3][0] - v0.W / 2, b[3][1] - v0.H / 2));
    await w(() => { window.__gw.setTab('globe'); window.__gw.flow.reseed(3); }); await settle(page, 1200); await A.shot(`globe-${scheme}`);
    await w(() => { window.__gw.setTab('map'); window.__gw.setHeat(false); window.__gw.flow.reseed(3); }); await settle(page, 1200); await A.shot(`plain-${scheme}`);
    await w(() => window.__gw.setHeat(true));
    check(onPlate.length > 0, `the readout scene's city is on the plate: ${onPlate.length ? onPlate[0][0] : 'none of the twelve'}`);
    if (onPlate.length) { await w(([lon, lat]) => { window.__gw.tap(lon, lat); window.__gw.flow.reseed(3); }, [onPlate[0][1], onPlate[0][2]]); await settle(page, 1200); await A.shot(`readout-${scheme}`); }
    await w(() => { document.getElementById('readout-close').click(); window.__gw.focus(true); window.__gw.flow.reseed(3); }); await settle(page, 1200); await A.shot(`focus-${scheme}`);
    await w(() => window.__gw.focus(false)); await settle(page, 300);
    if (scheme === 'light') {
      await A.tapEl('#stamp'); await settle(page, 400); await A.shot('about-light');
      await w(() => document.getElementById('about-close').click()); await settle(page, 200);
      // the camera zooms in twice and out twice from the plate's center and expects the view it started
      // from, on the view the app opens on (MarketingShotsUITests: "Put the view back where it was found")
      const m0 = (await S(w)).map;
      for (const id of ['zoom-in', 'zoom-in', 'zoom-out', 'zoom-out']) { await A.tapEl(`#${id}`); await settle(page, 120); }
      const m1 = (await S(w)).map;
      check(Math.abs(m1.scale - m0.scale) < 1e-9 && Math.abs(m1.cx - m0.cx) < 1e-12 && Math.abs(m1.cy - m0.cy) < 1e-12,
        `Zoom in twice, Zoom out twice, by touch, puts the map back where it was: scale ${m0.scale.toFixed(3)} → ${m1.scale.toFixed(3)}, center unchanged (${Math.abs(m1.cx - m0.cx).toExponential(1)}, ${Math.abs(m1.cy - m0.cy).toExponential(1)})`);
      const r0 = (await FS(w)).rung;
      for (let i = 0; i < 3; i++) { await A.tapEl('#zoom-in'); await settle(page, 150); }
      await w(() => window.__gw.flow.reseed(3)); await settle(page, 1200);
      const z = await S(w), r1 = (await FS(w)).rung;
      check(r1 !== r0 && z.exposure.includes(r1 >= 3 ? `${r1}${NN}h` : `${Math.round(r1 * 60)}${NN}min`), `a zoom across a rung changes the exposure: ${r0} h → ${r1} h at ${(z.map.scale / 360).toFixed(1)} px a degree ("${z.exposure}")`);
      await A.shot('zoomed-light');
    }
  }
  check(A.errors.length === 0, `${scheme}: no console error or warning, page error, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once (light)');
{
  const A = await open('light');
  const { page, w, touch } = A;
  await settle(page, 600);
  const perfLine = async (what) => {
    const p = await w(() => window.__gw.perf());
    console.log(`      frame time, ${what} (HEADLESS CHROMIUM, a trend only, not phone evidence): interval median ${p.interval.median} ms, p95 ${p.interval.p95}; flow script median ${p.flow.median} ms, p95 ${p.flow.p95}; base ${p.base.n} redraws, median ${p.base.median} ms; ${p.state.n} particles, rung ${p.state.rung} h, step-down now ${JSON.stringify(p.state.ladder)}${p.ladder.length ? `; the ladder moved ${p.ladder.length} times: ${p.ladder.map((l) => `${l.down ? 'down' : 'up'} at ${(l.t / 1000).toFixed(1)} s (median quiet interval ${l.median.toFixed(1)} ms against a display period ${l.period.toFixed(1)})`).join(', ')}` : ''}`);
    return p;
  };

  // frame time at rest: 5 s of idle flow on the map, then on the globe
  for (const tab of ['map', 'globe']) {
    await w((t) => { window.__gw.setTab(t); window.__gw.setTime(12); }, tab);
    await page.waitForTimeout(5200);
    const p = await perfLine(`5 s of idle flow on the ${tab}, 390 × 844 at DPR 2`);
    check(p.frames >= 100 && p.state.n >= 400, `the ${tab}'s flow ran for 5 s at ${p.state.n} particles (interval median ${p.interval.median} ms in headless Chromium)`);
  }

  // the three-speed scrub, by real touches, on the map and the globe
  if (process.env.SCRUB !== '0') {
    const rect = await w(() => document.getElementById('slider').getBoundingClientRect().toJSON());
    const PAD = 10, inner0 = rect.left + PAD, innerW = rect.width - 2 * PAD, y = rect.top + 24;
    const xOf = (k) => inner0 + (k / (STEPS - 1)) * innerW;
    const under = (x) => Math.max(0, Math.min(STEPS - 1, Math.round(((x - inner0) / innerW) * (STEPS - 1))));
    for (const tab of ['map', 'globe']) {
      await w((t) => { window.__gw.setTab(t); window.__gw.setTime(20); }, tab);
      await settle(page, 300);
      for (const speed of [2, 8, 20]) {
        const T = ((STEPS - 1) / speed) * 1000;
        await w(() => window.__gw.log(true));
        await touch('touchStart', xOf(0), y);
        const t0 = Date.now(); let sent = 0; const anims = [];
        for (;;) {
          const t = Date.now() - t0;
          if (t >= T) break;
          await touch('touchMove', xOf(0) + ((xOf(STEPS - 1) - xOf(0)) * t) / T, y); sent++;
          if (sent % 25 === 0) anims.push(...await w(() => document.getAnimations().map((a) => a.effect && a.effect.target).filter((e) => e && e.closest('#valid-time, #lead, #slider')).map((e) => e.id)));
          await new Promise((r) => setTimeout(r, 16 - ((Date.now() - t0) % 16)));
        }
        await touch('touchMove', xOf(STEPS - 1), y);
        await touch('touchEnd');
        await page.waitForTimeout(150);
        const log = await w(() => window.__gw.log(false));
        const held = log.filter((f) => f.pressed && f.finger != null);
        let mismatch = 0, flowBad = 0, labelBad = 0, first = null;
        for (const f of held) {
          const want = under(f.finger);
          if (f.shown !== want || f.wanted !== want) { mismatch++; if (!first) first = { finger: +f.finger.toFixed(1), want, wanted: f.wanted, shown: f.shown }; }
          if (f.flowK0 !== f.shown || f.flowF !== 0) flowBad++;
          if (f.label !== labelAt(VALID[f.shown])) labelBad++;
        }
        const order = []; for (const f of held) if (!order.length || order[order.length - 1] !== f.shown) order.push(f.shown);
        const inOrder = order.every((v, i) => !i || v > order[i - 1]);
        const after = log.find((f, i) => i > 0 && !f.pressed && log[i - 1].pressed);
        const all = speed !== 2 || (order.length === STEPS && inOrder);
        const secs = held.length ? (held[held.length - 1].t - held[0].t) / 1000 : 0;
        check(held.length > 0 && mismatch === 0 && flowBad === 0 && labelBad === 0 && all && after && after.shown === STEPS - 1 && anims.length === 0,
          `${tab} scrub at ${speed} steps a second (${sent} real touch moves, ${held.length} frames at ${(held.length / Math.max(secs, 1e-3)).toFixed(0)} a second): drawn = wanted = the step under the finger on every frame (${mismatch} differ${first ? ` first ${JSON.stringify(first)}` : ''}); the flow on that step's field with f = 0 (${flowBad} differ); the label the drawn step's (${labelBad} differ); ${new Set(held.map((f) => f.shown)).size} of ${STEPS} steps drawn${speed === 2 ? `, all in order: ${all}` : ''}; the frame after the lift draws step ${after && after.shown}; ${anims.length} animations on the time row or track`);
      }
    }
    await perfLine('after the scrub (the base redrawn on every step change)');
  }

  // play: across a day, and for 3 s; the label and the flow's field are the drawn t's on every frame
  {
    await w(() => { window.__gw.setTab('map'); window.__gw.setTime(4); });
    await settle(page, 200);
    await w(() => window.__gw.log(true));
    await w(() => window.__gw.play(true));
    await page.waitForFunction(() => window.__gw.state.shown >= 12, null, { timeout: 15000 });
    await page.waitForTimeout(3000);
    await w(() => window.__gw.play(false));
    const log = (await w(() => window.__gw.log(false))).filter((f) => f.playing && f.drawn);
    let labelBad = 0, flowBad = 0, back = 0;
    for (let i = 0; i < log.length; i++) {
      const f = log[i], k0 = Math.min(STEPS - 1, Math.floor(f.shown)), k1 = Math.min(k0 + 1, STEPS - 1), fr = k1 === k0 ? 0 : f.shown - k0;
      if (f.label !== labelAt(msAt(f.shown))) labelBad++;
      if (f.flowK0 !== k0 || f.flowK1 !== k1 || Math.abs(f.flowF - fr) > 1e-12) flowBad++;
      if (i && f.shown < log[i - 1].shown) back++;
    }
    const hours = (HOURS[Math.floor(log[log.length - 1].shown)] - HOURS[Math.floor(log[0].shown)]);
    check(log.length > 60 && labelBad === 0 && flowBad === 0 && back === 0 && hours >= 24,
      `play: ${log.length} drawn frames over ${hours} forecast hours; the label is the drawn t's on every frame (${labelBad} differ); the flow reads the base's k0, k1 and fraction (${flowBad} differ); never backwards (${back})`);
    const s = await S(w);
    check(Number.isInteger(s.shown) && !s.playing, `pausing rounds to a step: ${s.shown}, "${s.valid}"`);
    // after review: the Play key shows Pause while playing (an <svg>'s hidden attribute, not a property)
    const icons = () => w(() => ['ico-play', 'ico-pause'].map((id) => getComputedStyle(document.getElementById(id)).display));
    const paused = await icons();
    await A.tapEl('#btn-play'); await settle(page, 150);
    const during = await icons(), label = await w(() => document.getElementById('btn-play').getAttribute('aria-label'));
    await A.tapEl('#btn-play'); await settle(page, 150);
    const after = await icons();
    check(paused.join() === 'block,none' && during.join() === 'none,block' && label === 'Pause' && after.join() === 'block,none',
      `the Play key's mark follows play, by touch: paused ▶ shown (${paused.join(', ')}), playing ‖ shown (${during.join(', ')}) and named "${label}", paused again ▶ (${after.join(', ')})`);
    // after review: About holds play still (nothing is drawn under the sheet) and play goes on once it closes
    await w(() => window.__gw.setTime(6)); await settle(page, 100);
    await A.tapEl('#btn-play'); await page.waitForTimeout(500);
    await A.tapEl('#stamp'); await settle(page, 200);
    const a0 = await w(() => ({ t: window.__gw.state.t, frames: window.__gw.perf().frames, open: !document.getElementById('about').hidden }));
    await page.waitForTimeout(800);
    const a1 = await w(() => ({ t: window.__gw.state.t, playing: window.__gw.state.playing, last: window.__gw.flow.perf().frames.slice(-1)[0] }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    const a2 = await w(() => ({ t: window.__gw.state.t, playing: window.__gw.state.playing }));
    await w(() => window.__gw.play(false)); await settle(page, 100);
    check(a0.open && a1.t === a0.t && a1.playing && a2.t > a1.t && a2.playing,
      `About holds play still while it is open (t ${a0.t.toFixed(3)} → ${a1.t.toFixed(3)} over 0.8 s, still playing) and play goes on once it closes (t ${a2.t.toFixed(3)})`);
    // a touch on the track while playing stops play and lands on the step under the finger, before any move
    const tr = await w(() => document.getElementById('slider').getBoundingClientRect().toJSON());
    await w(() => window.__gw.play(true)); await page.waitForTimeout(400);
    await touch('touchStart', tr.left + 10 + (30 / (STEPS - 1)) * (tr.width - 20), tr.top + 24);
    await page.waitForTimeout(120);
    const held = await S(w);
    await touch('touchEnd'); await settle(page, 100);
    check(!held.playing && held.shown === 30, `a touch on the track during play stops it and draws the step under the finger at once: step ${held.shown} (want 30), playing ${held.playing}`);
    await perfLine('during play (the base redrawn on every frame)');
  }

  // after review: the plate's height never moves with the caption's words. A touch pan north across the
  // 45° edge (where the exposure gains its polar clause) and back, then 2 s at rest, must see no resize
  // of #map-wrap; nor may the Flow and Arrows keys move it.
  {
    await w(() => { window.__gw.setTab('map'); window.__gw.setTime(12); window.__gw.center(-95, 0); });
    await settle(page, 300);
    for (let i = 0; i < 2; i++) { await A.tapEl('#zoom-in'); await settle(page, 200); }
    await w(() => { window.__ro = []; window.__roArmed = false; new ResizeObserver((es) => { if (window.__roArmed) window.__ro.push(...es.map((e) => Math.round(e.contentRect.height))); }).observe(document.getElementById('map-wrap')); });
    await settle(page, 100);
    await w(() => { window.__roArmed = true; });
    const pr = await w(() => document.getElementById('map').getBoundingClientRect().toJSON());
    const x = pr.left + pr.width / 2;
    let y = pr.top + 60, crossed = -1;
    const clause = async () => /poles/.test((await S(w)).exposure);
    const before = await clause();
    await touch('touchStart', x, y);
    for (let k = 0; k < 400 && crossed < 0; k++) { y += 1.5; await touch('touchMove', x, y); if (k % 4 === 3) { await page.waitForTimeout(16); if (await clause()) crossed = k; } }
    for (let k = 0; k < 20; k++) { y += 1.5; await touch('touchMove', x, y); await page.waitForTimeout(16); }
    for (let k = 0; k < 40; k++) { y -= 1.5; await touch('touchMove', x, y); await page.waitForTimeout(16); }
    const backAcross = !(await clause());
    await touch('touchEnd');
    await page.waitForTimeout(2000);
    const ro = await w(() => window.__ro.slice());
    const H0 = (await S(w)).H;
    const heights = [];
    for (const id of ['btn-flow', 'btn-flow', 'btn-arrows', 'btn-arrows']) { await A.tapEl(`#${id}`); await settle(page, 150); heights.push((await S(w)).H); }
    const ro2 = await w(() => window.__ro.slice());
    check(!before && crossed >= 0 && backAcross && ro.length === 0 && ro2.length === 0 && heights.every((h) => h === H0),
      `the plate never resizes with the caption: a real-touch pan crossed the 45° edge (the polar clause appeared after ${crossed >= 0 ? (crossed + 1) * 1.5 : '–'} px and went again on the way back) with ${ro.length} resizes of #map-wrap during it and in 2 s at rest; Flow off, on, Arrows on, off: the plate ${H0} → ${heights.join(', ')} px (${ro2.length - ro.length} resizes)`);
    await w(() => { window.__roArmed = false; });
  }

  // after review: the readout card never covers the place that was tapped, and VoiceOver hears the tap
  {
    await w(() => { document.getElementById('readout-close').click(); window.__gw.setTime(12); });
    await settle(page, 200);
    const pr = await w(() => document.getElementById('map').getBoundingClientRect().toJSON());
    const res = [];
    for (const [dx, dy] of [[40, 40], [120, 90], [40, pr.height - 60]]) {
      // each tap starts with the card closed: a tap where the card already is lands on the card
      await w(() => document.getElementById('readout-close').click()); await settle(page, 100);
      await A.tapAt(pr.left + dx, pr.top + dy); await settle(page, 750);
      res.push(await w(() => {
        const m = window.__gw.state.marker, p = window.__gw.project(m.lon, m.lat), b = document.getElementById('readout'), r = b.getBoundingClientRect(), q = document.getElementById('map').getBoundingClientRect();
        const x = q.left + p[0], y = q.top + p[1];
        // the place names under the card: #top's lit device pixels inside the card's rectangle
        const tc = document.getElementById('top'), k = tc.width / q.width;
        const d = tc.getContext('2d').getImageData(Math.round((r.left - q.left) * k), Math.round((r.top - q.top) * k), Math.round(r.width * k), Math.round(r.height * k)).data;
        let under = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) under++;
        return { covered: x > r.left && x < r.right && y > r.top && y < r.bottom, low: b.classList.contains('low'), live: document.getElementById('live').textContent, under };
      }));
    }
    check(res.every((r) => !r.covered) && res[0].low && res[1].low && !res[2].low, `the readout card keeps clear of the tapped place: two taps under its top-left corner move it to the bottom, a tap near the bottom keeps it at the top (${res.map((r) => (r.low ? 'bottom' : 'top')).join(', ')}); covered ${res.filter((r) => r.covered).length} of ${res.length}`);
    // Global Weather's review: a real tap drew #top before the card opened, and the names under it stayed
    check(res.every((r) => r.under === 0), `no place name is left under a card a real tap has just opened: ${res.map((r) => r.under).join(', ')} lit device pixels of #top inside the card (want 0 each)`);
    check(/^\d+\.\d degrees (north|south), \d+\.\d degrees (east|west)\. Wind \d+\.\d meters a second\. (From [A-Z]+ \(\d+°\)|No direction), [a-z ]+, Beaufort \d+\.$/.test(res[2].live),
      `VoiceOver hears a tap once, units in words: "${res[2].live}"`);
    await w(() => document.getElementById('readout-close').click());
    await A.tapEl('#btn-next'); await settle(page, 200);
    const sp = await w(() => ({ live: document.getElementById('live').textContent, vt: document.getElementById('slider').getAttribute('aria-valuetext'), stamp: [document.getElementById('stamp').getAttribute('aria-haspopup'), document.getElementById(document.getElementById('stamp').getAttribute('aria-describedby')).textContent] }));
    check(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) \d+ [A-Z][a-z]+, \d\d:\d\d$/.test(sp.live) && / \d+ hours? after the run$/.test(sp.vt) && sp.stamp[0] === 'dialog' && sp.stamp[1] === 'Opens About this data.',
      `the Next step key says the new time in words ("${sp.live}"); the track's value in words ("${sp.vt}"); the stamp is a dialog button described "${sp.stamp[1]}"`);
  }

  // gestures: a map pan carries the trails; a globe drag clears them each frame and they regrow
  {
    await w(() => { window.__gw.setTab('map'); window.__gw.setTime(12); });
    await settle(page, 900);
    await w(() => window.__gw.flow.hold(true));
    await settle(page, 100);
    const grab = () => w(() => { const st = window.__gw.flow.state(), c = document.getElementById(st.shown === 'A' ? 'flow-a' : 'flow-b'); return { w: c.width, h: c.height, d: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((_, i) => i % 4 === 3)), map: window.__gw.view().map }; });
    const b0 = await grab();
    const pr = await w(() => document.getElementById('map').getBoundingClientRect().toJSON());
    await touch('touchStart', pr.left + 150, pr.top + 300);
    for (let k = 1; k <= 10; k++) { await touch('touchMove', pr.left + 150 + k * 4, pr.top + 300 + k * 3); await page.waitForTimeout(20); }
    await touch('touchEnd');
    await settle(page, 200);
    const b1 = await grab();
    // the pan the app applied, from its own view (Mercator: a pure translation), in device px
    let dcx = b1.map.cx - b0.map.cx; dcx -= Math.round(dcx);
    const ex = -dcx * b1.map.scale * 2, ey = -(b1.map.cy - b0.map.cy) * b1.map.scale * 2;
    let best = [Infinity, 0, 0];
    for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      let err = 0, n = 0;
      const sx = Math.round(ex) + ox, sy = Math.round(ey) + oy;
      for (let y = 40; y < b0.h - 40; y += 3) for (let x = 40; x < b0.w - 40; x += 3) { const a = b0.d[y * b0.w + x], X = x + sx, Y = y + sy; if (!a || X < 0 || Y < 0 || X >= b0.w || Y >= b0.h) continue; err += Math.abs(a - b1.d[Y * b0.w + X]); n++; }
      if (err / n < best[0]) best = [err / n, ox, oy];
    }
    await w(() => window.__gw.flow.hold(false));
    check(Math.hypot(ex, ey) > 20 && Math.abs(best[1]) <= 1 && Math.abs(best[2]) <= 1 && best[0] < 6,
      `a real-touch map pan of (${(ex / 2).toFixed(1)}, ${(ey / 2).toFixed(1)}) CSS px carries the held trails with it: the best match is ${best[1]}, ${best[2]} device px from the pan (±1), mean alpha error ${best[0].toFixed(2)}`);
    // the globe
    await w(() => window.__gw.setTab('globe'));
    await settle(page, 1200);
    const lit0 = (await flowPrint(w)).lit;
    await touch('touchStart', pr.left + 120, pr.top + 300);
    const mid = [];
    for (let k = 1; k <= 30; k++) { await touch('touchMove', pr.left + 120 + k * 4, pr.top + 300); await page.waitForTimeout(16); if (k % 10 === 0) mid.push((await flowPrint(w)).lit); }
    await touch('touchEnd');
    await settle(page, 1000);
    const lit2 = (await flowPrint(w)).lit;
    check(Math.max(...mid) === 0 && lit2 > 0.6 * lit0, `a globe drag hides the flow while the finger turns it (${lit0} lit device pixels at rest, at most ${Math.max(...mid)} at ${mid.length} reads during the drag, frames between two moves included) and the first frame after the release prewarms it (${lit2} within 1 s)`);
  }

  // focus mode (DESIGN §3)
  {
    await w(() => { window.__gw.setTab('map'); window.__gw.setTime(12); });
    await settle(page, 300);
    const H0 = (await S(w)).H;
    await w(() => window.__gw.tap(10, 10)); await settle(page, 150);
    await A.tapEl('#focus-key');
    await settle(page, 450);
    const closedOnEntry = await w(() => document.getElementById('readout').hidden && !window.__gw.state.marker);
    check(closedOnEntry, 'entering focus mode closes the readout card (a panel; a tap opens it again)');
    const f1 = await w(() => {
      const gone = ['head', 'keys', 'legend-scale'].map((id) => { const e = document.getElementById(id); return [id, e.hidden, e.inert]; });
      const vis = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && r.height > 0; };
      return { gone, stay: ['stamp', 'exposure', 'valid-time', 'slider', 'btn-play', 'focus-exit', 'legend-name'].map((id) => [id, vis(id)]),
               live: document.getElementById('live').textContent, active: document.activeElement && document.activeElement.id, stampIn: document.getElementById('stamp').parentElement.id };
    });
    await settle(page, 100);
    const live1 = await w(() => document.getElementById('live').textContent);
    const tree = await Promise.all([page.getByRole('tab', { name: 'Globe' }).count(), page.getByRole('button', { name: 'Zoom in' }).count(), page.getByRole('button', { name: 'Show the controls' }).count()]);
    const s1 = await S(w);
    check(f1.gone.every(([, h, i]) => h && i) && f1.stay.every(([, v]) => v) && f1.stampIn === 'caption' && tree[0] === 0 && tree[1] === 0 && tree[2] === 1 && s1.H > H0 && s1.focus,
      `focus mode by touch: the header, key column and legend bar hidden and inert (${f1.gone.map((g) => g[0]).join(', ')}), gone from the accessibility tree (Globe ${tree[0]}, Zoom in ${tree[1]}); the stamp moved into the caption, the exposure, time row, track, play and ghost key stay; the map grew ${H0} → ${s1.H} px`);
    check(live1 === 'Controls hidden. Press Escape or the corner key to show them.' && f1.active !== 'focus-exit', `the live region says "${live1}"; after a touch, focus stays put (active: ${f1.active})`);
    // after QA: the hit targets in focus mode too — the stamp heads the caption band there
    const hf = await hitTargets(w);
    check(hf.bad.length === 0 && hf.n >= 5, `focus mode's hit targets ≥ 44 × 44 px, the stamp in the caption among them: ${hf.n} controls${hf.bad.length ? '; too small: ' + hf.bad.join('; ') : ''}`);
    // a scrub, play and a tap in focus
    const rect = await w(() => document.getElementById('slider').getBoundingClientRect().toJSON());
    await touch('touchStart', rect.left + 10, rect.top + 24);
    for (let k = 0; k <= 20; k++) { await touch('touchMove', rect.left + 10 + (k / 20) * (rect.width - 20) * 0.5, rect.top + 24); await page.waitForTimeout(16); }
    await touch('touchEnd'); await settle(page, 150);
    const sc = await S(w);
    await A.tapEl('#btn-play'); await page.waitForTimeout(800); await A.tapEl('#btn-play'); await settle(page, 150);
    const pl = await S(w);
    const mr = await w(() => document.getElementById('map').getBoundingClientRect().toJSON());
    await A.tapAt(mr.left + mr.width / 2, mr.top + mr.height / 2); await settle(page, 600);
    const rd = await w(() => !document.getElementById('readout').hidden && document.getElementById('readout-where').textContent);
    check(sc.shown === 20 && pl.shown > 20 && !!rd, `in focus mode a scrub lands on step ${sc.shown} (want 20), play moves on to ${pl.shown}, and a tap on the plate opens the readout (${rd})`);
    await w(() => document.getElementById('readout-close').click());
    // the ghost key by touch; then Enter on the key and Escape out
    await A.tapEl('#focus-exit'); await settle(page, 300);
    const out1 = await S(w), live2 = await w(() => document.getElementById('live').textContent);
    await w(() => document.getElementById('focus-key').focus());
    await page.keyboard.press('Enter'); await settle(page, 450);
    const k1 = await w(() => ({ focus: window.__gw.state.focus, active: document.activeElement.id }));
    // a reload keeps it
    await page.reload(); await page.waitForFunction(() => window.__gw && window.__gw.ready(), null, { timeout: 60000 }); await settle(page, 300);
    const rl = await w(() => ({ focus: window.__gw.state.focus, ghost: !document.getElementById('focus-exit').hidden, head: document.getElementById('head').hidden }));
    await page.keyboard.press('Escape'); await settle(page, 300);
    const esc = await w(() => ({ focus: window.__gw.state.focus, active: document.activeElement.id, live: document.getElementById('live').textContent }));
    check(!out1.focus && live2 === 'Controls shown.' && k1.focus && k1.active === 'focus-exit' && rl.focus && rl.ghost && rl.head && !esc.focus && esc.active === 'focus-key',
      `focus mode leaves by the ghost key ("${live2}"), enters by Enter with focus moved to the ghost key (${k1.active}), survives a reload (gw.focus), and leaves by Escape with focus back on its key (${esc.active})`);
  }

  // after QA: the marketing camera on a library left in focus mode. It waits for the visible word
  // "Updated", then finds Globe, Map, Zoom in and Zoom out by role and name — all hidden in focus mode.
  // What it can find instead is the ghost key, named "Show the controls"; one tap by touch brings back
  // every control it looks for. (The camera's guard itself lives in Tests/, outside this folder.)
  {
    await w(() => window.__gw.focus(true)); await settle(page, 300);
    await page.reload(); await page.waitForFunction(() => window.__gw && window.__gw.ready(), null, { timeout: 60000 }); await settle(page, 300);
    const roles = () => Promise.all([page.getByRole('tab', { name: 'Globe', exact: true }).count(), page.getByRole('tab', { name: 'Map', exact: true }).count(), page.getByRole('button', { name: 'Zoom in', exact: true }).count(), page.getByRole('button', { name: 'Zoom out', exact: true }).count()]);
    const updated = await page.getByText('Updated', { exact: false }).first().isVisible();
    const hidden = await roles();
    const ghost = page.getByRole('button', { name: 'Show the controls', exact: true });
    const gn = await ghost.count(), gb = await ghost.boundingBox();
    await A.tapAt(gb.x + gb.width / 2, gb.y + gb.height / 2); await settle(page, 300);
    const shown = await roles();
    const vis = await Promise.all([page.getByRole('tab', { name: 'Globe', exact: true }).isVisible(), page.getByRole('button', { name: 'Zoom in', exact: true }).isVisible()]);
    const stored = await w(() => { try { return localStorage.getItem('gw.focus'); } catch { return 'unreadable'; } });
    check(updated && hidden.every((n) => n === 0) && gn === 1 && shown.every((n) => n === 1) && vis.every(Boolean) && stored === '0',
      `a library left in focus mode, reloaded: "Updated" is visible, the camera's Globe, Map, Zoom in, Zoom out are absent (${hidden.join(', ')}); one tap on the one button named "Show the controls" brings each back (${shown.join(', ')}), visible, and gw.focus reads '${stored}'`);
  }

  // the Speed colors key, by touch: the colors leave the plate, the legend's bar keeps its place, the
  // plate does not move, the choice is stored as gw.heat and survives a reload
  {
    await w(() => { window.__gw.setTab('map'); window.__gw.setTime(12); window.__gw.center(-150, 0); });
    await settle(page, 400);
    // a bare-ocean pixel of the base, far from any coast, graticule line or key: the Pacific at 13.7° S
    // 143.3° W, read with the night wash off so that bare means exactly the light plate's ocean, #d3e0e4
    await A.tapEl('#btn-night'); await settle(page, 300);
    const px = () => w(() => { const v = window.__gw.view(), p = window.__gw.project(-143.3, -13.7), c = document.getElementById('map'), k = c.width / v.W;
      return [...c.getContext('2d').getImageData(Math.round(p[0] * k), Math.round(p[1] * k), 1, 1).data.slice(0, 3)]; });
    const H0 = (await S(w)).H, on0 = await px();
    await A.tapEl('#btn-heat'); await settle(page, 300);
    const off = await w(() => ({ pressed: document.getElementById('btn-heat').getAttribute('aria-pressed'), bar: getComputedStyle(document.getElementById('legend-scale')).visibility,
      barH: document.getElementById('legend-scale').getBoundingClientRect().height, stored: (() => { try { return localStorage.getItem('gw.heat'); } catch { return '?'; } })() }));
    const H1 = (await S(w)).H, off0 = await px();
    await page.reload(); await page.waitForFunction(() => window.__gw && window.__gw.ready(), null, { timeout: 60000 }); await settle(page, 300);
    const kept = (await S(w)).heat;
    await A.tapEl('#btn-heat'); await settle(page, 300);
    await A.tapEl('#btn-night'); await settle(page, 300);
    const back = await S(w);
    const OCEAN = [211, 224, 228];
    const bare = off0.every((c, i) => Math.abs(c - OCEAN[i]) <= 2), colored = on0.some((c, i) => Math.abs(c - OCEAN[i]) > 6);
    check(off.pressed === 'false' && off.bar === 'hidden' && off.barH > 0 && off.stored === '0' && H1 === H0 && bare && colored && kept === false && back.heat && back.H === H0,
      `Speed colors by touch: off → aria-pressed ${off.pressed}, the legend's bar hidden but ${off.barH.toFixed(0)} px tall in place, the plate ${H0} → ${H1} px, an ocean pixel at 13.7° S 143.3° W, night off, ${JSON.stringify(on0)} → ${JSON.stringify(off0)} (the bare ocean is [211, 224, 228]), gw.heat '${off.stored}', kept over a reload (${kept}); on again by touch (${back.heat})`);
  }

  // the whole world: no coast drawn along the map's bottom edge (Global Weather's review found Natural
  // Earth's Antarctic ring closing from 180° E to 180° W at 84.35° S stroked as a full-width rule there)
  {
    await w(() => document.getElementById('zoom-home').click()); await settle(page, 600);
    const edge = await w(() => {
      const v = window.__gw.view(), c = document.getElementById('map'), k = c.width / v.W, x = c.getContext('2d');
      const y = (0.5 - Math.log(Math.tan(Math.PI / 4 + (-84.35 * Math.PI / 180) / 2)) / (2 * Math.PI) - v.map.cy) * v.map.scale + v.H / 2;
      const row = Math.round(y * k), d = x.getImageData(0, row - 2, c.width, 5).data, coast = [95, 112, 121];   // the light coast, #5f7079
      let hit = 0;
      for (let col = 0; col < c.width; col++) {
        let any = false;
        for (let j = 0; j < 5; j++) { const i = (j * c.width + col) * 4; if (Math.hypot(d[i] - coast[0], d[i + 1] - coast[1], d[i + 2] - coast[2]) < 40) any = true; }
        if (any) hit++;
      }
      return { row, hit, width: c.width };
    });
    check(edge.hit < 0.25 * edge.width, `the whole-world map draws no rule along 84.35° S: ${edge.hit} of ${edge.width} device columns carry the coast's ink within 2 rows of device row ${edge.row} (want under a quarter; Global Weather's ring closure inked ${edge.width} of ${edge.width})`);
    await w(() => window.__gw.center(-150, 0));
  }

  // plan 0012 3.6: the deeper zoom. The map stops at 120 px a degree of longitude, the globe at the radius that
  // draws its center at that scale; over Lofoten the rate takes the ladder's new 20 min; and the globe at rest
  // reads the land of its own window, which agrees with world.json's rings at every cell center further than
  // 2 px from a coast (the 2 048 × 1 024 mask alone drew 0.18° squares along it)
  {
    await w(() => window.__gw.setTab('map'));
    for (let i = 0; i < 9; i++) { await A.tapEl('#zoom-in'); await settle(page, 120); }
    await w(() => { window.__gw.center(14.3, 68.15); window.__gw.flow.reseed(3); }); await settle(page, 1200);   // centered once zoomed: a whole-world view clamps the latitude
    const m = await S(w), mr = (await FS(w)).rung;
    await A.shot('deepest-map-light', false);
    await w(() => { window.__gw.setTab('globe'); window.__gw.center(6.4, 61.15); });
    for (let i = 0; i < 9; i++) { await A.tapEl('#zoom-in'); await settle(page, 120); }
    await settle(page, 800);
    const g = await S(w);
    await A.shot('deepest-globe-light', false);
    const cells = await w(() => { const out = []; for (let i = 0; i < 24; i++) for (let j = 0; j < 40; j++) out.push(window.__gw.globeCell(5.2 + i * 0.1, 60.2 + j * 0.05)); return out; });
    const cmp = landAgreement(cells, g.globe.r);
    check(m.map.scale === 360 * 120 && Math.abs(g.globe.r - 360 * 120 / (2 * Math.PI)) < 1e-6 && mr === 20 / 60 && m.exposure.includes(`20${NN}min`) && cells.every((c) => c.fine) && cmp.bad === 0 && cmp.n > 300,
      `the deepest zoom: the map stops at ${(m.map.scale / 360).toFixed(1)} px a degree, the globe at r ${g.globe.r.toFixed(1)} px (${(g.globe.r * D).toFixed(1)} px a degree at its center); over Lofoten the rung is ${Math.round(mr * 60)} min ("${m.exposure}"); the globe at rest reads the fine land, and ${cmp.n - cmp.bad} of ${cmp.n} cells further than 2 px from a coast agree with world.json's rings (${cmp.near} nearer, not judged)`);
    await w(() => { document.getElementById('zoom-home').click(); window.__gw.setTab('map'); document.getElementById('zoom-home').click(); }); await settle(page, 400);
  }

  // hidden: the loop stops and the trails clear; visible again: a prewarm, never streaks from before
  {
    await settle(page, 600);
    const hide = (on) => w((h) => {
      if (h) { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); }
      else { delete document.hidden; delete document.visibilityState; }
      document.dispatchEvent(new Event('visibilitychange'));
    }, on);
    await hide(true);
    const a = await w(() => window.__gw.perf().frames), fa = await flowPrint(w), st = await FS(w);
    const cnt0 = await w(() => window.__gw.flow.perf().frames.length ? window.__gw.flow.perf().frames.slice(-1)[0].t : 0);
    await page.waitForTimeout(700);
    const cnt1 = await w(() => window.__gw.flow.perf().frames.slice(-1)[0].t);
    const both = await w(() => ['flow-a', 'flow-b'].map((id) => { const c = document.getElementById(id); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v); }));
    await hide(false);
    await page.waitForTimeout(80);
    const back = await flowPrint(w), st2 = await FS(w);
    check(st.suppressed === 'hidden' && cnt0 === cnt1 && both.every((x) => !x) && back.lit > 1000 && st2.on && a > 0,
      `hidden: the flow stops (suppressed "${st.suppressed}", its last frame time frozen at ${cnt0.toFixed(0)}), both trail canvases are empty; visible again, the first frames are a prewarm (${back.lit} lit pixels within 80 ms)`);
  }

  // hit targets, and what a reload keeps
  {
    const h = await hitTargets(w);
    check(h.bad.length === 0 && h.n >= 16, `hit targets ≥ 44 × 44 px: ${h.n} controls${h.bad.length ? '; too small: ' + h.bad.join('; ') : ''}`);
  }
  check(A.errors.length === 0, `once: no console error or warning, page error, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  // the About sheet, by touch: focus held inside, Escape closes, the flow paused while it is open
  {
    await A.tapEl('#stamp'); await settle(page, 400);
    const ab = await w(() => ({ open: !document.getElementById('about').hidden, sup: window.__gw.flow.state().suppressed, text: document.getElementById('about-body').textContent, credit: document.querySelector('#about-body section:nth-of-type(3) p').textContent }));
    await page.keyboard.press('Escape'); await settle(page, 200);
    const closed = await w(() => document.getElementById('about').hidden);
    check(ab.open && ab.sup === 'about' && closed && /Ysabeau Office by Christian Thalmann \(Catharsis Fonts\), SIL Open Font License 1\.1/.test(ab.text) && /www\.geonames\.org/.test(ab.text) && /not unaltered NOAA data/.test(ab.text)
      && ab.credit === 'NOAA GFS, sampled · Natural Earth · GeoNames CC BY 4.0',
      `About opens from the stamp, pauses the flow ("${ab.sup}"), carries the credit line first ("${ab.credit}"), NOAA's "not unaltered" sentence, GeoNames' license and the font's credit, and closes on Escape`);
  }
  await A.ctx.close();
}

/* Reduce Motion: no flow, the arrows in its place, every transition at zero, play still steps */
console.log('\n== Reduce Motion (dark)');
{
  const A = await open('dark', { reduced: true });
  const { page, w } = A;
  await settle(page, 400);
  const a = await flowPrint(w); await page.waitForTimeout(1000); const b = await flowPrint(w);
  const s = await S(w), st = await FS(w);
  const top = await w(() => { const c = document.getElementById('top'); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data.filter((v, i) => i % 4 === 3 && v).length; });
  check(a.lit === 0 && b.lit === 0 && st.suppressed === 'reduced' && s.flow && !s.arrows && s.arrowsDrawn && top > 5000 && s.exposure === `Arrows: length and weight grow with wind speed up to 25${NN}m/s`,
    `the flow canvases stay empty over 1 s (suppressed "${st.suppressed}"); the stored choice (flow on, arrows off) is kept and the arrows are drawn in its place (${top} lit pixels on #top); the caption: "${s.exposure}"`);
  await A.tapEl('#btn-flow'); await settle(page, 200);
  const k = await w(() => ({ live: document.getElementById('live').textContent, title: document.getElementById('btn-flow').title, pressed: document.getElementById('btn-flow').getAttribute('aria-pressed') }));
  check(k.live === 'The flow is off while Reduce Motion is on.' && k.title === k.live && k.pressed === 'false', `a press on the Flow key says "${k.live}" (live region and title), aria-pressed ${k.pressed}`);
  const d = await w(() => [document.querySelector('#btn-heat[aria-pressed="true"]'), document.querySelector('.about-sheet')].map((e) => getComputedStyle(e, e.matches('button') ? '::after' : null).animationDuration));
  await w(() => window.__gw.setTime(4)); await settle(page, 100);
  await w(() => window.__gw.log(true));
  await w(() => window.__gw.play(true)); await page.waitForTimeout(1500); await w(() => window.__gw.play(false)); await settle(page, 100);
  const rlog = (await w(() => window.__gw.log(false))).filter((f) => f.playing && f.drawn);
  const p = await S(w);
  const frac = rlog.filter((f) => !Number.isInteger(f.shown)).length, distinct = new Set(rlog.map((f) => f.shown)).size;
  check(d.every((x) => x === '0s') && p.shown > 4 && rlog.length >= 2 && frac === 0 && distinct === rlog.length,
    `every animation at zero duration (the tracer ${d[0]}, About ${d[1]}); play plays whole steps: ${rlog.length} drawn frames in 1.5 s, ${frac} at a fractional step, each a new step (4 → ${p.shown})`);
  await w(() => window.__gw.setTime(12)); await settle(page, 300);
  await A.shot('reduced-dark');
  check(A.errors.length === 0, `Reduce Motion: no console error or warning${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
}

/* The snapshot: missing, broken, the wrong schema, a short plane, stale; and a replacement while open */
console.log('\n== snapshots');
{
  const variant = (fn) => { const d = JSON.parse(SNAP_TEXT); fn(d); return JSON.stringify(d); };
  const cases = [
    ['missing', { status: 404 }, /^data\/snapshot\.json could not be read \(HTTP 404\)$/, /404|requestfailed .*\/data\/snapshot\.json/],
    ['not JSON', { body: '<html>Bad gateway</html>' }, /is not valid JSON; it looks like a web page was written over it/],
    ['schema 2', { body: variant((d) => { d.schema = 2; }) }, /it is a schema 2 snapshot — that is Global Weather’s file/],
    ['a short plane', { body: variant((d) => { d.steps[3].speed = zlib.deflateSync(Buffer.alloc(100)).toString('base64'); }) }, /step 3 speed unpacks to 100 points, the grid has 16380/],
  ];
  for (const [name, ov, re, expect] of cases) {
    snapOverride = ov;
    const A = await open('light', { noWait: true, expect: expect || /^$/ });
    await A.page.waitForFunction(() => !document.getElementById('error').hidden, null, { timeout: 30000 });
    const e = await A.w(() => ({ text: document.getElementById('error').textContent, stamp: document.getElementById('stamp').textContent, flow: window.__gw.flow.state().on }));
    check(re.test(e.text) && !e.flow && !/Updated/.test(e.stamp) && A.errors.length === 0, `${name}: "${e.text.slice(0, 110)}"; the stamp says "${e.stamp}"; no flow${A.errors.length ? '; ' + A.errors.join(' | ') : ''}`);
    await A.ctx.close();
  }
  // stale: the forecast still covers now, but the job last ran three days ago
  snapOverride = { body: variant((d) => { const shift = Date.now() - Date.parse(d.steps[0].validTime) - 24 * 3600e3; for (const st of d.steps) st.validTime = new Date(Date.parse(st.validTime) + shift).toISOString(); d.run = new Date(Date.parse(d.run) + shift).toISOString(); d.generatedAt = new Date(Date.now() - 72 * 3600e3).toISOString(); }) };
  {
    const A = await open('light');
    const s = await S(A.w);
    check(/^Stale\. Updated /.test(s.stamp) && A.errors.length === 0, `stale: the stamp leads with the sentence: "${s.stamp}"`);
    await A.ctx.close();
  }
  // plan 0012 (HOUSE §4.15, §7.2): the stamp is one line, 16 px tall, in every state its function can write:
  // fresh today, fresh on another day, each lead alone (stale; ran out), and the longest a lead and a date make
  {
    const shifted = (d, firstValid) => { const shift = firstValid - Date.parse(d.steps[0].validTime); for (const st of d.steps) st.validTime = new Date(Date.parse(st.validTime) + shift).toISOString(); d.run = new Date(Date.parse(d.run) + shift).toISOString(); };
    const now = Date.now(), H1 = 3600e3, span = (d) => Date.parse(d.steps[d.steps.length - 1].validTime) - Date.parse(d.steps[0].validTime);
    const day28 = new Date(new Date(now).getFullYear(), new Date(now).getMonth() - 1, 28, 23, 59).getTime();
    const states = [
      ['fresh today', /^Updated \d\d:\d\d$/, (d) => { shifted(d, now - H1); d.generatedAt = new Date(now - 60e3).toISOString(); }],
      ['fresh, another day', /^Updated \d+ [A-Z][a-z]{2}, \d\d:\d\d$/, (d) => { shifted(d, now - 24 * H1); d.generatedAt = new Date(now - 26 * H1).toISOString(); }],
      ['stale', /^Stale\. Updated \d+ [A-Z][a-z]{2}, \d\d:\d\d$/, (d) => { shifted(d, now - 24 * H1); d.generatedAt = new Date(now - 72 * H1).toISOString(); }],
      ['ran out, the longest', /^Forecast ran out 23\u202Fh ago\. Updated 28 [A-Z][a-z]{2}, 23:59$/, (d) => { shifted(d, now - 23 * H1 - span(d)); d.generatedAt = new Date(day28).toISOString(); }],
    ];
    const got = [];
    for (const [name, re, fn] of states) {
      snapOverride = { body: variant(fn) };
      const A = await open('light');
      const st = await A.w(() => { const e = document.getElementById('stamp'), r = e.getBoundingClientRect(); return { t: e.textContent, h: r.height, lines: e.getClientRects().length }; });
      got.push([name, st.t, st.h, re.test(st.t) && Math.abs(st.h - 16) <= 1 && A.errors.length === 0]);
      await A.ctx.close();
    }
    snapOverride = null;
    check(got.every((g) => g[3]), `the stamp is one line at 390 × 844 in every state it can write: ${got.map(([n, t, h]) => `${n} "${t}" ${h.toFixed(1)} px`).join('; ')} (want 16 ± 1 px)`);
  }
  // a replacement while open keeps the view, the step and the flow
  snapOverride = null;
  {
    const A = await open('dark');
    await A.w(() => { window.__gw.setTab('globe'); window.__gw.setTime(17); });
    await settle(A.page, 400);
    const before = await S(A.w);
    snapOverride = { body: variant((d) => { d.generatedAt = new Date(Date.parse(d.generatedAt) + 3600e3).toISOString(); }) };
    await A.w(() => document.dispatchEvent(new Event('visibilitychange')));
    await A.page.waitForFunction((g) => window.__gw.state.stamp !== g, before.stamp, { timeout: 30000 });
    await settle(A.page, 500);
    const after = await S(A.w), f = await FS(A.w);
    check(after.tab === 'globe' && after.shown === 17 && f.on && after.stamp !== before.stamp && A.errors.length === 0, `a snapshot replaced while open: the stamp "${before.stamp}" → "${after.stamp}"; still the globe, step ${after.shown}, the flow on`);
    snapOverride = { body: '{"message":"Bad credentials"}' };
    await A.w(() => document.dispatchEvent(new Event('visibilitychange')));
    await A.page.waitForFunction(() => !document.getElementById('error').hidden, null, { timeout: 30000 });
    const bad = await A.w(() => ({ text: document.getElementById('error').textContent, flow: window.__gw.flow.state().on, step: window.__gw.state.shown }));
    check(/a service's reply \(“Bad credentials”\)/.test(bad.text) && bad.flow && bad.step === 17, `a broken replacement keeps the forecast it had and its flow, and says so: "${bad.text.slice(0, 100)}…"`);
    snapOverride = null;
    await A.ctx.close();
  }
}

/* A library left by Global Wind 1.0: its seven keys, in the shapes 1.0 wrote, are read as they are */
console.log('\n== a Global Wind 1.0 library');
{
  const A = await open('light', { init: () => { try {
    localStorage.setItem('gw.view', JSON.stringify({ cx: 0.31, cy: 0.42, scale: 900 }));
    localStorage.setItem('gw.globe', JSON.stringify({ lon: 30, lat: 10, r: 220 }));
    localStorage.setItem('gw.tab', 'globe'); localStorage.setItem('gw.units', 'kt'); localStorage.setItem('gw.heat', '0');
    localStorage.setItem('gw.night', '0'); localStorage.setItem('gw.marker', JSON.stringify({ lon: 10, lat: 50 }));
  } catch { /* fine */ } } });
  await settle(A.page, 600);
  const s = await S(A.w);
  const card = await A.w(() => !document.getElementById('readout').hidden && document.getElementById('readout-unit').textContent);
  check(s.tab === 'globe' && s.units === 'kt' && s.heat === false && s.night === false && s.marker && s.marker.lon === 10 && s.map.cx === 0.31 && s.map.scale === 900 && s.globe.lon === 30 && s.globe.r === 220 && s.unitKey === 'kt' && card === `${NN}kt` && s.flow && A.errors.length === 0,
    `the 1.0 keys keep their names and shapes: globe tab, knots (the key and the card say "${s.unitKey}"), speed colors off, night off, the marker at 50° N 10° E, the map at cx 0.31 / scale 900 and the globe at 30° E / r 220 restored; the flow, new, is on (${s.flow})`);
  await A.ctx.close();
}

/* Widths and zoom: nothing scrolls sideways; the header's row of words fits */
console.log('\n== widths');
for (const [w0, h0, dpr, name] of [[320, 568, 2, '320'], [360, 740, 3, '360'], [375, 667, 2, '375'], [844, 390, 3, '844 × 390'], [312, 675, 2.5, '125 % zoom (312 × 675)']]) {
  const A = await open('light', { w: w0, h: h0, dpr });
  await settle(A.page, 400);
  const m = await A.w(() => { const L = document.getElementById('switcher'), hb = document.getElementById('btn-heat').getBoundingClientRect(), gb = document.getElementById('tab-globe').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, row: L.scrollWidth, rowW: L.clientWidth, apart: hb.left - gb.right, inside: hb.right <= innerWidth, player: document.getElementById('player').getBoundingClientRect().bottom, ih: innerHeight, plate: document.getElementById('map').getBoundingClientRect().height }; });
  const h = await hitTargets(A.w);
  // after review: the exposure line's height is fixed; its longest words must fit it at every width
  const fit = await A.w((nn) => {
    const e = document.getElementById('exposure'), keep = e.textContent, out = [];
    for (const t of [`Streaks: 1${nn}s = 2 days of wind at the hour shown, faster toward the poles, where the map stretches`, `Arrows: length and weight grow with wind speed up to 25.0${nn}m/s`]) { e.textContent = t; out.push([e.scrollHeight, e.clientHeight]); }
    e.textContent = keep;
    return out;
  }, NN);
  check(fit.every(([sh, ch]) => sh <= ch), `${name}: the longest exposure lines fit the line's fixed height (${fit.map(([sh, ch]) => `${sh} in ${ch} px`).join(', ')})`);
  if (name === '844 × 390') {
    const land = await A.w(async () => { const k = document.getElementById('keys').getBoundingClientRect(); window.__gw.setTab('globe'); await new Promise((r) => setTimeout(r, 300)); const s = window.__gw.state; window.__gw.setTab('map'); return { H: s.H, r: s.globe.r, keysH: k.height, row: document.getElementById('map-wrap').classList.contains('keys-row') }; });
    check(land.H >= 220 && land.row && land.keysH <= 40 && 2 * land.r <= land.H, `a phone on its side: the plate ${land.H} px tall (≥ 220), the keys one row ${land.keysH} px high, the globe's disc ${(2 * land.r).toFixed(0)} px inside it`);
  }
  check(m.sw <= m.iw && m.row <= m.rowW && m.apart >= 0 && m.inside && m.player <= m.ih + 0.5 && m.plate >= 120 && h.bad.length === 0 && A.errors.length === 0,
    `${name}: page ${m.sw} px wide in ${m.iw}; the row Map, Globe … Speed colors ${m.row} px in ${m.rowW} (fits, ${m.apart.toFixed(0)} px between Globe and Speed colors); the player ends at ${m.player.toFixed(0)} of ${m.ih}; the plate ${m.plate.toFixed(0)} px tall; ${h.n} hit targets ≥ 44${h.bad.length ? '; too small: ' + h.bad.join('; ') : ''}`);
  if (name === '320') await A.shot('narrow-light', false);
  if (name === '844 × 390') { await A.shot('landscape-light', false); await A.w(() => window.__gw.setTab('globe')); await settle(A.page, 600); await A.shot('landscape-globe-light', false); }
  await A.ctx.close();
}

await browser.close();
server.close();
const appAfter = fs.existsSync(appPng) ? crypto.createHash('sha256').update(fs.readFileSync(appPng)).digest('hex') : null;
check(appAfter === appPngHash, `screenshots/app.png (the README's composite) untouched: ${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent'}`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n  - ${fails.join('\n  - ')}`); process.exit(1); }
console.log('\nall checks pass');
