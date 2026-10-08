// Drive Besseggen in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch), light and
// dark (HOUSE.md section 7.2; the change list, step 21, in tools/DECISIONS.md). Fails on any console error or warning, page
// error, failed request, HTTP ≥ 400, or any request outside the local server; the one message
// tolerated is SwiftShader's own "GPU stall due to ReadPixels". Every figure it asserts is worked out
// from the shipped files by tools/decode.mjs (this folder's own decode, sun and ray march), never by
// importing js/.
//
// FRAME AND SWEEP TIMES ARE HEADLESS CHROMIUM ON THIS MAC (SwiftShader WebGL): a trend only, never
// phone evidence. The phone's frame rate, memory and battery are the owner's checks (tools/DECISIONS.md).
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCRUB=0 node tools/shoot.mjs            skip the three-speed scrub
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the scenes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's strings by role and name, CEST only once the terrain is in, the
// credits in About, the stamp's line one line in every state), the face, text contrast and the selection tracer, the Burn's ink against the page, the
// trail against its casing, the Burn against tools/decode.mjs at two waypoints on three dates, the card
// against this file's decode at a tapped point, SI in every visible text node, labels clear of the card
// and the keys, the profile's names, the scenes as pictures. Once: the real-touch scrub at 2, 8 and 20
// steps a second with the light and the cast shadows of one instant on every frame (B3), play, the day
// keys, the plate holding still while the caption changes, the grip's stops and the camera's keys,
// focus mode end to end and the camera's way out of it, hidden, hit targets, About and Layers, Reduce
// Motion, broken data, and the widths (with the profile's labels inside its strip at each, and the
// exaggeration's readout on a phone on its side). Pictures: tools/.work/shots/, and with SCREENSHOTS=1
// screenshots/*-{light,dark}.png; never screenshots/app.png, the README's composite.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { directSun, heightAt } from './decode.mjs';

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
const J = (f) => JSON.parse(fs.readFileSync(path.join(APP, 'data', f), 'utf8'));
const WP = Object.fromEntries(J('waypoints.json').waypoints.map((w) => [w.id, w]));
const LAT = 61.5044, LON = 8.7207;           // NOTES.md; tools/test_decode.mjs checks js/geo.js against it

/* ── formats, written here again (HOUSE.md section 6) ── */
const NN = ' ';
const MONS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const clock = (m) => `${pad(Math.floor(Math.round(m) / 60) % 24)}:${pad(Math.round(m) % 60)}`;
const label = (d, step) => `${d.d} ${MONS[d.mo - 1]}, ${clock(step * 5)}`;
const group = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+$)/g, NN);
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const pctl = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

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

/* ── the server: the app folder, with any data file replaceable ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/json', '.woff2': 'font/woff2', '.bin': 'application/octet-stream', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = {};                                     // path -> { status } or { body }
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const ov = override[u];
  if (ov) { if (ov.status) { res.writeHead(ov.status); res.end(); return; } res.writeHead(200, { 'content-type': 'application/json' }); res.end(ov.body); return; }
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
console.log(`headless Chromium ${browser.version()} with SwiftShader WebGL: every frame and sweep time below is a trend on this Mac, not phone evidence`);

const NOISE = /GPU stall due to ReadPixels/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const ready = () => window.__besseggen && /CES?T/.test(document.getElementById('t-zone').textContent);

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  if (o.focus !== undefined) await ctx.addInitScript((f) => { try { localStorage.setItem('besseggen:focus', JSON.stringify(f)); } catch { /* fine */ } }, o.focus);
  // record the first moment any CEST or CET reaches the page, and what the stamp's line was then
  await ctx.addInitScript(() => {
    new MutationObserver(() => {
      if (window.__zoneSeen || !document.body || !/CES?T/.test(document.getElementById('t-zone') ? document.getElementById('t-zone').textContent : '')) return;
      window.__zoneSeen = { stamp: document.getElementById('stamp').textContent, home: document.getElementById('stamp-home').hidden, about: !document.getElementById('btn-about').hidden, hook: !!window.__besseggen };
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
const ST = (A) => A.w(() => window.__besseggen.state());
/** Frames that swept the cast shadows without a new instant, or drew a new instant without a sweep. */
const sweepBad = (log) => log.slice(1).filter((f, i) => f.n - log[i].n !== (f.sun !== log[i].sun ? 1 : 0)).length;
/** The Play key's marks as drawn: the hidden attribute and the computed display, never the .hidden expando. */
const playMarks = (w) => w(() => ['ico-play', 'ico-pause'].map((id) => { const e = document.getElementById(id); return `${id} ${e.hasAttribute('hidden') ? 'hidden' : 'shown'} ${getComputedStyle(e).display}`; }).concat(document.getElementById('t-play').getAttribute('aria-label')).join(', '));
const minsOf = (t) => { const m = t.match(/(?:(\d+) h)?(?: ?(\d+) min)?/); return (+(m[1] || 0)) * 60 + (+(m[2] || 0)); };
/** Set the date and step through the app's own path, and wait for the frame that draws them. */
async function setTime(A, mo, d, min) { await A.w(([a, b, c]) => window.__besseggen.setDateTime(a, b, c), [mo, d, min]); await A.frame(); }

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
    if (!t.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr') || e.closest('#labels') || e.closest('svg')) continue;
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
  for (const e of document.querySelectorAll('button, [role="slider"], [role="tab"], input')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    // a control partly scrolled out of view is measured where it is wholly in view, not here
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !at(cx, cy)) continue;
    seen.push(e.id || (e.textContent || '').trim().slice(0, 12));
    // quarter-pixel steps: a 44 px box at a fractional offset measures 43 on a half-pixel grid
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 280 && at(cx + (s * k * dx) / 4, cy + (s * k * dy) / 4); k++) n++; return n / 4; };
    const okV = run(0, 1) >= 43.5, okH = run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Every visible text node: a hyphen-minus before a digit, or a plain space between a number and a unit. */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[  ](°|%|m|km|km\/h|mm|h|min|s|bytes)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    // About shows data/about.json's values verbatim (owner call 11)
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, #ab-gen p, #ab-lead, #ab-boat')) continue;
    const text = e.id === 'card-unit' ? document.getElementById('card-num').textContent + t.textContent : t.textContent;
    n++;
    if (/(^|[^\w])-\d/.test(text) || UNIT.test(text)) bad.push(text.trim().slice(0, 40));
  }
  return { n, bad };
});
/** The track canvas: every drawn device pixel above the day-so-far line, composited over the page,
 *  but the thumb's column and the 30° scale at the left end. */
