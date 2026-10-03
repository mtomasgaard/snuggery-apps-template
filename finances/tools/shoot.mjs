// Drive Finances in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through CDP),
// light and dark (HOUSE.md section 7.2 as a pane app allows: no player, no focus mode; tools/DECISIONS.md,
// item 19). The clock is fixed at Mon 21 Sep 2026, 12:00 in Oslo, so the stamp and the pictures are the
// same on every run. Fails on any console error or warning, page error, failed request, HTTP ≥ 400, or any
// request outside the local server. Every figure it asserts is worked out here from data/snapshot.json
// with Node's own tools, never by importing js/.
//
// LOAD AND RENDER TIMES ARE HEADLESS CHROMIUM ON THIS MAC: a trend only, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the panes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's tabs by role and name, the credits, the face, the stamp), every pane's text
// contrast and SVG labels, the tracer under exactly the chosen words, SI in every visible text node, hit
// targets, the caption band's height; the Balance (its blocks against this file's decode, its ink sampled on
// rendered pixels, its figure, its VoiceOver label, its cards on the home, the run of shallow blocks and the
// hollow, each clear of the tapped point and said once); Cash flow's card against this file's sums, fifteen
// taps with no column under the card; a vertical drag on every chart and on the Balance scrolling the pane
// and opening nothing. Once: the tabs by keyboard, About, hidden and back (the same file, then a changed one,
// keeping the pane and the scroll), a broken replacement keeping the view, storage blocked, the clock at
// 00:30 in Oslo, a stale copy of real data, Reduce Motion, the search field, a richer snapshot (pension,
// shares, a second fund, consent ending, a failed source), broken data at the start, the widths and a phone
// on its side, Savings' chart dragged at 375 × 667 where its pane has room to scroll. Pictures: tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png; never
// screenshots/app.png, the README's composite, whose hash is checked unchanged.

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
const NOW = '2026-09-21T10:00:00Z', TZ = 'Europe/Oslo';   // 12:00 CEST, UTC+2 until 25 Oct

/* ── the data, decoded here (app.js's header comment is the contract) ── */
const raw = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
const snap = JSON.parse(raw);
const NN = ' ', MINUS = '−';
const group = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NN);
const kr = (n) => `${n < 0 && Math.round(n) ? MINUS : ''}${group(n)}${NN}kr`;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const oslo = (iso) => new Date(Date.parse(iso) + 2 * 3600e3);   // Oslo in Sep 2026
const hm = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
const STAMP = `Example data. Updated ${hm(oslo(snap.generatedAt))}`;
const CREDITS = 'Accounts, holdings and loans: invented for this example. Home index: Statistics Norway, table 07221 (NLOD).';
const CREDITS_REAL = 'Accounts: your banks, through Enable Banking (PSD2). Home index: Statistics Norway, table 07221 (NLOD).';
// the Balance, by ART.md section 1's rule
const ownItems = [
  ...snap.accounts.filter((a) => a.balance > 0).sort((a, b) => b.balance - a.balance).map((a) => [a.name, a.balance]),
  ...snap.investments.funds.map((f) => [f.name, f.value]),
  ...snap.assets.filter((a) => a.kind === 'vehicle').sort((a, b) => b.value - a.value).map((a) => [a.name, a.value]),
  ...snap.assets.filter((a) => a.kind === 'property').map((a) => [a.name, a.value]),
];
const oweItems = [...snap.accounts.filter((a) => a.balance < 0).map((a) => [a.name, -a.balance]), ...snap.loans.map((l) => [l.name, -l.balance]).sort((a, b) => a[1] - b[1])];
const OWNED = ownItems.reduce((t, [, v]) => t + v, 0), OWED = oweItems.reduce((t, [, v]) => t + v, 0);
const SCALE = 50000;   // the first rung that keeps 5.7 million within 160 px

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
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), ov = override[u];
  if (u === '/data/snapshot.json') snapshotReads++;
  if (ov) { if (ov.status) { res.writeHead(ov.status); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(u)] || 'application/octet-stream' }); res.end(ov.body); return; }
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
const ready = () => window.__fin && window.__fin.ready();

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference', timezoneId: TZ });
  const page = await ctx.newPage(), errors = [];
  await page.clock.setFixedTime(new Date(o.time || NOW));
  if (o.init) await page.addInitScript(o.init);
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
  const pane = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(350); };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, rect, png, shot, pane };
}
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
    if (!t.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) continue;
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
        if ([...document.querySelectorAll('.tabs, .words, .pane')].some((sc) => { if (!sc.contains(e)) return false; const s = sc.getBoundingClientRect(); return r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1; })) continue;
        const id = `${e.tagName} ${(e.getAttribute('aria-label') || e.textContent || e.placeholder).trim().slice(0, 20)}`;
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
 *  unit, a decimal comma, or four or more digits ungrouped (years, clock times, codes and the data's own
 *  words excepted: names, bases and notes as the pipeline wrote them). */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[  ](kr|NOK|%|h|min)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, .nm, .data, #credits, .notice-lines')) continue;
    const s = t.textContent;
    if (!s.trim()) continue;
    n++;
    const ungrouped = s.replace(/\b(19|20)\d\d\b/g, '').replace(/\d{1,2}:\d\d/g, '').replace(/ending \d+|07221/g, '').match(/(?<![\d. ])\d{4,}/);
    if (/(^|[^\w])-\d/.test(s) || UNIT.test(s) || /\d,\d/.test(s) || / /.test(s) || ungrouped) bad.push(s.trim().slice(0, 50));
  }
  return { n, bad };
});
const xInside = (w) => w(() => {
  const b = document.querySelector('.readout:not([hidden]) .readout-close'), m = b && b.querySelector('svg');
  if (!m) return null;
  const r = b.getBoundingClientRect(), q = m.getBoundingClientRect();
  return { ok: q.left >= r.left && q.right <= r.right && q.top >= r.top && q.bottom <= r.bottom && r.width >= 44 && r.height >= 44 };
});
/** The Balance's selection mark and where its card is (after review, finding 3): the mark's rects in drawing
 *  coordinates, and whether the card's box meets the T (both columns, crossbar to foot) on screen. */
