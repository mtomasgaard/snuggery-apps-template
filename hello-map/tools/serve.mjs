// A small static server that serves Hello Map the way Snuggery serves it (Norway in 3D's, carried
// over). Every response carries a Content-Security-Policy, so a browser enforces what the phone does:
//
//   online (the default)  the policy Snuggery gives an app whose sites the person allowed: scripts
//                         only from the folder, no inline script, no eval, fetch to the folder alone,
//                         images and fonts from the sites in miniapp.json's resourceHosts and nowhere
//                         else (ADR-0027 section 5, with worker-src 'self' since 2026-10-16);
//   offline (--offline)   the policy of an app kept offline, or of any app with no sites: the map's
//                         site is not in img-src, so every tile is refused, as Keep Offline does.
//
//   node tools/serve.mjs [port]             http://127.0.0.1:8018/, online
//   node tools/serve.mjs [port] --offline   the same, kept offline
//   import { startServer } from './serve.mjs'   used by tools/shoot.mjs
//
// tools/check.mjs compares both policies with Snuggery's own source when the Snuggery repository is
// around the template, so the two cannot drift. It is a test tool: the ZIP leaves tools/ out.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

/** Snuggery's policy for an online app whose sites are allowed (MiniAppNetworkPolicy.onlinePolicy). */
export function onlineCsp(hosts) {
  const h = hosts.map((x) => `https://${x}`).join(' ');
  return [
    "default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "worker-src 'self'", "child-src 'self'", "frame-src 'self'",
    "object-src 'none'", "connect-src 'self'", `img-src 'self' data: blob: ${h}`, "media-src 'self' blob:",
    `font-src 'self' data: ${h}`, "style-src 'self' 'unsafe-inline'", "base-uri 'none'", "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Snuggery's policy for an app that is offline (MiniAppNetworkPolicy.offlinePolicy). */
export const OFFLINE_CSP = [
  "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:", "connect-src 'self' data: blob:", "img-src 'self' data: blob:",
  "media-src 'self' blob:", "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:", "frame-src 'self'", "child-src 'self'",
  "object-src 'none'", "worker-src 'self' blob:", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

export function resourceHosts() {
  const m = JSON.parse(fs.readFileSync(path.join(APP, 'miniapp.json'), 'utf8'));
  return (m.network && m.network.resourceHosts) || [];
}

export function startServer(port = 0, { csp = onlineCsp(resourceHosts()), onRequest } = {}) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(APP, p));
    if (onRequest) onRequest(req, file);
    // contained in the app folder after normalization, as Snuggery's scheme handler proves it
    if (!file.startsWith(APP + path.sep) || /[\\/](tools|screenshots)[\\/]/.test(file.slice(APP.length))) { res.writeHead(404, { 'Content-Security-Policy': csp }); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'Content-Security-Policy': csp }); res.end(); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Content-Security-Policy': csp,
        'Cache-Control': 'no-store',
      });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, csp })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const off = process.argv.includes('--offline');
  const portArg = process.argv.slice(2).find((a) => /^\d+$/.test(a));
  const { port, csp } = await startServer(Number(portArg || 8018), { csp: off ? OFFLINE_CSP : onlineCsp(resourceHosts()) });
  console.log(`Hello Map on http://127.0.0.1:${port}/ (${off ? 'kept offline' : 'online'})\nContent-Security-Policy: ${csp}`);
}
