// Drive Hello Live in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through CDP), light and
// dark (HOUSE.md section 7.2 as one live card allows: no player, no focus mode, no units key, no readout card;
// ART.md section 3, "Not here, and why"). The phone's zone is Europe/Oslo. Two clocks from ART.md: Sat 3 Oct 2026,
// 10:00 UTC (12:00 in Oslo: the committed file run out, what a fresh install and the marketing camera see) and
// Thu 1 Oct 2026, 02:30 UTC (31 minutes after the committed file was written: the fresh state). "The committed file" is
// the fixed day, tools/fixtures/snapshot.json (the file of 1 Oct; check.mjs pins it), served as data/snapshot.json,
// because the refresh job rewrites the shipped file about hourly; one stage reads the shipped file as it is (plan 0012
// package 4). Fails on any console
// error or warning, page error, failed request, HTTP ≥ 400, or any request outside the local server. Every figure it
// asserts is worked out here from data/snapshot.json with Node's own tools and formulas written in this file, never
// by importing js/.
//
// LOAD TIMES ARE HEADLESS CHROMIUM ON THIS MAC: a trend only, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the pictures to screenshots/*-{light,dark}.png
//
// Per theme, at both clocks: boot (the face, the credits word for word, the headline, the lead and the rows against
// the file, the stamp built here), the Time Card against the rule written here (px per hour, the punch, the tails
// across midnights, now, the axis labels, the accessible name), text contrast, SI and the date forms, the one bold
// thing on rendered pixels (the card's ink against what lies under it), hit targets, idle. Once: About (from the
// stamp, Tab held, Escape, focus returned, its lines), a week of the loop from storage, the same file on a return
// (nothing rebuilt), a new file (a punch added, said once), a broken and a missing replacement (the view kept, Close),
// hidden (nothing runs), the minute (the stamp turns stale, now moves), storage blocked, the bugs on record at their
// fixtures (B6 ahead, B7 undated, B16 a long headline), four locales, Reduce Motion, broken data at the start and its
// recovery, the widths, a phone on its side and a wide window (the header centered with the pane), the stamp on one
// line in every state it writes, and the shipped file. Plan 0012's register as this app takes it (HOUSE 11.1): the
// key number, the card's key, no band, the About key, the white ground. Pictures: tools/.work/shots/, and with SCREENSHOTS=1
// screenshots/*-{light,dark}.png; never screenshots/app.png, the README's composite, whose hash is checked unchanged.

process.env.TZ = 'Europe/Oslo';   // before any Date: this script's own clock forms are the phone's
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
if (KEEP) fs.mkdirSync(SHOTS, { recursive: true });
const schemes = (process.env.SCHEMES || 'light,dark').split(',').filter((s) => s === 'light' || s === 'dark');
const appPng = path.join(SHOTS, 'app.png');
const hashOf = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);
const appPngHash = hashOf(appPng);
const TZ = 'Europe/Oslo';
const RANOUT = '2026-10-03T10:00:00Z', FRESH = '2026-10-01T02:30:00Z';

