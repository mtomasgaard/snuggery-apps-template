// Drive Shelf Atlas in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through CDP),
// light and dark (HOUSE.md section 7.2; step 22 of the pass's change list, in tools/DECISIONS.md). Fails on
// any console error or warning, page error, failed request, HTTP ≥ 400, or any request outside the local
// server. Every figure it asserts is worked out here from the shipped files with Node's own tools (the
// series, each unit's rate and best month, the totals, the formats), never by importing js/.
//
// FRAME, MONTH AND LOAD TIMES ARE HEADLESS CHROMIUM ON THIS MAC: a trend only, never phone evidence.
// The phone's frame rate, memory and battery are the owner's checks.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCRUB=0 node tools/shoot.mjs            skip the three-speed scrub
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the scenes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's strings by role and name, the credit line whole, the face), text contrast
// and the tracer, the ring sampler (rendered rings against the same pixels with the rings off) and the
// ring count against this file's own, the card against this file's decode for Statfjord, Brent and Johan
// Sverdrup, the lead against this file's sum, SI in every visible text node, the scenes as pictures.
// Once: the real-touch scrub at 2, 8 and 20 months a second, play (stopping at the common month), the
// year keys, the plate holding still while the caption changes, the card clear of the tapped point,
// names clear of the card and the keys, focus mode end to end with the camera's way out, the units key,
// Find, the Layers sheet, a Norwegian platform's repaired name, hidden, hit targets in both modes and
// with a sheet open, About, Reduce Motion, broken data and the widths. Pictures: tools/.work/shots/,
// and with SCREENSHOTS=1 screenshots/*-{light,dark}.png; never screenshots/app.png, the README's composite.

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

/* ── the data, decoded here (js/data.js's contract) ── */
const snap = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(path.join(APP, 'data/geo.json'), 'utf8'));
const decode = (s) => { if (!s) return null; const b = Buffer.from(s.b64, 'base64'); const v = []; for (let i = 0; i + 1 < b.length; i += 2) v.push(b.readUInt16LE(i) * s.scale); return { start: s.start, v }; };
const FS = new Map(snap.fields.map((f) => [f.id, { f, liq: decode(f.liq), gas: decode(f.gas) }]));
const at = (S, m) => (S && m >= S.start && m < S.start + S.v.length ? S.v[m - S.start] : 0);
const days = (m) => new Date(Date.UTC(1971 + Math.floor(m / 12), (m % 12) + 1, 0)).getUTCDate();
const inGroup = new Set(snap.groups.flatMap((g) => g.members));
const UNITS = [...snap.fields.filter((f) => !inGroup.has(f.id)).map((f) => ({ name: f.name, ids: [f.id] })), ...snap.groups.map((g) => ({ name: g.name, ids: g.members }))];
const last = {}, first = {};
for (const { f, liq, gas } of FS.values()) for (const S of [liq, gas]) if (S) { last[f.country] = Math.max(last[f.country] ?? -1, S.start + S.v.length - 1); first[f.country] = Math.min(first[f.country] ?? 1e9, S.start); }
const rep = (c, m) => first[c] != null && m >= first[c] && m <= last[c];
const COMMON = Math.min(...Object.values(last));
// the newest month any country has reported (Denmark's, alone, in both builds of the data so far); the app's track ends there
const LAST = snap.lastMonth;
/** A unit's daily rate of liquids in month m, or null when one of its countries has not reported m. */
const rateOf = (U, m) => (U.ids.every((id) => rep(FS.get(id).f.country, m)) ? U.ids.reduce((a, id) => a + at(FS.get(id).liq, m), 0) / days(m) : null);
function bestOf(U, m) { let b = 0, bm = -1; for (let k = 0; k <= m; k++) { const v = rateOf(U, k); if (v != null && v > b) { b = v; bm = k; } } return bm < 0 ? null : { v: b, m: bm }; }
// the scale's top: each unit's second-highest month, the largest of those (js/data.js says why)
const HI = Math.max(...UNITS.map((U) => { const r = []; for (let m = 0; m <= snap.lastMonth; m++) r.push(U.ids.reduce((a, id) => a + at(FS.get(id).liq, m), 0) / days(m)); return r.sort((a, b) => b - a)[1]; }));
const FLOOR = HI * (3 / 17) ** 2;
const uByName = (n) => UNITS.find((U) => U.name.toLowerCase() === n.toLowerCase());

