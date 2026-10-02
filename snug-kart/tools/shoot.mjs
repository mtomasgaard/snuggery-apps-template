// Drive Snug Kart in headless Chromium at phone size (390 × 844 CSS px, DPR 2, real touch through CDP),
// in the light and the dark theme (DESIGN.md §17.3; HOUSE.md 7.2, adapted to a game). Fails on any
// console error or warning, page error, failed request, HTTP ≥ 400, or any request that is not to the
// local server, data: or blob:. Every figure it asserts about the Lap Chart is worked out here from the
// race's own record (window.__sk.chart()) with formulas written in this file, never by importing js/.
//
// FRAME TIMES ARE HEADLESS CHROMIUM (SwiftShader) ON THIS MAC: a trend only, never phone evidence.
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs [scene ...]
//   SCHEMES=light node tools/shoot.mjs        one theme (the game's own scenes run in the first theme)
//   SCREENSHOTS=1 node tools/shoot.mjs        also copy the house scenes to screenshots/*-{light,dark}.png
//   PROFILE=1, TIMING=1                       real-time frames on the heaviest tracks (trend only)
//
// The game's own scenes (first theme): the title, the countdown, a race on each track with the frame
// budgets, touch and keys, a phone on its side, hidden, WebGL context loss, the results and the skip
// and its tap guard, items, sound, tilt, the faces, a journey through the real title and a reload.
// The house's, in each theme: text contrast over every rendered text node, the tracer under exactly
// what is chosen, SI in every visible text node, hit targets of 44 × 44, the camera's "Race" by role
// and name, the face loaded, the title's view centered in its plate; the race card and its strip's
// redraw rule; the Lap Chart drawn by this file's formula and its ink sampled against what is beside
// it; the halo marks (the steering ring and the reticle) sampled over the scene; About opened from its
// key with the loop stopped under it, the license and both credits, Escape and focus returned; pause.
// Once: the live region's sentences, Reduce Motion (every duration 0 s, the title still, the
// countdown at the chase pose, no shake), widths 320, 360, 375, 844 × 390, 667 × 375, 932 × 430 and
// 125 % zoom (the title's controls hit-tested at each), and broken data. Pictures: tools/.work/shots/,
// and with SCREENSHOTS=1 screenshots/*-{light,dark}.png, never screenshots/app.png, the README's
// picture, whose hash this run checks unchanged.
//
// Needs Playwright (PLAYWRIGHT_MODULE, or `npm install playwright` inside tools/, which is git-ignored).
// It serves the app folder itself on a free port; scenes are driven through window.__sk, which the
// shipped build carries (inert unless called).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); } catch (e) {
  console.error(`Playwright could not be loaded (${e.code || e.message}): set PLAYWRIGHT_MODULE to a playwright/index.mjs, or run \`npm install playwright\` in tools/.`);
  process.exit(4);
}
const chromium = pw.chromium || pw.default.chromium;
const out = path.join(APP, 'tools', '.work', 'shots');
const SHOTS = path.join(APP, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const KEEP = process.env.SCREENSHOTS === '1';
const schemes = (process.env.SCHEMES || 'light,dark').split(',').filter((s) => s === 'light' || s === 'dark');
const only = new Set(process.argv.slice(2));
const hashOf = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);
const appPngHash = hashOf(path.join(SHOTS, 'app.png'));
const racersData = JSON.parse(fs.readFileSync(path.join(APP, 'data/racers.json'), 'utf8')).racers;
const tracksData = JSON.parse(fs.readFileSync(path.join(APP, 'data/tracks.json'), 'utf8')).tracks;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/markdown', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port, origin = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = 390, H = 844;
const errors = [], requests = [];
// The one message tolerated: SwiftShader's driver notice when Playwright reads the frame back for a
// screenshot ("GPU stall due to ReadPixels"). The app itself never calls readPixels.
const HEADLESS_NOISE = /GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels|Multiple readback operations using getImageData/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
let ctx, page, scheme;

