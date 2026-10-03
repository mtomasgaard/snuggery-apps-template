// Drive Running Dashboard in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through
// CDP), light and dark (HOUSE.md section 7.2 as a pane app allows: no player, no focus mode; ART.md
// section 8, item 33). The clock is fixed at Thu 1 Oct 2026, 12:00 in Copenhagen, so the Block, the stamp
// and the pictures are the same on every run. Fails on any console error or warning, page error, failed
// request, HTTP ≥ 400, or any request outside the local server. Every figure it asserts is worked out here
// from data/snapshot.json with Node's own tools, never by importing js/.
//
// LOAD AND RENDER TIMES ARE HEADLESS CHROMIUM ON THIS MAC: a trend only, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the panes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's tabs by role and name, the credits, the face and its ₂ supplement, the
// stamp), every pane's text contrast and SVG labels, the tracer under exactly the chosen words, the Block
// (its blocks against this file's decode, its ink and its planned weeks' tint sampled on rendered pixels,
// its card and sentence), a chart's card against this file's sums and clear of the tapped bar, fifteen taps
// along that chart with no column under its card, each card's ✕ inside its button, a vertical drag on a chart
// scrolling with no card, SI in every visible text node, hit targets on every pane, the pictures; and the
// owner's six (2026-10-03): the Now table at the pane's head and a long fact below the verdict, the filters
// held under the tabs with the sport and equipment row going and coming back with the scroll, the thumbs
// with nothing painted behind them, Plan's running chart (its place, legend, table, card and race name) and
// a planned bar's tint in every chart on Plan. Once: the loop clip's drag
// scrolling the pane, the stale stamp, the phone 21 days past the data, About, the tabs by keyboard, Reduce
// Motion, hidden and back (the same file, then a changed one, keeping the open folds and the scroll),
// broken data (missing, not JSON, the wrong shape, a broken replacement keeping the view and its plate's
// Close key), the route map (its card, the ramp's minimum span on a steady run, a vertical swipe across
// it, twenty points along it with no marker under its card), the widths and a phone on its side.
// Pictures: tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png; never
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
const NOW = '2026-10-01T10:00:00Z', TZ = 'Europe/Copenhagen';   // 12:00 CEST, UTC+2 until 25 Oct

/* ── the data, decoded here (app.js's header comment is the contract) ── */
const raw = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
const snap = JSON.parse(raw);
const DAY = 86400000;
const t = (s) => Date.parse(`${s}T00:00:00Z`);
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const monday = (s) => ymd(t(s) - ((new Date(t(s)).getUTCDay() + 6) % 7) * DAY);
const running = (a) => (typeof a.runKm === 'number' ? a.runKm : a.km);
const weekKm = (w) => snap.activities.filter((a) => a.sport === 'run' && monday(a.d) === w).reduce((s, a) => s + running(a), 0);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const cest = (iso) => new Date(Date.parse(iso) + 2 * 3600e3);   // Copenhagen in Sep and Oct 2026
const hm = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
const gen = cest(snap.pulledAt || snap.generatedAt);
const lastDay = snap.dataThrough.split('-').map(Number);
const STAMP = `Updated ${gen.getUTCDate()} ${MON[gen.getUTCMonth()]}, ${hm(gen)}, last session ${lastDay[2]} ${MON[lastDay[1] - 1]}`;
const CREDITS = 'Data: Garmin Connect. Coaching text: the coaching routine.';
const NN = '\u202F';

const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
/* The plan's tint: its token at 20 % over the page (tools/art/palette.py, TINT), as the browser composites it. */
const TINT = 0.2, over = (c, a, g) => c.map((v, i) => Math.round(v * a + g[i] * (1 - a)));
const near = (p, q, d = 2) => p.every((v, i) => Math.abs(v - q[i]) <= d);
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dateOf = (s) => `${Number(s.slice(8))} ${MON[Number(s.slice(5, 7)) - 1]} ${s.slice(0, 4)}`;
const siLabel = (s) => String(s).replace(/(\d) (km|min|h|m|bpm|kg|%)(?=$|[\s,.;)])/g, `$1${NN}$2`);

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
const ready = () => window.__rd && window.__rd.ready();

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
    console.log(`      ${name}.png${keep && KEEP ? ' → screenshots/' : ''}`);
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
  let worst = [99, ''], n = 0, faces = new Set();
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
      for (const e of document.querySelectorAll('button, [role="slider"], [role="radio"], [role="tab"], input, select, summary')) {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest('[hidden]') || e.closest('[inert]') || e.disabled) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const on = (x, yy) => { const h = document.elementFromPoint(x, yy); return h && (h === e || e.contains(h)); };
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !on(cx, cy)) continue;
        // wholly inside every scroller it sits in (the row of words, the session list, the pane under the header and the band)
        if ([...document.querySelectorAll('.tabs, .words, .sesslist, .pane')].some((sc) => { if (!sc.contains(e)) return false; const s = sc.getBoundingClientRect(); return r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1; })) continue;
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
/** Every visible text node the app wrote: a hyphen-minus before a digit, a plain space between a number and
 *  a unit, or four or more digits ungrouped (years, clock times, dates and the coaching text excepted). */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[ \u00a0](km\/h|km|min|h|m|bpm|spm|rpm|kg|kJ\/kg|ms|W|%|°C|cm|d|kcal|\/km)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, .said, .s-main b, .notice-lines')) continue;
    const s = t.textContent;
    n++;
    const ungrouped = s.replace(/\b(19|20)\d\d\b/g, '').replace(/\d{1,2}:\d\d(:\d\d)?/g, '').match(/(?<![\d.\u202F])\d{4,}/);
    if (/(^|[^\w])-\d/.test(s) || UNIT.test(s) || ungrouped) bad.push(s.trim().slice(0, 50));
  }
  return { n, bad };
});

const PANES = ['Now', 'Plan', 'Training', 'Health', 'Sessions'];
/** The open card's ✕: its drawn mark inside its 44 × 44 button (the review found the route card's mark
 *  172 px away, pulled out by a selector meant for the route's own svg). */
