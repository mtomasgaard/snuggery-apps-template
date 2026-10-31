// Static checks for Hello Map (HOUSE.md section 7.1, carried to an online app as Norway in 3D's are).
// Node, no dependencies but python3 for tools/art/palette.py and the system zip for the ZIP's size:
//   1. what the ZIP ships stays within Snuggery's limits;
//   2. miniapp.json: schema 1, the name, the entry point, a description of at most 200 characters,
//      a version of digits and dots; network.resourceHosts at most eight valid names, no xn--;
//   3. the sites: js/sources.js's HOSTS are exactly miniapp.json's resourceHosts, none missing and
//      none unused; every https:// address in shipped code names one of them; no http:// anywhere;
//   4. every import, src, href and url( is relative, inside the folder and present;
//   5. fonts/ holds exactly the house face and its OFL.txt, byte for byte (sha256), credited word
//      for word in About, NOTES.md and CREDITS.txt;
//   6. no AI vendor or model name in any shipped text file (Global Weather's list, ROT13);
//   7. the credits: the constant word for word as About's first Sources and credits paragraph and
//      in CREDITS.txt; USGS's requested acknowledgment word for word in About; no credit, source or
//      site name on the front (HOUSE.md 4.15);
//   8. the online policy: no inline <script>, no on…= attribute, no javascript: URL, no eval, no new
//      Function, no document.write, no innerHTML other than = '', no insertAdjacentHTML or
//      outerHTML, no worker built from a blob;
//   9. the policies tools/serve.mjs serves equal the pinned literals, and, when the Snuggery
//      repository is around the template, the policies Snuggery's own source builds;
//  10. SI: toFixed only in js/units.js; no plain space between a number and its unit in a string;
//  11. the camera's and the focus mode's names, and every stored key under the app's prefix;
//  12. the palette: python3 tools/art/palette.py passes, and its values are the ones the code uses;
//  13. the tells: no box-shadow, backdrop-filter, text-shadow, transition: all, uppercase, nonzero
//      letter-spacing or monospace; both theme-color metas equal --page; the @font-face rule exactly;
//      the chrome tokens exactly the house values in both themes; every script font names the face
//      first; no arrows or "..." in shipped code;
//  14. budgets: app code, fonts and the ZIP, printed, each against its cap (the ZIP at most 200 kB);
//  15. US spelling in every shipped text file.
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { onlineCsp, OFFLINE_CSP } from './serve.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
let n = 0;
const ok = (cond, msg) => { n++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${String(n).padStart(2)} ${msg}`); if (!cond) fails.push(msg); };
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const fmt = (v) => String(v).replace(/\B(?=(\d{3})+$)/g, ' ');
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(APP, dir), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (!(dir === '' && EXCLUDE.has(e.name))) walk(rel, out); } else out.push(rel);
  }
  return out;
};
const shipped = walk('');
const code = shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f));
const strip = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '') : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
const html = read('index.html'), css = read('styles.css'), appJs = read('app.js');

// 1. the ZIP's shape
const sizes = shipped.map((f) => fs.statSync(path.join(APP, f)).size);
const depth = Math.max(...shipped.map((f) => f.split(path.sep).length));
ok(shipped.length <= 10000 && depth <= 16 && Math.max(...sizes) <= 128 * 2 ** 20, `ZIP shape: ${shipped.length} files, depth ${depth}, largest ${fmt(Math.max(...sizes))} B`);
ok(!shipped.some((f) => fs.lstatSync(path.join(APP, f)).isSymbolicLink()) && fs.existsSync(path.join(APP, 'index.html')), 'no symlinks; index.html at the folder root');

// 2. miniapp.json
const M = JSON.parse(read('miniapp.json'));
ok(M.schemaVersion === 1 && M.name === 'Hello Map' && M.entryPoint === 'index.html', 'miniapp.json: schema 1, the name, the entry point');
ok(typeof M.description === 'string' && M.description.length <= 200, `miniapp.json: description ${M.description.length} characters (<= 200)`);
ok(/^\d+(\.\d+){1,2}$/.test(M.version), `miniapp.json: version ${M.version}`);
const HOSTS = (M.network && M.network.resourceHosts) || [];
ok(HOSTS.length >= 1 && HOSTS.length <= 8 && HOSTS.every((h) => h.length <= 253 && /^[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(h) && !h.split('.').some((l) => l.startsWith('xn--'))), `resource hosts: ${HOSTS.length} of 8, valid names (${HOSTS.join(', ')})`);
ok(!M.dataSource, 'no data source: an app with a private data source stays offline, and this one needs none');

// 3. the sites
const SRC = read('js/sources.js');
const hostBlock = /export const HOSTS = \{([\s\S]*?)\};/.exec(SRC);
const srcHosts = hostBlock ? Object.fromEntries([...hostBlock[1].matchAll(/(\w+):\s*'([^']+)'/g)].map((m) => [m[1], m[2]])) : {};
const listed = Object.values(srcHosts);
ok(listed.length === HOSTS.length && listed.every((h) => HOSTS.includes(h)), `js/sources.js's HOSTS equal miniapp.json's resourceHosts (${listed.join(', ')})`);
const used = new Set(), bad = [];
for (const f of code) {
  const s = strip(read(f), f);
  if (/http:\/\/(?!www\.w3\.org\/2000\/svg)/.test(s)) bad.push(`${f}: http://`);
  for (const m of s.matchAll(/https:\/\/(\$\{[^}]+\}|[a-z0-9.-]+)/g)) {
    let host = m[1];
    if (host.startsWith('${')) {
      const k = /^\$\{HOSTS\.(\w+)\}$/.exec(host);
      if (!k || !srcHosts[k[1]]) { bad.push(`${f}: https://${host}`); continue; }
      host = srcHosts[k[1]];
    }
    if (!HOSTS.includes(host)) bad.push(`${f}: ${host}`); else used.add(host);
  }
}
ok(bad.length === 0, `every address in shipped code is to an approved host, by HOSTS${bad.length ? `: ${bad.join(', ')}` : ''}`);
ok(HOSTS.every((h) => used.has(h)), `every approved host is used (${[...used].join(', ')})`);

