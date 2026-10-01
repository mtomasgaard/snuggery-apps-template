// Drive Warming World in headless Chromium at phone size (390 × 844 CSS px, DPR 2, touch), light and
// dark (DESIGN §16). Fails on any console error or warning, page error, failed request, HTTP ≥ 400,
// any request that is not to the local server, and any data: or blob: request. Every figure it asserts
// is worked out here from the shipped files with Node's own zlib and its own formulas (the labels, the
// means, the coverage, the projection, the ramp), never with js/*.js, so a bug in the app cannot agree
// with itself. Frame times are SwiftShader's: a trend, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs [outdir]
//   SCHEMES=light node tools/shoot.mjs            one theme (SCHEMES=none: only the once-scenes)
//   SCRUB=0 node tools/shoot.mjs                  skip the 100-second three-speed scrub
//
// Scenes, in each theme: the last complete year on the globe (label, global mean, coverage, the legend's
// count, the card's ground, sampled pixels against this file's own ramp, the top bar's stamp); 1880 over
// the Atlantic (hatch pixels where the snapshot has no value); the map in 2025 with the view carried
// across; the partial year (its label, the open stripe, the legend's caption); the last 24 months; the
// tap card on Fairbanks (its value, place, chart name and the cell's own stripes against this file's
// decode; opaque paper; it follows the step without drawing again) and on a no-data cell in 1880; the
// Arctic and Antarctic turns (72°, the key on, the cap's mean against this file's own sum) and Arctic
// from the map; About (every placeholder filled, the coverage numbers, addresses as plain text, no
// link, NASA's line, Natural Earth, Archivo, the version line's five taps); focus mode (entered by a
// touch and by Enter, hidden and inert, the accessibility tree, the new seat, a scrub, play and a tap
// in focus, left by Escape and by the ghost key); text contrast over every rendered text style and the
// canvas text pairs; hit targets; the fonts loaded before any canvas text; a forced context loss and
// restore. Once: play across a decade and for 3 s (the label is the drawn step on every frame, each step
// exactly one on; no element animates a number but the rolling year); a real-touch scrub across the
// whole track at 2, 8 and 20 steps a second (the drawn step is the step under the finger on every
// frame, and the label is the drawn step); a tap by the hook and by a real touch over Fairbanks; the
// chart drawing itself over 480 ms (and whole at once under Reduce Motion); the opening (a touch ends it;
// waited out once; never twice, never under Reduce Motion, never in focus mode); a reload keeps the view,
// the mode, the step and focus mode; hidden pauses play; focus mode under Reduce Motion and at 844 × 390;
// a snapshot replaced while open and a broken replacement; missing, broken and stale snapshots (the
// sentences); no WebGL 2 (the sentence; the track and play still work); widths 320, 360, 375 and
// 844 × 390, a rotation, and 125 % zoom without horizontal scroll.
// The QA pass added: the selected cell's mark is hollow at 0°, 45°, 64° and 80° on the globe and the
// map (the cell's ramp color at its centre, the overlay clear of it, the mark's ink on all four sides);
// pressed, hover and focus on every kind of key, in grays, with a mouse in both themes and by a held
// touch; the legend's one-line caption and credit and its height; the one-line stamp; theme-color; the
// switch's underline by transform; translate="no" on the proper names; place labels per view at zoom 1;
// the legend inside its reserve at 320, 360 and 375. Pictures: screenshots/*-{light,dark}.png — never
// screenshots/app.png, which is the README's two-pane composite (Tools/compose-readme.py in the private
// repository) and must survive a run of this script; every scene under tools/.work/shots/.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); } catch (e) {
  console.error(`Playwright could not be loaded (${e.code || e.message}): set PLAYWRIGHT_MODULE to a playwright/index.mjs.`); process.exit(4);
}
const chromium = pw.chromium || pw.default.chromium;
const out = path.resolve(process.argv[2] || path.join(APP, 'tools', '.work', 'shots'));
fs.mkdirSync(out, { recursive: true });
const schemes = (process.env.SCHEMES || 'light,dark').split(',');

/* ── the data, decoded here independently ── */
const snap = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
const ALL = [...snap.steps, ...snap.months], NY = snap.steps.length, L = ALL.length;
const frames = ALL.map((s) => zlib.inflateSync(Buffer.from(s.planes['anom.v'], 'base64')));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const NN = ' ', MINUS = '−';
const figure = (k) => (k < NY ? String(ALL[k].year) : `${MON[+ALL[k].month.slice(5) - 1]} ${ALL[k].month.slice(0, 4)}`);
const signed2 = (v) => { const h = Math.round(v * 100), a = Math.abs(h); return `${h > 0 ? '+' : h < 0 ? MINUS : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`; };
const cover = (a) => {
  const k = Math.round(a * 10000), whole = Math.floor((2 * k + 100) / 200);
  const p = whole === 100 && k < 10000 ? (Math.floor(k / 10) / 10).toFixed(1) : whole === 0 && k > 0 ? (Math.ceil(k / 10) / 10).toFixed(1) : String(whole);
  return `Data cover ${p}${NN}% of Earth’s surface`;
};
const meanText = (k) => {
  const s = ALL[k];
  return s.partial ? `Global mean so far ${signed2(s.globalMean)}${NN}°C (${s.months} months)` : `Global mean ${signed2(s.globalMean)}${NN}°C`;
};
const lastComplete = snap.steps.findLastIndex((s) => !s.partial), partial = snap.steps.findIndex((s) => s.partial);
/* ART.md's stops, interpolated in OKLab, converted with Ottosson's matrices — written here again */
const ART = [[-4, 0.44, 0.12, 262], [-2, 0.64, 0.105, 251], [-1, 0.8, 0.062, 245], [-0.5, 0.89, 0.03, 240], [0, 0.965, 0.004, 95], [0.5, 0.89, 0.032, 30], [1, 0.8, 0.068, 28], [2, 0.64, 0.125, 27], [4, 0.44, 0.125, 24]];
function rampHere(v) {
  v = Math.max(-4, Math.min(4, v));
  let i = 0; while (i < ART.length - 2 && v > ART[i + 1][0]) i++;
  const [v0, L0, C0, h0] = ART[i], [v1, L1, C1, h1] = ART[i + 1], t = (v - v0) / (v1 - v0);
  const a0 = C0 * Math.cos(h0 * Math.PI / 180), b0 = C0 * Math.sin(h0 * Math.PI / 180), a1 = C1 * Math.cos(h1 * Math.PI / 180), b1 = C1 * Math.sin(h1 * Math.PI / 180);
  const Lr = L0 + (L1 - L0) * t, a = a0 + (a1 - a0) * t, b = b0 + (b1 - b0) * t;
  const l = (Lr + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (Lr - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (Lr - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .map((x) => { x = Math.min(1, Math.max(0, x)); return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)); });
}
const D = Math.PI / 180;
/** Orthographic forward, written here: [x, y, z] in globe radii for a view centre (lon0, lat0). */
const ortho = (lon, lat, lon0, lat0) => {
  const c = Math.cos(lat * D), d = (lon - lon0) * D;
  return [c * Math.sin(d), Math.cos(lat0 * D) * Math.sin(lat * D) - Math.sin(lat0 * D) * c * Math.cos(d), Math.sin(lat0 * D) * Math.sin(lat * D) + Math.cos(lat0 * D) * c * Math.cos(d)];
};

/** Equal Earth forward, written here (Šavrič, Patterson and Jenny 2018): [x, y] in map units for dλ, φ in radians. */
const EE = [1.340264, -0.081106, 0.000893, 0.003796], EM = Math.sqrt(3) / 2;
const eeHere = (dl, phi) => {
  const t = Math.asin(EM * Math.sin(phi)), t2 = t * t, t6 = t2 * t2 * t2;
  return [(dl * Math.cos(t)) / (EM * (EE[0] + 3 * EE[1] * t2 + t6 * (7 * EE[2] + 9 * EE[3] * t2))), t * (EE[0] + EE[1] * t2 + t6 * (EE[2] + EE[3] * t2))];
};
/** A computed color ("rgb(…)", "rgba(…)", "color(srgb …)") → [r, g, b, a] on 0..1; and whether it is a gray (or nothing). */
const colorOf = (c) => {
  const n = (String(c).match(/-?[\d.]+(?:e-?\d+)?/g) || []).map(Number);
  if (/^color\(srgb/.test(c)) return [n[0], n[1], n[2], n[3] == null ? 1 : n[3]];
  return [n[0] / 255, n[1] / 255, n[2] / 255, n[3] == null ? 1 : n[3]];
};
const grayOrNone = (c) => { const v = colorOf(c); return v[3] === 0 || (Math.abs(v[0] - v[1]) < 1e-3 && Math.abs(v[1] - v[2]) < 1e-3); };
/** The proper names a translator must leave alone (js/util.js NAMES, written here again). */
const NAMES_RE = /\b(?:NASA GISS|GISS|GISTEMP(?: v4)?|Archivo|Natural Earth)\b/g;
/** Text nodes under a root that carry a proper name outside a translate="no" element. */
const untranslatable = (ww, root, extra = []) => ww(([sel, src, ex]) => {
  const re = new RegExp(src + (ex.length ? '|' + ex.join('|') : ''), 'g'), bad = [];
  const w = document.createTreeWalker(document.querySelector(sel), NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) { const m = t.textContent.match(re); if (m && !t.parentElement.closest('[translate="no"]')) bad.push(m[0]); }
  const kept = document.querySelectorAll(`${sel} [translate="no"]`).length;
  return { bad, kept };
}, [root, NAMES_RE.source, extra]);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const tenthsText = (t) => `${t > 0 ? '+' : t < 0 ? MINUS : ''}${Math.floor(Math.abs(t) / 10)}.${Math.abs(t) % 10}${NN}°C`;
const pct1 = (a) => { const k = Math.round(a * 10000), t = Math.floor((2 * k + 10) / 20); return `${Math.floor(t / 10)}.${t % 10}${NN}%`; };
const baseText = snap.release.base.replace('-', '–');
const newestLong = `${MONTHS[+snap.release.newestMonth.slice(5) - 1]} ${snap.release.newestMonth.slice(0, 4)}`;
/** The mean of a cap's cells with a value (rows 0–12 north, 77–89 south), area-weighted, in hundredths; written here again. */
function capHere(k, north) {
  let s = 0, w = 0, all = 0;
  for (let r = 0; r < 13; r++) {
    const row = north ? r : 89 - r, wt = Math.cos((89 - 2 * row) * D);
    for (let c = 0; c < 180; c++) { all += wt; const b = frames[k][row * 180 + c]; if (b !== 255) { s += wt * (b - 127); w += wt; } }
  }
  const x = (Math.abs(s) / w) * 10, f = Math.floor(x);            // half away from zero; a tie within 1e-9 is a tie
  const h = w ? Math.sign(s) * (x - f >= 0.5 - 1e-9 ? f + 1 : f) : null;
  return { h, share: w / all };
}
/** The SI spacing the app sets on the snapshot's credit lines (review R-5): U+202F before °C, km and %. */
const siSp = (t) => t.replace(/(\d) (°C|km|%)/g, `$1${NN}$2`);
const cap2 = (h) => `${h > 0 ? '+' : h < 0 ? MINUS : ''}${Math.floor(Math.abs(h) / 100)}.${String(Math.abs(h) % 100).padStart(2, '0')}${NN}°C`;
/** A cell's annual series as this file decodes it: tenths, or null. */
const cellSeries = (row, col) => snap.steps.map((s, k) => { const b = frames[k][row * 180 + col]; return b === 255 ? null : b - 127; });
const SHOTS = path.join(APP, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

/* ── the server: the app folder ── */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain' };
let snapOverride = null;                                 // { status } or { body } for data/snapshot.json
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (u === '/data/snapshot.json' && snapOverride) {
    if (snapOverride.status) { res.writeHead(snapOverride.status); res.end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(snapOverride.body); return;
  }
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// The one message tolerated: SwiftShader's notice when a frame is read back (a screenshot, __ww.pixel).
const NOISE = /GPU stall due to ReadPixels/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

async function open(scheme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: o.dpr || 2, isMobile: !o.desktop, hasTouch: !o.desktop, colorScheme: scheme, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  // the opening runs once per install: every scene but the opening's own starts with it already stored
  if (!o.opening) await ctx.addInitScript(() => { try { localStorage.setItem('ww.opened', 'true'); } catch { /* fine */ } });
  if (o.init) await ctx.addInitScript(o.init);
  const page = await ctx.newPage(), errors = [];
  // a notched or Dynamic Island iPhone's env(safe-area-inset-*), before the page loads (it declares viewport-fit=cover)
  if (o.insets) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: o.insets });
  const excused = (t) => NOISE.test(t) || (o.expect && o.expect.test(t));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(origin)) errors.push(`REQUEST OUTSIDE THE LOCAL SERVER: ${u.slice(0, 80)}`); });
  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  await page.waitForFunction(() => window.__ww && window.__ww.ready(), null, { timeout: 60000 });
  const ms = Date.now() - t0;
  const ww = (fn, arg) => page.evaluate(fn, arg);
  const settle = () => ww(() => window.__ww.settled());
  if (!o.opening) await settle();                         // the opening plays for 18 s: its scenes read it as it runs
  const shot = async (name, keep) => {
    await settle(); await page.waitForTimeout(250);
    const p = path.join(out, `${name}-${scheme}.png`); await page.screenshot({ path: p }); console.log(`  ${path.basename(p)}`);
    if (keep) { const q = path.join(SHOTS, keep === true ? `${name}-${scheme}.png` : keep); fs.copyFileSync(p, q); console.log(`  → screenshots/${path.basename(q)}`); }
  };
  return { ctx, page, errors, ww, settle, shot, ms };
}
/** The app's state; the legend's word joiners (U+2060, which keep "Jan–Jul" on one line) removed. */
const S = async (ww) => { const s = await ww(() => window.__ww.state()); s.legendCaption = s.legendCaption.replace(/\u2060/g, ''); return s; };
const goto = (ww, x) => ww((v) => window.__ww.goto(v), x);
const setView = (ww, v) => ww((x) => window.__ww.view(x), v);

