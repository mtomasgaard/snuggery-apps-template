// Drive Milky Way in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch), light and
// dark (HOUSE.md section 7.2; ART.md change list 21). Fails on any console error or warning, page
// error, failed request, HTTP ≥ 400, or any request outside the local server; the one message
// tolerated is headless Chromium's own "GPU stall due to ReadPixels" (its WebGL under SwiftShader
// says it whenever a screenshot reads the canvas back). Every figure it asserts is worked out here
// from the shipped files (tools/census.mjs: the planets' Chebyshev sum, the small bodies' Kepler
// solve, the stars, clusters and streams) and formats written here, never by importing js/.
//
// FRAME TIMES ARE HEADLESS CHROMIUM ON THIS MAC (SwiftShader WebGL): a trend only, never phone
// evidence. The phone's frame rate, memory and battery are the owner's checks (tools/DECISIONS.md).
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCRUB=0 node tools/shoot.mjs            skip the three-speed scrub (about 45 s)
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the scenes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's strings by role and name, the credits, the face and its supplement
// loaded, every inner planet on screen labeled), text contrast and the selection tracer, the Reach
// (its ink against the page; its census against this file's own, on the day shown), the caption band
// padding itself once the player has gone, the labels' halo on the plate, the card against this file's own decode
// and its sentence, SI in every visible text node, and the stock scenes as pictures (Find's field with
// no browser cross). Once: the
// real-touch scrub at 2, 8 and 20 days a second, play (its mark, About holding it, a touch landing),
// the year and speed keys, the zoom keys by touch and by keyboard, the plate holding still while the
// caption changes, the inner planets labeled through a year, the card keeping clear of the globe flown
// to (and of Saturn's rings) with its keys in view, focus mode end to end (its caption included) and the camera's way out of it, hidden, hit targets, About,
// Find and Layers (About no wider than the screen). Then the flights frame by frame on a stepped clock
// (no frame dominated by anything but space and the plate's own light; the Earth in view all the way
// there), Reduce Motion (the zoom keys' exact factor), broken data (the controls leave with the data,
// the stamp goes inert), and the widths (the card clear of the globe at each). Pictures: tools/.work/shots/, and
// with SCREENSHOTS=1 screenshots/*-{light,dark}.png; never screenshots/app.png, the README's composite.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { census, columns, planetKm, AU_KM, PC_AU } from './census.mjs';

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
const hashOf = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);
const appPngHash = hashOf(appPng);

