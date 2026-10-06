// Drive Power Hours in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through CDP), light
// and dark (HOUSE.md section 7.2 as a pane app allows: no player, no focus mode, no units key; tools/DECISIONS.md,
// item 11). The clock is fixed at Thu 1 Oct 2026, 08:20 UTC (10:20 in Oslo, inside the file) in Oslo's zone, so
// the stamp and the pictures are the same on every run; other clocks (the file run out on 3 Oct, what a fresh
// install and the marketing camera see; a two-day file at night and the next morning) are named where they are
// used. Fails on any console error or warning, page error, failed request, HTTP ≥ 400, or any request outside the
// local server. Every figure it asserts is worked out here from the data files with Node's own tools, never by
// importing js/.
//
// FRAME AND LOAD TIMES ARE HEADLESS CHROMIUM ON THIS MAC: a trend only, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCRUB=0 node tools/shoot.mjs            leave out the three-speed scrub
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the pictures to screenshots/*-{light,dark}.png
//
// Per theme: boot (c/kWh, the camera's wait, written only once the snapshot parses; the credits; the face; the
// stamp), text contrast, SI and the date forms in every visible text node, hit targets, the caption band; the
// Landing (the staircase, the level, the mean and the axis against this file's decode; the level's ink against
// what lies under it and the staircase's blue against the page, on rendered pixels), the slider's value and
// description, Now, the readout and the runs against the decode, a tap, a pinch, the keys, the scrub by real touch
// at 2, 8 and 20 intervals a second; the file run out (the camera's state). Once: the first Tab, the runs pressed,
// About, hidden and back (the same files, new prices, a broken replacement, new appliances), the clock crossing a
// quarter, the vertical swipe the camera makes, the pane's scroll at the camera's size (owner call 9) and the camera's
// second pane (Car charging's landing apart from the dishwasher's at 440 × 956, run out), a 404 on a return, the bugs
// on record at their clocks and fixtures (B1 to B5, B13, B14), the review's fixture (the mean's label off the
// staircase, a day's name kept beside a run's times), lastGood, private use, the appliance file's cases, four
// locales, Reduce Motion, hidden, broken data at the start and its recovery, the widths and a phone on its side.
// After the review every in-plot label is checked against the staircase as drawn, in every state that draws one.
// Pictures: tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png; never screenshots/app.png,
// the README's composite, whose hash is checked unchanged.

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
const SCRUB = process.env.SCRUB !== '0';
const schemes = (process.env.SCHEMES || 'light,dark').split(',').filter((s) => s === 'light' || s === 'dark');
const appPng = path.join(SHOTS, 'app.png');
const hashOf = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);
const appPngHash = hashOf(appPng);
const NOW = '2026-10-01T08:20:00Z', TZ = 'Europe/Oslo';   // 10:20 in Oslo, inside the file
const RANOUT = '2026-10-03T10:00:00Z';                     // what a fresh install and the marketing camera see

/* ── the data, decoded here (app.js's header comment is the contract) ── */
const rawSnap = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
const rawApps = fs.readFileSync(path.join(APP, 'data/appliances.json'), 'utf8');
const snap = JSON.parse(rawSnap), APPS = JSON.parse(rawApps).appliances;
const NN = ' ', MI = '−', EN = '–';
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n) => String(n).padStart(2, '0');
const pts = snap.hours.map((h) => ({ at: Date.parse(h.start), wall: h.start.slice(11, 16), date: h.start.slice(0, 10), v: h.price / 10 })).sort((a, b) => a.at - b.at);
const N = pts.length, STEP = 15 * 60000;
const endWall = (i) => (i + 1 < N ? pts[i + 1].wall : '24:00');
const f2 = (v) => `${v < 0 && Math.abs(v) >= 0.005 ? MI : ''}${Math.abs(v).toFixed(2)}`;
const ord = (k) => { const v = k % 100, t = ['th', 'st', 'nd', 'rd']; return `${k}${t[(v - 20) % 10] || t[v] || t[0]}`; };
const firstAt = (ms) => { const i = pts.findIndex((p) => p.at + STEP > ms); return i; };
const meanOf = (a) => a.reduce((s, p) => s + p.v, 0) / a.length;
/** The cheapest unbroken run of `hours` from interval `from` on, the earliest on a tie. */
function cheapest(from, hours) {
  const need = Math.ceil((hours * 60) / 15);
  let best = null;
  for (let a = from; a + need <= N; a++) { const m = meanOf(pts.slice(a, a + need)); if (!best || m < best.mean - 1e-12) best = { from: a, to: a + need - 1, mean: m }; }
  return best;
}
const rankOf = (i, set) => 1 + set.filter((j) => pts[j].v < pts[i].v).length;
const CUR = firstAt(Date.parse(NOW)), AHEAD = pts.slice(CUR), MEAN = meanOf(AHEAD);
const RUN = cheapest(CUR, 2);
const range = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);
// the scale, written here: the smallest 1, 2 or 5 × 10^k labeling the file's range in at most six ticks
const LO = Math.min(...pts.map((p) => p.v)), HI = Math.max(...pts.map((p) => p.v));
const SCALE = (() => { for (const s of [0.1, 0.2, 0.5, 1, 2, 5, 10]) { const lo = Math.floor(LO / s) * s, hi = Math.ceil(HI / s) * s; if (Math.round((hi - lo) / s) + 1 <= 6) return { lo, hi, s }; } return null; })();
const yOf = (v) => 16 + (120 * (SCALE.hi - v)) / (SCALE.hi - SCALE.lo);
const CREDIT = `${snap.source.attribution}. ${snap.source.licenceInfo}.`;
const CAPTION = `c/kWh, spot price per 15${NN}min, before grid rent, tax and VAT. Ink: the chosen run at its mean price.`;
const GEN = Date.parse(snap.generatedAt), osloClock = (ms) => { const d = new Date(ms + 2 * 3600e3); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
const runText = (r, today = true) => `${today ? '' : 'Thu '}${pts[r.from].wall}${EN}${endWall(r.to)}`;
const pctBelow = (m, mean) => Math.round(((mean - m) / mean) * 100);

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

/* ── the server: the app folder, with either data file replaceable or held back ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = {};
const reads = { '/data/snapshot.json': 0, '/data/appliances.json': 0 };
const server = http.createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), ov = override[u];
  if (u in reads) reads[u]++;
  if (ov && ov.hold) await ov.hold;
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
console.log(`headless Chromium ${browser.version()}: every load and frame time below is a trend on this Mac, not phone evidence`);

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const ready = () => window.__ph && window.__ph.ready();

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference', timezoneId: TZ, locale: o.locale || 'en-US' });
  const page = await ctx.newPage(), errors = [];
  if (o.install) await page.clock.install({ time: new Date(o.time || NOW) });
  else await page.clock.setFixedTime(new Date(o.time || NOW));
  // counts the animation frames the app asks for, so an idle page can be shown to ask for none
  await page.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__frames = 0; window.requestAnimationFrame = (f) => { window.__frames++; return raf(f); }; });
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
  const frame = () => w(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const shot = async (name, keep = true) => {
    await page.waitForTimeout(250);
    const p = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: p });
    if (keep && KEEP) { if (`${name}.png` === 'app.png') throw new Error('never screenshots/app.png'); fs.copyFileSync(p, path.join(SHOTS, `${name}.png`)); }
    console.log(`      ${name}.png${keep && KEEP ? ' to screenshots/' : ''}`);
  };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, rect, png, frame, shot };
}
const closeOut = async (A, label) => { check(A.errors.length === 0, `${label}: no console error or warning, failed or outside request${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`); await A.ctx.close(); };

/* Text contrast over every rendered DOM text node in view (backgrounds composited), and every SVG label's fill. */
const contrastOf = (w) => w(() => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const q = m ? m[1].split(/[ ,/]+/).map(Number) : [0, 0, 0, 0]; return [q[0], q[1], q[2], q[3] == null ? 1 : q[3]]; };
  const L = (c) => { const [r, g, b] = c.slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const over = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  const ground = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } } let bg = ground; for (const c of stack.reverse()) bg = over(c, bg); return bg; };
  let worst = [99, ''], n = 0;
  const faces = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let tn = walker.nextNode(); tn; tn = walker.nextNode()) {
    const e = tn.parentElement;
    if (!tn.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr') || e.closest('template')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(e);
    faces.add(cs.fontFamily.split(',')[0].replace(/["']/g, '').trim());
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    let c;
    if (e.closest('svg')) c = ratio(rgba(cs.fill), bgOf(e.closest('svg')));
    else { let op = 1; for (let x = e; x; x = x.parentElement) op *= +getComputedStyle(x).opacity; c = ratio(over([...rgba(cs.color).slice(0, 3), rgba(cs.color)[3] * op], bgOf(e)), bgOf(e)); }
    n++;
    if (c < worst[0]) worst = [c, `${e.id || e.getAttribute('class') || e.tagName} "${tn.textContent.trim().slice(0, 24)}"`];
  }
  return { n, worst: [Math.round(worst[0] * 100) / 100, worst[1]], faces: [...faces] };
});
/** Every control at 44 × 44 or more, measured where it is wholly in view; the pane scrolled through. */
const hitTargets = async (A) => {
  const bad = new Set(), seen = new Set();
  const Hgt = await A.w(() => document.getElementById('main').scrollHeight);
  for (let y = 0; y < Hgt; y += 300) {
    const r = await A.w((top) => {
      document.getElementById('main').scrollTop = top;
      const out = { bad: [], seen: [] };
      for (const e of document.querySelectorAll('button, [role="slider"], a, input')) {
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || e.closest('[hidden]') || e.closest('[inert]') || e.disabled) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const on = (x, yy) => { const h = document.elementFromPoint(x, yy); return h && (h === e || e.contains(h)); };
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !on(cx, cy)) continue;
        const m = document.getElementById('main').getBoundingClientRect();
        if (document.getElementById('main').contains(e) && (r.top < m.top - 1 || r.bottom > m.bottom + 1)) continue;
        const id = `${e.tagName} ${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}`;
        out.seen.push(id);
        const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 400 && on(cx + (s * k * dx) / 4, cy + (s * k * dy) / 4); k++) n++; return n / 4; };
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
 *  unit, a decimal comma, four or more digits ungrouped, a 12-hour clock or a locale's date form (B6, B15). */
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
    if (/(^|[^\w/])-\d/.test(s) || /\d (h|d|min|%|c\/kWh)(?![\w/])/.test(s) || /\d%|\d(c\/kWh)/.test(s) || /\d,\d/.test(s) || /\b(AM|PM)\b|\d+\.\s?(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)|[月日火水木金土]|Sept\b/i.test(s) || /\bToday\b|\bTomorrow\b/.test(s) || ungrouped) bad.push(s.trim().slice(0, 50));
  }
  return { n, bad };
});
const stateOf = (w) => w(() => {
  const st = document.getElementById('stair'), head = st.querySelector('.head circle:last-child'), L = window.__ph.staircase(), i = window.__ph.chosen();
  return { chosen: i, now: +st.getAttribute('aria-valuenow'), text: st.getAttribute('aria-valuetext'), head: +head.getAttribute('cx'), center: (L.xs[i] + L.xs[i + 1]) / 2,
    col: [+st.querySelector('.col').getAttribute('x'), +st.querySelector('.col').getAttribute('width')], xs: [L.xs[i], L.xs[i + 1] - L.xs[i]],
    when: document.querySelector('.ro-when').textContent, vals: document.querySelector('.ro-vals').textContent, live: document.getElementById('live').textContent };
});
/** A client point inside interval i's column, on the plot. */
/* Every in-plot label (the mean's, the appliance's) against the staircase as drawn: the box by the layout's own rule
   (x, y, anchor, the rendered length; 8 px up, 2 down), the treads and risers parsed from the two paths' d; a label in
   the row above the plot (y under 16) is clear by construction. `hit` is a label the staircase runs through. */