// 4. references
const missing = [];
for (const f of code) {
  const s = read(f), dir = path.dirname(f);
  for (const m of s.matchAll(/(?:\bfrom\s*['"]|\bimport\(\s*['"]|\bsrc=['"]|\bhref=['"]|\burl\(['"]?)([^'")\s>]+)/g)) {
    const r = m[1];
    if (/^(https?:|data:|#|mailto:)/.test(r) || r.includes('${')) continue;
    const p = path.normalize(path.join(dir, r.split('?')[0]));
    if (p.startsWith('..') || !fs.existsSync(path.join(APP, p))) missing.push(`${f}: ${r}`);
  }
}
ok(missing.length === 0, `every reference relative, inside the folder and present${missing.length ? `: ${missing.join(', ')}` : ''}`);

// 5. fonts
const FONT = { 'fonts/ysabeau-office-gw.woff2': 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262', 'fonts/OFL.txt': 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269' };
ok(fs.readdirSync(path.join(APP, 'fonts')).sort().join() === 'OFL.txt,ysabeau-office-gw.woff2' && Object.entries(FONT).every(([f, h]) => sha(f) === h), 'fonts/: the house face and OFL.txt, byte for byte');
const TYPE = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
ok(html.includes(`Type: ${TYPE}`) && read('CREDITS.txt').includes(TYPE) && read('NOTES.md').includes(TYPE), 'the face credited word for word in About, CREDITS.txt and NOTES.md');

// 6. vendor names (Global Weather's list, ROT13, copied as it is)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const textFiles = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
const named = textFiles.filter((f) => namesRe.test(read(f)));
ok(named.length === 0, `no AI vendor or model name in ${textFiles.length} shipped text files${named.length ? `: ${named.join(', ')}` : ''}`);

// 7. credits
const CREDIT = /const CREDITS = '([^']+)'/.exec(appJs)[1];
ok(/text\('about-credit-line', CREDITS\)/.test(appJs) && /<h3>Sources and credits<\/h3>\s*<p id="about-credit-line"><\/p>/.test(html) && read('CREDITS.txt').includes(CREDIT), `the credit constant "${CREDIT}" first under About's Sources and credits, and in CREDITS.txt`);
const ACK = 'Map services and data available from U.S. Geological Survey, National Geospatial Program.';
ok(html.includes(`<p>${ACK}</p>`) && read('CREDITS.txt').includes(ACK) && read('NOTES.md').includes(ACK), 'USGS\'s requested acknowledgment, word for word, in About, CREDITS.txt and NOTES.md');
const front = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<div class="dlg" id="about"[\s\S]*?\n<\/div>\n/, '');
ok(!/USGS|National Map|nationalmap|©|Survey/.test(front) && /<div class="dlg" id="about"/.test(html), 'no credit, source or site name on the front: they are in About (HOUSE.md 4.15)');
ok(!/USGS|National Map|nationalmap/.test(['Loading the map', 'could not be loaded', 'Every tile in view'].join('')) && /text\('stamp', s\)/.test(appJs), 'the status line names no source');