const markOf = (w) => w(() => {
  const svg = document.querySelector('.balsec svg'), B = window.__fin.balance(), s = svg.getBoundingClientRect(), c = document.querySelector('.balsec .readout:not([hidden])');
  const marks = [...svg.querySelectorAll('g.sel rect')].map((r) => ['x', 'y', 'width', 'height'].map((k) => Number(r.getAttribute(k))).concat(r.getAttribute('stroke') === 'var(--page)' ? 'ring' : 'tick'));
  const x0 = s.left + B.own[0].rect[0], x1 = s.left + B.owe[0].rect[0] + B.owe[0].rect[2], y0 = s.top + B.top - 2, y1 = s.top + B.foot;
  const r = c && c.getBoundingClientRect();
  return { marks, covers: !!r && r.left < x1 && x0 < r.right && r.top < y1 && y0 < r.bottom };
});
/** A vertical drag that starts on `sel` scrolls the pane and opens no card (B14; HOUSE 4.7). */
const dragOn = async (A, sel) => {
  await A.w((s) => { const m = document.getElementById('main'); m.scrollTop = 0; document.querySelector(s).scrollIntoView({ block: 'center' }); document.getElementById('live').textContent = ''; }, sel);
  await A.page.waitForTimeout(150);
  const [before, room] = await A.w(() => { const m = document.getElementById('main'); return [m.scrollTop, m.scrollHeight - m.clientHeight - m.scrollTop]; });
  const r = await A.rect(sel), x = r.left + r.width * 0.6, y0 = Math.min(r.top + r.height / 2, 700), dir = room >= before ? -1 : 1;   // toward the side with more to scroll
  await A.touch('touchStart', x, y0);
  for (let k = 1; k <= 18; k++) { await A.touch('touchMove', x + (k % 2), y0 + dir * 12 * k); await A.page.waitForTimeout(16); }
  await A.touch('touchEnd');
  await A.page.waitForTimeout(400);
  const v = await A.w(() => ({ card: window.__fin.card(), live: document.getElementById('live').textContent, top: document.getElementById('main').scrollTop }));
  return { ...v, moved: Math.abs(v.top - before), enough: Math.abs(v.top - before) >= Math.min(100, (dir < 0 ? room : before) - 2) };
};

