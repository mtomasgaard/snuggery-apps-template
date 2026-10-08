// Drive Norne Reservoir in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through
// CDP), light and dark (HOUSE.md section 7.2; step 21 of the pass's change list, in tools/DECISIONS.md). Fails on any console error or
// warning, page error, failed request, HTTP ≥ 400, or any request outside the local server; the one
// message tolerated is SwiftShader's own "GPU stall due to ReadPixels" (the cell picking reads a pixel).
// Every figure it asserts is worked out here from the shipped files with Node's own tools (the frames,
// the field rates, the cut's geometry, the formats), never by importing js/.
//
// FRAME, COLOR-PASS AND LOAD TIMES ARE HEADLESS CHROMIUM WITH SWIFTSHADER ON THIS MAC: a trend only,
// never phone evidence. The phone's frame rate, memory and battery are the owner's checks.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCRUB=0 node tools/shoot.mjs            skip the three-speed scrub
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the scenes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's strings by role and name, "Oil saturation" only once every file is in,
// the stamp's line hidden then and the About key shown, the credit in About and not on the front, the
// face), text contrast and the tracer, the plate printed per theme, the cut's ink and tint against the
// page and its column heights against this file's decode, the track's value in words, the legend's
// open ends on Pressure, the card against this file's decode at a tapped cell, the card clear
// of the tapped point, labels clear of the card and the keys, SI in every visible text node, the
// scenes as pictures. Once: the real-touch scrub at 2, 8 and 20 steps a second, play, the step keys,
// the plate holding still while the dates change, the legend clear of the header and the player at
// all three stops with the phone's insets emulated (the recorded bug, B1), the grip's names, the units
// key, focus mode end to end with the camera's way out, hidden, hit targets in both modes, About,
// Reduce Motion, broken data, and the widths; after the review, the field's framing at every plate
// size, taps on the rock against the names' hits, and the Cut's printed scale clear of its columns;
// after the final review, the card at every sheet stop, in focus mode and on a phone on its side (a
// grid of taps on the field, the card clear of each tap, its ring and every key, in the form the plate
// calls for), every well chosen from the list, a card carried across the stops, and the compact card's
// hits. Since 2.2 (plan 0012, package 3.4): the view's share of the screen at every stop with and
// without the section, the grip held in reach, the stamp's line one line in every state; and the
// section A–A′: opened by touch, its colors against this file's decode on three properties and in the
// dark theme, sharp while scrubbed, a tap on a block opening its cell, a line drawn and an end moved by
// touch under the finger, two fingers handing back to the view, the orbit still one finger, Along and
// Across, the units and the stretch, hidden, remembered, focus mode, gaps hatched. Since 2.4 (plan 0012
// D16, D17): the section's and the legend's colors follow config.json's plasma and viridis as before; the
// compass at rest in both themes, in every state the card is checked in, under the card, and turning with
// the model. Pictures: tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png; never
// screenshots/app.png, the README's composite.

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
const hashOf = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);
const appPngHash = hashOf(appPng);

