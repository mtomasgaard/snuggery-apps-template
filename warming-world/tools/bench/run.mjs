// Renderer bench for Warming World (DESIGN.md §5.1). Not shipped (tools/ is left out of the ZIP).
//   scripts/warming_world/.venv/bin/python warming-world/tools/bench/make_frames.py   # → tools/.work/bench/bench.json
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node warming-world/tools/bench/run.mjs [chromium,args]
// Prints bench.html's one-shot timings (decode, Canvas 2D raster, WebGL2 array texture) and raf.html's
// frame-paced runs at DPR 2 and 3. Headless Chromium on SwiftShader: a trend, never phone evidence.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), work = path.join(here, '../.work/bench');
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const srv = http.createServer((q, r) => {
  const name = path.basename(decodeURIComponent(q.url.split('?')[0]));
  for (const dir of [here, work]) { const f = path.join(dir, name); if (fs.existsSync(f)) {
    r.writeHead(200, { 'content-type': name.endsWith('.html') ? 'text/html' : 'application/json' }); return r.end(fs.readFileSync(f)); } }
  r.writeHead(404); r.end();
}).listen(0);
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await pw.chromium.launch({ args: (process.argv[2] || '').split(',').filter(Boolean) });
async function run(url, dpr) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr })).newPage();
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(base + url); await page.waitForFunction(() => document.title === 'done', null, { timeout: 180000 });
  const out = await page.evaluate(() => window.__out); await page.close(); return out;
}
console.log(JSON.stringify(await run('/bench.html', 2)));
for (const [mode, dpr] of [['2d', 2], ['gl', 2], ['2d', 3], ['gl', 3]]) console.log(JSON.stringify(await run(`/raf.html?mode=${mode}&dpr=${dpr}`, dpr)));
await browser.close(); srv.close();
