// A small static server for Norway in 3D that serves the app the way Snuggery serves an online app
// (ADR-0027 section 5, with worker-src 'self' as Snuggery serves online apps since 2026-10-16). Every
// response carries the online Content-Security-Policy built from miniapp.json's resourceHosts, so a
// headless browser enforces the same rules the phone does: scripts only from the package, no inline
// script, no eval, connect-src 'self' (fetch reaches the package alone), images and fonts from the
// approved hosts only.
//
//   node tools/serve.mjs [port]            serves the app folder on 127.0.0.1
//   import { startServer } from './serve.mjs'   used by tools/shoot.mjs
//
// It is a test tool: the ZIP leaves tools/ out.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.geojson': 'application/geo+json',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

/** The online policy of ADR-0027 section 5 with worker-src 'self' (Snuggery's online policy).
 *  The hosts are deduplicated and sorted first, as Snuggery's MiniAppNetworkPolicy does, so one set
 *  of hosts gives one header, byte for byte the phone's; tools/check.mjs pins it. */
export function onlineCsp(hosts) {
  const h = [...new Set(hosts)].sort().map((x) => `https://${x}`).join(' ');
  return [
    "default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "worker-src 'self'", "child-src 'self'", "frame-src 'self'",
    "object-src 'none'", "connect-src 'self'", `img-src 'self' data: blob: ${h}`, "media-src 'self' blob:",
    `font-src 'self' data: ${h}`, "style-src 'self' 'unsafe-inline'", "base-uri 'none'", "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

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
    if (!file.startsWith(APP + path.sep) || /[\\/]tools[\\/]/.test(file.slice(APP.length))) { res.writeHead(404); res.end(); return; }
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
  const { port, csp } = await startServer(Number(process.argv[2] || 8017));
  console.log(`Norway in 3D on http://127.0.0.1:${port}/\nContent-Security-Policy: ${csp}`);
}
