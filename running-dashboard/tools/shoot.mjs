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
// (its blocks against this file's decode, its ink sampled on rendered pixels, its card and sentence),
// a chart's card against this file's sums and clear of the tapped bar, fifteen taps along that chart with
// no column under its card, each card's ✕ inside its button, a vertical drag on a chart scrolling with no
// card, SI in every visible text node, hit targets on every pane, the pictures. Once: the loop clip's drag
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
          const a = c.getBoundingClientRect(), b = col.getBoundingClientRect(), r = c.parentElement.getBoundingClientRect();
          return { meet: a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom, seen: a.top >= m.top - 1 && a.bottom <= m.bottom + 1, at: a.top >= r.bottom - 1 ? 'hung from the foot' : a.left - r.left > 20 ? 'top-right' : 'top-left' };
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
  await closeOut(A, scheme);
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
          const a = c.getBoundingClientRect(), b = d.getBoundingClientRect(), r = c.parentElement.getBoundingClientRect();   // the dot and its 1 px of ring outside
          return { meet: a.left < b.right + 1 && b.left - 1 < a.right && a.top < b.bottom + 1 && b.top - 1 < a.bottom, seen: a.top >= m.top - 1 && a.bottom <= m.bottom + 1,
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
  if (wv > hv) await A.shot('now-landscape-light', false);
  await closeOut(A, label);
}

const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png, the README's composite, untouched (${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent'})`);
await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
