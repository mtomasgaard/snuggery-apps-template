// Drive World Oil & Gas in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through
// CDP), light and dark (HOUSE.md section 7.2; step 23 of the pass's change list, in tools/DECISIONS.md).
// Fails on any console error or warning, page error, failed request, HTTP ≥ 400, or any request outside
// the local server. Every figure it asserts is worked out here from the shipped files with Node's own
// tools (the series, the world's figure, the Ledger's rule-B partition, the field years, the formats),
// never by importing js/.
//
// LOAD AND FRAME TIMES ARE HEADLESS CHROMIUM ON THIS MAC: a trend only, never phone evidence. The
// phone's frame rate, memory and battery are the owner's checks.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs      one theme for the per-theme part
//   SCRUB=0 node tools/shoot.mjs            skip the three-speed scrub
//   SCREENSHOTS=1 node tools/shoot.mjs      also copy the scenes to screenshots/*-{light,dark}.png
//
// Per theme: boot (the camera's strings by role and name, the credit line whole, the face), text contrast
// and the tracer, the Ledger sampler (its drawn ink against the page, its blocks against this file's
// partition, the hatched end, the chosen country's tracer), the cards of Norway and the United States
// against this file's decode, the lead, SI in every visible text node, the scenes as pictures. Once: the
// real-touch scrub at 2, 8 and 20 years a second, play (B2, B3), the plate holding still while the caption
// changes, the card clear of the tapped point, names over the fields and clear of the card and keys (B6),
// focus mode end to end with the camera's way out, the units key, Find (no accent, B13), Cumulative (B1),
// 1906 (B5), the Layers sheet, hidden (B3), hit targets (B8), About (B10), Reduce Motion, broken data,
// after the final review (the details sheet scrolled by an upright swipe at 375 × 667 and 390 × 719, the
// Ledger's three widest named every year with no country, the United States and Norway chosen, none of
// their labels starting in its block's last pixels, a tap on a block and on a drawn name, the producers'
// reach, the legend's 1 000 tick, plain land in the caption, the caption's "under 1 %" and estimate in
// every year at 390, 320 and on its side, a snapshot with no world series) and the widths (B18).
// Pictures: tools/.work/shots/, and with SCREENSHOTS=1 screenshots/*-{light,dark}.png;
// never screenshots/app.png, the README's composite.

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
const fieldsFile = JSON.parse(fs.readFileSync(path.join(APP, 'data/fields.json'), 'utf8'));
const [Y0, Y1] = snap.years;
const by = new Map(snap.countries.map((c) => [c.iso3, c]));
const at = (c, m, y) => { const i = y - c.y0; if (i < 0 || i >= c.oil.length) return null; const o = c.oil[i], g = c.gas[i]; return m === 'oil' ? o : m === 'gas' ? g : o == null && g == null ? null : (o || 0) + (g || 0); };
const sumTo = (c, m, y) => { let t = 0, any = false; for (let k = c.y0; k <= y; k++) { const v = at(c, m, k); if (v != null) { t += v; any = true; } } return any ? t : null; };
const LEAD = { OWID_USS: 'RUS', OWID_CZS: 'CZE', OWID_YGS: 'SRB' };
const stateOf = {};
for (const [s, ms] of Object.entries({ OWID_USS: ['RUS', 'UKR', 'BLR', 'KAZ', 'UZB', 'TKM', 'AZE', 'GEO', 'ARM', 'KGZ', 'TJK', 'MDA', 'LTU', 'LVA', 'EST'], OWID_CZS: ['CZE', 'SVK'], OWID_YGS: ['SRB', 'HRV', 'SVN', 'BIH', 'MKD', 'MNE', 'OWID_KOS', 'KOS'] })) for (const m of ms) stateOf[m] = s;
function counted(c, m, y) {
  const v = at(c, m, y);
  if (!v) return 0;
  if (LEAD[c.iso3] && at(by.get(LEAD[c.iso3]), m, y) != null) return 0;
  const f = stateOf[c.iso3];
  if (f && by.has(f) && at(by.get(f), m, y) != null && at(by.get(LEAD[f]), m, y) == null) return 0;
  return v;
}
/** The Ledger for year y, annual, oil and gas: ISO codes widest first, each producer at 1 % of the world or more. */
function partition(y, m = 'total') {
  const w = at(snap.world, m, y), vals = [];
  for (const c of snap.countries) { const v = counted(c, m, y); if (v > 0) vals.push([v, c.iso3]); }
  vals.sort((a, b) => b[0] - a[0]);
  return vals.filter(([v]) => v / w >= 0.01).map(([v, iso]) => [iso, v / w]);
}
/** The caption's note in year y, oil and gas, annual or to date: a former state holding a figure while its
 *  lead member has none (its lands are plain, its figure in the bar); '' when none applies. */
function noteIn(y, cum) {
  const v = (c) => (!c ? null : cum ? sumTo(c, 'total', y) : at(c, 'total', y));
  for (const st of Object.keys(LEAD)) {
    if (!by.has(st) || v(by.get(st)) == null || v(by.get(LEAD[st])) != null) continue;
    const n = ((snap.historical || {})[st] || '').replace(/\s*\(.*\)$/, '') || by.get(st).name;
    return `${n === 'USSR' ? 'The USSR' : n}'s lands are plain: its figure is in the bar.`;
  }
  return '';
}
/** Fields producing (drawn and filled) in year y with the default filters (operating) and the fields following the year;
 *  with `all`, [on the map, of them undated, producing]. */
function producing(y, all = false) {
  let n = 0, drawn = 0, undated = 0;
  for (const x of fieldsFile.fields) {
    if (!x || !Number.isFinite(x.lat) || !Number.isFinite(x.lon) || String(x.status || '').toLowerCase() !== 'operating') continue;
    const d = Number.isInteger(x.disc) ? x.disc : null, s = Number.isInteger(x.start) ? x.start : null, py = Number.isInteger(x.prodYear) ? x.prodYear : null;
    const rate = Number.isFinite(x.oilBpd) || Number.isFinite(x.gasBoepd);
    let appear, fill;
    if (d == null && s == null) appear = fill = py != null ? Math.min(Y1, Math.max(Y0, py - 1)) : Y1;
    else if (s != null) { appear = d == null ? s : Math.min(d, s); fill = s; } else { appear = d; fill = rate ? d : Math.max(d, Math.min(py ?? Y1, Y1)); }
    if (appear <= y) { drawn++; if (d == null && s == null) undated++; }
    if (appear <= y && fill <= y) n++;
  }
  return all ? [drawn, undated, n] : n;
}

/* ── formats, written here again (HOUSE.md section 6) ── */
const NN = '\u202F';
const grp = (s) => (s.length > 3 ? s.replace(/\B(?=(\d{3})+$)/g, NN) : s);
function sig3(v) {
  if (v === 0) return '0';
  for (const [d, w] of [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']]) if (v >= d * 0.9995) { const x = v / d; return `${x.toFixed(x >= 99.95 ? 0 : x >= 9.995 ? 1 : 2)} ${w}`; }
  const e = Math.floor(Math.log10(v)), r = Math.round(v / 10 ** (e - 2)) * 10 ** (e - 2);
  return e >= 2 ? grp(String(Math.round(r))) : String(Number(r.toFixed(2 - e)));
}
const pct = (p) => `${p.toFixed(1)}${NN}%`;
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

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
  return { w, h, at: (x, y) => { const i = (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4; return [px[i], px[i + 1], px[i + 2]]; } };
}

/* ── the server: the app folder, with any file replaceable ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.md': 'text/markdown', '.txt': 'text/plain' };
let override = {};
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname), ov = override[u];
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
const ready = () => window.__wog && window.__wog.ready();

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
const ST = (A) => A.w(() => window.__wog.stats());
const setYear = async (A, y) => { await A.w((k) => window.__wog.setYear(k), y); await A.frame(); };
const text = (A, id) => A.w((i) => document.getElementById(i).textContent, id);
/** The Play key's marks as drawn: the hidden attribute and the computed display, never an expando (B2). */
const playMarks = (w) => w(() => ['ico-play', 'ico-pause'].map((id) => { const e = document.getElementById(id); return `${id} ${e.hasAttribute('hidden') ? 'hidden' : 'shown'} ${getComputedStyle(e).display}`; }).concat(document.getElementById('btn-play').getAttribute('aria-label')).join(', '));
const N = Y1 - Y0 + 1;
/** The x of year y on the track, in page CSS px (js/track.js: 10 px in from each end). */
const trackX = (r, y) => r.left + 10 + ((y - Y0) / (N - 1)) * (r.width - 20);
const pick = async (A, kind, q) => { await A.w(([k, s]) => window.__wog.pick(k, s), [kind, q]); await A.page.waitForTimeout(750); await A.frame(); };

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
  for (const e of document.querySelectorAll('button, [role="slider"], [role="radio"], input')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.closest('[inert]') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const on = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    // a control partly scrolled out of view (the row of words, a sheet) is measured where it is wholly in view
    if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || !on(cx, cy)) continue;
    const sc = e.closest('.switcher, .sheet-body, .about-body, .find-list');
    if (sc) { const s = sc.getBoundingClientRect(); if (r.left < s.left - 1 || r.right > s.right + 1 || r.top < s.top - 1 || r.bottom > s.bottom + 1) continue; }
    seen.push(e.id || (e.textContent || '').trim().slice(0, 12));
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 280 && on(cx + (s * k * dx) / 4, cy + (s * k * dy) / 4); k++) n++; return n / 4; };
    if (run(0, 1) < 43.5 || run(1, 0) < 43.5) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Every visible text node: a hyphen-minus before a digit, a plain space between a number and a unit,
 *  or five or more digits ungrouped (years, ids and the data's own names and terms excepted). */
const siOf = (w) => w(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[ \u00a0](TWh|PWh|GWh|kboe|Gboe|Sm³|bbl|boe|km|%|m|px)(?![\w/])/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    // the data's names, sources and statements are data, printed as the data writes them
    if (!e || e.closest('[hidden]') || e.closest('script, style, .sr, .src, #about-sources, #card-name, .find-list .name, .tlist li span:first-child')) continue;
    const s = t.textContent;
    n++;
    const groups = s.replace(/\b(1[89]|20)\d\d\b/g, '').match(/\d{5,}|\b\d{4}\b(?![.\d])/g);
    if (/(^|[^\w])-\d/.test(s) || UNIT.test(s) || groups) bad.push(s.trim().slice(0, 50));
  }
  return { n, bad };
});