/* ── formats, written here again (HOUSE.md section 6) ── */
const NN = '\u202F', MINUS = '\u2212';
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function num(v, d) {
  const s = Math.abs(v).toFixed(d), [i, f] = s.split('.'), neg = v < 0 && Number(s) !== 0;
  return (neg ? MINUS : '') + (i.length > 3 ? i.replace(/\B(?=(\d{3})+$)/g, NN) : i) + (f ? `.${f}` : '');
}
function sig3(v) { const p = 2 - Math.floor(Math.log10(Math.abs(v))); return p < 0 ? num(Math.round(v / 10 ** -p) * 10 ** -p, 0) : num(v, Math.min(6, p)); }
/** The label for a TDB Julian Date: TT − UTC is 69.184 s from 2017 on (37 leap seconds), the app's table. */
const utcOf = (jd) => new Date((jd - 2440587.5) * 864e5 - 69184);
const dateLabel = (t) => `${t.getUTCDate()} ${MONS[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
const dayLabel = (year, k) => dateLabel(new Date(Date.UTC(year, 0, 1 + k)));
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const pctl = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const named = JSON.parse(fs.readFileSync(path.join(APP, 'data/stars/named.json'), 'utf8'));
const physical = JSON.parse(fs.readFileSync(path.join(APP, 'data/physical.json'), 'utf8'));
const radiusKm = (id) => { const b = physical.bodies[id]; return b.radii_km ? b.radii_km[0] : b.radius_km; };
const ringOuterKm = Math.max(...physical.rings.saturn.map((r) => r.outer_km));       // the A ring's outer edge

/** A PNG (8-bit RGB or RGBA, not interlaced, as Chromium writes them) to RGBA pixels. */
function decodePng(buf) {
  let p = 8, w = 0, h = 0, bpp = 0; const idat = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bpp = d[9] === 6 ? 4 : d[9] === 2 ? 3 : 0; if (d[8] !== 8 || d[12] !== 0 || !bpp) throw new Error('png: only 8-bit RGB(A), not interlaced'); }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + n;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) px[(y * w + x) * 4 + k] = k < 3 || bpp === 4 ? line[x * bpp + k] : 255;
    prev = line;
  }
  return { w, h, px };
}

/* ── the server: the app folder, with a replaceable data/physical.json ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.bin': 'application/octet-stream', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = null;                                     // { status } or { body } for data/physical.json
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/data/physical.json' && override) {
    if (override.status) { res.writeHead(override.status); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(override.body); return;
  }
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
console.log(`headless Chromium ${browser.version()} with SwiftShader WebGL: every frame time below is a trend on this Mac, not phone evidence`);

const NOISE = /GPU stall due to ReadPixels|Multiple readback operations using getImageData/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const ready = () => window.__mw && /from the Sun/.test(document.getElementById('cap').textContent);

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(), errors = [];
  const excused = (t) => NOISE.test(t) || (o.expect && o.expect.test(t));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${r.url().slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  if (!o.noWait) await page.waitForFunction(ready, null, { timeout: 180000 });
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
const ST = (w) => w(() => window.__mw.state());
const settle = async (page, ms = 400) => { await page.waitForFunction(() => window.__mw && !window.__mw.rig.animating, null, { timeout: 60000 }); await page.waitForTimeout(ms); };

/* Text contrast over every rendered DOM text node (backgrounds composited), and hit targets. */
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
    if (!t.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr') || e.closest('#labels')) continue;
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
    // probed even when the box is 44 px: a later, positioned sibling (the track) can paint over its edge
    const okV = run(0, 1) >= 43.5, okH = run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Every visible text node: a hyphen-minus before a digit, or a plain space between a number and a unit. */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[  ](°|%|km|AU|pc|kpc|Mpc|h|d|s|min|years|light-[a-z]+)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    // the card's note and source quote the data's own text, which the app does not reformat
    if (!e || e.closest('[hidden]') || e.closest('script, style, #card-note, #card-src')) continue;
    const text = e.id === 'card-unit' ? document.getElementById('card-num').textContent + t.textContent : t.textContent;
    n++;
    if (/(^|[^\w])-\d/.test(text) || UNIT.test(text)) bad.push(text.trim().slice(0, 40));
  }
  return { n, bad };
});
/** The Reach's drawn ink composited over the page, against the page: every pixel of the bar's rows. */
const reachSamples = (w) => w(() => {
  const c = document.getElementById('reach-c'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  const dpr = c.width / c.getBoundingClientRect().width;
  const page = getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
  // the notch is a cut of the page's own color through the bar, with the hairline in it: left out
  const nx = ((Math.log10(window.__mw.census().you) + 3) / 15) * c.width;
  const out = [];
  for (let y = Math.round(7 * dpr); y < Math.round(13 * dpr); y++) for (let i = 0; i < c.width; i++) {
    if (Math.abs(i - nx) <= 3 * dpr) continue;
    const k = (y * c.width + i) * 4, a = d[k + 3] / 255;
    if (a > 0) out.push({ a, s: [0, 1, 2].map((j) => d[k + j] * a + page[j] * (1 - a)), page });
  }
  return out;
});

/** Each globe flown to with its card open: its disk, worked out here from data/physical.json and the
 *  camera's distance (and Saturn's rings, as the circle of their outer edge, where `rings`), clear of
 *  the card and the keys and inside the plate; the card's Fly there key in view (owner call 16). */
async function cardClear(A, rings) {
  const out = [];
  for (const id of ['saturn', 'jupiter', 'earth']) {
    await A.w((x) => { window.__mw.select(x, true); window.__mw.flyTo(x); }, id); await settle(A.page, 600);
    const q = await A.w((x) => {
      const pr = document.getElementById('plate').getBoundingClientRect(), rel = (e) => { const r = e.getBoundingClientRect(); return [r.left - pr.left, r.top - pr.top, r.right - pr.left, r.bottom - pr.top]; };
      const c = document.getElementById('card').getBoundingClientRect(), k = document.getElementById('card-go').getBoundingClientRect(), s = window.__mw.state();
      return { p: window.__mw.point(x), card: rel(document.getElementById('card')), keys: rel(document.getElementById('keys')), key: k.top >= c.top && k.bottom <= c.bottom + 0.5, dist: window.__mw.rig.dist, ppr: s.pxPerRad, W: s.W, H: s.H };
    }, id);
    const px = (km) => q.ppr * Math.asin(Math.min(1, km / AU_KM / q.dist));
    const clearOf = (R, b) => Math.hypot(q.p.x - Math.min(Math.max(q.p.x, b[0]), b[2]), q.p.y - Math.min(Math.max(q.p.y, b[1]), b[3])) >= R;
    const fits = (R) => clearOf(R, q.card) && clearOf(R, q.keys) && q.p.x - R >= 0 && q.p.x + R <= q.W && q.p.y - R >= 0 && q.p.y + R <= q.H;
    const r = px(radiusKm(id)), ring = rings && id === 'saturn' ? px(ringOuterKm) : 0;
    out.push({ id, r: Math.round(r), disk: fits(r), ring: Math.round(ring), rings: !ring || fits(ring), key: q.key });
  }
  await A.w(() => { window.__mw.select(null); window.__mw.goScale('solar'); }); await settle(A.page, 300);
  return [out.every((o) => o.disk && o.rings && o.key), out.map((o) => `${o.id} (disk ${o.r} px${o.ring ? `, rings ${o.ring} px` : ''}) ${o.disk && o.rings ? 'clear and on the plate' : 'COVERED OR CUT'}, key ${o.key ? 'in view' : 'HIDDEN'}`).join('; ')];
}
/** The inner planets through a year at the Solar System scale, every 15 days from the day shown: each
 *  one on the plate (and not under the keys, where no label may go) carries its label. */
async function innerYear(A) {
  const miss = [];
  let n = 0;
  for (let d = 0; d < 365; d += 15) {
    const r = await A.w(async (dd) => {
      const m = window.__mw; if (m.__j0 == null) m.__j0 = m.S.jd;
      m.setJd(m.__j0 + dd); await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const s = m.state(), on = new Set(m.placed().map((p) => p.id)), pr = document.getElementById('plate').getBoundingClientRect(), k = document.getElementById('keys').getBoundingClientRect();
      const under = (c) => c.x >= k.left - pr.left && c.x <= k.right - pr.left && c.y >= k.top - pr.top && c.y <= k.bottom - pr.top;
      return m.candidates().filter((c) => ['mercury', 'venus', 'earth', 'mars'].includes(c.id) && c.x > 0 && c.x < s.W && c.y > 0 && c.y < s.H && !under(c)).map((c) => [c.id, on.has(c.id), s.label]);
    }, d);
    n += r.length;
    for (const [id, on, label] of r) if (!on) miss.push(`${id} on ${label}`);
  }
  await A.w(() => { const m = window.__mw; m.setJd(m.__j0); m.__j0 = null; }); await A.page.waitForTimeout(200);
  return [n, miss];
}

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  await settle(page, 600);

  // boot: the camera's strings and controls, the credits, the face
  {
    const s = await ST(w);
    const roles = await Promise.all(['Solar System', 'Neighborhood', 'Milky Way', 'Play', 'Hide the controls', 'Find', 'Layers', 'Zoom in', 'Zoom out'].map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    const lowest = await w(() => { const b = [...document.querySelectorAll('button')].filter((e) => e.textContent.trim() === 'Milky Way' || e.getAttribute('aria-label') === 'Milky Way'); return b.length === 1 && b[0].closest('#scales') !== null; });
    const credits = await w(() => { const e = document.getElementById('credits'), r = e.getBoundingClientRect(); return { t: e.textContent, h: r.height, vis: getComputedStyle(e).visibility }; });
    const font = await w(() => document.fonts.check('560 11.5px "Ysabeau Office"') && document.fonts.check('600 21px "Ysabeau Office"') && document.fonts.check('560 11.5px "Ysabeau Office"', 'αʻ⁴'));
    const text = await page.getByText('from the Sun', { exact: false }).first().isVisible();
    // the inner planets on screen at boot each carry a label (Venus once lost its place to the Sun's)
    const inner = await w(() => { const s = window.__mw.state(), on = new Set(window.__mw.placed().map((p) => p.id));
      return window.__mw.candidates().filter((c) => ['mercury', 'venus', 'earth', 'mars'].includes(c.id) && c.x > 0 && c.x < s.W && c.y > 0 && c.y < s.H).map((c) => [c.id, on.has(c.id)]); });
    check(inner.length >= 3 && inner.every(([, on]) => on), `the inner planets on screen at boot are labeled: ${inner.map(([id, on]) => `${id} ${on ? 'labeled' : 'UNLABELED'}`).join(', ')}`);
    console.log(`  - boot: ready in ${A.ms} ms (headless Chromium); stamp "${await w(() => document.getElementById('stamp').textContent)}"; scale ${s.scale}`);
    check(text && roles.every((n) => n === 1) && lowest && s.scale === 'solar', `the camera's hooks: visible text with "from the Sun" (${text}); one button each named Solar System, Neighborhood, Milky Way, Play, Hide the controls, Find, Layers, Zoom in, Zoom out (${roles.join(', ')}); the only button named Milky Way is the scale word (${lowest})`);
    check(credits.t === 'NASA/JPL, USGS, ESA/Gaia/DPAC, AT-HYG, LVDB, galstreams, Stellarium' && credits.h > 0 && credits.vis === 'visible', `the credits on screen, words unchanged: "${credits.t}"`);
    check(font, 'the face and its supplement are loaded: document.fonts.check(560 11.5px, 600 21px, and α ʻ ⁴ in "Ysabeau Office")');
  }

  // text contrast; the selection tracer under the chosen scale word only
  {
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5, `text contrast: ${c.n} text nodes off the plate's labels, the lowest ${c.worst[0]}:1 at ${c.worst[1]} (≥ 4.5)`);
    const tr = await w(() => [...document.querySelectorAll('#scales button')].map((b) => [b.textContent, getComputedStyle(b, '::after').content !== 'none', b.getAttribute('aria-pressed') === 'true']));
    check(tr.every(([, mark, on]) => mark === on) && tr.filter((x) => x[1]).length === 1, `the selection tracer marks exactly the scale shown: ${tr.filter((x) => x[1]).map((x) => x[0]).join(', ')}`);
  }

  // the signature: the Reach's ink against the page, and its census against this file's
  {
    const px = await reachSamples(w);
    const ratios = px.map((p) => contrast(p.s, p.page)), full = px.filter((p) => p.a >= 0.99).map((p) => contrast(p.s, p.page));
    const share = ratios.filter((r) => r >= 3).length / Math.max(1, ratios.length);
    check(px.length > 500 && share >= 0.9 && full.every((r) => r >= 3), `the Reach's ink: ${px.length} drawn device pixels in the bar's rows, ${(share * 100).toFixed(1)} % at 3:1 or more against the page (target 90 %); fully drawn pixels at least ${Math.min(...full).toFixed(2)}:1; the lowest sample ${Math.min(...ratios).toFixed(2)}:1, an antialiased edge of a run`);
    const m = await w(() => window.__mw.census());
    const c = census(m.jd), mine = columns(c.lists, m.cols);
    let differ = 0, explained = 0;
    for (let k = 0; k < m.cols; k++) if (+m.mask[k] !== mine.ink[k]) { differ++; if (mine.near[k]) explained++; }
    check(m.cols > 600 && differ === explained, `the Reach's census on JD ${m.jd.toFixed(3)}: ${m.cols} device columns, ${[...m.mask].filter((v) => v === '1').length} inked; ${differ} differ from this file's decode (${explained} where a distance sits on a column's edge); the gap ${sig3(m.farthest)} AU to ${sig3(m.starNear / PC_AU)} pc (this file: ${sig3(c.farthest)} AU, ${sig3(c.starNear / PC_AU)} pc)`);
    const cap = (await ST(w)).caption;
    check(cap.includes(`none lie between ${sig3(c.farthest)}${NN}AU and ${sig3(c.starNear / PC_AU)}${NN}pc.`), `the caption names the gap from the data: "${cap.slice(cap.indexOf('The bar'))}"`);
    // within one year: the census is taken again for the day shown, not kept from the day the year began
    const s0 = await ST(w), follows = [];
    for (const [mo, d] of [[11, 30], [0, 2]]) {
      await w((jd) => window.__mw.setJd(jd), 2440587.5 + Date.UTC(s0.year, mo, d, 12) / 864e5); await page.waitForTimeout(300);
      const m2 = await w(() => window.__mw.census()), s2 = await ST(w), mine2 = columns(census(m2.jd).lists, m2.cols);
      let odd = 0;
      for (let k = 0; k < m2.cols; k++) if (+m2.mask[k] !== mine2.ink[k] && !mine2.near[k]) odd++;
      follows.push([s2.label, m2.jd === s2.jd, odd]);
    }
    await w((jd) => window.__mw.setJd(jd), s0.jd); await page.waitForTimeout(200);
    check(follows.every(([, same, odd]) => same && odd === 0), `the Reach's census is the day shown's: ${follows.map(([l, same, odd]) => `${l}, taken at the instant shown ${same}, ${odd} columns off this file's decode`).join('; ')}`);
  }

  // the bottom band pads itself for the home indicator once the player has gone (headless Chromium has
  // no safe areas, so the rule's selector is what is checked here; the inset itself is a phone check)
  {
    const pads = [];
    for (const sc of ['stars', 'solar']) {
      await w((x) => window.__mw.goScale(x), sc); await settle(page, 200);
      pads.push(await w(() => [window.__mw.state().scale, document.getElementById('player').hidden, document.querySelector('.caption').matches(':has(+ [hidden])')]));
    }
    check(pads.every(([, hid, pad]) => hid === pad) && pads[0][1] && !pads[1][1], `the caption band pads for the bottom safe area exactly when the player is gone: ${pads.map(([sc, hid, pad]) => `${sc}, player ${hid ? 'hidden' : 'shown'}, band pads ${pad}`).join('; ')}`);
  }

  // the labels on the plate: each label's brightest glyph pixel against the darkest of its halo
  {
    await w(() => window.__mw.goScale('galaxy')); await settle(page, 800);
    const boxes = await w(() => { const r = document.getElementById('plate').getBoundingClientRect(); return window.__mw.placed().map((p) => [p.id, p.box[0] + r.left, p.box[1] + r.top, p.box[2] + r.left, p.box[3] + r.top]); });
    const img = decodePng(await page.screenshot());
    const sc = img.w / 390, res = [];
    for (const [id, x0, y0, x1, y1] of boxes) {
      const ls = [];
      for (let y = Math.max(0, Math.round(y0 * sc)); y < Math.min(img.h, Math.round(y1 * sc)); y++) for (let x = Math.max(0, Math.round(x0 * sc)); x < Math.min(img.w, Math.round(x1 * sc)); x++) {
        const k = (y * img.w + x) * 4; ls.push([lum([img.px[k], img.px[k + 1], img.px[k + 2]]), k]);
      }
      if (ls.length < 20) continue;
      ls.sort((a, b) => a[0] - b[0]);
      const hi = ls[ls.length - 1][1], lo = ls[Math.floor(ls.length * 0.1)][1];
      res.push([id, contrast([img.px[hi], img.px[hi + 1], img.px[hi + 2]], [img.px[lo], img.px[lo + 1], img.px[lo + 2]])]);
    }
    const good = res.filter((r) => r[1] >= 4.5).length / Math.max(1, res.length), worst = res.reduce((a, b) => (b[1] < a[1] ? b : a), ['', 99]);
    check(res.length >= 5 && good >= 0.9, `the labels' halo over the galaxy view: ${res.length} labels, ${(good * 100).toFixed(0)} % with the brightest glyph pixel at 4.5:1 or more against the darker tenth of its box (target 90 %); the lowest ${worst[1].toFixed(2)}:1 (${worst[0]})`);
    await w(() => window.__mw.goScale('solar')); await settle(page, 600);
  }

  // the card against this file's own decode, and the sentence a tap says
  {
    await w(() => window.__mw.select('saturn', true)); await settle(page, 300);
    const s = await ST(w), card = await w(() => ({ num: document.getElementById('card-num').textContent, unit: document.getElementById('card-unit').textContent, sub: document.getElementById('card-sub').textContent,
      rows: [...document.querySelectorAll('#card-facts dt')].map((d) => [d.textContent, d.nextElementSibling.textContent]), live: document.getElementById('live').textContent, name: document.getElementById('card-name').textContent }));
    const sat = planetKm('saturn', s.jd), earth = planetKm('earth', s.jd);
    const au = Math.hypot(...sat) / AU_KM, dE = Math.hypot(sat[0] - earth[0], sat[1] - earth[1], sat[2] - earth[2]) / AU_KM;
    const fromEarth = (card.rows.find((r) => r[0] === 'From the Earth') || [])[1] || '';
    check(card.name === 'Saturn' && card.num === sig3(au) && card.unit === `${NN}AU` && card.sub === 'from the Sun' && fromEarth.startsWith(`${sig3(dE)}${NN}AU, `),
      `the card for Saturn: "${card.num}${card.unit} ${card.sub}" (this file: ${sig3(au)} AU), from the Earth "${fromEarth}" (this file: ${sig3(dE)} AU)`);
    check(card.live === `Saturn, planet, ${sig3(au)} astronomical units from the Sun.`, `the tap's sentence: "${card.live}"`);
    const k = named.name.indexOf('Sirius'), pc = Math.hypot(named.x[k], named.y[k], named.z[k]);
    await w((id) => window.__mw.select(id, true), `star:${k}`); await settle(page, 200);
    const star = await w(() => [document.getElementById('card-num').textContent, document.getElementById('card-unit').textContent, document.getElementById('card-sub').textContent]);
    check(star[0] === sig3(pc) && star[1] === `${NN}pc` && star[2].startsWith('from the Sun, '), `the card for Sirius: "${star.join('')}" (this file: ${sig3(pc)} pc from named.json)`);
    await w(() => window.__mw.select(null)); await settle(page, 100);
  }

  // SI in every visible text node
  {
    await w(() => window.__mw.select('jupiter')); await settle(page, 200);
    const si = await siOf(w);
    check(si.bad.length === 0 && si.n > 20, `SI: ${si.n} visible text nodes, no hyphen-minus before a digit and U+202F before every unit${si.bad.length ? ': ' + si.bad.join(' | ') : ''}`);
    await w(() => window.__mw.select(null));
  }

  // the stock scenes, as pictures
  const scenes = [
    ['solar', () => window.__mw.goScale('solar')], ['inner', () => window.__mw.flyTo('sun', 3.2)],
    ['earth', () => { window.__mw.select('earth'); window.__mw.flyTo('earth'); }], ['earth-moon', () => { window.__mw.select(null); window.__mw.flyTo('earth', 0.011); }],
    ['jupiter-moons', () => window.__mw.flyTo('jupiter', 0.02)], ['saturn', () => { window.__mw.select('saturn'); window.__mw.flyTo('saturn'); }],
    ['mars', () => { window.__mw.select(null); window.__mw.flyTo('mars'); }], ['stars', () => window.__mw.goScale('stars')],
    ['stars-60pc', () => window.__mw.flyTo('sun', 206265 * 60)], ['galaxy', () => window.__mw.goScale('galaxy')],
    ['galaxy-edge', () => { const m = window.__mw; m.flyTo('gal:centre', 206265e3 * 30, m.edgeDir()); }],
  ];
  for (const [name, fn] of scenes) { await w(fn); await settle(page, 500); await A.shot(`${name}-${scheme}`); }
  await w(() => window.__mw.goScale('solar')); await settle(page, 400);
  await w(() => { window.__mw.S.speed = 3; window.__mw.setPlaying(true); }); await page.waitForTimeout(3000); await w(() => { window.__mw.setPlaying(false); window.__mw.S.speed = 2; });
  await A.shot(`playing-${scheme}`);
  await A.tapEl('#btn-search'); await page.waitForTimeout(400); await page.fill('#search-q', 'sirius'); await page.waitForTimeout(300); await A.shot(`search-${scheme}`);
  {
    // Find's field draws no browser cross (its default blue is an accent): no blue-led pixel in its right end
    const f = await w(() => ({ r: document.getElementById('search-q').getBoundingClientRect().toJSON(), a: getComputedStyle(document.getElementById('search-q'), '::-webkit-search-cancel-button').appearance }));
    const img = decodePng(fs.readFileSync(path.join(OUT, `search-${scheme}.png`))), sc = img.w / 390;
    let blue = 0;
    for (let y = Math.round((f.r.top + 6) * sc); y < Math.round((f.r.bottom - 6) * sc); y++) for (let x = Math.round((f.r.right - 44) * sc); x < Math.round((f.r.right - 4) * sc); x++) {
      const k = (y * img.w + x) * 4; if (img.px[k + 2] - img.px[k] > 40) blue++;
    }
    check(f.a === 'none' && blue === 0, `Find's field: its cancel button's appearance is ${f.a}, and its right end holds ${blue} blue-led pixels (the browser's cross is gone)`);
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await A.tapEl('#stamp'); await page.waitForTimeout(400); await A.shot(`about-${scheme}`); await page.keyboard.press('Escape');
  check(A.errors.length === 0, `${scheme}: no console error or warning, page error, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once (light)');
{
  const A = await open('light');
  const { page, w, touch } = A;
  await w(() => window.__mw.goScale('solar')); await settle(page, 600);
  const rectOf = (sel) => w((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
  const PAD = 10;

  // the three-speed scrub, by real touches, across 60 days of the shown year
  if (process.env.SCRUB !== '0') {
    const r = await rectOf('#slider'), s0 = await ST(w);
    const n = s0.nDays, x0 = r.left + PAD, xw = r.width - 2 * PAD, y = r.top + 24;
    const xOf = (k) => x0 + (k / (n - 1)) * xw;
    const under = (x) => Math.max(0, Math.min(n - 1, Math.round(((x - x0) / xw) * (n - 1))));
    for (const speed of [2, 8, 20]) {
      const a = 100, b = 160, T = ((b - a) / speed) * 1000;
      await w(() => window.__mw.log(true));
      await touch('touchStart', xOf(a), y);
      const t0 = Date.now(); let sent = 0; const anims = [];
      for (;;) {
        const t = Date.now() - t0;
        if (t >= T) break;
        await touch('touchMove', xOf(a) + ((xOf(b) - xOf(a)) * t) / T, y); sent++;
        if (sent % 25 === 0) anims.push(...await w(() => document.getAnimations().map((x) => x.effect && x.effect.target).filter((e) => e && e.closest('#valid, .lead, #slider')).map((e) => e.id || e.className)));
        await new Promise((res) => setTimeout(res, 16 - ((Date.now() - t0) % 16)));
      }
      await touch('touchMove', xOf(b), y);
      await touch('touchEnd');
      await page.waitForTimeout(150);
      const log = await w(() => window.__mw.log(false)), year = (await ST(w)).year;
      const held = log.filter((f) => f.pressed && f.finger != null);
      let mismatch = 0, labelBad = 0, first = null;
      for (const f of held) {
        const want = under(f.finger);
        if (f.shown !== want || f.wanted !== want) { mismatch++; if (!first) first = { finger: +f.finger.toFixed(1), want, wanted: f.wanted, shown: f.shown }; }
        if (f.label !== dayLabel(year, f.shown)) labelBad++;
      }
      const order = []; for (const f of held) if (!order.length || order[order.length - 1] !== f.shown) order.push(f.shown);
      const inOrder = order.every((v, i) => !i || v > order[i - 1]);
      const after = log.find((f, i) => i > 0 && !f.pressed && log[i - 1].pressed);
      const secs = held.length ? (held[held.length - 1].t - held[0].t) / 1000 : 0;
      check(held.length > 0 && mismatch === 0 && labelBad === 0 && inOrder && after && after.shown === b && anims.length === 0,
        `scrub at ${speed} days a second (${sent} real touch moves, ${held.length} frames at ${(held.length / Math.max(secs, 1e-3)).toFixed(0)} a second): drawn = wanted = the day under the finger on every frame (${mismatch} differ${first ? ` first ${JSON.stringify(first)}` : ''}); the date the drawn day's (${labelBad} differ); ${order.length} days drawn, in order: ${inOrder}; the frame after the lift draws day ${after && after.shown} (want ${b}); ${anims.length} animations on the time row or track`);
    }
  }

  // play: the date is the drawn instant's on every frame, never backwards; then its mark, About, a touch
  {
    await w(() => window.__mw.setJd(window.__mw.S.jd - 30)); await page.waitForTimeout(150);
    await w(() => window.__mw.log(true));
    await A.tapEl('#t-play'); await page.waitForTimeout(3000);
    const during = await w(() => [getComputedStyle(document.getElementById('ico-play')).display, getComputedStyle(document.getElementById('ico-pause')).display, document.getElementById('t-play').getAttribute('aria-label')]);
    await A.tapEl('#t-play'); await page.waitForTimeout(150);
    const log = (await w(() => window.__mw.log(false))).filter((f) => f.playing);
    const paused = await w(() => [getComputedStyle(document.getElementById('ico-play')).display, getComputedStyle(document.getElementById('ico-pause')).display, document.getElementById('t-play').getAttribute('aria-label')]);
    let labelBad = 0, back = 0;
    for (let i = 0; i < log.length; i++) { if (log[i].label !== dateLabel(utcOf(log[i].jd))) labelBad++; if (i && log[i].jd < log[i - 1].jd) back++; }
    const span = log.length ? log[log.length - 1].jd - log[0].jd : 0;
    const iv = log.slice(1).map((f, i) => f.t - log[i].t);
    // at least 12 frames, so the per-frame checks have frames to check; how many more is a frame rate,
    // and nothing fails on a frame time here (HOUSE.md section 7.2): SwiftShader draws this scene at ~7 a second
    check(log.length >= 12 && labelBad === 0 && back === 0 && span > 15, `play at 7 days a second: ${log.length} drawn frames over ${span.toFixed(1)} days; the date is the drawn instant's on every frame (${labelBad} differ); never backwards (${back})`);
    console.log(`      frame time during play (HEADLESS CHROMIUM, SwiftShader, a trend only): interval median ${pctl(iv, 0.5).toFixed(1)} ms, p95 ${pctl(iv, 0.95).toFixed(1)} ms`);
    check(during.join() === 'none,block,Pause' && paused.join() === 'block,none,Play', `the Play key's mark follows play, by touch: playing ${during.join(', ')}; paused ${paused.join(', ')}`);
    await A.tapEl('#t-play'); await page.waitForTimeout(400);
    await A.tapEl('#stamp'); await page.waitForTimeout(250);
    const a0 = await ST(w); await page.waitForTimeout(800); const a1 = await ST(w);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    const a2 = await ST(w);
    check(a0.sheet === 'about' && a1.jd === a0.jd && a1.playing && a2.jd > a1.jd && a2.playing && a2.sheet === null, `About holds play still (JD ${a0.jd.toFixed(4)} to ${a1.jd.toFixed(4)} over 0.8 s, still playing) and play goes on once it closes (${a2.jd.toFixed(4)})`);
    const r = await rectOf('#slider'), n = a2.nDays;
    // read at the end of the next animation frame (the app's loop callback, registered before this one,
    // has drawn by then), not after a fixed 120 ms: at SwiftShader's ~140 ms a frame, a fixed wait could
    // read the state before the frame that draws the touched day
    await touch('touchStart', r.left + PAD + (30 / (n - 1)) * (r.width - 2 * PAD), r.top + 24);
    await w(() => new Promise((res) => requestAnimationFrame(() => res())));
    const held = await ST(w); await touch('touchEnd'); await page.waitForTimeout(100);
    check(!held.playing && held.shown === 30, `a touch on the track during play stops it and draws the day under the finger at once: day ${held.shown} (want 30), playing ${held.playing}`);
  }

  // the year and speed keys
  {
    const y0 = (await ST(w)).year;
    await A.tapEl('#t-yprev'); await page.waitForTimeout(200);
    const y1 = (await ST(w)).year, live = await w(() => document.getElementById('live').textContent);
    await A.tapEl('#t-ynext'); await page.waitForTimeout(200);
    const y2 = (await ST(w)).year;
    check(y1 === y0 - 1 && y2 === y0 && /^\w+day \d+ \w+ \d{4}, \d\d:\d\d UTC$/.test(live), `Previous year and Next year: ${y0} to ${y1} and back to ${y2}; the live region says "${live}"`);
    const labels = [];
    for (let i = 0; i < 5; i++) { await A.tapEl('#t-speed'); await page.waitForTimeout(80); labels.push(await w(() => { const e = document.getElementById('t-speed'); return [e.textContent, e.getAttribute('aria-label'), document.getElementById(e.getAttribute('aria-describedby')).textContent]; })); }
    check(labels.map((l) => l[0]).join('|') === [`1${NN}s = 30.4${NN}d`, `1${NN}s = 365.25${NN}d`, `1${NN}s = 1${NN}h`, `1${NN}s = 1${NN}d`, `1${NN}s = 7${NN}d`].join('|') && labels.every(([t, n]) => n === `Playback speed, now ${t}`) && labels[4][2] === '7 days a second',
      `the speed key cycles the five exposures in SI; its name carries its visible words and its description says them in words: ${labels.map((l) => l[0]).join(', ')} ("${labels[4][1]}", described "${labels[4][2]}")`);
  }

  // the zoom keys (owner call 13, WCAG 2.5.1): one finger zooms out, and so does the keyboard; each press
  // sets the double-tap's fling, so how far it carries depends on the frame rate (exactly ×2.83 under
  // Reduce Motion, below)
  {
    const still = () => page.waitForFunction(() => window.__mw.rig.vel.zoom === 0, null, { timeout: 15000 });
    const z0 = await w(() => window.__mw.rig.dist);
    await A.tapEl('#zoom-out'); await page.waitForTimeout(100); await still();
    const z1 = await w(() => window.__mw.rig.dist);
    await w(() => document.getElementById('zoom-in').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(100); await still();
    const z2 = await w(() => window.__mw.rig.dist);
    await w(() => document.getElementById('zoom-out').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(100); await still();
    const z3 = await w(() => window.__mw.rig.dist);
    check(z1 / z0 > 2 && z1 / z0 < 5 && z2 / z1 < 0.5 && z2 / z1 > 0.2 && z3 / z2 > 2 && z3 / z2 < 5,
      `the zoom keys: Zoom out by touch takes the camera from ${sig3(z0)} to ${sig3(z1)} AU of its target (×${(z1 / z0).toFixed(2)}); from the keyboard, Zoom in ×${(z2 / z1).toFixed(2)} and Zoom out ×${(z3 / z2).toFixed(2)}`);
    await w(() => window.__mw.goScale('solar')); await settle(page, 300);
  }

  // the plate holds still while the caption's words change; the card keeps clear of its object
  {
    await w(() => { window.__ro = []; new ResizeObserver((es) => window.__ro.push(...es.map((e) => Math.round(e.contentRect.height)))).observe(document.getElementById('plate')); });
    await page.waitForTimeout(200); await w(() => { window.__ro = []; });
    const c0 = (await ST(w)).caption;
    await w(() => window.__mw.flyTo('mars')); await settle(page, 300);
    const c1 = (await ST(w)).caption;
    await w(() => window.__mw.flyTo('sun', 7.5)); await settle(page, 300);
    const ro = await w(() => window.__ro);
    check(ro.length === 0 && c0 !== c1, `the plate holds still while the caption's words change ("${c0.slice(0, 30)}…" to "${c1.slice(0, 30)}…"): ${ro.length} resizes of #plate`);
    const [clear, said] = await cardClear(A, true);
    check(clear, `390 × 844: the view shifts a globe flown to clear of its card: ${said}`);
    const [n, miss] = await innerYear(A);
    check(n > 60 && miss.length === 0, `390 × 844: the inner planets on the plate carry their labels through a year, every 15 days (${n} placements${miss.length ? '; UNLABELED: ' + miss.join(', ') : ''})`);
  }

  // focus mode (HOUSE.md section 4.10)
  {
    const H0 = (await ST(w)).H;
    await w(() => window.__mw.select('earth')); await page.waitForTimeout(150);
    await A.tapEl('#focus-key'); await page.waitForTimeout(450);
    const f1 = await w(() => {
      const gone = ['head', 'keys', 'reach'].map((id) => { const e = document.getElementById(id); return [id, e.hidden, e.inert]; });
      const vis = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && r.height > 0; };
      return { gone, stay: ['stamp', 'cap', 'credits', 'valid', 'slider', 't-play', 'focus-exit'].map((id) => [id, vis(id)]), card: document.getElementById('card').hidden,
        live: document.getElementById('live').textContent, active: document.activeElement && document.activeElement.id, stampIn: document.getElementById('stamp-home').parentElement.id };
    });
    const tree = await Promise.all([page.getByRole('button', { name: 'Solar System' }).count(), page.getByRole('button', { name: 'Find' }).count(), page.getByRole('button', { name: 'Show the controls' }).count()]);
    const s1 = await ST(w);
    check(f1.gone.every(([, h, i]) => h && i) && f1.stay.every(([, v]) => v) && f1.stampIn === 'caption' && f1.card && tree[0] === 0 && tree[1] === 0 && tree[2] === 1 && s1.H > H0 && s1.focus,
      `focus mode by touch: the header, key column and Reach hidden and inert, gone from the accessibility tree (Solar System ${tree[0]}, Find ${tree[1]}); the card closed; the stamp moved into the caption; the caption, credits, date, track, Play and ghost key stay (${f1.stay.filter((x) => !x[1]).map((x) => x[0]).join(', ') || 'all'}); the plate grew ${H0} to ${s1.H} px`);
    check(f1.live === 'Controls hidden. Press Escape or the corner key to show them.' && f1.active !== 'focus-exit', `the live region says "${f1.live}"; after a touch, focus stays put (active: ${f1.active})`);
    check(/^You are .+ from the Sun; the screen spans .+ there\.$/.test(s1.caption), `in focus mode the caption says nothing of the Reach, which has gone: "${s1.caption}"`);
    const hf = await hitTargets(w);
    check(hf.bad.length === 0 && hf.n >= 5, `focus mode's hit targets ≥ 44 × 44 px: ${hf.n} controls${hf.bad.length ? '; too small: ' + hf.bad.join('; ') : ''}`);
    const r = await rectOf('#slider'), n = s1.nDays;
    await touch('touchStart', r.left + PAD, r.top + 24);
    for (let k = 0; k <= 20; k++) { await touch('touchMove', r.left + PAD + (k / (n - 1)) * (r.width - 2 * PAD), r.top + 24); await page.waitForTimeout(16); }
    await touch('touchEnd'); await page.waitForTimeout(150);
    const sc = await ST(w);
    await A.tapEl('#t-play'); await page.waitForTimeout(800); await A.tapEl('#t-play'); await page.waitForTimeout(150);
    const pl = await ST(w);
    const sun = await w(() => { const p = window.__mw.point('sun'), r = document.getElementById('plate').getBoundingClientRect(); return p && { x: p.x + r.left, y: p.y + r.top }; });
    if (sun) { await A.tapAt(sun.x, sun.y); await page.waitForTimeout(600); }
    const rd = await w(() => !document.getElementById('card').hidden && document.getElementById('card-name').textContent);
    check(sc.shown === 20 && pl.shown > 20 && !!rd, `in focus mode a scrub lands on day ${sc.shown} (want 20), play moves on to day ${pl.shown}, and a tap on the plate opens the card (${rd})`);
    await w(() => window.__mw.select(null));
    await A.tapEl('#focus-exit'); await page.waitForTimeout(300);
    const out1 = await ST(w), live2 = await w(() => document.getElementById('live').textContent);
    await w(() => document.getElementById('focus-key').focus());
    await page.keyboard.press('Enter'); await page.waitForTimeout(450);
    const k1 = await w(() => ({ focus: window.__mw.S.focus, active: document.activeElement.id }));
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await page.waitForTimeout(300);
    const rl = await w(() => ({ focus: window.__mw.S.focus, ghost: !document.getElementById('focus-exit').hidden, head: document.getElementById('head').hidden }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const esc = await w(() => ({ focus: window.__mw.S.focus, active: document.activeElement.id, live: document.getElementById('live').textContent }));
    check(!out1.focus && live2 === 'Controls shown.' && k1.focus && k1.active === 'focus-exit' && rl.focus && rl.ghost && rl.head && !esc.focus && esc.active === 'focus-key',
      `focus mode leaves by the ghost key ("${live2}"), enters by Enter with focus on the ghost key (${k1.active}), survives a reload (milkyway:focus), and leaves by Escape with focus back on its key (${esc.active})`);
  }

  // the marketing camera on a library left in focus mode: it waits for "from the Sun", then taps the
  // scale words, all hidden in focus mode; the ghost key named "Show the controls" brings them back
  {
    await w(() => window.__mw.setFocus(true)); await page.waitForTimeout(400);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await page.waitForTimeout(300);
    const roles = () => Promise.all(['Solar System', 'Neighborhood', 'Milky Way'].map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    const text = await page.getByText('from the Sun', { exact: false }).first().isVisible();
    const hidden = await roles();
    const ghost = page.getByRole('button', { name: 'Show the controls', exact: true });
    const gn = await ghost.count(), gb = await ghost.boundingBox();
    await A.tapAt(gb.x + gb.width / 2, gb.y + gb.height / 2); await page.waitForTimeout(300);
    const shown = await roles();
    const stored = await w(() => { try { return localStorage.getItem('milkyway:focus'); } catch { return 'unreadable'; } });
    check(text && hidden.every((n) => n === 0) && gn === 1 && shown.every((n) => n === 1) && stored === 'false',
      `a library left in focus mode, reloaded: "from the Sun" is visible, the scale words are absent (${hidden.join(', ')}); one tap on the one button named "Show the controls" brings each back (${shown.join(', ')}), and milkyway:focus reads '${stored}'`);
  }

  // hidden: no frame is drawn and the clock holds; visible again, it draws at once
  {
    await w(() => window.__mw.setPlaying(true)); await page.waitForTimeout(300);
    const hide = (on) => w((h) => {
      if (h) { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); }
      else { delete document.hidden; delete document.visibilityState; }
      document.dispatchEvent(new Event('visibilitychange'));
    }, on);
    await hide(true); await page.waitForTimeout(50);
    await w(() => window.__mw.log(true));
    const j0 = (await ST(w)).jd; await page.waitForTimeout(700); const j1 = (await ST(w)).jd;
    const frames = (await w(() => window.__mw.log(true))).length;
    await hide(false); await page.waitForTimeout(300);
    const back = (await w(() => window.__mw.log(false))).length;
    await w(() => window.__mw.setPlaying(false));
    check(frames === 0 && j1 === j0 && back > 3, `hidden: ${frames} frames drawn over 0.7 s and the date held (JD ${j0.toFixed(4)} to ${j1.toFixed(4)}); visible again, ${back} frames in 0.3 s`);
  }

  // hit targets
  {
    const h = await hitTargets(w);
    check(h.bad.length === 0 && h.n >= 12, `hit targets ≥ 44 × 44 px: ${h.n} controls${h.bad.length ? '; too small: ' + h.bad.join('; ') : ''}`);
  }

  // About, Find, Layers: dialogs that hold focus, close on Escape and give focus back
  {
    await w(() => document.getElementById('stamp').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const ab = await w(() => { const b = document.querySelector('#about .sheet-body'); return { open: !document.getElementById('about').hidden, sheet: window.__mw.S.sheet, text: document.getElementById('about').textContent, active: document.activeElement.textContent, sw: b.scrollWidth, cw: b.clientWidth }; });
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const closed = await w(() => ({ hidden: document.getElementById('about').hidden, active: document.activeElement.id }));
    check(ab.open && ab.sheet === 'about' && ab.active === 'Close' && closed.hidden && closed.active === 'stamp'
      && /Ysabeau Office by Christian Thalmann \(Catharsis Fonts\), SIL Open Font License 1\.1; a subset is in fonts\/ with its license\./.test(ab.text)
      && /NASA Jet Propulsion Laboratory/.test(ab.text) && /not empty space/.test(ab.text) && !/Atkinson|Newsreader|ruler at the bottom left/.test(ab.text),
    `About opens from the stamp by the keyboard with focus on Close, carries the sources, the face's credit and what the Reach is not, and neither of the two about.json blocks it writes in its own words; Escape closes it and focus returns to the stamp (${closed.active})`);
    check(ab.sw <= ab.cw, `About scrolls only down: its body ${ab.sw} px wide in ${ab.cw} (the sha256 lines wrap)`);
    await A.tapEl('#btn-search'); await page.waitForTimeout(400);
    await page.fill('#search-q', 'sirius'); await page.waitForTimeout(300);
    const res = await w(() => [...document.querySelectorAll('#search-res button')].map((b) => b.textContent));
    await A.tapEl('#search-res button'); await settle(page, 300);
    const found = await w(() => ({ sheet: window.__mw.S.sheet, name: document.getElementById('card-name').textContent }));
    check(res.length > 0 && /^Sirius/.test(res[0]) && found.sheet === null && found.name === 'Sirius', `Find: "sirius" lists ${res.length} buttons, the first "${res[0]}"; a tap closes the sheet and opens Sirius's card ("${found.name}")`);
    await w(() => window.__mw.select(null));
    await A.tapEl('#btn-layers'); await page.waitForTimeout(400);
    const ly = await w(() => ({ rows: document.querySelectorAll('#layer-rows input[type=checkbox]').length, expanded: document.getElementById('btn-layers').getAttribute('aria-expanded') }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    check(ly.rows === 19 && ly.expanded === 'true', `Layers: ${ly.rows} drawn checkboxes; its key says it is open (aria-expanded ${ly.expanded})`);
  }
  check(A.errors.length === 0, `once: no console error or warning, page error, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* The flights frame by frame (plan 0011 D8). On the phone the galaxy flight once filled the screen with
   the young-star map's blue for a few frames: it slid the target along the disk while the camera was
   still a few parsecs above it. Each flight here runs on a stepped clock, and every step's frame is read
   back from the WebGL buffer: its dominant color (the most common of 16 levels a channel, every fourth
   pixel) must be space or the plate's own light, neutral to warm (the stars, the disk model's glow),
   never led by blue. The flight to the Earth keeps the Earth on the plate all the way (it used to leave
   it for most of the flight, a black middle). */
console.log('\n== the flights, frame by frame (dark, DPR 1)');
{
  const A = await open('dark', { dpr: 1 });
  const { page, w } = A;
  await w(() => window.__mw.goScale('solar')); await settle(page, 400);
  await w(() => { const real = performance.now.bind(performance); window.__clock = null; performance.now = () => (window.__clock == null ? real() : window.__clock); });
  // draw the frame at clock time t and read it back: its dominant color, the camera's distance from the Sun
  const frameAt = (t, id) => w(async ([tt, ii]) => {
    window.__clock = tt; window.__mw.setJd(window.__mw.S.jd);
    await new Promise((res) => requestAnimationFrame(() => res()));
    const gl = document.getElementById('gl').getContext('webgl2'), cw = gl.drawingBufferWidth, ch = gl.drawingBufferHeight, px = new Uint8Array(cw * ch * 4);
    gl.readPixels(0, 0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const bins = new Map();
    for (let y = 0; y < ch; y += 4) for (let x = 0; x < cw; x += 4) {
      const i = (y * cw + x) * 4, k = (px[i] >> 4) * 256 + (px[i + 1] >> 4) * 16 + (px[i + 2] >> 4), b = bins.get(k) || [0, 0, 0, 0];
      b[0]++; b[1] += px[i]; b[2] += px[i + 1]; b[3] += px[i + 2]; bins.set(k, b);
    }
    let top = [0]; for (const b of bins.values()) if (b[0] > top[0]) top = b;
    const s = window.__mw.state(), q = ii && window.__mw.point(ii);
    return { dom: [top[1] / top[0], top[2] / top[0], top[3] / top[0]].map(Math.round), dSun: s.dSun, on: !ii || (!!q && q.x >= 0 && q.x <= s.W && q.y >= 0 && q.y <= s.H) };
  }, [t, id]);
  const fly = async (start, arg, n, id = null) => {
    await w(() => { window.__clock = performance.now(); });
    await w(start, arg);
    const { t0, dur } = await w(() => ({ t0: window.__mw.rig.anim.t0, dur: window.__mw.rig.anim.dur }));
    const out = [];
    for (let k = 0; k <= n; k++) out.push(await frameAt(t0 + (k / n) * dur, id));
    await w(() => { window.__clock = null; }); await settle(page, 200);
    return out;
  };
  const space = (c) => Math.max(...c) < 16;                                       // space's own bin
  const light = (c) => c[0] >= c[2] - 4 && c[1] >= c[2] - 6 && Math.max(...c) - Math.min(...c) <= 0.45 * Math.max(...c);
  const kpc = (au) => `${sig3(au / PC_AU / 1000)}${NN}kpc`;
  const summary = [], bad = [];
  for (const [from, to] of [['solar', 'stars'], ['stars', 'galaxy'], ['galaxy', 'stars'], ['stars', 'solar']]) {
    const f = await fly((x) => window.__mw.goScale(x), to, 32);
    const lit = f.filter((x) => !space(x.dom)), worst = lit.reduce((a, b) => (Math.max(...b.dom) > Math.max(...(a ? a.dom : [0])) ? b : a), null);
    for (const x of f) if (!space(x.dom) && !light(x.dom)) bad.push(`${from} to ${to} at ${kpc(x.dSun)}: (${x.dom.join(', ')})`);
    summary.push(`${from} to ${to}: ${f.length} frames, ${f.length - lit.length} space, ${lit.length} the plate's light${worst ? ` (brightest (${worst.dom.join(', ')}) at ${kpc(worst.dSun)})` : ''}`);
  }
  check(bad.length === 0, `the scale flights, every frame's dominant color space or the plate's neutral-to-warm light, none led by blue: ${summary.join('; ')}${bad.length ? '; NOT SO: ' + bad.join(' | ') : ''}`);
  await w(() => window.__mw.select('earth'));
  const e = await fly((x) => window.__mw.flyTo(x), 'earth', 24, 'earth');
  check(e.every((x) => x.on), `the flight to the Earth keeps it on the plate in ${e.filter((x) => x.on).length} of ${e.length} frames (the camera pulls back while the target moves)`);
  await w(() => { window.__mw.select(null); window.__mw.goScale('solar'); }); await settle(page, 300);
  check(A.errors.length === 0, `the flights: no console error or warning${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
}

/* Reduce Motion: every animation at zero, flights are cuts, play jumps whole steps once a second */
console.log('\n== Reduce Motion (dark)');
{
  const A = await open('dark', { reduced: true });
  const { page, w } = A;
  await w(() => window.__mw.goScale('solar')); await page.waitForTimeout(400);
  await w(() => window.__mw.goScale('stars'));
  const cut = await w(() => !window.__mw.rig.animating);
  await w(() => window.__mw.goScale('solar')); await page.waitForTimeout(300);
  const d = await w(() => getComputedStyle(document.querySelector('#scales button[aria-pressed="true"]'), '::after').animationDuration);
  await A.tapEl('#stamp'); await page.waitForTimeout(200);
  const sheet = await w(() => getComputedStyle(document.querySelector('#about .sheet-panel')).animationDuration);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await w(() => window.__mw.log(true));
  const j0 = (await ST(w)).jd;
  await A.tapEl('#t-play'); await page.waitForTimeout(2600); await A.tapEl('#t-play'); await page.waitForTimeout(100);
  const log = (await w(() => window.__mw.log(false))).filter((f) => f.playing);
  const jds = [...new Set(log.map((f) => f.jd))], steps = jds.map((j) => (j - j0) / 7);
  check(cut && d === '0s' && sheet === '0s' && jds.length >= 2 && steps.every((s) => Math.abs(s - Math.round(s)) < 1e-6),
    `Reduce Motion: a scale change is a cut (${cut}); the tracer ${d}, About ${sheet}; play jumps whole steps of 7 days once a second: ${jds.length} instants in 2.6 s, ${steps.map((s) => s.toFixed(3)).join(', ')} steps from the start`);
  const z0 = await w(() => window.__mw.rig.dist);
  await A.tapEl('#zoom-out'); await page.waitForTimeout(150);
  const z1 = await w(() => window.__mw.rig.dist);
  check(Math.abs(z1 / z0 / Math.exp(1.04) - 1) < 1e-9, `Reduce Motion: Zoom out is one step, at once: ×${(z1 / z0).toFixed(6)} (want e^1.04 = ${Math.exp(1.04).toFixed(6)})`);
  await A.shot('reduced-dark');
  check(A.errors.length === 0, `Reduce Motion: no console error or warning${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
}

/* Broken data: data/physical.json missing, not JSON, cut short: each a sentence on the plate */
console.log('\n== broken data');
{
  const text = fs.readFileSync(path.join(APP, 'data/physical.json'), 'utf8');
  const cases = [
    ['missing', { status: 404 }, /^data\/physical\.json could not be read \(HTTP 404\)\. The app’s files are incomplete: install its ZIP again\.$/],
    ['not JSON', { body: '<html>Bad gateway</html>' }, /^data\/physical\.json is not valid JSON; it looks like a web page was written over it\. /],
    ['cut short', { body: text.slice(0, Math.floor(text.length / 2)) }, /^data\/physical\.json is not valid JSON, or it was cut short\. /],
  ];
  for (const [name, ov, re] of cases) {
    override = ov;
    const A = await open('light', { noWait: true, expect: /physical\.json|404/ });
    await A.page.waitForFunction(() => !document.getElementById('notice').hidden, null, { timeout: 60000 });
    const e = await A.w(() => ({ text: document.getElementById('notice').textContent, stamp: document.getElementById('stamp').textContent, cap: document.getElementById('cap').textContent,
      gone: ['scales', 'keys', 'player'].every((id) => document.getElementById(id).hidden), credits: document.getElementById('credits').textContent.length > 0,
      inert: (() => { const b = document.getElementById('stamp'); b.focus(); return b.inert && document.activeElement !== b; })() }));
    // the browser's own accessibility tree (Playwright's role engine does not model inert)
    const ax = await A.cdp.send('Accessibility.getFullAXTree');
    const stampRole = ax.nodes.filter((nd) => !nd.ignored && nd.role && nd.role.value === 'button' && nd.name && nd.name.value === e.stamp).length;
    check(re.test(e.text) && !/from the Sun/.test(e.cap) && e.gone && e.credits && e.inert && stampRole === 0 && A.errors.length === 0, `${name}: "${e.text}"; the stamp says "${e.stamp}", inert (takes no focus; ${stampRole} buttons so named in the accessibility tree), no longer a key to About; no caption claims a distance; the scale words, keys and player leave (${e.gone}), the credits stay${A.errors.length ? '; ' + A.errors.join(' | ') : ''}`);
    await A.ctx.close();
  }
  override = null;
}

/* Widths and zoom: nothing scrolls sideways; the caption's longest words fit its fixed height */
console.log('\n== widths');
for (const [w0, h0, dpr, name] of [[320, 568, 2, '320'], [360, 740, 3, '360'], [375, 667, 2, '375'], [844, 390, 3, '844 × 390'], [312, 675, 2.5, '125 % zoom (312 × 675)']]) {
  const A = await open('light', { w: w0, h: h0, dpr });
  await A.w(() => window.__mw.goScale('solar')); await settle(A.page, 400);
  const m = await A.w(() => { const s = document.getElementById('scales'); return { sw: document.documentElement.scrollWidth, iw: innerWidth, row: s.scrollWidth, rowW: s.clientWidth, player: document.getElementById('player').getBoundingClientRect().bottom, ih: innerHeight, plate: document.getElementById('plate').getBoundingClientRect().height, keysRow: document.getElementById('plate').classList.contains('keys-row'), keysH: document.getElementById('keys').getBoundingClientRect().height }; });
  const h = await hitTargets(A.w);
  const fit = await A.w((nn) => {
    const e = document.getElementById('cap'), keep = e.textContent, out = [];
    for (const t of [`You are 999${nn}900${nn}km from the Sun; the screen spans 999${nn}900${nn}km there. The bar is inked where these catalogs hold an object; none lie between 160${nn}AU and 1.30${nn}pc.`,
      `You are 19${nn}900${nn}AU from the Sun; the screen spans 0.0999${nn}AU there. The bar is inked where these catalogs hold an object; none lie between 160${nn}AU and 1.30${nn}pc.`]) { e.textContent = t; out.push([e.scrollHeight, e.clientHeight]); }
    e.textContent = keep;
    return out;
  }, NN);
  check(fit.every(([sh, ch]) => sh <= ch), `${name}: the longest captions fit the caption's fixed height (${fit.map(([sh, ch]) => `${sh} in ${ch} px`).join(', ')})`);
  if (name === '844 × 390') check(m.plate >= 220 && (!m.keysRow || m.keysH <= 40), `a phone on its side: the plate ${m.plate.toFixed(0)} px tall (≥ 220)${m.keysRow ? `, the keys one row ${m.keysH.toFixed(0)} px high` : ', the key column fits it'}`);
  check(m.sw <= m.iw && m.row <= m.rowW && m.player <= m.ih + 0.5 && m.plate >= 120 && h.bad.length === 0 && A.errors.length === 0,
    `${name}: page ${m.sw} px wide in ${m.iw}; the scale words ${m.row} px in ${m.rowW}; the player ends at ${m.player.toFixed(0)} of ${m.ih}; the plate ${m.plate.toFixed(0)} px tall; ${h.n} hit targets ≥ 44${h.bad.length ? '; too small: ' + h.bad.join('; ') : ''}${A.errors.length ? '; ' + A.errors.join(' | ') : ''}`);
  if (['320', '375', '844 × 390'].includes(name)) {
    const [clear, said] = await cardClear(A, name === '375');
    check(clear, `${name}: the view shifts a globe flown to clear of its card: ${said}`);
  }
  if (name === '375') {
    const [n, miss] = await innerYear(A);
    check(n > 60 && miss.length === 0, `375: the inner planets on the plate carry their labels through a year, every 15 days (${n} placements${miss.length ? '; UNLABELED: ' + miss.join(', ') : ''})`);
  }
  if (name === '320') await A.shot('narrow-light', false);
  if (name === '844 × 390') await A.shot('landscape-light', false);
  await A.ctx.close();
}

await browser.close();
server.close();
check(hashOf(appPng) === appPngHash, `screenshots/app.png (the README's composite) untouched: ${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent'}`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n  - ${fails.join('\n  - ')}`); process.exit(1); }
console.log('\nall checks pass');
