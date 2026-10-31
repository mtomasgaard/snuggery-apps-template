// Drive Norway in 3D in headless Chromium at phone size (390 x 844 CSS px, DPR 2, touch), light and
// dark, under the online Content-Security-Policy Snuggery gives an approved online app (tools/serve.mjs).
// It FAILS on any console error or warning, page error, CSP violation, request to a host outside
// miniapp.json's resourceHosts (and the local server), or HTTP status of 400 or more from the
// local server. Map and height tiles come from the real services, so a run needs the network.
//
// FRAME TIMES, LOAD TIMES AND MEMORY HERE ARE HEADLESS CHROMIUM ON THE BUILD MAC (SwiftShader WebGL):
// a trend, never phone evidence. The phone's figures are the owner's checks (NOTES.md).
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs         one theme
//   SCENES=map,cabin node tools/shoot.mjs      some scenes (map, cabin, about, focus, style, 3d,
//                                              motion, hands, sun, layers, norway, widths)
//   OUT=dir node tools/shoot.mjs               where the pictures go (default tools/.work/shots)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { startServer, APP, resourceHosts } from './serve.mjs';

let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); } catch (e) {
  console.error(`Playwright could not be loaded (${e.code || e.message}): set PLAYWRIGHT_MODULE to a playwright/index.mjs.`); process.exit(4);
}
const chromium = pw.chromium || pw.default.chromium;
const OUT = process.env.OUT ? path.resolve(process.env.OUT) : path.join(APP, 'tools', '.work', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const schemes = (process.env.SCHEMES || 'light,dark').split(',');
const sceneFilter = process.env.SCENES ? new Set(process.env.SCENES.split(',')) : null;
const HOSTS = new Set(resourceHosts());

const fails = [];
let checks = 0;
const ok = (cond, msg) => { checks++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { server, port } = await startServer(0);
const BASE = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disk-cache-size=1'] });
const perf = [];

async function newPage(scheme, opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.viewport || { width: 390, height: 844 }, deviceScaleFactor: opts.dpr || 2, isMobile: true, hasTouch: true,
    colorScheme: scheme, reducedMotion: opts.reducedMotion || 'no-preference',
  });
  const page = await ctx.newPage();
  const log = { errors: [], tileErrors: [], csp: [], foreign: [], http: [], requests: { local: 0, byHost: {} } };
  // the one message tolerated is SwiftShader's own about screenshots reading pixels back
  // A tile host now and then answers without its CORS header (a transient error page): the browser
  // logs it, the app retries it. Those are counted, not failed, unless there are many (endPage).
  page.on('console', (m) => {
    if (!(m.type() === 'error' || m.type() === 'warning') || /GPU stall due to ReadPixels/.test(m.text())) return;
    const at = (m.location() && m.location().url) || '';
    const host = /https:\/\/([^/]+)\//.exec(`${m.text()} ${at}`);
    if (host && HOSTS.has(host[1]) && /CORS policy|Failed to load resource/.test(m.text())) { log.tileErrors.push(m.text().slice(0, 140)); return; }
    log.errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => log.errors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    if (u.host === `127.0.0.1:${port}`) { log.requests.local++; return; }
    if (u.protocol === 'https:' && HOSTS.has(u.hostname)) { log.requests.byHost[u.hostname] = (log.requests.byHost[u.hostname] || 0) + 1; return; }
    log.foreign.push(r.url());
  });
  page.on('response', (r) => { const u = new URL(r.url()); if (u.host === `127.0.0.1:${port}` && r.status() >= 400) log.http.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  return { ctx, page, log };
}
async function settle(page, maxMs = 90000) {
  const t0 = Date.now();
  let quiet = 0;
  while (Date.now() - t0 < maxMs) {
    const idle = await page.evaluate(() => !!(window.__norway3d && window.__norway3d.idle()));
    quiet = idle ? quiet + 1 : 0;
    if (quiet >= 4) return Date.now() - t0;
    await sleep(250);
  }
  return -1;
}
async function stats(page) { return page.evaluate(() => window.__norway3d.stats()); }
async function shot(page, name) { const f = path.join(OUT, `${name}.png`); await page.screenshot({ path: f }); return f; }
function endPage(log, label) {
  const total = Object.values(log.requests.byHost).reduce((a, b) => a + b, 0);
  ok(log.tileErrors.length <= Math.max(3, total * 0.02), `${label}: tile requests the hosts refused, retried by the app: ${log.tileErrors.length} of ${total}${log.tileErrors.length ? ` (${log.tileErrors[0]})` : ''}`);
  ok(log.errors.length === 0, `${label}: no console errors or warnings${log.errors.length ? `: ${log.errors.slice(0, 4).join(' | ')}` : ''}`);
  ok(log.foreign.length === 0, `${label}: no request outside the local server and the resource hosts${log.foreign.length ? `: ${log.foreign.slice(0, 3).join(' ')}` : ''}`);
  ok(log.http.length === 0, `${label}: no HTTP error from the package${log.http.length ? `: ${log.http.join(' ')}` : ''}`);
}
const want = (s) => !sceneFilter || sceneFilter.has(s);

/** A PNG (8-bit RGB or RGBA, not interlaced, as Chromium writes them) to RGBA pixels: Besseggen's. */
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
  return { w, h, px };
}
/** The drape is on the ground: in the middle of the plate (60 % of it each way), the share of
 *  pixels with color (max - min channel above 24) and the share that read as the map's water blue.
 *  A bare relief without its map is gray: both near 0. */
async function drapeCheck(page, label) {
  const r = await page.evaluate(() => { const b = document.getElementById('plate').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const buf = await page.screenshot({ clip: { x: r.x + r.w * 0.2, y: r.y + r.h * 0.2, width: r.w * 0.6, height: r.h * 0.6 } });
  const { w, h, px } = decodePng(buf);
  let color = 0, water = 0;
  for (let i = 0; i < w * h; i++) {
    const R = px[i * 4], G = px[i * 4 + 1], B = px[i * 4 + 2];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx - mn > 24) color++;
    if (B > R + 20 && B >= G && mx - mn > 18) water++;
  }
  const c = color / (w * h), wa = water / (w * h);
  ok(c > 0.05, `${label}: the topo drape shows on the ground (${(c * 100).toFixed(1)} % of the middle in color, ${(wa * 100).toFixed(1)} % water blue)`);
  return { color: c, water: wa };
}
const CREDITS = /const CREDITS = '([^']+)'/.exec(fs.readFileSync(path.join(APP, 'app.js'), 'utf8'))[1];

/** A color profile of the plate's middle: shares of colored pixels, of near-white, and of the hues
 *  each layer brings (steepness's yellow to red to purple, snow's white). */