/** Sample the WebGL frame at cells of layer k under the current globe view: hatch where 255, the
 *  ramp's color elsewhere. Returns {hatch: [n, bad], data: [n, bad], worst}. */
async function samplePixels(ww, k, n = 12) {
  const s = await S(ww), g = s.view.globe, R = s.view.radius;
  const f = frames[k], picks = { hatch: [], data: [] };
  for (let row = 0; row < 90; row++) for (let col = 0; col < 180; col++) {
    const lat = 89 - 2 * row, lon = -179 + 2 * col, p = ortho(lon, lat, g.lon, g.lat);
    if (p[2] < 0.6) continue;
    const b = f[row * 180 + col], kind = b === 255 ? 'hatch' : 'data';
    if (picks[kind].length < 400) picks[kind].push({ b, x: s.view.cx + R * p[0], y: s.view.cy - R * p[1] });
  }
  const res = { hatch: [0, 0], data: [0, 0], worst: 0 };
  for (const kind of ['hatch', 'data']) {
    const list = picks[kind], step = Math.max(1, Math.floor(list.length / n));
    for (let i = 0; i < list.length && res[kind][0] < n; i += step) {
      const q = list[i], px = await ww(([x, y]) => window.__ww.pixel(x, y), [q.x, q.y]);
      res[kind][0]++;
      if (kind === 'hatch') { if (!(px.every((c) => c === 152) || px.every((c) => c === 128))) res.hatch[1]++; }
      else { const want = rampHere((q.b - 127) / 10), d = Math.max(...want.map((c, j) => Math.abs(c - px[j]))); res.worst = Math.max(res.worst, d); if (d > 1) res.data[1]++; }
    }
  }
  return res;
}

/** Every visible control's hit area: the run of points through its centre that land on it (US Quakes'). */
const hitTargets = (ww) => ww(() => {
  const bad = [], seen = [];
  for (const e of document.querySelectorAll('button, [role="slider"]')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight || !at(cx, cy)) continue;
    seen.push(e.id || (e.textContent || '').trim().slice(0, 12));
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 120 && at(cx + (s * k * dx) / 2, cy + (s * k * dy) / 2); k++) n++; return n / 2; };
    const okV = r.height >= 44 || run(0, 1) >= 43.5, okH = r.width >= 44 || run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Text contrast over every rendered DOM text style (backgrounds composited), and the canvas text pairs
 *  from the tokens the canvases draw with (canvas glyphs cannot be read back as one color). */
const contrastOf = (ww) => ww(() => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const v = m ? m[1].split(/[ ,/]+/).map(Number) : [0, 0, 0, 0]; return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.trim().slice(i, i + 2), 16)).concat(1);
  const L = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const over = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  const ground = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } } let bg = ground; for (const c of stack.reverse()) bg = over(c, bg); return bg; };
  let worst = [99, ''], n = 0;
  const styles = new Set();
  for (const e of document.querySelectorAll('#app *')) {
    if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || e.closest('[hidden]') || e.closest('.sr') || e.disabled) continue;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const bg = bgOf(e), fg = over(rgba(cs.color), bg), k = ratio(fg, bg);
    styles.add(`${cs.color}|${bg.join()}|${cs.fontSize}|${cs.fontWeight}`); n++;
    if (k < worst[0]) worst = [k, `${e.tagName}#${e.id}.${e.className} "${e.textContent.trim().slice(0, 24)}" ${cs.color}`];
  }
  const v = (t) => hex(getComputedStyle(document.documentElement).getPropertyValue(t));
  const pairs = [['track caption and labels', '--ink-2', '--page'], ['track bracket label', '--ink', '--page'], ['legend labels', '--card-ink', '--card'], ['legend counts', '--card-ink-2', '--card'],
    ['chart axes, labels, global mean', '--ink-3', '--sheet'], ['months row labels', '--ink-3', '--sheet']];
  const canvas = pairs.map(([what, f, b]) => [what, +ratio(v(f), v(b)).toFixed(2)]);
  // place labels: #121212 over a #f5f5f5 halo at 85 % over the darkest and the lightest data, and the hatch (the same in both themes)
  const halo = (g) => over([245, 245, 245, 0.85], g);
  canvas.push(['place labels on their halo (worst of +4 °C, −4 °C, hatch)', +Math.min(...[[138, 47, 47, 1], [44, 79, 148, 1], [128, 128, 128, 1]].map((g) => ratio([18, 18, 18, 1], halo(g)))).toFixed(2)]);
  const cw = canvas.reduce((w, c) => (c[1] < w[1] ? c : w), ['', 99]);
  return { worst, n, styles: styles.size, canvas, canvasWorst: cw };
});
const allWritten = (w) => w == null || w === Infinity;
const S2 = (ww) => ww(() => { const s = window.__ww.state(); return { ...s, legendCaption: s.legendCaption.replace(/\u2060/g, '') }; });

