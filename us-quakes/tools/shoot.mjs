// Drive US Quakes in headless Chromium at phone size (390 × 844 CSS px, DPR 2, touch), light and dark
// (DESIGN §16, ART.md change list item 17). Fails on any console error or warning, page error, failed
// request, HTTP ≥ 400, any request that is not to the local server, and any data: or blob: request.
// Every count and window it asserts is computed here from the shipped files with Node's own zlib and
// typed arrays (and the section corridor with its own float64 maths), never with js/*.js, so a bug in
// the app cannot agree with itself. Frame times are SwiftShader's: a trend, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs [outdir]
//   SCHEMES=light node tools/shoot.mjs          one theme
//
// Scenes, in each theme: Live Lower 48 Month and Week, Alaska Month, the Live and History strips, History
// All M 2.5+ and M 4+, the stub before 1900 (× and grey), the nine region chips, the 1964 story with its
// card and annotation, a story's sequence (three steps and more, each label = the drawn window), the four
// section presets (Cook Inlet: ≥ 1 000 plotted, deepest ≥ 150 km, the M 7.1 highlighted; every count
// against this file's own corridor), a section drawn by a drag with the dimming measured in pixels, a tap
// on Ridgecrest, a long press, a fault and a volcano tap, Layers off and on, the legend card, About
// (sources, quotes, dates, fonts, units, the five-tap readout), US units, a forced loss of each WebGL
// context, a new snapshot arriving (the "new since" line; nothing animates but opacity), reload
// persistence, pausing when hidden, hit targets, text contrast and "chrome is ink", the landscape layout,
// focus mode (entered by its key: what hides is hidden, inert and out of the accessibility tree, the map
// grows, the credit line stays; the Live strip picks an event whose card opens over the map; the History
// strip scrubs, a window steps, a tap on the map; out by the key and by Escape; a reload; Reduce Motion).
// Once: Play for a decade and a sliding decade; through real CDP touches and keys, a story opened after
// another's sequence ran out, rotation from a marked chip, a drag along the Live strip at Peek, a long
// press near the foot, a hollow ring's empty centre and a section drawn from the keyboard; a gap, a stale
// (its windows named against the feed), a broken and a missing snapshot, a volcano status never read, the
// opening (watched to its end in light, ended by a touch in dark, never twice, never under Reduce Motion,
// never without a snapshot), no WebGL 2 (the tool keys' computed display is none; not one pixel of map). The lead's pass (DESIGN
// §25) adds: the default framings map to their edges (the Lower 48 at Peek and in focus mode, the nine chips, Alaska in focus
// mode: the panel inside geo.json's basemap, no hatching); focus mode by a pointer moves no focus and draws no ring, by keys it
// does; a 2D hollow ring (drawDot) whole at 0°, 5° and all round; US units in the depth legend and the section's 10 km key;
// Escape takes back a pending keyboard A, and a drawn section ends it; the Live pen's nib clear of the count label; labels
// placed again once the foot has moved (no label ink under it after Peek → Half). Writes screenshots/app.png,
// live-{light,dark}.png, focus-live-{light,dark}.png and focus-history-{light,dark}.png too.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); } catch (e) {
  console.error(`Playwright could not be loaded (${e.code || e.message}): set PLAYWRIGHT_MODULE to a playwright/index.mjs.`); process.exit(4);
}
const chromium = pw.chromium || pw.default.chromium;
const out = path.resolve(process.argv[2] || path.join(APP, 'tools', '.work', 'shots'));
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(APP, 'screenshots'), { recursive: true });
const schemes = (process.env.SCHEMES || 'light,dark').split(',');

/* ── the data, decoded here independently ── */
const EPOCH = Date.UTC(1600, 0, 1), minOf = (iso) => Math.floor((Date.parse(iso) - EPOCH) / 60000);
const hj = JSON.parse(fs.readFileSync(path.join(APP, 'assets/history.json'), 'utf8'));
const hb = fs.readFileSync(path.join(APP, 'assets/history.bin'));
const col = (Ty, s) => new Ty(hb.buffer, hb.byteOffset + s.offset, s.count);
const H = { t: col(Uint32Array, hj.sections.t), x: col(Uint16Array, hj.sections.x), y: col(Uint16Array, hj.sections.y), d: col(Uint16Array, hj.sections.d), m: col(Uint8Array, hj.sections.m) };
const snapRaw = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'), snap = JSON.parse(snapRaw);
const unz = (sec) => zlib.inflateSync(Buffer.from(sec.data, 'base64'));
const zz = (buf) => zlib.deflateSync(buf).toString('base64');
const typed = (Ty, sec) => { const b = unz(sec); return new Ty(b.buffer, b.byteOffset, b.byteLength / Ty.BYTES_PER_ELEMENT); };
const Sc = { t: typed(Uint32Array, snap.rows.columns.t), x: typed(Uint16Array, snap.rows.columns.x), y: typed(Uint16Array, snap.rows.columns.y), d: typed(Uint16Array, snap.rows.columns.d), m: typed(Uint8Array, snap.rows.columns.m) };
const cutoff = minOf(hj.cutoff + 'T00:00:00Z'), NOW = Math.max(snap.rows.to, cutoff);
const R = { t: [], x: [], y: [], d: [], m: [] };
for (const k of Object.keys(R)) { for (let i = 0; i < H.t.length; i++) R[k].push(H[k][i]); for (let i = 0; i < Sc.t.length; i++) if (Sc.t[i] >= cutoff) R[k].push(Sc[k][i]); }
const T = R.t, Mg = R.m, N = T.length;
const count = (t0, t1, f) => { let n = 0; for (let i = 0; i < N; i++) if (T[i] >= t0 && T[i] < t1 && Mg[i] !== 255 && Mg[i] >= f) n++; return n; };
const countX = (t0, t1) => { let n = 0; for (let i = 0; i < N; i++) if (T[i] >= t0 && T[i] < t1 && Mg[i] === 255) n++; return n; };
const nb = (n) => n.toLocaleString('en-US').replace(/,/g, '\u202f');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const Y = (y, m = 0) => Math.floor((Date.UTC(y, m, 1) - EPOCH) / 60000);
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (min) => { const d = new Date(EPOCH + min * 60000); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
/** The window a History label names, worked out from its words alone. */
function windowOf(label) {
  const to = / \(to [^)]+\)$/.test(label), L = label.replace(/ \(to [^)]+\)$/, '');
  let w, m;
  if (L === 'Before 1900') w = [Y(1600), Y(1900)];
  else if ((m = L.match(/^All, \d{4}–\d{4}$/))) w = [Y(1600), NOW + 1];
  else if ((m = L.match(/^(\d{4}-\d\d-\d\d) to (\d{4}-\d\d-\d\d)$/))) w = [minOf(m[1] + 'T00:00:00Z'), minOf(m[2] + 'T00:00:00Z') + 1440];
  else if ((m = L.match(/^(\d{4})–(\d{4})$/))) w = [Y(+m[1]), Y(+m[2] + 1)];
  else if ((m = L.match(/^(\d{4})s$/))) w = [Y(+m[1]), Y(+m[1] + 10)];
  else if ((m = L.match(/^([A-Z][a-z]+) (\d{4})$/))) w = [Y(+m[2], MONTHS.indexOf(m[1])), Y(+m[2], MONTHS.indexOf(m[1]) + 1)];
  else if ((m = L.match(/^(\d{4})$/))) w = [Y(+m[1]), Y(+m[1] + 1)];
  else return null;
  if (to) w[1] = NOW + 1;
  return w;
}
/** The corridor, float64, written here from DESIGN §9.2 (not imported): {n, j (no depth), deep}. */
function corridor(A, B, half, t0, t1, f) {
  const rad = Math.PI / 180, RK = 6371.0088, u = (lon, lat) => [Math.cos(lat * rad) * Math.cos(lon * rad), Math.cos(lat * rad) * Math.sin(lon * rad), Math.sin(lat * rad)];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const a = u(...A), b = u(...B), c = cr(a, b), l = Math.hypot(...c), n = c.map((v) => v / l), len = Math.acos(dt(a, b)) * RK;
  let k = 0, j = 0, deep = 0;
  for (let i = 0; i < N; i++) {
    if (T[i] < t0 || T[i] >= t1 || Mg[i] === 255 || Mg[i] < f) continue;
    const p = u(172 + 0.002 * R.x[i], 17 + 0.001 * R.y[i]), pn = dt(p, n), q = p.map((v, z) => v - pn * n[z]);
    const xt = Math.asin(pn) * RK, at = Math.atan2(dt(cr(a, q), n), dt(q, a)) * RK;
    if (Math.abs(xt) > half || at < 0 || at > len) continue;
    k++;
    if (R.d[i] === 65535) j++; else deep = Math.max(deep, R.d[i] / 100 - 5);
  }
  return { n: k, j, deep, len };
}
/** A copy of the demo snapshot with every time moved by D minutes (the gap, stale and arrival scenes). */
function shifted(D) {
  const s = JSON.parse(snapRaw), iso = (x) => new Date(Date.parse(x) + D * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
  const t = typed(Uint32Array, s.rows.columns.t).map((v) => v + D), u = typed(Uint32Array, s.rows.live.updated).map((v) => v + D);
  s.rows.columns.t.data = zz(Buffer.from(t.buffer)); s.rows.live.updated.data = zz(Buffer.from(u.buffer));
  for (const k of ['from', 'liveFrom', 'to']) s.rows[k] += D;
  s.generatedAt = iso(s.generatedAt); s.feed.generated = iso(s.feed.generated);
  return JSON.stringify(s);
}
const about = JSON.parse(fs.readFileSync(path.join(APP, 'assets/about.json'), 'utf8'));
const stories = JSON.parse(fs.readFileSync(path.join(APP, 'assets/stories.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(path.join(APP, 'assets/geo.json'), 'utf8'));

/* ── the server: the app folder, with data/snapshot.json replaceable per scene ── */
let snapOverride = null, expectErr = null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/data/snapshot.json' && snapOverride) {
    if (snapOverride.status === 404) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(snapOverride.body); return;
  }
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// The one message tolerated: SwiftShader's notice when Playwright reads the frame back for a screenshot.
const NOISE = /GPU stall due to ReadPixels/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

/**
 * A fresh context. The opening runs once on a first launch (ART.md), so every scene but the opening's
 * starts with uq.intro stored, as a second launch would.
 */
async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  if (!o.intro) await ctx.addInitScript(() => { try { if (!localStorage.getItem('uq.intro')) localStorage.setItem('uq.intro', 'true'); } catch { /* none */ } });
  if (o.init) await ctx.addInitScript(o.init);
  const page = await ctx.newPage(), errors = [], reqs = [];
  const ok = (t) => NOISE.test(t) || (expectErr && expectErr.test(t));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !ok(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!ok(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !(snapOverride && snapOverride.status === 404 && r.url().endsWith('/data/snapshot.json'))) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { const u = r.url(); reqs.push(u); if (!u.startsWith(origin)) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${u.slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  await page.waitForFunction(() => window.__uq && window.__uq.ready(), null, { timeout: 120000 });
  const ms = Date.now() - t0;
  const uq = (fn, arg) => page.evaluate(fn, arg);
  const settle = () => uq(() => window.__uq.settled());
  if (!o.intro) await settle();
  const shot = async (name, file) => { await settle(); await page.waitForTimeout(300); const p = file || path.join(out, `${name}-${scheme}.png`); await page.screenshot({ path: p }); console.log(`  ${path.basename(p)}`); };
  return { ctx, page, errors, reqs, uq, shot, settle, ms };
}
/** State, with the label, the largest row, the card and the notices read from the page itself. */
const S = (uq) => uq(() => {
  const s = window.__uq.state(), q = (sel) => { const e = document.querySelector(sel); return e ? e.textContent : null; };
  const card = document.querySelector('#body .card:not(.story-card)');
  return { ...s, label: q(s.mode === 'live' ? '#stamp' : '#hlabel'), largest: q('#largest'), notices: q('#notices'), card: card && card.innerText, story_card: q('#body .story-card'), body: q('#body') };
});
/** The History label's words against this file's arithmetic, and against what the GPU drew. */
function labelMatches(s, floorCode) {
  const bold = s.win.label, w = windowOf(bold);
  const n = w ? count(w[0], w[1], floorCode) : -1, x = w && w[0] < Y(1900) ? countX(w[0], w[1]) : 0;
  const want = `${bold} · M ${{ 45: '2.5', 60: '4', 70: '5', 80: '6' }[floorCode]}+ · ${nb(n)} earthquake${n === 1 ? '' : 's'} · `, tail = ` · ${nb(x)} × without magnitude`;
  const drawnOk = w && s.drawn && s.drawn.t0 === w[0] && s.drawn.t1 === Math.min(w[1], NOW + 1) && s.drawn.floor === floorCode;
  const xOk = x ? s.label.endsWith(tail) : !s.label.includes('×');
  return { ok: !!w && s.label.startsWith(want) && xOk && drawnOk, want: want + (x ? `… in view${tail}` : ''), got: s.label, drawn: s.drawn && { t0: s.drawn.t0, t1: s.drawn.t1, floor: s.drawn.floor }, w };
}
const tap = (uq, lon, lat) => uq(([lon, lat]) => { const { M, tapAt } = window.__uq._; tapAt(...M.toScreen(lon < 172 ? lon + 360 : lon, lat)); return window.__uq.settled(); }, [lon, lat]);
/** The earthquake layer's alpha summed over a screen rectangle, read in the frame that drew it. */
const glAlpha = (uq, rect) => uq((r) => new Promise((res) => {
  window.__uq._.req('gl');
  requestAnimationFrame(() => {
    const g = document.getElementById('gl'), k = g.width / g.clientWidth, c = document.createElement('canvas');
    c.width = g.width; c.height = g.height; const x = c.getContext('2d'); x.drawImage(g, 0, 0);
    const d = x.getImageData(Math.round(r[0] * k), Math.round(r[1] * k), Math.round(r[2] * k), Math.round(r[3] * k)).data;
    let a = 0; for (let i = 3; i < d.length; i += 4) a += d[i];
    res(a / 255);
  });
}), rect);

/**
 * The relief over land, read from #relief in the frame that drew it and composited over --land: the 5th,
 * 50th and 95th percentile luminance over the western US (124°W–104°W, 32°N–48°N) and the 5th's WCAG
 * ratio against bare land. The relief is the only thing on that canvas, so the other layers do not count.
 */
const reliefLand = (uq) => uq(() => new Promise((res) => {
  window.__uq._.req('relief');
  requestAnimationFrame(() => {
    const { M } = window.__uq._, land = getComputedStyle(document.documentElement).getPropertyValue('--land').trim(), L = [1, 3, 5].map((i) => parseInt(land.slice(i, i + 2), 16) / 255);
    const g = document.getElementById('relief'), k = g.width / g.clientWidth, c = document.createElement('canvas'); c.width = g.width; c.height = g.height;
    const x = c.getContext('2d'); x.drawImage(g, 0, 0);
    const [x0, y0] = M.toScreen(236, 48), [x1, y1] = M.toScreen(256, 32), d = x.getImageData(Math.round(x0 * k), Math.round(y0 * k), Math.round((x1 - x0) * k), Math.round((y1 - y0) * k)).data;
    const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4), Y = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]), lum = [];
    for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; lum.push(Y([0, 1, 2].map((j) => (d[i + j] / 255) * a + L[j] * (1 - a)))); }
    lum.sort((a, b) => a - b);
    const q = (p) => lum[Math.floor(p * (lum.length - 1))], bare = Y(L);
    res({ p5: q(0.05), p50: q(0.5), p95: q(0.95), land: bare, ratio: (bare + 0.05) / (q(0.05) + 0.05), dark: cssDark() });
    function cssDark() { return getComputedStyle(document.documentElement).getPropertyValue('--relief-dark').trim(); }
  });
}));
/** Every visible control's hit area: the run of points through its centre that land on it, 1 px apart, ≥ 44 px tall, and as wide unless it is a segment. */
const hitTargets = (uq) => uq(() => {
  const bad = [], seen = [];
  for (const e of document.querySelectorAll('button, [role="slider"], [role="button"], #over')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]')) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight || !at(cx, cy)) continue;
    seen.push(e);
    // the span, sampled every 0.5 px, of points through the centre that land on it: ≥ 43.5 is 44 px within the sampling
    const inSeg = !!e.closest('.seg'), run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 120 && at(cx + (s * k * dx) / 2, cy + (s * k * dy) / 2); k++) n++; return n / 2; };
    const okV = r.height >= 44 || run(0, 1) >= 43.5;
    const okH = inSeg || r.width >= 44 || run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Text contrast ≥ 4.5:1 over every rendered text style (glass composited over the page ground). */
const contrastOf = (uq) => uq(() => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const v = m ? m[1].split(/[ ,/]+/).map(Number) : [0, 0, 0, 0]; return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
  const L = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const over = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const ground = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } } let bg = ground; for (const c of stack.reverse()) bg = over(c, bg); return bg; };
  let worst = [99, ''], n = 0;
  const styles = new Set();
  for (const e of document.querySelectorAll('#top *, #sheet *, #foot *, #chips *, #tools *, #layers *, #about *, #perf')) {
    if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || e.closest('[hidden]')) continue;
    const cs = getComputedStyle(e), bg = bgOf(e), fg = over(rgba(cs.color), bg), k = (Math.max(L(fg), L(bg)) + 0.05) / (Math.min(L(fg), L(bg)) + 0.05);
    styles.add(`${cs.color}|${bg.join()}|${cs.fontSize}|${cs.fontWeight}`); n++;
    if (k < worst[0]) worst = [k, `${e.tagName}.${e.className} "${e.textContent.trim().slice(0, 24)}" ${cs.color}`];
  }
  return { worst, n, styles: styles.size };
});
/** Chrome is ink: the most chromatic computed colour on a chrome element (OKLCh chroma). */
const chromaOf = (uq) => uq(() => {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const C = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return 0; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).map(Number); if (!a) return 0;
    const [R2, G, B] = [r, g, b].map((v) => lin(v / 255));
    const l = Math.cbrt(0.4122214708 * R2 + 0.5363325363 * G + 0.0514459929 * B), mm = Math.cbrt(0.2119034982 * R2 + 0.6806995451 * G + 0.1073969566 * B), ss = Math.cbrt(0.0883024619 * R2 + 0.2817188376 * G + 0.6299787005 * B);
    return Math.hypot(1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * ss, 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * ss); };
  let worst = [0, ''];
  for (const e of document.querySelectorAll('#top, #top *, #sheet, #sheet *, #chips *, #foot *, #tools *, #focus-exit, #layers, #layers *, #about, #about *')) {
    if (e.closest('canvas, svg') || e.tagName === 'CANVAS') continue;
    const cs = getComputedStyle(e);
    for (const k of ['color', 'backgroundColor', 'borderTopColor']) { const c = C(cs[k]); if (c > worst[0]) worst = [c, `${e.tagName}#${e.id}.${e.className} ${k} ${cs[k]}`]; }
  }
  return worst;
});
const worstContrast = { light: [99, ''], dark: [99, ''] };
/** The panel above the sheet against geo.json's basemap: inside means no hatching can show (DESIGN §4.2, §25). */
const inBase = (uq) => uq(() => {
  const { M, A } = window.__uq._, b = A.G.basemap, map = document.getElementById('map').getBoundingClientRect(), sh = document.getElementById('sheet').getBoundingClientRect();
  const bottom = (matchMedia('(min-width: 700px)').matches && !window.__uq.state().focus ? map.bottom : Math.min(map.bottom, sh.top)) - map.top;
  const [w, n] = M.toLonLat(0, 0), [e, s] = M.toLonLat(map.width, bottom), t = 1e-6;
  return { inside: w >= b.west - t && e <= b.east + t && s >= b.south - t && n <= b.north + t, span: `${s.toFixed(1)}° to ${n.toFixed(1)}° N, ${w.toFixed(1)} to ${e.toFixed(1)} on the axis` };
});
const baseText = `the basemap, ${geo.basemap.south}° to ${geo.basemap.north}° N and ${geo.basemap.west} to ${geo.basemap.east} on the axis`;