async function profileOf(page) {
  const r = await page.evaluate(() => { const b = document.getElementById('plate').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
  const buf = await page.screenshot({ clip: { x: r.x + r.w * 0.1, y: r.y + r.h * 0.25, width: r.w * 0.75, height: r.h * 0.7 } });
  const { w, h, px } = decodePng(buf);
  let color = 0, white = 0, warm = 0, purple = 0, sum = [0, 0, 0];
  for (let i = 0; i < w * h; i++) {
    const R = px[i * 4], G = px[i * 4 + 1], B = px[i * 4 + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    if (mx - mn > 24) color++;
    if (mn > 225) white++;
    if (R > 180 && B < 120 && R - B > 90) warm++;
    if (R > 100 && B > 120 && G < R - 30 && G < B - 20) purple++;
    sum[0] += R; sum[1] += G; sum[2] += B;
  }
  const n = w * h;
  return { color: color / n, white: white / n, warm: warm / n, purple: purple / n, mean: sum.map((v) => Math.round(v / n)) };
}
const pc = (v) => `${(v * 100).toFixed(1)} %`;

async function layerScene(page, scheme) {
  const go = async (lon, lat, d, phi, heading) => { await page.evaluate(([lon, lat, d, phi, heading]) => { const n = window.__norway3d; n.setMode('3d', false); n.lookAt(lon, lat, d, phi, -heading); n.setTime(2026, 3, 20, 11 * 60); }, [lon, lat, d, phi, heading]); await settle(page, 120000); await sleep(1500); await settle(page, 30000); };
  const set = (o) => page.evaluate((o) => { const n = window.__norway3d; Object.assign(n.S, o.S || {}); for (const [k, v] of Object.entries(o.layers || {})) n.setLayer(k, v); n.applySurface(); n.applySnow(); }, o);
  for (const [place, lon, lat, d, phi, heading, lineLo, lineHi] of [['besseggen', 8.72, 61.50, 9000, 64, 250, 1000, 2000], ['lyngen', 20.13, 69.60, 22000, 64, 110, 400, 1200]]) {
    await set({ S: { surface: 'map' }, layers: { slope: false, snow: false, names: true } });
    await go(lon, lat, d, phi, heading);
    const base = await profileOf(page);
    const nm = await page.evaluate(() => window.__norway3d.labels.stats.placed);
    ok(nm > 0, `${scheme}: ${place}: ${nm} floating names placed, none overlapping (the placement refuses overlaps)`);
    await shot(page, `names-${place}-${scheme}`);
    for (const surface of ['relief', 'elevation']) {
      await set({ S: { surface } });
      await settle(page, 30000); await sleep(600);
      const p = await profileOf(page);
      if (surface === 'relief') ok(p.color < base.color * 0.6, `${scheme}: ${place}: the relief has no map colors (${pc(p.color)} colored against the map's ${pc(base.color)})`);
      else ok(p.color > 0.3, `${scheme}: ${place}: the elevation surface is colored by height (${pc(p.color)} colored)`);
      await shot(page, `${surface}-${place}-${scheme}`);
      await set({ layers: { slope: true } });
      await sleep(800);
      const q = await profileOf(page);
      ok(q.warm + q.purple > p.warm + p.purple + 0.01, `${scheme}: ${place}: steepness on ${surface} adds its classes (${pc(p.warm + p.purple)} to ${pc(q.warm + q.purple)} warm and purple)`);
      await shot(page, `${surface}-slope-${place}-${scheme}`);
      await set({ layers: { slope: false } });
    }
    // snow: the line at 1 000 m against 2 000 m, and the seNorge model for today
    await set({ S: { surface: 'relief', snowMode: 'line', snowLine: lineLo }, layers: { snow: true } });
    await sleep(800);
    const lo = await profileOf(page);
    await shot(page, `snowline-${lineLo}-${place}-${scheme}`);
    await set({ S: { snowLine: lineHi } });
    await sleep(800);
    const hi = await profileOf(page);
    const L = (p) => (p.mean[0] + p.mean[1] + p.mean[2]) / 3;
    ok(L(lo) > L(hi) + 4, `${scheme}: ${place}: snow down to ${lineLo} m lightens the ground more than down to ${lineHi} m (mean ${L(lo).toFixed(0)} against ${L(hi).toFixed(0)}; ${pc(lo.white)} against ${pc(hi.white)} near-white)`);
    await set({ S: { snowMode: 'model', surface: 'map' } });
    await settle(page, 60000); await sleep(800);
    const sm = await profileOf(page);
    const sn = await page.evaluate(() => ({ date: window.__norway3d.terrain.snowDate, credit: document.getElementById('snow-credit').textContent, tiles: window.__norway3d.terrain.snowTiles.size }));
    ok(sn.tiles > 0 && /seNorge/.test(sn.credit), `${scheme}: ${place}: seNorge snow depth for ${sn.date} loaded (${sn.tiles} tiles, ${pc(sm.white)} near-white), credited beside the map`);
    await shot(page, `snow-senorge-${place}-${scheme}`);
    await set({ S: { surface: 'map', snowMode: 'model' }, layers: { snow: false, slope: false } });
  }
}

async function sunScene(page, scheme) {
  const N = 'window.__norway3d';
  await page.evaluate(() => { const n = window.__norway3d; n.setMode('3d', false); n.lookAt(8.72, 61.50, 7000, 62, -250); n.setTime(2026, 9, 20, 8 * 60); });
  await settle(page, 120000);
  await sleep(2500);
  await settle(page, 30000);
  const sh = await page.evaluate(() => { const d = window.__norway3d.shade.coreTex.image.data; let z = 0; for (const v of d) if (!v) z++; const n = window.__norway3d; return { dark: z / d.length, st: n.shade.stats, tag: n.shade.tag, cap: document.getElementById('cap').textContent, day: n.day && n.day.total }; });
  ok(sh.dark > 0.02 && sh.dark < 0.98, `${scheme}: cast shadows at 08:00 on 20 Sep cover ${(sh.dark * 100).toFixed(1)} % of the core grid (sweep ${sh.st.sweepMs.toFixed(1)} ms, grids ${sh.st.buildMs.toFixed(0)} ms)`);
  ok(sh.tag === '2026-9-20 480', `${scheme}: the shadows are of the instant shown (${sh.tag})`);
  ok(/^Skyline at the middle of the view: /.test(sh.cap) && sh.day > 0, `${scheme}: the caption reads the skyline (${sh.cap})`);
  await shot(page, `sun-0800-${scheme}`);
  await page.evaluate(() => window.__norway3d.setTime(2026, 9, 20, 17 * 60 + 30));
  await sleep(800);
  await shot(page, `sun-1730-${scheme}`);

  // the scrub, by real touch through CDP: every frame drawn while the finger is down shows the
  // step under it, its label, and the shadows of that same instant
  const cdp = await page.context().newCDPSession(page);
  const tr = await page.evaluate(() => { const r = document.getElementById('slider').getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
  const xOf = (step) => tr.x + 10 + (step / 288) * (tr.w - 20);
  for (const sps of [2, 8, 20]) {
    await page.evaluate(() => window.__norway3d.log(true));
    const from = 84, to = from + Math.round(sps * 3);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xOf(from), y: tr.y }] });
    const t0 = Date.now();
    for (;;) {
      const k = Math.min(1, (Date.now() - t0) / 3000), x = xOf(from + (to - from) * k);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: tr.y }] });
      await sleep(16);
      if (k >= 1) break;
    }
    await sleep(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(300);
    const log = await page.evaluate(() => window.__norway3d.log(false));
    const pressed = log.filter((f) => f.pressed);
    const bad = pressed.filter((f) => f.wanted !== f.shown || f.shadow !== f.instant || !f.label.endsWith(`${String(Math.floor(f.shown * 5 / 60)).padStart(2, '0')}:${String(f.shown * 5 % 60).padStart(2, '0')}`));
    const steps = new Set(pressed.map((f) => f.shown));
    const sweep = pressed.map((f) => f.sweepMs).sort((a, b) => a - b);
    ok(pressed.length > 10 && bad.length === 0, `${scheme}: scrub at ${sps} steps a second: ${pressed.length} frames, every one the step under the finger with its label and its own shadows (${bad.length} differ; ${steps.size} steps drawn; sweep ${sweep[sweep.length >> 1]?.toFixed(1)} ms median, headless)`);
    perf.push({ scheme, scene: `scrub-${sps}`, frames: pressed.length, steps: steps.size, bad: bad.length, sweepMedian: sweep[sweep.length >> 1] });
  }

  // play: the pause mark shows while it plays, the hour advances, Pause stops it
  await page.click('#t-play');
  await sleep(1600);
  const pl = await page.evaluate(() => ({ label: document.getElementById('t-play').getAttribute('aria-label'), pause: getComputedStyle(document.getElementById('ico-pause')).display !== 'none', play: getComputedStyle(document.getElementById('ico-play')).display, t: document.getElementById('t-date').textContent }));
  await page.click('#t-play');
  ok(pl.label === 'Pause' && pl.pause && pl.play === 'none', `${scheme}: while playing, the key is named Pause and shows the pause mark (${pl.t})`);

  // the viewshed from the middle of the plate (the floating names off, so the taps meet the ground:
  // since the names stand on their summits, one stood under these taps)
  await page.evaluate(() => window.__norway3d.setLayer('names', false));
  await page.click('#w-viewshed');
  const mid = await page.evaluate(() => { const r = document.getElementById('plate').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.55 }; });
  await page.touchscreen.tap(mid.x, mid.y);
  await sleep(1500);
  const vs = await page.evaluate(() => ({ kind: document.getElementById('card-kind').textContent, num: document.getElementById('card-num').textContent, ms: window.__norway3d.timings.viewshedMs, on: !document.getElementById('lg-view').hidden }));
  ok(/^Viewshed from/.test(vs.kind) && /\d/.test(vs.num) && vs.on, `${scheme}: the viewshed: ${vs.kind}, ${vs.num} km² seen (${vs.ms.toFixed(0)} ms, headless)`);
  await shot(page, `viewshed-${scheme}`);
  await page.click('#card-close');

  // the profile along two taps
  await page.click('#w-profile');
  await page.touchscreen.tap(mid.x - 90, mid.y + 120);
  await sleep(500);
  await page.touchscreen.tap(mid.x + 70, mid.y - 140);
  await sleep(2500);
  await settle(page, 30000);
  const pr = await page.evaluate(() => ({ kind: document.getElementById('card-kind').textContent, num: document.getElementById('card-num').textContent, unit: document.getElementById('card-unit').textContent, rows: document.getElementById('card-rows').textContent, chart: !document.getElementById('card-chart').hidden }));
  ok(pr.kind === 'Profile' && /\d/.test(pr.num) && pr.chart, `${scheme}: the profile: ${pr.num}${pr.unit}, ${pr.rows}`);
  await shot(page, `profile-${scheme}`);
  await page.click('#card-close');
  ok(await page.evaluate(() => document.getElementById('w-profile').getAttribute('aria-pressed') === 'false'), `${scheme}: closing the profile's card ends the tool`);

  // the marker: a tapped point takes the skyline
  await page.touchscreen.tap(mid.x, mid.y);
  await sleep(2500);
  const mk = await page.evaluate(() => document.getElementById('cap').textContent);
  ok(/^Skyline at the marker/.test(mk) || /at the marker/.test(mk), `${scheme}: a tapped point becomes the skyline's marker (${mk})`);
  await shot(page, `marker-${scheme}`);
  await page.click('#card-close');
  await page.evaluate(() => window.__norway3d.setLayer('names', true));
  await page.evaluate(() => window.__norway3d.setMode('map', false));
  await settle(page, 60000);
  await shot(page, `map-sun-${scheme}`);
}

