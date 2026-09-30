// Static checks for US Quakes (DESIGN §16, CONTRACT §10). Node, no dependencies:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment;
//   3. every import / src / href / fetch( / url( and every data path the code names is relative, inside
//      the folder and present (the relief files named by assets/geo.json included);
//   4. assets/ holds exactly the contract's nine files, data/ only snapshot.json, fonts/ exactly the five
//      WOFF2 files and OFL.txt;
//   5. miniapp.json is valid;
//   6. no AI vendor or product name in any shipped text file (the list is stored ROT13);
//   7. js/ramp.js's stops equal ART.md's six, lightness falls at every stop and neighbouring stops stay
//      ≥ 10 apart in ΔE2000 under normal vision and simulated protan, deutan and tritan (Machado 2009);
//   8. app code (index.html, style.css, js/*.js) ≤ 200,000 bytes (raised from 150,000 on 2026-09-30 to give
//      the module headers back and fit focus mode); data/snapshot.json ≤ 1,500,000;
//   9. the ZIP, built exactly as build-zips.yml builds it, has index.html at its top, its assets/ entries
//      are stored in ≤ 6,000,000 bytes, and the whole is ≤ 8,000,000 bytes (each size printed).
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');

// 1. What the ZIP ships
const shipped = [];
let maxDepth = 0, symlinks = 0, biggest = ['', 0], total = 0;
(function walk(dir, depth) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name), rel = path.relative(APP, abs);
    if (depth === 0 && e.isDirectory() && EXCLUDE.has(e.name)) continue;
    if (e.isSymbolicLink()) { symlinks++; continue; }
    if (e.isDirectory()) { maxDepth = Math.max(maxDepth, depth + 1); walk(abs, depth + 1); continue; }
    const size = fs.statSync(abs).size;
    shipped.push(rel); total += size;
    if (size > biggest[1]) biggest = [rel, size];
  }
})(APP, 0);
ok(shipped.length <= 10000 && maxDepth <= 16 && symlinks === 0 && biggest[1] <= 128 * 2 ** 20 && total <= 512 * 2 ** 20,
  `files: ${shipped.length} shipped, ${fmt(total)} bytes, folder depth ${maxDepth}, ${symlinks} symlinks, largest ${biggest[0]} ${fmt(biggest[1])} bytes`);

// 2. No URL in the app's own code
const code = shipped.filter((f) => /\.(html|css|js)$/.test(f));
const withUrls = code.filter((f) => /https?:\/\//i.test(read(f)));
ok(withUrls.length === 0, `no http(s):// in ${code.length} .html/.css/.js files${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);

// 3. References: relative, inside the folder, present
const refs = [];
for (const f of code) {
  const src = read(f);
  // imports resolve against the module, url( against the stylesheet; src, href and fetch( against the page
  for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\()\s*['"]([^'"]+)['"]/g)) refs.push([f, m[1], '.']);
  for (const m of src.matchAll(/['`]((?:assets|data|fonts)\/[A-Za-z0-9_.-]+\.(?:json|bin|jpg|woff2))['`]/g)) refs.push([f, m[1], '.']);
}
const geo = JSON.parse(read('assets/geo.json'));
for (const r of geo.relief) refs.push(['assets/geo.json relief', `assets/${r.file}`, '.']);
const bad = refs.filter(([, r, dir]) => {
  if (r.startsWith('#') || r.startsWith('${')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..')) return true;
  const resolved = path.resolve(APP, dir, r);
  return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
});
ok(bad.length === 0, `references: ${refs.length} (imports, src, href, url(), data paths) — ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);

// 4. assets/, data/ and fonts/ hold exactly the contract's files
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort();
  const want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.length} files: ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : ` — found ${have.join(', ')}`}`);
};
exactly('assets', ['history.bin', 'history.json', 'geo.json', 'stories.json', 'about.json', 'relief-conus.jpg', 'relief-ak.jpg', 'relief-hi.jpg', 'relief-pr.jpg']);
exactly('data', ['snapshot.json']);
exactly('fonts', ['atkinson-hyperlegible-latin-400-normal.woff2', 'atkinson-hyperlegible-latin-700-normal.woff2', 'atkinson-hyperlegible-latin-ext-400-normal.woff2',
  'atkinson-hyperlegible-latin-ext-700-normal.woff2', 'red-hat-mono-latin-500-normal.woff2', 'OFL.txt']);

// 5. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'US Quakes' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && mini.version === '1.0',
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
}