/* ── the data, decoded here (data/ATTRIBUTION.txt) ── */
const model = JSON.parse(fs.readFileSync(path.join(APP, 'data/model.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(APP, 'config.json'), 'utf8'));
const bin = (f) => fs.readFileSync(path.join(APP, 'data', f));
const DYN = bin('dynamic.bin'), IJK = bin('ijk.bin'), ST = bin('static.bin');
const NA = model.NA, NF = model.frames.length, FB = model.dynamic.frameBytes, [P0, P1] = model.dynamic.pressureRange;
const own = {
  SWAT: (f, a) => DYN[f * FB + a] / 255,
  SGAS: (f, a) => DYN[f * FB + NA + a] / 255,
  SOIL: (f, a) => Math.max(0, 1 - (DYN[f * FB + a] + DYN[f * FB + NA + a]) / 255),
  PRESSURE: (f, a) => P0 + DYN.readUInt16LE(f * FB + 2 * NA + 2 * a) * (P1 - P0) / 65535,
};
const stat = (key, a) => ST.readFloatLE((model.static.order.indexOf(key) * NA + a) * 4);
const cellOf = (i, j, k) => { for (let a = 0; a < NA; a++) if (IJK[a * 3] === i - 1 && IJK[a * 3 + 1] === j - 1 && IJK[a * 3 + 2] === k - 1) return a; return -1; };
const DAY = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const DAYS = model.frames.map(DAY);
const F = model.summary.field;

/* ── formats, written here again (HOUSE.md section 6) ── */
const NN = ' ', MINUS = '−';
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const group = (n) => { const s = String(Math.round(Math.abs(n))); return (n < 0 && Math.round(n) !== 0 ? MINUS : '') + (s.length > 3 ? s.replace(/\B(?=(\d{3})+$)/g, NN) : s); };
const dateOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONS[m - 1]} ${y}`; };
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const pctl = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

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

/* ── the server: the app folder, with any file replaceable ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = {};                                     // path -> { status } or { body }
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
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
console.log(`headless Chromium ${browser.version()} with SwiftShader WebGL: every load, frame and color-pass time below is a trend on this Mac, not phone evidence`);

const NOISE = /GPU stall due to ReadPixels/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const ready = () => window.__norne && document.getElementById('legend-name').textContent.length > 0 && window.__norne.shown() >= 0;

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  if (o.focus !== undefined) await ctx.addInitScript((f) => { try { localStorage.setItem('norne-viewer:v1:focus', f ? '1' : '0'); } catch { /* fine */ } }, o.focus);
  // the first moment "Oil saturation" reaches the page, and whether every file was in then
  await ctx.addInitScript(() => {
    new MutationObserver(() => {
      if (window.__seen || !document.body || !/oil saturation/i.test(document.body.innerText || '')) return;
      window.__seen = { stamp: document.getElementById('stamp').textContent, stampHidden: document.getElementById('stamp-home').hidden, about: !document.getElementById('btn-about').hidden, shown: window.__norne ? window.__norne.shown() : null };
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const page = await ctx.newPage(), errors = [];
  const excused = (t) => NOISE.test(t) || (o.expect && o.expect.test(t));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${r.url().slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  if (!o.noWait) { await page.waitForFunction(ready, null, { timeout: 180000 }); await page.waitForTimeout(300); }
  const ms = Date.now() - t0;
  const w = (fn, arg) => page.evaluate(fn, arg);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tapAt = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd'); };
  const rect = (sel) => w((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
  const tapEl = async (sel) => { const r = await rect(sel); await tapAt(r.left + r.width / 2, r.top + r.height / 2); };
  const frame = () => w(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  const shot = async (name, keep = true) => {
    await page.waitForTimeout(250);
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    if (keep && KEEP) { if (`${name}.png` === 'app.png') throw new Error('never screenshots/app.png'); fs.copyFileSync(p, path.join(SHOTS, `${name}.png`)); }
    console.log(`      ${name}.png${keep && KEEP ? ' → screenshots/' : ''}`);
  };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, tapEl, rect, frame, shot };
}
const ST8 = (A) => A.w(() => window.__norne.stats());
const setFrame = async (A, f) => { await A.w((k) => window.__norne.setFrame(k), f); await A.frame(); };
const setProp = async (A, k) => { await A.w((key) => window.__norne.setProp(key), k); await A.frame(); await A.frame(); };
/** The Play key's marks as drawn: the hidden attribute and the computed display, never an expando. */
const playMarks = (w) => w(() => ['ico-play', 'ico-pause'].map((id) => { const e = document.getElementById(id); return `${id} ${e.hasAttribute('hidden') ? 'hidden' : 'shown'} ${getComputedStyle(e).display}`; }).concat(document.getElementById('btn-play').getAttribute('aria-label')).join(', '));
/** The x of report date k (fractional k interpolates) on the track, in page CSS px. */
const trackX = (r, k) => {
  const i = Math.max(0, Math.min(NF - 1, Math.floor(k))), j = Math.min(NF - 1, i + 1), t = k - i;
  const d = DAYS[i] + (DAYS[j] - DAYS[i]) * t;
  return r.left + 10 + ((d - DAYS[0]) / (DAYS[NF - 1] - DAYS[0])) * (r.width - 20);
};

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
    if (!t.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr') || e.closest('#labels') || e.closest('svg') || e.closest('option')) continue;
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
  for (const e of document.querySelectorAll('button, [role="slider"], [role="radio"], input, select')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.closest('#labels') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    // a control partly scrolled out of view (the property words, the sheet) is measured where it is wholly in view
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !at(cx, cy)) continue;
    const sc = e.closest('.words, .sheet');
    if (sc) { const s = sc.getBoundingClientRect(); if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) continue; }
    seen.push(e.id || (e.textContent || '').trim().slice(0, 12));
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 280 && at(cx + (s * k * dx) / 4, cy + (s * k * dy) / 4); k++) n++; return n / 4; };
    const okV = run(0, 1) >= 43.5, okH = run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  // the well names take no touch themselves; app.js reads a tap in a 44 x 44 box around each
  const labels = window.__norne.labelHits();
  const small = labels.filter((h) => h.w < 44 || h.h < 44).length;
  return { n: seen.length, bad, labels: labels.length, small };
});
/** Every visible text node: a hyphen-minus before a digit, a plain space between a number and a unit,
 *  or four digits ungrouped (years, dates and model names excepted). */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[  ](bar|psi|m|ft|km|mi|mD|Sm³\/d|bbl\/d|Mscf\/d|%|px)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    // About shows model.json's source sentence verbatim (data)
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, #about-source, option')) continue;
    const text = t.textContent;
    n++;
    const groups = text.replace(/\b(19|20)\d\d\b|OPM Flow \d{4}\.\d\d/g, '').match(/\d{5,}|\b\d{4}\b(?![.\d])/g);
    if (/(^|[^\w])-\d/.test(text) || UNIT.test(text) || groups) bad.push(text.trim().slice(0, 40));
  }
  return { n, bad };
});

/* The compass (plan 0012 D17), in the plate's coordinates: shown, 32 px or more, in the plate's top-left
 * corner, its N where north projects at the camera's target (worked out here from the camera's own numbers,
 * its eye, the 40° lens and the lens shift, never from app.js's matrices), the needle never under half its
 * length (8.5 px a side) and never narrower than its 6.4 px, its name saying where north is, and over none
 * of: a key, the ghost key, the card, a well's drawn name or its 44 px hit, a formation's name, the tapped
 * cell's ring, the section's A and A′. */
const DIRS = ['the top', 'the top right', 'the right', 'the bottom right', 'the bottom', 'the bottom left', 'the left', 'the top left'];
const compassOf = (w) => w((D) => {
  const N = window.__norne, e = document.getElementById('north'), pr = document.getElementById('plate').getBoundingClientRect();
  const rel = (q) => ({ l: q.left - pr.left, t: q.top - pr.top, r: q.right - pr.left, b: q.bottom - pr.top });
  const over = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t, r = e.getBoundingClientRect(), c = rel(r), cs = getComputedStyle(e);
  const cam = N.cam(), gl = document.getElementById('gl'), W = gl.clientWidth, H = gl.clientHeight, T = cam.target;
  const th = cam.theta * Math.PI / 180, ph = cam.phi * Math.PI / 180;
  const eye = [T[0] + cam.dist * Math.cos(ph) * Math.sin(th), T[1] + cam.dist * Math.sin(ph), T[2] + cam.dist * Math.cos(ph) * Math.cos(th)];
  const sub = (a, b) => a.map((v, i) => v - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], unit = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  const z = unit(sub(eye, T)), x = unit([z[2], 0, -z[0]]), y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const f = 1 / Math.tan(20 * Math.PI / 180);
  const scr = (p) => { const d = sub(p, eye), cz = -dot(z, d); return [((f * H / W) * dot(x, d) / cz + (cam.sx || 0)) * 0.5 * W, -(f * dot(y, d) / cz + (cam.sy || 0)) * 0.5 * H]; };
  const p0 = scr(T), p1 = scr([T[0], T[1], T[2] - cam.dist * 0.01]);   // model +y, north, is world -z
  const want = Math.atan2(p1[0] - p0[0], -(p1[1] - p0[1])) * 180 / Math.PI;
  const n = document.getElementById('north-n').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const got = Math.atan2(n.left + n.width / 2 - cx, -(n.top + n.height / 2 - cy)) * 180 / Math.PI;
  const off = ((got - want + 540) % 360) - 180;
  const m = document.querySelector('#needle .n').getScreenCTM(), at = (u, v) => new DOMPoint(u, v).matrixTransform(m);
  const o = at(0, 0), tip = at(0, -8.5), b1 = at(3.2, 0), b2 = at(-3.2, 0);
  const label = e.getAttribute('aria-label'), sector = (a) => ((Math.round(a / 45) % 8) + 8) % 8;
  const near = Math.abs(((want / 45 % 1) + 1) % 1 - 0.5) < 0.09;   // within 4° of a boundary between two words, either word
  const said = [sector(want), ...(near ? [sector(want - 4), sector(want + 4)] : [])].some((i) => label === `North arrow: north is toward ${D[i]} of the view.`);
  const things = [];
  for (const k of [...document.querySelectorAll('#keys button'), document.getElementById('focus-exit'), document.getElementById('readout')]) if (!k.hidden && !k.closest('[hidden]') && k.getBoundingClientRect().width) things.push([k.id || 'a key', rel(k.getBoundingClientRect())]);
  for (const k of document.querySelectorAll('#labels .wl, #labels .zl, #labels .pickmark')) if (k.style.display !== 'none' && k.style.transform && k.getBoundingClientRect().width) things.push([`${k.className.split(' ')[0]} ${k.textContent}`, rel(k.getBoundingClientRect())]);
  for (const h of N.labelHits()) things.push([`the hit of ${h.name}`, { l: h.x, t: h.y, r: h.x + h.w, b: h.y + h.h }]);
  if (!document.getElementById('secline').hidden) for (const id of ['sl-a', 'sl-b']) { const q = document.getElementById(id).getBoundingClientRect(); if (q.width) things.push([id, rel(q)]); }
  return {
    shown: !e.hidden && !e.closest('[hidden]') && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.9,
    size: Math.round(Math.min(r.width, r.height)), at: `${Math.round(c.l)}, ${Math.round(c.t)}`,
    corner: c.l >= 0 && c.t >= 0 && c.l <= 60 && c.t <= 60 && c.r <= pr.width / 2 && c.b <= pr.height / 2,
    want: Math.round(want), got: Math.round(got), off: Math.round(off), theta: Math.round(cam.theta), phi: Math.round(cam.phi),
    len: Math.round(Math.hypot(tip.x - o.x, tip.y - o.y) * 10) / 10, width: Math.round(Math.hypot(b1.x - b2.x, b1.y - b2.y) * 10) / 10,
    label, said, n: things.length, over: things.filter(([, q]) => over(c, q)).map(([what]) => what),
  };
}, DIRS);
const compassCheck = async (A, label) => {
  const k = await compassOf(A.w);
  const bad = [!k.shown && 'not shown', k.size < 32 && `${k.size} px`, !k.corner && 'not in the top-left corner', Math.abs(k.off) > 6 && `the N ${k.off}° off north`,
    !k.said && `named "${k.label}"`, k.len < 4.2 && 'the needle under half its length', k.width < 6.3 && 'the needle narrowed', k.over.length && `over ${k.over.join(', ')}`].filter(Boolean);
  check(bad.length === 0, `the compass, ${label}: ${k.size} px at (${k.at}) in the plate, its N at ${k.got}° where north projects to ${k.want}° (camera theta ${k.theta}°, phi ${k.phi}°), the needle ${k.len} px a side and ${k.width} px across, "${k.label}", clear of all ${k.n} marks and keys on the plate${bad.length ? ': ' + bad.join('; ') : ''}`);
  return k;
};

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the first frame: ${A.ms} ms (headless)`);

  // boot: the camera's strings and controls, Oil saturation only once every file is in, the credit, the face
  {
    const seen = await w(() => window.__seen);
    const radios = await Promise.all(['Oil', 'Pressure'].map((n) => page.getByRole('radio', { name: n, exact: true }).count()));
    const buttons = await Promise.all(['Show the whole field', 'Play production history', 'Show more controls', 'Hide the controls', 'Zoom in', 'Zoom out', 'Wells'].map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    const slider = await page.getByRole('slider', { name: 'Report date', exact: true }).count();
    const legend = await page.getByText('Oil saturation', { exact: true }).first().isVisible();
    check(radios.every((n) => n === 1) && buttons.every((n) => n === 1) && slider === 1 && legend,
      `camera: radios Oil, Pressure ${radios.join('/')}; buttons Show the whole field, Play production history, Show more controls, Hide the controls, Zoom in, Zoom out, Wells ${buttons.join('/')}; slider Report date ${slider}; "Oil saturation" visible ${legend}`);
    const edition = await w(() => { const dt = [...document.querySelectorAll('#about-list dt')].find((d) => d.textContent === 'Edition:'); return dt ? dt.nextElementSibling.textContent : null; });
    check(seen && seen.shown !== null && seen.stampHidden && seen.about && /^Norne benchmark, OPM Flow \d{4}\.\d\d run$/.test(edition || ''),
      `"Oil saturation" first reached the page with every file in (report date ${seen && seen.shown}); the stamp's line was hidden then and the About key shown (HOUSE 4.2, F2); About's first row "Edition: ${edition}"`);
    const credit = await w(() => ({ none: !document.getElementById('credits'), first: document.querySelector('#about-body section:nth-of-type(3) p').id, text: document.getElementById('about-credit-line').textContent }));
    check(credit.none && credit.first === 'about-credit-line' && credit.text === 'Data: Norne benchmark, Equinor and the Norne partners via the Open Porous Media initiative, ODbL 1.0',
      `no #credits on the front; About's first Sources and credits paragraph is the constant, word for word: "${credit.text}" (HOUSE 4.15, F1)`);
    const face = await w(() => document.fonts.check('560 11.5px "Ysabeau Office"') && document.fonts.check('600 21px "Ysabeau Office"') && [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Ysabeau Office' && f.status === 'loaded'));
    check(face, 'the face is loaded (document.fonts.check, status loaded) before the model shows');
  }

  await compassCheck(A, `${scheme}, at rest, Oil`);

  // text contrast and the tracer
  {
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5, `text contrast: ${c.n} text nodes, worst ${c.worst[0]}:1 (${c.worst[1]})`);
    const tracer = await w(() => [...document.querySelectorAll('.words [role="radio"]')].map((b) => [b.textContent, b.getAttribute('aria-checked'), getComputedStyle(b, '::after').content !== 'none' && getComputedStyle(b, '::after').backgroundImage !== 'none']));
    const wrong = tracer.filter(([, on, has]) => (on === 'true') !== has);
    check(wrong.length === 0 && tracer.filter(([, on]) => on === 'true').map(([t]) => t).join() === 'Oil,Along,Formations', `the tracer runs under exactly the chosen words (one in each group: the properties, the section's lines, the explode) (${tracer.filter(([, on]) => on === 'true').map(([t]) => t).join(', ')})${wrong.length ? ': wrong on ' + wrong.map(([t]) => t).join(', ') : ''}`);
  }

  // the plate printed per theme (B7): the clear color is --plate; oil-bearing rock stands further from the
  // ground than barren rock, darker in the light theme, brighter in the dark
  {
    await setFrame(A, 0);
    const pr = await A.rect('#plate');
    const p = path.join(OUT, `plate-${scheme}.png`);
    await page.screenshot({ path: p, clip: { x: 0, y: pr.top, width: pr.width - 60, height: pr.height } });
    const img = decodePng(fs.readFileSync(p)), ground = hexRgb(scheme === 'light' ? '#ffffff' : '#0c1316');
    let green = [], gray = [], groundPx = 0;
    for (let i = 0; i < img.w * img.h; i += 3) {
      const c = [img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]];
      if (Math.abs(c[0] - ground[0]) + Math.abs(c[1] - ground[1]) + Math.abs(c[2] - ground[2]) <= 3) { groundPx++; continue; }
      if (c[1] - Math.max(c[0], c[2]) > 30) green.push(lum(c));
      else if (Math.max(...c) - Math.min(...c) < 12) gray.push(lum(c));
    }
    const mg = green.reduce((a, b) => a + b, 0) / green.length, my = gray.reduce((a, b) => a + b, 0) / gray.length;
    check(groundPx > 1000 && green.length > 500 && gray.length > 500 && (scheme === 'light' ? mg < my : mg > my),
      `the plate is printed for the ${scheme} theme: ${groundPx} px of the ground ${scheme === 'light' ? '#ffffff' : '#0c1316'}; oil-bearing cells mean luminance ${mg.toFixed(3)} against barren rock ${my.toFixed(3)} (${scheme === 'light' ? 'darker' : 'brighter'} is more)`);
  }

  // the cut: its ink against the page, its tint where the series says, its columns' heights at five
  // months against this file's own geometry (ART.md section 1: 0.5 px per 1 000 Sm³/d, a 2 px foot gap)
  {
    await setFrame(A, 0);
    const tr = await A.w(() => { const c = document.getElementById('track'); const x = c.getContext('2d'); return { w: c.width, h: c.height, css: c.getBoundingClientRect().width, d: [...x.getImageData(0, 0, c.width, c.height).data] }; });
    const dpr = tr.w / tr.css, W = tr.css, page8 = hexRgb(scheme === 'light' ? '#ffffff' : '#141d21'), ink = hexRgb(scheme === 'light' ? '#12150b' : '#eff5e7');
    const px = (x, y) => tr.d.slice((y * tr.w + x) * 4, (y * tr.w + x) * 4 + 4);
    const xOf = (d) => 10 + ((d - DAYS[0]) / (DAYS[NF - 1] - DAYS[0])) * (W - 20);
    const foot = Math.round(32 * dpr), k = 0.5 / 1000;
    const samples = [], tints = [];
    for (let y = foot - Math.round(22 * dpr); y < foot; y++) for (let x = Math.round(30 * dpr); x < tr.w; x++) {
      const c = px(x, y);
      if (c[3] === 255 && Math.abs(c[0] - ink[0]) + Math.abs(c[1] - ink[1]) + Math.abs(c[2] - ink[2]) < 6) samples.push(contrast(c.slice(0, 3), page8));
      else if (c[3] > 40 && c[3] < 140) tints.push([0, 1, 2].map((j) => Math.round((c[j] * c[3]) / 255 + page8[j] * (1 - c[3] / 255))));
    }
    const good = samples.filter((c) => c >= 3).length / samples.length;
    check(samples.length > 1000 && good >= 0.9, `the cut's ink: ${samples.length} device pixels, ${(good * 100).toFixed(1)} % at 3:1 or more against the page (target 3.0, a mark), lowest ${Math.min(...samples).toFixed(2)}:1`);
    const tintC = tints.map((c) => contrast(c, page8));
    check(tints.length > 300, `the water's tint: ${tints.length} device pixels, at ${pctl(tintC, 0.5).toFixed(2)}:1 against the page (ART.md: 1.94 light, 2.90 dark, faint on purpose; its 1 px --ink-3 top carries the edge)`);
    const cols = [];
    for (const f of [20, 37, 60, 80, 109]) {
      const x0 = Math.round(xOf(DAYS[f - 1]) * dpr), x1 = Math.max(x0 + 1, Math.round(xOf(DAYS[f]) * dpr)), x = Math.floor((x0 + x1 - 1) / 2);
      const ho = Math.round(F.oil[f] * k * dpr), hl = Math.max(ho, Math.round((F.oil[f] + F.water[f]) * k * dpr)), top = hl + Math.round(dpr);
      let drawn = 0, inked = 0;
      for (let y = foot - 1; y >= 0; y--) { const c = px(x, y); if (c[3] === 0) break; drawn++; if (c[3] === 255 && Math.abs(c[0] - ink[0]) + Math.abs(c[1] - ink[1]) + Math.abs(c[2] - ink[2]) < 6) inked++; }
      cols.push({ f, want: [ho, top], got: [inked, drawn], ok: Math.abs(inked - ho) <= 1 && Math.abs(drawn - top) <= 1 });
    }
    check(cols.every((c) => c.ok), `the cut's columns against this file's decode (oil, liquid with its top line, in device px): ${cols.map((c) => `${model.frames[c.f]} ${c.got.join('/')} (want ${c.want.join('/')})`).join(', ')}`);
    await setFrame(A, 109);
    const vt = await w(() => document.getElementById('slider').getAttribute('aria-valuetext'));
    check(vt === '1 December 2006, 9.1 years after first oil. Oil 7361 standard cubic meters a day, water 16251, 69 percent water.', `the track's value in words: "${vt}"`);
  }

  // the legend's open ends at 1 Nov 2005 on Pressure (B5), then back to Oil as the camera does
  {
    await setFrame(A, model.frames.indexOf('2005-11-01'));
    await A.tapEl('#props [role="radio"]:nth-child(4)');
    await A.frame(); await A.frame();
    const ticks = await w(() => [...document.querySelectorAll('#legend-ticks span:not([hidden])')].map((s) => s.textContent));
    const title = await w(() => document.getElementById('legend-name').textContent);
    check(title === 'Pressure' && ticks[0] === `≤${NN}200` && ticks[ticks.length - 1] === `≥${NN}450${NN}bar`, `Pressure on 1 Nov 2005: the legend prints its ends open: ${ticks.join(' | ')}`);
    await A.shot(`pressure-${scheme}`);
    await page.getByRole('radio', { name: 'Oil', exact: true }).click();
    await A.frame();
  }

  // the card: a tapped cell's values against this file's decode, and the card clear of the point
  {
    await setFrame(A, 60);
    const pr = await A.rect('#plate');
    let hitPt = null;
    const hits = await w(() => window.__norne.labelHits());
    const inLabel = (x, y) => hits.some((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    for (let y = 150; y < 330 && !hitPt; y += 12) for (let x = 60; x < 260 && !hitPt; x += 12) { if (inLabel(x, y)) continue; const a = await w(([X, Y]) => window.__norne.pick(X, Y), [x, y]); if (a >= 0) hitPt = [x, y]; }
    await A.tapAt(pr.left + hitPt[0], pr.top + hitPt[1]);
    await page.waitForTimeout(500);
    await A.frame();
    const card = await w(() => ({ where: document.getElementById('readout-where').textContent, num: document.getElementById('readout-number').textContent, unit: document.getElementById('readout-unit').textContent, sub: document.getElementById('readout-sub').textContent, rows: [...document.querySelectorAll('#readout-all dt')].map((d) => [d.textContent, d.nextElementSibling.textContent]), r: document.getElementById('readout').getBoundingClientRect().toJSON(), live: document.getElementById('live').textContent }));
    const m = card.where.match(/^Cell I (\d+), J (\d+), K (\d+), (\w+)$/);
    const a = m ? cellOf(+m[1], +m[2], +m[3]) : -1, f = 60;
    const perm = (v) => `${v >= 10 ? group(v) : v >= 1 ? v.toFixed(1) : v.toFixed(2)}${NN}mD`;
    const want = a < 0 ? [] : [
      ['Oil saturation', own.SOIL(f, a).toFixed(2)], ['Water saturation', own.SWAT(f, a).toFixed(2)], ['Gas saturation', own.SGAS(f, a).toFixed(2)], ['Pressure', `${group(own.PRESSURE(f, a))}${NN}bar`],
      ['Depth', `${group(stat('DEPTH', a))}${NN}m`], ['Porosity', stat('PORO', a).toFixed(3)], ['Horizontal permeability', perm(stat('PERMX', a))], ['Vertical permeability', perm(stat('PERMZ', a))],
      ['Net to gross', stat('NTG', a).toFixed(2)], ['Fault segment', String((Math.round(stat('FIPNUM', a)) - 1) % 4 + 1)], ['Fluid-in-place region', String(Math.round(stat('FIPNUM', a)))],
    ];
    if (!m) console.log(`      (the card after the tap at ${hitPt}: ${JSON.stringify(card).slice(0, 300)})`);
    const zone = m ? (cfg.zones.find((z) => +m[3] >= z.k[0] && +m[3] <= z.k[1]) || {}).name : null;
    check(a >= 0 && JSON.stringify(card.rows) === JSON.stringify(want) && card.num === own.SOIL(f, a).toFixed(2) && card.sub === `Oil saturation on ${dateOf(model.frames[f])}` && m && m[4] === zone,
      `the card at a tapped cell equals this file's decode: "${card.where}", ${card.num} (${card.sub}); ${card.rows.map(([k, v]) => `${k} ${v}`).join(', ')}${JSON.stringify(card.rows) === JSON.stringify(want) ? '' : ` | want ${want.map(([k, v]) => `${k} ${v}`).join(', ')}`}`);
    const px = pr.left + hitPt[0], py = pr.top + hitPt[1];
    check(!(px >= card.r.left && px <= card.r.right && py >= card.r.top && py <= card.r.bottom), `the card keeps clear of the tapped point (${Math.round(px)}, ${Math.round(py)}; the card ${Math.round(card.r.left)}–${Math.round(card.r.right)} × ${Math.round(card.r.top)}–${Math.round(card.r.bottom)})`);
    await page.waitForTimeout(200);
    const live = await w(() => document.getElementById('live').textContent);
    check(live.startsWith(card.where) && /Oil saturation [\d.]+ on \d+ \w+ \d{4}\.$/.test(live), `the tap's one sentence: "${live}"`);
    const clash = await w(() => {
      const rs = ['readout', 'keys'].map((id) => document.getElementById(id).getBoundingClientRect());
      return [...document.querySelectorAll('#labels .wl, #labels .zl')].filter((e) => e.style.display !== 'none').filter((e) => { const r = e.getBoundingClientRect(); return rs.some((q) => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top); }).map((e) => e.textContent);
    });
    check(clash.length === 0, `well names stay clear of the card and the keys${clash.length ? ': ' + clash.join(', ') : ''}`);
    await A.shot(`cell-${scheme}`);
    // updated in place per step: the same dd nodes, new text
    const before = await w(() => { window.__dd = document.querySelector('#readout-all dd'); return window.__dd.textContent; });
    await setFrame(A, 100);
    const after = await w(() => [window.__dd === document.querySelector('#readout-all dd'), window.__dd.textContent]);
    check(after[0], `the card's rows are updated in place per step (the same node; ${before} then ${after[1]})`);
    await A.tapEl('#readout-close');
    await A.frame();
  }

  // a well's card never contradicts itself (QA, after the pass): on every frame where the well is open in
  // a role the summary holds no rate series for, the headline says what the Now row says, and that no
  // rate was reported; and on a frame with a rate, the figure, beside a Now row that is not Shut
  {
    const DOING = ['Shut', 'Producing', 'Injecting water', 'Injecting gas'], KEY = [null, 'oil', 'winj', 'ginj'];
    const gaps = [];
    for (const wl of model.wells) { const sm = model.summary.wells[wl.name] || {}; wl.state.forEach((c, f) => { if (c && !sm[KEY[c]]) gaps.push([wl.name, f, c]); }); }
    const rated = model.wells.flatMap((wl) => { const sm = model.summary.wells[wl.name] || {}; const f = wl.state.findIndex((c, i) => c === 1 && sm.oil && sm.oil[i] > 0); return f >= 0 ? [[wl.name, f, 1]] : []; }).slice(0, 1);
    const seen = [];
    for (const [name, f, c] of [...gaps, ...rated]) {
      await setFrame(A, f);
      await w((n) => { const s = document.getElementById('well-pick'); s.value = n; s.dispatchEvent(new Event('change')); }, name);
      await A.frame();
      const r = await w(() => [document.getElementById('readout-number').textContent, document.getElementById('readout-unit').textContent, document.getElementById('readout-sub').textContent, [...document.querySelectorAll('#readout-all dt')].find((d) => d.textContent === 'Now').nextElementSibling.textContent]);
      const gap = !rated.some(([n, ff]) => n === name && ff === f);
      const ok = r[3] === DOING[c] && (gap ? r[0] === DOING[c] && r[1] === '' && r[2] === `no rate reported for the month to ${dateOf(model.frames[f])}` : /^[\d\u202f.,]+$/.test(r[0]) && r[1].trim() === 'Sm³/d' && r[2] === `Oil produced in the month to ${dateOf(model.frames[f])}`);
      if (!ok) seen.push(`${name} ${model.frames[f]}: "${r[0]}${r[1]}" / ${r[2]} / Now ${r[3]}`);
      else seen.push(`${name} ${model.frames[f]} "${r[0]}${r[1]}", ${r[2]}, Now ${r[3]}`);
      check(ok, `the well card agrees with itself: ${seen[seen.length - 1]}`);
      if (gap && name === 'C-4H' && scheme === 'light') await A.shot('well-gap-light', false);
      await A.tapEl('#readout-close'); await A.frame();
    }
    check(gaps.length === 2, `this file has ${gaps.length} open frames without a rate series (2 expected: C-4H on 6 Nov 1997, F-4H on 1 Sep 2001)`);
  }

  // SI in every visible text node, with the sheet open to its last stop
  {
    await A.tapEl('#grip'); await A.tapEl('#grip'); await A.frame(); await page.waitForTimeout(300);
    const si = await siOf(w);
    check(si.bad.length === 0, `SI: ${si.n} visible text nodes, no hyphen-minus before a digit, U+202F before every unit, thousands grouped${si.bad.length ? ': ' + si.bad.slice(0, 6).join(' | ') : ''}`);
    await A.shot(`sheet-${scheme}`);
    await A.tapEl('#grip'); await A.frame();
  }
  await setFrame(A, 80);
  await A.shot(`open-${scheme}`);
  check(A.errors.length === 0, `no console error or warning, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once (light)');
{
  const A = await open('light');
  const { page, w } = A;

  // the scrub by real touch: 2, 8 and 20 report dates a second, a move every 16 ms
  if (process.env.SCRUB !== '0') {
    for (const [rate, from, to] of [[2, 10, 18], [8, 20, 60], [20, 5, 105]]) {
      await setFrame(A, from);
      const tr = await A.rect('#slider'), y = tr.top + tr.height / 2;
      await w(() => window.__norne.log(true));
      const s0 = await ST8(A);
      await A.touch('touchStart', trackX(tr, from), y);
      const t0 = Date.now(), dur = ((to - from) / rate) * 1000;
      for (;;) {
        const t = Math.min(dur, Date.now() - t0);
        await A.touch('touchMove', trackX(tr, from + ((to - from) * t) / dur), y);
        if (t >= dur) break;
        await new Promise((r) => setTimeout(r, 16));
      }
      await A.touch('touchEnd');
      await A.frame(); await A.frame();
      const log = await w(() => window.__norne.log(false));
      const s1 = await ST8(A);
      const bad = log.filter((e) => e.shown !== e.wanted || e.tex !== e.shown || e.label !== dateOf(model.frames[e.shown]) || e.now !== e.shown);
      const seq = log.map((e) => e.shown), steps = new Set(seq);
      const ordered = seq.every((s, i) => !i || s >= seq[i - 1]);
      const every = rate !== 2 || Array.from({ length: to - from }, (_, i) => from + 1 + i).every((s) => steps.has(s));   // the first date is drawn before the finger lands
      const passes = s1.colorPasses - s0.colorPasses;
      check(bad.length === 0 && ordered && every && seq[seq.length - 1] === to,
        `scrub at ${rate} dates a second, ${from} to ${to}: ${log.length} frames drew a new date, ${bad.length} whose texture, label or aria-valuenow differ from the date drawn; ${rate === 2 ? 'every date drawn, in order' : `${steps.size} dates drawn, never backwards`}; the frame after the lift draws ${seq[seq.length - 1]} (headless: ${passes} color passes at ${(passes ? (s1.colorMs - s0.colorMs) / passes : 0).toFixed(1)} ms each)`);
    }
    const anims = await w(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.player')).length);
    check(anims === 0, `no animation runs on the time row or the track (${anims})`);
  }

  // play: never backwards, the Play key's mark by computed style, the expensive work only on a new date,
  // About holding play, a touch on the track stopping it on the date under the finger
  {
    await setFrame(A, 30);
    await w(() => window.__norne.log(true));
    const s0 = await ST8(A);
    await A.tapEl('#btn-play');
    await page.waitForTimeout(150);
    const marks = await playMarks(w);
    await page.waitForTimeout(1350);
    const log = await w(() => window.__norne.log(false)), s1 = await ST8(A);
    const seq = log.map((e) => e.shown), adv = seq.length ? seq[seq.length - 1] - 30 : 0;
    const bad = log.filter((e) => e.label !== dateOf(model.frames[e.shown]) || e.tex !== e.shown);
    check(/ico-play hidden none, ico-pause shown (block|inline)/.test(marks) && /Pause$/.test(marks), `while playing the Play key shows the pause bars and is named Pause (${marks})`);
    check(seq.length > 3 && seq.every((s, i) => !i || s === seq[i - 1] + 1) && bad.length === 0,
      `play: ${seq.length} dates in 1.5 s (config.json's ${cfg.playbackFramesPerSecond} a second), each one step on, never backwards, every label the drawn date's`);
    const frames = s1.frames - s0.frames, passes = s1.colorPasses - s0.colorPasses;
    check(passes <= adv + 1 && frames > passes, `the color pass runs only on a new date: ${passes} passes for ${adv} dates over ${frames} frames (HOUSE 4.6)`);
    // About holds play still; closing it lets play go on
    await A.tapEl('#btn-about');
    await page.waitForTimeout(100);
    const held0 = await w(() => window.__norne.shown());
    await page.waitForTimeout(700);
    const held1 = await w(() => [window.__norne.shown(), window.__norne.stats().playing, !document.getElementById('about').hidden]);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    const after = await w(() => [window.__norne.shown(), window.__norne.stats().playing, document.getElementById('about').hidden]);
    check(held1[0] === held0 && !held1[1] && held1[2] && after[1] && after[0] > held0 && after[2], `About holds play still (${held0} while open), Escape closes it and play goes on (${after[0]})`);
    const tr = await A.rect('#slider');
    await A.touch('touchStart', trackX(tr, 20), tr.top + tr.height / 2);
    await A.frame();
    const stopped = await w(() => [window.__norne.stats().playing, window.__norne.shown()]);
    await A.touch('touchEnd');
    check(!stopped[0] && stopped[1] === 20, `a touch on the track during play stops it on the date under the finger (${stopped[1]})`);
    const m2 = await playMarks(w);
    check(/ico-play shown (block|inline), ico-pause hidden none/.test(m2) && /Play production history$/.test(m2), `stopped, the Play key shows its triangle and is named Play production history (${m2})`);
    // the step keys, with their sentence
    await A.tapEl('#btn-next'); await A.frame(); await page.waitForTimeout(100);
    const nx = await w(() => [window.__norne.shown(), document.getElementById('live').textContent]);
    check(nx[0] === 21 && nx[1] === `${(() => { const [y, m, d] = model.frames[21].split('-').map(Number); return `${d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`; })()}.`, `Forward one month moves one date and says it: "${nx[1]}"`);
    // a second of play at the last date draws nothing new
    await setFrame(A, NF - 1);
    const q0 = await ST8(A); await page.waitForTimeout(1000); const q1 = await ST8(A);
    check(q1.draws === q0.draws && q1.colorPasses === q0.colorPasses && !q1.raf, `at rest the loop asks for no frame: ${q1.frames - q0.frames} frames, ${q1.draws - q0.draws} draws in a second (B11)`);
  }

  // the plate holds still while the dates change; the cut's key is one 15 px line (HOUSE 4.15, F4)
  {
    const hs = new Set(), cs = new Set();
    for (let f = 0; f < NF; f += 9) { await setFrame(A, f); const r = await w(() => [document.getElementById('plate').getBoundingClientRect().height, document.getElementById('cutkey').getBoundingClientRect().height]); hs.add(r[0]); cs.add(r[1]); }
    check(hs.size === 1 && cs.size === 1 && [...cs][0] === 15, `the plate holds still over 13 dates: plate ${[...hs].join(', ')} px, the cut's key ${[...cs].join(', ')} px`);
    const ph = [...hs][0];
    check(ph >= 530, `the plate at 390 × 844 with the sheet closed: ${Math.round(ph)} px (ART.md: at least 530; 480 before the text cut)`);
  }

  // the recorded bug (B1): the legend clear of the header and the player at all three sheet stops, with the
  // phone's insets emulated (59 px on top, 34 px at the foot), as tools/.work/bug.mjs reproduced it
  {
    await page.addStyleTag({ content: '.head { padding-top: 65px !important } .sheet { padding-bottom: 34px !important }' });
    const res = [];
    for (let s = 0; s < 3; s++) {
      await A.frame(); await page.waitForTimeout(150);
      const r = await w(() => { const g = (id) => document.getElementById(id).getBoundingClientRect(); const L = g('legend'), H = g('head'), P = g('player'), V = g('valid'), Pl = g('plate'); const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; return { overHead: hit(L, H), overPlayer: hit(L, P), overDate: hit(L, V), plate: Math.round(Pl.height), name: document.getElementById('grip').getAttribute('aria-label') }; });
      res.push(r);
      await A.tapEl('#grip');
    }
    check(res.every((r) => !r.overHead && !r.overPlayer && !r.overDate && r.plate >= 200), `B1: the legend is clear of the header, the date and the player at every stop, with the insets: ${res.map((r, i) => `stop ${i} plate ${r.plate} px`).join(', ')}`);
    check(res.map((r) => r.name).join('|') === 'Show more controls|Show all controls|Hide the extra controls', `the grip's names at its stops: ${res.map((r) => r.name).join(', ')}`);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await A.frame();
  }

  // the units key: SI first, then US (psi, feet, bbl/d), back to SI
  {
    const k0 = await w(() => document.getElementById('btn-units').textContent);
    await A.tapEl('#btn-units'); await A.frame(); await A.frame();
    await setProp(A, 'PRESSURE');
    await setFrame(A, 109);
    const us = await w(() => [document.getElementById('btn-units').textContent, document.getElementById('btn-units').getAttribute('aria-label'), [...document.querySelectorAll('#legend-ticks span:not([hidden])')].pop().textContent, document.getElementById('slider').getAttribute('aria-valuetext'), document.getElementById('scale-len').textContent]);
    check(k0 === 'SI' && us[0] === 'US' && /psi$/.test(us[2]) && us[3].endsWith(`Oil ${Math.round(F.oil[109] * 6.28981)} barrels a day, water ${Math.round(F.water[109] * 6.28981)}, ${Math.round((F.water[109] / (F.oil[109] + F.water[109])) * 100)} percent water.`) && /(ft|mi)$/.test(us[4]), `the units key starts at SI; one press: ${us[0]} ("${us[1]}"), the legend ends "${us[2]}", the scale bar "${us[4]}", the track in words "${us[3]}"`);
    await A.tapEl('#btn-units'); await A.frame();
    await setProp(A, 'SOIL');
    const back = await w(() => [document.getElementById('btn-units').textContent, localStorage.getItem('norne-viewer:v1:units')]);
    check(back[0] === 'SI' && back[1] === 'SI', `a second press is back at SI, remembered as norne-viewer:v1:units = ${back[1]}`);
  }

  // hit targets, with the sheet closed and at its last stop
  {
    const h0 = await hitTargets(w);
    await A.tapEl('#grip'); await A.tapEl('#grip'); await A.frame(); await page.waitForTimeout(200);
    const h2 = await hitTargets(w);
    await A.tapEl('#grip'); await A.frame();
    check(h0.bad.length === 0 && h2.bad.length === 0 && h0.small === 0, `hit targets: ${h0.n} controls with the sheet closed and ${h2.n} at its last stop, all at least 44 × 44; ${h0.labels} well names, each a 44 × 44 hit${h0.bad.concat(h2.bad).length ? ': ' + h0.bad.concat(h2.bad).join('; ') : ''}`);
  }

  // focus mode: by touch and by Enter, what leaves, what stays, inside it, out of it, remembered
  {
    const before = await w(() => document.getElementById('plate').getBoundingClientRect().height);
    await A.tapEl('#focus-key');
    await page.waitForTimeout(450);
    const f = await w(() => {
      const gone = ['head', 'keys', 'sheet'].map((id) => { const e = document.getElementById(id); return e.hidden && e.inert; });
      const stays = ['legend', 'instruments', 'wellkey', 'cutkey', 'player', 'btn-about'].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return r.height > 0 && !e.closest('[hidden]'); });
      return { gone, stays, stampIn: document.getElementById('btn-about').parentElement.id, ghost: !document.getElementById('focus-exit').hidden, plate: document.getElementById('plate').getBoundingClientRect().height, live: document.getElementById('live').textContent, store: localStorage.getItem('norne-viewer:v1:focus'), active: document.activeElement.id };
    });
    const tree = await page.getByRole('button', { name: 'Zoom in', exact: true }).count();
    const legend = await page.getByText('Oil saturation', { exact: true }).first().isVisible();
    check(f.gone.every(Boolean) && tree === 0 && f.stays.every(Boolean) && f.stampIn === 'caption' && f.ghost && legend,
      `focus mode by touch: the header, the keys and the sheet are hidden and inert (gone from the tree: ${tree === 0}); the legend ("Oil saturation" visible ${legend}), the instruments, the wells' and the cut's keys, the player and the About key (now in the caption band) stay`);
    check(f.plate > before && f.plate >= 590, `the plate grew from ${Math.round(before)} to ${Math.round(f.plate)} px (ART.md: at least 590)`);
    check(f.live === 'Controls hidden. Press Escape or the corner key to show them.' && f.store === '1' && f.active !== 'focus-exit', `its sentence ("${f.live}"), norne-viewer:v1:focus = ${f.store}, and no ring after a touch (focus on "${f.active}")`);
    const hf = await hitTargets(w);
    check(hf.bad.length === 0, `hit targets in focus mode: ${hf.n} controls at least 44 × 44${hf.bad.length ? ': ' + hf.bad.join('; ') : ''}`);
    const g = await A.rect('#focus-exit'), pr = await A.rect('#plate');
    check(g.top - pr.top >= 8 && pr.right - g.right >= 8 && g.width === 44 && g.height === 44, `the ghost key sits in the plate's top-right corner, 8 px in (${Math.round(g.left)}, ${Math.round(g.top)}, 44 × 44)`);
    // inside it: a scrub, play and a tap still work
    const tr = await A.rect('#slider');
    await A.touch('touchStart', trackX(tr, 40), tr.top + 29); await A.touch('touchMove', trackX(tr, 50), tr.top + 29); await A.touch('touchEnd'); await A.frame();
    const sc = await w(() => window.__norne.shown());
    await A.tapEl('#btn-play'); await page.waitForTimeout(500); const pl = await w(() => window.__norne.stats().playing); await A.tapEl('#btn-play');
    await A.shot('focus-light');
    check(sc === 50 && pl, `inside focus mode the scrub lands on ${sc} and play plays (${pl})`);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 });
    const kept = await w(() => [document.body.classList.contains('focus'), document.getElementById('head').hidden]);
    check(kept[0] && kept[1], 'focus mode survives a reload, restored before the first draw');
    // the camera's way out: the button named exactly Show the controls
    await page.getByRole('button', { name: 'Show the controls', exact: true }).click();
    await page.waitForTimeout(300);
    const outs = await w(() => [document.getElementById('head').hidden, document.getElementById('live').textContent, localStorage.getItem('norne-viewer:v1:focus')]);
    const pressure = await page.getByRole('radio', { name: 'Pressure', exact: true }).isVisible();
    check(!outs[0] && outs[1] === 'Controls shown.' && outs[2] === '0' && pressure, `the camera's way out of a library left in focus mode: "Show the controls" brings the header back ("${outs[1]}"), Pressure visible ${pressure}`);
    // by the keyboard: Enter on the key, focus moves to the ghost; Escape leaves and focus returns
    await page.focus('#focus-key'); await page.keyboard.press('Enter'); await page.waitForTimeout(450);
    const k1 = await w(() => [document.body.classList.contains('focus'), document.activeElement.id]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const k2 = await w(() => [document.body.classList.contains('focus'), document.activeElement.id]);
    check(k1[0] && k1[1] === 'focus-exit' && !k2[0] && k2[1] === 'focus-key', `by the keyboard: Enter goes in with focus on the ghost key (${k1[1]}); Escape comes out with focus back on the entry key (${k2[1]})`);
  }

  // hidden: every loop stops, and the return draws fresh
  {
    await A.tapEl('#btn-play'); await page.waitForTimeout(200);
    await w(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const h0 = await ST8(A); await page.waitForTimeout(600); const h1 = await ST8(A);
    await w(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await A.frame(); await A.frame();
    const h2 = await ST8(A);
    check(!h0.playing && h1.frames === h0.frames && !h1.raf && h2.draws > h1.draws, `hidden: play stops and no frame runs (${h1.frames - h0.frames} in 600 ms); the return draws fresh (${h2.draws - h1.draws} draws)`);
  }

  // About: from the About key, every credit and the font's, Escape, focus back
  {
    await page.focus('#btn-about'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const ab = await w(() => ({ open: !document.getElementById('about').hidden, text: document.getElementById('about-body').innerText, src: document.getElementById('about-source').textContent, active: document.activeElement.id }));
    await A.shot('about-light');
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const back = await w(() => [document.getElementById('about').hidden, document.activeElement.id]);
    check(ab.open && ab.src === model.source && /License: Open Database License \(ODbL\) 1\.0, opendatacommons\.org\/licenses\/odbl\/1-0\//.test(ab.text)
      && ab.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.')
      && /not the field’s reported production/.test(ab.text) && /The section shows the model where a vertical plane/.test(ab.text) && back[0] && back[1] === 'btn-about',
    `About opens from the About key (focus on ${ab.active}): model.json's source verbatim, the license without its scheme, the face's credit, what the cut is not; Escape closes it, focus back on ${back[1]}`);
  }
  check(A.errors.length === 0, `no console error or warning, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

// Reduce Motion: every animation at 0 s, a flight a cut, play in whole steps
{
  console.log('\n== Reduce Motion');
  const A = await open('light', { reduced: true });
  const { w, page } = A;
  const pr = await A.rect('#plate');
  await A.touch('touchStart', pr.left + 150, pr.top + 250);
  for (let i = 1; i <= 6; i++) await A.touch('touchMove', pr.left + 150 + i * 12, pr.top + 250);
  await A.touch('touchEnd'); await A.frame();
  await A.tapEl('#fit');
  const c = await w(() => window.__norne.cam());
  await A.tapEl('#focus-key'); await A.frame();
  const dur = await w(() => [getComputedStyle(document.getElementById('focus-exit')).animationDuration, getComputedStyle(document.querySelector('.words [aria-checked="true"]'), '::after').animationDuration]);
  await A.tapEl('#focus-exit'); await A.frame();
  await A.tapEl('#btn-play'); await page.waitForTimeout(800);
  const st = await A.w(() => [window.__norne.stats().playing, Number.isInteger(window.__norne.shown())]);
  check(!c.flying && Math.round(c.theta) === 62 && Math.round(c.phi) === 36 && dur.every((d) => d === '0s') && st[0] && st[1],
    `Reduce Motion: Show the whole field is a cut (theta ${Math.round(c.theta)}, phi ${Math.round(c.phi)}, no flight), the ghost key and the tracer at ${dur.join(' and ')}, play plays in whole dates`);
  check(A.errors.length === 0, `no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
}

// broken data: each a sentence in the file's terms on the plate, never a blank screen
{
  console.log('\n== broken data');
  const cases = [
    ['/data/dynamic.bin', { status: 404 }, 'data/dynamic.bin could not be read (HTTP 404).'],
    ['/data/dynamic.bin', { body: DYN.subarray(0, 19549000) }, `data/dynamic.bin holds 19${NN}549${NN}000 bytes; 110 report dates need 19${NN}549${NN}640.`],
    ['/data/model.json', { body: '<!doctype html><title>Not found</title>' }, 'data/model.json is not valid JSON; it looks like a web page was written over it.'],
    ['/config.json', { status: 404 }, 'config.json could not be read (HTTP 404).'],
  ];
  for (const [p, ov, want] of cases) {
    override = { [p]: ov };
    const A = await open('light', { noWait: true, expect: new RegExp(`404|Failed to load resource|requestfailed .*${p.replace(/[./]/g, '\\$&')}$`) });
    await A.page.waitForFunction(() => !document.getElementById('error').hidden, null, { timeout: 60000 });
    const r = await A.w(() => [document.getElementById('error').textContent, document.getElementById('legend-name').textContent, document.getElementById('stamp').textContent, !document.getElementById('stamp-home').hidden, document.getElementById('btn-about').hidden, document.getElementById('stamp').getBoundingClientRect().height]);
    check(r[0] === want && r[1] === '' && r[2] === 'The model could not be read.' && r[3] && r[4] && Math.abs(r[5] - 16) <= 1 && A.errors.length === 0,
      `${p} ${ov.status ? `answers ${ov.status}` : 'replaced'}: "${r[0]}"; the legend stays empty, so the camera's wait does not pass; the stamp's line shows "${r[2]}" on one line (${r[5]} px), the About key hidden${A.errors.length ? ' | ' + A.errors.join(' | ') : ''}`);
    // the notice sits on the theme's own ground, never on the WebGL context's black (QA, after the pass);
    // the first case also turns the theme to dark and back while broken
    for (const sch of p === cases[0][0] && ov.status ? ['light', 'dark', 'light'] : ['light']) {
      await A.page.emulateMedia({ colorScheme: sch });
      await A.page.waitForTimeout(150);
      const pr = await A.rect('#plate'), er = await A.rect('#error'), sp = path.join(OUT, `broken-plate-${sch}.png`);
      await A.page.screenshot({ path: sp, clip: { x: 0, y: pr.top, width: pr.width - 60, height: pr.height } });   // the view's controls column left out, as the plate check does
      const img = decodePng(fs.readFileSync(sp)), ground = hexRgb(sch === 'light' ? '#ffffff' : '#0c1316'), sc = img.w / (pr.width - 60);
      let n = 0, on = 0;
      for (let y = 0; y < img.h; y += 4) for (let x = 0; x < img.w; x += 4) {
        const X = x / sc, Y = pr.top + y / sc;
        if (X >= er.left - 8 && X <= er.right + 8 && Y >= er.top - 8 && Y <= er.bottom + 8) continue;
        const i = (y * img.w + x) * 4; n++;
        if (Math.abs(img.px[i] - ground[0]) + Math.abs(img.px[i + 1] - ground[1]) + Math.abs(img.px[i + 2] - ground[2]) <= 3) on++;
      }
      check(n > 1000 && on / n >= 0.99, `${p} broken, ${sch} theme: ${(on / n * 100).toFixed(1)} % of ${n} sampled plate pixels outside the notice are the ground ${sch === 'light' ? '#ffffff' : '#0c1316'}`);
    }
    await A.ctx.close();
  }
  override = {};
  const A = await open('light', { expect: /404|Failed to load resource/ });
  override = { '/config.json': { body: '{ "defaultProperty": ' } };
  await A.w(() => window.dispatchEvent(new Event('focus')));
  await A.page.waitForFunction(() => !document.getElementById('error').hidden, null, { timeout: 10000 });
  const r = await A.w(() => [document.getElementById('error').textContent, document.getElementById('legend-name').textContent, window.__norne.stats().draws]);
  override = {};
  check(r[0] === 'config.json is not valid JSON. The settings already loaded stay.' && r[1] === 'Oil saturation', `a broken config.json on a later read: "${r[0]}", the view kept (legend "${r[1]}")`);
  check(A.errors.length === 0, `no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
}

// widths: no sideways scroll, the cut's longest line inside its fixed height, the plate on a phone on its side
{
  console.log('\n== widths');
  for (const [W, H, dpr, label] of [[320, 700, 2, '320'], [360, 780, 3, '360'], [375, 667, 2, '375'], [312, 675, 2.5, '125 % zoom (312 × 675)'], [844, 390, 3, '844 × 390, on its side']]) {
    const A = await open('dark', { w: W, h: H, dpr });
    const side = W > H;
    const r = await A.w(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, plate: document.getElementById('plate').getBoundingClientRect().height, keys: document.getElementById('keys').getBoundingClientRect().height, row: document.getElementById('plate').classList.contains('keys-row') }));
    // the keys in the caption and under the section stay on their one line, in both unit systems,
    // with the section open (beside the model on its side)
    await A.tapEl('#btn-section'); await A.page.waitForTimeout(400); await A.frame();
    let worst = [0, ''];
    for (const sys of ['SI', 'US']) {
      if ((await A.w(() => window.__norne.units())) !== sys) { await A.tapEl('#btn-units'); await A.frame(); }
      const o = await A.w(() => ['cutkey', 'sec-key', 'sec-head'].map((id) => { const e = id === 'sec-head' ? document.querySelector('.sec-head') : document.getElementById(id); return [Math.max(e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth), `${id} "${e.textContent.trim().replace(/\s+/g, ' ')}"`]; }));
      for (const [over, what] of o) if (over > worst[0]) worst = [over, what];
    }
    if ((await A.w(() => window.__norne.units())) !== 'SI') await A.tapEl('#btn-units');
    await A.frame();
    const sp = await A.w(() => { const p = document.getElementById('plate').getBoundingClientRect(), q = document.getElementById('section').getBoundingClientRect(); return { beside: q.left >= p.right - 1 && Math.abs(q.top - p.top) < 2, under: q.top >= p.bottom - 1, plate: Math.round(p.height), sec: Math.round(q.height), w: Math.round(q.width) }; });
    const hs = await hitTargets(A.w);
    if (side) await A.shot('landscape-dark', false);
    check(r.sw <= r.iw && worst[0] <= 1 && hs.bad.length === 0 && (side ? sp.beside : sp.under) && (!side || (r.plate >= 220 && r.row && r.keys <= 40)),
      `${label}: page ${r.sw} of ${r.iw} px wide; the cut's key, the section's key and its words each fit their line in both systems${worst[0] > 1 ? ` (over by ${worst[0]} px: ${worst[1]})` : ''}; the section ${side ? 'beside' : 'under'} the model (${sp.w} × ${sp.sec} px, the model ${sp.plate} px tall); ${hs.n} controls at 44 px or more with it open${hs.bad.length ? ': ' + hs.bad.join('; ') : ''}${side ? `; the plate ${Math.round(r.plate)} px tall with the sheet closed and the section shut (at least 220), the keys in a row ${Math.round(r.keys)} px tall` : ''}`);
    check(A.errors.length === 0, `${label}: no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
    await A.ctx.close();
  }
}

// after the review: the field framed at every size the plate takes, taps on the rock opening cells, the
// Cut's printed scale clear of its columns
{
  console.log('\n== framing, taps, the scale');
  const A = await open('light');
  const { w } = A;
  /** The field's drawn box: plate pixels that are not the ground, the keys and the ghost key left out. */
  const fieldBox = async (name) => {
    await A.frame(); await A.page.waitForTimeout(300); await A.frame();
    const g = await w(() => { const r = (id) => { const e = document.getElementById(id); return e.hidden || e.closest('[hidden]') ? null : e.getBoundingClientRect().toJSON(); }; return { plate: r('plate'), keys: r('keys'), ghost: r('focus-exit'), iw: innerWidth }; });
    const p = path.join(OUT, `frame-${name}.png`);
    await A.page.screenshot({ path: p });
    const img = decodePng(fs.readFileSync(p)), s = img.w / g.iw, ground = hexRgb('#ffffff'), pr = g.plate;
    const skip = [g.keys, g.ghost].filter(Boolean);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let y = Math.ceil(pr.top * s); y < Math.floor(pr.bottom * s); y++) for (let x = Math.ceil(pr.left * s); x < Math.floor(pr.right * s); x++) {
      const X = x / s, Y = y / s;
      if (skip.some((r) => X >= r.left - 2 && X <= r.right + 2 && Y >= r.top - 2 && Y <= r.bottom + 2)) continue;
      const i = (y * img.w + x) * 4;
      if (Math.abs(img.px[i] - ground[0]) + Math.abs(img.px[i + 1] - ground[1]) + Math.abs(img.px[i + 2] - ground[2]) > 12) { x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    }
    const inside = x0 > pr.left + 1 && x1 < pr.right - 2 && y0 > pr.top + 1 && y1 < pr.bottom - 2;
    const clear = !g.keys || !(x0 < g.keys.right && x1 > g.keys.left && y0 < g.keys.bottom && y1 > g.keys.top);
    return { name, W: Math.round(pr.width), H: Math.round(pr.height), wShare: Math.round(((x1 - x0) / pr.width) * 100), hShare: Math.round(((y1 - y0) / pr.height) * 100), inside, clear, keys: g.keys, right: Math.round(x1 - pr.left) };
  };
  const say = (b) => `${b.name} ${b.W} × ${b.H}: ${b.wShare} % of the width, ${b.hShare} % of the height${b.inside ? '' : ', CUT AT THE PLATE\'S EDGE'}${b.clear ? '' : ', UNDER THE KEYS'}`;
  await A.w(() => window.__norne.setFrame(80));
  const boxes = [];
  boxes.push(await fieldBox('closed'));
  await A.tapEl('#grip'); await A.page.waitForTimeout(400);
  boxes.push(await fieldBox('stop 1'));
  await A.tapEl('#grip'); await A.page.waitForTimeout(400);
  await A.tapEl('#grip'); await A.page.waitForTimeout(400);
  await A.tapEl('#focus-key'); await A.page.waitForTimeout(600);
  boxes.push(await fieldBox('focus mode'));
  await A.page.setViewportSize({ width: 844, height: 390 }); await A.page.waitForTimeout(600);
  const cols = await w(() => [getComputedStyle(document.body).gridTemplateColumns, document.getElementById('plate').getBoundingClientRect().width, innerWidth]);
  boxes.push(await fieldBox('focus mode on its side'));
  check(!cols[0].includes(' ') && Math.round(cols[1]) === cols[2], `focus mode on its side: one column ("${cols[0]}"), the plate ${Math.round(cols[1])} of ${cols[2]} px wide, no strip left by the hidden sheet`);
  await A.tapEl('#focus-exit'); await A.page.waitForTimeout(600);
  const side = await fieldBox('on its side');
  await A.page.setViewportSize({ width: 390, height: 844 }); await A.page.waitForTimeout(600);
  boxes.push(await fieldBox('upright again'));
  check(boxes.every((b) => b.inside && b.clear && b.wShare >= 70), `the field fitted by its projected box and refitted as the plate changes: ${boxes.map(say).join('; ')} (each inside the plate, clear of the keys, 70 % of the width or more)`);
  // on its side with the keys in a row the room is the part left of them: the field fills it to the keys
  check(side.inside && side.clear && side.keys && side.right >= side.keys.left - 24 - 0 && (side.hShare >= 65 || side.wShare >= 70), `${say(side)}; the keys' row starts at ${Math.round(side.keys.left)} px and the field ends at ${side.right} px (it fills the room left of them)`);
  // a camera moved by hand keeps its zoom against the fit: a pinch to half the fit, then focus mode
  await A.tapEl('#fit'); await A.page.waitForTimeout(800);
  const c0 = await w(() => window.__norne.cam());
  await w(() => { const c = document.getElementById('gl'); c.dispatchEvent(new WheelEvent('wheel', { deltaY: -460, bubbles: true, cancelable: true })); });
  const c1 = await w(() => window.__norne.cam());
  await A.tapEl('#focus-key'); await A.page.waitForTimeout(600);
  const c2 = await w(() => window.__norne.cam());
  await A.tapEl('#focus-exit'); await A.page.waitForTimeout(600);
  const c3 = await w(() => window.__norne.cam());
  check(c0.fit && !c1.fit && !c2.fit && Math.abs(c3.dist - c1.dist) / c1.dist < 0.02 && Math.abs(c2.dist / c1.dist - 1) > 0.02, `a pinched camera is no longer the fit, and keeps its zoom against it through focus mode: ${Math.round(c0.dist)} m at the fit, ${Math.round(c1.dist)} after the wheel, ${Math.round(c2.dist)} in focus mode, ${Math.round(c3.dist)} back out`);
  await A.tapEl('#fit'); await A.page.waitForTimeout(800);

  // taps: on the rock a cell wins, except on a name's own text (padded to 24 px tall, WCAG 2.5.8); the
  // review measured 31.4 % of the field under the names' former 44 px boxes, reaching down over the rock
  const share = await w(() => {
    const pr = document.getElementById('plate').getBoundingClientRect(), N = window.__norne, hits = N.labelHits();
    const inText = (x, y, pad) => hits.some((h) => x >= h.ix + 2 - pad && x <= h.ix + h.iw - 2 + pad && y >= h.iy + 4 - pad && y <= h.iy + 20 + pad);
    let cells = 0, wells = 0, stray = 0, drawn = 0;
    for (let y = 2; y < pr.height; y += 4) for (let x = 2; x < pr.width - 60; x += 4) {
      if (N.pick(x, y) < 0) continue;
      cells++;
      if (inText(x, y, 0)) drawn++;
      if (N.resolveTap(x, y).well) { wells++; if (!inText(x, y, 4)) stray++; }
    }
    return { cells, wells, stray, drawn };
  });
  const pct = (v) => `${((v / share.cells) * 100).toFixed(1)} %`;
  check(share.cells > 1000 && share.stray === 0 && share.wells - share.drawn <= share.cells * 0.1, `a tap on the rock opens the cell under the finger: of ${share.cells} sampled points on the field, ${share.wells} (${pct(share.wells)}) open a well, every one on a name's padded text and none beyond it; the names' drawn text alone covers ${share.drawn} (${pct(share.drawn)}), so the padding adds ${pct(share.wells - share.drawn)} (10 % or less)`);
  const h = (await w(() => window.__norne.labelHits()))[0], pr = await A.rect('#plate');
  await A.tapAt(pr.left + h.ix + h.iw / 2, pr.top + h.iy + h.ih / 2); await A.page.waitForTimeout(400);
  const where = await w(() => document.getElementById('readout-where').textContent);
  check(where === `Well ${h.name}` && h.ih >= 24 && h.h >= 44 && h.y + h.h <= h.iy + h.ih + 0.5, `a tap on a name's text opens its well ("${where}"); the text's hit is ${Math.round(h.iw)} × ${Math.round(h.ih)}, the 44 × 44 box grows upward from it`);
  await A.tapEl('#readout-close'); await A.frame();
  check(A.errors.length === 0, `no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();

  // the Cut's printed scale, with its unit, clear of every column at 320 and 390 px, in both systems
  for (const [Wd, Ht] of [[320, 700], [390, 844]]) {
    const B = await open('light', { w: Wd, h: Ht });
    for (const sys of ['SI', 'US']) {
      if ((await B.w(() => window.__norne.units())) !== sys) { await B.tapEl('#btn-units'); await B.frame(); }
      await B.frame();
      const t = await B.w((label) => {
        const c = document.getElementById('track'), x = c.getContext('2d');
        x.save(); x.font = '400 10.5px "Ysabeau Office", system-ui, -apple-system, sans-serif'; const m = x.measureText(label); x.restore();
        const copy = document.createElement('canvas'); copy.width = c.width; copy.height = c.height;
        const cx = copy.getContext('2d', { willReadFrequently: true }); cx.drawImage(c, 0, 0);
        const d = cx.getImageData(0, 0, c.width, c.height).data;   // a copy: one readback per context
        return { css: c.getBoundingClientRect().width, dw: c.width, labelW: m.width, d: [...d] };
      }, sys === 'SI' ? '40 000 Sm³/d' : '250 000 bbl/d');
      const k = sys === 'SI' ? 0.5 / 1000 : (0.08 / 1000) * 6.28981, dpr = t.dw / t.css, W = t.css;
      const xOf = (d) => 10 + ((d - DAYS[0]) / (DAYS[NF - 1] - DAYS[0])) * (W - 20);
      let top = Infinity;
      for (let f = 1; f < NF; f++) if (xOf(DAYS[f - 1]) < t.labelW) top = Math.min(top, 32 - (F.oil[f] + F.water[f]) * k - 1);
      // the label's box: x 0 to its width, y 1 to 11 (its baseline is the bottom, 1 px over the 20 px tick)
      const ink = hexRgb('#12150b');
      let inked = 0;
      for (let y = Math.round(1 * dpr); y < Math.round(11 * dpr); y++) for (let x = 0; x < Math.round(t.labelW * dpr); x++) { const i = (y * t.dw + x) * 4; if (t.d[i + 3] === 255 && Math.abs(t.d[i] - ink[0]) + Math.abs(t.d[i + 1] - ink[1]) + Math.abs(t.d[i + 2] - ink[2]) < 6) inked++; }
      check(top > 11 && inked === 0, `${Wd} px, ${sys}: the scale reads "${sys === 'SI' ? '40 000 Sm³/d' : '250 000 bbl/d'}", ${t.labelW.toFixed(1)} px wide; the tallest column under it tops out at ${top.toFixed(1)} px, below the label's foot at 11, and no column ink in its box (${inked} px)`);
    }
    check(B.errors.length === 0, `${Wd} px: no console error${B.errors.length ? ': ' + B.errors.join(' | ') : ''}`);
    await B.ctx.close();
  }
}

// the card at every sheet stop, in focus mode and on a phone on its side (the final review: with the
// sheet raised the plate is 200 px tall, and the 149 px card covered the tapped point and the keys). At
// each tap of a grid on the field: the card is open in the form the plate calls for (compact where the
// full one could not sit beside every point), clear of the finger's spot and the cell's ring, of every
// key and the ghost key, inside the plate, its Close and Zoom keys in reach, and what scrolls ends on a
// row's edge with the 1 px --line-strong rule at its foot when more follow. Then a card carried across
// the stops, a step with the card open, every well chosen from the list, and the compact card's hits.
{
  console.log('\n== the card at every stop');
  /** The open card against the tap, the ring, the keys and the plate, in the plate's CSS px. */
  const cardAt = (w, x, y) => w(([X, Y]) => {
    const pl = document.getElementById('plate'), pr = pl.getBoundingClientRect();
    const rel = (r) => ({ l: r.left - pr.left, t: r.top - pr.top, r: r.right - pr.left, b: r.bottom - pr.top });
    const over = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const card = document.getElementById('readout'), c = rel(card.getBoundingClientRect());
    const pm = document.querySelector('.pickmark'), ring = pm && pm.style.display !== 'none' && pm.style.transform ? rel(pm.getBoundingClientRect()) : null;
    const keys = [...document.querySelectorAll('#keys button'), document.getElementById('focus-exit')].filter((e) => !e.hidden && !e.closest('[hidden]')).map((e) => rel(e.getBoundingClientRect()));
    const reach = ['readout-close', 'readout-zoom'].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return (h === e || e.contains(h)) && r.top >= pr.top - 0.5 && r.bottom <= pr.bottom + 0.5; });
    const compact = card.classList.contains('compact'), region = document.getElementById(compact ? 'readout-body' : 'readout-all'), cs = getComputedStyle(region);
    const end = region.getBoundingClientRect().bottom - parseFloat(cs.borderBottomWidth);
    const parts = [...(compact ? [card.querySelector('.readout-value'), card.querySelector('.readout-sub')] : []), ...region.querySelectorAll('dd')];
    const sliced = parts.filter((e) => { const r = e.getBoundingClientRect(); return r.top < end - 0.5 && r.bottom > end + 0.5; }).length;
    const more = region.scrollHeight > region.clientHeight + 1;
    const sign = !more || (region.classList.contains('more') && cs.borderBottomStyle === 'solid' && cs.borderBottomWidth === '1px' && cs.borderBottomColor === getComputedStyle(card).borderTopColor);
    const cmp = rel(document.getElementById('north').getBoundingClientRect());
    return { open: !card.hidden, c, ring, compact, overCompass: over(c, cmp), overTap: over(c, { l: X - 9, t: Y - 9, r: X + 9, b: Y + 9 }), overRing: !!ring && over(c, { l: ring.l - 2, t: ring.t - 2, r: ring.r + 2, b: ring.b + 2 }), overKeys: keys.some((k) => over(c, k)), inside: c.l >= -0.5 && c.t >= -0.5 && c.r <= pr.width + 0.5 && c.b <= pr.height + 0.5, reach, sliced, more, sign, plate: [Math.round(pr.width), Math.round(pr.height)] };
  }, [x, y]);
  const wrong = (r, wantCompact) => [!r.open && 'closed', r.compact !== wantCompact && (r.compact ? 'compact' : 'full'), r.overTap && 'over the tap', !r.ring && 'ring hidden', r.overRing && 'over the ring', r.overKeys && 'over a key', r.overCompass && 'over the compass', !r.inside && 'past the plate', !r.reach.every(Boolean) && 'Close or Zoom out of reach', r.sliced && 'a row sliced', !r.sign && 'no rule at the foot'].filter(Boolean);
  /** Taps a 3 x 3 grid over the field's drawn rows, the card checked after each. */
  const scene = async (A, label, wantCompact) => {
    await A.frame(); await A.page.waitForTimeout(400); await A.frame();
    const pr = await A.rect('#plate');
    await compassCheck(A, label);
    const rows = await A.w(([W, H]) => { const out = []; for (let y = 12; y < H - 12; y += 12) { const xs = []; for (let x = 12; x < W - 12; x += 12) if (window.__norne.pick(x, y) >= 0) xs.push(x); if (xs.length > 2) out.push([y, xs[0], xs[xs.length - 1]]); } return out; }, [Math.round(pr.width), Math.round(pr.height)]);
    const res = [];
    for (const fy of [0.1, 0.5, 0.9]) for (const fx of [0.12, 0.5, 0.88]) {
      const row = rows[Math.round((rows.length - 1) * fy)], x = Math.round(row[1] + (row[2] - row[1]) * fx), y = row[0];
      if ((await A.w(([X, Y]) => window.__norne.resolveTap(X, Y), [x, y])).cell === undefined) continue;   // a well's name
      await A.tapAt(pr.left + x, pr.top + y); await A.page.waitForTimeout(350); await A.frame();
      res.push({ x, y, ...(await cardAt(A.w, x, y)) });
      await A.tapEl('#readout-close'); await A.frame();
    }
    const bad = res.filter((r) => wrong(r, wantCompact).length);
    const clipped = res.filter((r) => r.more).length, sz = res.length ? res[0].plate.join(' × ') : '?';
    check(res.length >= 4 && bad.length === 0, `${label}, plate ${sz}: ${res.length} taps on the field, the card ${wantCompact ? 'compact' : 'full'} each time, clear of the tap, its ring, every key and the compass, inside the plate, Close and Zoom in reach, rows whole (${clipped} with more below, each with its rule)${bad.length ? ': ' + bad.map((r) => `(${r.x}, ${r.y}) ${wrong(r, wantCompact).join(', ')}`).join('; ') : ''}`);
    return res;
  };
  const A = await open('light');
  await A.w(() => window.__norne.setFrame(60)); await A.frame();
  await scene(A, 'sheet closed', false);
  // since 2.2 the view keeps about half the screen with the sheet raised (405 px), so the full card;
  // the short plate the compact card is for comes with the section open under the model as well
  await A.tapEl('#grip'); await scene(A, 'sheet at its first stop', false);
  await A.tapEl('#grip'); await scene(A, 'sheet at its second stop', false);
  await A.tapEl('#btn-section'); await scene(A, 'the section open, the sheet at its second stop', true);
  await A.shot('card-sheet', false);
  // every well the list offers, chosen there at the first stop with the section open: its head and its
  // name clear of the card
  await A.tapEl('#grip'); await A.tapEl('#grip'); await A.page.waitForTimeout(400); await A.frame();
  const names = await A.w(() => [...document.getElementById('well-pick').options].map((o) => o.value).filter(Boolean));
  const wells = [];
  for (const name of names) {
    await A.w((n) => { const s = document.getElementById('well-pick'); s.value = n; s.dispatchEvent(new Event('change')); }, name);
    await A.frame(); await A.frame();
    const r = await A.w((n) => {
      const pr = document.getElementById('plate').getBoundingClientRect(), c = document.getElementById('readout').getBoundingClientRect();
      const head = window.__norne.wellScreen(n), lab = [...document.querySelectorAll('#labels .wl')].find((e) => e.textContent === n);
      const on = head && head[0] >= 0 && head[1] >= 0 && head[0] <= pr.width && head[1] <= pr.height;
      const C = { l: c.left - pr.left, t: c.top - pr.top, r: c.right - pr.left, b: c.bottom - pr.top }, over = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      const L = lab && lab.style.display !== 'none' ? lab.getBoundingClientRect() : null;
      const keys = [...document.querySelectorAll('#keys button')].map((e) => e.getBoundingClientRect()).map((k) => ({ l: k.left - pr.left, t: k.top - pr.top, r: k.right - pr.left, b: k.bottom - pr.top }));
      return { name: n, open: !document.getElementById('readout').hidden, on, overHead: on && over(C, { l: head[0] - 9, t: head[1] - 9, r: head[0] + 9, b: head[1] + 9 }), name_: !!L, overName: !!L && over(C, { l: L.left - pr.left, t: L.top - pr.top, r: L.right - pr.left, b: L.bottom - pr.top }), overKeys: keys.some((k) => over(C, k)), compact: document.getElementById('readout').classList.contains('compact') };
    }, name);
    wells.push(r);
  }
  const wbad = wells.filter((r) => !r.open || r.overHead || (r.on && (!r.name_ || r.overName)) || r.overKeys || !r.compact);
  check(wells.length > 20 && wbad.length === 0, `every well the list offers, chosen there at the first stop (${wells.length}; ${wells.filter((r) => r.on).length} with the head on the plate): the compact card clear of the head, its drawn name and every key${wbad.length ? ': ' + wbad.map((r) => `${r.name}${r.overHead ? ' over the head' : ''}${r.on && !r.name_ ? ' name hidden' : ''}${r.overName ? ' over the name' : ''}${r.overKeys ? ' over a key' : ''}${r.compact ? '' : ' full'}`).join(', ') : ''}`);
  // a cell's compact card: its own hits, Close and Zoom included, at 44 x 44 or more
  await A.tapEl('#readout-close'); await A.frame();
  {
    const pr = await A.rect('#plate');
    const pt = await A.w(([W, H]) => { for (let y = Math.round(H / 2); y < H - 20; y += 6) for (let x = Math.round(W / 2); x < W - 40; x += 6) if (window.__norne.pick(x, y) >= 0 && window.__norne.resolveTap(x, y).cell !== undefined) return [x, y]; return null; }, [Math.round(pr.width), Math.round(pr.height)]);
    await A.tapAt(pr.left + pt[0], pr.top + pt[1]); await A.page.waitForTimeout(400); await A.frame();
    const hc = await hitTargets(A.w);
    const inCard = await A.w(() => ['readout-close', 'readout-zoom'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)}`; }));
    check(hc.bad.length === 0, `hit targets with the compact card open: ${hc.n} controls at 44 × 44 or more, Close ${inCard[0]} and Zoom ${inCard[1]}${hc.bad.length ? ': ' + hc.bad.join('; ') : ''}`);
  }
  // a step with the card open: it stays where it is (the figure changes in place)
  {
    const before = await A.w(() => document.getElementById('readout').getBoundingClientRect().toJSON());
    await A.tapEl('#btn-next'); await A.frame(); await A.frame();
    const after = await A.w(() => document.getElementById('readout').getBoundingClientRect().toJSON());
    check(Math.round(before.top) === Math.round(after.top) && Math.round(before.left) === Math.round(after.left), `a step with the card open leaves it in place (top ${Math.round(before.top)} then ${Math.round(after.top)}, left ${Math.round(before.left)} then ${Math.round(after.left)})`);
    await A.tapEl('#readout-close'); await A.frame();
  }
  // a card carried across the stops: tapped with the sheet closed, then the sheet raised and lowered
  {
    await A.tapEl('#grip'); await A.tapEl('#grip'); await A.page.waitForTimeout(400); await A.frame();   // the first stop to the second, then closed
    const pr = await A.rect('#plate');
    const pt = await A.w(([W, H]) => { for (let y = Math.round(H / 2); y < H - 20; y += 6) for (let x = 40; x < W - 80; x += 6) if (window.__norne.pick(x, y) >= 0 && window.__norne.resolveTap(x, y).cell !== undefined) return [x, y]; return null; }, [Math.round(pr.width), Math.round(pr.height)]);
    await A.tapAt(pr.left + pt[0], pr.top + pt[1]); await A.page.waitForTimeout(400); await A.frame();
    const seen = [];
    for (const stop of [0, 1, 2]) {
      if (stop) { await A.tapEl('#grip'); await A.page.waitForTimeout(500); await A.frame(); await A.frame(); }
      const r = await A.w(() => {
        const pr = document.getElementById('plate').getBoundingClientRect(), card = document.getElementById('readout'), c = card.getBoundingClientRect(), pm = document.querySelector('.pickmark');
        const ring = pm.style.display !== 'none' && pm.style.transform ? pm.getBoundingClientRect() : null, over = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const keys = [...document.querySelectorAll('#keys button')].map((e) => e.getBoundingClientRect());
        return { open: !card.hidden, compact: card.classList.contains('compact'), ring: !!ring, overRing: !!ring && over(c, ring), overKeys: keys.some((k) => over(c, k)), inside: c.top >= pr.top - 0.5 && c.bottom <= pr.bottom + 0.5, h: Math.round(pr.height) };
      });
      seen.push(r);
    }
    // the raised stops give the compact form; closed, the form the plate's room calls for (2.3: with the
    // sweep row the section's compact pane is 44 px taller, and a 343 px plate takes the compact form too)
    check(seen.every((r, i) => r.open && r.ring && !r.overRing && !r.overKeys && r.inside && (i === 0 || r.compact)), `a card carried across the stops is placed again at each: ${seen.map((r, i) => `stop ${i} (plate ${r.h} px) ${r.compact ? 'compact' : 'full'}${r.ring && !r.overRing ? ', ring clear' : ', RING COVERED'}${r.overKeys ? ', OVER A KEY' : ''}${r.inside ? '' : ', PAST THE PLATE'}`).join('; ')}`);
    await A.shot('card-carried', false);
    await A.tapEl('#readout-close'); await A.tapEl('#grip'); await A.page.waitForTimeout(400);
  }
  // focus mode: the plate is tall again, the full card, clear of the ghost key
  await A.tapEl('#focus-key'); await A.page.waitForTimeout(500);
  await scene(A, 'focus mode', false);
  await A.tapEl('#focus-exit'); await A.page.waitForTimeout(300);
  check(A.errors.length === 0, `no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
  // a phone on its side: the sheet closed (its grip strip), raised (a column), and focus mode
  const B = await open('dark', { w: 844, h: 390 });
  await B.w(() => window.__norne.setFrame(60)); await B.frame();
  await scene(B, 'on its side, the sheet closed', true);
  await B.tapEl('#grip'); await scene(B, 'on its side, the sheet raised', true);
  await B.shot('card-side', false);
  await B.tapEl('#grip'); await B.tapEl('#grip'); await B.page.waitForTimeout(400);
  await B.tapEl('#focus-key'); await B.page.waitForTimeout(500);
  await scene(B, 'on its side, focus mode', true);
  check(B.errors.length === 0, `on its side: no console error${B.errors.length ? ': ' + B.errors.join(' | ') : ''}`);
  await B.ctx.close();
}

// the compass turns with the model (plan 0012 D17): one-finger turns and tilts, the N where north projects
// each time and the needle never under half its length, then Show the whole field
{
  console.log('\n== the compass turns with the model');
  const A = await open('dark');
  const pr = await A.rect('#plate');
  const drag = async (dx, dy) => {
    const x = pr.left + pr.width * 0.45, y = pr.top + pr.height * 0.62;
    await A.touch('touchStart', x, y);
    for (let i = 1; i <= 10; i++) { await A.touch('touchMove', x + (dx * i) / 10, y + (dy * i) / 10); await new Promise((r) => setTimeout(r, 16)); }
    await A.touch('touchEnd'); await A.page.waitForTimeout(200); await A.frame(); await A.frame();
  };
  const seen = [await compassCheck(A, 'dark, at rest')];
  for (const [dx, dy, what] of [[90, 0, 'turned'], [110, 0, 'turned further'], [0, 140, 'tilted'], [0, -300, 'tilted the other way'], [-160, 0, 'turned back']]) {
    await drag(dx, dy); seen.push(await compassCheck(A, `dark, ${what}`));
    if (what === 'tilted the other way') await A.shot('compass-tilted-dark', false);
  }
  const angles = seen.map((k) => k.got), lens = seen.map((k) => k.len);
  check(new Set(angles.map((a) => Math.round(a / 15))).size >= 3 && Math.max(...lens) - Math.min(...lens) > 0.5,
    `the needle turned with the model (N at ${angles.join('°, ')}°) and shortened as north leaned into the view (${lens.join(', ')} px a side; 8.5 at most, 4.25 at least)`);
  await A.tapEl('#fit'); await A.page.waitForTimeout(1200); await A.frame();
  await compassCheck(A, 'dark, the whole field again');
  check(A.errors.length === 0, `the compass turning: no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
}

// plan 0012, package 3.4: the view's share of the screen at each sheet stop (the owner: "when expanding
// the bottom section, the 3d view becomes too small"; 200 px of 844 before), the grip in reach while the
// sheet scrolls, and the stamp's line one line in every state the app writes into it (HOUSE 7.2, F8)
{
  console.log('\n== the view at each stop, the stamp');
  const A = await open('light');
  const { w } = A;
  const size = () => w(() => { const h = (id) => { const e = document.getElementById(id); return e.hidden ? 0 : e.getBoundingClientRect().height; }; return { plate: h('plate'), section: h('section'), sheet: h('sheet') }; });
  const rows = [];
  for (const sec of [false, true]) {
    if (sec) { await A.tapEl('#btn-section'); await A.page.waitForTimeout(500); await A.frame(); }
    for (let s = 0; s < 3; s++) {
      await A.frame(); await A.page.waitForTimeout(300);
      rows.push({ sec, s, ...(await size()), at: await w(() => { const s = document.getElementById('sheet'), g = document.getElementById('grip').getBoundingClientRect(), h = document.querySelector('.stop2 .sheet-head').getBoundingClientRect(); return { top: s.scrollTop, head: Math.round(h.top - g.bottom), shows: h.bottom <= s.getBoundingClientRect().bottom && h.height > 0 }; }) });
      await A.tapEl('#grip'); await A.page.waitForTimeout(300);
    }
  }
  const H = 844, share = (r) => (r.plate + r.section) / H;
  const say = (r) => `${r.sec ? 'with the section' : 'the model alone'}, stop ${r.s}: ${Math.round(r.plate)}${r.sec ? ` + ${Math.round(r.section)}` : ''} px (${Math.round(share(r) * 100)} %), the sheet ${Math.round(r.sheet)}`;
  check(rows.every((r) => share(r) >= 0.47 && r.plate >= 220 && (r.s === 0 || r.sheet >= 175)),
    `the view keeps about half the screen at every stop (at least 47 %, the model at least 220 px; the raised sheet at least 175 px, scrolling inside itself): ${rows.map(say).join('; ')}`);
  const st2 = rows.filter((r) => r.s === 2), st1 = rows.filter((r) => r.s === 1);
  check(st2.every((r) => r.at.shows && Math.abs(r.at.head) <= 2) && st1.every((r) => r.at.top === 0),
    `the second stop shows what it adds: the sheet scrolls "Cells and view" up under the grip (${st2.map((r) => `${r.at.head} px below it, scrolled ${Math.round(r.at.top)} px`).join('; ')}); the first stop opens at the sheet's top (${st1.map((r) => r.at.top).join(', ')})`);
  await A.tapEl('#btn-section'); await A.page.waitForTimeout(300);
  await A.tapEl('#grip'); await A.tapEl('#grip'); await A.page.waitForTimeout(300);
  const grip = await w(() => { const s = document.getElementById('sheet'); s.scrollTop = s.scrollHeight; return new Promise((res) => requestAnimationFrame(() => { const g = document.getElementById('grip').getBoundingClientRect(), r = s.getBoundingClientRect(); res([Math.round(g.top - r.top), s.scrollTop > 0, document.elementFromPoint(g.left + g.width / 2, g.top + 22) === document.getElementById('grip') || document.getElementById('grip').contains(document.elementFromPoint(g.left + g.width / 2, g.top + 22))]); })); });
  check(grip[1] && Math.abs(grip[0] - 1) <= 1 && grip[2], `the grip stays at the sheet's top while the sheet scrolls (${grip[0]} px from its top edge, reachable ${grip[2]})`);
  await A.tapEl('#grip'); await A.page.waitForTimeout(300);
  const stamps = await w(() => {
    const home = document.getElementById('stamp-home'), st = document.getElementById('stamp'), was = [home.hidden, st.textContent], out = [];
    home.hidden = false;
    for (const t of ['Reading the model… 1 of 7', 'Reading the model… 6 of 7', 'The model could not be read.']) { st.textContent = t; out.push([t, st.getBoundingClientRect().height]); }
    home.hidden = was[0]; st.textContent = was[1];
    return out;
  });
  check(stamps.every(([, h]) => Math.abs(h - 16) <= 1), `the stamp's line is one line, 16 px, in every state the app writes into it: ${stamps.map(([t, h]) => `"${t}" ${h} px`).join(', ')}`);
  check(A.errors.length === 0, `no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
}

// the section A–A′ (plan 0012, package 3.4; D4, D11): opened by touch, the field's own line, its cells in
// the 3D view's colors for the shown property and month as this file decodes them, sharp while scrubbed,
// a tap opening the cell's card, a line drawn and an end moved by touch, the orbit still one finger,
// gaps hatched, the units, the stretch, hidden, remembered, in focus mode
{
  console.log('\n== the section');
  /** config.json's scale as app.js's lut() builds it, and a value's color on it, from this file's decode. */
  const lutOf = (name, dark) => {
    const st = ((dark && cfg.colormapsDark[name]) || cfg.colormaps[name]).map(hexRgb), out = [];
    for (let i = 0; i < 256; i++) { const t = (i / 255) * (st.length - 1), k = Math.min(Math.floor(t), st.length - 2), f = t - k; out.push([0, 1, 2].map((c) => Math.round(st[k][c] * (1 - f) + st[k + 1][c] * f))); }
    return out;
  };
  const colorOf = (key, f, a, dark) => {
    const p = cfg.properties.find((q) => q.key === key), v = own[key](f, a), r = p.range;
    const t = Math.max(0, Math.min(1, (v - r[0]) / (r[1] - r[0])));
    return lutOf(p.colormap, dark)[Math.round(t * 255)];
  };
  /** The pane's pixels at the middle of its widest cells, against this file's colors for them. */
  const colorCheck = async (A, key, f, dark) => {
    const pick = await A.w(() => {
      const q = window.__norne.section();
      return q.cells.map((a) => [a, window.__norne.secCellBox(a)]).filter(([, b]) => b && b[2] - b[0] >= 4 && b[3] - b[1] >= 3).sort((p, r) => (r[1][2] - r[1][0]) * (r[1][3] - r[1][1]) - (p[1][2] - p[1][0]) * (p[1][3] - p[1][1])).slice(0, 30)
        .map(([a, b]) => [a, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2]).filter(([a, x, y]) => window.__norne.secCellAt(x, y) === a);
    });
    const px = await A.w((pts) => { const c = document.getElementById('sec-plot'), k = c.width / c.clientWidth, cp = document.createElement('canvas'); cp.width = c.width; cp.height = c.height; const x = cp.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; return pts.map(([, X, Y]) => { const i = (Math.round(Y * k) * c.width + Math.round(X * k)) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; }); }, pick);
    let good = 0; const bad = [];
    pick.forEach(([a], i) => { const want = colorOf(key, f, a, dark), got = px[i]; if (want.every((v, c) => Math.abs(v - got[c]) <= 3)) good++; else bad.push(`cell ${a} ${got.slice(0, 3)} want ${want}`); });
    return { n: pick.length, good, bad };
  };
  const A = await open('light');
  const { w, page } = A;
  await setFrame(A, 60);
  const p0 = await A.rect('#plate');
  await A.tapEl('#btn-section'); await page.waitForTimeout(500); await A.frame(); await A.frame();
  const q = await w(() => window.__norne.section());
  const st0 = await w(() => ({ pressed: document.getElementById('btn-section').getAttribute('aria-pressed'), pane: !document.getElementById('section').hidden, line: getComputedStyle(document.getElementById('secline')).display, along: document.querySelector('#sec-lines [data-line="along"]').getAttribute('aria-checked'), live: document.getElementById('live').textContent, label: document.getElementById('sec-plot').getAttribute('aria-label') }));
  const p1 = await A.rect('#plate'), plot = await A.rect('#sec-plot');
  const ends = q.ends || [];
  check(st0.pressed === 'true' && st0.pane && st0.line !== 'none' && st0.along === 'true' && q.on && q.line === 'along' && q.n > 1000 && q.step === 60
    && ends.length === 2 && ends.every((e) => e[0] >= 0 && e[0] <= p1.width && e[1] >= 0 && e[1] <= p1.height) && p1.height < p0.height,
  `the Section key opens the section under the model: Along, ${Math.round(q.L)} m, ${q.n} cells cut, drawn for report date ${q.step}; the line on the model with A at (${ends.map((e) => e.map(Math.round).join(', ')).join(') and A′ at (')}); the model ${Math.round(p0.height)} then ${Math.round(p1.height)} px; the plot ${Math.round(plot.width)} × ${Math.round(plot.height)} px`);
  check(/^Section A to A prime, along the field, 8\.\d\d km long, \d+ cells cut, from 2 ?\d{3} meters to 2 ?\d{3} meters deep, colored by Oil saturation, depth stretched 5 times\. Wells within 150 meters: /.test(st0.label.replace(/2(\d{3})/g, '2$1')), `its description: "${st0.label}"`);
  const ax = q.ax;
  check(Math.abs(ax.sz / ax.sx - 5) < 1e-9 && ax.y1 <= plot.height + 0.5 && ax.x1 <= plot.width + 0.5, `one depth axis, stretched as the 3D view is: ${(ax.sx * 1000).toFixed(1)} px a kilometer across, ${(ax.sz * 1000).toFixed(1)} down (×${(ax.sz / ax.sx).toFixed(2)}); the section ${Math.round(ax.x1 - ax.x0)} × ${Math.round(ax.y1 - ax.y0)} px inside the plot`);
  // the colors: the 3D view's property and month, as this file decodes the cells; checked on Across, the
  // shorter line, whose cells are drawn wider and taller, so their middles are clear of edges and lines;
  // in the pane made tall (End on its edge), since 2.3's sweep row took 44 px of the compact plot
  await A.tapEl('#sec-lines [data-line="across"]');
  await w(() => document.getElementById('sec-edge').focus()); await page.keyboard.press('End');
  await A.frame(); await A.frame();
  for (const [key, f, tab] of [['SOIL', 60, null], ['SOIL', 100, null], ['PRESSURE', 100, 4], ['SWAT', 20, 2]]) {
    if (tab) { await A.tapEl(`#props [role="radio"]:nth-child(${tab})`); await A.frame(); await A.frame(); }
    await setFrame(A, f); await A.frame();
    const c = await colorCheck(A, key, f, false), step = (await w(() => window.__norne.section())).step;
    check(c.n >= 20 && c.good >= c.n - 1 && step === f, `${key} on ${model.frames[f]}${tab ? ' (by its word)' : ''}, Across: the middles of the ${c.n} widest cells in the section are this file's colors for them in ${c.good} (within 3 of 255 a channel; the section drew date ${step})${c.bad.length ? ': ' + c.bad.slice(0, 3).join('; ') : ''}`);
  }
  await page.getByRole('radio', { name: 'Oil', exact: true }).click(); await A.frame();
  await w(() => document.getElementById('sec-edge').focus()); await page.keyboard.press('Home'); await w(() => document.activeElement.blur());
  await A.tapEl('#sec-lines [data-line="along"]'); await A.frame(); await A.frame();
  // sharp while scrubbed: every frame that drew a new date drew the section for that date
  for (const [rate, from, to] of [[8, 20, 60], [20, 5, 105]]) {
    await setFrame(A, from);
    const tr = await A.rect('#slider'), y = tr.top + tr.height / 2;
    await w(() => window.__norne.log(true));
    await A.touch('touchStart', trackX(tr, from), y);
    const t0 = Date.now(), dur = ((to - from) / rate) * 1000;
    for (;;) { const t = Math.min(dur, Date.now() - t0); await A.touch('touchMove', trackX(tr, from + ((to - from) * t) / dur), y); if (t >= dur) break; await new Promise((r) => setTimeout(r, 16)); }
    await A.touch('touchEnd'); await A.frame(); await A.frame();
    const log = await w(() => window.__norne.log(false));
    const bad = log.filter((e) => e.sec !== e.shown || e.tex !== e.shown);
    check(log.length > 5 && bad.length === 0 && log[log.length - 1].shown === to, `scrub at ${rate} dates a second with the section open: ${log.length} frames drew a new date, ${bad.length} whose section or texture is another date's; the last draws ${log[log.length - 1].shown}`);
  }
  const ms = await ST8(A);
  console.log(`      the section: ${ms.secDraws} draws at ${(ms.secMs / ms.secDraws).toFixed(1)} ms each, ${ms.secCuts} cuts at ${(ms.secCutMs / ms.secCuts).toFixed(1)} ms (headless SwiftShader on this Mac: a trend, never phone evidence)`);
  // a tap on a cell in the section opens that cell's card
  {
    await setFrame(A, 60);
    const pt = await w(() => { const q = window.__norne.section(); const a = q.cells[Math.floor(q.cells.length / 2)]; return [a, ...window.__norne.secCellPoint(a)]; });
    const pr = await A.rect('#sec-plot');
    await A.tapAt(pr.left + pt[1], pr.top + pt[2]); await page.waitForTimeout(400); await A.frame();
    const at = await w(([x, y]) => window.__norne.secCellAt(x, y), [pt[1], pt[2]]);
    const card = await w(() => [document.getElementById('readout').hidden, document.getElementById('readout-where').textContent, document.getElementById('readout-number').textContent]);
    const ijk = [IJK[at * 3] + 1, IJK[at * 3 + 1] + 1, IJK[at * 3 + 2] + 1];
    check(!card[0] && card[1].startsWith(`Cell I ${ijk[0]}, J ${ijk[1]}, K ${ijk[2]}, `) && card[2] === own.SOIL(60, at).toFixed(2), `a tap on a cell in the section opens its card: "${card[1]}", ${card[2]} (this file: ${own.SOIL(60, at).toFixed(2)})`);
    await A.shot(`section-cell-light`, false);
    await A.tapEl('#readout-close'); await A.frame();
  }
  // a line drawn by touch: Draw, then one finger across the field; the camera holds still. First the
  // mapping: points on the drawn line (it lies on the field's top) map back to where they are on the map
  {
    const cam0 = await w(() => window.__norne.cam());
    const pr = await A.rect('#plate');
    const back = await w(() => {
      const q = window.__norne.section(), d = document.getElementById('sl-line').getAttribute('d');
      const pts = d.slice(1).split('L').map((t) => t.trim().split(/\s+/).map(Number)), out = [];
      for (let k = 8; k <= 56; k += 4) {
        const m = [q.a[0] + (q.b[0] - q.a[0]) * k / 64, q.a[1] + (q.b[1] - q.a[1]) * k / 64], hit = window.__norne.mapPoint(pts[k][0], pts[k][1]);
        if (Number.isNaN(window.__norne.topAt(m))) continue;   // where the line crosses a gap in the field
        out.push({ k, s: pts[k], err: hit ? Math.hypot(hit[0] - m[0], hit[1] - m[1]) : Infinity });
      }
      return out;
    });
    const seen = await w(() => {
      const c = document.getElementById('gl'), W = c.clientWidth, H = c.clientHeight, N = window.__norne, out = [];
      for (let y = H * 0.1; y < H * 0.95; y += H / 22) for (let x = 12; x < W - 60; x += (W - 72) / 18) {
        const a = N.pick(x, y); if (a < 0) continue;
        const hit = N.mapPoint(x, y), m = N.cellXY(a);
        out.push(hit ? Math.hypot(hit[0] - m[0], hit[1] - m[1]) : 1e9);
      }
      return out;
    });
    const near = seen.filter((d) => d <= 150).length;
    // 0.95 since 2.3 (0.97 before): the plate with the section open is 44 px shorter, and its samples land on
    // two more of the field's walls, where a finger meets the top behind the wall (mapPoint is unchanged)
    check(seen.length > 40 && near >= seen.length * 0.95, `the finger meets the cell it sees: at ${seen.length} points on the model, the point a touch maps to lies within 150 m of the middle of the cell drawn there in ${near} (cells are up to 160 m across; the farthest ${Math.round(Math.max(...seen))} m)`);
    const good = back.filter((b) => b.err <= 5);
    check(good.length >= 2, `points on the line where it lies on the field and shows map back to where they lie: ${good.length} of ${back.length} within 5 m (a nearer ridge hides the others: ${back.filter((b) => b.err > 5).map((b) => Math.round(b.err) + ' m').join(', ') || 'none'})`);
    const P0 = good[0].s, Q0 = good[good.length - 1].s, P = [pr.left + P0[0], pr.top + P0[1]], Q = [pr.left + Q0[0], pr.top + Q0[1]];
    await A.tapEl('#sec-draw'); await A.frame();
    const armed = await w(() => [document.getElementById('sec-draw').getAttribute('aria-pressed'), document.getElementById('live').textContent]);
    await A.touch('touchStart', P[0], P[1]);
    for (let i = 1; i <= 12; i++) { await A.touch('touchMove', P[0] + ((Q[0] - P[0]) * i) / 12, P[1] + ((Q[1] - P[1]) * i) / 12); await new Promise((r) => setTimeout(r, 16)); }
    // where the line lies under the finger is read before the lift: once the finger is off, the pane
    // fits the new section and the model's plate changes height with it
    await A.frame();
    const d0 = await w(() => window.__norne.section());
    const sa = await w((p) => window.__norne.mapScreen(p), d0.a), sb = await w((p) => window.__norne.mapScreen(p), d0.b);
    await A.touch('touchEnd'); await page.waitForTimeout(300); await A.frame(); await A.frame();
    const d = await w(() => window.__norne.section()), cam1 = await w(() => window.__norne.cam());
    check(d.a.join() === d0.a.join() && d.b.join() === d0.b.join(), `the lift keeps the line as drawn (${d.a.join(', ')} to ${d.b.join(', ')})`);
    await A.frame(); await A.frame();
    const fit1 = await w(() => window.__norne.secFit());
    check(!fit1.lock && fit1.set === fit1.need, `after the line is drawn the pane fits its section again: the plot set to ${fit1.set} px, the section needs ${fit1.need} px (shown ${fit1.h} px under --sec-h)`);
    const after = await w(() => [document.getElementById('sec-draw').getAttribute('aria-pressed'), [...document.querySelectorAll('#sec-lines [role="radio"]')].map((b) => b.getAttribute('aria-checked')).join('/'), document.getElementById('live').textContent]);
    const off = (s, p) => Math.hypot(s[0] + pr.left - p[0], s[1] + pr.top - p[1]);
    check(armed[0] === 'true' && armed[1] === 'Drag across the field to draw the section line.' && d.line === null && off(sa, P) <= 2 && off(sb, Q) <= 2 && d.n > 50 && after[0] === 'false' && after[1] === 'false/false' && cam1.theta === cam0.theta && cam1.phi === cam0.phi && /^Section drawn, on your line, [\d.]+ (km|m) long\.$/.test(after[2]),
      `Draw, then a drag across the field draws the line under the finger: A ${off(sa, P).toFixed(2)} px and A′ ${off(sb, Q).toFixed(2)} px from the touch, ${Math.round(d.L)} m, ${d.n} cells; the camera held still; Draw off again, neither line word chosen; "${after[2]}"`);
    await A.shot('section-drawn-light', false);
    // A′ moved by its handle; A stays
    const mid = await w(() => { const p = document.getElementById('sl-line').getAttribute('d').slice(1).split('L')[24].trim().split(/\s+/).map(Number); return p; });
    const e = d.ends[1], R2 = [pr.left + mid[0], pr.top + mid[1]];
    await A.touch('touchStart', pr.left + e[0], pr.top + e[1]);
    for (let i = 1; i <= 8; i++) { await A.touch('touchMove', pr.left + e[0] + ((R2[0] - pr.left - e[0]) * i) / 8, pr.top + e[1] + ((R2[1] - pr.top - e[1]) * i) / 8); await new Promise((r) => setTimeout(r, 16)); }
    await A.frame();
    const d2p = await w(() => window.__norne.section()), sb2 = await w((p) => window.__norne.mapScreen(p), d2p.b);
    await A.touch('touchEnd'); await A.frame(); await A.frame(); await A.frame();
    const d2 = await w(() => window.__norne.section()), cam2 = await w(() => window.__norne.cam()), fit2 = await w(() => window.__norne.secFit());
    check(d2.a.join() === d.a.join() && d2.b.join() === d2p.b.join() && off(sb2, R2) <= 2 && cam2.theta === cam0.theta && !fit2.lock && fit2.set === fit2.need, `a drag on A′ moves that end under the finger (${off(sb2, R2).toFixed(2)} px off) and leaves A where it was; the camera held still; after the lift the pane fits again (${fit2.set} of ${fit2.need} px)`);
    // two fingers while drawing: back to the view, the line as it was
    // (both fingers on the plate as it is now: the pane fitted to the new line takes up to its cap, and the
    // edge's hit reaches 22 px over the plate's foot)
    await A.tapEl('#sec-draw');
    const pn = await A.rect('#plate'), F = [pn.left + pn.width / 2 - 80, pn.top + pn.height / 2 - 50];
    await A.touch('touchStart', F[0], F[1]); await A.touch('touchMove', F[0] + 40, F[1] + 10);
    await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: F[0] + 40, y: F[1] + 10, id: 0 }, { x: F[0] + 120, y: F[1] + 70, id: 1 }] });
    await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: F[0] + 30, y: F[1], id: 0 }, { x: F[0] + 150, y: F[1] + 90, id: 1 }] });
    await A.touch('touchEnd'); await A.frame(); await A.frame();
    const d3 = await w(() => window.__norne.section());
    check(d3.a.join() === d2.a.join() && d3.b.join() === d2.b.join(), `a second finger while drawing gives the touch back to the view, and the line is as it was (${d3.a.join(', ')} to ${d3.b.join(', ')})`);
    // a line drawn off the field cuts nothing: refused, the line it had kept, and said so
    {
      if ((await w(() => document.getElementById('sec-draw').getAttribute('aria-pressed'))) !== 'true') await A.tapEl('#sec-draw');
      const y0 = pr.top + 12, x0 = pr.left + 30, x1 = pr.left + pr.width - 90;
      const miss = await w(([a, b, y]) => [window.__norne.mapPoint(a, y), window.__norne.mapPoint(b, y)], [x0 - pr.left, x1 - pr.left, y0 - pr.top]);
      await A.touch('touchStart', x0, y0);
      for (let i = 1; i <= 10; i++) { await A.touch('touchMove', x0 + ((x1 - x0) * i) / 10, y0); await new Promise((r) => setTimeout(r, 16)); }
      await A.frame(); await A.shot('section-offfield-light', false);
      const mid = await w(() => [window.__norne.section().n, document.getElementById('sec-plot').getAttribute('aria-label')]);
      await A.touch('touchEnd'); await A.frame(); await A.frame();
      const q = await w(() => [window.__norne.section(), document.getElementById('live').textContent]);
      check(mid[0] === 0 && /the line misses the field, so no cell is cut\.$/.test(mid[1]) && q[0].a.join() === d3.a.join() && q[0].b.join() === d3.b.join() && q[0].n > 50 && q[1] === 'That line misses the field.',
        `a line drawn above the model (${miss.map((m) => (m ? m.slice(0, 2).map(Math.round).join(', ') : 'nothing')).join(' to ')}) cuts no cell while drawn ("${mid[1].slice(0, 60)}…") and is refused on the lift: the line as it was (${q[0].n} cells), "${q[1]}"`);
    }
    await A.tapEl('#sec-draw'); await A.frame();   // off again, if the two fingers left it armed
    if ((await w(() => document.getElementById('sec-draw').getAttribute('aria-pressed'))) === 'true') await A.tapEl('#sec-draw');
    // with the section open and Draw off, one finger still turns the model (on the plate as it is now)
    const pt = await A.rect('#plate');
    await A.touch('touchStart', pt.left + 200, pt.top + pt.height * 0.7);
    for (let i = 1; i <= 6; i++) await A.touch('touchMove', pt.left + 200 + i * 10, pt.top + pt.height * 0.7);
    await A.touch('touchEnd'); await A.frame();
    const cam4 = await w(() => window.__norne.cam()), d4 = await w(() => window.__norne.section());
    check(cam4.theta !== cam0.theta && d4.a.join() === d3.a.join() && d4.b.join() === d3.b.join(), `with Draw off, a one-finger drag on the model turns it (theta ${Math.round(cam0.theta)} then ${Math.round(cam4.theta)}) and leaves the line alone`);
    await A.tapEl('#fit'); await page.waitForTimeout(700);
  }
  // Across, and Along again, by their words
  {
    await A.tapEl('#sec-lines [data-line="across"]'); await A.frame(); await A.frame();
    const c = await w(() => window.__norne.section());
    await A.tapEl('#sec-lines [data-line="along"]'); await A.frame(); await A.frame();
    const l = await w(() => window.__norne.section());
    const dot = Math.abs(((c.b[0] - c.a[0]) * (l.b[0] - l.a[0]) + (c.b[1] - c.a[1]) * (l.b[1] - l.a[1])) / (c.L * l.L));
    check(c.line === 'across' && l.line === 'along' && dot < 0.02 && c.L < l.L && c.n > 300, `Across: ${Math.round(c.L)} m, ${c.n} cells, square to Along (|cos| ${dot.toFixed(3)}); Along again: ${Math.round(l.L)} m`);
  }
  // the units and the stretch
  {
    await A.tapEl('#btn-units'); await A.frame(); await A.frame();
    const us = await w(() => [document.getElementById('sec-corridor').textContent, document.getElementById('sec-plot').getAttribute('aria-label')]);
    await A.tapEl('#btn-units'); await A.frame();
    await w(() => { const e = document.getElementById('exag'); e.value = '10'; e.dispatchEvent(new Event('input')); });
    await A.frame(); await A.frame();
    const ex = await w(() => [document.getElementById('sec-exag').textContent, window.__norne.section().ax]);
    await w(() => { const e = document.getElementById('exag'); e.value = '5'; e.dispatchEvent(new Event('input')); });
    await A.frame();
    check(us[0] === `Wells within 492${NN}ft` && /feet deep/.test(us[1]) && ex[0] === 'vertical ×10' && Math.abs(ex[1].sz / ex[1].sx - 10) < 1e-9,
      `US units: "${us[0]}", depths in feet in its description; at a stretch of 10 the pane says "${ex[0]}" and draws ×${(ex[1].sz / ex[1].sx).toFixed(2)}`);
  }
  // SI and the contrast with the pane open, and its controls' hits
  {
    const si = await siOf(w), c = await contrastOf(w), h = await hitTargets(w);
    check(si.bad.length === 0 && c.worst[0] >= 4.5 && h.bad.length === 0, `with the section open: SI in ${si.n} text nodes${si.bad.length ? ': ' + si.bad.join(' | ') : ''}; text contrast worst ${c.worst[0]}:1 (${c.worst[1]}); ${h.n} controls at 44 × 44 or more${h.bad.length ? ': ' + h.bad.join('; ') : ''}`);
  }
  await setFrame(A, 80);
  {
    const q = await w(() => [window.__norne.section(), document.getElementById('sec-more').textContent]);
    check(q[0].named.length > 0 && q[0].unnamed.every((n) => q[1].includes(n)) && (q[1] === '') === (q[0].unnamed.length === 0),
      `${q[0].line}: every well drawn on the section is named, on the pane (${q[0].named.join(', ')}) or in its key (${q[0].unnamed.join(', ') || 'none needed'}); within ${'150 m'}: ${q[0].wells.join(', ')}`);
  }
  await A.shot('section-light');
  // hidden: no section draws; and its key's ✕ hides it, the line with it
  {
    await w(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const h0 = await ST8(A); await page.waitForTimeout(500); const h1 = await ST8(A);
    await w(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await A.frame();
    check(h1.secDraws === h0.secDraws && h1.frames === h0.frames, `hidden, the section draws nothing (${h1.secDraws - h0.secDraws} draws in 500 ms)`);
    await A.tapEl('#sec-close'); await page.waitForTimeout(300); await A.frame();
    const off = await w(() => [document.getElementById('section').hidden, document.getElementById('secline').hasAttribute('hidden'), document.getElementById('btn-section').getAttribute('aria-pressed'), document.getElementById('plate').getBoundingClientRect().height]);
    check(off[0] && off[1] && off[2] === 'false' && Math.abs(off[3] - p0.height) < 1, `✕ hides the section and its line (the Section key not pressed); the model back to ${Math.round(off[3])} px`);
  }
  // remembered: open, reload, it is back with its line
  {
    await A.tapEl('#btn-section'); await A.tapEl('#sec-lines [data-line="across"]'); await page.waitForTimeout(600);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await A.frame(); await A.frame();
    const r = await w(() => window.__norne.section());
    check(r.on && r.line === 'across' && r.n > 300, `the section and its line are remembered over a reload (${r.line}, ${r.n} cells)`);
    // focus mode: the section stays under the model, its words and ✕ in reach; on Pressure (whose
    // interior ticks crowd its open end) the legend's labels stay apart once the About key joins its line
    await A.tapEl('#props button[data-key="PRESSURE"]'); await page.waitForTimeout(200);
    await A.tapEl('#focus-key'); await page.waitForTimeout(500);
    const lt = await w(() => { const sp = [...document.querySelectorAll('#legend-ticks span')].filter((e) => !e.hidden), r = sp.map((e) => e.getBoundingClientRect()); let gap = Infinity; for (let i = 1; i < r.length; i++) gap = Math.min(gap, r[i].left - r[i - 1].right); return { t: sp.map((e) => e.textContent), gap }; });
    check(lt.gap >= 5, `focus mode with the section open, on Pressure: the legend's labels ${lt.t.join(' | ')} stand ${lt.gap.toFixed(1)} px apart at the least`);
    const f = await w(() => [!document.getElementById('section').hidden, document.getElementById('section').getBoundingClientRect().height, window.__norne.focus()]);
    const hf = await hitTargets(w);
    await A.shot('section-focus-light', false);
    check(f[0] && f[1] > 100 && f[2] && hf.bad.length === 0, `in focus mode the section stays (${Math.round(f[1])} px), its controls at 44 × 44 or more (${hf.n})`);
    await A.tapEl('#focus-exit'); await page.waitForTimeout(400);
    await A.tapEl('#props button[data-key="SOIL"]'); await page.waitForTimeout(200);
  }
  // gaps: where the plane passes between active cells inside the model, a hatch, and its key
  {
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('norne-viewer:v1')); s.section = { on: true, line: null, a: [-3337, -2360], b: [663, -675] }; localStorage.setItem('norne-viewer:v1', JSON.stringify(s)); });
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await A.frame(); await A.frame(); await page.waitForTimeout(300);
    const g = await w(() => [window.__norne.section(), !document.getElementById('sec-key-gap').hidden]);
    check(g[0].gapPx / 4 >= 150 && g[1], `a line through inactive cells (${g[0].a.join(', ')} to ${g[0].b.join(', ')}): ${Math.round(g[0].gapPx / 4)} CSS px² of the cut hatched as no active cell, and the key says so`);
    await A.shot('section-gaps-light', false);
  }
  check(A.errors.length === 0, `no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
  // the dark theme: the print, the same colors as the 3D view's dark scales
  const B = await open('dark');
  await B.w(() => window.__norne.setFrame(80)); await B.frame();
  await B.tapEl('#btn-section'); await B.page.waitForTimeout(500); await B.frame(); await B.frame();
  await B.shot('section-dark');
  await B.tapEl('#sec-lines [data-line="across"]');
  await B.w(() => document.getElementById('sec-edge').focus()); await B.page.keyboard.press('End');
  await B.frame(); await B.frame();
  const cd = await colorCheck(B, 'SOIL', 80, true);
  check(cd.n >= 20 && cd.good >= cd.n - 1, `dark, Across: the middles of the ${cd.n} widest cells are this file's colors on the dark scale in ${cd.good}${cd.bad.length ? ': ' + cd.bad.slice(0, 3).join('; ') : ''}`);
  check(B.errors.length === 0, `dark: no console error${B.errors.length ? ': ' + B.errors.join(' | ') : ''}`);
  await B.ctx.close();
}

