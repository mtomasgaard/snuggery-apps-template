// Drive Anatomy in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through CDP),
// light and dark (HOUSE.md section 7.2; step 20 of the pass's change list, in tools/DECISIONS.md).
// Fails on any console error or warning, page error, failed request, HTTP ≥ 400, or any request outside
// the local server; the one message tolerated is SwiftShader's own "GPU stall due to ReadPixels".
// Every figure it asserts is worked out here from the shipped files with Node's own tools (the
// vertebrae, their bands and levels, the projection through the camera's matrices, the formats), never
// by importing js/.
//
// LOAD AND FRAME TIMES ARE HEADLESS CHROMIUM WITH SWIFTSHADER ON THIS MAC: a trend only, never phone
// evidence. The phone's frame rate, memory and battery are the owner's checks.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the scenes to screenshots/*-{light,dark}.png
//
// There is no time player in this app, so there is no scrub to run (HOUSE 4.0: a 3D view without time).
// Per theme: boot (the camera's strings by role and name, "Every layer is showing" only once the model
// is in, the credit, the face before the Levels' first draw), text contrast and the tracer, the Levels
// against this file's own projection of the data at the first-run view, in the front view and pulled
// apart, the column hidden from the top and from far away, eleven structures found by name with their
// card, bar and caption, the found kidney in its own color under X-ray, the signature sampler, the
// selection's outline on a vein, the card clear of the selection and of the Levels, SI in every visible
// text node, the Layers sheet, the scenes as pictures. Once: the camera's put-back (remove, explode by
// taps at 0.45 and 0.01, bring back, the opening frame again), the depth words, the card and the finger
// (taps across the plate), the plate holding still, focus mode end to end with the camera's way out,
// hidden, the loop at rest, hit targets in both modes, About, Reduce Motion switched while open, broken
// data, the widths, and focus mode's card against the ghost key at 390, 375 and 320 px wide. Pictures:
// tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png; never screenshots/app.png,
// the README's composite.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/* ── the data, read here (NOTES.md: geometry.json's boxes, anatomy.json's labels) ── */
const anat = JSON.parse(fs.readFileSync(path.join(APP, 'data/anatomy.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(path.join(APP, 'data/geometry.json'), 'utf8'));
const BOX = new Map(geo.parts.map((p) => [p.id, p]));
const SPINE = ['atlas', 'axis', 'cervical', 'thoracic', 'lumbar', 'sacrum'];
const VERT = anat.parts.filter((p) => p.label && SPINE.includes(p.type) && BOX.has(p.id)).map((p) => {
  const b = BOX.get(p.id);
  return { id: p.id, label: p.label, c: (b.min[1] + b.max[1]) / 2, top: b.max[1], bot: b.min[1], x: (b.min[0] + b.max[0]) / 2, z: (b.min[2] + b.max[2]) / 2 };
}).sort((a, b) => b.c - a.c);
const EDGE = VERT.map((v, i) => [i ? (VERT[i - 1].c + v.c) / 2 : v.top, i < VERT.length - 1 ? (VERT[i + 1].c + v.c) / 2 : v.bot]);
const levelAt = (y) => (y > EDGE[0][0] ? 'above C1' : y < EDGE[EDGE.length - 1][1] ? 'below the sacrum' : VERT[EDGE.findIndex((e) => y >= e[1])].label);
const words = (lo, hi) => (levelAt(hi) === levelAt(lo) ? levelAt(hi) : `${levelAt(hi)} to ${levelAt(lo)}`);
const byName = (n) => anat.parts.find((p) => p.name === n);
const spanOfName = (n) => { const b = BOX.get(byName(n).id); return { lo: b.min[1], hi: b.max[1], words: words(b.min[1], b.max[1]) }; };

/* ── formats and sentences, written here again (HOUSE.md section 6; ART.md section 1) ── */
const NN = ' ';
const RULE = `Levels: this body’s spine in ${VERT.length} levels, ${VERT[0].label} to ${VERT[VERT.length - 1].label}, drawn beside it where the camera sees them.`;
// no column, and the caption says which of the two reasons holds (review, 2026-10-02)
const HID = { steep: 'Levels: turn the body upright to read its vertebrae beside it.', small: 'Levels: come closer to read this body’s vertebrae beside it.' };
const spanLine = (w, drawn, why = 'small') => {
  if (w.startsWith('above ') && !w.includes(' to ')) return `The selection lies ${w}, over the top of the spine.`;
  if (w === 'below the sacrum') return 'The selection lies below the sacrum, under the spine.';
  const verb = w.startsWith('above ') ? 'runs from' : w.includes(' to ') ? 'spans' : 'lies at';
  return drawn ? `The selection ${verb} ${w} on this body’s spine: the bar beside the levels.` : `The selection ${verb} ${w}; ${why === 'steep' ? 'turn the body upright' : 'come closer'} to see its bar.`;
};
/** Pixels that differ by more than `t` (summed over the channels) between two decoded plate shots. */
const differs = (a, b, x, y, t = 24) => { const p = a.at(x, y), q = b.at(x, y); return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) > t; };
const inRect = (X, Y, r, m = 4) => r && X >= r.left - m && X <= r.right + m && Y >= r.top - m && Y <= r.bottom + m;
const exploded = (pct, by) => `Pulled apart ${pct}${NN}% by ${by}, a display distance; the levels follow the vertebrae as drawn.`;
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const pctl = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const INK = { light: '#0f1c23', dark: '#e6edee' }, PAGE = { light: '#e8eef0', dark: '#141d21' };

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
  return { w, h, px, at: (x, y) => { const i = (Math.round(y) * w + Math.round(x)) * 4; return [px[i], px[i + 1], px[i + 2]]; } };
}

/* ── the server: the app folder, with any file replaceable ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = {};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const ov = override[u];
  if (ov) { if (ov.status) { res.writeHead(ov.status); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(u)] || 'application/octet-stream' }); res.end(ov.body); return; }
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
console.log(`headless Chromium ${browser.version()} with SwiftShader WebGL: every load and frame time below is a trend on this Mac, not phone evidence`);

const NOISE = /GPU stall due to ReadPixels/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const ready = () => window.__anatomy && window.__anatomy.ready();

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  if (o.focus !== undefined) await ctx.addInitScript((f) => { try { localStorage.setItem('skeleton-viewer:focus', f ? '1' : '0'); } catch { /* fine */ } }, o.focus);
  // the first moment "Every layer is showing" reaches the page (text or a name), and whether the model was in then
  await ctx.addInitScript(() => {
    const look = () => {
      if (window.__seen || !document.body) return;
      const named = [...document.querySelectorAll('[aria-label]')].some((e) => /every layer is showing/i.test(e.getAttribute('aria-label')));
      if (!named && !/every layer is showing/i.test(document.body.textContent || '')) return;
      window.__seen = { ready: !!(window.__anatomy && window.__anatomy.ready()), levels: window.__anatomy ? window.__anatomy.stats().levels : -1, font: document.fonts.check('560 10.5px "Ysabeau Office"') };
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label'] });
  });
  const page = await ctx.newPage(), errors = [];
  const excused = (t) => NOISE.test(t) || (o.expect && o.expect.test(t));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:') && !(o.file && u.startsWith('file:'))) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${u.slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(o.url || `${origin}index.html`);
  if (!o.noWait) { await page.waitForFunction(ready, null, { timeout: 240000 }); await page.waitForTimeout(400); }
  const ms = Date.now() - t0;
  const w = (fn, arg) => page.evaluate(fn, arg);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tapAt = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd'); };
  const rect = (sel) => w((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
  const tapEl = async (sel) => {
    await w((s) => { const e = document.querySelector(s), r = e.getBoundingClientRect(); if (r.left < 0 || r.right > innerWidth) e.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, sel);
    const r = await rect(sel); await tapAt(r.left + r.width / 2, r.top + r.height / 2);
  };
  const frame = () => w(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  /** Until nothing moves: no frame asked for, no tween running. */
  const idle = async (max = 8000) => { const t = Date.now(); while (Date.now() - t < max) { const s = await w(() => window.__anatomy.stats()); if (!s.raf && !s.tweens) return true; await page.waitForTimeout(60); } return false; };
  const shot = async (name, keep = true) => {
    await page.waitForTimeout(300);
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    if (keep && KEEP) { if (`${name}.png` === 'app.png') throw new Error('never screenshots/app.png'); fs.copyFileSync(p, path.join(SHOTS, `${name}.png`)); }
    console.log(`      ${name}.png${keep && KEEP ? ' → screenshots/' : ''}`);
    return p;
  };
  const plateShot = async (name) => { const pr = await rect('#plate'); const p = path.join(OUT, `${name}.png`); await page.screenshot({ path: p, clip: { x: pr.left, y: pr.top, width: pr.width, height: pr.height } }); return { img: decodePng(fs.readFileSync(p)), pr }; };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, tapEl, rect, frame, idle, shot, plateShot };
}
/** Find a structure by its exact name: Find, the field, a tap on its row; then wait out the flight. */
async function find(A, name) {
  await A.tapEl('#btn-find');
  await A.page.waitForFunction(() => !document.getElementById('find').hidden && document.querySelector('#find .dialog-sheet').getAnimations().length === 0, null, { timeout: 5000 });
  await A.page.fill('#search', name.toLowerCase()); await A.page.waitForTimeout(150);
  const r = await A.w((n) => { const b = [...document.querySelectorAll('#tree .t-part')].find((e) => e.querySelector('.p-name').firstChild.textContent === n); if (b) b.scrollIntoView({ block: 'center' }); return b ? b.getBoundingClientRect().toJSON() : null; }, name);
  if (!r) return false;
  await A.tapAt(r.left + 40, r.top + r.height / 2);
  await A.page.waitForTimeout(100);
  const closed = await A.w(() => document.getElementById('find').hidden);
  await A.idle(); await A.frame();
  return closed;
}
/** A 4 × 4 column-major matrix times a 4-vector. */
const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
/** A part's box from geometry.json, moved by its explode offset, projected through the hook's matrices:
 *  its rectangle on the plate in CSS px, or null when a corner lies behind the camera. */
function boxOnPlate(cam, id, off = [0, 0, 0]) {
  const b = BOX.get(id), r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let i = 0; i < 8; i++) {
    const e = mul(cam.proj, mul(cam.view, [(i & 1 ? b.max[0] : b.min[0]) + off[0], (i & 2 ? b.max[1] : b.min[1]) + off[1], (i & 4 ? b.max[2] : b.min[2]) + off[2], 1]));
    if (e[3] <= 0) return null;
    const x = (e[0] / e[3] + 1) / 2 * cam.w, y = (1 - e[1] / e[3]) / 2 * cam.h;
    r.left = Math.min(r.left, x); r.right = Math.max(r.right, x); r.top = Math.min(r.top, y); r.bottom = Math.max(r.bottom, y);
  }
  return r;
}
const meets = (a, b) => !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
/** Taps at each point; for every tap that selects a structure (or whose click reaches the card), what
 *  the card did: how far the tapped point lies outside it (its clearance), the clicks that reached it,
 *  any change beyond the selection (X-ray, a hidden or isolated structure, the camera, the card shut),
 *  and the card, the ghost key, the status plate and the plate as laid out. Each card is shut by a tap
 *  on its ✕, a new touch, which also ends the opening tap's click window. */
async function cardTaps(A, pts) {
  await A.w(() => {
    window.__cardClicks = [];
    if (!window.__cardWatch) { window.__cardWatch = true; document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#card')) window.__cardClicks.push(e.target.id || e.target.textContent.trim().slice(0, 16)); }, true); }
  });
  // the camera counts as moved past 0.1 mm: OrbitControls rewrites its position each frame through a
  // spherical round trip, which can change the last bits of a float without anything moving
  const out = [], cam0 = await A.w(() => window.__anatomy.camera().pos), moved = (p) => Math.max(...p.map((v, i) => Math.abs(v - cam0[i]))) > 1e-4;
  for (const [x, y] of pts) {
    await A.w(() => { window.__cardClicks = []; });
    await A.tapAt(x, y); await A.page.waitForTimeout(250); await A.idle();
    const r = await A.w(() => {
      const R = (id) => { const e = document.getElementById(id); return e.hidden ? null : e.getBoundingClientRect().toJSON(); };
      return { sel: window.__anatomy.selection(), card: R('card'), ghost: R('focus-exit'), status: R('status'), plate: R('plate'), clicks: window.__cardClicks.slice(), xray: document.getElementById('c-ghost').getAttribute('aria-pressed') === 'true', cam: window.__anatomy.camera().pos };
    });
    if (!r.sel && !r.clicks.length) continue;
    const c = r.card, clear = c ? Math.max(c.left - x, x - c.right, c.top - y, y - c.bottom) : Infinity;
    out.push({ x, y, ...r, clear, changed: !r.sel || !c || r.xray || !!r.status || moved(r.cam) });
    if (c) { await A.tapEl('#c-close'); await A.idle(); }
  }
  return out;
}
/** The script's own projection of the vertebrae through the hook's matrices, with each one's explode offset. */
async function ownColumn(A) {
  const cam = await A.w(() => window.__anatomy.camera());
  const off = await A.w((ids) => window.__anatomy.offsets(ids), VERT.map((v) => v.id));
  const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
  const sy = (v, i, y) => { const o = off[i] || [0, 0, 0]; const e = mul(cam.proj, mul(cam.view, [v.x + o[0], y + o[1], v.z + o[2], 1])); return (1 - e[1] / e[3]) / 2 * cam.h; };
  const centers = VERT.map((v, i) => sy(v, i, v.c));
  // ART.md section 1: where a group of vertebrae rises past its neighbor, the column keeps the spine's order
  for (let i = 1; i < centers.length; i++) centers[i] = Math.max(centers[i], centers[i - 1]);
  const top = Math.min(sy(VERT[0], 0, VERT[0].top), centers[0]), bottom = Math.max(sy(VERT[VERT.length - 1], VERT.length - 1, VERT[VERT.length - 1].bot), centers[centers.length - 1]);
  const knotsW = [EDGE[0][0], ...VERT.map((v) => v.c), EDGE[EDGE.length - 1][1]], knotsS = [top, ...centers, bottom];
  const toCol = (y) => { if (y >= knotsW[0]) return knotsS[0]; for (let i = 1; i < knotsW.length; i++) if (y >= knotsW[i]) return knotsS[i - 1] + (knotsS[i] - knotsS[i - 1]) * (knotsW[i - 1] - y) / (knotsW[i - 1] - knotsW[i]); return knotsS[knotsS.length - 1]; };
  const edges = EDGE.map(([hi, lo]) => [toCol(hi), toCol(lo)]);
  return { cam, centers, top, bottom, edges, toCol, tall: bottom - top };
}
const levelsOf = (A) => A.w(() => window.__anatomy.levels());
const caption = (A) => A.w(() => document.getElementById('capline').textContent);

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
    if (!t.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr') || e.closest('svg')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const c = ratio(over(rgba(cs.color), bgOf(e)), bgOf(e));
    n++;
    if (c < worst[0]) worst = [c, `${e.id || e.className || e.tagName} "${t.textContent.trim().slice(0, 24)}"`];
  }
  return { n, worst: [Math.round(worst[0] * 100) / 100, worst[1]] };
});
const hitTargets = (w) => w(() => {
  const bad = [], seen = [];
  for (const e of document.querySelectorAll('button, [role="slider"], [role="radio"], [role="checkbox"], input')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    // a control partly scrolled out of view (the row of words, a sheet) is measured where it is wholly in view
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !at(cx, cy)) continue;
    const sc = e.closest('.row, .layers, .dialog-body, .card-body');
    if (sc) { const s = sc.getBoundingClientRect(); if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) continue; }
    seen.push(e.id || (e.textContent || '').trim().slice(0, 12));
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 280 && at(cx + (s * k * dx) / 4, cy + (s * k * dy) / 4); k++) n++; return n / 4; };
    const okV = run(0, 1) >= 43.5, okH = run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Every visible text node: a hyphen-minus before a digit, a plain space between a number and a unit,
 *  or four digits ungrouped (years excepted). The data's own sentences in About are verbatim. */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[  ](m|cm|mm|MB|%|px)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, #ab-sources, #ab-gaps, #ab-intro, .card-desc, .card-note')) continue;
    const text = t.textContent;
    n++;
    const groups = text.replace(/\b(19|20)\d\d\b|r186/g, '').match(/\d{5,}|\b\d{4}\b(?![.\d])/g);
    if (/(^|[^\w+])-\d/.test(text) || UNIT.test(text) || groups) bad.push(text.trim().slice(0, 40));
  }
  return { n, bad };
});

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
let opening = null;
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the first frame: ${A.ms} ms (headless)`);

  // boot: the camera's strings and controls, "Every layer is showing" only once the model is in, the credit, the face
  {
    const seen = await w(() => window.__seen);
    const peel = await page.getByRole('button', { name: /^Remove the/ }).count();
    const peelName = await w(() => document.getElementById('btn-peel').getAttribute('aria-label'));
    const slider = await page.getByRole('slider', { name: 'Explode amount', exact: true }).count();
    const buttons = await Promise.all(['Hide the controls', 'Zoom in', 'Zoom out', 'Show the whole body', 'Layers', 'Find a structure', 'Explode'].map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    const radios = await Promise.all(['Skin', 'Bone', 'Part', 'Group', 'Region'].map((n) => page.getByRole('radio', { name: n, exact: true }).count()));
    const views = await Promise.all(['Front', 'Back', 'Left', 'Right', 'Top'].map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    const credit = await w(() => [document.getElementById('credits').textContent, document.getElementById('credits').getBoundingClientRect().height > 0]);
    check(seen && seen.ready && seen.font, `"Every layer is showing" first appears with the model in (ready ${seen && seen.ready}) and the face loaded before the Levels' first draw (${seen && seen.font})`);
    check(peel === 1 && peelName === 'Remove the skin and hair layer' && slider === 1 && buttons.every((n) => n === 1) && radios.every((n) => n === 1) && views.every((n) => n === 1),
      `camera's controls: one button named "${peelName}", the slider "Explode amount", ${buttons.length} keys, ${radios.length} words and the five views by role and exact name`);
    check(credit[0] === 'BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP and CC BY 4.0' && credit[1], `the credit on screen, word for word: "${credit[0]}"`);
  }

  // text contrast and the tracer
  {
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5, `text contrast: ${c.n} text nodes, the lowest ${c.worst[0]}:1 (${c.worst[1]})`);
    const tr = await w(() => [...document.querySelectorAll('.words button')].filter((b) => b.offsetParent !== null && getComputedStyle(b, '::after').content !== 'none' && getComputedStyle(b, '::after').backgroundImage !== 'none').map((b) => b.textContent));
    check(tr.join(',') === 'Skin,Part', `the tracer runs under exactly the chosen words: ${tr.join(', ')}`);
  }

  // Find's field with words in it (QA, 2026-10-01): the engine's clear button is drawn in its accent color,
  // so it is switched off and the house's own ✕ stands in; no pixel of the field may carry a hue
  {
    await A.tapEl('#btn-find');
    await page.waitForFunction(() => !document.getElementById('find').hidden && document.querySelector('#find .dialog-sheet').getAnimations().length === 0, null, { timeout: 5000 });
    const inertIn = await w(() => ['head', 'plate', 'caption', 'dissect'].map((id) => document.getElementById(id).inert));
    const empty = await w(() => document.getElementById('search-clear').hidden);
    await page.fill('#search', 'femur'); await page.waitForTimeout(150);
    const fr = await A.rect('.find-field'), fp = path.join(OUT, `find-typed-${scheme}.png`);
    await page.screenshot({ path: fp, clip: { x: fr.left, y: fr.top, width: fr.width, height: fr.height } });
    const img = decodePng(fs.readFileSync(fp)); let spread = 0, hued = 0;
    for (let i = 0; i < img.px.length; i += 4) { const d = Math.max(img.px[i], img.px[i + 1], img.px[i + 2]) - Math.min(img.px[i], img.px[i + 1], img.px[i + 2]); spread = Math.max(spread, d); if (d > 40) hued++; }
    const shown = await w(() => !document.getElementById('search-clear').hidden && document.querySelectorAll('#tree .t-part').length);
    const hc = await hitTargets(w);
    await A.tapEl('#search-clear'); await page.waitForTimeout(150);
    const after = await w(() => [document.getElementById('search').value, document.activeElement && document.activeElement.id, document.getElementById('search-clear').hidden, document.querySelectorAll('#tree .t-layer').length]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    const inertOut = await w(() => ['head', 'plate', 'caption', 'dissect'].map((id) => document.getElementById(id).inert));
    check(empty && shown > 0 && hued === 0 && !hc.bad.length && after[0] === '' && after[1] === 'search' && after[2] && after[3] > 0,
      `Find with "femur" typed: ${shown} results, the house's "Clear the search" key shown (hidden while empty: ${empty}), no hued pixel in the field (the widest channel spread ${spread} of 255, none over 40; the engine's own blue key measured 123), ${hc.n} controls at least 44 × 44; the key empties the field ("${after[0]}"), hides itself, keeps focus on the field and brings back the ${after[3]} layers`);
    check(inertIn.every(Boolean) && inertOut.every((x) => !x), `while Find is open the header, the plate, the caption and the dissection band are inert (${inertIn.join(', ')}); closed, none is (${inertOut.join(', ')})`);
  }

  // the Levels at the first-run view, against this file's own projection of the data's boxes
  const compareColumn = async (label) => {
    const L = await levelsOf(A), own = await ownColumn(A);
    let worst = 0, n = 0;
    for (const b of L.blocks) { const i = VERT.findIndex((v) => v.label === b.label); worst = Math.max(worst, Math.abs(b.top - own.edges[i][0]), Math.abs(b.bottom - own.edges[i][1])); n++; }
    check(L.drawn && n >= 20 && worst <= 1, `${label}: ${n} blocks drawn, every edge within ${worst.toFixed(3)} px of this file's projection (at most 1); the rule ${Math.round(own.tall)} px tall; labels ${L.labels.map((l) => l.label).join(' ')}`);
    return { L, own };
  };
  await compareColumn('the Levels at the first-run view');
  check((await caption(A)) === RULE, `the caption: "${await caption(A)}"`);
  await w(() => document.activeElement && document.activeElement.blur());   // no focus ring in the picture
  const first = await A.shot(`open-${scheme}`);
  if (scheme === schemes[0]) opening = decodePng(fs.readFileSync(first));

  // the signature sampler: each block's ink against the halo beside it, over whatever is under it
  {
    const p = path.join(OUT, `levels-${scheme}.png`), pr = await A.rect('#plate');
    await page.screenshot({ path: p, clip: { x: 0, y: pr.top, width: 60, height: pr.height } });
    const img = decodePng(fs.readFileSync(p)), L = await levelsOf(A), sc = img.w / 60, s = [];
    for (const b of L.blocks) for (let y = b.top + 1; y < b.bottom - 1.5; y += 1) s.push(contrast(img.at(38.5 * sc, y * sc), img.at(34.2 * sc, y * sc)));
    const lowest = Math.min(...s), at3 = s.filter((x) => x >= 3).length / s.length;
    check(s.length > 100 && at3 >= 0.9, `the signature sampler: ${s.length} samples of the blocks against their halo, ${(at3 * 100).toFixed(1)} % at 3:1 or more (the target 90 %), median ${pctl(s, 0.5).toFixed(2)}:1, the lowest ${lowest.toFixed(2)}:1 (an edge pixel the antialiasing blends, which palette.py's 11.66 / 9.70 for the full mark does not see)`);
  }

  // the selection's outline on a muscle at the opening view (review, 2026-10-02): the back-face hulls
  // z-fought with thin soft tissue and scribbled ink and halo inside the silhouette. The silhouette is
  // measured here, not taken from the app: the same view drawn from a copy of anatomy.json that colors
  // the muscle pure green (served in place of the file, read by the app's own refresh), every green
  // pixel its own, eroded 4 px for the antialiased edge. Inside it the selected frame must equal the
  // unselected one pixel for pixel, since the outline alone marks a selection this small; at its edge
  // the outline's ink must show. Shown to catch the fault: with the hulls' stencil test taken out of
  // app.js (tools/.work/outline-proof.mjs, light), 910 of 4 010 pixels inside changed; with it, 0.
  {
    const MUSCLE = 'Left external oblique', b = BOX.get(byName(MUSCLE).id), cam = await A.w(() => window.__anatomy.camera());
    const mul = (m, v) => [0, 1, 2, 3].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);
    const e = mul(cam.proj, mul(cam.view, [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.max[2] * 0.8 + b.min[2] * 0.2, 1]));
    const pr = await A.rect('#plate'), tx = pr.left + (e[0] / e[3] + 1) / 2 * cam.w, ty = pr.top + (1 - e[1] / e[3]) / 2 * cam.h;
    const U = await A.plateShot(`tap-off-${scheme}`);
    await A.tapAt(tx, ty); await page.waitForTimeout(300); await A.idle(); await A.frame();
    const sel = await A.w(() => window.__anatomy.selection()), meta = sel && anat.parts.find((p) => p.id === sel.id);
    const S1 = await A.plateShot(`tap-sel-${scheme}`), card = await A.rect('#card');
    if (scheme === schemes[0]) await A.shot(`tap-${scheme}`, false);
    await A.tapEl('#c-close'); await A.idle(); await A.frame();
    const keyed = JSON.parse(JSON.stringify(anat)); keyed.parts.find((p) => p.name === MUSCLE).color = '#00ff00';
    const reread = async () => { await A.w(() => window.dispatchEvent(new Event('focus'))); await page.waitForTimeout(1500); await A.idle(); await A.frame(); };
    override = { '/data/anatomy.json': { body: JSON.stringify(keyed) } }; await reread();
    const G = await A.plateShot(`tap-key-${scheme}`);
    override = {}; await reread();
    const sc = U.img.w / U.pr.width, W2 = U.img.w, H2 = U.img.h, E = Math.round(4 * sc), mask = new Uint8Array(W2 * H2);
    const skip = (x, y) => x < 56 * sc || inRect(x / sc + U.pr.left, y / sc + U.pr.top, card);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const p = G.img.at(x, y); if (!skip(x, y) && p[1] - Math.max(p[0], p[2]) > 60) mask[y * W2 + x] = 1; }
    // the eroded mask, by a separable minimum: rows, then columns
    const rowMin = new Uint8Array(W2 * H2), core = new Uint8Array(W2 * H2);
    for (let y = 0; y < H2; y++) for (let x = E; x < W2 - E; x++) { let m = 1; for (let d = -E; d <= E && m; d++) m = mask[y * W2 + x + d]; rowMin[y * W2 + x] = m; }
    for (let y = E; y < H2 - E; y++) for (let x = 0; x < W2; x++) { let m = 1; for (let d = -E; d <= E && m; d++) m = rowMin[(y + d) * W2 + x]; core[y * W2 + x] = m; }
    let inside = 0, area = 0, ring = 0, inkPx = 0;
    const ink = hexRgb(INK[scheme]);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      if (skip(x, y)) continue;
      if (core[y * W2 + x]) { area++; if (differs(U.img, S1.img, x, y)) inside++; continue; }
      if (!differs(U.img, S1.img, x, y)) continue;   // outside the eroded silhouette: the outline, nothing else
      ring++; const p = S1.img.at(x, y); if (Math.abs(p[0] - ink[0]) + Math.abs(p[1] - ink[1]) + Math.abs(p[2] - ink[2]) < 60) inkPx++;
    }
    check(meta && meta.layer === 'muscle' && area > 2000 && inside === 0 && inkPx > 100,
      `a tap at the chest selects ${meta ? `${meta.name} (${meta.layer})` : 'nothing'}: inside its silhouette (${area} device pixels, eroded 4 px) ${inside} pixels change when it is selected (0: no ink or halo inside, no tint); outside it ${ring} change, the outline, ${inkPx} of them its --ink`);
    await A.tapEl('#fit'); await A.idle();
  }

  // the front view: the column again; the top view and far away: no column, and the caption says why
  {
    await A.tapEl('#views [data-view="front"]'); await A.idle(); await A.frame();
    await compareColumn('the front view');
    await A.tapEl('#views [data-view="top"]'); await A.idle(); await A.frame();
    const top = await levelsOf(A), ct = await caption(A);
    for (let i = 0; i < 4; i++) { await A.tapEl('#zoom-out'); await A.idle(); }
    await A.tapEl('#views [data-view="front"]'); await A.idle();
    for (let i = 0; i < 4; i++) { await A.tapEl('#zoom-out'); await A.idle(); }
    await A.frame();
    const far = await levelsOf(A), own = await ownColumn(A), cf = await caption(A);
    check(!top.drawn && top.reason === 'steep' && ct === HID.steep && !far.drawn && far.reason === 'small' && own.tall < 120 && cf === HID.small,
      `no column from the top (${top.blocks.length} blocks) or from far away (the rule ${Math.round(own.tall)} px, under 120), and the caption gives each its own reason: "${ct}", then "${cf}"`);
    await A.tapEl('#fit'); await A.idle(); await A.frame();
  }

  // pulled apart 45 % by part: the blocks follow the drawn vertebrae
  {
    await A.w(() => { const s = document.getElementById('explode'); s.value = 45; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); });
    await A.idle(); await A.frame();
    const off = await A.w((ids) => window.__anatomy.offsets(ids), VERT.map((v) => v.id));
    const moved = off.filter((o) => Math.hypot(...o) > 0.001).length;
    await compareColumn(`pulled apart 45 % by part (${moved} of ${VERT.length} vertebrae moved)`);
    check((await caption(A)) === exploded(45, 'part'), `the caption: "${await caption(A)}"`);
    await A.shot(`explode-${scheme}`);
    await A.w(() => { const s = document.getElementById('explode'); s.value = 0; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); });
    await A.idle();
  }

  // eleven structures found by name: the card's Levels row, the bar's ends on this file's map, the caption
  {
    const NAMES = ['Right kidney', 'Left kidney', 'Celiac trunk', 'Right renal artery', 'Abdominal aorta', 'Hyoid bone', 'Cricoid cartilage', 'Trachea', 'Pancreas', 'Xiphoid process', 'Left scapula'];
    const rows = [], xray = [];
    for (const n of NAMES) {
      const found = await find(A, n);
      await A.page.waitForTimeout(120);   // the live region fills 50 ms after it is cleared
      const r = await A.w(() => ({ name: document.getElementById('c-name').textContent, levels: document.getElementById('c-levels').textContent, cap: document.getElementById('capline').textContent, live: document.getElementById('live').textContent, card: document.getElementById('card').getBoundingClientRect().toJSON(), sel: window.__anatomy.selection(), plate: document.getElementById('plate').getBoundingClientRect().toJSON(), ghost: document.getElementById('c-ghost').getAttribute('aria-pressed') }));
      const L = await levelsOf(A), own = await ownColumn(A), sp = spanOfName(n);
      const barOk = L.drawn ? !!L.bar && Math.abs(L.bar.top - own.toCol(sp.hi)) <= 1 && Math.abs(L.bar.bottom - Math.max(own.toCol(sp.lo), own.toCol(sp.hi) + 2)) <= 1 : !L.bar;
      const c = r.sel && r.sel.center, cardClear = !c || !(c.x >= r.card.left - r.plate.left && c.x <= r.card.right - r.plate.left && c.y >= r.card.top - r.plate.top && c.y <= r.card.bottom - r.plate.top);
      // a structure the layers in front hide turns X-ray on, and the sentence says so after the levels
      const xr = r.ghost === 'true', saidX = /X-ray on, so it shows through the [a-z]+\.$/.test(r.live);
      if (xr) xray.push(n);
      const okRow = found && r.name === n && r.levels === sp.words && r.cap === spanLine(sp.words, L.drawn, L.reason) && barOk && cardClear && r.card.left >= 52 && r.live.includes(`Levels ${sp.words}.`) && xr === saidX;
      rows.push([okRow, `${n} ${r.levels}${L.drawn ? '' : ' (no column)'}${xr ? ' (X-ray)' : ''}${barOk ? '' : ' BAR OFF'}${cardClear ? '' : ' CARD OVER IT'}`]);
      if (n === 'Right kidney') {
        // the kidney shows: the body changes when it is found, not only the card, the bar and the caption
        await A.shot(`kidney-${scheme}`);
        const card = await A.rect('#card'), K = await A.plateShot(`kidney-on-${scheme}`);
        // ... and in its own color (final review, 2026-10-02): the see-through layers in front of it
        // washed it at 12 % each, so it read only by its outline. Drawn after them, over them, its pixels
        // cannot depend on what lies in front: the same view with every layer but the organs turned off
        // (by the Layers sheet's own words, which move no camera) must match it inside its silhouette,
        // measured from a copy of anatomy.json that keys it green, eroded 4 px. Shown to catch the fault:
        // with app.js as it was, the green kidney measured only 2 127 device px under the wash and 1 910
        // of them changed (median 44 of 765); with the change, 29 462 and 0.
        {
          const LAY = anat.layers.map((l) => l.id), was = await A.w(() => JSON.parse(localStorage.getItem('skeleton-viewer:layerModes') || '{}'));
          const setModes = (want) => A.w((m) => { for (const row of document.querySelectorAll('#layer-rows .lrow')) if (m[row.dataset.layer]) row.querySelector(`[data-mode="${m[row.dataset.layer]}"]`).click(); }, want);
          const reread = async () => { await A.w(() => window.dispatchEvent(new Event('focus'))); await page.waitForTimeout(1500); await A.idle(); await A.frame(); };
          await setModes(Object.fromEntries(LAY.filter((l) => l !== 'organ').map((l) => [l, 'off']))); await A.idle(); await A.frame();
          const alone = await A.plateShot(`kidney-alone-${scheme}`);
          const keyed = JSON.parse(JSON.stringify(anat)); keyed.parts.find((p) => p.name === 'Right kidney').color = '#00ff00';
          override = { '/data/anatomy.json': { body: JSON.stringify(keyed) } }; await reread();
          const G = await A.plateShot(`kidney-key-${scheme}`);
          override = {}; await reread();
          await setModes(Object.fromEntries(LAY.map((l) => [l, was[l] || (l === 'skin' ? 'fade' : 'on')]))); await A.idle(); await A.frame();
          const back = await A.plateShot(`kidney-back-${scheme}`);
          const sc = K.img.w / K.pr.width, W2 = K.img.w, H2 = K.img.h, E = Math.round(4 * sc), mask = new Uint8Array(W2 * H2);
          const skip = (x, y) => x < 56 * sc || inRect(x / sc + K.pr.left, y / sc + K.pr.top, card);
          for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { const q = G.img.at(x, y); if (!skip(x, y) && q[1] - Math.max(q[0], q[2]) > 60) mask[y * W2 + x] = 1; }
          const rowMin = new Uint8Array(W2 * H2), core = new Uint8Array(W2 * H2);
          for (let y = 0; y < H2; y++) for (let x = E; x < W2 - E; x++) { let m = 1; for (let d = -E; d <= E && m; d++) m = mask[y * W2 + x + d]; rowMin[y * W2 + x] = m; }
          for (let y = E; y < H2 - E; y++) for (let x = 0; x < W2; x++) { let m = 1; for (let d = -E; d <= E && m; d++) m = rowMin[(y + d) * W2 + x]; core[y * W2 + x] = m; }
          let area = 0, inside = 0, restored = 0;
          for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) { if (core[y * W2 + x]) { area++; if (differs(K.img, alone.img, x, y)) inside++; } if (!skip(x, y) && differs(K.img, back.img, x, y)) restored++; }
          check(area > 10000 && inside === 0 && restored < 50, `the found kidney in its own color under X-ray: inside its silhouette (${area} device pixels, eroded 4 px) ${inside} pixels change when every layer but the organs is turned off (0: nothing in front washes over it); the layers put back, ${restored} pixels differ from the found frame`);
        }
        await A.tapEl('#c-close'); await A.idle(); await A.frame();
        const O = await A.plateShot(`kidney-off-${scheme}`), sc = K.img.w / K.pr.width;
        let body = 0;
        for (let y = 0; y < K.img.h; y += 2) for (let x = Math.round(56 * sc); x < K.img.w; x += 2) if (!inRect(x / sc + K.pr.left, y / sc + K.pr.top, card) && differs(K.img, O.img, x, y)) body++;
        check(xr && /through the muscles\.$/.test(r.live) && body > 2000, `Right kidney found: X-ray is on (${r.ghost}), the sentence ends "${r.live.slice(r.live.indexOf('X-ray'))}", and ${body} sampled body pixels outside the card change against the same view with it let go (before the review, none did)`);
      }
    }
    check(rows.every((x) => x[0]), `${rows.length} structures found by name, each with its card's Levels row, its bar's ends within 1 px of this file's map, its caption and its sentence (X-ray, said, for ${xray.length}: ${xray.join(', ')}), the card clear of it and of the Levels: ${rows.map((x) => x[1]).join('; ')}`);
    await A.tapEl('#c-close'); await A.frame();
  }

  // the selection's outline on a vein, against the same view unselected
  {
    await find(A, 'Left great saphenous vein');
    const card = await A.rect('#card');
    const a = await A.plateShot(`vein-sel-${scheme}`);
    const st = await A.w(() => ({ ...window.__anatomy.stats(), ghost: document.getElementById('c-ghost').getAttribute('aria-pressed') }));
    await A.w(() => document.getElementById('c-close').click()); await A.idle(); await A.frame();
    const b = await A.plateShot(`vein-off-${scheme}`);
    const sc = a.img.w / a.pr.width, ink = hexRgb(INK[scheme]);
    let diff = 0, inkPx = 0;
    for (let y = 0; y < a.img.h; y += 2) for (let x = Math.round(56 * sc); x < a.img.w; x += 2) {
      const X = x / sc + a.pr.left, Y = y / sc + a.pr.top;
      if (X >= card.left - 4 && X <= card.right + 4 && Y >= card.top - 4 && Y <= card.bottom + 4) continue;
      const p = a.img.at(x, y), q = b.img.at(x, y);
      if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) > 24) { diff++; if (Math.abs(p[0] - ink[0]) + Math.abs(p[1] - ink[1]) + Math.abs(p[2] - ink[2]) < 60) inkPx++; }
    }
    check(st.hulls === 2 && st.ghost === 'false' && diff > 200 && inkPx > 60, `the vein's selection: ${st.hulls} outline hulls, X-ray off (it lies under the faded skin only); ${diff} sampled pixels change when it is cleared, ${inkPx} of them the outline's --ink (${INK[scheme]})`);
    await A.tapEl('#fit'); await A.idle();
  }

  // SI in every visible text node, with the card open and About open
  {
    await find(A, 'Right kidney');
    const s1 = await siOf(w);
    await A.tapEl('#c-close');
    await A.tapEl('#stamp'); await page.waitForTimeout(300);
    const s2 = await siOf(w);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    check(s1.bad.length + s2.bad.length === 0, `SI: ${s1.n + s2.n} visible text nodes with the card and About open: no hyphen-minus before a digit, U+202F before every unit, thousands grouped${s1.bad.concat(s2.bad).length ? ': ' + s1.bad.concat(s2.bad).join(' | ') : ''}`);
    await A.tapEl('#fit'); await A.idle();
  }
  // the Layers sheet, the same scene in both themes (final review, 2026-10-02: the two pictures caught
  // the selection tracer mid-draw and showed different scenes): the whole body from the front, nothing
  // selected, the picture taken once no animation is left on the page and the plate has drawn
  {
    await A.tapEl('#views [data-view="front"]'); await A.idle();
    await A.tapEl('#btn-layers');
    await page.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 8000 });
    await A.idle(); await A.frame();
    // the row of words back at its start (tapping Front scrolled it), so the chosen depth word and its tracer show
    await w(() => { document.activeElement && document.activeElement.blur(); document.getElementById('row').scrollLeft = 0; });
    const still = await w(() => [document.getAnimations().length, getComputedStyle(document.querySelector('#layer-rows [aria-checked="true"]'), '::after').clipPath, window.__anatomy.selection()]);
    await A.shot(`layers-${scheme}`);
    await A.tapEl('#layers-close'); await A.idle();
    check(still[0] === 0 && !still[2], `the Layers sheet's picture: no animation running (${still[0]}), the tracer drawn whole (clip-path ${still[1]}), nothing selected, the whole body from the front`);
  }
  check(A.errors.length === 0, `no console error or warning, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
{
  console.log('\n== once, light');
  const A = await open('light');
  const { page, w } = A;

  // the camera's put-back (HOUSE 7.4): remove the skin, the track tapped at 0.45 and 0.01, the skin
  // brought back, "Every layer is showing" again, the opening frame again
  {
    const a0 = await A.plateShot('putback-0');
    await page.getByRole('button', { name: /^Remove the/ }).tap(); await page.waitForTimeout(500); await A.idle();
    const r = await A.rect('#explode');
    await A.tapAt(r.left + r.width * 0.45, r.top + r.height / 2); await A.idle();
    const v45 = await w(() => +document.getElementById('explode').value);
    await A.shot('peeled-explode-light');
    // the camera was still at its fit, so the body is fitted again pulled apart: the plate's top and
    // foot rows, between the Levels and the keys, are bare ground (the README picture needs the whole body)
    const ex = await A.plateShot('putback-45'), sc45 = ex.img.w / ex.pr.width, g = hexRgb(PAGE.light);
    let edge = 0, bare = 0;
    for (const y of [2, 4, 6, ex.img.h - 7, ex.img.h - 5, ex.img.h - 3]) for (let x = Math.round(60 * sc45); x < ex.img.w - Math.round(60 * sc45); x += 2) {
      const q = ex.img.at(x, y); edge++; if (Math.abs(q[0] - g[0]) + Math.abs(q[1] - g[1]) + Math.abs(q[2] - g[2]) <= 6) bare++;
    }
    check(bare / edge >= 0.99, `pulled apart 45 % from the opening's fit, the body is fitted again and stays on the plate: ${(bare / edge * 100).toFixed(1)} % of ${edge} pixels along its top and foot are bare ground`);
    await A.tapAt(r.left + r.width * 0.01, r.top + r.height / 2); await A.idle();
    const v0 = await w(() => +document.getElementById('explode').value);
    await page.getByRole('button', { name: /^Bring back the/ }).tap(); await page.waitForTimeout(500); await A.idle(); await A.frame();
    const back = await w(() => document.getElementById('btn-add').getAttribute('aria-label'));
    const a1 = await A.plateShot('putback-1');
    let d = 0; for (let i = 0; i < a0.img.px.length; i += 4) if (Math.abs(a0.img.px[i] - a1.img.px[i]) + Math.abs(a0.img.px[i + 1] - a1.img.px[i + 1]) + Math.abs(a0.img.px[i + 2] - a1.img.px[i + 2]) > 6) d++;
    check(v45 >= 42 && v45 <= 46 && v0 === 0 && back === 'Every layer is showing' && d / (a0.img.px.length / 4) < 0.002,
      `the camera's put-back: a tap at 0.45 of the track lands on ${v45} (42 to 46), at 0.01 on ${v0}; the skin brought back ("${back}"); the plate equals the opening frame (${d} pixels differ)`);
  }

  // the depth words: Bone leaves bone and teeth; Skin brings everything back in its mode
  {
    await page.getByRole('radio', { name: 'Bone', exact: true }).tap(); await page.waitForTimeout(500); await A.idle();
    const b = await w(() => [JSON.parse(localStorage.getItem('skeleton-viewer:layerModes')), document.querySelector('#depth [aria-checked="true"]').textContent, document.getElementById('btn-peel').textContent]);
    await A.shot('bone-light');
    await page.getByRole('radio', { name: 'Skin', exact: true }).tap(); await page.waitForTimeout(500); await A.idle();
    const s = await w(() => [JSON.parse(localStorage.getItem('skeleton-viewer:layerModes')), document.getElementById('btn-add').getAttribute('aria-label')]);
    const offs = Object.entries(b[0]).filter(([, m]) => m === 'off').map(([k]) => k).sort().join(',');
    check(offs === 'artery,cartilage,muscle,nerve,organ,skin,vein' && b[1] === 'Bone' && b[2] === 'Only bone and teeth are left' && s[0].skin === 'fade' && Object.values(s[0]).every((m) => m !== 'off') && s[1] === 'Every layer is showing',
      `the depth words: Bone leaves bone and teeth (off: ${offs}; "${b[2]}"); Skin brings every layer back, the skin faded as it was ("${s[1]}")`);
  }

  // the card and the finger (final review, 2026-10-02): the card was placed by the selection's center,
  // so a tap on a structure reaching below the card opened it under the finger, and the tap's own click,
  // which the browser sends after the pointerup to whatever then stands there, pressed a key on it.
  // Taps across the plate at the opening view, 9 columns over the body and 19 rows, denser over the top
  // half where the card stands; for each that selects a structure: the tapped point lies 23 px or more
  // outside the card (the app keeps 24, half a fingertip, less 1 px for rounding), no click reaches the
  // card, nothing changes but the selection, and wherever the top-left or the bottom-left place clears
  // both the finger and the structure's box (projected here from geometry.json through the hook's
  // matrices), the card covers none of that box. Shown to catch the fault: with app.js as it was, these
  // 171 taps opened 78 cards, 9 of them under the finger, and each of those 9 clicks pressed a key
  // (Isolate, X-ray, Zoom to it); with the change, 80 cards and none.
  {
    const pr = await A.rect('#plate'), pts = [], rowsAt = [];
    for (let fy = 0.03; fy < 0.46; fy += 0.035) rowsAt.push(fy);
    rowsAt.push(0.52, 0.60, 0.68, 0.76, 0.84, 0.92);
    for (const fy of rowsAt) for (let fx = 0.34; fx < 0.67; fx += 0.04) pts.push([pr.left + pr.width * fx, pr.top + pr.height * fy]);
    const rows = await cardTaps(A, pts), cam = await w(() => window.__anatomy.camera());
    const bad = []; let boxed = 0, clearOfBox = 0;
    for (const t of rows) {
      let boxBad = false;
      if (t.card && t.sel && t.sel.kind === 'part') {
        const b = boxOnPlate(cam, t.sel.id), P = t.plate, ch = t.card.height, tx = t.x - P.left, ty = t.y - P.top;
        const at = (y0) => ({ left: t.card.left - P.left, right: t.card.right - P.left, top: y0, bottom: y0 + ch });
        const finger = { left: tx - 24, right: tx + 24, top: ty - 24, bottom: ty + 24 }, inner = b && { left: b.left + 1, right: b.right - 1, top: b.top + 1, bottom: b.bottom - 1 };
        const foot = P.height - 8 - (t.status ? t.status.height + 8 : 0);
        if (inner && [8, Math.max(8, foot - ch)].some((y0) => !meets(at(y0), finger) && !meets(at(y0), inner))) {
          boxed++; boxBad = meets(at(t.card.top - P.top), inner); if (!boxBad) clearOfBox++;
        }
      }
      if (t.clear < 23 || t.clicks.length || t.changed || boxBad) bad.push(`(${Math.round(t.x)}, ${Math.round(t.y)}) ${t.sel ? t.sel.id : 'nothing'}: ${t.clear === Infinity ? 'no card' : `${Math.round(t.clear)} px clear`}${t.clicks.length ? `, the click pressed ${t.clicks.join(' ')}` : ''}${t.changed ? ', something else changed' : ''}${boxBad ? ', over its box' : ''}`);
    }
    const least = Math.min(...rows.filter((t) => t.card).map((t) => t.clear));
    check(rows.length >= 60 && bad.length === 0, `the card and the finger: ${pts.length} taps across the plate, ${rows.length} selected a structure; every card ${Math.round(least)} px or more clear of the tapped point (at least 23), no click reached a card, nothing changed but the selection; ${clearOfBox} of the ${boxed} cards with a place clear of both the finger and the structure's box took one${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}`);
  }

  // the plate holds still while the caption's words change
  {
    const r0 = await A.rect('#plate');
    const f = await find(A, 'Pancreas'); const r1 = await A.rect('#plate'), c1 = await caption(A);
    await A.tapEl('#c-close'); await A.tapEl('#views [data-view="top"]'); await A.idle(); const r2 = await A.rect('#plate'), c2 = await caption(A);
    await A.tapEl('#fit'); await A.idle();
    check(f && c1 !== c2 && c2 === HID.steep && [r1, r2].every((r) => r.top === r0.top && r.height === r0.height), `the plate holds still while the caption changes ("${c1}", then "${c2}"; ${r0.height} px tall each time)`);
  }

  // hit targets, with the card open, and with the Layers sheet open
  {
    await find(A, 'Right kidney');
    const h0 = await hitTargets(w);
    await A.tapEl('#c-close');
    await A.tapEl('#btn-layers'); await page.waitForTimeout(200);
    const h1 = await hitTargets(w);
    const plateH = (await A.rect('#plate')).height;
    await A.tapEl('#layers-close');
    check(h0.bad.length === 0 && h1.bad.length === 0 && plateH >= 260, `hit targets: ${h0.n} controls with the card open and ${h1.n} with the Layers sheet open, all at least 44 × 44; the plate keeps ${Math.round(plateH)} px under the sheet (at least 260)${h0.bad.concat(h1.bad).length ? ': ' + h0.bad.concat(h1.bad).join('; ') : ''}`);
    await A.tapEl('#btn-find'); await page.fill('#search', ''); await page.waitForTimeout(100);
    await page.evaluate(() => document.querySelector('#tree .t-toggle').click()); await page.waitForTimeout(100);
    await page.evaluate(() => document.querySelector('#tree .t-group .t-toggle').click()); await page.waitForTimeout(100);
    const h2 = await hitTargets(w);
    const names = await w(() => [...document.querySelectorAll('#tree .vis')].slice(0, 3).map((b) => b.getAttribute('aria-label')));
    await A.shot('find-light');
    await page.keyboard.press('Escape');
    check(h2.bad.length === 0 && names.every((n) => /^Show /.test(n) && n !== 'Show Visible'), `Find: ${h2.n} controls at least 44 × 44; the visibility boxes named for what they show (${names.join('; ')})${h2.bad.length ? ': ' + h2.bad.join('; ') : ''}`);
  }

  // focus mode: by touch and by Enter, what leaves, what stays, inside it, out of it, remembered
  {
    await A.tapEl('#views [data-view="front"]'); await A.idle();   // the whole body from the front, nothing selected
    const before = (await A.rect('#plate')).height;
    await A.tapEl('#focus-key'); await page.waitForTimeout(450); await A.idle();
    await page.waitForFunction(() => document.getElementById('live').textContent.length > 0, null, { timeout: 8000 }).catch(() => {});
    const f = await w(() => {
      const gone = ['head', 'keys'].map((id) => { const e = document.getElementById(id); return e.hidden && e.inert; });
      const stays = ['capline', 'credits', 'dissect', 'stamp', 'levels'].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return r.height > 0 && !e.closest('[hidden]'); });
      return { gone, stays, stampIn: document.getElementById('stamp').parentElement.id, ghost: !document.getElementById('focus-exit').hidden, plate: document.getElementById('plate').getBoundingClientRect().height, live: document.getElementById('live').textContent, store: localStorage.getItem('skeleton-viewer:focus'), active: document.activeElement.id };
    });
    const tree = await page.getByRole('button', { name: 'Zoom in', exact: true }).count();
    const steps = await page.getByRole('button', { name: /^Remove the/ }).count();
    const explodeRow = await w(() => { const e = document.getElementById('drow-explode'); return e.hidden && e.inert; });
    const track = await page.getByRole('slider').count() + await page.getByRole('radio').count() + await page.getByRole('button', { name: 'Explode', exact: true }).count();
    const shown = await w(() => [...document.querySelectorAll('button, input, [role="slider"]')].filter((e) => e.getBoundingClientRect().height > 0 && !e.closest('[hidden]') && !e.closest('[inert]')).map((e) => e.getAttribute('aria-label') || e.textContent.trim()));
    check(f.gone.every(Boolean) && tree === 0 && f.stays.every(Boolean) && f.stampIn === 'caption' && f.ghost && steps === 1 && explodeRow && track === 0,
      `focus mode by touch: the header, the keys and the explode row are hidden and inert (none in the tree: ${tree + track === 0}); the Levels, the caption line, the credits, the stamp (now in the caption band) and the one control, the step keys, stay. Controls left: ${shown.join(', ')}`);
    check(before >= 540 && f.plate >= 700, `the plate is ${Math.round(before)} px tall (ART.md: at least 540) and grew to ${Math.round(f.plate)} px in focus mode (at least 700)`);
    await A.shot('focus-light');
    check(f.live === 'Controls hidden. Press Escape or the corner key to show them.' && f.store === '1' && f.active !== 'focus-exit', `its sentence ("${f.live}"), skeleton-viewer:focus = ${f.store}, and no ring after a touch (focus on "${f.active}")`);
    const hf = await hitTargets(w);
    check(hf.bad.length === 0, `hit targets in focus mode: ${hf.n} controls at least 44 × 44${hf.bad.length ? ': ' + hf.bad.join('; ') : ''}`);
    const g = await A.rect('#focus-exit'), pr = await A.rect('#plate');
    check(g.top - pr.top >= 8 && pr.right - g.right >= 8 && g.width === 44 && g.height === 44, `the ghost key sits in the plate's top-right corner, 8 px in (${Math.round(g.left)}, ${Math.round(g.top)}, 44 × 44)`);
    // inside it: a tap still opens the card, the explode track still works
    const sel0 = await w(() => window.__anatomy.selection());
    await A.tapAt(pr.left + pr.width / 2, pr.top + pr.height * 0.42); await page.waitForTimeout(400); await A.idle();
    const sel1 = await w(() => [window.__anatomy.selection(), !document.getElementById('card').hidden, document.getElementById('card').getBoundingClientRect().top]);
    await A.tapEl('#c-close');
    check(!sel0 && sel1[0] && sel1[1] && sel1[2] >= g.top - 1, `inside focus mode a tap opens the card (${sel1[0] && sel1[0].id}), level with the ghost key, under the top safe area`);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 240000 });
    const kept = await w(() => [document.body.classList.contains('focus'), document.getElementById('head').hidden]);
    check(kept[0] && kept[1], 'focus mode survives a reload, restored before the first draw');
    // the camera's way out: the button named exactly Show the controls
    await page.getByRole('button', { name: 'Show the controls', exact: true }).click();
    await page.waitForFunction(() => document.getElementById('live').textContent === 'Controls shown.', null, { timeout: 8000 }).catch(() => {});
    const outs = await w(() => [document.getElementById('head').hidden, document.getElementById('live').textContent, localStorage.getItem('skeleton-viewer:focus')]);
    const layers = await page.getByRole('button', { name: 'Layers', exact: true }).isVisible();
    check(!outs[0] && outs[1] === 'Controls shown.' && outs[2] === '0' && layers, `the camera's way out of a library left in focus mode: "Show the controls" brings the header back ("${outs[1]}"), Layers visible ${layers}`);
    await page.focus('#focus-key'); await page.keyboard.press('Enter'); await page.waitForTimeout(450);
    const k1 = await w(() => [document.body.classList.contains('focus'), document.activeElement.id]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const k2 = await w(() => [document.body.classList.contains('focus'), document.activeElement.id]);
    check(k1[0] && k1[1] === 'focus-exit' && !k2[0] && k2[1] === 'focus-key', `by the keyboard: Enter goes in with focus on the ghost key (${k1[1]}); Escape comes out with focus back on the entry key (${k2[1]})`);
  }

  // the safe areas in the camera's fit (review, 2026-10-02): headless Chromium has none, so the probe
  // app.js reads them from is given a 47 px top inset by a test style, as a phone in full screen has;
  // in focus mode the whole body's top must then stand clear of it
  {
    const topRow = async (name) => {
      const { img } = await A.plateShot(name), sc = img.w / (await A.rect('#plate')).width, g = hexRgb(PAGE.light);
      for (let y = 0; y < img.h; y++) {
        let n = 0; for (let x = Math.round(60 * sc); x < img.w - Math.round(60 * sc); x++) { const q = img.at(x, y); if (Math.abs(q[0] - g[0]) + Math.abs(q[1] - g[1]) + Math.abs(q[2] - g[2]) > 12) n++; }
        if (n >= 3) return y / sc;
      }
      return Infinity;
    };
    const into = async () => { await A.tapEl('#views [data-view="front"]'); await A.idle(); await A.tapEl('#focus-key'); await page.waitForTimeout(450); await A.idle(); await A.frame(); };
    await into(); const t0 = await topRow('safe-0');
    await A.tapEl('#focus-exit'); await page.waitForTimeout(300); await A.idle();
    await page.addStyleTag({ content: '#safe-probe { padding: 47px 12px 0 30px !important; }' });
    await into(); const t47 = await topRow('safe-47');
    const keyTop = (await A.rect('#focus-exit')).top;
    // the test style goes before focus mode ends, so the resize on the way out reads no inset again
    await w(() => { for (const s of document.querySelectorAll('style')) if (s.textContent.includes('#safe-probe')) s.remove(); });
    await A.tapEl('#focus-exit'); await page.waitForTimeout(300); await A.idle();
    await A.tapEl('#fit'); await A.idle();
    check(t47 >= 47 && t47 - t0 >= 25, `focus mode with a 47 px top inset: the body's top at ${t47.toFixed(1)} px from the plate's top (at least 47), against ${t0.toFixed(1)} px with none; the ghost key at ${Math.round(keyTop)} px (it pads itself by env(), which headless Chromium leaves at 0)`);
  }

  // the loop at rest: no frame callbacks over an idle second; a drag damps and then rests. The drag runs
  // on one isolated structure, so SwiftShader's frames are short enough for the damping to end inside the
  // test (with the whole body a headless frame takes over a second, and the damping some 60 frames).
  {
    await A.idle(); const s0 = await w(() => window.__anatomy.stats()); await page.waitForTimeout(1000); const s1 = await w(() => window.__anatomy.stats());
    await find(A, 'Right kidney'); await A.tapEl('#c-isolate'); await A.idle(); await A.tapEl('#c-close'); await A.idle();
    const pr = await A.rect('#plate'), sd = await w(() => window.__anatomy.stats());
    await A.touch('touchStart', pr.left + 200, pr.top + 300);
    for (let i = 1; i <= 8; i++) { await A.touch('touchMove', pr.left + 200 + i * 10, pr.top + 300); await page.waitForTimeout(16); }
    await A.touch('touchEnd');
    const rested = await A.idle(60000); const s2 = await w(() => window.__anatomy.stats()); await page.waitForTimeout(1000); const s3 = await w(() => window.__anatomy.stats());
    check(s1.frames === s0.frames && !s1.raf && rested && s2.renders - sd.renders > 5 && s3.frames === s2.frames, `the loop rests: ${s1.frames - s0.frames} frames over an idle second; a drag turned the isolated kidney and damped over ${s2.renders - sd.renders} renders, then ${s3.frames - s2.frames} frames over the next second`);
    await A.tapEl('#status-reset'); await A.tapEl('#fit'); await A.idle();
  }

  // hidden: the loop stops, a tween lands on its end, and the return draws fresh
  {
    await A.tapEl('#btn-explode'); await page.waitForTimeout(100);
    await w(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const h0 = await w(() => [window.__anatomy.stats(), +document.getElementById('explode').value]); await page.waitForTimeout(600); const h1 = await w(() => window.__anatomy.stats());
    await w(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await A.frame(); await A.frame();
    const h2 = await w(() => window.__anatomy.stats());
    check(!h0[0].raf && !h0[0].tweens && h0[1] === 100 && h1.frames === h0[0].frames && h2.renders > h1.renders, `hidden: the explode lands on its end (${h0[1]}), no frame runs (${h1.frames - h0[0].frames} in 600 ms); the return draws fresh (${h2.renders - h1.renders} renders)`);
    await A.tapEl('#btn-explode'); await A.idle();
  }

  // About: from the stamp, every credit and the type's, never the data's third paragraph, Escape, focus back
  {
    await A.tapEl('#views [data-view="front"]'); await A.idle(); await A.frame();
    await page.focus('#stamp'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.getElementById('about').hidden && document.querySelector('#about .dialog-sheet').getAnimations().length === 0, null, { timeout: 5000 });
    const ab = await w(() => { const b = document.querySelector('.about-body'); const t = b.scrollTop; b.scrollTop = 400; const sc = b.scrollTop > t; b.scrollTop = 0; return { open: !document.getElementById('about').hidden, text: document.getElementById('about').innerText, active: document.activeElement.id, sc }; });
    await w(() => document.activeElement && document.activeElement.blur());   // no focus ring in the picture
    await A.shot('about-light');
    await page.focus('#about-close');
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const back = await w(() => [document.getElementById('about').hidden, document.activeElement.id]);
    const src = anat.about.sources;
    const times = (t) => ab.text.split(t).length - 1;
    check(ab.open && ab.text.includes(src[0]) && ab.text.includes(src[1]) && anat.about.gaps.every((g) => ab.text.includes(g))
      && times('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.') === 1
      && times('Rendering: three.js r186, MIT License') === 1 && !/Atkinson|Newsreader/.test(ab.text) && /not a spinal cord segment/.test(ab.text) && ab.text.includes(`3${NN}448${NN}950`) && back[0] && back[1] === 'stamp' && ab.sc,
    `About opens from the stamp (focus on ${ab.active}) and scrolls inside itself (${ab.sc}): the data's two source paragraphs and its gaps verbatim; the rendering and type lines once each (the data's third paragraph is the same credit, not printed twice); what the Levels are not; 3${NN}448${NN}950 triangles; Escape closes it, focus back on ${back[1]}`);
  }
  check(A.errors.length === 0, `no console error or warning, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

// Reduce Motion, from the start and switched while open: the explode key's move a cut, CSS at 0 s
{
  console.log('\n== Reduce Motion');
  const A = await open('light', { reduced: true });
  const { w, page } = A;
  await A.tapEl('#btn-explode'); await A.frame();
  const v = await w(() => [+document.getElementById('explode').value, window.__anatomy.stats().tweens]);
  await A.tapEl('#focus-key'); await A.frame();
  const dur = await w(() => [getComputedStyle(document.getElementById('focus-exit')).animationDuration, getComputedStyle(document.querySelector('#ex-by [aria-checked="true"]'), '::after').animationDuration]);
  await A.tapEl('#focus-exit'); await A.frame();
  await A.tapEl('#btn-explode'); await A.frame();
  check(v[0] === 100 && v[1] === 0 && dur.every((d) => d === '0s'), `Reduce Motion: Explode is a cut (at ${v[0]} on the next frame, ${v[1]} tweens running), the ghost key and the tracer at ${dur.join(' and ')}`);
  await A.ctx.close();
  const B = await open('light');
  await B.tapEl('#btn-explode'); await B.page.waitForTimeout(80);
  const mid = await B.w(() => +document.getElementById('explode').value);
  await B.page.emulateMedia({ reducedMotion: 'reduce' }); await B.frame();
  const after = await B.w(() => [+document.getElementById('explode').value, window.__anatomy.stats().tweens]);
  await B.tapEl('#btn-explode'); await B.frame();
  const cut = await B.w(() => +document.getElementById('explode').value);
  check(mid < 100 && after[0] === 100 && after[1] === 0 && cut === 0, `Reduce Motion switched on while open: the running explode lands at once (${mid} then ${after[0]}), and the next press is a cut (${cut})`);
  check(A.errors.length + B.errors.length === 0, `no console error${A.errors.concat(B.errors).length ? ': ' + A.errors.concat(B.errors).join(' | ') : ''}`);
  await B.ctx.close();
}

// broken data: each a sentence in the file's terms on the plate, never a blank screen, and the camera's wait never passes
{
  console.log('\n== broken data');
  const muscle = fs.readFileSync(path.join(APP, 'data/geometry-muscle.bin'));
  const cases = [
    ['/data/geometry.json', { status: 404 }, 'data/geometry.json could not be read (HTTP 404).'],
    ['/data/anatomy.json', { body: '<!doctype html><title>Not found</title>' }, 'data/anatomy.json is not valid JSON; it looks like a web page was written over it.'],
    ['/data/anatomy.json', { body: '{ "parts": [' }, 'data/anatomy.json is not valid JSON.'],
    ['/data/geometry-muscle.bin', { body: muscle.subarray(0, muscle.length - 20) }, `data/geometry-muscle.bin holds 9${NN}509${NN}900 bytes; data/geometry.json says 9${NN}509${NN}920.`],
  ];
  for (const [p, ov, want] of cases) {
    override = { [p]: ov };
    const A = await open('light', { noWait: true, expect: new RegExp(`404|Failed to load resource|requestfailed .*${p.replace(/[./]/g, '\\$&')}$`) });
    await A.page.waitForFunction(() => !document.getElementById('notice').hidden, null, { timeout: 120000 });
    await A.page.waitForTimeout(200);
    const r = await A.w(() => [document.getElementById('notice').textContent, document.getElementById('btn-add').getAttribute('aria-label'), document.getElementById('stamp').textContent, window.__seen || null]);
    check(r[0] === want && !r[3] && A.errors.length === 0, `${p} ${ov.status ? `answers ${ov.status}` : 'replaced'}: "${r[0]}"; "Every layer is showing" never appears, so the camera's wait does not pass; the stamp "${r[2]}"${A.errors.length ? ' | ' + A.errors.join(' | ') : ''}`);
    await A.ctx.close();
  }
  override = {};
  // opened as a file
  {
    const A = await open('light', { noWait: true, file: true, url: pathToFileURL(path.join(APP, 'index.html')).href, expect: /.*/ });
    await A.page.waitForFunction(() => !document.getElementById('notice').hidden, null, { timeout: 30000 });
    const t = await A.w(() => document.getElementById('notice').textContent);
    check(t === 'This app reads its data over Snuggery’s own server; opened as a file, the browser blocks it.', `opened as a file: "${t}"`);
    await A.ctx.close();
  }
  // a broken anatomy.json on a later read keeps the text already loaded
  {
    const A = await open('light', { expect: /Failed to load resource/ });
    override = { '/data/anatomy.json': { body: '{ "parts": [' } };
    await A.w(() => window.dispatchEvent(new Event('focus')));
    await A.page.waitForFunction(() => !document.getElementById('notice').hidden, null, { timeout: 10000 });
    const r = await A.w(() => [document.getElementById('notice').textContent, document.getElementById('stamp').textContent, document.querySelectorAll('#depth button').length]);
    override = {};
    check(r[0] === 'data/anatomy.json is not valid JSON. The text already loaded stays.' && /1.752 structures/.test(r[1]) && r[2] === 8, `a broken data/anatomy.json on a later read: "${r[0]}", the model kept ("${r[1]}", ${r[2]} depth words)`);
    check(A.errors.length === 0, `no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
    await A.ctx.close();
  }
}

// widths: no sideways scroll, every caption sentence inside its fixed height, the camera's taps on the
// track, the plate on a phone on its side
{
  console.log('\n== widths');
  const LONG = [RULE, HID.steep, HID.small, exploded(100, 'region'), exploded(100, 'group'), spanLine('above C1 to below the sacrum', false, 'steep'), spanLine('above C1 to below the sacrum', false, 'small'), spanLine('above C1 to below the sacrum', true), spanLine('S1–S5 to below the sacrum', false, 'steep'), spanLine('above C1', true)];
  for (const [W, H, dpr, label] of [[320, 700, 2, '320'], [360, 780, 3, '360'], [375, 667, 2, '375'], [312, 675, 2.5, '125 % zoom (312 × 675)'], [844, 390, 3, '844 × 390, on its side']]) {
    const A = await open('dark', { w: W, h: H, dpr });
    const side = W > H;
    const r = await A.w(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, plate: document.getElementById('plate').getBoundingClientRect().height, track: document.getElementById('explode').getBoundingClientRect().width }));
    const over = await A.w((list) => { const e = document.getElementById('capline'), was = e.textContent, out = []; for (const t of list) { e.textContent = t; if (e.scrollHeight > e.clientHeight + 1 || (getComputedStyle(e).whiteSpace === 'nowrap' && e.scrollWidth > e.clientWidth + 1)) out.push(t); } e.textContent = was; return out; }, LONG);
    const tr = await A.rect('#explode');
    await A.tapAt(tr.left + tr.width * 0.45, tr.top + tr.height / 2); await A.idle();
    const v45 = await A.w(() => +document.getElementById('explode').value);
    await A.tapAt(tr.left + tr.width * 0.01, tr.top + tr.height / 2); await A.idle();
    const v0 = await A.w(() => +document.getElementById('explode').value);
    const hs = await hitTargets(A.w);
    if (side) {
      // on its side the whole body's spine projects at 88 px on a 263 px plate: the column is kept down
      // to 80 px on a plate under 300 px, so the signature is in the opening (review, 2026-10-02)
      const L = await levelsOf(A), cap = await caption(A), own = await ownColumn(A);
      check(L.drawn && L.blocks.length >= 20 && cap === RULE, `${label}: the Levels at the opening, ${L.blocks.length} blocks, the rule ${Math.round(own.tall)} px tall on a ${Math.round(r.plate)} px plate; the caption "${cap}"`);
    }
    if (W === 375) {
      // a plate under 420 px: the compact card, its four actions on one row, its Levels row in view
      await find(A, 'Right kidney');
      const c = await A.w(() => {
        const acts = [...document.querySelectorAll('.card-actions button')].map((b) => b.getBoundingClientRect().top);
        const lv = document.getElementById('r-levels').getBoundingClientRect(), body = document.getElementById('card-body').getBoundingClientRect();
        return { compact: document.getElementById('card').classList.contains('compact'), rows: new Set(acts.map(Math.round)).size, levelsIn: lv.top >= body.top - 1 && lv.bottom <= body.bottom + 1, zoom: document.getElementById('c-zoom').textContent.trim(), plate: document.getElementById('plate').getBoundingClientRect().height };
      });
      await A.shot('w375-card-dark', false);
      await A.tapEl('#c-close'); await A.idle();
      check(c.compact && c.rows === 1 && c.levelsIn, `${label}: on a ${Math.round(c.plate)} px plate the card is compact, its four actions on ${c.rows} row, its Levels row in view`);
    }
    if (side) await A.shot('landscape-dark', false); else if (W === 320) await A.shot('w320-dark', false);
    check(r.sw <= r.iw && over.length === 0 && hs.bad.length === 0 && v45 >= 42 && v45 <= 46 && v0 === 0 && (!side || r.plate >= 220),
      `${label}: page ${r.sw} of ${r.iw} px wide; every caption sentence fits its fixed height${over.length ? ` (over: "${over.join('" | "')}")` : ''}${side ? ' (one line on its side, the rest ellipsized)' : ''}; the track ${Math.round(r.track)} px, a tap at 0.45 lands on ${v45} and at 0.01 on ${v0}; ${hs.n} controls at 44 px or more${side ? `; the plate ${Math.round(r.plate)} px tall (at least 220)` : ''}${hs.bad.length ? ': ' + hs.bad.join('; ') : ''}`);
    check(A.errors.length === 0, `${label}: no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
    await A.ctx.close();
  }
}

// focus mode's card against the ghost key (final review, 2026-10-02): level with the ghost key, the card
// ran under it on a phone 375 px wide. Taps over the body in focus mode at three sizes; every card the
// taps open keeps 8 px or more from the ghost key, and stays clear of the finger.
{
  console.log('\n== focus mode at three sizes');
  for (const [W, H] of [[390, 844], [375, 812], [320, 568]]) {
    const A = await open('light', { w: W, h: H, focus: true });
    const pr = await A.rect('#plate'), pts = [];
    for (let fy = 0.15; fy < 0.9; fy += 0.15) for (const fx of [0.4, 0.5, 0.6]) pts.push([pr.left + pr.width * fx, pr.top + pr.height * fy]);
    const rows = await cardTaps(A, pts);
    const gap = (c, g) => Math.max(g.left - c.right, c.left - g.right, g.top - c.bottom, c.top - g.bottom);
    const cards = rows.filter((t) => t.card && t.ghost), bad = rows.filter((t) => !t.card || !t.ghost || gap(t.card, t.ghost) < 8 || t.clear < 23 || t.clicks.length || t.changed);
    const gaps = cards.map((t) => Math.round(gap(t.card, t.ghost)));
    check(cards.length >= 6 && bad.length === 0, `focus mode at ${W} × ${H}: ${cards.length} cards opened by taps, each ${Math.min(...gaps)} px or more from the ghost key (at least 8; the card ${Math.round(cards[0] ? cards[0].card.width : 0)} px wide, level with it), clear of the finger, no click reaching it${bad.length ? ': ' + bad.slice(0, 4).map((t) => `(${Math.round(t.x)}, ${Math.round(t.y)}) ${t.card && t.ghost ? `${Math.round(gap(t.card, t.ghost))} px from the ghost key, ${Math.round(t.clear)} px clear` : 'no card'}`).join('; ') : ''}`);
    check(A.errors.length === 0, `${W} × ${H} in focus mode: no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
    await A.ctx.close();
  }
}

await browser.close();
server.close();
check(hashOf(appPng) === appPngHash, `screenshots/app.png, the README's composite, is untouched (${(appPngHash || 'missing').slice(0, 12)}…)`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('\nall checks pass');