// 6. No AI vendor or product name in shipped text (Earth's History's list, ROT13), model family names included
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
// geo.json's encoded polylines are skipped (a run like "BArD" inside one is not a name); its name tables are read.
const POLY = (k, v) => (['land', 'lakes', 'coast', 'borders', 'states', 'rings', 'lines'].includes(k) && Array.isArray(v) && typeof v[0] === 'string' ? undefined : v);
const named = texts.filter((f) => namesRe.test(f === 'assets/geo.json' ? JSON.stringify(JSON.parse(read(f), POLY)) : read(f)));
ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files${named.length ? ': ' + named.join(', ') : ''}`);

// 7. The depth ramp
const stops = (read('js/ramp.js').match(/export const STOPS = \[([^\]]+)\]/) || [, ''])[1].match(/#[0-9a-f]{6}/gi) || [];
const artStops = (read('ART.md').match(/\| stop \|([^\n]+)/) || [, ''])[1].match(/#[0-9a-f]{6}/gi) || [];
ok(stops.length === 6 && stops.join() === artStops.join(), `js/ramp.js stops ${stops.join(' ')} equal ART.md's (${artStops.join(' ')})`);
{
  const CVD = { normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]] };
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lab = (rgb) => {
    const [r, g, b] = rgb.map((v) => Math.min(1, Math.max(0, v)));
    const X = 0.4124 * r + 0.3576 * g + 0.1805 * b, Yv = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X / 0.95047), fy = f(Yv), fz = f(Z / 1.08883);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  };
  const D = Math.PI / 180;
  const de2000 = ([L1, a1, b1], [L2, a2, b2]) => {
    const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
    const h1 = ((Math.atan2(b1, a1p) / D) + 360) % 360, h2 = ((Math.atan2(b2, a2p) / D) + 360) % 360;
    let dh = h2 - h1;
    if (C1 * C2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    const dL = L2 - L1, dC = C2 - C1, dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * D);
    const Lb = (L1 + L2) / 2, Cbp = (C1 + C2) / 2;
    const hb = C1 * C2 === 0 ? h1 + h2 : Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
    const Tt = 1 - 0.17 * Math.cos((hb - 30) * D) + 0.24 * Math.cos(2 * hb * D) + 0.32 * Math.cos((3 * hb + 6) * D) - 0.2 * Math.cos((4 * hb - 63) * D);
    const dth = 30 * Math.exp(-(((hb - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
    const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * Tt;
    return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 - Math.sin(2 * dth * D) * Rc * (dC / Sc) * (dH / Sh));
  };
  let worst = 99, mono = true;
  const lines = [];
  for (const [name, m] of Object.entries(CVD)) {
    const labs = stops.map((h) => { const c = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)); return lab(m.map((row) => row[0] * c[0] + row[1] * c[1] + row[2] * c[2])); });
    const d = labs.slice(1).map((l, i) => de2000(labs[i], l));
    mono = mono && labs.every((l, i) => !i || l[0] < labs[i - 1][0]);
    worst = Math.min(worst, ...d);
    lines.push(`${name} L* ${labs.map((l) => l[0].toFixed(1)).join('/')} ΔE ${d.map((v) => v.toFixed(1)).join('/')}`);
  }
  ok(mono && worst >= 10, `depth ramp: lightness falls at every stop in all four visions, smallest neighbouring ΔE2000 ${worst.toFixed(1)} (≥ 10)`);
  for (const l of lines) console.log(`     ${l}`);
}

// 8. Budgets
const codeFiles = code.filter((f) => f === 'index.html' || f === 'style.css' || /^js\/[^/]+\.js$/.test(f));
const codeBytes = codeFiles.reduce((n, f) => n + fs.statSync(path.join(APP, f)).size, 0);
ok(codeBytes <= 200000, `app code ${fmt(codeBytes)} bytes (budget 200,000): ${codeFiles.map((f) => `${f} ${fmt(fs.statSync(path.join(APP, f)).size)}`).join(', ')}`);
const snapBytes = fs.statSync(path.join(APP, 'data/snapshot.json')).size;
ok(snapBytes <= 1500000, `data/snapshot.json ${fmt(snapBytes)} bytes (cap 1,500,000)`);

// 9. The ZIP, exactly as .github/workflows/build-zips.yml builds it
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'us-quakes.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8' }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pre) => entries.filter((p) => p[7].startsWith(pre)).reduce((n, p) => n + Number(p[2]), 0);
const size = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && !names.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/') || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
ok(stored('assets/') <= 6000000, `ZIP stores assets/ in ${fmt(stored('assets/'))} bytes (cap 6,000,000); data/ ${fmt(stored('data/'))}; app code ${fmt(entries.filter((p) => codeFiles.includes(p[7])).reduce((n, p) => n + Number(p[2]), 0))}; fonts/ ${fmt(stored('fonts/'))}`);
ok(size <= 8000000, `ZIP size ${fmt(size)} bytes (cap 8,000,000)`);

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
