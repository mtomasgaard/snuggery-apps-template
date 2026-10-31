// Drive Hello Map in a headless browser at phone size (390 x 844 CSS px, DPR 2, touch), light and
// dark, served by tools/serve.mjs under the policies Snuggery gives it:
//
//   online    the site allowed: it FAILS on any console error or warning, page error, policy
//             violation, request to a host outside miniapp.json's resourceHosts, or HTTP status of 400
//             or more from the folder. The map comes from the real site, so a run needs the network.
//   offline   the app kept offline: the only messages allowed are the policy refusing the site's
//             pictures; nothing may reach the network; the calm sentence and the collar must show.
//   cut       the site allowed but the network gone: the only messages allowed are the refused tile
//             loads; then the network comes back and the map must recover by itself.
//
// Every figure it asserts is worked out here from first principles (the projection, the grid step,
// the scale, the coordinates, the tile), never by importing js/, so a bug in the app cannot agree
// with itself. HEADLESS FIGURES ARE NOT PHONE EVIDENCE (NOTES.md lists the phone checks).
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/shoot.mjs
//   SCHEMES=light node tools/shoot.mjs          one theme
//   SCENES=boot,offline node tools/shoot.mjs    some scenes (boot, layer, units, card, gestures, keys,
//                                               focus, about, remember, outside, country, widths,
//                                               motion, offline, cut, board)
//   SCREENSHOTS=1 node tools/shoot.mjs          also copies the kept pictures (KEEP) to screenshots/
//                                               (never screenshots/app.png); all go to tools/.work/shots/
//   ENGINE=webkit node tools/shoot.mjs          Playwright's WebKit: boot, offline and cut only
//                                               (its touch input has no CDP, so no gesture scenes)

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { startServer, onlineCsp, OFFLINE_CSP, APP, resourceHosts } from './serve.mjs';

let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); } catch (e) {
  console.error(`Playwright could not be loaded (${e.code || e.message}): set PLAYWRIGHT_MODULE to a playwright/index.mjs.`); process.exit(4);
}
const ENGINE = process.env.ENGINE || 'chromium';
const browserType = (pw[ENGINE] || pw.default[ENGINE]);
const WORK = path.join(APP, 'tools', '.work', 'shots');
const SHOTS = process.env.SCREENSHOTS === '1' ? path.join(APP, 'screenshots') : WORK;
// the pictures kept in screenshots/ (the rest stay in tools/.work/shots/, which Git ignores): the
// before-and-after boards, and one picture of each thing a reviewer looks for
const KEEP = new Set(['before-after-light', 'before-after-dark', 'map-dark', 'imagery-light', 'card-dark', 'focus-light', 'about-light', 'outside-light']);
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });
const schemes = (process.env.SCHEMES || 'light,dark').split(',');
const sceneFilter = process.env.SCENES ? new Set(process.env.SCENES.split(',')) : null;
const want = (s) => (!sceneFilter || sceneFilter.has(s)) && (ENGINE === 'chromium' || ['boot', 'offline', 'cut'].includes(s));
const HOSTS = new Set(resourceHosts());
const HOST = [...HOSTS][0];