/** A new context and page in a theme, loaded and ready; `o.expect` excuses a console message a scene provokes. */
async function open(sch, o = {}) {
  const c = await browser.newContext({ viewport: { width: o.w || W, height: o.h || H }, deviceScaleFactor: o.dpr || 2, isMobile: true, hasTouch: true, colorScheme: sch, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
  if (o.route) await c.route(o.route.url, o.route.fn);
  const p = await c.newPage();
  const excused = (t) => HEADLESS_NOISE.test(t) || (o.expect && o.expect.test(t));
  p.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !excused(m.text())) errors.push(`${sch}: ${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => errors.push(`${sch}: pageerror: ${e.message}`));
  p.on('requestfailed', (r) => { if (!excused(`requestfailed ${r.url()}`)) errors.push(`requestfailed: ${r.url()}`); });
  p.on('response', (r) => { if (r.status() >= 400 && !excused(`HTTP ${r.status()} ${r.url()}`)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  p.on('request', (r) => { const u = r.url(); requests.push(u); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) errors.push(`EXTERNAL REQUEST: ${u}`); });
  const t0 = Date.now();
  await p.goto(`${origin}index.html`);
  await p.waitForFunction(() => document.getElementById('loading').classList.contains('done') || document.getElementById('loading').classList.contains('error'), null, { timeout: 120000 });
  return { c, p, ms: Date.now() - t0 };
}
const sk = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name, keep = false) => {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file });
  if (keep && KEEP) { if (`${name}.png` === 'app.png') throw new Error('never screenshots/app.png'); fs.copyFileSync(file, path.join(SHOTS, `${name}.png`)); }
  console.log(`  ${name}.png${keep && KEEP ? ' (and screenshots/)' : ''}`);
};
const BUDGET = { high: { tris: 150000, calls: 50 }, low: { tris: 90000, calls: 35 } };
const statsLine = (s) => `${s.track} ${s.quality}: ${s.calls} calls, ${s.triangles} tris, ${s.geometries} geometries, ${s.textures} textures, ×${s.pixelRatio}, built in ${s.buildMs} ms`;
const budgets = async (label) => {
  for (const q of ['high', 'low']) {
    await sk(async (q) => { await window.__sk.startRace({ track: window.__sk.stats().track, quality: q, seed: 3, autopilot: true }); window.__sk.freeze(true); window.__sk.advance(20); }, q);
    const s = await sk(() => window.__sk.stats());
    console.log(`    ${statsLine(s)}`);
    check(s.triangles <= BUDGET[q].tris && s.calls <= BUDGET[q].calls, `${label} ${q} within budget (${s.calls}/${BUDGET[q].calls} calls, ${s.triangles}/${BUDGET[q].tris} tris)`);
  }
  await sk(() => window.__sk.startRace({ quality: 'high', seed: 3, autopilot: true }));
};

/* ── formulas written here ── */
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const pct = (arr, q) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
const ordinal = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
/** A drawn time in the words VoiceOver should hear: "1:52.985" is "1 minute 52.985 seconds". */
const words = (d) => {
  const m = /^(about )?(\d+):(\d\d(?:\.\d{3})?)$/.exec(d); if (!m) return null;
  const min = +m[2], sec = +m[3], secs = `${m[1] ? sec : sec.toFixed(3)} second${sec === 1 ? '' : 's'}`;
  return (m[1] || '') + (min ? `${min} minute${min === 1 ? '' : 's'} ${secs}` : secs);
};
/** A PNG screenshot decoded with Node's zlib: 8-bit RGB or RGBA, not interlaced (Chromium's). */
function decodePng(buf) {
  let p = 8, w = 0, h = 0, type = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; }
    if (kind === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = x >= bpp && y ? px[o - stride + x - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      px[o + x] = (row[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
    }
  }
  return { w, h, at: (x, y) => { const i = (Math.round(y) * w + Math.round(x)) * bpp; return [px[i], px[i + 1], px[i + 2]]; } };
}

/* ── in-page probes (Global Weather's, changed for this game) ── */
const contrastOf = () => sk(() => {
  const rgba = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); const v = m ? m[1].split(/[ ,/]+/).map(Number) : [0, 0, 0, 0]; return [v[0], v[1], v[2], v[3] == null ? 1 : v[3]]; };
  const L = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const over = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  const ground = rgba(getComputedStyle(document.body).backgroundColor);
  const bgOf = (e) => { const stack = []; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } } let bg = ground; for (const c of stack.reverse()) bg = over(c, bg); return { bg, held: stack.length > 0 }; };
  let worst = [99, ''], n = 0; const loose = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement;
    if (!t.textContent.trim() || !e || e.closest('[hidden]') || e.closest('.sr') || e.closest('svg')) continue;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.display === 'none') continue;
    const { bg, held } = bgOf(e);
    if (!held) loose.push(t.textContent.trim().slice(0, 20));   // text straight over the scene, on no plate
    const c = ratio(over(rgba(cs.color), bg), bg);
    n++;
    if (c < worst[0]) worst = [c, `${e.id || e.className || e.tagName} "${t.textContent.trim().slice(0, 24)}"`];
  }
  return { n, worst: [+worst[0].toFixed(2), worst[1]], loose };
});
const hitTargets = () => sk(() => {
  const bad = [], seen = [];
  for (const e of document.querySelectorAll('button, [role="slider"], [role="tab"], [role="radio"]')) {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || e.closest('[hidden]') || e.disabled) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const at = (x, y) => { const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h)); };
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight || !at(cx, cy)) continue;
    seen.push(e.id || (e.textContent || '').trim().slice(0, 12));
    const run = (dx, dy) => { let n = 0; for (const s of [-1, 1]) for (let k = 1; k < 140 && at(cx + (s * k * dx) / 2, cy + (s * k * dy) / 2); k++) n++; return n / 2; };
    const okV = r.height >= 44 || run(0, 1) >= 43.5, okH = r.width >= 44 || run(1, 0) >= 43.5;
    if (!okV || !okH) bad.push(`${e.id || e.className || e.tagName} "${(e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20)}" ${Math.round(r.width)}×${Math.round(r.height)} (hit ${run(1, 0)}×${run(0, 1)})`);
  }
  return { n: seen.length, bad };
});
/** Every visible text node: a hyphen-minus before a digit, a plain space before a unit, a comma or a plain space in thousands, a middle dot. */
const siOf = () => sk(() => {
  const bad = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const UNIT = /\d[ \u00a0](m|km|%|s|ms|fps)(?![\w/])/, THOU = /\d,\d{3}\b|\b\d{1,3}[ \u00a0]\d{3}\b/;
  let n = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const e = t.parentElement, text = t.textContent;
    if (!e || e.closest('[hidden]') || e.closest('script, style, #about-license') || !text.trim()) continue;
    n++;
    if (/(^|[^\w])-\d/.test(text) || UNIT.test(text) || THOU.test(text) || text.includes('·') || / — /.test(text)) bad.push(text.trim().slice(0, 40));
  }
  return { n, bad };
});
/** The tracer (a ::after with content) under exactly the chosen track, racer and settings that are on. */
const tracerOf = () => sk(() => {
  const all = [...document.querySelectorAll('#tracks button, #racers button, #settings button')];
  const drawn = all.filter((b) => getComputedStyle(b, '::after').content !== 'none').map((b) => b.getAttribute('aria-label') || b.textContent.trim());
  const chosen = all.filter((b) => b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label') || b.textContent.trim());
  return { drawn, chosen };
});
const house = async (where) => {
  const ct = await contrastOf();
  check(ct.worst[0] >= 4.5 && ct.loose.length === 0, `${where}: ${ct.n} text nodes at 4.5:1 or more over their composited background (lowest ${ct.worst[0]}, ${ct.worst[1]}); none straight over the scene${ct.loose.length ? ': ' + ct.loose.join(', ') : ''}`);
  const si = await siOf();
  check(si.bad.length === 0, `${where}: SI in ${si.n} visible text nodes (U+202F before units and in thousands, no hyphen-minus, no middle dot, no spaced em dash)${si.bad.length ? ': ' + si.bad.join(' | ') : ''}`);
  const ht = await hitTargets();
  check(ht.bad.length === 0, `${where}: ${ht.n} controls hit at 44 × 44 or more${ht.bad.length ? ': ' + ht.bad.join('; ') : ''}`);
};

/* ════════════════════ the game's own scenes (the first theme) ════════════════════ */
const scenes = {
  title: async () => {
    await page.waitForTimeout(600);
    const v = await sk(() => ({
      tracks: [...document.querySelectorAll('#tracks [role="radio"]')].map((b) => b.textContent), faces: document.querySelectorAll('#racers .racer canvas').length,
      caption: document.getElementById('caption').textContent, chosen: document.querySelector('#tracks [aria-checked="true"]').textContent,
    }));
    const t = tracksData.find((x) => x.name === v.chosen);
    check(JSON.stringify(v.tracks) === JSON.stringify(tracksData.map((x) => x.name)) && v.faces === 8, `title: the tracks as words from the data (${v.tracks.join(', ')}) and ${v.faces} racer faces`);
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    check(!!t && new RegExp(`^${esc(t.blurb)} \\d{1,3}(\u202f\\d{3})?\u202fm a lap, rising \\d+\\.\\d\u202fm\\.$`).test(v.caption), `title caption: the data's blurb, then the lap and the rise with U+202F ("${v.caption}")`);
    await shot('title');
  },
  countdown: async () => {
    // The swoop frames the player's kart: every rival behind it on the grid stays hidden until Go.
    // A first race shows one line on drifting under the numerals; Go takes it away. The numerals are
    // text on a plate that replace each other with no animation (B9).
    await sk(async () => { localStorage.removeItem('snugkart:v1:hints'); await window.__sk.startRace({ track: 'harbour', racer: 'pip', seed: 1 }); window.__sk.freeze(true); window.__sk.advance(0.3); });
    await page.waitForTimeout(200);
    const behind = () => sk(() => { const ks = window.__sk.karts(), P = ks.find((k) => k.player); return ks.filter((k) => !k.player && k.dist < P.dist - 1); });
    const b0 = await behind();
    check(b0.length === 2 && b0.every((k) => !k.visible), `countdown 0.3 s: the ${b0.length} rivals behind the player are hidden (${b0.map((k) => `${k.id} ${k.visible ? 'shown' : 'hidden'}`).join(', ')})`);
    const num = () => sk(() => { const c = document.getElementById('count'); return { text: c.textContent, shown: !c.hidden, anim: c.getAnimations().length, font: getComputedStyle(c).fontSize }; });
    const p3 = await num();
    check(p3.text === '3' && p3.shown && p3.anim === 0 && p3.font === '96px', `countdown 0.3 s: "${p3.text}" on its plate at ${p3.font}, ${p3.anim} animations`);
    await shot('countdown-0.3');
    await sk(() => window.__sk.advance(0.9));
    await page.waitForTimeout(250);
    const n = await sk(() => ({ n: document.getElementById('count').textContent, hint: document.getElementById('hint').hidden ? null : document.getElementById('hint').textContent }));
    check(n.n === '2', `countdown shows "${n.n}" at 1.2 s`);
    check(!!n.hint, `first race: the drift hint shows ("${n.hint}")`);
    const b1 = await behind();
    check(b1.every((k) => !k.visible), `countdown 1.2 s: rivals behind still hidden (${b1.map((k) => k.id).join(', ')})`);
    await shot('countdown');
    await sk(() => window.__sk.advance(1.2));
    await page.waitForTimeout(200);
    const p1 = await num();
    check(p1.text === '1' && p1.shown, `countdown 2.4 s: "${p1.text}" on screen`);
    await sk(() => window.__sk.advance(1.0));
    await page.waitForTimeout(200);
    const g = await sk(() => ({ st: window.__sk.state(), hint: document.getElementById('hint').hidden, ks: window.__sk.karts() }));
    const faded = g.ks.filter((k) => !k.player && k.opacity < 1).map((k) => `${k.id} ${k.opacity}`);
    check(g.st.phase === 'racing' && g.hint, `after Go: racing, hint gone (rivals faded near the camera: ${faded.join(', ') || 'none'})`);
    await shot('countdown-go');
  },
  'race-harbour': async () => raceScene('harbour'),
  'race-pinewood': async () => raceScene('pinewood', true),
  'race-lantern': async () => raceScene('lantern'),
  touch: async () => {
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', racer: 'juno', seed: 2 }); window.__sk.freeze(true); window.__sk.advance(3.5); });
    const cdp = await ctx.newCDPSession(page);
    const drift = await sk(() => { const r = document.getElementById('btn-drift').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const item = await sk(() => { const r = document.getElementById('btn-item').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
    const pad = { x: 90, y: 700, id: 1 }, dr = { x: drift[0], y: drift[1], id: 2 };
    const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 4, radiusY: 4, force: 1 })) });
    await touch('touchStart', [pad]);
    for (let dx = 10; dx <= 60; dx += 10) await touch('touchMove', [{ ...pad, x: pad.x + dx }]);
    await touch('touchStart', [{ ...pad, x: pad.x + 60 }, dr]);
    await sk(() => window.__sk.advance(1.0));
    const s1 = await sk(() => window.__sk.state());
    check(s1.input.steer > 0.5, `pad drag right steers (input ${s1.input.steer.toFixed(2)}, kart ${s1.steer.toFixed(2)})`);
    check(s1.drift === true, `drift held with a second finger: drifting = ${s1.drift}, tier ${s1.driftTier}`);
    await shot('touch');
    await touch('touchEnd', []);
    await sk(() => window.__sk.giveItem('kettle'));
    await touch('touchStart', [{ x: item[0], y: item[1], id: 3 }]); await touch('touchEnd', []);
    await sk(() => window.__sk.advance(0.05));
    const s2 = await sk(() => window.__sk.state());
    check(s2.item === null && s2.boostKind === 'kettle', `item button tap uses the Kettle (item ${s2.item}, boost ${s2.boostKind} ${s2.boost.toFixed(2)} s)`);
    // Forgiving targets: a tap 10 px outside the item button's ring still uses the item; a thumb in
    // the lower right below the item button (not on the drift button) drifts.
    await sk(() => window.__sk.giveItem('quilt'));
    const edge = await sk(() => { const r = document.getElementById('btn-item').getBoundingClientRect(); return [r.left - 10, r.top + r.height / 2]; });
    await touch('touchStart', [{ x: edge[0], y: edge[1], id: 4 }]); await touch('touchEnd', []);
    await sk(() => window.__sk.advance(0.05));
    const s2b = await sk(() => window.__sk.state());
    check(s2b.item === null && s2b.shield > 9, `a tap 10 px outside the item ring still uses it (shield ${s2b.shield.toFixed(1)} s)`);
    await touch('touchStart', [{ ...pad, x: pad.x + 60 }, { x: 250, y: 830, id: 7 }]);
    await sk(() => window.__sk.advance(0.5));
    const s2c = await sk(() => window.__sk.state());
    check(s2c.input.drift === true, `a thumb in the lower right, off the drift button, drifts (drift input ${s2c.input.drift})`);
    await touch('touchEnd', []);
    // Floating pad: dragging 200 px right then 70 px back steers left of centre at once.
    await touch('touchStart', [pad]);
    for (let dx = 20; dx <= 200; dx += 20) await touch('touchMove', [{ ...pad, x: pad.x + dx }]);
    await touch('touchMove', [{ ...pad, x: pad.x + 130 }]);
    await page.waitForTimeout(120);                       // pointermove is delivered with the next frame
    const s2d = await sk(() => window.__sk.state());
    check(s2d.input.steer < 0.1, `the pad follows a thumb past the ring: 70 px back steers ${s2d.input.steer.toFixed(2)}`);
    await touch('touchEnd', []);
    // Sides: hold the right of the lower screen → full right lock; release and press again within
    // 250 ms and hold → a drift to the right; both sides at once → brake.
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', racer: 'juno', seed: 2, controls: 'sides' }); window.__sk.freeze(true); window.__sk.advance(4.5); });
    const R = { x: 240, y: 700, id: 5 }, Lf = { x: 80, y: 700, id: 6 };
    await touch('touchStart', [R]); await sk(() => window.__sk.advance(0.3));
    const s3 = await sk(() => window.__sk.state());
    check(s3.input.steer === 1 && s3.steer > 0.9, `sides: right half steers right (${s3.steer.toFixed(2)})`);
    await touch('touchEnd', []); await touch('touchStart', [R]);
    await sk(() => window.__sk.advance(0.3));
    const s4 = await sk(() => window.__sk.state());
    check(s4.drift === true, `sides: tap-and-hold the same side drifts (drifting ${s4.drift})`);
    await touch('touchStart', [R, Lf]);
    const s5 = await sk(() => window.__sk.state());
    check(s5.input.brake === 1, 'sides: both sides brake');
    await touch('touchEnd', []);
    await sk(() => window.__sk.startRace({ controls: 'pad' }));
    await cdp.detach();
  },
  keys: async () => {
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', racer: 'soren', seed: 8 }); window.__sk.freeze(true); window.__sk.advance(4.5); });
    await page.keyboard.down('ArrowLeft');
    await sk(() => window.__sk.advance(0.5));
    const a = await sk(() => window.__sk.state());
    await page.keyboard.up('ArrowLeft');
    check(a.steer < -0.9, `keyboard ← steers left (kart steer ${a.steer.toFixed(2)})`);
    // Drift keys: Space with → starts a drift to the right on the start straight; releasing Space
    // after a full charge (set through the hook — holding a drift on a bend with digital keys is a
    // steering test, not an input test) fires the tier-2 mini-boost. tools/sim.mjs checks that
    // mini-boosts happen in real races.
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', racer: 'soren', seed: 8 }); window.__sk.freeze(true); window.__sk.advance(4.5); });
    await page.keyboard.down('ArrowRight'); await page.keyboard.down('Space');
    await sk(() => window.__sk.advance(0.1));
    const b = await sk(() => window.__sk.state());
    await page.keyboard.up('ArrowRight');
    check(b.drift && b.v >= 12, `keyboard → + Space starts a drift (drifting ${b.drift}, v ${b.v.toFixed(1)} m/s)`);
    await sk(() => { window.__sk.setDrift(2); window.__sk.advance(0.02); });
    await shot('drift');
    await page.keyboard.up('Space');
    await sk(() => window.__sk.advance(0.05));
    const c = await sk(() => window.__sk.state());
    check(!c.drift && c.boost > 0.9, `releasing Space after a tier-2 charge fires the 1.0 s mini-boost (${c.boost.toFixed(2)} s left)`);
    await page.keyboard.press('Escape');
    const d = await sk(() => window.__sk.state());
    check(d.paused && d.screen === 'pause', 'Escape pauses');
    await sk(() => window.__sk.resume());
  },
  resize: async () => {
    await sk(async () => { await window.__sk.startRace({ track: 'lantern', racer: 'otto', seed: 4, autopilot: true }); window.__sk.freeze(true); window.__sk.advance(8); });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(400);
    const a = await sk(() => ({ size: window.__sk.stats().size, cam: window.__sk.camera() }));
    check(a.size[0] > a.size[1] && Math.abs(a.cam.aspect - 844 / 390) < 0.01, `landscape: canvas ${a.size.join('×')}, aspect ${a.cam.aspect.toFixed(2)}`);
    await shot('landscape');
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(400);
    const b = await sk(() => ({ size: window.__sk.stats().size, cam: window.__sk.camera() }));
    check(b.size[1] > b.size[0] && Math.abs(b.cam.aspect - W / H) < 0.01, `back to portrait: canvas ${b.size.join('×')}`);
  },
  hidden: async () => {
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', racer: 'tuck', seed: 5 }); window.__sk.advance(5); });
    await page.waitForTimeout(200);
    await sk(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
    const s = await sk(() => window.__sk.state());
    const t1 = s.time; await page.waitForTimeout(500); const t2 = (await sk(() => window.__sk.state())).time;
    check(s.paused && !s.rafScheduled && !s.running && t1 === t2, `hidden page pauses (paused ${s.paused}, rAF scheduled ${s.rafScheduled}, clock ${t1 === t2 ? 'stopped' : 'moving'})`);
    await sk(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(200);
    const s2 = await sk(() => window.__sk.state());
    check(s2.paused && s2.screen === 'pause', 'visible again: still paused behind the panel');
    await shot('paused');
    await sk(() => window.__sk.resume());
  },
  context: async () => {
    // WebGL context loss (a phone under memory pressure): the race pauses behind "Graphics were
    // reset"; after the context returns, a tap brings back the pause panel and the race resumes.
    await sk(async () => { await window.__sk.startRace({ track: 'lantern', racer: 'ines', seed: 11 }); window.__sk.advance(5); });
    await sk(() => { window.__lose = document.getElementById('gl').getContext('webgl2').getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
    await page.waitForTimeout(400);
    const a = await sk(() => ({ lost: !document.getElementById('lost').hidden, st: window.__sk.state() }));
    check(a.lost && a.st.paused && !a.st.rafScheduled, `context lost: message shown (${a.lost}), race paused (${a.st.paused})`);
    await sk(() => window.__lose.restoreContext());
    await page.waitForTimeout(800);
    await page.click('#lost');
    await sk(() => window.__sk.resume());
    await sk(() => window.__sk.advance(2));
    await page.waitForTimeout(300);
    const b = await sk(() => window.__sk.state());
    check(b.screen === 'race' && !b.paused && b.phase === 'racing', `context restored: racing again (screen ${b.screen})`);
    await shot('context-restored');
    // A different track after a restore: the old track is disposed and the new one built.
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', racer: 'ines', seed: 12 }); window.__sk.advance(4); });
    const c = await sk(() => window.__sk.stats());
    check(c.track === 'harbour' && c.calls > 10, `after a restore, a new track builds and draws (${c.calls} calls)`);
  },
  results: async () => {
    await sk(async () => {
      localStorage.removeItem('snugkart:v1:best:pinewood');
      await window.__sk.startRace({ track: 'pinewood', racer: 'wren', seed: 6, autopilot: true }); window.__sk.freeze(true);
      for (let i = 0; i < 100 && !window.__sk.state().finished; i++) window.__sk.advance(2);
    });
    await page.waitForTimeout(250);
    const f = await sk(() => ({ banner: document.getElementById('banner').textContent, shown: !document.getElementById('banner').hidden }));
    check(/^Finished \d(st|nd|rd|th) of 8$/.test(f.banner) && f.shown, `finish banner "${f.banner}" on its plate`);
    await shot('finish');
    await sk(() => window.__sk.advance(400));
    await page.waitForTimeout(300);
    const r = await sk(() => ({ rows: [...document.querySelectorAll('#res-list li')].map((li) => li.querySelector('.times').firstChild.textContent), st: window.__sk.state(), best: localStorage.getItem('snugkart:v1:best:pinewood'), rec: document.getElementById('res-record').textContent }));
    check(r.st.screen === 'results' && r.rows.length === 8, `results: ${r.rows.length} rows on screen "${r.st.screen}"`);
    const formsOk = r.st.results.every((x, i) => (x.est ? /^about \d+:\d\d$/ : /^\d+:\d\d\.\d{3}$/).test(r.rows[i]));
    check(formsOk, `results: measured times to the millisecond, projected ones "about" to the second (B3): ${r.rows.join(', ')}`);
    check(!!r.best && JSON.parse(r.best).lap > 0 && /^New best (lap|race|lap and best race) on Pinewood Pass\.$/.test(r.rec), `best lap written to localStorage (${r.best}); the record a sentence: "${r.rec}"`);
    await shot('results');
  },
  skip: async () => {
    await sk(async () => {
      await window.__sk.startRace({ track: 'pinewood', racer: 'wren', seed: 9, autopilot: true }); window.__sk.freeze(true);
      for (let i = 0; i < 400 && !window.__sk.state().finished; i++) window.__sk.advance(0.5);
      window.__sk.advance(Math.max(0, 2.05 - window.__sk.state().finishT));
    });
    await page.waitForTimeout(150);
    const w = await sk(() => window.__sk.state());
    check(w.screen === 'race' && w.phase === 'finished' && w.finishT >= 2, `after the banner, waiting for the field (screen ${w.screen}, phase ${w.phase}, ${w.finishT.toFixed(2)} s since the line)`);
    await page.touchscreen.tap(W / 2, H / 2);
    // The race stays frozen: advance(0) only hands over the events, so nobody can finish meanwhile.
    await sk(() => window.__sk.advance(0));
    await page.waitForTimeout(150);
    const r = await sk(() => ({ st: window.__sk.state(), rows: document.querySelectorAll('#res-list li').length }));
    const est = r.st.results ? r.st.results.filter((x) => x.est).length : 0;
    check(r.st.screen === 'results' && r.rows === 8 && est > 0, `a tap mid-screen skips to the results (screen ${r.st.screen}, ${r.rows} rows, ${est} projected)`);
  },
  // The tap that skips the wait must not also press what the results panel then puts under the
  // finger. A real tap lasts ~0.1 s, several frames, so the panel appears while the finger is still
  // down; Chrome then aims the tap's click at whatever is under it on lift (WebKit does the same).
  // First find where Race again and Change sit (a skip high on the screen), then press and hold
  // 120 ms on each button's spot before the results exist: they must still be on screen 1 s later.
  // Finally a deliberate tap on Race again still starts a race.
  'skip-tap': async () => {
    const toBanner = () => sk(async () => {
      await window.__sk.startRace({ track: 'pinewood', racer: 'wren', seed: 9, autopilot: true }); window.__sk.freeze(true);
      for (let i = 0; i < 400 && !window.__sk.state().finished; i++) window.__sk.advance(0.5);
      window.__sk.advance(Math.max(0, 2.05 - window.__sk.state().finishT));
    });
    const centre = (id) => sk((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; }, id);
    await toBanner();
    await page.touchscreen.tap(W / 2, 120);
    await sk(() => window.__sk.advance(0));
    await page.waitForTimeout(150);
    const spots = { again: await centre('btn-again'), change: await centre('btn-change') };
    check((await sk(() => window.__sk.state().screen)) === 'results' && spots.again.y > 0, `the results' buttons sit at Race again ${spots.again.x},${spots.again.y} and Change ${spots.change.x},${spots.change.y}`);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
    for (const [name, id] of [['again', 'btn-again'], ['change', 'btn-change']]) {
      await toBanner();
      const before = await sk(() => ({ st: window.__sk.state() }));
      await touch('touchStart', [spots[name]]);
      // On a phone the next frame (~16 ms) shows the results while the finger is still down; here the
      // race stays frozen and advance(0) is that frame (it only hands over the events). SwiftShader
      // frames with the loop running take long enough to make a real-time version flaky.
      await sk(() => window.__sk.advance(0));
      await page.waitForTimeout(120);
      // (By its box, not elementFromPoint: the settling panel is out of hit-testing on purpose.)
      const under = await sk(({ x, y, id }) => { const r = document.getElementById(id).getBoundingClientRect(); return { screen: window.__sk.state().screen, onButton: x >= r.left && x <= r.right && y >= r.top && y <= r.bottom }; }, { ...spots[name], id });
      await touch('touchEnd', []);
      await page.waitForTimeout(1000);
      const after = await sk(() => ({ st: window.__sk.state(), rows: document.querySelectorAll('#res-list li').length }));
      check(before.st.screen === 'race' && under.screen === 'results' && under.onButton, `finger down on ${id}'s spot: the results appeared under it (${under.screen}, finger on the button ${under.onButton})`);
      check(after.st.screen === 'results' && after.rows === 8 && !!after.st.results, `lifting the skip's finger off ${id} presses nothing: 1 s later the results are still up (screen ${after.st.screen}, ${after.rows} rows)`);
    }
    await shot('skip-tap');
    await page.touchscreen.tap(spots.again.x, spots.again.y);
    await page.waitForTimeout(300);
    const again = await sk(() => window.__sk.state());
    check(again.screen === 'race' && again.phase === 'countdown', `a deliberate tap on Race again afterwards still starts a race (screen ${again.screen}, ${again.phase})`);
    await cdp.detach();
  },
  items: async () => {
    // Pick one up for real: the player on autopilot drives through Pinewood's first parcel row.
    await sk(async () => { await window.__sk.startRace({ track: 'pinewood', racer: 'pip', seed: 21, autopilot: true }); window.__sk.freeze(true); window.__sk.advance(3); });
    let got = null, t = 3;
    for (; t < 60 && !got; t += 0.5) got = (await sk(() => { window.__sk.advance(0.5); return window.__sk.state(); })).item;
    const r = await sk(() => ({ st: window.__sk.state(), href: document.getElementById('item-use').getAttribute('href') }));
    const pk = r.st.items.stats.pickups;
    check(!!got && !!r.href && pk > 1, `parcels: the player picks up a ${got} after ${t.toFixed(1)} s (${pk} pickups in the field so far; the button shows ${r.href})`);
    // Every kart drops a snare, then a honey puddle, then raises a quilt; the leader's and everyone's
    // planes go up — the crowded case the budgets must hold for.
    await sk(async () => { await window.__sk.startRace({ track: 'lantern', racer: 'mabel', seed: 7, autopilot: true, quality: 'high' }); window.__sk.freeze(true); window.__sk.advance(12); });
    const n = await sk(() => { let n = 0; for (const id of ['yarn', 'honey', 'plane', 'quilt']) { window.__sk.giveAll(id); n += window.__sk.useAll(); } window.__sk.advance(0.35); return n; });
    await sk(() => { window.__sk.setAutopilot(false); window.__sk.giveItem('plane'); window.__sk.advance(1.0); });
    const st = await sk(() => window.__sk.state());
    check(n >= 24 && st.items.yarns + st.items.honeys + st.items.planes > 5, `crowded race: ${n} items used, on track ${st.items.yarns} snares, ${st.items.honeys} puddles, ${st.items.planes} planes; player shield ${st.shield.toFixed(1)} s`);
    await page.waitForTimeout(250);
    const vis = await sk(() => ({ ret: !document.getElementById('reticle').hidden }));
    check(vis.ret, 'the Paper Plane reticle shows on the racer ahead while a plane is in hand');
    await shot('items');
    for (const q of ['high', 'low']) {
      const s = await sk(async (q) => {
        await window.__sk.startRace({ track: 'lantern', racer: 'mabel', seed: 7, autopilot: true, quality: q }); window.__sk.freeze(true); window.__sk.advance(12);
        for (const id of ['yarn', 'honey', 'plane', 'quilt']) { window.__sk.giveAll(id); window.__sk.useAll(); }
        window.__sk.advance(0.35);
        return window.__sk.stats();
      }, q);
      console.log(`    with every item type on screen: ${statsLine(s)}`);
      check(s.calls <= BUDGET[q].calls && s.triangles <= BUDGET[q].tris, `lantern ${q} with items within budget (${s.calls}/${BUDGET[q].calls} calls, ${s.triangles}/${BUDGET[q].tris} tris)`);
    }
  },
  sound: async () => {
    // Sound is off until the word is tapped; the tap creates the AudioContext (a user gesture).
    await sk(() => window.__sk.showTitle());
    await page.waitForTimeout(300);
    const a = await sk(() => window.__sk.state());
    check(!a.settings.sound && a.audio === 'none', `sound off by default, no AudioContext yet (${a.audio})`);
    await page.tap('#set-sound');
    await page.waitForTimeout(300);
    const b = await sk(() => ({ st: window.__sk.state(), note: document.getElementById('note').textContent }));
    check(b.st.settings.sound && b.st.audio === 'running', `tapping Sound: on, context ${b.st.audio}; note "${b.note}"`);
    await page.tap('#btn-race');
    await page.waitForFunction(() => window.__sk.state().screen === 'race');
    await page.waitForTimeout(3600);                     // the countdown beeps and the engine run in real time
    const c = await sk(() => window.__sk.state());
    check(c.audio === 'running' && c.phase === 'racing', `racing with sound (${c.audio})`);
    await sk(() => window.__sk.pause());
    const d = await sk(() => window.__sk.state());
    check(d.audio === 'suspended', `pause suspends audio (${d.audio})`);
    await sk(() => window.__sk.resume());
    await page.waitForTimeout(200);
    const e = await sk(() => window.__sk.state());
    check(e.audio === 'running', `resume restarts it (${e.audio})`);
    // Every one-shot sound once, through the real event path.
    await sk(() => { for (const id of ['kettle', 'quilt', 'yarn', 'honey', 'plane']) { window.__sk.giveItem(id); window.__sk.state(); window.__sk.useAll(); } });
    await page.waitForTimeout(700);
    await sk(() => window.__sk.showTitle());
    // Hidden and back on the title, then Race: the sound comes back (a regression check).
    await sk(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(200);
    await sk(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.tap('#btn-race');
    await page.waitForFunction(() => window.__sk.state().screen === 'race');
    await page.waitForTimeout(300);
    const g = await sk(() => window.__sk.state());
    check(g.audio === 'running', `after the page was hidden on the title, the next race has sound (${g.audio})`);
    await sk(() => window.__sk.showTitle());
    await page.tap('#set-sound');
    await page.waitForTimeout(200);
    const f = await sk(() => window.__sk.state());
    check(!f.settings.sound && f.audio === 'suspended', `tapping again turns it off (${f.audio})`);
  },
  tilt: async () => {
    await sk(() => window.__sk.showTitle());
    await page.waitForTimeout(200);
    // iOS's permission prompt, stubbed: refused → the word stays off and says why.
    await sk(() => { DeviceOrientationEvent.requestPermission = async () => 'denied'; });
    await page.tap('#set-tilt');
    await page.waitForTimeout(300);
    const a0 = await sk(() => ({ st: window.__sk.state(), note: document.getElementById('note').textContent, live: document.getElementById('live').textContent }));
    check(!a0.st.settings.tilt && /isn’t available/.test(a0.note) && a0.live === a0.note, `motion permission refused: tilt stays off ("${a0.note}"), and the refusal is said through the live region ("${a0.live}")`);
    // Granted, but no readings ever arrive (a desktop): still off.
    await sk(() => { DeviceOrientationEvent.requestPermission = async () => 'granted'; });
    await page.tap('#set-tilt');
    await page.waitForTimeout(1100);
    const a = await sk(() => ({ st: window.__sk.state(), note: document.getElementById('note').textContent }));
    check(!a.st.settings.tilt && /isn’t available/.test(a.note), `granted but no orientation readings: tilt stays off ("${a.note}")`);
    // Granted and readings arrive (a phone): the word turns on.
    await sk(() => { window.__tiltG = 5; window.__tiltTimer = setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 40, gamma: window.__tiltG })), 50); });
    await page.tap('#set-tilt');
    await page.waitForTimeout(1100);
    const b = await sk(() => ({ st: window.__sk.state(), note: document.getElementById('note').textContent }));
    check(b.st.settings.tilt, `orientation readings: tilt turns on ("${b.note}")`);
    // Neutral is the average over the countdown (gamma 5°); leaning to 20° steers (20 − 5 − 3) / 19.
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', racer: 'juno', seed: 2 }); });
    await page.waitForTimeout(3400);
    await sk(() => { window.__tiltG = 20; });
    await page.waitForTimeout(300);
    const c = await sk(() => window.__sk.state());
    check(Math.abs(c.tilt.neutral - 5) < 0.5 && Math.abs(c.input.steer - 12 / 19) < 0.05 && c.steer > 0.3, `tilt steers: neutral ${c.tilt.neutral.toFixed(1)}°, input ${c.input.steer.toFixed(2)}, kart ${c.steer.toFixed(2)}`);
    await sk(() => { window.__tiltG = 6; });
    await page.waitForTimeout(200);
    const d = await sk(() => window.__sk.state());
    check(d.input.steer === 0, `within the 3° dead zone: straight (${d.input.steer})`);
    await sk(() => { clearInterval(window.__tiltTimer); });
    await page.waitForTimeout(700);
    const e = await sk(() => window.__sk.state());
    check(e.input.steer === 0 && e.tilt.steer === null, 'readings stop: tilt lets go and the pad steers again');
    await sk(() => window.__sk.showTitle());
    await page.tap('#set-tilt');
    const f = await sk(() => window.__sk.state());
    check(!f.settings.tilt, 'tapping the word again turns tilt off');
  },
  face: async () => {
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', seed: 1 }); window.__sk.freeze(true); });
    for (const id of ['pip', 'juno', 'otto', 'wren', 'soren', 'mabel', 'tuck', 'ines']) {
      await sk((id) => window.__sk.lookAtKart(id), id);
      await page.screenshot({ path: path.join(out, `face-${id}.png`), clip: { x: 95, y: 250, width: 200, height: 260 } });
    }
    console.log('  face-*.png');
    await sk(() => window.__sk.showTitle());
  },
  // A full run driven through the real title rather than startRace's options: pick track 2 (Pinewood
  // Pass) by its word, pick a racer by tapping its face, tap Race, sit through the countdown, then let
  // the race itself run at simulated speed (the advance hook, a time-scale; the navigation around it
  // is real taps) through all three laps to the results, and back to the title with "Change".
  journey: async () => {
    await sk(() => window.__sk.showTitle());
    await page.waitForTimeout(300);
    const chosen = () => sk(() => document.querySelector('#tracks [aria-checked="true"]').textContent);
    const before = await chosen();
    await page.getByRole('radio', { name: 'Pinewood Pass', exact: true }).tap();
    await page.waitForTimeout(400);
    const after = await chosen();
    check(before === 'Harbour Loop' && after === 'Pinewood Pass', `the track words choose track 2: "${before}" then "${after}"`);
    await page.getByRole('radio', { name: 'Otto Brisk', exact: true }).tap();
    await page.waitForTimeout(150);
    const picked = await sk(() => ({ id: document.querySelector('.racer[aria-checked="true"]').dataset.id, name: document.getElementById('racer-name').textContent }));
    check(picked.id === 'otto' && picked.name === 'Otto Brisk', `tapping a racer face selects it: "${picked.id}", named "${picked.name}"`);
    await shot('journey-title');
    await page.getByRole('button', { name: 'Race', exact: true }).tap();
    await page.waitForFunction(() => window.__sk.state().screen === 'race');
    const started = await sk(() => window.__sk.state());
    check(started.screen === 'race' && started.phase === 'countdown', `Race tapped: screen "${started.screen}", phase "${started.phase}"`);
    await sk(() => window.__sk.freeze(true));
    await shot('journey-countdown');
    await sk(() => window.__sk.setAutopilot(true));
    let i = 0;
    for (; i < 300; i++) { const s = await sk(() => { window.__sk.advance(2); return window.__sk.state(); }); if (s.finished) break; }
    const fin = await sk(() => window.__sk.state());
    check(fin.finished === true, `three laps done through real navigation: finished ${fin.finished}, place ${fin.place}, lap ${fin.lap} (${i * 2}s simulated)`);
    await shot('journey-finish');
    await sk(() => window.__sk.advance(400));
    await page.waitForTimeout(700);
    const res = await sk(() => ({ screen: window.__sk.state().screen, rows: document.querySelectorAll('#res-list li').length }));
    check(res.screen === 'results' && res.rows === 8, `results reached through the real UI: ${res.rows} rows, screen "${res.screen}"`);
    await shot('journey-results');
    await page.getByRole('button', { name: 'Change track or racer', exact: true }).tap();
    await page.waitForTimeout(300);
    const back = await sk(() => window.__sk.state().screen);
    check(back === 'title', `"Change track or racer" returns to the title (screen "${back}")`);
    // A sideways swipe on the plate still changes track (the old track card's swipe).
    const cdp = await ctx.newCDPSession(page);
    const sw = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: 300, id: 1 }] });
    await sw('touchStart', 300); for (const x of [260, 220, 180, 140]) await sw('touchMove', x); await sw('touchEnd');
    await page.waitForTimeout(500);
    const swiped = await chosen();
    check(swiped === 'Lantern Night', `a leftward swipe on the plate moves to the next track: "${swiped}"`);
    await page.getByRole('radio', { name: 'Harbour Loop', exact: true }).tap();
    await page.waitForTimeout(400);
    await cdp.detach();
  },
  reload: async () => {
    await sk(() => {
      localStorage.removeItem('snugkart:v1:best:harbour');
      localStorage.setItem('snugkart:v1:best:harbour', JSON.stringify({ lap: 41000, race: 130000, racer: 'juno', at: new Date().toISOString() }));
    });
    await sk(async () => { await window.__sk.startRace({ track: 'harbour', racer: 'juno', seed: 9 }); window.__sk.freeze(true); window.__sk.advance(6); });
    const before = await sk(() => window.__sk.state());
    check(before.screen === 'race' && !before.finished, `mid-race before reload: screen "${before.screen}", lap ${before.lap}`);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('loading').classList.contains('done') || document.getElementById('loading').classList.contains('error'), null, { timeout: 120000 });
    await page.waitForTimeout(300);
    const after = await sk(() => ({ screen: window.__sk.state().screen, best: localStorage.getItem('snugkart:v1:best:harbour') }));
    check(after.screen === 'title', `reload mid-race does not resume the race: screen is "${after.screen}", not "race"`);
    check(!!after.best && JSON.parse(after.best).lap === 41000, `localStorage best survives a reload: ${after.best}`);
    const sessionUsed = await sk(() => Object.keys(sessionStorage).filter((k) => k.startsWith('snugkart')).length);
    check(sessionUsed === 0, `nothing under sessionStorage (Snuggery clears it on every launch): ${sessionUsed} snugkart keys`);
    const rec = await sk(() => { const r = document.getElementById('record'), d = r.querySelector('[aria-hidden="true"]'), s = r.querySelector('.sr'); return { d: (d || r).textContent, s: s && s.textContent }; });
    check(rec.d === 'Best lap0:41.000best race 2:10.000, as Juno' && rec.s === 'Best lap 41.000 seconds, best race 2 minutes 10.000 seconds, as Juno', `the record row: the best lap as the one large figure, then the best race and the racer you drove for it ("${rec.d}"), and in words for VoiceOver ("${rec.s}")`);
    await shot('reload-title');
  },
};

