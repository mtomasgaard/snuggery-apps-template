// Frame times of the map's gestures in headless Chromium and WebKit at 390 × 844 CSS px, DPR 2 (plan 0012,
// package 3.1: the owner's "moving around the map does not really work - way too laggy"). Each engine runs
// the same three gestures over the Lower 48 (at twice the chip's scale) in two states (Live Month, the opening's; History All at M 2.5+,
// the heaviest, 403 421 rows), and once more over California's faults at twice the California chip's
// scale (the densest lines): a one-finger pan for 3 s, the same finger locked to the frames, a fling,
// and a two-finger pinch out and in.
//   STATES=california node tools/frametime.mjs      one state
//
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/frametime.mjs [outdir]
//   ENGINES=chromium node tools/frametime.mjs         one engine
//
// What it records, per gesture:
//   - every requestAnimationFrame delta, from a rAF loop of its own (the display's frames, not the app's);
//   - the app's own frames (window.__uq._.perf.frames): the whole frame and each part (gl = the points'
//     draw call, base, relief, lines, over = the static layers' redraws, strip, sheet), so a frame's time
//     can be split by where it goes;
//   - time spent inside getBoundingClientRect, computed-style reads and clientWidth/clientHeight while
//     the gesture runs (a read after a write forces style or layout there, so this is that cost);
//   - long tasks (Chromium only: WebKit has no PerformanceObserver for them);
//   - Chromium only: a performance trace, summarized as the renderer main thread's script, style, layout
//     and paint time and the GPU thread's busy time inside the gesture's window;
//   - how far the map moved against how far the finger moved (1.00 is a map that stays under the finger).
//
// How the gestures are driven. Chromium: real touches through CDP's Input.dispatchTouchEvent, one and two
// points. WebKit: Playwright has no touch input there but a tap, so the pan and fling go through its mouse
// (real input, pointerType "mouse"), and the pinch is two synthetic touch PointerEvents dispatched on the
// map in the page. Events are paced at 60 Hz by the wall clock.
//
// Headless engines are not a phone (Chromium rasterizes on SwiftShader, on the CPU; this Mac's WebKit on its GPU): these
// numbers compare one build with another on this machine, and say nothing about a phone. The phone's own
// figure is the app's frame-time readout (About → five taps on the version line), which prints the same
// median and 95th percentile of the last gesture's frame intervals that this script prints as "raf".

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// APP_DIR serves another copy of the app (an older build, for a before and after on the same machine)
const APP = path.resolve(process.env.APP_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
let pw;
try { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); } catch (e) {
  console.error(`Playwright could not be loaded (${e.code || e.message}): set PLAYWRIGHT_MODULE to a playwright/index.mjs.`); process.exit(4);
}
pw = pw.chromium ? pw : pw.default;
const out = path.resolve(process.argv[2] || path.join(APP, 'tools', '.work', 'frametime'));
fs.mkdirSync(out, { recursive: true });
const engines = (process.env.ENGINES || 'chromium,webkit').split(',');
const KEEP_TRACE = !!process.env.KEEP_TRACE;

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(APP, u === '/' ? 'index.html' : u);
  if (!f.startsWith(APP + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}/`;

// In the page before the app: the rAF loop, the wrapped reads, long tasks, and capture that tolerates a
// synthetic pointer (WebKit's pinch). None of it changes what the app does with a real pointer.
const INIT = () => {
  try { if (!localStorage.getItem('uq.intro')) localStorage.setItem('uq.intro', 'true'); } catch { /* none */ }
  const F = window.__ft = { on: false, raf: [], reads: { n: 0, ms: 0 }, lt: [], app: new Map() };
  const loop = (t) => { if (F.on) F.raf.push(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  const wrap = (obj, name) => {
    const o = obj[name];
    obj[name] = function (...a) { if (!F.on) return o.apply(this, a); const t = performance.now(); try { return o.apply(this, a); } finally { F.reads.n++; F.reads.ms += performance.now() - t; } };
  };
  wrap(Element.prototype, 'getBoundingClientRect');
  wrap(CSSStyleDeclaration.prototype, 'getPropertyValue');
  for (const k of ['clientWidth', 'clientHeight']) {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, k);
    Object.defineProperty(Element.prototype, k, { configurable: true, get() { if (!F.on) return d.get.call(this); const t = performance.now(); try { return d.get.call(this); } finally { F.reads.n++; F.reads.ms += performance.now() - t; } } });
  }
  const cap = Element.prototype.setPointerCapture;
  Element.prototype.setPointerCapture = function (id) { try { return cap.call(this, id); } catch { return undefined; } };
  try { new PerformanceObserver((l) => { if (F.on) for (const e of l.getEntries()) F.lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: false }); F.ltOk = true; } catch { F.ltOk = false; }
  setInterval(() => { const p = window.__uq && window.__uq._ && window.__uq._.perf; if (F.on && p) for (const f of p.frames) F.app.set(f.t, f); }, 200);
};

const sleepUntil = (t) => new Promise((r) => setTimeout(r, Math.max(0, t - Date.now())));
const q = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

async function run(engine) {
  const bt = pw[engine];
  const browser = await bt.launch(engine === 'chromium' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {});
  const results = [];
  for (const state of [{ name: 'live-month', go: { mode: 'live', window: 'month', liveAll: true, view: 'lower-48', sheet: 'peek' } },
    { name: 'history-all', go: { mode: 'history', window: 'all', floor: 2.5, view: 'lower-48', sheet: 'peek' } },
    // the densest lines: California's faults at their full alpha (the California chip, then twice it)
    { name: 'california', go: { mode: 'live', window: 'month', liveAll: true, view: 'california', sheet: 'peek' } }].filter((x) => !process.env.STATES || process.env.STATES.split(',').includes(x.name))) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: engine !== 'firefox', hasTouch: true, colorScheme: 'light' });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${origin}index.html`);
    await page.waitForFunction(() => window.__uq && window.__uq.ready(), null, { timeout: 120000 });
    await page.waitForFunction(() => window.__uq._.perf.load.relief != null, null, { timeout: 30000 }).catch(() => {});
    // the Lower 48 chip, then twice its scale, so three sweeps of 290 px never meet the edge the view is
    // held inside (at the chip's own scale it is about 70 px east, and a clamped pan follows no finger)
    // and quiet: ten frames in a row under 25 ms, so a raster still running from the last redraw (SwiftShader
    // takes most of a second for the lines) neither delays the first touch nor turns it into a long press
    const quiet = () => page.evaluate(() => new Promise((res) => { let n = 0, last = 0; const t0 = performance.now(); const f = (t) => { n = last && t - last < 25 ? n + 1 : 0; last = t; if (n >= 10 || t - t0 > 8000) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
    const go = async () => { await page.evaluate((o) => window.__uq.goto(o), state.go); await page.evaluate(() => { const { M, req } = window.__uq._; M.set({ ...M.v, s: M.v.s * 2 }); req('base', 'relief', 'lines', 'over', 'gl', 'settle'); return window.__uq.settled(); }); await quiet(); };
    await go();
    await page.waitForTimeout(1500);
    const vis = await page.evaluate(() => { const r = window.__uq._.M.visible(), m = document.getElementById('map').getBoundingClientRect(); return { x0: r.x0 + m.left, y0: r.y0 + m.top, x1: r.x1 + m.left, y1: r.y1 + m.top }; });
    const cy = Math.round((vis.y0 + vis.y1) / 2), cx = Math.round((vis.x0 + vis.x1) / 2);
    let cdp = null;
    if (engine === 'chromium') cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    // a gesture: a list of [ms, points] steps (points = [] lifts every finger); driven as the engine allows
    async function drive(steps, two, peekAt, lock) {
      const t0 = Date.now();
      let down = 0, i = 0, peek = null, pre = null;
      for (const [ms, pts] of steps) {
        if (i++ === peekAt) peek = await page.evaluate(() => ({ ...window.__uq._.M.v }));
        if (!pts.length) pre = await page.evaluate(() => ({ ...window.__uq._.M.v }));   // just before the lift
        if (lock) await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
        else await sleepUntil(t0 + ms);
        if (engine === 'chromium') {
          if (!pts.length) { await touch('touchEnd', []); down = 0; continue; }
          await touch(down ? 'touchMove' : 'touchStart', pts); down = pts.length;
        } else if (!two) {
          if (!pts.length) { await page.mouse.up(); down = 0; continue; }
          await page.mouse.move(pts[0][0], pts[0][1]);
          if (!down) { await page.mouse.down(); down = 1; }
        } else {
          await page.evaluate(([pts, was]) => {
            const el = document.getElementById('over');
            const fire = (type, id, x, y) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }));
            if (!pts.length) { fire('pointerup', 12, ...window.__ft.last[1]); fire('pointerup', 11, ...window.__ft.last[0]); return; }
            pts.forEach((p, i) => fire(was ? 'pointermove' : 'pointerdown', 11 + i, p[0], p[1]));
            window.__ft.last = pts;
          }, [pts, down]);
          down = pts.length ? 2 : 0;
        }
      }
      return { peek, pre };
    }
    const gestures = {
      // three sweeps across the Lower 48, 3 s in all, the finger at 60 Hz
      pan: { two: false, settleMs: 600, steps: (() => {
        const s = [], n = 180, xa = vis.x1 - 50, xb = vis.x0 + 50;
        for (let i = 0; i <= n; i++) { const k = i / n, ph = (k * 3) % 2, f = ph < 1 ? ph : 2 - ph; s.push([i * (3000 / n), [[xa + (xb - xa) * f, cy + 40 * Math.sin(k * Math.PI * 2)]]]); }
        s.push([3000 + 120, []]);   // held still 120 ms before the lift: no fling
        return s;
      })() },
      // the same finger, one event a displayed frame (a phone delivers touches once a frame): 160 px in 40
      // steps, each sent after the page has drawn a frame; the measure is how closely the map follows
      locked: { two: false, settleMs: 600, lock: true, steps: (() => { const s = []; for (let i = 0; i <= 40; i++) s.push([0, [[cx + 80 - 4 * i, cy]]]); s.push([0, []]); return s; })() },
      // a fast flick, 220 px in 100 ms, and the coast after it
      fling: { two: false, settleMs: 2200, steps: (() => { const s = []; for (let i = 0; i <= 6; i++) s.push([i * 16.7, [[cx + 110 - (220 * i) / 6, cy]]]); s.push([6 * 16.7 + 8, []]); return s; })() },
      // two fingers, 60 → 300 px apart in 1 s, and back in 1 s
      pinch: { two: true, settleMs: 700, peekAt: 61, steps: (() => {
        const s = [], n = 120;
        for (let i = 0; i <= n; i++) { const k = i / n, d = 60 + 240 * (k < 0.5 ? k * 2 : 2 - k * 2); s.push([i * (2000 / n), [[cx - d / 2, cy], [cx + d / 2, cy]]]); }
        s.push([2000 + 50, []]);
        return s;
      })() },
    };
    for (const [gname, G] of Object.entries(gestures)) {
      await go();
      await page.waitForTimeout(500);
      const tracePath = path.join(out, `trace-${engine}-${state.name}-${gname}.json`);
      if (engine === 'chromium') await browser.startTracing(page, { path: tracePath, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'gpu', 'viz', 'toplevel'] });
      await quiet();
      const v0 = await page.evaluate(() => { const F = window.__ft; F.raf = []; F.reads = { n: 0, ms: 0 }; F.lt = []; F.app = new Map(); F.on = true; performance.mark('ft-start'); return { ...window.__uq._.M.v }; });
      const { peek: vPeek, pre: vLift } = await drive(G.steps, G.two, G.peekAt, G.lock);
      await page.waitForTimeout(G.settleMs);
      await page.evaluate(() => window.__uq.settled());
      const r = await page.evaluate(() => { const F = window.__ft; F.on = false; performance.mark('ft-end'); for (const f of window.__uq._.perf.frames) F.app.set(f.t, f); return { raf: F.raf, reads: F.reads, lt: F.lt, ltOk: F.ltOk, app: [...F.app.values()].filter((f) => f.t >= F.raf[0] - 1), v1: { ...window.__uq._.M.v } }; });
      let trace = null;
      if (engine === 'chromium') { await browser.stopTracing(); trace = summarizeTrace(tracePath); if (!KEEP_TRACE) fs.rmSync(tracePath, { force: true }); }
      const d = []; for (let i = 1; i < r.raf.length; i++) d.push(r.raf[i] - r.raf[i - 1]);
      // the three longest intervals, and the app's own frames inside each (what that frame drew, in ms)
      const worst = d.map((x, i) => [x, i + 1]).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([x, i]) => ({ ms: r1(x),
        drew: r.app.filter((f) => f.t > r.raf[i - 1] - 1 && f.t <= r.raf[i] + 1).map((f) => Object.entries(f).filter(([k]) => k !== 't').map(([k, v]) => `${k} ${v}`).join(' ')).join(' | ') || 'no app frame' }));
      const parts = {};
      for (const k of ['ms', 'gl', 'base', 'relief', 'lines', 'over', 'strip', 'sheet']) {
        const v = r.app.map((f) => f[k]).filter((x) => x != null);
        parts[k] = { n: v.length, median: r1(q(v, 0.5)), p95: r1(q(v, 0.95)), max: r1(q(v, 1)), sum: r1(v.reduce((a, b) => a + b, 0)) };
      }
      // the finger's travel against the map's, for the pan and fling's first moves (to the lift)
      let follow = null;
      if (!G.two) {
        const st = G.steps.filter((s) => s[1].length), fx = st[st.length - 1][1][0][0] - st[0][1][0][0];
        let path = 0; for (let i = 1; i < st.length; i++) path += Math.abs(st[i][1][0][0] - st[i - 1][1][0][0]);
        follow = { fingerNetPx: r1(fx), mapNetPx: r1((v0.cx - vLift.cx) * v0.s), fingerPathPx: r1(path), ratio: fx ? +(((v0.cx - vLift.cx) * v0.s) / fx).toFixed(3) : null };
      } else {
        // the fingers at their widest are 300 px apart from 60: a map under them is zoomed ×5 there
        follow = { zoomAtWidest: vPeek ? +(vPeek.s / v0.s).toFixed(3) : null, fingerRatio: 5, zoomAtLift: +(vLift.s / v0.s).toFixed(3) };
      }
      const res = { engine, state: state.name, gesture: gname, input: engine === 'chromium' ? 'CDP touch' : G.two ? 'synthetic touch PointerEvents' : 'Playwright mouse',
        frames: d.length, raf: { median: r1(q(d, 0.5)), p95: r1(q(d, 0.95)), max: r1(q(d, 1)), over33: d.filter((x) => x > 33.4).length, over50: d.filter((x) => x > 50).length },
        app: parts, reads: { n: r.reads.n, ms: r1(r.reads.ms) }, longTasks: r.ltOk ? { n: r.lt.length, ms: r1(r.lt.reduce((a, b) => a + b[1], 0)), max: r1(Math.max(0, ...r.lt.map((x) => x[1]))) } : 'not available in this engine',
        worst, trace, follow, errors };
      results.push(res);
      console.log(`${engine.padEnd(8)} ${state.name.padEnd(11)} ${gname.padEnd(5)} raf median ${res.raf.median} p95 ${res.raf.p95} max ${res.raf.max} (${res.frames} frames, ${res.raf.over33} > 33 ms) · app frame median ${parts.ms.median} p95 ${parts.ms.p95} · gl ${parts.gl.median}/${parts.gl.p95} (${parts.gl.n}) · base ${parts.base.median}/${parts.base.p95} (${parts.base.n}) · relief ${parts.relief.median} (${parts.relief.n}) · lines ${parts.lines.median}/${parts.lines.p95} (${parts.lines.n}) · over ${parts.over.median}/${parts.over.p95} (${parts.over.n}) · strip ${parts.strip.n} · sheet ${parts.sheet.n} · reads ${res.reads.n} in ${res.reads.ms} ms · long tasks ${typeof res.longTasks === 'string' ? '—' : `${res.longTasks.n} (${res.longTasks.ms} ms)`} · ${G.two ? `zoom at the widest ×${follow.zoomAtWidest} (fingers ×5), at the lift ×${follow.zoomAtLift}` : `map/finger ${follow.ratio} (${follow.mapNetPx}/${follow.fingerNetPx} px)`}${trace ? ` · trace: script ${trace.script} style ${trace.style} layout ${trace.layout} (forced ${trace.forced}) paint ${trace.paint} gpu ${trace.gpu} ms` : ''}${errors.length ? ` · ERRORS ${errors.join(' | ')}` : ''}`);
      console.log(`         longest: ${worst.map((w) => `${w.ms} ms [${w.drew}]`).join('; ')}`);
    }
    await ctx.close();
  }
  await browser.close();
  return results;
}

