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
// the credit, the face), text contrast and the tracer, the plate printed per theme, the cut's ink and
// tint against the page and its column heights against this file's decode, the cut's line, the
// legend's open ends on Pressure, the card against this file's decode at a tapped cell, the card clear
// of the tapped point, labels clear of the card and the keys, SI in every visible text node, the
// scenes as pictures. Once: the real-touch scrub at 2, 8 and 20 steps a second, play, the step keys,
// the plate holding still while the caption changes, the legend clear of the header and the player at
// all three stops with the phone's insets emulated (the recorded bug, B1), the grip's names, the units
// key, focus mode end to end with the camera's way out, hidden, hit targets in both modes, About,
// Reduce Motion, broken data, and the widths; after the review, the field's framing at every plate
// size, taps on the rock against the names' hits, and the Cut's printed scale clear of its columns;
// after the final review, the card at every sheet stop, in focus mode and on a phone on its side (a
// grid of taps on the field, the card clear of each tap, its ring and every key, in the form the plate
// calls for), every well chosen from the list, a card carried across the stops, and the compact card's
// hits. Pictures: tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png; never
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
const cutLine = (f, sys) => {
  const o = F.oil[f], w = F.water[f], l = o + w;
  if (!(l > 0)) return `The track starts here, at first oil on ${dateOf(model.frames[f])}: nothing lifted yet.`;
  const q = (v) => (sys === 'US' ? `${group(v * 6.28981)}${NN}bbl/d` : `${group(v)}${NN}Sm³/d`);
  return `On the track, the month to ${dateOf(model.frames[f])}: oil ${q(o)} (ink), water ${q(w)} (tint), ${Math.round((w / l) * 100)}${NN}% water cut.`;
};
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
      window.__seen = { stamp: document.getElementById('stamp').textContent, shown: window.__norne ? window.__norne.shown() : null };
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
    check(seen && seen.shown !== null && /^Norne benchmark, OPM Flow \d{4}\.\d\d run$/.test(seen.stamp), `"Oil saturation" first reached the page with every file in (stamp then "${seen && seen.stamp}", report date ${seen && seen.shown})`);
    const credit = await w(() => document.getElementById('credits').textContent);
    const cv = await page.locator('#credits').isVisible();
    check(cv && credit === 'Data: Norne benchmark, Equinor and the Norne partners via the Open Porous Media initiative, ODbL 1.0', `the credit line is on screen word for word: "${credit}"`);
    const face = await w(() => document.fonts.check('560 11.5px "Ysabeau Office"') && document.fonts.check('600 21px "Ysabeau Office"') && [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Ysabeau Office' && f.status === 'loaded'));
    check(face, 'the face is loaded (document.fonts.check, status loaded) before the model shows');
  }

  // text contrast and the tracer
  {
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5, `text contrast: ${c.n} text nodes, worst ${c.worst[0]}:1 (${c.worst[1]})`);
    const tracer = await w(() => [...document.querySelectorAll('.words [role="radio"]')].map((b) => [b.textContent, b.getAttribute('aria-checked'), getComputedStyle(b, '::after').content !== 'none' && getComputedStyle(b, '::after').backgroundImage !== 'none']));
    const wrong = tracer.filter(([, on, has]) => (on === 'true') !== has);
    check(wrong.length === 0 && tracer.filter(([, on]) => on === 'true').length === 2, `the tracer runs under exactly the chosen words (${tracer.filter(([, on]) => on === 'true').map(([t]) => t).join(', ')})${wrong.length ? ': wrong on ' + wrong.map(([t]) => t).join(', ') : ''}`);
  }

  // the plate printed per theme (B7): the clear color is --plate; oil-bearing rock stands further from the
  // ground than barren rock, darker in the light theme, brighter in the dark
  {
    await setFrame(A, 0);
    const pr = await A.rect('#plate');
    const p = path.join(OUT, `plate-${scheme}.png`);
    await page.screenshot({ path: p, clip: { x: 0, y: pr.top, width: pr.width - 60, height: pr.height } });
    const img = decodePng(fs.readFileSync(p)), ground = hexRgb(scheme === 'light' ? '#e8eef0' : '#0c1316');
    let green = [], gray = [], groundPx = 0;
    for (let i = 0; i < img.w * img.h; i += 3) {
      const c = [img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]];
      if (Math.abs(c[0] - ground[0]) + Math.abs(c[1] - ground[1]) + Math.abs(c[2] - ground[2]) <= 3) { groundPx++; continue; }
      if (c[1] - Math.max(c[0], c[2]) > 30) green.push(lum(c));
      else if (Math.max(...c) - Math.min(...c) < 12) gray.push(lum(c));
    }
    const mg = green.reduce((a, b) => a + b, 0) / green.length, my = gray.reduce((a, b) => a + b, 0) / gray.length;
    check(groundPx > 1000 && green.length > 500 && gray.length > 500 && (scheme === 'light' ? mg < my : mg > my),
      `the plate is printed for the ${scheme} theme: ${groundPx} px of the ground ${scheme === 'light' ? '#e8eef0' : '#0c1316'}; oil-bearing cells mean luminance ${mg.toFixed(3)} against barren rock ${my.toFixed(3)} (${scheme === 'light' ? 'darker' : 'brighter'} is more)`);
  }

  // the cut: its ink against the page, its tint where the series says, its columns' heights at five
  // months against this file's own geometry (ART.md section 1: 0.5 px per 1 000 Sm³/d, a 2 px foot gap)
  {
    await setFrame(A, 0);
    const tr = await A.w(() => { const c = document.getElementById('track'); const x = c.getContext('2d'); return { w: c.width, h: c.height, css: c.getBoundingClientRect().width, d: [...x.getImageData(0, 0, c.width, c.height).data] }; });
    const dpr = tr.w / tr.css, W = tr.css, page8 = hexRgb(scheme === 'light' ? '#e8eef0' : '#141d21'), ink = hexRgb(scheme === 'light' ? '#12150b' : '#eff5e7');
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
    const lines = [];
    for (const f of [0, 37, 80, 109]) { await setFrame(A, f); lines.push([f, await w(() => document.getElementById('cutline').textContent)]); }
    const off = lines.filter(([f, t]) => t !== cutLine(f, 'SI'));
    check(off.length === 0, `the cut's line equals this file's decode at four dates: "${lines[3][1]}"${off.length ? ' | wrong: ' + off.map(([f, t]) => `${f} "${t}"`).join('; ') : ''}`);
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
    await A.tapEl('#stamp');
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

  // the plate holds still while the caption's words change
  {
    const hs = new Set(), cs = new Set();
    for (let f = 0; f < NF; f += 9) { await setFrame(A, f); const r = await w(() => [document.getElementById('plate').getBoundingClientRect().height, document.getElementById('cutline').getBoundingClientRect().height]); hs.add(r[0]); cs.add(r[1]); }
    check(hs.size === 1 && cs.size === 1, `the plate holds still while the cut's line changes: plate ${[...hs].join(', ')} px, the line ${[...cs].join(', ')} px over 13 dates`);
    const ph = [...hs][0];
    check(ph >= 460, `the plate at 390 × 844 with the sheet closed: ${Math.round(ph)} px (ART.md: at least 460)`);
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
    const us = await w(() => [document.getElementById('btn-units').textContent, document.getElementById('btn-units').getAttribute('aria-label'), [...document.querySelectorAll('#legend-ticks span:not([hidden])')].pop().textContent, document.getElementById('cutline').textContent, document.getElementById('scale-len').textContent]);
    check(k0 === 'SI' && us[0] === 'US' && /psi$/.test(us[2]) && us[3] === cutLine(109, 'US') && /(ft|mi)$/.test(us[4]), `the units key starts at SI; one press: ${us[0]} ("${us[1]}"), the legend ends "${us[2]}", the scale bar "${us[4]}", the line "${us[3]}"`);
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
      const stays = ['legend', 'instruments', 'cutline', 'credits', 'player', 'stamp'].map((id) => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return r.height > 0 && !e.closest('[hidden]'); });
      return { gone, stays, stampIn: document.getElementById('stamp').parentElement.id, ghost: !document.getElementById('focus-exit').hidden, plate: document.getElementById('plate').getBoundingClientRect().height, live: document.getElementById('live').textContent, store: localStorage.getItem('norne-viewer:v1:focus'), active: document.activeElement.id };
    });
    const tree = await page.getByRole('button', { name: 'Zoom in', exact: true }).count();
    const legend = await page.getByText('Oil saturation', { exact: true }).first().isVisible();
    check(f.gone.every(Boolean) && tree === 0 && f.stays.every(Boolean) && f.stampIn === 'caption' && f.ghost && legend,
      `focus mode by touch: the header, the keys and the sheet are hidden and inert (gone from the tree: ${tree === 0}); the legend ("Oil saturation" visible ${legend}), the instruments, the cut's line, the credits, the player and the stamp (now in the caption band) stay`);
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

  // About: from the stamp, every credit and the font's, Escape, focus back
  {
    await page.focus('#stamp'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const ab = await w(() => ({ open: !document.getElementById('about').hidden, text: document.getElementById('about-body').innerText, src: document.getElementById('about-source').textContent, active: document.activeElement.id }));
    await A.shot('about-light');
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    const back = await w(() => [document.getElementById('about').hidden, document.activeElement.id]);
    check(ab.open && ab.src === model.source && /License: Open Database License \(ODbL\) 1\.0, opendatacommons\.org\/licenses\/odbl\/1-0\//.test(ab.text)
      && ab.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.')
      && /not the field’s reported production/.test(ab.text) && back[0] && back[1] === 'stamp',
    `About opens from the stamp (focus on ${ab.active}): model.json's source verbatim, the license without its scheme, the face's credit, what the cut is not; Escape closes it, focus back on ${back[1]}`);
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
    const r = await A.w(() => [document.getElementById('error').textContent, document.getElementById('legend-name').textContent, document.getElementById('stamp').textContent]);
    check(r[0] === want && r[1] === '' && A.errors.length === 0, `${p} ${ov.status ? `answers ${ov.status}` : 'replaced'}: "${r[0]}"; the legend stays empty, so the camera's wait does not pass; the stamp "${r[2]}"${A.errors.length ? ' | ' + A.errors.join(' | ') : ''}`);
    // the notice sits on the theme's own ground, never on the WebGL context's black (QA, after the pass);
    // the first case also turns the theme to dark and back while broken
    for (const sch of p === cases[0][0] && ov.status ? ['light', 'dark', 'light'] : ['light']) {
      await A.page.emulateMedia({ colorScheme: sch });
      await A.page.waitForTimeout(150);
      const pr = await A.rect('#plate'), er = await A.rect('#error'), sp = path.join(OUT, `broken-plate-${sch}.png`);
      await A.page.screenshot({ path: sp, clip: { x: 0, y: pr.top, width: pr.width - 60, height: pr.height } });   // the view's controls column left out, as the plate check does
      const img = decodePng(fs.readFileSync(sp)), ground = hexRgb(sch === 'light' ? '#e8eef0' : '#0c1316'), sc = img.w / (pr.width - 60);
      let n = 0, on = 0;
      for (let y = 0; y < img.h; y += 4) for (let x = 0; x < img.w; x += 4) {
        const X = x / sc, Y = pr.top + y / sc;
        if (X >= er.left - 8 && X <= er.right + 8 && Y >= er.top - 8 && Y <= er.bottom + 8) continue;
        const i = (y * img.w + x) * 4; n++;
        if (Math.abs(img.px[i] - ground[0]) + Math.abs(img.px[i + 1] - ground[1]) + Math.abs(img.px[i + 2] - ground[2]) <= 3) on++;
      }
      check(n > 1000 && on / n >= 0.99, `${p} broken, ${sch} theme: ${(on / n * 100).toFixed(1)} % of ${n} sampled plate pixels outside the notice are the ground ${sch === 'light' ? '#e8eef0' : '#0c1316'}`);
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
    let worst = [0, ''];
    for (const sys of ['SI', 'US']) {
      if ((await A.w(() => window.__norne.units())) !== sys) { await A.tapEl('#btn-units'); await A.frame(); }
      for (let f = 0; f < NF; f++) {
        await A.w((k) => window.__norne.setFrame(k), f);
        if (f % 4 === 3 || f === NF - 1) await A.frame();
        const o = await A.w(() => { const e = document.getElementById('cutline'); return [e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth, e.textContent]; });
        const over = Math.max(o[0], o[1]);
        if (over > worst[0]) worst = [over, o[2]];
      }
    }
    if ((await A.w(() => window.__norne.units())) !== 'SI') await A.tapEl('#btn-units');
    await A.frame();
    const hs = await hitTargets(A.w);
    if (side) await A.shot('landscape-dark', false);
    check(r.sw <= r.iw && worst[0] <= 1 && hs.bad.length === 0 && (!side || (r.plate >= 220 && r.row && r.keys <= 40)),
      `${label}: page ${r.sw} of ${r.iw} px wide; the cut's longest line in both systems fits its fixed height${worst[0] > 1 ? ` (over by ${worst[0]} px: "${worst[1]}")` : ''}; ${hs.n} controls at 44 px or more${side ? `; the plate ${Math.round(r.plate)} px tall (at least 220), the keys in a row ${Math.round(r.keys)} px high` : ''}${hs.bad.length ? ': ' + hs.bad.join('; ') : ''}`);
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
    const img = decodePng(fs.readFileSync(p)), s = img.w / g.iw, ground = hexRgb('#e8eef0'), pr = g.plate;
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
    return { open: !card.hidden, c, ring, compact, overTap: over(c, { l: X - 9, t: Y - 9, r: X + 9, b: Y + 9 }), overRing: !!ring && over(c, { l: ring.l - 2, t: ring.t - 2, r: ring.r + 2, b: ring.b + 2 }), overKeys: keys.some((k) => over(c, k)), inside: c.l >= -0.5 && c.t >= -0.5 && c.r <= pr.width + 0.5 && c.b <= pr.height + 0.5, reach, sliced, more, sign, plate: [Math.round(pr.width), Math.round(pr.height)] };
  }, [x, y]);
  const wrong = (r, wantCompact) => [!r.open && 'closed', r.compact !== wantCompact && (r.compact ? 'compact' : 'full'), r.overTap && 'over the tap', !r.ring && 'ring hidden', r.overRing && 'over the ring', r.overKeys && 'over a key', !r.inside && 'past the plate', !r.reach.every(Boolean) && 'Close or Zoom out of reach', r.sliced && 'a row sliced', !r.sign && 'no rule at the foot'].filter(Boolean);
  /** Taps a 3 x 3 grid over the field's drawn rows, the card checked after each. */
  const scene = async (A, label, wantCompact) => {
    await A.frame(); await A.page.waitForTimeout(400); await A.frame();
    const pr = await A.rect('#plate');
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
    check(res.length >= 6 && bad.length === 0, `${label}, plate ${sz}: ${res.length} taps on the field, the card ${wantCompact ? 'compact' : 'full'} each time, clear of the tap, its ring and every key, inside the plate, Close and Zoom in reach, rows whole (${clipped} with more below, each with its rule)${bad.length ? ': ' + bad.map((r) => `(${r.x}, ${r.y}) ${wrong(r, wantCompact).join(', ')}`).join('; ') : ''}`);
    return res;
  };
  const A = await open('light');
  await A.w(() => window.__norne.setFrame(60)); await A.frame();
  await scene(A, 'sheet closed', false);
  await A.tapEl('#grip'); await scene(A, 'sheet at its first stop', true);
  await A.tapEl('#grip'); await scene(A, 'sheet at its second stop', true);
  await A.shot('card-sheet', false);
  // every well the list offers, chosen there at the first stop: its head and its name clear of the card
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
    check(seen.every((r, i) => r.open && r.ring && !r.overRing && !r.overKeys && r.inside && r.compact === (i > 0)), `a card carried across the stops is placed again at each: ${seen.map((r, i) => `stop ${i} (plate ${r.h} px) ${r.compact ? 'compact' : 'full'}${r.ring && !r.overRing ? ', ring clear' : ', RING COVERED'}${r.overKeys ? ', OVER A KEY' : ''}${r.inside ? '' : ', PAST THE PLATE'}`).join('; ')}`);
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

await browser.close();
server.close();
check(hashOf(appPng) === appPngHash, `screenshots/app.png, the README's composite, is untouched (${(appPngHash || 'missing').slice(0, 12)}…)`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('\nall checks pass');