async function raceScene(track, extras = false) {
  await sk(async (track) => { await window.__sk.startRace({ track, racer: 'mabel', seed: 7, autopilot: true, quality: 'high' }); window.__sk.freeze(true); window.__sk.advance(20); }, track);
  if (extras) {
    // A held tier-2 drift (mint sparks) and a Paper Plane in hand.
    await sk(() => { window.__sk.giveItem('plane'); window.__sk.setAutopilot(false); });
    await page.keyboard.down('Space');
    await sk(() => { window.__sk.setDrift(2); window.__sk.advance(0.25); });
  }
  await page.waitForTimeout(300);
  const s = await sk(() => ({ st: window.__sk.state(), pos: document.getElementById('pos-n').textContent, of: document.getElementById('pos-of').textContent, lap: document.getElementById('lap').textContent, map: document.getElementById('minimap').width }));
  check(s.pos === `${s.st.place}${ordinal(s.st.place)}` && s.of === ' of 8' && /^Lap [1-3] of 3$/.test(s.lap) && s.map > 0 && s.st.phase === 'racing', `${track}: "${s.pos}${s.of}", "${s.lap}", track map ${s.map} px, v ${s.st.v.toFixed(1)} m/s`);
  await shot(`race-${track}`);
  if (extras) await page.keyboard.up('Space');
  await budgets(track);
}