const labelsClear = (w) => w(() => {
  const segs = [];
  for (const p of document.querySelectorAll('#stair .st')) {
    let x = 0, y = 0;
    for (const m of p.getAttribute('d').matchAll(/([MVH])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
      if (m[1] === 'M') { x = +m[2]; y = +m[3]; } else if (m[1] === 'V') { const y2 = +m[2]; segs.push({ a: x, b: x, lo: Math.min(y, y2), hi: Math.max(y, y2) }); y = y2; } else { const x2 = +m[2]; segs.push({ a: Math.min(x, x2), b: Math.max(x, x2), lo: y, hi: y }); x = x2; }
    }
  }
  return [...document.querySelectorAll('#stair text.halo')].map((t) => {
    const x = +t.getAttribute('x'), y = +t.getAttribute('y'), wd = t.getComputedTextLength(), an = t.getAttribute('text-anchor');
    const a = an === 'end' ? x - wd : an === 'middle' ? x - wd / 2 : x, b = a + wd, top = y - 8, bot = y + 2, row = y < 16;
    return { text: t.textContent, row, hit: !row && segs.some((s) => s.b > a - 1 && s.a < b + 1 && s.lo < bot + 1 && s.hi > top - 1), a: Math.round(a), b: Math.round(b) };
  });
});
const clearCheck = async (w, label) => { const lc = await labelsClear(w); check(lc.length >= 1 && lc.every((l) => !l.hit), `${label}: the in-plot labels clear of the staircase as drawn: ${lc.map((l) => `"${l.text}" at x ${l.a} to ${l.b}${l.row ? ' (in the row above the plot)' : ''}${l.hit ? ' RUN THROUGH' : ''}`).join(', ')}`); };
const pointOf = async (A, i) => { const s = await A.rect('#stair svg'), L = await A.w(() => window.__ph.staircase()); return { x: s.left + (L.xs[i] + L.xs[i + 1]) / 2, y: s.top + 16 + 100, s, L }; };
const whenOf = (i, now) => `Thu 1 Oct, ${pts[i].wall}${EN}${endWall(i)}${i === now ? ', now' : ''}`;
const valsOf = (i, first, run, name) => {
  const set = range(first, N), r = rankOf(i, set);
  const rank = i < first ? 'already past' : `${r === 1 ? 'lowest' : `${ord(r)} lowest`} of the ${set.length} quarter hours ahead`;
  return `${f2(pts[i].v)}${NN}c/kWh, ${rank}${run && i >= run.from && i <= run.to ? `, inside the run for ${name}` : ''}`;
};

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the drawing: ${A.ms} ms (headless)`);
  const PAGE = scheme === 'light' ? [0xe8, 0xee, 0xf0] : [0x14, 0x1d, 0x21];

  // boot: the camera's wait, the credits, the face, the stamp
  {
    const b = await w(() => {
      const c = document.getElementById('credits'), r = c.getBoundingClientRect();
      return { credits: c.textContent, whole: r.height > 0 && r.bottom <= innerHeight + 1, face: document.fonts.check('400 10.5px "Ysabeau Office"'), loaded: [...document.fonts].filter((f) => f.status === 'loaded').length,
        stamp: document.getElementById('stamp').textContent, idle: window.__frames, priv: document.getElementById('private').hidden, timer: window.__ph.timer() };
    });
    const cam = await page.getByText('c/kWh').first().isVisible();
    check(cam, 'the camera\'s wait: visible text containing "c/kWh"');
    check(b.credits === CREDIT && b.whole && b.priv, `the credits on screen word for word from the snapshot: "${b.credits}"; no private-use line (NO2 is CC BY)`);
    check(b.face && b.loaded === 1, `the face is loaded before the drawing measures its labels (${b.loaded} face)`);
    check(b.stamp === `Updated ${osloClock(GEN)}`, `the stamp: "${b.stamp}" (built here: "Updated ${osloClock(GEN)}", the phone's clock in Oslo; no "Stale": day-ahead prices are final, B4)`);
    check(b.idle === 0 && b.timer, `idle: the page asked for ${b.idle} animation frames after loading; one timeout waits for the next quarter's boundary`);
  }

  // text contrast, the face, SI and dates, hit targets, the band: the pane at its top and scrolled to its foot
  for (const where of ['top', 'foot']) {
    if (where === 'foot') await w(() => { const m = document.getElementById('main'); m.scrollTop = m.scrollHeight; });
    const c = await contrastOf(w), si = await siOf(w);
    check(c.worst[0] >= 4.5 && c.faces.every((f) => f === 'Ysabeau Office'), `the pane at its ${where}: ${c.n} text nodes and labels in view, the lowest ${c.worst[0]}:1 (${c.worst[1]}); faces ${c.faces.join(', ')}`);
    check(si.bad.length === 0, `the pane at its ${where}: SI and the date forms in ${si.n} visible text nodes, no "Today" or "Tomorrow" (B1, B6, B15)${si.bad.length ? ': ' + si.bad.slice(0, 5).join(' | ') : ''}`);
  }
  await w(() => { document.getElementById('main').scrollTop = 0; });
  {
    const hits = await hitTargets(A);
    check(hits.bad.length === 0 && hits.n >= 6, `${hits.n} controls (the stamp, the slider, the four runs), every one 44 × 44 or more (B7: the stock's hours were 13 px)${hits.bad.length ? ': ' + hits.bad.slice(0, 5).join('; ') : ''}`);
    const g = await w(() => { const m = document.getElementById('main'); return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, cap: document.getElementById('capline').textContent, live: document.querySelectorAll('[aria-live]').length, mainLive: document.getElementById('main').getAttribute('aria-live') }; });
    check(!g.side && g.cap === CAPTION, `the caption "${g.cap.replace(NN, ' ')}"; nothing runs past the pane's width`);
    check(g.live === 1 && g.mainLive === null, `one polite live region, and <main> is not one (B8)`);
    await A.shot(`landing-${scheme}`);
  }

  // the Landing: the staircase, the level, the mean, now and the axis against this file's decode
  {
    const L = await w(() => window.__ph.staircase());
    const dom = await w(() => {
      const q = (s) => document.querySelector(`#stair ${s}`), num = (e, a) => +e.getAttribute(a);
      const lvl = q('.lvl'), posts = [...document.querySelectorAll('#stair .post')], mean = q('.mean');
      const H = (d) => (d.match(/H/g) || []).length;
      return { lvl: [num(lvl, 'x'), num(lvl, 'width'), num(lvl, 'y')], posts: posts.map((p) => [num(p, 'x'), num(p, 'y') + num(p, 'height')]), mean: [num(mean, 'x1'), num(mean, 'x2'), num(mean, 'y1')],
        dash: getComputedStyle(mean).strokeDasharray, past: H(q('.st.past').getAttribute('d')), ahead: H(document.querySelector('#stair .st:not(.past)').getAttribute('d')),
        pastOp: getComputedStyle(q('.st.past')).opacity, ticks: [...document.querySelectorAll('#stair .tl')].map((t) => t.textContent), axis: [...document.querySelectorAll('#stair text.lab:not(.nowl)')].map((t) => t.textContent),
        nowl: [...document.querySelectorAll('#stair .nowl')].map((t) => [t.textContent, +t.getAttribute('x')]), inPlot: [...document.querySelectorAll('#stair .halo')].map((t) => t.textContent),
        bold: [...document.querySelectorAll('#stair *')].filter((e) => getComputedStyle(e).fill === getComputedStyle(document.querySelector('h1')).color && getComputedStyle(e).fillOpacity === '1' && e.getBBox && e.getBBox().height > 0 && e.getBBox().width > 0 && !e.closest('.head') && e.tagName === 'rect').map((e) => e.getAttribute('class')) };
    });
    const xs = L.xs, wantTicks = [13, 14, 15, 16, 17].map(String);
    check(JSON.stringify(dom.ticks) === JSON.stringify(wantTicks) && SCALE.lo === 13 && SCALE.hi === 17, `the scale, as worked out here from the file's ${LO.toFixed(2)} to ${HI.toFixed(2)}: ${dom.ticks.join(', ')} c/kWh, fixed for the whole file, not from zero`);
    check(dom.past === CUR && dom.ahead === N - CUR && dom.pastOp === '0.4', `the staircase: one tread per quarter hour, ${dom.past} ended at 40 % and ${dom.ahead} ahead (B10: no hourly means)`);
    check(dom.lvl[0] === xs[RUN.from] && dom.lvl[1] === xs[RUN.to + 1] - xs[RUN.from] && Math.abs(dom.lvl[2] + 1 - yOf(RUN.mean)) < 0.01 && dom.posts.length === 2 && dom.posts.every(([, b]) => Math.abs(b - 136) < 0.01),
      `the landing: the Dishwasher's run ${runText(RUN)} as decoded here (intervals ${RUN.from} to ${RUN.to}), a level from x ${dom.lvl[0]} to ${dom.lvl[0] + dom.lvl[1]} at y ${(dom.lvl[2] + 1).toFixed(1)} = ${f2(RUN.mean)} c/kWh, two posts down to the plot's foot`);
    check(dom.mean[0] === xs[CUR] && dom.mean[1] === xs[N] && Math.abs(dom.mean[2] - yOf(MEAN)) < 0.01 && /3/.test(dom.dash) && dom.inPlot.includes(`mean ${f2(MEAN)}`),
      `the mean ahead, dashed (${dom.dash}) across the stretch searched at y ${dom.mean[2]} = ${f2(MEAN)}, labeled; the level ${(yOf(RUN.mean) - yOf(MEAN)).toFixed(0)} px under it, ${pctBelow(RUN.mean, MEAN)} % lower`);
    const nowX = xs[CUR] + ((Date.parse(NOW) - pts[CUR].at) / STEP) * (xs[CUR + 1] - xs[CUR]);
    check(dom.nowl.length === 1 && Math.abs(dom.nowl[0][1] - nowX) < 0.01 && dom.axis[0] === runText(RUN) && !dom.axis.includes('12:00') && dom.axis.includes('Thu 1'),
      `now over the plot at x ${nowX.toFixed(2)}; the axis says ${dom.axis.join(', ')}: the run's times first, 12:00 left out rather than printed through them (B9)`);
    check(JSON.stringify([...new Set(dom.bold)].sort()) === '["brk","lvl","post"]', `the one bold thing: the only ink marks in the drawing are the landing's level, posts and bracket (and the tracer head) (${[...new Set(dom.bold)].join(', ')})`);
    await clearCheck(w, 'at 10:20');
  }

  // the signature on rendered pixels: the level against what lies under it (the same screen with the landing hidden),
  // and the staircase's blue against the page
  {
    const boxes = await w(() => [...document.querySelectorAll('#stair .lvl')].map((r) => r.getBoundingClientRect().toJSON()));
    const a = await A.png();
    await w(() => { document.querySelector('#stair .landing').style.visibility = 'hidden'; });
    const b = await A.png();
    await w(() => { document.querySelector('#stair .landing').style.visibility = ''; });
    const s = [];
    for (const r of boxes) for (let x = Math.ceil(r.left * 2); x < Math.floor(r.right * 2); x++) for (let y = Math.ceil(r.top * 2 - 0.5); y + 0.5 <= r.bottom * 2 - 0.5 + 1e-9 && y < Math.floor(r.bottom * 2); y++) s.push(contrast(a.at(x, y), b.at(x, y)));
    const under = s.length ? s.filter((x) => x >= 3).length / s.length : 0;
    const L = await w(() => window.__ph.staircase()), svg = await A.rect('#stair svg');
    const tread = [];
    for (let i = CUR; i < N; i++) {
      if (i >= RUN.from - 1 && i <= RUN.to + 1) continue;
      const cx = Math.round((svg.left + (L.xs[i] + L.xs[i + 1]) / 2) * 2), cy = (svg.top + yOf(pts[i].v)) * 2;
      tread.push(Math.max(...[-1, 0, 1].map((d) => contrast(a.at(cx, Math.round(cy) + d), PAGE))));
    }
    const at3 = tread.filter((x) => x >= 3).length / tread.length;
    check(s.length >= 40 && under >= 0.9, `the landing's level: ${s.length} device pixels, ${(under * 100).toFixed(1)} % at 3:1 or more against what lies under them (palette.py: ${scheme === 'light' ? '3.55' : '3.48'} across the staircase, ${scheme === 'light' ? '14.80' : '14.43'} on the page); the lowest ${Math.min(...s).toFixed(2)}, where the level crosses the blue line`);
    check(tread.length > 30 && at3 >= 0.9, `the staircase's treads ahead: ${tread.length} sampled at their centers, ${(at3 * 100).toFixed(1)} % at 3:1 or more on the page (palette.py: ${scheme === 'light' ? '4.17' : '4.14'}); the lowest ${Math.min(...tread).toFixed(2)}`);
  }

  // the slider, Now, the readout and the runs, against the decode
  {
    const st = await stateOf(w);
    const named = await w(() => { const s = document.getElementById('stair'); return [s.getAttribute('role'), s.getAttribute('aria-label'), s.getAttribute('aria-valuemin'), s.getAttribute('aria-valuemax'), s.tabIndex, s.getAttribute('aria-describedby'), document.getElementById('st-desc').textContent]; });
    const wantDesc = `96 quarter hours from Thursday 1 October, 00:00. Lowest ${f2(LO)} at ${pts.find((p) => p.v === LO).wall}, highest ${f2(HI)} at ${pts.find((p) => p.v === HI).wall}. Dishwasher: cheapest 2 hours ahead ${pts[RUN.from].wall} to ${endWall(RUN.to)}, mean ${f2(RUN.mean)} cents a kilowatt hour, ${pctBelow(RUN.mean, MEAN)} percent below the mean ahead.`;
    check(named.slice(0, 6).join() === `slider,Time,0,${N - 1},0,st-desc` && named[6] === wantDesc && st.chosen === CUR && st.now === CUR,
      `the slider: role slider, named Time, 0 to ${N - 1}, at the current interval (${st.now}); described once: "${named[6].slice(0, 90)}…"`);
    const wantVals = valsOf(CUR, CUR, RUN, 'Dishwasher');
    check(st.when === whenOf(CUR, CUR) && st.vals === wantVals && st.text === `Thursday 1 October, ${pts[CUR].wall} to ${endWall(CUR)}, now, ${f2(pts[CUR].v)} cents a kilowatt hour, ${wantVals.split(', ').slice(1).join(', ')}` && Math.abs(st.head - st.center) < 1e-9 && st.col.join() === st.xs.join(),
      `the readout, as decoded here: "${st.when}" / "${st.vals.replace(NN, ' ')}"; the column and the head on the interval`);
    const dayIdx = range(0, N), rk = rankOf(CUR, dayIdx);
    const now = await w(() => [document.querySelector('.now .fig').textContent, document.querySelector('.now .lead').textContent, getComputedStyle(document.querySelector('.now .fig b')).fontSize]);
    check(now[0] === `${f2(pts[CUR].v)}${NN}c/kWh` && now[1] === `${pts[CUR].wall}${EN}${endWall(CUR)}, ${ord(rk)} lowest of today’s 96 quarter hours, in the middle half` && now[2] === '21px',
      `Now: "${now[0].replace(NN, ' ')}" at 21 px, "${now[1]}": the quarter's price and the quarter's rank (B11)`);
    const rows = await w(() => [...document.querySelectorAll('.runs button')].map((b) => [b.querySelector('.nm').textContent, b.querySelector('.tm').textContent, b.querySelector('.sub').textContent, b.getAttribute('aria-pressed')]));
    const wantRows = APPS.map((a, k) => { const r = cheapest(CUR, a.hours), len = a.hours === 1.5 ? `1${NN}h 30${NN}min` : `${a.hours}${NN}h`; return [a.name, runText(r), `${len} run, ${f2(r.mean)}${NN}c/kWh, ${pctBelow(r.mean, MEAN)}${NN}% below the mean ahead`, String(k === 0)]; });
    check(JSON.stringify(rows) === JSON.stringify(wantRows), `the runs, as searched here from 10:15: ${rows.map((r) => `${r[0]} ${r[1]}`).join('; ')}; the first pressed`);
    const names = await w(() => [...document.querySelectorAll('.runs button')].map((b) => b.getAttribute('aria-label')));
    check(names[0] === `Dishwasher, ${pts[RUN.from].wall} to ${endWall(RUN.to)}, 2 hours run, ${f2(RUN.mean)} cents a kilowatt hour, ${pctBelow(RUN.mean, MEAN)} percent below the mean ahead` && names.every((nm, k) => nm.startsWith(`${APPS[k].name}, `) && !/[\u2013\u202f%]|c\/kWh/.test(nm)),
      `the rows' names for VoiceOver begin with their visible words and go on in words, no symbol in them: "${names[0]}"`);
    const sub = await w(() => document.querySelector('.runs').previousElementSibling.textContent);
    check(sub === `Searched from 10:15 to 24:00; mean ${f2(MEAN)}${NN}c/kWh`, `the stretch: "${sub.replace(NN, ' ')}"`);
  }

  // a tap on 14:15's column: the readout, the head and the value move; said once
  {
    const i = pts.findIndex((p) => p.wall === '14:15'), p = await pointOf(A, i);
    await w(() => { document.getElementById('live').textContent = ''; });
    await A.tapAt(p.x, p.y);
    await page.waitForTimeout(300);
    const s = await stateOf(w);
    check(s.chosen === i && s.now === i && s.when === whenOf(i, CUR) && s.vals === valsOf(i, CUR, RUN, 'Dishwasher') && Math.abs(s.head - s.center) < 1e-9 && s.live.startsWith('Thursday 1 October, 14:15 to 14:30, 13.69 cents a kilowatt hour, lowest of the 55 quarter hours ahead, inside the run for Dishwasher'),
      `a tap on 14:15 picks it: "${s.when}", "${s.vals.replace(NN, ' ')}"; said once: "${s.live.slice(0, 80)}…"`);
    await A.shot(`tapped-${scheme}`, false);
    await A.tapAt(p.s.left + 4, p.y);
    await page.waitForTimeout(200);
    check(await w(() => window.__ph.chosen()) === i, 'a tap on the tick column picks nothing');
    // a pinch that starts on the drawing belongs to the page: two fingers never scrub
    const ta = await w(() => getComputedStyle(document.getElementById('stair')).touchAction);
    const q = await pointOf(A, 30);
    await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: q.x, y: q.y, id: 1 }, { x: q.x + 20, y: q.y + 4, id: 2 }] });
    for (let k = 1; k <= 8; k++) { await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: q.x - 6 * k, y: q.y, id: 1 }, { x: q.x + 20 + 6 * k, y: q.y + 4, id: 2 }] }); await page.waitForTimeout(16); }
    await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(250);
    const pinched = await w(() => ({ chosen: window.__ph.chosen(), r: document.querySelector('#stair .head circle:last-child').getAttribute('r') }));
    check(ta === 'pan-y pinch-zoom' && pinched.chosen === i && pinched.r === '4', `a pinch on the drawing: touch-action "${ta}"; two fingers moving apart leave the interval where it was (${pinched.chosen})`);
    // the keys: one interval, four, the ends; the slider says its own value, so the live region adds nothing
    await w(() => { document.getElementById('stair').focus(); document.getElementById('live').textContent = ''; });
    const seq = [];
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown']) { await page.keyboard.press(k); seq.push((await stateOf(w)).now); }
    const kl = await w(() => document.getElementById('live').textContent);
    check(seq.join() === [i + 1, i, i - 1, i + 3, i - 1, 0, N - 1, N - 1, N - 2].join() && kl === '', `the keys: → ← ← PageUp PageDown Home End ↑ ↓ give ${seq.join(', ')}; nothing said through the live region`);
  }

  // the scrub by real touch, at 2, 8 and 20 intervals a second, a move every 16 ms (HOUSE 4.6's rule as a slider takes it)
  if (SCRUB) {
    await w(() => {
      window.__log = [];
      window.__fx = null;
      document.addEventListener('pointermove', (e) => { window.__fx = e.clientX; }, true);
      const step = () => {
        const st = document.getElementById('stair'), L = window.__ph.staircase();
        if (st && L) {
          const i = window.__ph.chosen(), head = +st.querySelector('.head circle:last-child').getAttribute('cx');
          window.__log.push({ i, now: +st.getAttribute('aria-valuenow'), head: Math.abs(head - (L.xs[i] + L.xs[i + 1]) / 2) < 1e-9, when: document.querySelector('.ro-when').textContent, anims: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#stair, .ro')).length });
        }
        if (window.__log.length < 100000 && !window.__stop) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const labelOf = (i) => whenOf(i, CUR);
    for (const speed of [2, 8, 20]) {
      const a = await pointOf(A, 10), L = a.L, cw = (L.xs[N] - L.xs[0]) / N, moves = speed === 2 ? 90 : 50, dx = (speed * cw * 16) / 1000;
      const idx = (cx) => { const x = cx - a.s.left; let k = 0; while (k < N - 1 && L.xs[k + 1] <= x) k++; return x < L.xs[0] ? 0 : k; };
      await w(() => { window.__log.length = 0; });
      let x = a.x;
      await A.touch('touchStart', Math.round(x), a.y);
      const after = [], seen = []; let lost = 0;
      const t0 = Date.now();
      for (let k = 0; k < moves; k++) {
        x += dx;
        if (k === 0) x += 7;   // past the 6 px that tells a sideways drag from a tap
        const xi = Math.round(x);   // CDP delivers touch points in whole CSS pixels
        await A.touch('touchMove', xi, a.y + (k % 3) - 1);
        const got = await w((v) => new Promise((r) => { const t = performance.now(), go = () => (window.__fx === v ? r(true) : performance.now() - t > 500 ? r(false) : requestAnimationFrame(go)); go(); }), xi);
        if (!got) lost++;
        await A.frame();
        const want = idx(xi), st = await stateOf(w);
        if (st.chosen !== want || st.now !== want || st.when !== labelOf(want) || Math.abs(st.head - st.center) > 1e-9) after.push(`${want}:${st.chosen}`);
        if (seen[seen.length - 1] !== st.chosen) seen.push(st.chosen);
      }
      const ms = (Date.now() - t0) / moves;
      await A.touch('touchEnd');
      await A.frame();
      const last = await stateOf(w), log = await w(() => window.__log.slice());
      const bad = log.filter((f) => f.i !== f.now || !f.head || f.anims), labelsBad = log.filter((f) => f.when !== labelOf(f.i)).length;
      const inOrder = seen.every((s, k) => k === 0 || s === seen[k - 1] + 1);
      check(lost === 0 && after.length === 0 && bad.length === 0 && labelsBad === 0 && last.chosen === idx(Math.round(x)) && (speed !== 2 || inOrder) && log.length > 10,
        `the scrub at ${speed} intervals a second (${moves} moves, ${ms.toFixed(1)} ms each in headless): after every move, once the page has it (${lost} never arrived), and one drawn frame, the head, the readout and the value show the interval under the finger (${after.length} differ); over ${log.length} drawn frames ${bad.length + labelsBad} differ and no animation runs on them; ${speed === 2 ? `every interval drawn in order (${seen.join(' ')}); ` : ''}the lift lands on ${last.chosen}`);
      await page.waitForTimeout(150);
    }
    await w(() => { window.__stop = true; });
    check(await w(() => document.querySelector('#stair .head circle:last-child').getAttribute('r')) === '4', 'the head back to 8 px after the lift');
  }
  await closeOut(A, scheme);

  // the file run out: what a fresh install and the marketing camera see (B2)
  {
    const B = await open(scheme, { time: RANOUT });
    const H = cheapest(0, 2), hmean = meanOf(pts);
    const s = await B.w(() => ({ stamp: document.getElementById('stamp').textContent, lead: document.querySelector('#stamp .lead') && document.querySelector('#stamp .lead').textContent, h2: [...document.querySelectorAll('.sec > h2')].map((n) => n.textContent),
      st: [...document.querySelectorAll('.statement')].map((n) => n.textContent), now: document.querySelectorAll('#stair .nowl').length, past: document.querySelectorAll('#stair .past').length, chosen: window.__ph.chosen(),
      tm: document.querySelector('.runs .tm').textContent, sub: document.querySelector('.runs .sub').textContent, cam: document.body.innerText.includes('c/kWh') }));
    const ago = Math.floor((Date.parse(RANOUT) - (pts[N - 1].at + STEP)) / 3600e3);
    check(s.stamp === `Prices ran out ${ago}${NN}h ago. Updated 1 Oct, ${osloClock(GEN)}` && s.lead === `Prices ran out ${ago}${NN}h ago.` && s.h2.join() === 'Cheapest runs in this file' && s.now === 0 && s.past === 0 && s.chosen === H.from && s.cam,
      `run out, ${scheme}: "${s.stamp.replace(NN, ' ')}" (the sentence in ink); no Now, no now mark, nothing faint; "${s.h2[0]}", the chosen interval the run's first`);
    check(s.tm === runText(H, false) && s.sub === `2${NN}h run, ${f2(H.mean)}${NN}c/kWh, ${pctBelow(H.mean, hmean)}${NN}% below the file’s mean` && s.st[0] === `These prices have all ended, so this is a past day, not a plan: the last are for ${(([y, m, d]) => { const w = new Date(Date.UTC(y, m - 1, d)); return `${DAYS[w.getUTCDay()].slice(0, 3)} ${d} ${MONTHS[m - 1].slice(0, 3)}`; })(pts[N - 1].date.split('-').map(Number))}, and no newer ones have arrived. The refresh after each day’s auction brings the next.`,
      `history, never a plan (the stock planned "Dishwasher 00:30–02:30" for a day that had ended): "${s.tm}", "${s.sub.replace(/ /g, ' ')}"; "${s.st[0].slice(0, 40)}…"`);
    await clearCheck(B.w, 'run out');
    await B.shot(`history-${scheme}`);
    await closeOut(B, `run out, ${scheme}`);
  }
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once');
{
  const A = await open('light');
  const { page, w } = A;
  {
    await w(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Tab');
    check(await w(() => document.activeElement.id) === 'stamp', 'the first Tab after the load lands on the stamp');
  }
  // the runs pressed: the landing moves, the rows change, said once
  {
    const car = cheapest(CUR, 4);
    await w(() => { document.getElementById('live').textContent = ''; });
    const b = await A.rect('.runs button:nth-child(3)');
    await A.tapAt(b.left + 40, b.top + b.height / 2);
    await page.waitForTimeout(300);
    const s = await w(() => ({ pressed: [...document.querySelectorAll('.runs button')].map((x) => x.getAttribute('aria-pressed')).join(), lvl: [+document.querySelector('#stair .lvl').getAttribute('x'), +document.querySelector('#stair .lvl').getAttribute('width')], xs: window.__ph.staircase().xs, live: document.getElementById('live').textContent, axis: document.querySelector('#stair .lab.run').textContent, app: window.__ph.appliance() }));
    check(s.pressed === 'false,false,true,false' && s.app === 2 && s.lvl[0] === s.xs[car.from] && s.lvl[1] === s.xs[car.to + 1] - s.xs[car.from] && s.axis === runText(car) && s.live === `Car charging: ${pts[car.from].wall} to ${endWall(car.to)}, ${f2(car.mean)} cents a kilowatt hour.`,
      `pressing Car charging: the landing moves to ${s.axis}, the row is pressed, said once: "${s.live}"`);
    await A.shot('car-light', false);
    const d = await A.rect('.runs button:nth-child(1)');
    await A.tapAt(d.left + 40, d.top + d.height / 2);
    await page.waitForTimeout(200);
  }
  // About: opens from the stamp, holds the rest inert, carries the credits, closes on Escape
  {
    const s = await A.rect('#stamp');
    await A.tapAt(s.left + 20, s.top + s.height / 2);
    await page.waitForTimeout(400);
    const a = await w(() => ({ open: !document.getElementById('about').hidden, inert: ['head', 'main', 'band'].every((id) => document.getElementById(id).inert), focus: document.activeElement.id,
      text: document.querySelector('.about-body').textContent.replace(/[ \t\n]+/g, ' '), list: [...document.querySelectorAll('#about-list dt')].map((d, i) => `${d.textContent} ${document.querySelectorAll('#about-list dd')[i].textContent}`) }));
    const wantList = ['Zone: NO2, Norway south-west', 'Time zone: Europe/Oslo, UTC+2', 'Prices: Thu 1 Oct 2026, 00:00 to Fri 2 Oct 2026, 00:00, 96 quarter hours', 'Updated: Thu 1 Oct 2026, 06:01 (UTC+2)',
      'Source unit: EUR/MWh, shown divided by 10 as c/kWh, euro-cents per kWh, the unit a household tariff is written in', 'Scale: 13 to 17 c/kWh for the whole file', 'Next day: Fri 2 Oct, not in this file (no prices published for 2026-10-02)',
      'Appliances: data/appliances.json, 4 rows', `Ask table: ${snap.ask.length} rows`];
    check(a.open && a.inert && a.focus === 'about-close' && a.text.includes(CREDIT) && a.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.') && a.text.includes('api.energy-charts.info') && a.text.includes('creativecommons.org/licenses/by/4.0') && !/https?:/.test(a.text)
      && /It is not a bill/.test(a.text) && /not a forecast/.test(a.text) && /not at zero/.test(a.text),
      'About opens from the stamp, focus on Close, the rest inert; the credit word for word, both addresses printed without their scheme, the face\'s credit; what the Landing is not (a bill, a forecast, a scale from zero)');
    check(JSON.stringify(a.list) === JSON.stringify(wantList), `About's This data: ${a.list.join('; ')}`);
    await A.shot('about-light');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp' && !document.getElementById('main').inert), 'About closes on Escape; focus returns to the stamp');
  }
  // hidden and back: both files read again; the same files redraw nothing; new prices redraw in place
  {
    const i = pts.findIndex((p) => p.wall === '18:00'), p = await pointOf(A, i);
    await A.tapAt(p.x, p.y);
    await page.waitForTimeout(250);
    await w(() => { document.getElementById('stair').dataset.old = '1'; document.getElementById('main').scrollTop = 40; });
    const n0 = { ...reads };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => [document.getElementById('main').scrollTop, !!document.querySelector('#stair[data-old]'), window.__ph.chosen()]);
    check(reads['/data/snapshot.json'] === n0['/data/snapshot.json'] + 1 && reads['/data/appliances.json'] === n0['/data/appliances.json'] + 1 && s[1] && Math.abs(s[0] - 40) < 2 && s[2] === i,
      `back on screen: both files read again; the same files redraw nothing; the scroll (${s[0]} px) and the chosen interval (${s[2]}) kept`);
    const later = new Date(GEN + 3600e3).toISOString().replace('.000Z', 'Z');
    override = { '/data/snapshot.json': { body: rawSnap.replace(`"generatedAt": "${snap.generatedAt}"`, `"generatedAt": "${later}"`) } };
    await w(() => { document.getElementById('live').textContent = ''; });
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(700);
    const t2 = await w(() => ({ redrawn: !document.querySelector('#stair[data-old]'), stamp: document.getElementById('stamp').textContent, top: document.getElementById('main').scrollTop, chosen: window.__ph.chosen(), live: document.getElementById('live').textContent }));
    check(t2.redrawn && t2.stamp === `Updated ${osloClock(GEN + 3600e3)}` && Math.abs(t2.top - 40) < 2 && t2.chosen === i && t2.live === `New prices, updated ${osloClock(GEN + 3600e3)}.`,
      `back with new prices ("${t2.stamp}"): drawn again in place, the scroll and the chosen interval kept; said once: "${t2.live}"`);
    // a broken replacement keeps the view and says so (B13)
    override = { '/data/snapshot.json': { body: '<!doctype html><title>502</title>' } };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const b = await w(() => ({ notice: document.getElementById('notice').hidden ? '' : document.querySelector('#notice p').textContent, lvl: document.querySelectorAll('#stair .lvl').length, rows: document.querySelectorAll('.runs button').length, stamp: document.getElementById('stamp').textContent, cam: document.body.innerText.includes('c/kWh') }));
    check(b.notice === `A new data/snapshot.json arrived and cannot be used. data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a Shortcut does without noticing. Still showing the prices updated ${osloClock(GEN + 3600e3)}.` && b.lvl === 1 && b.rows === 4 && b.stamp.startsWith('Updated') && b.cam,
      `B13: a broken replacement while open: "${b.notice.slice(0, 70)}…"; the drawing, the runs and the stamp kept (the stock emptied the screen)`);
    await A.shot('broken-replacement-light', false);
    const kb = await A.rect('#notice .textkey');
    await A.tapAt(kb.left + kb.width / 2, kb.top + kb.height / 2);
    await page.waitForTimeout(150);
    check(kb.height >= 44 && kb.width >= 44 && await w(() => document.getElementById('notice').hidden), `the plate's Close key (${Math.round(kb.width)} × ${Math.round(kb.height)}) puts it away; the prices stay`);
    // new appliances while open
    override = { '/data/snapshot.json': { body: rawSnap.replace(`"generatedAt": "${snap.generatedAt}"`, `"generatedAt": "${later}"`) }, '/data/appliances.json': { body: JSON.stringify({ schema: 1, appliances: [{ name: 'Heat pump top-up for the whole upstairs floor', hours: 6 }, { name: 'Dishwasher', hours: 2 }] }) } };
    await w(() => { document.getElementById('live').textContent = ''; });
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(700);
    const na = await w(() => ({ names: [...document.querySelectorAll('.runs .nm')].map((x) => x.textContent), app: window.__ph.appliance(), live: document.getElementById('live').textContent }));
    check(na.names.join() === 'Heat pump top-up for the whole upstairs,Dishwasher' && na.app === 1 && na.live === 'The appliances were read again from data/appliances.json.', `new appliances while open: ${na.names.map((x) => `"${x}"`).join(', ')} (a 45-character name cut at 40 and trimmed again, no trailing space); the Dishwasher stays chosen; said once: "${na.live}"`);
    override = {};
    // hidden: nothing runs, the clock's timeout cleared
    await w(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const hid = await w(() => window.__ph.timer());
    await w(() => { delete document.hidden; });
    check(hid === false, 'hidden: the clock\'s timeout is cleared, nothing runs');
  }
  await closeOut(A, 'once');
}
// the clock crossing a quarter while open: now, Now, the faint quarters and the stretch move on their own
{
  const A = await open('light', { install: true, time: '2026-10-01T08:29:30Z' });
  const before = await A.w(() => [document.querySelector('.now .lead').textContent.slice(0, 11), window.__ph.chosen(), document.querySelectorAll('#stair .st.past').length && (document.querySelector('#stair .st.past').getAttribute('d').match(/H/g) || []).length]);
  await A.page.clock.runFor(45000);
  await A.page.waitForTimeout(300);
  const after = await A.w(() => [document.querySelector('.now .lead').textContent.slice(0, 11), window.__ph.chosen(), (document.querySelector('#stair .st.past').getAttribute('d').match(/H/g) || []).length, document.querySelector('.runs').previousElementSibling.textContent.slice(0, 26)]);
  check(before[0] === `10:15${EN}10:30` && before[1] === 41 && after[0] === `10:30${EN}10:45` && after[1] === 42 && after[2] === 42 && after[3] === 'Searched from 10:30 to 24:',
    `the clock crossing 10:30 while open: Now ${before[0]} became ${after[0]}, the chosen interval followed it (${before[1]} to ${after[1]}), ${after[2]} quarters faint, "${after[3]}…"`);
  await closeOut(A, 'the clock');
}
// the camera's swipe, from the screen's center, and a swipe that starts on the drawing: the pane scrolls, nothing is picked
{
  const A = await open('light', { w: 390, h: 700 });
  for (const [label, from] of [['from the screen\'s center', null], ['starting on the drawing', 'stair']]) {
    await A.w(() => { document.getElementById('main').scrollTop = 0; document.getElementById('live').textContent = ''; });
    const c = from ? await pointOf(A, 60) : { x: 195, y: 350 };
    const before = await A.w(() => window.__ph.chosen());
    await A.touch('touchStart', c.x, c.y);
    for (let k = 1; k <= 14; k++) { await A.touch('touchMove', c.x + (k % 2), c.y - 14 * k); await A.page.waitForTimeout(16); }
    await A.touch('touchEnd');
    await A.page.waitForTimeout(500);
    const s = await A.w(() => ({ top: document.getElementById('main').scrollTop, chosen: window.__ph.chosen(), live: document.getElementById('live').textContent }));
    check(s.top >= 100 && s.chosen === before && s.live === '', `a vertical swipe ${label} at 390 × 700 scrolls the pane by ${Math.round(s.top)} px, picks nothing and says nothing`);
  }
  await closeOut(A, 'the swipe');
  // the pane's scroll at the camera's 6.9-inch width (440 × 956), printed for owner call 9
  const room = [];
  for (const [label, time] of [['inside the file, 10:20', NOW], ['run out (the camera\'s state)', RANOUT]]) for (const [wv, hv] of [[390, 844], [440, 956]]) {
    const B = await open('light', { w: wv, h: hv, time });
    room.push(`${label} at ${wv} × ${hv}: ${await B.w(() => { const m = document.getElementById('main'); return m.scrollHeight - m.clientHeight; })} px`);
    await closeOut(B, `the pane's scroll, ${wv} × ${hv}`);
  }
  console.log(`      the pane's room to scroll (owner call 9): ${room.join('; ')}`);
  // the camera's second README pane (HOUSE 7.4, plan 0011 D39): Car charging's landing in the run-out state at the
  // camera's 440 × 956, apart from the dishwasher's; the washing machine's, which the camera tapped first, measured too
  {
    const C = await open('light', { w: 440, h: 956, time: RANOUT });
    const lvl = () => C.w(() => { const l = document.querySelector('#stair .lvl'); return { x: +l.getAttribute('x'), w: +l.getAttribute('width'), axis: document.querySelector('#stair .lab.run').textContent }; });
    const dish = await lvl(), out = {};
    for (const [name, nth] of [['Washing machine', 2], ['Car charging', 3]]) {
      const r = await C.rect(`.runs button:nth-child(${nth})`);
      const label = await C.w((k) => document.querySelector(`.runs button:nth-child(${k})`).getAttribute('aria-label'), nth);
      await C.tapAt(r.left + 40, r.top + r.height / 2);
      await C.page.waitForTimeout(300);
      const l = await lvl();
      out[name] = { label, dx1: Math.abs(l.x - dish.x), dx2: Math.abs(l.x + l.w - dish.x - dish.w), dw: Math.abs(l.w - dish.w), axis: l.axis };
    }
    const car = out['Car charging'], wm = out['Washing machine'];
    check(car.label.startsWith('Car charging, ') && car.dw >= dish.w * 0.9 && car.axis !== dish.axis && car.axis === `Thu ${pts[cheapest(0, 4).from].wall}${EN}${endWall(cheapest(0, 4).to)}`,
      `the camera's second pane at 440 × 956, run out: Car charging's landing ${car.axis}, ${car.dw.toFixed(0)} px longer than the dishwasher's ${dish.axis} (${dish.w.toFixed(0)} px long) (the washing machine's, ${wm.axis}, moves ${wm.dx1.toFixed(0)} and ${wm.dx2.toFixed(0)} px at its ends, so the camera taps Car charging); the row's name begins with its visible words: "${car.label}"`);
    await C.shot('camera-car-440-light', false);
    await closeOut(C, 'the camera\'s second pane');
  }
}
// a file that cannot be read on a return: nothing arrived, so the plate says so (not "arrived and cannot be used")
{
  const A = await open('light', { expect: /HTTP 404|404 \(Not Found\)|Failed to load resource|requestfailed .*\/data\/snapshot\.json/ });
  override = { '/data/snapshot.json': { status: 404 } };
  await A.w(() => document.dispatchEvent(new Event('visibilitychange')));
  await A.page.waitForTimeout(600);
  const s = await A.w(() => ({ notice: document.getElementById('notice').hidden ? '' : document.querySelector('#notice p').textContent, lvl: document.querySelectorAll('#stair .lvl').length, rows: document.querySelectorAll('.runs button').length }));
  check(s.notice === `data/snapshot.json could not be read (HTTP 404). Nothing new arrived. Still showing the prices updated ${osloClock(GEN)}.` && s.lvl === 1 && s.rows === 4, `a 404 on a return: "${s.notice}"; the drawing and the runs kept`);
  override = {};
  await closeOut(A, 'a 404 on a return');
}
// the bugs on record at their clocks: a two-day file made 1 Oct 16:31 UTC, read at 22:30, at 23:30 and the next morning
{
  const two = JSON.parse(rawSnap);
  two.generatedAt = '2026-10-01T16:31:00Z';
  const fri = snap.hours.map((h, i) => ({ start: h.start.replace('2026-10-01', '2026-10-02'), price: i < 4 ? 10 : i === 56 || i === 57 ? -33.1 : 120 + (i % 7) }));
  two.hours = snap.hours.map((h, i) => ({ ...h, price: i >= 92 ? 10 : h.price })).concat(fri);
  two.days = [{ date: '2026-10-01', label: 'Today', source: 'fetched', intervals: 96 }, { date: '2026-10-02', label: 'Tomorrow', source: 'fetched', intervals: 96 }];
  override = { '/data/snapshot.json': { body: JSON.stringify(two) } };
  for (const scheme of schemes) {
    const A = await open(scheme, { time: '2026-10-01T20:30:00Z' });
    const s = await A.w(() => ({ tm: [...document.querySelectorAll('.runs .tm')].map((n) => n.textContent), sub: document.querySelector('.runs').previousElementSibling.textContent, neg: !!document.querySelector('#stair .neg'), zero: !!document.querySelector('#stair .zero'), ticks: [...document.querySelectorAll('#stair .tl')].map((t) => t.textContent) }));
    check(s.tm[0] === '23:00 to Fri 01:00' && s.tm[2] === '23:00 to Fri 03:00' && s.sub.startsWith('Searched from 22:30 to Fri 24:00') && s.neg && s.zero && s.ticks.some((x) => x.startsWith(MI)),
      `B3, ${scheme}: at 22:30 with Friday published, the runs cross midnight, "${s.tm[0]}" and "${s.tm[2]}" (the stock printed a dash for every appliance at night); Friday's half hour below zero filled under the zero rule, ticks ${s.ticks.join(' ')}`);
    await clearCheck(A.w, `two days at 22:30, ${scheme}`);
    await A.shot(`two-days-${scheme}`, false);
    await closeOut(A, `two days at 22:30, ${scheme}`);
  }
  const B = await open('light', { time: '2026-10-02T06:00:00Z', locale: 'nb-NO' });
  const m = await B.w(() => ({ stamp: document.getElementById('stamp').textContent, when: document.querySelector('.ro-when').textContent, lead: document.querySelector('.now .lead').textContent, text: document.body.innerText, tm: document.querySelector('.runs .tm').textContent, past: (document.querySelector('#stair .st.past').getAttribute('d').match(/H/g) || []).length }));
  check(m.stamp === 'Updated 1 Oct, 18:31' && m.when === 'Fri 2 Oct, 08:00–08:15, now' && m.lead.includes('of today’s 96 quarter hours') && !/Today|Tomorrow|okt|fre\./.test(m.text) && m.past === 128 && !m.tm.startsWith('Fri'),
    `B1, B4, B5, B6: the next morning at 08:00 in nb-NO, before the next refresh: "${m.stamp}" (dated, no "Stale"), "${m.when}"; no "Today" or "Tomorrow" anywhere; Thursday and the night faint (${m.past} quarters); the runs from now, "${m.tm}"`);
  await clearCheck(B.w, 'two days, the next morning');
  await B.shot('two-days-morning-light', false);
  await closeOut(B, 'two days, the next morning');
  // the review's fixture: a Friday whose daytime prices swing through the mean ahead everywhere, read at Fri 08:00, where
  // the stock rule printed the mean's label across the staircase; and at 23:30 Thursday, where "Fri 2" was dropped
  const rev = JSON.parse(rawSnap);
  rev.generatedAt = '2026-10-01T14:31:00Z';
  rev.days = two.days;
  rev.hours = snap.hours.concat(Array.from({ length: 96 }, (_, k) => { const h = Math.floor(k / 4); const p = h >= 2 && h < 5 ? -35 + 6 * Math.sin(k / 3) : h < 2 ? 60 - 12 * (k / 8) : h < 8 ? -5 + 20 * ((k - 20) / 12) : h < 18 ? 120 + 35 * Math.sin((k - 32) / 7) + (k % 3) * 2 : 150 - 3 * (k - 72) + (k % 2) * 4; return { start: `2026-10-02T${p2(h)}:${p2((k % 4) * 15)}:00+02:00`, price: Math.round(p * 100) / 100 }; }));
  override = { '/data/snapshot.json': { body: JSON.stringify(rev) } };
  for (const [label, time, want] of [['Fri 08:00', '2026-10-02T06:00:00Z', (s) => s.mean.row && s.mean.a > s.now + 4 && s.meanY < 16], ['Thu 23:30', '2026-10-01T21:30:00Z', (s) => s.axis.includes('Fri 2') && s.axis[0] === `Fri 02:45${EN}04:45` && s.dayX > s.runB + 3]]) {
    const R = await open('light', { time });
    const lc = await labelsClear(R.w);
    const s = await R.w(() => { const L = window.__ph.staircase(), ls = [...document.querySelectorAll('#stair text.lab:not(.nowl)')]; const run = ls.find((t) => t.classList.contains('run')), day = ls.find((t) => t.textContent === 'Fri 2');
      return { axis: ls.map((t) => t.textContent), meanY: +document.querySelector('#stair text.mean').getAttribute('y'), now: L.nowX, runB: run ? run.getBBox().x + run.getBBox().width : 0, dayX: day ? day.getBBox().x : -1 }; });
    s.mean = lc.find((l) => l.text.startsWith('mean'));
    check(lc.every((l) => !l.hit) && want(s), `the review's fixture at ${label}: labels ${lc.map((l) => `"${l.text}"${l.row ? ' in the row above the plot' : ''}`).join(', ')}, none run through; the axis ${s.axis.join(', ')}${label === 'Thu 23:30' ? ` ("Fri 2" at x ${s.dayX.toFixed(0)}, after the run's times ending at ${s.runB.toFixed(0)})` : ` (the mean's label at y ${s.meanY}, now at x ${s.now.toFixed(0)})`}`);
    await R.shot(`review-${label.replace(/[ :]/g, '-')}-light`, false);
    await closeOut(R, `the review's fixture at ${label}`);
  }
  override = {};
}
// lastGood, private use, the appliance file's cases
{
  const kept = JSON.parse(rawSnap);
  kept.lastGood = { generatedAt: '2026-09-30T14:31:00Z', days: kept.days, hours: kept.hours };
  kept.hours = [];
  kept.source.publishable = false;
  override = { '/data/snapshot.json': { body: JSON.stringify(kept) }, '/data/appliances.json': { body: '{"appliances":[{"name":"Dishwasher","hours":2},{"name":"","hours":1},{"name":"Sauna","hours":30}]}' } };
  const A = await open('light');
  const s = await A.w(() => ({ stamp: document.getElementById('stamp').textContent, st: [...document.querySelectorAll('.statement')].map((n) => n.textContent), priv: !document.getElementById('private').hidden && document.getElementById('private').textContent, ink: getComputedStyle(document.getElementById('private')).color === getComputedStyle(document.querySelector('h1')).color, rows: document.querySelectorAll('.runs button').length }));
  check(s.stamp === 'Kept from the run before. Updated 30 Sep, 16:31' && s.st.includes('The last refresh could not reach the price service, so these are the prices it kept from the run made 30 Sep, 16:31.') && s.priv === 'These prices are licensed for private and internal use only. Do not republish them.' && s.ink
    && s.st.includes('2 rows in data/appliances.json were skipped: each needs a name and a run length between 0 and 24 hours.') && s.rows === 1,
    `lastGood: "${s.stamp}" and its sentence; private use: the second credits line in ink; two of three appliance rows skipped, said so`);
  await closeOut(A, 'lastGood and private use');
  override = { '/data/appliances.json': { body: '{ "appliances": [ ] , }' } };
  const B = await open('light');
  const t = await B.w(() => [...document.querySelectorAll('.statement')].map((n) => n.textContent).find((x) => x.startsWith('data/appliances.json')));
  check(t === 'data/appliances.json is not valid JSON, so this is the built-in list. A trailing comma or a missing quote will do it.', `a broken appliance file: "${t}"`);
  await closeOut(B, 'a broken appliance file');
  override = {};
}
// the same words on every locale: dates and times built by hand (B6)
{
  const words = [];
  for (const locale of ['en-US', 'en-GB', 'nb-NO', 'ja-JP']) {
    const A = await open('light', { locale });
    words.push([locale, await A.w(() => [document.getElementById('head').innerText, document.getElementById('pane').innerText, document.getElementById('band').innerText].join('\n'))]);
    await closeOut(A, `locale ${locale}`);
  }
  check(words.every(([, x]) => x === words[0][1]), `the same words, letter for letter, under ${words.map(([l]) => l).join(', ')} (${words[0][1].length} characters)`);
}
// Reduce Motion: every animation at 0 s
{
  const A = await open('light', { reduced: true });
  const s = await A.rect('#stamp');
  await A.tapAt(s.left + 20, s.top + s.height / 2);
  await A.page.waitForTimeout(100);
  const d = await A.w(() => getComputedStyle(document.querySelector('.about-sheet')).animationDuration);
  check(d === '0s', `Reduce Motion: About at ${d}; nothing else moves`);
  await closeOut(A, 'reduce motion');
}
// boot with the snapshot held back: no c/kWh in the page until it parses (the camera's wait proves the prices are in)
{
  let release;
  override = { '/data/snapshot.json': { hold: new Promise((r) => { release = r; }) } };
  const A = await open('light', { noWait: true });
  await A.page.waitForTimeout(800);
  const before = await A.w(() => [document.body.innerText.includes('c/kWh'), document.getElementById('stamp').textContent]);
  release();
  await A.page.waitForFunction(() => window.__ph && window.__ph.ready(), null, { timeout: 10000 });
  const after = await A.w(() => document.body.innerText.includes('c/kWh'));
  check(!before[0] && before[1] === 'Reading the prices…' && after, `held back: no "c/kWh" in the page while the snapshot is read ("${before[1]}"), then present`);
  await closeOut(A, 'held back');
  override = {};
}
// broken data at the start: a sentence on a plate, never a blank pane; then the file mended, and the app reads it
for (const [label, ov, want] of [
  ['missing', { status: 404 }, 'data/snapshot.json could not be read (HTTP 404).'],
  ['a web page', { body: '<!doctype html><html><body>Bad Gateway</body></html>' }, 'data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a Shortcut does without noticing.'],
  ['not an object', { body: '[1, 2]' }, 'data/snapshot.json is not a JSON object.'],
  ['schema 2', { body: JSON.stringify({ ...snap, schema: 2 }) }, 'data/snapshot.json says schema 2; this app reads schema 1.'],
  ['no prices', { body: JSON.stringify({ ...snap, hours: [], lastGood: null }) }, 'data/snapshot.json has no prices: hours is empty and there is no lastGood to fall back on.'],
  ['bad entries', { body: JSON.stringify({ ...snap, hours: snap.hours.map((h, i) => (i % 8 === 0 ? { start: h.start, price: null } : h)) }) }, '12 of 96 prices have no number or no time.'],
]) {
  override = { '/data/snapshot.json': ov };
  const A = await open('light', { noWait: true, expect: /HTTP 404|404 \(Not Found\)|Failed to load resource|requestfailed .*\/data\/snapshot\.json/ });
  await A.page.waitForSelector('#notice:not([hidden])', { timeout: 15000 });
  const s = await A.w(() => ({ lines: [...document.querySelectorAll('#notice p')].map((p) => p.textContent), role: document.getElementById('notice').getAttribute('role'), stamp: document.getElementById('stamp').textContent, tick: document.getElementById('notice').textContent.includes('`'), amp: document.getElementById('notice').textContent.includes('&lt;'), cam: document.body.innerText.includes('c/kWh') }));
  check(JSON.stringify(s.lines) === JSON.stringify([want, 'In Snuggery, Options, then App Files shows what the file holds.']) && s.role === 'alert' && s.stamp === 'No usable prices' && !s.tick && !s.amp && !s.cam,
    `B14, broken data, ${label}: "${s.lines[0]}" on a plate (role alert), no backtick, no escaped entity, words for the menu; no c/kWh, so the camera's wait does not pass`);
  if (label === 'a web page') await A.shot('broken-light', false);
  if (label === 'missing') {
    override = {};
    await A.w(() => document.dispatchEvent(new Event('visibilitychange')));
    await A.page.waitForFunction(() => window.__ph.ready(), null, { timeout: 10000 });
    check(await A.w(() => document.getElementById('notice').hidden && document.body.innerText.includes('c/kWh')), 'the file mended while the app is open: a return reads it, the plate goes and the prices come');
  }
  await closeOut(A, `broken data, ${label}`);
}
override = {};
// the widths: no sideways scroll, the caption inside its lines, the drawing inside the pane, the readout held
for (const [label, wv, hv] of [['320 × 700', 320, 700], ['360 × 740', 360, 740], ['375 × 667', 375, 667], ['390 × 844', 390, 844], ['125 % text (312 × 675)', 312, 675], ['on its side (844 × 390)', 844, 390], ['640 × 900', 640, 900], ['a tablet (820 × 1180)', 820, 1180]]) {
  const A = await open('light', { w: wv, h: hv });
  const r = await A.w(() => {
    const m = document.getElementById('main'), cap = document.getElementById('capline'), p = document.getElementById('pane'), ps = getComputedStyle(p), sv = document.querySelector('#stair svg');
    return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, cap: cap.scrollHeight <= cap.clientHeight + 1, capH: cap.clientHeight, pane: m.clientHeight, head: document.getElementById('head').getBoundingClientRect().height,
      inside: sv.getBoundingClientRect().right <= p.getBoundingClientRect().right - parseFloat(ps.paddingRight) + 0.5, plot: window.__ph.staircase().G.plotH,
      left: [document.querySelector('#pane > *').getBoundingClientRect().left, document.querySelector('h1').getBoundingClientRect().left, cap.getBoundingClientRect().left].map(Math.round) };
  });
  await A.w(() => document.getElementById('stair').focus());
  await A.page.keyboard.press('Home');
  const held = new Set();
  for (let i = 0; i < N; i++) {
    held.add(await A.w(() => { const ro = document.querySelector('.ro'), nx = document.querySelector('.stw').nextElementSibling; return `${Math.round(ro.getBoundingClientRect().height)}/${Math.round(nx.getBoundingClientRect().top)}`; }));
    await A.page.keyboard.press('ArrowRight');
  }
  const hits = await hitTargets(A);
  const land = wv > hv ? r.head <= 47 && r.pane >= 220 && r.plot === 96 : r.plot === 120;
  check(!r.side && r.cap && r.capH === (wv >= 640 ? 15 : 30) && r.inside && held.size === 1 && r.left[0] === r.left[1] && r.left[1] === r.left[2] && land && hits.bad.length === 0,
    `${label}: no sideways scroll, the caption inside its ${wv >= 640 ? 'one line' : 'two lines'}, the drawing inside the pane (plot ${r.plot} px), the readout held at ${[...held][0].split('/')[0]} px with what follows at one top over all ${N} intervals (${held.size} seen), the pane's left edge with the header's and the band's (x ${r.left.join(', ')}), ${hits.n} controls at 44 px or more${wv > hv ? `, the header ${Math.round(r.head)} px, the pane ${Math.round(r.pane)} px tall` : ''}${hits.bad.length ? ': ' + hits.bad.join('; ') : ''}`);
  if (wv === 320) await A.shot('landing-320-light', false);
  if (wv > hv) await A.shot('landing-landscape-light', false);
  await closeOut(A, label);
}
const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png, the README's composite, untouched (${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent'})`);
await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