// 2.3 (plan 0012, package 3.4b; D13, D14): the pane's edge and the sweep. The sweep: the slider steps
// through the grid's own columns (Along) or rows (Across), each the slice's own cells along its path, the
// line moving on the model; ‹ › one at a time; a drawn line moved parallel to itself; a fast scrub by
// touch draws the slider's newest place in every frame, both canvases at their own size, the pane held
// until the lift. The edge: a drag by touch moves it under the finger with both canvases sharp in every
// frame; past tall the model keeps its 120 px strip, which still turns by one finger; a double tap
// toggles compact and tall; the keys step it; the size is remembered; on its side the side edge widens
// the pane and the key plates stand side by side; the pane taller than its section states its own stretch.
// A one-finger drag that starts on the model right next to A′ (8 px from it, toward A): on a strip, where the
// model is drawn small, it must turn the model and leave the line alone.
async function nearEndDrag(A, pr) {
  const q0 = await A.w(() => window.__norne.section()), b = q0.ends[1], a = q0.ends[0], L = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const p = [b[0] + ((a[0] - b[0]) * 8) / L, b[1] + ((a[1] - b[1]) * 8) / L], box = await A.w(() => window.__norne.modelBox());
  const t0 = (await A.w(() => window.__norne.cam())).theta;
  await A.touch('touchStart', pr.left + p[0], pr.top + p[1]);
  for (let i = 1; i <= 6; i++) await A.touch('touchMove', pr.left + p[0] + i * 12, pr.top + p[1]);
  await A.touch('touchEnd'); await A.frame(); await A.frame();
  const t1 = (await A.w(() => window.__norne.cam())).theta, q1 = await A.w(() => window.__norne.section());
  const same = q1.line === q0.line && q1.a.every((v, i) => v === q0.a[i]) && q1.b.every((v, i) => v === q0.b[i]);
  return { ok: same && t1 !== t0, same, t0, t1, line: q1.line, d: Math.hypot(p[0] - b[0], p[1] - b[1]), box: [Math.round(box[2] - box[0]), Math.round(box[3] - box[1])] };
}
{
  console.log('\n== the pane\'s edge and the sweep (2.3)');
  const A = await open('light');
  const { w, page } = A;
  await setFrame(A, 60);
  await A.tapEl('#btn-section'); await page.waitForTimeout(500); await A.frame();
  await A.tapEl('#sec-lines [data-line="across"]'); await A.frame(); await A.frame();
  const sweepState = () => w(() => { const q = window.__norne.section(), sw = document.getElementById('sec-sweep'); return { q, v: +sw.value, max: +sw.max, text: sw.getAttribute('aria-valuetext'), role: sw.type, shown: document.getElementById('sec-at').textContent, prev: document.getElementById('sec-prev').getAttribute('aria-label'), live: document.getElementById('live').textContent, d: document.getElementById('sl-line').getAttribute('d') }; });
  const ownSlice = (q, ax, k) => q.cells.filter((a) => IJK[a * 3 + (ax === 'I' ? 0 : 1)] + 1 !== k).length;
  // Across: the rows of the grid, the field's own line in its place among them
  {
    const s0 = await sweepState();
    const rows = new Set(); for (let a = 0; a < NA; a++) rows.add(IJK[a * 3 + 1] + 1);
    await A.tapEl('#sec-next'); await A.frame(); await A.frame();
    const s1 = await sweepState(), k1 = s1.q.at;
    await A.tapEl('#sec-next'); await A.frame(); await A.frame();
    const s2 = await sweepState();
    check(s0.role === 'range' && s0.q.at === null && s0.q.axis === 'J' && s0.max === rows.size && /^the field’s own line, between rows J \d+ and J \d+$/.test(s0.text) && s0.shown === 'Across'
      && s1.v === s0.v + 1 && s1.text === `row J ${k1}` && s1.shown === `J ${k1}` && ownSlice(s1.q, 'J', k1) === 0 && s1.q.n > 100 && s1.live === `Row J ${k1}.` && s1.d !== s0.d
      && s2.q.at === k1 + 1 && ownSlice(s2.q, 'J', k1 + 1) === 0 && s2.prev === 'Previous row',
    `Across sweeps the grid's rows: the slider (an input range, ${s0.max + 1} places: the ${rows.size} rows with a cell and the field's line, "${s0.text}"); › goes to "${s1.text}" (${s1.q.n} cells, every one in row J ${k1}; said "${s1.live}"), › again to J ${s2.q.at} (${s2.q.n} cells, all its own); the line on the model moved`);
    await A.shot('sweep-row-light', false);
  }
  // Along: the grid's columns
  {
    await A.tapEl('#sec-lines [data-line="along"]'); await A.frame(); await A.frame();
    const s0 = await sweepState();
    await A.tapEl('#sec-prev'); await A.frame(); await A.frame();
    const s1 = await sweepState();
    check(s0.q.axis === 'I' && s0.q.at === null && s1.q.at !== null && s1.text === `column I ${s1.q.at}` && ownSlice(s1.q, 'I', s1.q.at) === 0 && s1.q.n > 100 && s1.prev === 'Previous column',
      `Along sweeps the grid's columns: ‹ from the field's line ("${s0.text}") goes to "${s1.text}", ${s1.q.n} cells, every one in its column, ${Math.round(s1.q.L)} m along its path`);
  }
  // a fast scrub by touch on the slider: the newest place in every frame, both canvases at their size, the pane held
  {
    await A.tapEl('#sec-lines [data-line="across"]'); await A.frame(); await A.frame();
    const r = await A.rect('#sec-sweep'), y = r.top + r.height / 2;
    await w(() => window.__norne.secLog(true));
    await A.touch('touchStart', r.left + 7, y);
    for (let i = 1; i <= 30; i++) { await A.touch('touchMove', r.left + 7 + ((r.width - 14) * i) / 30, y); }
    for (let i = 29; i >= 10; i--) { await A.touch('touchMove', r.left + 7 + ((r.width - 14) * i) / 30, y); }
    const held = await w(() => window.__norne.secFit());
    await A.touch('touchEnd'); await A.frame(); await A.frame(); await A.frame();
    const log = await w(() => window.__norne.secLog(false)), fit = await w(() => window.__norne.secFit()), end = await sweepState();
    const stale = log.filter((e) => e.drew !== e.at), blur = log.filter((e) => e.plot[0] !== e.plot[1] || e.plot[2] !== e.plot[3] || e.gl[0] !== e.gl[1] || e.gl[2] !== e.gl[3]);
    const hs = new Set(log.slice(0, -3).map((e) => e.plot[3])), places = new Set(log.map((e) => e.at));
    check(log.length > 10 && places.size > 10 && stale.length === 0 && blur.length === 0 && hs.size === 1 && held.lock && !fit.lock && fit.set === fit.need && end.q.drawnAt === end.q.at,
      `a fast scrub of the sweep by touch: ${log.length} frames over ${places.size} places, ${stale.length} whose section is not the slider's place, ${blur.length} with a canvas not at its own size; the plot held at one height while the finger was down (locked ${held.lock}), fitted after the lift (${fit.set} of ${fit.need} px)`);
  }
  // a drawn line, moved parallel to itself
  {
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('norne-viewer:v1')); s.section = { on: true, line: null, a: [-2502, -2327], b: [1690, 947], at: null, size: 0 }; localStorage.setItem('norne-viewer:v1', JSON.stringify(s)); });
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await A.frame(); await A.frame();
    const s0 = await sweepState();
    await A.tapEl('#sec-next'); await A.frame(); await A.frame();
    const s1 = await sweepState();
    const u0 = [s0.q.b[0] - s0.q.a[0], s0.q.b[1] - s0.q.a[1]], u1 = [s1.q.b[0] - s1.q.a[0], s1.q.b[1] - s1.q.a[1]], L0 = Math.hypot(...u0), L1 = Math.hypot(...u1);
    const cos = (u0[0] * u1[0] + u0[1] * u1[1]) / (L0 * L1), off = Math.abs((s1.q.a[0] - s0.q.a[0]) * -u0[1] / L0 + (s1.q.a[1] - s0.q.a[1]) * u0[0] / L0);
    const said = s1.text.match(/^your line, moved (\d+) meters (north|south|east|west|northeast|northwest|southeast|southwest)$/);
    check(s0.text === 'your line, as drawn' && s0.shown === 'Drawn' && cos > 0.99999 && Math.abs(L1 - L0) < 2 && off > 50 && off < 120 && !!said && Math.abs(+said[1] - off) <= 1.5,
      `a drawn line sweeps parallel to itself: › moves it ${off.toFixed(1)} m square to itself (|cos| ${cos.toFixed(6)}, length ${Math.round(L0)} then ${Math.round(L1)} m): "${s1.text}", "${s1.shown}" on the pane`);
  }
  // the grip under the model sits inside its edge's hit, not on its boundary; at the raised sheet's first
  // stop the compact pane keeps a plot that can be read, and the model its 220 px
  {
    const g = await w(() => { const bar = document.querySelector('#sec-edge .grip-bar').getBoundingClientRect(), x = bar.left + bar.width / 2, y = bar.top + bar.height / 2; return [-8, -4, 0, 4, 8].map((d) => { const t = document.elementFromPoint(x, y + d); return t && t.closest('#sec-edge') ? 'edge' : (t && t.id) || '?'; }); });
    check(g.every((t) => t === 'edge'), `the grip under the model lies inside its edge's hit: at its middle −8, −4, 0, +4 and +8 px a touch meets ${g.join(', ')}`);
    const rows = [];
    await A.tapEl('#grip'); await page.waitForTimeout(700);
    for (const line of ['along', 'across']) { await A.tapEl(`#sec-lines [data-line="${line}"]`); await A.frame(); await A.frame(); rows.push(await w((l) => [l, document.getElementById('sec-plot').getBoundingClientRect().height, document.getElementById('plate').getBoundingClientRect().height], line)); }
    await A.shot('pane-raised-across-light', false);
    await A.tapEl('#grip'); await page.waitForTimeout(300); await A.tapEl('#grip'); await page.waitForTimeout(700); await A.frame();
    check(rows.every((r) => r[1] >= 86 && r[2] >= 219.5), `at the raised sheet's first stop the compact pane takes what the model can give above its 220 px: ${rows.map((r) => `${r[0]} a ${Math.round(r[1])} px plot over a ${Math.round(r[2])} px model`).join(', ')}`);
  }
  // the edge, dragged by touch past tall and back: under the finger, both canvases sharp in every frame
  {
    await A.tapEl('#sec-lines [data-line="along"]'); await A.frame(); await A.frame();
    const e = await A.rect('#sec-edge'), x = e.left + e.width / 2, y0 = e.top + 22, p0 = await A.rect('#section');
    await w(() => window.__norne.secLog(true));
    await A.touch('touchStart', x, y0);
    const under = [];
    for (let i = 1; i <= 16; i++) { await A.touch('touchMove', x, y0 - i * 10); await A.frame(); const p = await A.rect('#section'); under.push(Math.abs(p.top - (p0.top - i * 10))); }
    for (let i = 1; i <= 30; i++) await A.touch('touchMove', x, y0 - 160 - i * 12);
    await A.frame(); const atMax = await A.w(() => [document.getElementById('plate').getBoundingClientRect().height, document.getElementById('view').getBoundingClientRect().height]);
    for (let i = 1; i <= 27; i++) await A.touch('touchMove', x, y0 - 520 + i * 20);   // back down past compact
    await A.touch('touchEnd'); await A.frame(); await A.frame();
    const log = await w(() => window.__norne.secLog(false));
    const blur = log.filter((q) => q.plot[0] !== q.plot[1] || q.plot[2] !== q.plot[3] || q.gl[0] !== q.gl[1] || q.gl[2] !== q.gl[3]);
    const panes = log.map((q) => Math.round(q.pane));
    const done = await w(() => window.__norne.section().size);
    check(Math.max(...under) <= 1 && blur.length === 0 && Math.abs(atMax[0] - 120) <= 1 && new Set(panes).size > 10 && done === 0,
      `a drag on the pane's edge by touch: its top follows the finger to ${Math.max(...under).toFixed(2)} px over 16 steps; ${log.length} frames, ${blur.length} with a canvas not at its own size; dragged past tall, the model keeps ${Math.round(atMax[0])} px of ${Math.round(atMax[1])} (its 120 px strip); the pane took ${new Set(panes).size} heights from ${Math.min(...panes)} to ${Math.max(...panes)} px`);
  }
  // a double tap on the edge: tall, the stretch the pane states, the strip still turns the model; again: compact
  {
    const e = await A.rect('#sec-edge'), x = e.left + e.width / 2, y = e.top + 22;
    const c0 = await A.rect('#section');
    await A.tapAt(x, y); await page.waitForTimeout(100); await A.tapAt(x, y); await page.waitForTimeout(400); await A.frame(); await A.frame();
    const t = await w(() => ({ plate: document.getElementById('plate').getBoundingClientRect().height, q: window.__norne.section(), ex: document.getElementById('sec-exag').textContent, label: document.getElementById('sec-plot').getAttribute('aria-label'), vt: document.getElementById('sec-edge').getAttribute('aria-valuetext'), now: document.getElementById('sec-edge').getAttribute('aria-valuenow') }));
    const ax = t.q.ax, n = Number(t.ex.replace(/^vertical ×/, ''));
    await A.shot('pane-tall-light');
    const pr = await A.rect('#plate'), cam0 = await w(() => window.__norne.cam());
    // a spot on the strip under the keys and clear of A and A′ (a drag that starts on one moves that end)
    const spot = await w(([W, H]) => { const e = window.__norne.section().ends || []; for (let x = 20; x < W - 120; x += 4) { const y = (50 + H) / 2; if (e.every((p) => Math.hypot(p[0] - x, p[1] - y) > 40)) return [x, y]; } return [20, (50 + H) / 2]; }, [pr.width, pr.height]);
    await A.touch('touchStart', pr.left + spot[0], pr.top + spot[1]);
    for (let i = 1; i <= 6; i++) await A.touch('touchMove', pr.left + spot[0] + i * 15, pr.top + spot[1]);
    await A.touch('touchEnd'); await A.frame();
    const cam1 = await w(() => window.__norne.cam());
    const nearEnd = await nearEndDrag(A, pr);
    check(nearEnd.ok, `on the 120 px strip a one-finger drag that starts on the model ${nearEnd.d.toFixed(0)} px from A′ turns it (theta ${nearEnd.t0.toFixed(0)} then ${nearEnd.t1.toFixed(0)}) and leaves the line as it was ("${nearEnd.line}", ${nearEnd.same ? 'the same ends' : 'its ends moved'}): the model is ${nearEnd.box[0]} × ${nearEnd.box[1]} px there, so its ends take no touch`);
    const e2 = await A.rect('#sec-edge');
    await A.tapAt(e2.left + e2.width / 2, e2.top + 22); await page.waitForTimeout(100); await A.tapAt(e2.left + e2.width / 2, e2.top + 22); await page.waitForTimeout(400); await A.frame(); await A.frame();
    const c1 = await A.rect('#section'), sz = await w(() => window.__norne.section().size), noCard = await w(() => document.getElementById('readout').hidden && window.__norne.section().on);
    check(Math.abs(t.plate - 120) <= 1 && t.q.size === 1 && t.vt === 'Tall' && t.now === '100' && n > 5 && Math.abs(ax.sz / ax.sx - n) < 1e-9 && t.q.exag === n && new RegExp(`depth stretched ${n} times, more than the 3D view’s 5\\.`).test(t.label)
      && cam1.theta !== cam0.theta && sz === 0 && Math.abs(c1.height - c0.height) < 1 && noCard,
      `a double tap on the edge: tall (the model ${Math.round(t.plate)} px, "${t.vt}"), the section filling it at its own stretch, "${t.ex}" on the pane and ×${(ax.sz / ax.sx).toFixed(2)} drawn, "…depth stretched ${n} times, more than the 3D view’s 5." said; one finger on the strip turns the model (theta ${cam0.theta.toFixed(0)} then ${cam1.theta.toFixed(0)}); a double tap again: compact (${Math.round(c1.height)} px), the section open and no card opened by the tap's click (${noCard})`);
  }
  // the keys, and the size remembered over a reload
  {
    await w(() => document.getElementById('sec-edge').focus());
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await A.frame();
    const k = await w(() => [window.__norne.section().size, document.getElementById('sec-edge').getAttribute('aria-valuenow'), document.getElementById('section').getBoundingClientRect().height]);
    await page.keyboard.press('ArrowDown'); await A.frame();
    const k2 = await w(() => window.__norne.section().size);
    await page.waitForTimeout(600);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await A.frame(); await A.frame();
    const back = await w(() => [window.__norne.section().size, document.getElementById('section').getBoundingClientRect().height, document.getElementById('section').classList.contains('grown')]);
    check(k[0] === 0.3 && k[1] === '30' && k2 === 0.2 && back[0] === 0.2 && back[2] && back[1] > 204,
      `the keys step the edge (three ↑: ${k[0]}, "${k[1]}", ${Math.round(k[2])} px; ↓: ${k2}), and the size is remembered over a reload (${back[0]}, the pane ${Math.round(back[1])} px)`);
    const h = await hitTargets(w);
    check(h.bad.length === 0 && h.n >= 20, `with the pane grown: ${h.n} controls at 44 × 44 or more, the edge and the sweep's keys among them${h.bad.length ? ': ' + h.bad.join('; ') : ''}`);
    await w(() => document.getElementById('sec-edge').focus()); await page.keyboard.press('Home'); await A.frame();
  }
  check(A.errors.length === 0, `no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
  // on its side: the side edge widens the pane, the model keeps 160 px, the key plates side by side
  {
    const B = await open('light', { w: 844, h: 390 });
    await B.tapEl('#btn-section'); await B.page.waitForTimeout(500); await B.frame();
    const e = await B.rect('#sec-side'), x0 = e.left + e.width / 2, y = e.top + e.height / 2, p0 = await B.rect('#section');
    await B.touch('touchStart', x0, y);
    const under = [];
    for (let i = 1; i <= 10; i++) { await B.touch('touchMove', x0 - i * 10, y); await B.frame(); const p = await B.rect('#section'); under.push(Math.abs(p.left - (p0.left - i * 10))); }
    for (let i = 1; i <= 20; i++) await B.touch('touchMove', x0 - 100 - i * 30, y);
    await B.touch('touchEnd'); await B.frame(); await B.frame();
    const r = await B.w(() => ({ plate: document.getElementById('plate').getBoundingClientRect().toJSON(), keys: document.getElementById('keys').getBoundingClientRect().toJSON(), cls: document.getElementById('plate').className, vt: document.getElementById('sec-side').getAttribute('aria-valuetext') }));
    const h = await hitTargets(B.w);
    await B.shot('pane-side-light', false);
    const nearEnd = await nearEndDrag(B, await B.rect('#plate'));
    check(nearEnd.ok, `on the 160 px strip beside the pane a one-finger drag that starts on the model ${nearEnd.d.toFixed(0)} px from A′ turns it (theta ${nearEnd.t0.toFixed(0)} then ${nearEnd.t1.toFixed(0)}) and leaves the line as it was (${nearEnd.same ? 'the same ends' : 'its ends moved'}; the model ${nearEnd.box[0]} × ${nearEnd.box[1]} px)`);
    const keys = await B.w(() => { const e = document.getElementById('sec-side'), k = (key) => e.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })), v = () => e.getAttribute('aria-valuenow'); const o = [e.getAttribute('aria-orientation')]; k('ArrowLeft'); o.push(v()); o.push(e.getAttribute('aria-valuetext')); k('ArrowRight'); o.push(v()); k('ArrowDown'); o.push(v()); k('ArrowUp'); o.push(v()); return o; });
    check(keys.slice(0, 2).concat(keys.slice(3)).join() === 'horizontal,90,100,90,100' && /^\d+ percent of the view’s width$/.test(keys[2]), `the side edge is a horizontal slider ("${keys[0]}"), and its keys follow the slider convention VoiceOver's increment relies on: from tall ← ${keys[1]} ("${keys[2]}"), → ${keys[3]}, ↓ ${keys[4]}, ↑ ${keys[5]}`);
    check(Math.max(...under) <= 1 && Math.abs(r.plate.width - 160) <= 1 && /keys-(cols|wrap)/.test(r.cls) && r.keys.left >= r.plate.left && r.keys.bottom <= r.plate.bottom && r.vt === 'Wide' && h.bad.length === 0,
      `on its side the side edge follows the finger (to ${Math.max(...under).toFixed(2)} px) and, dragged out, leaves the model ${Math.round(r.plate.width)} px wide ("${r.vt}") with its key plates ${/keys-cols/.test(r.cls) ? 'side by side' : 'in two rows'} inside it (${Math.round(r.keys.width)} × ${Math.round(r.keys.height)} px, the plate ${Math.round(r.plate.height)} px tall); ${h.n} controls at 44 × 44 or more${h.bad.length ? ': ' + h.bad.join('; ') : ''}`);
    check(B.errors.length === 0, `on its side: no console error${B.errors.length ? ': ' + B.errors.join(' | ') : ''}`);
    await B.ctx.close();
  }
  // on its side with the sheet at its first raised stop and the pane compact (2.2's state; the final review's
  // must): the keys inside the plate, the model framed by the house rule (70 % of the plate's width or
  // more, where 2.3's first build left 35 %), and an end of the line still moved by a drag that starts on it
  {
    const B = await open('light', { w: 844, h: 390 });
    await B.tapEl('#btn-section'); await B.page.waitForTimeout(500); await B.frame();
    await B.tapEl('#grip'); await B.page.waitForTimeout(900); await B.frame(); await B.frame();
    for (const line of ['along', 'across']) {
      await B.tapEl(`#sec-lines [data-line="${line}"]`); await B.page.waitForTimeout(300); await B.frame(); await B.frame();
      const r = await B.w(() => { const p = document.getElementById('plate'), pr = p.getBoundingClientRect(), k = document.getElementById('keys').getBoundingClientRect(), m = window.__norne.modelBox(); return { W: pr.width, H: pr.height, cls: p.className, keys: k.left >= pr.left && k.right <= pr.right && k.bottom <= pr.bottom, m: [m[2] - m[0], m[3] - m[1]], stop: document.querySelector('.sheet').classList.contains('s1'), size: window.__norne.section().size, track: document.getElementById('sec-sweep').getBoundingClientRect().width }; });
      if (line === 'along') await B.shot('pane-raised-side-light', false);
      const q0 = await B.w(() => window.__norne.section()), pr = await B.rect('#plate'), e = q0.ends[1], o = q0.ends[0], L = Math.hypot(o[0] - e[0], o[1] - e[1]);
      const x = pr.left + e[0] + ((o[0] - e[0]) * 6) / L, y = pr.top + e[1] + ((o[1] - e[1]) * 6) / L;
      await B.touch('touchStart', x, y);
      for (let i = 1; i <= 6; i++) await B.touch('touchMove', x - i * 6, y + i * 3);
      await B.touch('touchEnd'); await B.frame(); await B.frame();
      const q1 = await B.w(() => window.__norne.section());
      const moved = q1.line === null && Math.hypot(q1.b[0] - q0.b[0], q1.b[1] - q0.b[1]) > 20 && Math.hypot(q1.a[0] - q0.a[0], q1.a[1] - q0.a[1]) < 2;
      check(r.stop && r.size === 0 && r.keys && r.m[0] >= 0.7 * r.W && moved && r.track >= 140,
        `${line === 'along' ? 'Along' : 'Across'} on its side, the sheet at its first raised stop, the pane compact: the model ${Math.round(r.m[0])} × ${Math.round(r.m[1])} px on a ${Math.round(r.W)} × ${Math.round(r.H)} px plate (${Math.round((100 * r.m[0]) / r.W)} % of its width; 2.2 about 207 px wide, 2.3's first build 94), the keys inside it (${/keys-(row|wrap|cols)/.exec(r.cls)?.[0] || 'column'}); a drag from 6 px off A′ moves A′ ${Math.round(Math.hypot(q1.b[0] - q0.b[0], q1.b[1] - q0.b[1]))} m and leaves A (the line now "${q1.line}"); the sweep's track ${Math.round(r.track)} px`);
    }
    // a double tap on the side edge to wide and one back: the tap's own click, which follows the lift over
    // whatever the toggle moved under the finger (here the plate's Section key), is taken by the edge
    await B.tapEl('#sec-lines [data-line="along"]'); await B.frame();
    const dbl = async () => { const e = await B.rect('#sec-side'), x = e.left + e.width / 2, y = e.top + e.height / 2; await B.tapAt(x, y); await B.page.waitForTimeout(100); await B.tapAt(x, y); await B.page.waitForTimeout(500); await B.frame(); return B.w(() => ({ on: window.__norne.section().on, size: window.__norne.section().size, card: !document.getElementById('readout').hidden, vt: document.getElementById('sec-side').getAttribute('aria-valuetext') })); };
    const d1 = await dbl(), d2 = await dbl();
    check(d1.on && d1.size === 1 && d1.vt === 'Wide' && d2.on && d2.size === 0 && d2.vt === 'Compact' && !d1.card && !d2.card,
      `on its side with the sheet raised, a double tap on the side edge goes to wide ("${d1.vt}") and one more back to compact ("${d2.vt}"); the section stays open (${d2.on}) and no card opens under the finger (${!d1.card && !d2.card})`);
    check(B.errors.length === 0, `on its side, raised: no console error${B.errors.length ? ': ' + B.errors.join(' | ') : ''}`);
    await B.ctx.close();
  }
  // the sweep's track is 140 px or more wherever the pane is shown: upright and on its side, at each of the
  // sheet's stops, compact and tall
  {
    const seen = [];
    for (const [W, H] of [[390, 844], [844, 390]]) {
      const B = await open('light', { w: W, h: H });
      await B.tapEl('#btn-section'); await B.page.waitForTimeout(500); await B.frame();
      const edge = W > H ? '#sec-side' : '#sec-edge';
      for (const stop of [0, 1, 2]) {
        if (stop) { await B.tapEl('#grip'); await B.page.waitForTimeout(900); }
        for (const key of ['Home', 'End']) {
          await B.w(([sel, k]) => { const e = document.querySelector(sel); e.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); }, [edge, key]);
          await B.page.waitForTimeout(150); await B.frame(); await B.frame();
          const t = await B.w(() => { const r = document.getElementById('sec-sweep').getBoundingClientRect(), s = document.getElementById('section').getBoundingClientRect(); return { w: r.width, shown: r.width > 0 && r.bottom <= innerHeight + 1 && s.width > 0, narrow: document.getElementById('sec-sweep').parentNode.classList.contains('narrow') }; });
          if (t.shown) seen.push(`${W > H ? 'side' : 'upright'} s${stop} ${key === 'Home' ? 'compact' : 'tall'} ${Math.round(t.w)}${t.narrow ? ' (word over it)' : ''}`);
          if (t.shown && t.w < 140) seen.push('UNDER 140');
        }
      }
      await B.w((sel) => document.querySelector(sel).dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })), edge);
      check(B.errors.length === 0, `the sweep's track at ${W} × ${H}: no console error${B.errors.length ? ': ' + B.errors.join(' | ') : ''}`);
      await B.ctx.close();
    }
    check(seen.length >= 10 && !seen.includes('UNDER 140'), `the sweep's track is 140 px or more wherever the pane is shown (${seen.length} states, px): ${seen.join('; ')}`);
  }
}

await browser.close();
server.close();
check(hashOf(appPng) === appPngHash, `screenshots/app.png, the README's composite, is untouched (${(appPngHash || 'missing').slice(0, 12)}…)`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('\nall checks pass');
