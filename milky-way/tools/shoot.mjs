// Drive the app in headless Chromium at phone size, fail on any console error, and save screenshots
// of a set of scenes. Used to check the app end to end and to make screenshots/app.png.
//
//   node tools/shoot.mjs [outdir] [scene ...]
//
// It serves the app folder itself on a free port; nothing is fetched from the network. Scenes are
// driven through the small window.__mw hook app.js exposes for exactly this purpose.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, '..');
const pw = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs');
const chromium = pw.chromium || pw.default.chromium;

const out = path.resolve(process.argv[2] || path.join(APP, 'tools', '.work', 'shots'));
fs.mkdirSync(out, { recursive: true });
const only = new Set(process.argv.slice(3));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.txt': 'text/plain' };
// STUB=1 serves empty stand-ins for files a pipeline step has not written yet, so the parts that do
// exist can be tested early. Test-only: nothing here is ever written into data/.
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAAAAADRSSBWAAAAC0lEQVR4nGNgYAAAAAMAAbitOmMAAAAASUVORK5CYII=', 'base64');
const STUBS = {
  '/js/smallbodies.js': ['text/javascript', "export async function loadSmallBodies() { return { count: 0, labelled: [], kind: () => 'other', name: () => '', positionsAt() {}, orbitPath: () => new Float32Array(3) }; }"],
  '/data/tex/textures.json': ['application/json', '{"bodies":{},"colours":{}}'],
  '/data/sky/sky.json': ['application/json', '{"file":"stub.png"}'],
  '/data/sky/stub.png': ['image/png', PNG_1PX],
  '/data/galaxy/galaxy.json': ['application/json', '{"frame":{"to_icrs":[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],"sun_kpc":[-8,0,0],"r0_kpc":8,"refs":[]},"arms_reid2019":[],"arms_drimmel2024":[],"globulars":[],"satellites":[],"streams":[]}'],
};
const stubbed = new Set();
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(APP, u === '/' ? 'index.html' : u);
  if (process.env.STUB && STUBS[u] && !fs.existsSync(f)) { stubbed.add(u); res.writeHead(200, { 'content-type': STUBS[u][0] }); res.end(STUBS[u][1]); return; }
  if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const W = +(process.env.W || 390), H = +(process.env.H || 844), DPR = +(process.env.DPR || 2);
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
page.on('response', (r) => { if (r.status() >= 400 && !(process.env.STUB && r.url().endsWith('/about.json'))) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
page.on('request', (r) => { if (!r.url().startsWith(`http://127.0.0.1:${port}/`) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`EXTERNAL REQUEST: ${r.url()}`); });

const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => document.getElementById('loading').classList.contains('done') || document.getElementById('loading').classList.contains('error'), null, { timeout: 180000 });
const loadMs = Date.now() - t0;
const failed = await page.evaluate(() => document.getElementById('loading').classList.contains('error') ? document.getElementById('load-msg').textContent : null);
if (failed) { console.log('LOAD FAILED:', failed); console.log(errors.join('\n')); process.exit(1); }
console.log(`loaded in ${loadMs} ms`);

const settle = async (ms = 400) => {
  await page.waitForFunction(() => window.__mw && !window.__mw.rig.animating, null, { timeout: 60000 });
  await page.waitForTimeout(ms);
};
const shot = async (name) => { await page.screenshot({ path: path.join(out, `${name}.png`) }); console.log(`  ${name}.png`); };

const scenes = {
  solar: async () => { await page.evaluate(() => window.__mw.goScale('solar')); await settle(); await shot('solar'); },
  inner: async () => { await page.evaluate(() => window.__mw.flyTo('sun', 3.2)); await settle(); await shot('inner'); },
  earth: async () => { await page.evaluate(() => { window.__mw.select('earth'); window.__mw.flyTo('earth'); }); await settle(); await shot('earth'); },
  moon: async () => { await page.evaluate(() => window.__mw.flyTo('earth', 0.006)); await settle(); await shot('earth-moon'); },
  jupiter: async () => { await page.evaluate(() => { window.__mw.select(null); window.__mw.flyTo('jupiter', 0.02); }); await settle(); await shot('jupiter-moons'); },
  saturn: async () => { await page.evaluate(() => window.__mw.flyTo('saturn')); await settle(); await shot('saturn'); },
  mars: async () => { await page.evaluate(() => window.__mw.flyTo('mars')); await settle(); await shot('mars'); },
  play: async () => {
    await page.evaluate(() => { window.__mw.goScale('solar'); });
    await settle();
    await page.evaluate(() => { window.__mw.S.speed = 3; window.__mw.S.playing = true; window.__mw.invalidate(); });
    await page.waitForTimeout(4000);
    await page.evaluate(() => { window.__mw.S.playing = false; });
    await shot('playing');
  },
  stars: async () => { await page.evaluate(() => window.__mw.goScale('stars')); await settle(); await shot('stars'); },
  orion: async () => { await page.evaluate(() => window.__mw.flyTo('sun', 206265 * 60)); await settle(); await shot('stars-60pc'); },
  galaxy: async () => { await page.evaluate(() => window.__mw.goScale('galaxy')); await settle(); await shot('galaxy'); },
  edge: async () => { await page.evaluate(() => { const m = window.__mw; m.flyTo('gal:centre', 206265e3 * 30, m.edgeDir()); }); await settle(); await shot('galaxy-edge'); },
  debug: async () => { await page.evaluate(() => window.__mw.goScale('solar')); await settle(); console.log(JSON.stringify(await page.evaluate(() => ({ c: window.__mw.candidates().filter((c) => c.pri > 50), placed: window.__mw.placed() })))); },
  search: async () => { await page.evaluate(() => { document.getElementById('btn-search').click(); }); await page.fill('#search-q', 'sirius'); await page.waitForTimeout(300); await shot('search'); await page.evaluate(() => document.querySelector('[data-close]').click()); },
};
for (const [name, fn] of Object.entries(scenes)) {
  if (only.size && !only.has(name)) continue;
  const t = Date.now();
  try { await fn(); } catch (e) { errors.push(`scene ${name}: ${e.message}`); }
  console.log(`  scene ${name}: ${Date.now() - t} ms`);
}
const stats = await page.evaluate(() => window.__mw && window.__mw.stats ? window.__mw.stats() : null);
if (stats) console.log('render stats:', JSON.stringify(stats));
await browser.close();
server.close();
if (stubbed.size) console.log('STUBBED (not yet built):', [...stubbed].join(', '));
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2); }
console.log('no console errors');
