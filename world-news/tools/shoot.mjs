// Drive World News in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through CDP),
// light and dark (HOUSE.md section 7.2 as a pane app allows: no player, no focus mode, no units key;
// tools/DECISIONS.md, item 14). The clock is fixed at Thu 1 Oct 2026, 12:00 in Oslo, and the snapshot served is
// the pinned file of that morning, tools/fixtures/snapshot.json, so the stamp and the pictures are the same on
// every run whatever the hourly refresh has written into data/snapshot.json (plan 0012 package 4). One stage
// then opens the app on data/snapshot.json as it stands, two hours after it was made. Fails on any console error or warning, page error, failed request,
// HTTP ≥ 400, or any request outside the local server. Every figure it asserts is worked out here from
// data/snapshot.json with Node's own tools, never by importing js/.
//
// LOAD AND RENDER TIMES ARE HEADLESS CHROMIUM ON THIS MAC: a trend only, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the panes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's tabs by role and name, no credit on the front and the credit first in About, the
// face, the stamp), every pane's text contrast, the tracer under exactly the chosen tab, SI and the date forms in
// every visible text node, hit targets, the plates and their label, the About key last; the register on All (the
// sources' table and colors, the regions' heads, two-line summaries); the Datelines (every tick's x against this file's decode, the
// ink sampled on rendered pixels, the label for VoiceOver), a tap on a tick on All and across panes, a
// vertical swipe that starts on them scrolling and picking nothing, VoiceOver's press on the image as WebKit
// runs it picking nothing, a click on the layer at a tick picking it, a story's link holding its headline
// alone. Once: the first Tab, the tabs by keyboard, the same words on four locales (B1), About, hidden and
// back (the same file, then a new one keeping the pane and the scroll), a broken replacement keeping the view
// (B6), stale at 31 hours, a copy with Europe's feeds kept from an earlier run and Oceania empty (B2, B5), the
// year on a later clock, broken data at the start and the recovery, Reduce Motion, the widths (to a tablet and a
// wide screen, the header centered on the pane's column) and a phone on its side, a crafted copy at 320 px (a long
// word, a long region name, a tick of six), the stamp on one line in every state it writes, two taps racing (the
// last one wins; World News has no scrub), the live file. Pictures: tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png;
// never screenshots/app.png, the README's composite, whose hash is checked unchanged.

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
const NOW = '2026-10-01T10:00:00Z', TZ = 'Europe/Oslo';   // 12:00 CEST, UTC+2 until 25 Oct