const PANES = ['Overview', 'Owned', 'Spending', 'Cash flow', 'Savings', 'Transactions'];
const fileName = (n) => n.toLowerCase().replace(/ /g, '-');

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the first pane: ${A.ms} ms (headless)`);
  const PAGE = scheme === 'light' ? [0xe8, 0xee, 0xf0] : [0x14, 0x1d, 0x21];
  await A.pane('Overview');

  // boot: the camera's tabs by role and name, the credits, the face, the stamp
  {
    const tabs = await Promise.all(PANES.map((n) => page.getByRole('tab', { name: n, exact: true }).count()));
    const camera = await w(() => ['Overview', 'Spending'].map((n) => [...document.querySelectorAll('#tabs button')].filter((b) => b.textContent === n && b.getAttribute('role') === 'tab').length));
    const b = await w(() => {
      const c = document.getElementById('credits'), r = c.getBoundingClientRect();
      return { credits: c.textContent, whole: r.height > 0 && r.bottom <= innerHeight + 1, face: document.fonts.check('600 21px "Ysabeau Office"'),
        loaded: [...document.fonts].filter((f) => f.status === 'loaded').length, stamp: document.getElementById('stamp').textContent, lead: getComputedStyle(document.querySelector('#stamp .lead')).color === getComputedStyle(document.querySelector('h1')).color };
    });
    check(tabs.every((n) => n === 1), `the panes as tabs by name: ${PANES.map((p, i) => `${p} ${tabs[i]}`).join(', ')}`);
    check(camera.every((n) => n === 1), 'the camera\'s strings: Overview and Spending, each a <button role="tab"> as before the pass, built after the parse');
    check(b.credits === CREDITS && b.whole, `the credits on screen, word for word: "${b.credits}"`);
    check(b.face && b.loaded === 1, `the face is loaded before the first pane is drawn (${b.loaded} face)`);
    check(b.stamp === STAMP && b.lead, `the stamp: "${b.stamp}", "Example data." in ink (built here: "${STAMP}")`);
  }

  // every pane: text contrast, the face, the tracer, SI, hit targets, the band's height, the picture
  const bandH = [];
  for (const name of PANES) {
    await A.pane(name);
    const t0 = Date.now();
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5 && c.faces.every((f) => f === 'Ysabeau Office'), `${name}: ${c.n} text nodes and labels, the lowest ${c.worst[0]}:1 (${c.worst[1]}); faces ${c.faces.join(', ')} (B5)`);
    const tr = await w(() => [...document.querySelectorAll('.tabs button, .words button')].filter((b) => b.getBoundingClientRect().width)
      .map((b) => [b.textContent, b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-pressed') === 'true', getComputedStyle(b, '::after').content !== 'none']));
    check(tr.every(([, on, has]) => on === has), `${name}: the tracer under exactly the chosen words (${tr.filter(([, on]) => on).map(([x]) => x).join(', ')})`);
    const si = await siOf(w);
    check(si.bad.length === 0, `${name}: SI in ${si.n} visible text nodes (B1)${si.bad.length ? ': ' + si.bad.slice(0, 5).join(' | ') : ''}`);
    const hits = await hitTargets(A);
    check(hits.bad.length === 0 && hits.n >= 6, `${name}: ${hits.n} controls, every one 44 × 44 or more (B6)${hits.bad.length ? ': ' + hits.bad.slice(0, 5).join('; ') : ''}`);
    const side = await w(() => { const m = document.getElementById('main'); return document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1; });
    check(!side, `${name}: nothing runs past the pane's width (B9)`);
    bandH.push(await w(() => document.getElementById('band').getBoundingClientRect().height));
    console.log(`      ${name} drawn and checked in ${Date.now() - t0} ms (headless)`);
    await A.shot(`${fileName(name)}-${scheme}`);
  }
  check(new Set(bandH).size === 1, `the caption band holds its height on every pane (${bandH.join(', ')} px): the pane above it never resizes`);

  // the Balance: its blocks against this file's decode, its ink on rendered pixels, its figure and label, its cards
  await A.pane('Overview');
  {
    const B = await w(() => window.__fin.balance());
    const rows = (items) => { let cum = 0; return items.map(([n, v]) => { const y0 = B.top + Math.round(cum / SCALE); cum += v; return [n, y0, B.top + Math.round(cum / SCALE)]; }); };
    const same = (got, want) => got.length === want.length && got.every((b, i) => b.name === want[i][0] && b.y0 === want[i][1] && b.y1 === want[i][2]);
    check(B.scale === SCALE && same(B.own, rows(ownItems)) && same(B.owe, rows(oweItems)) && Math.abs(B.owned - B.owed - snap.netWorth.total) < 0.005,
      `the Balance: ${B.own.length} blocks owned and ${B.owe.length} owed at ${SCALE} kr a pixel, each block's rows as decoded here (the home ${B.own[B.own.length - 1].y0} to ${B.own[B.own.length - 1].y1}); owned less owed is netWorth.total`);
    const sv = await A.rect('.balsec svg'), img = await A.png();
    const samples = [];
    for (const b of [...B.own, ...B.owe]) { const [x, y, wd, h] = b.rect; if (h < 3) continue; for (let xx = x + 1.5; xx < x + wd - 1; xx += 2) for (let yy = y + 0.75; yy < y + h - 0.5; yy += 1.5) samples.push(contrast(img.at(Math.round((sv.left + xx) * 2), Math.round((sv.top + yy) * 2)), PAGE)); }
    const at3 = samples.filter((s) => s >= 3).length / samples.length;
    check(at3 >= 0.9, `the Balance's ink: ${samples.length} samples inside its blocks, ${(at3 * 100).toFixed(1)} % at 3:1 or more on the page (ART.md: ink on page 14.80 light, 14.43 dark; the lowest sample ${Math.min(...samples).toFixed(2)})`);
    const t = await w(() => ({ fig: document.querySelector('.balsec .nw-fig').textContent, what: document.querySelector('.balsec .nw-what').textContent, label: document.querySelector('.balsec svg').getAttribute('aria-label'),
      labels: [...document.querySelectorAll('.balsec svg text.halo')].map((x) => [...x.children].map((sp) => sp.textContent).join(' ')), size: getComputedStyle(document.querySelector('.balsec .nw-fig')).fontSize }));
    check(t.fig === kr(snap.netWorth.total) && t.what === 'Net worth' && t.size === '21px', `the hollow's figure: "${t.what}" "${t.fig}" at ${t.size} (this file ${kr(snap.netWorth.total)})`);
    check(t.label === `Balance on 21 September 2026: owned ${Math.round(OWNED)} kroner, the home ${Math.round(ownItems[ownItems.length - 1][1])} of it; owed ${Math.round(OWED)} kroner, the home loan ${Math.round(oweItems[oweItems.length - 1][1])} of it; net worth ${Math.round(snap.netWorth.total)} kroner.`,
      `the Balance's label for VoiceOver: "${t.label}"`);
    check(t.labels.join('|') === '3 accounts, 1 fund, 2 vehicles|Home|Credit card, Car loan|Home loan', `its labels: ${t.labels.join(' | ')}`);
    // a tap on the home: its card, clear of the point, said once
    const home = B.own[B.own.length - 1].rect;
    await w(() => { document.getElementById('live').textContent = ''; });
    const hx = sv.left + home[0] + home[2] / 2, hy = sv.top + home[1] + home[3] * 0.4;
    await A.tapAt(hx, hy);
    await page.waitForTimeout(300);
    let c = await w(() => ({ c: window.__fin.card(), live: document.getElementById('live').textContent, r: document.querySelector('.balsec .readout').getBoundingClientRect().toJSON() }));
    const share = `${(ownItems[ownItems.length - 1][1] / OWNED * 100).toFixed(1)}${NN}%`;
    const clear = (r, x, y) => x < r.left - 4 || x > r.right + 4 || y < r.top - 4 || y > r.bottom + 4;
    check(c.c && c.c.place === 'Home, property' && c.c.value === group(snap.assets[0].value) && c.c.rows[0][1] === share && clear(c.r, hx, hy) && c.live.startsWith('Home, property. 5059605 kroner. Share of what is owned 88.2 percent.'),
      `a tap on the home: "${c.c && c.c.place}", ${c.c && c.c.value} kr, ${c.c && c.c.rows[0].join(' ')} (this file ${share}), clear of the finger, said once: "${c.live.slice(0, 70)}…"`);
    const xb = await xInside(w);
    check(xb && xb.ok, "the card's ✕ is drawn inside its 44 × 44 button");
    let m = await markOf(w);
    check(m.marks.length === 1 && m.marks[0][4] === 'ring' && m.marks[0][0] === home[0] + 1.5 && m.marks[0][1] === home[1] + 1.5 && m.marks[0][3] === home[3] - 3 && !m.covers,
      `the home tapped: a 1 px page ring inset in its block (${m.marks.map((x) => x.join(' ')).join('; ')}); its card hangs clear of the T`);
    await A.shot(`balance-card-${scheme}`, false);
    // the run of six shallow blocks, and the hollow
    await A.tapAt(sv.left + home[0] + home[2] / 2, sv.top + B.top + 6);
    await page.waitForTimeout(250);
    c = await w(() => window.__fin.card());
    m = await markOf(w);
    const run6 = B.own.slice(0, 6);
    check(m.marks.length === 1 && m.marks[0][4] === 'tick' && m.marks[0][0] === B.own[0].rect[0] - 4 && m.marks[0][2] === 2 && m.marks[0][1] === run6[0].y0 && m.marks[0][1] + m.marks[0][3] === Math.max(run6[0].y0 + 6, run6[5].y1) && !m.covers,
      `the run tapped: a 2 px ink tick outside the Own column along its rows (${m.marks.map((x) => x.join(' ')).join('; ')}); its card clear of the T`);
    check(c && c.place === '3 accounts, 1 fund, 2 vehicles' && c.rows.length === 6 && c.value === group(ownItems.slice(0, 6).reduce((t2, [, v]) => t2 + v, 0)), `a tap on the run of shallow blocks: "${c && c.place}", one row per item (${c && c.rows.length})`);
    const ow = B.owe[0];
    await A.tapAt(sv.left + ow.rect[0] + ow.rect[2] / 2, sv.top + B.top + 1);   // the Owe side's top run, the reviewer's case
    await page.waitForTimeout(250);
    m = await markOf(w);
    c = await w(() => window.__fin.card());
    check(c && c.place === 'Credit card, Car loan' && m.marks.length === 1 && m.marks[0][4] === 'tick' && m.marks[0][0] === ow.rect[0] + ow.rect[2] + 2 && !m.covers,
      `the Owe side's top run tapped: "${c && c.place}", a tick outside the Owe column (${m.marks.map((x) => x.join(' ')).join('; ')}); its card clear of the Own column`);
    await A.shot(`balance-card-owe-${scheme}`, false);
    await A.tapAt(sv.left + ow.rect[0] + ow.rect[2] / 2, sv.top + (B.hollow.y0 + B.hollow.y1) / 2);
    await page.waitForTimeout(250);
    m = await markOf(w);
    check(m.marks.length === 1 && m.marks[0][4] === 'tick' && m.marks[0][1] === B.hollow.y0 && m.marks[0][3] === B.hollow.y1 - B.hollow.y0 && B.hollow.y1 === B.foot && !m.covers,
      `the hollow tapped: a tick along it, ${B.hollow.y0} to the foot at ${B.hollow.y1} (${B.hollow.y1 - B.hollow.y0} px, ${Math.round(snap.netWorth.total)} kr at ${SCALE} a pixel), the card clear of the T`);
    c = await w(() => window.__fin.card());
    check(c && c.place === 'Net worth' && c.value === group(snap.netWorth.total) && c.rows.map((r) => r[0]).join(',') === 'Owned,Owed,Change in 30 days,Change in a year', `a tap on the hollow: "${c && c.place}", ${c && c.value} kr, ${c && c.rows.map((r) => r.join(' ')).join('; ')}`);
    await A.tapAt(5, 700);
    await page.waitForTimeout(150);
    m = await markOf(w);
    check(m.marks.length === 0 && !(await w(() => window.__fin.card())), 'a tap elsewhere puts the card away and clears the mark');
    const d = await dragOn(A, '.balsec svg');
    check(!d.card && d.live === '' && d.moved > 100, `a vertical drag on the Balance scrolls the pane by ${Math.round(d.moved)} px, opens no card and says nothing (B14)`);
  }

  // the net-worth line at every range: the end mark's casing under the line, the dot on its last vertex (finding 2)
  {
    const got = [];
    for (const r of ['30 days', '90 days', '1 year', 'All']) {
      await page.getByRole('button', { name: r, exact: true }).click();
      await page.waitForTimeout(200);
      got.push(await w((name) => {
        const svg = document.querySelector('.sec:not(.balsec) .chartwrap svg'), kids = [...svg.children], line = svg.querySelector('polyline'), dot = svg.querySelector('circle.end'), cas = svg.querySelector('circle.casing');
        const last = line.getAttribute('points').trim().split(' ').pop().split(',').map(Number), n = line.getAttribute('points').trim().split(' ').length;
        const ok = kids.indexOf(cas) < kids.indexOf(line) && kids.indexOf(line) < kids.indexOf(dot) && last[0] === Number(dot.getAttribute('cx')) && last[1] === Number(dot.getAttribute('cy'));
        return [name, n, ok];
      }, r));
    }
    await page.getByRole('button', { name: '90 days', exact: true }).click();
    await page.waitForTimeout(200);
    check(got.every((g) => g[2]), `the net-worth line's end at every range (${got.map((g) => `${g[0]} ${g[1]} days`).join(', ')}): its casing under the line, the dot on the last vertex, no day erased`);
  }

  // Overview's chart, Owned's chart and Savings' chart: a vertical drag scrolls, nothing opens
  for (const [p, sel] of [['Overview', '.sec:not(.balsec) .chartwrap svg'], ['Owned', '.chartwrap svg'], ['Savings', '.sec:last-of-type .chartwrap svg']]) {
    await A.pane(p);
    const d = await dragOn(A, sel);
    check(!d.card && d.live === '' && d.enough, `${p}: a vertical drag on its chart scrolls the pane by ${Math.round(d.moved)} px (as far as it goes), opens no card and says nothing (B14)`);
  }

  // Cash flow: the card against this file's sums, clear of the tapped pair; fifteen taps, no column under the card
  await A.pane('Cash flow');
  {
    const cf = snap.cashflow, k = cf.months.length - 1, net = cf.in[k] - cf.out[k];
    const r = await A.rect('.chartwrap svg');
    await A.tapAt(r.right - 14, r.top + r.height - 60);
    await page.waitForTimeout(250);
    const c = await w(() => window.__fin.card());
    const ym = cf.months[k].split('-');
    check(c && c.place === `${MON[+ym[1] - 1]} ${ym[0]}, in less out` && c.value === `${net > 0 ? '+' : ''}${group(net)}` && c.rows[0][1] === kr(cf.in[k]) && c.rows[1][1] === kr(cf.out[k]),
      `Cash flow's card for the last month: "${c && c.place}", ${c && c.value} kr (this file ${group(net)}), in ${c && c.rows[0][1]}, out ${c && c.rows[1][1]}`);
    await A.shot(`cash-flow-card-${scheme}`, false);
    await w(() => { document.querySelector('.chartwrap svg').scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(150);
    const s = await A.rect('.chartwrap svg'), bad = [], where = new Set();
    for (let i = 0; i < 15; i++) {
      const f = 0.14 + i * 0.058;
      await A.tapAt(s.left + s.width * f, s.top + s.height * 0.55);
      await page.waitForTimeout(120);
      const q = await w(() => {
        const c2 = document.querySelector('.chartwrap .readout:not([hidden])'), col = document.querySelector('.chartwrap svg rect[opacity="0.07"]'), m = document.getElementById('main').getBoundingClientRect();
        if (!c2 || !col) return null;
        const a = c2.getBoundingClientRect(), b = col.getBoundingClientRect(), rr = c2.parentElement.getBoundingClientRect();
        return { meet: a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom, seen: a.top >= m.top - 1 && a.bottom <= m.bottom + 1, at: a.top >= rr.bottom - 1 ? 'hung from the foot' : a.left - rr.left > 20 ? 'top-right' : 'top-left' };
      });
      if (!q || q.meet || !q.seen) bad.push(`${Math.round(s.width * f)} px ${!q ? 'no card' : q.meet ? 'covered' : 'out of view'}`);
      if (q) where.add(q.at);
      await A.tapAt(5, 120);
      await page.waitForTimeout(80);
    }
    check(bad.length === 0, `In and out by month, 15 taps along it: the tapped pair never under its card, every card in view (${[...where].join(', ')})${bad.length ? ': ' + bad.join('; ') : ''}`);
    const d = await dragOn(A, '.chartwrap svg');
    check(!d.card && d.live === '' && d.moved > 50, `Cash flow: a vertical drag on its chart scrolls the pane by ${Math.round(d.moved)} px, opens no card and says nothing (B14)`);
  }

  // Spending's window is (from, to]: printed from the day after `from` (B11)
  await A.pane('Spending');
  {
    const s = snap.spending, f = new Date(Date.parse(`${s.from}T00:00:00Z`) + 864e5), t = s.to.split('-').map(Number);
    const want = `Spent, ${f.getUTCDate()} ${MON[f.getUTCMonth()]} to ${t[2]} ${MON[t[1] - 1]} ${t[0]}`;
    const got = await w(() => [document.querySelector('.fig-what').textContent, document.querySelector('.fig').textContent]);
    check(got[0] === want && got[1] === kr(s.total), `Spending: "${got[0]}" (built here: "${want}"), ${got[1]} (this file ${kr(s.total)})`);
  }
  await closeOut(A, scheme);
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once');
{
  const A = await open('light');
  const { page, w } = A;
  await A.pane('Overview');
  // the credit card's row: no repeated words, its sign kept; the bill as To pay, due in 15 days (B10, B15)
  {
    const r = await w(() => ({ rows: [...document.querySelectorAll('.sec .row')].map((x) => x.textContent), due: [...document.querySelectorAll('.sec')].find((s) => s.querySelector('h2') && s.querySelector('h2').textContent === 'To pay') }));
    const cardRow = r.rows.find((x) => x.startsWith('Credit card'));
    check(cardRow === `Credit cardending 3388${MINUS}8${NN}761${NN}kr51${NN}239${NN}kr available` && r.rows.some((x) => x === `Credit cardDue Tue 6 Oct, in 15 days8${NN}761${NN}kr15${NN}% of the 60${NN}000${NN}kr limit`),
      `B10, B15: the card's row "${cardRow}" and its bill under To pay, due in 15 days`);
  }
  // the tabs by keyboard: an arrow chooses the next pane and says its name once
  {
    await w(() => document.querySelector('.tabs [aria-selected="true"]').focus());
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    const k = await w(() => [window.__fin.pane(), document.activeElement.textContent, document.getElementById('live').textContent]);
    check(k[0] === 'owned' && k[1] === 'Owned' && k[2] === 'Owned.', `the tabs by keyboard: ArrowRight chooses ${k[1]}, focus follows, the live region says "${k[2]}"`);
    const f = await w(() => { const b = document.activeElement, r = b.getBoundingClientRect(), n = b.parentElement.getBoundingClientRect(), o = parseFloat(getComputedStyle(b).outlineOffset) || 0, ow = parseFloat(getComputedStyle(b).outlineWidth);
      return { vis: b.matches(':focus-visible'), off: o, inside: r.top - o - ow >= n.top - 0.5 && r.bottom + o + ow <= n.bottom + 0.5 }; });
    check(f.vis && f.off === -2 && f.inside, `the focus ring on a tab drawn inside the row that scrolls (offset ${f.off} px), not clipped to a bar (finding 4)`);
  }
  // the last tab chosen by touch on its visible part: scrolled whole into view (finding 5)
  {
    const t = await A.rect('#tab-txns'), row = await A.rect('#tabs');
    await A.tapAt(Math.min(t.right, row.right) - 8, t.top + t.height / 2);   // on the part the row shows
    await page.waitForTimeout(400);
    const r = await A.rect('#tab-txns');
    check(await w(() => window.__fin.pane()) === 'txns' && r.left >= row.left - 0.5 && r.right <= row.right + 0.5, `the last tab, its right edge at ${Math.round(t.right)} past the row's ${Math.round(row.right)} px, tapped by touch: chosen and whole in the row (${Math.round(r.left)} to ${Math.round(r.right)})`);
    await A.pane('Overview');
  }
  // one draw per chart per render: switching to Owned adds one svg per drawing (a nit)
  {
    await w(() => { window.__svgs = 0; new MutationObserver((ms) => { for (const x of ms) for (const n of x.addedNodes) if (n.nodeName === 'svg' && n.getAttribute('role') === 'img') window.__svgs++; }).observe(document.getElementById('pane'), { childList: true, subtree: true }); });
    await A.pane('Owned');
    const n = await w(() => [window.__svgs, document.querySelectorAll('#pane svg[role="img"]').length]);
    const lg = await w(() => [[...document.querySelectorAll('.legend li, .legend > *')].map((x) => x.textContent), [...document.querySelectorAll('.fact')].map((x) => x.textContent)]);
    const val = lg[1].find((x) => x.startsWith('Value')), leg = lg[0].find((x) => x.startsWith('Value, '));
    check(n[0] === n[1], `Owned drawn once: ${n[0]} drawings made for ${n[1]} on the pane`);
    check(leg && val && leg.slice(7) === val.slice(5) && !lg[0].some((x) => x.startsWith('Owned')), `one word, one number: Owned's legend "${leg}" and its fact "${val}" (finding 6)`);
    await A.pane('Savings');
    check(await w(() => !document.querySelector('svg[aria-label^="Share of the funds"]')), 'Savings with one fund draws no allocation strip (100 % encodes nothing; its legend and row say it)');
    await A.pane('Owned');
  }
  // the valuation words redraw the home, and the choice is remembered
  {
    await page.getByRole('button', { name: 'Detached houses', exact: true }).click();
    await page.waitForTimeout(300);
    const v = snap.assets[0].variants.find((x) => x.id === 'detached');
    const got = await w(() => [document.querySelector('.row .amt').firstChild.textContent, localStorage.getItem('fin.basis')]);
    check(got[0] === kr(v.value) && got[1] === '{"home":"detached"}', `the valuation words: Detached houses puts the home at ${got[0]} (this file ${kr(v.value)}), stored as ${got[1]}`);
    await page.getByRole('button', { name: 'All dwellings', exact: true }).click();
    await page.waitForTimeout(300);
  }
  // About: opens from the stamp, holds the rest inert, carries the credits, closes on Escape back to the stamp
  {
    const s = await A.rect('#stamp');
    await A.tapAt(s.left + 20, s.top + s.height / 2);
    await page.waitForTimeout(400);
    const a = await w(() => ({ open: !document.getElementById('about').hidden, inert: ['head', 'main', 'band'].every((id) => document.getElementById(id).inert), focus: document.activeElement.id,
      text: document.querySelector('.about-body').textContent.replace(/[ \t\n]+/g, ' '), list: [...document.querySelectorAll('#about-list dt')].map((d) => d.textContent) }));
    check(a.open && a.inert && a.focus === 'about-close' && a.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.')
      && a.text.includes(`50${NN}000${NN}kr a pixel here`) && a.text.includes('data.norge.no/nlod/en') && a.list.includes('Stale after:') && a.list.includes('Example data:') && a.list.includes('Updated:'),
      `About opens from the stamp, focus on Close, the rest inert; the scale, the index's license, the font's credit; This data (${a.list.join(' ')})`);
    await A.shot('about-light');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp' && !document.getElementById('main').inert), 'About closes on Escape; focus returns to the stamp');
  }
  // hidden and back: the snapshot is read again; the same file redraws nothing
  await A.pane('Transactions');
  {
    const n0 = snapshotReads;
    await w(() => { document.getElementById('pane').firstElementChild.dataset.old = '1'; document.getElementById('main').scrollTop = 600; });
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => [document.getElementById('main').scrollTop, window.__fin.pane(), !!document.querySelector('#pane [data-old]')]);
    check(snapshotReads === n0 + 1 && s[1] === 'txns' && s[2] && Math.abs(s[0] - 600) < 2, `back on screen: the snapshot read again (${snapshotReads - n0}); the same file redraws nothing; the pane and its scroll (${s[0]} px) kept`);
    override = { '/data/snapshot.json': { body: raw.replace('"generatedAt": "2026-09-21T05:12:00Z"', '"generatedAt": "2026-09-21T06:12:00Z"').replace('"generatedAt":"2026-09-21T05:12:00Z"', '"generatedAt":"2026-09-21T06:12:00Z"') } };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const t = await w(() => ({ redrawn: !document.querySelector('#pane [data-old]'), stamp: document.getElementById('stamp').textContent, top: document.getElementById('main').scrollTop, pane: window.__fin.pane() }));
    check(t.redrawn && t.stamp === 'Example data. Updated 08:12' && t.pane === 'txns' && Math.abs(t.top - 600) < 2, `back on screen with a changed file ("${t.stamp}"): the pane drawn again in place, Transactions and its scroll (${t.top} px) kept`);
  }
  // a broken replacement keeps the data that was showing, and says so (B12)
  {
    override = { '/data/snapshot.json': { body: '<!doctype html><title>404</title>' } };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => ({ notice: document.getElementById('notice').hidden ? '' : document.getElementById('notice').textContent, pane: document.querySelectorAll('#pane .row').length, tabs: !document.getElementById('tabs').hidden, scroll: document.getElementById('main').scrollTop }));
    check(s.notice === 'The new data/snapshot.json is not valid JSON; it looks like a web page was written over it. Still showing the data from 21 Sep, 08:12.Close' && s.pane > 3 && s.tabs && Math.abs(s.scroll - 600) < 2,
      `B12: a broken replacement while open: "${s.notice}"; the pane, the tabs and the scroll kept`);
    await A.shot('broken-replacement-light', false);
    const kb = await A.rect('#notice .textkey');
    await A.tapAt(kb.left + kb.width / 2, kb.top + kb.height / 2);
    await page.waitForTimeout(150);
    check(kb.height >= 44 && await w(() => document.getElementById('notice').hidden && document.querySelectorAll('#pane .row').length > 3), `the plate's Close key (${Math.round(kb.width)} × ${Math.round(kb.height)}) puts it away; the data stays`);
    override = {};
  }
  // the search field: it finds, and the browser's blue clear button is not drawn (HOUSE 4.8)
  {
    await w(() => { document.getElementById('main').scrollTop = 0; });
    await page.locator('.search').fill('bakery');
    await page.waitForTimeout(300);
    const want = snap.transactions.filter((t) => /bakery/i.test(`${t.text} ${t.account} ${t.category}`)).length;
    const r = await w(() => [...document.querySelectorAll('#pane .row')].length);
    const box = await A.rect('.search'), img = await A.png();
    let blue = 0;
    for (let x = box.right - 40; x < box.right - 2; x += 1) for (let y = box.top + 4; y < box.bottom - 4; y += 2) { const [rr, g, b] = img.at(Math.round(x * 2), Math.round(y * 2)); if (b > rr + 40 && b > g + 20) blue++; }
    const sf = await w(() => [document.querySelector('.search').placeholder, document.querySelector('.search').name, document.getElementById('stamp-hint').hidden]);
    check(sf[0] === 'Search text, account or category…' && sf[1] === 'q' && sf[2], `the search field "${sf[0]}", named ${sf[1]}; the stamp's hint hidden, so VoiceOver reads it once`);
    check(r === Math.min(100, want) && blue === 0, `the search field: "bakery" lists ${r} transactions (this file ${want}); no blue pixels at its right end (${blue})`);
    await A.shot('search-light', false);
  }
  await closeOut(A, 'once');
}
// storage blocked: every access throws, and the app still draws (B13)
{
  const A = await open('light', { init: () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); } });
  const s = await A.w(() => ({ ready: window.__fin.ready(), pane: window.__fin.pane(), stamp: document.getElementById('stamp').textContent }));
  await A.pane('Spending');
  check(s.ready && s.pane === 'overview' && s.stamp === STAMP && await A.w(() => window.__fin.pane() === 'spending'), 'B13: with storage blocked the app draws Overview, the stamp and a tab switch');
  await closeOut(A, 'storage blocked');
}
// 00:30 in Oslo on 22 Sep is still 21 Sep in UTC: "in N days" counts from the phone's day (B3), on a copy's own
// data (the example counts from its own day, below)
{
  override = { '/data/snapshot.json': { body: raw.replace('"synthetic":true', '"synthetic":false') } };
  const A = await open('light', { time: '2026-09-21T22:30:00Z' });
  const due = await A.w(() => [...document.querySelectorAll('.sec .row')].map((x) => x.textContent).find((x) => x.includes('Due ')));
  check(due && due.includes('Due Tue 6 Oct, in 14 days'), `B3: at 00:30 in Oslo on 22 Sep the card is due "in 14 days" ("${due && due.slice(11, 40)}")`);
  await closeOut(A, 'the clock at 00:30');
  override = {};
}
// the example on 1 Mar 2027: every relative day from the snapshot's own day, the stamp with its year (finding 1)
{
  const A = await open('light', { time: '2027-03-01T11:00:00Z' });
  const s = await A.w(() => ({ st: [...document.querySelectorAll('.statement')].map((p) => p.textContent), due: [...document.querySelectorAll('.sec .row')].map((x) => x.textContent).find((x) => x.includes('Due ')), stamp: document.getElementById('stamp').textContent }));
  check(!s.st.some((x) => /consent|BankID/.test(x)) && s.due && s.due.includes('in 15 days') && !/ago/.test(s.due) && s.stamp === 'Example data. Updated 21 Sep 2026, 07:12',
    `the example on 1 Mar 2027: no consent sentence (${s.st.length} statements), the bill "${s.due && s.due.slice(11, 35)}", the stamp "${s.stamp}"`);
  await closeOut(A, 'the example months on');
}
// debts beyond what is owned: the words carry the sign, the figure none (a nit)
{
  const neg = JSON.parse(raw), d = 1500000 - neg.assets[0].value;
  neg.assets[0].value += d; neg.netWorth.assets += d; neg.netWorth.total += d;
  override = { '/data/snapshot.json': { body: JSON.stringify(neg) } };
  const A = await open('light');
  const t = await A.w(() => [document.querySelector('.balsec .nw-what').textContent, document.querySelector('.balsec .nw-fig').textContent]);
  check(t[0] === 'Owed beyond what is owned' && t[1] === kr(-neg.netWorth.total), `debts beyond what is owned: "${t[0]} ${t[1]}" (netWorth.total ${Math.round(neg.netWorth.total)})`);
  await A.shot('balance-negative-light', false);
  await closeOut(A, 'debts beyond what is owned');
  override = {};
}
// a stored last tab at launch: chosen and in view (finding 5)
{
  const A = await open('light', { init: () => { try { localStorage.setItem('fin.tab', 'txns'); } catch { /* */ } } });
  const r = await A.rect('#tab-txns'), row = await A.rect('#tabs');
  check(await A.w(() => window.__fin.pane()) === 'txns' && r.left >= row.left - 0.5 && r.right <= row.right + 0.5, `launched on a stored Transactions: its tab whole in the row (${Math.round(r.left)} to ${Math.round(r.right)}, the row ${Math.round(row.left)} to ${Math.round(row.right)})`);
  await closeOut(A, 'a stored tab');
}
// a copy's own data, two days old: "Stale." in ink, the credits for real data (B4)
{
  override = { '/data/snapshot.json': { body: raw.replace('"synthetic": true', '"synthetic": false').replace('"synthetic":true', '"synthetic":false') } };
  const A = await open('light', { time: '2026-09-23T12:00:00Z' });
  const s = await A.w(() => ({ text: document.getElementById('stamp').textContent, ink: getComputedStyle(document.querySelector('#stamp .lead')).color === getComputedStyle(document.querySelector('h1')).color, credits: document.getElementById('credits').textContent }));
  check(s.text === 'Stale. Updated 21 Sep, 07:12' && s.ink && s.credits === CREDITS_REAL, `B4: real data two days on: "${s.text}", the word in ink; the credits "${s.credits}"`);
  await closeOut(A, 'stale');
  override = {};
}
// Reduce Motion: every animation at 0 s
{
  const A = await open('light', { reduced: true });
  await A.tapAt(100, 300);
  const d = await A.w(() => [getComputedStyle(document.querySelector('.tabs [aria-selected="true"]'), '::after').animationDuration, getComputedStyle(document.querySelector('.about-sheet')).animationDuration]);
  check(d.every((x) => x === '0s'), `Reduce Motion: the tracer and About at ${d.join(', ')}`);
  await closeOut(A, 'reduce motion');
}
// a richer snapshot: pension, employee shares, a second fund, consent ending in 5 days, a failed source
{
  const rich = JSON.parse(raw);
  rich.sources[0].consentExpires = '2026-09-26';
  rich.sources.push({ id: 'card2', label: 'Second card', status: 'error', fetchedAt: '2026-09-19T05:00:00Z', consentExpires: null, message: 'the bank answered 401' });
  rich.investments.funds.push({ name: 'Nordic fund', units: 100, nav: 150, navDate: '2026-09-21', value: 15000, costBasis: 12000, navSource: 'manual' });
  rich.pension = { provider: 'Pension', total: 66500, costBasis: 40000, counted: 66500, includeInNetWorth: true, notes: [],
    accounts: [{ id: 'personal', label: 'Personal pension', kind: 'personal', value: 66500, costBasis: 40000, anchoredAt: '2026-06-30', accruedSince: 3, basis: 'units held, priced at published NAV', funds: [{ name: 'Index fund', units: 286.0123, nav: 232.51, value: 66500, navSource: 'inline' }] }] };
  rich.equity = { provider: 'Share plan', symbol: 'XXXX', currency: 'USD', price: 58.42, priceDate: '2026-09-18', priceSource: 'yahoo', fxRate: 10.284, fxDate: '2026-09-18', fxSource: 'norges-bank',
    vestedShares: 418, unvestedShares: 264, vested: 251131, unvested: 158609, unvestedAfterTax: 84063, unvestedTaxRate: 0.47, includeUnvested: false, counted: 251131, costBasis: 0, historyBasis: 'partial',
    grants: [{ id: 'rsu-2024', label: 'RSU 2024', kind: 'rsu', strike: null, underWater: false, vestedShares: 192, unvestedShares: 96, vested: 115352, unvested: 57676, costBasis: 0, nextVest: '2027-03-15' }],
    upcoming: [{ date: '2027-03-15', shares: 96, label: 'RSU 2024', value: 57676 }], error: null };
  rich.netWorth = { ...rich.netWorth, investments: rich.netWorth.investments + 15000 + 251131, pension: 66500, total: rich.netWorth.total + 15000 + 251131 + 66500 };
  override = { '/data/snapshot.json': { body: JSON.stringify(rich) } };
  const A = await open('light');
  const st = await A.w(() => [...document.querySelectorAll('.statement')].map((p) => p.textContent));
  check(st.includes('Bank: consent ends in 5 days. Authorize again with BankID before then.') && st.some((x) => x.startsWith('Second card: the bank answered 401. Last good read 2 days ago.')),
    `statements on Overview: "${st.filter((x) => !x.startsWith('Example')).join('" "')}"`);
  const B = await A.w(() => window.__fin.balance());
  check(Math.abs(B.owned - B.owed - rich.netWorth.total) < 0.01 && B.own.some((b) => b.name === 'Share plan') && B.own.some((b) => b.name === 'Pension'), `the Balance counts the share plan and the pension: owned less owed is the richer netWorth.total (${Math.round(B.owned - B.owed)})`);
  await A.pane('Savings');
  const s = await A.w(() => ({ groups: [...document.querySelectorAll('h2.group')].map((h) => h.textContent), facts: [...document.querySelectorAll('.fact dt')].map((d) => d.textContent) }));
  const si = await siOf(A.w);
  check(s.groups.join(',') === 'Pension,Funds,Employee shares' && s.facts.slice(0, 4).join(',') === 'Funds,Pension,Shares,Paid in' && si.bad.length === 0,
    `Savings with a pension, shares and two funds: groups ${s.groups.join(', ')}; facts ${s.facts.slice(0, 4).join(', ')}; SI in ${si.n} text nodes${si.bad.length ? ': ' + si.bad.slice(0, 4).join(' | ') : ''}`);
  const hits = await hitTargets(A);
  const side = await A.w(() => document.getElementById('main').scrollWidth > document.getElementById('main').clientWidth + 1);
  check(hits.bad.length === 0 && !side, `Savings with every kind of holding: ${hits.n} controls at 44 × 44 or more, nothing past the pane's width (B9)`);
  await A.shot('savings-rich-light', false);
  await closeOut(A, 'a richer snapshot');
  override = {};
}
// broken data at the start: a sentence on a plate, never a blank pane
for (const [label, ov, want] of [
  ['missing', { status: 404 }, 'data/snapshot.json could not be read (HTTP 404).'],
  ['not JSON', { body: '<!doctype html><html><body>Not Found</body></html>' }, 'data/snapshot.json is not valid JSON; it looks like a web page was written over it.'],
  ['the wrong shape', { body: '{"message":"Not Found","documentation_url":"x"}' }, 'data/snapshot.json is not the shape this app expects:'],
]) {
  override = { '/data/snapshot.json': ov };
  const A = await open('light', { noWait: true, expect: /HTTP 404|404 \(Not Found\)|Failed to load resource|requestfailed .*\/data\/snapshot\.json/ });
  await A.page.waitForSelector('#notice:not([hidden])', { timeout: 15000 });
  const s = await A.w(() => ({ first: document.querySelector('#notice p').textContent, role: document.getElementById('notice').getAttribute('role'), tabs: document.getElementById('tabs').hidden, stamp: document.getElementById('stamp').textContent, mono: [...document.querySelectorAll('#notice *')].some((e) => /mono/i.test(getComputedStyle(e).fontFamily)) }));
  check(s.first === want && s.role === 'alert' && s.tabs && s.stamp === 'No usable data' && !s.mono, `broken data, ${label}: "${s.first}" on a plate (role alert), no tabs, no monospace (B12)`);
  const sb = await A.rect('#stamp');
  await A.tapAt(sb.left + 20, sb.top + sb.height / 2);
  await A.page.waitForTimeout(300);
  const ab = await A.w(() => ({ open: !document.getElementById('about').hidden, list: document.getElementById('about-list').parentElement.hidden, tick: document.getElementById('notice').textContent.includes('`') }));
  check(ab.open && ab.list && !ab.tick, `broken data, ${label}: the stamp opens About (its prose and credits; This data hidden); no Markdown backtick on the plate`);
  await A.page.keyboard.press('Escape');
  await A.shot(`broken-${label.replace(/ /g, '-')}-light`, false);
  await closeOut(A, `broken data, ${label}`);
}
override = {};
// the widths: no sideways scroll, the caption line inside its fixed height, a phone on its side
for (const [label, wv, hv] of [['320 × 700', 320, 700], ['360 × 740', 360, 740], ['375 × 667', 375, 667], ['125 % text (312 × 675)', 312, 675], ['on its side (844 × 390)', 844, 390]]) {
  const A = await open('light', { w: wv, h: hv });
  const r = [];
  for (const name of PANES) {
    await A.pane(name);
    r.push(await A.w(() => {
      const m = document.getElementById('main'), cap = document.getElementById('capline'), svg = document.querySelector('.balsec svg');
      const fig = svg && svg.querySelector('.nw-fig').getBBox();
      return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, cap: cap.scrollHeight <= cap.clientHeight + 1, pane: m.clientHeight, head: document.getElementById('head').getBoundingClientRect().height,
        fig: !fig || (fig.x >= -0.5 && fig.x + fig.width <= svg.getBoundingClientRect().width + 0.5) };
    }));
  }
  const side = r.filter((x) => x.side).length, cap = r.filter((x) => !x.cap).length, fig = r.every((x) => x.fig);
  const land = wv > hv ? r.every((x) => x.head <= 47 && x.pane >= 220) : true;
  check(side === 0 && cap === 0 && land && fig, `${label}: no sideways scroll on any pane, the caption line inside its height on every pane, the Balance's figure inside its drawing${wv > hv ? `, the header one ${Math.round(r[0].head)} px row, the pane ${Math.round(Math.min(...r.map((x) => x.pane)))} px tall` : ''}`);
  if (wv === 375) {   // at 844 px tall Savings has about 10 px to scroll, too little to prove B14; on a 667 px screen its chart's drag has room
    await A.pane('Savings');
    const d = await dragOn(A, '.sec:last-of-type .chartwrap svg');
    check(!d.card && d.live === '' && d.moved > 100, `${label}: Savings, a vertical drag on its chart scrolls the pane by ${Math.round(d.moved)} px, opens no card and says nothing (B14, with room to scroll)`);
  }
  await A.pane('Overview');
  if (wv === 320) await A.shot('overview-320-light', false);
  if (wv > hv) await A.shot('overview-landscape-light', false);
  await closeOut(A, label);
}
const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png, the README's composite, untouched (${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent'})`);
await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