/** Contrast of a halo mark's stroke against its own halo, read off a screenshot around a circle. */
async function ringSamples(sel, r, skip = () => false) {
  const box = await sk((sel) => document.querySelector(sel).getBoundingClientRect().toJSON(), sel);
  const img = decodePng(await page.screenshot());
  const cx = (box.left + box.width / 2) * 2, cy = (box.top + box.height / 2) * 2, out = [];
  for (let a = 0; a < 360; a += 4) {
    if (skip(a)) continue;
    const dx = Math.cos((a * Math.PI) / 180), dy = Math.sin((a * Math.PI) / 180);
    const s = img.at(cx + dx * r * 2, cy + dy * r * 2), h = img.at(cx + dx * (r + 1.25) * 2, cy + dy * (r + 1.25) * 2);
    if (cx + dx * (r + 2) * 2 < 0 || cy + dy * (r + 2) * 2 < 0 || cx + dx * (r + 2) * 2 >= img.w || cy + dy * (r + 2) * 2 >= img.h) continue;
    out.push(ratio(s, h));
  }
  return out;
}

/* ════════════════════ the house's scenes, in each theme ════════════════════ */
const look = {
  'look-title': async () => {
    await sk(() => window.__sk.showTitle());
    await page.waitForTimeout(500);
    const roles = await page.getByRole('button', { name: 'Race', exact: true }).count();
    const font = await sk(() => document.fonts.check('560 10.5px "Ysabeau Office"') && document.fonts.check('600 21px "Ysabeau Office"'));
    check(roles === 1 && font, `the camera's hook: one button named "Race" (${roles}); the face loaded (document.fonts.check 560 10.5px and 600 21px "Ysabeau Office")`);
    const aim = await sk(() => { const r = document.getElementById('title-plate').getBoundingClientRect(); return { view: window.__sk.camera().view, want: [innerWidth / 2 - (r.left + r.width / 2), innerHeight / 2 - (r.top + r.height / 2)], h: r.height }; });
    check(!!aim.view && Math.abs(aim.view[0] - aim.want[0]) < 0.5 && Math.abs(aim.view[1] - aim.want[1]) < 0.5 && aim.h >= 300, `the title camera's view is centered in its plate (offset ${aim.view && aim.view.map((v) => v.toFixed(1)).join(', ')}; plate ${Math.round(aim.h)} px tall)`);
    const tr = await tracerOf();
    check(tr.drawn.length > 0 && JSON.stringify(tr.drawn) === JSON.stringify(tr.chosen), `the tracer under exactly the chosen track, racer and settings that are on: ${tr.drawn.join(', ')}`);
    await house('title');
    await shot(`title-${scheme}`, true);
    // About: from its key, the loop stopped under it, the words, Escape, focus returned.
    await page.getByRole('button', { name: 'About', exact: true }).tap();
    await page.waitForTimeout(600);
    const a = await sk(() => ({ shown: !document.getElementById('about').hidden, running: window.__sk.state().running, text: document.getElementById('about').innerText, lic: document.getElementById('about-license').textContent, focus: document.activeElement && document.activeElement.id, modal: document.getElementById('about').getAttribute('aria-modal') }));
    const credit = 'Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
    const lic = fs.readFileSync(path.join(APP, 'vendor/three-LICENSE.txt'), 'utf8').trim().replace(/(?<!\n)\n(?!\n)/g, ' ');   // its 80-column breaks joined, its paragraphs kept
    check(a.shown && a.modal === 'true' && !a.running && a.focus === 'about-close', `About opens from its key as a modal dialog, focus on Close, the loop stopped under it (running ${a.running})`);
    check(a.lic === lic && a.text.includes(credit) && a.text.includes('3D: three.js r186, MIT License, as follows.'), "About prints vendor/three-LICENSE.txt as text, word for word with its 80-column breaks joined into paragraphs, and both credits word for word");
    const rows = tracksData.length + 5;
    check((await sk(() => document.querySelectorAll('#about-game dt').length)) === rows && /Timing lines\s+10 a lap/.test(a.text), `About's "This game": ${rows} label: value lines from the loaded data`);
    await house('About');
    await shot(`about-${scheme}`, true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const b = await sk(() => ({ shown: !document.getElementById('about').hidden, running: window.__sk.state().running, focus: document.activeElement && document.activeElement.id }));
    check(!b.shown && b.running && b.focus === 'btn-about', `Escape closes About, the title moves again, focus back on the About key (${b.focus})`);
  },
  'look-race': async () => {
    // Pinewood Pass at 25 s, seed 7: the racer ahead is on screen, so the reticle shows over the scene.
    await sk(async () => { await window.__sk.startRace({ track: 'pinewood', racer: 'mabel', seed: 7, autopilot: true, quality: 'high' }); window.__sk.freeze(true); window.__sk.advance(25); window.__sk.setAutopilot(false); window.__sk.giveItem('plane'); window.__sk.advance(1.0); });
    await page.waitForTimeout(300);
    const card = await sk(() => ({ live: !!document.querySelector('#pos-n[aria-live], #card[aria-live]'), pause: document.getElementById('btn-pause').getBoundingClientRect().toJSON(), empty: document.getElementById('btn-item').getAttribute('aria-label') }));
    check(!card.live && card.pause.width >= 44 && card.pause.height >= 44, `the place is no live region (B6); the Pause key hits ${card.pause.width} × ${card.pause.height} (B2)`);
    await house('race');
    await shot(`race-${scheme}`, true);
    const ret = await sk(() => !document.getElementById('reticle').hidden);
    if (ret) {
      const rs = await ringSamples('#reticle', 14, (a) => a % 90 <= 10 || a % 90 >= 80);   // not where the four ticks cross the ring
      check(pct(rs, 0.1) >= 3, `the reticle over Pinewood Pass: stroke against its own halo, 90 % of ${rs.length} samples at 3:1 or more, the ticks' crossings left out (10th percentile ${pct(rs, 0.1).toFixed(2)}, lowest ${Math.min(...rs).toFixed(2)})`);
    } else check(false, 'the reticle shows on the racer ahead while a plane is in hand');
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 90, y: 700, id: 9 }] });
    await page.waitForTimeout(150);
    const ps = await ringSamples('#pad', 56);
    check(pct(ps, 0.1) >= 3, `the steering ring over Pinewood Pass: stroke against its own halo, 90 % of ${ps.length} samples at 3:1 or more (10th percentile ${pct(ps, 0.1).toFixed(2)}, lowest ${Math.min(...ps).toFixed(2)})`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    // The strip is drawn only when its head's pixel or the place changes (HOUSE 4.6's rule, here).
    const s0 = (await sk(() => window.__sk.state())).strips;
    await sk(() => { window.__sk.advance(0); window.__sk.advance(0); });
    const s1 = (await sk(() => window.__sk.state())).strips;
    await sk(() => window.__sk.advance(1));
    const s2 = (await sk(() => window.__sk.state())).strips;
    check(s1 === s0 && s2 > s1, `the race card's strip: no redraw across ${2 * 20} frames that changed nothing (${s0} then ${s1}), redrawn once the head moved (${s2})`);
    // Past the first lap (on autopilot again, until a lap is done): each time on the card is
    // aria-hidden figures with a .sr twin in words.
    await sk(() => { window.__sk.setAutopilot(true); for (let i = 0; i < 30 && !document.getElementById('last').textContent; i++) window.__sk.advance(4); });
    await page.waitForTimeout(100);
    const ct = await sk(() => {
      const twin = (e) => (e.nextElementSibling && e.nextElementSibling.classList.contains('sr') ? e.nextElementSibling.textContent : null);
      const t = document.getElementById('rtime'), l = document.getElementById('last');
      return { t: t.textContent, ts: twin(t), th: t.getAttribute('aria-hidden'), l: l.textContent, ls: twin(l), lh: l.getAttribute('aria-hidden') };
    });
    const lw = ct.l.startsWith('Last lap ') && words(ct.l.slice(9));
    check(ct.th === 'true' && ct.lh === 'true' && ct.ts === `, ${words(ct.t)}` && !!lw && ct.ls === `Last lap ${lw}`, `the race card's times are said in words: "${ct.t}" as "${ct.ts}", "${ct.l}" as "${ct.ls}"`);
  },
  'look-results': async () => {
    // Harbour Loop, Juno, seed 5, the wait skipped by a tap 2 s after the finish: projected racers too.
    await sk(async () => { localStorage.removeItem('snugkart:v1:best:harbour'); await window.__sk.startRace({ track: 'harbour', racer: 'juno', seed: 5, autopilot: true }); window.__sk.freeze(true); for (let i = 0; i < 100 && !window.__sk.state().finished; i++) window.__sk.advance(2); window.__sk.advance(2.1); });
    await page.touchscreen.tap(W / 2, 400); await sk(() => window.__sk.advance(0));
    await page.waitForTimeout(900);
    const c = await sk(() => ({ ch: window.__sk.chart(), box: document.getElementById('chart').getBoundingClientRect().toJSON(), label: document.getElementById('chart').getAttribute('aria-label') }));
    const { ch } = c, d = ch.drawn, ids = Object.keys(ch.gates);
    // The rule ART.md 1 sets, worked out here: x from the grid (14 px) to the names' column over 30 timing lines; 16 px a place, 7 px down.
    const X = (col) => d.x0 + (col * (d.x1 - d.x0)) / 30, Y = (p) => 7 + (p - 1) * 16;
    const drawnOk = d.x0 === 14 && d.top === 7 && d.row === 16 && d.cols === 30 && d.x1 < c.box.width && ids.every((id) => d.points[id].length === ch.gates[id].length && d.points[id].every(([x, y], col) => Math.abs(x - X(col)) < 0.01 && Math.abs(y - Y(ch.gates[id][col])) < 0.01));
    check(drawnOk, `the Lap Chart is drawn by this file's rule: every racer's point at x = 14 + col·(x1 − 14)/30, y = 7 + (place − 1)·16 (x1 ${d.x1.toFixed(1)} of ${c.box.width} px)`);
    let ranks = true;
    for (let col = 0; col <= 30; col++) { const ps = ids.map((id) => ch.gates[id][col]); if (ps.every((p) => p != null) && JSON.stringify([...ps].sort((a, b) => a - b)) !== '[1,2,3,4,5,6,7,8]') ranks = false; }
    const fin = ids.filter((id) => !ch.projected.includes(id));
    check(ranks && ch.gates[ch.player][0] === 5 && fin.every((id) => ch.gates[id].length === 31 && ch.gates[id][30] === ch.final[id]) && ch.projected.every((id) => ch.gates[id].length < 31),
      `the record: every full column a ranking of 1 to 8; you start 5th; the ${fin.length} finishers end on their places; the ${ch.projected.length} projected racers (${ch.projected.join(', ')}) stop where they stood, dotted on to their places`);
    check(/^Lap chart: you started 5th and finished \d(st|nd|rd|th) of 8\.$/.test(c.label), `the chart's accessible name: "${c.label}"`);
    const lead = await sk(() => { const e = document.getElementById('res-lead'), n = e.nextElementSibling; return { d: e.textContent, s: n && n.classList.contains('sr') ? n.textContent : null, h: e.getAttribute('aria-hidden') }; });
    const lm = /^(of 8 in )(.+)$/.exec(lead.d);
    check(lead.h === 'true' && !!lm && !!words(lm[2]) && lead.s === lm[1] + words(lm[2]), `the results' lead is said in words: "${lead.d}" as "${lead.s}"`);
    // The signature sampler: your ink at the middle of each segment against the pixels 4 px to each side.
    const img = decodePng(await page.screenshot()), pts = d.points[ch.player], samples = [];
    const ink = scheme === 'dark' ? [0xe6, 0xed, 0xee] : [0x0f, 0x1c, 0x23];
    let inked = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      const mx = c.box.left + (x0 + x1) / 2, my = c.box.top + (y0 + y1) / 2, at = (dx, dy) => img.at((mx + dx) * 2, (my + dy) * 2);
      const p = at(0, 0);
      if (Math.hypot(p[0] - ink[0], p[1] - ink[1], p[2] - ink[2]) < 40) inked++;
      for (const s of [1, -1]) samples.push(ratio(p, at(4 * s * nx, 4 * s * ny)));
    }
    check(inked >= 0.9 * (pts.length - 1) && pct(samples, 0.1) >= 3, `the signature sampler: your line is ink at ${inked} of ${pts.length - 1} segment middles; against the pixels 4 px to each side, 90 % of ${samples.length} samples at 3:1 or more (10th percentile ${pct(samples, 0.1).toFixed(2)}, lowest ${Math.min(...samples).toFixed(2)}, where a rival's line runs beside it)`);
    const rows = await sk(() => [...document.querySelectorAll('#res-list li')].map((li) => li.querySelector('.times').firstChild.textContent));
    const st = await sk(() => window.__sk.state());
    check(st.results.every((x, i) => (x.est ? /^about \d+:\d\d$/ : /^\d+:\d\d\.\d{3}$/).test(rows[i])) && st.results.some((x) => x.est), `the rows: projected times "about" to the second (${st.results.filter((x) => x.est).length}), measured ones to the millisecond`);
    const labels = await sk(() => [...document.querySelectorAll('#res-list li')].map((li) => li.getAttribute('aria-label')));
    check(labels.every((l) => /^\d(st|nd|rd|th), [^,]+, (about )?(\d+ minutes? )?[\d.]+ seconds?(, best lap (\d+ minutes? )?[\d.]+ seconds?)?$/.test(l)) && (await sk(() => document.getElementById('res-list').getAttribute('role'))) === 'list', `the rows are a list, each named in words: "${labels[0]}"`);
    await house('results');
    await shot(`results-${scheme}`, true);
  },
  'look-pause': async () => {
    await sk(async () => { await window.__sk.startRace({ track: 'lantern', racer: 'tuck', seed: 4, autopilot: true }); window.__sk.freeze(true); window.__sk.advance(12); });
    await page.tap('#btn-pause');   // a real tap, so focus moves as it does under a finger (no focus ring)
    await page.waitForTimeout(300);
    const pf = await sk(() => { const d = document.getElementById('pause'); return { focus: document.activeElement && document.activeElement.id, role: d.getAttribute('role'), name: document.getElementById(d.getAttribute('aria-labelledby')).textContent }; });
    check(pf.focus === 'btn-resume' && pf.role === 'dialog' && pf.name === 'Paused', `pausing: a dialog named "${pf.name}" (${pf.role}), focus on Resume (${pf.focus})`);
    await house('pause');
    await shot(`paused-${scheme}`, true);
    await sk(() => window.__sk.resume());
    const rf = await sk(() => document.activeElement && document.activeElement.id);
    check(rf === 'btn-pause', `resuming puts focus back on the Pause key (${rf})`);
  },
};

