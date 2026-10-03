// Drive Outdoor Window in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through CDP),
// light and dark (HOUSE.md section 7.2 as a pane app allows: no player, no focus mode, no units key;
// tools/DECISIONS.md, item 14). The clock is fixed at Mon 21 Sep 2026, 14:20 UTC (10:20 in Boston, inside the
// file) in Oslo's zone, so the stamp and the pictures are the same on every run; other clocks are named where
// they are used. Fails on any console error or warning, page error, failed request, HTTP ≥ 400, or any request
// outside the local server. Every figure it asserts is worked out here from the data files with Node's own
// tools, never by importing js/.
//
// FRAME AND LOAD TIMES ARE HEADLESS CHROMIUM ON THIS MAC: a trend only, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCRUB=0 node tools/shoot.mjs            leave out the three-speed scrub
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the panes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's tabs by role and name, built after the parse; the credits; the face; the stamp),
// every pane's text contrast, the tracer under exactly the chosen tab, SI and the date forms in every visible
// text node, hit targets, the caption band's height and words; the Shutters (every block, bar and window frame
// against this file's decode, the ink and the green sampled on rendered pixels, the slider's value and
// description), the readout against the decode, a tap, a vertical swipe that scrolls and picks nothing, the
// keys, the scrub by real touch at 2, 8 and 20 hours a second. Once: the first Tab, the tabs by keyboard, About,
// the Hours pane's table and its scroll to a tapped hour, hidden and back (the same files, a new forecast, a
// broken replacement, new rules), a broken rules file, four locales (B1), stale, run out, a reader's own file,
// a missing value, broken data at the start and its recovery, Reduce Motion, the widths and a phone on its side.
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
const SCRUB = process.env.SCRUB !== '0';
const schemes = (process.env.SCHEMES || 'light,dark').split(',').filter((s) => s === 'light' || s === 'dark');
const appPng = path.join(SHOTS, 'app.png');
const hashOf = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);
const appPngHash = hashOf(appPng);
const NOW = '2026-09-21T14:20:00Z', TZ = 'Europe/Oslo';   // 10:20 in Boston (UTC−4), 16:20 in Oslo (UTC+2)
const RANOUT = '2026-10-02T10:00:00Z';                     // what a fresh install and the marketing camera see