/* ════════════════════════════════════ per theme ════════════════════════════════════ */
for (const scheme of schemes) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { page, w } = A;
  console.log(`    load to the first frame: ${A.ms} ms (headless)`);
  const PAGE = scheme === 'light' ? [0xe8, 0xee, 0xf0] : [0x14, 0x1d, 0x21];
  const T = JSON.parse(fs.readFileSync(path.join(APP, 'app.js'), 'utf8').match(/^const THEMES = (.*);$/m)[1])[scheme];

  // boot: the camera's strings, the credit line whole, the face, the year it opens on
  {
    const buttons = await Promise.all(['Play', 'Previous year', 'Next year', 'Hide the controls', 'Find a field, company, basin or country', 'Zoom in', 'Zoom out', 'Whole world', 'Map layers', 'Change units, now TWh/yr'].map((n) => page.getByRole('button', { name: n, exact: true }).count()));
    const radios = await Promise.all(['Oil', 'Gas', 'Oil and gas', 'Annual', 'Cumulative'].map((n) => page.getByRole('radio', { name: n, exact: true }).count()));
    const slider = await page.getByRole('slider', { name: 'Year', exact: true }).count();
    const b = await w(() => {
      const c = document.getElementById('credits'), r = c.getBoundingClientRect();
      return { credits: c.textContent, whole: c.scrollWidth <= c.clientWidth + 1 && r.height > 0 && r.bottom <= document.getElementById('player').getBoundingClientRect().top + 1, font: document.fonts.check('560 11.5px "Ysabeau Office"'),
        family: getComputedStyle(document.body).fontFamily, stamp: document.getElementById('stamp').textContent, valid: document.getElementById('valid-time').textContent };
    });
    check(buttons.every((n) => n === 1) && radios.every((n) => n === 1) && slider === 1, `the camera's controls by role and name: buttons ${buttons.join(',')}, radios ${radios.join(',')}, the slider ${slider}`);
    check(b.credits === 'Sources: Energy Institute via Our World in Data · Natural Earth · Global Energy Monitor' && b.whole, `B7: the credit line is on screen whole: "${b.credits}"`);
    check(b.font && /^"?Ysabeau Office"?/.test(b.family), `the face is loaded (${b.family.split(',')[0]})`);
    check(/^Updated (\d\d:\d\d|\d{1,2} \w{3}, \d\d:\d\d), figures to 2024$/.test(b.stamp) && b.valid === String(Y1), `it opens on ${b.valid}; the stamp "${b.stamp}" (B9: built by hand, no middle dot)`);
  }
  // text contrast, and the tracer under exactly the chosen words
  {
    const c = await contrastOf(w);
    check(c.worst[0] >= 4.5, `text contrast: ${c.n} text nodes, the lowest ${c.worst[0]}:1 (${c.worst[1]})`);
    const tr = await w(() => [...document.querySelectorAll('.switcher .words button')].map((b) => [b.textContent, b.getAttribute('aria-checked') === 'true', getComputedStyle(b, '::after').content !== 'none']));
    check(tr.every(([, on, has]) => on === has) && tr.filter(([, on]) => on).map(([t]) => t).join(',') === 'Oil and gas,Annual', `the tracer under exactly the chosen words: ${tr.filter(([, , h]) => h).map(([t]) => t).join(', ')}`);
  }
  // the Ledger: its blocks against this file's partition, its ink against the page, the hatched end
  for (const y of [1920, 2024]) {
    await setYear(A, y); await A.frame();
    const L = await w(() => window.__wog.ledger()), mine = partition(y);
    const lr = await A.rect('#ledger-cv'), img = await A.png();
    const samples = [];
    for (const b of L.blocks) for (let x = b.x0 + 0.5; x < b.x1 - 1.5; x += 1) for (const yy of [3, 6, 9]) samples.push(contrast(img.at(Math.round((lr.left + x) * 2), Math.round((lr.top + yy) * 2)), PAGE));
    const at3 = samples.filter((s) => s >= 3).length / samples.length;
    const end = L.blocks.length ? L.blocks[L.blocks.length - 1].x1 : 0;
    let ink = 0, all = 0;
    for (let x = end + 2; x < lr.width - 2; x += 0.5) for (let yy = 2.5; yy < 10.5; yy += 0.5) { all++; if (contrast(img.at(Math.round((lr.left + x) * 2), Math.round((lr.top + yy) * 2)), PAGE) >= 1.5) ink++; }
    const same = L.blocks.length === mine.length && L.blocks.every((b, i) => b.iso3 === mine[i][0] && Math.abs(b.share - mine[i][1]) < 1e-9);
    const say = await text(A, 'ledger-say');
    check(same && at3 >= 0.9 && (!all || (ink / all > 0.15 && ink / all < 0.7)) && say.startsWith(`Shares of the world's oil and gas in ${y}: ${L.blocks[0].name} ${(L.blocks[0].share * 100).toFixed(1)} percent`),
      `the Ledger in ${y}: ${L.blocks.length} blocks (this file's partition ${mine.length}), the first ${L.blocks[0].name} ${(L.blocks[0].share * 100).toFixed(1)} % (this file ${(mine[0][1] * 100).toFixed(1)}); ${samples.length} samples of its ink against the page, ${(at3 * 100).toFixed(1)} % at 3:1 or more, the lowest ${Math.min(...samples).toFixed(2)} (a 1 px gap's antialiased edge); the hatched end ${all ? (ink / all * 100).toFixed(0) : 0} % ink`);
  }
  // the card for Norway and the United States against this file's decode; the chosen country's tracer
  for (const iso of ['NOR', 'USA']) {
    const c = by.get(iso);
    await pick(A, 'Countries', c.name);
    const card = await w(() => ({ v: document.getElementById('card-value').textContent, u: document.getElementById('card-unit').textContent, sub: document.getElementById('card-sub').textContent,
      rows: [...document.querySelectorAll('#card-rows dt')].map((d) => [d.textContent, d.nextElementSibling.textContent]) }));
    const v = at(c, 'total', Y1), w0 = at(snap.world, 'total', Y1);
    const rank = snap.countries.map((x) => [x.iso3, at(x, 'total', Y1)]).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]), ri = rank.findIndex(([x]) => x === iso);
    const want = `Oil and gas in ${Y1}, ${pct((v / w0) * 100)} of the world, ${ord(ri + 1)} of ${rank.length}.`;
    const oilRow = (card.rows.find((r) => r[0] === 'Oil') || [])[1], wantOil = `${sig3(at(c, 'oil', Y1) / 1000)}${NN}TWh/yr, ${pct((at(c, 'oil', Y1) / at(snap.world, 'oil', Y1)) * 100)}`;
    const L = await w(() => window.__wog.ledger()), blk = L.blocks.find((b) => b.iso3 === iso);
    const lr = await A.rect('#ledger-cv'), img = await A.png();
    let under = 0, elsewhere = 0;
    for (let x = 1; x < lr.width - 1; x += 1) {
      const d = contrast(img.at(Math.round((lr.left + x) * 2), Math.round((lr.top + 14) * 2)), PAGE) >= 2;
      if (blk && x >= blk.x0 + 1 && x <= blk.x1 - 1) under += d; else if (d && x > 0) elsewhere++;
    }
    check(card.v === sig3(v / 1000) && card.u === `${NN}TWh/yr` && card.sub === want && oilRow === wantOil && blk && under >= 2 && elsewhere <= 4,
      `${c.name}: the card reads ${card.v}${card.u}, "${card.sub}", Oil "${oilRow}" (this file: ${v / 1000} TWh/yr); the tracer runs under its block (${under} ink pixels there, ${elsewhere} elsewhere on the line)`);
  }
  await A.shot(`card-${scheme}`);
  // SI in every visible text node, with a country's details open
  {
    await A.tapEl('#card-act'); await A.frame(); await page.waitForTimeout(200);
    const si = await siOf(w), cd = await contrastOf(w);
    check(cd.worst[0] >= 4.5, `text contrast with the United States' details open: ${cd.n} text nodes, the lowest ${cd.worst[0]}:1 (${cd.worst[1]})`);
    check(si.bad.length === 0, `SI: ${si.n} visible text nodes with the details open, no hyphen-minus before a digit, U+202F before every unit, numbers grouped${si.bad.length ? ': ' + si.bad.slice(0, 6).join(' | ') : ''}`);
    await A.shot(`details-${scheme}`);
    await A.tapEl('#details-close'); await A.frame();
    await A.tapEl('#card-close'); await A.frame();
  }
  // the lead against this file's sum and the field years
  {
    await w(() => window.__wog.home()); await setYear(A, Y1);
    const lead = await text(A, 'lead');
    const want = `World ${sig3(at(snap.world, 'total', Y1) / 1000)}${NN}TWh/yr, ${grp(String(producing(Y1)))} fields producing`;
    check(lead === want, `the lead in ${Y1}: "${lead}" (this file: ${at(snap.world, 'total', Y1)} GWh, ${producing(Y1)} operating units producing, the undated ones in their data year)`);
  }
  // the scenes
  await A.shot(`open-${scheme}`);
  await setYear(A, 1950); await A.shot(`1950-${scheme}`);
  await A.tapEl('#accum [data-accum="cumulative"]'); await setYear(A, Y1); await A.shot(`cumulative-${scheme}`); await A.tapEl('#accum [data-accum="annual"]');
  await A.tapEl('#btn-layers'); await A.frame();
  { const cl = await contrastOf(w); check(cl.worst[0] >= 4.5, `text contrast with the Layers sheet open: ${cl.n} text nodes, the lowest ${cl.worst[0]}:1 (${cl.worst[1]})`); }
  await A.shot(`layers-${scheme}`); await A.tapEl('#layers-close');
  await A.tapEl('#stamp'); await page.waitForTimeout(300);
  { const ca = await contrastOf(w); check(ca.worst[0] >= 4.5, `text contrast in About: ${ca.n} text nodes, the lowest ${ca.worst[0]}:1 (${ca.worst[1]})`); }
  await A.shot(`about-${scheme}`, scheme === 'light');
  await page.keyboard.press('Escape');
  check(T.ledger && A.errors.length === 0, `no console error or warning, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

/* ════════════════════════════════════ once ════════════════════════════════════ */
console.log('\n== once (light)');
{
  const A = await open('light');
  const { page, w } = A;

  // frame times, printed and never asserted: headless Chromium on this Mac, a trend and not phone evidence
  {
    const t = await w(() => { const a = []; for (let i = 0; i < 20; i++) a.push(window.__wog.render()); return a; });
    const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1].toFixed(2);
    console.log(`    frame times (headless, not phone evidence): a year's frame ${med(t)} ms (median of 20)`);
  }

  // the scrub by real touch: 2, 8 and 20 years a second, a move every 16 ms
  if (process.env.SCRUB !== '0') {
    for (const [rate, from, to] of [[2, 1950, 1958], [8, 1900, 1940], [20, 1925, 2024]]) {
      await setYear(A, from);
      const tr = await A.rect('#slider'), y = tr.top + tr.height / 2;
      await w(() => window.__wog.log(true));
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
      const log = await w(() => window.__wog.log(false));
      const s1 = await ST(A), el = Date.now() - t1;
      const bad = log.filter((e) => e.shown !== e.wanted || e.label !== String(e.shown) || e.now !== e.shown || e.ledger !== String(e.shown));
      const seq = log.map((e) => e.shown), steps = new Set(seq);
      const ordered = seq.every((s, i) => !i || s >= seq[i - 1]);
      const every = rate !== 2 || Array.from({ length: to - from }, (_, i) => from + 1 + i).every((s) => steps.has(s));
      check(bad.length === 0 && ordered && every && seq[seq.length - 1] === to,
        `scrub at ${rate} years a second, ${from} to ${to}: ${log.length} frames, ${bad.length} whose label, aria-valuenow or Ledger differ from the year drawn; ${rate === 2 ? 'every year drawn, in order' : `${steps.size} years drawn, never backwards`}; the frame after the lift draws ${seq[seq.length - 1]} (headless: ${s1.fills - s0.fills} country fill passes, ${s1.frames - s0.frames} frames in ${el} ms)`);
    }
    const anims = await w(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && (a.effect.target.closest('.player') || a.effect.target.closest('.ledger'))).length);
    check(anims === 0, `no animation runs on the year, the lead, the track or the Ledger (${anims})`);
  }

  // play: never backwards, whole years, stopping at 2024; the Play key's mark (B2); the work only on a new
  // year; About holding play (B3); a finger on the plate holding the clock; a touch on the track stopping it
  {
    await setYear(A, 2000);
    await w(() => window.__wog.log(true));
    await A.tapEl('#btn-play');
    await page.waitForTimeout(150);
    const marks = await playMarks(w);
    const s0 = await ST(A);
    await page.waitForTimeout(1000);
    const s1 = await ST(A);
    await page.waitForTimeout(3000);
    const log = await w(() => window.__wog.log(false));
    const end = await w(() => [window.__wog.shown(), window.__wog.stats().playing]);
    const seq = log.map((e) => e.shown);
    check(/ico-play hidden none, ico-pause shown (block|inline)/.test(marks) && /Pause$/.test(marks), `B2: while playing the Play key shows the pause bars and is named Pause (${marks})`);
    check(seq.every((s, i) => !i || s >= seq[i - 1]) && log.every((e) => e.label === String(e.shown)) && end[0] === Y1 && !end[1], `play: ${new Set(seq).size} years, never backwards, every label the drawn year's; it stops at ${end[0]}`);
    const fills = s1.fills - s0.fills, frames = s1.frames - s0.frames, years = new Set(log.filter((e, i) => i).map((e) => e.shown)).size;
    check(fills <= 10 && frames > fills, `the year's work runs only on a new year: ${fills} country fill passes and ${s1.ledgerDraws - s0.ledgerDraws} Ledger draws over ${frames} frames in a second of play (8 years a second)`);
    const m2 = await playMarks(w);
    check(/ico-play shown (block|inline), ico-pause hidden none/.test(m2) && /Play$/.test(m2), `stopped, the Play key shows its triangle and is named Play (${m2})`);
    await A.tapEl('#btn-play'); await page.waitForTimeout(300);
    const restart = await w(() => window.__wog.shown());
    await A.tapEl('#btn-play');
    check(restart < 1906, `Play at ${Y1} starts over from ${Y0} (${restart} after 0.3 s)`);
    // About holds play still; closing it lets play go on from the year it opened on (B3)
    await setYear(A, 1950);
    await A.tapEl('#btn-play'); await page.waitForTimeout(300);
    await A.tapEl('#stamp'); await page.waitForTimeout(100);
    const held0 = await w(() => window.__wog.shown());
    await page.waitForTimeout(800);
    const held1 = await w(() => [window.__wog.shown(), !document.getElementById('about').hidden]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const after = await w(() => [window.__wog.shown(), document.getElementById('about').hidden, document.activeElement.id]);
    check(held1[0] === held0 && held1[1] && after[0] > held0 && after[0] <= held0 + 6 && after[1] && after[2] === 'stamp', `B3: About holds play still (${held0} while open), Escape closes it, focus returns to the stamp, and play goes on from there (${after[0]})`);
    // a finger held on the plate holds the clock and the work: the picture is the frame the touch began on
    {
      const plate = await A.rect('#map-wrap');
      await A.touch('touchStart', plate.left + plate.width / 2, plate.top + plate.height * 0.6);
      await page.waitForTimeout(100);
      const p0 = await w(() => [window.__wog.shown(), window.__wog.stats().fills]);
      await page.waitForTimeout(800);
      const p1 = await w(() => [window.__wog.shown(), window.__wog.stats().fills, window.__wog.stats().playing]);
      await A.touch('touchEnd'); await page.waitForTimeout(500);
      const p2 = await w(() => [window.__wog.shown(), window.__wog.stats().playing]);
      check(p1[0] === p0[0] && p1[1] === p0[1] && p1[2] && p2[0] > p1[0] && p2[1], `play with a finger held on the plate for 0.8 s: the year holds (${p0[0]}) and no fill pass runs (${p1[1] - p0[1]}); play goes on after the lift (${p2[0]})`);
    }
    const tr = await A.rect('#slider');
    await A.touch('touchStart', trackX(tr, 1930), tr.top + tr.height / 2); await A.frame();
    const stopped = await w(() => [window.__wog.stats().playing, window.__wog.shown()]);
    await A.touch('touchEnd');
    check(!stopped[0] && stopped[1] === 1930, `a touch on the track during play stops it on the year under the finger (${stopped[1]})`);
    await A.tapEl('#btn-prev'); await A.frame(); await page.waitForTimeout(100);
    const bk = await w(() => [window.__wog.shown(), document.getElementById('live').textContent]);
    check(bk[0] === 1929 && bk[1] === '1929', `Previous year moves one year and says it: "${bk[1]}"`);
    const q0 = await ST(A); await page.waitForTimeout(800); const q1 = await ST(A);
    check(q1.frames === q0.frames && !q1.raf, `at rest no frame runs: ${q1.frames - q0.frames} frames in 0.8 s`);
  }

  // the plate holds still while the caption's words change; every form fits its two lines
  {
    const hs = new Set(), forms = new Set(), over = [];
    for (const [y, acc] of [[1900, 'annual'], [1920, 'annual'], [2017, 'annual'], [2024, 'annual'], [1950, 'cumulative'], [2024, 'cumulative']]) {
      await w(([k, a]) => { window.__wog.setAccum(a); window.__wog.setYear(k); }, [y, acc]); await A.frame();
      const r = await w(() => { const e = document.getElementById('readline'); return [document.getElementById('map-wrap').getBoundingClientRect().height, e.textContent, e.scrollHeight <= e.clientHeight + 1]; });
      hs.add(r[0]); forms.add(r[1]); if (!r[2]) over.push(r[1]);
    }
    await w(() => window.__wog.setAccum('annual'));
    check(hs.size === 1 && over.length === 0, `the plate holds still while the caption changes: plate ${[...hs].map(Math.round).join(', ')} px over ${forms.size} forms of the line, each inside its two lines${over.length ? ': over ' + over.join(' | ') : ''}`);
    check([...hs][0] >= 480, `the plate at 390 × 844: ${Math.round([...hs][0])} px (ART.md: at least 480; the stock plate had the legend and credits laid over it)`);
  }

  // B6: names are drawn over the fields: each placed name's ink is the same with the fields on and off
  {
    await w(() => window.__wog.home()); await setYear(A, Y1); await A.frame();
    const plate = await A.rect('#map-wrap');
    const labels = await w(() => window.__wog.labels());
    const on = await A.png();
    await w(() => document.querySelector('[data-layer="fields"]').click()); await A.frame(); await A.frame();
    const labelsOff = await w(() => window.__wog.labels());
    const off = await A.png();
    await w(() => document.querySelector('[data-layer="fields"]').click()); await A.frame();
    const ink = [0x0f, 0x1c, 0x23];
    // with the fields off the credit line loses a source and the plate grows a line, so each name is
    // compared at its own place in each picture (the same name, the same box, moved with the map)
    let n = 0, same = 0;
    labels.forEach(([x0, y0, x1, y1], i) => {
      const [ox, oy] = labelsOff[i] ? [labelsOff[i][0] - x0, labelsOff[i][1] - y0] : [0, 0];
      for (let x = x0 + 4; x < x1 - 4; x += 1) for (let y = y0 + 5; y < y1 - 5; y += 1) {
        const a = off.at(Math.round((plate.left + x + ox) * 2), Math.round((plate.top + y + oy) * 2));
        if (contrast(a, ink) > 1.6) continue;              // the name's own ink, with the fields off
        n++; if (contrast(on.at(Math.round((plate.left + x) * 2), Math.round((plate.top + y) * 2)), ink) < 1.6) same++;
      }
    });
    const boxes = await w(() => ['card', 'keys'].map((id) => document.getElementById(id).getBoundingClientRect().toJSON()).filter((b) => b.width));
    const hit = labels.filter(([x0, y0, x1, y1]) => boxes.some((b) => plate.left + x0 < b.right && plate.left + x1 > b.left && plate.top + y0 < b.bottom && plate.top + y1 > b.top));
    check(labels.length >= 10 && labelsOff.length === labels.length && labelsOff.every((b, i) => Math.abs((b[2] - b[0]) - (labels[i][2] - labels[i][0])) < 0.01) && n > 200 && same / n >= 0.97 && hit.length === 0,
      `B6: ${labels.length} country names; ${n} pixels of their ink with the fields off, ${(same / n * 100).toFixed(1)} % still ink with the fields on (names drawn last, on halos); none under the key column`);
  }
  // the card keeps clear of the tapped point, and VoiceOver hears it once: central Sweden, dragged by
  // touch to the plate's top left where the card opens, then tapped
  {
    await w(() => window.__wog.flyTo(16, 64.2, 360 * 6)); await A.frame();
    const plate = await A.rect('#map-wrap');
    const from = await w(() => window.__wog.project(16, 64.2));
    await A.touch('touchStart', plate.left + from[0], plate.top + from[1]);
    for (let i = 1; i <= 10; i++) { await A.touch('touchMove', plate.left + from[0] + ((70 - from[0]) * i) / 10, plate.top + from[1] + ((70 - from[1]) * i) / 10); await new Promise((r) => setTimeout(r, 16)); }
    await A.touch('touchEnd'); await A.frame(); await page.waitForTimeout(350);
    const q = await w(() => window.__wog.project(16, 64.2));
    await A.tapAt(plate.left + q[0], plate.top + q[1]); await A.frame(); await page.waitForTimeout(250);
    const card = await A.rect('#card'), where = await text(A, 'card-where');
    const clear = !(plate.left + q[0] > card.left - 4 && plate.left + q[0] < card.right + 4 && plate.top + q[1] > card.top - 4 && plate.top + q[1] < card.bottom + 4);
    await page.waitForTimeout(150);
    const live = await text(A, 'live');
    check(where === 'Sweden' && clear && Math.abs(q[0] - 70) < 3 && /^Sweden\. Oil and gas in 2024: (no figure|.+ terawatt-hours a year.*)\.$/.test(live),
      `a tap on Sweden under the card's corner (${Math.round(q[0])}, ${Math.round(q[1])}): the card moves clear of it (${Math.round(card.left)}, ${Math.round(card.top)}); VoiceOver hears "${live}"`);
    await A.shot('sweden-light', false);
    await A.tapEl('#card-close'); await w(() => window.__wog.home());
  }

  // the units key: SI first, kboe/d one press away; a field's card in Sm³ o.e./d, then boe/d (B9)
  {
    const k0 = await w(() => [document.getElementById('btn-units').textContent, document.getElementById('btn-units').getAttribute('aria-label')]);
    await pick(A, 'Fields', 'Troll Oil and Gas');
    const c0 = await w(() => document.getElementById('card-unit').textContent);
    await A.tapEl('#btn-units'); await A.frame();
    const us = await w(() => [document.getElementById('btn-units').textContent, [...document.querySelectorAll('#legend-ticks span')].pop().textContent, document.getElementById('lead').textContent, document.getElementById('card-unit').textContent, localStorage.getItem('wog.units')]);
    await A.tapEl('#btn-units'); await A.frame();
    const back = await w(() => [document.getElementById('btn-units').textContent, localStorage.getItem('wog.units')]);
    check(k0[0] === 'TWh/yr' && k0[1] === 'Change units, now TWh/yr' && c0 === `${NN}Sm³ o.e./d` && us[0] === 'kboe/d' && us[1].endsWith(`${NN}kboe/d`) && us[2].includes(`${NN}kboe/d`) && us[3] === `${NN}boe/d` && us[4] === 'kboe' && back[0] === 'TWh/yr' && back[1] === 'twh',
      `the units key starts at TWh/yr ("${k0[1]}"), Troll's card in${c0}; one press: ${us[0]}, the legend ends "${us[1]}", the lead "${us[2]}", the card in${us[3]}; a second press is back (wog.units = ${back[1]})`);
    await A.tapEl('#card-close'); await w(() => window.__wog.home());
  }
  // B1: Cumulative to 2024 colors France, Spain, Sweden and Ireland; their cards hold their totals
  {
    await w(() => { window.__wog.setAccum('cumulative'); window.__wog.setYear(2024); }); await A.frame();
    const st = await w(() => ['FRA', 'ESP', 'SWE', 'IRL'].map((i) => window.__wog.countryColor(i).st));
    await pick(A, 'Countries', 'France');
    const c = await w(() => [document.getElementById('card-value').textContent, document.getElementById('card-sub').textContent, [...document.querySelectorAll('#card-rows dd')].pop().textContent]);
    const want = sig3(sumTo(by.get('FRA'), 'total', 2016) / 1e6);
    check(st.every((s) => s === 0) && c[0] === want && c[1].startsWith('Oil and gas to 2024, with no figures after 2016') && c[2] === '1900 to 2016; later years are not in it',
      `B1: Cumulative 2024 colors France, Spain, Sweden and Ireland (states ${st.join(', ')}); France's card ${c[0]} PWh (this file: ${want}), "${c[1]}", series "${c[2]}"`);
    await A.shot('cumulative-france-light');
    await A.tapEl('#card-close'); await w(() => { window.__wog.setAccum('annual'); window.__wog.home(); });
  }
  // B5: in 1906 no undated unit is drawn, and the lead counts what is
  {
    await setYear(A, 1906);
    const undated = fieldsFile.fields.filter((x) => x.disc == null && x.start == null && x.status === 'operating').slice(0, 40).map((x) => x.id);
    const vis = await w((ids) => ids.map((id) => window.__wog.field(id)).filter((f) => f && f.visible).length, undated);
    const lead = await text(A, 'lead');
    check(vis === 0 && lead.endsWith(`, ${producing(1906)} fields producing`), `B5: in 1906, 0 of 40 undated units drawn; the lead "${lead}" (this file: ${producing(1906)})`);
    await A.shot('1906-light', false);
    await setYear(A, Y1);
  }
  // Find: no browser clear button in its accent; the count; a choice flies; a touch ends a flight (B13)
  {
    await A.tapEl('#btn-find'); await page.waitForTimeout(300);
    await page.keyboard.type('troll'); await page.waitForTimeout(200);
    const f = await A.rect('#find-input');
    const img = await A.png({ x: f.left, y: f.top, width: f.width, height: f.height });
    let blue = 0;
    for (let y = 0; y < img.h; y++) for (let x = Math.floor(img.w * 0.75); x < img.w; x++) { const [r, g, b] = img.at(x, y); if (b > r + 40 && b > g + 20) blue++; }
    const res = await w(() => [...document.querySelectorAll('#find-list button .name')].map((b) => b.textContent));
    const heads = await w(() => [...document.querySelectorAll('#find-list h3')].map((h) => h.textContent).join(','));
    await page.waitForTimeout(800);
    const heard = await text(A, 'live');
    check(blue === 0 && res[0] === 'Troll Oil and Gas Field (Norway)' && /^Fields/.test(heads) && heard === `${res.length} ${res.length === 1 ? 'match' : 'matches'}.`,
      `Find: "troll" lists ${res.length} under ${heads} (${res.slice(0, 2).join('; ')}); no blue-led pixel at the field's right end (${blue}); VoiceOver hears "${heard}"`);
    await A.shot('find-light');
    await A.tapEl('#find-list button'); await page.waitForTimeout(80);
    const flying = await w(() => window.__wog.flying());
    await page.waitForTimeout(800);
    const s = await w(() => [window.__wog.state.sel, window.__wog.flying(), document.getElementById('find').hidden]);
    check(flying && !s[1] && s[2] && s[0] && s[0].kind === 'field', `a choice closes Find and flies to the field (flying ${flying}, then landed on ${s[0] && s[0].id})`);
    await A.tapEl('#card-close'); await w(() => window.__wog.home());
    await w(() => window.__wog.pick('Countries', 'Brazil')); await page.waitForTimeout(100);
    const plate = await A.rect('#map-wrap');
    await A.tapAt(plate.right - 70, plate.bottom - 30);
    const z = await w(() => [window.__wog.flying(), window.__wog.state.view.scale]);
    check(!z[0] && z[1] > 1500, `B13: a touch during a flight ends it at its destination (scale ${Math.round(z[1])}, not midway)`);
    await A.tapEl('#card-close').catch(() => {}); await w(() => window.__wog.home());
  }
  // the Layers sheet: the rows, the counts sentence, hit targets with it open; the highlight's note
  {
    await A.tapEl('#btn-layers'); await page.waitForTimeout(150);
    const note = await text(A, 'fields-note');
    const h = await hitTargets(w);
    const m = note.match(/^([\d\u202F]+) fields on the map by 2024, ([\d\u202F]+) of them without dates \(shown from their data year\); ([\d\u202F]+) producing; /), want = producing(Y1, true);
    check(m && m.slice(1, 4).map((x) => +x.replace(/\u202F/g, '')).join() === want.join() && !note.includes('·') && h.bad.length === 0,
      `the Layers sheet: "${note.slice(0, 120)}…" (this file: ${want.join(', ')}; the words add up); hit targets with it open: ${h.n} controls at least 44 × 44${h.bad.length ? ': ' + h.bad.join('; ') : ''}`);
    await A.tapEl('#layers-close');
    await w(() => window.__wog.pick('Companies', 'TotalEnergies')); await A.frame();
    const rl = await text(A, 'readline');
    await w(() => window.__wog.setHighlight(null)); await A.frame();
    check(/^Highlighted: TotalEnergies SE, [\d\u202F]+ fields\./.test(rl), `a company lit from Find is named in the caption, no floating chip: "${rl}"`);
  }

  // hit targets, and focus mode end to end
  {
    const h0 = await hitTargets(w);
    check(h0.bad.length === 0 && h0.n >= 15, `B8: hit targets: ${h0.n} controls, all at least 44 × 44${h0.bad.length ? ': ' + h0.bad.join('; ') : ''}`);
    const before = await w(() => document.getElementById('map-wrap').getBoundingClientRect().height);
    await A.tapEl('#focus-key');
    await page.waitForTimeout(450);
    const f = await w(() => {
      const gone = ['head', 'keys', 'legend-scale'].map((id) => { const e = document.getElementById(id); return e.hidden && e.inert; });
      const stays = ['ledger', 'legend-name', 'readline', 'credits', 'player', 'stamp'].map((id) => { const e = document.getElementById(id); return e.getBoundingClientRect().height > 0 && !e.closest('[hidden]'); });
      return { gone, stays, stampIn: document.getElementById('stamp').parentElement.id, ghost: !document.getElementById('focus-exit').hidden, plate: document.getElementById('map-wrap').getBoundingClientRect().height, live: document.getElementById('live').textContent, store: localStorage.getItem('wog.focus'), active: document.activeElement.id };
    });
    const tree = await page.getByRole('button', { name: 'Zoom in', exact: true }).count();
    check(f.gone.every(Boolean) && tree === 0 && f.stays.every(Boolean) && f.stampIn === 'caption' && f.ghost,
      `focus mode by touch: the header, the keys and the legend's bar are hidden and inert (gone from the tree: ${tree === 0}); the Ledger, the legend's title, the caption line, the credits, the player and the stamp (now in the caption band) stay`);
    check(f.plate > before && f.plate >= 600, `the plate grew from ${before.toFixed(1)} to ${f.plate.toFixed(1)} px (ART.md: at least 600)`);
    check(f.live === 'Controls hidden. Press Escape or the corner key to show them.' && f.store === '1' && f.active !== 'focus-exit', `its sentence ("${f.live}"), wog.focus = ${f.store}, and no ring after a touch (focus on "${f.active || 'body'}")`);
    const hf = await hitTargets(w);
    check(hf.bad.length === 0, `hit targets in focus mode: ${hf.n} controls at least 44 × 44${hf.bad.length ? ': ' + hf.bad.join('; ') : ''}`);
    const g = await A.rect('#focus-exit'), pr = await A.rect('#map-wrap');
    check(g.top - pr.top >= 8 && pr.right - g.right >= 8 && g.width === 44 && g.height === 44, `the ghost key sits in the plate's top-right corner, 8 px in (${Math.round(g.left)}, ${Math.round(g.top)}, 44 × 44)`);
    const tr = await A.rect('#slider');
    await A.touch('touchStart', trackX(tr, 1960), tr.top + 24); await A.touch('touchMove', trackX(tr, 1970), tr.top + 24); await A.touch('touchEnd'); await A.frame();
    const sc = await w(() => window.__wog.shown());
    await A.tapEl('#btn-play'); await page.waitForTimeout(400); const pl = await w(() => window.__wog.stats().playing); await A.tapEl('#btn-play');
    await A.tapAt(pr.left + 140, pr.top + 300); await page.waitForTimeout(200);
    const card = await w(() => !document.getElementById('card').hidden);
    await A.shot('focus-light');
    check(sc === 1970 && pl && card, `inside focus mode the scrub lands on ${sc}, play plays (${pl}) and a tap opens the card (${card})`);
    await page.reload(); await page.waitForFunction(ready, null, { timeout: 60000 });
    const kept = await w(() => [document.body.classList.contains('focus'), document.getElementById('head').hidden]);
    check(kept[0] && kept[1], 'focus mode survives a reload, restored before the first draw');
    await page.getByRole('button', { name: 'Show the controls', exact: true }).click();
    await page.waitForTimeout(300);
    const outs = await w(() => [document.getElementById('head').hidden, document.getElementById('live').textContent, localStorage.getItem('wog.focus')]);
    const play = await page.getByRole('button', { name: 'Play', exact: true }).isVisible();
    check(!outs[0] && outs[1] === 'Controls shown.' && outs[2] === '0' && play, `the camera's way out of a library left in focus mode: "Show the controls" brings the header back ("${outs[1]}"), Play visible ${play}`);
    await page.focus('#focus-key'); await page.keyboard.press('Enter'); await page.waitForTimeout(450);
    const k1 = await w(() => [document.body.classList.contains('focus'), document.activeElement.id]);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    const k2 = await w(() => [document.body.classList.contains('focus'), document.activeElement.id]);
    check(k1[0] && k1[1] === 'focus-exit' && !k2[0] && k2[1] === 'focus-key', `by the keyboard: Enter goes in with focus on the ghost key (${k1[1]}); Escape comes out with focus back on the entry key (${k2[1]})`);
  }
  // the map by keyboard: plus and minus zoom, the arrows pan
  {
    await w(() => window.__wog.home()); await page.focus('#map');
    const v0 = await w(() => window.__wog.state.view);
    await page.keyboard.press('+'); await page.keyboard.press('ArrowLeft'); await A.frame();
    const v1 = await w(() => window.__wog.state.view);
    await page.keyboard.press('-'); await A.frame();
    const v2 = await w(() => window.__wog.state.view);
    check(Math.abs(v1.scale / v0.scale - 2) < 0.01 && Math.abs(v2.scale - v0.scale) < 0.5 && v1.cx !== v0.cx, `the map by keyboard: plus zooms ×2 (${Math.round(v1.scale)}), minus back (${Math.round(v2.scale)}), the arrow keys pan`);
    await w(() => window.__wog.home());
  }
  // hidden: play stops and no frame runs; the return does not jump the year (B3)
  {
    await setYear(A, 1950);
    await A.tapEl('#btn-play'); await page.waitForTimeout(200);
    await w(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const h0 = await ST(A), y0 = await w(() => window.__wog.shown());
    await page.waitForTimeout(1500); const h1 = await ST(A);
    await w(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(400);
    const h2 = await ST(A), y2 = await w(() => window.__wog.shown());
    check(!h0.playing && h1.frames === h0.frames && !h1.raf && h2.draws > h1.draws && y2 === y0, `B3: hidden, play stops and no frame runs (${h1.frames - h0.frames} in 1.5 s); the return draws (${h2.draws - h1.draws} draws) and the year has not jumped (${y0}, then ${y2})`);
  }
  // About: from the stamp, every source's statement and the face's credit, no address with its scheme, Escape
  {
    await A.tapEl('#stamp'); await page.waitForTimeout(300);
    const a = await w(() => ({ text: document.getElementById('about-body').textContent, focus: document.activeElement.id, inert: document.getElementById('map-wrap').inert }));
    const missing = snap.sources.filter((s) => !a.text.includes(s.attribution));
    check(a.inert && a.focus === 'about-close' && missing.length === 0 && a.text.includes(fieldsFile.source.attribution) && a.text.includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.')
      && !/https?:\/\//.test(a.text) && a.text.includes('github.com/owid/energy-data') && a.text.includes('creativecommons.org/licenses/by/4.0/') && /\(UTC([+\u2212]\d+(:\d\d)?)?\)/.test(a.text) && !/\d{1,2}\/\d{1,2}\/\d{4}/.test(a.text)
      && !/hatched (in every|before their|over)/i.test(a.text) && !a.text.includes('·') && !snap.sources.reduce((t, s) => t.split(s.name).join(''), a.text).includes(' — '),
    `B10, B4: About opens from the stamp with the page behind inert, carries every attribution and the face's credit, prints addresses without their scheme and dates by hand, promises no hatching, and has no middle dot, nor a spaced em dash but in a source's name as the data writes it`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check(await w(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp'), 'Escape closes About and focus returns to the stamp');
  }
  check(A.errors.length === 0, `no console error or warning, failed request or request outside the app${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

// Reduce Motion: every animation at 0 s, flights as cuts, play in whole years
{
  console.log('\n== Reduce Motion (dark)');
  const A = await open('dark', { reduced: true });
  const { page, w } = A;
  await w(() => window.__wog.flyTo(10, 60, 360 * 10));
  await A.tapEl('#zoom-home');
  const cut = await w(() => [window.__wog.flying(), window.__wog.state.view.scale, window.__wog.state.W]);
  await A.tapEl('#accum [data-accum="cumulative"]'); await A.tapEl('#accum [data-accum="annual"]');
  const durs = await w(() => document.getAnimations().map((a) => a.effect.getComputedTiming().duration));
  await setYear(A, 1950);
  await w(() => window.__wog.log(true)); await A.tapEl('#btn-play'); await page.waitForTimeout(1200); await A.tapEl('#btn-play');
  const log = await w(() => window.__wog.log(false));
  check(!cut[0] && Math.abs(cut[1] - Math.max(160, cut[2])) < 0.5 && durs.every((d) => d === 0) && log.every((e) => Number.isInteger(e.shown) && e.label === String(e.shown)),
    `Reduce Motion: Whole world is a cut (flying ${cut[0]}), ${durs.length} animations all at 0 s, play in whole years (${new Set(log.map((e) => e.shown)).size} years)`);
  await A.shot('reduced-dark');
  check(A.errors.length === 0, `no console error or warning${A.errors.length ? ': ' + A.errors.slice(0, 4).join(' | ') : ''}`);
  await A.ctx.close();
}

// broken data: each file missing, not JSON, the wrong schema; stale; a replacement while open keeps the view
{
  console.log('\n== broken data');
  const cases = [
    ['/data/snapshot.json', { status: 404 }, /^data\/snapshot\.json could not be read \(HTTP 404\)\. Is the file missing\? The map shows outlines only; no production is drawn\.$/],
    ['/data/world.json', { status: 404 }, /^data\/world\.json could not be read \(HTTP 404\)\. Is the file missing\? No country outlines, so nothing can be colored\.$/],
    ['/data/snapshot.json', { body: '<!DOCTYPE html><html>' }, /^data\/snapshot\.json is not JSON; it looks like a web page was written over it\. The map shows outlines only; no production is drawn\.$/],
    ['/data/snapshot.json', { body: JSON.stringify({ ...snap, schema: 2 }) }, /^data\/snapshot\.json is not a World Oil & Gas snapshot: schema is 2, expected 1\. /],
    ['/data/fields.json', { body: '{"schema": 1' }, /^data\/fields\.json is not valid JSON \(unparseable or cut short\)\. Field points are not drawn; the country map is unaffected\.$/],
  ];
  for (const [p, ov, re] of cases) {
    override = { [p]: ov };
    const A = await open('light', { noWait: true, expect: /404|Failed to load resource/ });
    await A.page.waitForFunction(() => !document.getElementById('error').hidden, null, { timeout: 30000 });
    await A.page.waitForTimeout(300);
    const msg = await A.w(() => [[...document.querySelectorAll('#error div')].map((d) => d.textContent), document.getElementById('stamp').textContent, ['btn-play', 'btn-prev', 'btn-next'].map((id) => document.getElementById(id).getAttribute('aria-disabled')).join(',')]);
    const noSnap = p.endsWith('snapshot.json');
    check(msg[0].some((m) => re.test(m)) && (!noSnap || (msg[1] === 'Map only. Outlines from data/world.json.' && msg[2] === 'true,true,true')),
      `${p} ${ov.status ? `answers ${ov.status}` : ov.body.startsWith('<') ? 'is a web page' : ov.body.includes('"schema":2') ? 'has schema 2' : 'is cut short'}: "${msg[0].join(' ')}"${noSnap ? `; the stamp "${msg[1]}", the transport aria-disabled (${msg[2]})` : ''}`);
    if (p === '/data/snapshot.json' && ov.status) await A.shot('no-snapshot-light', false);
    check(A.errors.length === 0, `no console error with ${p} broken${A.errors.length ? ': ' + A.errors.slice(0, 3).join(' | ') : ''}`);
    await A.ctx.close();
  }
  // stale: a snapshot built 401 days ago; its first sentence in --ink, in both themes and in focus mode
  for (const scheme of ['light', 'dark']) {
    override = { '/data/snapshot.json': { body: JSON.stringify({ ...snap, generatedAt: new Date(Date.now() - 401 * 864e5).toISOString() }) } };
    const S = await open(scheme);
    const st = () => S.w(() => { const e = document.getElementById('stamp'), sp = e.querySelector('.stale'), cs = getComputedStyle(document.documentElement);
      const probe = document.createElement('span'); probe.style.color = cs.getPropertyValue('--ink'); document.body.append(probe); const ink = getComputedStyle(probe).color; probe.remove();
      return [e.textContent, sp ? getComputedStyle(sp).color : null, ink, e.parentElement.id]; });
    const s0 = await st();
    await S.w(() => window.__wog.focus(true)); await S.page.waitForTimeout(400);
    const s1 = await st();
    await S.w(() => window.__wog.focus(false)); await S.page.waitForTimeout(300);
    check(/^Stale\. Updated \d{1,2} \w{3} \d{4}, \d\d:\d\d, figures to 2024$/.test(s0[0]) && s0[1] === s0[2] && s1[0] === s0[0] && s1[1] === s1[2] && s1[3] === 'caption',
      `${scheme}: a snapshot 401 days old stamps "${s0[0]}", its first sentence in --ink (${s0[1]}), never red; the same in focus mode's caption band`);
    await S.ctx.close();
  }
  override = {};
  const A = await open('light');
  await A.w(() => window.__wog.flyTo(10, 60, 360 * 10));
  const v0 = await A.w(() => window.__wog.state.view.scale);
  override = { '/data/snapshot.json': { body: '{"schema": 1' } };
  await A.w(() => window.__wog.loadAll()); await A.frame();
  const after = await A.w(() => [[...document.querySelectorAll('#error div')].map((d) => d.textContent).join(' '), window.__wog.state.series, window.__wog.state.view.scale, document.getElementById('valid-time').textContent]);
  check(/is not valid JSON \(unparseable or cut short\)\. Showing the figures as last read\.$/.test(after[0]) && after[1] === snap.countries.length && after[2] === v0 && after[3] === '2024',
    `a broken replacement while open keeps what was showing and says so ("${after[0]}"), the view kept`);
  override = {};
  await A.ctx.close();
}

// after the final review (tools/DECISIONS.md "After review"): the details sheet scrolls by an upright swipe
// through the chart on short screens; the Ledger names its three widest blocks and opens a block's card on a
// tap; a drawn name opens its country and the near-field slop leaves producing countries reachable; the
// upright legend keeps its 1 000 tick; the caption says what plain land means; no world series is worded so
{
  console.log('\n== after review');
  for (const [wd, ht] of [[375, 667], [390, 719]]) {
    const A = await open('light', { w: wd, h: ht });
    await pick(A, 'Countries', 'Norway');
    await A.tapEl('#card-act'); await A.frame(); await A.page.waitForTimeout(200);
    const b = await A.rect('#details-body'), x = b.left + b.width / 2, y0 = b.top + b.height * 0.6;
    const before = await A.w(() => [document.getElementById('details-body').scrollTop, window.__wog.shown(), document.getElementById('map-wrap').getBoundingClientRect().height]);
    await A.touch('touchStart', x, y0);
    for (let k = 1; k <= 10; k++) { await A.touch('touchMove', x - k * 3, y0 - k * 6); await A.page.waitForTimeout(16); }
    await A.touch('touchEnd'); await A.page.waitForTimeout(400);
    const after = await A.w(() => [document.getElementById('details-body').scrollTop, window.__wog.shown()]);
    check(after[0] > before[0] + 30 && after[1] === before[1] && before[2] >= 150 && A.errors.length === 0,
      `${wd} × ${ht}: an upright swipe through the details sheet's body scrolls it (scrollTop ${before[0]} → ${after[0]}) and leaves the year (${before[1]} → ${after[1]}); the plate keeps ${Math.round(before[2])} px`);
    if (wd === 375) await A.shot('details-375-light', false);
    await A.ctx.close();
  }
  const A = await open('light', { init: () => {
    const f = CanvasRenderingContext2D.prototype.fillText;
    window.__lt = []; window.__ml = [];
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y) {
      if (this.canvas.id === 'ledger-cv') window.__lt.push([t, x, this.font.startsWith('560')]); else if (this.canvas.id === 'map' && this.font.startsWith('560 11.5px')) window.__ml.push([t, x, y]);
      return f.apply(this, arguments);
    };
  } });
  const { w } = A;
  // the three widest named wherever their block is 20 px or more, every year, both modes, with no country
  // chosen and with one chosen (its label first, in 560, at its block); every label of the three starts
  // where at least half its block, or 10 px of it, is still to come (never in the block's last pixels)
  for (const who of [null, 'United States', 'Norway']) {
    if (who) { await pick(A, 'Countries', who); }
    const iso = who && snap.countries.find((c) => c.name === who).iso3;
    for (const acc of ['annual', 'cumulative']) {
      const rows = await w(async ([a, y0, y1]) => {
        window.__wog.setAccum(a);
        const out = [];
        for (let y = y0; y <= y1; y++) {
          window.__lt.length = 0; window.__wog.setYear(y);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          out.push([y, window.__lt.slice(), window.__wog.ledger().blocks.map((b) => [b.iso3, b.name, b.x0, b.x1])]);
        }
        return out;
      }, [acc, Y0, Y1]);
      const missed = [], late = [], chosen = [];
      for (const [y, lt, blocks] of rows) {
        blocks.slice(0, 3).forEach(([bi, name, x0, x1]) => {
          const l = lt.find(([t, x]) => x >= x0 - 0.5 && x < x1 && (t.startsWith(name) || /^[\d.]+ %$/.test(t)));
          if (!l && x1 - x0 >= 20) missed.push(`${y} ${name}`);
          if (l && !l[2] && x1 - l[1] < Math.min((x1 - x0) / 2, 10) - 0.01) late.push(`${y} "${l[0]}" at ${l[1].toFixed(0)} in ${x0.toFixed(0)} to ${x1.toFixed(0)}`);
        });
        if (iso && blocks.some(([bi]) => bi === iso) !== lt.some((l) => l[2])) chosen.push(y);
      }
      check(missed.length === 0 && late.length === 0 && chosen.length === 0,
        `${acc}, ${who || 'no country'} chosen: the Ledger's three widest blocks are named in every year from ${Y0} to ${Y1} where the block is 20 px wide or more${missed.length ? ': unnamed ' + missed.slice(0, 6).join(', ') : ''}; no label of theirs starts in its block's last pixels${late.length ? ': ' + late.slice(0, 4).join(', ') : ''}${iso ? `; the chosen label in 560 in every year its block is drawn${chosen.length ? ', not in ' + chosen.slice(0, 6).join(', ') : ''}` : ''}`);
    }
    if (who) { await w(() => document.getElementById('card-close').click()); await A.frame(); }
  }
  await w(() => { window.__wog.setAccum('annual'); window.__wog.home(); });
  for (const y of [1973, Y1]) {
    await setYear(A, y);
    const L = await w(() => window.__wog.ledger().blocks.slice(0, 6)), lr = await A.rect('#ledger-cv'), got = [];
    for (const b of L) {
      await A.tapAt(lr.left + (b.x0 + b.x1) / 2, lr.top + 20); await A.frame();
      const s = await w(() => [window.__wog.state.sel, document.getElementById('card').hidden, document.getElementById('card-where').textContent]);
      got.push(s[0] && s[0].iso3 === b.iso3 && !s[1] ? s[2] : `WRONG ${b.name}`);
    }
    await A.tapEl('#card-close'); await A.frame();
    await A.tapAt(lr.right - 3, lr.top + 5); await A.frame();
    const none = await w(() => window.__wog.state.sel);
    check(!got.some((g) => g.startsWith('WRONG')) && none === null, `${y}: a tap on each of the strip's first six blocks opens its card (${got.join(', ')}); a tap on the hatched end opens none`);
  }
  await w(() => window.__wog.home()); await setYear(A, Y1); await A.page.waitForTimeout(200);
  {
    const [labels, drawn] = await w(() => { window.__ml = []; window.__wog.render(); return [window.__wog.labels(), window.__ml.slice()]; }), m = await A.rect('#map'), got = [];
    for (const b of labels) {
      const name = (drawn.find(([, x, y]) => x > b[0] && x < b[2] && y > b[1] && y < b[3]) || ['?'])[0];
      await w(() => document.getElementById('card').hidden || document.getElementById('card-close').click()); await A.page.waitForTimeout(330);
      await A.tapAt(m.left + (b[0] + b[2]) / 2, m.top + (b[1] + b[3]) / 2); await A.frame();
      const s = await w(() => [window.__wog.state.sel, document.getElementById('card-where').textContent]);
      got.push(s[0] && s[0].kind === 'country' && s[1] === name ? name : `WRONG: ${name} opened ${JSON.stringify(s)}`);
    }
    await A.tapEl('#card-close');
    check(labels.length >= 8 && !got.some((g) => g.startsWith('WRONG')), `a tap on each of the ${labels.length} names drawn at the opening view opens that country's card: ${got.join(', ')}`);
  }
  {
    const grid = (on) => w(async (fieldsOn) => {
      const L = document.querySelector('[data-layer="fields"]');
      if (window.__wog.state.showFields !== fieldsOn) L.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const s = window.__wog.state, out = [];
      for (let y = 4; y < s.H - 4; y += 5) for (let x = 4; x < s.W - 50; x += 5) { window.__wog.selectAt(x, y); const v = window.__wog.state.sel; out.push(v ? (v.kind === 'country' ? v.iso3 : 'F') : null); }
      document.getElementById('card-close').click();
      return out;
    }, on);
    const off = await grid(false), on = await grid(true), L = await w(() => window.__wog.ledger().blocks), rows = [];
    let ok = true;
    for (const b of L) {
      let area = 0, hit = 0;
      off.forEach((v, i) => { if (v === b.iso3) { area++; if (on[i] === b.iso3) hit++; } });
      if (area >= 50) { rows.push(`${b.name} ${Math.round((100 * hit) / area)} % of ${area}`); if (hit < area / 2) ok = false; }
    }
    check(ok && rows.length >= 5, `${Y1}, the opening view, the fields on: every Ledger producer with 50 or more grid points (5 px) of its own opens on half of them or more: ${rows.join(', ')}`);
  }
  {
    const t = await w(() => [[...document.querySelectorAll('#legend-ticks span')].map((s) => s.textContent).join(' / '), document.getElementById('readline').textContent]);
    check(t[0].includes(`1${NN}000`) && t[1].includes('Plain: no figure, or none.'), `upright at 390: the legend reads "${t[0]}"; the caption says what plain land is: "${t[1]}"`);
    await setYear(A, Y1);
    await pick(A, 'Fields', 'Nuayyim');
    const heard = await text(A, 'live');
    check(/\. No rate reported\.$/.test(heard), `a field with no rate is spoken in sentences: "${heard}"`);
  }
  check(A.errors.length === 0, `no console error after review${A.errors.length ? ': ' + A.errors.slice(0, 3).join(' | ') : ''}`);
  await A.ctx.close();
  // the caption keeps the Ledger's number in every year: where a note leads (a former state's plain lands),
  // the bar's "hatched, all under 1 %" follows it, and so does the estimate while the fields follow the year
  for (const [wd, ht, upright] of [[390, 844, true], [320, 568, true], [844, 390, false]]) {
    const C = await open('light', { w: wd, h: ht });
    const rows = await C.w(async ([y0, y1]) => {
      const out = [];
      for (const a of ['annual', 'cumulative']) {
        window.__wog.setAccum(a);
        for (let y = y0; y <= y1; y++) {
          window.__wog.setYear(y);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const e = document.getElementById('readline');
          out.push([a, y, e.textContent, e.scrollHeight <= e.clientHeight + 1]);
        }
      }
      window.__wog.setAccum('annual');
      return out;
    }, [Y0, Y1]);
    let notes = 0;
    const bad = rows.filter(([a, y, t, fit]) => {
      const n = noteIn(y, a === 'cumulative');
      if (n) notes++;
      return !fit || !t.startsWith(n ? `${n} Bar: ` : 'Bar: ') || !t.includes(`under 1${NN}%`) || (upright && !t.includes('Field sizes are estimates.'));
    });
    const y50 = rows.find(([a, y]) => a === 'annual' && y === 1950)[2];
    check(rows.length === 2 * N && bad.length === 0 && C.errors.length === 0,
      `${wd} × ${ht}: in all ${N} years, Annual and Cumulative, the caption says "under 1 %"${upright ? ' and "Field sizes are estimates."' : ''} inside its fixed height, led by a former state's note in the ${notes} where this file finds one (1950: "${y50}")${bad.length ? ': ' + bad.slice(0, 3).map((r) => `${r[0]} ${r[1]} "${r[2]}"`).join(' | ') : ''}`);
    await C.ctx.close();
  }
  // a snapshot with no world series: the shares are of the countries listed, and every sentence says so
  const noWorld = { ...snap };
  delete noWorld.world;
  override = { '/data/snapshot.json': { body: JSON.stringify(noWorld) } };
  const B = await open('light');
  const nw = await B.w(() => [document.getElementById('lead-world').textContent, document.getElementById('readline').textContent, document.getElementById('ledger-say').textContent]);
  check(nw[0].startsWith('All listed') && nw[1].startsWith("Bar: shares of all listed countries' oil and gas") && nw[2].startsWith("Shares of all listed countries' oil and gas") && B.errors.length === 0,
    `no world series: "${nw[0]}"; "${nw[1].slice(0, 60)}…"; spoken "${nw[2].slice(0, 60)}…"`);
  override = {};
  await B.ctx.close();
}

// widths: no horizontal scroll, the caption line inside its height, the plate on a phone on its side (B18)
{
  console.log('\n== widths');
  for (const [wd, ht, dpr, name] of [[320, 568, 2, '320'], [360, 740, 3, '360'], [375, 667, 2, '375'], [312, 675, 2.5, '125 % zoom'], [844, 390, 3, 'on its side']]) {
    const A = await open('light', { w: wd, h: ht, dpr });
    const r = await A.w(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, plate: document.getElementById('map-wrap').getBoundingClientRect().height, keysRow: document.getElementById('map-wrap').classList.contains('keys-row'), keys: document.getElementById('keys').getBoundingClientRect().height,
      credits: (() => { const c = document.getElementById('credits'); return c.scrollWidth <= c.clientWidth + 1 && c.getBoundingClientRect().bottom <= document.getElementById('player').getBoundingClientRect().top + 1; })() }));
    const forms = [];
    for (const [u, y, acc] of [['twh', 1900, 'annual'], ['kboe', 2017, 'annual'], ['twh', 2024, 'cumulative'], ['kboe', 1950, 'cumulative'], ['twh', 2024, 'annual']]) {
      await A.w(([uu, k, a]) => { window.__wog.setUnits(uu); window.__wog.setAccum(a); window.__wog.setYear(k); }, [u, y, acc]); await A.frame();
      forms.push(await A.w(() => { const e = document.getElementById('readline'), l = document.getElementById('lead'); return [e.scrollHeight <= e.clientHeight + 1 ? '' : e.textContent, l.scrollWidth <= l.clientWidth + 1 ? '' : l.textContent]; }));
    }
    const over = forms.flat().filter(Boolean);
    const side = name === 'on its side';
    check(r.sw <= r.iw && over.length === 0 && r.credits && (!side || (r.plate >= 220 && r.keysRow && r.keys <= 40)),
      `${name} (${wd} × ${ht}): no horizontal scroll (${r.sw} ≤ ${r.iw}), every caption and lead form inside its box${over.length ? ': over ' + over.join(' | ') : ''}, the credits whole, plate ${Math.round(r.plate)} px${side ? ` (the stock 167), the keys in one row ${Math.round(r.keys)} px high` : ''}`);
    if (side) {
      await A.shot('side-light');
      await A.tapEl('#btn-layers'); await A.frame(); await A.page.waitForTimeout(200);
      const s = await A.w(() => ({ plate: document.getElementById('map-wrap').getBoundingClientRect().toJSON(), sheet: document.getElementById('layers').getBoundingClientRect().toJSON() }));
      check(s.plate.height >= 220 && s.sheet.left >= s.plate.right - 1 && s.sheet.width <= 341, `on its side with the Layers sheet open: a ${Math.round(s.sheet.width)} px column at the plate's right, the plate ${Math.round(s.plate.width)} × ${Math.round(s.plate.height)} px`);
      await A.shot('side-layers-light', false);
    }
    if (name === '320') {
      await A.w(() => window.__wog.pick('Countries', 'Norway')); await A.page.waitForTimeout(700);
      await A.tapEl('#card-act'); await A.frame();
      const sp = await A.w(() => [document.getElementById('map-wrap').getBoundingClientRect().height, document.getElementById('details').getBoundingClientRect().height]);
      check(sp[0] >= 150, `B16: at 320 × 568 a country's details take the sheet's slot (${Math.round(sp[1])} px) and the plate keeps ${Math.round(sp[0])} px, never covered`);
    }
    check(A.errors.length === 0, `no console error at ${name}${A.errors.length ? ': ' + A.errors.slice(0, 3).join(' | ') : ''}`);
    await A.ctx.close();
  }
}

await browser.close();
server.close();
const after = hashOf(appPng);
check(after === appPngHash, `screenshots/app.png (the README's composite) untouched: ${appPngHash ? appPngHash.slice(0, 12) : 'absent'}…`);
if (fails.length) { console.log(`\n${fails.length} check(s) failed:\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('\nall checks pass');