/* ════════════════════ once ════════════════════ */
const once = {
  live: async () => {
    await sk(() => { window.__said = []; new MutationObserver(() => { const t = document.getElementById('live').textContent; if (t) window.__said.push(t); }).observe(document.getElementById('live'), { childList: true, characterData: true, subtree: true }); });
    await sk(async () => { await window.__sk.startRace({ track: 'lantern', racer: 'soren', seed: 3, autopilot: true }); window.__sk.freeze(true); });
    for (let i = 0; i < 300; i++) { const f = await sk(() => { window.__sk.advance(1); return window.__sk.state().finished; }); await page.waitForTimeout(20); if (f) break; }
    await page.waitForTimeout(200);
    const said = await sk(() => window.__said);
    const main = said.filter((t) => !/^(Hit by|Caught in|Stuck in)/.test(t));
    const ok = main.length === 4 && main[0] === 'Go' && /^Lap 2 of 3, \d(st|nd|rd|th) of 8\.$/.test(main[1]) && /^Lap 3 of 3, \d(st|nd|rd|th) of 8\.$/.test(main[2]) && /^Finished \d(st|nd|rd|th) of 8 in \d+ minutes? \d+\.\d{3} seconds\.$/.test(main[3]);
    check(ok && said.every((t) => /\.$|^Go$/.test(t)), `the live region, once each: ${said.map((t) => `"${t}"`).join(', ')} (${said.length} sentences a race; the place, which changed many times, said none)`);
    for (let i = 0; i < 60; i++) { const s = await sk(() => { window.__sk.advance(2); return window.__sk.state().screen; }); if (s === 'results') break; }
    await page.waitForTimeout(200);
    const res = await sk(() => window.__said.slice(-1)[0]);
    check(/^Results: \d(st|nd|rd|th) of 8\. Race again or change track\.$/.test(res), `the results sheet says one sentence as it appears: "${res}"`);
  },
  reduced: async () => {
    // The motion each Reduce Motion rule removes, measured first with motion on, in this page.
    const moving = await sk(async () => {
      await window.__sk.startRace({ track: 'harbour', racer: 'pip', seed: 2 }); window.__sk.freeze(true); window.__sk.advance(0.3);
      const a = window.__sk.camera().pos; window.__sk.advance(0.6); const b = window.__sk.camera().pos;
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    });
    const R = await open('light', { reduced: true });
    const keep = { ctx, page }; ctx = R.c; page = R.p;
    await page.waitForTimeout(400);
    const t = await sk(async () => {
      const a = window.__sk.camera().pos; await new Promise((r) => setTimeout(r, 1000)); const b = window.__sk.camera().pos;
      const tr = document.querySelector('#tracks [aria-checked="true"]');
      return { still: window.__sk.state().still, moved: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), anim: getComputedStyle(tr, '::after').animationDuration };
    });
    check(t.still && t.moved < 1e-6 && t.anim === '0s', `Reduce Motion: the title camera stands still over a second (moved ${t.moved.toFixed(4)} m) and the tracer draws in 0 s (${t.anim})`);
    await page.getByRole('button', { name: 'About', exact: true }).tap(); await page.waitForTimeout(100);
    const ab = await sk(() => getComputedStyle(document.querySelector('.about-sheet')).animationDuration);
    await page.keyboard.press('Escape');
    const still = await sk(async () => {
      await window.__sk.startRace({ track: 'harbour', racer: 'pip', seed: 2 }); window.__sk.freeze(true); window.__sk.advance(0.3);
      const a = window.__sk.camera().pos; window.__sk.advance(0.6); const b = window.__sk.camera().pos;
      window.__sk.advance(4); window.__sk.giveItem('kettle'); window.__sk.useAll(); window.__sk.advance(0.05);
      const boost = window.__sk.state().boost; window.__sk.stats(); const c = window.__sk.camera().pos; window.__sk.stats(); const d = window.__sk.camera().pos;
      return { count: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), boost, shake: Math.hypot(c[0] - d[0], c[1] - d[1], c[2] - d[2]) };
    });
    check(ab === '0s' && still.count < 0.01 && moving > 0.3 && still.boost > 0 && still.shake < 1e-9, `Reduce Motion: About in 0 s (${ab}); the countdown starts at the chase pose (the camera moves ${still.count.toFixed(3)} m between 0.3 s and 0.9 s, against ${moving.toFixed(2)} m with motion on); no shake through a boost (${still.shake} m between two frames)`);
    await shot('reduced-race');
    // No blink under Reduce Motion: the item shuffle shows the item it lands on (at 75 %), and a kart
    // recovering from a hit is a steady half form. Planes for everyone hurry the hits along.
    const rm = await sk(async () => {
      await window.__sk.startRace({ track: 'harbour', racer: 'pip', seed: 2, autopilot: true }); window.__sk.freeze(true); window.__sk.advance(4);
      const out = { roll: null, immune: [] }, me = () => window.__sk.karts().find((k) => k.player);
      for (let i = 0; i < 400 && (!out.roll || out.immune.length < 3); i++) {
        if (i % 20 === 0) { window.__sk.giveAll('plane'); window.__sk.useAll(); }
        const was = window.__sk.state().stun;
        window.__sk.advance(0.1);
        const st = window.__sk.state();
        if (!out.roll && st.itemRoll > 0 && st.item) out.roll = { item: st.item, href: document.getElementById('item-use').getAttribute('href'), rolling: document.getElementById('btn-item').classList.contains('rolling') };
        if (was && !st.stun && out.immune.length < 3) for (let j = 0; j < 3; j++) { const k = me(); out.immune.push([k.body, k.opacity]); window.__sk.advance(0.1); }
      }
      return out;
    });
    const steady = rm.immune.length === 3 && rm.immune.every(([b, o]) => b && o === 0.5);
    check(!!rm.roll && rm.roll.href === `#i-${rm.roll.item}` && rm.roll.rolling && steady, `Reduce Motion, no blink: mid-shuffle the item key shows the ${rm.roll && rm.roll.item} it lands on, at 75 % (${rm.roll && rm.roll.href}); after a hit your kart is a steady half form (${JSON.stringify(rm.immune)}: shown, opacity, at 0.1 s steps)`);
    await ctx.close(); ({ ctx, page } = keep);
  },
  widths: async () => {
    for (const [w, h, dpr, name] of [[320, 640, 2, '320'], [320, 568, 2, '320 × 568'], [360, 780, 2, '360'], [375, 667, 2, '375'], [312, 675, 2.5, '125 % zoom'], [844, 390, 2, '844 × 390'], [667, 375, 2, '667 × 375'], [932, 430, 2, '932 × 430']]) {
      const R = await open('light', { w, h, dpr });
      const keep = { ctx, page }; ctx = R.c; page = R.p;
      await page.waitForTimeout(400);
      const v = await sk(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect(), race = r('btn-race'), plate = r('title-plate'), cap = r('caption'), bands = document.querySelector('.bands');
        return { scroll: document.documentElement.scrollWidth - innerWidth, race: race.bottom <= innerHeight && race.right <= innerWidth && race.width > 0, plate: plate.height, cap: cap.height, inside: bands.scrollHeight >= bands.clientHeight };
      });
      const floor = w > h ? 220 : 0.38 * h - 1;
      check(v.scroll <= 0 && v.race && v.plate >= floor && v.cap === 30, `${name}: no sideways scroll (${v.scroll}), Race on screen, the title's plate ${Math.round(v.plate)} px (at least ${Math.round(floor)}), the caption's two fixed lines ${v.cap} px, the bands scrolling inside themselves`);
      // Every control on the title hits at 44 × 44 or more, by house()'s run-length test: on its side
      // the racers' faces too, two rows of four in the 360 px column (eight across would be 40 px).
      const ht = await hitTargets();
      check(ht.bad.length === 0, `${name}: the title's ${ht.n} controls hit at 44 × 44 or more${ht.bad.length ? ': ' + ht.bad.join('; ') : ''}`);
      await shot(`width-${name.replace(/[^0-9a-z]+/g, '')}`);
      // In full screen on iOS 18 Snuggery's 44 pt exit control sits 16 pt inside the top-right corner
      // (NOTES decision 36): no key of the title's header may be under it (the words as clipped by their row).
      const ex = await sk(() => {
        const box = (e) => e.getBoundingClientRect(), x = [innerWidth - 60, 16, innerWidth - 16, 60], row = box(document.getElementById('tracks'));
        return [...document.querySelectorAll('#tracks button, #btn-about')].filter((b) => {
          const r = box(b), l = Math.max(r.left, b.id ? r.left : row.left), rt = Math.min(r.right, b.id ? r.right : row.right);
          return l < rt && l < x[2] && x[0] < rt && r.top < x[3] && x[1] < r.bottom;
        }).map((b) => b.textContent);
      });
      check(ex.length === 0, `${name}: About and the track words clear of the exit control's 44 px square 16 px inside the top-right corner${ex.length ? ': ' + ex.join(', ') : ''}`);
      // The countdown of a first race: the hint under the countdown's plate, clear of every other plate.
      await sk(async () => { localStorage.removeItem('snugkart:v1:hints'); await window.__sk.startRace({ track: 'pinewood', racer: 'pip', seed: 3 }); window.__sk.freeze(true); window.__sk.advance(0.3); });
      const cd = await sk(() => {
        const ids = ['hint', 'count', 'card', 'btn-pause', 'minimap', 'btn-item', 'btn-drift', 'pad-ghost'], rs = ids.map((id) => [id, document.getElementById(id)]).filter(([, e]) => !e.closest('[hidden]')).map(([id, e]) => [id, e.getBoundingClientRect()]);
        const off = rs.filter(([, r]) => r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight).map(([id]) => id);
        const lap = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i][1], b = rs[j][1]; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) lap.push(`${rs[i][0]}/${rs[j][0]}`); }
        return { shown: rs.map(([id]) => id), off, lap, font: getComputedStyle(document.getElementById('count')).fontSize };
      });
      const numerals = h > w && h <= 600 ? '75px' : '96px';   // a 100 px plate on a short upright phone, else 128
      check(cd.shown.includes('hint') && cd.shown.includes('count') && cd.off.length === 0 && cd.lap.length === 0 && cd.font === numerals, `${name}, a first race's countdown: the numerals at ${cd.font}; the hint, the countdown, the card, Pause, the map, Item, Drift and the steering ring on screen and clear of each other${cd.off.length + cd.lap.length ? ': ' + [...cd.off, ...cd.lap].join(', ') : ''}`);
      await shot(`width-${name.replace(/[^0-9a-z]+/g, '')}-countdown`);
      await sk(async () => { await window.__sk.startRace({ track: 'pinewood', racer: 'pip', seed: 3, autopilot: true }); window.__sk.freeze(true); window.__sk.advance(8); });
      await page.waitForTimeout(200);
      const hud = await sk(() => {
        const w = document.getElementById('warn'), bn = document.getElementById('banner'), was = bn.textContent;
        w.hidden = false;   // laid out as it would be with a plane aimed at you, and hit by a snare
        bn.textContent = 'Caught in a yarn snare'; bn.hidden = false;
        const ids = ['card', 'btn-pause', 'minimap', 'warn', 'banner', 'btn-item', 'btn-drift'], rs = ids.map((id) => [id, document.getElementById(id).getBoundingClientRect()]);
        w.hidden = true; bn.hidden = true; bn.textContent = was;
        const off = rs.filter(([, r]) => r.width && (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight)).map(([id]) => id);
        const lap = []; for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i][1], b = rs[j][1]; if (a.width && b.width && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) lap.push(`${rs[i][0]}/${rs[j][0]}`); }
        return { off, lap };
      });
      check(hud.off.length === 0 && hud.lap.length === 0, `${name}, racing: the card, Pause, the map, the warning, the longest banner, Item and Drift on screen and clear of each other${hud.off.length + hud.lap.length ? ': ' + [...hud.off, ...hud.lap].join(', ') : ''}`);
      await shot(`width-${name.replace(/[^0-9a-z]+/g, '')}-race`);
      // The results: a short panel scrolls; the Lap Chart's caption keeps its two lines inside it.
      for (let i = 0; i < 60; i++) { const s = await sk(() => { window.__sk.advance(4); return window.__sk.state().screen; }); if (s === 'results') break; }
      await page.waitForTimeout(600);
      const rc = await sk(() => { const c = document.querySelector('.chart-cap').getBoundingClientRect(), p = document.querySelector('.results-panel').getBoundingClientRect(); return { screen: window.__sk.state().screen, h: c.height, inside: c.left >= p.left && c.right <= p.right }; });
      check(rc.screen === 'results' && rc.h === 30 && rc.inside, `${name}, the results: the chart's caption ${rc.h} px tall (two lines of 15), inside the panel`);
      await shot(`width-${name.replace(/[^0-9a-z]+/g, '')}-results`);
      await ctx.close(); ({ ctx, page } = keep);
    }
  },
  broken: async () => {
    const racers = JSON.parse(fs.readFileSync(path.join(APP, 'data/racers.json'), 'utf8'));
    delete racers.racers[0].body;
    const cases = [
      ['data/tracks.json missing', '**/data/tracks.json', { status: 404, body: '' }, 'data/tracks.json is missing (the app needs it to build the races).'],
      ['data/tracks.json not JSON', '**/data/tracks.json', { status: 200, body: '{"tracks": [', contentType: 'application/json' }, 'data/tracks.json is not valid JSON. Check for a missing comma or bracket.'],
      ['data/tracks.json without "tracks"', '**/data/tracks.json', { status: 200, body: '{}', contentType: 'application/json' }, 'data/tracks.json has no "tracks" list.'],
      ['a racer short of a field', '**/data/racers.json', { status: 200, body: JSON.stringify(racers), contentType: 'application/json' }, `data/racers.json, racer "${racersData[0].name}": "body" must be a color like #F28C28.`],
    ];
    for (const [name, url, res, want] of cases) {
      const R = await open('light', { route: { url, fn: (r) => r.fulfill(res) }, expect: /404|data\/(tracks|racers)\.json/ });
      const v = await R.p.evaluate(() => { const m = document.getElementById('load-msg'); return { text: m.textContent, role: m.getAttribute('role'), shown: !document.getElementById('loading').hidden && m.getBoundingClientRect().height > 0 }; });
      check(v.text === want && v.role === 'alert' && v.shown, `broken data, ${name}: the sentence on a plate, role alert: "${v.text}"`);
      await R.c.close();
    }
  },
};