/* ── formats, written here again (HOUSE.md section 6) ── */
const NN = ' ';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mon = (m) => `${MON[m % 12]} ${1971 + Math.floor(m / 12)}`;
const monLong = (m) => `${MONTHS[m % 12]} ${1971 + Math.floor(m / 12)}`;
const grp = (s) => (s.length > 3 ? s.replace(/\B(?=(\d{3})+$)/g, NN) : s);
function sig3(v) {
  if (v === 0) return '0';
  for (const [d, w] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']]) if (v >= d * 0.9995) { const x = v / d; return `${x.toFixed(x >= 99.95 ? 0 : x >= 9.995 ? 1 : 2)} ${w}`; }
  const e = Math.floor(Math.log10(v)), r = Math.round(v / 10 ** (e - 2)) * 10 ** (e - 2);
  return e >= 2 ? grp(String(Math.round(r))) : String(Number(r.toFixed(2 - e)));
}
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
  return { w, h, px, at: (x, y) => { const i = (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4; return [px[i], px[i + 1], px[i + 2]]; } };
}

/* ── the server: the app folder, with any file replaceable ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.md': 'text/markdown', '.txt': 'text/plain' };
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
const browser = await chromium.launch();
console.log(`headless Chromium ${browser.version()}: every load, frame and month time below is a trend on this Mac, not phone evidence`);

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const ready = () => window.__sa && window.__sa.ready();

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  if (o.init) await ctx.addInitScript(o.init);
  const page = await ctx.newPage(), errors = [];
  const excused = (t) => o.expect && o.expect.test(t);
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${r.url().slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  if (!o.noWait) { await page.waitForFunction(ready, null, { timeout: 60000 }); await page.waitForTimeout(250); }
  const ms = Date.now() - t0;
  const w = (fn, arg) => page.evaluate(fn, arg);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tapAt = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd'); };
  const rect = (sel) => w((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
  // a control in a scrolling sheet is brought into view first, as a finger would scroll to it
  const tapEl = async (sel) => { await w((s) => document.querySelector(s).scrollIntoView({ block: 'nearest' }), sel); const r = await rect(sel); await tapAt(r.left + r.width / 2, r.top + r.height / 2); };
  const frame = () => w(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  const png = async (clip) => decodePng(await page.screenshot(clip ? { clip } : {}));
  const shot = async (name, keep = true) => {
    await page.waitForTimeout(250);
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    if (keep && KEEP) { if (`${name}.png` === 'app.png') throw new Error('never screenshots/app.png'); fs.copyFileSync(p, path.join(SHOTS, `${name}.png`)); }
    console.log(`      ${name}.png${keep && KEEP ? ' → screenshots/' : ''}`);
  };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, tapEl, rect, frame, png, shot };
}
const ST = (A) => A.w(() => window.__sa.stats());
const setMonth = async (A, m) => { await A.w((k) => window.__sa.setMonth(k), m); await A.frame(); };
const text = (A, id) => A.w((i) => document.getElementById(i).textContent, id);
/** The Play key's marks as drawn: the hidden attribute and the computed display, never an expando. */
const playMarks = (w) => w(() => ['ico-play', 'ico-pause'].map((id) => { const e = document.getElementById(id); return `${id} ${e.hasAttribute('hidden') ? 'hidden' : 'shown'} ${getComputedStyle(e).display}`; }).concat(document.getElementById('btn-play').getAttribute('aria-label')).join(', '));
const N = snap.lastMonth + 1;
/** The x of month k on the track, in page CSS px (js/track.js: 10 px in from each end). */
const trackX = (r, k) => r.left + 10 + (k / (N - 1)) * (r.width - 20);

/* Text contrast over every rendered DOM text node (backgrounds composited). */
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
    let op = 1; for (let x = e; x; x = x.parentElement) op *= +getComputedStyle(x).opacity;
    const c = ratio(over([...rgba(cs.color).slice(0, 3), rgba(cs.color)[3] * op], bgOf(e)), bgOf(e));
    n++;
    if (c < worst[0]) worst = [c, `${e.id || e.className || e.tagName} "${t.textContent.trim().slice(0, 24)}"`];
  }
  return { n, worst: [Math.round(worst[0] * 100) / 100, worst[1]] };
});
const hitTargets = (w) => w(() => {
  const bad = [], seen = [];
  for (const e of document.querySelectorAll('button, [role="slider"], [role="radio"], input, canvas.chart')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.closest('[inert]') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    // a control partly scrolled out of view (the row of words, the sheet) is measured where it is wholly in view
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !at(cx, cy)) continue;
    const sc = e.closest('.switcher, .sheet-body, .about-body, .find-list');
    if (sc) { const s = sc.getBoundingClientRect(); if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) continue; }
    seen.push(e.id || (e.textContent || '').trim().slice(0, 12));
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 280 && at(cx + (s * k * dx) / 4, cy + (s * k * dy) / 4); k++) n++; return n / 4; };
    const okV = run(0, 1) >= 43.5, okH = run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Every visible text node: a hyphen-minus before a digit, a plain space between a number and a unit,
 *  or five or more digits ungrouped (years, ids and the data's own names and terms excepted). */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[  ](Sm³|bbl|scf|boe|km|mm|in|%|m|px)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    // the regulators' ids, names, sources and statuses are data, printed as the data writes them
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, .src, #about-sources, #card-name, .find-list .name')) continue;
    if (e.closest('dd') && /^(Id|Regulator id|Operator|Field)$/.test((e.previousElementSibling || {}).textContent || '')) continue;
    const s = t.textContent;
    n++;
    const groups = s.replace(/\b(19|20)\d\d\b|[A-Z]{2}-\S+/g, '').match(/\d{5,}|\b\d{4}\b(?![.\d])/g);
    if (/(^|[^\w])-\d/.test(s) || UNIT.test(s) || groups) bad.push(s.trim().slice(0, 50));
  }
  return { n, bad };
});

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
const statfjord = uByName('Statfjord'), brent = uByName('BRENT'), sverdrup = uByName('JOHAN SVERDRUP');
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the first frame: ${A.ms} ms (headless)`);

  // boot: the camera's strings, the credit line whole, the face, the month it opens on
  {
    const buttons = await Promise.all(['Play', 'Back one year', 'Forward one year', 'Hide the controls', 'Find a field', 'Zoom in', 'Zoom out', 'Whole North Sea', 'Map layers'].map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    const radios = await Promise.all(['Rate', 'Cumulative', 'Liquids', 'Gas', 'Oil equivalent'].map((n) => page.getByRole('radio', { name: n, exact: true }).count()));
    const slider = await page.getByRole('slider', { name: 'Month', exact: true }).count();
    const b = await w(() => {
      const c = document.getElementById('about-credit-line');
      // the stamp is one line, 16 px, in every state updateStamp() can write (HOUSE.md 7.2), the longest included
      const st = document.getElementById('stamp'), was = [...st.childNodes];
      const lines = ['Reading the data\u2026 1 of 2', 'No data could be read', 'Updated 05:34, figures to Jun 2026', 'Map only. Updated 22 Sep, 05:34', 'Stale. Updated 22 Sep, 05:34, figures to Jun 2026', 'Stale. Map only. Updated 22 Sep, 05:34']
        .map((t) => { st.textContent = t; return [t, st.getBoundingClientRect().height]; });
      st.replaceChildren(...was);
      return { lines, credits: c.textContent, whole: !document.getElementById('credits') && c.previousElementSibling.textContent === 'Sources and credits', font: document.fonts.check('560 11.5px "Ysabeau Office"'),
        family: getComputedStyle(document.body).fontFamily, stamp: document.getElementById('stamp').textContent, valid: document.getElementById('valid-time').textContent };
    });
    check(buttons.every((n) => n === 1) && radios.every((n) => n === 1) && slider === 1, `the camera's controls by role and name: buttons ${buttons.join(',')}, radios ${radios.join(',')}, the slider ${slider}`);
    check(b.credits === 'Natural Earth · Marine Regions CC BY · EMODnet CC BY · Sodir NLOD · NSTA · Danish Energy Agency · NLOG' && b.whole, `no #credits on the front; the credit line is About's first Sources and credits paragraph, whole: "${b.credits}"`);
    check(b.lines.every(([, h]) => Math.abs(h - 16) <= 1), `the stamp is one line in every state it can show: ${b.lines.map(([t, h]) => `"${t}" ${h.toFixed(0)} px`).join(', ')}`);
    check(b.font && /^"?Ysabeau Office"?/.test(b.family), `the face is loaded (${b.family.split(',')[0]})`);
    check(b.stamp.startsWith('Updated') && b.stamp.endsWith(`figures to ${mon(COMMON)}`) && b.valid === mon(COMMON), `it opens on ${b.valid}, the newest month every country has reported (B2); the stamp "${b.stamp}"`);
  }
  // text contrast, and the tracer under exactly the chosen words
  {
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5, `text contrast: ${c.n} text nodes, the lowest ${c.worst[0]}:1 (${c.worst[1]})`);
    const tr = await w(() => [...document.querySelectorAll('.words button')].map((b) => [b.textContent, b.getAttribute('aria-checked') === 'true', getComputedStyle(b, '::after').content !== 'none']));
    check(tr.every(([, on, has]) => on === has) && tr.filter(([, on]) => on).map(([t]) => t).join(',') === 'Liquids,Rate', `the tracer under exactly the chosen words: ${tr.filter(([, , h]) => h).map(([t]) => t).join(', ')}`);
  }
  // the Peaks: the count against this file's, and the rendered rings against the same pixels with the rings off
  for (const m of [COMMON, (1985 - 1971) * 12 + 5]) {
    await A.w(() => window.__sa.home()); await setMonth(A, m); await A.frame();
    const own = UNITS.filter((U) => { const b = bestOf(U, m); return b && b.v >= FLOOR && U.ids.every((id) => rep(FS.get(id).f.country, m)); }).length;
    const rings = await w(() => window.__sa.rings());
    const plate = await A.rect('#map-wrap'), keys = await A.rect('#keys');
    const on = await A.png();
    await w(() => window.__sa.setLayer('peaks', false)); await A.frame(); await A.frame();
    const off = await A.png();
    await w(() => window.__sa.setLayer('peaks', true)); await A.frame();
    const samples = [];
    for (const [, r, sx, sy] of rings) {
      for (let a = 0; a < 16; a++) {
        const x = plate.left + sx + r * Math.cos((a * Math.PI) / 8), y = plate.top + sy + r * Math.sin((a * Math.PI) / 8);
        if (x < plate.left + 2 || y < plate.top + 2 || x > plate.right - 2 || y > plate.bottom - 2) continue;
        if (x > keys.left - 4 && y < keys.bottom + 4) continue;
        let best = 0;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const X = Math.round(x * 2) + dx, Y = Math.round(y * 2) + dy;
          best = Math.max(best, contrast(on.at(X, Y), off.at(X, Y)));
        }
        samples.push(best);
      }
    }
    const at3 = samples.filter((s) => s >= 3).length / samples.length;
    check(rings.length === own && at3 >= 0.9, `the Peaks at ${mon(m)}: ${rings.length} rings (this file's count ${own}); ${samples.length} samples of drawn rings against the same pixels with the rings off, ${(at3 * 100).toFixed(1)} % at 3:1 or more, the lowest ${Math.min(...samples).toFixed(2)} (an antialiased edge where a ring crosses another ring's ink)`);
  }
  await A.w(() => window.__sa.home()); await setMonth(A, COMMON);
  // inside a ring the disc is drawn at its true size, never at the 1.6 px floor, so the ring reads as
  // full as the data says (after review); a ringless disc keeps the floor
  {
    const rings = await w(() => window.__sa.rings());
    let n = 0, floored = 0, worst = 0;
    for (const [name, r, , , d] of rings) {
      const U = uByName(name), v = U && rateOf(U, COMMON), b = U && bestOf(U, COMMON);
      if (!v || !b) continue;
      n++;
      if (17 * Math.sqrt(v / HI) < 1.6) floored++;
      worst = Math.max(worst, Math.abs((d / r) ** 2 - v / b.v));
    }
    check(n > 100 && floored > 20 && worst < 0.002, `the disc in its ring: ${n} producing rings at ${mon(COMMON)}, ${floored} of them with a disc under the 1.6 px floor, each drawn at its true size: drawn share of the ring's area against this file's month / best, worst difference ${worst.toFixed(4)}`);
  }
  // a tap at a ring's center opens that field, not a small neighbor; a tap on a small disc opens it
  {
    const plate = await A.rect('#map-wrap'), got = [];
    for (const name of ['Statfjord', 'Brent', 'Oseberg', 'Ekofisk', 'Barnacle']) {
      const at = await w((n) => window.__sa.at(n), name);
      if (!at) { got.push([name, 'not drawn']); continue; }
      await A.tapAt(plate.left + at[0], plate.top + at[1]); await A.frame(); await page.waitForTimeout(350);
      got.push([name, await text(A, 'card-where'), at[3] ? `ring ${at[3].toFixed(1)} px` : `disc ${at[2].toFixed(1)} px`]);
      await A.tapEl('#card-close'); await A.frame(); await page.waitForTimeout(350);
    }
    check(got.every(([n, wh]) => wh.toLowerCase().startsWith(`${n.toLowerCase()},`)), `by touch at the opening view, a tap at each center opens that field: ${got.map(([n, wh, k]) => `${n} (${k}) → "${wh}"`).join('; ')}`);
  }
  // the lead against this file's sum
  {
    let sum = 0, n = 0;
    for (const U of UNITS) { const v = rateOf(U, COMMON); if (v > 0) { sum += v; n++; } }
    const lead = await text(A, 'lead');
    check(lead === `${sig3(sum)}${NN}Sm³/d, ${grp(String(n))} fields`, `the lead at ${mon(COMMON)}: "${lead}" (this file: ${Math.round(sum)} Sm³/d over ${n} fields)`);
  }
  // the card against this file's decode, for three fields
  for (const U of [statfjord, brent, sverdrup]) {
    await w((n) => window.__sa.pick(n), U.name); await page.waitForTimeout(700); await A.frame();
    const c = await w(() => ({ v: document.getElementById('card-value').textContent, u: document.getElementById('card-unit').textContent, rows: [...document.querySelectorAll('#card-rows dt')].map((d) => [d.textContent, d.nextElementSibling.textContent]), where: document.getElementById('card-where').textContent }));
    const v = rateOf(U, COMMON), b = bestOf(U, COMMON);
    const best = (c.rows.find((r) => r[0] === 'Best month so far') || [])[1];
    check(c.v === sig3(v) && c.u === `${NN}Sm³/d` && best === `${sig3(b.v)}${NN}Sm³/d, ${mon(b.m)}`,
      `${U.name}: the card reads ${c.v}${c.u}, best month so far "${best}" (this file: ${Math.round(v)} Sm³/d; best ${Math.round(b.v)} in ${mon(b.m)})`);
  }
  await A.shot(`card-${scheme}`);
  await w(() => window.__sa.home()); await A.tapEl('#card-close'); await A.frame();
  // SI in every visible text node, with the details sheet of a cross-border unit open
  {
    await w(() => window.__sa.pick('Statfjord')); await page.waitForTimeout(700);
    await A.tapEl('#card-act'); await A.frame(); await page.waitForTimeout(200);
    const si = await siOf(w), cd = await contrastOf(w);
    check(cd.worst[0] >= 4.5, `text contrast with the details sheet and the card's field selected: ${cd.n} text nodes, the lowest ${cd.worst[0]}:1 (${cd.worst[1]})`);
    check(si.bad.length === 0, `SI: ${si.n} visible text nodes with Statfjord's details open, no hyphen-minus before a digit, U+202F before every unit, numbers grouped${si.bad.length ? ': ' + si.bad.slice(0, 6).join(' | ') : ''}`);
    await A.shot(`details-${scheme}`);
    await A.tapEl('#details-close'); await A.tapEl('#card-close');
    await w(() => window.__sa.home());
  }
  // the scenes
  await setMonth(A, COMMON); await A.shot(`open-${scheme}`);
  await setMonth(A, (1990 - 1971) * 12 + 5); await A.shot(`1990-${scheme}`);
  await A.tapEl('#mode [data-m="cum"]'); await A.frame(); await A.shot(`cumulative-${scheme}`); await A.tapEl('#mode [data-m="rate"]');
  await setMonth(A, COMMON);
  await A.tapEl('#btn-layers'); await A.frame();
  { const cl = await contrastOf(w); check(cl.worst[0] >= 4.5, `text contrast with the Layers sheet open: ${cl.n} text nodes, the lowest ${cl.worst[0]}:1 (${cl.worst[1]})`); }
  await A.shot(`layers-${scheme}`); await A.tapEl('#layers-close');
  await A.tapEl('#stamp'); await page.waitForTimeout(300);
  { const ca = await contrastOf(w); check(ca.worst[0] >= 4.5, `text contrast in About: ${ca.n} text nodes, the lowest ${ca.worst[0]}:1 (${ca.worst[1]})`); }
  await page.keyboard.press('Escape');
  check(A.errors.length === 0, `no console error or warning, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once (light)');
{
  const A = await open('light');
  const { page, w } = A;

  // frame times, printed and never asserted: headless Chromium on this Mac, a trend and not phone evidence
  {
    await w(() => window.__sa.home()); await setMonth(A, COMMON);
    const t = await w(() => { const warm = [], cold = []; for (let i = 0; i < 20; i++) warm.push(window.__sa.render()); for (let i = 0; i < 5; i++) cold.push(window.__sa.renderCold()); return { warm, cold }; });
    const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1].toFixed(1);
    console.log(`    frame times (headless, not phone evidence): a month's frame ${med(t.warm)} ms (median of 20), with the basemap redrawn ${med(t.cold)} ms (median of 5)`);
  }

  // the scrub by real touch: 2, 8 and 20 months a second, a move every 16 ms
  if (process.env.SCRUB !== '0') {
    for (const [rate, from, to] of [[2, 300, 308], [8, 100, 140], [20, 400, 500]]) {
      await setMonth(A, from);
      const tr = await A.rect('#slider'), y = tr.top + tr.height / 2;
      await w(() => window.__sa.log(true));
      const s0 = await ST(A), t1 = Date.now();
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
      const log = await w(() => window.__sa.log(false));
      const s1 = await ST(A), el = Date.now() - t1;
      const bad = log.filter((e) => e.shown !== e.wanted || e.label !== mon(e.shown) || e.now !== e.shown);
      const seq = log.map((e) => e.shown), steps = new Set(seq);
      const ordered = seq.every((s, i) => !i || s >= seq[i - 1]);
      const every = rate !== 2 || Array.from({ length: to - from }, (_, i) => from + 1 + i).every((s) => steps.has(s));
      const comps = s1.computes - s0.computes;
      check(bad.length === 0 && ordered && every && seq[seq.length - 1] === to,
        `scrub at ${rate} months a second, ${mon(from)} to ${mon(to)}: ${log.length} frames, ${bad.length} whose label or aria-valuenow differ from the month drawn; ${rate === 2 ? 'every month drawn, in order' : `${steps.size} months drawn, never backwards`}; the frame after the lift draws ${mon(seq[seq.length - 1])} (headless: ${comps} month computations, ${s1.frames - s0.frames} frames in ${el} ms)`);
    }
    const anims = await w(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.player')).length);
    check(anims === 0, `no animation runs on the month, the lead or the track (${anims})`);
  }

  // play: never backwards, whole months, stopping at the common month; the Play key's mark; the expensive
  // work only on a new month; About holding play; a touch on the track stopping it under the finger
  {
    await setMonth(A, COMMON - 30);
    await w(() => window.__sa.log(true));
    const s0 = await ST(A);
    await A.tapEl('#btn-play');
    await page.waitForTimeout(150);
    const marks = await playMarks(w);
    await page.waitForTimeout(850);
    const s1 = await ST(A);
    await page.waitForTimeout(2200);
    const log = await w(() => window.__sa.log(false));
    const end = await w(() => [window.__sa.shown(), window.__sa.stats().playing]);
    const seq = log.map((e) => e.shown);
    const steps = seq.filter((s, i) => i && s !== seq[i - 1]).map((s, i, a) => s - (i ? a[i - 1] : seq[0]));
    check(/ico-play hidden none, ico-pause shown (block|inline)/.test(marks) && /Pause$/.test(marks), `while playing the Play key shows the pause bars and is named Pause (${marks})`);
    check(seq.every((s, i) => !i || s >= seq[i - 1]) && log.every((e) => e.label === mon(e.shown)) && end[0] === COMMON && !end[1],
      `play: ${new Set(seq).size} months, never backwards, every label the drawn month's; it stops at ${mon(end[0])}, the newest month every country has reported (B2)`);
    const comps = s1.computes - s0.computes, frames = s1.frames - s0.frames;
    check(comps <= 14 && frames > comps, `the month's work runs only on a new month: ${comps} computations over ${frames} frames in the first second of play (a year a second)`);
    const m2 = await playMarks(w);
    check(/ico-play shown (block|inline), ico-pause hidden none/.test(m2) && /Play$/.test(m2), `stopped, the Play key shows its triangle and is named Play (${m2})`);
    // Play at the end starts over from January 1971
    await A.tapEl('#btn-play'); await page.waitForTimeout(300);
    const restart = await w(() => window.__sa.shown());
    await A.tapEl('#btn-play');
    check(restart < 12, `Play at the common month starts over from Jan 1971 (${mon(restart)} after 0.3 s)`);
    // About holds play still; closing it lets play go on
    await setMonth(A, 100);
    await A.tapEl('#btn-play'); await page.waitForTimeout(300);
    await A.tapEl('#stamp'); await page.waitForTimeout(100);
    const held0 = await w(() => window.__sa.shown());
    await page.waitForTimeout(700);
    const held1 = await w(() => [window.__sa.shown(), !document.getElementById('about').hidden]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    const after = await w(() => [window.__sa.shown(), document.getElementById('about').hidden, document.activeElement.id]);
    check(held1[0] === held0 && held1[1] && after[0] > held0 && after[1] && after[2] === 'stamp', `About holds play still (${mon(held0)} while open), Escape closes it, focus returns to the stamp, and play goes on (${mon(after[0])})`);
    // a finger held on the plate during play holds the clock: the picture is the frame the touch began
    // on, so the label must not move under it; play goes on when the finger lifts (after review)
    {
      const plate = await A.rect('#map-wrap'), sea = await w(() => window.__sa.project(4.5, 57.2));
      await A.touch('touchStart', plate.left + sea[0], plate.top + sea[1]);
      await page.waitForTimeout(100);
      // read once the touch has landed (a month may pass between a read and the touch), then 0.5 s later
      const p0 = await w(() => [window.__sa.shown(), document.getElementById('valid-time').textContent]);
      await page.waitForTimeout(500);
      const p1 = await w(() => [window.__sa.shown(), document.getElementById('valid-time').textContent, window.__sa.stats().playing]);
      await A.touch('touchEnd'); await page.waitForTimeout(600);
      const p2 = await w(() => [window.__sa.shown(), window.__sa.stats().playing]);
      check(p1[0] === p0[0] && p1[1] === mon(p1[0]) && p1[2] && p2[0] > p1[0] && p2[1], `play with a finger held on the plate for 0.5 s: the month holds (${p0[1]}, then ${p1[1]}; drawn ${mon(p1[0])}; playing ${p1[2]}), and play goes on after the lift (${mon(p2[0])}, playing ${p2[1]})`);
    }
    const tr = await A.rect('#slider');
    await A.touch('touchStart', trackX(tr, 200), tr.top + tr.height / 2); await A.frame();
    const stopped = await w(() => [window.__sa.stats().playing, window.__sa.shown()]);
    await A.touch('touchEnd');
    check(!stopped[0] && stopped[1] === 200, `a touch on the track during play stops it on the month under the finger (${mon(stopped[1])})`);
    // the year keys, with their sentence
    await A.tapEl('#btn-back'); await A.frame(); await page.waitForTimeout(100);
    const bk = await w(() => [window.__sa.shown(), document.getElementById('live').textContent]);
    check(bk[0] === 188 && bk[1] === `${MONTHS[188 % 12]} ${1971 + Math.floor(188 / 12)}`, `Back one year moves twelve months and says it: "${bk[1]}"`);
    // at rest the loop asks for no frame
    const q0 = await ST(A); await page.waitForTimeout(800); const q1 = await ST(A);
    check(q1.frames === q0.frames && !q1.raf, `at rest no frame runs: ${q1.frames - q0.frames} frames in 0.8 s`);
  }

  // the plate holds still while the caption's words change; every form fits its two lines
  {
    const hs = new Set(), forms = new Set(), over = [];
    for (const m of [0, 5, 20, 60, 300, 380, COMMON, COMMON + 1, LAST]) {
      await setMonth(A, m);
      const r = await w(() => { const e = document.getElementById('readline'); return [document.getElementById('map-wrap').getBoundingClientRect().height, e.textContent, e.scrollHeight <= e.clientHeight + 1]; });
      hs.add(r[0]); forms.add(r[1]); if (!r[2]) over.push(r[1]);
    }
    check(hs.size === 1 && over.length === 0, `the plate holds still while the caption changes: plate ${[...hs].map(Math.round).join(', ')} px over ${forms.size} forms of the line, each inside its two lines${over.length ? ': over ' + over.join(' | ') : ''}`);
    check([...hs][0] >= 540, `the plate at 390 × 844: ${Math.round([...hs][0])} px (ART.md: at least 540)`);
    await setMonth(A, LAST);
    const late = await w(() => [document.getElementById('readline').textContent, document.getElementById('slider').getAttribute('aria-valuetext'), window.__sa.rings().map((r) => r[0])]);
    const m2 = LAST, dkOnly = UNITS.filter((U) => U.ids.every((id) => rep(FS.get(id).f.country, m2))).filter((U) => { const b = bestOf(U, m2); return b && b.v >= FLOOR; });
    check(new RegExp(`^No NO, UK or NL figures for ${mon(LAST)} yet\\.`).test(late[0]) && late[1] === `${monLong(LAST)}, no NO, UK or NL figures yet` && late[2].length === dkOnly.length
      && dkOnly.every((U) => U.ids.every((id) => FS.get(id).f.country === 'DK')),
    `an unreported month names what is missing ("${late[0]}"; the track says "${late[1]}") and rings only the units whose every country reported it: ${late[2].length}, all Danish (this file: ${dkOnly.length})`);
    await setMonth(A, COMMON);
  }

  // the card keeps clear of the tapped point; the names keep clear of the card and the keys
  {
    // Statfjord dragged by touch to the plate's top left, where the card opens, then tapped
    await w(() => window.__sa.zoomTo(1.9, 61.2, 3)); await A.frame(); await page.waitForTimeout(200);
    const plate = await A.rect('#map-wrap');
    const from = await w(() => window.__sa.rings().find((r) => r[0] === 'Statfjord'));
    await A.touch('touchStart', plate.left + from[2], plate.top + from[3]);
    for (let i = 1; i <= 10; i++) { await A.touch('touchMove', plate.left + from[2] + ((100 - from[2]) * i) / 10, plate.top + from[3] + ((100 - from[3]) * i) / 10); await new Promise((r) => setTimeout(r, 16)); }
    await A.touch('touchEnd'); await A.frame(); await page.waitForTimeout(400);
    const target = await w(() => window.__sa.rings().find((r) => r[0] === 'Statfjord'));
    await A.tapAt(plate.left + target[2], plate.top + target[3]); await A.frame(); await page.waitForTimeout(250);
    const card = await A.rect('#card');
    const clear = !(plate.left + target[2] > card.left - 4 && plate.left + target[2] < card.right + 4 && plate.top + target[3] > card.top - 4 && plate.top + target[3] < card.bottom + 4);
    const live = await text(A, 'live');
    check(clear && new RegExp(`^.+\\. Liquids in ${monLong(COMMON)}: .+ a day\\. Best month so far: \\d+(\\.\\d+)?( million)? standard cubic meters a day, \\w+ \\d{4}\\.$`).test(live), `a tap on ${target[0]} under the card's corner: the card moves clear of it (${Math.round(card.left)}, ${Math.round(card.top)}); VoiceOver hears "${live}"`);
    const labels = await w(() => window.__sa.labels());
    const boxes = await w(() => ['card', 'keys'].map((id) => document.getElementById(id).getBoundingClientRect().toJSON()));
    const hit = labels.filter(([x0, y0, x1, y1]) => boxes.some((b) => plate.left + x0 < b.right && plate.left + x1 > b.left && plate.top + y0 < b.bottom && plate.top + y1 > b.top));
    check(labels.length > 5 && hit.length === 0, `${labels.length} field names drawn, none under the card or the keys`);
    await A.shot('names-light');
    await A.tapEl('#card-close'); await w(() => window.__sa.home());
  }

  // a Norwegian platform's card reads its name repaired (B1)
  {
    const i = await w(() => window.__sa.find('fac', '^ÅSGARD A$'));
    const lonlat = geo.facilities.find((f) => /SGARD A$/.test(f.name || '') && f.country === 'NO');
    await w(([lon, lat]) => window.__sa.zoomTo(lon, lat, 30), [lonlat.lon, lonlat.lat]); await A.frame(); await page.waitForTimeout(200);
    const [x, y] = await w((k) => window.__sa.anchor('fac', k), i);
    const plate = await A.rect('#map-wrap');
    await A.tapAt(plate.left + x, plate.top + y); await A.frame(); await page.waitForTimeout(200);
    const c = await w(() => [document.getElementById('card-name').textContent, document.getElementById('card-act').textContent, [...document.querySelectorAll('#card-rows dd')].map((d) => d.textContent).join(' | ')]);
    check(i >= 0 && c[0] === 'Åsgard A' && c[1] === 'Show Åsgard' && !/Ã/.test(c.join('')), `B1: the platform reads "${c[0]}", its key "${c[1]}" (rows: ${c[2].slice(0, 80)})`);
    await A.shot('platform-light');
    await A.tapEl('#card-act'); await page.waitForTimeout(700);
    const sel = await w(() => window.__sa.state.sel);
    check(sel === 'f:NO-43765', `"Show Åsgard" selects the field (${sel})`);
    await A.tapEl('#card-close'); await w(() => window.__sa.home());
  }

  // the units key: SI first, the field units one press away, back again
  {
    const k0 = await w(() => [document.getElementById('btn-units').textContent, document.getElementById('btn-units').getAttribute('aria-label')]);
    await A.tapEl('#btn-units'); await A.frame();
    const us = await w(() => [document.getElementById('btn-units').textContent, [...document.querySelectorAll('#legend-ticks span')].pop().textContent, document.getElementById('lead').textContent, document.getElementById('readline').textContent]);
    await A.tapEl('#btn-units'); await A.frame();
    const back = await w(() => [document.getElementById('btn-units').textContent, localStorage.getItem('sa.units')]);
    check(k0[0] === 'Sm³/d' && k0[1] === 'Change units, now Sm³/d' && us[0] === 'bbl/d' && us[1].endsWith(`${NN}bbl/d`) && us[2].includes('bbl/d') && us[3].includes('bbl/d') && back[0] === 'Sm³/d' && back[1] === 'si',
      `the units key starts at Sm³/d ("${k0[1]}"); one press: ${us[0]}, the legend ends "${us[1]}", the lead "${us[2]}"; a second press is back (sa.units = ${back[1]})`);
  }

  // the card's first month is the first month the regulator reports, and says so where the series starts late
  {
    const rows = [];
    for (const name of ['Groningen', 'West Sole', 'Statfjord']) {
      await w((n) => window.__sa.pick(n), name); await page.waitForTimeout(700); await A.frame();
      rows.push([name, await w(() => [...document.querySelectorAll('#card-rows dt')].map((d) => [d.textContent, d.nextElementSibling.textContent]).find((r) => /^First/.test(r[0])) || [])]);
      await A.tapEl('#card-close'); await A.frame();
    }
    const [g, ws, sf] = rows.map((r) => r[1]);
    check(g[0] === 'First month reported' && g[1] === 'Jan 2003, when the Dutch series starts' && /; earlier months are not in the series$/.test(ws[1] || '') && /^[A-Z][a-z]{2} \d{4}$/.test(sf[1] || ''),
      `the card's first month: ${rows.map(([n, r]) => `${n} "${r[0]}: ${r[1]}"`).join('; ')}`);
    await w(() => window.__sa.home()); await setMonth(A, COMMON);
  }
  // Find: the field, no browser clear button in its accent, a choice flies to the field
  {
    await A.tapEl('#btn-find'); await page.waitForTimeout(300);
    await page.keyboard.type('statf'); await page.waitForTimeout(200);
    const f = await A.rect('#find-input');
    const img = await A.png({ x: f.left, y: f.top, width: f.width, height: f.height });
    let blue = 0;
    for (let y = 0; y < img.h; y++) for (let x = Math.floor(img.w * 0.75); x < img.w; x++) { const [r, g, b] = img.at(x, y); if (b > r + 40 && b > g + 20) blue++; }
    const res = await w(() => [...document.querySelectorAll('#find-list button')].map((b) => b.textContent));
    const clear = await w(() => !document.getElementById('find-clear').hidden);
    check(blue === 0 && clear && res[0] && res[0].startsWith('Statfjord'), `Find: "statf" lists ${res.length} (${res.slice(0, 2).join('; ')}); the house's clear key shows, and no blue-led pixel at the field's right end (${blue})`);
    await page.waitForTimeout(800);
    const heard = await text(A, 'live');
    const nAll = UNITS.filter((U) => U.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('statf')).length;
    check(heard === `${res.length} ${res.length === 1 ? 'field matches' : 'fields match'}.` && nAll === res.length, `Find tells VoiceOver the count once typing settles: "${heard}" (this file: ${nAll} names hold "statf")`);
    await A.shot('find-light');
    await A.tapEl('#find-list button'); await page.waitForTimeout(80);
    const flying = await w(() => window.__sa.flying());
    await page.waitForTimeout(800);
    const s = await w(() => [window.__sa.state.sel, window.__sa.flying(), document.getElementById('find').hidden]);
    check(flying && !s[1] && s[2] && s[0] === 'g:STATFJORD', `a choice closes Find and flies to the field (flying ${flying}, then landed on ${s[0]})`);
    // B13: a touch during a flight ends it at its destination
    await w(() => window.__sa.home()); await A.tapEl('#card-close');
    await w(() => window.__sa.pick('Troll')); await page.waitForTimeout(100);
    const plate = await A.rect('#map-wrap');
    await A.tapAt(plate.right - 30, plate.bottom - 30);       // clear of the card and the keys
    const z = await w(() => [window.__sa.flying(), window.__sa.state.zoom]);
    check(!z[0] && z[1] > 1.5, `B13: a touch during a flight ends it at its destination (zoom ${z[1].toFixed(1)}, not midway)`);
    await A.tapEl('#card-close').catch(() => {}); await w(() => window.__sa.home());
  }

  // the Layers sheet: a country off removes its circles and rings and the lead names who is shown
  {
    await A.tapEl('#btn-layers'); await page.waitForTimeout(150);
    const r0 = await w(() => window.__sa.rings().length);
    await A.tapEl('#country-rows [data-cc="NO"]'); await A.frame(); await A.frame();
    const r1 = await w(() => [window.__sa.rings().length, document.getElementById('lead').textContent, window.__sa.val('Troll'), window.__sa.state.ccOn.NO]);
    const ownNo = UNITS.filter((U) => U.ids.some((id) => FS.get(id).f.country !== 'NO')).filter((U) => { const b = bestOf({ ids: U.ids.filter((id) => FS.get(id).f.country !== 'NO') }, COMMON); return b && b.v >= FLOOR; }).length;
    check(!r1[3] && r1[0] === ownNo && r1[1].startsWith('UK, DK, NL: ') && r1[2] === 0, `Norway off: ${r1[0]} rings (this file: ${ownNo}, from ${r0}), Troll draws nothing, the lead "${r1[1]}"`);
    await A.tapEl('#country-rows [data-cc="NO"]'); await A.frame();
    const h = await hitTargets(w);
    check(h.bad.length === 0, `hit targets with the Layers sheet open: ${h.n} controls at least 44 × 44${h.bad.length ? ': ' + h.bad.join('; ') : ''}`);
    await A.tapEl('#layers-close');
  }

  // hit targets, and focus mode end to end
  {
    const h0 = await hitTargets(w);
    // the key: the map's own marks drawn small, in the map's colors, after the notes (HOUSE 4.15)
    {
      const TH = JSON.parse(fs.readFileSync(path.join(APP, 'app.js'), 'utf8').match(/^const THEMES = (.*);$/m)[1])[await w(() => (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))];
      const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
      const keyOf = () => w(() => [...document.querySelectorAll('#readline .k')].map((k) => { const i = k.querySelector('.sw'), cs = getComputedStyle(i); return [i.className.replace('sw sw-', ''), k.textContent, cs.backgroundColor, cs.borderTopColor, cs.borderTopWidth]; }));
      await setMonth(A, COMMON);
      const k1 = await keyOf();
      await page.getByRole('radio', { name: 'Cumulative', exact: true }).click(); await A.frame();
      const k2 = await keyOf();
      await page.getByRole('radio', { name: 'Rate', exact: true }).click(); await A.frame();
      const disc = `rgba(${hex(TH.ramp[8]).join(', ')}, ${TH.circleAlpha})`, ring = `rgb(${hex(TH.ring).join(', ')})`, shut = `rgba(${hex(TH.shutFill).join(', ')}, ${TH.shutAlpha})`;
      check(k1.length === 2 && k1[0][0] === 'rate' && k1[0][1] === 'The month\u2019s rate' && k1[0][2] === disc && k1[1][0] === 'best' && /^Best month so far, from \d{1,3}(\u202f\d{3})*\u202fSm³\/d$/.test(k1[1][1]) && k1[1][3] === ring && k1[1][4] === '1px'
        && k2.length === 2 && k2[0][1] === 'Produced to date' && k2[0][2] === disc && k2[1][1] === 'Shut down' && k2[1][2] === shut,
      `the key in the map's own marks: Rate ${k1.map((k) => `"${k[1]}" (${k[2] !== 'rgba(0, 0, 0, 0)' ? k[2] : `${k[4]} ${k[3]}`})`).join(', ')}; Cumulative ${k2.map((k) => `"${k[1]}" (${k[2]})`).join(', ')}`);
    }
    check(h0.bad.length === 0 && h0.n >= 15, `hit targets: ${h0.n} controls, all at least 44 × 44 (B4)${h0.bad.length ? ': ' + h0.bad.join('; ') : ''}`);
    const before = await w(() => document.getElementById('map-wrap').getBoundingClientRect().height);
    await A.tapEl('#focus-key');
    await page.waitForTimeout(450);
    const f = await w(() => {
      const gone = ['head', 'keys', 'legend-scale'].map((id) => { const e = document.getElementById(id); return e.hidden && e.inert; });
      const stays = ['legend-name', 'readline', 'player', 'stamp'].map((id) => { const e = document.getElementById(id); return e.getBoundingClientRect().height > 0 && !e.closest('[hidden]'); });
      return { gone, stays, stampIn: document.getElementById('stamp').parentElement.id, ghost: !document.getElementById('focus-exit').hidden, plate: document.getElementById('map-wrap').getBoundingClientRect().height, live: document.getElementById('live').textContent, store: localStorage.getItem('sa.focus'), active: document.activeElement.id, rings: window.__sa.stats().rings };
    });
    const tree = await page.getByRole('button', { name: 'Zoom in', exact: true }).count();
    check(f.gone.every(Boolean) && tree === 0 && f.stays.every(Boolean) && f.stampIn === 'caption' && f.ghost,
      `focus mode by touch: the header, the keys and the legend's bar are hidden and inert (gone from the tree: ${tree === 0}); the legend's title, the caption line, the player and the stamp (now in the caption band) stay`);
    check(f.plate > before && f.plate >= 645 && f.rings > 100, `the plate grew from ${before.toFixed(1)} to ${f.plate.toFixed(1)} px (ART.md: at least 645), the rings still drawn (${f.rings} in view)`);
    check(f.live === 'Controls hidden. Press Escape or the corner key to show them.' && f.store === '1' && f.active !== 'focus-exit', `its sentence ("${f.live}"), sa.focus = ${f.store}, and no ring after a touch (focus on "${f.active || 'body'}")`);
    const hf = await hitTargets(w);
    check(hf.bad.length === 0, `hit targets in focus mode: ${hf.n} controls at least 44 × 44${hf.bad.length ? ': ' + hf.bad.join('; ') : ''}`);
    const g = await A.rect('#focus-exit'), pr = await A.rect('#map-wrap');
    check(g.top - pr.top >= 8 && pr.right - g.right >= 8 && g.width === 44 && g.height === 44, `the ghost key sits in the plate's top-right corner, 8 px in (${Math.round(g.left)}, ${Math.round(g.top)}, 44 × 44)`);
    const tr = await A.rect('#slider');
    await A.touch('touchStart', trackX(tr, 300), tr.top + 24); await A.touch('touchMove', trackX(tr, 320), tr.top + 24); await A.touch('touchEnd'); await A.frame();
    const sc = await w(() => window.__sa.shown());
    await A.tapEl('#btn-play'); await page.waitForTimeout(400); const pl = await w(() => window.__sa.stats().playing); await A.tapEl('#btn-play');
    await A.tapAt(pr.left + 140, pr.top + 300); await page.waitForTimeout(200);
    await A.shot('focus-light');
    check(sc === 320 && pl, `inside focus mode the scrub lands on ${mon(sc)} and play plays (${pl})`);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 60000 });
    const kept = await w(() => [document.body.classList.contains('focus'), document.getElementById('head').hidden]);
    check(kept[0] && kept[1], 'focus mode survives a reload, restored before the first draw');
    await page.getByRole('button', { name: 'Show the controls', exact: true }).click();
    await page.waitForTimeout(300);
    const outs = await w(() => [document.getElementById('head').hidden, document.getElementById('live').textContent, localStorage.getItem('sa.focus')]);
    const cum = await page.getByRole('radio', { name: 'Cumulative', exact: true }).isVisible();
    check(!outs[0] && outs[1] === 'Controls shown.' && outs[2] === '0' && cum, `the camera's way out of a library left in focus mode: "Show the controls" brings the header back ("${outs[1]}"), Cumulative visible ${cum}`);
    await page.focus('#focus-key'); await page.keyboard.press('Enter'); await page.waitForTimeout(450);
    const k1 = await w(() => [document.body.classList.contains('focus'), document.activeElement.id]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const k2 = await w(() => [document.body.classList.contains('focus'), document.activeElement.id]);
    check(k1[0] && k1[1] === 'focus-exit' && !k2[0] && k2[1] === 'focus-key', `by the keyboard: Enter goes in with focus on the ghost key (${k1[1]}); Escape comes out with focus back on the entry key (${k2[1]})`);
  }

  // the map by keyboard: arrows pan, plus and minus zoom
  {
    await w(() => window.__sa.home()); await page.focus('#map');
    const z0 = await w(() => window.__sa.state.zoom);
    await page.keyboard.press('+'); await page.keyboard.press('ArrowLeft'); await A.frame();
    const z1 = await w(() => window.__sa.state.zoom);
    await page.keyboard.press('-'); await A.frame();
    const z2 = await w(() => window.__sa.state.zoom);
    check(Math.abs(z1 / z0 - 2) < 0.01 && Math.abs(z2 - z0) < 0.01, `the map by keyboard: plus zooms ×2 (${z1.toFixed(2)}), minus back (${z2.toFixed(2)}), the arrow keys pan`);
    await w(() => window.__sa.home());
  }

  // hidden: play stops and no frame runs; the return draws fresh
  {
    await A.tapEl('#btn-play'); await page.waitForTimeout(200);
    await w(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const h0 = await ST(A); await page.waitForTimeout(600); const h1 = await ST(A);
    await w(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(400);
    const h2 = await ST(A);
    check(!h0.playing && h1.frames === h0.frames && !h1.raf && h2.draws > h1.draws, `hidden: play stops and no frame runs (${h1.frames - h0.frames} in 600 ms); the return re-reads the data and draws (${h2.draws - h1.draws} draws)`);
  }

  // About: from the stamp, every source's statement and the face's credit, no address with its scheme, Escape
  {
    await A.tapEl('#stamp'); await page.waitForTimeout(300);
    const a = await w(() => ({ text: document.getElementById('about-body').textContent, open: !document.getElementById('about').hidden, focus: document.activeElement.id, inert: document.getElementById('map-wrap').inert }));
    const missingAttr = snap.sources.filter((s) => !a.text.includes(s.attribution));
    check(a.open && a.inert && a.focus === 'about-close' && missingAttr.length === 0 && a.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.')
      && !/https?:\/\//.test(a.text) && a.text.includes('factpages.sodir.no/') && /\(UTC[+−]?\d*/.test(a.text) && !/\d{1,2}\/\d{1,2}\/\d{4}/.test(a.text),
    `About opens from the stamp with the page behind inert, carries all ${snap.sources.length} attributions and the face's credit, prints addresses without their scheme and dates by hand (B10)`);
    await A.shot('about-light');
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp'), 'Escape closes About and focus returns to the stamp');
  }
  check(A.errors.length === 0, `no console error or warning, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

// Reduce Motion: every animation at 0 s, flights as cuts, play in whole months
{
  console.log('\n== Reduce Motion (dark)');
  const A = await open('dark', { reduced: true });
  const { page, w } = A;
  await w(() => window.__sa.zoomTo(3, 58, 4));
  await A.tapEl('#zoom-home');
  const cut = await w(() => [window.__sa.flying(), window.__sa.state.zoom]);
  await A.tapEl('#mode [data-m="cum"]'); await A.tapEl('#mode [data-m="rate"]');
  const durs = await w(() => document.getAnimations().map((a) => a.effect.getComputedTiming().duration));
  await setMonth(A, 200);
  await w(() => window.__sa.log(true)); await A.tapEl('#btn-play'); await page.waitForTimeout(1200); await A.tapEl('#btn-play');
  const log = await w(() => window.__sa.log(false));
  check(!cut[0] && Math.abs(cut[1] - 1) < 0.01 && durs.every((d) => d === 0) && log.every((e) => Number.isInteger(e.shown) && e.label === mon(e.shown)),
    `Reduce Motion: Whole North Sea is a cut (flying ${cut[0]}, zoom ${cut[1].toFixed(2)}), ${durs.length} animations all at 0 s, play in whole months (${new Set(log.map((e) => e.shown)).size} months)`);
  await A.shot('reduced-dark');
  check(A.errors.length === 0, `no console error or warning${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

// broken data: each file missing, not JSON, the wrong schema; a replacement while open keeps the view
{
  console.log('\n== broken data');
  const cases = [
    ['/data/snapshot.json', { status: 404 }, /^data\/snapshot\.json could not be read \(HTTP 404\)\.$/],
    ['/data/geo.json', { status: 404 }, /^data\/geo\.json could not be read \(HTTP 404\)\.$/],
    ['/data/snapshot.json', { body: '<!DOCTYPE html><html>…' }, /^data\/snapshot\.json is not valid JSON; it looks like a web page was written over it\.$/],
    ['/data/snapshot.json', { body: JSON.stringify({ ...snap, schema: 2 }) }, /^data\/snapshot\.json is not a Shelf Atlas snapshot: schema is 2, this app reads schema 1\.$/],
  ];
  for (const [p, ov, re] of cases) {
    override = { [p]: ov };
    const A = await open('light', { noWait: true, expect: /404|Failed to load resource/ });
    await A.page.waitForFunction(() => !document.getElementById('error').hidden, null, { timeout: 30000 });
    const msg = await A.w(() => [...document.querySelectorAll('#error div')].map((d) => d.textContent));
    check(msg.some((m) => re.test(m)), `${p} ${ov.status ? `answers ${ov.status}` : ov.body.startsWith('<') ? 'is a web page' : 'has schema 2'}: "${msg.join(' ')}"`);
    await A.ctx.close();
  }
  // stale: a snapshot built 20 days ago; its first sentence in --ink, in both themes and in focus mode
  for (const scheme of ['light', 'dark']) {
    override = { '/data/snapshot.json': { body: JSON.stringify({ ...snap, generatedAt: new Date(Date.now() - 20 * 864e5).toISOString() }) } };
    const S = await open(scheme);
    const st = () => S.w(() => { const e = document.getElementById('stamp'), sp = e.querySelector('.stale'), cs = getComputedStyle(document.documentElement);
      const probe = document.createElement('span'); probe.style.color = cs.getPropertyValue('--ink'); document.body.append(probe); const ink = getComputedStyle(probe).color; probe.remove();
      return [e.textContent, sp ? getComputedStyle(sp).color : null, ink, e.parentElement.id]; });
    const s0 = await st();
    await S.w(() => window.__sa.focus(true)); await S.page.waitForTimeout(400);
    const s1 = await st();
    await S.w(() => window.__sa.focus(false)); await S.page.waitForTimeout(300);
    check(/^Stale\. Updated \d{1,2} \w{3}, \d\d:\d\d, figures to /.test(s0[0]) && s0[1] === s0[2] && s1[0] === s0[0] && s1[1] === s1[2] && s1[3] === 'caption',
      `${scheme}: a snapshot 20 days old stamps "${s0[0]}", its first sentence in --ink (${s0[1]}), the same in focus mode's caption band`);
    await S.shot(`stale-${scheme}`, false);
    await S.ctx.close();
  }
  // a short file: half the snapshot. The notice names it, the stamp says map only, the transport stands down
  {
    const raw = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
    override = { '/data/snapshot.json': { body: raw.slice(0, raw.length >> 1) } };
    const S = await open('light', { noWait: true });
    await S.page.waitForFunction(() => !document.getElementById('error').hidden, null, { timeout: 30000 });
    await S.page.waitForTimeout(400);
    const r = await S.w(() => [[...document.querySelectorAll('#error div')].map((d) => d.textContent).join(' '), document.getElementById('stamp').textContent, document.getElementById('readline').textContent,
      ['btn-play', 'btn-back', 'btn-fwd', 'btn-peaks'].map((id) => document.getElementById(id).getAttribute('aria-disabled')).join(',')]);
    check(r[0] === 'data/snapshot.json is not valid JSON.' && /^Map only\. Updated /.test(r[1]) && r[2] === 'No production figures to show; the notice above says why.' && r[3] === 'true,true,true,true',
      `a short snapshot: the notice "${r[0]}", the stamp "${r[1]}", the caption "${r[2]}", the transport and the Peaks key aria-disabled (${r[3]})`);
    await S.shot('short-light', false);
    check(S.errors.length === 0, `no console error with a short snapshot${S.errors.length ? ': ' + S.errors.slice(0, 3).join(' | ') : ''}`);
    await S.ctx.close();
  }
  override = {};
  const A = await open('light');
  await A.w(() => window.__sa.zoomTo(2, 60, 3));
  const z0 = await A.w(() => window.__sa.state.zoom);
  override = { '/data/snapshot.json': { body: '{"schema": 1' } };
  await A.w(() => window.__sa.reload()); await A.frame();
  const after = await A.w(() => [[...document.querySelectorAll('#error div')].map((d) => d.textContent).join(' '), window.__sa.state.fields, window.__sa.state.zoom, window.__sa.rings().length]);
  check(/not valid JSON\. Showing production as last read\.$/.test(after[0]) && after[1] === snap.fields.length && after[2] === z0 && after[3] > 0, `a broken replacement while open keeps what was showing and says so ("${after[0]}"), the view kept`);
  override = {};
  await A.ctx.close();
}

// widths: no horizontal scroll, the caption line inside its height, the plate on a phone on its side
{
  console.log('\n== widths');
  for (const [wd, ht, dpr, name] of [[320, 568, 2, '320'], [360, 740, 3, '360'], [375, 667, 2, '375'], [312, 675, 2.5, '125 % zoom'], [844, 390, 3, 'on its side']]) {
    const A = await open('light', { w: wd, h: ht, dpr });
    const r = await A.w(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, plate: document.getElementById('map-wrap').getBoundingClientRect().height, line: (() => { const e = document.getElementById('readline'); return e.scrollHeight <= e.clientHeight + 1; })(), keysRow: document.getElementById('map-wrap').classList.contains('keys-row'), keys: document.getElementById('keys').getBoundingClientRect().height }));
    const forms = [];
    for (const [sys, m] of [['si', 0], ['si', 20], ['field', COMMON], ['field', LAST], ['si', 380]]) {
      await A.w(([s, k]) => { if (window.__sa.state.sys !== s) document.getElementById('btn-units').click(); window.__sa.setMonth(k); }, [sys, m]); await A.frame();
      forms.push(await A.w(() => { const e = document.getElementById('readline'); return e.scrollHeight <= e.clientHeight + 1 ? '' : e.textContent; }));
    }
    const over = forms.filter(Boolean);
    const side = name === 'on its side';
    check(r.sw <= r.iw && r.line && over.length === 0 && (!side || (r.plate >= 220 && r.keysRow && r.keys <= 40)),
      `${name} (${wd} × ${ht}): no horizontal scroll (${r.sw} ≤ ${r.iw}), every caption form inside its height${over.length ? ': over ' + over.join(' | ') : ''}, plate ${Math.round(r.plate)} px${side ? `, the keys in one row ${Math.round(r.keys)} px high` : ''}`);
    if (side) {
      await A.shot('side-light');
      await A.tapEl('#btn-layers'); await A.frame(); await A.page.waitForTimeout(200);
      const s = await A.w(() => ({ plate: document.getElementById('map-wrap').getBoundingClientRect().toJSON(), sheet: document.getElementById('layers').getBoundingClientRect().toJSON() }));
      check(s.plate.height >= 220 && s.sheet.left >= s.plate.right - 1 && s.sheet.width <= 341, `on its side with the Layers sheet open: a ${Math.round(s.sheet.width)} px column at the plate's right, the plate ${Math.round(s.plate.width)} × ${Math.round(s.plate.height)} px`);
      await A.shot('side-layers-light', false);
    }
    check(A.errors.length === 0, `no console error at ${name}${A.errors.length ? ': ' + A.errors.slice(0, 3).join(' | ') : ''}`);
    await A.ctx.close();
  }
}
// beyond the data's box: its own tone, not --page, with a --line edge (after review); both themes on its side
{
  console.log('\n== beyond the data');
  const T = JSON.parse(fs.readFileSync(path.join(APP, 'app.js'), 'utf8').match(/^const THEMES = (.*);$/m)[1]);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const scheme of ['light', 'dark']) {
    const A = await open(scheme, { w: 844, h: 390, dpr: 2 });
    const plate = await A.rect('#map-wrap');
    const west = await A.w(() => window.__sa.project(-6, 56));
    const page = await A.w(() => getComputedStyle(document.body).backgroundColor);
    const img = await A.png();
    const px = (x, y) => img.at(Math.round((plate.left + x) * 2), Math.round((plate.top + y) * 2)).slice(0, 3);
    const out = px(Math.max(4, west[0] - 30), plate.height / 2), want = hex(T[scheme].outside), line = hex(T[scheme].edge);
    let edge = false;
    for (let dx = -2; dx <= 2; dx++) { const c = px(west[0] + dx / 2, plate.height / 2 + 40); if (Math.hypot(c[0] - line[0], c[1] - line[1], c[2] - line[2]) < 14) edge = true; }
    check(west[0] > 40 && out.every((v, i) => Math.abs(v - want[i]) <= 1) && `rgb(${out.join(', ')})` !== page && edge,
      `${scheme} at 844 × 390: the data's west edge (6° W) at x ${Math.round(west[0])}; beyond it rgb(${out.join(', ')}), the outside's own tone ${T[scheme].outside}, not the page's ${page}; a ${T[scheme].edge} line at the edge ${edge ? 'found' : 'MISSING'}`);
    await A.shot(`side-${scheme}`, false);
    check(A.errors.length === 0, `no console error on its side in ${scheme}${A.errors.length ? ': ' + A.errors.slice(0, 3).join(' | ') : ''}`);
    await A.ctx.close();
  }
}

await browser.close();
server.close();
const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png (the README's composite) untouched: ${appPngHash ? appPngHash.slice(0, 12) : 'absent'}…`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('\nall checks pass');