/* ── the data, decoded here (app.js's header comment is the contract): the pinned fixed day ── */
const FIXTURE_SHA = 'ecb808729f4562dfe98f324aaef3a54ffaeebef03982c62348ab6f8f910c5d2c';
const raw = fs.readFileSync(path.join(APP, 'tools/fixtures/snapshot.json'), 'utf8');
if (crypto.createHash('sha256').update(raw).digest('hex') !== FIXTURE_SHA) { console.error(`tools/fixtures/snapshot.json is not the pinned file (${FIXTURE_SHA.slice(0, 12)}…)`); process.exit(1); }
const snap = JSON.parse(raw);
const liveRaw = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
const NN = ' ';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n) => String(n).padStart(2, '0');
const oslo = (ms) => new Date(ms + 2 * 3600e3);   // Oslo in Sep and Oct 2026, before 25 Oct
const hm = (d) => `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
const GEN = Date.parse(snap.generatedAt), genO = oslo(GEN);
const WHEN = `${genO.getUTCDate()} ${MON[genO.getUTCMonth()]}, ${hm(genO)}`;
const FEEDS = `${snap.feeds.filter((f) => f.ok).length} of ${snap.feeds.length} feeds answered`;
const STAMP = `Updated ${hm(genO)}, ${FEEDS}`;
const NAMES = snap.sources.map((s) => s.name);
const CREDITS = `Headlines from ${NAMES.slice(0, -1).join(', ')} and ${NAMES[NAMES.length - 1]}.`;
const ABOUT_KEY = 'Sources, their terms and credits are in About.';
/** The Datelines' plate label (HOUSE 11.1 rule 9): the scale, then a key's words where the band said them. */
const CAP = `Age when the file was made, ${WHEN}. Log scale.`;
/** The key under it (HOUSE 11.1 rule 6): on a region's tab its sources, in sources[] order; a hollow tick when one is drawn. */
const KEY = (region, hollow, data = snap) => [...(region ? data.sources.map((x) => x.name).filter((n) => data.regions.find((r) => r.name === region).items.some((it) => it.source === n)) : []), ...(hollow ? ['From an earlier run'] : [])];
/** The sources' color slots, by their order in sources[] (HOUSE 11.3), and the tokens they take. */
const SLOT = new Map(NAMES.map((n, i) => [n, i + 1]));
const SRC_TOK = { light: ['#1f5f99', '#a64a1a', '#6d2736'], dark: ['#8cbcf0', '#f0a070', '#ab8198'] };
const rgbOf = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
/** A region's newest age as its plate's head says it: whole hours or days, never rounded up. */
const ageShort = (h) => (!(h >= 1) ? `under 1${NN}h` : h < 24 ? `${Math.floor(h)}${NN}h` : `${Math.floor(h / 24)}${NN}d`);
const PANES = ['All', ...snap.regions.map((r) => r.name)];
const hours = (iso) => (GEN - Date.parse(iso)) / 36e5;
const spokenAge = (h) => { const d = Math.floor(h / 24), r = Math.floor(h - d * 24); return [d && `${d} day${d === 1 ? '' : 's'}`, r && `${r} hour${r === 1 ? '' : 's'}`].filter(Boolean).join(' '); };
/** An item's age as VoiceOver hears it: a date-only stamp (00:00:00 or 12:00:00 UTC) as the span of its UTC day. */
const spokenItem = (iso) => {
  if (!/T(00|12):00:00Z$/.test(iso)) return spokenAge(hours(iso));
  const hi = (GEN - Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)) / 36e5, b = Math.floor(hi / 24);
  return hi < 48 ? `at most ${spokenAge(hi)}` : `${b - 1} or ${b} days`;
};
/** The Datelines by ART.md section 1's rule: per region, clusters newest first, each [x, [item index…]]. */
function clusters(width, label) {
  const W = Math.min(480, width - label - 6), k = W / Math.log2(1440);
  return snap.regions.map((r) => {
    const xs = r.items.map((it, ii) => ({ ii, h: hours(it.published) })).sort((a, b) => a.h - b.h)
      .map((t) => ({ ...t, x: label + W - k * Math.log2(Math.min(1440, Math.max(1, t.h))) }));
    const cl = [];
    for (const t of xs) { const last = cl[cl.length - 1]; if (last && last[0].x - t.x < 3) last.push(t); else cl.push([t]); }   // within 3 px of the tick's own x
    return cl;
  });
}

const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

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
  const rawPx = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = rawPx[y * (stride + 1)], line = Buffer.from(rawPx.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
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
  return { w, h, at: (x, y) => { const i = (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4; return [px[i], px[i + 1], px[i + 2]]; } };
}

/* ── the server: the app folder, with the snapshot replaceable ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = {}, snapshotReads = 0;
const BASE = { '/data/snapshot.json': { body: raw } };   // the fixed day, unless a stage overrides it
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), ov = override[u] || BASE[u];
  if (u === '/data/snapshot.json') snapshotReads++;
  if (ov) { if (ov.status) { res.writeHead(ov.status); res.end(); return; } setTimeout(() => { res.writeHead(200, { 'content-type': TYPES[path.extname(u)] || 'application/octet-stream' }); res.end(ov.body); }, ov.delay || 0); return; }
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
console.log(`headless Chromium ${browser.version()}: every load and render time below is a trend on this Mac, not phone evidence`);

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const ready = () => window.__wn && window.__wn.ready();

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference', timezoneId: TZ, locale: o.locale || 'en-US' });
  const page = await ctx.newPage(), errors = [];
  await page.clock.setFixedTime(new Date(o.time || NOW));
  const excused = (s) => o.expect && o.expect.test(s);
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${r.url().slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  if (!o.noWait) { await page.waitForFunction(ready, null, { timeout: 30000 }); await page.waitForTimeout(300); }
  const ms = Date.now() - t0;
  const w = (fn, arg) => page.evaluate(fn, arg);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tapAt = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd'); };
  const rect = (sel) => w((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
  const png = async () => decodePng(await page.screenshot());
  const shot = async (name, keep = true) => {
    await page.waitForTimeout(250);
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    if (keep && KEEP) { if (`${name}.png` === 'app.png') throw new Error('never screenshots/app.png'); fs.copyFileSync(p, path.join(SHOTS, `${name}.png`)); }
    console.log(`      ${name}.png${keep && KEEP ? ' to screenshots/' : ''}`);
  };
  const pane = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(300); };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, rect, png, shot, pane };
}
/** The stamp on one line at 16 px (HOUSE 7.2, plan 0012 F8), whatever it says. */
const stampLine = (A) => A.w(() => { const s = document.getElementById('stamp'), r = s.getBoundingClientRect(); return { h: r.height, text: s.textContent, one: Math.abs(r.height - 16) <= 1 && s.getClientRects().length === 1 }; });
const stampCheck = async (A, label) => { const s = await stampLine(A); check(s.one, `the stamp on one line, ${Math.round(s.h * 10) / 10} px tall (${label}): "${s.text}"`); };
const closeOut = async (A, label) => { check(A.errors.length === 0, `${label}: no console error or warning, failed or outside request${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`); await A.ctx.close(); };

/* Text contrast over every rendered DOM text node (backgrounds composited), and every SVG label's fill on the page. */
const contrastOf = (w) => w(() => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const v = m ? m[1].split(/[ ,/]+/).map(Number) : [0, 0, 0, 0]; return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
  const L = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const over = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  const ground = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } } let bg = ground; for (const c of stack.reverse()) bg = over(c, bg); return bg; };
  let worst = [99, ''], n = 0;
  const faces = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!t.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr') || e.closest('template')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(e);
    faces.add(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim());
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    let c;
    if (e.closest('svg')) c = ratio(rgba(cs.fill), bgOf(e.closest('svg')));
    else { let op = 1; for (let x = e; x; x = x.parentElement) op *= +getComputedStyle(x).opacity; c = ratio(over([...rgba(cs.color).slice(0, 3), rgba(cs.color)[3] * op], bgOf(e)), bgOf(e)); }
    n++;
    if (c < worst[0]) worst = [c, `${e.id || e.getAttribute('class') || e.tagName} "${t.textContent.trim().slice(0, 24)}"`];
  }
  return { n, worst: [Math.round(worst[0] * 100) / 100, worst[1]], faces: [...faces] };
});
/** Every control at 44 × 44 or more, measured where it is wholly in view; the pane scrolled through. */
const hitTargets = async (A) => {
  const bad = new Set(), seen = new Set();
  const H = await A.w(() => document.getElementById('main').scrollHeight);
  for (let y = 0; y < H; y += 400) {
    const r = await A.w((top) => {
      document.getElementById('main').scrollTop = top;
      const out = { bad: [], seen: [] };
      for (const e of document.querySelectorAll('button, [role="tab"], input')) {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest('[hidden]') || e.closest('[inert]') || e.disabled) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const on = (x, yy) => { const h = document.elementFromPoint(x, yy); return h && (h === e || e.contains(h)); };
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !on(cx, cy)) continue;
        if ([...document.querySelectorAll('.tabs, .pane')].some((sc) => { if (!sc.contains(e)) return false; const s = sc.getBoundingClientRect(); return r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1; })) continue;
        const id = `${e.tagName} ${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}`;
        out.seen.push(id);
        const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 280 && on(cx + (s * k * dx) / 4, cy + (s * k * dy) / 4); k++) n++; return n / 4; };
        if (run(0, 1) < 43.5 || run(1, 0) < 43.5) out.bad.push(`${id} ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
      }
      return out;
    }, y);
    r.seen.forEach((s) => seen.add(s)); r.bad.forEach((b) => bad.add(b));
  }
  await A.w(() => { document.getElementById('main').scrollTop = 0; });
  return { n: seen.size, bad: [...bad] };
};
/** Every visible text node the app wrote: a hyphen-minus before a digit, a plain space between a number and a
 *  unit, a decimal comma, four or more digits ungrouped, a 12-hour clock or a locale's date form (B1, B11). The
 *  publishers' own words (headlines, summaries, bylines) are theirs and are passed over. */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, template, .hl, .sum, #about-sources')) continue;
    let s = t.textContent;
    if (!s.trim()) continue;
    n++;
    if (e.closest('.src')) s = s.replace(/^[^,]*,/, '').replace(/, by [^,]*/, '');   // the source's own name and the byline are the file's
    const ungrouped = s.replace(/\b(19|20)\d\d\b/g, '').replace(/\d{1,2}:\d\d/g, '').match(/(?<![\d. ])\d{4,}/);
    if (/(^|[^\w])-\d/.test(s) || /\d (h|d|min|%)(?![\w/])/.test(s) || /\d,\d/.test(s) || /\b(AM|PM)\b|\d+\.\s?(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)|[月日火水木金土]|Sept\b/i.test(s) || ungrouped) bad.push(s.trim().slice(0, 50));
  }
  return { n, bad };
});
/** A vertical drag that starts on the Datelines scrolls the pane, picks nothing and says nothing (HOUSE 4.7). */
const dragOn = async (A) => {
  await A.w(() => { document.getElementById('main').scrollTop = 0; document.getElementById('live').textContent = ''; });
  await A.page.waitForTimeout(150);
  const r = await A.rect('.dl'), x = r.left + r.width * 0.7, y0 = r.top + r.height / 2;
  await A.touch('touchStart', x, y0);
  for (let k = 1; k <= 18; k++) { await A.touch('touchMove', x + (k % 2), y0 - 12 * k); await A.page.waitForTimeout(16); }
  await A.touch('touchEnd');
  await A.page.waitForTimeout(400);
  return A.w(() => ({ sel: window.__wn.selected(), live: document.getElementById('live').textContent, top: document.getElementById('main').scrollTop, cur: document.querySelectorAll('[aria-current]').length }));
};
/** The page's own measure of the label column (the widest region name at 12.5 px and 620, plus 10) and the pane's width. */
const geometryOf = (w) => w(() => {
  const c = document.createElement('canvas').getContext('2d');
  c.font = '620 12.5px "Ysabeau Office"';
  const names = [...document.querySelectorAll('.dl .rn')].map((t) => t.textContent);
  const plate = document.querySelector('.lead-sec'), cs = getComputedStyle(plate);   // the Datelines fill their plate
  return { label: Math.ceil(Math.max(...names.map((n) => c.measureText(n).width))) + 10, width: plate.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) };
});
/** The drawn ticks per row: the x of each tick (its rect's centre) and its parts, read from the SVG. */
const drawnOf = (w) => w(() => [...document.querySelectorAll('.dl g.row')].map((g) => {
  const by = new Map();
  for (const r of g.querySelectorAll('rect')) { const x = Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2; by.set(x, (by.get(x) || 0) + 1); }
  return [...by.entries()].sort((a, b) => b[0] - a[0]);
}));
const fileName = (n) => n.toLowerCase().replace(/ /g, '-');

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the first pane: ${A.ms} ms (headless)`);
  const SHEET = scheme === 'light' ? [0xf6, 0xf9, 0xfa] : [0x1c, 0x27, 0x2c];   // the Datelines sit on a plate

  // boot: the camera's tabs by role and name, the credits, the face, the stamp
  {
    const tabs = await Promise.all(PANES.map((n) => page.getByRole('tab', { name: n, exact: true }).count()));
    const camera = await w(() => ['Europe', 'Americas'].map((n) => [...document.querySelectorAll('button')].filter((b) => b.textContent === n && !b.hasAttribute('aria-label')).map((b) => b.getAttribute('role'))));
    const b = await w(() => {
      const first = document.querySelector('#about-sources').parentElement.querySelector('h3 + p');
      return { gone: !document.getElementById('credits') && !document.getElementById('band') && !document.querySelector('footer'), about: first && first.id, credits: first && first.textContent,
        front: [document.getElementById('head').innerText, document.getElementById('main').innerText].join('\n'), face: document.fonts.check('620 12.5px "Ysabeau Office"'),
        loaded: [...document.fonts].filter((f) => f.status === 'loaded').length, stamp: document.getElementById('stamp').textContent, pane: window.__wn.pane() };
    });
    check(tabs.every((n) => n === 1), `the panes as tabs by name: ${PANES.map((p, i) => `${p} ${tabs[i]}`).join(', ')}`);
    check(camera.every((r) => r.length === 1 && r[0] === 'tab'), 'the camera\'s strings: Europe and Americas, each exactly one <button role="tab"> named by its word, built after the parse');
    check(b.gone && b.about === 'about-credit-line' && b.credits === CREDITS && !/Headlines from|Creative Commons|terms of use|licen[cs]e/i.test(b.front),
      `no band and no credit line on the front; About's first Sources and credits paragraph is the credit, built from the file's sources: "${b.credits}" (HOUSE 4.15)`);
    check(b.face && b.loaded === 1, `the face is loaded before the Datelines measure their labels (${b.loaded} face)`);
    check(b.stamp === STAMP && b.pane === 'all', `the stamp: "${b.stamp}" (built here: "${STAMP}"); the app opens on All`);
  }

  // every pane: text contrast, the face, the tracer, SI and dates, hit targets, the plates and their label, the About key
  for (const name of PANES) {
    await A.pane(name);
    const t0 = Date.now();
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5 && c.faces.every((f) => f === 'Ysabeau Office'), `${name}: ${c.n} text nodes and labels in view, the lowest ${c.worst[0]}:1 (${c.worst[1]}); faces ${c.faces.join(', ')} (B8)`);
    const tr = await w(() => [...document.querySelectorAll('.tabs button')].map((b) => [b.textContent, b.getAttribute('aria-selected') === 'true', getComputedStyle(b, '::after').content !== 'none']));
    check(tr.every(([, on, has]) => on === has) && tr.filter(([, on]) => on).map(([x]) => x).join() === name, `${name}: the tracer under exactly the chosen tab`);
    const si = await siOf(w);
    check(si.bad.length === 0, `${name}: SI and the date forms in ${si.n} visible text nodes (B1, B11)${si.bad.length ? ': ' + si.bad.slice(0, 5).join(' | ') : ''}`);
    const hits = await hitTargets(A);
    check(hits.bad.length === 0 && hits.n >= 5, `${name}: ${hits.n} controls, every one 44 × 44 or more (B9)${hits.bad.length ? ': ' + hits.bad.slice(0, 5).join('; ') : ''}`);
    const g = await w(() => { const m = document.getElementById('main'), cap = document.querySelector('.lead-sec .cap');
      return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, cap: cap.textContent, capLines: Math.round(cap.getBoundingClientRect().height / 15),
        key: [...document.querySelectorAll('.lead-sec .key .k')].map((k) => k.textContent),
        plates: [...document.querySelectorAll('#pane > *')].map((e) => (e.matches('section.sec') ? (e.querySelector('h2') || {}).textContent : e.className)) }; });
    check(!g.side, `${name}: nothing runs past the pane's width`);
    const want = ['Every headline by age', ...snap.regions.filter((r) => name === 'All' || r.name === name).map((r) => r.name), 'aboutlink'];
    check(g.cap === CAP && g.capLines === 1 && JSON.stringify(g.key) === JSON.stringify(KEY(name === 'All' ? null : name, false)) && JSON.stringify(g.plates) === JSON.stringify(want),
      `${name}: the plates in order (${g.plates.join(', ')}); the Datelines' label on one line, "${g.cap}"${g.key.length ? `, its key: ${g.key.join(', ')}` : ''} (HOUSE 11.1 rules 4, 6 and 9)`);
    const k = await w(() => { const b = document.getElementById('pane').lastElementChild, r = b.getBoundingClientRect(), s = b.previousElementSibling && b.previousElementSibling.getBoundingClientRect(); return { tag: b.tagName, cls: b.className, text: b.textContent, h: r.height, gap: s ? r.top - s.bottom : null }; });
    check(k.tag === 'BUTTON' && k.cls === 'aboutlink' && k.text === ABOUT_KEY && k.h >= 44 && Math.abs(k.gap - 14) < 0.5, `${name}: the pane ends with the key "${k.text}", ${Math.round(k.h)} px tall, ${k.gap} px under the last plate (HOUSE 11.1 rule 1)`);
    console.log(`      ${name} drawn and checked in ${Date.now() - t0} ms (headless)`);
    await A.shot(`${fileName(name)}-${scheme}`, ['All', 'Europe', 'Americas', 'Oceania'].includes(name));
  }

  // the register on All: the sources' table against this file's decode, their colors, the regions' heads, two-line summaries
  {
    await A.pane('All');
    const items = snap.regions.flatMap((r) => r.items);
    const wantRows = NAMES.map((n) => [n, String(items.filter((x) => x.source === n).length), `${snap.feeds.filter((f) => f.source === n && f.ok).length} of ${snap.feeds.filter((f) => f.source === n).length}`]);
    const t = await w(() => ({ head: [...document.querySelectorAll('.keytab th')].map((x) => x.textContent), rows: [...document.querySelectorAll('.keytab tr')].slice(1).map((tr) => [...tr.children].map((x) => x.textContent)),
      sw: [...document.querySelectorAll('.keytab .sw')].map((x) => getComputedStyle(x).backgroundColor), align: [...document.querySelectorAll('.keytab tr:nth-child(2) td')].map((x) => getComputedStyle(x).textAlign) }));
    check(t.head.join() === 'Source,Headlines,Feeds' && JSON.stringify(t.rows) === JSON.stringify(wantRows) && JSON.stringify(t.sw) === JSON.stringify(SRC_TOK[scheme].map(rgbOf)) && t.align.join() === 'left,right,right',
      `All's table of sources, also the colors' key: ${t.rows.map((r) => r.join(' ')).join('; ')}; each swatch its token (${SRC_TOK[scheme].join(', ')}), the figures right-aligned (HOUSE 11.1 rule 3, 11.3)`);
    const fills = await w(() => [...document.querySelectorAll('.dl g.row')].map((g) => [...g.querySelectorAll('rect.tk')].map((r) => [r.getAttribute('class'), getComputedStyle(r).fill])));
    const ticks = fills.flat(), slotOk = ticks.every(([cls, fill]) => { const m = cls.match(/src-(\d)/); return m && fill === rgbOf(SRC_TOK[scheme][m[1] - 1]); });
    const byClass = {}; for (const [cls] of ticks) byClass[cls] = (byClass[cls] || 0) + 1;
    const wantClass = {}; for (const it of items) { const k = `tk src-${SLOT.get(it.source)}`; wantClass[k] = (wantClass[k] || 0) + 1; }
    const shared = items.length - ticks.length;   // parts of a shared tick past the fourth are not drawn; none in this file
    check(slotOk && shared === 0 && JSON.stringify(Object.entries(byClass).sort()) === JSON.stringify(Object.entries(wantClass).sort()),
      `All: every tick in its source's color, ${Object.entries(byClass).sort().map(([k, v]) => `${v} ${k.slice(3)}`).join(', ')}, as this file's sources say`);
    const heads = await w(() => [...document.querySelectorAll('#pane > .sec:not(.lead-sec)')].map((p) => [p.querySelector('h2').textContent, p.querySelector('.sec-meta').textContent]));
    const wantHeads = snap.regions.map((r) => [r.name, `${r.items.length} headlines, newest ${ageShort(Math.min(...r.items.map((it) => hours(it.published))))}`]);
    check(JSON.stringify(heads) === JSON.stringify(wantHeads), `each region's plate heads with its count and its newest headline's age, floored: ${heads.map((h) => h.join(': ')).join('; ')}`);
    const sums = await w(() => [...document.querySelectorAll('.sum')].map((x) => [x.className, x.getBoundingClientRect().height, x.scrollHeight]));
    check(sums.length > 10 && sums.every(([c, h]) => c === 'sum clamp' && h <= 34.5) && sums.some(([, h, sh]) => sh > h + 1),
      `All: ${sums.length} summaries held to two lines (at most ${Math.max(...sums.map((x) => x[1]))} px), ${sums.filter(([, h, sh]) => sh > h + 1).length} of them cut (display only; HOUSE 11.1 rule 10)`);
    await A.pane('Europe');
    const full = await w(() => [...document.querySelectorAll('.sum')].map((x) => [x.className, x.scrollHeight - x.clientHeight]));
    check(full.every(([c, d]) => c === 'sum' && d <= 1), `Europe: its ${full.length} summaries whole`);
    const sl = await w(() => [...document.querySelectorAll('.story')].map((st) => { const sw = st.querySelector('.src .sw'); return [st.querySelector('.src').textContent, sw ? getComputedStyle(sw).backgroundColor : null]; }));
    const eu = snap.regions[0], others = new Map();
    for (const r of snap.regions) for (const it of r.items) others.set(it.link, [...(others.get(it.link) || []), r.name]);
    const wantSl = eu.items.map((it) => {
      const d = new Date(Date.parse(it.published)), dateOnly = /T(00|12):00:00Z$/.test(it.published), o = oslo(Date.parse(it.published));
      const when = dateOnly ? `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` : `${o.getUTCDate()} ${MON[o.getUTCMonth()]}, ${hm(o)}`;
      const also = others.get(it.link).filter((n) => n !== eu.name);
      return [[it.source, when, it.author ? `by ${it.author}` : null].filter(Boolean).join(', ') + (also.length ? `, also under ${also.join(', ')}` : ''), rgbOf(SRC_TOK[scheme][SLOT.get(it.source) - 1])];
    });
    check(JSON.stringify(sl) === JSON.stringify(wantSl), `Europe: each source line is its swatch in the source's color, the name, the date and the byline joined to it (HOUSE 11.1 rule 10): "${sl[0][0]}"`);
  }

  // the Datelines: every tick against this file's decode, the ink on rendered pixels, the label
  for (const name of ['All', 'Europe']) {
    await A.pane(name);
    const G = await geometryOf(w), mine = clusters(G.width, G.label), drawn = await drawnOf(w);
    const want = mine.map((cl) => cl.map((c) => [Math.round(c[0].x), Math.min(4, c.length)]));
    const same = drawn.length === want.length && drawn.every((row, i) => row.length === want[i].length && row.every(([x, k], j) => x === want[i][j][0] && k === want[i][j][1]));
    const hook = await w(() => window.__wn.datelines());
    const hookSame = hook.rows.every((r, i) => r.ticks.length === mine[i].length && r.ticks.every((t, j) => Math.abs(t.x - mine[i][j][0].x) < 1e-9 && t.items.map((x) => x[1]).join() === mine[i][j].map((c) => c.ii).join()));
    check(same && hookSame && hook.x0 === G.label, `${name}: ${drawn.reduce((s, r) => s + r.length, 0)} ticks in 6 rows, each at its x and in its parts as decoded here (label column ${G.label} px, plot ${Math.min(480, G.width - G.label - 6)} px)`);
    const ticks = await w(() => [...document.querySelectorAll('.dl g.row.on rect.tk')].map((r) => r.getBoundingClientRect().toJSON()));
    const img = await A.png(), samples = [];
    for (const r of ticks) for (let x = Math.round(r.left * 2) + 1; x < Math.round(r.right * 2) - 1; x++) for (let y = Math.round(r.top * 2) + 1; y < Math.round(r.bottom * 2) - 1; y++) samples.push(contrast(img.at(x, y), SHEET));
    const at3 = samples.filter((s) => s >= 3).length / samples.length;
    check(samples.length > 100 && at3 >= 0.9, `${name}: the chosen rows' ticks, ${samples.length} samples inside ${ticks.length} parts, ${(at3 * 100).toFixed(1)} % at 3:1 or more on their plate (ART.md: the sources' colors on --sheet 4.60 to 9.96; the lowest sample ${Math.min(...samples).toFixed(2)}, an antialiased part's edge)`);
    const lab = await w(() => document.querySelector('.dl').getAttribute('aria-label'));
    const eu = snap.regions[0], byAge = [...eu.items].sort((a, b) => hours(a.published) - hours(b.published));
    check(lab.startsWith(`Datelines. ${eu.name}: ${eu.items.length} headlines, the newest ${spokenItem(byAge[0].published)} and the oldest ${spokenItem(byAge[byAge.length - 1].published)} before the file was made.`) && (lab.match(/: \d+ headlines/g) || []).length === 6,
      `${name}: the picture's label for VoiceOver, a sentence a region: "${lab.slice(0, 90)}…"`);
  }

  // a tap on a tick: Europe's 23 Sep tick (two UN News stories at noon and a Global Voices one six hours before)
  {
    await A.pane('All');
    const G = await geometryOf(w), mine = clusters(G.width, G.label);
    const ci = mine[0].findIndex((c) => c.length === 3), cl = mine[0][ci], it = snap.regions[0].items[cl[0].ii];
    const d = new Date(Date.parse(it.published));
    const want = `${cl.length} headlines at this age. ${snap.regions[0].name}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}: ${it.title}${/[.?!…]$/.test(it.title) ? '' : '.'} ${it.source}, ${spokenItem(it.published)} before the file was made.`;
    const s = await A.rect('.dl');
    await w(() => { document.getElementById('live').textContent = ''; });
    await A.tapAt(s.left + cl[0].x + 4, s.top + 4 + 9);   // 4 px off the tick: the nearest within 22 px
    await page.waitForTimeout(400);
    const r = await w(() => {
      const cur = document.querySelector('[aria-current="true"]'), row = cur && cur.closest('.story'), m = document.getElementById('main').getBoundingClientRect();
      const disc = document.querySelector('.dl circle.sel');
      return { sel: window.__wn.selected(), id: row && row.id, link: cur && cur.tagName, n: document.querySelectorAll('[aria-current]').length, top: row && Math.round(row.getBoundingClientRect().top - m.top), live: document.getElementById('live').textContent,
        disc: disc && [Number(disc.getAttribute('cx')), Number(disc.getAttribute('cy')), Number(disc.getAttribute('r'))], rule: row && getComputedStyle(row, '::before').width, pane: window.__wn.pane() };
    });
    check(r.sel && r.sel.ri === 0 && r.sel.ii === cl[0].ii && r.id === `s-0-${cl[0].ii}` && r.link === 'A' && r.n === 1 && Math.abs(r.top - 8) <= 1 && r.pane === 'all' && r.rule === '2px'
      && r.disc && r.disc[0] === Math.round(cl[0].x) && r.disc[1] - r.disc[2] - 0.75 >= 4 + 3 && r.disc[1] + r.disc[2] + 0.75 <= 4 + 3 + 12,
      `a tap beside Europe's 23 Sep tick on All: its newest story (${it.source}, "${it.title.slice(0, 32)}…") marked with a 2 px rule, its link aria-current, scrolled to 8 px under the pane's top (${r.top}); a ringed head on the tick (cy ${r.disc && r.disc[1]}, r ${r.disc && r.disc[2]}) inside the tick's own 7 to 19 px, never the row above`);
    check(r.live === want, `said once: "${r.live}"`);
    await A.shot(`tick-tapped-${scheme}`, false);
    // across panes: on Americas, a tap on Oceania's newest tick chooses Oceania
    await A.pane('Americas');
    const oc = mine[5][0], s2 = await A.rect('.dl');
    await A.tapAt(s2.left + oc[0].x, s2.top + 4 + 5 * 18 + 9);
    await page.waitForTimeout(400);
    const q = await w(() => ({ pane: window.__wn.pane(), sel: window.__wn.selected(), tab: document.querySelector('.tabs [aria-selected="true"]').textContent, cur: ((document.querySelector('[aria-current="true"]') || { closest: () => ({}) }).closest('.story') || {}).id }));
    check(q.pane === snap.regions[5].key && q.tab === snap.regions[5].name && q.sel && q.sel.ri === 5 && q.cur === `s-5-${oc[0].ii}`, `across panes: a tap on ${snap.regions[5].name}'s newest tick from the Americas pane chooses ${q.tab} and marks its story (${q.cur})`);
    await A.pane('All');
    check(await w(() => window.__wn.selected() === null && !document.querySelector('[aria-current]')), 'another pane clears the selection');
    const lc = await A.rect('.dl');
    await A.tapAt(lc.left + 20, lc.top + 4 + 9);   // on the label column: nothing
    await page.waitForTimeout(200);
    check(await w(() => window.__wn.selected() === null && document.getElementById('main').scrollTop === 0), 'a tap on a region\'s name picks nothing');
    const dr = await dragOn(A);
    check(!dr.sel && dr.live === '' && dr.cur === 0 && dr.top > 100, `a vertical swipe that starts on the Datelines scrolls the pane by ${Math.round(dr.top)} px, picks nothing and says nothing`);
    // VoiceOver's double-tap on the image, as WebKit runs it (AccessibilityObject::press, WebKit main read on
    // 2026-10-02): its action element is the image or the nearest ancestor below <body> with a click, mousedown or
    // mouseup listener. With none, press() fails and iOS taps the image's centre instead, on the taps' layer and
    // within reach of a Middle East tick at every phone width; that is modelled here by a touch there. With one,
    // the press stays on the image (the layer a hit test finds at its centre is not inside it) and dispatches
    // mousedown, mouseup and click on it at its centre. Either way it must pick nothing. Then a finger's path: a
    // click on the svg at a tick's place picks nothing, and on the layer there picks the tick.
    await w(() => { document.getElementById('main').scrollTop = 0; });
    for (const name of ['Europe', 'Asia']) {
      await A.pane(name);
      const key = snap.regions.find((x) => x.name === name).key;
      let up = 0, action = -1;
      for (; action < 0; up++) {
        const o = await A.cdp.send('Runtime.evaluate', { expression: `(() => { let e = document.querySelector('.dl'); for (let i = 0; i < ${up} && e; i++) e = e.parentElement; return e === document.body ? null : e; })()` });
        if (!o.result.objectId) break;
        const L = await A.cdp.send('DOMDebugger.getEventListeners', { objectId: o.result.objectId });
        if (L.listeners.some((l) => ['click', 'mousedown', 'mouseup'].includes(l.type))) action = up;
      }
      const s = await A.rect('.dl'), cx = s.left + s.width / 2, cy = s.top + s.height / 2;
      await w(() => { document.getElementById('live').textContent = ''; });
      const pr = await w(([n, x, y]) => {
        const svg = document.querySelector('.dl'), h = document.elementFromPoint(x, y);
        let a = svg, press = svg;   // an action element at or above the image leaves the press on it
        for (let i = 0; i < n; i++) a = a.parentElement;
        if (h && h !== press && press.contains(h)) press = h;
        if (n >= 0) {
          for (const type of ['mousedown', 'mouseup']) press.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y }));
          press.dispatchEvent(new PointerEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: -1, pointerType: '' }));
        }
        return { action: n < 0 ? null : a.getAttribute('class'), hit: h && h.getAttribute('class'), press: press.getAttribute('class'), hidden: document.querySelector('.dlhit').getAttribute('aria-hidden'), role: svg.getAttribute('role') };
      }, [action, cx, cy]);
      if (action < 0) await A.tapAt(cx, cy);
      await page.waitForTimeout(150);
      const after = await w(() => ({ pane: window.__wn.pane(), sel: window.__wn.selected(), live: document.getElementById('live').textContent }));
      const tree = await page.locator('#pane').ariaSnapshot();
      check(pr.action === 'dlw' && pr.hit === 'dlhit' && pr.press === 'dl' && after.pane === key && after.sel === null && after.live === '' && pr.hidden === 'true' && pr.role === 'img' && /img "Datelines\. /.test(tree),
        `${name}: VoiceOver's press on the image: ${pr.action ? `its action element .${pr.action}; the hit test at its centre finds .${pr.hit}, outside the image, so the click lands on .${pr.press}` : `no action element, so press() fails and iOS taps its centre, on .${pr.hit}`}: ${after.sel ? `it picked ${JSON.stringify(after.sel)} on ${after.pane}` : 'nothing picked, nothing said, the pane kept'}; the image is one img in the tree, the layer aria-hidden`);
      // a finger's path, from the pane as chosen: the tick of Middle East nearest the image's centre
      await A.pane(name);
      const d = await w(() => window.__wn.datelines()), t = d.rows[3].ticks.reduce((b, q) => (Math.abs(q.x - s.width / 2) < Math.abs(b.x - s.width / 2) ? q : b));
      const tx = s.left + t.x, ty = s.top + 4 + 3 * 18 + 9;
      const fp = await w(([x, y]) => {
        const click = (e) => e.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, detail: 1 }));
        click(document.querySelector('.dl'));
        const onSvg = { pane: window.__wn.pane(), sel: window.__wn.selected() };
        click(document.querySelector('.dlhit'));
        return { onSvg, pane: window.__wn.pane(), sel: window.__wn.selected() };
      }, [tx, ty]);
      await page.waitForTimeout(150);
      check(fp.onSvg.pane === key && fp.onSvg.sel === null && fp.pane === snap.regions[3].key && fp.sel && fp.sel.ri === 3 && fp.sel.ii === t.items[0][1],
        `${name}: a click on the svg at Middle East's tick at x ${t.x.toFixed(1)} picks ${fp.onSvg.sel ? JSON.stringify(fp.onSvg.sel) : 'nothing'}; on the layer there it picks that tick's newest story (${JSON.stringify(fp.sel)}) and chooses Middle East`);
    }
    // the stretched link: the headline alone is the link; a tap on the summary lands on it; the rest is text after it
    await A.pane('Europe');
    const st = await w(() => {
      const row = document.querySelector('.story'), a = row.querySelector('a'), sum = row.querySelector('.sum') || row.querySelector('.src'), b = sum.getBoundingClientRect();
      const at = document.elementFromPoint(b.left + 10, b.top + b.height / 2);
      return { name: a.textContent, title: row.querySelector('.hl').textContent, kids: [...row.children].map((e) => e.className), hit: at === a, link: row.children[0] === a };
    });
    const story = await page.locator('.story').first().ariaSnapshot();
    check(st.link && st.name === st.title && st.hit && ['hl,src', 'hl,src,sum'].includes(st.kids.join()) && /^- link "/m.test(story) && /^- text: /m.test(story),
      `a story: the link is its headline alone ("${st.name.slice(0, 32)}…"), a tap on its summary lands on the link, and the source line (its byline joined) and the summary follow it as text (${st.kids.join(', ')})`);
  }
  await closeOut(A, scheme);
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once');
{
  const A = await open('light');
  const { page, w } = A;
  // the first Tab after the load lands on the stamp, the first control, never past the tabs
  {
    await w(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Tab');
    const first = await w(() => document.activeElement.id || document.activeElement.textContent);
    check(first === 'stamp', `the first Tab after the load: ${first} (the stamp, then the chosen tab)`);
  }
  // the tabs by keyboard: an arrow chooses the next pane, focus follows; Home and End
  {
    await w(() => document.querySelector('.tabs [aria-selected="true"]').focus());
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    const k = await w(() => [window.__wn.pane(), document.activeElement.textContent, document.getElementById('live').textContent]);
    check(k[0] === snap.regions[0].key && k[1] === 'Europe' && k[2] === '', `the tabs by keyboard: ArrowRight chooses ${k[1]}, focus follows, and the live region adds nothing (the focused tab says its name; HOUSE 4.9)`);
    const f = await w(() => { const b = document.activeElement, r = b.getBoundingClientRect(), n = b.parentElement.getBoundingClientRect(), o = parseFloat(getComputedStyle(b).outlineOffset) || 0, ow = parseFloat(getComputedStyle(b).outlineWidth);
      return { vis: b.matches(':focus-visible'), off: o, inside: r.top - o - ow >= n.top - 0.5 && r.bottom + o + ow <= n.bottom + 0.5 }; });
    check(f.vis && f.off === -2 && f.inside, `the focus ring on a tab drawn inside the row that scrolls (offset ${f.off} px)`);
    await page.keyboard.press('End');
    await page.waitForTimeout(250);
    const e = await w(() => [document.activeElement.textContent, (() => { const b = document.activeElement.getBoundingClientRect(), r = document.getElementById('tabs').getBoundingClientRect(); return b.left >= r.left - 0.5 && b.right <= r.right + 0.5; })()]);
    await page.keyboard.press('Home');
    await page.waitForTimeout(250);
    check(e[0] === 'Oceania' && e[1] && await w(() => document.activeElement.textContent === 'All' && window.__wn.pane() === 'all'), `End chooses ${e[0]}, scrolled whole into the row; Home chooses All`);
  }
  // the last tab chosen by touch on its visible part: scrolled whole into view
  {
    const t = await A.rect('.tabs button:last-child'), row = await A.rect('#tabs');
    await A.tapAt(Math.min(t.right, row.right) - 8, t.top + t.height / 2);
    await page.waitForTimeout(400);
    const r = await A.rect('.tabs button:last-child');
    check(await w(() => window.__wn.pane()) === snap.regions[5].key && r.left >= row.left - 0.5 && r.right <= row.right + 0.5, `the last tab, its right edge at ${Math.round(t.right)} past the row's ${Math.round(row.right)} px, tapped by touch: chosen and whole in the row`);
    await A.pane('All');
  }
  // About: opens from the stamp, holds the rest inert, carries every source word for word, closes on Escape
  {
    const s = await A.rect('#stamp');
    await A.tapAt(s.left + 20, s.top + s.height / 2);
    await page.waitForTimeout(400);
    const a = await w(() => ({ open: !document.getElementById('about').hidden, inert: ['head', 'main'].every((id) => document.getElementById(id).inert), focus: document.activeElement.id,
      credit: document.getElementById('about-credit-line').textContent, firstP: document.querySelector('#about-credit-line').previousElementSibling.tagName,
      text: document.querySelector('.about-body').textContent.replace(/[ \t\n]+/g, ' '),
      list: [...document.querySelectorAll('#about-list dt')].map((d, i) => `${d.textContent} ${document.querySelectorAll('#about-list dd')[i].textContent}`),
      links: [...document.querySelectorAll('#about-sources a')].map((x) => [x.textContent, x.getAttribute('href')]) }));
    const words = snap.sources.every((src) => a.text.includes(src.name) && a.text.includes(src.attribution) && a.text.includes(src.licence));
    const links = snap.sources.every((src, i) => a.links[i] && a.links[i][1] === src.terms && a.links[i][0] === src.terms.replace(/^https?:\/\//, ''));
    const dateOnly = snap.regions.flatMap((r) => r.items).filter((i) => /T(00|12):00:00Z$/.test(i.published)).length;
    const wantList = ['Updated: Thu 1 Oct 2026, 07:01 (UTC+2)', 'Stale after: 30 hours', `Regions: ${snap.regions.length}`, `Headlines: ${snap.regions.reduce((n, r) => n + r.items.length, 0)}`, `Dates without a time: ${dateOnly}`, `Feeds: ${FEEDS.replace(' feeds answered', '')} answered on the last run`, 'In two regions or more: 3'];
    check(a.open && a.inert && a.focus === 'about-close' && a.credit === CREDITS && a.firstP === 'H3' && a.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.') && words && links,
      `About opens from the stamp, focus on Close, the rest inert; the credit "${a.credit}" first under Sources and credits; every source's name, attribution and license line word for word, its terms address printed without its scheme as the link; the face's credit`);
    check(JSON.stringify(a.list) === JSON.stringify(wantList), `About's This data: ${a.list.join('; ')}`);
    await A.shot('about-light');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp' && !document.getElementById('main').inert), 'About closes on Escape; focus returns to the stamp');
    // the About key at the pane's end, by touch: About opens, and closing it returns focus to the key
    await w(() => { const m = document.getElementById('main'); m.scrollTop = m.scrollHeight; });
    await page.waitForTimeout(150);
    const kb = await A.rect('#pane > .aboutlink');
    await A.tapAt(kb.left + 30, kb.top + kb.height / 2);
    await page.waitForTimeout(400);
    const ok1 = await w(() => !document.getElementById('about').hidden && document.activeElement.id === 'about-close');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(ok1 && await w(() => document.getElementById('about').hidden && document.activeElement.className === 'aboutlink'), `the key "${ABOUT_KEY}" at the pane's end, tapped: About opens; Escape brings focus back to the key`);
    await w(() => { document.getElementById('main').scrollTop = 0; });
  }
  // two taps racing (World News has no scrub, so this is its race): a tap on Europe's newest tick and, in the same
  // task, before the page has drawn or said it, one on Oceania's (the first tap scrolls the pane to its story, so the
  // second is placed on the layer where it then is); the last tap wins, the selection, the marked story and the sentence
  {
    await A.pane('All');
    await w(() => { document.getElementById('live').textContent = ''; });
    const G = await geometryOf(w), mine = clusters(G.width, G.label);
    const eu = mine[0][0], oc = mine[5][0];
    await w(([ex, ox]) => {
      const click = (x, row) => { const l = document.querySelector('.dlhit'), b = l.getBoundingClientRect(); l.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: b.left + x, clientY: b.top + 4 + row * 18 + 9, detail: 1 })); };
      click(ex, 0);
      click(ox, 5);
    }, [eu[0].x, oc[0].x]);
    await page.waitForTimeout(500);
    const r = await w(() => ({ sel: window.__wn.selected(), cur: [...document.querySelectorAll('[aria-current="true"]')].map((x) => x.closest('.story').id), live: document.getElementById('live').textContent }));
    const it = snap.regions[5].items[oc[0].ii];
    check(r.sel && r.sel.ri === 5 && r.sel.ii === oc[0].ii && r.cur.join() === `s-5-${oc[0].ii}` && r.live.startsWith(`${oc.length > 1 ? `${oc.length} headlines at this age. ` : ''}Oceania, `) && r.live.includes(it.title.trim().slice(0, 20)),
      `two taps racing, Europe's newest tick then Oceania's: the last wins (${JSON.stringify(r.sel)}, ${r.cur.join()}), said once for it: "${r.live.slice(0, 60)}…"`);
    await A.pane('All');
  }
  // hidden and back: the snapshot is read again; the same file redraws only the stamp
  await A.pane('Africa');
  {
    const n0 = snapshotReads;
    await w(() => { document.getElementById('pane').firstElementChild.dataset.old = '1'; document.getElementById('main').scrollTop = 500; });
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => [document.getElementById('main').scrollTop, window.__wn.pane(), !!document.querySelector('#pane [data-old]')]);
    check(snapshotReads === n0 + 1 && s[1] === 'africa' && s[2] && Math.abs(s[0] - 500) < 2, `back on screen: the snapshot read again (${snapshotReads - n0}); the same file redraws nothing; Africa and its scroll (${s[0]} px) kept`);
    const later = new Date(GEN + 3600e3).toISOString().replace('.000Z', 'Z');
    override = { '/data/snapshot.json': { body: raw.replace(`"generatedAt": "${snap.generatedAt}"`, `"generatedAt": "${later}"`) } };
    await w(() => { document.getElementById('live').textContent = ''; });
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(700);
    const t = await w(() => ({ redrawn: !document.querySelector('#pane [data-old]'), stamp: document.getElementById('stamp').textContent, top: document.getElementById('main').scrollTop, pane: window.__wn.pane(), live: document.getElementById('live').textContent }));
    check(t.redrawn && t.stamp === `Updated 08:01, ${FEEDS}` && t.pane === 'africa' && Math.abs(t.top - 500) < 2 && t.live === 'New headlines, updated 08:01.',
      `back on screen with a new file ("${t.stamp}"): drawn again in place, Africa and its scroll (${t.top} px) kept; said once: "${t.live}"`);
  }
  // a broken replacement keeps the headlines, the stamp and the view, and says so (B6)
  {
    override = { '/data/snapshot.json': { body: '<!doctype html><title>404</title>' } };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => ({ notice: document.getElementById('notice').hidden ? '' : document.querySelector('#notice p').textContent, stories: document.querySelectorAll('#pane .story').length, tabs: !document.getElementById('tabs').hidden, stamp: document.getElementById('stamp').textContent, scroll: document.getElementById('main').scrollTop }));
    check(s.notice === 'The new data/snapshot.json is not valid JSON; it looks like a web page or an error was written over it. Still showing the headlines from 1 Oct, 08:01.' && s.stories === 8 && s.tabs && s.stamp.startsWith('Updated 08:01') && Math.abs(s.scroll - 500) < 2,
      `B6: a broken replacement while open: "${s.notice}"; the stories, the tabs, the stamp and the scroll kept`);
    await A.shot('broken-replacement-light', false);
    const kb = await A.rect('#notice .textkey');
    await A.tapAt(kb.left + kb.width / 2, kb.top + kb.height / 2);
    await page.waitForTimeout(150);
    check(kb.height >= 44 && kb.width >= 44 && await w(() => document.getElementById('notice').hidden && document.querySelectorAll('#pane .story').length === 8), `the plate's Close key (${Math.round(kb.width)} × ${Math.round(kb.height)}) puts it away; the headlines stay`);
    override = {};
  }
  await closeOut(A, 'once');
}
// the same words on every locale: dates and times built by hand (B1)
{
  const texts = [];
  for (const locale of ['en-US', 'en-GB', 'nb-NO', 'ja-JP']) {
    const A = await open('light', { locale });
    texts.push([locale, await A.w(() => [document.getElementById('head').innerText, document.getElementById('pane').innerText].join('\n'))]);
    await closeOut(A, `locale ${locale}`);
  }
  check(texts.every(([, t]) => t === texts[0][1]), `the same words, letter for letter, under ${texts.map(([l]) => l).join(', ')} (${texts[0][1].length} characters on All)`);
}
// stale: 31 hours after the file was made, "Stale." in ink, the date in the stamp
{
  const A = await open('light', { time: new Date(GEN + 31 * 3600e3).toISOString() });
  const s = await A.w(() => ({ text: document.getElementById('stamp').textContent, ink: getComputedStyle(document.querySelector('#stamp .lead')).color === getComputedStyle(document.querySelector('h1')).color }));
  check(s.text === `Stale. Updated ${WHEN}, ${FEEDS}` && s.ink, `B2: 31 hours on: "${s.text}", the word in ink, never a color`);
  await stampCheck(A, 'stale');
  await closeOut(A, 'stale');
}
// a later year: the stamp and the stories carry their year
{
  const A = await open('light', { time: '2027-01-05T10:00:00Z' });
  const s = await A.w(() => ({ stamp: document.getElementById('stamp').textContent, src: [...document.querySelectorAll('.src')].map((x) => x.textContent).slice(0, 2) }));
  check(s.stamp === `Stale. Updated 1 Oct 2026, 07:01, ${FEEDS}` && s.src[0] === 'Global Voices, 29 Sep 2026, by Elmira Lyapina, also under Middle East' && s.src[1] === 'Global Voices, 28 Sep 2026, 08:00, by Nevena Borisova', `on 5 Jan 2027: "${s.stamp}"; "${s.src.join('" "')}"`);
  await stampCheck(A, 'the longest it writes: stale, with the year');
  await closeOut(A, 'a later year');
}
// a copy with Europe's feeds kept from an earlier run, and Oceania empty (B2, B5)
for (const scheme of schemes) {
  const kept = JSON.parse(raw);
  kept.regions[0].stale = true;
  for (const it of kept.regions[0].items) it.stale = true;
  for (const f of kept.feeds) if (f.region === 'Europe') { f.ok = false; f.note = `HTTP 503; kept ${kept.regions[0].items.filter((i) => i.feed === f.id).length} cached`; }
  kept.regions[5].items = [];
  override = { '/data/snapshot.json': { body: JSON.stringify(kept) } };
  const A = await open(scheme);
  const { page, w } = A;
  await A.pane('Europe');
  const s = await w(() => {
    const tab = [...document.querySelectorAll('.tabs button')].find((b) => b.textContent === 'Europe');
    return { name: tab && tab.textContent, desc: tab && document.getElementById(tab.getAttribute('aria-describedby')).textContent, label: tab && tab.getAttribute('aria-label'),
      hollow: document.querySelectorAll('.dl g.row:first-of-type rect.ho').length, ink: document.querySelectorAll('.dl g.row:first-of-type rect.tk').length,
      st: [...document.querySelectorAll('.statement')].map((p) => p.textContent), src: [...document.querySelectorAll('.src')].map((x) => x.textContent), cap: document.querySelector('.lead-sec .cap').textContent, key: [...document.querySelectorAll('.lead-sec .key .k')].map((k) => k.textContent), keyH: (document.querySelector('.lead-sec .key') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height, stamp: document.getElementById('stamp').textContent,
      stroke: getComputedStyle(document.querySelector('.dl g.row.on rect.ho')).stroke, ink2: getComputedStyle(document.querySelector('h1')).color };
  });
  const tabCount = await page.getByRole('tab', { name: 'Europe', exact: true }).count();
  check(tabCount === 1 && s.name === 'Europe' && !s.label && s.desc === 'Kept from an earlier run: its feeds did not answer.', `B5: Europe's tab keeps its name, exactly "${s.name}" (the camera finds it), its state a description: "${s.desc}"`);
  check(s.hollow === 8 && s.ink === 0 && s.stroke === s.ink2, `Europe's row: ${s.hollow} hollow parts in ink, no filled one (a failed feed shows by its shape)`);
  check(s.st[0] === 'Europe’s feeds did not answer on the last run: gv-western-europe, gv-eastern-europe and un-europe (HTTP 503). These 8 headlines are kept from an earlier run.' && s.src.every((x) => x.includes(', kept from an earlier run')),
    `B2: the statement "${s.st[0]}"; every story says "kept from an earlier run"`);
  check(s.cap === CAP && JSON.stringify(s.key) === JSON.stringify(KEY('Europe', true, kept)) && s.keyH <= 15.5 && s.stamp === `Updated 07:01, ${snap.feeds.length - 3} of ${snap.feeds.length} feeds answered`, `the Datelines' label "${s.cap}" and its key on one line, ${s.key.join(', ')}; the stamp "${s.stamp}"`);
  await A.shot(`europe-kept-${scheme}`, false);
  await A.pane('Oceania');
  const o = await w(() => [[...document.querySelectorAll('.statement')].map((p) => p.textContent).join(), document.querySelector('.dl').getAttribute('aria-label').endsWith('Oceania: no headlines.')]);
  check(o[0] === 'No headlines for Oceania on the last run, and none kept from an earlier one.' && o[1], `an empty region: "${o[0]}", and its row says so to VoiceOver`);
  const c = await contrastOf(w);
  check(c.worst[0] >= 4.5, `kept and empty, ${scheme}: the lowest text contrast ${c.worst[0]}:1 (${c.worst[1]})`);
  await A.pane('All');
  await A.shot(`all-kept-${scheme}`, false);
  await closeOut(A, `Europe kept, Oceania empty, ${scheme}`);
  override = {};
}
// Reduce Motion: every animation at 0 s
{
  const A = await open('light', { reduced: true });
  const d = await A.w(() => [getComputedStyle(document.querySelector('.tabs [aria-selected="true"]'), '::after').animationDuration, getComputedStyle(document.querySelector('.about-sheet')).animationDuration]);
  check(d.every((x) => x === '0s'), `Reduce Motion: the tracer and About at ${d.join(', ')}; nothing else moves`);
  await closeOut(A, 'reduce motion');
}
// broken data at the start: a sentence on a plate, never a blank pane; then the file mended, and the app reads it
for (const [label, ov, want] of [
  ['missing', { status: 404 }, 'data/snapshot.json could not be read (HTTP 404).'],
  ['a web page', { body: '<!doctype html><html><body>Not Found</body></html>' }, 'data/snapshot.json is not valid JSON; it looks like a web page or an error was written over it.'],
  ['an error envelope', { body: '{"message":"Not Found","documentation_url":"x"}' }, 'data/snapshot.json is not the shape this app expects: it has no generatedAt, so its age cannot be told.'],
  ['every region empty', { body: JSON.stringify({ ...snap, regions: snap.regions.map((r) => ({ ...r, items: [] })) }) }, 'data/snapshot.json is not the shape this app expects: every region in it is empty: no feed answered on the last run, and none was kept from an earlier one.'],
]) {
  override = { '/data/snapshot.json': ov };
  const A = await open('light', { noWait: true, expect: /HTTP 404|404 \(Not Found\)|Failed to load resource|requestfailed .*\/data\/snapshot\.json/ });
  await A.page.waitForSelector('#notice:not([hidden])', { timeout: 15000 });
  const s = await A.w(() => ({ first: document.querySelector('#notice p').textContent, next: document.querySelector('#notice .notice-lines').textContent, role: document.getElementById('notice').getAttribute('role'), tabs: document.getElementById('tabs').hidden, stamp: document.getElementById('stamp').textContent, mono: [...document.querySelectorAll('#notice *')].some((e) => /mono/i.test(getComputedStyle(e).fontFamily)), tick: document.getElementById('notice').textContent.includes('`') }));
  check(s.first === want && s.next === 'In Snuggery, Options, then App Files shows what the file holds.' && s.role === 'alert' && s.tabs && s.stamp === 'No usable data' && !s.mono && !s.tick,
    `broken data, ${label}: "${s.first}" on a plate (role alert), no tabs, no monospace, no backtick (B7)`);
  if (label === 'missing') await stampCheck(A, 'no usable data');
  if (label === 'an error envelope') await A.shot('broken-envelope-light', false);
  const sb = await A.rect('#stamp');
  await A.tapAt(sb.left + 20, sb.top + sb.height / 2);
  await A.page.waitForTimeout(300);
  check(await A.w(() => !document.getElementById('about').hidden && document.getElementById('about-list').parentElement.hidden), `broken data, ${label}: the stamp opens About (its prose and credits; This data hidden)`);
  await A.page.keyboard.press('Escape');
  if (label === 'missing') {
    override = {};
    await A.w(() => document.dispatchEvent(new Event('visibilitychange')));
    await A.page.waitForFunction(() => window.__wn.ready(), null, { timeout: 10000 });
    check(await A.w(() => document.getElementById('notice').hidden && !document.getElementById('tabs').hidden) && await A.page.getByRole('tab', { name: 'Europe', exact: true }).count() === 1, 'the file mended while the app is open: a return reads it, the plate goes and the tabs come');
  }
  await closeOut(A, `broken data, ${label}`);
}
override = {};
// the widths: no sideways scroll, the Datelines inside their plate; on its side; a wide screen with the header
// centered on the pane's column (plan 0011's owed item)
for (const [label, wv, hv, kept] of [['320 × 700', 320, 700], ['360 × 740', 360, 740], ['375 × 667', 375, 667], ['125 % text (312 × 675)', 312, 675], ['125 % text with every region kept (312 × 675)', 312, 675, true], ['on its side (844 × 390)', 844, 390], ['640 × 900', 640, 900], ['a tablet (820 × 1180)', 820, 1180], ['wide (1024 × 768)', 1024, 768]]) {
  if (kept) { const k = JSON.parse(raw); k.generatedAt = '2026-10-10T05:01:21Z'; for (const r of k.regions) { r.stale = true; for (const it of r.items) it.stale = true; } override = { '/data/snapshot.json': { body: JSON.stringify(k) } }; }
  const A = await open('light', { w: wv, h: hv, time: kept ? '2026-10-10T10:00:00Z' : NOW });
  const r = [];
  for (const name of PANES) {
    await A.pane(name);
    r.push(await A.w(() => {
      const m = document.getElementById('main'), dl = document.querySelector('.dl').getBoundingClientRect(), plate = document.querySelector('.lead-sec'), pr = plate.getBoundingClientRect(), ps = getComputedStyle(plate);
      return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, pane: m.clientHeight, head: document.getElementById('head').getBoundingClientRect().height,
        dl: dl.right <= pr.right - parseFloat(ps.paddingRight) + 0.5, at: [document.querySelector('h1').getBoundingClientRect().left, pr.left, pr.right] };
    }));
  }
  const side = r.filter((x) => x.side).length, dl = r.every((x) => x.dl);
  const land = wv > hv && hv < 500 ? r.every((x) => x.head <= 47 && x.pane >= 220) : true;
  const along = r.every((x) => Math.abs(x.at[0] - x.at[1]) < 0.5 && (wv <= 760 || Math.abs((x.at[1] + x.at[2]) / 2 - wv / 2) < 1));
  check(side === 0 && land && dl && along, `${label}: no sideways scroll on any pane, the Datelines inside their plate, the name starting where the first plate does (${Math.round(r[0].at[0])} and ${Math.round(r[0].at[1])} px${wv > 760 ? `; the column ${Math.round(r[0].at[1])} to ${Math.round(r[0].at[2])} of ${wv} px, centered` : ''})${land && wv > hv && hv < 500 ? `, the header one ${Math.round(r[0].head)} px row, the pane ${Math.round(Math.min(...r.map((x) => x.pane)))} px tall` : ''}`);
  await A.pane('All');
  if (wv === 320) await A.shot('all-320-light', false);
  if (wv > hv && hv < 500) await A.shot('all-landscape-light', false);
  if (wv === 1024) await A.shot('all-wide-light', false);
  await closeOut(A, label);
  override = {};
}
// a crafted copy at 320 px: a long unbroken word, a long region name, and six headlines on one Middle East tick
{
  const c = JSON.parse(raw);
  c.regions[0].items[0].title = `Die ${'Donaudampfschifffahrtsgesellschaftskapitänswitwenrentenversicherung'} und das Wetter`;
  c.regions[1].name = 'Latin America and the Caribbean';
  const me = c.regions[3].items;
  for (let j = 0; j < 6; j++) me[j].published = '2026-09-28T12:00:00Z';
  override = { '/data/snapshot.json': { body: JSON.stringify(c) } };
  const A = await open('light', { w: 320, h: 640 });
  const out = [];
  for (const name of ['All', 'Europe', 'Middle East']) {
    await A.pane(name);
    out.push(await A.w(() => {
      const m = document.getElementById('main'), labs = [...document.querySelectorAll('.dl .lab')].map((t) => t.getBBox());
      const touch = labs.some((a, i) => labs.some((b, j) => i < j && a.x < b.x + b.width + 2 && b.x < a.x + a.width + 2));
      return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, touch, labs: labs.length, cnt: [...document.querySelectorAll('.dl .cnt')].map((t) => t.textContent) };
    }));
  }
  await A.shot('crafted-320-light', false);
  check(out.every((o) => !o.side && !o.touch && o.labs >= 2) && out[2].cnt.join() === '6',
    `a crafted copy at 320 px: a 66-letter word wraps (no sideways scroll on All, Europe, Middle East); a long region name leaves ${out[0].labs} scale labels, none touching; a tick of six headlines prints "${out[2].cnt.join()}" beside its four parts`);
  await closeOut(A, 'crafted');
  override = {};
}
// the stamp on its own day and the day after, on one line (HOUSE 7.2, plan 0012 F8); the loading line
{
  const A = await open('light', { time: new Date(GEN + 3600e3).toISOString() });
  await stampCheck(A, 'fresh, the file\'s own day');
  await closeOut(A, 'stamp fresh');
  const B = await open('light', { time: new Date(GEN + 24 * 3600e3).toISOString() });
  check(await B.w(() => document.getElementById('stamp').textContent) === `Updated ${WHEN}, ${FEEDS}`, `the day after: "Updated ${WHEN}, ${FEEDS}"`);
  await stampCheck(B, 'the day after');
  await closeOut(B, 'stamp next day');
  override = { '/data/snapshot.json': { body: raw, delay: 1500 } };   // the file held back, so the loading line can be read
  const C = await open('light', { noWait: true });
  check(await C.w(() => document.getElementById('stamp').textContent) === 'Reading the headlines…', 'the loading line, before the file is read');
  await stampCheck(C, 'loading');
  await C.page.waitForFunction(ready, null, { timeout: 30000 });
  await closeOut(C, 'stamp loading');
  override = {};
}
// the live file: data/snapshot.json as the refresh last wrote it, two hours after it was made. Every figure is
// worked out here from that file; nothing is pinned, so any file the bot writes must pass.
{
  // Oslo's wall clock by its zone, not a fixed +2: the live file may be from winter time (tools may use Intl; the app may not)
  const live = JSON.parse(liveRaw), lg = Date.parse(live.generatedAt);
  const osl = (ms) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const g0 = osl(lg), g1 = osl(lg + 2 * 3600e3), liveWhen = `${g0.day === g1.day ? '' : `${g0.day} ${g0.month}, `}${g0.hour}:${g0.minute}`;
  override = { '/data/snapshot.json': { body: liveRaw } };
  const A = await open('light', { time: new Date(lg + 2 * 3600e3).toISOString() });
  const names = live.sources.map((x) => x.name), items = live.regions.flatMap((r) => r.items);
  const r = await A.w(() => ({ stamp: document.getElementById('stamp').textContent, credit: document.getElementById('about-credit-line').textContent,
    rows: [...document.querySelectorAll('.keytab tr')].slice(1).map((tr) => [...tr.children].map((x) => x.textContent)), plates: document.querySelectorAll('#pane > section.sec').length,
    tabs: [...document.querySelectorAll('.tabs button')].map((b) => b.textContent), last: document.getElementById('pane').lastElementChild.className }));
  const lf = `${live.feeds.filter((f) => f.ok).length} of ${live.feeds.length} feeds answered`;
  const wantRows = names.slice(0, 3).map((n) => [n, String(items.filter((x) => x.source === n).length), `${live.feeds.filter((f) => f.source === n && f.ok).length} of ${live.feeds.filter((f) => f.source === n).length}`]);
  check(r.stamp === `Updated ${liveWhen}, ${lf}` && r.credit === `Headlines from ${names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`}.`
    && JSON.stringify(r.rows) === JSON.stringify(wantRows) && r.plates === live.regions.length + 1 && r.tabs.join() === ['All', ...live.regions.map((x) => x.name)].join() && r.last === 'aboutlink',
    `the live file (made ${live.generatedAt}): "${r.stamp}"; the credit "${r.credit}"; the sources' table ${r.rows.map((x) => x.join(' ')).join('; ')}; ${r.plates} plates; the About key last`);
  const c = await contrastOf(A.w);
  check(c.worst[0] >= 4.5, `the live file: the lowest text contrast ${c.worst[0]}:1 (${c.worst[1]})`);
  await stampCheck(A, 'the live file');
  await A.shot('all-live-light', false);
  await closeOut(A, 'the live file');
  override = {};
}
const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png, the README's composite, untouched (${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent'})`);
await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