for (const scheme of schemes.filter((x) => x !== 'none')) {
  console.log(`\n== ${scheme}`);
  const A = await open(scheme);
  const { ww, page } = A;
  let s = await S(ww);
  // 1. the last complete year on the globe
  console.log(`  - boot: ready in ${A.ms} ms (first draw ${s.firstDraw && s.firstDraw.toFixed(0)} ms after the module ran, every frame resident ${s.decode && s.decode.ms} ms) — SwiftShader, trend only`);
  check(s.shown === lastComplete && s.label === figure(lastComplete) && s.mean === meanText(lastComplete) && s.cover === cover(ALL[lastComplete].coverage.area),
    `opens on the last complete year: "${s.label}", "${s.mean}", "${s.cover}"`);
  check(s.resident === L && s.decode.done === L && s.gl.layers === L && s.gl.uploads >= L, `every frame resident: ${s.resident} of ${L} layers decoded and uploaded (${s.gl.uploads} uploads, ${s.gl.gpuBytes} B on the GPU)`);
  check(s.fontAtFirstText === 'loaded' && s.fontNow === 'loaded' && await ww(() => document.fonts.check('600 28px Archivo') && document.fonts.check('semi-condensed 400 10.5px Archivo')),
    `Archivo was ${s.fontAtFirstText} before the first canvas text, and is ${s.fontNow} now`);
  {
    // the legend (§20 Q-5): the caption on one line, the credit one small line, the whole foot measured
    const credit = siSp(snap.source.attribution).replace(/^Temperature:\s*/, 'Data: ').replace(' Surface Temperature Analysis (', ' (');
    const lg = await ww(() => { const h = (id) => document.getElementById(id).getBoundingClientRect().height; return { legend: h('legend'), cap: h('legend-caption'), credit: h('legend-credit'), line: parseFloat(getComputedStyle(document.getElementById('legend-credit')).lineHeight) }; });
    check(/^Anomaly vs\. each place’s 1951–1980 average, not temperature\.$/.test(s.legendCaption) && s.legendCredit === credit && lg.cap <= lg.line + 0.5 && lg.credit <= lg.line + 0.5 && lg.legend <= 70,
      `the legend says anomaly, not temperature, on one line (${lg.cap.toFixed(1)} px), and the credit in one line (${lg.credit.toFixed(1)} px): "${s.legendCredit}"; the legend is ${lg.legend.toFixed(1)} px tall (was about 108)`);
    // the stamp (§20 Q-6): one line, the release, and the research mode in words (or when a live copy was made)
    const d = new Date(snap.generatedAt), want = `Data to ${newestLong}${snap.release.mode === 'research' ? ', archived copy' : `, updated ${MON[d.getMonth()]} ${d.getDate()}`}`;
    const st1 = await ww(() => { const a = document.getElementById('stamp-1').getBoundingClientRect(), b = document.getElementById('stamp-2').getBoundingClientRect(); return { same: Math.abs(a.top - b.top) < 0.5, h: document.getElementById('stamp').getBoundingClientRect().height }; });
    check(s.stamp === want && st1.same && st1.h <= 44.5, `the top bar's stamp is one line (${st1.h} px tall): "${s.stamp}"`);
    // the browser's bar takes the page's gray in each theme
    const tc = await ww(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => [m.media, m.content]));
    const page = await ww(() => getComputedStyle(document.documentElement).getPropertyValue('--page').trim());
    const mine = tc.find((m) => m[0].includes(scheme));
    check(tc.length === 2 && mine && mine[1] === page && tc.every((m) => grayOrNone(m[1].replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`))),
      `theme-color for both schemes (${tc.map((m) => `${m[0]} ${m[1]}`).join('; ')}); this ${scheme} page's is --page ${page}`);
  }
  await setView(ww, { mode: 'globe', lon: -150, lat: 50, zoom: 1 });
  const ground = await ww(() => window.__ww.pixel(6, 60)), cardHex = scheme === 'light' ? 190 : 48;
  check(ground.every((c) => c === cardHex), `the Earth sits on the gray card: a corner pixel reads [${ground}] (--card ${cardHex})`);
  let px = await samplePixels(ww, lastComplete);
  check(px.data[1] === 0 && px.hatch[1] === 0 && px.data[0] >= 8, `${figure(lastComplete)}: ${px.data[0]} cells drawn in this file's own ramp color (worst channel off by ${px.worst}), ${px.hatch[0]} no-data cells hatched, ${px.data[1] + px.hatch[1]} wrong`);
  await A.shot('globe-2025');
  {
    // place labels at zoom 1 on the phone globe and map: tier 1 only below zoom 1.5 (§20 Q-9)
    const n = { globe: [], map: [] };
    for (const mode of ['globe', 'map']) for (let lon = -180; lon < 180; lon += 30) { await setView(ww, { mode, lon, lat: 20, lon0: lon, zoom: 1 }); n[mode].push(await ww(() => window.__ww.perf().overlayStats.labels)); }
    await setView(ww, { mode: 'globe', lon: 30, lat: 40, zoom: 1.5 });
    const z15 = await ww(() => window.__ww.perf().overlayStats.labels);
    await setView(ww, { mode: 'globe', lon: 30, lat: 40, zoom: 1 });
    const z1 = await ww(() => window.__ww.perf().overlayStats.labels);
    check(Math.max(...n.globe) <= 16 && Math.max(...n.map) <= 16 && z15 > z1,
      `place labels at zoom 1, every 30° of longitude: globe ${n.globe.join(' ')}, map ${n.map.join(' ')} (at most 16); over Europe ${z1} at zoom 1, ${z15} at 1.5 where tier 2 returns`);
    await setView(ww, { mode: 'globe', lon: -150, lat: 50, zoom: 1 });
  }

  // 2. 1880 over the Atlantic: the hatch where GISS has no value
  await goto(ww, 1880); await setView(ww, { lon: 0, lat: 20 });
  s = await S(ww);
  px = await samplePixels(ww, 0);
  check(s.label === '1880' && s.mean === meanText(0) && s.cover === cover(ALL[0].coverage.area) && px.hatch[0] >= 8 && px.hatch[1] === 0 && px.data[1] === 0,
    `1880: "${s.mean}", "${s.cover}"; ${px.hatch[0]} no-data cells read a hatch gray, ${px.data[0]} data cells their ramp color, ${px.hatch[1] + px.data[1]} wrong`);
  await A.shot('globe-1880');

  // 3. the map in 2025, the view carried across
  await goto(ww, ALL[lastComplete].year); await setView(ww, { mode: 'globe', lon: -150, lat: 50 });
  await setView(ww, 'map');
  s = await S(ww);
  check(s.view.mode === 'map' && s.view.map.lon0 === -150 && s.label === figure(lastComplete), `Globe → Map in ${s.label}: the central meridian is the globe's longitude (${s.view.map.lon0})`);
  await A.shot('map-2025');
  {
    // the switch's underline moves by transform alone (QA nit): translateX to the option, scaleX its width
    await page.waitForTimeout(200);
    const u = await ww(() => { const mk = document.querySelector('#view-seg .mark'), b = document.querySelector('#view-seg button[data-v="map"]'), cs = getComputedStyle(mk); return { tf: cs.transform, prop: cs.transitionProperty, left: cs.left, width: cs.width, x: b.offsetLeft, w: b.offsetWidth }; });
    const m = (u.tf.match(/matrix\(([^)]+)\)/) || [, ''])[1].split(',').map(Number);
    check(u.prop === 'transform' && u.left === '0px' && u.width === '1px' && Math.abs(m[0] - u.w) < 0.01 && Math.abs(m[4] - u.x) < 0.01,
      `the Globe | Map underline: ${u.tf} (scaleX ${u.w}, translateX ${u.x}); transition-property ${u.prop}; left ${u.left}, width ${u.width}`);
  }
  await setView(ww, 'globe');
  s = await S(ww);
  check(s.view.globe.lon === -150 && s.view.globe.lat === 50, `Map → Globe: longitude ${s.view.globe.lon}, latitude kept ${s.view.globe.lat}`);

  // 4. the partial year
  if (partial >= 0) {
    await goto(ww, ALL[partial].year);
    s = await S(ww);
    const span = ALL[partial].label.match(/Jan–[A-Z][a-z]{2}/)[0];
    check(s.label === String(ALL[partial].year) && s.sub === `${span}, partial` && s.mean === meanText(partial) && s.legendCaption.includes(`Partial year: ${span}.`),
      `the partial year: "${s.label}" / "${s.sub}", "${s.mean}", legend "${s.legendCaption}"`);
    // the open stripe, read with the thumb far away (at 1880): its top and bottom thirds carry the
    // stripe's color, its middle third is left to the page (transparent on the track's canvas)
    await goto(ww, 1880);
    const open = await ww(() => {
      const c = document.getElementById('track'), k = c.width / c.clientWidth, w = c.clientWidth, n = window.__ww.state().track.n;
      const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
      const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0);
      const d = x.getImageData(0, 0, t.width, t.height).data, col = Math.floor((1 + ((n - 0.5) * (w - 2)) / n) * k);
      const get = (y) => { const o = (Math.floor(y * k) * t.width + col) * 4; return [d[o], d[o + 1], d[o + 2], d[o + 3]]; };
      return { top: get(20), mid: get(29.5), bottom: get(39) };
    });
    const wantTop = rampHere((Math.max(-1.5, Math.min(1.5, ALL[partial].globalMean)) * 4) / 1.5);
    const near = (a) => a[3] === 255 && Math.max(...wantTop.map((c, j) => Math.abs(c - a[j]))) <= 1;
    check(near(open.top) && near(open.bottom) && open.mid[3] === 0,
      `the partial year's stripe is open: top and bottom thirds [${open.top.slice(0, 3)}] / [${open.bottom.slice(0, 3)}] (its mean on the ±1.5 °C scale: [${wantTop}]), the middle third empty to the page (alpha ${open.mid[3]})`);
    await goto(ww, ALL[partial].year);
    await A.shot('partial');
  }

  // 5. the last 24 months
  await ww(() => window.__ww.mode('months'));
  await A.settle();
  s = await S(ww);
  check(s.mode === 'months' && s.shown === L - 1 && s.label === figure(L - 1) && s.mean === meanText(L - 1) && s.legendCaption.includes('Single months swing further than years.'),
    `Last 24 months opens on the newest month: "${s.label}", "${s.mean}", "${s.cover}"`);
  const cap = await ww(() => document.getElementById('track-hit').getAttribute('aria-valuetext'));
  check(cap === `${ALL[L - 1].label}, global mean ${signed2(ALL[L - 1].globalMean)}${NN}°C`, `the scrubber's value text: "${cap}"`);
  await A.shot('months');
  await goto(ww, '2025-01');
  s = await S(ww);
  check(s.label === 'Jan 2025' && s.cover === cover(ALL[NY + snap.months.findIndex((m) => m.month === '2025-01')].coverage.area), `a month: "${s.label}", "${s.cover}"`);
  await ww(() => window.__ww.mode('annual'));
  await A.settle();
  s = await S(ww);
  check(s.label === '2025', `back to Annual: the year of the month showing, "${s.label}"`);

  // 6. a forced context loss and restore
  const c0 = await ww(() => window.__ww.pixel(195, 300));
  await ww(() => window.__ww.loseContext());
  await page.waitForTimeout(300);
  const during = (await S(ww)).notices;
  await ww(() => window.__ww.restoreContext());
  await A.settle(); await page.waitForTimeout(400);
  const c1 = await ww(() => window.__ww.pixel(195, 300)), after = await S(ww);
  check(during.includes('Restoring the view…') && after.gl.restores === 1 && c0.join() === c1.join() && !after.notices.includes('Restoring the view…'),
    `context loss: "${during.join('; ')}" while lost; restored (${after.gl.restores}), the centre pixel [${c1}] equals the one before [${c0}]`);


  // 7. the tap card on Fairbanks in the last complete year: value, place, chart, the cell's stripes
  {
    const y = ALL[lastComplete].year, ser = cellSeries(12, 16);
    await goto(ww, y); await setView(ww, { mode: 'globe', lon: -150, lat: 50, zoom: 1 });
    await ww(() => window.__ww.tap(-147.71, 64.84));
    await A.settle();
    s = await S(ww);
    const done = ser.map((v, k) => [v, k]).filter(([v, k]) => v != null && k !== partial);
    const lo = done.reduce((a, b) => (b[0] < a[0] ? b : a)), hi = done.reduce((a, b) => (b[0] > a[0] ? b : a)), first = ser.findIndex((v) => v != null);
    const name = `Line chart of this cell’s annual anomaly from ${ALL[0].year} to ${y}. First year with data ${ALL[first].year}. Lowest ${tenthsText(lo[0])} in ${ALL[lo[1]].year}, highest ${tenthsText(hi[0])} in ${ALL[hi[1]].year}.`;
    const c = s.card;
    check(c && c.value === tenthsText(ser[lastComplete]) && c.when === `in ${y}, against this cell’s ${baseText} average` && c.place === '64–66° N, 148–146° W, with Fairbanks' && c.chart === name && !c.drawing,
      `the card: "${c && c.place}", "${c && c.value}" "${c && c.when}"; the chart's name "${c && c.chart}"`);
    const where = `Land and sea ice: station anomalies spread up to 1${NN}200${NN}km. Open water: sea-surface anomalies.`;
    check(c && c.foot === `Annual mean of at least ${snap.annual.minMonths} of 12 months. ${where}`, `the card's footnote from the snapshot's rules, true for land and open water: "${c && c.foot}"`);
    // the cell's line is whole wherever the snapshot has two years in a row (review R-1: no label cuts it),
    // and the global mean's key sits in the labels row, outside the plot
    {
      const g = c && c.geom, R = g && g.R;
      const res = await ww(([G, ser, P]) => {
        const cv = document.getElementById('c-chart'), k = cv.width / cv.clientWidth;
        const x = cv.getContext('2d', { willReadFrequently: true }), d = x.getImageData(0, 0, cv.width, cv.height).data;
        const css = (t) => [1, 3, 5].map((i) => parseInt(getComputedStyle(document.documentElement).getPropertyValue(t).trim().slice(i, i + 2), 16));
        const ink = css('--ink'), sheet = css('--sheet'), full = Math.abs(ink[0] - sheet[0]);
        const X = (i) => G.x0 + ((i + 0.5) * (G.x1 - G.x0)) / G.n, Y = (t) => G.top + G.ph / 2 - (t / (G.R * 10)) * (G.ph / 2);
        const gaps = []; let n = 0;
        for (let i = 0; i + 1 < ser.length; i++) {
          if (ser[i] == null || ser[i + 1] == null || i === P || i + 1 === P) continue;
          for (const f of [0.25, 0.5, 0.75]) {
            const cx = X(i) + f * (X(i + 1) - X(i)), cy = Y(ser[i]) + f * (Y(ser[i + 1]) - Y(ser[i])), px = Math.round(cx * k);
            let best = 0;
            for (let dy = -2.5; dy <= 2.5; dy += 0.5) { const py = Math.round((cy + dy) * k), o = (py * cv.width + px) * 4; best = Math.max(best, Math.abs(d[o] - sheet[0])); }
            n++; if (best < full * 0.7) gaps.push(i);         // 0.7: the gray global-mean line does not count
          }
        }
        return { n, gaps: [...new Set(gaps)] };
      }, [g, ser, partial]);
      check(g && g.key != null && res.n > 400 && res.gaps.length === 0, `the cell's line is unbroken across every pair of years with data (${res.n} points on ${res.n / 3} segments, ${res.gaps.length} with a gap${res.gaps.length ? ': ' + res.gaps.map((i) => ALL[i].year).join(', ') : ''}); the global mean's key in the labels row at x ${g && g.key && g.key.toFixed(1)}, ±${R} °C plot`);
    }
    // the cell's own stripes under the chart, on the map's ±4 °C scale: 2025's stripe and a no-data year
    const px = await ww(([k25, kNone]) => {
      const cv = document.getElementById('c-chart'), k = cv.width / cv.clientWidth, w = cv.clientWidth, x0 = 0;
      const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height; const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0);
      const d = x.getImageData(0, 0, t.width, t.height).data;
      // the plot's left edge is where the 1880 stripe starts: find the first opaque pixel on the stripes row
      const row = Math.round(103 * k); let left = 0; for (let i = 0; i < t.width; i++) if (d[(row * t.width + i) * 4 + 3] === 255) { left = i / k; break; }
      const right = w - 4, n = window.__ww.state().track.n, at = (i) => { const xx = Math.floor((left + ((i + 0.5) * (right - left)) / n) * k), o = (row * t.width + xx) * 4; return [d[o], d[o + 1], d[o + 2], d[o + 3]]; };
      return { last: at(k25), none: kNone >= 0 ? at(kNone) : null, left };
    }, [lastComplete, ser.findIndex((v) => v == null)]);
    const want = rampHere(ser[lastComplete] / 10);
    check(Math.max(...want.map((v, j) => Math.abs(v - px.last[j]))) <= 1 && (!px.none || (px.none[0] === px.none[1] && px.none[1] === px.none[2] && px.none[0] >= 120 && px.none[0] <= 160 && px.none[3] === 255)),
      `the cell's stripes: ${y} drawn [${px.last.slice(0, 3)}] = the ±4 °C ramp at ${ser[lastComplete] / 10} [${want}]; a year with no value hatched [${px.none && px.none.slice(0, 3)}]`);
    const look = await ww(() => { const cs = getComputedStyle(document.getElementById('card')); return { bg: cs.backgroundColor, shadow: cs.boxShadow, blur: cs.backdropFilter || 'none', border: `${cs.borderTopWidth} ${cs.borderTopStyle}`, radius: cs.borderTopLeftRadius, sheet: getComputedStyle(document.documentElement).getPropertyValue('--sheet').trim() }; });
    const sheetRGB = [1, 3, 5].map((i) => parseInt(look.sheet.slice(i, i + 2), 16)).join(', ');
    check(look.bg === `rgb(${sheetRGB})` && look.shadow === 'none' && look.blur === 'none' && look.border === '1px solid' && look.radius === '3px', `the card is opaque paper: ${look.bg}, a ${look.border} edge, radius ${look.radius}, shadow ${look.shadow}, blur ${look.blur}`);
    {
      // proper names stay out of a page translator's hands (QA nit): the place, GISS, GISTEMP, Archivo
      const tc = await untranslatable(ww, '#card', ['Fairbanks']), tl = await untranslatable(ww, '#legend');
      check(tc.bad.length === 0 && tl.bad.length === 0 && tc.kept >= 1 && tl.kept >= 1,
        `translate="no" on the names in the card (${tc.kept}: the place) and the legend (${tl.kept}: GISS); ${tc.bad.length + tl.bad.length} left bare${tc.bad.concat(tl.bad).length ? ': ' + tc.bad.concat(tl.bad).join(', ') : ''}`);
    }
    await A.shot('card', true);
    // the card follows the step without drawing itself again; the pin stays on the cell
    await goto(ww, 1990);
    await page.waitForTimeout(40);
    const s2 = await S(ww), k90 = ALL.findIndex((q) => q.year === 1990);
    check(s2.card && s2.card.value === tenthsText(ser[k90]) && s2.card.when.startsWith('in 1990,') && !s2.card.drawing && s2.selection && s2.selection.row === 12,
      `a step to 1990 updates the card at once ("${s2.card && s2.card.value}", not drawing again) and the pin stays on row ${s2.selection && s2.selection.row}, column ${s2.selection && s2.selection.col}`);
    // the footnote says the rule behind the value on screen (review R-3): the partial year, one month
    if (partial >= 0) {
      const pm = snap.steps[partial].months, need = Math.ceil(snap.annual.partialCellShare * pm - 1e-9), span = `Jan–${MON[pm - 1]}`;
      await goto(ww, ALL[partial].year); await page.waitForTimeout(40);
      const sp = await S(ww);
      await goto(ww, snap.months[snap.months.length - 1].month); await page.waitForTimeout(40);
      const sm = await S(ww);
      check(sp.card && sp.card.foot === `Mean of at least ${need} of its ${pm} months (${span}). ${where}` && sm.card && sm.card.foot === `One month’s value; the line shows annual means. ${where}`,
        `the footnote follows the step: ${ALL[partial].year} "${sp.card && sp.card.foot}"; ${figure(L - 1)} "${sm.card && sm.card.foot}"`);
      await ww(() => window.__ww.mode('annual'));
    }
    await ww(() => window.__ww.clear());
    // a no-data cell in 1880: the card says so, and names the first year with data
    const noneCell = (() => { for (let row = 20; row < 70; row++) for (let col = 0; col < 180; col++) { if (frames[0][row * 180 + col] !== 255) continue; const sr = cellSeries(row, col), f = sr.findIndex((v) => v != null); if (f > 0) return { row, col, first: f }; } return null; })();
    await goto(ww, 1880);
    await ww(([la, lo]) => window.__ww.tap(lo, la), [89 - 2 * noneCell.row, -179 + 2 * noneCell.col]);
    await A.settle();
    s = await S(ww);
    check(s.card && s.card.value === null && s.card.when === 'No estimate for this cell in 1880.' && s.card.note === `First year with data: ${ALL[noneCell.first].year}.`,
      `a no-data cell in 1880 (row ${noneCell.row}, column ${noneCell.col}): "${s.card && s.card.when}" "${s.card && s.card.note}"`);
    await A.shot('card-none');
    await ww(() => window.__ww.clear());
  }

  // 7b. the selected cell's mark (QA's must, §20 Q-1). At 0°, 45°, 64° and 80° on the globe at zoom 1, on
  // the map at zoom 1, and on the map at zoom 3, the mark is hollow: the cell's own ramp color at its
  // centre (read from the WebGL frame, with nothing of the overlay over it), the overlay clear of the
  // cell out to its edges along the four rays to its edges' midpoints, and the mark's ink met on every
  // ray within reach. Ocean cells away from coasts and the graticule; the centre is worked out here with
  // this file's own projections, and must be on the Earth's canvas, under no card, strip or legend.
  {
    await goto(ww, ALL[lastComplete].year);
    const G = (lon, lat) => ['globe', { mode: 'globe', lon, lat: 20, zoom: 1 }, lon, lat];
    const Mp = (lon, lat, zoom) => [`map ×${zoom}`, { mode: 'map', lon0: lon, panY: 0, zoom }, lon, lat];
    const cases = [G(-139, 1), G(-159, 46), G(-5, 65), G(-159, 81), Mp(-139, 1, 1), Mp(-159, 46, 1), Mp(-5, 65, 1), Mp(-159, 81, 1), Mp(-139, 1, 3), Mp(-159, 46, 3)];
    const rows = [], bad = [];
    for (const [what, v, lon, lat] of cases) {
      await ww(() => window.__ww.clear());
      await setView(ww, v);
      await ww(([lo, la]) => window.__ww.tap(lo, la), [lon, lat]);
      await A.settle();
      const st = await S(ww), V = st.view, row = Math.floor((90 - lat) / 2), col = Math.floor((lon + 180) / 2), b = frames[lastComplete][row * 180 + col];
      const P = V.mode === 'globe'
        ? (lo, la) => { const q = ortho(lo, la, V.globe.lon, V.globe.lat); return [V.cx + V.radius * q[0], V.cy - V.radius * q[1]]; }
        : (lo, la) => { const lc = -179 + 2 * col, dlc = ((((lc - V.map.lon0) % 360) + 540) % 360 - 180) * D, q = eeHere(dlc + (lo - lc) * D, la * D); return [V.cx + V.mapScale * q[0], V.cy - V.mapScale * (q[1] - V.map.panY)]; };
      const lc = -179 + 2 * col, pc = 89 - 2 * row, c = P(lc, pc);
      const ends = [P(lc, pc + 1), P(lc, pc - 1), P(lc + 1, pc), P(lc - 1, pc)];          // the midpoints of N, S, E, W
      const r = await ww(([c, ends]) => {
        const cv = document.getElementById('over'), k = cv.width / cv.clientWidth, pr = document.getElementById('panel').getBoundingClientRect();
        const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height; const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0);
        const at = (px, py) => { const d = x.getImageData(Math.floor(px * k), Math.floor(py * k), 1, 1).data; return [d[0], d[1], d[2], d[3]]; };
        const rays = ends.map(([ex, ey]) => {
          const len = Math.hypot(ex - c[0], ey - c[1]), ux = (ex - c[0]) / len, uy = (ey - c[1]) / len, out = [];
          for (let t = 0; t <= 16; t += 0.25) out.push([t, at(c[0] + ux * t, c[1] + uy * t)]);
          return { edge: len, out };
        });
        const top = document.elementFromPoint(pr.left + c[0], pr.top + c[1]);
        return { rays, centre: at(c[0], c[1]), under: top && top.id, mark: window.__ww.perf().overlayStats.mark };
      }, [c, ends]);
      const gl = await ww(([x, y]) => window.__ww.pixel(x, y), c);
      const want = b === 255 ? null : rampHere((b - 127) / 10), off = want ? Math.max(...want.map((q, j) => Math.abs(q - gl[j]))) : 99;
      const ink = (p) => p[3] >= 230 && p[0] <= 30 && p[1] <= 30 && p[2] <= 30;      // the mark's own #121212, not a coast's 74 % over its halo
      const clear = r.rays.every((ray) => ray.out.every(([t, p]) => t >= ray.edge - 0.75 || p[3] === 0));
      const reach = r.rays.map((ray) => { const f = ray.out.find(([, p]) => ink(p)); return f ? f[0] : null; });
      const near = r.rays.every((ray, i) => reach[i] != null && reach[i] >= ray.edge - 0.75 && reach[i] <= Math.max(ray.edge + 3, 12));
      const same = r.mark && Math.hypot(r.mark.x - c[0], r.mark.y - c[1]) < 0.75;
      const ok = want && off <= 1 && r.centre[3] === 0 && clear && near && same && r.under === 'over';
      rows.push(`${what} ${lat >= 0 ? lat - 1 : lat}–${lat + 1}°: ${r.mark ? r.mark.kind : 'none'} (cell ${r.mark ? r.mark.m : '?'} px), centre [${gl.slice(0, 3)}] = ramp ${want ? (b - 127) / 10 : '?'} off ${off}, ink at ${reach.map((q) => (q == null ? '–' : q.toFixed(2))).join('/')} px for edges at ${r.rays.map((q) => q.edge.toFixed(2)).join('/')}`);
      if (!ok) bad.push(`${what} ${lat}: centre alpha ${r.centre[3]}, clear ${clear}, near ${near}, same ${same}, under ${r.under}, off ${off}`);
    }
    for (const q of rows) console.log(`      ${q}`);
    const kinds = rows.map((q) => q.split(': ')[1].split(' ')[0]);
    check(bad.length === 0 && kinds.includes('frame') && kinds.includes('ring'),
      `the selected cell's mark is hollow at 0°, 45°, 64° and 80° on the globe and the map (${kinds.filter((k) => k === 'frame').length} frames, ${kinds.filter((k) => k === 'ring').length} rings): the cell's own color at its centre with no overlay on it, the overlay clear of the cell to its edges, ink on all four sides${bad.length ? ' — ' + bad.join('; ') : ''}`);
    await ww(() => window.__ww.clear());
    await setView(ww, { mode: 'globe', lon: -150, lat: 50, zoom: 1 });
  }

  // 8. the poles: Arctic and Antarctic turn the globe to 72°; the key is on; the cap's mean for the step
  {
    const y = ALL[lastComplete].year;
    await goto(ww, y); await setView(ww, { mode: 'globe', lon: -40, lat: 20, zoom: 1 });
    await ww(() => window.__ww.pole('n'));
    await page.waitForTimeout(250);
    const mid = await S(ww);
    await A.settle();
    s = await S(ww);
    const n = capHere(lastComplete, true), wantN = `Map mean north of 64° N: ${cap2(n.h)}${Math.round(n.share * 10000) >= 10000 ? '' : `, data cover ${Math.round(n.share * 100)}${NN}% of it`}`;
    const pressed = await ww(() => [document.getElementById('arctic').getAttribute('aria-pressed'), document.getElementById('antarctic').getAttribute('aria-pressed')]);
    check(mid.turning && mid.view.globe.lat > 20 && mid.view.globe.lat < 72 && Math.abs(s.view.globe.lat - 72) < 1e-6 && Math.abs(s.view.globe.lon + 40) < 1e-6 && s.poleOn === 'n' && pressed.join() === 'true,false' && s.poleRead === wantN,
      `Arctic: turning at 250 ms (latitude ${mid.view.globe.lat.toFixed(1)}), then ${s.view.globe.lat.toFixed(4)}° N at longitude ${s.view.globe.lon.toFixed(4)}; the key on; "${s.poleRead}" (this file's sum: ${cap2(n.h)})`);
    await page.waitForTimeout(120);
    const liveN = await ww(() => document.getElementById('live').textContent);
    check(liveN === s.poleRead, `the reading is said once the turn lands (the live region: "${liveN}")`);
    await A.shot('arctic', scheme === 'dark' ? true : false);
    await goto(ww, 1880);
    s = await S(ww);
    const n0 = capHere(0, true);
    check(s.poleRead === `Map mean north of 64° N: ${cap2(n0.h)}, data cover ${Math.round(n0.share * 100)}${NN}% of it`, `the reading follows the step, and says how much of the cap has data: 1880 "${s.poleRead}"`);
    await goto(ww, y);
    await ww(() => window.__ww.pole('s')); await A.settle();
    s = await S(ww);
    const sc = capHere(lastComplete, false);
    check(Math.abs(s.view.globe.lat + 72) < 1e-6 && s.poleOn === 's' && s.poleRead && s.poleRead.startsWith(`Map mean south of 64° S: ${cap2(sc.h)}`), `Antarctic: 72° S, "${s.poleRead}"`);
    // a drag clears the key
    const cdp = await page.context().newCDPSession(page), pr = await ww(() => document.getElementById('panel').getBoundingClientRect().toJSON());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pr.left + 150, y: pr.top + 300 }] });
    for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pr.left + 150 + k * 6, y: pr.top + 300 }] }); await page.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await A.settle();
    s = await S(ww);
    check(s.poleOn === null && s.poleRead === null, `a drag clears the key and its reading (key ${s.poleOn}, reading ${s.poleRead})`);
    // Arctic from the map switches to the globe
    await setView(ww, 'map');
    await ww(() => window.__ww.pole('n')); await A.settle();
    s = await S(ww);
    check(s.view.mode === 'globe' && Math.abs(s.view.globe.lat - 72) < 1e-6 && s.poleOn === 'n', `Arctic from the map: the globe, at ${s.view.globe.lat.toFixed(4)}° N`);
    await setView(ww, { mode: 'globe', lon: -150, lat: 50, zoom: 1 });
  }

  // 9. About, opened by a real tap on its key, as a finger opens it (the picture then shows ✕ without the keyboard
  // ring a hook's open leaves): every placeholder filled from the snapshot, addresses as plain text, nothing a link
  {
    const cdp9 = await page.context().newCDPSession(page), k9 = await ww(() => document.getElementById('about-key').getBoundingClientRect().toJSON());
    await cdp9.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: k9.left + k9.width / 2, y: k9.top + k9.height / 2 }] });
    await cdp9.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    const ab = await ww(() => { const b = document.getElementById('about-body'); return { text: b.innerText, links: document.querySelectorAll('#about a, #about [href]').length, addr: [...b.querySelectorAll('.ab-addr')].map((e) => e.textContent), focus: document.activeElement && document.activeElement.id, ring: !!document.activeElement && document.activeElement.matches(':focus-visible'), unknown: window.__ww.state().aboutUnknown }; });
    const covers = [1880, 1900, 1950, 1980].map((y) => pct1(ALL[y - 1880].coverage.area));
    const urls = snap.sources.map((x) => x.url).concat(JSON.parse(fs.readFileSync(path.join(APP, 'assets/about.json'), 'utf8')).static.map((x) => x.url));
    check(ab.unknown && ab.unknown.length === 0 && !/\{[A-Za-z]+(:[0-9a-z]+)?\}/.test(ab.text)
      && ab.text.includes(`Data cover ${covers[0]} of Earth’s surface in 1880, ${covers[1]} in 1900, ${covers[2]} in 1950, ${covers[3]} in 1980 and ${pct1(ALL[lastComplete].coverage.area)} in ${ALL[lastComplete].year}.`)
      && ab.text.includes(`release created ${snap.release.created.slice(0, 10)}, with the newest month ${newestLong}. It was read on ${snap.release.retrieved}.`),
    `About: every placeholder filled (${ab.unknown && ab.unknown.length} left); coverage ${covers.join(', ')} …; the release created ${snap.release.created.slice(0, 10)}, read ${snap.release.retrieved}`);
    check(ab.links === 0 && urls.every((u) => ab.addr.includes(u)) && snap.sources.every((x) => (x.citation || []).every((c) => ab.text.includes(c))),
      `About prints ${ab.addr.length} addresses as plain text (${ab.links} links) and GISS's ${snap.sources[0].citation.length} citations with the access date`);
    const k = lastComplete, cells = frames[k].reduce((n, b) => n + (b !== 255), 0);
    check(ab.text.includes('NASA does not endorse this app.') && ab.text.includes('Made with Natural Earth') && ab.text.includes('SIL Open Font License 1.1') && ab.text.includes(siSp(snap.source.attribution)) && !/\d (°C|km|%)/.test(ab.text)
      && ab.text.includes(`In ${ALL[k].year}, ${ALL[k].beyondScale.above} of the ${String(cells).replace(/\B(?=(\d{3})+(?!\d))/g, NN)} cells with a value lie above +4${NN}°C`)
      && (snap.release.mode !== 'research' || ab.text.includes('Internet Archive')) && ab.text.includes('Version: 1.0'),
    `About carries the credit line, NASA's non-endorsement, Natural Earth, Archivo's OFL, the ±4 °C count (${ALL[k].beyondScale.above} of ${cells} cells in ${ALL[k].year}), the research note and "Version: 1.0"`);
    {
      const ta = await untranslatable(ww, '#about-body');
      check(ta.bad.length === 0 && ta.kept >= 8, `About: ${ta.kept} proper names (GISS, GISTEMP, Archivo, Natural Earth) in translate="no" spans, ${ta.bad.length} left bare${ta.bad.length ? ': ' + ta.bad.slice(0, 5).join(', ') : ''}`);
    }
    // five taps on the version line show the frame-time readout
    for (let i = 0; i < 5; i++) await ww(() => document.querySelector('.ab-ver').click());
    const perf = (await S(ww)).perf;
    check(ab.focus === 'about-close' && !ab.ring && /^frame [\d.–]+ ms/.test(perf || ''), `About, opened by a real tap, takes focus on its ✕ ${ab.ring ? 'WITH' : 'without'} the keyboard ring; five taps on the version line show the readout: "${perf}"`);
    for (let i = 0; i < 5; i++) await ww(() => document.querySelector('.ab-ver').click());
    await A.shot('about', scheme === 'light' ? true : false);
    await page.keyboard.press('Escape');
    s = await S(ww);
    check(!s.about && s.perf === null, 'Escape closes About; five more taps hide the readout');
    // the legend's caption opens About at what the colors mean (the caveat is one tap from the legend)
    await ww(() => document.getElementById('legend-caption').click());
    const at = await ww(() => { const b = document.getElementById('about-body'), h = document.getElementById('ab-colors'); return { open: !document.getElementById('about').hidden, top: Math.round(h.getBoundingClientRect().top - b.getBoundingClientRect().top), text: h.querySelector('h3').textContent }; });
    check(at.open && at.top <= 8 && at.text === 'What the colors mean', `the legend's caption opens About at "${at.text}" (${at.top} px from the top)`);
    await ww(() => window.__ww.about(false));
  }

  // 10. focus mode (§10): entered by a touch, then by Enter; the seat; a scrub, play and a tap in focus
  {
    await goto(ww, ALL[lastComplete].year); await setView(ww, { mode: 'globe', lon: 20, lat: 20, zoom: 1 });
    const before = await S(ww);
    const cdp = await page.context().newCDPSession(page);
    const tapAt = async (id) => { const r = await ww((i) => document.getElementById(i).getBoundingClientRect().toJSON(), id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.left + r.width / 2, y: r.top + r.height / 2 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await tapAt('focus-key');
    await page.waitForTimeout(90);
    const gliding = await S(ww), moving = await ww(() => { const t = getComputedStyle(document.getElementById('track-row')).transform; return t === 'none' ? '' : t; });
    await A.settle(); await page.waitForTimeout(350);
    s = await S(ww);
    const hid = await ww(() => ['top', 'strip', 'legend', 'yearrow', 'mode-seg'].map((id) => { const e = document.getElementById(id); return [id, e.hidden, e.inert, getComputedStyle(e).display]; }));
    const aria = await page.locator('#app').ariaSnapshot();
    const act = await ww(() => document.activeElement && document.activeElement.id);
    const stored = await ww(() => localStorage.getItem('ww.focus'));
    check(s.focus && hid.every((h) => h[1] && h[2] && h[3] === 'none') && stored === 'true' && act !== 'focus-exit',
      `focus by a touch: ${hid.map((h) => h[0]).join(', ')} hidden, inert and display none; ww.focus ${stored}; focus not moved (active: ${act || 'body'})`);
    const gk = await ww(() => { const p = document.getElementById('panel').getBoundingClientRect(), e = document.getElementById('focus-exit'), g = e.getBoundingClientRect(); return { right: +(p.right - g.right).toFixed(1), top: +(g.top - p.top).toFixed(1), w: g.width, h: g.height, pos: getComputedStyle(e).position }; });
    check(gk.pos === 'absolute' && gk.right >= 0 && gk.right <= 8 && gk.top >= 0 && gk.top <= 8 && gk.w >= 44 && gk.h >= 44,
      `the ghost key sits in the panel's top-right corner (${gk.pos}; ${gk.right} px from the right edge, ${gk.top} px from the top, ${gk.w} × ${gk.h})`);
    check(/button "Show the controls and the color scale"/.test(aria) && !/About|radio "Globe"|Arctic|Last 24 months/.test(aria) && /slider "Year"/.test(aria),
      'the accessibility tree has the ghost key, the stripes slider and the transport, and none of the hidden controls');
    check(Math.abs(s.view.H - 732) < 1 && Math.abs(s.view.radius - 187.2) < 0.05 && s.view.factor === 0.48 && s.view.dy === 0 && s.focusName === ALL[lastComplete].label && (gliding.view.dy !== 0 || moving !== ''),
      `the Earth takes the freed rows: panel ${s.view.H} px (was ${before.view.H}), radius ${s.view.radius.toFixed(1)} px (was ${before.view.radius.toFixed(1)}); it glided (centre offset ${gliding.view.dy.toFixed(1)} px at 90 ms, the track ${moving || 'not'} moving); the step's name "${s.focusName}"`);
    await A.shot('focus', true);
    // the stripes keep their keys: → steps, play plays, and the step's name is the drawn step
    await ww(() => document.getElementById('track-hit').focus());
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(60);
    s = await S(ww);
    check(s.focusName === ALL[lastComplete - 1].label && s.shown === lastComplete - 1, `← on the track in focus: "${s.focusName}"`);
    await goto(ww, 1950);
    await ww(() => window.__ww.log(true)); await ww(() => window.__ww.play(true)); await page.waitForTimeout(700); await ww(() => window.__ww.play(false));
    const flog = await ww(() => window.__ww.log(false)), fn = await ww(() => document.getElementById('focus-name').textContent);
    s = await S(ww);
    check(s.shown > ALL.findIndex((q) => q.year === 1950) && fn === figure(s.drawn) && flog.every((f) => f.label === figure(f.drawn)), `play in focus: to ${fn}; the step's name is the drawn step`);
    await ww(() => window.__ww.tap(-147.71, 64.84)); await A.settle();
    const cb = await ww(() => { const p = document.getElementById('panel').getBoundingClientRect(), c = document.getElementById('card').getBoundingClientRect(); return { open: !document.getElementById('card').hidden, gap: Math.round(p.bottom - c.bottom), inPanel: c.top >= p.top }; });
    check(cb.open && cb.gap === 8 && cb.inPanel, `a tap in focus opens the card over the Earth (${cb.gap} px from the panel's foot)`);
    await page.keyboard.press('Escape');                        // the card first
    s = await S(ww);
    check(!s.card && s.focus, 'Escape closes the card first, and focus mode stays');
    await page.keyboard.press('Escape');                        // then focus mode
    await A.settle(); await page.waitForTimeout(350);
    s = await S(ww);
    check(!s.focus && Math.abs(s.view.H - before.view.H) < 1 && Math.abs(s.view.radius - before.view.radius) < 0.05 && (await ww(() => localStorage.getItem('ww.focus'))) === 'false', `Escape leaves focus mode: panel ${s.view.H} px, radius ${s.view.radius.toFixed(1)} px`);
    // by the keyboard: Enter on the key moves focus to the ghost key (ringed); Enter on the ghost back
    await ww(() => document.getElementById('focus-key').focus());
    await page.keyboard.press('Enter');
    await A.settle(); await page.waitForTimeout(350);
    const k1 = await ww(() => { const a = document.activeElement; return [a && a.id, a && a.matches(':focus-visible')]; });
    await page.keyboard.press('Enter');
    await A.settle(); await page.waitForTimeout(350);
    const k2 = await ww(() => { const a = document.activeElement; return [a && a.id, a && a.matches(':focus-visible')]; });
    check(k1[0] === 'focus-exit' && k1[1] && k2[0] === 'focus-key' && k2[1], `by Enter: focus goes to ${k1[0]} (ringed ${k1[1]}) and back to ${k2[0]} (ringed ${k2[1]})`);
    // the ghost key, by a touch
    await tapAt('focus-key'); await A.settle(); await page.waitForTimeout(350);
    await tapAt('focus-exit'); await A.settle(); await page.waitForTimeout(350);
    s = await S(ww);
    check(!s.focus, 'the ghost key leaves focus mode');
  }

  // 11. contrast over every rendered text style, the canvas pairs, and hit targets, in the states people meet
  {
    await goto(ww, ALL[lastComplete].year); await setView(ww, { mode: 'globe', lon: -150, lat: 50, zoom: 1 });
    const runs = [];
    const both = async (where) => { await page.waitForTimeout(120); const c = await contrastOf(ww), h = await hitTargets(ww); runs.push([where, c, h]); };
    await both('the globe');
    await ww(() => window.__ww.tap(-147.71, 64.84)); await A.settle();
    await ww(() => window.__ww.pole('n')); await A.settle();
    await both('the card and the Arctic reading');
    await ww(() => window.__ww.clear());
    await ww(() => window.__ww.about(true)); await both('About'); await ww(() => window.__ww.about(false));
    await ww(() => window.__ww.focus(true)); await A.settle(); await page.waitForTimeout(350); await both('focus'); await ww(() => window.__ww.focus(false)); await A.settle(); await page.waitForTimeout(350);
    const worst = runs.reduce((w, r) => (r[1].worst[0] < w[0] ? [r[1].worst[0], `${r[0]}: ${r[1].worst[1]}`] : w), [99, '']);
    const cw = runs[0][1].canvasWorst, styles = runs.reduce((n, r) => n + r[1].styles, 0), texts = runs.reduce((n, r) => n + r[1].n, 0);
    check(worst[0] >= 4.5 && cw[1] >= 4.5, `text contrast: lowest ${worst[0].toFixed(2)}:1 over ${texts} rendered texts in ${styles} styles (${worst[1]}); canvas pairs lowest ${cw[1]}:1 (${cw[0]}) — ${runs[0][1].canvas.map((c) => `${c[0]} ${c[1]}`).join('; ')}`);
    const bad = runs.flatMap((r) => r[2].bad.map((b) => `${r[0]}: ${b}`)), nh = runs.reduce((n, r) => n + r[2].n, 0);
    check(bad.length === 0, `hit targets ≥ 44 × 44 px: ${nh} controls checked in ${runs.length} states${bad.length ? '; too small: ' + bad.join('; ') : ''}`);
  }

  check(A.errors.length === 0, `no console errors or warnings, page errors, failed or outside requests${A.errors.length ? ': ' + A.errors.slice(0, 5).join(' | ') : ''}`);
  await A.ctx.close();
}

/* ── once: play, the three-speed scrub, widths ── */
console.log('\n== once (light)');
{
  const A = await open('light');
  const { ww, page } = A;
  const analyse = (log) => {
    let bad = 0, steps = [], first = null;
    for (const f of log) {
      if (f.drawn !== f.shown || f.label !== figure(f.drawn)) { bad++; if (!first) first = f; }
      if (!steps.length || steps[steps.length - 1] !== f.drawn) steps.push(f.drawn);
    }
    const jumps = steps.slice(1).filter((v, i) => v - steps[i] !== 1).length;
    return { bad, steps, jumps, first };
  };
  // play across a decade
  await goto(ww, 1990);
  await ww(() => window.__ww.log(true));
  await ww(() => window.__ww.play(true));
  await page.waitForFunction(() => window.__ww.state().label === '2000', null, { timeout: 5000 });
  await ww(() => window.__ww.play(false));
  let log = await ww(() => window.__ww.log(false));
  let r = analyse(log);
  const span = (log[log.length - 1].t - log[0].t) / 1000;
  check(r.bad === 0 && r.jumps === 0 && figure(r.steps[0]) === '1990' && figure(r.steps[r.steps.length - 1]) === '2000',
    `play 1990 → 2000: ${r.steps.length} steps drawn in order, each exactly one on (${r.jumps} jumps); the label equals the drawn step on all ${log.length} frames (${r.bad} differ) over ${span.toFixed(2)} s`);
  // 3 s at 8 a second; meanwhile, no element animates a number's text but the rolling year twin (ART)
  await goto(ww, 1900);
  await ww(() => window.__ww.log(true));
  await ww(() => window.__ww.play(true));
  const anims = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300);
    anims.push(await ww(() => document.getAnimations().map((a) => { const t = a.effect && a.effect.target; return t ? (t.closest('#year-roll') ? 'roll' : `${t.id || t.className || t.tagName}`) : 'none'; })));
  }
  await ww(() => window.__ww.play(false));
  log = await ww(() => window.__ww.log(false));
  r = analyse(log);
  const fps = log.length / ((log[log.length - 1].t - log[0].t) / 1000);
  check(r.bad === 0 && r.jumps === 0 && Math.abs(r.steps.length - 1 - 24) <= 2, `play for 3 s: ${r.steps.length - 1} steps (24 ± 2 at 8 a second), ${r.jumps} skipped, ${r.bad} frames whose label is not the drawn step (${fps.toFixed(0)} frames a second)`);
  const others = anims.flat().filter((a) => a !== 'roll'), rolls = anims.flat().length - others.length;
  check(others.length === 0 && rolls > 0, `during play only the year's rolling digits animate (${rolls} roll animations seen in 10 samples, ${others.length} others${others.length ? ': ' + [...new Set(others)].join(', ') : ''}); the mean and the coverage cut`);
  let perf = await ww(() => window.__ww.perf());
  console.log(`      __ww.perf() after play (SwiftShader, trend only): earth draw submit median ${perf.earth.median} ms, p95 ${perf.earth.p95}; frame total median ${perf.total.median} ms, p95 ${perf.total.p95}, max ${perf.total.max}`);

  // the three-speed scrub, by real touches (CDP Input.dispatchTouchEvent)
  if (process.env.SCRUB !== '0') {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const rect = await ww(() => document.getElementById('track').getBoundingClientRect().toJSON());
    const n = NY, inner0 = rect.left + 1, innerW = rect.width - 2, xOf = (i) => inner0 + ((i + 0.5) * innerW) / n, y = rect.top + 30;
    const under = (x) => Math.max(0, Math.min(n - 1, Math.floor(((x - inner0) / innerW) * n)));
    for (const speed of [2, 8, 20]) {
      await goto(ww, 1880);
      const T = ((n - 1) / speed) * 1000;
      await ww(() => window.__ww.log(true));
      await touch('touchStart', xOf(0), y);
      const t0 = Date.now();
      let sent = 0;
      for (;;) {
        const t = Date.now() - t0;
        if (t >= T) break;
        await touch('touchMove', xOf(0) + ((xOf(n - 1) - xOf(0)) * t) / T, y); sent++;
        const wait = 16 - ((Date.now() - t0) % 16);
        await new Promise((res) => setTimeout(res, wait));
      }
      await touch('touchMove', xOf(n - 1), y);
      await touch('touchEnd');
      await page.waitForTimeout(150);
      log = await ww(() => window.__ww.log(false));
      const held = log.filter((f) => f.pressed && f.finger != null);
      let mismatch = 0, labelBad = 0, firstBad = null;
      for (const f of held) {
        const want = under(f.finger);
        if (f.drawn !== want) { mismatch++; if (!firstBad) firstBad = { finger: +f.finger.toFixed(2), want, drawn: f.drawn }; }
        if (f.label !== figure(f.drawn)) labelBad++;
      }
      const after = log.find((f, i) => !f.pressed && i > 0 && log[i - 1].pressed);
      const seen = new Set(held.map((f) => f.drawn)).size;
      const secs = held.length ? (held[held.length - 1].t - held[0].t) / 1000 : 0;
      check(held.length > 0 && mismatch === 0 && labelBad === 0 && after && after.drawn === n - 1,
        `scrub at ${speed} steps a second (${(T / 1000).toFixed(1)} s, ${sent} touch moves, ${held.length} frames at ${(held.length / Math.max(secs, 1e-3)).toFixed(0)} a second): the drawn step is the step under the finger on every frame (${mismatch} differ${firstBad ? `, first ${JSON.stringify(firstBad)}` : ''}), the label the drawn step (${labelBad} differ); ${seen} of ${n} steps drawn; first frame after the lift draws ${after && figure(after.drawn)}`);
    }
    perf = await ww(() => window.__ww.perf());
    console.log(`      __ww.perf() after the scrub (SwiftShader, trend only): earth draw submit median ${perf.earth.median} ms, p95 ${perf.earth.p95}; overlay ${perf.overlay.n ? `median ${perf.overlay.median} ms` : 'not redrawn (a step change never touches it)'}; frame total median ${perf.total.median} ms, p95 ${perf.total.p95}, max ${perf.total.max}`);
  }
  // a drag of the globe: the overlay's cost per frame (trend only)
  {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const pr = await ww(() => document.getElementById('panel').getBoundingClientRect().toJSON());
    const lon0 = (await S(ww)).view.globe.lon;
    await touch('touchStart', pr.left + 100, pr.top + 280);
    for (let k = 1; k <= 40; k++) { await touch('touchMove', pr.left + 100 + k * 4, pr.top + 280); await page.waitForTimeout(16); }
    await touch('touchEnd');
    await A.settle();
    const lon1 = (await S(ww)).view.globe.lon;
    perf = await ww(() => window.__ww.perf());
    check(lon1 !== lon0, `a 160 px drag turns the globe (centre longitude ${lon0.toFixed(1)} → ${lon1.toFixed(1)})`);
    console.log(`      __ww.perf() after a globe drag (SwiftShader, trend only): earth draw submit median ${perf.earth.median} ms; overlay median ${perf.overlay.median} ms, p95 ${perf.overlay.p95} (${perf.overlayStats.emitted} of ${perf.overlayStats.vertices} vertices stroked, ${perf.overlayStats.labels} labels); frame total median ${perf.total.median} ms, p95 ${perf.total.p95}`);
  }
  // a tap: the cell under (lon, lat), its value as this file decodes it and as the reference has it;
  // then a real touch on the globe over Fairbanks selects the same cell
  {
    const ref = JSON.parse(fs.readFileSync(path.join(APP, 'tools/ref/snapshot_ref.json'), 'utf8'));
    const y = ALL[lastComplete].year, rc = ref.cells.find((c) => c.step === String(y) && c.row === 12 && c.col === 16);
    await goto(ww, y); await setView(ww, { mode: 'globe', lon: -150, lat: 55, zoom: 1 });
    const t = await ww(() => window.__ww.tap(-147.71, 64.84));
    const b = frames[lastComplete][12 * 180 + 16], want = b === 255 ? null : b - 127;
    check(t && t.row === 12 && t.col === 16 && t.tenths === want && rc && Math.round(rc.c * 10) === want && t.bounds === '64–66° N, 148–146° W',
      `__ww.tap(Fairbanks) in ${y}: ${t && t.bounds}, ${t && t.text} (this file's decode ${want / 10}, the reference ${rc && rc.c})`);
    await ww(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    await A.settle();
    const pt = await ww(() => window.__ww.screen(-147.71, 64.84));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt[0], y: pt[1] }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(450);
    const sel = (await S(ww)).selection, label = await ww(() => document.getElementById('earth').getAttribute('aria-label'));
    check(sel && sel.row === 12 && sel.col === 16 && label.includes('Selected 64–66° N, 148–146° W'), `a real touch over Fairbanks selects row ${sel && sel.row}, column ${sel && sel.col}; the Earth's name: "${label}"`);
    await A.shot('tap');
    // the chart (review R-8): a tap on it moves nothing; a horizontal drag scrubs the year
    {
      const cr = await ww(() => document.getElementById('c-chart').getBoundingClientRect().toJSON()), g = (await S(ww)).card.geom;
      const xAt = (i) => cr.left + g.x0 + ((i + 0.5) * (g.x1 - g.x0)) / g.n, cy = cr.top + 40;
      const tch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: cy }] });
      await tch('touchStart', xAt(20)); await tch('touchEnd'); await page.waitForTimeout(450);
      let q = await S(ww);
      const tapLeft = q.label === String(y) && !!q.card;
      await tch('touchStart', xAt(20));
      for (let k = 1; k <= 10; k++) { await tch('touchMove', xAt(20 + k * 3)); await page.waitForTimeout(20); }
      const held = (await S(ww)).label;
      await tch('touchEnd'); await A.settle();
      q = await S(ww);
      check(tapLeft && held === String(ALL[50].year) && q.label === String(ALL[50].year) && q.card && q.selection && q.selection.row === 12,
        `the chart: a tap on it leaves ${y}; a drag across it scrubs the year (${held} while held, ${q.label} after), the card stays on its cell`);
      await goto(ww, y); await A.settle();
    }
    // double-tap (review R-7): at zoom 1 in by 2× about the finger, zoomed home; neither selects
    {
      await ww(() => window.__ww.clear()); await setView(ww, { mode: 'globe', lon: -150, lat: 40, zoom: 1 }); await A.settle();
      const pr = await ww(() => document.getElementById('panel').getBoundingClientRect().toJSON()), v0 = (await S(ww)).view;
      const dbl = async () => { for (let k = 0; k < 2; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pr.left + v0.cx + 30, y: pr.top + v0.cy - 20 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(60); } await page.waitForTimeout(400); await A.settle(); };
      await dbl(); const a = await S(ww);
      await dbl(); const b2 = await S(ww);
      check(Math.abs(a.view.globe.zoom - 2) < 1e-6 && !a.selection && b2.view.globe.zoom === 1 && b2.view.globe.lat === 20 && !b2.selection,
        `double-tap: zoom 1 → ${a.view.globe.zoom.toFixed(2)} about the finger (centre ${a.view.globe.lon.toFixed(1)}°, ${a.view.globe.lat.toFixed(1)}°), then home (zoom ${b2.view.globe.zoom}, latitude ${b2.view.globe.lat}°); no cell selected`);
      await setView(ww, { mode: 'globe', lon: -150, lat: 55, zoom: 1 });
    }
    // the chart draws itself: the context at once, then the cell's line and its stripes from the first year
    // over 480 ms at a constant rate. Read from the frame log (SwiftShader's frame times vary, the order does not).
    await ww(() => window.__ww.clear()); await A.settle();
    await ww(() => window.__ww.log(true));
    await ww(() => window.__ww.tap(-147.71, 64.84));
    await A.settle();
    const clog = (await ww(() => window.__ww.log(false))).filter((f) => f.cardP != null);
    const ps = clog.map((f) => f.cardP), mids = clog.filter((f) => f.cardP > 0 && f.cardP < 1), mono = ps.every((p, i) => !i || p >= ps[i - 1]);
    // a constant rate: every partial frame's share equals its time since the first frame's implied start / 480 ms
    const tStart = clog[0].t - clog[0].cardP * 480, off = mids.map((f) => Math.abs(f.cardP - (f.t - tStart) / 480)), t1 = clog.find((f) => f.cardP >= 1);
    check(mids.length >= 2 && mono && ps[ps.length - 1] === 1 && Math.max(...off) <= 0.06 && t1 && t1.t - tStart >= 480 - 17,
      `the chart draws itself: ${mids.length} frames drew part of the line (${mids.map((f) => f.cardP.toFixed(2)).join(', ')}), in order, each within ${Math.max(...off).toFixed(3)} of a constant 480 ms rate, whole ${t1 ? Math.round(t1.t - tStart) : '?'} ms after it began (SwiftShader's first frame after a tap is late)`);
    await ww(() => window.__ww.clear());
  }
  // a new snapshot while the app is open (§12.3): kept by name, announced; a broken one changes nothing
  {
    await goto(ww, 1950);
    const fresh = JSON.parse(fs.readFileSync(path.join(APP, 'data/snapshot.json'), 'utf8'));
    fresh.generatedAt = new Date(Date.now() - 3600e3).toISOString().replace(/\.\d+Z$/, 'Z');
    snapOverride = { body: JSON.stringify(fresh) };
    await ww(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => window.__ww.state().notices.some((n) => n.startsWith('New data')), null, { timeout: 10000 });
    let s = await S(ww);
    const nm = `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+snap.release.newestMonth.slice(5) - 1]} ${snap.release.newestMonth.slice(0, 4)}`;
    check(s.label === '1950' && s.notices.includes(`New data: to ${nm}`) && s.resident === L, `a replaced snapshot: the step kept by name ("${s.label}"), the notice "${s.notices.join('; ')}"`);
    snapOverride = { body: '<!doctype html><title>Not found</title>' };
    await ww(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => window.__ww.state().notices.some((n) => n.startsWith('The new data file')), null, { timeout: 10000 });
    s = await S(ww);
    check(s.label === '1950' && s.notices.includes(`The new data file could not be read: it is damaged. Still showing data to ${nm}.`), `a broken replacement leaves everything as it was: "${s.notices.find((n) => n.startsWith('The new'))}"`);
    snapOverride = null;
  }
  check(A.errors.length === 0, `no console errors or warnings, page errors, failed or outside requests${A.errors.length ? ': ' + A.errors.slice(0, 5).join(' | ') : ''}`);
  await A.ctx.close();

  // missing, broken and stale snapshots: the sentences (§3.7)
  for (const [name, ov, want] of [
    ['missing', { status: 404 }, 'The data file data/snapshot.json is missing. It ships in the ZIP and the Shortcut replaces it; reinstall the app or run the Shortcut.'],
    ['an HTML body', { body: '<!doctype html><title>x</title>' }, 'The data file could not be read: it is not valid JSON.'],
    ['nx 181', { body: JSON.stringify({ ...snap, grid: { ...snap.grid, nx: 181 } }) }, 'The data file could not be read: the grid is 181 × 90 cells, expected 180 × 90.'],
  ]) {
    snapOverride = ov;
    const B = await open('light', { expect: /404|Failed to load resource|requestfailed \S+\/data\/snapshot\.json$/ });
    const e = await B.ww(() => { const p = document.getElementById('error'); return { text: p.textContent, shown: !p.hidden, legend: document.getElementById('legend').hidden, play: document.getElementById('play').disabled }; });
    check(e.shown && e.text === want && e.legend && e.play && B.errors.length === 0, `${name}: "${e.text}" on the card; the legend hidden, the keys disabled${B.errors.length ? '; ' + B.errors[0] : ''}`);
    if (name === 'missing') await B.shot('missing');
    await B.ctx.close();
  }
  {
    const old = { ...snap, generatedAt: new Date(Date.now() - 100 * 86400e3).toISOString().replace(/\.\d+Z$/, 'Z') };
    snapOverride = { body: JSON.stringify(old) };
    const B = await open('light');
    const s = await S(B.ww);
    check(s.notices.includes(`This copy of the data was made on ${old.generatedAt.slice(0, 10)}. GISS publishes a release about the 10th of every month.`) && B.errors.length === 0, `stale (100 days): "${s.notices.join('; ')}"`);
    await B.ctx.close();
    snapOverride = null;
  }

  // the opening (§3.9): a touch ends it; the stripes are written only up to the drawn step
  {
    const B = await open('light', { opening: true });
    let s = await S(B.ww);
    const chip = `Playing ${ALL[0].year} to ${ALL[lastComplete].year}, one year every eighth of a second. Touch to stop.`;
    const storedAtStart = await B.ww(() => localStorage.getItem('ww.opened'));
    check(s.opening && s.playing && s.notices.includes(chip) && storedAtStart === 'true', `the first launch opens on ${s.label} and plays: "${s.notices.join('; ')}"; ww.opened stored before it starts (${storedAtStart})`);
    await B.page.waitForTimeout(1500);
    const mid = await B.ww(() => {
      const st = window.__ww.state(), c = document.getElementById('track'), k = c.width / c.clientWidth, w = c.clientWidth, n = st.track.n;
      const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0);
      const d = x.getImageData(0, 0, t.width, t.height).data, col = (i) => Math.floor((1 + ((i + 0.5) * (w - 2)) / n) * k), at = (i) => d[(Math.floor(29.5 * k) * t.width + col(i)) * 4 + 3];
      return { shown: st.shown, written: st.track.written, behind: at(Math.max(0, st.shown - 2)), ahead: at(Math.min(n - 1, st.shown + 6)), last: at(n - 2) };
    });
    check(mid.written === mid.shown + 1 && mid.behind === 255 && mid.ahead === 0 && mid.last === 0,
      `the stripes are written by the years: at ${ALL[mid.shown].year} ${mid.written} are written; a stripe behind the index is drawn (alpha ${mid.behind}), one ahead of it and ${ALL[NY - 2].year}'s are the page (alpha ${mid.ahead}, ${mid.last})`);
    { const q = path.join(out, 'opening-light.png'); await B.page.screenshot({ path: q }); fs.copyFileSync(q, path.join(SHOTS, 'opening-light.png')); console.log('  opening-light.png → screenshots/'); }
    const cdp = await B.page.context().newCDPSession(B.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 330 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await B.page.waitForTimeout(400);
    s = await S(B.ww);
    check(!s.opening && !s.playing && allWritten(s.track.written) && !s.notices.includes(chip) && s.shown < lastComplete && s.shown >= mid.shown,
      `a touch ends it on the year it had reached (${s.label}); every stripe appears at once; the chip is gone`);
    const hint = `Tap any place for its own line since ${ALL[0].year}.`;
    check(!s.card && !s.selection && s.notices.includes(hint) && (await B.ww(() => localStorage.getItem('ww.hinted'))) === 'true',
      `the touch on the globe that stopped it opens no card (selection ${JSON.stringify(s.selection)}); the one hint follows: "${s.notices.join('; ')}"`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 330 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await B.page.waitForTimeout(450);
    s = await S(B.ww);
    check(!s.notices.includes(hint) && s.selection, `the next touch clears the hint and is a tap again (a cell selected: ${s.selection && `row ${s.selection.row}, column ${s.selection.col}`})`);
    check(B.errors.length === 0, `the opening: no console errors${B.errors.length ? ': ' + B.errors[0] : ''}`);
    await B.ctx.close();
  }
  {
    // waited out once: 1880 to the last complete year, every year in order; never twice
    const B = await open('light', { opening: true });
    await B.ww(() => window.__ww.log(true));
    await B.page.waitForFunction(() => !window.__ww.state().opening, null, { timeout: 60000 });
    const olog = await B.ww(() => window.__ww.log(false));
    const r = analyse(olog);
    let s = await S(B.ww);
    check(s.shown === lastComplete && !s.playing && allWritten(s.track.written) && r.jumps === 0 && r.bad === 0 && figure(r.steps[r.steps.length - 1]) === ALL[lastComplete].label,
      `waited out: the opening ends on ${s.label} (the last complete year) after ${r.steps.length} steps drawn in order (${r.jumps} jumps, ${r.bad} labels off), every stripe written`);
    await B.page.reload();
    await B.page.waitForFunction(() => window.__ww && window.__ww.ready(), null, { timeout: 60000 });
    s = await S(B.ww);
    check(!s.opening && !s.playing, 'never twice: a reload opens without the opening');
    await B.ctx.close();
    // never under Reduce Motion, never in focus mode
    const C = await open('light', { opening: true, reduced: true });
    s = await S(C.ww);
    check(!s.opening && !s.playing && s.shown === lastComplete, `under Reduce Motion there is no opening: it opens on ${s.label}`);
    await C.ctx.close();
    const F = await open('light', { opening: true, init: () => { try { localStorage.setItem('ww.focus', 'true'); } catch { /* fine */ } } });
    s = await S(F.ww);
    check(s.focus && !s.opening && !s.playing, 'with focus mode stored, the app opens in focus mode and the opening never starts');
    await F.ctx.close();
  }

  // a reload keeps the view, the mode, the step and focus mode; the selection is not kept
  {
    const B = await open('light');
    await B.ww(() => window.__ww.mode('months')); await goto(B.ww, '2025-03');
    await setView(B.ww, 'map'); await setView(B.ww, { lon0: 30 });
    await B.ww(() => window.__ww.tap(10, 50));
    await B.page.waitForTimeout(500);
    await B.page.reload();
    await B.page.waitForFunction(() => window.__ww && window.__ww.ready(), null, { timeout: 60000 });
    await B.settle();
    let s = await S(B.ww);
    check(s.mode === 'months' && s.label === 'Mar 2025' && s.view.mode === 'map' && Math.abs(s.view.map.lon0 - 30) < 0.01 && !s.selection && !s.card,
      `a reload restores Last 24 months at ${s.label}, the map at ${s.view.map.lon0}°; nothing selected`);
    await B.ww(() => window.__ww.focus(true)); await B.settle();
    await B.page.reload();
    await B.page.waitForFunction(() => window.__ww && window.__ww.ready(), null, { timeout: 60000 });
    s = await S(B.ww);
    check(s.focus && s.focusName === 'Mar 2025' && Math.abs(s.view.H - 732) < 1, `focus mode is restored before the first draw ("${s.focusName}", panel ${s.view.H} px)`);
    await B.ctx.close();
  }

  // hidden: play stops and nothing runs
  {
    const B = await open('light');
    await goto(B.ww, 1950);
    await B.ww(() => window.__ww.play(true));
    await B.page.waitForTimeout(400);
    await B.ww(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await B.page.waitForTimeout(100);
    await B.ww(() => window.__ww.log(true));
    await B.page.waitForTimeout(600);
    const hl = await B.ww(() => window.__ww.log(false));
    const s = await S(B.ww);
    await B.ww(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await B.page.waitForTimeout(300);
    const s2 = await S(B.ww);
    check(!s.playing && hl.length === 0 && !s2.playing && s2.label === s.label && B.errors.length === 0, `hidden: play stops at ${s.label} and no frame runs for 600 ms (${hl.length} frames); visible again, it stays paused`);
    await B.ctx.close();
  }

  // Reduce Motion: the card and the pole turn at once, the chart whole, focus mode at once, no digits roll
  {
    const B = await open('dark', { reduced: true });
    await goto(B.ww, ALL[lastComplete].year); await setView(B.ww, { mode: 'globe', lon: -40, lat: 20 });
    await B.ww(() => window.__ww.pole('n'));
    let s = await S(B.ww);
    check(!s.turning && Math.abs(s.view.globe.lat - 72) < 1e-9, `Reduce Motion: Arctic is a jump (latitude ${s.view.globe.lat} at once)`);
    await B.ww(() => window.__ww.log(true));
    await B.ww(() => window.__ww.tap(-147.71, 64.84));
    await B.settle();
    const rlog = (await B.ww(() => window.__ww.log(false))).filter((f) => f.cardP != null);
    s = await S(B.ww);
    const cin = await B.ww(() => { const c = document.getElementById('card'); return [c.classList.contains('in'), getComputedStyle(c).opacity, getComputedStyle(c).transform]; });
    check(s.card && !s.card.drawing && cin[0] && cin[1] === '1' && cin[2] === 'none' && rlog.length > 0 && rlog.every((f) => f.cardP === 1), `Reduce Motion: the card is there at once (opacity ${cin[1]}, transform ${cin[2]}) and its chart whole on every frame that drew it (${rlog.length})`);
    await B.ww(() => window.__ww.clear());
    await B.ww(() => window.__ww.focus(true));
    s = await S(B.ww);
    const run = await B.ww(() => document.getAnimations().length);
    check(s.focus && s.view.dy === 0 && s.view.factor === 0.48 && run === 0 && Math.abs(s.view.H - 732) < 1, `Reduce Motion: focus mode at once (centre offset ${s.view.dy}, ${run} animations running)`);
    await B.shot('focus-reduced');
    await B.ww(() => window.__ww.focus(false));
    await B.ww(() => window.__ww.play(true)); await B.page.waitForTimeout(400);
    const roll = await B.ww(() => [!document.getElementById('year-roll').hidden, document.getAnimations().length]);
    await B.ww(() => window.__ww.play(false));
    check(!roll[0] && roll[1] === 0, `Reduce Motion: play still plays and its digits do not roll (${roll[1]} animations)`);
    check(B.errors.length === 0, `Reduce Motion: no console errors${B.errors.length ? ': ' + B.errors[0] : ''}`);
    await B.ctx.close();
  }

  // focus mode at 844 × 390: one column
  {
    const B = await open('light', { w: 844, h: 390 });
    await B.ww(() => window.__ww.focus(true)); await B.settle(); await B.page.waitForTimeout(350);
    const m = await B.ww(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { panel: r('panel').width, track: r('track-row').width, sw: document.documentElement.scrollWidth, iw: innerWidth, under: r('track-row').top >= r('panel').bottom - 1 }; });
    const s = await S(B.ww);
    check(s.focus && m.panel === 844 && m.track === 844 && m.under && m.sw <= m.iw && B.errors.length === 0, `844 × 390 in focus: one column, the Earth ${m.panel} px wide over the track (${m.track} px); radius ${s.view.radius.toFixed(1)} px`);
    await B.shot('focus-landscape');
    await B.ctx.close();
  }

  // no WebGL 2: the sentence; the year row, the stripes and play still work; no focus key
  {
    const B = await open('light', { init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : g.call(this, t, ...a); }; } });
    const e = await B.ww(() => ({ text: document.getElementById('error').textContent, shown: !document.getElementById('error').hidden, focusKey: document.getElementById('focus-key').hidden, legend: document.getElementById('legend').hidden }));
    let s = await S(B.ww);
    const before = s.label;
    await B.ww(() => document.getElementById('prev').click());
    await B.page.waitForTimeout(100);
    s = await S(B.ww);
    const stepped = s.label;
    await B.ww(() => window.__ww.play(true)); await B.page.waitForTimeout(700); await B.ww(() => window.__ww.play(false));
    const played = (await S(B.ww)).label;
    check(e.shown && e.text === 'This view needs WebGL 2, which this device does not offer.' && e.focusKey && e.legend && before === ALL[lastComplete].label && stepped === ALL[lastComplete - 1].label && played !== stepped && s.mean === meanText(lastComplete - 1) && B.errors.length === 0,
      `no WebGL 2: "${e.text}"; the focus key hidden; ‹ steps to ${stepped} ("${s.mean}") and play runs to ${played}${B.errors.length ? '; ' + B.errors[0] : ''}`);
    await B.shot('no-webgl');
    await B.ctx.close();
  }

  // pressed and hover (QA's should, §20 Q-3): every kind of control, with a mouse (hover exists only for a
  // hovering pointer) in both themes, and a press by a real touch on the phone. Each state is a gray (no
  // hue), hover differs from rest, pressed from hover, and :focus-visible is the 2 px ring with no plate.
  for (const scheme of schemes.filter((x) => x !== 'none')) {
    const B = await open(scheme, { desktop: true });
    const controls = [['About', '#about-key', '::before'], ['Arctic', '#arctic', '::before'], ['the stamp', '#stamp', '::before'], ['Map', '#view-seg button[data-v="map"]', '::after'],
      ['Last 24 months', '#mode-seg button[data-m="months"]', '::after'], ['the legend caption', '#legend-caption', '::after'], ['‹', '#prev', '::before'], ['the focus key', '#focus-key', '::before'], ['▶', '#play', 'circle']];
    const read = (sel, pseudo) => B.ww(([sel, pseudo]) => { const e = document.querySelector(sel), cs = getComputedStyle(e); return { color: cs.color, plate: pseudo === 'circle' ? getComputedStyle(e.querySelector('circle')).fill : getComputedStyle(e, pseudo).backgroundColor, outline: `${cs.outlineStyle} ${cs.outlineWidth}` }; }, [sel, pseudo]);
    const rows = [], bad = [];
    for (const [name, sel, pseudo] of controls) {
      const r = await B.ww((sel) => document.querySelector(sel).getBoundingClientRect().toJSON(), sel);
      await B.page.mouse.move(2, 2);
      const rest = await read(sel, pseudo);
      await B.page.mouse.move(r.left + r.width / 2, r.top + r.height / 2);
      const hover = await read(sel, pseudo);
      await B.page.mouse.down();
      const pressed = await read(sel, pseudo);
      await B.page.mouse.move(2, 2); await B.page.mouse.up();             // released away: no click
      await B.page.keyboard.press('Escape');                              // a key first: focus from the keyboard is ringed
      await B.ww((sel) => document.querySelector(sel).focus(), sel);
      const focus = await read(sel, pseudo);
      await B.ww(() => document.activeElement && document.activeElement.blur());
      const all = [rest, hover, pressed, focus].flatMap((q) => [q.color, q.plate]);
      const ok = all.every(grayOrNone) && (hover.color !== rest.color || hover.plate !== rest.plate) && pressed.plate !== hover.plate && colorOf(pressed.plate)[3] > 0
        && focus.outline === 'solid 2px' && colorOf(focus.plate)[3] === 0;
      rows.push(`${name}: rest ${rest.color} / ${rest.plate}; hover ${hover.color} / ${hover.plate}; pressed ${pressed.color} / ${pressed.plate}; focus ${focus.outline}`);
      if (!ok) bad.push(name);
    }
    // the stripes track: its frame is --line-strong at rest, --ink-2 under the pointer, --ink pressed
    // read at x 250, clear of the index (a press at x 100 moves it there, and its halo parts the frame)
    const frameAt = () => B.ww(() => { const c = document.getElementById('track'), k = c.width / c.clientWidth, t = document.createElement('canvas'); t.width = c.width; t.height = c.height; const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); const d = x.getImageData(Math.floor(250 * k), Math.floor(16.5 * k), 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; });
    const tr = await B.ww(() => document.getElementById('track').getBoundingClientRect().toJSON());
    await B.page.mouse.move(2, 2); await B.page.waitForTimeout(60);
    const t0 = await frameAt();
    await B.page.mouse.move(tr.left + 100, tr.top + 30); await B.page.waitForTimeout(60);
    const t1 = await frameAt();
    await B.page.mouse.down(); await B.page.waitForTimeout(60);
    const t2 = await frameAt();
    await B.page.mouse.up(); await B.page.mouse.move(2, 2); await B.page.waitForTimeout(60);
    const tok = new Set([t0, t1, t2]).size === 3 && [t0, t1, t2].every(grayOrNone);
    rows.push(`the stripes track's frame: rest ${t0}, hover ${t1}, pressed ${t2}`);
    for (const q of rows) console.log(`      ${q}`);
    check(bad.length === 0 && tok && B.errors.length === 0, `${scheme}: pressed and hover on ${controls.length} kinds of key and the track, every state a gray, hover ≠ rest, pressed ≠ hover, focus the 2 px ring without a plate${bad.length ? '; failing: ' + bad.join(', ') : ''}${tok ? '' : '; the track frame did not change'}`);
    await B.shot('hover');
    await B.ctx.close();
  }
  {
    // a press by a real touch on the phone: the plate is there while the finger is down
    const B = await open('light');
    const cdp = await B.page.context().newCDPSession(B.page);
    const out = [];
    for (const [sel, pseudo] of [['#about-key', '::before'], ['#arctic', '::before'], ['#next', '::before']]) {
      const r = await B.ww((sel) => document.querySelector(sel).getBoundingClientRect().toJSON(), sel);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.left + r.width / 2, y: r.top + r.height / 2 }] });
      await B.page.waitForTimeout(120);
      out.push([sel, await B.ww(([sel, pseudo]) => getComputedStyle(document.querySelector(sel), pseudo).backgroundColor, [sel, pseudo])]);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await B.page.waitForTimeout(60);
    }
    check(out.every(([, c]) => colorOf(c)[3] > 0 && grayOrNone(c)) && B.errors.length === 0, `a touch held on a key shows its pressed plate: ${out.map(([k, c]) => `${k} ${c}`).join('; ')}`);
    await B.ctx.close();
  }

  // 125 %: browser zoom at 125 % on a 390 × 844 screen is a 312 × 675 CSS px viewport at 2.5 device px each
  // (Safari's text-size setting zooms the page the same way): nothing scrolls sideways, every row stays on screen
  {
    const B = await open('light', { w: 312, h: 675, dpr: 2.5 });
    const m = await B.ww(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight, ctrl: r('controls').bottom, next: r('next').right, modeL: r('mode-seg').left, mode: r('mode-seg').right, seg: r('view-seg').right, arctic: r('arctic').left, fk: r('focus-key').right }; });
    const s = await S(B.ww);
    check(m.sw <= m.iw && m.ctrl <= m.ih + 0.5 && m.next < m.modeL && m.mode <= m.iw && m.seg < m.arctic && m.fk <= m.iw && s.label === ALL[lastComplete].label && B.errors.length === 0,
      `125 % zoom (312 × 675 CSS px): page ${m.sw} px wide in ${m.iw}; the controls row ends at ${m.ctrl.toFixed(0)} of ${m.ih}; the transport ends at ${m.next.toFixed(0)} before the time switch at ${m.modeL.toFixed(0)}; globe radius ${s.view.radius.toFixed(1)} px`);
    await B.shot('zoom-125');
    await B.ctx.close();
  }

  // rotation: portrait → landscape → portrait keeps the step and the view, and nothing scrolls sideways
  {
    const B = await open('light');
    await goto(B.ww, 1977); await setView(B.ww, { mode: 'globe', lon: 100, lat: 30 });
    await B.page.setViewportSize({ width: 844, height: 390 }); await B.page.waitForTimeout(400); await B.settle();
    const l = await S(B.ww), lw = await B.ww(() => document.documentElement.scrollWidth);
    await B.page.setViewportSize({ width: 390, height: 844 }); await B.page.waitForTimeout(400); await B.settle();
    const p = await S(B.ww), pw2 = await B.ww(() => document.documentElement.scrollWidth);
    check(l.label === '1977' && p.label === '1977' && Math.abs(l.view.radius - 142) < 1 && Math.abs(p.view.radius - 183.3) < 0.1 && l.view.globe.lon === 100 && lw <= 844 && pw2 <= 390 && B.errors.length === 0,
      `rotation: 1977 kept; radius ${l.view.radius.toFixed(1)} px in landscape, ${p.view.radius.toFixed(1)} px back in portrait; no sideways scroll`);
    await B.ctx.close();
  }

  // widths: no horizontal scroll, the top strip and the controls row inside the screen
  for (const [w, h] of [[320, 568], [360, 740], [375, 667], [844, 390]]) {
    const B = await open('light', { w, h });
    const m = await B.ww(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, iw: innerWidth, seg: r('view-seg').right, mode: r('mode-seg').right, play: r('next').right, modeLeft: r('mode-seg').left, panel: r('panel').width, arctic: r('arctic').left, focusKey: r('focus-key').right, name: document.querySelector('#top .name').getBoundingClientRect().right, stamp: r('stamp').left }; });
    const s = await S(B.ww);
    check(m.sw <= m.iw && m.seg <= m.panel && m.seg < m.arctic && m.focusKey <= m.panel && m.name < m.stamp && m.mode <= m.iw && m.play < m.modeLeft && s.label === figure(lastComplete) && B.errors.length === 0,
      `${w} × ${h}: page ${m.sw} px wide in ${m.iw}, the view switch ends at ${m.seg.toFixed(0)}, the transport at ${m.play.toFixed(0)} before the time switch at ${m.modeLeft.toFixed(0)}–${m.mode.toFixed(0)}; globe radius ${s.view.radius.toFixed(1)} px${B.errors.length ? '; ' + B.errors[0] : ''}`);
    if (w !== 844) {
      // the legend never grows past the seat's foot (the reserve is measured per time list, with the
      // longest caption and the longest beyond-count lead), at the last complete year, the partial year and a month
      const fit = [];
      for (const x of [ALL[lastComplete].year, ...(partial >= 0 ? [ALL[partial].year] : []), snap.months[snap.months.length - 1].month]) {
        await goto(B.ww, x); await B.settle();
        fit.push(await B.ww(() => [document.getElementById('legend').offsetHeight, window.__ww.state().view.bottom]));
      }
      await B.ww(() => window.__ww.mode('annual'));
      check(fit.every(([h, b]) => h <= b), `${w} × ${h}: the legend inside its reserve: ${fit.map(([h, b]) => `${h} ≤ ${b}`).join(', ')} px (year, partial, month)`);
    }
    if (w === 844) await B.shot('landscape');
    await B.ctx.close();
    if (w !== 844) continue;
    // the sensor housing (DESIGN §22 L-1): CDP's Emulation.setSafeAreaInsetsOverride gives env(safe-area-inset-*) the
    // values of a notched or Dynamic Island iPhone in full-screen landscape. The top bar, the strip, the right column,
    // About (its text and ✕), the docked card and focus mode's card clear the side inset; the docked card's foot clears
    // the bottom one.
    for (const [l, r] of [[59, 0], [0, 59]]) {
      const C = await open('light', { w: 844, h: 390, insets: { top: 0, left: l, right: r, bottom: 21 } });
      const ext = (sels) => C.ww((list) => list.map((q) => { const e = document.querySelector(q); if (!e || !e.getClientRects().length) return [q, null]; const b = e.getBoundingClientRect(); return [q, Math.round(b.left * 10) / 10, Math.round(b.right * 10) / 10, Math.round(b.bottom * 10) / 10]; }), sels);
      const main = await ext(['#top .name', '#about-key', '#view-seg', '#focus-key', '#yearrow .yr', '#yearrow .read', '#track', '#prev', '#mode-seg', '#legend-caption']);
      await C.ww(() => window.__ww.tap(-147.71, 64.84)); await C.settle(); await C.page.waitForTimeout(250);
      const card = await ext(['#card', '#c-close']);
      await C.ww(() => window.__ww.clear()); await C.ww(() => window.__ww.about(true)); await C.page.waitForTimeout(150);
      const about = await C.ww(() => {
        let lo = 1e9, hi = -1e9;
        for (const e of document.querySelectorAll('#about-title, #about-body p, #about-body h3, #about-body h4, #about-body button')) { const g = document.createRange(); g.selectNodeContents(e); for (const q of g.getClientRects()) if (q.width) { lo = Math.min(lo, q.left); hi = Math.max(hi, q.right); } }
        const x = document.querySelector('#about-close svg path').getBoundingClientRect();
        return { text: [lo, hi], cross: [x.left, x.right] };
      });
      await C.shot(`landscape-insets-${l}-${r}`);
      await C.ww(() => window.__ww.about(false)); await C.ww(() => window.__ww.focus(true)); await C.settle(); await C.page.waitForTimeout(350);
      await C.ww(() => window.__ww.tap(-147.71, 64.84)); await C.settle(); await C.page.waitForTimeout(250);
      const focus = await ext(['#card', '#focus-exit', '#prev', '#focus-name']);
      const L0 = l - 0.5, R0 = 844 - r + 0.5, bad = [...main, ...card, ...focus].filter((e) => e[1] != null && (e[1] < L0 || e[2] > R0)).map((e) => `${e[0]} ${e[1]}–${e[2]}`);
      if (!(about.text[0] >= L0 && about.text[1] <= R0 && about.cross[0] >= L0 && about.cross[1] <= R0)) bad.push(`About: text ${about.text.join('–')}, ✕ ${about.cross.join('–')}`);
      check(bad.length === 0 && card[0][1] != null && focus[0][1] != null && card[0][3] <= 390 - 21 + 0.5 && C.errors.length === 0,
        `844 × 390, the housing on the ${l ? 'left' : 'right'} (insets ${l}/${r}, bottom 21, by CDP): About's text ${about.text.map((v) => v.toFixed(0)).join('–')} and ✕ ${about.cross.map((v) => v.toFixed(0)).join('–')}, the docked card ${card[0][1]}–${card[0][2]} with its foot at ${card[0][3]} (≤ 369), focus mode's card ${focus[0][1]}–${focus[0][2]}; ${main.length + card.length + focus.length} boxes inside ${l}–${844 - r}${bad.length ? '; outside: ' + bad.join(', ') : ''}${C.errors.length ? '; ' + C.errors[0] : ''}`);
      await C.ctx.close();
    }
  }
}

await browser.close();
server.close();
if (fails.length) { console.log(`\n${fails.length} check(s) failed:`); for (const f of fails) console.log(`  - ${f}`); process.exit(1); }
console.log('\nall checks pass');