const fails = [];
let checks = 0;
const ok = (cond, msg) => { checks++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const skip = (msg) => console.log(`skip ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── first principles: the projection, the step, the scale, the words ─────────────────────────────
const NN = '\u202F', DEG = Math.PI / 180;
const mx = (lon) => (lon + 180) / 360;
const my = (lat) => { const s = Math.sin(lat * DEG); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); };
const ilon = (x) => (x - Math.floor(x)) * 360 - 180;
const ilat = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / DEG;
const wpx = (z) => 256 * 2 ** z;
const mpp = (lat, z) => (2 * Math.PI * 6378137 * Math.cos(lat * DEG)) / wpx(z);
const STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 150, 300, 450, 900, 1800, 3600, 7200, 18000, 36000, 72000];
const stepAt = (z) => STEPS.find((s) => (s / 3600) * (wpx(z) / 360) >= 120) || 72000;
const stepWord = (s) => (s % 3600 === 0 ? `${s / 3600}°` : s >= 60 ? `${s / 60}′` : `${s}″`);
function tickLabel(v, step, p, n) {
  const tot = Math.round(Math.abs(v) * 3600 / step) * step, d = Math.floor(tot / 3600), rem = tot - d * 3600;
  const h = tot === 0 ? '' : `${NN}${v >= 0 ? p : n}`;
  if (rem === 0) return `${d}°${h}`;
  if (step >= 60) return `${d}° ${rem / 60}′${h}`;
  return `${d}° ${Math.floor(rem / 60)}′ ${rem % 60}″${h}`;
}
function niceScale(maxM, us) {
  const nice = (v) => { const p = 10 ** Math.floor(Math.log10(v)); let r = p; for (const k of [1, 2, 5]) if (k * p <= v) r = k * p; return r; };
  if (us) { const mi = maxM / 1609.344; if (mi >= 1) { const k = nice(mi); return { m: k * 1609.344, s: `${k}${NN}mi` }; } const f = nice(maxM / 0.3048); return { m: f * 0.3048, s: `${f >= 1000 ? String(f).replace(/\B(?=(\d{3})+$)/g, NN) : f}${NN}ft` }; }
  const k = nice(maxM);
  return k >= 1000 ? { m: k, s: `${k / 1000}${NN}km` } : { m: k, s: `${k}${NN}m` };
}
const dec4 = (lon, lat) => `${Math.abs(lat).toFixed(4)}°${NN}${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${NN}${lon >= 0 ? 'E' : 'W'}`;
const OFFLINE_SENTENCE = 'No map tiles could be loaded. If this app is offline in Snuggery, allow its site to see the map.';
const OUTSIDE_SENTENCE = 'The National Map shows detail only in the United States. Zoom out, or show the whole country.';
const CREDITS = /const CREDITS = '([^']+)'/.exec(fs.readFileSync(path.join(APP, 'app.js'), 'utf8'))[1];
const ACK = 'Map services and data available from U.S. Geological Survey, National Geospatial Program.';
const lumOf = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** A PNG (8-bit RGB or RGBA, not interlaced, as the browsers write them) to RGBA pixels. */
function decodePng(buf) {
  let p = 8, w = 0, h = 0, bpp = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bpp = d[9] === 6 ? 4 : d[9] === 2 ? 3 : 0; if (d[8] !== 8 || d[12] !== 0 || !bpp) throw new Error('png: only 8-bit RGB(A), not interlaced'); }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
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

// ── the browser, the servers, a page ─────────────────────────────────────────────────────────────
const online = await startServer(0, { csp: onlineCsp([...HOSTS]) });
const offline = await startServer(0, { csp: OFFLINE_CSP });
const browser = await browserType.launch();
console.log(`${ENGINE} ${browser.version()}; online policy on :${online.port}, offline policy on :${offline.port}`);

async function newPage(scheme, opts = {}) {
  const base = { viewport: opts.viewport || { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, colorScheme: scheme, reducedMotion: opts.reducedMotion || 'no-preference' };
  let ctx;
  try { ctx = await browser.newContext({ ...base, isMobile: true }); } catch { ctx = await browser.newContext(base); }
  if (opts.route) await opts.route(ctx);
  const page = await ctx.newPage();
  const srv = opts.offline ? offline : online;
  const log = { errors: [], refused: [], failedTiles: [], foreign: [], http: [], hostReq: [], hostResp: [], hostFailed: [], local: 0 };
  page.on('console', (m) => {
    if (!(m.type() === 'error' || m.type() === 'warning')) return;
    const t = m.text(), at = (m.location() && m.location().url) || '';
    const tile = new RegExp(`https://${HOST.replace(/\./g, '\\.')}/arcgis/rest/services/USGS(Topo|ImageryTopo)/MapServer/tile/`);
    if (opts.offline && /Content Security Policy/.test(t) && /img-src/.test(t) && tile.test(t)) { log.refused.push(t); return; }
    if (opts.cut && /Failed to load resource|ERR_INTERNET_DISCONNECTED|network connection was lost|could not be loaded|Could not connect/i.test(t) && (tile.test(t) || tile.test(at))) { log.failedTiles.push(t); return; }
    log.errors.push(`${m.type()}: ${t.slice(0, 220)}`);
  });
  page.on('pageerror', (e) => log.errors.push(`pageerror: ${e.message}`));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return;
    if (u.host === `127.0.0.1:${srv.port}`) { log.local++; return; }
    if (u.protocol === 'https:' && HOSTS.has(u.hostname)) { log.hostReq.push(r.url()); return; }
    log.foreign.push(r.url());
  });
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (u.host === `127.0.0.1:${srv.port}` && r.status() >= 400) log.http.push(`${r.status()} ${r.url()}`);
    if (HOSTS.has(u.hostname)) log.hostResp.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => { const u = new URL(r.url()); if (HOSTS.has(u.hostname)) log.hostFailed.push((r.failure() && r.failure().errorText) || '?'); });
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  await page.goto(`http://127.0.0.1:${srv.port}/`);
  return { ctx, page, log, srv };
}
async function settle(page, maxMs = 45000) {
  const t0 = Date.now();
  let quiet = 0;
  while (Date.now() - t0 < maxMs) {
    const idle = await page.evaluate(() => !!(window.__hellomap && window.__hellomap.idle()));
    quiet = idle ? quiet + 1 : 0;
    if (quiet >= 3) return Date.now() - t0;
    await sleep(200);
  }
  return -1;
}
const state = (page) => page.evaluate(() => window.__hellomap.state());
const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
async function shot(page, name) {
  const f = path.join(WORK, `${name}.png`);
  await page.screenshot({ path: f });
  if (SHOTS !== WORK && KEEP.has(name)) fs.copyFileSync(f, path.join(SHOTS, `${name}.png`));
  return f;
}
function endPage(log, label, { offline: off = false } = {}) {
  ok(log.errors.length === 0, `${label}: no console errors or warnings, no page errors${log.errors.length ? `: ${log.errors.slice(0, 3).join(' | ')}` : ''}`);
  ok(log.foreign.length === 0, `${label}: no request outside the folder and ${HOST}${log.foreign.length ? `: ${log.foreign.slice(0, 3).join(' ')}` : ''}`);
  ok(log.http.length === 0, `${label}: no HTTP error from the folder${log.http.length ? `: ${log.http.join(' ')}` : ''}`);
  if (off) ok(log.refused.length > 0, `${label}: the policy refused the site's pictures (${log.refused.length} console lines, each an img-src refusal of a tile)`);
}
const plateRect = (page) => page.evaluate(() => { const r = document.getElementById('plate').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
async function colorShare(page) {
  const r = await plateRect(page);
  const { w, h, px } = decodePng(await page.screenshot({ clip: { x: r.x + r.w * 0.2, y: r.y + r.h * 0.25, width: r.w * 0.6, height: r.h * 0.5 } }));
  let color = 0;
  for (let i = 0; i < w * h; i++) { const R = px[i * 4], G = px[i * 4 + 1], B = px[i * 4 + 2]; if (Math.max(R, G, B) - Math.min(R, G, B) > 24) color++; }
  return color / (w * h);
}
/** Every visible text node's contrast over its composited background (HOUSE.md 7.2). */
const textContrast = (page) => page.evaluate(() => {
  const parse = (s) => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const mix = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      if (e.id === 'plate') return null;            // text straight on the map is the canvas's, measured by the sampler
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (const c of layers.reverse()) out = mix(c, out);
    return out;
  };
  const res = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || !el || el.closest('.sr,[hidden]') || !el.getClientRects().length) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
    const bg = bgOf(el);
    if (!bg) continue;
    const fg = mix(parse(cs.color), bg);
    const a = L(fg), b = L(bg);
    res.push({ t: n.textContent.trim().slice(0, 30), c: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) });
  }
  return res;
});
/** Hit targets of every visible control: its box, with the stamp's ::before reach (HOUSE.md 4.2). */
const hitTargets = (page) => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, [role=slider], [role=tab], [role=radio], a[href]')) {
    if (el.closest('[hidden]') || !el.getClientRects().length) continue;
    const r = el.getBoundingClientRect();
    let h = r.height;
    const be = getComputedStyle(el, '::before');
    if (be.content !== 'none' && be.position === 'absolute') h = Math.max(h, r.height - parseFloat(be.top) - parseFloat(be.bottom));
    out.push({ name: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 24), w: Math.round(r.width), h: Math.round(h) });
  }
  return out;
});
/** SI in every visible text node: a true minus, U+202F before units. */
const siScan = (page) => page.evaluate(() => {
  const bad = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent;
    if (/(^|[\s(])-\d/.test(t) || /\d (m|km|ft|mi|px|%)\b/.test(t)) bad.push(t.trim().slice(0, 40));
  }
  return bad;
});
async function touchDrag(page, pts, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  const tp = (list) => list.map((p, i) => ({ x: p.x, y: p.y, id: i }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(pts.map((p) => p.from)) });
  for (let s = 1; s <= steps; s++) {
    const cur = pts.map((p) => ({ x: p.from.x + (p.to.x - p.from.x) * s / steps, y: p.from.y + (p.to.y - p.from.y) * s / steps }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(cur) });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

// ── the scenes ───────────────────────────────────────────────────────────────────────────────────
for (const scheme of schemes) {
  const S = scheme;
  if (want('boot')) {
    const { ctx, page, log } = await newPage(S);
    const t = await settle(page);
    ok(t >= 0, `${S} boot: the map settles under the online policy (${t} ms, headless, a trend only)`);
    const st = await state(page);
    ok(await page.evaluate(() => document.fonts.check('560 11.5px "Ysabeau Office"')) && st.fontReady, `${S} boot: the house face is loaded before the collar is drawn`);
    ok((await page.textContent('h1')) === 'Hello Map', `${S} boot: the name`);
    ok((await page.textContent('#stamp')) === 'Every tile in view has loaded.', `${S} boot: the status line "${await page.textContent('#stamp')}"`);
    ok((await page.evaluate(() => document.getElementById('stamp').getBoundingClientRect().height)) <= 17, `${S} boot: the status line is one line`);
    ok(st.view.level === 13 && st.view.loaded === st.view.inView && st.view.failed === 0 && st.view.inView >= 8, `${S} boot: Yosemite Valley at level 13, ${st.view.loaded} of ${st.view.inView} pictures in view, none failed`);
    const tileRe = new RegExp(`^https://${HOST.replace(/\./g, '\\.')}/arcgis/rest/services/USGSTopo/MapServer/tile/13/(\\d+)/(\\d+)$`);
    const asked = log.hostReq.map((u) => tileRe.exec(u)).filter(Boolean);
    ok(asked.length === log.hostReq.length && asked.length >= st.view.inView, `${S} boot: every request to ${HOST} is a level-13 USGSTopo tile (${asked.length})`);
    // the tiles are the view's: rows and columns from the projection, worked out here
    const W = wpx(13), n = 2 ** 13;
    const c0 = Math.floor((st.cx * W - st.w / 2) / 256), c1 = Math.floor((st.cx * W + st.w / 2) / 256);
    const r0 = Math.floor((st.cy * W - st.h / 2) / 256), r1 = Math.floor((st.cy * W + st.h / 2) / 256);
    const expect = new Set(); for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) expect.add(`${r}/${((c % n) + n) % n}`);
    const got = new Set(asked.map((m) => `${m[1]}/${m[2]}`));
    ok([...expect].every((k) => got.has(k)) && [...got].every((k) => expect.has(k)), `${S} boot: the pictures asked for are exactly the ${expect.size} the view covers`);
    ok((await colorShare(page)) > 0.2, `${S} boot: the map is drawn on the plate (color in the middle of the plate)`);
    // the collar, worked out here
    const step = stepAt(st.zoom);
    ok(st.step === step, `${S} collar: the step is ${stepWord(step)} (${st.step} s; the smallest whose ticks stand 120 px apart)`);
    ok((await page.textContent('#cap')) === `Ticks and crosses every ${stepWord(step)} of latitude and longitude.`, `${S} collar: the caption line names the step`);
    const Wz = wpx(st.zoom);
    let labelOk = st.labels.length >= 4;
    for (const l of st.labels) {
      if (l.kind === 'lat') {
        const lat = Math.round(ilat(st.cy + (l.y - 4 - st.h / 2) / Wz) * 3600 / step) * step / 3600;
        const y = (my(lat) - st.cy) * Wz + st.h / 2 + 4;
        if (Math.abs(y - l.y) > 0.5 || l.s !== tickLabel(lat, step, 'N', 'S')) labelOk = false;
      } else {
        // a meridian label is centered on its tick: one of the step's meridians inside the view
        const lonL = (st.cx - st.w / 2 / Wz) * 360 - 180, lonR = (st.cx + st.w / 2 / Wz) * 360 - 180;
        const words = [];
        for (let i = Math.ceil(lonL * 3600 / step); i * step / 3600 <= lonR; i++) words.push(tickLabel(i * step / 3600, step, 'E', 'W'));
        if (!words.includes(l.s) || l.y !== st.h - 12) labelOk = false;
      }
    }
    ok(labelOk, `${S} collar: ${st.labels.length} labels, each at its own latitude's place and in its own words (${st.labels.map((l) => l.s).join('; ')})`);
    // the scale bar, worked out here
    const sc = niceScale(mpp(st.lat, st.zoom) * 112, false);
    const barW = await page.evaluate(() => document.getElementById('scale-bar').getBoundingClientRect().width);
    ok((await page.textContent('#scale-len')) === sc.s && Math.abs(barW - Math.round(sc.m / mpp(st.lat, st.zoom))) <= 1, `${S} scale: ${sc.s} over ${Math.round(barW)} px, true at ${Math.abs(st.lat).toFixed(1)}° N`);
    ok((await page.textContent('#scale-sub')) === `true at ${Math.abs(st.lat).toFixed(1)}°${NN}N`, `${S} scale: names the latitude it is true at`);
    // the signature sampler: the collar's ink against its halo over the rendered map
    const r = await plateRect(page);
    await page.evaluate(() => window.__hellomap.collar(false)); await frame(page);
    const mapPx = decodePng(await page.screenshot({ clip: { x: r.x, y: r.y, width: r.w, height: r.h } }));
    await page.evaluate(() => window.__hellomap.collar(true)); await frame(page);
    const ov = await page.evaluate(() => { const c = document.getElementById('overlay'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height); return { w: c.width, h: c.height, d: Array.from(d.data) }; });
    const samples = [];
    const ink = lumOf(0x0f, 0x1c, 0x23);
    for (let y = 0; y < Math.min(ov.h, mapPx.h); y++) for (let x = 0; x < Math.min(ov.w, mapPx.w); x++) {
      const i = (y * ov.w + x) * 4, a = ov.d[i + 3] / 255;
      if (a < 0.8 || a > 0.95 || ov.d[i] < 230) continue;                         // a halo pixel: pale, at its alpha
      const R = ov.d[i] * a + mapPx.px[(y * mapPx.w + x) * 4] * (1 - a), G = ov.d[i + 1] * a + mapPx.px[(y * mapPx.w + x) * 4 + 1] * (1 - a), B = ov.d[i + 2] * a + mapPx.px[(y * mapPx.w + x) * 4 + 2] * (1 - a);
      samples.push(cr(ink, lumOf(R, G, B)));
    }
    samples.sort((a, b) => a - b);
    const p10 = samples[Math.floor(samples.length * 0.1)] || 0;
    ok(samples.length > 500 && p10 >= 4.5, `${S} signature: the collar's ink on its halo over the rendered map, 90 % of ${samples.length} samples at ${p10.toFixed(2)}:1 or more (target 4.5); the lowest ${samples[0] && samples[0].toFixed(2)} (an antialiased halo edge)`);
    const tc = await textContrast(page);
    const low = tc.filter((x) => x.c < 4.5);
    ok(tc.length >= 5 && low.length === 0, `${S} text: ${tc.length} visible text nodes at 4.5:1 or more${low.length ? `: ${low.map((x) => `${x.t} ${x.c.toFixed(2)}`).join(', ')}` : ''}`);
    const hits = await hitTargets(page);
    const small = hits.filter((x) => x.w < 44 || x.h < 44);
    ok(small.length === 0, `${S} hit targets: ${hits.length} controls at 44 x 44 px or more${small.length ? `: ${small.map((x) => `${x.name} ${x.w}x${x.h}`).join(', ')}` : ''}`);
    const si = await siScan(page);
    ok(si.length === 0 && st.labels.every((l) => l.s.includes(NN) || /^0°$/.test(l.s)), `${S} SI: no hyphen-minus before a digit, U+202F before every unit and hemisphere${si.length ? `: ${si.join(' | ')}` : ''}`);
    ok((await page.evaluate(() => window.__csp.length)) === 0, `${S} boot: no policy violation`);
    await shot(page, `map-${S}`);
    endPage(log, `${S} boot`);
    await ctx.close();
  }

  if (want('layer') || want('units') || want('card') || want('keys') || want('about') || want('remember') || want('outside') || want('country')) {
    const { ctx, page, log } = await newPage(S);
    await settle(page);
    if (want('layer')) {
      await page.touchscreen.tap(...(await center(page, '#layer-imagery')));
      await settle(page);
      const st = await state(page);
      ok(st.layer === 'imagery' && (await page.getAttribute('#layer-imagery', 'aria-checked')) === 'true' && (await page.getAttribute('#layer-map', 'aria-checked')) === 'false', `${S} layer: Imagery chosen by touch`);
      ok(log.hostReq.some((u) => /USGSImageryTopo\/MapServer\/tile\/13\//.test(u)) && st.view.loaded === st.view.inView, `${S} layer: the imagery's pictures asked for and drawn (${st.view.loaded} of ${st.view.inView})`);
      ok((await page.textContent('#live')).includes('Imagery with the topographic map over it.'), `${S} layer: the live region names the layer`);
      await shot(page, `imagery-${S}`);
      await page.touchscreen.tap(...(await center(page, '#layer-map')));
      await settle(page);
      ok((await state(page)).layer === 'map', `${S} layer: back to the map`);
    }
    if (want('units')) {
      const before = await state(page);
      await page.touchscreen.tap(...(await center(page, '#units')));
      await frame(page);
      const us = niceScale(mpp(before.lat, before.zoom) * 112, true);
      ok((await page.textContent('#units')) === 'mi' && (await page.getAttribute('#units', 'aria-label')) === 'Change units, now miles' && (await page.textContent('#scale-len')) === us.s, `${S} units: one tap gives US units, ${us.s}`);
      await page.touchscreen.tap(...(await center(page, '#units')));
      await frame(page);
      ok((await page.textContent('#units')) === 'km' && (await page.textContent('#scale-len')) === niceScale(mpp(before.lat, before.zoom) * 112, false).s, `${S} units: the next tap is back to SI first`);
    }
    if (want('card')) {
      const r = await plateRect(page);
      const st = await state(page);
      const px = 200, py = 330;
      await page.touchscreen.tap(r.x + px, r.y + py);
      await page.waitForSelector('#card:not([hidden])', { timeout: 3000 }).catch(() => {});
      await sleep(200);
      const Wz = wpx(st.zoom), wx = st.cx + (px - st.w / 2) / Wz, wy = st.cy + (py - st.h / 2) / Wz;
      const lon = ilon(wx), lat = ilat(wy);
      ok((await page.textContent('#card-fig')) === dec4(lon, lat), `${S} card: the tapped point's coordinates, worked out here (${dec4(lon, lat)})`);
      const tz = 13, col = Math.floor(mx(lon) * 2 ** tz), row = Math.floor(my(lat) * 2 ** tz);
      const rows = await page.$$eval('#card-rows dd', (d) => d.map((e) => e.textContent));
      const g = (v) => String(v).replace(/\B(?=(\d{3})+$)/g, NN);
      ok(rows[0] === `level ${tz}, column ${g(col)}, row ${g(row)}` && rows[1] === HOST, `${S} card: the picture under the point (${rows[0]}) and its site`);
      const cb = await page.evaluate(() => document.getElementById('card').getBoundingClientRect().toJSON());
      ok(!(r.x + px > cb.left && r.x + px < cb.right && r.y + py > cb.top && r.y + py < cb.bottom), `${S} card: the card does not cover its point`);
      const ovPx = await page.evaluate(([x, y]) => { const c = document.getElementById('overlay'), d = c.getContext('2d').getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data; return Array.from(d); }, [px, py]);
      ok(ovPx[3] > 200 && ovPx[0] < 60, `${S} card: the marker is drawn at the point`);
      ok((await page.textContent('#live')).startsWith(`${Math.abs(lat).toFixed(4)} degrees north, ${Math.abs(lon).toFixed(4)} degrees west.`), `${S} card: the live region says the point in words`);
      await shot(page, `card-${S}`);
      // a tap where the card stands: the card moves down, clear of its point
      await page.touchscreen.tap(...(await center(page, '#card-close')));
      await sleep(100);
      ok(await page.evaluate(() => document.getElementById('card').hidden) && !(await state(page)).marker, `${S} card: Close takes the card and the marker away`);
      await page.touchscreen.tap(r.x + 60, r.y + 40);
      await page.waitForSelector('#card:not([hidden])', { timeout: 3000 }).catch(() => {});
      await sleep(200);
      const cb2 = await page.evaluate(() => { const c = document.getElementById('card'); return { low: c.classList.contains('low'), ...c.getBoundingClientRect().toJSON() }; });
      ok(cb2.low && !(r.x + 60 > cb2.left && r.x + 60 < cb2.right && r.y + 40 > cb2.top && r.y + 40 < cb2.bottom), `${S} card: a point near the top-left puts the card at the foot, clear of the point`);
      await page.touchscreen.tap(...(await center(page, '#card-close')));
      await sleep(100);
    }
    if (want('keys')) {
      const z0 = (await state(page)).zoom;
      await page.touchscreen.tap(...(await center(page, '#zoom-in')));
      await sleep(450);
      ok(Math.abs((await state(page)).zoom - (z0 + 1)) < 1e-6, `${S} keys: Zoom in, one level (${z0} to ${z0 + 1})`);
      await page.touchscreen.tap(...(await center(page, '#zoom-out')));
      await sleep(450);
      ok(Math.abs((await state(page)).zoom - z0) < 1e-6, `${S} keys: Zoom out, back`);
      await page.focus('#map');
      const a = await state(page);
      await page.keyboard.press('ArrowRight'); await frame(page);
      const b = await state(page);
      const quarter = Math.min(a.w, a.h) / 4 / wpx(a.zoom);
      ok(Math.abs((b.cx - a.cx) - quarter) < 1e-9, `${S} keys: the right arrow moves the view a quarter of its short side east`);
      await page.keyboard.press('Enter'); await sleep(150);
      ok(!(await page.evaluate(() => document.getElementById('card').hidden)) && (await page.textContent('#card-fig')) === dec4(b.lon, b.lat), `${S} keys: Enter marks the middle, and its card names it`);
      ok(await page.evaluate(() => document.activeElement.id === 'card-close'), `${S} keys: by keyboard, the focus goes to the card's Close`);
      await page.keyboard.press('Enter'); await sleep(100);
      ok(await page.evaluate(() => document.getElementById('card').hidden && document.activeElement.id === 'map'), `${S} keys: Close by keyboard returns to the map`);
      await page.keyboard.press('ArrowLeft'); await frame(page);
    }
    if (want('about')) {
      await page.touchscreen.tap(...(await center(page, '#stamp')));
      await sleep(300);
      const ab = await page.evaluate(() => ({ open: !document.getElementById('about').hidden, first: document.getElementById('about-credit-line').textContent, next: document.querySelector('#about-credit-line + h4 + p').textContent, focus: document.activeElement.textContent, inert: document.getElementById('plate').inert }));
      ok(ab.open && ab.focus === 'Close' && ab.inert, `${S} About: opens from the status line, focus on Close, the app behind it inert`);
      ok(ab.first === CREDITS && ab.next === ACK, `${S} About: the credit constant first under Sources and credits, then USGS's acknowledgment word for word`);
      const tc = await textContrast(page);
      ok(tc.every((x) => x.c >= 4.5), `${S} About: ${tc.length} text nodes at 4.5:1 or more`);
      ok((await page.$$eval('#ab-data dt', (d) => d.map((e) => e.textContent))).join() === 'Map,Layers,Levels,Pictures this session', `${S} About: This data, one fact a line`);
      await shot(page, `about-${S}`);
      await page.keyboard.press('Escape'); await sleep(100);
      ok(await page.evaluate(() => document.getElementById('about').hidden && document.activeElement.id === 'stamp'), `${S} About: Escape closes it and the focus returns to the status line`);
      await page.touchscreen.tap(...(await center(page, '#btn-about')));
      await sleep(250);
      ok(!(await page.evaluate(() => document.getElementById('about').hidden)), `${S} About: opens from the About key too`);
      await page.touchscreen.tap(...(await center(page, '.dlg-head [data-close]')));
      await sleep(100);
    }
    if (want('remember')) {
      await page.evaluate(() => window.__hellomap.view(-105.2705, 40.015, 12.5));
      await page.touchscreen.tap(...(await center(page, '#layer-imagery')));
      await page.touchscreen.tap(...(await center(page, '#units')));
      await sleep(600);
      await page.reload();
      await settle(page);
      const st = await state(page);
      ok(Math.abs(st.lon + 105.2705) < 1e-5 && Math.abs(st.lat - 40.015) < 1e-5 && st.zoom === 12.5 && st.layer === 'imagery' && st.units === 'us', `${S} remember: the place, the zoom, the layer and the units survive a reload`);
      await page.touchscreen.tap(...(await center(page, '#layer-map')));
      await page.touchscreen.tap(...(await center(page, '#units')));
      await sleep(300);
    }
    if (want('outside')) {
      const before = log.hostReq.length;
      await page.evaluate(() => window.__hellomap.view(2.3522, 48.8566, 11));
      await settle(page);
      const st = await state(page);
      const asked = log.hostReq.slice(before).map((u) => Number(/\/tile\/(\d+)\//.exec(u)[1]));
      ok(st.notice === OUTSIDE_SENTENCE && (await page.textContent('#notice')) === OUTSIDE_SENTENCE, `${S} outside: Paris at level 11 says "${OUTSIDE_SENTENCE}"`);
      ok(asked.length > 0 && asked.every((z) => z <= 8), `${S} outside: no picture beyond level 8 asked for outside the United States (levels ${[...new Set(asked)].join(', ')})`);
      const r = await plateRect(page);
      const top = decodePng(await page.screenshot({ clip: { x: r.x + r.w * 0.1, y: r.y + r.h * 0.12, width: r.w * 0.7, height: r.h * 0.25 } }));
      let drawn = 0;
      for (let i = 0; i < top.w * top.h; i++) if (Math.max(Math.abs(top.px[i * 4] - 0xdf), Math.abs(top.px[i * 4 + 1] - 0xe5), Math.abs(top.px[i * 4 + 2] - 0xe3)) > 8) drawn++;
      ok(drawn / (top.w * top.h) > 0.5 && st.view.outside === st.view.inView && st.view.loaded === st.view.inView, `${S} outside: the level-8 world picture is drawn enlarged over the whole view (${(100 * drawn / (top.w * top.h)).toFixed(0)} % of the sampled plate differs from the empty plate), never a blank plate`);
      if (S === 'light') await shot(page, `outside-${S}`);
    }
    if (want('country')) {
      await page.touchscreen.tap(...(await center(page, '#btn-country')));
      await settle(page);
      const st = await state(page);
      const westX = (mx(-125) - st.cx) * wpx(st.zoom) + st.w / 2, eastX = (mx(-66.9) - st.cx) * wpx(st.zoom) + st.w / 2;
      ok(westX >= 0 && eastX <= st.w && st.notice === '' && st.view.failed === 0, `${S} country: the 48 states fit the plate (level ${st.zoom.toFixed(2)}), no notice, every picture in`);
      if (S === 'light') await shot(page, `country-${S}`);
    }
    endPage(log, `${S} keys, layer, units, card, About`);
    await ctx.close();
  }

  if (want('gestures')) {
    const { ctx, page, log } = await newPage(S);
    await settle(page);
    const r = await plateRect(page);
    const a = await state(page);
    await touchDrag(page, [{ from: { x: r.x + 150, y: r.y + 400 }, to: { x: r.x + 210, y: r.y + 470 } }]);
    await frame(page);
    const b = await state(page);
    const W = wpx(a.zoom);
    ok(Math.abs((a.cx - b.cx) * W - 60) < 0.5 && Math.abs((a.cy - b.cy) * W - 70) < 0.5 && !(await page.evaluate(() => !document.getElementById('card').hidden)), `${S} gestures: a drag of 60 x 70 px moves the map 60 x 70 px under the finger, and opens no card`);
    // pinch: the fingers part from 100 to 200 px; one level in, the place between them stays put
    const mid = { x: 195, y: 360 };
    const anchor = { x: b.cx + (mid.x - b.w / 2) / W, y: b.cy + (mid.y - b.h / 2) / W };
    await touchDrag(page, [{ from: { x: r.x + mid.x - 50, y: r.y + mid.y }, to: { x: r.x + mid.x - 100, y: r.y + mid.y } }, { from: { x: r.x + mid.x + 50, y: r.y + mid.y }, to: { x: r.x + mid.x + 100, y: r.y + mid.y } }], 16);
    await frame(page);
    const c = await state(page), Wc = wpx(c.zoom);
    const ax = (anchor.x - c.cx) * Wc + c.w / 2, ay = (anchor.y - c.cy) * Wc + c.h / 2;
    ok(Math.abs(c.zoom - (b.zoom + 1)) < 0.02 && Math.hypot(ax - mid.x, ay - mid.y) < 1, `${S} gestures: a pinch from 100 to 200 px zooms one level (${b.zoom.toFixed(3)} to ${c.zoom.toFixed(3)}) toward the fingers (the place between them moved ${Math.hypot(ax - mid.x, ay - mid.y).toFixed(2)} px)`);
    // double-tap: one level in, rounded, the place under the finger kept
    const d = await state(page), Wd = wpx(d.zoom), p = { x: 120, y: 500 };
    const an = { x: d.cx + (p.x - d.w / 2) / Wd, y: d.cy + (p.y - d.h / 2) / Wd };
    await page.touchscreen.tap(r.x + p.x, r.y + p.y); await sleep(90); await page.touchscreen.tap(r.x + p.x, r.y + p.y);
    await sleep(500);
    const e = await state(page), We = wpx(e.zoom);
    const ex = (an.x - e.cx) * We + e.w / 2, ey = (an.y - e.cy) * We + e.h / 2;
    ok(e.zoom === Math.min(16, Math.round(d.zoom) + 1) && Math.hypot(ex - p.x, ey - p.y) < 1 && (await page.evaluate(() => document.getElementById('card').hidden)), `${S} gestures: a double-tap zooms in on the place (to level ${e.zoom}), and opens no card`);
    await settle(page);
    ok((await state(page)).view.failed === 0, `${S} gestures: every picture after the moves arrived`);
    endPage(log, `${S} gestures`);
    await ctx.close();
  }

  if (want('focus')) {
    const { ctx, page, log } = await newPage(S);
    await settle(page);
    const h0 = (await state(page)).h;
    await page.touchscreen.tap(...(await center(page, '#focus-key')));
    await sleep(500);
    const f = await page.evaluate(() => ({
      head: document.getElementById('head').hidden && document.getElementById('head').inert,
      keys: document.getElementById('keys').hidden && document.getElementById('keys').inert,
      ghost: !document.getElementById('focus-exit').hidden && document.getElementById('focus-exit').getAttribute('aria-label'),
      layer: !!document.getElementById('viewkey').getClientRects().length,
      about: document.getElementById('caption').firstElementChild.id,
      live: document.getElementById('live').textContent,
      focus: document.body.classList.contains('focus'),
    }));
    const st = await state(page);
    ok(f.head && f.keys && f.focus, `${S} focus: by touch, the header and the key column leave, hidden and inert`);
    ok(f.ghost === 'Show the controls' && f.layer && f.about === 'btn-about', `${S} focus: the ghost key Show the controls, the layer switch and the About key (in the caption band) stay`);
    ok(st.h > h0 && st.labels.length > 0, `${S} focus: the plate takes the freed rows, less the About key's line in the caption band (${Math.round(h0)} to ${Math.round(st.h)} px), the collar redrawn for it`);
    ok(f.live === 'Controls hidden. Press Escape or the corner key to show them.', `${S} focus: the live region's sentence`);
    const hits = await hitTargets(page);
    ok(hits.every((x) => x.w >= 44 && x.h >= 44), `${S} focus: ${hits.length} controls at 44 x 44 px or more`);
    await shot(page, `focus-${S}`);
    await page.reload(); await settle(page);
    ok(await page.evaluate(() => document.body.classList.contains('focus') && document.getElementById('head').hidden), `${S} focus: remembered after a reload`);
    await page.touchscreen.tap(...(await center(page, '#btn-about'))); await sleep(250);
    await page.keyboard.press('Escape'); await sleep(100);
    ok(await page.evaluate(() => document.getElementById('about').hidden && document.body.classList.contains('focus')), `${S} focus: Escape closes About and leaves focus mode on`);
    await page.keyboard.press('Escape'); await sleep(100);
    ok(await page.evaluate(() => !document.body.classList.contains('focus') && !document.getElementById('head').hidden && document.getElementById('live').textContent === 'Controls shown.'), `${S} focus: Escape again shows the controls`);
    await page.focus('#focus-key'); await page.keyboard.press('Enter'); await sleep(450);
    ok(await page.evaluate(() => document.activeElement.id === 'focus-exit'), `${S} focus: by keyboard, the focus moves to the ghost key`);
    await page.keyboard.press('Enter'); await sleep(100);
    ok(await page.evaluate(() => document.activeElement.id === 'focus-key' && !document.body.classList.contains('focus')), `${S} focus: the ghost key by keyboard brings the controls back, focus on the entry key`);
    endPage(log, `${S} focus`);
    await ctx.close();
  }

  if (want('widths')) {
    for (const [w, h, label] of [[320, 640, '320 px'], [360, 740, '360 px'], [375, 812, '375 px'], [312, 675, '125 % zoom (312 x 675)'], [844, 390, 'on its side (844 x 390)']]) {
      const { ctx, page, log } = await newPage(S, { viewport: { width: w, height: h } });
      await settle(page);
      const m = await page.evaluate(() => ({ sw: document.scrollingElement.scrollWidth, iw: innerWidth, stamp: document.getElementById('stamp').getBoundingClientRect().height, cap: document.getElementById('cap').scrollHeight, capbox: document.querySelector('.capbox').clientHeight }));
      const st = await state(page);
      ok(m.sw <= m.iw && m.stamp <= 17 && m.cap <= m.capbox, `${S} ${label}: no sideways scroll, the status line one line, the caption inside its fixed height`);
      if (w > h) ok(st.h >= 220, `${S} ${label}: the plate is ${Math.round(st.h)} px tall (at least 220)`);
      const hits = await hitTargets(page);
      ok(hits.every((x) => x.w >= 44 && x.h >= 44), `${S} ${label}: ${hits.length} controls at 44 x 44 px or more`);
      if (w > h && S === 'light') await shot(page, `landscape-${S}`);
      endPage(log, `${S} ${label}`);
      await ctx.close();
    }
  }

  if (want('motion')) {
    const { ctx, page, log } = await newPage(S, { reducedMotion: 'reduce' });
    await settle(page);
    const z0 = (await state(page)).zoom;
    await page.touchscreen.tap(...(await center(page, '#zoom-in')));
    await frame(page);
    ok((await state(page)).zoom === z0 + 1, `${S} Reduce Motion: a zoom key is a cut, not a flight`);
    const dur = await page.evaluate(() => getComputedStyle(document.querySelector('.card')).animationDuration);
    ok(dur === '0s', `${S} Reduce Motion: every animation at 0 s (the card's: ${dur})`);
    endPage(log, `${S} Reduce Motion`);
    await ctx.close();
  }

  if (want('offline')) {
    const { ctx, page, log } = await newPage(S, { offline: true });
    const t = await settle(page, 20000);
    const st = await state(page);
    ok(t >= 0 && st.offline && st.notice === OFFLINE_SENTENCE && (await page.textContent('#notice')) === OFFLINE_SENTENCE, `${S} kept offline: the calm sentence on the plate, "${OFFLINE_SENTENCE}"`);
    ok((await page.textContent('#stamp')) === 'The map could not be loaded.', `${S} kept offline: the status line says so`);
    ok(st.labels.length >= 4 && (await page.textContent('#cap')).startsWith('Ticks and crosses every') && (await page.textContent('#scale-len')).length > 0, `${S} kept offline: the collar, its caption and the scale still drawn`);
    const why = [...new Set(log.hostFailed)];
    ok(log.hostResp.length === 0 && log.hostFailed.length === log.hostReq.length && why.every((w) => /^csp$|BLOCKED_BY_CSP|Content Security Policy|blocked/i.test(w)), `${S} kept offline: no request reached ${HOST}: ${log.hostReq.length} pictures asked for, every one stopped by the policy (${why.join(', ') || 'none'}), no response`);
    const csp = await page.evaluate(() => window.__csp);
    ok(csp.length > 0 && csp.every((v) => /^img-src https:\/\/basemap\.nationalmap\.gov\//.test(v)), `${S} kept offline: every policy violation is the site's picture refused by img-src (${csp.length})`);
    ok((await colorShare(page)) < 0.02, `${S} kept offline: no broken pictures on the plate`);
    const tc = await textContrast(page);
    ok(tc.every((x) => x.c >= 4.5), `${S} kept offline: ${tc.length} text nodes at 4.5:1 or more`);
    await shot(page, `offline-${S}`);
    endPage(log, `${S} kept offline`, { offline: true });
    await ctx.close();
  }

  if (want('cut')) {
    let cut = true;
    const { ctx, page, log } = await newPage(S, { cut: true, route: (c) => c.route(`https://${HOST}/**`, (rt) => (cut ? rt.abort('internetdisconnected') : rt.continue())) });
    log.cutMode = true;
    await settle(page, 20000);
    let st = await state(page);
    ok(st.offline && st.notice === OFFLINE_SENTENCE, `${S} network cut: the same calm sentence`);
    ok(log.hostFailed.length > 0 && log.hostResp.length === 0, `${S} network cut: every picture failed and none answered (${log.hostFailed.length} failed requests, ${[...new Set(log.hostFailed)].join(', ')}; ${log.failedTiles.length} console lines about them)`);
    cut = false;
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await settle(page);
    st = await state(page);
    ok(!st.offline && st.notice === '' && st.view.loaded === st.view.inView && (await page.textContent('#stamp')) === 'Every tile in view has loaded.', `${S} network back: the map recovers by itself, the sentence goes (${st.view.loaded} of ${st.view.inView})`);
    endPage(log, `${S} network cut`);
    await ctx.close();
  }
}

// ── the before and after board: kept offline, then the site allowed, side by side ────────────────
if (want('board') && ENGINE === 'chromium') {
  for (const S of schemes) {
    const a = path.join(WORK, `offline-${S}.png`), b = path.join(WORK, `map-${S}.png`);
    if (!fs.existsSync(a) || !fs.existsSync(b)) { skip(`board ${S}: needs the offline and boot scenes`); continue; }
    const ctx = await browser.newContext({ viewport: { width: 860, height: 960 }, deviceScaleFactor: 2, colorScheme: S });
    const page = await ctx.newPage();
    const font = fs.readFileSync(path.join(APP, 'fonts', 'ysabeau-office-gw.woff2')).toString('base64');
    const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
    const bg = S === 'dark' ? '#141d21' : '#e8eef0', ink = S === 'dark' ? '#e6edee' : '#0f1c23', ink2 = S === 'dark' ? '#a3b1b6' : '#45555d', line = S === 'dark' ? '#2a373c' : '#c9d4d8';
    await page.setContent(`<style>@font-face{font-family:'Ysabeau Office';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:400 650}
      body{margin:0;background:${bg};color:${ink};font:400 13.5px/1.35 'Ysabeau Office'}
      .row{display:flex;gap:40px;padding:24px 20px 20px}figure{margin:0;width:390px}img{width:390px;height:844px;display:block;border:1px solid ${line}}
      figcaption{font-size:15px;font-weight:650;margin-bottom:8px}figcaption span{display:block;font-size:12.5px;font-weight:400;color:${ink2}}</style>
      <div class="row"><figure><figcaption>Before: kept offline<span>The collar and the scale, and one calm sentence</span></figcaption><img src="${img(a)}"></figure>
      <figure><figcaption>After: basemap.nationalmap.gov allowed<span>The map, as the site serves it</span></figcaption><img src="${img(b)}"></figure></div>`);
    await page.evaluate(() => document.fonts.ready);
    await sleep(200);
    const f = path.join(WORK, `before-after-${S}.png`);
    await page.screenshot({ path: f, fullPage: true });
    if (SHOTS !== WORK) fs.copyFileSync(f, path.join(SHOTS, `before-after-${S}.png`));
    ok(fs.statSync(f).size > 50000, `${S} board: before and after written (${path.relative(APP, SHOTS !== WORK ? path.join(SHOTS, path.basename(f)) : f)})`);
    await ctx.close();
  }
}

async function center(page, sel) {
  const r = await page.evaluate((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, sel);
  return r;
}

if (!want('gestures') && ENGINE !== 'chromium') skip('gestures: CDP touch is Chromium-only');
if (ENGINE !== 'chromium') skip('layer, units, card, keys, about, remember, outside, country, focus, widths, motion and board: run under Chromium');
skip('hidden: headless browsers keep document.hidden false, so the stop-on-hide path is a phone check');
await browser.close();
online.server.close(); offline.server.close();
console.log(fails.length ? `\n${fails.length} of ${checks} FAIL: SOME CHECKS FAIL` : `\nall ${checks} checks pass (${ENGINE})`);
process.exit(fails.length ? 1 : 0);