/* ════════════════════ the run ════════════════════ */
const run = async (name, fn) => {
  if (only.size && !only.has(name)) return;
  const t = Date.now();
  console.log(`scene ${name}`);
  try { await fn(); } catch (e) { fails.push(`scene ${name}: ${e.message}`); console.log(`    FAIL ${e.message}`); }
  console.log(`  (${Date.now() - t} ms)`);
};
for (const [i, sch] of schemes.entries()) {
  scheme = sch;
  const R = await open(sch); ctx = R.c; page = R.p;
  const failed = await sk(() => (document.getElementById('loading').classList.contains('error') ? document.getElementById('load-msg').textContent : null));
  if (failed) { console.log('LOAD FAILED:', failed); console.log(errors.join('\n')); await browser.close(); server.close(); process.exit(1); }
  console.log(`\n== ${sch}: loaded in ${R.ms} ms (headless Chromium)`);
  await sk(() => window.__sk.adaptive(false));   // keep the pixel ratio fixed so shots and stats are comparable
  if (i === 0) for (const [name, fn] of Object.entries(scenes)) await run(name, fn);
  for (const [name, fn] of Object.entries(look)) await run(`${name}`, fn);
  if (i === 0) {
    for (const [name, fn] of Object.entries(once)) await run(name, fn);
  }
  await ctx.close();
}

await browser.close();
server.close();
check(hashOf(path.join(SHOTS, 'app.png')) === appPngHash, `screenshots/app.png, the README's picture, untouched (sha256 ${String(appPngHash).slice(0, 12)}…)`);
const outside = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'));
console.log(`${requests.length} requests, ${outside.length} outside the app`);
if (errors.length) { console.log('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(2); }
if (fails.length) { console.log('FAILED CHECKS:\n' + fails.join('\n')); process.exit(3); }
console.log('no console errors; all checks pass');