// 8. the online policy
ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) && !/\son[a-z]+\s*=/i.test(html) && !/javascript:/i.test(html), 'index.html: no inline script, no on…= attribute, no javascript: URL');
const evil = code.filter((f) => /\beval\(|new Function\(|document\.write|insertAdjacentHTML|outerHTML|innerHTML\s*=\s*(?!'')|new Worker\(\s*URL\.createObjectURL|\bsetTimeout\(\s*['"`]|\bsetInterval\(\s*['"`]/.test(strip(read(f), f)));
ok(evil.length === 0, `no eval, new Function, string timers, document.write, insertAdjacentHTML, outerHTML, innerHTML from strings or blob workers${evil.length ? `: ${evil.join(', ')}` : ''}`);
ok(!code.some((f) => /\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(strip(read(f), f))), 'no fetch, XHR, WebSocket, EventSource or sendBeacon: the map is pictures, and the app reads no file');
ok(!code.some((f) => /crossOrigin/.test(strip(read(f), f))), 'no crossOrigin: the canvas draws the pictures and never reads their pixels');

// 9. the policies
const PIN_ONLINE = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; child-src 'self'; frame-src 'self'; object-src 'none'; connect-src 'self'; img-src 'self' data: blob: https://basemap.nationalmap.gov; media-src 'self' blob:; font-src 'self' data: https://basemap.nationalmap.gov; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const PIN_OFFLINE = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' data: blob:; img-src 'self' data: blob:; media-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; frame-src 'self'; child-src 'self'; object-src 'none'; worker-src 'self' blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
ok(onlineCsp(HOSTS) === PIN_ONLINE, 'tools/serve.mjs: the online policy equals the pinned literal');
ok(OFFLINE_CSP === PIN_OFFLINE, 'tools/serve.mjs: the offline policy equals the pinned literal');
const SWIFT = path.join(APP, '..', '..', 'Packages', 'SnuggeryKit', 'Sources', 'SnuggeryKit', 'MiniApp', 'MiniAppNetworkPolicy.swift');
if (fs.existsSync(SWIFT)) {
  const sw = fs.readFileSync(SWIFT, 'utf8');
  const arr = (re) => { const b = re.exec(sw); return b ? [...b[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]) : null; };
  const on = arr(/static func onlinePolicy\([\s\S]*?return \[([\s\S]*?)\]\.joined\(separator: "; "\)/);
  const off = arr(/public static let offlinePolicy = \[([\s\S]*?)\]\.joined\(separator: "; "\)/);
  // The Swift joins each source list before it interpolates it (B2 added
  // connect-src sources): an online app with no send hosts fills them so.
  const hostList = HOSTS.map((h) => `https://${h}`).join(' ');
  const fill = { '\\(connect)': "'self'", '\\(images)': `'self' data: blob: ${hostList}`, '\\(fonts)': `'self' data: ${hostList}`, '\\(sources)': hostList };
  const onStr = on && on.map((d) => Object.entries(fill).reduce((t, [k, v]) => t.replace(k, v), d)).join('; ');
  ok(onStr === PIN_ONLINE, `the pinned online policy is what Snuggery builds (MiniAppNetworkPolicy.onlinePolicy, ${on ? on.length : 0} directives)`);
  ok(off && off.join('; ') === PIN_OFFLINE, `the pinned offline policy is Snuggery's (MiniAppNetworkPolicy.offlinePolicy, ${off ? off.length : 0} directives)`);
} else console.log('     (Snuggery\'s MiniAppNetworkPolicy.swift is not beside this template: the two policies are checked against the pins only)');

// 10. SI
const tf = code.filter((f) => f !== 'js/units.js' && /toFixed|toLocaleString/.test(strip(read(f), f)));
ok(tf.length === 0, `toFixed and toLocaleString only in js/units.js${tf.length ? `: ${tf.join(', ')}` : ''}`);
const plain = [];
for (const f of code.filter((x) => /\.(js|html)$/.test(x))) {
  const s = strip(read(f), f);
  const strings = f.endsWith('.html') ? [s.replace(/<[^>]+>/g, ' ')] : [...s.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]);
  for (const t of strings) {
    const m = /\d (m|km|ft|mi|px|%|h|min|s|kB|B)\b(?![-\w])/.exec(t.replace(/\b\d+\s?px\b(?=[;)])/g, ''));
    if (m) plain.push(`${f}: "${t.slice(Math.max(0, m.index - 10), m.index + 12)}"`);
  }
}
ok(plain.length === 0, `no plain space between a number and its unit in a string the app writes${plain.length ? `: ${plain.slice(0, 4).join(' | ')}` : ''}`);

// 11. names and stored keys
ok(/<h1 translate="no">Hello Map<\/h1>/.test(html), 'the name in the header is miniapp.json\'s, never renamed');
ok(/id="focus-key" aria-label="Hide the controls"/.test(html) && /id="focus-exit" aria-label="Show the controls" aria-keyshortcuts="Escape"/.test(html), 'focus mode: the keys named exactly Hide the controls and Show the controls');
ok(/aria-label="Zoom in"/.test(html) && /aria-label="Zoom out"/.test(html) && /aria-label="Show the whole country"/.test(html) && /role="radiogroup" aria-label="Map layer"/.test(html), 'the keys by their names: Zoom in, Zoom out, Show the whole country; the Map layer switch');
ok(!code.some((f) => f !== 'js/util.js' && /localStorage|sessionStorage|indexedDB/.test(strip(read(f), f))) && /const KEY = 'hellomap:';/.test(read('js/util.js')), 'every stored key goes through js/util.js under the prefix hellomap:');

// 12. the palette
const pal = spawnSync('python3', [path.join('hello-map', 'tools', 'art', 'palette.py')], { cwd: path.join(APP, '..'), encoding: 'utf8' });
ok(pal.status === 0 && /ALL CHECKS PASS/.test(pal.stdout), 'tools/art/palette.py: ALL CHECKS PASS');
const PJ = JSON.parse(execFileSync('python3', [path.join('hello-map', 'tools', 'art', 'palette.py'), '--json'], { cwd: path.join(APP, '..'), encoding: 'utf8' }));
const halo = PJ.collar.halo.slice(1).match(/../g).map((x) => parseInt(x, 16)).join(', ');
ok(css.includes(`--collar: ${PJ.collar.ink};`) && css.includes(`--collar-halo: rgba(${halo}, ${PJ.collar.halo_a});`) && appJs.includes(`ink: '${PJ.collar.ink}', halo: 'rgba(${halo}, ${PJ.collar.halo_a})'`), 'the collar\'s ink and halo in styles.css and app.js are the palette\'s');
ok(css.includes(`--plate: ${PJ.plate};`) && /\.ghost \{[^}]*opacity: 0\.72;/.test(css) && PJ.ghost.rest === 0.72, 'the plate and the ghost key\'s rest are the palette\'s');
ok(!/prefers-color-scheme: dark\) \{\s*:root \{[^}]*--(collar|plate)/.test(css), 'the plate and its marks keep one style in both themes');

// 13. the tells
ok(!/box-shadow|backdrop-filter|text-shadow|transition:\s*all|text-transform:\s*uppercase|monospace/.test(css) && !/letter-spacing:\s*(?!0[;\s])/.test(css), 'styles.css: no shadow, blur, transition: all, uppercase, letter-spacing or monospace');
const page = { light: /:root \{[\s\S]*?--page: (#[0-9a-f]{6})/.exec(css)[1], dark: /prefers-color-scheme: dark\) \{\s*:root \{[\s\S]*?--page: (#[0-9a-f]{6})/.exec(css)[1] };
ok(html.includes(`<meta name="theme-color" content="${page.light}" media="(prefers-color-scheme: light)">`) && html.includes(`<meta name="theme-color" content="${page.dark}" media="(prefers-color-scheme: dark)">`), 'both theme-color metas equal --page');
ok(css.includes("@font-face {\n  font-family: 'Ysabeau Office';\n  src: url(fonts/ysabeau-office-gw.woff2) format('woff2');\n  font-weight: 400 650;\n  font-display: block;\n}"), 'the @font-face rule exactly as HOUSE.md 2.5 gives it');
const TOKENS = {
  light: { page: '#e8eef0', sheet: '#f6f9fa', ink: '#0f1c23', 'ink-2': '#45555d', 'ink-3': '#5b6a72', line: '#c9d4d8', 'line-strong': '#74858c' },
  dark: { page: '#141d21', sheet: '#1c272c', ink: '#e6edee', 'ink-2': '#a3b1b6', 'ink-3': '#8b9a9f', line: '#2a373c', 'line-strong': '#64757b' },
};
const lightBlock = /:root \{([\s\S]*?)\n\}/.exec(css)[1], darkBlock = /prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\}/.exec(css)[1];
ok(Object.entries(TOKENS.light).every(([k, v]) => lightBlock.includes(`--${k}: ${v};`)) && Object.entries(TOKENS.dark).every(([k, v]) => darkBlock.includes(`--${k}: ${v};`)), 'the chrome tokens exactly the house values in both themes');
ok(!/font-family:/.test(css.replace(/@font-face \{[\s\S]*?\}/, '')) && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(css), 'one family, through --face');
const fonts = code.filter((f) => f.endsWith('.js')).flatMap((f) => [...read(f).matchAll(/'(\d{3} [\d.]+px [^'\n]*)'/g)].map((m) => m[1]));
ok(fonts.length > 0 && fonts.every((f) => /^\d{3} [\d.]+px "Ysabeau Office"/.test(f)), `every script font names the face first (${fonts.length})`);
const all = code.map((f) => read(f)).join('');
ok(!/[→➤⋯]/.test(all) && !/\.\.\.['"`<]/.test(all), 'no arrows, no ⋯ and no "..." in shipped code');
const sizesPx = [...css.matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?([\d.]+)px/g)].map((m) => Number(m[1]));
ok(sizesPx.every((s) => [10.5, 11, 11.5, 12.5, 13.5, 15, 21].includes(s)), `type sizes on the house scale (${[...new Set(sizesPx)].sort((a, b) => a - b).join(', ')} px)`);

// 14. budgets
const bytes = (fs_) => fs_.reduce((a, f) => a + fs.statSync(path.join(APP, f)).size, 0);
const CODE_CAP = 80000, FONT_CAP = 160000, ZIP_CAP = 200000;
const codeB = bytes(code), fontB = bytes(shipped.filter((f) => f.startsWith('fonts/')));
ok(codeB <= CODE_CAP, `app code ${fmt(codeB)} B (cap ${fmt(CODE_CAP)})`);
ok(fontB <= FONT_CAP, `fonts ${fmt(fontB)} B (cap ${fmt(FONT_CAP)})`);
const zipOut = path.join(APP, 'tools', '.work', 'hello-map.zip');
fs.mkdirSync(path.dirname(zipOut), { recursive: true });
if (fs.existsSync(zipOut)) fs.unlinkSync(zipOut);
const z = spawnSync('zip', ['-q', '-r', '-X', zipOut, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const zipB = z.status === 0 ? fs.statSync(zipOut).size : Infinity;
ok(zipB <= ZIP_CAP, `the ZIP, built as build-zips.yml builds it: ${fmt(zipB)} B (cap ${fmt(ZIP_CAP)})`);
const list = spawnSync('unzip', ['-Z1', zipOut], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
ok(list.includes('index.html') && !list.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/')), `the ZIP: index.html at its top, ${list.length} entries, no tools/ or screenshots/`);

// 15. US spelling
const BRIT = /\b(judgement|colour\w*|centre\w*|centred|(?:kilo|milli|centi|deci)?metres?|behaviour\w*|recognis\w*|normalis\w*|optimis\w*|initialis\w*|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey|favour\w*|catalogue\w*|modelled|modelling|for ever)\b/i;
const brit = textFiles.filter((f) => f !== 'fonts/OFL.txt' && BRIT.test(read(f)));
ok(brit.length === 0, `US spelling in shipped text${brit.length ? `: ${brit.map((f) => `${f} (${BRIT.exec(read(f))[0]})`).join(', ')}` : ''}`);

console.log(fails.length ? `\n${fails.length} FAIL: SOME CHECKS FAIL` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