// The renderer main thread's time by kind, and the GPU main thread's busy time, between the two marks.
function summarizeTrace(file) {
  let ev;
  try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); ev = j.traceEvents || j; } catch { return null; }
  const names = new Map();
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const mark = (n) => ev.find((e) => e.name === n && (e.cat || '').includes('blink.user_timing'));
  const a = mark('ft-start'), b = mark('ft-end');
  if (!a || !b) return null;
  const main = `${a.pid}:${a.tid}`, t0 = a.ts, t1 = b.ts;
  const X = ev.filter((e) => e.ph === 'X' && e.ts >= t0 && e.ts <= t1 && e.dur);
  const on = (e, n) => names.get(`${e.pid}:${e.tid}`) === n;
  const sum = (f) => Math.round(X.filter(f).reduce((s, e) => s + e.dur, 0) / 100) / 10;
  const M = X.filter((e) => `${e.pid}:${e.tid}` === main);
  const calls = M.filter((e) => e.name === 'FunctionCall' || e.name === 'FireAnimationFrame' || e.name === 'EventDispatch');
  const inside = (e) => calls.some((c) => e.ts > c.ts && e.ts + e.dur <= c.ts + c.dur);
  const lay = M.filter((e) => e.name === 'Layout' || e.name === 'UpdateLayoutTree');
  return {
    script: sum((e) => `${e.pid}:${e.tid}` === main && (e.name === 'FunctionCall' || e.name === 'FireAnimationFrame' || e.name === 'EventDispatch') && !calls.some((c) => c !== e && e.ts >= c.ts && e.ts + e.dur <= c.ts + c.dur)),
    style: sum((e) => `${e.pid}:${e.tid}` === main && e.name === 'UpdateLayoutTree'),
    layout: sum((e) => `${e.pid}:${e.tid}` === main && e.name === 'Layout'),
    forced: Math.round(lay.filter(inside).reduce((s, e) => s + e.dur, 0) / 100) / 10,
    paint: sum((e) => `${e.pid}:${e.tid}` === main && (e.name === 'Paint' || e.name === 'PrePaint' || e.name === 'Layerize' || e.name === 'Commit')),
    gpu: sum((e) => on(e, 'CrGpuMain') && (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'ThreadPool_RunTask' || e.name === 'TaskGraphRunner::RunTask')),
    windowMs: Math.round((t1 - t0) / 1000),
  };
}

const all = [];
for (const e of engines) all.push(...await run(e));
server.close();
const file = path.join(out, `frametime-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify(all, null, 1));
console.log(`\nwritten ${file}`);