const xInside = (w) => w(() => {
  const b = document.querySelector('.readout:not([hidden]) .readout-close'), m = b && b.querySelector('svg');
  if (!m) return null;
  const r = b.getBoundingClientRect(), q = m.getBoundingClientRect();
  return { ok: q.left >= r.left && q.right <= r.right && q.top >= r.top && q.bottom <= r.bottom && r.width >= 44 && r.height >= 44, at: [Math.round(q.left), Math.round(q.top)], btn: [Math.round(r.left), Math.round(r.top)] };
});

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the first pane: ${A.ms} ms (headless)`);
  const PAGE = scheme === 'light' ? [0xe8, 0xee, 0xf0] : [0x14, 0x1d, 0x21];
  await A.pane('Now');

  // boot: the camera's tabs by role and name, the credits, the face and its supplement, the stamp
  {
    const tabs = await Promise.all(PANES.map((n) => page.getByRole('tab', { name: n, exact: true }).count()));
    const b = await w(() => {
      const c = document.getElementById('credits'), r = c.getBoundingClientRect();
      return { credits: c.textContent, whole: c.scrollWidth <= c.clientWidth + 1 && r.height > 0 && r.bottom <= innerHeight + 1,
        face: document.fonts.check('600 12.5px "Ysabeau Office"'), sub: document.fonts.check('400 12.5px "Ysabeau Office"', '\u2082'),
        loaded: [...document.fonts].filter((f) => f.status === 'loaded').length, stamp: document.getElementById('stamp').textContent, pane: window.__rd.pane() };
    });
    check(tabs.every((n) => n === 1), `the camera's panes as tabs by name: ${PANES.map((p, i) => `${p} ${tabs[i]}`).join(', ')}`);
    check(b.credits === CREDITS && b.whole, `the credits on screen whole: "${b.credits}"`);
    check(b.face && b.sub && b.loaded === 2, `the face is loaded, and its ₂ supplement (${b.loaded} faces loaded)`);
    check(b.stamp === STAMP, `the stamp: "${b.stamp}" (built by hand: "${STAMP}")`);
  }

  // every pane: text contrast and the SVG labels, the face, the tracer, SI, hit targets, the picture
  const bandH = [];
  for (const name of PANES) {
    await A.pane(name);
    const t0 = Date.now();
    await w(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5 && c.faces.every((f) => f === 'Ysabeau Office'), `${name}: ${c.n} text nodes and labels, the lowest ${c.worst[0]}:1 (${c.worst[1]}); faces ${c.faces.join(', ')}`);
    const tr = await w(() => [...document.querySelectorAll('.tabs button, .words button, .wordrow > button')].filter((b) => b.getBoundingClientRect().width)
      .map((b) => [b.textContent, b.getAttribute('aria-selected') === 'true' || b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-pressed') === 'true', getComputedStyle(b, '::after').content !== 'none']));
    check(tr.every(([, on, has]) => on === has), `${name}: the tracer under exactly the chosen words (${tr.filter(([, on]) => on).map(([x]) => x).join(', ')})`);
    const si = await siOf(w);
    check(si.bad.length === 0, `${name}: SI in ${si.n} visible text nodes${si.bad.length ? ': ' + si.bad.slice(0, 5).join(' | ') : ''}`);
    const hits = await hitTargets(A);
    check(hits.bad.length === 0 && hits.n > 6, `${name}: ${hits.n} controls, every one 44 × 44 or more (B17)${hits.bad.length ? ': ' + hits.bad.slice(0, 5).join('; ') : ''}`);
    bandH.push(await w(() => document.getElementById('band').getBoundingClientRect().height));
    console.log(`      ${name} drawn and checked in ${Date.now() - t0} ms (headless)`);
    await A.shot(`${name.toLowerCase()}-${scheme}`);
  }
  check(new Set(bandH).size === 1, `the caption band holds its height on every pane (${bandH.join(', ')} px): the pane above it never resizes`);

  // the Block: its blocks against this file's decode, its ink on rendered pixels, its card and its sentence
  await A.pane('Now');
  {
    const B = await w(() => window.__rd.block());
    const cols = B.columns.map((c) => c.week);
    const now = monday('2026-10-01');
    const want = [];
    for (let k = 11; k >= 0; k--) want.push(ymd(t(now) - 7 * k * DAY));
    for (const h of snap.plan.horizon) if (h.w > now) want.push(h.w);
    const sums = cols.map((wk) => (wk <= now ? weekKm(wk) : 0));
    const first = (i) => B.columns.slice(0, i).reduce((s, c) => s + c.runs.length, 0);
    const tops = cols.map((_, i) => { const ps = B.points.slice(first(i), first(i + 1)); return ps.length ? Math.min(...ps.map((p) => p[1])) : B.base; });
    const okTops = tops.every((y, i) => y === B.base - Math.round(sums[i] * B.scale));
    const okOut = B.columns.filter((c) => c.target != null).map((c) => c.target).join(',') === snap.plan.horizon.filter((h) => h.w >= now).map((h) => h.km).join(',');
    check(JSON.stringify(cols) === JSON.stringify(want) && okTops && okOut && B.scale === 0.8,
      `the Block: ${cols.length} weeks ${cols[0]} to ${cols[cols.length - 1]}, every column's ink as tall as this file's running kilometers at 0.8 px per km (this week ${sums[B.now].toFixed(1)} km), the outlines the plan's ${B.columns.filter((c) => c.target != null).map((c) => c.target).join(', ')} km`);
    const sv = await A.rect('.blocksec svg'), img = await A.png();
    const samples = [];
    for (const [x, y, wd, h] of B.points) for (let xx = x + 1.5; xx < x + wd - 1; xx += 2) for (let yy = y + 0.75; yy < y + h - 0.5; yy += 1.5) samples.push(contrast(img.at(Math.round((sv.left + xx) * 2), Math.round((sv.top + yy) * 2)), PAGE));
    const at3 = samples.filter((s) => s >= 3).length / samples.length;
    const edges = [];
    for (const [x, y, wd, h] of B.outlines) for (let yy = y + 3; yy < y + h - 3; yy += 2) edges.push(contrast(img.at(Math.round((sv.left + x + 0.75) * 2), Math.round((sv.top + yy) * 2)), PAGE));
    const e3 = edges.filter((s) => s >= 3).length / edges.length;
    check(at3 >= 0.9 && e3 >= 0.9, `the Block's ink: ${samples.length} samples inside its blocks, ${(at3 * 100).toFixed(1)} % at 3:1 or more on the page (lowest ${Math.min(...samples).toFixed(2)}, a block's antialiased edge); its outlines' 1.5 px strokes ${(e3 * 100).toFixed(1)} % (lowest ${Math.min(...edges).toFixed(2)})`);
    // the plan's tint inside the outlines (the owner, 2026-10-03): from each outline's top down to the ink, the
    // ink at 20 % over the page, light, and apart from the ink; this week's only above what was run
    const INKC = scheme === 'light' ? [0x0f, 0x1c, 0x23] : [0xe6, 0xed, 0xee], tint = over(INKC, TINT, PAGE), tints = [];
    const BT = B.tints || [], okT = BT.length === B.outlines.length && BT.every(([x, y, wd, h], k) => { const o = B.outlines[k], i = B.columns.findIndex((c) => c.target != null) + k, ink = B.base - Math.round(sums[i] * B.scale); return x === o[0] && y === o[1] && wd === o[2] && h === Math.min(o[3], ink - o[1]); });
    for (const [x, y, wd, h] of BT) for (let xx = x + 3; xx < x + wd - 3; xx += 2) for (let yy = y + 3; yy < y + h - 2; yy += 2) tints.push(img.at(Math.round((sv.left + xx) * 2), Math.round((sv.top + yy) * 2)));
    const atT = tints.filter((p) => near(p, tint)).length / (tints.length || 1);
    check(okT && atT >= 0.9 && contrast(tint, PAGE) >= 1.2 && contrast(tint, PAGE) < 2 && contrast(INKC, tint) >= 3,
      `the Block's planned weeks: ${BT.length} tints from each outline's top down to the ink (this week's ${(BT.find((tn) => tn[0] === B.outlines[0][0]) || [])[3]} px above its ${sums[B.now].toFixed(1)} km); ${tints.length} samples inside them, ${(atT * 100).toFixed(1)} % at the tint rgb(${tint}) (the race's rule crosses one), ${contrast(tint, PAGE).toFixed(2)}:1 on the page, the ink ${contrast(INKC, tint).toFixed(2)}:1 against it`);
    const label = await w(() => document.querySelector('.blocksec svg').getAttribute('aria-label'));
    check(label.includes(`the latest ${weekKm('2026-09-14').toFixed(1)}, ${weekKm('2026-09-21').toFixed(1)} and so far ${weekKm(now).toFixed(1)} kilometers`) && label.includes(snap.plan.goal.race.name),
      `the Block's label for VoiceOver: "${label.slice(0, 90)}…"`);
    // a tap on the week of 14 Sep: the card, said once
    const i = cols.indexOf('2026-09-14'), p = B.points[first(i)];
    await w(() => { document.getElementById('live').textContent = ''; });
    await A.tapAt(sv.left + p[0] + p[2] / 2, sv.top + B.base - 10);
    await page.waitForTimeout(300);
    const card = await w(() => ({ c: window.__rd.card(), live: document.getElementById('live').textContent, r: document.querySelector('.blocksec .readout').getBoundingClientRect().toJSON() }));
    const want14 = weekKm('2026-09-14');
    const xb = await xInside(w);
    check(xb && xb.ok, `the Block's card: its ✕ drawn inside its button (mark at ${xb && xb.at}, button at ${xb && xb.btn})`);
    check(card.c && card.c.place === 'Week of 14 Sep 2026' && card.c.value === want14.toFixed(1) && card.live === `Week of 14 September 2026. ${want14.toFixed(1)} kilometers in 6 runs, longest 24.0 kilometers.` && card.r.top >= sv.bottom - 1,
      `the Block's card: "${card.c && card.c.place}", ${card.c && card.c.value} km (this file ${want14.toFixed(1)}), hung from the chart's foot, said once: "${card.live}"`);
    await A.shot(`block-card-${scheme}`, false);
    await A.tapAt(5, 300);
  }

  // the Now table (the owner, 2026-10-03): the short facts are the pane's first section, the app's four and
  // the evaluation's short metrics, their values on one left edge; the Block follows; nothing long in the demo
  {
    const n = await w(() => {
      const t = document.querySelector('#pane > .sec:first-child > dl.tab');
      return { t: !!t, block: !!document.querySelector('#pane > .sec:nth-child(2).blocksec'), labels: t ? [...t.querySelectorAll('dt')].map((d) => d.textContent) : [],
        v: t ? t.querySelector('dd').textContent : '', lefts: t ? [...t.querySelectorAll('dd')].map((d) => Math.round(d.getBoundingClientRect().left)) : [], long: document.querySelectorAll('#pane dl.long .fact').length };
    });
    const pd = `${Number(snap.dataThrough.slice(8))} ${MON[Number(snap.dataThrough.slice(5, 7)) - 1]}`, d0 = ymd(t(snap.dataThrough) - 6 * DAY);
    const run7 = snap.activities.filter((a) => a.sport === 'run' && a.d >= d0 && a.d <= snap.dataThrough).reduce((s, a) => s + running(a), 0);
    const want = [`Run, 7 days to ${pd}`, `Run, 28 days to ${pd}`, 'Garmin status', 'VO₂ max', ...snap.assessment.metrics.map((m) => siLabel(m.label))];
    check(n.t && n.block && JSON.stringify(n.labels) === JSON.stringify(want) && n.v.startsWith(`${run7.toFixed(1)}${NN}km`) && new Set(n.lefts).size === 1 && n.long === 0,
      `Now: the pane opens on a table of ${n.labels.length} short facts (${n.labels.join('; ')}), the first ${run7.toFixed(1)} km as this file sums it, every value at x ${n.lefts[0]}; the Block second; no long fact in this snapshot`);
  }

  // a chart's card on Training: this week's running against this file's sum, clear of the tapped bar
  await A.pane('Training');
  {
    const r = await A.rect('.sec .chartwrap svg');
    await A.tapAt(r.right - 12, r.top + r.height - 40);
    await page.waitForTimeout(250);
    const c = await w(() => ({ c: window.__rd.card(), r: document.querySelector('.sec .chartwrap .readout').getBoundingClientRect().toJSON() }));
    const last = monday('2026-10-01');
    check(c.c && c.c.place === `Week of ${Number(last.slice(8))} ${MON[Number(last.slice(5, 7)) - 1]} 2026` && c.c.value === weekKm(last).toFixed(1) && c.c.unit === 'km',
      `Weekly running volume's card for the last bar: "${c.c && c.c.place}", ${c.c && c.c.value} km (this file ${weekKm(last).toFixed(1)})`);
    await A.tapAt(r.left + 46, r.top + r.height - 40);
    await page.waitForTimeout(250);
    const c2 = await w(() => document.querySelector('.sec .chartwrap .readout').getBoundingClientRect().toJSON());
    check(c2.left > r.left + 46 + 4, `the card keeps clear of the tapped bar: a tap at the left puts it at the right (left edge ${Math.round(c2.left)} px)`);
    const xt = await xInside(w);
    check(xt && xt.ok, `the chart's card: its ✕ drawn inside its button (mark at ${xt && xt.at}, button at ${xt && xt.btn})`);
    await A.shot(`training-card-${scheme}`, false);
    const close = await A.rect('.sec .chartwrap .readout-close');
    await A.tapAt(close.left + close.width / 2, close.top + close.height / 2);
    await page.waitForTimeout(150);
    check(await w(() => !window.__rd.card()), 'the card closes on its ✕ (named Close)');
    // HOUSE 4.7, the tapped column never under its own card: fifteen taps along the chart at 55 % of its
    // height (the final review found one in fifteen covered, where both top corners hold the column)
    {
      await w(() => { document.querySelector('.sec .chartwrap svg').scrollIntoView({ block: 'center' }); });
      await page.waitForTimeout(150);
      const s = await A.rect('.sec .chartwrap svg'), bad = [], where = new Set();
      for (let k = 0; k < 15; k++) {
        const f = 0.13 + k * 0.059;   // the plot runs from 38 px to 8 px short of the right edge
        await A.tapAt(s.left + s.width * f, s.top + s.height * 0.55);
        await page.waitForTimeout(120);
        const q = await w(() => {
          const c = document.querySelector('.sec .chartwrap .readout:not([hidden])'), col = document.querySelector('.sec .chartwrap svg rect[opacity="0.07"]'), m = document.getElementById('main').getBoundingClientRect();
          if (!c || !col) return null;
          const a = c.getBoundingClientRect(), b = col.getBoundingClientRect(), r = c.parentElement.getBoundingClientRect(), f = document.getElementById('filters').getBoundingClientRect();   // in view: under the filters held at the top
          return { meet: a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom, seen: a.top >= f.bottom - 1 && a.bottom <= m.bottom + 1, at: a.top >= r.bottom - 1 ? 'hung from the foot' : a.left - r.left > 20 ? 'top-right' : 'top-left' };
        });
        if (!q || q.meet || !q.seen) bad.push(`${Math.round(s.width * f)} px ${!q ? 'no card' : q.meet ? 'covered' : 'out of view'}`);
        if (q) where.add(q.at);
        await A.tapAt(5, 300);
        await page.waitForTimeout(80);
      }
      check(bad.length === 0, `Weekly running volume, 15 taps along it: the tapped column never under its card, every card in view (${[...where].join(', ')})${bad.length ? ': ' + bad.join('; ') : ''}`);
    }
    // a scroll that starts on a chart scrolls the pane and opens no card: a finger waits to be a tap or a slide
    await w(() => { document.getElementById('main').scrollTop = 0; document.getElementById('live').textContent = ''; });
    const r2 = await A.rect('.sec .chartwrap svg'), y0 = r2.top + r2.height / 2;
    await A.touch('touchStart', 200, y0);
    for (let k = 1; k <= 20; k++) { await A.touch('touchMove', 200 + (k % 2), y0 - 13 * k); await page.waitForTimeout(16); }
    await A.touch('touchEnd');
    await page.waitForTimeout(400);
    const v = await w(() => ({ card: window.__rd.card(), live: document.getElementById('live').textContent, top: document.getElementById('main').scrollTop }));
    check(!v.card && v.live === '' && v.top > 100, `a vertical drag that starts on a chart scrolls the pane by ${Math.round(v.top)} px, opens no card${v.card ? ` (opened "${v.card.place}")` : ''} and says nothing${v.live ? ` (said "${v.live}")` : ''}`);
  }

  // the filters held under the tabs (the owner, 2026-10-03): in the flow, so at rest the pane's content begins
  // at their foot and nothing is covered; the sport and equipment row above the window goes up and out with
  // a scroll down and comes back with a scroll up, moving with the pane; the window and its track stay
  {
    const at = () => w(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const g = (id) => document.getElementById(id).getBoundingClientRect(), m = g('main').top;
      r({ h: Math.round(g('filters').height), foot: Math.round(g('filters').bottom - m), picks: [g('picksRow').top - m, g('picksRow').bottom - m], row: Math.round(g('picksRow').height),
        time: g('timeRow').top - m, content: Math.round(g('pane').top - m), first: Math.round(document.querySelector('#pane > :first-child').getBoundingClientRect().top - m), top: document.getElementById('main').scrollTop });
    }))));
    const to = (y) => w((v) => { document.getElementById('main').scrollTop = v; }, y);
    await w(() => { document.getElementById('main').scrollTop = 0; });
    const s0 = await at();
    await to(200); const s1 = await at();
    // a finger dragging a thumb while the row is tucked: the window moves, the track holds still under it
    const th0 = await w(() => { const r = document.getElementById('dual').getBoundingClientRect(), t2 = document.getElementById('toRange'); return { x: r.left + 22 + (r.width - 44) * +t2.value / +t2.max, y: r.top + 22, v: +t2.value }; });
    const tops = [];
    await A.touch('touchStart', th0.x, th0.y);
    for (let k = 1; k <= 10; k++) { await A.touch('touchMove', th0.x - 6 * k, th0.y); await page.waitForTimeout(16); tops.push(await w(() => Math.round(document.getElementById('dual').getBoundingClientRect().top))); }
    await A.touch('touchEnd'); await page.waitForTimeout(300);
    const th1 = await w(() => ({ v: +document.getElementById('toRange').value, tf: document.getElementById('filters').style.transform }));
    check(new Set(tops).size === 1 && th1.v < th0.v && th1.tf === `translateY(-${s0.row}px)`, `a finger dragging the window's end with the row tucked: the window moves (week ${th0.v} to ${th1.v}), the track holds still under it (at ${tops[0]} px on all ${tops.length} moves), the row stays tucked`);
    await page.getByRole('button', { name: '1 year', exact: true }).click();
    await page.waitForTimeout(300);
    await to(140); const s2 = await at();
    await to(0); const s3 = await at();
    check(s0.content === s0.h && s0.first >= s0.foot && s0.picks[0] === 0, `Training: the filters under the tabs, ${s0.h} px (the sport and equipment row ${s0.row} px above the window's words and track, ${s0.h - s0.row} px); the pane's content begins ${s0.content} px down, at their foot, so at rest they cover nothing`);
    check(s1.picks[1] <= 0.5 && Math.abs(s1.time) < 0.5 && s1.foot === s0.h - s0.row, `scrolled 200 px down: the sport and equipment row gone above the pane (its foot at ${s1.picks[1]} px), the window's words at the top, ${s1.foot} px of filters held over the pane`);
    check(Math.abs(s2.picks[0]) < 0.5 && s2.foot === s0.h, `60 px back up (at ${s2.top} px): the row back whole (its top at ${s2.picks[0]} px), the filters ${s2.foot} px`);
    check(Math.abs(s3.picks[0]) < 0.5 && s3.foot === s0.h && s3.content === s0.h, `back at the top: the filters as at rest (${s3.foot} px), the content at their foot`);
    // the same by touch: a drag up tucks the row, a drag down brings it back; the window stays at the top
    await A.touch('touchStart', 200, 640);
    for (let k = 1; k <= 20; k++) { await A.touch('touchMove', 200, 640 - 13 * k); await page.waitForTimeout(16); }
    await A.touch('touchEnd'); await page.waitForTimeout(500);
    const t1 = await at();
    await A.shot(`training-tucked-${scheme}`, false);
    await A.touch('touchStart', 200, 400);
    for (let k = 1; k <= 8; k++) { await A.touch('touchMove', 200, 400 + 12 * k); await page.waitForTimeout(16); }
    await A.touch('touchEnd'); await page.waitForTimeout(500);
    const t2 = await at();
    check(t1.top > 150 && t1.picks[1] <= 0.5 && Math.abs(t1.time) < 0.5 && t2.top < t1.top - 48 && Math.abs(t2.picks[0]) < 0.5 && Math.abs(t2.time - s0.row) < 0.5,
      `by touch: a drag up scrolls the pane to ${t1.top} px with the row tucked and the window's words on top; a drag down back to ${t2.top} px brings the row back`);
    await w(() => { document.getElementById('main').scrollTop = 0; });
    await A.pane('Health');
    await to(200);
    const hs = await at();
    check(hs.row === 0 && Math.abs(hs.time) < 0.5 && hs.foot === hs.h, `Health (no sport or equipment): the window's words and track held at the top, ${hs.h} px, nothing tucked`);
    await to(0);
    await A.pane('Training');
  }

  // the window's thumbs (the owner, 2026-10-03: "I do not like the squares around the sliders"): the inputs
  // drawn at opacity 0, so the platform paints nothing of its own behind a thumb; a tracer head at each end
  // of the window; a thumb's 44 × 44 box holds nothing but the page outside its head and the track; each hit
  // still 44 × 44
  {
    const th = await w(() => {
      const d = document.getElementById('dual').getBoundingClientRect(), f = document.getElementById('fromRange'), t2 = document.getElementById('toRange');
      const x = (v) => d.left + 22 + (d.width - 44) * v / +f.max, y = d.top + 22;
      const hit = (cx) => { let n = 0; for (let k = -21; k <= 21; k++) { const a = document.elementFromPoint(cx + k, y), b = document.elementFromPoint(cx, y + k); if (a && a.type === 'range' && b && b.type === 'range') n++; } return n; };
      return { op: [getComputedStyle(f).opacity, getComputedStyle(t2).opacity], xs: [x(+f.value), x(+t2.value)], y, hits: [hit(x(+f.value)), hit(x(+t2.value))] };
    });
    const img = await A.png(), off = [], head = [];
    let seen = 0;
    for (const cx of th.xs) {
      let n = 0;
      for (let dy = -21.5; dy <= 21.5; dy += 0.5) for (let dx = -21.5; dx <= 21.5; dx += 0.5) {
        if ((Math.abs(dx) <= 9.5 && Math.abs(dy) <= 9.5) || Math.abs(dy) <= 2) continue;
        seen++;
        if (!near(img.at(Math.round((cx + dx) * 2), Math.round((th.y + dy) * 2)), PAGE, 3)) n++;
      }
      off.push(n);
      head.push(contrast(img.at(Math.round(cx * 2), Math.round(th.y * 2)), PAGE));
    }
    check(th.op.every((o) => o === '0') && off.every((n) => n === 0) && head.every((c) => c >= 3) && th.hits.every((n) => n === 43),
      `the window's thumbs: the inputs at opacity ${th.op.join(' and ')}; around each, ${off.join(' and ')} of ${seen / 2} sampled pixels off the page outside its head and the track (no plate); each head's ink ${head.map((c) => c.toFixed(2)).join(' and ')}:1; each hit 44 × 44 (${th.hits.join(' and ')} of 43 points both ways)`);
  }

  // Plan: the weekly running chart (the owner, 2026-10-03), where the stock had it, between the goal and the time in
  // zone; its legend, its table against this file's sums and the plan's targets, a tap's card, the race's name
  // clear of every bar; then a planned bar's tint in every chart on the pane, and the plan's zone bars
  await A.pane('Plan');
  {
    const RUN = 'Running volume, past and planned';
    const p = await w((T) => {
      const secs = [...document.querySelectorAll('#pane > .sec')], names = secs.map((x) => (x.querySelector('h2, h3') || {}).textContent || ''), s = secs[names.indexOf(T)], i = secs.indexOf(s);
      const lab = s && [...s.querySelectorAll('svg text')].find((x) => x.classList.contains('halo') && !x.classList.contains('mk') && x.textContent.length > 12);
      const L = lab && lab.getBBox(), bars = s ? [...s.querySelectorAll('svg rect')].filter((r) => r.getAttribute('fill') && r.getAttribute('fill') !== 'transparent' && r.getAttribute('opacity') !== '0') : [];
      const hits = L ? bars.filter((r) => { const b = r.getBBox(); return b.x < L.x + L.width && L.x < b.x + b.width && b.y < L.y + L.height && L.y < b.y + b.height; }).length : -1;
      return { before: names[i - 1], after: names[i + 1], aria: s && s.querySelector('svg').getAttribute('aria-label'), legend: s ? [...s.querySelectorAll('.legend span')].map((x) => x.textContent) : [],
        label: lab ? lab.textContent : '', hits, bars: bars.length, tinted: s ? s.querySelectorAll('svg rect.tint').length : 0 };
    }, RUN);
    check(p.before === `Goal: ${snap.plan.goal.race.name}` && p.after === 'Time in zone, past and planned' && p.aria === 'Weekly running kilometers by heart-rate zone, run and planned'
      && JSON.stringify(p.legend) === JSON.stringify(['Below Z1', 'Easy (Z1–2)', 'Moderate (Z3)', 'Hard (Z4–5)', 'Planned', '4-week average, actual', '4-week average, planned']) && p.tinted > 0 && p.label === snap.plan.goal.race.name && p.hits === 0,
      `Plan: "${RUN}" between "${p.before}" and "${p.after}"; its legend ${p.legend.join(', ')}; ${p.tinted} planned segments tinted; "${p.label}" clear of all ${p.bars} bars (${p.hits} met)`);
    const key = page.locator('.sec', { has: page.locator('h2', { hasText: RUN }) }).getByRole('button', { name: 'Show the table', exact: true });
    if (await key.count()) await key.click();
    await page.waitForTimeout(150);
    const rows = await w((T) => [...([...document.querySelectorAll('#pane > .sec')].find((x) => (x.querySelector('h2, h3') || {}).textContent === T) || document.createElement('i')).querySelectorAll('.tableview tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent)), RUN);
    const now = monday('2026-10-01'), weeks = [];
    for (let k = 11; k >= 0; k--) weeks.push(ymd(t(now) - 7 * k * DAY));
    for (const h of snap.plan.horizon) if (h.w > now) weeks.push(h.w);
    const bad = [];
    weeks.forEach((wk, i) => {
      const r = rows[i] || [], h = snap.plan.horizon.find((x) => x.w === wk);
      if (r[0] !== dateOf(wk)) bad.push(`${wk}: week ${r[0]}`);
      else if (wk <= now) { const z = r.slice(2, 6).reduce((s, v) => s + Number(v), 0); if (r[1] !== weekKm(wk).toFixed(1) || Math.abs(z - weekKm(wk)) > 0.2) bad.push(`${wk}: ${r[1]} km, zones ${z.toFixed(1)} (this file ${weekKm(wk).toFixed(1)})`); }
      else if (r[1] !== '–' || r[6] !== String(h.km)) bad.push(`${wk}: ${r[1]}, plan ${r[6]}`);
    });
    check(rows.length === weeks.length && bad.length === 0 && (rows[11] || [])[6] === '62',
      `its table: ${rows.length} weeks, ${weeks[0]} to ${weeks[weeks.length - 1]}, each run week's kilometers as this file sums them and its four zones adding up to them, this week with its 62 km, the plan's weeks ${snap.plan.horizon.filter((h) => h.w > now).map((h) => h.km).join(', ')} km${bad.length ? ': ' + bad.slice(0, 4).join('; ') : ''}`);
    // a tap on the week of 14 Sep: its card, the run kilometers and their zones
    await w((T) => ([...document.querySelectorAll('#pane > .sec')].find((x) => (x.querySelector('h2, h3') || {}).textContent === T) || document.querySelector('#pane > .sec')).querySelector('svg').scrollIntoView({ block: 'center' }), RUN);
    await page.waitForTimeout(200);
    const sr = await w((T) => ([...document.querySelectorAll('#pane > .sec')].find((x) => (x.querySelector('h2, h3') || {}).textContent === T) || document.querySelector('#pane > .sec')).querySelector('svg').getBoundingClientRect().toJSON(), RUN);
    await A.tapAt(sr.left + 38 + (weeks.indexOf('2026-09-14') + 0.5) * (sr.width - 46) / weeks.length, sr.top + sr.height - 60);
    await page.waitForTimeout(250);
    const c = await w(() => window.__rd.card());
    const zones = c ? c.rows.filter(([l]) => /^(Below Z1|Easy|Moderate|Hard)/.test(l)).map(([, v]) => parseFloat(v)) : [];
    check(c && c.place === 'Week of 14 Sep 2026' && c.value === weekKm('2026-09-14').toFixed(1) && zones.length >= 3 && Math.abs(zones.reduce((s, v) => s + v, 0) - weekKm('2026-09-14')) <= 0.2,
      `its card for 14 Sep: "${c && c.place}", ${c && c.value} km (this file ${weekKm('2026-09-14').toFixed(1)}), ${zones.length} zones adding up to ${zones.reduce((s, v) => s + v, 0).toFixed(1)}`);
    await A.shot(`plan-running-${scheme}`, false);
    await A.tapAt(5, 300);
    // every chart on Plan: its tallest planned segment's inside is its own color at 20 % over the page, and the
    // done segment of the same color stands at 3:1 or more against it (done solid, planned tinted)
    for (const title of [RUN, 'Time in zone, past and planned', 'Day by day, planned and run', 'Day by day, as time in zone']) {
      const q = await w((T) => {
        const s = [...document.querySelectorAll('#pane > .sec')].find((x) => (x.querySelector('h2, h3') || {}).textContent === T), ts = s ? [...s.querySelectorAll('svg rect.tint')] : [].sort((a, b) => b.getBBox().height - a.getBBox().height), r = ts[0];
        if (!r) return null;
        r.scrollIntoView({ block: 'center' });
        const b = r.getBoundingClientRect(), fill = getComputedStyle(r).fill.match(/\d+/g).map(Number);
        const done = [...s.querySelectorAll('svg rect:not(.tint)')].some((x) => x.getAttribute('fill') === r.getAttribute('fill') && x.getBBox().height > 2);
        return { b: [b.left, b.top, b.width, b.height], h: b.height, fill, done };
      }, title);
      if (!q) { check(false, `${title}: a planned segment to sample`); continue; }
      await page.waitForTimeout(120);
      // four points inside it, the best taken (a race's rule or an average's line may cross one)
      const img = await A.png(), want = over(q.fill, TINT, PAGE), [bx, by, bw, bh] = q.b;
      const px = [[0.3, 0.4], [0.7, 0.4], [0.3, 0.6], [0.7, 0.6]].map(([fx, fy]) => img.at(Math.round((bx + bw * fx) * 2), Math.round((by + bh * fy) * 2))).sort((m, k) => Math.max(...m.map((v, i) => Math.abs(v - want[i]))) - Math.max(...k.map((v, i) => Math.abs(v - want[i]))))[0];
      const ok = near(px, want) && contrast(q.fill, px) >= 3 && q.done;
      check(ok, `${title}: a planned segment ${Math.round(q.h)} px tall, inside rgb(${px}) for rgb(${want}) (its rgb(${q.fill}) at 20 % over the page), ${contrast(px, PAGE).toFixed(2)}:1 on the page; the done segment of its color ${contrast(q.fill, px).toFixed(2)}:1 against it`);
    }
    const zb = await w(() => { const s = document.querySelector('.zbar.plan span'), l = document.querySelector('.legend i.plan'); return [s && getComputedStyle(s).backgroundColor, l && getComputedStyle(l).backgroundColor]; });
    check(zb.every((c2) => c2 && /\/ 0\.2\)|, 0\.2\)$/.test(c2)), `the plan's zone bars in the week rows and the legend's planned swatch: their outline's color at 20 % inside (${zb.join('; ')})`);
    await w(() => { document.getElementById('main').scrollTop = 0; });
  }
  await closeOut(A, scheme);

  // a long fact (a metric whose note runs on, as the owner's coaching routine writes them) stays below, under
  // the verdict, as a label over its prose, left-aligned and wrapped, never right-aligned prose in the table
  {
    const s = JSON.parse(raw), LONG = 'The down week, as it closed';
    s.assessment.metrics.push({ label: LONG, value: '45.9 km', note: 'Against the 46 km written: on target to the kilometer. The long run moved to Saturday, so the week ended a day early, and by load it reads as written.' });
    override = { '/data/snapshot.json': { body: JSON.stringify(s) } };
    const L = await open(scheme);
    const q = await L.w((label) => {
      const lg = document.querySelector('#pane > dl.long'), f = lg && [...lg.querySelectorAll('.fact')].find((x) => x.querySelector('dt').textContent === label), dd = f && f.querySelector('dd');
      const tab = [...document.querySelectorAll('#pane dl.tab dt')].map((d) => d.textContent), pr = document.getElementById('pane').getBoundingClientRect(), r = dd && dd.getBoundingClientRect();
      return { found: !!dd, after: lg && lg.previousElementSibling && lg.previousElementSibling.matches('p.verdict'), inTab: tab.includes(label), n: tab.length,
        align: dd && getComputedStyle(dd).textAlign, lines: r ? Math.round(r.height / parseFloat(getComputedStyle(dd).lineHeight)) : 0, inside: r && r.right <= pr.right - 15 && r.left >= pr.left + 15 };
    }, LONG);
    check(q.found && q.after && !q.inTab && q.n === 8 && q.align === 'left' && q.lines >= 2 && q.inside,
      `a long fact ("${LONG}…"): below the verdict, not in the table (still ${q.n} short facts), a label over ${q.lines} lines of left-aligned prose inside the pane's gutters`);
    await L.shot(`now-long-fact-${scheme}`, false);
    override = {};
    await closeOut(L, `${scheme}, a long fact`);
  }
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once');
{
  const A = await open('light');
  const { page, w } = A;
  await A.pane('Now');
  // the loop clip's slow drag from 75 % to 35 % of the screen's height on Now scrolls the pane, not the page
  {
    const before = await w(() => [document.getElementById('main').scrollTop, scrollY]);
    await A.touch('touchStart', 195, 633);
    for (let y = 633; y >= 295; y -= 13) { await A.touch('touchMove', 195, y); await page.waitForTimeout(16); }
    await A.touch('touchEnd');
    await page.waitForTimeout(400);
    const after = await w(() => [document.getElementById('main').scrollTop, scrollY, document.getElementById('head').getBoundingClientRect().top, document.getElementById('band').getBoundingClientRect().bottom]);
    check(after[0] > before[0] + 150 && after[1] === 0 && after[2] === 0 && Math.abs(after[3] - 844) < 1, `the camera's drag (75 % to 35 %) scrolls the pane by ${after[0] - before[0]} px; the page stays, the header and the caption band hold`);
    await w(() => { document.getElementById('main').scrollTop = 0; });
  }
  // the tabs by keyboard: an arrow chooses the next pane and says its name once
  {
    await w(() => document.querySelector('.tabs [aria-selected="true"]').focus());
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    const k = await w(() => [window.__rd.pane(), document.activeElement.textContent, document.getElementById('live').textContent]);
    check(k[0] === 'plan' && k[1] === 'Plan' && k[2] === 'Plan.', `the tabs by keyboard: ArrowRight chooses ${k[1]}, focus follows, the live region says "${k[2]}"`);
  }
  // About: opens from the stamp, holds the rest inert, carries the credits, closes on Escape back to the stamp
  {
    const s = await A.rect('#stamp');
    await A.tapAt(s.left + 20, s.top + s.height / 2);
    await page.waitForTimeout(400);
    const a = await w(() => ({ open: !document.getElementById('about').hidden, inert: ['head', 'main', 'band'].every((id) => document.getElementById(id).inert), focus: document.activeElement.id,
      text: document.querySelector('.about-body').textContent.replace(/\s+/g, ' '), routes: !document.getElementById('about-routes').hidden && document.getElementById('about-routes').textContent.startsWith('Routes: © OpenStreetMap contributors, under the Open Database License 1.0'), list: [...document.querySelectorAll('#about-list dt')].map((d) => d.textContent) }));
    check(a.open && a.inert && a.focus === 'about-close' && a.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.')
      && a.text.includes('Map services and data available from U.S. Geological Survey, National Geospatial Program.') && a.text.includes('as the coaching routine wrote it on 30 Sep 2026') && a.list.includes('Stale after:') && a.routes,
      `About opens from the stamp, focus on Close, the rest inert; the font's, the tiles' and the demo routes' OpenStreetMap credits (the lead's ruling), the plan's date, This data (${a.list.length} lines)`);
    await A.shot('about-light');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp' && !document.getElementById('main').inert), 'About closes on Escape; focus returns to the stamp');
  }
  // hidden and back: the snapshot is read again and the pane stays
  {
    const n0 = snapshotReads;
    await w(() => { document.querySelectorAll('#pane details').forEach((d, i) => { d.open = i < 3; }); });
    await w(() => { document.getElementById('main').scrollTop = 300; });
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => [document.getElementById('main').scrollTop, window.__rd.pane(), window.__rd.ready(), document.querySelectorAll('#pane details[open]').length]);
    check(snapshotReads === n0 + 1 && s[1] === 'plan' && s[2] && Math.abs(s[0] - 300) < 2 && s[3] === 3, `back on screen: the snapshot read again (${snapshotReads - n0}), the same file redraws nothing: the pane, its scroll (${s[0]} px) and its ${s[3]} open folds kept`);
  }
  // back on screen with a changed file (the pull an hour later): the pane is drawn again, and its open folds,
  // one of each kind and known by their words, and its scroll stay
  {
    const open = await w(() => {
      const ds = [...document.querySelectorAll('#pane details')], want = [ds.find((d) => d.matches('.howto')), ds.find((d) => d.matches('.srow')), ds.find((d) => d.firstChild.textContent === 'Why this shape')];
      ds.forEach((d) => { d.open = want.includes(d); });
      document.getElementById('pane').firstElementChild.dataset.old = '1';
      document.getElementById('main').scrollTop = 300;
      return want.map((d) => d.firstChild.textContent);
    });
    override = { '/data/snapshot.json': { body: raw.replace('"generatedAt":"2026-09-30T18:20:00Z"', '"generatedAt":"2026-09-30T19:20:00Z"') } };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => ({ redrawn: !document.querySelector('#pane [data-old]'), stamp: document.getElementById('stamp').textContent, top: document.getElementById('main').scrollTop,
      open: [...document.querySelectorAll('#pane details[open]')].map((d) => d.firstChild.textContent) }));
    check(s.redrawn && s.stamp.startsWith('Updated 30 Sep, 21:20') && JSON.stringify(s.open) === JSON.stringify(open) && Math.abs(s.top - 300) < 2,
      `back on screen with a changed file ("${s.stamp}"): the pane drawn again (${s.redrawn}), its ${s.open.length} open folds kept by their words (${s.open.map((x) => `"${x.slice(0, 18)}"`).join(', ')}) and its scroll (${s.top} px)`);
    override = {};
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
  }
  // a broken replacement keeps the data that was showing, and says so
  {
    override = { '/data/snapshot.json': { body: '<!doctype html><title>404</title>' } };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => ({ notice: document.getElementById('notice').hidden ? '' : document.getElementById('notice').textContent, pane: document.getElementById('pane').children.length, tabs: !document.getElementById('tabs').hidden, scroll: document.getElementById('main').scrollTop }));
    check(s.notice === 'The new data/snapshot.json is not valid JSON; it looks like a web page was written over it. Still showing the data from 30 Sep, 20:20.Close' && s.pane > 3 && s.tabs && Math.abs(s.scroll - 300) < 2,
      `B3: a broken replacement while open: "${s.notice}"; the pane (${s.pane} sections), the tabs and the scroll kept`);
    await A.shot('broken-replacement-light', false);
    const kb = await A.rect('#notice .textkey');
    await A.tapAt(kb.left + kb.width / 2, kb.top + kb.height / 2);
    await page.waitForTimeout(150);
    check(kb.height >= 44 && await w(() => document.getElementById('notice').hidden && document.getElementById('pane').children.length > 3), `the plate's Close key (${Math.round(kb.width)} × ${Math.round(kb.height)}) puts it away; the data stays`);
    override = {};
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    check(await w(() => document.getElementById('notice').hidden), 'a good file again clears the notice');
  }
  // the route map on Sessions: the newest session's route, its words, its legend's open ends, its card
  {
    await A.pane('Sessions');
    await page.locator('.sess', { hasText: 'Easy run' }).first().click();   // the newest session with a route (Intervals has no record stream)
    await page.waitForTimeout(900);
    const m = await w(() => ({ svg: !!document.querySelector('.mapwrap svg path'), words: [...document.querySelectorAll('[aria-label="Route colors"] button')].map((b) => b.textContent),
      cap: [...document.querySelectorAll('.sec .cap')].map((c) => c.textContent).find((x) => x.startsWith('Start is the filled dot')) || '', fig: document.querySelector('.sessdetail .fig').textContent }));
    const a = [...snap.activities].reverse().find((x) => x.name === 'Easy run');
    check(m.svg && m.words[0] === 'Heart-rate zone' && m.words.includes('Pace') && m.fig === `${running(a).toFixed(1)}${NN}km` && m.cap.endsWith('Map tiles: USGS The National Map. Route: © OpenStreetMap contributors, ODbL.'),
      `the route: ${m.words.join(', ')}; the session's figure ${m.fig} (this file ${running(a).toFixed(1)} km); its caption ends "${m.cap.slice(-75)}"`);
    await page.getByRole('button', { name: 'Pace', exact: true }).click();
    await page.waitForTimeout(300);
    const r = await w(() => [...document.querySelectorAll('.ramp span')].map((s) => s.textContent));
    check(/^slower ≥ \d:\d\d\u202F\/km$/.test(r[0]) && /^faster ≤ \d:\d\d\u202F\/km$/.test(r[1]), `the pace legend prints its open ends: "${r[0]}" and "${r[1]}"`);
    // the ramp's minimum span: this steady run's 5th to 95th percentile of pace lie closer than 45 s/km, so its
    // colors span 45 s/km around its median (worked out here from the stream) and 90 % of the route reads in at
    // most three of the ramp's nine stops (the review saw nine colors for 12 s/km of noise)
    {
      const st = snap.streams[a.id];
      const v = st.p.map((x, i) => (st.lat[i] != null && st.lon[i] != null && x && x <= 8.5 ? x : null)).filter((x) => x != null).sort((p, q) => p - q);
      let lo = v[Math.floor(v.length * 0.05)], hi = v[Math.floor(v.length * 0.95)];
      const spread = Math.round((hi - lo) * 60);
      if (hi - lo < 0.75) { lo = v[Math.floor(v.length / 2)] - 0.375; hi = lo + 0.75; }
      const mmss = (m) => { let mm = Math.floor(m), s = Math.round((m - mm) * 60); if (s === 60) { mm++; s = 0; } return `${mm}:${String(s).padStart(2, '0')}`; };
      const g = await w(() => ({ stops: getComputedStyle(document.querySelector('.ramp i')).backgroundImage.match(/rgb\([^)]+\)/g).map((c) => c.match(/\d+/g).map(Number)),
        segs: [...document.querySelectorAll('.mapwrap > svg path[stroke-width="4"]')].map((p) => [p.getAttribute('stroke').match(/\d+/g).map(Number), (p.getAttribute('d').match(/L/g) || []).length]),
        cap: [...document.querySelectorAll('.sec .cap')].map((c) => c.textContent).find((x) => x.startsWith('Start is the filled dot')) || '' }));
      // each drawn color's place on the ramp: projected onto the nearest of its eight sRGB segments, then the nearest stop
      const at = (c) => {
        let best = [Infinity, 0];
        for (let k = 0; k < g.stops.length - 1; k++) {
          const A0 = g.stops[k], B0 = g.stops[k + 1], d = B0.map((x, j) => x - A0[j]), L2 = d.reduce((s, x) => s + x * x, 0);
          const f = Math.max(0, Math.min(1, d.reduce((s, x, j) => s + x * (c[j] - A0[j]), 0) / L2)), e = c.reduce((s, x, j) => s + (x - A0[j] - f * d[j]) ** 2, 0);
          if (e < best[0]) best = [e, Math.round(k + f)];
        }
        return best[1];
      };
      const hist = new Array(9).fill(0), list = [];
      for (const [c, n] of g.segs) { const k = at(c); hist[k] += n; for (let j = 0; j < n; j++) list.push(k); }
      list.sort((p, q) => p - q);
      const span = list[Math.floor(list.length * 0.95)] - list[Math.floor(list.length * 0.05)] + 1;
      check(g.stops.length === 9 && r[0] === `slower ≥ ${mmss(hi)}${NN}/km` && r[1] === `faster ≤ ${mmss(lo)}${NN}/km` && span <= 3 && g.cap.includes(`5th and 95th percentile, at least 45${NN}s/km apart,`),
        `a steady run (5th to 95th percentile ${spread} s/km apart) is colored over 45 s/km around its median: the legend "${r[0]}", "${r[1]}" (this file ${mmss(hi)} and ${mmss(lo)}); 90 % of its ${list.length} segments in ${span} of the ramp's ${g.stops.length} stops (segments per stop ${hist.join(' ')}); the caption says so`);
    }
    await w(() => document.querySelector('.mapwrap').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(200);
    const mr = await A.rect('.mapwrap svg');
    const pts = await w(() => document.querySelector('.route-casing').getAttribute('d').slice(1).split('L').map((p) => p.split(',').map(Number)));
    const [px, py] = pts[Math.floor(pts.length / 2)];
    await A.tapAt(mr.left + px, mr.top + py);
    await page.waitForTimeout(250);
    const c = await w(() => window.__rd.card());
    check(c && /^\d+:\d\d into the session, \d+\.\d\u202Fkm$/.test(c.place) && /^\d:\d\d$/.test(c.value) && c.unit === '/km' && c.rows.some(([l]) => l === 'Heart rate'),
      `a touch on the route: "${c && c.place}", ${c && c.value} ${c && c.unit}, ${c && c.rows.length} rows`);
    const xm = await xInside(w);
    check(xm && xm.ok, `the route's card: its ✕ drawn inside its button (mark at ${xm && xm.at}, button at ${xm && xm.btn})`);
    await A.shot('sessions-map-light', false);
    await A.tapAt(5, 300);
    await page.waitForTimeout(150);
    const top0 = await w(() => document.getElementById('main').scrollTop), y1 = mr.top + mr.height * 0.8;
    await A.touch('touchStart', mr.left + mr.width / 2, y1);
    for (let k = 1; k <= 16; k++) { await A.touch('touchMove', mr.left + mr.width / 2, y1 - 14 * k); await page.waitForTimeout(16); }
    await A.touch('touchEnd');
    await page.waitForTimeout(400);
    const mv = await w(() => ({ top: document.getElementById('main').scrollTop, card: window.__rd.card() }));
    check(mv.top - top0 > 100 && !mv.card, `a vertical swipe across the route map scrolls the pane by ${Math.round(mv.top - top0)} px and opens no card`);
    // HOUSE 4.7, the marker never under its own card: twenty points along this route (the final review
    // found 15 of 41 covered, where both top corners hold the point)
    {
      await w(() => document.querySelector('.mapwrap').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(200);
      const mr2 = await A.rect('.mapwrap'), bad = [], where = new Set();
      const P = await w(() => document.querySelector('.route-casing').getAttribute('d').slice(1).split('L').map((p) => p.split(',').map(Number)));
      for (let k = 0; k < 20; k++) {
        const [x, y] = P[Math.round((k * (P.length - 1)) / 19)];
        await A.tapAt(mr2.left + x, mr2.top + y);
        await page.waitForTimeout(120);
        const q = await w(() => {
          const c = document.querySelector('.mapwrap .readout:not([hidden])'), d = document.querySelector('.mapwrap > svg .cdot'), m = document.getElementById('main').getBoundingClientRect();
          if (!c || !d || +d.getAttribute('opacity') !== 1) return null;
          const a = c.getBoundingClientRect(), b = d.getBoundingClientRect(), r = c.parentElement.getBoundingClientRect(), f = document.getElementById('filters').getBoundingClientRect();   // the dot and its 1 px of ring outside; in view under the filters
          return { meet: a.left < b.right + 1 && b.left - 1 < a.right && a.top < b.bottom + 1 && b.top - 1 < a.bottom, seen: a.top >= f.bottom - 1 && a.bottom <= m.bottom + 1,
            at: a.top >= r.bottom - 1 ? 'hung from the foot' : a.bottom <= r.top + 1 ? 'over its head' : `${a.top - r.top > 20 ? 'bottom' : 'top'}-${a.left - r.left > 20 ? 'right' : 'left'}` };
        });
        if (!q || q.meet || !q.seen) bad.push(`${Math.round(x)},${Math.round(y)} ${!q ? 'no card' : q.meet ? 'covered' : 'out of view'}`);
        if (q) where.add(q.at);
        await A.tapAt(5, 300);
        await page.waitForTimeout(80);
      }
      check(bad.length === 0, `the route, 20 points along it: the marker never under its card, every card in view (${[...where].join(', ')})${bad.length ? ': ' + bad.join('; ') : ''}`);
    }
  }
  await closeOut(A, 'once');
}
// the stale stamp: two days after the snapshot, a sentence in ink, never a color (B1)
{
  const A = await open('light', { time: '2026-10-03T12:00:00Z' });
  const s = await A.w(() => { const e = document.querySelector('#stamp .stale'); return { text: document.getElementById('stamp').textContent, ink: e && getComputedStyle(e).color === getComputedStyle(document.querySelector('h1')).color }; });
  check(s.text === `Stale. ${STAMP}` && s.ink, `B1: more than 48 hours on, the stamp reads "${s.text}", the word in ink`);
  await closeOut(A, 'stale');
}
// three weeks after the pull: days the data never saw are not shown as days without running
{
  const A = await open('light', { time: '2026-10-21T10:00:00Z' });
  const { w } = A;
  const pullDay = ymd(gen.getTime()), d0 = ymd(t(pullDay) - 6 * DAY);
  const run7 = snap.activities.filter((a) => a.sport === 'run' && a.d >= d0 && a.d <= pullDay).reduce((s, a) => s + running(a), 0);
  const n = await w(() => ({ fig: document.querySelector('.figure .fig-what').textContent, f1: document.querySelector('.fact').textContent, B: window.__rd.block() }));
  const pd = `${Number(pullDay.slice(8))} ${MON[Number(pullDay.slice(5, 7)) - 1]}`;
  const later = n.B.columns.slice(n.B.now + 1).map((c) => c.week), plan = snap.plan.horizon.map((h) => h.w);
  check(n.fig === `Week of 28 Sep, data to ${pd}` && n.f1.startsWith(`Run, 7 days to ${pd}${run7.toFixed(1)}`) && n.B.columns[n.B.now].week === monday(pullDay) && later.every((x) => plan.includes(x)) && n.B.columns.slice(0, n.B.now + 1).every((c) => c.target == null || c.week === monday(pullDay)),
    `21 days on: "${n.fig}", "${n.f1.slice(0, 40)}" (this file ${run7.toFixed(1)} km), the Block's last ink in the pull's week (${n.B.columns[n.B.now].week}), every later column the plan's`);
  await A.pane('Plan');
  const p = await w(() => document.querySelector('.figure').textContent);
  const days = Math.round((t(snap.plan.goal.race.date) - t('2026-10-21')) / DAY);
  check(p.startsWith(`Race day${days} days`), `21 days on, race day still counts from the phone: "${p.slice(0, 20)}" (${days} days)`);
  await A.pane('Health');
  const h = await w(() => document.querySelector('.fact').textContent);
  check(/at \d+ [A-Z][a-z]{2}, \d\d:\d\d/.test(h), `21 days on, Today's facts carry their day: "${h}"`);
  await A.shot('stale-21-days-health-light', false);
  await closeOut(A, '21 days on');
}
// Reduce Motion: every animation at 0 s
{
  const A = await open('light', { reduced: true });
  const d = await A.w(() => [getComputedStyle(document.querySelector('.tabs [aria-selected="true"]'), '::after').animationDuration, getComputedStyle(document.querySelector('.about-sheet')).animationDuration]);
  check(d.every((x) => x === '0s'), `Reduce Motion: the tracer and About at ${d.join(', ')}`);
  await closeOut(A, 'reduce motion');
}
// broken data at the start: a sentence on a plate, never a blank pane
for (const [label, ov, want] of [
  ['missing', { status: 404 }, 'data/snapshot.json could not be read (HTTP 404).'],
  ['not JSON', { body: '<!doctype html><html><body>Not Found</body></html>' }, 'data/snapshot.json is not valid JSON; it looks like a web page was written over it.'],
  ['the wrong shape', { body: '{"message":"Not Found","documentation_url":"x"}' }, 'data/snapshot.json is not the shape this app expects:'],
]) {
  override = { '/data/snapshot.json': ov };
  const A = await open('light', { noWait: true, expect: /HTTP 404|404 \(Not Found\)|Failed to load resource|requestfailed .*\/data\/snapshot\.json$/ });
  await A.page.waitForSelector('#notice:not([hidden])', { timeout: 15000 });
  const s = await A.w(() => ({ first: document.querySelector('#notice p').textContent, role: document.getElementById('notice').getAttribute('role'), tabs: document.getElementById('tabs').hidden, stamp: document.getElementById('stamp').textContent, mono: [...document.querySelectorAll('#notice *')].some((e) => /mono/i.test(getComputedStyle(e).fontFamily)) }));
  check(s.first === want && s.role === 'alert' && s.tabs && s.stamp === 'No usable data' && !s.mono, `broken data, ${label}: "${s.first}" on a plate (role alert), no tabs, no monospace (B4)`);
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
      const m = document.getElementById('main'), cap = document.getElementById('capline');
      return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, cap: cap.scrollHeight <= cap.clientHeight + 1, pane: m.clientHeight, head: document.getElementById('head').getBoundingClientRect().height };
    }));
  }
  const side = r.filter((x) => x.side).length, cap = r.filter((x) => !x.cap).length;
  const land = wv > hv ? r.every((x) => x.head <= 47 && x.pane >= 220) : true;
  check(side === 0 && cap === 0 && land, `${label}: no sideways scroll on any pane, the caption line inside its height on every pane${wv > hv ? `, the header one ${Math.round(r[0].head)} px row, the pane ${Math.round(Math.min(...r.map((x) => x.pane)))} px tall` : ''}`);
  if (wv > hv) {
    await A.shot('now-landscape-light', false);
    // the filters held over a pane on its side: they count against it as the header does
    await A.pane('Training');
    const f = async (y) => A.w((v) => new Promise((res) => { document.getElementById('main').scrollTop = v; requestAnimationFrame(() => requestAnimationFrame(() => res([document.getElementById('main').clientHeight, Math.round(document.getElementById('filters').getBoundingClientRect().bottom - document.getElementById('main').getBoundingClientRect().top)]))); }), y);
    const [pane, rest] = await f(0), [, held] = await f(200);
    check(pane - held >= pane / 2, `on its side, Training: the pane ${pane} px tall, the filters ${rest} px of it at rest and ${held} px once the row has tucked, ${pane - held} px left for the charts`);
    await A.shot('training-landscape-light', false);
  }
  await closeOut(A, label);
}

const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png, the README's composite, untouched (${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent'})`);
await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
