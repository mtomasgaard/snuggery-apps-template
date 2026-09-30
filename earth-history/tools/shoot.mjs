// Drive Earth's History in headless Chromium at phone size (390 × 844 CSS px, DPR 2, touch), light
// and dark; fail on any console error or warning, page error, failed request, HTTP ≥ 400, or any
// request that is not to the local server, data: or blob:; save a screenshot of each scene
// (DESIGN §13). Then, in the first theme: the full sweep — all 90 stops by ›, the age row, the
// sheet's two peek lines and the curves' three values checked against the manifest at each — and a
// scripted scrub across the slider (and a short one on the curves strip), with __eh.perf() printed.
//
//   node tools/shoot.mjs [outdir] [scene ...]
//   SCREENSHOTS=1 node tools/shoot.mjs      also writes screenshots/app.png (780 × 1688, map 49, the
//                                           sheet at peek) and ten named scenes beside it
//
// Each theme starts from a fresh profile, so the first-launch opening (DESIGN §19) runs: it is
// watched for a moment (the "opening" scene's screenshot), then ended with __eh.skipIntro() before
// the other scenes; a Reduce Motion profile checks that it never runs there. Screenshots wait for
// the resting state (the sheet's glide and any CSS animation finished).
//
// Needs Playwright: `npm install playwright` inside tools/ (tools/node_modules is git-ignored and left
// out of the ZIP) and `npx playwright install chromium`; or set PLAYWRIGHT_MODULE to another
// install's playwright/index.mjs. It serves the app folder itself on a free port; nothing is fetched
// from the network. Scenes are driven through window.__eh, which the shipped build carries inert.
// SCHEMES=light (or dark) runs one theme. Frame times are SwiftShader's: a trend, never evidence of
// phone performance.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwPath = process.env.PLAYWRIGHT_MODULE;
let pw;
try { pw = await import(pwPath || 'playwright'); } catch (e) {
  console.error(pwPath
    ? `PLAYWRIGHT_MODULE is set to ${pwPath}, but it could not be loaded (${e.code || e.message}).`
    : 'Playwright is not installed: run `npm install playwright` in tools/ (then `npx playwright install chromium`), or set PLAYWRIGHT_MODULE to a playwright/index.mjs.');
  process.exit(4);
}
const chromium = pw.chromium || pw.default.chromium;

const out = path.resolve(process.argv[2] || path.join(APP, 'tools', '.work', 'shots'));
fs.mkdirSync(out, { recursive: true });
const only = new Set(process.argv.slice(3));
const schemes = (process.env.SCHEMES || 'light,dark').split(',');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.bin': 'application/octet-stream', '.txt': 'text/plain', '.md': 'text/markdown' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;

const manifest = JSON.parse(fs.readFileSync(path.join(APP, 'data/manifest.json'), 'utf8'));
const tsUnits = new Map(JSON.parse(fs.readFileSync(path.join(APP, 'data/timescale.json'), 'utf8')).units.map((u) => [u.id, u]));
const stopOfMap = (m) => manifest.slices.findIndex((s) => s.map === m);
// The age row as DESIGN §3.3 words it, computed here from the manifest (not by the app's code).
function expectedAge(a) {
  if (a === 0) return 'Today';
  if (a < 0.1) return `${(Math.round(a * 1000) * 1000).toLocaleString('en-US').replace(/,/g, '\u202f')} years ago`;
  return `${a} million years ago`;
}
function expectedIcs(s) {
  const n = [];
  for (const r of ['period', 'epoch', 'age']) { const id = s.ics[r]; if (id) { const name = tsUnits.get(id).name; if (n[n.length - 1] !== name) n.push(name); } }
  return n.join(' · ');
}

const periodName = (s) => tsUnits.get(s.ics.period).name;
// The curves' three labels as DESIGN §3.5 words them in SI units (the default), computed here from the
// tiles; thousands grouped with a narrow no-break space, as the app prints them.
const num = (v, d) => Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/,/g, '\u202f');
const signed = (v, d) => { const t = num(v, d); return (/^[0.,\u202f]+$/.test(t) ? '' : v > 0 ? '+' : v < 0 ? '−' : '') + t; };
function expectedCurves(s) {
  const t = s.tiles;
  return [
    t.temperature ? `Temp ${num(t.temperature.c, 1)} °C` : 'Temp: no data',
    t.co2 ? `CO₂ ${num(t.co2.ppm, 0)} ppm${t.co2.kind === 'model_input' ? ', model input' : ''}` : 'CO₂: no data',
    t.sea_level ? `Sea ${signed(t.sea_level.m, 1)} m` : 'Sea: no data',
  ];
}
const APP_LON = 15, APP_LAT = 5;
/** Label boxes [[left, right], …] in order, at least 2 px apart. */
const apart = (boxes) => Array.isArray(boxes) && boxes.length > 1 && boxes.every((b, j) => j === 0 || b[0] >= boxes[j - 1][1] + 2);
const sunPct = (a) => (100 / (1 + 0.4 * a / 4700)).toFixed(1);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// The one message tolerated: SwiftShader's driver notice when Playwright reads the frame back for a
// screenshot ("GPU stall due to ReadPixels"). The app itself never calls readPixels.
const HEADLESS_NOISE = /GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels/;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

