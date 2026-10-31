// A scratch driver for debugging: opens the app, runs a snippet, prints what it returns.
//   node tools/probe.mjs "<js expression evaluated in the page after boot>" [waitMs]
import { startServer } from './serve.mjs';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium || pw.default.chromium;
const { server, port } = await startServer(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => console.log(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.__norway3d, null, { timeout: 30000 });
await new Promise((r) => setTimeout(r, Number(process.argv[3] || 3000)));
const out = await page.evaluate(process.argv[2] || 'window.__norway3d.stats()');
console.log(JSON.stringify(out, null, 1));
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await browser.close(); server.close();