/* ── the data, decoded here (app.js's header comment is the contract) ── */
const rawSnap = fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8');
const rawRules = fs.readFileSync(path.join(APP, 'data/rules.json'), 'utf8');
const snap = JSON.parse(rawSnap), rules = JSON.parse(rawRules);
const NN = '\u202f', MI = '\u2212';
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const p2 = (n) => String(n).padStart(2, '0');
const OFF = snap.utc_offset_seconds, H = snap.hourly, N = H.time.length;
const t = (iso) => Date.parse(`${iso.slice(0, 16)}Z`) - OFF * 1000;
const local = (ms) => new Date(ms + OFF * 1000);
const clockAt = (ms) => { const d = local(ms); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
const dateAt = (ms) => { const d = local(ms); return `${DAY[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
const spokenAt = (ms) => { const d = local(ms); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${clockAt(ms)}`; };
const v = (x, u) => `${x < 0 ? MI : ''}${Math.abs(x)}${NN}${u}`;
const GEN = Date.parse(snap.generatedAt), osloClock = (ms) => { const d = new Date(ms + 2 * 3600e3); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
const CREDIT = "Weather data by Open-Meteo.com, under CC\u00a0BY\u00a04.0. The free API is for non-commercial use. The forecast is Open-Meteo's, unmodified; the scores and the ask table beside it are this app's.";
const CAP = { Windows: 'Ink: hours a rule rules out. Green: how much of its limit an hour uses. Framed gaps are windows.',
  Hours: 'Hours in Boston Common’s own time, UTC−4. Air and dew point in °C, rain chance in %, rainfall in mm, gusts in km/h.',
  Rules: 'Read from data/rules.json. An hour must clear every rule, in the forecast’s own units.' };
const PANES = ['Windows', 'Hours', 'Rules'];
/** The scorer, written here from js/score.js's header comment: per hour, each rule's [label, ok, comfort]. */
function score(s = snap, r = rules) {
  const h = s.hourly, sun = {};
  s.daily.time.forEach((d, i) => { sun[d] = [t(s.daily.sunrise[i]), t(s.daily.sunset[i])]; });
  const real = (x) => typeof x === 'number' && Number.isFinite(x), light = String(r.daylight || 'any').toLowerCase(), gold = (r.goldenHourMinutes || 0) * 60000;
  return h.time.map((iso, i) => {
    const at = t(iso), [rise, set] = sun[iso.slice(0, 10)], golden = gold > 0 && ((at >= rise && at <= rise + gold) || (at >= set - gold && at <= set));
    const c = [];
    const most = (label, x, L) => { if (!real(L)) return; c.push(real(x) ? [label, x <= L, Math.max(0, Math.min(1, (L - x) / L))] : [label, false, 0, true]); };
    const band = (label, x, B) => { if (!B || !real(B.min) || !real(B.max)) return; const w = (B.max - B.min) / 2; c.push(real(x) ? [label, x >= B.min && x <= B.max, Math.max(0, Math.min(1, (w - Math.abs(x - (B.max + B.min) / 2)) / w))] : [label, false, 0, true]); };
    most('rain chance', h.precipitation_probability[i], r.maxRainChancePct);
    most('rainfall', h.precipitation[i], r.maxPrecipMm);
    most('gusts', h.wind_gusts_10m[i], r.maxGustKmh);
    band('temperature', h.temperature_2m[i], r.temperatureC);
    band('dew point', h.dew_point_2m[i], r.dewPointC);
    if (light === 'daylight') c.push(['daylight', h.is_day[i] === 1, h.is_day[i] === 1 ? 1 : 0]);
    if (light === 'golden') c.push(['golden hour', golden, golden ? 1 : 0]);
    return { i, at, c, pass: c.every((x) => x[1]), score: Math.round((100 * c.reduce((a, x) => a + x[2], 0)) / c.length), blocked: c.filter((x) => !x[1]).map((x) => x[0]), light: golden ? 'golden' : h.is_day[i] === 1 ? 'day' : 'night', rise, set };
  });
}
const S0 = score();
const windowsOf = (rows) => { const out = []; let run = []; for (const r of [...rows, null]) { if (r && r.pass) run.push(r); else { if (run.length >= Math.ceil(rules.minWindowHours)) out.push(run); run = []; } } return out; };
const list = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const verdict = (r) => `${r.pass ? 'clears every rule' : `ruled out by ${list(r.blocked)}`}, score ${r.score}`;
/** The hour the clock `now` is in says so in the readout and the slider's value (after review). */
const isNowHour = (r, now) => now != null && r.at <= now && now < r.at + 3600e3;
const said = (r, now) => `${isNowHour(r, now) ? 'now, ' : ''}${verdict(r)}`;
const valueOf = (r, now) => `${spokenAt(r.at)}${isNowHour(r, now) ? ', now' : ''}: ${verdict(r)}`;
/** The readout's second line for an hour, as ART.md section 3 gives it. */
function valuesOf(r, now) {
  const out = [`air ${v(H.temperature_2m[r.i], '°C')}`, `rain chance ${v(H.precipitation_probability[r.i], '%')}`, `rainfall ${v(H.precipitation[r.i], 'mm')}`, `gusts ${v(H.wind_gusts_10m[r.i], 'km/h')}`, `dew point ${v(H.dew_point_2m[r.i], '°C')}`, `cloud ${v(H.cloud_cover[r.i], '%')}`,
    r.light === 'golden' ? 'golden hour' : r.light === 'day' ? 'daylight' : 'night'];
  if (r.rise >= r.at && r.rise < r.at + 3600e3) out.push(`sunrise ${clockAt(r.rise)}`);
  if (r.set >= r.at && r.set < r.at + 3600e3) out.push(`sunset ${clockAt(r.set)}`);
  if (now != null && r.at + 3600e3 <= now) out.push('already past');
  return out.join(', ');
}

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

/* ── the server: the app folder, with either data file replaceable ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = {};
const reads = { '/data/snapshot.json': 0, '/data/rules.json': 0 };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), ov = override[u];
  if (u in reads) reads[u]++;
  if (ov) { if (ov.status) { res.writeHead(ov.status); res.end(); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(u)] || 'application/octet-stream' }); res.end(ov.body); return; }
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
const ready = () => window.__ow && window.__ow.ready();

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference', timezoneId: TZ, locale: o.locale || 'en-US' });
  const page = await ctx.newPage(), errors = [];
  await page.clock.setFixedTime(new Date(o.time || NOW));
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
  const pane = async (name) => { await page.getByRole('tab', { name, exact: true }).click(); await page.waitForTimeout(250); };
  return { ctx, page, errors, ms, w, cdp, touch, tapAt, rect, png, frame, shot, pane };
}
const closeOut = async (A, label) => { check(A.errors.length === 0, `${label}: no console error or warning, failed or outside request${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`); await A.ctx.close(); };

/* Text contrast over every rendered DOM text node (backgrounds composited), and every SVG label's fill on the page. */
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
  for (let y = 0; y < Hgt; y += 400) {
    const r = await A.w((top) => {
      document.getElementById('main').scrollTop = top;
      const out = { bad: [], seen: [] };
      for (const e of document.querySelectorAll('button, [role="tab"], [role="slider"], a, input')) {
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
 *  unit, a decimal comma, four or more digits ungrouped, a 12-hour clock or a locale's date form (B1, B10). */
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
    if (/(^|[^\w])-\d/.test(s) || /\d (h|d|min|%|mm|m|km\/h|°C)(?![\w/])/.test(s) || /\d\d?°C|\d%/.test(s) || /\d,\d/.test(s) || /\b(AM|PM)\b|\d+\.\s?(jan|feb|mar|apr|mai|jun|jul|aug|sep|okt|nov|des)|[月日火水木金土]|Sept\b/i.test(s) || ungrouped) bad.push(s.trim().slice(0, 50));
  }
  return { n, bad };
});
/** The Shutters as drawn: per row its name, blocks (hour runs), hollows and bars (hour, px); the windows (sills, lit openings, jambs); `now`; the geometry. */
const drawnOf = (w) => w(() => {
  const svg = document.querySelector('#sh svg'), M = window.__ow.shutters(), { x0, ph } = M.G;
  const hr = (x) => Math.round((x - x0) / ph);
  const rows = [...svg.querySelectorAll('g.r')].map((g) => ({
    name: g.querySelector('text').textContent,
    count: g.querySelectorAll('text')[1] ? g.querySelectorAll('text')[1].textContent : '',
    blocks: [...g.querySelectorAll('rect.blk')].map((r) => [hr(+r.getAttribute('x')), hr(+r.getAttribute('x') + +r.getAttribute('width') + 1) - 1, r.classList.contains('past')]),
    hollows: [...g.querySelectorAll('rect.ho')].map((r) => [hr(+r.getAttribute('x') - 0.5), hr(+r.getAttribute('x') - 0.5 + +r.getAttribute('width') + 2) - 1]),
    bars: [...g.querySelectorAll('rect.u')].map((r) => [hr(+r.getAttribute('x')), +r.getAttribute('height'), +r.getAttribute('width')]),
  }));
  const br = [...svg.querySelectorAll('rect.br')].filter((r) => +r.getAttribute('height') === 2).map((r) => [hr(+r.getAttribute('x')), hr(+r.getAttribute('x') + +r.getAttribute('width') + 1) - 1]);
  // a window drawn as one: its lit opening (from the stack's top to the sill) and its two jambs, in hours
  const lit = [...svg.querySelectorAll('rect.lit')].map((r) => [hr(+r.getAttribute('x')), hr(+r.getAttribute('x') + +r.getAttribute('width') + 1) - 1, +r.getAttribute('y'), +r.getAttribute('y') + +r.getAttribute('height')]);
  const jb = [...svg.querySelectorAll('rect.jb')].map((r) => [(+r.getAttribute('x') + 1 - x0) / ph, +r.getAttribute('y'), +r.getAttribute('y') + +r.getAttribute('height')]);
  const nowl = [...svg.querySelectorAll('text.nowl')].map((t) => [t.textContent, +t.getAttribute('x'), +t.getAttribute('y')]);
  return { rows, br, lit, jb, nowl, G: M.G, now: svg.querySelector('rect.now') ? +svg.querySelector('rect.now').getAttribute('x') : null };
});
/** The hour whose column a client x falls in, from the drawn geometry. */
const xOfHour = async (A, i) => { const s = await A.rect('#sh svg'), G = await A.w(() => window.__ow.shutters().G); return { x: s.left + G.x0 + i * G.ph + G.ph / 2, y: s.top + G.top + 2 * 19 + 8, s, G }; };
const stateOf = (w) => w(() => {
  const sh = document.getElementById('sh'), head = sh.querySelector('.head circle:last-child'), M = window.__ow.shutters();
  return { chosen: window.__ow.chosen(), now: +sh.getAttribute('aria-valuenow'), text: sh.getAttribute('aria-valuetext'), head: +head.getAttribute('cx'), center: M.G.x0 + window.__ow.chosen() * M.G.ph + (M.G.ph - 1) / 2,
    when: document.querySelector('.ro-when b').textContent, verdict: document.querySelector('.ro-when span').textContent, vals: document.querySelector('.ro-vals').textContent, live: document.getElementById('live').textContent };
});

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
const nowMs = Date.parse(NOW), left = S0.filter((r) => r.at + 3600e3 > nowMs), WIN = windowsOf(left);
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the first pane: ${A.ms} ms (headless)`);
  const PAGE = scheme === 'light' ? [0xe8, 0xee, 0xf0] : [0x14, 0x1d, 0x21];

  // boot: the camera's tabs by role and name, the credits, the face, the stamp
  {
    const tabs = await Promise.all(PANES.map((n) => page.getByRole('tab', { name: n, exact: true }).count()));
    const cam = await w(() => ['Windows', 'Hours'].map((n) => [...document.querySelectorAll('button, [role], a')].filter((b) => (b.getAttribute('aria-label') || b.textContent.trim()) === n).map((b) => `${b.tagName} ${b.getAttribute('role')}`)));
    const b = await w(() => {
      const c = document.getElementById('credits'), r = c.getBoundingClientRect();
      return { credits: c.textContent.replace(/[ \t\n]+/g, ' ').trim(), anchors: [...c.querySelectorAll('a')].map((a) => a.getAttribute('href')), whole: r.height > 0 && r.bottom <= innerHeight + 1, face: document.fonts.check('400 10.5px "Ysabeau Office"'),
        loaded: [...document.fonts].filter((f) => f.status === 'loaded').length, stamp: document.getElementById('stamp').textContent, pane: window.__ow.pane(), idle: window.__frames };
    });
    check(tabs.every((n) => n === 1), `the panes as tabs by name: ${PANES.map((p, i) => `${p} ${tabs[i]}`).join(', ')}`);
    check(cam.every((r) => r.length === 1 && r[0] === 'BUTTON tab'), `the camera's strings: Windows and Hours, each exactly one <button role="tab"> named by its word (${cam.map((r) => r.join('/')).join(', ')}), built after the parse`);
    check(b.credits === CREDIT && b.anchors.join() === 'https://open-meteo.com/,https://creativecommons.org/licenses/by/4.0/' && b.whole, 'the credits on screen word for word, with their two anchors');
    check(b.face && b.loaded === 1, `the face is loaded before the Shutters measure their labels (${b.loaded} face)`);
    check(b.stamp === `Updated ${osloClock(GEN)}` && b.pane === 'windows', `the stamp: "${b.stamp}" (built here: "Updated ${osloClock(GEN)}", the phone's clock in Oslo); the app opens on Windows`);
    check(b.idle === 0, `idle: the page asked for ${b.idle} animation frames after loading (nothing runs while nothing is touched)`);
  }

  // every pane: text contrast, the face, the tracer, SI and dates, hit targets, the band's height and words
  const bandH = [];
  for (const name of PANES) {
    await A.pane(name);
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5 && c.faces.every((f) => f === 'Ysabeau Office'), `${name}: ${c.n} text nodes and labels in view, the lowest ${c.worst[0]}:1 (${c.worst[1]}); faces ${c.faces.join(', ')} (B8)`);
    const tr = await w(() => [...document.querySelectorAll('.tabs button')].map((b) => [b.textContent, b.getAttribute('aria-selected') === 'true', getComputedStyle(b, '::after').content !== 'none']));
    check(tr.every(([, on, has]) => on === has) && tr.filter(([, on]) => on).map(([x]) => x).join() === name, `${name}: the tracer under exactly the chosen tab`);
    const si = await siOf(w);
    check(si.bad.length === 0, `${name}: SI and the date forms in ${si.n} visible text nodes (B1, B10)${si.bad.length ? ': ' + si.bad.slice(0, 5).join(' | ') : ''}`);
    const hits = await hitTargets(A);
    check(hits.bad.length === 0 && hits.n >= 6, `${name}: ${hits.n} controls (the stamp, the tabs, the slider, the credit anchors), every one 44 × 44 or more (B6)${hits.bad.length ? ': ' + hits.bad.slice(0, 5).join('; ') : ''}`);
    const g = await w(() => { const m = document.getElementById('main'); return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, cap: document.getElementById('capline').textContent }; });
    check(!g.side, `${name}: nothing runs past the pane's width`);
    check(g.cap === CAP[name], `${name}: the caption "${g.cap}"`);
    bandH.push(await w(() => document.getElementById('band').getBoundingClientRect().height));
    await A.shot(`${name.toLowerCase()}-${scheme}`);
  }
  check(new Set(bandH).size === 1, `the caption band holds its height on every pane (${bandH.join(', ')} px): the pane above it never resizes`);

  // the Shutters: every block, bar and window against this file's decode
  await A.pane('Windows');
  {
    const D = await drawnOf(w), past = (i) => S0[i].at + 3600e3 <= nowMs;
    const runs = (test) => { const out = []; for (let i = 0; i < N; i++) if (test(i)) { const l = out[out.length - 1]; if (l && l[1] === i - 1 && l[2] === past(i)) l[1] = i; else out.push([i, i, past(i)]); } return out; };
    const want = S0[0].c.map((_, k) => ({ blocks: runs((i) => !S0[i].c[k][1]), bars: S0.flatMap((r) => (r.c[k][1] && Math.round(12 * (1 - r.c[k][2])) >= 1 ? [[r.i, Math.round(12 * (1 - r.c[k][2])), 2]] : [])), out: S0.filter((r) => !r.c[k][1]).length }));
    const same = D.rows.length === 6 && D.rows.every((r, k) => JSON.stringify(r.blocks) === JSON.stringify(want[k].blocks) && JSON.stringify(r.bars) === JSON.stringify(want[k].bars) && r.hollows.length === 0 && r.count === (want[k].out ? `${want[k].out}${NN}h` : ''));
    check(same && D.G.ph === 5 && D.G.x0 === 64, `the Shutters at 390 px: ${D.G.ph} px an hour from x ${D.G.x0}; ${D.rows.map((r) => `${r.name} ${r.blocks.length} blocks, ${r.bars.length} bars${r.count ? `, ${r.count.replace(NN, ' ')}` : ''}`).join('; ')}: every block (split where the hours turn past), bar height (round(12 × used), 2 px wide) and count as decoded here`);
    const wantBr = WIN.map((x) => [x[0].i, x[x.length - 1].i]), nowX = 64 + ((nowMs - S0[0].at) / 3600e3) * 5;
    const framed = JSON.stringify(D.lit.map((l) => [l[0], l[1]])) === JSON.stringify(wantBr) && D.lit.every((l) => l[2] === D.G.top && l[3] === D.G.brY)
      && JSON.stringify(D.jb.map((j) => j[0])) === JSON.stringify(wantBr.flatMap((b) => [b[0], b[1] + 1])) && D.jb.every((j) => j[1] === D.G.top && j[2] === D.G.brY);
    check(JSON.stringify(D.br) === JSON.stringify(wantBr) && framed, `the windows from the present on, each drawn as one: lit from the stack's top (y ${D.G.top}) to its sill (y ${D.G.brY}), an ink jamb up the stack at each edge and the sill under it, over hours ${D.br.map((b) => `${b[0]}–${b[1]}`).join(', ')} (decoded: ${wantBr.map((b) => `${b[0]}–${b[1]}`).join(', ')})`);
    const axis = await w(() => window.__ow.shutters().labels.join(', '));
    check(D.now === Math.round(nowX) && D.nowl.length === 1 && D.nowl[0][0] === 'now' && Math.abs(D.nowl[0][1] - nowX) < 1e-9 && D.G.top === 17 && D.G.base - 8.5 > D.G.rb,
      `now at hour ${((nowMs - S0[0].at) / 3600e3).toFixed(2)}, in its own row over the stack, its notch at x ${D.now} hanging to the rows (y 12 to ${D.G.top}), where the tracer head (on the axis, from y ${D.G.base - 8.5}) can never cover it; the axis' labels ${axis}`);
    const faint = await w(() => [...document.querySelectorAll('#sh .past')].every((e) => getComputedStyle(e).opacity === '0.4') && document.querySelectorAll('#sh .past').length);
    check(faint > 0, `the hours already past drawn at 40 % (${faint} marks)`);
    // the ink and the green on rendered pixels
    const SHEET = scheme === 'light' ? [0xf6, 0xf9, 0xfa] : [0x1c, 0x27, 0x2c];
    const marks = await w(() => {
      const M = window.__ow.shutters(), inWin = (r) => { const i = Math.floor((+r.getAttribute('x') - M.G.x0) / M.G.ph); return M.brackets.some((b) => b.from <= i && i <= b.to); };
      const box = (r) => ({ ...r.getBoundingClientRect().toJSON(), lit: inWin(r) });
      return { blk: [...document.querySelectorAll('#sh rect.blk:not(.past)')].map(box), u: [...document.querySelectorAll('#sh rect.u:not(.past)')].filter((r) => +r.getAttribute('height') >= 3).map(box),
        jb: [...document.querySelectorAll('#sh rect.jb')].map((r) => r.getBoundingClientRect().toJSON()), lit: [...document.querySelectorAll('#sh rect.lit')].map((r) => r.getBoundingClientRect().toJSON()) };
    });
    // every mark against the ground it stands on: the lit opening inside a window, the page elsewhere
    const img = await A.png(), sample = (rs) => { const s = []; for (const r of rs) for (let x = Math.round(r.left * 2) + 1; x < Math.round(r.right * 2) - 1; x++) for (let y = Math.round(r.top * 2) + 1; y < Math.round(r.bottom * 2) - 1; y++) s.push(contrast(img.at(x, y), r.lit ? SHEET : PAGE)); return s; };
    for (const [what, rs, target] of [['ink blocks', marks.blk, scheme === 'light' ? '14.80' : '14.43'], ['green bars', marks.u, scheme === 'light' ? '3.61 on the page, 4.00 in a window' : '4.61 on the page, 4.11 in a window']]) {
      const s = sample(rs), at3 = s.filter((x) => x >= 3).length / s.length;
      check(s.length > 100 && at3 >= 0.9, `the Shutters' ${what}: ${s.length} samples inside ${rs.length} marks (${rs.filter((r) => r.lit).length} in a window), ${(at3 * 100).toFixed(1)} % at 3:1 or more on their ground (palette.py: ${target}; the lowest sample ${Math.min(...s).toFixed(2)}, where the chosen hour's 7 % ink column lies behind a mark)`);
    }
    // the frame and the light inside it, on pixels: each jamb's center column ink, each opening --sheet in the gaps between rows
    const jamb = marks.jb.map((r) => { let n = 0, k = 0; for (let y = Math.round(r.top * 2) + 2; y < Math.round(r.bottom * 2) - 2; y++, n++) if (contrast(img.at(Math.round(r.left * 2) + 1, y), PAGE) >= 3) k++; return k / n; });
    const glow = marks.lit.map((r) => { const rowGap = (q) => Math.round((r.top + 16 + q * 19 + 1.5) * 2); let n = 0, k = 0; for (let x = Math.round(r.left * 2) + 2; x < Math.round(r.right * 2) - 2; x++) for (let q = 0; q < 5; q++, n++) { const c = img.at(x, rowGap(q)); if (Math.abs(c[0] - SHEET[0]) + Math.abs(c[1] - SHEET[1]) + Math.abs(c[2] - SHEET[2]) <= 6) k++; } return k / n; });
    check(jamb.length === 2 * WIN.length && jamb.every((f) => f >= 0.97) && glow.every((f) => f >= 0.85), `the windows on rendered pixels: ${jamb.length} jambs, ${jamb.map((f) => `${(f * 100).toFixed(0)} %`).join(', ')} of each one's height at 3:1 or more on the page; the openings ${glow.map((f) => `${(f * 100).toFixed(0)} %`).join(', ')} --sheet in the gaps between the rows (the rest a midnight hairline or the chosen column)`);
    // the slider's value and description, and the readout, against the decode
    const ch = WIN[0][0], st = await stateOf(w), desc = await w(() => document.getElementById('sh-desc').textContent);
    const named = await w(() => { const s = document.getElementById('sh'); return [s.getAttribute('role'), s.getAttribute('aria-label'), s.getAttribute('aria-valuemin'), s.getAttribute('aria-valuemax'), s.tabIndex, s.getAttribute('aria-describedby')]; });
    const outs = S0[0].c.map((_, k) => [S0[0].c[k][0], S0.filter((r) => !r.c[k][1]).length]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
    const wantDesc = `48 hours from ${spokenAt(S0[0].at)}. ${outs[0][0][0].toUpperCase()}${outs[0][0].slice(1)} rules out ${outs[0][1]} hours and ${outs[1][0]} ${outs[1][1]}; rain chance, rainfall, temperature and dew point none. Windows: ${WIN.map((x) => `${spokenAt(x[0].at).split(' ')[0]} ${clockAt(x[0].at)} to ${clockAt(x[x.length - 1].at + 3600e3)}, ${x.length} hours`).join('; ')}.`;
    check(named.join() === 'slider,Hour,0,47,0,sh-desc' && st.chosen === ch.i && st.now === ch.i && st.text === valueOf(ch, nowMs) && isNowHour(ch, nowMs) && desc === wantDesc,
      `the slider: role slider, named Hour, 0 to 47, at the next window's first hour (${st.now}), its value "${st.text}"; described once: "${desc.slice(0, 80)}…"`);
    check(st.when === `${dateAt(ch.at)}, ${clockAt(ch.at)}` && st.verdict === ` ${said(ch, nowMs)}` && st.vals === valuesOf(ch, nowMs) && Math.abs(st.head - st.center) < 1e-9,
      `the readout, as decoded here: "${st.when}${st.verdict}" (the present hour says now) / "${st.vals}"; the head on its column`);
    // a pinch that starts on the Shutters belongs to the page: the drawing allows it, and two fingers never scrub
    const ta = await w(() => getComputedStyle(document.getElementById('sh')).touchAction);
    const pin = await xOfHour(A, 20), before = await w(() => window.__ow.chosen());
    await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pin.x, y: pin.y, id: 1 }, { x: pin.x + 20, y: pin.y + 4, id: 2 }] });
    for (let k = 1; k <= 8; k++) { await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pin.x - 6 * k, y: pin.y, id: 1 }, { x: pin.x + 20 + 6 * k, y: pin.y + 4, id: 2 }] }); await page.waitForTimeout(16); }
    await A.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(250);
    const pinched = await w(() => ({ chosen: window.__ow.chosen(), pressed: document.querySelector('#sh .head circle:last-child').getAttribute('r'), scale: visualViewport.scale }));
    check(ta === 'pan-y pinch-zoom' && pinched.chosen === before && pinched.pressed === '4', `a pinch that starts on the Shutters: touch-action "${ta}", so the page may zoom (headless Chromium's visual viewport ended at a scale of ${pinched.scale.toFixed(2)}; the phone check is in tools/DECISIONS.md); two fingers moving apart sideways leave the hour where it was (${pinched.chosen})`);
    // a tap on the Shutters: Tuesday 11:00, said once
    const tue = S0.find((r) => dateAt(r.at) === 'Tue 22 Sep' && clockAt(r.at) === '11:00'), p = await xOfHour(A, tue.i);
    await w(() => { document.getElementById('live').textContent = ''; });
    await A.tapAt(p.x + 1, p.y);
    await page.waitForTimeout(300);
    const s2 = await stateOf(w);
    const sayVals = valuesOf(tue).replace(/\u202f°C/g, ' degrees Celsius').replace(/\u202fkm\/h/g, ' kilometers an hour').replace(/\u202f%/g, ' percent').replace(/\u202fmm/g, ' millimeters');
    check(s2.chosen === tue.i && s2.now === tue.i && s2.when === 'Tue 22 Sep, 11:00' && s2.vals === valuesOf(tue, nowMs) && Math.abs(s2.head - s2.center) < 1e-9 && s2.live === `${spokenAt(tue.at)}: ${verdict(tue)}. ${sayVals}.`,
      `a tap on Tuesday 11:00's column picks it: the head, the readout ("${s2.when}${s2.verdict}") and the value move; said once: "${s2.live.slice(0, 90)}…"`);
    await A.shot(`tapped-${scheme}`, false);
    const lc = await A.rect('#sh svg');
    await A.tapAt(lc.left + 10, p.y);
    await page.waitForTimeout(200);
    check(await w(() => window.__ow.chosen()) === tue.i, 'a tap on a row\'s name picks nothing');
    // a vertical swipe that starts on the Shutters scrolls the pane, picks nothing and says nothing (HOUSE 4.7); on
    // the Hours pane, which is long enough to scroll
    await A.pane('Hours');
    await w(() => { document.getElementById('main').scrollTop = 0; document.getElementById('live').textContent = ''; });
    const s0 = await xOfHour(A, 30);
    await A.touch('touchStart', s0.x, s0.y + 40);
    for (let k = 1; k <= 14; k++) { await A.touch('touchMove', s0.x + (k % 2), s0.y + 40 - 12 * k); await page.waitForTimeout(16); }
    await A.touch('touchEnd');
    await page.waitForTimeout(400);
    const dr = await w(() => ({ chosen: window.__ow.chosen(), live: document.getElementById('live').textContent, top: document.getElementById('main').scrollTop }));
    check(dr.chosen === tue.i && dr.live === '' && dr.top > 60, `a vertical swipe that starts on the Shutters scrolls the Hours pane by ${Math.round(dr.top)} px, picks nothing and says nothing`);
    await A.pane('Windows');
    // the keys: one hour, six, the ends; the slider says its own value, so the live region adds nothing
    await w(() => { document.getElementById('sh').focus(); document.getElementById('live').textContent = ''; });
    const seq = [];
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown']) { await page.keyboard.press(k); seq.push((await stateOf(w)).now); }
    const kl = await w(() => document.getElementById('live').textContent);
    check(seq.join() === [tue.i + 1, tue.i, tue.i - 1, tue.i + 5, tue.i - 1, 0, 47, 47, 46].join() && kl === '', `the keys: → ← ← PageUp PageDown Home End ↑ ↓ give ${seq.join(', ')}; nothing said through the live region`);
    // the scrub by real touch, at 2, 8 and 20 hours a second, a move every 16 ms (HOUSE 4.6's rule as a slider takes it)
    if (SCRUB) {
      await w(() => {
        window.__log = [];
        // the last finger position the page has received: CDP's touch call can return before headless Chromium
        // hands the move to the page (it arrives with a later frame), so "after every move" means after the page
        // has it, as Global Weather's log compares each drawn frame with the finger the page itself was given
        window.__fx = null;
        document.addEventListener('pointermove', (e) => { window.__fx = e.clientX; }, true);
        const step = () => {
          const sh = document.getElementById('sh'), M = window.__ow.shutters();
          if (sh && M) {
            const i = window.__ow.chosen(), head = +sh.querySelector('.head circle:last-child').getAttribute('cx');
            window.__log.push({ i, now: +sh.getAttribute('aria-valuenow'), head: Math.abs(head - (M.G.x0 + i * M.G.ph + (M.G.ph - 1) / 2)) < 1e-9, when: document.querySelector('.ro-when b').textContent, anims: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#sh, .ro')).length });
          }
          if (window.__log.length < 100000 && !window.__stop) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      const labelOf = (i) => `${dateAt(S0[i].at)}, ${clockAt(S0[i].at)}`;
      for (const speed of [2, 8, 20]) {
        const a = await xOfHour(A, 4), G = a.G, from = 4, moves = speed === 2 ? 70 : 40, dx = (speed * G.ph * 16) / 1000;
        await w(() => { window.__log.length = 0; });
        await A.touch('touchStart', a.x - G.ph / 2 + 1, a.y);
        let x = a.x - G.ph / 2 + 1, after = [], seen = [], lost = 0;
        const t0 = Date.now();
        for (let k = 0; k < moves; k++) {
          x += dx;
          if (k === 0) x += 7;   // past the 6 px that tells a sideways drag from a tap
          const xi = Math.round(x);   // CDP delivers touch points in whole CSS pixels
          await A.touch('touchMove', xi, a.y + (k % 3) - 1);
          const got = await w((v) => new Promise((r) => { const t = performance.now(), go = () => (window.__fx === v ? r(true) : performance.now() - t > 500 ? r(false) : requestAnimationFrame(go)); go(); }), xi);
          if (!got) lost++;
          await A.frame();
          const want = Math.max(0, Math.min(47, Math.floor((xi - a.s.left - G.x0) / G.ph)));
          const st = await stateOf(w);
          if (st.chosen !== want || st.now !== want || st.when !== labelOf(want) || Math.abs(st.head - st.center) > 1e-9) after.push(`${want}:${st.chosen}`);
          if (seen[seen.length - 1] !== st.chosen) seen.push(st.chosen);
        }
        const ms = (Date.now() - t0) / moves;
        await A.touch('touchEnd');
        await A.frame();
        const end = Math.floor((Math.round(x) - a.s.left - G.x0) / G.ph), last = await stateOf(w);
        const log = await w(() => window.__log.slice());
        const bad = log.filter((f) => f.i !== f.now || !f.head || f.anims);
        const labelsBad = log.filter((f) => f.when !== labelOf(f.i)).length;
        const inOrder = seen.every((s, k) => k === 0 || s === seen[k - 1] + 1);
        check(lost === 0 && after.length === 0 && bad.length === 0 && labelsBad === 0 && last.chosen === end && (speed !== 2 || inOrder) && log.length > 10,
          `the scrub at ${speed} hours a second (${moves} moves, ${ms.toFixed(1)} ms each in headless): after every move, once the page has it (${lost} never arrived), and one drawn frame, the head, the readout and the value show the hour under the finger (${after.length} differ); over ${log.length} drawn frames ${bad.length + labelsBad} frames differ between the chosen hour, the value, the head and the readout's label, and no animation runs on them; ${speed === 2 ? `every hour drawn in order (${seen.join(' ')}); ` : ''}the lift lands on hour ${last.chosen}`);
        await page.waitForTimeout(150);
      }
      await w(() => { window.__stop = true; });
      const pr = await w(() => document.querySelector('#sh .head circle:last-child').getAttribute('r'));
      check(pr === '4', `the head back to 8 px after the lift (r ${pr})`);
    }
  }
  await closeOut(A, scheme);
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once');
{
  const A = await open('light');
  const { page, w } = A;
  // the first Tab after the load lands on the stamp, the first control
  {
    await w(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Tab');
    const first = await w(() => document.activeElement.id || document.activeElement.textContent);
    check(first === 'stamp', `the first Tab after the load: ${first} (the stamp, then the chosen tab)`);
  }
  // the tabs by keyboard
  {
    await w(() => document.querySelector('.tabs [aria-selected="true"]').focus());
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(250);
    const k = await w(() => [window.__ow.pane(), document.activeElement.textContent, document.getElementById('live').textContent]);
    await page.keyboard.press('End');
    await page.waitForTimeout(200);
    const e = await w(() => [window.__ow.pane(), document.activeElement.textContent]);
    await page.keyboard.press('Home');
    await page.waitForTimeout(200);
    const h = await w(() => [window.__ow.pane(), document.activeElement.textContent]);
    check(k.join() === 'hours,Hours,' && e.join() === 'rules,Rules' && h.join() === 'windows,Windows', `the tabs by keyboard: ArrowRight chooses ${k[1]}, End ${e[1]}, Home ${h[1]}; focus follows, the live region adds nothing`);
  }
  // the Windows pane's words, as decoded here
  {
    const x = WIN[0], wd = await w(() => ({ h2: [...document.querySelectorAll('.sec > h2')].map((n) => n.textContent), fig: document.querySelector('.fig').textContent, facts: [...document.querySelectorAll('.facts')].map((d) => [...d.children].map((n) => n.textContent).join('|')),
      st: [...document.querySelectorAll('.statement')].map((n) => n.textContent), title: document.querySelector('.title').textContent }));
    const mx = (k) => Math.max(...x.map((r) => H[k][r.i]));
    const wantFacts = [`Warmest|${v(mx('temperature_2m'), '°C')}|Highest chance of rain|${v(mx('precipitation_probability'), '%')}|Most rainfall|${v(mx('precipitation'), 'mm')}|Strongest gust|${v(mx('wind_gusts_10m'), 'km/h')}|Highest dew point|${v(mx('dew_point_2m'), '°C')}|Sunset|18:43`,
      WIN.slice(1).map((y) => `${dateAt(y[0].at)}, ${clockAt(y[0].at)}–${clockAt(y[y.length - 1].at + 3600e3)}|${y.length} hours, best score ${Math.max(...y.map((r) => r.score))}`).join('|')];
    check(wd.h2.join() === 'Next window,After that' && wd.fig === `${clockAt(x[0].at)}–${clockAt(x[x.length - 1].at + 3600e3)}${dateAt(x[0].at)}, ${x.length} hours, best score ${Math.max(...x.map((r) => r.score))}` && JSON.stringify(wd.facts) === JSON.stringify(wantFacts),
      `Windows: "${wd.fig}"; ${wd.facts[0].split('|').join(' ')}; after that ${wd.facts[1].replace('|', ', ')} (the window's last hour runs past the sunset, so the sunset is printed)`);
    const foot = await w(() => { const n = [...document.querySelectorAll('#pane > .sec')].pop().querySelector('.note'); return [n && n.textContent, document.querySelector('.statement').getBoundingClientRect().height]; });
    check(wd.st.join() === 'Example forecast: Boston Common, 21 to 23 Sep 2026.' && foot[1] <= 30 && wd.title === `A walk outsideBoston Common, 42.37°${NN}N, 71.06°${NN}W` && foot[0] === 'Build the Shortcut in PROMPT.md and the app shows where you are.',
      `the statement on one line (${Math.round(foot[1])} px), "${wd.st[0]}", so the Shutters lead; the heading "${rules.activity}" over "Boston Common, 42.37° N, 71.06° W"; the pane closes with "${foot[0]}"`);
  }
  // the Rules pane, as rules.json gives it
  {
    await A.pane('Rules');
    const r = await w(() => [...document.querySelectorAll('.rule')].map((g) => [...g.children].map((n) => n.textContent)));
    const want = [['Rain chance', `≤ 30${NN}%`], ['Rainfall', `≤ 0.2${NN}mm`], ['Gusts', `≤ 35${NN}km/h`], ['Temperature', `2 to 26${NN}°C`], ['Dew point', `${MI}10 to 17${NN}°C`], ['Light', 'Daylight only'], ['Shortest window', '2 hours']];
    const outN = S0[0].c.map((_, k) => S0.filter((q) => !q.c[k][1]).length);
    check(r.length === 7 && r.every((g, i) => g[0] === want[i][0] && g[1] === want[i][1]) && r[2][2].endsWith(`Rules out ${outN[2]} of 48 hours.`) && r[5][2].endsWith(`Rules out ${outN[5]} of 48 hours.`),
      `Rules: ${r.map((g) => `${g[0]} ${g[1]}`).join('; ').replace(/\u202f/g, ' ')}; gusts rule out ${outN[2]} of 48 hours, daylight ${outN[5]}`);
    const steps = await w(() => [...document.querySelectorAll('.steps li')].map((n) => n.textContent));
    check(steps[0] === 'In Snuggery, Options, then App Files: data/rules.json.' && steps.length === 3, `Changing them: an ordered list of ${steps.length}, "${steps[0]}" (B14)`);
    await A.pane('Windows');
  }
  // About: opens from the stamp, holds the rest inert, carries the credits, closes on Escape
  {
    const s = await A.rect('#stamp');
    await A.tapAt(s.left + 20, s.top + s.height / 2);
    await page.waitForTimeout(400);
    const a = await w(() => ({ open: !document.getElementById('about').hidden, inert: ['head', 'main', 'band'].every((id) => document.getElementById(id).inert), focus: document.activeElement.id,
      text: document.querySelector('.about-body').textContent.replace(/[ \t\n]+/g, ' '),
      list: [...document.querySelectorAll('#about-list dt')].map((d, i) => `${d.textContent} ${document.querySelectorAll('#about-list dd')[i].textContent}`) }));
    const wantList = ['Place: Boston Common (an example)', `Grid point: 42.37°${NN}N, 71.06°${NN}W, 16${NN}m`, `Time zone: America/New York, UTC${MI}4`, 'Forecast: Mon 21 Sep 2026, 05:00 to Wed 23 Sep 2026, 05:00, 48 hours',
      'Updated: Mon 21 Sep 2026, 11:35 (UTC+2), from the file’s own time', 'Stale after: 6 hours', 'Rules: data/rules.json', 'Ask table: 48 rows'];
    check(a.open && a.inert && a.focus === 'about-close' && a.text.includes(CREDIT) && a.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.') && a.text.includes('open-meteo.com') && a.text.includes('creativecommons.org/licenses/by/4.0/') && !/https?:/.test(a.text),
      'About opens from the stamp, focus on Close, the rest inert; the credit word for word, both addresses printed without their scheme, the face\'s credit');
    check(JSON.stringify(a.list) === JSON.stringify(wantList), `About's This data: ${a.list.join('; ').replace(/\u202f/g, ' ')}`);
    await A.shot('about-light');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp' && !document.getElementById('main').inert), 'About closes on Escape; focus returns to the stamp');
  }
  // the Hours pane: the table from the present hour, a row tapped, the Shutters tapped scrolling the table to the row
  {
    await A.pane('Hours');
    const tb = await w(() => ({ first: document.querySelector('tr.h td').textContent, rows: document.querySelectorAll('tr.h').length, days: [...document.querySelectorAll('tr.day th')].map((n) => n.textContent),
      head: [...document.querySelectorAll('thead th')].map((n) => n.textContent), win: document.querySelectorAll('tr.h.win').length, why: [...document.querySelectorAll('tr.why td:last-child')].map((n) => n.textContent) }));
    const wantWhy = left.filter((r) => !r.pass).map((r) => `ruled out by ${list(r.blocked)}`);
    check(tb.first === clockAt(left[0].at) && tb.rows === left.length && tb.days.join() === 'Mon 21 Sep,Tue 22 Sep,Wed 23 Sep' && tb.head.join('|') === 'Time|Light|Air°C|Rain chance%|Rainfallmm|Gustskm/h|Dew point°C' && tb.win === WIN.reduce((n, x) => n + x.length, 0) && JSON.stringify(tb.why) === JSON.stringify(wantWhy),
      `Hours: ${tb.rows} rows from ${tb.first}, under ${tb.days.join(', ')}; columns ${tb.head.join(', ')} (rainfall shown, B17); ${tb.win} rows ruled as window hours; every failing hour's rules on its own line, "${tb.why[0]}"`);
    const row = await w(() => { const r = document.querySelectorAll('tr.h')[3]; r.scrollIntoView({ block: 'center' }); return +r.dataset.i; });
    const rr = await A.rect(`tr.h[data-i="${row}"]`);
    const was = await w(() => window.__ow.chosen());
    await A.tapAt(rr.left + 60, rr.top + rr.height / 2);
    await page.waitForTimeout(250);
    check(await w(([i, c]) => window.__ow.chosen() === c && i !== c && getComputedStyle(document.querySelector('tr.h')).cursor !== 'pointer', [row, was]), `a tap on a row (hour ${row}) chooses nothing: the rows are not controls (30 px tall, no key reaches them); the Shutters choose the hour`);
    await w(() => { document.getElementById('main').scrollTop = 0; });
    const last = await xOfHour(A, 44);
    await A.tapAt(last.x, last.y);
    await page.waitForTimeout(300);
    const vis = await w(() => { const r = [...document.querySelectorAll('tr[data-i="44"]')].map((n) => n.getBoundingClientRect()), m = document.getElementById('main').getBoundingClientRect(); return { top: Math.round(r[0].top), bottom: Math.round(r[r.length - 1].bottom), mt: m.top, mb: m.bottom, on: document.querySelector('tr.h.on').dataset.i }; });
    check(vis.on === '44' && vis.top >= vis.mt && vis.bottom <= vis.mb, `a tap on the Shutters at hour 44 scrolls the table until its row is in view (${vis.top} to ${vis.bottom} inside ${Math.round(vis.mt)} to ${Math.round(vis.mb)}), instantly`);
    await A.shot('hours-tapped-light', false);
  }
  // hidden and back: both files read again; the same files redraw nothing
  {
    const n0 = { ...reads };
    await w(() => { document.getElementById('pane').firstElementChild.dataset.old = '1'; document.getElementById('main').scrollTop = 300; });
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const s = await w(() => [document.getElementById('main').scrollTop, window.__ow.pane(), !!document.querySelector('#pane [data-old]'), window.__ow.chosen()]);
    check(reads['/data/snapshot.json'] === n0['/data/snapshot.json'] + 1 && reads['/data/rules.json'] === n0['/data/rules.json'] + 1 && s[1] === 'hours' && s[2] && Math.abs(s[0] - 300) < 2 && s[3] === 44,
      `back on screen: both files read again; the same files redraw nothing; the Hours pane, its scroll (${s[0]} px) and the hour kept`);
    const later = new Date(GEN + 3600e3).toISOString().replace('.000Z', 'Z');
    override = { '/data/snapshot.json': { body: rawSnap.replace(`"generatedAt": "${snap.generatedAt}"`, `"generatedAt": "${later}"`) } };
    await w(() => { document.getElementById('live').textContent = ''; });
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(700);
    const t2 = await w(() => ({ redrawn: !document.querySelector('#pane [data-old]'), stamp: document.getElementById('stamp').textContent, top: document.getElementById('main').scrollTop, pane: window.__ow.pane(), chosen: window.__ow.chosen(), live: document.getElementById('live').textContent }));
    check(t2.redrawn && t2.stamp === `Updated ${osloClock(GEN + 3600e3)}` && t2.pane === 'hours' && Math.abs(t2.top - 300) < 2 && t2.chosen === 44 && t2.live === `New forecast, updated ${osloClock(GEN + 3600e3)}.`,
      `back on screen with a new forecast ("${t2.stamp}"): drawn again in place, the pane, its scroll and the hour kept; said once: "${t2.live}"`);
    // a broken replacement keeps the view and says so (B5)
    override = { '/data/snapshot.json': { body: '<!doctype html><title>502</title>' } };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(600);
    const b = await w(() => ({ notice: document.getElementById('notice').hidden ? '' : document.querySelector('#notice p').textContent, blocks: document.querySelectorAll('#sh rect.blk').length, rows: document.querySelectorAll('tr.h').length, stamp: document.getElementById('stamp').textContent, tabs: !document.getElementById('tabs').hidden }));
    check(b.notice === `A new data/snapshot.json arrived and cannot be used. data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a Shortcut does without noticing. Still showing the forecast updated ${osloClock(GEN + 3600e3)}.` && b.blocks > 0 && b.rows === left.length && b.tabs && b.stamp.startsWith('Updated'),
      `B5: a broken replacement while open: "${b.notice.slice(0, 70)}…"; the Shutters (${b.blocks} blocks), the table, the tabs and the stamp kept`);
    await A.shot('broken-replacement-light', false);
    const kb = await A.rect('#notice .textkey');
    await A.tapAt(kb.left + kb.width / 2, kb.top + kb.height / 2);
    await page.waitForTimeout(150);
    check(kb.height >= 44 && kb.width >= 44 && await w(() => document.getElementById('notice').hidden), `the plate's Close key (${Math.round(kb.width)} × ${Math.round(kb.height)}) puts it away; the forecast stays`);
    // new rules while open: a band missing an end, "Golden" (B12)
    const r2 = { ...rules, temperatureC: { min: 2 }, daylight: 'Golden' };
    override = { '/data/rules.json': { body: JSON.stringify(r2) } };
    await w(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(700);
    const names = await w(() => [...document.querySelectorAll('#sh g.r text:first-child')].map((n) => n.textContent));
    const goldOut = await w(() => window.__ow.shutters().rules[4].out);
    await A.pane('Rules');
    const rr2 = await w(() => [...document.querySelectorAll('.rule')].map((g) => `${g.children[0].textContent}: ${g.children[1].textContent}`));
    const gold = score(snap, r2);
    check(names.join() === 'Rain chance,Rainfall,Gusts,Dew point,Golden hour' && rr2.includes('Temperature: Not used: needs both min and max') && rr2.includes(`Light: Golden hour, 75${NN}min`) && !rr2.some((x) => /undefined/.test(x)) && goldOut === gold.filter((q) => !q.pass && q.blocked.includes('golden hour')).length,
      `B12: new rules while open, temperature missing its max and "Golden": the Shutters' rows ${names.join(', ')}; Rules says "${rr2[3]}" and "${rr2[5].replace(/\u202f/g, ' ')}"`);
    override = {};
    await A.pane('Windows');
  }
  await closeOut(A, 'once');
}
// a rules file that cannot be read: the built-in rules, said in a statement and in the caption
{
  override = { '/data/rules.json': { body: '{ "maxGustKmh": 35, }' } };
  const A = await open('light');
  const s = await A.w(() => ({ st: [...document.querySelectorAll('.statement')].map((n) => n.textContent)[1], about: [...document.querySelectorAll('#about-list dd')].map((n) => n.textContent) }));
  await A.pane('Rules');
  const cap = await A.w(() => document.getElementById('capline').textContent);
  check(s.st === 'data/rules.json could not be used: it is not valid JSON; a trailing comma or a missing quote will do it, and JSON allows neither, nor comments. The built-in rules are in use; the Rules pane shows them.' && cap.startsWith('The built-in rules: data/rules.json could not be used.') && s.about.includes('built in, because data/rules.json could not be used'),
    `a broken rules file: "${s.st.slice(0, 60)}…"; the Rules caption "${cap.slice(0, 50)}…"`);
  await closeOut(A, 'broken rules');
  override = {};
}
// the same words on every locale: dates and times built by hand (B1)
{
  const words = [];
  for (const locale of ['en-US', 'en-GB', 'nb-NO', 'ja-JP']) {
    const A = await open('light', { locale });
    const one = [];
    for (const name of PANES) { await A.pane(name); one.push(await A.w(() => [document.getElementById('head').innerText, document.getElementById('pane').innerText, document.getElementById('band').innerText].join('\n'))); }
    words.push([locale, one.join('\n')]);
    await closeOut(A, `locale ${locale}`);
  }
  check(words.every(([, x]) => x === words[0][1]), `the same words, letter for letter, on every pane under ${words.map(([l]) => l).join(', ')} (${words[0][1].length} characters)`);
}
// stale: past six hours on the phone's clock, "Stale." in ink
{
  const A = await open('light', { time: new Date(GEN + 7 * 3600e3).toISOString() });
  const s = await A.w(() => ({ text: document.getElementById('stamp').textContent, ink: getComputedStyle(document.querySelector('#stamp .lead')).color === getComputedStyle(document.querySelector('h1')).color, rest: getComputedStyle(document.getElementById('stamp')).color !== getComputedStyle(document.querySelector('h1')).color }));
  check(s.text === `Stale. Updated ${osloClock(GEN)}` && s.ink && s.rest, `B2: seven hours on: "${s.text}", the word in ink and the rest in --ink-2, never a color`);
  await closeOut(A, 'stale');
}
// run out: what a fresh install and the marketing camera see today
for (const scheme of schemes) {
  const A = await open(scheme, { time: RANOUT });
  const end = S0[N - 1].at + 3600e3, days = Math.floor((Date.parse(RANOUT) - end) / 864e5);
  const s = await A.w(() => ({ stamp: document.getElementById('stamp').textContent, st: document.querySelector('.statement').textContent, h2: document.querySelector('.sec > h2').textContent, now: !!document.querySelector('#sh rect.now'), past: document.querySelectorAll('#sh .past').length, chosen: window.__ow.chosen(), br: window.__ow.shutters().brackets.map((b) => `${b.from}–${b.to}`).join() }));
  const all = windowsOf(S0);
  const top = await A.w(() => [window.__ow.shutters().G.top, document.querySelectorAll('#sh text.nowl').length, document.querySelector('.ro-when').textContent]);
  check(s.stamp === `Forecast ran out ${days}${NN}d ago. Updated 21 Sep, ${osloClock(GEN)}` && s.st === 'Example forecast: Boston Common, 21 to 23 Sep 2026.' && s.h2 === 'First window in this file' && !s.now && top[0] === 1 && top[1] === 0 && !top[2].includes('now') && s.past === 0 && s.chosen === all[0][0].i && s.br === all.map((x) => `${x[0].i}–${x[x.length - 1].i}`).join(),
    `run out, ${scheme}: "${s.stamp.replace(NN, ' ')}" (the stamp says it ran out; the statement stays one line); "${s.h2}" (B11); every hour at full ink, no now and no row for it; the windows ${s.br}`);
  await A.shot(`windows-ranout-${scheme}`, false);
  await closeOut(A, `run out, ${scheme}`);
}
// a reader's own file: the weather service's reply as the Shortcut writes it (no generatedAt, demoPlace or ask)
{
  const own = JSON.parse(rawSnap);
  delete own.generatedAt; delete own.demoPlace; delete own.ask; delete own.schema;
  override = { '/data/snapshot.json': { body: JSON.stringify(own) } };
  const cur = t(own.current.time);
  const A = await open('light');
  const s = await A.w(() => ({ stamp: document.getElementById('stamp').textContent, st: document.querySelectorAll('.statement').length, title: document.querySelector('.title p').textContent, about: [...document.querySelectorAll('#about-list dt')].map((d, i) => `${d.textContent} ${document.querySelectorAll('#about-list dd')[i].textContent}`), ask: document.getElementById('about-ask').textContent }));
  await A.pane('Hours');
  const cap = await A.w(() => document.getElementById('capline').textContent);
  check(s.stamp === `Updated about ${osloClock(cur)}` && s.st === 0 && s.title === `42.37°${NN}N, 71.06°${NN}W` && s.about.includes('Ask table: none: the file came straight from the weather service') && !s.about.some((x) => x.startsWith('Place')) && s.ask.startsWith('This file came straight from the weather service')
    && cap.startsWith('Hours in the forecast’s own time, UTC−4.'),
    `a reader's own file: "${s.stamp}" (the service's time to the quarter hour); no example statement; the place line its coordinates; About: no ask table; the Hours caption "${cap.slice(0, 45)}…"`);
  await closeOut(A, 'a reader\'s own file');
  const B = await open('light', { time: RANOUT });
  const r = await B.w(() => document.querySelector('.statement').textContent);
  check(r === 'Every hour in this file has ended, so this is history, not a forecast. Run the Shortcut that refreshes the app.', `a reader's own file run out: "${r}"`);
  await closeOut(B, 'a reader\'s own file, run out');
  override = {};
}
// a reader's own file fetched late in the evening (the review's must): a Shortcut's file starts at the fetch hour, so
// a 22:00 fetch in Oslo starts two hours before its first midnight. Every midnight's day under its own tick, no
// day's name under hours it does not name, and `now` drawn, read half an hour after midnight
{
  const own = JSON.parse(rawSnap), t0 = Date.UTC(2026, 8, 20, 20);   // Sun 20 Sep, 22:00 in Oslo
  delete own.generatedAt; delete own.demoPlace; delete own.ask; delete own.schema;
  const iso = (ms) => { const d = new Date(ms + 7200e3); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:00`; };
  own.utc_offset_seconds = 7200; own.timezone = 'Europe/Oslo';
  own.hourly.time = own.hourly.time.map((_, i) => iso(t0 + i * 3600e3));
  own.current.time = iso(t0);
  own.daily = { time: ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'], sunrise: ['2026-09-20T07:12', '2026-09-21T07:14', '2026-09-22T07:16', '2026-09-23T07:18'], sunset: ['2026-09-20T19:17', '2026-09-21T19:14', '2026-09-22T19:11', '2026-09-23T19:08'] };
  override = { '/data/snapshot.json': { body: JSON.stringify(own) } };
  const A = await open('light', { time: new Date(t0 + 2.5 * 3600e3).toISOString() });
  const s = await A.w(() => { const M = window.__ow.shutters(); return { labels: [...document.querySelectorAll('#sh text.lab')].filter((t) => +t.getAttribute('y') === M.G.base + 18).map((t) => [t.textContent, +t.getAttribute('x'), t.getAttribute('text-anchor'), t.getBBox().x, t.getBBox().x + t.getBBox().width]), mids: [...document.querySelectorAll('#sh rect.mid')].map((r) => +r.getAttribute('x') + 1), x0: M.G.x0, ph: M.G.ph, now: document.querySelectorAll('#sh text.nowl').length }; });
  const dayAt = (i) => { const d = new Date(t0 + i * 3600e3 + 7200e3); return `${DAY[d.getUTCDay()]} ${d.getUTCDate()}`; };
  const named = s.mids.every((x) => s.labels.some(([text, lx, anchor]) => lx === x && anchor === 'middle' && text === dayAt((x - s.x0) / s.ph)));
  const across = s.labels.filter(([text, lx, , a, b]) => /^[A-Z]/.test(text) && s.mids.some((x) => a < x && x < b && x !== lx));
  check(named && across.length === 0 && s.now === 1 && s.labels[0][0] === 'Mon 21', `a reader's own file fetched at 22:00 in Oslo, read at 00:30: the axis says ${s.labels.map((l) => l[0]).join(', ')}; every midnight's day under its own tick, no day's name across a midnight it does not name (${across.length}), the first two hours unnamed rather than misnamed, and now drawn over the stack`);
  await A.shot('late-22-light', false);
  await closeOut(A, 'a file fetched at 22:00');
  override = {};
}
// no rule in use, and a window that runs past midnight: said in words, never a backwards range
{
  override = { '/data/rules.json': { body: '{ "activity": "A walk outside" }' } };
  const A = await open('light');
  const s = await A.w(() => ({ st: [...document.querySelectorAll('.statement')].map((n) => n.textContent), cap: document.getElementById('capline').textContent, fig: document.querySelector('.fig b').textContent, lead: document.querySelector('.fig span').textContent }));
  const left0 = S0.filter((r) => r.at + 3600e3 > nowMs)[0];
  check(s.st[1] === 'No rule is in use, so every hour clears and scores 0. The Rules pane says how to add one.' && s.cap === 'No rule is in use, so every hour is open. Framed gaps are windows.' && s.fig === `${clockAt(left0.at)} to Wed 05:00` && s.lead.startsWith(`${dateAt(left0.at)}, 43 hours`),
    `no rule in use: "${s.st[1]}"; the caption "${s.cap}"; the window runs past two midnights and reads "${s.fig}", "${s.lead}"`);
  await closeOut(A, 'no rule in use');
  override = {};
}
// a missing value: gusts null for two hours, a hollow block, never ink
{
  const m = JSON.parse(rawSnap);
  m.hourly.wind_gusts_10m[30] = null;
  m.hourly.wind_gusts_10m[31] = null;
  override = { '/data/snapshot.json': { body: JSON.stringify(m) } };
  for (const scheme of schemes) {
    const A = await open(scheme);
    const p = await xOfHour(A, 30);
    await A.tapAt(p.x, p.y);
    await A.page.waitForTimeout(250);
    const s = await A.w(() => ({ ho: [...document.querySelectorAll('#sh rect.ho')].map((r) => [r.getAttribute('x'), r.getAttribute('width'), getComputedStyle(r).stroke, getComputedStyle(r).fill]), cap: document.getElementById('capline').textContent, vals: document.querySelector('.ro-vals').textContent, v: document.querySelector('.ro-when span').textContent, ink: getComputedStyle(document.querySelector('h1')).color }));
    check(s.ho.length === 1 && +s.ho[0][0] === 64 + 30 * 5 + 0.5 && +s.ho[0][1] === 8 && s.ho[0][2] === s.ink && s.ho[0][3] === 'none' && s.cap === 'Ink: hours a rule rules out. Hollow: no value in the file. Framed gaps are windows.' && s.vals.includes('gusts not in the file') && s.v.includes('ruled out by gusts'),
      `a missing value, ${scheme}: one hollow block over hours 30 and 31 in the Gusts row, a 1 px ink outline; the caption says "Hollow: no value in the file."; the readout "${s.v.trim()}", "gusts not in the file"`);
    await A.shot(`hollow-${scheme}`, false);
    await closeOut(A, `a missing value, ${scheme}`);
  }
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
const envelope = '{"error":true,"reason":"Latitude must be in range of -90 to 90°. Given: 91.0."}';
for (const [label, ov, want] of [
  ['missing', { status: 404 }, ['data/snapshot.json could not be read (HTTP 404).']],
  ['a web page', { body: '<!doctype html><html><body>Bad Gateway</body></html>' }, ['data/snapshot.json is not valid JSON; it looks like an error page was written over it, which a Shortcut does without noticing.']],
  ['the service\'s refusal', { body: envelope }, ['The weather service refused the request: Latitude must be in range of -90 to 90°. Given: 91.0. Check the latitude and longitude the Shortcut passes.']],
  ['a variable left out', { body: JSON.stringify({ ...snap, hourly: { ...snap.hourly, wind_gusts_10m: undefined } }) }, ['data/snapshot.json is missing hourly.wind_gusts_10m: add it to the hourly list in the address the Shortcut fetches.']],
  ['a short array', { body: JSON.stringify({ ...snap, hourly: { ...snap.hourly, precipitation: snap.hourly.precipitation.slice(1) } }) }, ['data/snapshot.json has 47 values of hourly.precipitation for 48 hours.']],
]) {
  override = { '/data/snapshot.json': ov };
  const A = await open('light', { noWait: true, expect: /HTTP 404|404 \(Not Found\)|Failed to load resource|requestfailed .*\/data\/snapshot\.json/ });
  await A.page.waitForSelector('#notice:not([hidden])', { timeout: 15000 });
  const s = await A.w(() => ({ lines: [...document.querySelectorAll('#notice p')].map((p) => p.textContent), role: document.getElementById('notice').getAttribute('role'), tabs: document.getElementById('tabs').hidden, stamp: document.getElementById('stamp').textContent, mono: [...document.querySelectorAll('#notice *')].some((e) => /mono/i.test(getComputedStyle(e).fontFamily)), tick: document.getElementById('notice').textContent.includes('`') }));
  check(JSON.stringify(s.lines) === JSON.stringify([...want, 'In Snuggery, Options, then App Files shows what the file holds.']) && s.role === 'alert' && s.tabs && s.stamp === 'No usable forecast' && !s.mono && !s.tick,
    `broken data, ${label}: "${s.lines[0]}" on a plate (role alert), no tabs, no monospace, no backtick, words for the menu (B14)`);
  if (label === 'the service\'s refusal') await A.shot('broken-refusal-light', false);
  const sb = await A.rect('#stamp');
  await A.tapAt(sb.left + 20, sb.top + sb.height / 2);
  await A.page.waitForTimeout(300);
  check(await A.w(() => !document.getElementById('about').hidden && document.getElementById('about-list').parentElement.hidden), `broken data, ${label}: the stamp opens About (its prose and credits; This data hidden)`);
  await A.page.keyboard.press('Escape');
  if (label === 'missing') {
    override = {};
    await A.w(() => document.dispatchEvent(new Event('visibilitychange')));
    await A.page.waitForFunction(() => window.__ow.ready(), null, { timeout: 10000 });
    check(await A.w(() => document.getElementById('notice').hidden && !document.getElementById('tabs').hidden) && await A.page.getByRole('tab', { name: 'Hours', exact: true }).count() === 1, 'the file mended while the app is open: a return reads it, the plate goes and the tabs come');
  }
  await closeOut(A, `broken data, ${label}`);
}
override = {};
// the widths: no sideways scroll, the caption inside its lines, the Shutters inside the pane, the readout inside its lines
for (const [label, wv, hv, ph] of [['320 × 700', 320, 700, 4], ['360 × 740', 360, 740, 4], ['375 × 667', 375, 667, 5], ['390 × 844', 390, 844, 5], ['125 % text (312 × 675)', 312, 675, 4], ['on its side (844 × 390)', 844, 390, 12], ['640 × 900', 640, 900, 10], ['a tablet (820 × 1180)', 820, 1180, 12]]) {
  const A = await open('light', { w: wv, h: hv });
  const r = [];
  for (const name of PANES) {
    await A.pane(name);
    r.push(await A.w(() => {
      const m = document.getElementById('main'), cap = document.getElementById('capline'), p = document.getElementById('pane'), ps = getComputedStyle(p), sh = document.querySelector('#sh svg');
      return { side: document.documentElement.scrollWidth > innerWidth + 1 || m.scrollWidth > m.clientWidth + 1, cap: cap.scrollHeight <= cap.clientHeight + 1, capH: cap.clientHeight, pane: m.clientHeight, head: document.getElementById('head').getBoundingClientRect().height,
        sh: !sh || sh.getBoundingClientRect().right <= p.getBoundingClientRect().right - parseFloat(ps.paddingRight) + 0.5, ph: window.__ow.shutters() ? window.__ow.shutters().G.ph : null, band: document.getElementById('band').getBoundingClientRect().height,
        // the pane's text starts where the header's and the band's do (HOUSE 4.1: left-aligned, one gutter)
        left: [document.querySelector('#pane > *').getBoundingClientRect().left, document.querySelector('h1').getBoundingClientRect().left, cap.getBoundingClientRect().left].map(Math.round),
        // no credit anchor's hit reaches over the caption line: every point of the caption's box is the caption's
        capHit: (() => { const c = cap.getBoundingClientRect(); let n = 0; for (let y = c.top + 0.5; y < c.bottom - 0.5; y += 1) for (let x = c.left + 1; x < c.right; x += 3) { const e = document.elementFromPoint(x, y); if (e && e.closest('a')) n++; } return n; })() };
    }));
  }
  // the readout never outgrows its two lines: every hour, by the keys
  await A.pane('Windows');
  await A.w(() => document.getElementById('sh').focus());
  await A.page.keyboard.press('Home');
  // the readout is a fixed block: its first line's height and the top of what follows the Shutters (.shw's next sibling) never change (the final's should, 2026-10-03)
  let over = 0; const held = new Set();
  for (let i = 0; i < N; i++) {
    const m = await A.w(() => { const e = document.querySelector('.ro-vals'), wn = document.querySelector('.ro-when'), nx = document.querySelector('.shw').nextElementSibling; return { over: e.scrollHeight > e.clientHeight + 1, held: `${Math.round(wn.getBoundingClientRect().height)}/${Math.round(nx.getBoundingClientRect().top)}` }; });
    if (m.over) over++; held.add(m.held);
    await A.page.keyboard.press('ArrowRight');
  }
  const side = r.filter((x) => x.side).length, cap = r.filter((x) => !x.cap).length;
  const land = wv > hv ? r.every((x) => x.head <= 47 && x.pane >= 220) : true;
  const lines = r.every((x) => x.capH === (wv >= 640 ? 15 : 30));
  const aligned = r.every((x) => x.left[0] === x.left[1] && x.left[1] === x.left[2]), capHit = r.reduce((n, x) => n + x.capHit, 0);
  check(side === 0 && cap === 0 && land && r.every((x) => x.sh) && lines && new Set(r.map((x) => x.band)).size === 1 && r[0].ph === ph && over === 0 && held.size === 1 && aligned && capHit === 0,
    `${label}: no sideways scroll on any pane, the caption line inside its ${wv >= 640 ? 'one line' : 'two lines'} on every pane, the Shutters inside the pane at ${r[0].ph} px an hour, the readout inside its ${wv < 360 ? 'three' : 'two'} lines for all ${N} hours (${over} over) with its first line held at ${[...held][0].split('/')[0]} px and what follows at one top (${held.size} seen), the pane's left edge with the header's and the band's (x ${r[0].left.join(', ')}), no credit hit over the caption (${capHit} points)${wv > hv ? `, the header one ${Math.round(r[0].head)} px row, the pane ${Math.round(Math.min(...r.map((x) => x.pane)))} px tall` : ''}`);
  if (wv === 320) await A.shot('windows-320-light', false);
  if (wv > hv) await A.shot('windows-landscape-light', false);
  await closeOut(A, label);
}
const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png, the README's composite, untouched (${appPngHash ? appPngHash.slice(0, 12) + '…' : 'absent'})`);
await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