for (const [si, scheme] of schemes.entries()) {
  console.log(`\n== ${scheme} ==`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !HEADLESS_NOISE.test(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('request', (r) => { const u = r.url(); requests.push(u); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) errors.push(`EXTERNAL REQUEST: ${u}`); });
  const eh = (fn, arg) => page.evaluate(fn, arg);
  const settled = () => eh(() => window.__eh.settled());
  // A picture of the resting state: after the sheet's glide and any CSS animation or transition
  // (a card, an overlay fading in) has finished — except during the opening, which is the point.
  const rest = () => page.waitForFunction(() => !document.getElementById('app').classList.contains('flipping')
    && document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  const shot = async (name) => { await page.waitForTimeout(120); if (name !== 'opening') await rest(); await page.screenshot({ path: path.join(out, `${name}-${scheme}.png`) }); console.log(`  ${name}-${scheme}.png`); };

  const t0 = Date.now();
  await page.goto(`${origin}index.html`);
  await page.waitForFunction(() => { const l = document.getElementById('loading'); return l.classList.contains('done') || l.classList.contains('error'); }, null, { timeout: 120000 });
  const failed = await eh(() => (document.getElementById('loading').classList.contains('error') ? document.getElementById('load-msg').textContent : null));
  if (failed) { console.log('LOAD FAILED:', failed); console.log(errors.join('\n')); await browser.close(); server.close(); process.exit(1); }
  const firstPaint = Date.now() - t0;
  // The opening (DESIGN §19) runs once on a first launch: watch it for a moment, then skip it.
  const i0 = await eh(() => window.__eh.intro());
  check(i0.stored === 1 && (i0.pending || i0.running) && i0.stop === 89, `first launch: the opening is stored as seen and starts at 750 Ma (${JSON.stringify(i0)})`);
  if (!only.size || only.has('opening')) {
    await page.waitForFunction(() => window.__eh.intro().running && window.__eh.state().stop <= 60, null, { timeout: 20000 });
    await shot('opening');
    const mid = await eh(() => ({ i: window.__eh.intro(), row: window.__eh.ageRow(), roll: document.getElementById('age-roll').textContent }));
    // The rolling count stays between this map's age and its older neighbour's (DESIGN §19).
    const cnt = parseFloat(mid.roll), lo = manifest.slices[mid.i.stop].age_ma, hi = manifest.slices[Math.min(89, mid.i.stop + 1)].age_ma;
    const inRange = !mid.i.rolling || (cnt >= Math.floor(lo) && cnt <= Math.ceil(hi));
    check(mid.i.running && mid.i.stop < 89 && mid.i.fade === 1 && inRange, `the opening plays toward today: map at stop ${mid.i.stop}, "${mid.row.age}", counter ${mid.i.rolling ? `rolling at "${mid.roll}" (within ${lo}–${hi})` : 'landed'}`);
  }
  const skipped = await eh(() => window.__eh.skipIntro());
  await settled();
  const i1 = await eh(() => ({ i: window.__eh.intro(), st: window.__eh.state() }));
  check(skipped && !i1.i.running && !i1.i.pending && i1.st.stop === 0, `Skip ends the opening at today (stop ${i1.st.stop})`);
  console.log(`  first map on screen ${firstPaint} ms after navigation; full map settled ${Date.now() - t0} ms (SwiftShader, trend only)`);

  const scenes = {
    'globe-today': async () => {
      const v = await eh(() => ({ st: window.__eh.state(), row: window.__eh.ageRow(), earth: document.getElementById('earth').getBoundingClientRect().height, cache: window.__eh.perf().cache }));
      check(v.st.stop === 0 && v.row.age === 'Today', `opens at today: "${v.row.age}" · "${v.row.ics}"`);
      check(v.earth === 498, `Earth panel ${v.earth} px tall at 390 × 844 (DESIGN §3: 498)`);
      check(v.cache.A && v.cache.A.kind === 'full' && v.cache.A.stop === 0, `today's full map on screen (${JSON.stringify(v.cache.A)})`);
      check(v.st.coasts && !v.st.plates && v.st.view.mode === 'globe', 'defaults: globe, Coasts on, Plates off');
      await shot('globe-today');
    },
    'globe-49': async () => {
      await eh((i) => { window.__eh.goto(i); window.__eh.look(20, 0); }, stopOfMap(49));
      await settled();
      const row = await eh(() => window.__eh.ageRow());
      check(row.age === '251 million years ago' && row.ics === 'Triassic · Lower Triassic · Induan', `map 49: "${row.age}" · "${row.ics}"`);
      await shot('globe-49');
    },
    'map-49': async () => {
      await eh((i) => { window.__eh.goto(i); window.__eh.setView('map'); window.__eh.look(20, 0); }, stopOfMap(49));
      await settled();
      const st = await eh(() => window.__eh.state());
      check(st.view.mode === 'map' && st.view.map.lon0 === 20, `map view, central meridian ${st.view.map.lon0}°`);
      await shot('map-49');
      await eh(() => window.__eh.setView('globe'));
      const g = await eh(() => window.__eh.state());
      check(g.view.globe.lon === 20, `the view carries back to the globe (centre ${g.view.globe.lon}°)`);
    },
    'plates-43': async () => {
      await eh((i) => { window.__eh.goto(i); window.__eh.setView('globe'); window.__eh.look(0, 10); window.__eh.toggle('plates', true); }, stopOfMap(43));
      await settled();
      const v = await eh(() => ({ p: window.__eh.perf(), notice: document.getElementById('notice').textContent, hidden: document.getElementById('notice').hidden }));
      check(!v.hidden && v.notice.startsWith('Pieces of today\'s crust'), `Plates notice: "${v.notice}"`);
      check(v.p.overlay.arrows > 0, `${v.p.overlay.arrows} arrows drawn, ${v.p.overlay.emitted} of ${v.p.overlay.vertices} projected vertices stroked`);
      await shot('plates-43');
      await eh(() => window.__eh.toggle('plates', false));
    },
    'coasts-16': async () => {
      await eh((i) => { window.__eh.goto(i); window.__eh.look(-60, 20); window.__eh.toggle('coasts', true); }, stopOfMap(16));
      await settled();
      const row = await eh(() => window.__eh.ageRow());
      check(row.age === '65.5 million years ago', `map 16: "${row.age}" · "${row.ics}"`);
      await shot('coasts-16');
    },
    readout: async () => {
      // Chicago carried to map 49: turn the globe to it and tap its pin's spot with a real touch.
      const i = stopOfMap(49);
      await eh(() => window.__eh.follow(true));      // the scenes before this one turned the view by hand
      await eh((j) => window.__eh.goto(j), i);
      await settled();
      // The view follows the continents (DESIGN §19): after the step it sits on the followed centre.
      const fw = await eh(() => ({ f: window.__eh.follow(), g: window.__eh.state().view.globe }));
      const fd = fw.f.at ? Math.hypot(((fw.g.lon - fw.f.at[0] + 540) % 360) - 180, fw.g.lat - fw.f.at[1]) : 99;
      check(fw.f.on && fd < 0.06, `the view follows the continents: map 49 centred on ${fw.g.lon.toFixed(1)}°, ${fw.g.lat.toFixed(1)}° (followed point ${fw.f.at && fw.f.at.map((x) => x.toFixed(1)).join(', ')})`);
      const at = await eh(() => window.__eh.cityAt('Chicago'));
      check(Array.isArray(at), `Chicago at map 49: ${at && at.map((x) => x.toFixed(2)).join(', ')}`);
      await eh(([lon, lat]) => window.__eh.look(lon, lat), at);
      const st = await eh(() => window.__eh.state());
      check(!st.follow, 'turning the view to a place stops the following');
      const box = await page.locator('#stage').boundingBox();
      const pc = await eh(([lon, lat]) => window.__eh.project(lon, lat), at);
      await page.touchscreen.tap(box.x + pc[0], box.y + pc[1]);
      await page.waitForFunction(() => window.__eh.readout() && window.__eh.readout().length >= 3, null, { timeout: 10000 });
      await page.waitForTimeout(200);
      const r = await eh(() => window.__eh.readout());
      console.log('      ' + r.join('\n      '));
      check(r[0] === 'Here, 251 million years ago', `readout heading "${r[0]}"`);
      check(/from Chicago\./.test(r[2]) && /^This crust is now at 42° N 88° W/.test(r[2]), 'the tapped crust is now at Chicago');
      check(/PALEOMAP plate 101/.test(r[r.length - 1]) && /PaleoDEM, 250 Ma/.test(r[r.length - 1]) && /climate model, 250 Ma/.test(r[r.length - 1]), 'footnotes name the plate, the PaleoDEM and the climate slice');
      const cd = await eh(() => window.__eh.card());
      // Collapsed: a heading, two lines of "then" and two of "now" (DESIGN §19), so at most about 110 px.
      check(cd.side === 'above' && cd.top + cd.height <= pc[1] - 10 && cd.height <= 112 && cd.top >= 44, `the card is a callout above its pin: top ${cd.top.toFixed(0)} px, ${cd.height.toFixed(0)} px tall, ${cd.width.toFixed(0)} px wide, pointer ${cd.side}`);
      await shot('readout');
      await page.click('#readout-more');
      const co = await eh(() => window.__eh.card());
      check(co.open && co.height > cd.height, `"More" opens the whole card (${cd.height.toFixed(0)} → ${co.height.toFixed(0)} px)`);
      await page.click('#readout-more');
      // The pin rides its plate: one map newer, it moves with the crust.
      const before = await eh(([lon, lat]) => window.__eh.project(lon, lat), at);
      await eh(() => window.__eh.step(-1));
      const after = await eh(() => window.__eh.cityAt('Chicago'));
      const r2 = await eh(() => window.__eh.readout());
      check(r2[0] === 'Here, 248.5 million years ago' && /from Chicago\./.test(r2[2] || ''), `after ›, the readout follows the pin to map 48: "${r2[0]}"`);
      check(after[0] !== at[0] || after[1] !== at[1], `the pin moved with its plate (${before.slice(0, 2).map((x) => x.toFixed(0))} px → rotated to ${after.map((x) => x.toFixed(2)).join(', ')})`);
      const rm = await eh(() => window.__eh.readout());
      check(/ °C, \d[\d,\u202f]* mm of rain a year²/.test(rm[1]) && / km from Chicago|0 km from Chicago/.test(rm[2]) && /moving [\d.]+ cm a year/.test(rm[2]), `metric (the default): "${rm[1]}" / "${rm[2]}"`);
      await eh(() => window.__eh.setUnits('us'));
      const ru = await eh(() => window.__eh.readout());
      check(/ °F, \d[\d,\u202f.]* in of rain a year²/.test(ru[1]) && / mi from Chicago|0 mi from Chicago/.test(ru[2]) && /moving [\d.]+ in \([\d.]+ cm\) a year/.test(ru[2]), `US: "${ru[1]}" / "${ru[2]}"`);
      await eh(() => window.__eh.setUnits('metric'));
      // A tap on the open ocean at map 49: no crust, the first two lines only; the next map drops it.
      await eh(() => window.__eh.look(-150, 0));
      const po = await eh(() => window.__eh.project(-150, 0));
      await page.touchscreen.tap(box.x + po[0], box.y + po[1]);
      await page.waitForFunction(() => window.__eh.readout() && /No piece/.test(window.__eh.readout().join(' ')), null, { timeout: 10000 });
      const ro = await eh(() => window.__eh.readout());
      check(ro[2] === 'No piece of today\'s crust sits here in this reconstruction.' && !/plate/.test(ro[3] || ''), `open ocean: "${ro[1]}" / "${ro[2]}"`);
      await eh(() => window.__eh.step(1));
      check(await eh(() => window.__eh.readout() === null), 'a tap with no crust closes when the map changes');
      await eh(() => document.getElementById('readout-close').click());
      check(await eh(() => window.__eh.readout() === null), 'the close button removes the readout');
    },
    play: async () => {
      await eh(() => window.__eh.goto(10));
      await settled();
      const t = Date.now();
      await eh(() => window.__eh.play());
      await page.waitForTimeout(2100);
      const mid = await eh(() => window.__eh.state());
      await eh(() => window.__eh.pause());
      const ms = Date.now() - t, steps = 10 - mid.stop;
      check(mid.playing && steps >= 2 && steps <= 4, `play: ${steps} maps in ${ms} ms toward today (1.5 per second → 3)`);
      await eh(() => window.__eh.goto(1));
      await eh(() => window.__eh.play());
      await page.waitForTimeout(900);
      const end = await eh(() => window.__eh.state());
      check(end.stop === 0 && !end.playing, 'play stops at today');
      await eh(() => window.__eh.play());
      const re = await eh(() => window.__eh.state());
      check(re.stop === 89 && re.playing, 'pressing play at today restarts from 750 Ma');
      await eh(() => window.__eh.pause());
    },
    keyboard: async () => {
      await eh(() => window.__eh.goto(47));
      await page.focus('#slider');
      const keys = [['ArrowRight', 46], ['ArrowLeft', 47], ['PageUp', 37], ['PageDown', 47], ['Home', 89], ['End', 0]];
      const got = [];
      for (const [k, want] of keys) { await page.keyboard.press(k); const st = await eh(() => window.__eh.state().stop); got.push(`${k} → ${st}`); if (st !== want) got.push(`(expected ${want})`); }
      check(!got.some((g) => g.startsWith('(')), `slider keys: ${got.join(', ')}`);
      const aria = await eh(() => ({ now: document.getElementById('slider').getAttribute('aria-valuenow'), text: document.getElementById('slider').getAttribute('aria-valuetext'), live: document.getElementById('age-live').textContent }));
      check(aria.now === '89' && aria.text === 'Today, Quaternary' && aria.live.startsWith('Today.'), `aria at today: valuenow ${aria.now}, "${aria.text}", live "${aria.live}"`);
    },
    gestures: async () => {
      await eh(() => { window.__eh.setView('globe'); window.__eh.look(0, 0, 1); });
      const box = await page.locator('#stage').boundingBox();
      const r = await eh(() => 0.46 * Math.min(window.__eh.state().view.W, window.__eh.state().view.H - 72));
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy); await page.mouse.down();
      for (let k = 1; k <= 10; k++) await page.mouse.move(cx - 6 * k, cy, { steps: 1 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      const g = await eh(() => window.__eh.state().view.globe);
      const want = (60 / r) * 180 / Math.PI;
      check(g.lon >= want - 0.5, `drag 60 px left turns the globe east by ≥ ${want.toFixed(1)}° (now centered on ${g.lon.toFixed(1)}°; a fling may add more)`);
      await eh(() => window.__eh.look(50, 40, 2.5));
      await page.touchscreen.tap(cx, cy);
      await page.waitForTimeout(80);
      await page.touchscreen.tap(cx, cy);
      await page.waitForTimeout(450);
      const d = await eh(() => ({ g: window.__eh.state().view.globe, f: window.__eh.follow(), ro: window.__eh.readout() }));
      check(d.g.zoom === 1 && d.f.on && d.f.at && Math.abs(d.g.lat - d.f.at[1]) < 0.06 && d.ro === null, `double-tap resets the view (zoom ${d.g.zoom}, following the continents again at ${d.g.lat.toFixed(1)}°) and opens no readout`);
    },
    persist: async () => {
      await eh(() => { window.__eh.goto(30); window.__eh.setView('map'); window.__eh.toggle('plates', true); window.__eh.look(77, 0, 1.5); });
      await page.reload();
      await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
      await settled();
      const st = await eh(() => window.__eh.state());
      const ir = await eh(() => window.__eh.intro());
      check(st.stop === 30 && st.view.mode === 'map' && st.plates && st.view.map.lon0 === 77 && st.view.map.zoom === 1.5 && !ir.pending && !ir.running, `after a reload: stop ${st.stop}, ${st.view.mode} view at ${st.view.map.lon0}° × ${st.view.map.zoom}, Plates ${st.plates ? 'on' : 'off'}; no opening again`);
      await eh(() => { localStorage.setItem('eh.stop', '"broken'); localStorage.setItem('eh.globe', '{"lon":"x"}'); });
      await page.reload();
      await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
      const b = await eh(() => window.__eh.state());
      check(b.stop === 0, `a broken stored value falls back to the default (stop ${b.stop})`);
      await eh(() => { window.__eh.setView('globe'); window.__eh.toggle('plates', false); });
    },
    'context-loss': async () => {
      await eh((i) => { window.__eh.goto(i); window.__eh.look(20, 0); }, stopOfMap(49));
      await settled();
      check(await eh(() => window.__eh.loseContext()), 'WEBGL_lose_context available');
      await page.waitForFunction(() => window.__eh.state().lost, null, { timeout: 10000 });
      const n = await eh(() => document.getElementById('notice').textContent);
      check(n === 'Restoring the view…', `while lost: "${n}"`);
      await shot('context-lost');
      await eh(() => window.__eh.restoreContext());
      await page.waitForFunction(() => !window.__eh.state().lost, null, { timeout: 10000 });
      await settled();
      const c = await eh(() => ({ cache: window.__eh.perf().cache, hidden: document.getElementById('notice').hidden }));
      check(c.hidden && c.cache.A.kind === 'full' && c.cache.A.stop === stopOfMap(49) && c.cache.restores === 1, `restored: map 49 full again, notice gone, cache ${JSON.stringify(c.cache.cached)}`);
      await shot('context-restored');
    },

    'temperature-14': async () => {
      const i = stopOfMap(14), sl = manifest.slices[i];
      await eh((j) => { window.__eh.goto(j); window.__eh.setView('globe'); window.__eh.look(0, 20); window.__eh.setLens('temperature'); }, i);
      await page.waitForFunction(() => window.__eh.legend() !== null, null, { timeout: 20000 });
      await settled();
      const v = await eh(() => ({ st: window.__eh.state(), lg: window.__eh.legend(), n: window.__eh.notice(), cl: window.__eh.curvesLabel() }));
      check(v.st.climateKey === `temperature:${sl.climate}`, `map 14 (55.8 Ma) Temperature: climate slice ${sl.climate} (${sl.climate_age_ma} Ma) on the Earth (${v.st.climateKey})`);
      check(v.lg && v.lg.ticks.join(' ') === '−40 −20 0 20 40 °C' && v.lg.text === 'Air temperature, yearly mean · climate model' && /1\.5 m \(5 ft\) above the surface/.test(v.lg.label), `legend: ${v.lg && v.lg.ticks.join(' ')} · "${v.lg && v.lg.text}"`);
      check(apart(await eh(() => window.__eh.legendBoxes())), `temperature legend labels do not touch: ${JSON.stringify(await eh(() => window.__eh.legendBoxes()))}`);
      check(v.n === null, 'no notice on a map with a climate slice');
      check(JSON.stringify(v.cl) === JSON.stringify(expectedCurves(sl)), `curves: ${v.cl.join(' · ')}`);
      await shot('temperature-14');
      await eh(() => document.getElementById('legend').click());
      const m = await eh(() => ({ u: window.__eh.state().units, lg: window.__eh.legend() }));
      check(m.u === 'us' && m.lg.ticks.join(' ') === '−40 0 32 60 100 °F', `a tap on the legend switches to US units: ${m.lg.ticks.join(' ')}`);
      check(apart(await eh(() => window.__eh.legendBoxes())), 'US temperature legend labels do not touch');
      await eh(() => window.__eh.setUnits('metric'));
    },
    'rain-57': async () => {
      const i = stopOfMap(57), sl = manifest.slices[i];
      await eh((j) => { window.__eh.goto(j); window.__eh.look(20, 0); window.__eh.setLens('rain'); }, i);
      await settled();
      const v = await eh(() => ({ st: window.__eh.state(), lg: window.__eh.legend() }));
      check(v.st.climateKey === `rain:${sl.climate}` && v.lg.ticks.join(' ') === '0 250 1\u202f000 5\u202f000 mm' && v.lg.text === 'Rain and snow in an average year · climate model', `map 57 (301.2 Ma) Rain: ${v.st.climateKey}; legend ${v.lg.ticks.join(' ')} · "${v.lg.text}"`);
      const rb = await eh(() => window.__eh.legendBoxes());
      check(apart(rb), `rain legend labels do not touch (no "100200"): ${JSON.stringify(rb)}`);
      await shot('rain-57');
      await eh(() => window.__eh.setUnits('us'));
      const m = await eh(() => window.__eh.legend());
      check(m.ticks.join(' ') === '0 10 50 200 in', `US rain legend: ${m.ticks.join(' ')}`);
      const mb = await eh(() => window.__eh.legendBoxes());
      check(apart(mb), `US rain legend labels do not touch: ${JSON.stringify(mb)}`);
      await eh(() => window.__eh.setUnits('metric'));
    },
    'no-climate-93': async () => {
      await eh((j) => { window.__eh.follow(true); window.__eh.goto(j); window.__eh.setLens('temperature'); }, stopOfMap(93));
      await settled();
      const v = await eh(() => ({ st: window.__eh.state(), lg: window.__eh.legend(), n: window.__eh.notice(), cl: window.__eh.curvesLabel(), sheet: window.__eh.sheetText() }));
      check(v.n && v.n[0] === 'The climate model starts at 540 million years ago — this map has no temperature or rain.' && v.lg === null && v.st.climateKey === null && v.st.lens === 'temperature',
        `map 93 (750 Ma) with Temperature: "${v.n && v.n[0]}", no legend, the Surface drawn, the chip stays selected`);
      check(v.cl.join(' · ') === 'Temp: no data · CO₂: no data · Sea: no data', `curves at 750 Ma: ${v.cl.join(' · ')}`);
      check((v.sheet.match(/No data this far back/g) || []).length === 4 && /Before 750 million years ago/.test(v.sheet), 'sheet: four tiles say "No data this far back"; the prologue card follows the Tonian');
      await shot('no-climate-93');
      await eh(() => window.__eh.setLens('surface'));
    },
    'find-57': async () => {
      const i = stopOfMap(57);
      await eh((j) => window.__eh.goto(j), i);
      await settled();
      await page.click('#btn-find');
      const focused = await eh(() => document.activeElement && document.activeElement.id);
      await page.keyboard.type('Chicago');
      const rows = await eh(() => [...document.querySelectorAll('.find-row')].map((b) => b.innerText.replace(/\n/g, ' | ')));
      check(focused === 'find-q' && rows[0] === 'Chicago · United States of America | now 41.8° N 87.6° W', `Find opens with the field focused; "Chicago" → ${rows[0]}`);
      await shot('find-57');
      const acc = await eh(() => [window.__eh.find('sao paulo')[0], window.__eh.find('japan')[0], window.__eh.find('zzzz').length]);
      check(acc[0] && acc[0].n === 'São Paulo' && acc[1] && acc[1].c === 'Japan' && acc[2] === 0, `accents ignored ("sao paulo" → ${acc[0] && acc[0].n}), countries match ("japan" → ${acc[1] && acc[1].n}), no match → 0 rows`);
      await eh(() => window.__eh.find('Chicago'));
      await page.click('.find-row');
      await page.waitForFunction(() => window.__eh.readout() && window.__eh.readout().length >= 3, null, { timeout: 10000 });
      await settled();
      const r = await eh(() => ({ ro: window.__eh.readout(), st: window.__eh.state(), at: window.__eh.cityAt('Chicago'), hidden: document.getElementById('find').hidden }));
      console.log('      ' + r.ro.join('\n      '));
      check(r.hidden && r.st.pin.kind === 'city' && r.st.pin.n === 'Chicago' && r.ro[0] === 'Chicago, 301.2 million years ago' && /^Then: /.test(r.ro[1]) && /^Chicago is now at 42° N 88° W\./.test(r.ro[2]), 'choosing Chicago closes Find, pins it and opens its card');
      check(Math.abs(r.st.view.globe.lon - r.at[0]) < 0.01 && Math.abs(r.st.view.globe.lat - r.at[1]) < 0.01, `the Earth turned to Chicago at 301.2 Ma (${r.at.map((x) => x.toFixed(1)).join(', ')})`);
      await shot('find-57-card');
      // A city whose crust is not carried back that far: the pin hides and the card says so.
      await eh(() => window.__eh.find('Houston'));
      await eh(() => window.__eh.choose(0));
      await eh((j) => window.__eh.goto(j), stopOfMap(49));
      const h = await eh(() => ({ ro: window.__eh.readout(), at: window.__eh.cityAt('Houston') }));
      check(h.at === null && h.ro[1] === 'Houston’s crust is carried back only to 155 million years ago in this model.', `Houston at 251 Ma: "${h.ro[1]}"`);
      await page.click('#btn-find');
      await page.keyboard.press('Escape');
      const esc = await eh(() => ({ hidden: document.getElementById('find').hidden, focus: document.activeElement.id }));
      check(esc.hidden && esc.focus === 'btn-find', 'Escape closes Find and gives focus back to its button');
      await eh(() => document.getElementById('readout-close').click());
    },
    sheet: async () => {
      const i = stopOfMap(49), sl = manifest.slices[i];
      await eh((j) => { window.__eh.goto(j); window.__eh.look(20, 0); }, i);
      await settled();
      const heights = async () => eh(() => ({ earth: Math.round(document.getElementById('earth').getBoundingClientRect().height), sheet: Math.round(document.getElementById('sheet').getBoundingClientRect().height), curves: document.getElementById('curves').offsetParent !== null, st: window.__eh.state().sheet }));
      const h0 = await heights();
      check(h0.st === 0 && h0.earth === 498 && h0.sheet === 112 && h0.curves, `peek: Earth ${h0.earth} px, sheet ${h0.sheet} px, curves shown`);
      const head = await eh(() => window.__eh.sheetHead());
      check(head[0] === 'Triassic · 251.902–201.4 million years ago' && head[1] === `This map: Scotese map 49 · ${sl.label}`, `peek lines: "${head[0]}" / "${head[1]}"`);
      await page.click('#sheet-grip');
      const h1 = await heights();
      check(h1.st === 1 && h1.earth === 314 && h1.sheet === 380 && !h1.curves, `a tap on the grip → half: Earth ${h1.earth} px, sheet ${h1.sheet} px, curves hidden`);
      await shot('sheet-half');
      await page.focus('#sheet-grip');
      await page.keyboard.press('ArrowUp');
      const h2 = await heights();
      check(h2.st === 2 && h2.earth === 0 && h2.sheet === 694, `↑ on the grip → full: Earth ${h2.earth} px, sheet ${h2.sheet} px`);
      const text = await eh(() => window.__eh.sheetText());
      const t = sl.tiles;
      const want = [sl.ics_note.text, `${num(t.temperature.c, 1)} °C`, `${num(t.co2.ppm, 0)} ppm`, `${signed(t.sea_level.m, 1)} m`, `${num(t.land.land_pct, 1)}%`,
        `${sunPct(sl.age_ma)}% of today’s brightness`, 'End-Permian mass extinction', 'Siberian Traps', 'Overlays rotated to 250 Ma · Climate: model run for 250 Ma · Elevation: PaleoDEM for 250 Ma', 'License: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)'];
      const missing = want.filter((w) => !text.includes(w));
      check(missing.length === 0, `full sheet at map 49 holds the chart note, the tiles (${want.slice(1, 6).join(', ')}), the events, the Look-for pins and the sources${missing.length ? ' — missing: ' + missing.join(' | ') : ''}`);
      const links = await eh(() => document.querySelectorAll('a').length);
      check(links === 0, `no links anywhere on the page (${links} <a> elements); URLs are text`);
      await shot('sheet-full');
      await page.keyboard.press('ArrowDown');
      check((await heights()).st === 1, '↓ on the grip → half');
      // A Look-for: tapping it drops the pin, turns the Earth to it and brings the sheet down to peek.
      await page.click('.look >> text=Siberian Traps');
      await settled();
      const lk = await eh(() => ({ st: window.__eh.state(), ro: window.__eh.readout() }));
      check(lk.st.sheet === 0 && lk.st.pin.kind === 'look' && lk.ro[0] === 'Siberian Traps' && /^On this map it sits at /.test(lk.ro[2]), `Look for "Siberian Traps": sheet at peek, pin dropped, "${lk.ro[2]}"`);
      await shot('look-49');
      await eh(() => window.__eh.step(-1));
      const lk2 = await eh(() => window.__eh.readout());
      check(lk2[2] !== lk.ro[2], `the Look-for pin rides its plate to map 48: "${lk2[2]}"`);
      await eh(() => document.getElementById('readout-close').click());
    },
    about: async () => {
      await page.click('#btn-about');
      const a = await eh(() => ({ text: document.getElementById('about-body').innerText, focus: document.activeElement.id }));
      const about = JSON.parse(fs.readFileSync(path.join(APP, 'data/about.json'), 'utf8'));
      const want = [...about.caveats.map((c) => c.title), 'calls a “first draft”', 'not from measurements', about.not_shown.title,
        ...about.sources.map((x) => x.licence), ...about.sources.filter((x) => x.licence_uri).map((x) => x.licence_uri), ...about.sources.map((x) => x.retrieved), 'Earth’s History 1.0'];
      const missing = want.filter((w) => w && !a.text.includes(w));
      check(missing.length === 0 && a.focus === 'about-done', `About: ${about.caveats.length} caveats, ${about.sources.length} sources with licence, URI and retrieval date, the version line${missing.length ? ' — missing: ' + missing.join(' | ') : ''}`);
      await shot('about');
      await page.locator('.ab-version').scrollIntoViewIfNeeded();
      for (let k = 0; k < 5; k++) await page.click('.ab-version');
      const hud = await eh(() => ({ on: !document.getElementById('perf-hud').hidden, text: document.getElementById('perf-hud').textContent }));
      check(hud.on && /^frame /.test(hud.text), `five taps on the version line show the frame-time readout: "${hud.text.split('\n')[0]}"`);
      await eh(() => window.__eh.perfHud(false));
      await page.click('.units-switch.big button[data-sys="us"]');
      check((await eh(() => window.__eh.state().units)) === 'us', 'About\'s Units setting switches to US units');
      await eh(() => window.__eh.setUnits('metric'));
      await page.keyboard.press('Escape');
      check(await eh(() => document.getElementById('about').hidden && document.activeElement.id === 'btn-about'), 'Escape closes About and gives focus back');
    },
    units: async () => {
      await eh((j) => window.__eh.goto(j), stopOfMap(49));
      await settled();
      await eh(() => window.__eh.setUnits('metric'));
      const v = await eh(() => ({ cl: window.__eh.curvesLabel(), sheet: window.__eh.sheetText() }));
      const t = manifest.slices[stopOfMap(49)].tiles;
      check(v.cl[0] === `Temp ${num(t.temperature.c, 1)} °C` && v.cl[2] === `Sea ${signed(t.sea_level.m, 1)} m` && v.sheet.includes('Shelf seas (0–200 m deep)'), `metric: ${v.cl.join(' · ')}`);
      await eh(() => window.__eh.setUnits('us'));
      const u = await eh(() => window.__eh.sheetText());
      check(u.includes('Shelf seas (0–660 ft deep)'), 'US: the shelf-sea line reads in feet');
      await eh(() => window.__eh.setUnits('metric'));
    },
    a11y: async () => {
      await eh((j) => { window.__eh.goto(j); window.__eh.setSheet(1); window.__eh.setLens('temperature'); window.__eh.toggle('plates', true); window.__eh.toggle('coasts', false); }, stopOfMap(49));
      await settled();
      await eh(() => window.__eh.tap(195, 250));
      const names = await eh(() => [...document.querySelectorAll('button, [role="slider"], [role="radio"], input, [role="img"]')]
        .filter((e) => !(e.getAttribute('aria-labelledby')) && !((e.getAttribute('aria-label') || e.textContent || '').trim())).map((e) => e.id || e.className));
      check(names.length === 0, `every control has an accessible name${names.length ? ': unnamed ' + names.join(', ') : ''}`);
      const stage = await eh(() => document.getElementById('stage').getAttribute('aria-label'));
      check(/^Globe of the Earth 251 million years ago, Temperature lens, centered on /.test(stage), `Earth's label: "${stage}"`);
      const pairs = ['#age', '#ics', '.lab', '.sh-title', '.sh-map', '.sh-meta', '.sh-src', '.tile-k', '.tile-s', '.notice span', '.legend-text', '.legend-ticks span',
        '.chip[aria-checked="false"]', '.chip[aria-checked="true"]', '.toggle[aria-pressed="true"]', '.toggle[aria-pressed="false"]', '.segmented button[aria-checked="false"]',
        '.units-switch button[aria-checked="false"]', '.ro-head', '.look-text', '.era', '#top h1', '.age .u', '.sh-h', '.sh-title .rg', '.tile-v', '.lenses button[aria-checked="false"]'];
      const measure = (sels) => eh((list) => {
        const parse = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const bgOf = (el) => { const st = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let r = [255, 255, 255]; for (let k = st.length - 1; k >= 0; k--) { const c = st[k]; r = [0, 1, 2].map((j) => c[j] * c[3] + r[j] * (1 - c[3])); } return r; };
        return list.map((sel) => {
          const e = [...document.querySelectorAll(sel)].find((x) => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden');
          if (!e) return [sel, null];
          const fg = parse(getComputedStyle(e).color), bg = bgOf(e), a = lum(fg.slice(0, 3)), b = lum(bg);
          return [sel, +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))).toFixed(2)];
        });
      }, sels);
      await rest();                           // colours at rest, not mid-way through a key's cross-fade
      const res = await measure(pairs);
      await page.click('#btn-find'); await page.keyboard.type('par');
      res.push(...await measure(['.find-name', '.find-now', '#find-q', '.text-btn']));
      await page.keyboard.press('Escape');
      await page.click('#btn-about');
      res.push(...await measure(['.ab-kv', '.ab-src', '.about-body h3', '.about-body p']));
      await page.keyboard.press('Escape');
      const low = res.filter(([, r]) => r == null || r < 4.5);
      const min = res.filter(([, r]) => r != null).sort((x, y) => x[1] - y[1])[0];
      check(low.length === 0, `text contrast ≥ 4.5:1 for ${res.length} text styles (lowest ${min[0]} ${min[1]}:1)${low.length ? ' — below or not found: ' + low.map((x) => x.join(' ')).join(', ') : ''}`);
      await eh(() => { document.getElementById('readout-close').click(); window.__eh.setSheet(0); window.__eh.setLens('surface'); window.__eh.toggle('plates', false); window.__eh.toggle('coasts', true); });
    },
    'reduced-motion': async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await eh(() => window.__eh.goto(20));
      await settled();
      const b = await eh(() => { window.__eh.step(-1); return window.__eh.perf().cache.B; });
      await eh(() => window.__eh.lookFor('himalaya'));
      const v = await eh(() => ({ st: window.__eh.state(), look: window.__eh.readout() }));
      check(b === null && v.st.pin.kind === 'look', `reduced motion: a step shows no cross-fade (slot B ${JSON.stringify(b)}); turn-to jumps at once`);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await eh(() => document.getElementById('readout-close').click());
    },
    hidden: async () => {
      await eh(() => window.__eh.goto(30));
      await eh(() => window.__eh.play());
      await eh(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
      const st = await eh(() => window.__eh.state());
      await eh(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      check(!st.playing, 'the page hidden: play pauses (and fling and turn-to stop)');
    },
    rotate: async () => {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(400);
      await settled();
      const v = await eh(() => ({ st: window.__eh.state(), sheetX: document.getElementById('sheet').getBoundingClientRect().left, earth: document.getElementById('earth').getBoundingClientRect() }));
      check(v.sheetX > 400 && v.st.view.W > 400 && v.earth.height > 300, `turned to 844 × 390: two columns (the sheet from x ${Math.round(v.sheetX)}), the Earth ${Math.round(v.st.view.W)} × ${Math.round(v.st.view.H)}`);
      await shot('landscape');
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);
      const b = await eh(() => window.__eh.state().view);
      check(b.W === 390 && b.H === 498, `back to 390 × 844: the Earth ${b.W} × ${b.H}`);
    },
    'persist-2': async () => {
      await eh((j) => { window.__eh.goto(j); window.__eh.setSheet(1); window.__eh.setUnits('metric'); window.__eh.setLens('rain'); window.__eh.find('Cape Town'); window.__eh.choose(0); }, stopOfMap(49));
      await page.reload();
      await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
      await page.waitForFunction(() => window.__eh.readout() !== null, null, { timeout: 20000 });
      const st = await eh(() => ({ st: window.__eh.state(), ro: window.__eh.readout() }));
      check(st.st.sheet === 1 && st.st.units === 'metric' && st.st.lens === 'rain' && st.st.pin.kind === 'city' && st.ro[0].startsWith('Cape Town, '), `after a reload: sheet half, metric, Rain, the Cape Town pin and card ("${st.ro[0]}")`);
      await eh(() => { localStorage.setItem('eh.sheet', '7'); localStorage.setItem('eh.pin', '{"kind":"city","id":9999,"n":"Nowhere"}'); });
      await page.reload();
      await page.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
      await page.waitForFunction(() => window.__eh.state().stop >= 0 && document.getElementById('btn-find').disabled === false, null, { timeout: 20000 });
      const b = await eh(() => ({ st: window.__eh.state(), ro: window.__eh.readout() }));
      check(b.st.sheet === 0 && b.st.pin === null && b.ro === null, 'a broken stored sheet height and a pin naming no city fall back to the defaults');
      await eh(() => { window.__eh.setUnits('metric'); window.__eh.setLens('surface'); });
    },
  };

  for (const [name, fn] of Object.entries(scenes)) {
    if (only.size && !only.has(name)) continue;
    console.log(`  - ${name}`);
    try { await fn(); } catch (e) { check(false, `${name}: ${e.message}`); }
  }

  if (si === 0 && (!only.size || only.has('sweep'))) {
    console.log('  - sweep: all 90 stops by ›');
    await eh(() => { window.__eh.toggle('plates', true); window.__eh.goto(89); });
    await settled();
    let bad = 0, badSide = 0, spill = 0;
    for (let k = 0; k < 90; k++) {
      const i = 89 - k;
      if (k > 0) await page.click('#btn-next');
      const row = await eh(() => window.__eh.ageRow());
      const s = manifest.slices[i];
      const okAge = row.age === expectedAge(s.age_ma), okIcs = row.ics === expectedIcs(s);
      const okText = row.valuetext === `${expectedAge(s.age_ma)}, ${tsUnits.get(s.ics.period).name}`;
      if (!okAge || !okIcs || !okText) { bad++; console.log(`      map ${s.map}: "${row.age}" · "${row.ics}" · "${row.valuetext}" — expected "${expectedAge(s.age_ma)}" · "${expectedIcs(s)}"`); }
      const side = await eh(() => {
        const row = document.getElementById('agerow').getBoundingClientRect(), txt = document.querySelector('.age-text').getBoundingClientRect(), ics = document.getElementById('ics').getBoundingClientRect();
        return { head: window.__eh.sheetHead(), cl: window.__eh.curvesLabel(), fits: txt.top >= row.top + 1 - 0.5 && txt.bottom <= row.bottom + 0.5 && ics.bottom <= row.bottom + 0.5, box: [row.top, txt.top, txt.bottom, row.bottom].map((v) => +v.toFixed(1)) };
      });
      if (!side.fits) { spill++; console.log(`      map ${s.map}: the age row's text spills out of its 48 px (${side.box.join(', ')})`); }
      if (!side.head[0].startsWith(`${periodName(s)} · `) || side.head[1] !== `This map: Scotese map ${s.map} · ${s.label}` || JSON.stringify(side.cl) !== JSON.stringify(expectedCurves(s))) {
        badSide++; console.log(`      map ${s.map}: sheet "${side.head.join(' / ')}", curves ${side.cl.join(' · ')} — expected ${expectedCurves(s).join(' · ')}`);
      }
    }
    await settled();
    check(bad === 0, `age row equals the manifest at all 90 stops (${90 - bad} of 90)`);
    check(badSide === 0, `the sheet's peek lines and the curves' three values equal the manifest at all 90 stops (${90 - badSide} of 90)`);
    check(spill === 0, `the age row's two lines (the age, the ICS line wrapped to at most two) stay inside the row at all 90 stops (${90 - spill} of 90)`);
    const end = await eh(() => ({ st: window.__eh.state(), cache: window.__eh.perf().cache }));
    check(end.st.stop === 0 && end.cache.A.kind === 'full', `the sweep ends at today with its full map (${end.cache.decodes} decodes, ${end.cache.evicted} evicted, ${end.cache.freezes} blends frozen mid-way, ${end.cache.dropped} dropped; cache holds ${end.cache.cached.length})`);
    check(end.cache.cached.length <= 8, `cache within 8 maps (${end.cache.cached.length}, ${end.cache.gpuMiB} MiB of textures)`);

    console.log('  - scrub: a finger across the slider, 750 Ma → today');
    await eh(() => { window.__eh.toggle('plates', true); window.__eh.goto(89); window.__eh.resetPerf(); });
    await settled();
    await eh(() => window.__eh.resetPerf());
    const tr = await page.locator('#track').boundingBox();
    const y = tr.y + 17;
    await page.mouse.move(tr.x + 1, y);
    await page.mouse.down();
    let blank = 0, seen = new Set();
    for (let k = 0; k <= 120; k++) {
      await page.mouse.move(tr.x + 1 + (tr.width - 2) * (k / 120), y);
      const s = await eh(() => ({ stop: window.__eh.state().stop, shown: window.__eh.perf().cache.A }));
      seen.add(s.stop);
      if (!s.shown) blank++;
    }
    await page.mouse.up();
    await settled();
    check(blank === 0, `scrub: a map on screen at every one of 121 finger positions (${seen.size} different stops shown)`);
    const p = await eh(() => window.__eh.perf());
    console.log(`      __eh.perf() after the scrub, ${p.n} frames (SwiftShader, trend only): earth draw median ${p.summary.earth.median} ms, p95 ${p.summary.earth.p95}; overlay median ${p.summary.overlay.median} ms, p95 ${p.summary.overlay.p95}; frame total median ${p.summary.total.median} ms, p95 ${p.summary.total.p95}, max ${p.summary.total.max}; last rotation ${p.rotateMs} ms; overlay stroked ${p.overlay.emitted} of ${p.overlay.vertices} vertices; cache ${JSON.stringify(p.cache.cached)}`);
    await eh(() => window.__eh.toggle('plates', false));

    console.log('  - scrub on the curves strip');
    const cv = await page.locator('#curves').boundingBox();
    await page.mouse.move(cv.x + cv.width - 2, cv.y + 40);
    await page.mouse.down();
    const before = await eh(() => window.__eh.state().stop);
    await page.mouse.move(cv.x + cv.width * 0.5, cv.y + 40, { steps: 8 });
    await page.mouse.up();
    await settled();
    const after = await eh(() => window.__eh.state().stop);
    const x = await eh(() => { const t = document.getElementById('track').getBoundingClientRect(), c = document.getElementById('curves-canvas').getBoundingClientRect(); return [t.left, t.width, c.left, c.width]; });
    check(after !== before && after > 0 && Math.abs(x[0] - x[2]) < 0.5 && Math.abs(x[1] - x[3]) < 0.5, `dragging on the curves scrubs like the slider (stop ${before} → ${after}); strip and track share their x axis (${x.map((n) => n.toFixed(1)).join(', ')})`);
  }

  if (si === 0 && process.env.SCREENSHOTS && !only.size) {
    // The README picture: the Permian–Triassic boundary on the globe, the sheet at peek.
    await eh(([j, lon, lat]) => { window.__eh.setView('globe'); window.__eh.setLens('surface'); window.__eh.toggle('plates', false); window.__eh.toggle('coasts', true); window.__eh.setSheet(0); window.__eh.goto(j); window.__eh.look(lon, lat); }, [stopOfMap(49), APP_LON, APP_LAT]);
    await eh(() => { const b = document.getElementById('readout-close'); if (!document.getElementById('readout').hidden) b.click(); });
    await settled();
    fs.mkdirSync(path.join(APP, 'screenshots'), { recursive: true });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(APP, 'screenshots', 'app.png') });
    console.log('  screenshots/app.png');
  }

  if (si === 0 && (!only.size || only.has('opening'))) {
    // Under Reduce Motion the opening never runs, even on a first launch.
    const rc = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, reducedMotion: 'reduce' });
    const rp = await rc.newPage();
    rp.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !HEADLESS_NOISE.test(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
    rp.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await rp.goto(`${origin}index.html`);
    await rp.waitForFunction(() => document.getElementById('loading').classList.contains('done'), null, { timeout: 60000 });
    await rp.evaluate(() => window.__eh.ready());
    const ri = await rp.evaluate(() => ({ i: window.__eh.intro(), stop: window.__eh.state().stop }));
    check(!ri.i.pending && !ri.i.running && ri.stop === 0, `reduced motion: no opening on a first launch (stop ${ri.stop})`);
    await rc.close();
  }

  const external = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'));
  check(errors.length === 0, `no console errors or warnings, page errors, failed requests (${requests.length} requests, ${external.length} outside the local server)${errors.length ? ':\n      ' + errors.join('\n      ') : ''}`);
  await ctx.close();
}

await browser.close();
server.close();
if (process.env.SCREENSHOTS && !only.size) {
  // A few named scenes beside app.png (screenshots/ is left out of the ZIP).
  for (const n of ['opening-dark', 'temperature-14-light', 'rain-57-dark', 'plates-43-dark', 'readout-light', 'sheet-half-light', 'about-light', 'map-49-dark', 'no-climate-93-light', 'landscape-light']) {
    const f = path.join(out, `${n}.png`);
    if (fs.existsSync(f)) { fs.copyFileSync(f, path.join(APP, 'screenshots', `${n}.png`)); console.log(`screenshots/${n}.png`); }
  }
}
if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
