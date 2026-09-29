// Drive Snug Kart in headless Chromium at phone size (390 × 844 CSS px, DPR 2, touch), fail on any
// console error or warning, page error, failed request, HTTP ≥ 400, or any request that is not to
// the local server, data: or blob:, and save screenshots of each scene (DESIGN.md §17.3).
//
//   node tools/shoot.mjs [outdir] [scene ...]
//
// Needs Playwright: `npm install playwright` inside tools/ (tools/node_modules is git-ignored and
// left out of the ZIP), then `npx playwright install chromium` once; or point PLAYWRIGHT_MODULE at
// another install's playwright/index.mjs.
//
// It serves the app folder itself on a free port; nothing is fetched from the network. Scenes are
// driven through window.__sk, which the shipped build carries (inert unless called).
// TIMING=1 also runs 11 s of a real-time race and prints the JS ms per frame (trend only: SwiftShader
// frame times are not evidence of phone performance).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '..');
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

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain', '.md': 'text/markdown' };
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
const W = +(process.env.W || 390), H = +(process.env.H || 844), DPR = +(process.env.DPR || 2);
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true, colorScheme: process.env.SCHEME || 'light' });
const page = await ctx.newPage();
const errors = [], requests = [];
// The one message tolerated: SwiftShader's driver notice when Playwright reads the frame back for a
// screenshot ("GPU stall due to ReadPixels"). The app itself never calls readPixels.
const HEADLESS_NOISE = /GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels/;
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !HEADLESS_NOISE.test(m.text())) errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
page.on('request', (r) => { const u = r.url(); requests.push(u); if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) errors.push(`EXTERNAL REQUEST: ${u}`); });

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`    ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
const sk = (fn, arg) => page.evaluate(fn, arg);
const shot = async (name) => { await page.screenshot({ path: path.join(out, `${name}.png`) }); console.log(`  ${name}.png`); };
const BUDGET = { high: { tris: 150000, calls: 50 }, low: { tris: 90000, calls: 35 } };
const statsLine = (s) => `${s.track} ${s.quality}: ${s.calls} calls, ${s.triangles} tris, ${s.geometries} geometries, ${s.textures} textures, ×${s.pixelRatio}, built in ${s.buildMs} ms`;
const budgets = async (label) => {
  for (const q of ['high', 'low']) {
    await sk(async (q) => { const st = window.__sk.state(); await window.__sk.startRace({ track: window.__sk.stats().track, quality: q, seed: 3, autopilot: true }); window.__sk.freeze(true); window.__sk.advance(20); }, q);
    const s = await sk(() => window.__sk.stats());
    console.log(`    ${statsLine(s)}`);
    check(s.triangles <= BUDGET[q].tris && s.calls <= BUDGET[q].calls, `${label} ${q} within budget (${s.calls}/${BUDGET[q].calls} calls, ${s.triangles}/${BUDGET[q].tris} tris)`);
  }
  await sk(() => window.__sk.startRace({ quality: 'high', seed: 3, autopilot: true }));
};

const t0 = Date.now();
await page.goto(`${origin}index.html`);
await page.waitForFunction(() => document.getElementById('loading').classList.contains('done') || document.getElementById('loading').classList.contains('error'), null, { timeout: 120000 });
const failed = await sk(() => document.getElementById('loading').classList.contains('error') ? document.getElementById('load-msg').textContent : null);
if (failed) { console.log('LOAD FAILED:', failed); console.log(errors.join('\n')); await browser.close(); server.close(); process.exit(1); }
console.log(`loaded in ${Date.now() - t0} ms`);
await sk(() => window.__sk.adaptive(false));   // keep the pixel ratio fixed so shots and stats are comparable

const scenes = {
  title: async () => {
    await page.waitForTimeout(600);
    const v = await sk(() => ({ card: !!document.getElementById('track-name').textContent && !document.getElementById('title').hidden, faces: document.querySelectorAll('.racer canvas').length, scroll: document.querySelector('.title-panel').scrollHeight <= document.querySelector('.title-panel').clientHeight + 1 }));
    check(v.card && v.faces === 8, `title shows the track card and ${v.faces} racer faces`);
    check(v.scroll, 'title panel fits without scrolling at this size');
    await shot('title');
  },
  countdown: async () => {
    // The swoop frames the player's kart: every rival behind it on the grid stays hidden until Go.
    // A first race shows one line on drifting under the numerals; Go takes it away.
    await sk(async () => { localStorage.removeItem('snugkart:v1:hints'); await window.__sk.startRace({ track: 'harbour', racer: 'pip', seed: 1 }); window.__sk.freeze(true); window.__sk.advance(0.3); });
    await page.waitForTimeout(200);
    const behind = () => sk(() => { const ks = window.__sk.karts(), P = ks.find((k) => k.player); return ks.filter((k) => !k.player && k.dist < P.dist - 1); });
    const b0 = await behind();
    check(b0.length === 2 && b0.every((k) => !k.visible), `countdown 0.3 s: the ${b0.length} rivals behind the player are hidden (${b0.map((k) => `${k.id} ${k.visible ? 'shown' : 'hidden'}`).join(', ')})`);
    // The numeral's pop is a 0.9 s CSS animation in real time, while the race is simulated: the first
    // advance (shader compiles) outlasts it, so "3" had faded before the shot. Pin each numeral's
    // animation at the moment the shot stands for (the 3 appears at 0 s, the 2 at 1 s, the 1 at 2 s).
    const popAt = (ms) => sk((ms) => {
      const c = document.getElementById('count'), a = c.getAnimations()[0];
      if (a) { a.pause(); a.currentTime = ms; }
      return { text: c.textContent, shown: !c.hidden, opacity: +getComputedStyle(c).opacity };
    }, ms);
    const p3 = await popAt(300);
    check(p3.text === '3' && p3.shown && p3.opacity > 0.99, `countdown 0.3 s: "${p3.text}" on screen (opacity ${p3.opacity})`);
    await shot('countdown-0.3');
    await sk(() => window.__sk.advance(0.9));
    await page.waitForTimeout(250);
    await popAt(200);
    const n = await sk(() => ({ n: document.getElementById('count').textContent, hint: document.getElementById('hint').hidden ? null : document.getElementById('hint').textContent }));
    check(n.n === '2', `countdown shows "${n.n}" at 1.2 s`);
    check(!!n.hint, `first race: the drift hint shows ("${n.hint}")`);
    const b1 = await behind();
    check(b1.every((k) => !k.visible), `countdown 1.2 s: rivals behind still hidden (${b1.map((k) => k.id).join(', ')})`);
    await shot('countdown');
    await sk(() => window.__sk.advance(1.2));
    await page.waitForTimeout(200);
    const p1 = await popAt(400);
    check(p1.text === '1' && p1.shown && p1.opacity > 0.99, `countdown 2.4 s: "${p1.text}" on screen (opacity ${p1.opacity})`);
    await shot('countdown-2.4');
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
    const f = await sk(() => ({ banner: document.getElementById('banner').textContent, shown: document.getElementById('banner').classList.contains('show') }));
    check(/^Finished \d(st|nd|rd|th)$/.test(f.banner) && f.shown, `finish banner "${f.banner}"`);
    await shot('finish');
    await sk(() => window.__sk.advance(400));
    await page.waitForTimeout(300);
    const r = await sk(() => ({ rows: document.querySelectorAll('#res-list li').length, screen: window.__sk.state().screen, best: localStorage.getItem('snugkart:v1:best:pinewood') }));
    check(r.screen === 'results' && r.rows === 8, `results: ${r.rows} rows on screen "${r.screen}"`);
    check(!!r.best && JSON.parse(r.best).lap > 0, `best lap written to localStorage: ${r.best}`);
    await shot('results');
  },
  // After the finish banner, a tap in the middle of the screen skips the wait for the stragglers.
  // Seed 9 on Pinewood Pass: the player (autopilot) finishes 3rd and the last kart 3.4 s later.
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
    // Sound is off until the chip is tapped; the tap creates the AudioContext (a user gesture).
    await sk(() => window.__sk.showTitle());
    await page.waitForTimeout(300);
    const a = await sk(() => window.__sk.state());
    check(!a.settings.sound && a.audio === 'none', `sound off by default, no AudioContext yet (${a.audio})`);
    await page.tap('#chips .chip:nth-child(1)');
    await page.waitForTimeout(300);
    const b = await sk(() => ({ st: window.__sk.state(), note: document.getElementById('chip-note').textContent }));
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
    await page.tap('#chips .chip:nth-child(1)');
    await page.waitForTimeout(200);
    const f = await sk(() => window.__sk.state());
    check(!f.settings.sound && f.audio === 'suspended', `tapping again turns it off (${f.audio})`);
  },
  tilt: async () => {
    await sk(() => window.__sk.showTitle());
    await page.waitForTimeout(200);
    // iOS's permission prompt, stubbed: refused → the chip stays off and says why.
    await sk(() => { DeviceOrientationEvent.requestPermission = async () => 'denied'; });
    await page.tap('#chips .chip:nth-child(2)');
    await page.waitForTimeout(300);
    const a0 = await sk(() => ({ st: window.__sk.state(), note: document.getElementById('chip-note').textContent }));
    check(!a0.st.settings.tilt && /isn't available/.test(a0.note), `motion permission refused: tilt stays off ("${a0.note}")`);
    // Granted, but no readings ever arrive (a desktop): still off.
    await sk(() => { DeviceOrientationEvent.requestPermission = async () => 'granted'; });
    await page.tap('#chips .chip:nth-child(2)');
    await page.waitForTimeout(1100);
    const a = await sk(() => ({ st: window.__sk.state(), note: document.getElementById('chip-note').textContent }));
    check(!a.st.settings.tilt && /isn't available/.test(a.note), `granted but no orientation readings: tilt stays off ("${a.note}")`);
    // Granted and readings arrive (a phone): the chip turns on.
    await sk(() => { window.__tiltG = 5; window.__tiltTimer = setInterval(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta: 40, gamma: window.__tiltG })), 50); });
    await page.tap('#chips .chip:nth-child(2)');
    await page.waitForTimeout(1100);
    const b = await sk(() => ({ st: window.__sk.state(), note: document.getElementById('chip-note').textContent }));
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
    await page.tap('#chips .chip:nth-child(2)');
    const f = await sk(() => window.__sk.state());
    check(!f.settings.tilt, 'tapping the chip again turns tilt off');
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
  // A full run driven through the real title-screen UI rather than startRace's options: cycle to
  // track 2 (Pinewood Pass), pick a racer by tapping its face, tap Race, sit through the countdown,
  // then let the race itself run at simulated speed (the advance hook — a time-scale; the
  // navigation around it is real taps) through all three laps to the results screen, and
  // back to the title with "Change".
  journey: async () => {
    await sk(() => window.__sk.showTitle());
    await page.waitForTimeout(300);
    const before = await sk(() => document.getElementById('track-name').textContent);
    await page.click('#track-next');
    await page.waitForTimeout(200);
    const after = await sk(() => document.getElementById('track-name').textContent);
    check(before === 'Harbour Loop' && after === 'Pinewood Pass', `title-next cycles track 1 → 2: "${before}" → "${after}"`);
    await page.click('.racer[data-id="otto"]');
    await page.waitForTimeout(150);
    const picked = await sk(() => document.querySelector('.racer[aria-checked="true"]').dataset.id);
    check(picked === 'otto', `tapping a racer face selects it: "${picked}"`);
    await shot('journey-title');
    await page.click('#btn-race');
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
    await page.waitForTimeout(300);
    const res = await sk(() => ({ screen: window.__sk.state().screen, rows: document.querySelectorAll('#res-list li').length }));
    check(res.screen === 'results' && res.rows === 8, `results reached through the real UI: ${res.rows} rows, screen "${res.screen}"`);
    await shot('journey-results');
    await page.click('#btn-change');
    await page.waitForTimeout(200);
    const back = await sk(() => window.__sk.state().screen);
    check(back === 'title', `"Change" returns to the title (screen "${back}")`);
  },
  // Snuggery empties sessionStorage on every launch and mini-apps run in one long-lived WKWebView, so
  // the only persistence that must survive is localStorage — a page reload approximates both a fresh
  // launch and returning to a backgrounded tab. A race in progress does not (and must not) survive;
  // a best time already recorded must.
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
    await shot('reload-title');
  },
};

async function raceScene(track, extras = false) {
  await sk(async (track) => { await window.__sk.startRace({ track, racer: 'mabel', seed: 7, autopilot: true, quality: 'high' }); window.__sk.freeze(true); window.__sk.advance(20); }, track);
  if (extras) {
    // A held tier-2 drift (mint sparks) and a Paper Plane in hand, for screenshots/app.png.
    await sk(() => { window.__sk.giveItem('plane'); window.__sk.setAutopilot(false); });
    await page.keyboard.down('Space');
    await sk(() => { window.__sk.setDrift(2); window.__sk.advance(0.25); });
  }
  await page.waitForTimeout(300);
  const s = await sk(() => ({ st: window.__sk.state(), pos: document.getElementById('pos-n').textContent, lap: document.getElementById('lap').textContent, map: document.getElementById('minimap').width }));
  check(s.pos >= 1 && /Lap [1-3]\/3/.test(s.lap) && s.map > 0 && s.st.phase === 'racing', `${track}: place ${s.pos}, "${s.lap}", mini-map ${s.map}px, v ${s.st.v.toFixed(1)} m/s`);
  await shot(`race-${track}`);
  if (extras) await page.keyboard.up('Space');
  await budgets(track);
}

for (const [name, fn] of Object.entries(scenes)) {
  if (only.size && !only.has(name)) continue;
  const t = Date.now();
  console.log(`scene ${name}`);
  try { await fn(); } catch (e) { fails.push(`scene ${name}: ${e.message}`); console.log(`    FAIL ${e.message}`); }
  console.log(`  (${Date.now() - t} ms)`);
}

// The README's picture and the two beside it (SAVE=1 writes them into screenshots/).
if (process.env.SAVE) {
  const dir = path.join(APP, 'screenshots');
  // Results first, so the title's track card then shows the best it set.
  await sk(async () => {
    localStorage.removeItem('snugkart:v1:best:harbour');
    await window.__sk.startRace({ track: 'harbour', racer: 'juno', seed: 5, autopilot: true, quality: 'high' }); window.__sk.freeze(true);
    for (let i = 0; i < 100 && !window.__sk.state().finished; i++) window.__sk.advance(2);
    window.__sk.advance(400);
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, 'results.png') });
  await sk(() => window.__sk.showTitle());
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(dir, 'title.png') });
  await sk(async (t) => {
    await window.__sk.startRace({ track: 'pinewood', racer: 'mabel', seed: 7, autopilot: true, quality: 'high' }); window.__sk.freeze(true);
    window.__sk.advance(t);
    window.__sk.setAutopilot(false); window.__sk.giveItem('plane');
  }, +(process.env.APP_T || 26));
  await page.keyboard.down('Space');
  await sk(() => { window.__sk.setDrift(2); window.__sk.advance(0.25); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'app.png') });
  await page.keyboard.up('Space');
  console.log('saved screenshots/results.png, title.png, app.png');
}

if (process.env.PROFILE) {
  // Real-time frames with all eight karts and a crowded item field, on the longest track (Lantern
  // Night) and the heaviest (Pinewood Pass), High quality at the full pixel ratio. SwiftShader: trend
  // only, never evidence of phone speed. JS ms is simulate + render submission per frame.
  for (const track of ['lantern', 'pinewood']) {
    const t = await sk(async (track) => {
      await window.__sk.startRace({ track, racer: 'pip', seed: 9, autopilot: true, quality: 'high' });
      window.__sk.adaptive(false); window.__sk.freeze(true); window.__sk.advance(10);
      for (const id of ['yarn', 'honey', 'plane', 'quilt']) { window.__sk.giveAll(id); window.__sk.useAll(); }
      const start = window.__sk.state().items;
      window.__sk.freeze(false);
      const frames = []; let last = performance.now();
      await new Promise((res) => { const f = (now) => { frames.push(now - last); last = now; if (frames.length < 240) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      const st = window.__sk.stats(), s = window.__sk.state();
      frames.shift(); frames.sort((a, b) => a - b);
      return { st, med: frames[frames.length >> 1], p90: frames[Math.floor(frames.length * 0.9)], items: start };
    }, track);
    console.log(`profile ${track} (High, ×${t.st.pixelRatio}, 240 frames, 8 karts, starting with ${t.items.yarns} snares, ${t.items.honeys} puddles, ${t.items.planes} planes and every quilt up): JS ${t.st.jsMs} ms/frame, frame interval median ${t.med.toFixed(1)} ms, p90 ${t.p90.toFixed(1)} ms; ${t.st.calls} calls, ${t.st.triangles} tris`);
    check(t.st.calls <= 50 && t.st.triangles <= 150000, `profile ${track}: within the High budget`);
  }
}

if (process.env.TIMING) {
  const t = await sk(async () => {
    await window.__sk.startRace({ track: 'pinewood', racer: 'pip', seed: 9, autopilot: true, quality: 'high' });
    window.__sk.freeze(false); window.__sk.adaptive(true);
    await new Promise((r) => setTimeout(r, 11000));
    return window.__sk.stats();
  });
  console.log(`real-time race, SwiftShader (trend only): ${t.fps} fps, ${t.jsMs} ms JS per frame, ${t.calls} calls, ${t.triangles} tris`);
  check(t.pixelRatio < 2, `adaptive resolution stepped down under a slow GPU (pixel ratio ${t.pixelRatio})`);
}

await browser.close();
server.close();
const outside = requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:'));
console.log(`${requests.length} requests, ${outside.length} outside the app`);
if (errors.length) { console.log('ERRORS:\n' + [...new Set(errors)].join('\n')); process.exit(2); }
if (fails.length) { console.log('FAILED CHECKS:\n' + fails.join('\n')); process.exit(3); }
console.log('no console errors; all checks pass');