/* ── the file and the card's rule, written here ── */
const rawSnap = fs.readFileSync(path.join(APP, 'tools/fixtures/snapshot.json'), 'utf8');   // the fixed day, served as data/snapshot.json
const liveSnap = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');               // the shipped file, for its own stage
const snap = JSON.parse(rawSnap);
const GEN = Date.parse(snap.generatedAt);
const NN = ' ', MI = '−';
// a row's value as the app should print it, written here from HOUSE 6.1 and the lead's ruling (2026-10-08), not imported:
// a plain digit string of four digits or more, with no leading zero, grouped in threes with U+202F
const grouped = (v) => (/^[1-9]\d{3,}$/.test(v) ? v.replace(/\B(?=(\d{3})+(?!\d))/g, NN) : v);
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n) => String(n).padStart(2, '0');
const hm = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const when = (ms, now) => (sameDay(ms, now) ? hm(ms) : `${new Date(ms).getDate()} ${MON[new Date(ms).getMonth()]}, ${hm(ms)}`);
const spokenAt = (ms) => { const d = new Date(ms); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${hm(ms)}`; };
const fullAt = (ms) => { const d = new Date(ms), off = -d.getTimezoneOffset() / 60; return `${DAY[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${hm(ms)} (UTC+${off})`; };
/** The stamp's words as ART.md section 3 gives them: 6 h stale, more than 1 h ahead, the instant on the phone. */
const stampText = (made, now) => (made - now > 3600e3 ? 'Made after the phone’s time. ' : now - made >= 6 * 3600e3 ? 'Stale. ' : '') + `Updated ${when(made, now)}`;
const PPH = (inner) => Math.max(1, Math.min(24, Math.floor((inner - 40) / 24)));
const X = (ms, pph) => { const d = new Date(ms); return 40 + Math.round((d.getHours() + d.getMinutes() / 60) * pph); };
const dayNo = (ms) => { const d = new Date(ms); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
/** The marks the rule draws for a record at `now` and `pph`: punches [row, x] and tails [row, x, w]. */
function marks(record, now, pph) {
  const right = 40 + 24 * pph, P = [], T = [];
  for (const [w, f] of record) {
    const kw = dayNo(now) - dayNo(w);
    if (kw < 0) continue;
    if (kw > 6) {   // written before the seven days: no punch; the tail's part inside them, from the oldest row's left
      const kr = f >= w ? dayNo(now) - dayNo(f) : -1;
      if (kr < 0 || kr > 6) continue;
      for (let k = 6; k > kr; k--) T.push([k, 40, 24 * pph]);
      if (X(f, pph) - 40 >= 1) T.push([kr, 40, X(f, pph) - 40]);
      continue;
    }
    const x = Math.min(X(w, pph), right - 2);
    P.push([kw, x]);
    if (f < w) continue;
    const kr = dayNo(now) - dayNo(f);
    if (kr < 0) continue;
    const xr = X(f, pph);
    if (kr === kw) { if (xr - x >= 1) T.push([kw, x, xr - x]); continue; }
    if (right - x >= 1) T.push([kw, x, right - x]);
    for (let k = kw - 1; k > kr; k--) T.push([k, 40, 24 * pph]);
    if (xr - 40 >= 1) T.push([kr, 40, xr - 40]);
  }
  return { P, T };
}
const KEY = (ms) => ['File written', 'Until it was first read here', `Hours: this phone’s, UTC+${-new Date(ms).getTimezoneOffset() / 60}`];
const CREDIT = 'Data: this repository’s own refresh job; no outside source.';
const FONT_CREDIT = 'Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
const withGen = (iso, extra = {}) => JSON.stringify({ ...snap, generatedAt: iso, ...extra }, null, 2);
const ROWS = snap.runs.map((r) => `${r.label}=${r.value}`).join('|');
/** A week of the owner's loop, for the week picture: a daily Shortcut near 06:10, one day missed, and today's file,
 *  written 05:58 and served through the override, read when the app opens at 06:12. The committed file is not in it:
 *  a Shortcut copies the latest file, so an older file is never first read after newer ones (after review). */
const WEEK_NOW = '2026-10-03T04:12:00Z', WEEK_GEN = '2026-10-03T03:58:00Z';
const WEEK_FILE = withGen(WEEK_GEN, { headline: '03:58 UTC', runs: [{ label: 'Day of year', value: '276' }, { label: 'Week', value: '40' }, { label: 'Minute of day', value: '238' }], ask: [{ measure: 'Day of year', value: 276 }, { measure: 'Week', value: 40 }, { measure: 'Minute of day', value: 238 }] });
const WEEK = (() => {
  const r = [], now = Date.parse(RANOUT);
  for (const k of [6, 5, 3, 2, 1]) {
    const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - k);
    const w = day.getTime() + (5 * 60 + 53 + k) * 60000;
    r.push([w, w + (k % 2 ? 14 : 31) * 60000]);
  }
  return r;
})();

const lum = (c) => { const [r, g, b] = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
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
      let q = line[x];
      if (f === 1) q += a; else if (f === 2) q += b; else if (f === 3) q += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); q += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = q & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) px[(y * w + x) * 4 + k] = k < 3 || bpp === 4 ? line[x * bpp + k] : 255;
    prev = line;
  }
  return { w, h, at: (x, y) => { const i = (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4; return [px[i], px[i + 1], px[i + 2]]; } };
}

/* ── the server: the app folder, with the data file replaceable, refused or cut off ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = {};
const BASE = { '/data/snapshot.json': { body: rawSnap } };   // what is served when nothing overrides it
let reads = 0;
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), ov = override[u] || BASE[u];
  if (u === '/data/snapshot.json') reads++;
  if (ov && ov.cut) { req.socket.destroy(); return; }
  if (ov && ov.status) { res.writeHead(ov.status); res.end(); return; }
  if (ov && ov.body != null) { res.writeHead(200, { 'content-type': TYPES[path.extname(u)] || 'application/octet-stream' }); res.end(ov.body); return; }
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
console.log(`headless Chromium ${browser.version()}: every load time below is a trend on this Mac, not phone evidence`);

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const ready = () => window.__hl && window.__hl.ready();
/** The stamp on one line at 16 px (HOUSE 7.2, plan 0012 F8), whatever it says. */
const stampLine = (A) => A.w(() => { const s = document.getElementById('stamp'), r = s.getBoundingClientRect(); return { h: r.height, text: s.textContent, one: Math.abs(r.height - 16) <= 1 && s.getClientRects().length === 1 }; });
const stampCheck = async (A, label) => { const s = await stampLine(A); check(s.one, `the stamp on one line, ${Math.round(s.h * 10) / 10} px tall (${label}): "${s.text.replace(/\u202f/g, ' ')}"`); };

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference', timezoneId: TZ, locale: o.locale || 'en-US' });
  const page = await ctx.newPage(), errors = [];
  if (o.install) await page.clock.install({ time: new Date(o.time || RANOUT) });
  else await page.clock.setFixedTime(new Date(o.time || RANOUT));
  // counts the animation frames the app asks for, so an idle page can be shown to ask for none
  await page.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__frames = 0; window.requestAnimationFrame = (f) => { window.__frames++; return raf(f); }; });
  if (o.record) await page.addInitScript((r) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('hello-live.card', JSON.stringify(r)); sessionStorage.setItem('seeded', '1'); } } catch { /* blocked */ } }, o.record);
  if (o.blocked) await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); });
  const excused = (s) => o.expect && o.expect.test(s);
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()} (${r.failure() && r.failure().errorText})`); });
  page.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${r.url().slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  if (!o.noWait) { await page.waitForFunction(ready, null, { timeout: 30000 }); await page.waitForTimeout(250); }
  const ms = Date.now() - t0;
  const w = (fn, arg) => page.evaluate(fn, arg);
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const tapAt = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd'); };
  const rect = (sel) => w((s) => document.querySelector(s).getBoundingClientRect().toJSON(), sel);
  const tap = async (sel) => { const r = await rect(sel); await tapAt(r.left + Math.min(20, r.width / 2), r.top + r.height / 2); };
  const png = async () => decodePng(await page.screenshot());
  const shot = async (name, keep = true) => {
    await page.waitForTimeout(200);
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    if (keep && KEEP) { if (`${name}.png` === 'app.png') throw new Error('never screenshots/app.png'); fs.copyFileSync(p, path.join(SHOTS, `${name}.png`)); }
    console.log(`      ${name}.png${keep && KEEP ? ' to screenshots/' : ''}`);
  };
  const back = async () => { await w(() => document.dispatchEvent(new Event('visibilitychange'))); await page.waitForTimeout(400); };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, tap, rect, png, shot, back };
}
const closeOut = async (A, label) => { check(A.errors.length === 0, `${label}: no console error or warning, failed or outside request${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`); await A.ctx.close(); };