const burnSamples = (w) => w(() => {
  const c = document.getElementById('track'), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  const dpr = c.width / c.getBoundingClientRect().width, W = c.width / dpr;
  const page = getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number);
  const tx = 10 + (window.__besseggen.shown() / 288) * (W - 20);
  const out = [];
  for (let y = Math.round(8 * dpr); y < Math.round(31.5 * dpr); y++) for (let i = Math.round(32 * dpr); i < c.width; i++) {
    if (Math.abs(i / dpr - tx) < 9) continue;
    const k = (y * c.width + i) * 4, a = d[k + 3] / 255;
    if (a > 0) out.push({ a, s: [0, 1, 2].map((j) => d[k + j] * a + page[j] * (1 - a)), page });
  }
  return out;
});
/** The trail's red pixels on the plate against the palest pixel within 3 px (its casing). */
function trailCasing(png, plate) {
  const img = decodePng(png), sc = img.w / 390, out = [];
  const y0 = Math.round(plate.top * sc), y1 = Math.round(plate.bottom * sc);
  for (let y = y0 + 4; y < y1 - 4; y += 2) for (let x = 4; x < img.w - 4; x += 2) {
    const k = (y * img.w + x) * 4, r = img.px[k], g = img.px[k + 1], b = img.px[k + 2];
    if (!(r > 150 && g < 90 && b < 80)) continue;
    let best = null, bl = -1;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const q = ((y + dy) * img.w + x + dx) * 4, c = [img.px[q], img.px[q + 1], img.px[q + 2]];
      if (c[0] > 150 && c[1] < 90) continue;
      const l = lum(c); if (l > bl) { bl = l; best = c; }
    }
    if (best) out.push(contrast([r, g, b], best));
  }
  return out;
}

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;

  // boot: the camera's strings and controls, the zone only once the terrain is in, the credits in About, the face
  {
    const seen = await w(() => window.__zoneSeen);
    const names = ['About', 'Show more controls', 'Fit the route', 'Zoom in', 'Zoom out', 'Layers', 'Hide the controls', 'Play', 'Previous day', 'Next day'];
    const roles = await Promise.all(names.map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    const slider = await page.getByRole('slider', { name: 'Time of day', exact: true }).count();
    const zone = await page.getByText('CEST', { exact: false }).first().isVisible();
    const credits = await w(() => ({ gone: !document.getElementById('credits'), t: document.getElementById('about-credit-line').textContent,
      first: document.querySelector('#ab-gen h3 + #about-credit-line') === document.getElementById('about-credit-line') && document.getElementById('about-credit-line').previousElementSibling.textContent === 'Sources and credits',
      ed: [...document.querySelectorAll('#ab-gen dl')][0].firstElementChild.textContent + ': ' + [...document.querySelectorAll('#ab-gen dl')][0].children[1].textContent }));
    // the stamp's line is one line, 16 px, in every state its writers can put in it (HOUSE.md section 7.2)
    const lines = await w(() => {
      const home = document.getElementById('stamp-home'), st = document.getElementById('stamp'), was = [home.hidden, st.textContent];
      home.hidden = false;
      const out = ['Reading the terrain\u2026', 'Reading the terrain\u2026 4 of 4', 'Reading the trail and the names\u2026', 'Besseggen could not start.'].map((t) => { st.textContent = t; return [t, st.getBoundingClientRect().height]; });
      [home.hidden, st.textContent] = was;
      return out;
    });
    const font = await w(() => document.fonts.check('560 11.5px "Ysabeau Office"') && document.fonts.check('600 21px "Ysabeau Office"'));
    console.log(`  - boot: ready in ${A.ms} ms (headless Chromium); stamp "${await w(() => document.getElementById('stamp').textContent)}"`);
    check(zone && seen && seen.hook && seen.home && seen.about, `the camera's wait: CEST visible, and the first moment any CEST or CET reached the page the terrain was in (the stamp's line hidden ${seen && seen.home}, the About key shown ${seen && seen.about})`);
    check(/^Edition: Kartverket data, retrieved \d+ \w{3} \d{4}$/.test(credits.ed), `the edition is About's first This data row: "${credits.ed}"`);
    check(lines.every(([, h]) => Math.abs(h - 16) <= 1), `the stamp's line is one line in every state it can show: ${lines.map(([t, h]) => `"${t}" ${h.toFixed(0)} px`).join(', ')}`);
    check(roles.every((n) => n === 1) && slider === 1, `the camera's and the house's controls by role and name, one each: ${names.map((n, i) => `${n} ${roles[i]}`).join(', ')}; slider "Time of day" ${slider}`);
    check(credits.gone && credits.first && credits.t === 'Terrain, trail, lakes and names: Kartverket, CC BY 4.0', `no #credits on the front; About's first Sources and credits paragraph is the credit, word for word: "${credits.t}"`);
    check(font, 'the face is loaded: document.fonts.check(560 11.5px and 600 21px "Ysabeau Office")');
    const o = await w(() => ({ mark: (document.querySelector('#labels .lbl.mark') || {}).textContent, cap: document.getElementById('cap').textContent, walk: document.querySelector('.walk').textContent }));
    check(/^Gjendesheim, \d+\u202fm$/.test(o.mark || '') && o.cap.startsWith('The burn: direct sun at the marker, Gjendesheim, ') && /^\S+\u202fm walked, at \S+\u202fm, \S+\u202f% grade, /.test(o.walk), `on opening the marker is named on the plate ("${o.mark}") and in the caption ("${o.cap.slice(0, 60)}…"); the walk line's figures each with a word ("${o.walk}")`);
  }

  // text contrast; the selection tracer under exactly the chosen words
  {
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5, `text contrast: ${c.n} text nodes off the plate, the lowest ${c.worst[0]}:1 at ${c.worst[1]} (≥ 4.5)`);
    await A.tapEl('#grip'); await A.tapEl('#grip'); await page.waitForTimeout(200);
    const tr = await w(() => [...document.querySelectorAll('.word')].filter((b) => b.getBoundingClientRect().height).map((b) => [b.textContent, getComputedStyle(b, '::after').content !== 'none', b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-checked') === 'true']));
    check(tr.length > 8 && tr.every(([, mark, on]) => mark === on), `the selection tracer marks exactly the chosen words: ${tr.filter((x) => x[1]).map((x) => x[0]).join(', ')} of ${tr.length} word keys`);
    await A.tapEl('#grip'); await page.waitForTimeout(200);
  }

  // the signature: the Burn's ink against the page, and against this file's own ray march
  {
    const px = await burnSamples(w);
    const ratios = px.map((p) => contrast(p.s, p.page)), full = px.filter((p) => p.a >= 0.99).map((p) => contrast(p.s, p.page));
    const share = ratios.filter((r) => r >= 3).length / Math.max(1, ratios.length);
    check(px.length > 2000 && share >= 0.9 && Math.min(...full) >= 3, `the Burn's ink: ${px.length} drawn device pixels above the day so far, ${(share * 100).toFixed(1)} % at 3:1 or more against the page (target 90 %); fully drawn pixels at least ${Math.min(...full).toFixed(2)}:1; the lowest sample ${Math.min(...ratios).toFixed(2)}:1, an antialiased edge`);
    const rows = [], adds = []; let bad = 0;
    for (const id of ['veslfjellet', 'bandet']) {
      const p = WP[id];
      await w(([x, y]) => window.__besseggen.setMarker(x, y), [p.x, p.y]);
      for (const [mo, d] of [[6, 14], [9, 20], [12, 21]]) {
        await setTime(A, mo, d, 600);
        const b = await w(() => window.__besseggen.burn()), mine = directSun(p.x, p.y, 2026, mo, d, LAT, LON);
        const s = await ST(A);
        const first = mine.spans.length ? mine.spans[0][0] : null, last = mine.spans.length ? mine.spans[mine.spans.length - 1][1] : null;
        const same = b.spans.length === mine.spans.length && (first === null ? b.first === null : Math.abs(b.first - first) <= 4 && Math.abs(b.last - last) <= 4);
        const cap = first === null ? s.caption.startsWith(`No direct sun reaches the marker at ${p.name} on ${d} ${MONS[mo - 1]}:`) : s.caption.includes(clock(b.spans[0][0])) && s.caption.includes(clock(b.spans[b.spans.length - 1][1])) && s.caption.includes(`at the marker, ${p.name}`);
        // the total in parentheses against the spells: those printed, or the burn's own when it says "in N spells"
        const c = s.caption.replace(/\u202f/g, ' '), tot = c.match(/\((\d+ h(?: \d+ min)?|\d+ min)\)/);
        const printed = [...c.matchAll(/(\d\d):(\d\d) to (\d\d):(\d\d)/g)].map((m) => (+m[3] * 60 + +m[4]) - (+m[1] * 60 + +m[2]));
        const sum = / spells from /.test(c) ? b.spans.reduce((n, [a0, a1]) => n + a1 - a0, 0) : printed.reduce((n, v) => n + v, 0);
        if (first !== null) { adds.push(`${tot && tot[1]} = ${sum} min`); if (!tot || minsOf(tot[1]) !== sum || b.total !== sum) bad++; }
        if (!same || !cap) bad++;
        rows.push(`${p.name} ${d} ${MONS[mo - 1]} ${first === null ? 'none' : `${clock(b.first)} to ${clock(b.last)} (this file ${clock(first)} to ${clock(last)})`}`);
      }
    }
    check(bad === 0, `the Burn against tools/decode.mjs's ray march (first and last within 4 minutes, the same spells, the caption's times the burn's, the place named, the total the sum of the spells as printed: ${adds.join(', ')}): ${rows.join('; ')}`);
    await A.tapEl('#btn-fit'); await setTime(A, 6, 14, 420);
    await w(([x, y]) => window.__besseggen.setMarker(x, y), [WP.gjendesheim.x, WP.gjendesheim.y]);
  }

  // the trail on its casing, at the opening view and from the boat
  {
    const plate = await A.rect('#plate'), res = [];
    for (const [name, fn] of [['opening', () => 0], ['boat', () => window.__besseggen.applyViewpoint(0)]]) {
      await w(fn); await page.waitForTimeout(600);
      const r = trailCasing(await page.screenshot(), plate);
      res.push([name, r.length, r.filter((x) => x >= 3).length / Math.max(1, r.length), Math.min(...r)]);
    }
    await A.tapEl('#btn-fit'); await page.waitForTimeout(300);
    check(res.every(([, n, s]) => n > 40 && s >= 0.9), `the trail against its casing: ${res.map(([n, k, s, lo]) => `${n} ${k} red pixels, ${(s * 100).toFixed(0)} % at 3:1 or more against the palest pixel within 3 px (lowest ${lo.toFixed(2)})`).join('; ')}`);
  }

  // the card for a tapped point against this file's decode; its sentence; it keeps clear of the point
  {
    const p = WP.besseggen;
    const q = await w(([x, y]) => window.__besseggen.project(x, y), [p.x + 300, p.y - 400]);
    const plate = await A.rect('#plate');
    await A.tapAt(plate.left + q.x, plate.top + q.y); await page.waitForTimeout(700);
    const c = await w(() => ({ kind: document.getElementById('card-kind').textContent, num: document.getElementById('card-num').textContent, unit: document.getElementById('card-unit').textContent,
      rows: [...document.querySelectorAll('#card-body dt')].map((d) => [d.textContent, d.nextElementSibling.textContent]), live: document.getElementById('live').textContent, m: window.__besseggen.burn().marker,
      card: document.getElementById('card').getBoundingClientRect().toJSON(), low: document.getElementById('card').classList.contains('low') }));
    const h = heightAt(c.m.x, c.m.y), mine = directSun(c.m.x, c.m.y, 2026, 6, 14, LAT, LON);
    const sun = (c.rows.find((r) => r[0] === 'Direct sun') || [])[1] || '';
    check(c.num === group(h) && c.unit === `${NN}m` && /^(Tapped point|On the trail, )/.test(c.kind), `the card for a tap: "${c.kind}", "${c.num}${c.unit}" (this file's decode at the hit: ${h.toFixed(2)} m), ${c.rows.map((r) => `${r[0]} ${r[1]}`).join('; ')}`);
    check(mine.spans.length ? sun.startsWith('14 Jun, ') : sun === 'none on 14 Jun', `its direct sun against this file's ray march: "${sun}" (this file: ${mine.spans.length ? `${clock(mine.spans[0][0])} to ${clock(mine.spans[mine.spans.length - 1][1])}` : 'none'})`);
    check(c.live.startsWith(`${c.kind}, ${group(h)} meters. `), `the tap's sentence: "${c.live}"`);
    const pt = await w(([x, y]) => window.__besseggen.project(x, y), [c.m.x, c.m.y]);
    const inside = pt.x + plate.left >= c.card.left && pt.x + plate.left <= c.card.right && pt.y + plate.top >= c.card.top && pt.y + plate.top <= c.card.bottom;
    check(!inside, `the card keeps clear of the point it describes (${c.low ? 'moved to the bottom' : 'at the top'}; the point at ${Math.round(pt.x)}, ${Math.round(pt.y)} on the plate)`);
    // labels stay out of the card's, the keys' and the ghost key's rectangles (B1)
    const lab = await w(() => {
      const pr = document.getElementById('plate').getBoundingClientRect(), boxes = [];
      for (const id of ['card', 'keys']) { const e = document.getElementById(id); if (!e.hidden) { const r = e.getBoundingClientRect(); boxes.push([id, r.left - pr.left, r.top - pr.top, r.right - pr.left, r.bottom - pr.top]); } }
      const lbl = [...document.querySelectorAll('#labels .lbl')].map((e) => { const r = e.getBoundingClientRect(); return [e.textContent, r.left - pr.left, r.top - pr.top, r.right - pr.left, r.bottom - pr.top]; });
      const hits = []; for (const l of lbl) for (const b of boxes) if (l[1] < b[3] && l[3] > b[1] && l[2] < b[4] && l[4] > b[2]) hits.push(`${l[0]} under ${b[0]}`);
      return { n: lbl.length, hits };
    });
    check(lab.n >= 3 && lab.hits.length === 0, `labels keep out of the card and the keys: ${lab.n} labels${lab.hits.length ? '; COVERED: ' + lab.hits.join(', ') : ''}`);
    await A.shot(`tap-${scheme}`);
  }

  // SI in every visible text node (the card open, a tool's result in it too)
  {
    const si = await siOf(w);
    check(si.bad.length === 0 && si.n > 40, `SI: ${si.n} visible text nodes, no hyphen-minus before a digit and U+202F before every unit${si.bad.length ? ': ' + si.bad.join(' | ') : ''}`);
    await w(([a, b]) => window.__besseggen.runTool('los', [a, b]), [[WP.veslfjellet.x, WP.veslfjellet.y], [WP.bandet.x, WP.bandet.y]]); await page.waitForTimeout(400);
    const si2 = await siOf(w), los = await w(() => document.getElementById('card').textContent.replace(/\s+/g, ' ').trim());
    check(si2.bad.length === 0 && /Line of sight.*blocked by up to/.test(los), `SI with the line of sight in the card: "${los.slice(0, 110)}…"${si2.bad.length ? ': ' + si2.bad.join(' | ') : ''}`);
    await A.shot(`los-${scheme}`);
    await w(() => document.getElementById('card-close').click()); await page.waitForTimeout(100);
  }

  // the profile's names: inside the strip, apart, over a halo of the page (B2)
  {
    const pr = await w(() => {
      const s = document.getElementById('profile').getBoundingClientRect(), out = [];
      for (const e of document.querySelectorAll('#profile .pwpt')) { if (e.style.display === 'none') continue; const r = e.getBoundingClientRect(); out.push([e.textContent, r.left - s.left, r.top - s.top, r.right - s.left, r.bottom - s.top]); }
      const cs = getComputedStyle(document.querySelector('#profile .pwpt'));
      return { w: s.width, h: s.height, out, halo: [cs.paintOrder, cs.stroke, cs.strokeWidth], page: getComputedStyle(document.body).backgroundColor };
    });
    const apart = pr.out.every((a, i) => pr.out.every((b, j) => i === j || a[3] <= b[1] || b[3] <= a[1] || a[4] <= b[2] || b[4] <= a[2]));
    const inside = pr.out.every((a) => a[1] >= 0 && a[3] <= pr.w + 0.5 && a[2] >= 0 && a[4] <= pr.h + 0.5);
    check(pr.out.length === 6 && apart && inside && /stroke/.test(pr.halo[0]) && pr.halo[1] === pr.page && parseFloat(pr.halo[2]) >= 3,
      `the profile's six waypoint names drawn (${pr.out.length}), inside the strip ${inside}, apart ${apart}, each over a ${pr.halo[2]} halo of the page (${pr.halo[0]})`);
  }

  // the scenes, as pictures
  await A.tapEl('#btn-fit'); await setTime(A, 6, 14, 420); await page.waitForTimeout(500);
  await A.shot(`open-${scheme}`);
  await w(() => window.__besseggen.applyViewpoint(0)); await setTime(A, 9, 20, 480); await page.waitForTimeout(600);
  await A.shot(`boat-${scheme}`);
  await A.tapEl('#btn-fit'); await setTime(A, 6, 14, 420);
  await w(() => window.__besseggen.setLayer('slope', true)); await page.waitForTimeout(400); await A.shot(`slope-${scheme}`);
  await w(() => window.__besseggen.setLayer('slope', false));
  await w(([x, y]) => window.__besseggen.runTool('viewshed', [[x, y]]), [WP.veslfjellet.x, WP.veslfjellet.y]); await page.waitForTimeout(600);
  await A.shot(`viewshed-${scheme}`);
  await w(() => document.getElementById('tool-clear').click()); await page.waitForTimeout(100);
  await A.tapEl('#grip'); await page.waitForTimeout(300); await A.shot(`stop1-${scheme}`);
  await A.tapEl('#grip'); await page.waitForTimeout(300); await A.shot(`stop2-${scheme}`);
  await A.tapEl('#grip'); await page.waitForTimeout(200);
  await A.tapEl('#btn-about'); await page.waitForTimeout(400); await A.shot(`about-${scheme}`);
  const fa = await w(() => document.activeElement.closest('#about') && document.activeElement.textContent); await page.keyboard.press('Escape');
  await A.tapEl('#btn-layers'); await page.waitForTimeout(400); await A.shot(`layers-${scheme}`);
  const fl = await w(() => document.activeElement.closest('#layers') && document.activeElement.textContent); await page.keyboard.press('Escape');
  check(fa === 'Close' && fl === 'Close', `About and Layers opened by touch move focus to their Close (${fa}, ${fl})`);
  await A.tapEl('#focus-key'); await page.waitForTimeout(500); await A.shot(`focus-${scheme}`); await A.tapEl('#focus-exit'); await page.waitForTimeout(300);
  check(A.errors.length === 0, `${scheme}: no console error or warning, page error, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once (light)');
{
  const A = await open('light');
  const { page, w, touch } = A;
  await A.tapEl('#btn-fit'); await setTime(A, 9, 20, 480);
  const PAD = 10, STEPS = 288;
  const stepOf = async () => { const r = await A.rect('#slider'); return { r, x: (k) => r.left + PAD + (k / STEPS) * (r.width - 2 * PAD), under: (x) => Math.max(0, Math.min(STEPS - 1, Math.round(((x - r.left - PAD) / (r.width - 2 * PAD)) * STEPS))) }; };
  const date = (await ST(A)).date;

  // the plate's height at the sheet's first stop, and in focus mode later
  const plate0 = (await A.rect('#plate')).height;
  check(plate0 >= 400, `390 × 844, the sheet at its first stop: the plate ${plate0.toFixed(0)} px tall (≥ 400)`);

  // the three-speed scrub, by real touches: the light and the cast shadows of one instant on every frame
  if (process.env.SCRUB !== '0') {
    const { r, x, under } = await stepOf(), y = r.top + 34;
    for (const speed of [2, 8, 20]) {
      const a = 96, b = 132, T = ((b - a) / speed) * 1000;
      await w(() => window.__besseggen.log(true));
      await touch('touchStart', x(a), y);
      const t0 = Date.now(); let sent = 0; const anims = [], moved = new Set([a]);
      for (;;) {
        const t = Date.now() - t0;
        if (t >= T) break;
        const fx = x(a) + ((x(b) - x(a)) * t) / T;
        await touch('touchMove', fx, y); sent++; moved.add(under(fx));
        if (sent % 25 === 0) anims.push(...await w(() => document.getAnimations().map((z) => z.effect && z.effect.target).filter((e) => e && e.closest('.valid, .lead, #slider')).map((e) => e.id || e.className)));
        await new Promise((res) => setTimeout(res, 16 - ((Date.now() - t0) % 16)));
      }
      await touch('touchMove', x(b), y);
      await touch('touchEnd');
      await page.waitForTimeout(400);
      const log = await w(() => window.__besseggen.log(false));
      const held = log.filter((f) => f.pressed && f.finger != null);
      let mismatch = 0, labelBad = 0, mixed = 0, first = null;
      for (const f of held) {
        const want = under(f.finger);
        if (f.shown !== want || f.wanted !== want) { mismatch++; if (!first) first = { finger: Math.round(f.finger * 10) / 10, want, wanted: f.wanted, shown: f.shown }; }
        if (f.label !== label(date, f.shown)) labelBad++;
      }
      for (const f of log) if (f.sun !== f.shadow) mixed++;
      const sw = sweepBad(log);
      const order = []; for (const f of held) if (!order.length || order[order.length - 1] !== f.shown) order.push(f.shown);
      const inOrder = order.every((v, i) => !i || v > order[i - 1]);
      // at 2 a second every step the finger rests on is drawn. A skipped step is excused only where the
      // finger itself never touched it: a touch move held up by SwiftShader's slow frame (about 4 a
      // second) arrives late, and its position, worked out from the clock, has moved on by then
      const skips = []; for (let i = 1; i < held.length; i++) for (let k = held[i - 1].shown + 1; k < held[i].shown; k++) skips.push([k, moved.has(k)]);
      const excused = skips.every(([, touched]) => !touched);
      const after = log.find((f, i) => i > 0 && !f.pressed && log[i - 1].pressed);
      const secs = held.length ? (held[held.length - 1].t - held[0].t) / 1000 : 0;
      const sweep = log.map((f) => f.ms);
      check(held.length > 0 && mismatch === 0 && labelBad === 0 && mixed === 0 && sw === 0 && inOrder && (speed > 2 || excused) && after && after.shown === b && anims.length === 0,
        `scrub at ${speed} steps a second (cast shadows swept once per new instant: ${sw} frames otherwise) (${sent} real touch moves, ${held.length} frames at ${(held.length / Math.max(secs, 1e-3)).toFixed(0)} a second): drawn = wanted = the step under the finger on every frame (${mismatch} differ${first ? ` first ${JSON.stringify(first)}` : ''}); the time row the drawn step's (${labelBad} differ); ${mixed} of ${log.length} frames with the sun of one step and the shadows of another (B3); ${order.length} steps drawn, in order: ${inOrder}${speed === 2 ? `, ${skips.length ? `skipped only where no touch move landed (${skips.map(([k, t]) => `${k}${t ? ' TOUCHED' : ''}`).join(', ')})` : 'none skipped'}` : ''}; the frame after the lift draws step ${after && after.shown} (want ${b}); ${anims.length} animations on the time row or track`);
      console.log(`      shadow sweep per frame (HEADLESS CHROMIUM, a trend only): median ${pctl(sweep, 0.5).toFixed(1)} ms, p95 ${pctl(sweep, 0.95).toFixed(1)} ms`);
    }
  }

  // play: every frame one whole step with its own shadows, never backwards; its mark; About; a touch
  {
    await setTime(A, 9, 20, 600);
    await w(() => window.__besseggen.log(true));
    await A.tapEl('#t-play'); await page.waitForTimeout(2500);
    const during = await playMarks(w);
    await A.shot('playing-light', false);
    await A.tapEl('#t-play'); await page.waitForTimeout(200);
    const log = (await w(() => window.__besseggen.log(false))).filter((f) => f.playing);
    const paused = await playMarks(w);
    let labelBad = 0, back = 0, mixed = 0;
    for (let i = 0; i < log.length; i++) { if (log[i].label !== label(date, log[i].shown)) labelBad++; if (i && log[i].shown < log[i - 1].shown) back++; if (log[i].sun !== log[i].shadow) mixed++; }
    const span = log.length ? log[log.length - 1].shown - log[0].shown : 0, iv = log.slice(1).map((f, i) => f.t - log[i].t);
    const sw = sweepBad(log), steps = new Set(log.map((f) => f.shown)).size;
    check(log.length >= 6 && labelBad === 0 && back === 0 && mixed === 0 && sw === 0 && log.length <= steps + 2 && span >= 12, `play at an hour a second: ${log.length} drawn frames over ${span} steps (${steps} distinct; a frame per step, not per refresh); the cast shadows swept once per step (${sw} frames otherwise); the time row the drawn step's (${labelBad} differ); never backwards (${back}); ${mixed} frames mixing two instants`);
    console.log(`      frame interval during play (HEADLESS CHROMIUM, SwiftShader, a trend only): median ${pctl(iv, 0.5).toFixed(0)} ms, p95 ${pctl(iv, 0.95).toFixed(0)} ms`);
    check(during === 'ico-play hidden none, ico-pause shown block, Pause' && paused === 'ico-play shown block, ico-pause hidden none, Play', `the Play key's mark follows play, by touch, as drawn: playing ${during}; paused ${paused}`);
    await A.tapEl('#t-play'); await page.waitForTimeout(400);
    await A.tapEl('#btn-about'); await page.waitForTimeout(250);
    const a0 = await ST(A); await page.waitForTimeout(800); const a1 = await ST(A);
    await page.keyboard.press('Escape'); await page.waitForTimeout(700);
    const a2 = await ST(A);
    check(a0.dialog === 'about' && a1.shown === a0.shown && !a1.playing && a2.playing && a2.shown > a1.shown && a2.dialog === null, `About holds play still (step ${a0.shown} to ${a1.shown} over 0.8 s) and play goes on once it closes (step ${a2.shown}, playing ${a2.playing})`);
    const { r, x } = await stepOf();
    await touch('touchStart', x(60), r.top + 34); await A.frame();
    const held = await ST(A); await touch('touchEnd'); await page.waitForTimeout(100);
    check(!held.playing && held.shown === 60, `a touch on the track during play stops it and draws the step under the finger: step ${held.shown} (want 60), playing ${held.playing}`);
  }

  // the day keys, and the date in the sheet
  {
    const d0 = (await ST(A)).date;
    await A.tapEl('#t-next'); await A.frame(); await page.waitForTimeout(100);
    const d1 = (await ST(A)).date, live = await w(() => document.getElementById('live').textContent);
    await A.tapEl('#t-prev'); await A.frame();
    const d2 = (await ST(A)).date;
    check(d1.d === d0.d + 1 && d2.d === d0.d && live === `${d1.d} September 2026` && (await ST(A)).sun === (await ST(A)).shadow, `Next day and Previous day: ${d0.d} Sep to ${d1.d} and back to ${d2.d}; the live region says "${live}"`);
  }

  // the plate holds still while the caption's words change (a new marker, a new day)
  {
    await w(() => { window.__ro = []; new ResizeObserver((es) => window.__ro.push(...es.map((e) => Math.round(e.contentRect.height)))).observe(document.getElementById('plate')); });
    // the observer reports once when it starts: wait for that, then count
    await page.waitForFunction(() => window.__ro.length > 0, null, { timeout: 10000 }); await A.frame(); await w(() => { window.__ro = []; });
    const c0 = (await ST(A)).caption;
    await w(([x, y]) => window.__besseggen.setMarker(x, y), [WP.bandet.x, WP.bandet.y]); await setTime(A, 12, 21, 600);
    const c1 = (await ST(A)).caption, ro = await w(() => window.__ro);
    check(ro.length === 0 && c0 !== c1, `the plate holds still while the caption's words change ("${c0.slice(0, 40)}…" to "${c1.slice(0, 50)}…"): ${ro.length} resizes of the plate`);
    await setTime(A, 9, 20, 480);
  }

  // the grip's three names at its stops; the camera's keys where the camera looks for them
  {
    const names = [];
    for (let i = 0; i < 3; i++) { names.push(await w(() => document.getElementById('grip').getAttribute('aria-label'))); if (i < 2) { await A.tapEl('#grip'); await page.waitForTimeout(200); } }
    const boat = await page.getByRole('button', { name: 'From the boat on Gjende', exact: true }).count();
    const fly = await page.getByRole('button', { name: 'Fly the route', exact: true }).count();
    const fit = await page.getByRole('button', { name: 'Fit the route', exact: true }).count();
    const plate2 = (await A.rect('#plate')).height, row = await w(() => document.getElementById('plate').classList.contains('keys-row'));
    await A.tapEl('#btn-fly'); await page.waitForTimeout(600);
    const stop = await page.getByRole('button', { name: 'Stop', exact: true }).count();
    await page.getByRole('button', { name: 'Stop', exact: true }).click(); await page.waitForTimeout(200);
    const flyAgain = await page.getByRole('button', { name: 'Fly the route', exact: true }).count();
    check(names.join('|') === 'Show more controls|Show all controls|Hide the extra controls' && boat === 1 && fly === 1 && fit === 1 && stop === 1 && flyAgain === 1 && plate2 >= 180,
      `the grip says ${names.join(', ')}; at the top stop: From the boat on Gjende ${boat}, Fly the route ${fly}, then Stop ${stop} while flying and Fly the route again ${flyAgain}; Fit the route ${fit} (keys ${row ? 'in a row' : 'in a column'}); the plate keeps ${plate2.toFixed(0)} px (≥ 180)`);
    await w(([a, b]) => window.__besseggen.runTool('measure', [a, b]), [[WP.veslfjellet.x, WP.veslfjellet.y], [WP.bandet.x, WP.bandet.y]]); await page.waitForTimeout(300);
    const cd = await w(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { c: r('card'), k: r('keys'), p: r('plate') }; });
    const clear = cd.c.top >= cd.k.bottom + 7.5 || cd.c.right <= cd.k.left || cd.c.bottom <= cd.k.top;
    check(clear && cd.c.height <= 0.4 * cd.p.height, `the card at the top stop: ${cd.c.height.toFixed(0)} px of a ${cd.p.height.toFixed(0)} px plate (≤ 40 %), ${clear ? 'clear of' : 'OVER'} the key row`);
    await page.waitForTimeout(300); await w(() => document.getElementById('card-close').click()); await page.waitForTimeout(100);
    const h = await hitTargets(w);
    check(h.bad.length === 0 && h.n >= 15, `hit targets ≥ 44 × 44 px with the sheet at its top stop: ${h.n} controls${h.bad.length ? '; too small: ' + h.bad.join('; ') : ''}`);
    await A.tapEl('#grip'); await page.waitForTimeout(200);
    await A.tapEl('#btn-fit'); await page.waitForTimeout(200);
    const h0 = await hitTargets(w);
    check(h0.bad.length === 0 && h0.n >= 12, `hit targets ≥ 44 × 44 px at the first stop: ${h0.n} controls${h0.bad.length ? '; too small: ' + h0.bad.join('; ') : ''}`);
  }

  // focus mode (HOUSE.md section 4.10)
  {
    await A.tapEl('#focus-key'); await page.waitForTimeout(450);
    const f1 = await w(() => {
      const gone = ['head', 'keys', 'legends', 'sheet'].map((id) => { const e = document.getElementById(id); return [id, e.hidden, e.inert]; });
      const vis = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return !e.closest('[hidden]') && r.height > 0; };
      return { gone, stay: ['btn-about', 'compass', 'cap', 't-date', 'slider', 't-play', 'focus-exit'].map((id) => [id, vis(id)]), live: document.getElementById('live').textContent, active: document.activeElement && document.activeElement.id, stampIn: document.getElementById('btn-about').parentElement.id, first: document.getElementById('caption').firstElementChild.id, plate: document.getElementById('plate').getBoundingClientRect().height };
    });
    const tree = await Promise.all(['Show more controls', 'Fit the route', 'Show the controls'].map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    check(f1.gone.every(([, h, i]) => h && i) && f1.stay.every(([, v]) => v) && f1.stampIn === 'caption' && f1.first === 'btn-about' && tree[0] === 0 && tree[1] === 0 && tree[2] === 1 && f1.plate >= 640,
      `focus mode by touch: the header, keys, legend rows and sheet hidden and inert (the grip ${tree[0]}, Fit the route ${tree[1]} in the accessibility tree); the About key moved into the caption, its first line; the instrument line, caption, time, track, Play and ghost key stay (${f1.stay.filter((x) => !x[1]).map((x) => x[0]).join(', ') || 'all'}); the plate ${plate0.toFixed(0)} to ${f1.plate.toFixed(0)} px (≥ 640)`);
    check(f1.live === 'Controls hidden. Press Escape or the corner key to show them.' && f1.active !== 'focus-exit', `the live region says "${f1.live}"; after a touch, focus stays put (active: ${f1.active || 'body'})`);
    const hf = await hitTargets(w);
    check(hf.bad.length === 0 && hf.n >= 5, `focus mode's hit targets ≥ 44 × 44 px: ${hf.n} controls${hf.bad.length ? '; too small: ' + hf.bad.join('; ') : ''}`);
    const { r, x } = await stepOf();
    await touch('touchStart', x(100), r.top + 34);
    for (let k = 100; k <= 120; k++) { await touch('touchMove', x(k), r.top + 34); await page.waitForTimeout(16); }
    await touch('touchEnd'); await page.waitForTimeout(200);
    const sc = await ST(A);
    await A.tapEl('#t-play'); await page.waitForTimeout(1200); await A.tapEl('#t-play'); await page.waitForTimeout(150);
    const pl = await ST(A);
    const pr = await A.rect('#plate');
    await A.tapAt(pr.left + pr.width / 2, pr.top + pr.height * 0.6); await page.waitForTimeout(700);
    const card = await ST(A);
    check(sc.shown === 120 && pl.shown > 120 && card.card === 'point' && card.focus, `in focus mode a scrub lands on step ${sc.shown} (want 120), play moves on to step ${pl.shown}, and a tap opens the card (${card.card})`);
    await A.tapEl('#focus-exit'); await page.waitForTimeout(300);
    const out1 = await ST(A), live2 = await w(() => document.getElementById('live').textContent);
    await w(() => document.getElementById('focus-key').focus());
    await page.keyboard.press('Enter'); await page.waitForTimeout(450);
    const k1 = await w(() => ({ focus: window.__besseggen.focus(), active: document.activeElement.id }));
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await page.waitForTimeout(300);
    const rl = await w(() => ({ focus: window.__besseggen.focus(), ghost: !document.getElementById('focus-exit').hidden, head: document.getElementById('head').hidden }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const esc = await w(() => ({ focus: window.__besseggen.focus(), active: document.activeElement.id }));
    await page.keyboard.press('f'); await page.waitForTimeout(400);
    const fk = await w(() => window.__besseggen.focus());
    await page.keyboard.press('f'); await page.waitForTimeout(400);
    const fk2 = await w(() => window.__besseggen.focus());
    check(!out1.focus && live2 === 'Controls shown.' && k1.focus && k1.active === 'focus-exit' && rl.focus && rl.ghost && rl.head && !esc.focus && esc.active === 'focus-key' && fk && !fk2,
      `focus mode leaves by the ghost key ("${live2}"), enters by Enter with focus on the ghost key (${k1.active}), survives a reload (besseggen:focus), leaves by Escape with focus back on its key (${esc.active}), and F toggles it (${fk}, then ${fk2})`);
    // the camera's double-tap at (0.5, 0.42) of the web view, in and out
    // the four touch events carry the browser's own timestamps, 80 ms apart, as a finger's would:
    // SwiftShader's slow frames would otherwise hold the second tap back past the 300 ms window
    const dbl = async () => {
      const t = Date.now() / 1000, ev = (type, dt) => A.cdp.send('Input.dispatchTouchEvent', { type, timestamp: t + dt, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y: 354 }] });
      await Promise.all([ev('touchStart', 0), ev('touchEnd', 0.04), ev('touchStart', 0.12), ev('touchEnd', 0.16)]);
      await page.waitForTimeout(700); return w(() => window.__besseggen.focus());
    };
    const d1 = await dbl(), d2 = await dbl();
    check(d1 && !d2, `the camera's double-tap at (0.5, 0.42) of the view puts focus mode on (${d1}) and takes it off again (${!d2})`);
  }

  // the marketing camera on a library left in focus mode: the ghost key named "Show the controls"
  // brings back the grip it taps
  {
    await w(() => window.__besseggen.setFocus(true)); await page.waitForTimeout(400);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 180000 }); await page.waitForTimeout(300);
    const zone = await page.getByText('CEST', { exact: false }).first().isVisible();
    const hidden = await page.getByRole('button', { name: 'Show more controls', exact: true }).count();
    const ghost = page.getByRole('button', { name: 'Show the controls', exact: true });
    const gn = await ghost.count(), gb = await ghost.boundingBox();
    await A.tapAt(gb.x + gb.width / 2, gb.y + gb.height / 2); await page.waitForTimeout(300);
    const shown = await page.getByRole('button', { name: 'Show more controls', exact: true }).count();
    const stored = await w(() => { try { return localStorage.getItem('besseggen:focus'); } catch { return 'unreadable'; } });
    check(zone && hidden === 0 && gn === 1 && gb.y >= 8 && shown === 1 && stored === 'false', `the camera's way out of a library left in focus mode: CEST visible (${zone}), the grip gone (${hidden}); one key named Show the controls at ${Math.round(gb.x)}, ${Math.round(gb.y)}; after a tap the grip is back (${shown}) and besseggen:focus is ${stored}`);
  }

  // hidden: play and the fly-through stop
  {
    await A.tapEl('#t-play'); await page.waitForTimeout(300);
    await w(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
    const s = await ST(A);
    await w(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    check(!s.playing, `hidden: play stops (playing ${s.playing}), and the state is saved`);
  }

  // About: from the stamp, every source and the face's credit, Escape closes it
  {
    await A.tapEl('#btn-about'); await page.waitForTimeout(400);
    const ab = await w(() => ({ text: document.getElementById('about').textContent, open: !document.getElementById('about').hidden }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const closed = await w(() => document.getElementById('about').hidden);
    const want = ['Not a navigation tool.', 'Nasjonal høydemodell DTM1', 'Turrutebasen', 'N50 Kartdata', 'Sentralt stedsnavnregister', 'three.js r186', 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.', 'sunshine recorder', 'not a forecast', 'Gjende 985.1'];
    const missing = want.filter((t) => !ab.text.includes(t));
    check(ab.open && closed && missing.length === 0, `About opens from the About key with every source, the face's credit and what the Burn is and is not, and closes on Escape${missing.length ? '; MISSING: ' + missing.join(', ') : ''}`);
  }
  check(A.errors.length === 0, `once: no console error or warning, page error, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* Reduce Motion: every duration 0 s, play in whole hours, the fly-through stepped */
console.log('\n== reduce motion (dark)');
{
  const A = await open('dark', { reduced: true });
  const { page, w } = A;
  const fly = await page.getByRole('button', { name: 'Step to the next point', exact: true }).count().catch(() => 0);
  await setTime(A, 9, 20, 360);
  await w(() => window.__besseggen.log(true));
  await A.tapEl('#t-play'); await page.waitForTimeout(3300); await A.tapEl('#t-play');
  const log = (await w(() => window.__besseggen.log(false))).filter((f) => f.playing);
  const steps = [...new Set(log.map((f) => f.shown))], sw = sweepBad(log);
  const hours = steps.every((s) => (s - steps[0]) % 12 === 0);
  const durs = await w(() => { const e = document.querySelector('.card'); const cs = getComputedStyle(document.querySelector('.dlg-panel')); return [cs.animationDuration, getComputedStyle(e).animationDuration]; });
  await A.tapEl('#grip'); await page.waitForTimeout(200);
  const fly2 = await page.getByRole('button', { name: 'Step to the next point', exact: true }).count();
  check(hours && steps.length >= 3 && sw === 0 && log.length <= steps.length + 2 && durs.every((d) => d === '0s') && fly2 === 1, `Reduce Motion: play in whole hours (steps ${steps.join(', ')}; ${log.length} frames, ${sw} sweeps without a new hour); About's and the card's animations ${durs.join(', ')}; the fly key says Step to the next point (${fly2}; ${fly} before the sheet opened)`);
  await A.shot('reduced-dark', false);
  check(A.errors.length === 0, `reduce motion: no console error${A.errors.length ? ': ' + A.errors.join(' | ') : ''}`);
  await A.ctx.close();
}

/* Broken data: each a sentence on the plate, in the file's terms */
console.log('\n== broken data');
{
  const cases = [
    ['a missing level file', { '/data/terrain-L3.bin': { status: 404 } }, /terrain-L3|404/, (e) => e.notice === 'data/terrain-L3.bin could not be read (HTTP 404).' && e.stamp === 'Besseggen could not start.' && e.gone && e.boot],
    ['data/pace.json not JSON', { '/data/pace.json': { body: '<html>Bad gateway</html>' } }, null, (e) => e.notice === "data/pace.json could not be read (not valid JSON); the app's own copy is used." && e.ready],
    ['no data/rivers.geojson (optional)', { '/data/rivers.geojson': { status: 404 } }, /rivers|404/, (e) => e.hidden && e.ready],
  ];
  for (const [name, ov, expect, good] of cases) {
    override = ov;
    const A = await open('light', { noWait: true, expect: expect || undefined });
    await A.page.waitForFunction(() => !document.getElementById('notice').hidden || (window.__besseggen && /CES?T/.test(document.getElementById('t-zone').textContent)), null, { timeout: 120000 });
    await A.page.waitForTimeout(500);
    const e = await A.w(() => ({ notice: document.getElementById('notice').textContent, hidden: document.getElementById('notice').hidden, stamp: document.getElementById('stamp').textContent,
      ready: !!window.__besseggen, gone: ['keys', 'sheet', 'player'].every((id) => document.getElementById(id).hidden), boot: [...document.querySelectorAll('[data-boot]')].every((x) => x.hasAttribute('hidden')), home: !document.getElementById('stamp-home').hidden }));
    const errs = A.errors.filter((x) => !(name.startsWith('a missing') && /^error: Error: data\/terrain-L3\.bin/.test(x)));
    check(good(e) && (e.ready || e.home) && errs.length === 0, `${name}: ${e.hidden ? 'no notice' : `"${e.notice}"`}; the stamp's line shows "${e.stamp}"; the app ${e.ready ? 'runs' : 'stops, its keys, sheet and player gone'}${errs.length ? '; ' + errs.join(' | ') : ''}`);
    await A.ctx.close();
  }
  override = {};
}

/* Widths and zoom: nothing scrolls sideways; the caption's longest sentence fits its fixed height */
console.log('\n== widths');
for (const [w0, h0, dpr, name] of [[320, 568, 2, '320'], [360, 780, 3, '360'], [375, 812, 3, '375'], [844, 390, 3, '844 × 390'], [1024, 768, 2, '1024 × 768'], [312, 675, 2.5, '125 % zoom (312 × 675)']]) {
  const A = await open('light', { w: w0, h: h0, dpr });
  const m = await A.w(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, player: document.getElementById('player').getBoundingClientRect().bottom, ih: innerHeight, plate: document.getElementById('plate').getBoundingClientRect().height, keysRow: document.getElementById('plate').classList.contains('keys-row'), keysH: document.getElementById('keys').getBoundingClientRect().height, sheetW: document.getElementById('sheet').getBoundingClientRect().width, sub: (() => { const e = document.getElementById('scale-sub'); return [e.textContent, e.scrollWidth, e.clientWidth]; })() }));
  const h = await hitTargets(A.w);
  // the caption at every waypoint on four dates, as the data writes it
  const fit = [];
  for (const p of Object.values(WP)) {
    await A.w(([x, y]) => window.__besseggen.setMarker(x, y), [p.x, p.y]);
    for (const [mo, d] of [[6, 14], [9, 20], [12, 21], [3, 1]]) {
      await setTime(A, mo, d, 600);
      fit.push(await A.w(() => { const e = document.querySelector('.capbox'), c = document.getElementById('cap'); return [c.scrollHeight, e.clientHeight, c.textContent.length]; }));
    }
  }
  const longest = fit.reduce((a, b) => (b[2] > a[2] ? b : a));
  check(fit.every(([sh, ch]) => sh <= ch), `${name}: the caption at six waypoints on four dates fits its fixed height (the longest, ${longest[2]} characters, ${longest[0]} in ${longest[1]} px)`);
  // the sheet's foot: the totals with the steep key, beside the direction key, no taller than the sentence it replaced
  // (measured 2026-10-07: "… Red: 25 % or steeper." took 45 px, three lines, in a sheet 320 and 360 px wide, 30 at 390); the key's swatch is the profile's steep stroke
  const ft = await A.w(() => { const f = document.querySelector('.foot'), k = f.querySelector('.k'), sw = getComputedStyle(k.querySelector('.sw')).backgroundColor, ps = document.querySelector('#profile .psteep');
    return { h: f.getBoundingClientRect().height, kh: k.getBoundingClientRect().height, t: k.textContent, same: !!ps && getComputedStyle(ps).stroke === sw, sw: document.getElementById('sheet').getBoundingClientRect().width, p: document.getElementById('s-updown').parentElement.getBoundingClientRect().height }; });
  check(ft.h <= (ft.sw < 389 ? 45.5 : 44.5) && ft.kh <= 16 && ft.t === '25\u202f% or steeper' && ft.same, `${name}: the sheet's foot ${ft.h.toFixed(0)} px (its words ${ft.p.toFixed(0)} px), the steep key "${ft.t}" on one line in the profile's own red (${ft.same})`);
  // the instrument line's words whole, never an ellipsis (QA 2026-10-01: at 844 x 390 they ran into the credits)
  check(m.sub[1] <= m.sub[2], `${name}: the scale's words whole, "${m.sub[0]}" ${m.sub[1]} px in ${m.sub[2]}`);
  // every label the profile shows inside its strip, the top edge included (the final review: "1 900 m" was cut at the top)
  const pl = await A.w(() => { const s = document.getElementById('profile').getBoundingClientRect(); return { h: s.height, l: [...document.querySelectorAll('#profile text')].filter((e) => e.style.display !== 'none').map((e) => { const r = e.getBoundingClientRect(); return [e.textContent, r.left - s.left, r.top - s.top, s.right - r.right, s.bottom - r.bottom]; }) }; });
  const cut = pl.l.filter((l) => l.slice(1).some((d) => d < -0.5)), top = pl.l.reduce((a, b) => (b[2] < a[2] ? b : a), ['', 99, 99]);
  check(pl.h > 0 && pl.l.length >= 10 && cut.length === 0, `${name}: the profile's ${pl.l.length} labels inside its ${Math.round(pl.h)} px strip, the topmost "${top[0]}" ${top[2].toFixed(1)} px from its top${cut.length ? '; CUT: ' + cut.map((l) => `"${l[0]}"`).join(', ') : ''}`);
  if (name === '844 × 390') {
    // the readout says true scale in words, and the slider keeps its length when the value leaves 1.0 (a longer "×1.0, true scale" moved it 14 px)
    const ex = await A.w(() => { const e = document.getElementById('exag'), o = document.getElementById('exag-out'), r = []; for (const v of ['1', '1.1', '3']) { e.value = v; e.dispatchEvent(new Event('input')); r.push([o.textContent, Math.round(e.getBoundingClientRect().width)]); } e.value = '1'; e.dispatchEvent(new Event('input')); return r; });
    check(ex[0][0] === 'True scale' && ex[1][0] === '×1.1' && ex.every((x) => x[1] === ex[0][1] && x[1] > 100), `the vertical exaggeration reads ${ex.map((x) => `"${x[0]}"`).join(', ')}, the slider ${ex[0][1]} px long at each`);
  }
  if (name === '844 × 390') check(m.plate >= 220 && (!m.keysRow || m.keysH <= 40), `a phone on its side: the plate ${m.plate.toFixed(0)} px tall (≥ 220), the sheet a column ${m.sheetW.toFixed(0)} px wide${m.keysRow ? `, the keys one row ${m.keysH.toFixed(0)} px high` : ', the key column fits'}`);
  check(m.sw <= m.iw && m.player <= m.ih + 0.5 && m.plate >= 120 && h.bad.length === 0 && A.errors.length === 0,
    `${name}: page ${m.sw} px wide in ${m.iw}; the player ends at ${m.player.toFixed(0)} of ${m.ih}; the plate ${m.plate.toFixed(0)} px tall; ${h.n} hit targets ≥ 44${h.bad.length ? '; too small: ' + h.bad.join('; ') : ''}${A.errors.length ? '; ' + A.errors.join(' | ') : ''}`);
  if (w0 > h0) {
    // focus mode where the sheet is a column: the plate grows, and the About key, the caption and the time stay on screen
    await A.w(() => window.__besseggen.setFocus(true)); await A.page.waitForTimeout(450);
    const f = await A.w(() => ({ plate: document.getElementById('plate').getBoundingClientRect().height, out: ['btn-about', 'cap', 't-date'].filter((id) => { const r = document.getElementById(id).getBoundingClientRect(); return !(r.width > 0 && r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5); }) }));
    await A.shot(`focus-${w0}x${h0}`, false);
    check(f.plate > m.plate && f.out.length === 0, `${name} in focus mode: the plate ${m.plate.toFixed(0)} to ${f.plate.toFixed(0)} px; the About key, the caption and the time on screen${f.out.length ? '; OFF SCREEN: ' + f.out.join(', ') : ''}`);
    await A.w(() => window.__besseggen.setFocus(false)); await A.page.waitForTimeout(300);
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