for (const scheme of schemes) {
  console.log(`\n== ${scheme} ==`);
  const P = await open(scheme);
  const { uq, shot, page, settle } = P;
  const load = await uq(() => window.__uq._.perf.load);
  console.log(`  ready ${P.ms} ms after navigation; load marks ${JSON.stringify(load)} (SwiftShader, trend only)`);
  const goto = (o) => uq((o) => window.__uq.goto(o), o);
  const contrast = async (where) => { await page.waitForTimeout(200); const c = await contrastOf(uq); if (c.worst[0] < worstContrast[scheme][0]) worstContrast[scheme] = [c.worst[0], `${where}: ${c.worst[1]}`]; return c; };

  // 1. Live, Lower 48, Month and Week
  await goto({ mode: 'live', window: 'month', liveAll: true, view: 'lower-48' });
  let s = await S(uq);
  const liveN = count(snap.rows.to - 30 * 1440, snap.rows.to + 1, 0), weekN = count(snap.rows.to - 7 * 1440, snap.rows.to + 1, 0);
  const gen = new Date(snap.feed.generated), hm = `${pad(gen.getUTCHours())}:${pad(gen.getUTCMinutes())}`;
  check(s.label.startsWith(`USGS feed ${hm} UTC`) && s.count === liveN, `Live Month: stamp "${s.label}", ${s.count} earthquakes drawn (this file counts ${liveN} in the 30 days before the feed's minute)`);
  const credit = await uq(() => document.getElementById('credit').textContent);
  check(credit.startsWith('Not a warning service'), `the map's credit line leads with "${credit}"`);
  // the map's description sits on #over (a leaf), not on <main>, whose chips and keys stay reachable;
  // the Live strip is named by its count
  const names = await uq(() => ({ main: document.getElementById('map').getAttribute('role'), over: document.getElementById('over').getAttribute('role'),
    label: document.getElementById('over').getAttribute('aria-label'), strip: document.getElementById('strip-live').getAttribute('aria-label') }));
  check(names.main === null && names.over === 'img' && names.label.startsWith(`Map of Lower 48, Live, the past 30 days, all sizes, ${nb(liveN)} earthquakes. `)
    && names.strip.startsWith(`Record strip, the past 30 days: ${nb(liveN)} earthquakes`) && / largest M \d\.\d, /.test(names.strip),
    `accessible names: <main> a plain landmark, #over "${names.label.slice(0, 60)}…", the Live strip "${names.strip}"`);
  await page.waitForFunction(() => window.__uq._.perf.load.relief != null, null, { timeout: 10000 });
  const rl = await reliefLand(uq);
  check(scheme === 'dark' || rl.ratio >= 1.4, `the relief over the western US's land (uDark ${rl.dark}): luminance p5 ${rl.p5.toFixed(3)} · p50 ${rl.p50.toFixed(3)} · p95 ${rl.p95.toFixed(3)} against bare land ${rl.land.toFixed(3)}; its shaded 5th percentile ${rl.ratio.toFixed(2)}:1 against land${scheme === 'light' ? ' (≥ 1.40)' : ''}`);
  const ib1 = await inBase(uq);
  check(ib1.inside, `the Lower 48 at Peek is map to its edges: it shows ${ib1.span}, inside ${baseText}, so no hatching`);
  await shot('live-lower48-month');
  await shot('live', path.join(APP, 'screenshots', `live-${scheme}.png`));
  await page.locator('#head').screenshot({ path: path.join(out, `strip-live-${scheme}.png`) });
  await goto({ mode: 'live', window: 'week', view: 'lower-48' });
  s = await S(uq);
  check(s.count === weekN && /· \d+ (min|h|days?) ago/.test(s.label), `Live Week: ${s.count} earthquakes (this file: ${weekN}), stamp "${s.label}"`);
  await shot('live-lower48-week');
  await goto({ mode: 'live', window: 'month', view: 'alaska' });
  s = await S(uq);
  check(s.chip === 'alaska' && s.view.s > 1000, `Live Alaska Month: chip ${s.chip}, view s ${Math.round(s.view.s)}`);
  await shot('live-alaska-month');

  // 2. History: All at M 2.5+ and 4+, the stub before 1900, the History strip
  for (const [fl, code] of [[2.5, 45], [4, 60]]) {
    await goto({ mode: 'history', window: 'all', floor: fl, view: 'lower-48' });
    s = await S(uq);
    const lm = labelMatches(s, code);
    check(lm.ok, `History All M ${fl}+: "${s.label}"${lm.ok ? '' : ` (expected "${lm.want}")`}`);
    await shot(`history-all-m${fl}`);
  }
  await page.locator('#head').screenshot({ path: path.join(out, `strip-history-${scheme}.png`) });
  await goto({ mode: 'history', window: 'year', floor: 2.5, at: '1811-12-16', view: 'lower-48' });
  s = await S(uq);
  const lmStub = labelMatches(s, 45);
  const stubLines = await uq(() => Math.round(document.getElementById('hlabel').getBoundingClientRect().height / 13));
  check(lmStub.ok && / · 180 × without magnitude$/.test(s.label) && s.drawn.noMag && stubLines === 3, `the stub: "${s.label}" in ${stubLines} lines (window, counts, the × apart), × drawn for rows without a magnitude`);
  await shot('stub-before-1900');

  // 3. The nine region chips: each fits its box into the free part of the map
  const chipN = await uq(() => document.querySelectorAll('#chips button').length);
  let chipBad = [], chipOut = [];
  for (let k = 0; k < chipN; k++) {
    await uq((k) => document.querySelectorAll('#chips button')[k].click(), k);
    await settle();
    const ibk = await inBase(uq);
    if (!ibk.inside) chipOut.push(`${k} ${ibk.span}`);
    const c = await uq(() => { const { M } = window.__uq._, s = window.__uq.state(), v = window.__uq._.A.G.views.find((q) => q.key === s.chip), r = M.visible();
      const [x0, y0] = M.toScreen(v.west, v.north), [x1, y1] = M.toScreen(v.east, v.south);
      return { key: s.chip, pressed: document.querySelector(`#chips [data-v="${s.chip}"]`).getAttribute('aria-pressed'), inside: x0 >= -1 && x1 <= r.x1 + 1 && y0 >= r.y0 - 1 && y1 <= r.y1 + 1, r, box: [x0, y0, x1, y1] }; });
    if (!c.inside || c.pressed !== 'true') chipBad.push(`${c.key} ${JSON.stringify(c.box.map(Math.round))}`);
    if (scheme === schemes[0] || k === 3) await shot(`chip-${c.key}`);
  }
  check(chipN === 9 && !chipBad.length, `the ${chipN} region chips each mark themselves and fit their box in the free map${chipBad.length ? ': ' + chipBad.join('; ') : ''}`);
  check(!chipOut.length, `the ${chipN} chips at Peek are map to their edges: each framing inside ${baseText}${chipOut.length ? ' — past it: ' + chipOut.join('; ') : ''}`);

  // 4. The 1964 story: window, floor, view, anchor, card text verbatim, the annotation
  await goto({ mode: 'live', view: 'lower-48', sheet: 'peek' });
  await uq(() => window.__uq._.A.openStory('alaska-1964'));
  await settle();
  s = await S(uq);
  const st64 = stories.stories.find((q) => q.id === 'alaska-1964');
  const lm64 = labelMatches(s, 60), anchorRow = await uq(() => { const A = window.__uq._.A; return A.C.textRows[A.C.ids.indexOf('official19640328033616_30')]; });
  check(lm64.ok && s.label.startsWith(`1964 · M 4+ · ${nb(count(Y(1964), Y(1965), 60))} earthquakes`) && s.chip === 'alaska' && s.sel === anchorRow && s.sheet === 'half',
    `story 1964: "${s.label}", chip ${s.chip}, the anchor (row ${anchorRow}) selected, sheet ${s.sheet}`);
  check(s.story_card && s.story_card.includes(st64.text) && s.story_card.includes('Play the sequence') && st64.sources.every((id) => { const q = stories.sources.find((x) => x.id === id); return s.story_card.includes(q.url); }),
    'the story card prints stories.json\'s text verbatim, its sources with their addresses, and Play the sequence');
  await shot('story-alaska-1964');
  // … its sequence: cumulative day windows every 300 ms, each label naming exactly what the GPU drew
  const seqSteps = await uq(async () => {
    const outS = [], t0 = performance.now(), A = window.__uq._.A;
    let prev = '';
    A.playSeq(A.story);
    while (performance.now() - t0 < 1900) {
      const s = window.__uq.state(), label = document.getElementById('hlabel').textContent;
      if (s.seq && s.seq.label !== prev && s.drawn && s.drawn.t1 === s.seq.t1) { outS.push({ ...s, label }); prev = s.seq.label; }
      await new Promise((r) => setTimeout(r, 20));
    }
    return outS;
  });
  let seqBad = 0;
  for (const q of seqSteps) if (!labelMatches(q, 60).ok) { seqBad++; console.log(`      step "${q.label}" expected "${labelMatches(q, 60).want}"`); }
  check(seqSteps.length >= 3 && !seqBad && seqSteps[0].win.label === '1964-03-27 to 1964-03-27' && seqSteps[2].win.label === '1964-03-27 to 1964-03-29',
    `Play the sequence: ${seqSteps.length} steps in 1.9 s (${seqSteps.slice(0, 4).map((q) => q.win.label.slice(14)).join(', ')} …), each label = the drawn window and its count`);
  await shot('story-sequence');
  await uq(() => window.__uq.goto({ mode: 'history' }));

  // 5. The four section presets, and Cook Inlet at Half over Alaska for screenshots/app.png
  await goto({ mode: 'history', view: 'alaska', sheet: 'half' });
  for (const p of geo.sections) {
    await uq((k) => window.__uq._.A.preset(k), p.key);
    await settle();
    const sc = await uq(() => { const { sec } = window.__uq._; return { plotted: sec.D && sec.D.rows.length, n: sec.D && sec.D.n, j: sec.D && sec.D.j, deep: sec.D && sec.D.deep, cap: sec.cap && sec.cap.textContent, plot: sec.cv && [sec.cv.width, sec.cv.height], ms: sec.ms }; });
    s = await S(uq);
    const want = corridor(p.a, p.b, 50, Y(1600), NOW + 1, 45);
    const on = await uq(() => [...document.querySelectorAll('#hist-win [aria-checked="true"], #floor [aria-checked="true"]')].map((b) => b.dataset.v).join());
    const okP = sc.n === want.n && sc.j === want.j && Math.abs(sc.deep - want.deep) < 1e-6 && s.win.label.startsWith('All') && s.floor === 45 && on === 'all,45' && s.drawn.sec;
    check(okP, `preset ${p.label}: ${sc.n} within ±50 km (this file: ${want.n}), ${sc.plotted} plotted, ${sc.j} without depth, deepest ${sc.deep} km, plot ${sc.plot} device px, ${sc.ms.toFixed(1)} ms; window All, floor 2.5+ shown`);
    if (p.key === 'cook-inlet') {
      const hi = await uq(() => window.__uq._.A.C.textRows[window.__uq._.A.C.ids.indexOf('ak018fcnsk91')]);
      const hiOk = await uq((hi) => window.__uq._.sec.P.pts.some((q) => q[0] === hi), hi);
      check(sc.plotted >= 1000 && sc.deep >= 150 && hiOk, `Cook Inlet: ${sc.plotted} plotted (≥ 1 000), deepest ${sc.deep} km (≥ 150), the 2018 M 7.1 (row ${hi}) plotted and called out`);
      await shot('section-cook-inlet');
      await uq(() => { const b = document.getElementById('body'); b.scrollTop = document.querySelector('.sec .seg[aria-label="Presets"]').offsetTop - b.offsetTop - 4; });
      if (scheme === 'light') await shot('app', path.join(APP, 'screenshots', 'app.png'));
      const plot = await uq(() => { const r = window.__uq._.sec.cv.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
      await page.screenshot({ path: path.join(out, `section-plot-${scheme}.png`), clip: { x: plot[0], y: Math.max(0, plot[1] - 60), width: plot[2], height: Math.min(844 - Math.max(0, plot[1] - 60), plot[3] + 120) } });
      // the stretch: 5× reads "Depth stretched 5×" on the plot; true scale again at 1×
      await uq(() => window.__uq._.A.secSet({ ve: 5 })); await settle();
      const h5 = await uq(() => window.__uq._.sec.cv.height);
      await uq(() => window.__uq._.A.secSet({ ve: 1 })); await settle();
      check(h5 > sc.plot[1], `the stretch 5× draws a taller plot (${h5} device px against ${sc.plot[1]} at 1×)`);
      // the 10 km key and the caption name the catalog's round 10 km, the miles after it in US units
      const k10 = async () => uq(() => ({ key: document.querySelector('.sec .quote .mono').textContent, cap: window.__uq._.sec.cap.textContent }));
      const si10 = await k10();
      await uq(() => window.__uq._.A.set({ units: 'us' })); await settle();
      const us10 = await k10();
      await uq(() => window.__uq._.A.set({ units: 'si' })); await settle();
      check(si10.key === '10 km' && / listed at 10 km · /.test(si10.cap) && us10.key === '10 km (6 mi)' && / listed at 10 km \(6 mi\) · /.test(us10.cap),
        `the section's 10 km key "${si10.key}" (US: "${us10.key}"), the caption's "${si10.cap.match(/[\d\u202f ]+ listed at [^·]+/)}" (US: "${us10.cap.match(/[\d\u202f ]+ listed at [^·]+/)}")`);
    } else await shot(`section-${p.key}`);
  }

  // 6. A section drawn by a drag over California, with the dimming outside the corridor measured
  await goto({ mode: 'history', window: 'decade', floor: 2.5, at: '2019-06-01', sheet: 'half' });
  await goto({ view: 'california' });
  await uq(() => window.__uq._.A.secSet({ on: false, a: null, b: null, hi: null }));
  await page.click('#section-btn');
  await settle();
  s = await S(uq);
  check(s.section.on && /^A—A′ Drag across the map to draw a section/.test(s.notices) && s.sheet === 'half', `Section on: the notice "${s.notices}", the sheet at Half`);
  await shot('section-hint');
  const [pa, pb] = await uq(() => { const { M } = window.__uq._, r = document.getElementById('over').getBoundingClientRect(); return [[-121.2, 39.3], [-118.2, 36.4]].map(([lo, la]) => { const [x, y] = M.toScreen(lo + 360, la); return [x + r.left, y + r.top]; }); });
  const far = await uq(() => { const { M } = window.__uq._, [x, y] = M.toScreen(-124.2 + 360, 40.4); return [x - 30, y - 30, 60, 60]; });  // Cape Mendocino, far outside
  const a0 = await glAlpha(uq, far);
  await page.mouse.move(pa[0], pa[1]); await page.mouse.down();
  for (let k = 1; k <= 16; k++) { await page.mouse.move(pa[0] + ((pb[0] - pa[0]) * k) / 16, pa[1] + ((pb[1] - pa[1]) * k) / 16); await page.waitForTimeout(16); }
  await page.mouse.up();
  await settle();
  const a1 = await glAlpha(uq, far);
  const dr = await uq(() => ({ line: window.__uq.state().section, cap: window.__uq._.sec.cap && window.__uq._.sec.cap.textContent }));
  const dw = corridor(dr.line.a, dr.line.b, 50, Y(2010), Y(2020), 45);
  check(dr.line.a && Math.abs(dr.line.a[0] - 238.8) < 0.1 && Math.abs(dr.line.a[1] - 39.3) < 0.1 && Math.abs(dr.line.b[0] - 241.8) < 0.1 && dr.cap && dr.cap.startsWith(`${nb(dw.n)} earthquakes within ±50 km · 2010s · M 2.5+`),
    `a drag draws A (${dr.line.a.map((v) => v.toFixed(2))}) to A′ (${dr.line.b.map((v) => v.toFixed(2))}); "${dr.cap}" (this file: ${dw.n})`);
  check(a0 > 50 && a1 < a0 * 0.7, `outside the corridor the dots dim: their alpha off Cape Mendocino ${a0.toFixed(0)} → ${a1.toFixed(0)} (${((a1 / a0) * 100).toFixed(0)} %)`);
  await shot('section-drawn');
  // dragging the A′ handle moves only that end; the plot follows
  const endB = await uq(() => { const e = window.__uq._.sec.ends[1], r = document.getElementById('over').getBoundingClientRect(); return [e[0] + r.left, e[1] + r.top]; });
  await page.mouse.move(endB[0], endB[1]); await page.mouse.down();
  for (let k = 1; k <= 8; k++) { await page.mouse.move(endB[0], endB[1] - 5 * k); await page.waitForTimeout(16); }
  await page.mouse.up(); await settle();
  const dr2 = await uq(() => window.__uq.state().section);
  check(dr2.a.join() === dr.line.a.join() && dr2.b[1] > dr.line.b[1] + 0.1, `dragging A′ moves only that end (${dr.line.b[1].toFixed(2)}° → ${dr2.b[1].toFixed(2)}° N)`);
  await page.click('#section-btn'); await settle();
  check(!(await S(uq)).drawn.sec, 'Section off: the line and the dimming are gone');

  // 7. A tap on Ridgecrest's M 7.1, a long press, a fault, a volcano
  await goto({ mode: 'history', window: 'month', floor: 2.5, at: '2019-07-15', view: 'california' });
  await tap(uq, -117.5993, 35.7695);
  s = await S(uq);
  const card = s.card || '';
  const wantCard = ['M 7.1', 'mw', 'Ridgecrest Earthquake Sequence', '2019-07-06 03:19 UTC', '8.0 km', 'Status: reviewed', 'earthquake.usgs.gov/earthquakes/eventpage/ci38457511'];
  check(wantCard.every((w) => card.includes(w)), `tap on Ridgecrest opens its card: ${JSON.stringify(card.split('\n').filter(Boolean).slice(0, 6))}`);
  await shot('tap-card');
  const nLong = await uq(() => { const { M, pressAt } = window.__uq._; pressAt(...M.toScreen(-117.55 + 360, 35.75)); return window.__uq.settled().then(() => window.__uq._.A.list.length); });
  const head = await uq(() => document.querySelector('#body h2') && document.querySelector('#body h2').textContent);
  check(nLong > 1 && head === `${nb(nLong)} earthquakes here`, `long press lists ${nLong}: "${head}"`);
  await shot('long-press');
  await goto({ mode: 'history', window: 'year', floor: 6, at: '1964-06-01', view: 'california' });
  await tap(uq, -121.9, 39.2);
  s = await S(uq);
  const fname = s.card && s.card.split('\n')[0];
  check(!!s.card && /Age class: /.test(s.card) && geo.faults.names.includes(fname) && s.card.includes(about.notes.find((q) => q.id === 'faults').text), `a tap on a fault opens its card ("${fname}", with the faults note)`);
  await shot('fault-card');
  await goto({ view: 'alaska' });
  await tap(uq, -153.43, 59.36);
  s = await S(uq);
  const aug = snap.volcanoes.monitored.find((v) => v.vnum === '313010');
  check(!!s.card && s.card.startsWith('Augustine') && (aug ? s.card.includes(`Alert level ${aug.alert[0] + aug.alert.slice(1).toLowerCase()}`) && s.card.includes(about.volcanoLevels[aug.alert].quote) : /Not monitored/.test(s.card)),
    `a tap on a volcano opens its card: ${JSON.stringify((s.card || '').split('\n').filter(Boolean).slice(0, 3))}`);
  await shot('volcano-card');

  // 8. Live: the largest row opens its card with the phone's time; US units
  await goto({ mode: 'live', window: 'month', view: 'lower-48' });
  await page.click('#largest'); await settle();
  s = await S(uq);
  check(!!s.card && s.card.includes('on your phone') && s.sel != null, `Live largest row → card (${(s.card || '').split('\n').filter(Boolean).slice(0, 3).join(' | ')})`);
  await shot('live-card');
  await uq(() => window.__uq._.A.set({ units: 'us' })); await settle();
  const us = await uq(() => ({ scale: document.getElementById('scale').textContent, card: document.querySelector('#body .card').innerText, legend: document.querySelector('#legend .mono').textContent, name: document.getElementById('legend').getAttribute('aria-label') }));
  check(/ mi · at \d+° N$/.test(us.scale) && / mi\b/.test(us.card), `US units: the scale bar "${us.scale}", the card's depth in mi`);
  check(us.legend === '0 · 22 · 186 mi' && us.name.endsWith('0 to 186 mi'), `US units: the depth legend "${us.legend}" ("${us.name}")`);
  await uq(() => window.__uq._.A.set({ units: 'si' })); await settle();
  const si = await uq(() => document.querySelector('#legend .mono').textContent);
  check(si === '0 · 35 · 300 km', `SI again: the depth legend "${si}"`);

  // 9. Layers off and on; the legend card
  await goto({ mode: 'live', window: 'month', view: 'california', sheet: 'peek' });
  await page.click('#layers-btn'); await settle();
  const sw = await uq(() => [...document.querySelectorAll('#layers .sw')].map((b) => [b.textContent, b.getAttribute('aria-checked')]));
  check(sw.length === 6 && sw.every((q) => q[1] === 'true'), `Layers: six switches, all on (${sw.map((q) => q[0]).join(', ')})`);
  await shot('layers-panel');
  await contrast('Layers');
  for (let k = 0; k < 6; k++) { await uq((k) => document.querySelectorAll('#layers .sw')[k].click(), k); }
  await settle();
  s = await S(uq);
  check(Object.values(s.layers).every((v) => v === false), `every layer switched off: ${JSON.stringify(s.layers)}`);
  await uq(() => window.__uq._.A.toggleLayers(false));
  await shot('layers-off');
  await uq(() => { for (const k of ['relief', 'bathy', 'faults', 'volcanoes', 'states', 'labels']) window.__uq._.A.setLayer(k, true); });
  await shot('layers-on');
  await page.click('#legend'); await settle();
  const lg = await uq(() => [...document.querySelectorAll('#legend-card .krow')].map((r) => r.textContent));
  check(lg.length === 8 && lg[0] === `M 3 · 5 · 7 · 9: each whole magnitude doubles the area; M ${about.numbers.sizeFloor} and below share the smallest dot` && lg[6].endsWith('empty: not monitored') && lg[7] === 'Faint specks: earlier in this play',
    `the legend card "Reading the map": ${lg.length} drawn keys ("${lg[0]}")`);
  await shot('legend');
  await contrast('legend');
  await page.keyboard.press('Escape');
  check(await uq(() => !document.getElementById('legend-card') && document.activeElement.id === 'legend'), 'Escape closes the legend card and gives focus back');

  // 10. About: every source, quote, date and the fonts' notice; the five-tap readout
  await page.click('#about-btn'); await settle();
  const ab = await uq(() => document.getElementById('about').innerText);
  const abMiss = [];
  if (!ab.includes(about.intro)) abMiss.push('intro');
  for (const n of about.notes) { if (!ab.includes(n.text)) abMiss.push(n.id); if (n.quote && !ab.includes(n.quote)) abMiss.push(`${n.id} quote`); }
  for (const q of about.sources) for (const k of ['title', 'licence', 'attribution', 'url', 'cite']) if (q[k] && !ab.includes(q[k])) abMiss.push(`${q.id} ${k}`);
  for (const q of snap.sources) for (const k of ['attribution', 'url']) if (!ab.includes(q[k])) abMiss.push(`${q.id} ${k}`);
  for (const q of stories.sources.filter((x) => /oklahoma/.test(x.id))) if (!ab.includes(q.quote)) abMiss.push(q.id);
  if (!ab.includes(about.software.fonts)) abMiss.push('fonts');
  if (!ab.includes(`to ${hj.cutoff}`) || !ab.includes(snap.feed.generated.replace('T', ' ').replace(/(:\d\d)?Z$/, ' UTC'))) abMiss.push('dates');
  check(abMiss.length === 0 && /SI: km, m/.test(ab) && /Version 1\.0/.test(ab), `About: intro, ${about.notes.length} notes with their quotes, ${about.sources.length + snap.sources.length} sources with licence, attribution and address, the Oklahoma statement, the fonts, the data's dates, units, version${abMiss.length ? ' — missing: ' + abMiss.join(', ') : ''}`);
  await shot('about');
  await contrast('About');
  for (let k = 0; k < 5; k++) await page.click('#about .ver');
  const perfOn = await uq(() => !document.getElementById('perf').hidden && document.getElementById('perf').textContent);
  check(/^frame [\d.]+ ms · map/.test(perfOn || ''), `five taps on the version line show the frame-time readout ("${perfOn}")`);
  for (let k = 0; k < 5; k++) await page.click('#about .ver');
  await page.keyboard.press('Escape');
  check(await uq(() => document.getElementById('about').hidden && document.activeElement.id === 'about-btn'), 'Escape closes About and gives focus back');
  await page.click('#credit'); await settle();
  const srcTop = await uq(() => { const a = document.getElementById('about'), h = document.getElementById('about-sources'); return h.getBoundingClientRect().top - a.getBoundingClientRect().top; });
  check(srcTop >= 0 && srcTop < 60, `the credit line opens About at its sources (heading ${Math.round(srcTop)} px from the top)`);
  await shot('about-sources');
  await uq(() => window.__uq._.A.closeAbout());

  // 11. Forced loss and restore of each WebGL context
  await goto({ mode: 'live', window: 'month', view: 'lower-48' });
  for (const which of ['points', 'relief']) {
    const d0 = await uq(() => window.__uq._.gl.stats.draws);
    check(await uq((w) => (w === 'relief' ? window.__uq._.gl.reliefCtx : window.__uq._.gl.points).lose(), which), `${which}: context lost by WEBGL_lose_context`);
    await page.waitForFunction(() => document.getElementById('notices').textContent.includes('Restoring the map'), null, { timeout: 3000 }).catch(() => {});
    const during = await uq(() => document.getElementById('notices').textContent);
    await page.waitForFunction(() => !window.__uq.state().lost, null, { timeout: 5000 });
    await settle();
    const d1 = await uq(() => window.__uq._.gl.stats.draws);
    check(during.includes('Restoring the map') && (which === 'relief' || d1 > d0), `${which}: "Restoring the map…" while lost, then restored and redrawn (draws ${d0} → ${d1})`);
  }

  // 12. A newer snapshot while open: the pen writes the new stems, the dots fade in, "n new since …"
  const D1 = 90, prevTo = snap.rows.to;
  snapOverride = { body: shifted(D1) };
  await uq(() => window.__uq._.refreshSnapshot());
  const anim = await uq(() => document.getAnimations().filter((a) => a.playState === 'running').flatMap((a) => (a.effect && a.effect.getKeyframes ? a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))) : [])));
  const midT = await uq(() => { const d = window.__uq.state().drawn; return d.newT; });
  await settle();
  s = await S(uq);
  const nNew = count(prevTo - D1 + 1, prevTo + 1, 0);                      // the copy's last 90 minutes, before the shift
  const penCut = await uq(() => window.__uq._.A.liveStrip.cut);
  check(s.arrival && s.arrival.n === nNew && s.largest.includes(`${nNew} new since ${hhmm(prevTo)} UTC`) && s.drawn.newFrom === prevTo + 1 && s.drawn.newT === 1 && penCut === null,
    `a newer snapshot: "${s.largest}" (this file: ${nNew} rows after ${hhmm(prevTo)}), fading from newT ${midT.toFixed(2)} to 1, the strip redrawn to the feed at the end (cut ${penCut})`);
  check(anim.every((p) => p === 'opacity'), `while it arrives nothing animates but opacity (${anim.length ? anim.join(', ') : 'no running animation'})`);
  await shot('arrival');
  snapOverride = null; await uq(() => window.__uq._.refreshSnapshot()); await settle();

  // 13. Reload: mode, window, floor, time, view, sheet, layers, units, section and story come back
  await goto({ mode: 'history', window: 'decade', floor: 5, at: '1964-06-01', view: 'pacific-northwest', sheet: 'half' });
  await uq(() => { const A = window.__uq._.A; A.setLayer('faults', false); A.set({ units: 'us' }); A.preset('cascadia'); A.set({ histWin: 'decade', floor: 70 }); });
  await settle();
  const before = await S(uq);
  await page.reload();
  await page.waitForFunction(() => window.__uq && window.__uq.ready(), null, { timeout: 120000 });
  await settle();
  const after = await S(uq);
  const same = ['mode', 'histWin', 'floor', 'histAt', 'sheet', 'units'].every((k) => after[k] === before[k]) && JSON.stringify(after.layers) === JSON.stringify(before.layers)
    && JSON.stringify(after.section) === JSON.stringify(before.section) && Math.abs(after.view.s / before.view.s - 1) < 1e-6 && after.label === before.label && !after.intro.on;
  check(same, `after a reload: ${after.mode}, ${after.histWin}, M ${after.floor}, "${after.label}", sheet ${after.sheet}, units ${after.units}, faults ${after.layers.faults ? 'on' : 'off'}, the Cascadia section, the same view; no opening`);
  await uq(() => { const A = window.__uq._.A; A.setLayer('faults', true); A.set({ units: 'si' }); A.secSet({ on: false, a: null, b: null, hi: null }); });

  // 14. Hidden: Play stops, a story's sequence pauses where it is
  await goto({ mode: 'history', window: 'year', floor: 4, at: '1960-06-01', view: 'alaska' });
  await uq(() => window.__uq._.startPlay());
  await page.waitForTimeout(700);
  await uq(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hid1 = await S(uq);
  await uq(() => window.__uq._.A.openStory('ridgecrest-2019')); await settle();
  await uq(() => { delete document.hidden; const A = window.__uq._.A; A.playSeq(A.story); });
  await page.waitForTimeout(700);
  await uq(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  const hid2 = await S(uq);
  await page.waitForTimeout(700);
  const hid3 = await S(uq);
  await uq(() => { delete document.hidden; });
  check(!hid1.playing && hid2.seq && !hid2.seq.timer && hid3.seq.label === hid2.seq.label, `hidden: Play stops ("${hid1.label}"); the sequence pauses at "${hid2.seq && hid2.seq.label}" and stays there`);
  await uq(() => window.__uq._.A.closeStory());

  // 15. Hit targets, contrast and chrome, in the states people meet
  const hitBad = [];
  let hitN = 0;
  const hitAt = (h, where) => { hitN += h.n; hitBad.push(...h.bad.map((b) => `${b} in ${where}`)); };
  for (const st of [{ mode: 'live', sheet: 'peek' }, { mode: 'live', sheet: 'half' }, { mode: 'history', sheet: 'half' }]) {
    await goto({ ...st, view: 'lower-48' });
    hitAt(await hitTargets(uq), `${st.mode} ${st.sheet}`);
    await contrast(`${st.mode} ${st.sheet}`);
  }
  await uq(() => window.__uq._.A.preset('hawaii')); await settle();
  hitAt(await hitTargets(uq), 'a section'); await contrast('section');
  await uq(() => window.__uq._.A.toggleLayers(true)); await settle();
  hitAt(await hitTargets(uq), 'Layers');
  await uq(() => window.__uq._.A.toggleLayers(false));
  await uq(() => window.__uq._.A.secSet({ on: false, a: null, b: null, hi: null }));
  await uq(() => window.__uq._.A.openAbout()); await settle();
  hitAt(await hitTargets(uq), 'About');
  await uq(() => window.__uq._.A.closeAbout());
  check(hitBad.length === 0, `hit targets: ${hitN} visible controls checked in six states, each ≥ 44 px tall where fingers go${hitBad.length ? ': ' + [...new Set(hitBad)].slice(0, 8).join('; ') : ''}`);
  const chroma = await chromaOf(uq);
  check(chroma[0] <= 0.025, `chrome is ink: the most chromatic chrome colour has OKLCh chroma ${chroma[0].toFixed(4)} (${chroma[1]})`);
  check(worstContrast[scheme][0] >= 4.5, `text contrast: the lowest rendered pair over Live, History, a section, Layers, the legend and About is ${worstContrast[scheme][0].toFixed(2)}:1 (${worstContrast[scheme][1]})`);
  await goto({ mode: 'history', window: 'year', floor: 4, at: '1964-06-01' });
  const kb = await uq(() => { const t = document.getElementById('timeline'); return [t.getAttribute('aria-valuetext'), t.getAttribute('aria-valuenow'), t.tabIndex]; });
  check(/^\d{4}, year window, magnitude \d(\.5)? and up, [\d  ]+ earthquakes$/.test(kb[0]) && kb[2] === 0, `the timeline is a focusable slider: aria-valuenow ${kb[1]}, aria-valuetext "${kb[0]}"`);

  // 16. Landscape: two columns, the sheet a 380 px column at Full, no grip
  await page.setViewportSize({ width: 844, height: 390 });
  await settle();
  const ls = await uq(() => ({ sheet: document.getElementById('sheet').getBoundingClientRect().toJSON(), map: document.getElementById('map').getBoundingClientRect().toJSON(), grip: getComputedStyle(document.getElementById('grip')).display, credit: document.getElementById('credit').getBoundingClientRect().toJSON() }));
  check(Math.round(ls.sheet.width) === 381 || Math.round(ls.sheet.width) === 380, `landscape: map ${Math.round(ls.map.width)} × ${Math.round(ls.map.height)}, sheet ${Math.round(ls.sheet.width)} px on the right, grip ${ls.grip}`);
  check(ls.grip === 'none' && ls.map.width === 464 && ls.credit.bottom <= 390 && ls.credit.right <= 464, `landscape: the credit line on screen at ${Math.round(ls.credit.left)}–${Math.round(ls.credit.right)} px`);
  await shot('landscape');
  await page.setViewportSize({ width: 390, height: 844 });
  await settle();

  // 17. Focus mode (DESIGN §22): the map and the record strip alone, "Not a warning service" kept
  {
    const HIDE = ['top', 'chips', 'tools', 'legend', 'grip', 'body', 'live-win', 'largest'];
    const look = () => uq((HIDE) => {
      const M = window.__uq._.M, r = M.visible(), rect = (id) => document.getElementById(id).getBoundingClientRect().toJSON();
      return { focus: window.__uq.state().focus, stored: localStorage.getItem('uq.focus'), active: document.activeElement.id, sheetState: window.__uq.state().sheet,
        gone: HIDE.filter((id) => { const e = document.getElementById(id); return e.hidden && e.inert && getComputedStyle(e).display === 'none'; }),
        shown: HIDE.filter((id) => { const e = document.getElementById(id); return !e.hidden && !e.inert && e.checkVisibility(); }),
        exit: document.getElementById('focus-exit').checkVisibility(), free: r.y1 - r.y0, map: rect('map'), sheet: rect('sheet'), credit: rect('credit'),
        creditText: document.getElementById('credit').textContent, canvas: document.getElementById('base').height, fcard: document.getElementById('fcard') && document.getElementById('fcard').innerText,
        ring: (document.querySelector(':focus-visible') || {}).id || null };
    }, HIDE);
    const tree = () => page.locator('body').ariaSnapshot();
    await goto({ mode: 'live', window: 'month', liveAll: true, view: 'california', sheet: 'half' });
    await page.waitForTimeout(300);                                   // the sheet's 240 ms height change
    const f0 = await look();
    await page.click('#focus-btn');
    await page.waitForFunction(() => window.__uq.state().focus, null, { timeout: 3000 });
    await settle(); await page.waitForTimeout(300);
    let f1 = await look(), ax = await tree();
    check(f1.gone.length === HIDE.length && f1.exit && f1.active !== 'focus-exit' && !f1.ring && f1.stored === 'true',
      `focus mode by its key (a pointer): ${f1.gone.length} of ${HIDE.length} controls hidden and inert (computed display none), the exit key shown; focus not moved (on ${f1.active || 'the page'}), no ring drawn`);
    const ib17 = await inBase(uq);
    check(ib17.inside, `focus mode, California: the grown map shows ${ib17.span}, inside ${baseText}`);
    check(!/US Quakes|Lower 48|Layers|Hide the controls|Day|Month|Largest/.test(ax) && /Show the controls/.test(ax),
      `focus mode: the top bar, chips, keys, legend and the sheet's body are out of the accessibility tree (${ax.split('\n').length} lines left)`);
    check(f1.map.top === 0 && f1.free > f0.free + 200 && f1.canvas > f0.canvas && f1.sheet.height < 140 && f1.sheetState === f0.sheetState,
      `focus mode: the map grows (free height ${Math.round(f0.free)} → ${Math.round(f1.free)} px, #base ${f0.canvas} → ${f1.canvas} device px), the strip a ${Math.round(f1.sheet.height)} px band`);
    check(f1.creditText.startsWith('Not a warning service') && f1.credit.bottom <= f1.sheet.top && f1.credit.top > 0,
      `focus mode: "${f1.creditText}" stays on screen above the band (${Math.round(f1.credit.top)}–${Math.round(f1.credit.bottom)} px)`);
    const fh = await hitTargets(uq), fc = await contrast('focus');
    check(!fh.bad.length && fc.worst[0] >= 4.5, `focus mode: ${fh.n} visible controls, each with a 44 px hit area${fh.bad.length ? ': ' + fh.bad.join('; ') : ''}; lowest text contrast ${fc.worst[0].toFixed(2)}:1 over ${fc.n} texts`);
    await shot('focus-live', path.join(APP, 'screenshots', `focus-live-${scheme}.png`));
    // the Live strip still picks: a tap on the largest stem opens its card over the map, the band stays
    const pick = await uq(() => { const { A, hitLive } = window.__uq._, big = A.largest(1)[0], r = document.getElementById('strip-live').getBoundingClientRect();
      let x = null; for (let k = 0; k < r.width && x == null; k += 0.5) if (hitLive(k, r.width, A.liveStrip) === big) x = r.left + k;
      return { big, x, y: r.top + 30 }; });
    await page.mouse.click(pick.x, pick.y);
    await settle();
    f1 = await look(); s = await S(uq);
    check(s.sel === pick.big && /^M \d/.test(f1.fcard || '') && f1.sheet.height < 140 && f1.gone.length === HIDE.length,
      `focus mode, Live: a tap on the strip's largest stem opens the card over the map (${JSON.stringify((f1.fcard || '').split('\n').filter(Boolean).slice(0, 2))}), the band stays ${Math.round(f1.sheet.height)} px`);
    await page.keyboard.press('Escape'); await settle(); await page.waitForTimeout(300);
    const f2 = await look();
    check(!f2.focus && f2.shown.length === HIDE.length && f2.active === 'focus-btn' && f2.map.top > 0 && f2.stored === 'false' && Math.round(f2.sheet.height) === Math.round(f0.sheet.height),
      `Escape leaves focus mode: every control back (${f2.shown.join(', ')}), focus on the key, the sheet at ${f2.sheetState} again${f2.focus || f2.active !== 'focus-btn' || Math.round(f2.sheet.height) !== Math.round(f0.sheet.height) ? ` — ${JSON.stringify({ focus: f2.focus, active: f2.active, stored: f2.stored, top: f2.map.top, h: f2.sheet.height, h0: f0.sheet.height })}` : ''}`);
    // by keys: Enter on the focused key goes in with focus on the exit key, ringed; Enter there comes back
    await page.focus('#focus-btn'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__uq.state().focus, null, { timeout: 3000 }); await settle(); await page.waitForTimeout(300);
    const fk1 = await look();
    await page.keyboard.press('Enter'); await settle(); await page.waitForTimeout(300);
    const fk2 = await look();
    check(fk1.focus && fk1.active === 'focus-exit' && fk1.ring === 'focus-exit' && !fk2.focus && fk2.active === 'focus-btn' && fk2.ring === 'focus-btn',
      `focus mode by keys: Enter on the key goes in with focus on the exit key (ringed: ${fk1.ring}), Enter there comes out with focus on the key (ringed: ${fk2.ring})`);
    // the Lower 48 in focus mode, the tallest framing a phone gives it, is map to its edges
    await goto({ mode: 'live', window: 'month', view: 'lower-48', sheet: 'peek' });
    await page.click('#focus-btn');
    await page.waitForFunction(() => window.__uq.state().focus, null, { timeout: 3000 }); await settle(); await page.waitForTimeout(300);
    const ib48 = await inBase(uq);
    check(ib48.inside, `focus mode, Lower 48: it shows ${ib48.span}, inside ${baseText}`);
    await shot('focus-lower48');
    await page.keyboard.press('Escape'); await settle(); await page.waitForTimeout(300);
    // History: the strip scrubs, a window steps, a tap on the map
    await goto({ mode: 'history', window: 'year', floor: 4, at: '1964-06-01', view: 'alaska', sheet: 'peek' });
    await page.click('#focus-btn');
    await page.waitForFunction(() => window.__uq.state().focus, null, { timeout: 3000 }); await settle(); await page.waitForTimeout(300);
    f1 = await look();
    check(f1.gone.length === HIDE.length && f1.sheet.height < 175 && await uq(() => ['hlabel', 'play', 'timeline', 'hist-win', 'floor'].every((id) => document.getElementById(id).checkVisibility())),
      `focus mode, History: the label, play key, strip, window and floor chips stay in a ${Math.round(f1.sheet.height)} px band`);
    const ibAk = await inBase(uq);
    check(ibAk.inside && !f1.ring, `focus mode, Alaska: it shows ${ibAk.span}, inside ${baseText}; no ring on the exit key after a pointer (${f1.ring || 'none'})`);
    await shot('focus-history', path.join(APP, 'screenshots', `focus-history-${scheme}.png`));
    const tl = await uq(() => document.getElementById('timeline').getBoundingClientRect().toJSON());
    await page.mouse.move(tl.left + tl.width * 0.55, tl.top + 40); await page.mouse.down();
    for (let k = 1; k <= 10; k++) { await page.mouse.move(tl.left + tl.width * (0.55 + k * 0.02), tl.top + 40); await page.waitForTimeout(16); }
    await page.mouse.up(); await settle();
    s = await S(uq);
    const scrubbed = labelMatches(s, 60);
    check(scrubbed.ok && s.win.label !== '1964' && /^\d{4}$/.test(s.win.label), `focus mode, History: scrubbing the strip moves the window to "${s.label}"`);
    await page.click('#hist-win [data-v="decade"]'); await settle();
    await page.focus('#timeline'); await page.keyboard.press('ArrowLeft'); await settle();
    s = await S(uq);
    const stepped = labelMatches(s, 60);
    check(stepped.ok && /^\d{4}s$/.test(s.win.label) && s.histWin === 'decade', `focus mode, History: Decade, then a step back: "${s.label}"`);
    await goto({ window: 'year', at: '1964-06-01' });
    const pt64 = await uq(() => { const { M, A } = window.__uq._, i = A.C.textRows[A.C.ids.indexOf('official19640328033616_30')], r = document.getElementById('over').getBoundingClientRect();
      const [x, y] = M.toScreen(172 + 0.002 * A.C.x[i], 17 + 0.001 * A.C.y[i]); return [x + r.left, y + r.top]; });
    await page.mouse.click(pt64[0], pt64[1]); await settle();
    f1 = await look(); s = await S(uq);
    check(s.sel != null && /M 9\.2/.test(f1.fcard || '') && f1.gone.length === HIDE.length, `focus mode, History: a tap on the map opens the card over it (${JSON.stringify((f1.fcard || '').split('\n').filter(Boolean).slice(0, 2))})`);
    await shot('focus-card');
    await page.click('#focus-exit'); await settle(); await page.waitForTimeout(300);
    const f3 = await look(); s = await S(uq);
    check(!f3.focus && f3.active !== 'focus-btn' && !f3.ring && !f3.exit && f3.map.top > 0 && /M 9\.2/.test(s.card || ''), `the exit key (a pointer) leaves focus mode without moving focus (on ${f3.active || 'the page'}) or drawing a ring, and the card moves back into the sheet`);
    // a reload keeps focus mode; the opening never starts in it
    await page.click('#focus-btn'); await page.waitForFunction(() => window.__uq.state().focus, null, { timeout: 3000 });
    await page.reload();
    await page.waitForFunction(() => window.__uq && window.__uq.ready(), null, { timeout: 120000 });
    await settle();
    const f4 = await look();
    check(f4.focus && f4.gone.length === HIDE.length && f4.exit && f4.map.top === 0 && !(await S(uq)).intro.on, `after a reload focus mode is back: ${f4.gone.length} controls hidden, the map from the top, no opening`);
    await uq(() => window.__uq._.A.setFocus(false)); await settle();
    // Reduce Motion: the change is immediate, with nothing transitioning
    const RM = await open(scheme, { reduced: true });
    await RM.uq(() => window.__uq.goto({ mode: 'live', view: 'california' }));
    const rm = await RM.uq(() => { document.getElementById('focus-btn').click(); const s = window.__uq.state(); return { focus: s.focus, running: document.getAnimations().length, active: document.activeElement.id, gone: ['top', 'chips', 'tools'].every((id) => document.getElementById(id).hidden) }; });
    check(rm.focus && rm.gone && rm.running === 0 && rm.active === 'focus-exit', `Reduce Motion: focus mode applies at once, with ${rm.running} animations or transitions running`);
    const rm2 = await RM.uq(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return { focus: window.__uq.state().focus, running: document.getAnimations().length }; });
    check(!rm2.focus && rm2.running === 0, `Reduce Motion: Escape leaves it at once (${rm2.running} running)`);
    check(RM.errors.length === 0, `Reduce Motion focus: no console error (${RM.errors.slice(0, 3).join(' | ')})`);
    await RM.ctx.close();
  }

  if (scheme === schemes[0]) {
    // 18. The sweep of History windows at several floors
    const sweep = [['month', '1964-03-10', 4], ['year', '1964-06-01', 4], ['decade', '1964-06-01', 4], ['all', '1964-06-01', 4], ['year', '1811-12-16', 2.5],
      ['month', '2019-07-10', 2.5], ['year', '2025-06-01', 2.5], ['year', '2026-06-01', 2.5], ['decade', '2021-01-01', 5], ['year', '1906-04-18', 6]];
    for (const [win, at, fl] of sweep) {
      await goto({ mode: 'history', window: win, floor: fl, at, view: 'lower-48' });
      s = await S(uq);
      const lm = labelMatches(s, { 2.5: 45, 4: 60, 5: 70, 6: 80 }[fl]);
      check(lm.ok, `${win} at ${at}, M ${fl}+: "${s.label}"${lm.ok ? '' : ` — expected "${lm.want}", drew ${JSON.stringify(lm.drawn)}`}`);
    }
    // 19. Play one decade of Year windows from 1960, and a sliding decade
    await goto({ mode: 'history', window: 'year', floor: 4, at: '1960-06-01', view: 'alaska' });
    // every label the page shows, caught by a MutationObserver in the frame that wrote it, kept when the
    // GPU drew that window. Play starts after two presented frames: SwiftShader rasters a fresh view of
    // Alaska for ~300 ms, and a Play started into that backlog once stepped twice before its first frame
    // (traced with a histAt write log, 2026-09-30); the app now waits for each step to be drawn as well
    const rec = (ms) => uq(async (ms) => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const o = [], lab = document.getElementById('hlabel');
      let prev = lab.textContent;
      const mo = new MutationObserver(() => {
        const s = window.__uq.state(), label = lab.textContent;
        if (label !== prev && s.drawn && s.drawn.t0 === s.win.t0) { o.push({ ...s, label }); prev = label; }
      });
      mo.observe(lab, { childList: true, subtree: true, characterData: true });
      window.__uq._.startPlay();
      await new Promise((r) => setTimeout(r, ms));
      mo.disconnect();
      window.__uq._.stopPlay();
      return o;
    }, ms);
    const steps = await rec(6300);
    let bad = 0;
    for (const s2 of steps) { const l2 = labelMatches(s2, 60); if (!l2.ok || s2.drawn.trace0 !== Y(1960)) { bad++; console.log(`      step "${s2.label}" expected "${l2.want}"`); } }
    const seen = steps.map((x) => x.win.label);
    await shot('play-decade');
    check(bad === 0 && seen.slice(0, 10).join(',') === '1961,1962,1963,1964,1965,1966,1967,1968,1969,1970', `Play steps Year windows from 1960, each label = the drawn window and its count, the trace from 1960 (${seen.join(', ')})`);
    await goto({ mode: 'history', window: 'decade', floor: 4, at: '1960-06-01' });
    const dsteps = await rec(1300), dec = dsteps.map((x) => x.win.label);
    for (const s2 of dsteps) if (!labelMatches(s2, 60).ok) check(false, `sliding decade: "${s2.label}" vs "${labelMatches(s2, 60).want}"`);
    check(dec.slice(0, 2).join(',') === '1961–1970,1962–1971', `Play in Decade slides one year a step: ${dec.join(', ')}`);

    // 20. Frame times over a scripted pan, pinch and play (a trend only)
    await goto({ mode: 'history', window: 'all', floor: 2.5, view: 'lower-48' });
    await uq(async () => { const { M, req } = window.__uq._; const mv = (f) => { M.set(f(M.v)); M.moving = true; req('move'); };
      for (let i = 0; i < 60; i++) { mv((v) => ({ ...v, cx: v.cx - 3 / v.s, cy: v.cy - 1 / v.s })); await new Promise(requestAnimationFrame); }
      for (let i = 0; i < 40; i++) { mv((v) => ({ ...v, s: v.s * 1.012 })); await new Promise(requestAnimationFrame); }
      M.moving = false; req('base', 'relief', 'lines', 'over', 'settle'); });
    await settle();
    const pf = await uq(() => window.__uq._.perf.frames);
    const med = (k) => { const v = pf.map((f) => f[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? `${v[Math.floor(v.length / 2)]} ms median, ${v[Math.floor(v.length * 0.95)]} p95 (${v.length})` : 'none'; };
    console.log(`  frames, History All 2.5+ (${nb(N)} rows): gl ${med('gl')}; base ${med('base')}; lines ${med('lines')}; over ${med('over')}; whole frame ${med('ms')}`);


    // 20b. The gestures themselves, through real touches (CDP Input.dispatchTouchEvent), and the paths
    // between features: what a person does, asserted by what they would see
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    // a story opened after another story's sequence has run to its end takes its own window
    await goto({ mode: 'history', view: 'hawaii', sheet: 'half' });
    await uq(() => window.__uq._.A.openStory('kilauea-2018')); await settle();
    await uq(() => { const A = window.__uq._.A; A.playSeq(A.story); });
    await page.waitForFunction(() => { const q = window.__uq.state().seq; return q && q.done; }, null, { timeout: 15000 });
    await uq(() => window.__uq._.A.openStory('ridgecrest-2019')); await settle();
    s = await S(uq);
    const lmR = labelMatches(s, 45);
    check(!s.seq && s.win.label === 'July 2019' && lmR.ok && s.story === 'ridgecrest-2019', `after Kīlauea's sequence ran out, Ridgecrest opens on its own window: "${s.label}"`);
    await uq(() => [...document.querySelectorAll('#body .story-card .btn')].find((b) => b.textContent === 'Play the sequence').click());
    await page.waitForTimeout(700);
    s = await S(uq);
    check(s.seq && s.seq.timer && s.seq.label.startsWith('2019-07-01 to ') && s.seq.label !== '2019-07-01 to 2019-07-01' && s.win.label === s.seq.label, `its own Play the sequence starts and steps its own sequence: "${s.win.label}"`);
    await uq(() => window.__uq._.A.closeStory());
    // rotation from a marked chip: the region stays in view and marked, both ways
    await goto({ mode: 'live', window: 'month', view: 'california', sheet: 'peek' });
    const boxIn = () => uq(() => { const { M } = window.__uq._, st = window.__uq.state(), v = window.__uq._.A.G.views.find((q) => q.key === 'california'), r = M.visible();
      const [x0, y0] = M.toScreen(v.west, v.north), [x1, y1] = M.toScreen(v.east, v.south);
      return { chip: st.chip, inside: x0 >= -1 && x1 <= r.x1 + 1 && y0 >= r.y0 - 1 && y1 <= r.y1 + 1, box: [x0, y0, x1, y1].map(Math.round), W: st.W, H: st.H }; });
    const rot0 = await boxIn();
    await page.setViewportSize({ width: 844, height: 390 }); await settle(); await page.waitForTimeout(300);
    const rot1 = await boxIn();
    await page.setViewportSize({ width: 390, height: 844 }); await settle(); await page.waitForTimeout(300);
    const rot2 = await boxIn();
    check([rot0, rot1, rot2].every((q) => q.chip === 'california' && q.inside), `rotation from the California chip: portrait ${JSON.stringify(rot0.box)}, landscape ${rot1.W}×${rot1.H} ${JSON.stringify(rot1.box)}, portrait again ${JSON.stringify(rot2.box)}, the chip marked throughout`);
    await shot('rotated-back');
    // dragging along the Live strip at Peek: the strip stays under the finger and the map waits for the release
    await goto({ mode: 'live', window: 'week', view: 'lower-48', sheet: 'peek' });
    const sr = await uq(() => document.getElementById('strip-live').getBoundingClientRect().toJSON());
    const v0 = (await S(uq)).view, ys = [], sels = new Set(), views = new Set();
    await touch('touchStart', sr.left + sr.width * 0.3, sr.top + 30);
    for (let k = 1; k <= 30; k++) {
      await touch('touchMove', sr.left + sr.width * (0.3 + k * 0.02), sr.top + 30);
      const q = await uq(() => ({ top: document.getElementById('strip-live').getBoundingClientRect().top, sel: window.__uq.state().sel, v: window.__uq.state().view, sheet: window.__uq.state().sheet }));
      ys.push(Math.round(q.top)); if (q.sel != null) sels.add(q.sel); views.add(`${q.v.cx.toFixed(6)} ${q.v.cy.toFixed(6)} ${q.v.s.toFixed(3)}`);
    }
    const mid = await S(uq);
    await touch('touchEnd'); await settle(); await page.waitForTimeout(300);
    const after = await S(uq), pen = await uq(() => window.__uq._.A.liveStrip.sel);
    check(ys.every((y) => y === Math.round(sr.top)) && views.size === 1 && views.has(`${v0.cx.toFixed(6)} ${v0.cy.toFixed(6)} ${v0.s.toFixed(3)}`) && sels.size >= 5 && mid.sheet === 'peek' && after.sheet === 'half' && pen === after.sel,
      `a 30-step drag along the Live strip at Peek: the strip stays at ${Math.round(sr.top)} px (${[...new Set(ys)].join(', ')}), ${sels.size} events selected in turn, the view unmoved until the release (${views.size} view${views.size === 1 ? '' : 's'}), then the sheet at ${after.sheet}; the pen marks the selected stem`);
    await page.locator('#head').screenshot({ path: path.join(out, `strip-pen-${scheme}.png`) });
    // the pen's nib clears the count label: a stem under the label's words selected, the nib's first inked row
    // (device px, the selection's difference) below the label's last inked row in the same columns
    const nib = await uq(async () => {
      const { A } = window.__uq._, { liveGeom } = await import('./js/strip.js');
      const L = A.liveStrip, cv = document.getElementById('strip-live'), w = cv.clientWidth, k = cv.width / w, C = A.C;
      const x = cv.getContext('2d'); x.save(); x.font = '500 10px "Red Hat Mono", ui-monospace, monospace'; const lw = x.measureText(L.countText).width; x.restore();
      const g = liveGeom(w, L.t0, L.t1, L.ageMs / 60000);
      let pick = -1;
      for (let i = C.n - 1; i >= 0 && C.t[i] >= L.t0; i--) { const px = g.X(C.t[i]); if (C.m[i] !== 255 && C.m[i] >= L.floor && px > w - lw * 0.7 && px < w - lw * 0.3) { pick = i; break; } }
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      // read a copy, as glAlpha does, so the strip's own canvas is never read back
      const H = Math.round(20 * k), grab = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = H; const y = c.getContext('2d', { willReadFrequently: true }); y.drawImage(cv, 0, 0); return y.getImageData(0, 0, cv.width, H).data; };
      A.closeCard(); await frame(); const off = grab();
      A.select(pick, false, true); await frame(); const on = grab(); A.closeCard(); await frame();
      const px = Math.round(g.X(C.t[pick]) * k);
      let penTop = 99, labelBottom = -1;
      for (let row = 0; row < H; row++) for (let col = px - Math.round(3 * k); col <= px + Math.round(3 * k); col++) {
        const q = (row * cv.width + col) * 4 + 3;
        if (on[q] > 60 && off[q] < 20) penTop = Math.min(penTop, row);
        if (row < Math.round(10 * k) && off[q] > 60) labelBottom = Math.max(labelBottom, row);   // above the ticks' tops (10 px)
      }
      return { pick, penTop, labelBottom };
    });
    check(nib.pick >= 0 && nib.penTop - nib.labelBottom >= 2, `the Live pen's nib clears the count label: under the label's words (row ${nib.pick}) its first inked row is ${nib.penTop}, the label's last ${nib.labelBottom} (device px)`);
    // the labels are placed again once the foot has moved: after Peek → Half, no label ink under the foot's
    // scale bar, legend or credit line (volcanoes off, so every mark on #over is a label)
    await goto({ mode: 'live', window: 'month', view: 'lower-48', sheet: 'peek' });
    await uq(() => window.__uq._.A.setLayer('volcanoes', false)); await settle();
    // the sheet's move and the foot's 240 ms slide with it (slower here on SwiftShader): wait for the foot's own
    // transitionend, then for the frames it asks for
    await uq(() => new Promise((res) => { const f = document.getElementById('foot'), h = (e) => { if (e.target === f) { f.removeEventListener('transitionend', h); res(); } };
      f.addEventListener('transitionend', h); setTimeout(res, 4000); window.__uq.goto({ sheet: 'half' }); }));
    await settle();
    const under = await uq(() => new Promise((res) => requestAnimationFrame(() => {
      const o = document.getElementById('over'), k = o.width / o.clientWidth, m = o.getBoundingClientRect(), rs = [], c = document.createElement('canvas');
      c.width = o.width; c.height = o.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(o, 0, 0);
      let n = 0;
      for (const id of ['scale', 'legend', 'credit']) {
        const r = document.getElementById(id).getBoundingClientRect(), d = x.getImageData(Math.round((r.left - m.left + 2) * k), Math.round((r.top - m.top + 2) * k), Math.round((r.width - 4) * k), Math.round((r.height - 4) * k)).data;
        let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) c++;
        n += c; rs.push(`${id} ${c}`);
      }
      res({ n, rs });
    })));
    await uq(() => window.__uq._.A.setLayer('volcanoes', true));
    check(under.n === 0, `after Peek → Half the labels are placed against the foot where it ends: label pixels under it ${under.rs.join(', ')}`);
    // a long press near the foot: listed at 500 ms, the sheet lifts only on release, the release clicks nothing
    await goto({ mode: 'live', window: 'month', view: 'california', sheet: 'peek' });
    await page.waitForTimeout(300);                                   // the foot's 240 ms move to Peek
    const lp = await uq(() => { const { M } = window.__uq._, r = document.getElementById('over').getBoundingClientRect(), f = document.querySelector('.foot-row').getBoundingClientRect(), [x, y] = M.toScreen(-117.55 + 360, 35.75), e = document.elementFromPoint(x + r.left, y + r.top); return { x: x + r.left, y: y + r.top, foot: f.top, on: e && e.id }; });
    await touch('touchStart', lp.x, lp.y);
    // the list comes 500 ms into the press, in the next frame; under this harness's load SwiftShader's frame
    // can land after a fixed 750 ms read, so the list is waited for (up to 3 s) with the finger still down
    const tHeld = Date.now();
    const listedMs = await page.waitForFunction(() => document.getElementById('body').textContent.includes('earthquakes here'), null, { timeout: 3000 }).then(() => Date.now() - tHeld).catch(() => -1);
    await page.waitForTimeout(Math.max(0, 750 - (Date.now() - tHeld)));
    const held = await S(uq);
    await touch('touchEnd'); await page.waitForTimeout(500);
    const rel = await S(uq), abHidden = await uq(() => document.getElementById('about').hidden);
    check(lp.on === 'over' && held.body.includes('earthquakes here') && held.sheet === 'peek' && rel.sheet === 'half' && abHidden && /earthquakes here/.test(rel.body),
      `a real long press on Ridgecrest (${Math.round(lp.y)} px on #${lp.on}, the foot at ${Math.round(lp.foot)}): listed while held with the sheet still at ${held.sheet}, lifted to ${rel.sheet} on release, About ${abHidden ? 'not opened' : 'OPENED'}; the list after ${listedMs} ms held (held: "${held.body.slice(0, 22)}…", released: "${rel.body.slice(0, 22)}…")`);
    // a hollow ring has a hole: the centre of an isolated automatic M < 2 event is empty, its ring inked
    await goto({ mode: 'live', window: 'month', liveAll: true, view: 'california', sheet: 'peek' });
    const hol = await uq(() => new Promise((res) => {
      const { A, M, req } = window.__uq._, C = A.C, r = M.visible(), pts = [];
      for (let i = C.nh; i < C.n; i++) { if (C.t[i] < A.F.t0 || C.m[i] === 255) continue; const [x, y] = M.toScreen(172 + 0.002 * C.x[i], 17 + 0.001 * C.y[i]); if (x > 20 && x < M.w - 60 && y > r.y0 + 40 && y < r.y1 - 20) pts.push([i, x, y]); }
      const iso = pts.filter(([i, x, y]) => A.hollow(i) && C.m[i] < 40 && pts.every(([j, u, v]) => j === i || Math.hypot(u - x, v - y) > 9));
      req('gl');
      requestAnimationFrame(() => {
        const g = document.getElementById('gl'), k = g.width / g.clientWidth, c = document.createElement('canvas'); c.width = g.width; c.height = g.height;
        const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(g, 0, 0);
        const at = (px, py) => x.getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data[3];
        res({ n: iso.length, m: iso.slice(0, 5).map(([i, px, py]) => ({ M: (C.m[i] - 20) / 10, centre: at(px - 0.25, py - 0.25), ring: Math.max(at(px + 1.4, py), at(px - 1.4, py), at(px, py + 1.4), at(px, py - 1.4)) })) });
      });
    }));
    check(hol.n > 0 && hol.m.every((q) => q.centre <= 0.2 * q.ring && q.ring > 40), `hollow rings show their hole: ${hol.n} isolated automatic events under M 2 at the California view; centre vs ring alpha ${hol.m.map((q) => `M ${q.M} ${q.centre}/${q.ring}`).join(', ')}`);
    // a 2D hollow ring (drawDot: the legend's key, the section plot, list and card icons) is whole all round: its ink
    // at 0°, 5° (where an anticlockwise 0–7 rad hole once left a notch at 3 o'clock) and elsewhere, its hole empty
    const ring2d = await uq(async () => {
      const { drawDot } = await import('./js/ramp.js');
      const c = document.createElement('canvas'); c.width = c.height = 120;
      const x = c.getContext('2d', { willReadFrequently: true });
      drawDot(x, 60, 60, 80, 20, true, 1);                   // an 80 px ring 14.4 px wide (0.18 d): inner radius 25.6
      const at = (deg, rad) => x.getImageData(Math.round(60 + rad * Math.cos((deg * Math.PI) / 180)), Math.round(60 + rad * Math.sin((deg * Math.PI) / 180)), 1, 1).data[3];
      const deg = [0, 5, 10, 20, 30, 45, 90, 180, 270, 355];
      return { deg, ring: deg.map((d) => at(d, 32.8)), hole: deg.map((d) => at(d, 12.8)) };
    });
    check(ring2d.ring.every((v) => v >= 250) && ring2d.hole.every((v) => v === 0), `a 2D hollow ring (drawDot) is whole: ring alpha ${ring2d.deg.map((d, k) => `${d}° ${ring2d.ring[k]}`).join(', ')}; hole alpha ${[...new Set(ring2d.hole)].join('/')}`);
    // the keyboard draws a section: Enter places A at the centre, the arrows move the map, Enter places A′
    await goto({ mode: 'history', window: 'decade', floor: 2.5, at: '2019-06-01', view: 'california', sheet: 'half' });
    await uq(() => window.__uq._.A.secSet({ on: false, a: null, b: null, hi: null }));
    await page.click('#section-btn'); await settle();
    await page.focus('#over'); await page.keyboard.press('Enter');
    const kA1 = await uq(() => !!window.__uq._.sec.kA);
    await page.keyboard.press('Escape'); await settle();
    const kA2 = await uq(() => ({ kA: window.__uq._.sec.kA, said: document.getElementById('announce').textContent, on: window.__uq.state().section.on, a: window.__uq.state().section.a }));
    check(kA1 && !kA2.kA && kA2.said === 'A cleared.' && kA2.on && !kA2.a, `Escape takes back a pending A: placed, then "${kA2.said}"; Section still on, nothing drawn`);
    await page.focus('#over'); await page.keyboard.press('Enter');
    for (let k = 0; k < 3; k++) { await page.keyboard.press('ArrowRight'); await settle(); }
    await page.keyboard.press('Enter'); await settle();
    s = await S(uq);
    const kb2 = await uq(() => ({ cap: window.__uq._.sec.cap && window.__uq._.sec.cap.textContent, said: document.getElementById('announce').textContent }));
    check(s.section.a && s.section.b && Math.abs(s.section.b[0] - s.section.a[0]) > 0.5 && /^Section drawn, /.test(kb2.said) && /earthquakes within ±50 km/.test(kb2.cap || ''),
      `the keyboard draws a section: A (${s.section.a && s.section.a.map((v) => v.toFixed(2))}) to A′ (${s.section.b && s.section.b.map((v) => v.toFixed(2))}), "${kb2.said}"`);
    // an A placed from the keyboard and then a section drawn by a drag: the drag's section stands, the pending A is gone
    await uq(() => window.__uq._.A.secSet({ a: null, b: null, hi: null })); await settle();
    await page.focus('#over'); await page.keyboard.press('Enter');
    const kA3 = await uq(() => !!window.__uq._.sec.kA);
    const dr3 = await uq(() => { const r = document.getElementById('over').getBoundingClientRect(); return [r.left + r.width * 0.3, r.top + r.height * 0.3, r.left + r.width * 0.6, r.top + r.height * 0.35]; });
    await page.mouse.move(dr3[0], dr3[1]); await page.mouse.down();
    for (let k = 1; k <= 10; k++) { await page.mouse.move(dr3[0] + ((dr3[2] - dr3[0]) * k) / 10, dr3[1] + ((dr3[3] - dr3[1]) * k) / 10); await page.waitForTimeout(16); }
    await page.mouse.up(); await settle();
    const kA4 = await uq(() => ({ kA: window.__uq._.sec.kA, a: window.__uq.state().section.a, b: window.__uq.state().section.b }));
    check(kA3 && !kA4.kA && kA4.a && kA4.b, `a section drawn by a drag ends the keyboard's pending A (pending before: ${kA3}; after: ${!!kA4.kA}; the drag's A ${kA4.a && kA4.a.map((v) => v.toFixed(2))})`);
    await uq(() => window.__uq._.A.secSet({ on: false, a: null, b: null, hi: null }));
    await cdp.detach();

    // 21. Snapshots: a gap, older than the history, broken, missing
    const D2 = Y(2027) - Y(2025);
    snapOverride = { body: shifted(D2) }; await uq(() => window.__uq._.refreshSnapshot()); await goto({ mode: 'history', window: 'year', floor: 4, at: '2026-06-01' });
    s = await S(uq);
    check(s.gap && s.body.includes('No data from 2026-01-01 to 2027-01-01 in this copy'), `gap: "${s.body.slice(0, 150)}"`);
    await shot('snapshot-gap');
    snapOverride = { body: shifted(-D2) }; await uq(() => window.__uq._.refreshSnapshot()); await goto({ mode: 'live', window: 'month' });
    s = await S(uq);
    check(/older than the app's history/.test(s.body) && /days old\. It shows nothing newer than/.test(s.notices), `older than the history: "${s.body.match(/The live data here[^.]*\./)}" and the notice "${s.notices}"`);
    const toFeed = `the 30 days to ${new Date(EPOCH + (snap.rows.to - D2) * 60000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    check(s.win.label === toFeed && s.body.includes(`Largest in ${toFeed}`) && !/the past /.test(s.body), `an aged copy names its window against the feed, not "the past": "${s.win.label}"`);
    await shot('snapshot-stale');
    // a status never read (ok: false, whatever `monitored` holds): every triangle empty, and the legend says why
    const unread = JSON.parse(shifted(0)); unread.volcanoes.ok = false;
    snapOverride = { body: JSON.stringify(unread) }; await uq(() => window.__uq._.refreshSnapshot()); await goto({ mode: 'live', window: 'month', view: 'alaska' });
    await page.click('#legend'); await settle();
    const vk = await uq(() => ({ key: [...document.querySelectorAll('#legend-card .krow')].map((r) => r.textContent).find((t) => t.startsWith('Volcanoes')), known: window.__uq._.A.vstat.known, filled: window.__uq._.A.vstat.byVnum.size }));
    check(!vk.known && vk.filled === 0 && vk.key === 'Volcanoes by threat class; volcano status not available in this copy', `volcano status never read: nothing filled (${vk.filled}), the legend reads "${vk.key}"`);
    await shot('volcano-unread');
    await page.keyboard.press('Escape');
    snapOverride = { body: '<!DOCTYPE html><html><body>Not Found</body></html>' }; await uq(() => window.__uq._.refreshSnapshot()); await goto({ mode: 'live' });
    s = await S(uq);
    check(/web page was written over it/.test(s.body), `broken: "${s.body.match(/data\/snapshot.json[^.]*/)}"`);
    await goto({ mode: 'history', window: 'year', floor: 4, at: '1964-06-01' });
    s = await S(uq);
    check(s.count > 0 && labelMatches(s, 60).ok, `broken snapshot: History still works ("${s.label}")`);
    // A missing file: Chromium itself logs the 404 of the fetch and reports it aborted; those two are expected here.
    expectErr = /status of 404|requestfailed .*\/data\/snapshot\.json$/;
    snapOverride = { status: 404 }; await uq(() => window.__uq._.refreshSnapshot()); await goto({ mode: 'live' });
    s = await S(uq);
    check(/has no data\/snapshot.json/.test(s.body) && s.count === 0, 'missing snapshot: Live says so and draws nothing');
    snapOverride = null; await uq(() => window.__uq._.refreshSnapshot()); expectErr = null;
    s = await S(uq);
    check(!s.snapErr && s.n === N, `the demo snapshot back: ${s.n} rows`);
  }

  check(P.errors.length === 0, `no console error or warning, page error, failed or outside request (${P.reqs.length} requests)${P.errors.length ? ': ' + P.errors.slice(0, 5).join(' | ') : ''}`);
  await P.ctx.close();

  // 22. The opening: first launch only, stored before it starts; watched in light, ended by a touch in dark
  {
    const O = await open(scheme, { intro: true });
    const i0 = await O.uq(() => ({ ...window.__uq.state().intro, stored: localStorage.getItem('uq.intro'), chip: window.__uq.state().chip, s: window.__uq.state().view.s }));
    check(i0.on && i0.stored === 'true' && i0.chip === null, `first launch: the opening runs, stored as seen before it starts, over the whole domain (s ${Math.round(i0.s)})`);
    if (scheme === 'light') {
      await O.page.waitForFunction(() => { const s = window.__uq.state(); return s.intro.on && s.drawn && (s.drawn.t1 - s.win.t0) / (s.win.t1 - s.win.t0) > 0.4; }, null, { timeout: 10000 });
      const mid = await S(O.uq);
      await O.page.screenshot({ path: path.join(out, `opening-${scheme}.png`) });
      console.log(`  opening-${scheme}.png`);
      const frac = (mid.drawn.t1 - mid.win.t0) / (mid.win.t1 - mid.win.t0), strip = await O.uq(() => window.__uq._.A.liveStrip.countText);
      check(frac > 0.4 && frac < 1 && strip === 'The last 30 days, as recorded', `mid-opening: the month written to ${(frac * 100).toFixed(0)} %, the strip reads "${strip}"`);
      await O.page.waitForFunction(() => !window.__uq.state().intro.on, null, { timeout: 6000 });
      await O.settle();
      const end = await S(O.uq);
      check(end.chip === 'lower-48' && end.drawn.t1 === end.win.t1 && end.mode === 'live' && end.liveWin === 'month' && end.liveAll, `waited out: the whole month drawn, the view eased to the Lower 48 (chip ${end.chip})`);
      await O.shot('opening-end');
    } else {
      await O.page.tap('#stamp', { position: { x: 6, y: 6 } });   // its left end: once the feed is 3 h old the stamp is long enough that its centre lies under the grip's hit area
      await O.settle();
      const end = await S(O.uq);
      check(!end.intro.on && end.chip === 'lower-48' && end.drawn.t1 === end.win.t1, `a touch ends the opening at its final state (chip ${end.chip}, the whole month drawn)`);
    }
    await O.page.reload();
    await O.page.waitForFunction(() => window.__uq && window.__uq.ready(), null, { timeout: 120000 });
    check(!(await O.uq(() => window.__uq.state().intro.on)), 'never twice: after a reload the opening does not run');
    check(O.errors.length === 0, `the opening: no console error (${O.errors.slice(0, 3).join(' | ')})`);
    await O.ctx.close();
  }
}

// The opening never runs under Reduce Motion, nor without a snapshot
{
  const O = await open(schemes[0], { intro: true, reduced: true });
  const r = await O.uq(() => ({ on: window.__uq.state().intro.on, stored: localStorage.getItem('uq.intro'), chip: window.__uq.state().chip }));
  check(!r.on && r.stored === null && r.chip === 'lower-48', `Reduce Motion: no opening, the app opens on the Lower 48 (${JSON.stringify(r)})`);
  await O.ctx.close();
  expectErr = /status of 404|requestfailed .*\/data\/snapshot\.json$/; snapOverride = { status: 404 };
  const Q = await open(schemes[0], { intro: true });
  const q = await Q.uq(() => ({ on: window.__uq.state().intro.on, stored: localStorage.getItem('uq.intro') }));
  check(!q.on && q.stored === null, `without a snapshot: no opening (${JSON.stringify(q)})`);
  await Q.ctx.close();
  snapOverride = null; expectErr = null;
}

// WebGL 2 unavailable: the sentence, no half map, and the sheet still lists
{
  const P = await open(schemes[0], { init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, o) { return t === 'webgl2' ? null : g.call(this, t, o); }; } });
  await P.uq(() => window.__uq.goto({ mode: 'live', window: 'month' }));
  const r = await P.uq(() => ({ nogl: !document.getElementById('nogl').hidden && document.getElementById('nogl').textContent, rows: document.querySelectorAll('#body .row').length,
    keys: ['tools', 'layers-btn', 'section-btn', 'focus-btn'].map((id) => { const e = document.getElementById(id); return `${id} ${getComputedStyle(e).display} ${e.getBoundingClientRect().width}`; }),
    shown: ['tools', 'layers-btn', 'section-btn', 'focus-btn', 'chips', 'legend', 'scale'].filter((id) => document.getElementById(id).checkVisibility()),
    credit: document.getElementById('credit').checkVisibility() && document.getElementById('credit').textContent,
    // every pixel of the three 2D map canvases, read back: the panel draws no map at all (DESIGN §3.2)
    ink: ['base', 'lines', 'over'].map((id) => { const c = document.getElementById(id), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return `${id} ${n}`; }) }));
  check(r.nogl === 'This map needs WebGL 2, which this device does not offer.' && r.rows > 0 && r.keys[0].startsWith('tools none ') && !r.shown.length,
    `without WebGL 2: "${r.nogl}", ${r.rows} list rows, the map's keys, chips, legend and scale bar not on screen (computed: ${r.keys.join(', ')}; shown: ${r.shown.join(', ') || 'none'})`);
  check(r.ink.every((q) => q.endsWith(' 0')) && (r.credit || '').startsWith('Not a warning service'),
    `without WebGL 2: no half map — painted pixels ${r.ink.join(', ')}; the credit line stays ("${r.credit}")`);
  await P.shot('no-webgl');
  check(P.errors.length === 0, `without WebGL 2: no console error (${P.errors.slice(0, 3).join(' | ')})`);
  await P.ctx.close();
}

await browser.close(); server.close();
if (fails.length) { console.log(`\n${fails.length} check(s) failed`); for (const f of fails) console.log(`  - ${f}`); process.exit(1); }
console.log('\nall checks pass');