/* Text contrast over every rendered text node in view (backgrounds composited), SVG labels by their fill. */
const contrastOf = (w) => w(() => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const q = m ? m[1].split(/[ ,/]+/).map(Number) : [0, 0, 0, 0]; return [q[0], q[1], q[2], q[3] == null ? 1 : q[3]]; };
  const L = (c) => { const [r, g, b] = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const over = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  const ground = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } } let bg = ground; for (const c of stack.reverse()) bg = over(c, bg); return bg; };
  // today's label sits on today's row: the ink at 4 % over the page, as the card draws it
  const today = document.querySelector('#card .today');
  const todayBg = today ? (() => { const ink = rgba(getComputedStyle(today).fill); return over([...ink.slice(0, 3), 0.04], bgOf(document.getElementById('card'))); })() : null;
  let worst = [99, ''], n = 0;
  const faces = new Set();
  const about = document.getElementById('about');   // with About open, only the sheet is in view
  const walker = document.createTreeWalker(about.hidden ? document.body : about, NodeFilter.SHOW_TEXT);
  for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
    const e = tn.parentElement;
    if (!tn.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr') || e.closest('template')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(e);
    faces.add(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim());
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    let c;
    if (e.closest('svg')) {
      const onToday = today && Math.abs(+e.getAttribute('y') - (+today.getAttribute('y') + 10.5)) < 0.01;
      c = ratio(rgba(cs.fill), onToday ? todayBg : bgOf(e.closest('svg')));
    } else { let op = 1; for (let x = e; x; x = x.parentElement) op *= +getComputedStyle(x).opacity; c = ratio(over([...rgba(cs.color).slice(0, 3), rgba(cs.color)[3] * op], bgOf(e)), bgOf(e)); }
    n++;
    if (c < worst[0]) worst = [c, `${e.id || e.getAttribute('class') || e.tagName} "${tn.textContent.trim().slice(0, 24)}"`];
  }
  return { n, worst: [Math.round(worst[0] * 100) / 100, worst[1]], faces: [...faces] };
});
/** Every control at 44 × 44 or more, where it is wholly in view, by hit-testing out from its center. */
const hitTargets = (w) => w(() => {
  const out = { bad: [], seen: [] };
  for (const e of document.querySelectorAll('button, a, input, [role="button"]')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.closest('[inert]') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const on = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !on(cx, cy)) continue;
    const id = `${e.tagName} ${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}`;
    out.seen.push(id);
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 400 && on(cx + (s * k * dx) / 4, cy + (s * k * dy) / 4); k++) n++; return n / 4; };
    if (run(0, 1) < 43.5 || run(1, 0) < 43.5) out.bad.push(`${id} ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  out.n = out.seen.length;
  return out;
});
/** Every visible text node: a hyphen-minus before a digit, a plain space between a number and a unit, a decimal
 *  comma, four or more digits ungrouped, a 12-hour clock or a locale's date form. */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n = 0;
  for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
    const e = tn.parentElement;
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, template')) continue;
    const s = tn.textContent;
    if (!s.trim()) continue;
    n++;
    const ungrouped = s.replace(/\b(19|20)\d\d\b/g, '').replace(/\d{1,2}:\d\d/g, '').match(/(?<![\d. ])\d{4,}/);
    if (/(^|[^\w/])-\d/.test(s) || /\d (h|d|min|px|%)(?![\w/])/.test(s) || /\d%/.test(s) || /\d,\d/.test(s) || /\b(AM|PM)\b|\d+\.\s?(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)|[月日火水木金土]|Sept\b/i.test(s) || /\bjust now\b/.test(s) || ungrouped) bad.push(s.trim().slice(0, 50));
  }
  return { n, bad };
});
/** The card as drawn, read from the SVG itself. */
const drawn = (w) => w(() => {
  const svg = document.getElementById('card'), A = (e, k) => +e.getAttribute(k);
  const c = window.__hl.card(), rows = c.rows;
  const rowOf = (y) => rows.findIndex((r) => y >= r.y && y < r.y + c.row);
  const m = document.getElementById('main'), pb = document.getElementById('pane');
  return {
    row: c.row, gap: Math.round(m.getBoundingClientRect().bottom - pb.getBoundingClientRect().bottom), room: m.clientHeight,
    width: A(svg, 'width'), height: A(svg, 'height'), name: svg.getAttribute('aria-label'), role: svg.getAttribute('role'), controls: svg.querySelectorAll('a, button, [tabindex]').length,
    punches: [...svg.querySelectorAll('.punch')].map((e) => [rowOf(A(e, 'y')), A(e, 'x'), A(e, 'width'), A(e, 'height')]),
    tails: [...svg.querySelectorAll('.tail')].map((e) => [rowOf(A(e, 'y')), A(e, 'x'), A(e, 'width'), A(e, 'height')]),
    days: [...svg.querySelectorAll('text.day')].map((e) => e.textContent), labels: [...svg.querySelectorAll('text.lab')].map((e) => e.textContent),
    now: (() => { const e = svg.querySelector('.now'), h = svg.querySelector('.nowhair'); return [A(e, 'x'), A(e, 'height'), A(e, 'y'), h ? A(h, 'x') : null, h ? A(h, 'y') + A(h, 'height') : null]; })(), nowl: svg.querySelector('.nowl').textContent,
    face: getComputedStyle(svg.querySelector('text')).fontFamily.split(',')[0].replace(/["']/g, '').trim(),
  };
});
const sortM = (a) => a.map((x) => x.join(',')).sort().join(' ');
const dayLabels = (now) => Array.from({ length: 7 }, (_, k) => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - k); return `${DAY[d.getDay()]} ${d.getDate()}`; });
/** The card against the rule written here: the record, the clock, the width. */
async function cardCheck(A, label, record, now, inner) {
  const pph = PPH(inner), want = marks(record, now, pph), g = await drawn(A.w);
  // the rows take the pane's free height, 14 px to 40 (ART section 1): whole pixels, the punch 4 px under the row's
  // top, the notch 9 px and never more than the row less 9 (5 at 14 px), joined to its word by a hairline; the pane's space left below the page (its own 24 px foot is inside the page) is under 7 px,
  // the floor's remainder over seven rows, unless the rows are at their most, or at their least with no room
  const okR = Number.isInteger(g.row) && g.row >= 14 && g.row <= 40 && (g.row === 40 ? g.gap >= 0 : g.row === 14 ? g.gap <= 6 : g.gap >= 0 && g.gap <= 6);
  const okP = okR && sortM(g.punches.map((p) => [p[0], p[1]])) === sortM(want.P) && g.punches.every((p) => p[2] === 2 && p[3] === g.row - 4);
  const okT = sortM(g.tails.map((t) => [t[0], t[1], t[2]])) === sortM(want.T) && g.tails.every((t) => t[3] === 2);
  const okA = g.width === 40 + 24 * pph && g.height === 38 + 7 * g.row && JSON.stringify(g.days) === JSON.stringify(dayLabels(now)) && g.labels.join() === '00:00,06:00,12:00,18:00,24:00' && g.now[0] === Math.min(X(now, pph), 40 + 24 * pph - 1) && g.now[1] === Math.max(5, Math.min(9, g.row - 9)) && g.now[3] === g.now[0] && g.now[4] === g.now[2] && g.nowl === 'now' && g.face === 'Ysabeau Office';
  check(okP && okT && okA, `${label}: ${pph} px an hour on a ${inner} px pane; ${g.punches.length} punch(es) at ${g.punches.map((p) => `row ${p[0]} x ${p[1]}`).join(', ') || 'none'}; ${g.tails.length} tail piece(s)${g.tails.length ? ` (${g.tails.map((t) => `row ${t[0]} ${t[1]}+${t[2]}`).join(', ')})` : ''}; now at x ${g.now[0]}; days ${g.days[0]} to ${g.days[6]}; the axis ${g.labels.join(' ')}; the labels in ${g.face}; rows ${g.row} px, ${g.gap} px of the pane left below the page in a ${g.room} px pane${okP && okT && okA ? '' : ` MISMATCH: want punches ${sortM(want.P)}; tails ${sortM(want.T)}`}`);
  check(g.role === 'img' && g.controls === 0, `${label}: the card is an image with no control on it`);
  return g;
}
/** The one bold thing on rendered pixels: every device pixel inside the card's ink against the same pixel with the
 *  ink hidden; 90 % at 3:1 or more, the lowest printed (an edge pixel next to a hairline). */
async function inkCheck(A, label) {
  const boxes = await A.w(() => [...document.querySelectorAll('#card .punch, #card .tail')].map((r) => r.getBoundingClientRect().toJSON()));
  const a = await A.png();
  await A.w(() => { for (const e of document.querySelectorAll('#card .punch, #card .tail')) e.style.visibility = 'hidden'; });
  const b = await A.png();
  await A.w(() => { for (const e of document.querySelectorAll('#card .punch, #card .tail')) e.style.visibility = ''; });
  const s = [];
  const seen = new Set();
  for (const r of boxes) for (let x = Math.ceil(r.left * 2) + 1; x < Math.floor(r.right * 2) - 1; x++) for (let y = Math.ceil(r.top * 2) + 1; y < Math.floor(r.bottom * 2) - 1; y++) {
    if (seen.has(`${x},${y}`)) continue;
    seen.add(`${x},${y}`);
    s.push(contrast(a.at(x, y), b.at(x, y)));
  }
  const at3 = s.length ? s.filter((v) => v >= 3).length / s.length : 0;
  check(s.length >= 20 && at3 >= 0.9, `${label}: the card's ink, ${s.length} device pixels inside the punches and tails, ${(at3 * 100).toFixed(1)} % at 3:1 or more against what lies under them (ART.md section 2: 14.80 / 14.43 on the page, 13.73 / 13.16 on today's row, 11.47 / 10.36 across a hairline); the lowest ${s.length ? Math.min(...s).toFixed(2) : '-'}`);
}

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  for (const [state, time] of [['run out', RANOUT], ['fresh', FRESH]]) {
    const A = await open(scheme, { time });
    const { page, w } = A, now = Date.parse(time), tag = state === 'run out' ? 'ranout' : 'fresh';
    console.log(`  -- ${state} (${time}); load to the card: ${A.ms} ms (headless)`);
    const b = await w(() => {
      const sc = document.querySelector('.about-body section:nth-of-type(3)'), first = sc && sc.querySelector('h3 + p');
      return { credits: first ? first.textContent : null, firstId: first && first.id, footer: !!document.querySelector('footer, #band, #credits, #capline'), face: document.fonts.check('400 10.5px "Ysabeau Office"'), loaded: [...document.fonts].filter((f) => f.status === 'loaded').length,
        stamp: document.getElementById('stamp').textContent, head: document.getElementById('headline').textContent, lead: document.getElementById('lead').textContent, cap: document.getElementById('caption').textContent,
        rows: [...document.querySelectorAll('#rows dt')].map((d, i) => `${d.textContent}=${document.querySelectorAll('#rows dd')[i].textContent}`).join('|'),
        key: [...document.querySelectorAll('#card-key .k')].map((k) => k.textContent), keyNext: document.getElementById('card').nextElementSibling.id, sw: [...document.querySelectorAll('#card-key .sw')].map((e) => `${e.getBoundingClientRect().width}x${e.getBoundingClientRect().height}`),
        fig: [getComputedStyle(document.getElementById('headline')).fontSize, getComputedStyle(document.getElementById('headline')).fontWeight, getComputedStyle(document.getElementById('lead')).fontSize, Math.round(document.getElementById('lead').getBoundingClientRect().top - document.getElementById('headline').getBoundingClientRect().bottom)],
        dd: getComputedStyle(document.querySelector('#rows dd')).fontSize + '/' + getComputedStyle(document.querySelector('#rows dd')).fontWeight, ground: getComputedStyle(document.body).backgroundColor,
        aboutKey: (() => { const k = document.getElementById('pane').lastElementChild; return k.id === 'about-key' ? k.textContent : null; })(), statement: !!document.getElementById('statement'),
        idle: window.__frames, timer: window.__hl.timer(), record: window.__hl.record(), live: document.querySelectorAll('[aria-live]').length, mainLive: document.getElementById('main').getAttribute('aria-live'),
        h1: document.querySelector('h1').textContent, hint: document.getElementById('stamp').getAttribute('aria-describedby') && document.getElementById(document.getElementById('stamp').getAttribute('aria-describedby')).textContent };
    });
    const camRow = await page.getByRole('heading', { name: 'Hello Live' }).isVisible();
    check(camRow && b.h1 === 'Hello Live', 'the name "Hello Live", the Library row the camera opens (the camera taps nothing inside the app)');
    check(b.credits === CREDIT && b.firstId === 'about-credit-line' && !b.footer, `the credit in About word for word, its first Sources and credits paragraph: "${b.credits}"; no footer on the front (HOUSE 4.15)`);
    check(b.fig[0] === '34px' && b.fig[1] === '650' && b.fig[2] === '13.5px' && b.fig[3] >= 0 && b.dd === '15px/600' && b.ground === (scheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(20, 29, 33)') && b.aboutKey === 'Sources, method and credits are in About.',
      `the register: the headline at ${b.fig[0]}/${b.fig[1]}, its lead under it (${b.fig[3]} px below) at ${b.fig[2]}; the rows' values ${b.dd}; the ground ${b.ground}; the pane ends with "${b.aboutKey}"`);
    await stampCheck(A, `${state}, ${scheme}`);
    check(b.face && b.loaded === 1, `the face is loaded before the card is drawn (${b.loaded} face)`);
    check(b.head === snap.headline && b.lead === `${hm(GEN)} on this phone’s clock` && b.cap === snap.caption && b.rows === ROWS, `the file as the file gives it: "${b.head}", the lead "${b.lead}" (the same instant in Oslo), the caption, the rows ${b.rows}`);
    const wantStamp = stampText(GEN, now);
    check(b.stamp === wantStamp && b.hint === 'Opens About this data.', `the stamp: "${b.stamp}" (built here: "${wantStamp}"; B1, B5), described as "${b.hint}"`);
    check(!b.statement, 'no sentence under the rows: the stamp and About carry staleness (owner call 10, the default reversed after review)');
    check(JSON.stringify(b.key) === JSON.stringify(KEY(now)) && b.keyNext === 'card-key' && b.sw.join() === '3x10,10x2', `the card's key under it, in place of the band's sentence: ${b.key.join(', ')}; the punch ${b.sw[0]} and the tail ${b.sw[1]} drawn small`);
    check(b.record.length === 1 && b.record[0][0] === GEN && b.record[0][1] === now, `the record: one file, written ${hm(GEN)}, first read here at the faked clock ${hm(now)}`);
    check(b.idle === 0 && b.timer && b.live === 1 && b.mainLive === null, `idle: ${b.idle} animation frames asked for; one timeout waits for the next minute; one polite live region and <main> is not one (B10, B15)`);
    const g = await cardCheck(A, `the Time Card, ${state}`, [[GEN, now]], now, 358);
    const nameWant = `Time card, 7 days: 1 file read; the latest written ${spokenAt(GEN)}, first read here ${spokenAt(now)}.`;
    check(g.name === nameWant, `the card's name: "${g.name}"`);
    const c = await contrastOf(w), si = await siOf(w);
    check(c.worst[0] >= 4.5 && c.faces.every((f) => f === 'Ysabeau Office'), `text: ${c.n} nodes and labels in view, the lowest ${c.worst[0]}:1 (${c.worst[1]}); faces ${c.faces.join(', ')}`);
    check(si.bad.length === 0, `SI and the date forms in ${si.n} visible text nodes; no "just now"${si.bad.length ? ': ' + si.bad.slice(0, 5).join(' | ') : ''}`);
    await inkCheck(A, `the one bold thing, ${state}`);
    const hits = await hitTargets(w);
    check(hits.bad.length === 0 && hits.n === 2, `${hits.n} controls on the page (the stamp, the About key), 44 × 44 or more${hits.bad.length ? ': ' + hits.bad.join('; ') : ''}`);
    const side = await w(() => document.documentElement.scrollWidth > innerWidth + 1 || document.getElementById('main').scrollWidth > document.getElementById('main').clientWidth + 1);
    check(!side, 'nothing runs past the page\'s width');
    await A.shot(`card-${tag}-${scheme}`);
    await closeOut(A, `${scheme}, ${state}`);
  }
  // a week of the loop, from storage: the picture the card is for
  {
    override = { '/data/snapshot.json': { body: WEEK_FILE } };
    const now = Date.parse(WEEK_NOW);
    const A = await open(scheme, { record: WEEK, time: WEEK_NOW });
    const rec = await A.w(() => window.__hl.record());
    const record = [...WEEK, [Date.parse(WEEK_GEN), now]];
    check(rec.length === record.length && rec.every((e, i) => e[0] === record[i][0] && e[1] === record[i][1]), `a week from storage: ${WEEK.length} files read back as stored, and today's file (written ${hm(Date.parse(WEEK_GEN))}) added at this launch, ${hm(now)}; no file older than one already read`);
    const g = await cardCheck(A, 'the Time Card, a week', record, now, 358);
    const latest = record.reduce((m, e) => (e[0] > m[0] ? e : m));
    check(g.name === `Time card, 7 days: ${record.length} files read; the latest written ${spokenAt(latest[0])}, first read here ${spokenAt(latest[1])}.`, `the card's name: "${g.name}" (the latest by its writing, not by its place in the record)`);
    await inkCheck(A, 'the one bold thing, a week');
    const c = await contrastOf(A.w);
    check(c.worst[0] >= 4.5, `text with a week drawn: the lowest ${c.worst[0]}:1 (${c.worst[1]})`);
    check(await A.w(() => document.getElementById('stamp').textContent) === `Updated ${hm(Date.parse(WEEK_GEN))}`, 'the week\'s stamp: today\'s file, fresh');
    await A.shot(`card-week-${scheme}`);
    // About, in this theme, for its picture and its contrast
    await A.tap('#stamp');
    await A.page.waitForTimeout(400);
    const ca = await contrastOf(A.w);
    check(ca.worst[0] >= 4.5 && ca.faces.every((f) => f === 'Ysabeau Office'), `About: ${ca.n} text nodes, the lowest ${ca.worst[0]}:1 (${ca.worst[1]})`);
    await A.shot(`about-${scheme}`);
    await closeOut(A, `${scheme}, a week`);
    override = {};
  }
  // the starter pack nine days on (after review): the committed file, older than the card, first read on Sat 10 Oct
  {
    const time = '2026-10-10T08:00:00Z', now = Date.parse(time);
    const A = await open(scheme, { time });
    const g = await cardCheck(A, 'the Time Card, the file nine days old', [[GEN, now]], now, 358);
    check(g.punches.length === 0 && g.tails.length === 7 && g.name === `Time card, 7 days: 1 file read; the latest written ${spokenAt(GEN)}, before these 7 days, first read here ${spokenAt(now)}.`,
      `nine days on: no punch (its writing lies before the card), the tail through all seven rows to now; the name "${g.name}"`);
    await inkCheck(A, 'the one bold thing, nine days on');
    await A.shot(`card-ninedays-${scheme}`, false);
    await closeOut(A, `${scheme}, nine days on`);
  }
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once (light unless named)');
{
  const A = await open('light', { install: true, time: '2026-10-01T07:58:30Z' });
  const { page, w } = A;
  // About: from the stamp by touch, Tab held, the lines, the credits, Escape, focus back
  {
    await A.tap('#stamp');
    await page.waitForTimeout(400);
    const a = await w(() => ({ open: !document.getElementById('about').hidden, inert: ['head', 'main'].every((id) => document.getElementById(id).inert), focus: document.activeElement.id,
      text: document.querySelector('.about-body').textContent.replace(/[ \t\n]+/g, ' '),
      list: [...document.querySelectorAll('#about-list dt')].map((d, i) => `${d.textContent} ${document.querySelectorAll('#about-list dd')[i].textContent}`) }));
    const now = Date.parse('2026-10-01T07:58:30Z');
    const wantList = [`Written: ${fullAt(GEN)}`, `In the file: ${snap.headline}`, `Rows: ${snap.runs.length}`, `Ask table: ${snap.ask.length} rows`, `Files read here: 1 file, since ${new Date(now).getDate()} ${MON[new Date(now).getMonth()]}`, `Stale after: 6${NN}h`, `Card: 7 days, 13${NN}px an hour at this width`];
    check(a.open && a.inert && a.focus === 'about-close' && a.text.includes(FONT_CREDIT) && a.text.includes('scripts/refresh_hello_live.py') && /It is not the job’s log/.test(a.text) && /cannot tell which/.test(a.text) && /at most 400 files/.test(a.text) && /in UTC/.test(a.text) && !/https?:/.test(a.text),
      'About opens from the stamp, focus on Close, the rest inert; the face\'s credit word for word; what the card is not (the job\'s log), what it cannot tell, the record\'s limit, the two clocks (B13)');
    check(JSON.stringify(a.list) === JSON.stringify(wantList), `About's This data: ${a.list.join('; ')}`);
    const hits = await hitTargets(w);
    check(hits.bad.length === 0 && hits.n >= 1, `About: ${hits.n} control(s) in view (${hits.seen?.join?.(', ') || 'Close'}), 44 × 44 or more${hits.bad.length ? ': ' + hits.bad.join('; ') : ''}`);
    const tabs = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); tabs.push(await w(() => document.activeElement.id || document.activeElement.tagName)); }
    check(tabs.every((t) => t === 'about-close' || t === 'about-close-2'), `Tab is held inside About: ${tabs.join(', ')}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp' && !document.getElementById('main').inert), 'About closes on Escape; focus returns to the stamp');
    await A.tap('#stamp');
    await page.waitForTimeout(300);
    const foot = await A.rect('#about-close-2');
    await w(() => document.getElementById('about-close-2').scrollIntoView());
    await A.tap('#about-close-2');
    await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden) && foot.height >= 44, `About closes from its foot's Close (${Math.round(foot.width)} × ${Math.round(foot.height)})`);
  }
  // the minute: 5 h 58 min 34 s old; a minute and a half on the stamp turns stale, now moves
  {
    const before = await w(() => ({ stamp: document.getElementById('stamp').textContent, now: +document.querySelector('#card .now').getAttribute('x'), timer: window.__hl.timer() }));
    await w(() => { document.querySelector('#rows dt').dataset.old = '1'; });
    await page.clock.runFor(95000);
    await page.waitForTimeout(200);
    const mid = await w(() => ({ stamp: document.getElementById('stamp').textContent, kept: !!document.querySelector('#rows dt[data-old]') }));
    await page.clock.runFor(5 * 60000);
    await page.waitForTimeout(200);
    const after = await w(() => ({ now: +document.querySelector('#card .now').getAttribute('x'), frames: window.__frames }));
    const t1 = Date.parse('2026-10-01T07:58:30Z') + 95000 + 5 * 60000;
    check(before.stamp === `Updated ${hm(GEN)}` && before.timer && mid.stamp === `Stale. Updated ${hm(GEN)}` && mid.kept,
      `the minute timer: "${before.stamp}" at 09:58:30, "${mid.stamp}" once the file turns six hours old; the rows not rebuilt (B15)`);
    check(before.now !== after.now && after.now === X(t1, 13) && after.frames === 0, `now moves with the clock: x ${before.now} to ${after.now} (the rule: ${X(t1, 13)}), instantly, no animation frame asked for`);
    // hidden: the timeout cleared, nothing runs; back: read again, the timeout back
    const r0 = reads;
    await w(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hid = await w(() => window.__hl.timer());
    await page.clock.runFor(3 * 60000);
    await w(() => { delete document.hidden; });
    await A.back();
    const back = await w(() => window.__hl.timer());
    check(hid === false && reads === r0 + 1 && back, `hidden: the minute's timeout cleared and the file not read while hidden; back on screen it is read once (${reads - r0}) and the timeout set again`);
  }
  // the same file on a return: nothing rebuilt; a new file: in place, a punch added, said once
  {
    await w(() => { document.getElementById('headline').dataset.old = '1'; document.getElementById('live').textContent = ''; });
    await A.back();
    const same = await w(() => ({ kept: !!document.querySelector('#headline[data-old]') && !!document.querySelector('#rows dt[data-old]'), live: document.getElementById('live').textContent, rec: window.__hl.record().length }));
    check(same.kept && same.live === '' && same.rec === 1, 'the same file on a return: the headline and the rows kept, nothing said, the record unchanged (B11)');
    const nowMs = await w(() => Date.now());
    const later = '2026-10-01T08:04:51Z';
    override = { '/data/snapshot.json': { body: withGen(later, { headline: '08:04 UTC', runs: snap.runs.map((r) => (r.label === 'Minute of day' ? { ...r, value: '484' } : r)) }) } };
    await A.back();
    await page.waitForTimeout(150);
    const n = await w(() => ({ head: document.getElementById('headline').textContent, kept: !!document.querySelector('#headline[data-old]') && !!document.querySelector('#rows dt[data-old]'), rows: [...document.querySelectorAll('#rows dd')].map((d) => d.textContent).join(), stamp: document.getElementById('stamp').textContent, live: document.getElementById('live').textContent, rec: window.__hl.record() }));
    const lw = Date.parse(later);
    check(n.head === '08:04 UTC' && n.kept && n.rows === '274,40,484' && n.stamp === `Updated ${hm(lw)}` && n.live === `New file, written ${hm(lw)}.` && n.rec.length === 2 && n.rec[1][0] === lw && Math.abs(n.rec[1][1] - nowMs) < 5000,
      `a new file while open: "${n.head}" in place (the same nodes), the rows' values updated, "${n.stamp}", said once: "${n.live}"; the record two files`);
    await cardCheck(A, 'the card after the new file', n.rec, await w(() => Date.now()), 358);
    // a broken replacement keeps the view and says so, with Close (B8); then a missing one
    override = { '/data/snapshot.json': { body: '<!doctype html><title>502 Bad Gateway</title>' } };
    await A.back();
    const br = await w(() => ({ notice: document.getElementById('notice').hidden ? '' : document.querySelector('#notice p').textContent, next: [...document.querySelectorAll('#notice p.notice-lines')].map((p) => p.textContent).join(), head: document.getElementById('headline').textContent, punches: document.querySelectorAll('#card .punch').length, rows: document.querySelectorAll('#rows dt').length, stamp: document.getElementById('stamp').textContent, pane: !document.getElementById('pane').hidden }));
    check(br.notice === `A new data/snapshot.json arrived and cannot be used. It is not valid JSON. Still showing the file updated ${hm(lw)}.` && br.next === 'In Snuggery, Options, then App Files shows what the file holds.' && br.head === '08:04 UTC' && br.punches === 2 && br.rows === 3 && br.stamp === `Updated ${hm(lw)}` && br.pane,
      `B8, a broken replacement while open: "${br.notice}", then the next step "${br.next}"; the headline, the card, the rows and the stamp kept (the stock emptied the page)`);
    await A.shot('broken-replacement-light', false);
    const kb = await A.rect('#notice .textkey');
    await A.tapAt(kb.left + kb.width / 2, kb.top + kb.height / 2);
    await page.waitForTimeout(150);
    check(kb.height >= 44 && kb.width >= 44 && await w(() => document.getElementById('notice').hidden), `the notice's Close (${Math.round(kb.width)} × ${Math.round(kb.height)}) puts it away; the file stays`);
    A.errors.length = 0;
    override = { '/data/snapshot.json': { status: 404 } };
    await A.back();
    const mi = await w(() => ({ notice: document.getElementById('notice').hidden ? '' : document.querySelector('#notice p').textContent, punches: document.querySelectorAll('#card .punch').length }));
    check(mi.notice === `data/snapshot.json could not be read (HTTP 404). Nothing new arrived. Still showing the file updated ${hm(lw)}.` && mi.punches === 2, `a missing file on a return: "${mi.notice}"; the view kept`);
    // the browser's own lines for the 404 served here: its status line, and the unread body it aborts (net::ERR_ABORTED)
    await page.waitForTimeout(300);
    A.errors.splice(0, A.errors.length, ...A.errors.filter((e) => !/404|snapshot\.json \(net::ERR_ABORTED\)/.test(e)));
    override = {};
    await A.back();
    check(await w(() => document.getElementById('notice').hidden), 'the file back: the notice goes on the next return');
  }
  await closeOut(A, 'once');
}
// storage blocked: the record is this page's life, one punch, no console error
{
  const A = await open('light', { blocked: true });
  const s = await A.w(() => ({ storage: window.__hl.storage(), punches: document.querySelectorAll('#card .punch').length, rec: window.__hl.record().length }));
  await A.tap('#stamp');
  await A.page.waitForTimeout(300);
  const line = await A.w(() => [...document.querySelectorAll('#about-list dt')].map((d, i) => `${d.textContent} ${document.querySelectorAll('#about-list dd')[i].textContent}`).find((t) => t.startsWith('Files read here')));
  check(!s.storage && s.punches === 1 && s.rec === 1 && line === 'Files read here: 1 file, since 3 Oct; storage is unavailable, so the record is this page’s', `storage blocked: the current file's one punch; About: "${line}"`);
  await closeOut(A, 'storage blocked');
}
// the bugs on record at their fixtures
for (const [label, body, time, want] of [
  ['B6, a file an hour and a half ahead', withGen('2026-10-03T11:30:00Z', { headline: '11:30 UTC' }), RANOUT, { stamp: 'Made after the phone’s time. Updated 13:30', punches: 1, tails: 0, before: true }],
  ['B7, an unreadable generatedAt', withGen('yesterday-ish', { headline: 'sometime' }), RANOUT, { stamp: 'Undated file.', punches: 0, tails: 0, lead: true }],
  ['a file exactly 6 h old', withGen('2026-10-03T04:00:00Z'), RANOUT, { stamp: 'Stale. Updated 06:00', punches: 1, tails: 1 }],
  ['a file 5 h 59 min old', withGen('2026-10-03T04:01:00Z'), RANOUT, { stamp: 'Updated 06:01', punches: 1, tails: 1 }],
]) {
  override = { '/data/snapshot.json': { body } };
  const A = await open('light', { time });
  const s = await A.w(() => ({ stamp: document.getElementById('stamp').textContent, punches: document.querySelectorAll('#card .punch').length, tails: document.querySelectorAll('#card .tail').length, lead: document.getElementById('lead').hidden, name: document.getElementById('card').getAttribute('aria-label'), head: document.getElementById('headline').textContent }));
  let extra = '';
  if (want.before || want.lead) {
    await A.tap('#stamp');
    await A.page.waitForTimeout(300);
    extra = await A.w(() => [...document.querySelectorAll('#about-list dt')].map((d, i) => `${d.textContent} ${document.querySelectorAll('#about-list dd')[i].textContent}`).filter((t) => /^(Written|Read before)/.test(t)).join('; '));
  }
  const okExtra = want.before ? extra.includes('Read before written: 1 file (a clock behind the server’s), drawn without a tail') : want.lead ? extra === 'Written: not readable in the file' && s.lead && s.name === 'Time card, 7 days: no file read.' && s.head === 'sometime' : true;
  await stampCheck(A, label);
  check(s.stamp === want.stamp && s.punches === want.punches && s.tails === want.tails && okExtra, `${label}: "${s.stamp}", ${s.punches} punch(es), ${s.tails} tail(s)${extra ? `; About: ${extra}` : ''}`);
  await closeOut(A, label);
  override = {};
}
// four locales: the same words letter for letter (dates by hand, never Intl)
{
  const words = [];
  for (const locale of ['en-US', 'en-GB', 'nb-NO', 'ja-JP']) {
    const A = await open('light', { locale });
    words.push([locale, await A.w(() => [document.getElementById('head').innerText, document.getElementById('pane').innerText, document.getElementById('card').getAttribute('aria-label')].join('\n'))]);
    await closeOut(A, `locale ${locale}`);
  }
  check(words.every(([, x]) => x === words[0][1]), `the same words, letter for letter, under ${words.map(([l]) => l).join(', ')} (${words[0][1].length} characters)`);
}
// Reduce Motion: About at 0 s, nothing else moves
{
  const A = await open('light', { reduced: true });
  await A.tap('#stamp');
  await A.page.waitForTimeout(100);
  const d = await A.w(() => [getComputedStyle(document.querySelector('.about-sheet')).animationDuration, window.__frames]);
  check(d[0] === '0s' && d[1] === 0, `Reduce Motion: About at ${d[0]}; ${d[1]} animation frames asked for`);
  await closeOut(A, 'reduce motion');
}
// broken data at the start: a sentence on a plate, never a blank page; then the file mended
for (const [label, ov, want, expect] of [
  ['missing', { status: 404 }, ['data/snapshot.json could not be read (HTTP 404).', 'In Snuggery, Options, then App Files shows what the file holds.'], /HTTP 404|404 \(Not Found\)|Failed to load resource|requestfailed .*\/data\/snapshot\.json/],
  ['a web page', { body: '<!doctype html><html><body>Bad Gateway</body></html>' }, ['data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a Shortcut does without noticing when a web address answers with one.', 'In Snuggery, Options, then App Files shows what the file holds.']],
  ['the wrong shape', { body: '{"error": "rate limited"}' }, ['data/snapshot.json parsed, but has no headline or no generatedAt. An error reply is valid JSON too.', 'In Snuggery, Options, then App Files shows what the file holds.']],
  ['an array', { body: '[1, 2]' }, ['data/snapshot.json parsed, but has no headline or no generatedAt. An error reply is valid JSON too.', 'In Snuggery, Options, then App Files shows what the file holds.']],
  ['the read refused (a page opened from a folder)', { cut: true }, null, /Failed to load resource|ERR_EMPTY_RESPONSE|requestfailed .*\/data\/snapshot\.json/],
]) {
  override = { '/data/snapshot.json': ov };
  const A = await open('light', { noWait: true, expect });
  await A.page.waitForSelector('#notice:not([hidden])', { timeout: 15000 });
  const s = await A.w(() => ({ lines: [...document.querySelectorAll('#notice p')].map((p) => p.textContent), role: document.getElementById('notice').getAttribute('role'), stamp: document.getElementById('stamp').textContent, pane: document.getElementById('pane').hidden, code: document.querySelectorAll('#notice code').length, tick: document.getElementById('notice').textContent.includes('`'), amp: document.getElementById('notice').textContent.includes('&lt;'), face: getComputedStyle(document.querySelector('#notice p')).fontFamily.split(',')[0] }));
  const okLines = want ? JSON.stringify(s.lines) === JSON.stringify(want) : s.lines.length === 3 && /^data\/snapshot\.json could not be read \(.+\)\.$/.test(s.lines[0]) && s.lines[1] === 'Opened from a file, a browser blocks the read: serve the folder with a local web server.' && s.lines[2] === 'In Snuggery, Options, then App Files shows what the file holds.';
  check(okLines && s.role === 'alert' && s.stamp === 'No usable file.' && s.pane && !s.code && !s.tick && !s.amp && /Ysabeau Office/.test(s.face), `B14, broken data, ${label}: "${s.lines.join(' / ')}" on a plate (role alert), no code face, no backtick, the stamp "No usable file."`);
  if (label === 'a web page') { await A.shot('broken-light', false); await stampCheck(A, 'no usable file'); }
  if (label === 'missing') {
    override = {};
    await A.back();
    await A.page.waitForFunction(() => window.__hl.ready(), null, { timeout: 10000 });
    check(await A.w(() => document.getElementById('notice').hidden && document.getElementById('headline').textContent === '01:59 UTC'), 'the file mended while the app is open: a return reads it, the plate goes and the file comes');
  }
  await closeOut(A, `broken data, ${label}`);
}
override = {};
// the widths: no sideways scroll, the caption inside its lines, the card at its whole px per hour
for (const [label, wv, hv, inner] of [['320 × 568', 320, 568, 288], ['360 × 740', 360, 740, 328], ['375 × 667', 375, 667, 343], ['390 × 844', 390, 844, 358], ['125 % text (312 × 675)', 312, 675, 280], ['on its side (844 × 390)', 844, 390, 728], ['a tablet (820 × 1180)', 820, 1180, 728], ['wide (1024 × 768)', 1024, 768, 728]]) {
  const A = await open('light', { w: wv, h: hv });
  const r = await A.w(() => {
    const m = document.getElementById('main'), key = document.getElementById('card-key'), p = document.getElementById('pane'), ps = getComputedStyle(p);
    return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, keyH: key.getBoundingClientRect().height, head: document.getElementById('head').getBoundingClientRect().height,
      inner: Math.floor(p.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight)), pph: window.__hl.card().pph, row: window.__hl.card().row, gap: Math.round(m.getBoundingClientRect().bottom - p.getBoundingClientRect().bottom), cardRight: document.getElementById('card').getBoundingClientRect().right, paneRight: p.getBoundingClientRect().right - parseFloat(ps.paddingRight),
      left: [document.querySelector('#pane .fig').getBoundingClientRect().left, document.querySelector('h1').getBoundingClientRect().left, key.getBoundingClientRect().left].map(Math.round) };
  });
  const pph = Math.min(PPH(inner), 24);
  // on its side there is no free height, so the rows stay at their least; upright they fill it, or reach 40 px
  const land = hv < 500 ? r.head <= 47 && r.row === 14 : r.row === 40 || r.gap >= 0 && r.gap <= 6;
  const hits = await hitTargets(A.w);
  const wantLeft = Math.round(Math.max(16, wv / 2 - 364));
  check(!r.side && r.keyH <= (wv >= 640 ? 15.5 : 32.5) && r.inner === inner && r.pph === pph && r.cardRight <= r.paneRight + 0.5 && r.left[0] === r.left[1] && r.left[1] === r.left[2] && r.left[0] === wantLeft && land && hits.bad.length === 0,
    `${label}: no sideways scroll, the card's key on ${r.keyH <= 15.5 ? 'one line' : 'two lines'} (${Math.round(r.keyH)} px), the card at ${r.pph} px an hour on a ${r.inner} px pane inside the pane, the rows ${r.row} px (${r.gap} px of the pane left below the page), the left edges together at x ${r.left.join(', ')} (max(16, 50 % − 364) = ${wantLeft}: the header centered with the pane)${hv < 500 ? `, the header ${Math.round(r.head)} px` : ''}, ${hits.n} control(s) at 44 px or more${hits.bad.length ? ': ' + hits.bad.join('; ') : ''}`);
  if (wv === 320) await A.shot('card-320-light', false);
  if (wv > hv && wv < 1000 && hv < 500) await A.shot('card-landscape-light', false);
  if (wv === 1024) await A.shot('card-wide-light', false);
  await stampCheck(A, label);
  await closeOut(A, label);
}
// B16: a long unbroken headline at 320 px never widens the page
{
  override = { '/data/snapshot.json': { body: withGen(snap.generatedAt, { headline: 'X'.repeat(40), caption: 'Y'.repeat(70) }) } };
  const A = await open('light', { w: 320, h: 568 });
  const r = await A.w(() => ({ side: document.documentElement.scrollWidth > innerWidth + 1 || document.getElementById('main').scrollWidth > document.getElementById('main').clientWidth + 1, right: document.getElementById('headline').getBoundingClientRect().right }));
  check(!r.side && r.right <= 320 - 16 + 0.5, `B16, a 40-character unbroken headline and a 70-character caption at 320 px: no sideways scroll, the headline ends at x ${Math.round(r.right)}`);
  await A.shot('long-headline-320-light', false);
  await closeOut(A, 'B16');
  override = {};
}
// a row value of four digits or more, whatever the day the shipped file was made: "1000" and "16380" print grouped with
// U+202F, a three-digit value and a leading-zero code as written, and the file is not changed (HOUSE 6.1; the lead's
// ruling, 2026-10-08)
{
  const runs = [{ label: 'Day of year', value: '279' }, { label: 'Week', value: '41' }, { label: 'Minute of day', value: '1000' }, { label: 'Count', value: '16380' }, { label: 'Code', value: '0420' }];
  override = { '/data/snapshot.json': { body: withGen(snap.generatedAt, { runs }) } };
  for (const wv of [390, 320]) {
    const A = await open('light', { w: wv, h: 844 });
    const r = await A.w(() => ({ vals: [...document.querySelectorAll('#rows dd')].map((d) => d.textContent), side: document.documentElement.scrollWidth > innerWidth + 1 }));
    const want = ['279', '41', `1${NN}000`, `16${NN}380`, '0420'];
    check(JSON.stringify(r.vals) === JSON.stringify(want) && JSON.stringify(want) === JSON.stringify(runs.map((x) => grouped(x.value))) && !r.side,
      `the rows at ${wv} px: ${runs.map((x, i) => `"${x.value}" as "${(r.vals[i] || '').replace(/\u202f/g, ' ')}"`).join(', ')} (four digits and up grouped with U+202F; a leading zero is a code), no sideways scroll`);
    await closeOut(A, `four-digit rows, ${wv} px`);
  }
  override = {};
}
// the shipped data/snapshot.json as the refresh job last wrote it, at its own clock (31 minutes after it was made)
{
  const live = JSON.parse(liveSnap), at = new Date(Date.parse(live.generatedAt) + 31 * 60000).toISOString();
  override = { '/data/snapshot.json': { body: liveSnap } };
  for (const scheme of schemes) {
    const A = await open(scheme, { time: at });
    const s = await A.w(() => ({ head: document.getElementById('headline').textContent, notice: document.getElementById('notice').hidden, punches: document.querySelectorAll('#card .punch').length, rows: document.querySelectorAll('#rows dt').length, stamp: document.getElementById('stamp').textContent }));
    const c = await contrastOf(A.w), si = await siOf(A.w);
    // a row value of four digits or more ("Minute of day" is 1000 to 1439 from 16:40 UTC each day) prints grouped with
    // U+202F (HOUSE 6.1; the lead's ruling, 2026-10-08), the data as the file writes it
    const rowVals = await A.w(() => [...document.querySelectorAll('#rows dd')].map((d) => d.textContent));
    const wantVals = live.runs.map((r) => grouped(String(r.value)));
    check(JSON.stringify(rowVals) === JSON.stringify(wantVals),
      `the shipped file, ${scheme}: the rows print ${live.runs.map((r, i) => `${r.label} "${r.value}" as "${(rowVals[i] || '').replace(/\u202f/g, ' ')}"`).join(', ')} (a plain count of four digits or more grouped with U+202F)`);
    check(s.head === live.headline && s.notice && s.punches === 1 && s.rows === live.runs.length && c.worst[0] >= 4.5 && si.bad.length === 0,
      `the shipped data/snapshot.json (made ${live.generatedAt}) at ${at.slice(0, 16)}Z, ${scheme}: "${s.head}", one punch, ${s.rows} rows, no notice, the stamp "${s.stamp}"; text contrast ${c.worst[0]}:1 at the lowest; SI clean${si.bad.length ? ': ' + si.bad.join(' | ') : ''}`);
    await stampCheck(A, `the shipped file, ${scheme}`);
    await A.shot(`live-${scheme}`, false);
    await closeOut(A, `the shipped file, ${scheme}`);
  }
  override = {};
}
const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png, the README's composite, untouched (${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent, as before the run'})`);
await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