// ---------------------------------------------------------------- moving stays sharp
// The owner on the phone (1.1): "Is it possible to not reduce the resolution when moving around?"
// A one-finger turn, then a two-finger pan of about 5 km and back over the same ground, by real
// touch at the speed of a hand. Every frame the app draws is sampled in the page: the pixel ratio,
// the share of the ground on screen drawn at the finest detail held for it, the frame's time and
// the caches against their budgets. The sampler reads only what 1.1 already had (terrain.kept, the
// texture and height caches), so the same scene measures the code before the change (NOTES.md).
//
// "Finest detail" for a drawn tile: its own map (not an ancestor's piece), its own heights, and a map
// texel no larger than 1.25 of the phone's physical pixels (the rest choice, at the full pixel ratio)
// unless the tile is already at the deepest level there is. Weighted by the tile's size on screen.
async function installMonitor(page) {
  await page.evaluate(() => {
    const n = window.__norway3d, gl = document.getElementById('gl');
    const hsrc = (z, x, y) => { if (z <= 12) return ['T', z, x, y]; const hz = Math.min(15, z - 1), k = z - hz; return ['D', Math.max(12, hz), x >> k, y >> k]; };
    const full = Math.min(2, window.devicePixelRatio || 1);
    const M = window.__mon = { frames: [], phase: 'idle', bestMap: new Map(), bestH: new Map(), down: { held: 0, evicted: 0, frames: 0, examples: [] }, lastNo: -1, on: true };
    const hLevel = (z, x, y) => {
      const [k, hz, hx, hy] = hsrc(z, x, y), H = n.heights;
      if (H.get(k, hz, hx, hy)) return { lvl: (k === 'D' ? 100 : 0) + hz, exact: true, want: (k === 'D' ? 100 : 0) + hz };
      if (k === 'D') for (let j = 1; hz - j >= 12; j++) if (H.get('D', hz - j, hx >> j, hy >> j)) return { lvl: 100 + hz - j, exact: false, want: 100 + hz };
      const tz = Math.min(z, 12);
      for (let j = z - tz; j <= z; j++) if (H.get('T', z - j, x >> j, y >> j)) return { lvl: z - j, exact: false, want: (k === 'D' ? 100 : 0) + hz };
      return { lvl: -1, exact: false, want: (k === 'D' ? 100 : 0) + hz };
    };
    const heldH = (k, lvl) => { const kind = lvl >= 100 ? 'D' : 'T', z = lvl % 100, j = k.z - z; return j >= 0 && !!n.heights.get(kind, z, k.x >> j, k.y >> j); };
    const sample = () => {
      const t = n.terrain;
      if (!M.on) return;
      if (t.frameNo !== M.lastNo && t.kept) {
        M.lastNo = t.frameNo;
        const pr = gl.width / Math.max(1, gl.clientWidth), st = t.style, c0 = n.frame.c0;
        let wAll = 0, wSharp = 0, wMap = 0, wH = 0, down = 0;
        for (const k of t.kept) {
          let mz = -1;
          for (let j = 0; j <= k.z; j++) if (t.tex.has(`m${st}${k.z - j}/${k.x >> j}/${k.y >> j}`)) { mz = k.z - j; break; }
          const h = n.S.surface === 'map' && n.rig.mode === 'map' && !n.terrain.wantHeights ? { lvl: 0, exact: true } : hLevel(k.z, k.x, k.y);
          const w = ((k.b.s * c0) / Math.max(1, k.dist)) ** 2;
          const errSrc = k.err * (full / pr) * 2 ** Math.max(0, k.z - mz);
          const mapOk = mz === k.z && (errSrc <= 1.2501 || k.z >= k.maxZ);
          wAll += w; if (mz === k.z) wMap += w; if (h.exact) wH += w; if (mapOk && h.exact) wSharp += w;
          if (M.phase === 'back') {
            const bm = M.bestMap.get(k.key), bh = M.bestH.get(k.key);
            if ((bm != null && mz < bm) || (bh != null && h.lvl < bh)) {
              down++;
              // is the finer one still held (a fall-back that need not have happened) or evicted?
              const held = (bm != null && mz < bm && t.tex.has(`m${st}${bm}/${k.x >> (k.z - bm)}/${k.y >> (k.z - bm)}`)) || (bh != null && h.lvl < bh && heldH(k, bh));
              if (held) M.down.held++; else M.down.evicted++;
              if (M.down.examples.length < 6) M.down.examples.push(`${k.z}/${k.x}/${k.y} map ${mz}<${bm} h ${h.lvl}<${bh}`);
            }
          }
          if (mz >= 0) M.bestMap.set(k.key, Math.max(M.bestMap.get(k.key) ?? -1, mz));
          if (h.lvl >= 0) M.bestH.set(k.key, Math.max(M.bestH.get(k.key) ?? -1, h.lvl));
        }
        if (down) M.down.frames++;
        const c = n.rig;
        M.frames.push({ t: performance.now(), phase: M.phase, pr, sharp: wAll ? wSharp / wAll : 0, mapOwn: wAll ? wMap / wAll : 0, hOwn: wAll ? wH / wAll : 0, drawn: t.kept.length, frameMs: n.timings.frameMs, selectMs: n.timings.selectMs,
          gpuMB: t.stats.gpuMB, hMB: n.heights.bytes / 1048576, inflight: n.loader.inflight, liveMB: t.stats.liveMB ?? null, aheadMB: t.stats.aheadMB ?? 0, hLive: n.heights.stats.liveMB ?? 0, hAhead: n.heights.stats.aheadMB ?? 0, ahead: t.stats.ahead ?? 0, moving: c.active || c.coasting, down });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pctl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
function summarize(frames) {
  const f = frames.filter((x) => x.moving);
  const iv = []; for (let i = 1; i < f.length; i++) { const d = f[i].t - f[i - 1].t; if (d < 500) iv.push(d); }
  return {
    frames: f.length, prMin: Math.min(...f.map((x) => x.pr)), prMax: Math.max(...f.map((x) => x.pr)),
    sharpMean: f.reduce((a, x) => a + x.sharp, 0) / Math.max(1, f.length), sharpMedian: median(f.map((x) => x.sharp)), sharpP10: pctl(f.map((x) => x.sharp), 0.1),
    mapOwnMean: f.reduce((a, x) => a + x.mapOwn, 0) / Math.max(1, f.length), hOwnMean: f.reduce((a, x) => a + x.hOwn, 0) / Math.max(1, f.length),
    frameMsMedian: median(f.map((x) => x.frameMs)), frameMsP90: pctl(f.map((x) => x.frameMs), 0.9), intervalMedian: median(iv), intervalP90: pctl(iv, 0.9),
    gpuMBMax: Math.max(...frames.map((x) => x.gpuMB)), hMBMax: Math.max(...frames.map((x) => x.hMB)), inflightMax: Math.max(...frames.map((x) => x.inflight)), drawnMax: Math.max(...f.map((x) => x.drawn)), liveMBMax: Math.max(...frames.map((x) => x.liveMB || 0)), aheadMBMax: Math.max(...frames.map((x) => x.aheadMB || 0)), hLiveMax: Math.max(...frames.map((x) => x.hLive || 0)), hAheadMax: Math.max(...frames.map((x) => x.hAhead || 0)), aheadMean: f.reduce((a, x) => a + x.ahead, 0) / Math.max(1, f.length),
  };
}
const fmtSum = (s) => `${s.frames} frames, pixel ratio ${s.prMin}–${s.prMax}, finest detail ${pc(s.sharpMean)} mean (${pc(s.sharpMedian)} median, ${pc(s.sharpP10)} p10; own map ${pc(s.mapOwnMean)}, own heights ${pc(s.hOwnMean)}), frame CPU ${s.frameMsMedian.toFixed(1)} ms median / ${s.frameMsP90.toFixed(1)} p90, frame interval ${s.intervalMedian.toFixed(0)} / ${s.intervalP90.toFixed(0)} ms, textures ≤ ${s.gpuMBMax.toFixed(1)} MB${s.liveMBMax ? ` (drawn ≤ ${s.liveMBMax.toFixed(1)}, ahead ≤ ${s.aheadMBMax.toFixed(1)} MB)` : ""}, heights ≤ ${s.hMBMax.toFixed(1)} MB${s.hLiveMax ? ` (drawn ≤ ${s.hLiveMax.toFixed(1)}, ahead ≤ ${s.hAheadMax.toFixed(1)} MB)` : ""}, ≤ ${s.inflightMax} in flight${s.aheadMean ? `, ${s.aheadMean.toFixed(0)} tiles ahead a frame` : ""}`;

async function motionScene(page, scheme) {
  const cdp = await page.context().newCDPSession(page);
  const cam = () => page.evaluate(() => window.__norway3d.cam());
  const plate = await page.evaluate(() => { const r = document.getElementById('plate').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; });
  const { x, y } = plate;
  const newCode = await page.evaluate(() => 'saveBattery' in window.__norway3d);
  await page.evaluate(() => { const n = window.__norway3d; n.setLayer('names', false); n.setMode('3d', false); n.lookAt(8.72, 61.50, 7000, 62, -250); if ('saveBattery' in n) n.saveBattery = false; });
  await settle(page, 120000); await sleep(800); await settle(page, 30000);
  await installMonitor(page);
  const phase = (p) => page.evaluate((p) => { window.__mon.phase = p; }, p);
  const start = await cam();
  // a hand's turn: 300 px in a second, then a flick back of the same in half a second, coasting out
  await phase('turn');
  const tt0 = Date.now(), h0 = start.heading;
  await touchPath(cdp, [[x - 150, y + 40]], [[x + 150, y + 40]], 1000, 120);
  await touchPath(cdp, [[x + 150, y + 40]], [[x - 150, y + 40]], 500, 0);
  await sleep(1200);
  const turnS = (Date.now() - tt0) / 1000, c1 = await cam();
  await phase('out');
  const pt0 = Date.now();
  // the pan: two fingers in the lower half of the picture, where the ground is near, a quarter of its
  // height in 0.45 s, each thrown (it coasts), until the middle has gone 5 km; then the same strokes
  // back over the ground just seen
  let strokes = 0, from = await cam();
  const lo = Math.round(y + plate.h * 0.36), hi = Math.round(y + plate.h * 0.1);
  while (gap(from, await cam()) < 5000 && strokes < 40) {
    await touchPath(cdp, [[x - 45, lo], [x + 45, lo]], [[x - 45, hi], [x + 45, hi]], 450, 0);
    strokes++; await sleep(250);
  }
  await sleep(600);
  const far = await cam(), outS = (Date.now() - pt0) / 1000, outKm = gap(from, far) / 1000;
  await phase('back');
  const bt0 = Date.now();
  // the same strokes the other way, until the middle is back where it began (or stops getting closer)
  let back = 0, prev = gap(from, await cam());
  while (prev > 300 && back < strokes + 6) {
    await touchPath(cdp, [[x - 45, hi], [x + 45, hi]], [[x - 45, lo], [x + 45, lo]], 450, 0);
    back++; await sleep(250);
    const g = gap(from, await cam());
    if (g > prev) break;
    prev = g;
  }
  await sleep(600);
  const end = await cam(), backS = (Date.now() - bt0) / 1000;
  await phase('rest');
  await settle(page, 60000); await sleep(400);
  const M = await page.evaluate(() => { const M = window.__mon; M.on = false; return { frames: M.frames, down: M.down }; });
  const all = summarize(M.frames.filter((f) => f.phase !== 'rest' && f.phase !== 'idle'));
  const turn = summarize(M.frames.filter((f) => f.phase === 'turn'));
  const out = summarize(M.frames.filter((f) => f.phase === 'out'));
  const bk = summarize(M.frames.filter((f) => f.phase === 'back'));
  const rest = M.frames.filter((f) => f.phase === 'rest');
  const restLast = rest[rest.length - 1] || {};
  console.log(`     motion (${newCode ? 'this code' : 'the code before'}): turn 300 px (107°) each way, ${Math.abs(turned(h0, c1.heading)).toFixed(0)}° net, in ${turnS.toFixed(1)} s; pan ${outKm.toFixed(1)} km in ${strokes} strokes, ${outS.toFixed(1)} s (${(outKm * 1000 / outS).toFixed(0)} m of ground a second); back in ${back} strokes, ${backS.toFixed(1)} s, ended ${gap(from, end).toFixed(0)} m from the start`);
  console.log(`     turn: ${fmtSum(turn)}`);
  console.log(`     pan out: ${fmtSum(out)}`);
  console.log(`     pan back: ${fmtSum(bk)}`);
  console.log(`     at rest after: pixel ratio ${restLast.pr}, finest detail ${pc(restLast.sharp || 0)}, ${restLast.drawn} tiles, textures ${restLast.gpuMB?.toFixed(1)} MB, heights ${restLast.hMB?.toFixed(1)} MB`);
  console.log(`     pan back over seen ground: ${M.down.held + M.down.evicted} tile-frames coarser than already shown (${M.down.held} with the finer still held, ${M.down.evicted} evicted), in ${M.down.frames} frames${M.down.examples.length ? `: ${M.down.examples.join('; ')}` : ''}`);
  perf.push({ scheme, scene: `motion-${newCode ? 'after' : 'before'}`, all, turn, out, back: bk, rest: restLast, down: M.down, pan: { km: outKm, s: outS, strokes, backS, endOffM: gap(from, end) }, turnS });
  fs.writeFileSync(path.join(OUT, `motion-${newCode ? 'after' : 'before'}.json`), JSON.stringify(M.frames));

  if (newCode) {
    const B = await page.evaluate(() => ({ gpu: window.__norway3d.budgets.gpuMB, h: window.__norway3d.budgets.heightsMB, lanes: window.__norway3d.budgets.inflight }));
    const full = await page.evaluate(() => Math.min(2, window.devicePixelRatio || 1));
    ok(all.frames > 40 && all.prMin === full && all.prMax === full, `${scheme}: moving (turn, flick, pan and pan back, ${all.frames} frames) draws at the full pixel ratio throughout: ${all.prMin} to ${all.prMax}, the phone's ${full}`);
    ok(M.down.held + M.down.evicted === 0, `${scheme}: panning back over ground already seen never draws a tile coarser than it was drawn before (${M.down.held} with the finer held, ${M.down.evicted} evicted${M.down.examples.length ? `: ${M.down.examples.join('; ')}` : ''})`);
    ok(all.gpuMBMax <= B.gpu + 0.01 && all.hMBMax <= B.h + 0.01, `${scheme}: while moving the caches stay in their budgets: textures ≤ ${all.gpuMBMax.toFixed(1)} of ${B.gpu} MB, heights ≤ ${all.hMBMax.toFixed(1)} of ${B.h} MB`);
    const L = await page.evaluate(() => { const s = window.__norway3d.loader.stats; return { peak: s.peakInflight, pfPeak: s.peakPrefetch || 0, pf: s.prefetchStarted || 0 }; });
    ok(all.inflightMax <= B.lanes && L.peak <= B.lanes && L.pfPeak <= B.lanes - 2 && L.pf > 0, `${scheme}: at most ${B.lanes} requests in flight (peak ${L.peak}); tiles ahead of the view loaded (${L.pf} requests), never more than ${B.lanes - 2} of them at once (peak ${L.pfPeak}), two lanes kept for the view`);
    ok(out.sharpMean >= 0.5 * (restLast.sharp || 1) || out.mapOwnMean > 0.8, `${scheme}: while panning ${pc(out.sharpMean)} of the ground on screen is at its finest detail (${pc(restLast.sharp || 0)} at rest)`);

    const E = await page.evaluate(() => ({ t: window.__norway3d.terrain.stats.evictedNear, h: window.__norway3d.heights.stats.evictedNear, te: window.__norway3d.terrain.stats.evicted, he: window.__norway3d.heights.stats.evicted }));
    ok(E.t === 0 && E.h === 0, `${scheme}: nothing in or around the view was evicted (textures ${E.t}, heights ${E.h}; ${E.te} textures and ${E.he} height tiles from elsewhere)`);
    // what drawing the moving frames at the full pixel ratio costs here: the same view at 1 and at 2
    const b1 = await page.evaluate((f) => window.__norway3d.bench(20, 1), full), b2 = await page.evaluate((f) => window.__norway3d.bench(20, f), full);
    console.log(`     one frame of this view, waited out on the GPU: ${b1.median.toFixed(1)} ms at pixel ratio 1, ${b2.median.toFixed(1)} ms at ${full} (SwiftShader on the build Mac, not a phone)`);
    perf[perf.length - 1].bench = { pr1: b1, full: b2 };

    // Save battery on: the old way back, the lower resolution while moving and full at rest
    await page.evaluate(() => { window.__norway3d.saveBattery = true; });
    await touchDrag(cdp, page, [[x - 100, y]], [[x + 100, y]], { steps: 20, rest: 0 });
    const during = await page.evaluate(() => window.__norway3d.stats().pixelRatio);
    await sleep(1500); await settle(page, 30000);
    const after = await page.evaluate(() => window.__norway3d.stats().pixelRatio);
    const stored = await page.evaluate(() => localStorage.getItem('norway3d:saveBattery'));
    ok(during < full && after === full && stored === 'true', `${scheme}: Save battery on brings the old way back: pixel ratio ${during} while moving, ${after} at rest (the setting kept: ${stored})`);
    await page.evaluate(() => { window.__norway3d.saveBattery = false; });
    ok(await page.evaluate(() => localStorage.getItem('norway3d:saveBattery')) === 'false', `${scheme}: Save battery is off again (the default)`);
  }
  await page.evaluate(() => { const n = window.__norway3d; n.setLayer('names', true); n.setMode('map', false); });
  await settle(page, 30000);
}

// ---------------------------------------------------------------- the hands
// Real touch through CDP (pointer events, as on the phone): one finger turns and tilts in 3D about
// the ground in the middle, a pinch zooms toward the fingers, two fingers carry the land, a flick
// coasts, a double tap flies; the eye never goes under the ground; and the 2D/3D switch keeps the
// place, the card and the layers.
const M_LAT = 111132, M_LON = (lat) => 111320 * Math.cos(lat * Math.PI / 180);
const gap = (a, b) => Math.hypot((a.lon - b.lon) * M_LON(a.lat), (a.lat - b.lat) * M_LAT);
const turned = (a, b) => ((b - a + 540) % 360) - 180;

async function touchDrag(cdp, page, from, to, { steps = 20, rest = 150, every = 0, watch = null } = {}) {
  const at = (f) => from.map((p, i) => ({ x: p[0] + (to[i][0] - p[0]) * f, y: p[1] + (to[i][1] - p[1]) * f, id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  for (let k = 1; k <= steps; k++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(k / steps) });
    await sleep(16);
    if (watch && every && k % every === 0) watch(await page.evaluate(() => window.__norway3d.cam()));
  }
  if (rest) await sleep(rest);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** A touch path driven by the clock, not by a count of events: the fingers are where `ms` of travel
 *  puts them however long each event takes to be handled, so a hand's speed is the same at any frame
 *  rate (the motion scene compares code whose frames take 25 ms here with code whose take 130). */
async function touchPath(cdp, from, to, ms, rest = 0) {
  const at = (f) => from.map((p, i) => ({ x: p[0] + (to[i][0] - p[0]) * f, y: p[1] + (to[i][1] - p[1]) * f, id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  const t0 = Date.now();
  for (;;) {
    const f = Math.min(1, (Date.now() - t0) / ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(f) });
    if (f >= 1) break;
    await sleep(8);
  }
  if (rest) await sleep(rest);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function handsScene(page, scheme) {
  const cdp = await page.context().newCDPSession(page);
  const cam = () => page.evaluate(() => window.__norway3d.cam());
  const plate = await page.evaluate(() => { const r = document.getElementById('plate').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
  const { x, y } = plate;
  let low = Infinity;
  const watch = (c) => { low = Math.min(low, c.clearance); };
  const clear = (c) => watch(c) || c.clearance;
  // the names off, so a touch meets the ground rather than a name's own tap
  await page.evaluate(() => { const n = window.__norway3d; n.setLayer('names', false); n.setMode('3d', false); n.lookAt(8.72, 61.50, 7000, 62, -250); });
  await settle(page, 120000); await sleep(800); await settle(page, 30000);

  // one finger sideways: the view turns about its pivot, 0.0062 rad a pixel; the tilt and the
  // distance stay; no fling after a finger that rests before it lifts
  let c0 = await cam();
  await touchDrag(cdp, page, [[x - 60, y]], [[x + 60, y]], { every: 4, watch });
  await sleep(400);
  let c1 = await cam();
  const dh = turned(c0.heading, c1.heading);
  // the pivot is the ground in the middle of the view (found again when the finger starts: where the
  // line of sight first meets the ground, which may be a ridge in front of the old pivot)
  const mid1 = await page.evaluate(([px, py]) => window.__norway3d.pickAt(px, py), [x, y]);
  ok(dh > 36 && dh < 49 && Math.abs(c1.phi - c0.phi) < 1 && mid1 && gap(mid1, c1) < c1.dist * 0.01 && !c1.coasting,
    `${scheme}: one finger dragged 120 px sideways turns the 3D view ${dh.toFixed(1)}° (expected 42.6°) about the ground in the middle (${gap(mid1, c1).toFixed(1)} m from the pivot); tilt ${c0.phi.toFixed(1)}° to ${c1.phi.toFixed(1)}°, the pivot ${c1.dist.toFixed(0)} m away`);
  ok(Math.abs(c1.pivotOff) < 1, `${scheme}: the pivot is on the ground after the turn (${c1.pivotOff.toFixed(2)} m off)`);

  // one finger up: tilts toward the horizon, never past 76 degrees
  c0 = c1;
  await touchDrag(cdp, page, [[x, y + 20]], [[x, y - 10]], { steps: 10 });
  await sleep(300);
  c1 = await cam();
  ok(c1.phi > c0.phi + 7 && c1.phi < c0.phi + 14, `${scheme}: one finger dragged 30 px up tilts the view from ${c0.phi.toFixed(1)}° to ${c1.phi.toFixed(1)}° (expected +10.7°)`);
  await touchDrag(cdp, page, [[x, y + 150]], [[x, y - 250]], { every: 4, watch });
  await sleep(300);
  c1 = await cam();
  ok(c1.phi <= 76.001 && c1.phi > 70, `${scheme}: a long drag up stops the tilt at ${c1.phi.toFixed(2)}° (the limit is 76° within 30 km), the horizon kept in the upper part of the view`);
  await touchDrag(cdp, page, [[x, y - 100]], [[x, y + 30]], { steps: 12 });   // back to a working tilt
  await sleep(300);
  await settle(page, 30000);

  // a pinch about a point off the middle: the ground under the fingers stays under them
  const pm = { x: x + 50, y: y + 70 };
  const g0 = await page.evaluate(([px, py]) => window.__norway3d.pickAt(px, py), [pm.x, pm.y]);
  c0 = await cam();
  await touchDrag(cdp, page, [[pm.x - 40, pm.y], [pm.x + 40, pm.y]], [[pm.x - 120, pm.y], [pm.x + 120, pm.y]], { every: 4, watch });
  await sleep(300);
  c1 = await cam();
  const p1 = await page.evaluate(([lon, lat]) => window.__norway3d.project(lon, lat), [g0.lon, g0.lat]);
  const off = Math.hypot(p1.x - pm.x, p1.y - pm.y), k = c1.dist / c0.dist;
  ok(off < 14 && k > 0.22 && k < 0.5, `${scheme}: a pinch from 80 to 240 px zooms toward the fingers: the distance ${c0.dist.toFixed(0)} to ${c1.dist.toFixed(0)} m (×${k.toFixed(2)}), the ground under them still ${off.toFixed(1)} px from them`);
  await settle(page, 30000);

  // two fingers dragged together: the land moves with them
  const pa = { x: x - 20, y: y + 90 }, pb = { x: x - 20, y: y - 40 };
  const g1 = await page.evaluate(([px, py]) => window.__norway3d.pickAt(px, py), [pa.x, pa.y]);
  c0 = await cam();
  await touchDrag(cdp, page, [[pa.x - 45, pa.y], [pa.x + 45, pa.y]], [[pb.x - 45, pb.y], [pb.x + 45, pb.y]], { every: 4, watch });
  await sleep(300);
  c1 = await cam();
  const p2 = await page.evaluate(([lon, lat]) => window.__norway3d.project(lon, lat), [g1.lon, g1.lat]);
  const off2 = Math.hypot(p2.x - pb.x, p2.y - pb.y);
  ok(gap(c0, c1) > 200 && off2 < 18 && Math.abs(turned(c0.heading, c1.heading)) < 1, `${scheme}: two fingers dragged 130 px carry the land: the pivot moved ${gap(c0, c1).toFixed(0)} m, the ground first under them ended ${off2.toFixed(1)} px from them, the heading kept`);

  // a flick coasts and eases out
  c0 = await cam();
  await touchDrag(cdp, page, [[x - 80, y]], [[x + 80, y]], { steps: 5, rest: 0 });
  const r0 = await cam();
  await sleep(700);
  const r1 = await cam();
  await sleep(1500);
  const r2 = await cam();
  ok(Math.abs(turned(r0.heading, r1.heading)) > 3 && !r2.coasting && Math.abs(turned(r1.heading, r2.heading)) < Math.abs(turned(r0.heading, r1.heading)),
    `${scheme}: a flick keeps turning after the finger lifts (${turned(r0.heading, r1.heading).toFixed(1)}° in the next 0.7 s, ${turned(r1.heading, r2.heading).toFixed(1)}° after) and stops`);
  await settle(page, 30000);

  // a double tap in 3D flies to the place tapped, which becomes the middle, at half the distance
  const pt = { x: x + 40, y: y + 60 };
  const g2 = await page.evaluate(([px, py]) => window.__norway3d.pickAt(px, py), [pt.x, pt.y]);
  c0 = await cam();
  await page.touchscreen.tap(pt.x, pt.y); await sleep(90); await page.touchscreen.tap(pt.x, pt.y);
  await sleep(1100);
  c1 = await cam();
  ok(gap(c1, g2) < Math.max(25, c0.dist * 0.01) && c1.dist < c0.dist * 0.7, `${scheme}: a double tap flies to the place tapped: it is the new middle (${gap(c1, g2).toFixed(1)} m off), the distance ${c0.dist.toFixed(0)} to ${c1.dist.toFixed(0)} m`);
  ok(await page.evaluate(() => document.getElementById('card').hidden), `${scheme}: a double tap opens no card`);

  // low over steep ground: Galdhøpiggen's west face, pinched in, tilted to the horizon and turned
  await page.evaluate(() => window.__norway3d.lookAt(8.296, 61.636, 700, 70, -90));
  await settle(page, 60000); await sleep(600); await settle(page, 30000);
  clear(await cam());
  for (let i = 0; i < 3; i++) {
    await touchDrag(cdp, page, [[x - 30, y], [x + 30, y]], [[x - 150, y], [x + 150, y]], { every: 2, watch });
    await sleep(200);
  }
  await touchDrag(cdp, page, [[x, y + 150]], [[x, y - 200]], { every: 2, watch });
  await touchDrag(cdp, page, [[x - 140, y]], [[x + 140, y]], { every: 2, watch, steps: 30 });
  await touchDrag(cdp, page, [[x, y + 60], [x + 80, y + 60]], [[x, y - 160], [x + 80, y - 160]], { every: 2, watch });
  await sleep(400);
  const cl = await cam();
  clear(cl);
  await shot(page, `hands-low-${scheme}`);
  ok(low >= 39, `${scheme}: low over Galdhøpiggen's face (pinched to ${cl.dist.toFixed(0)} m, tilted to ${cl.phi.toFixed(1)}°), the eye never came closer than ${low.toFixed(0)} m to the ground within 80 m of it (40 m kept; ${cl.stats.lifts} lifts)`);

  // the owner's phone (2026-10-16): Galdhøpiggen's name read 2 242 m and its dot stood in the col.
  // Its name prints OpenStreetMap's 2 469 m, and its dot stands on the summit: the ground under the
  // dot's pixel within 20 m of the summit, the terrain there within 5 m of 2 469 m.
  {
    const SUM = { lon: 8.31244, lat: 61.63647 };
    await page.evaluate(() => { const n = window.__norway3d; n.setLayer('names', true); n.S.surface = 'elevation'; n.applySurface(); n.lookAt(8.335, 61.625, 3200, 64, -300); });
    await settle(page, 90000); await sleep(1200); await settle(page, 30000);
    const L = await page.evaluate(() => {
      const n = window.__norway3d, it = n.labels.items.find((i) => i.p.n === 'Galdhøpiggen'), e = n.labels.pool.find((x) => x.used && x.b._it === it && !x.b.hidden);
      return { shown: !!e, text: e ? e.s.textContent : '', at: it.at, h: n.heights.heightAt(it.X, it.Y), src: n.heights.sourceAt(it.X, it.Y) };
    });
    // a ray aimed exactly at a summit only grazes it, so the dot is compared with the drawn ground's
    // own summit point projected, and with the ground just below the dot (into the face toward us)
    const top = await page.evaluate(([lon, lat]) => window.__norway3d.project(lon, lat), [SUM.lon, SUM.lat]);
    const under = L.at && await page.evaluate(([px, py]) => window.__norway3d.pickAt(px, py), [L.at.x, L.at.y + 1]);
    const px = L.at && top ? Math.hypot(L.at.x - top.x, L.at.y - top.y) : Infinity;
    // meters a pixel at the view's distance (the summit is near the middle), so the gap reads as meters
    const mpp = await page.evaluate(() => 2 * window.__norway3d.cam().dist * Math.tan(21 * Math.PI / 180) / document.getElementById('gl').clientHeight);
    await shot(page, `label-galdhopiggen-${scheme}`);
    ok(L.shown && /^2 469 m$/.test(L.text), `${scheme}: Galdhøpiggen's name reads OpenStreetMap's height (${JSON.stringify(L.text)})`);
    ok(px * mpp < 20 && Math.abs(L.h - 2469) < 5, `${scheme}: Galdhøpiggen's dot stands on the summit: ${px.toFixed(2)} px (${(px * mpp).toFixed(1)} m) from the drawn summit, the ground 1 px under the dot ${under ? gap(under, SUM).toFixed(1) : '?'} m from it, the terrain there ${L.h != null ? L.h.toFixed(1) : '?'} m (${L.src && L.src.model === 1 ? 'the 1 m model' : 'the 10 m model'})`);
    await page.evaluate(() => { const n = window.__norway3d; n.setLayer('names', false); n.S.surface = 'map'; n.applySurface(); });
  }

  // the page itself never scrolls under the hands
  ok(await page.evaluate(() => document.scrollingElement.scrollTop === 0 && document.scrollingElement.scrollLeft === 0 && getComputedStyle(document.getElementById('gl')).touchAction === 'none'), `${scheme}: the page does not scroll under the gestures (the plate's touch-action is none)`);

  // the switch: 2D, a place and a tapped point; to 3D and back by the keys, the middle and the
  // scale kept, the card and the marker kept, the surface and the layers kept
  await page.click('#view-2d');
  await sleep(700);
  await page.evaluate(() => { const n = window.__norway3d; n.lookAt(7.75, 62.45, 16000); n.S.surface = 'relief'; n.applySurface(); n.setLayer('slope', true); });
  await settle(page, 60000);
  const a = await cam();
  await page.touchscreen.tap(x + 30, y - 40);
  await sleep(800);
  const mk = await page.evaluate(() => ({ card: !document.getElementById('card').hidden && document.getElementById('card-kind').textContent, marker: window.__norway3d.S.marker && { ...window.__norway3d.S.marker } }));
  await page.click('#view-3d');
  await sleep(800);
  const b = await cam();
  const s3 = await page.evaluate(() => ({ card: !document.getElementById('card').hidden && document.getElementById('card-kind').textContent, marker: window.__norway3d.S.marker && { ...window.__norway3d.S.marker }, surface: window.__norway3d.S.surface, slope: window.__norway3d.S.layers.slope, key: !document.getElementById('key-slope').hidden, checked: document.getElementById('view-3d').getAttribute('aria-checked') }));
  ok(b.mode === '3d' && Math.abs(b.phi - 52) < 0.5 && gap(a, b) < 25 && Math.abs(b.dist / a.dist - 1) < 0.01 && s3.checked === 'true',
    `${scheme}: 2D to 3D by the key: the middle kept (${gap(a, b).toFixed(1)} m), the distance kept (${a.dist.toFixed(0)} to ${b.dist.toFixed(0)} m), tilted to ${b.phi.toFixed(1)}°`);
  ok(mk.card === 'Tapped point' && s3.card === mk.card && s3.marker && s3.marker.X === mk.marker.X && s3.marker.Y === mk.marker.Y && s3.surface === 'relief' && s3.slope && s3.key,
    `${scheme}: the tapped point's card, the marker, the relief surface and steepness survive the switch to 3D`);
  await shot(page, `switch-3d-${scheme}`);
  await page.click('#view-2d');
  await sleep(800);
  const c = await cam();
  const s2 = await page.evaluate(() => ({ card: !document.getElementById('card').hidden, surface: window.__norway3d.S.surface, slope: window.__norway3d.S.layers.slope }));
  ok(c.mode === 'map' && c.phi < 0.01 && Math.abs(c.heading) < 0.01 && gap(a, c) < 25 && Math.abs(c.dist / a.dist - 1) < 0.01 && s2.card && s2.surface === 'relief' && s2.slope,
    `${scheme}: back to 2D: north up, the middle ${gap(a, c).toFixed(1)} m from where it started, the distance ${c.dist.toFixed(0)} m, the card and the layers kept`);
  await page.click('#card-close');

  // a viewshed made in 2D stays through the switch
  await page.click('#w-viewshed');
  await page.touchscreen.tap(x, y + 30);
  await sleep(1200);
  await page.click('#view-3d');
  await sleep(800);
  const vs = await page.evaluate(() => ({ kind: document.getElementById('card-kind').textContent, key: !document.getElementById('lg-view').hidden, on: !!window.__norway3d.vs }));
  ok(/^Viewshed from/.test(vs.kind) && vs.key && vs.on, `${scheme}: a viewshed made on the map stays, card and key, in 3D (${vs.kind})`);
  await shot(page, `switch-viewshed-3d-${scheme}`);
  await page.click('#card-close');   // closing the viewshed's card ends the tool too
  await page.evaluate(() => { const n = window.__norway3d; n.S.surface = 'map'; n.applySurface(); n.setLayer('slope', false); n.setLayer('names', true); n.setMode('map', false); });
  await settle(page, 30000);
}

/** Under Reduce Motion the switch is a cut and a flick does not coast. */
async function reducedHands() {
  const { ctx, page, log } = await newPage('light', { reducedMotion: 'reduce' });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__norway3d, null, { timeout: 30000 });
  await settle(page, 60000);
  const cdp = await ctx.newCDPSession(page);
  const r = await page.evaluate(() => { const b = document.getElementById('plate').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
  await page.evaluate(() => window.__norway3d.setLayer('names', false));
  await touchDrag(cdp, page, [[r.x - 80, r.y]], [[r.x + 80, r.y]], { steps: 5, rest: 0 });
  const a = await page.evaluate(() => window.__norway3d.cam());
  await sleep(500);
  const b = await page.evaluate(() => window.__norway3d.cam());
  ok(Math.abs(turned(a.heading, b.heading)) < 0.01 && !b.coasting, `Reduce Motion: a flick stops when the finger lifts (${turned(a.heading, b.heading).toFixed(3)}° after)`);
  await page.click('#view-2d');
  await sleep(60);
  const c = await page.evaluate(() => window.__norway3d.cam());
  ok(c.mode === 'map' && c.flat === 1 && c.phi === 0, `Reduce Motion: the switch to 2D is a cut (flat ${c.flat}, tilt ${c.phi}° 60 ms after the tap)`);
  endPage(log, 'Reduce Motion');
  await ctx.close();
}

/** SI in every visible text node (HOUSE.md 6.1): no hyphen-minus before a digit, a narrow no-break
 *  space between a number and its unit, thousands grouped. */
async function checkText(page, label) {
  const bad = await page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const e = n.parentElement;
      if (!e || e.closest('[hidden], .sr, script, style') || !e.getClientRects().length) continue;
      const t = n.textContent;
      if (/(^|[\s(])-\d/.test(t)) out.push(`hyphen-minus: ${t}`);
      if (/\d (m|km|km²|h|min|%)(\b|$)/.test(t)) out.push(`plain space before a unit: ${t}`);
      if (/\b\d{5,}\b/.test(t)) out.push(`ungrouped: ${t}`);
    }
    return out;
  });
  ok(bad.length === 0, `${label}: SI in every visible text node${bad.length ? `: ${bad.slice(0, 3).join(' | ')}` : ''}`);
}
/** Every visible control at least 44 x 44 px, counting a key's drawn hit (its ::before). */
async function hitTargets(page, label) {
  const small = await page.evaluate(() => [...document.querySelectorAll('button, [role="slider"], a[href], input')].filter((e) => {
    if (e.closest('[hidden]') || e.closest('[inert]')) return false;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const b = getComputedStyle(e, '::before');
    let w = r.width, h = r.height;
    if (b.content !== 'none' && b.position === 'absolute') {
      const t = parseFloat(b.top) || 0, bo = parseFloat(b.bottom) || 0, l = parseFloat(b.left) || 0, ri = parseFloat(b.right) || 0;
      w = Math.max(w, r.width - l - ri); h = Math.max(h, r.height - t - bo);
    }
    return w < 43.5 || h < 43.5;
  }).map((e) => `${e.id || e.className || e.tagName} ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
  ok(small.length === 0, `${label}: every control is 44 x 44 px or more${small.length ? `: ${small.join(', ')}` : ''}`);
}

for (const scheme of schemes) {
  const { ctx, page, log } = await newPage(scheme);
  const t0 = Date.now();
  await page.goto(BASE);
  await page.waitForFunction(() => window.__norway3d, null, { timeout: 30000 });
  const ms = await settle(page);
  ok(ms >= 0, `${scheme}: the first view settles (${ms} ms after the hook, ${Date.now() - t0} ms after navigation)`);
  const s = await stats(page);
  perf.push({ scheme, scene: 'boot', settleMs: ms, ...s });
  ok(s.cover.map === 1, `${scheme}: every drawn tile has its own map (${(s.cover.map * 100).toFixed(0)} %)`);
  if (want('map')) { await shot(page, `map-${scheme}`); await drapeCheck(page, `${scheme}: the map`); }
  ok(await page.evaluate(() => document.fonts.check('560 11.5px "Ysabeau Office"')), `${scheme}: the house face is loaded`);
  for (const id of ['key-trails', 'key-cabins']) {
    const fit = await page.evaluate((id) => { const e = document.getElementById(id); return e.hidden || e.scrollWidth <= e.clientWidth + 1; }, id);
    ok(fit, `${scheme}: #${id} fits its row at 390 px`);
  }
  await checkText(page, scheme);

  // a cabin: Gjendebu (staffed, DNT) by name
  if (want('cabin')) {
    const i = await page.evaluate(() => window.__norway3d.cabins.items.findIndex((c) => c.p.n === 'Gjendebu'));
    ok(i >= 0, `${scheme}: Gjendebu is in the cabins`);
    await page.evaluate((i) => { const c = window.__norway3d.cabins.items[i]; window.__norway3d.lookAt(c.lon + 0.02, c.lat - 0.012, 9000); }, i);
    await settle(page, 30000);
    const p = await page.evaluate((i) => { const c = window.__norway3d.cabins.items[i]; return window.__norway3d.project(c.lon, c.lat); }, i);
    await page.touchscreen.tap(p.x, p.y - 4);
    await sleep(700);
    const card = await page.evaluate(() => ({ hidden: document.getElementById('card').hidden, kind: document.getElementById('card-kind').textContent, rows: document.getElementById('card-rows').textContent }));
    ok(!card.hidden && card.kind === 'Gjendebu', `${scheme}: a tap on Gjendebu opens its card (${card.kind}: ${card.rows.slice(0, 80)})`);
    await settle(page, 20000);
    await shot(page, `cabin-${scheme}`);
    await page.click('#card-close');
  }

  // About: opens from the key, the credit line first under Sources and credits, closes on Escape
  if (want('about')) {
    await page.click('#btn-about');
    await sleep(400);
    const ab = await page.evaluate(() => ({ open: !document.getElementById('about').hidden, credit: document.getElementById('about-credit-line').textContent }));
    ok(ab.open && ab.credit === CREDITS, `${scheme}: About opens and prints the credit line word for word`);
    await shot(page, `about-${scheme}`);
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => document.getElementById('about').hidden), `${scheme}: Escape closes About`);
  }
  await hitTargets(page, scheme);

  // focus mode: in by the key, the chrome hidden and inert, the plate grows, out by Escape
  if (want('focus')) {
    const h0 = await page.evaluate(() => document.getElementById('plate').clientHeight);
    await page.click('#focus-key');
    await sleep(500);
    const f = await page.evaluate(() => ({ head: document.getElementById('head').hidden && document.getElementById('head').inert, keys: document.getElementById('keys').hidden, ghost: !document.getElementById('focus-exit').hidden, plate: document.getElementById('plate').clientHeight, about: !!document.querySelector('#caption > #btn-about') }));
    ok(f.head && f.keys && f.ghost && f.about, `${scheme}: focus mode hides the header and the keys, shows the ghost key, keeps About in the caption`);
    ok(f.plate > h0 + 80, `${scheme}: the plate grows in focus mode (${h0} to ${f.plate} px)`);
    await settle(page, 30000);
    await shot(page, `focus-${scheme}`);
    await hitTargets(page, `${scheme} focus`);
    // the view switch stays in focus mode, and works there
    const vk = await page.evaluate(() => { const e = document.getElementById('viewkey'), r = e.getBoundingClientRect(); return { shown: !e.hidden && !e.closest('[inert]') && r.width >= 88 && r.height >= 36 && r.bottom <= document.getElementById('plate').getBoundingClientRect().bottom, mode: window.__norway3d.rig.mode }; });
    await page.click(vk.mode === '3d' ? '#view-2d' : '#view-3d');
    await sleep(700);
    const m1 = await page.evaluate(() => window.__norway3d.rig.mode);
    await page.click(m1 === '3d' ? '#view-2d' : '#view-3d');
    await sleep(700);
    const m2 = await page.evaluate(() => window.__norway3d.rig.mode);
    ok(vk.shown && m1 !== vk.mode && m2 === vk.mode, `${scheme}: the 2D/3D switch stays on the plate in focus mode and switches there (${vk.mode} to ${m1} to ${m2})`);
    await page.reload();
    await page.waitForFunction(() => window.__norway3d, null, { timeout: 30000 });
    ok(await page.evaluate(() => document.body.classList.contains('focus')), `${scheme}: focus mode is remembered across a reload`);
    await page.keyboard.press('Escape');
    await sleep(300);
    ok(await page.evaluate(() => !document.getElementById('head').hidden && document.getElementById('focus-exit').hidden), `${scheme}: Escape shows the controls again`);
    await settle(page, 30000);
  }

  if (want('style') && scheme === 'light') {
    await page.click('#btn-layers');
    await sleep(300);
    await page.click('.style-row[data-style="gray"]');
    await page.keyboard.press('Escape');
    await settle(page);
    await shot(page, `style-gray-${scheme}`);
    await page.click('#btn-layers');
    await sleep(300);
    await page.click('.style-row[data-style="topo"]');
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());   // no focus ring in the later pictures
    await settle(page);
  }

  // 3D: streaming terrain with the map draped, at four places; heading = where the camera looks
  if (want('3d')) {
    await page.evaluate(() => window.__norway3d.setMode('3d', false));
    const VIEWS = [
      ['besseggen', 8.72, 61.50, 7000, 62, 250],      // Besseggen and Gjende from the east
      ['romsdalen', 7.80, 62.47, 9000, 66, 200],      // Trollveggen and Romsdalen
      ['lofoten', 13.08, 67.93, 12000, 68, 20],       // Reine and the Lofoten wall
      ['lyngen', 20.13, 69.60, 22000, 64, 110],       // the Lyngen Alps
    ];
    for (const [name, lon, lat, d, phi, heading] of (scheme === 'light' ? VIEWS : VIEWS.slice(0, 1))) {
      const t0 = Date.now();
      await page.evaluate(([lon, lat, d, phi, heading]) => window.__norway3d.lookAt(lon, lat, d, phi, -heading), [lon, lat, d, phi, heading]);
      const ms3 = await settle(page, 120000);
      const st = await stats(page);
      await shot(page, `3d-${name}-${scheme}`);
      const drape = await drapeCheck(page, `${scheme}: 3D ${name}`);
      const bench = await page.evaluate(() => window.__norway3d.bench(20));
      perf.push({ scheme, scene: `3d-${name}`, settleMs: ms3, wallMs: Date.now() - t0, bench, ...st });
      console.log(`     ${name}: frame ${bench.median.toFixed(1)} ms median, ${bench.p90.toFixed(1)} ms p90 (SwiftShader, not a phone); ${st.loader.started} requests so far`);
      ok(ms3 >= 0, `${scheme}: 3D ${name} settles in ${ms3} ms (${st.terrain.drawn} tiles, ${st.info.triangles} triangles, ${st.terrain.gpuMB.toFixed(1)} MB of textures, heights ${(st.cover.height * 100).toFixed(0)} % own, ${(st.cover.fine * 100).toFixed(0)} % from the 1 m model)`);
      const B = await page.evaluate(() => window.__norway3d.budgets);
      ok(st.terrain.drawn <= B.tiles && st.terrain.gpuMB <= B.gpuMB && st.heights.mb <= B.heightsMB, `${scheme}: 3D ${name} within the budgets: ${st.terrain.drawn} of ${B.tiles} tiles, textures ${st.terrain.gpuMB.toFixed(1)} of ${B.gpuMB} MB (${st.terrain.liveMB.toFixed(1)} MB drawn, ${st.terrain.ahead} tiles ahead), heights ${st.heights.mb.toFixed(1)} of ${B.heightsMB} MB`);
      perf[perf.length - 1].drape = drape;
      await drapeCheck(page, `${scheme}: 3D ${name}, after the frame-time bench`);
    }
    ok(await page.evaluate(() => window.__norway3d.heights.stats.decoded > 0 && !!window.__norway3d.heights.worker), `${scheme}: heights decoded in the worker`);
    // a tap on the ground in 3D finds it by marching the heights: the card's height is the 1 m model's there
    // (the floating names off, so the tap meets the ground, not a name)
    await page.evaluate(() => window.__norway3d.setLayer('names', false));
    const box = await page.evaluate(() => { const r = document.getElementById('plate').getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + r.height * 0.6 }; });
    await page.touchscreen.tap(box.x, box.y);
    await sleep(900);
    const pc = await page.evaluate(() => ({ kind: document.getElementById('card-kind').textContent, num: document.getElementById('card-num').textContent, note: document.getElementById('card-note').textContent }));
    ok(pc.kind === 'Tapped point' && /\d/.test(pc.num), `${scheme}: a tap on the 3D ground opens its card (${pc.num} m, ${pc.note})`);
    await page.click('#card-close');
    await page.evaluate(() => { window.__norway3d.setLayer('names', true); window.__norway3d.setMode('map', false); });
  }

  // moving stays as sharp as standing still (light only)
  if (want('motion') && scheme === 'light') await motionScene(page, scheme);

  // the hands and the 2D/3D switch (light only)
  if (want('hands') && scheme === 'light') await handsScene(page, scheme);

  // the sun: shadows, the skyline, the scrub, play, the viewshed and the profile (light only)
  if (want('sun') && scheme === 'light') await sunScene(page, scheme);

  // the surfaces, steepness, snow and the floating names, at Besseggen and Lyngen (light only)
  if (want('layers') && scheme === 'light') await layerScene(page, scheme);

  if (want('norway')) {
    await page.click('#btn-norway');
    const ms2 = await settle(page);
    perf.push({ scheme, scene: 'norway', settleMs: ms2, ...(await stats(page)) });
    await shot(page, `norway-${scheme}`);
  }

  const csp = await page.evaluate(() => window.__csp);
  ok(csp.length === 0, `${scheme}: no CSP violation${csp.length ? `: ${csp.slice(0, 3).join(' | ')}` : ''}`);
  endPage(log, scheme);
  perf.push({ scheme, scene: 'requests', ...log.requests });
  await ctx.close();
}

if (want('hands') && schemes.includes('light')) await reducedHands();

// widths: no sideways scroll at 320 px, at 125 % text zoom and on its side
if (want('widths')) {
  for (const [w, h, z] of [[320, 640, 1], [360, 740, 1], [312, 675, 1.25], [844, 390, 1]]) {
    const { ctx, page, log } = await newPage('light', { viewport: { width: w, height: h } });
    await page.goto(BASE);
    await page.waitForFunction(() => window.__norway3d, null, { timeout: 30000 });
    if (z !== 1) await page.evaluate((z) => { document.body.style.zoom = String(z); }, z);
    await settle(page, 30000);
    const r = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, plate: document.getElementById('plate').clientHeight }));
    ok(r.sw <= r.iw, `${w} x ${h}${z !== 1 ? ` at ${z * 100} %` : ''}: no sideways scroll (${r.sw} of ${r.iw})`);
    if (w > h) ok(r.plate >= 220, `${w} x ${h}: the plate is ${r.plate} px tall on its side (at least 220)`);
    await shot(page, `width-${w}x${h}`);
    endPage(log, `${w} x ${h}`);
    await ctx.close();
  }
}

fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(perf, null, 1));
await browser.close();
server.close();
console.log(`\n${checks - fails.length} of ${checks} checks pass. Pictures and perf.json in ${path.relative(process.cwd(), OUT) || OUT}`);
console.log('Times and memory above are headless Chromium with SwiftShader on the build Mac: not phone figures.');
if (fails.length) { console.log('SOME CHECKS FAIL'); process.exit(1); }
console.log('ALL CHECKS PASS');
