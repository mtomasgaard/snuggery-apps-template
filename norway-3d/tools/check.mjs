// Static checks for Norway in 3D (HOUSE.md section 7.1, carried to an online app). Node, no
// dependencies but python3 for tools/art/palette.py and the system zip for the ZIP's size:
//   1. what the ZIP ships stays within Snuggery's limits, and within this app's 60 MB;
//   2. an online app: every https:// address in shipped code names a host in miniapp.json's
//      network.resourceHosts, and every resource host is used; no http:// anywhere; no address
//      outside vendor/ in a shipped .css (the hosts themselves: 16 and 17);
//   3. every import, src, href and url( is relative, inside the folder and present; the worker is
//      a package file; the data files the code fetches are present;
//   4. fonts/ holds exactly the house face and its OFL.txt, byte for byte (sha256);
//   5. vendor/ is three.js r186, byte for byte Besseggen's copy, and the ramps' license;
//   6. miniapp.json: schema 1, the name, the entry point, a description of at most 200 characters,
//      a version of digits and dots;
//   7. no AI vendor or model name in any shipped text file (Global Weather's list, ROT13);
//   8. the credit line, word for word, in About's first Sources and credits paragraph (app.js writes
//      it), and in CREDITS.txt;
//   9. the online policy: no inline <script>, no on…= attribute, no javascript: URL, no eval, no new
//      Function, no document.write, no innerHTML other than = '', no insertAdjacentHTML or outerHTML;
//  10. SI: toFixed only in js/units.js and the address and key builders named below;
//  11. no transition or animation on the track, the time row or the lead;
//  12. the palette: python3 tools/art/palette.py passes, and its values are the ones the code uses;
//  13. the tells: no box-shadow, backdrop-filter, text-shadow, transition: all, uppercase, nonzero
//      letter-spacing or monospace; both theme-color metas equal --page; the @font-face rule exactly;
//      the chrome tokens exactly the house values in both themes; every script font names the face;
//  14. budgets: app code, fonts, data and the ZIP, printed, each against its cap;
//  15. US spelling in every shipped text file (proper names and data keys excepted);
//  16. js/sources.js's HOSTS is the one list of hosts: its values are miniapp.json's
//      network.resourceHosts as a set, none missing, none extra, no duplicates in either;
//  17. the hosts as Snuggery's importer reads them (ResourceHost.parse): at most eight, each a plain
//      host name of at most 253 characters, no xn-- label, no numeric last label, no private-network
//      name (.local, .localhost, .home.arpa, .internal, .lan). Snuggery's shared-host refusals are
//      not repeated here; its own tests hold these five hosts to them;
//  18. the Content-Security-Policy tools/serve.mjs sends equals the literal pinned below, which is
//      the same literal Snuggery's tests pin for these five hosts, so a change to the online policy
//      fails in both places;
//  19. no page (every shipped .html) has an inline <script>, an on…= attribute or a javascript:
//      address, by Snuggery's own rule (InlineScripts.found, ported below and checked on samples).
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { onlineCsp, resourceHosts } from './serve.mjs';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ' ');
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
const code = shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f) && !f.startsWith('vendor/'));
const strip = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '') : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));

// 1. the ZIP's shape
const sizes = shipped.map((f) => fs.statSync(path.join(APP, f)).size);
const depth = Math.max(...shipped.map((f) => f.split(path.sep).length));
ok(shipped.length <= 10000 && depth <= 16 && Math.max(...sizes) <= 128 * 2 ** 20, `ZIP shape: ${shipped.length} files, depth ${depth}, largest ${fmt(Math.max(...sizes))} B`);
ok(!shipped.some((f) => fs.lstatSync(path.join(APP, f)).isSymbolicLink()), 'no symlinks');
ok(fs.existsSync(path.join(APP, 'index.html')), 'index.html at the folder root');

// 6. miniapp.json
const M = JSON.parse(read('miniapp.json'));
ok(M.schemaVersion === 1 && M.name === 'Norway in 3D' && M.entryPoint === 'index.html', 'miniapp.json: schema 1, the name, the entry point');
ok(typeof M.description === 'string' && M.description.length <= 200, `miniapp.json: description ${M.description.length} characters (<= 200)`);
ok(/^\d+(\.\d+){1,2}$/.test(M.version), `miniapp.json: version ${M.version}`);
const HOSTS = (M.network && M.network.resourceHosts) || [];

// js/sources.js's HOSTS, read as text (nothing of the app is run here): one `name: 'host',` a line
const hostsBlock = /export const HOSTS = \{\n([\s\S]*?)\n\};/.exec(read('js/sources.js'));
const HOST_OF = {};
let hostsRead = !!hostsBlock;
for (const line of hostsBlock ? hostsBlock[1].split('\n') : []) {
  const m = /^ {2}([a-z]+): '([^'\s]+)',$/.exec(line);
  if (m && !(m[1] in HOST_OF)) HOST_OF[m[1]] = m[2]; else hostsRead = false;
}
ok(hostsRead && Object.keys(HOST_OF).length > 0, `js/sources.js: HOSTS is one object of name: 'host' pairs (${Object.keys(HOST_OF).join(', ')})`);

// 2. addresses
const used = new Set();
let badAddr = [];
for (const f of code) {
  const s = strip(read(f), f);
  if (/http:\/\/(?!www\.w3\.org\/2000\/svg)/.test(s)) badAddr.push(`${f}: http://`);   // the SVG namespace is a name, not an address
  for (const m of s.matchAll(/https:\/\/(\$\{[^}]+\}|[a-z0-9.-]+)/g)) {
    let host = m[1];
    if (host.startsWith('${')) {
      // a template naming a host constant: resolve the constants the code defines
      const k = host.slice(2, -1).trim();
      const def = k === 'x' ? null : k === 'SNOW_HOST' ? HOST_OF.snow : k.startsWith('HOSTS.') ? HOST_OF[k.slice(6)] : undefined;
      if (def === undefined) { badAddr.push(`${f}: https://${host}`); continue; }
      if (def === null) continue;           // a test hook building https://${x} for a host list
      host = def;
    }
    if (!HOSTS.includes(host) && host !== 'www.w3.org') badAddr.push(`${f}: ${host}`);
    else used.add(host);
  }
}
const srcHosts = read('js/sources.js') + read('js/snow.js');
for (const h of HOSTS) if (srcHosts.includes(`'${h}'`)) used.add(h);
ok(badAddr.length === 0, `every address in shipped code is to an approved host${badAddr.length ? `: ${badAddr.join(', ')}` : ''}`);
ok(HOSTS.every((h) => used.has(h)), `every approved host is used (${[...used].sort().join(', ')})`);

// 3. references
const missing = [];
for (const f of code) {
  const s = read(f), dir = path.dirname(f);
  for (const m of s.matchAll(/(?:\bfrom\s*['"]|\bimport\(\s*['"]|\bsrc=['"]|\bhref=['"]|\burl\(['"]?)([^'")\s>]+)/g)) {
    const r = m[1];
    if (/^(https?:|data:|#|mailto:)/.test(r) || r.includes('${')) continue;
    const p = path.normalize(path.join(dir, r.split('?')[0]));
    if (p.startsWith('..') || !fs.existsSync(path.join(APP, p))) missing.push(`${f}: ${r}`);
  }
  for (const m of s.matchAll(/fetch\(\s*['"]([^'"]+)['"]/g)) if (!fs.existsSync(path.join(APP, m[1]))) missing.push(`${f}: fetch ${m[1]}`);
}
ok(missing.length === 0, `every reference relative, inside the folder and present${missing.length ? `: ${missing.join(', ')}` : ''}`);
ok(/new Worker\(new URL\('\.\/worker\.js', import\.meta\.url\), \{ type: 'module' \}\)/.test(read('js/heights.js')), 'the worker is a package file (js/worker.js), a module, never a blob');

// 4. fonts
const FONT = { 'fonts/ysabeau-office-gw.woff2': 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262', 'fonts/OFL.txt': 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269' };
ok(fs.readdirSync(path.join(APP, 'fonts')).sort().join() === 'OFL.txt,ysabeau-office-gw.woff2' && Object.entries(FONT).every(([f, h]) => sha(f) === h), 'fonts/: the house face and OFL.txt, byte for byte');
ok(/Ysabeau Office by Christian Thalmann \(Catharsis Fonts\), SIL Open Font License 1\.1; a subset is in fonts\/ with its license\./.test(read('CREDITS.txt')) && read('index.html').includes('Type: Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.'), 'the face credited word for word in About and CREDITS.txt');

// 5. vendor
const BES = path.join(APP, '..', 'besseggen', 'vendor');
const same = ['three.module.js', 'three.core.js', 'three-LICENSE.txt'].every((f) => !fs.existsSync(path.join(BES, f)) || sha(`vendor/${f}`) === crypto.createHash('sha256').update(fs.readFileSync(path.join(BES, f))).digest('hex'));
ok(same && /REVISION = '186'/.test(read('vendor/three.core.js')), 'vendor/: three.js r186, byte for byte Besseggen\'s copy');
ok(fs.existsSync(path.join(APP, 'vendor/ramps-LICENSE.txt')) && /Fabio Crameri/.test(read('vendor/ramps-LICENSE.txt')), 'vendor/ramps-LICENSE.txt carries the color tables\' licenses');

// 7. vendor names (Global Weather's list, ROT13, copied as it is)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const textFiles = shipped.filter((f) => /\.(html|css|js|json|geojson|md|txt)$/.test(f) && !f.startsWith('vendor/three'));
const named = textFiles.filter((f) => namesRe.test(read(f)));
ok(named.length === 0, `no AI vendor or model name in ${textFiles.length} shipped text files${named.length ? `: ${named.join(', ')}` : ''}`);

// 8. credits
const CREDIT = /const CREDITS = '([^']+)'/.exec(read('app.js'))[1];
ok(/text\('about-credit-line', CREDITS\)/.test(read('app.js')) && read('CREDITS.txt').includes(CREDIT), 'the credit line, word for word, in About (first under Sources and credits) and CREDITS.txt');
ok(/Names and cabins: © OpenStreetMap contributors, ODbL\./.test(read('index.html')), 'the OpenStreetMap credit stands under the map while names or cabins are shown (HOUSE.md 4.15, exception 1)');

// 9. the online policy
const html = read('index.html');
ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html) && !/\son[a-z]+\s*=/i.test(html) && !/javascript:/i.test(html), 'index.html: no inline script, no on…= attribute, no javascript: URL');
const evil = code.filter((f) => /\beval\(|new Function\(|document\.write|insertAdjacentHTML|outerHTML|innerHTML\s*=\s*(?!'')/.test(strip(read(f), f)));
ok(evil.length === 0, `no eval, new Function, document.write, insertAdjacentHTML, outerHTML or innerHTML from strings${evil.length ? `: ${evil.join(', ')}` : ''}`);
ok(!code.some((f) => /WebAssembly/.test(strip(read(f), f))), 'no WebAssembly');

// 10. toFixed only where numbers are not words
const TOFIXED_OK = new Set(['js/units.js', 'js/sources.js', 'js/snow.js', 'js/shade.js', 'js/labels.js']);
const tf = [];
for (const f of code) {
  if (TOFIXED_OK.has(f) || !f.endsWith('.js')) continue;
  for (const line of strip(read(f), f).split('\n')) {
    if (!/toFixed|toLocaleString/.test(line)) continue;
    // keys, SVG geometry and CSS values are not text
    if (/Key|key|transform|rotate\(|\$\{d \? 'L'|toFixed\(1\)\}%|setAttribute\('transform'|stops\.push|ms\.push|\.d \+=|d \+= /.test(line)) continue;
    tf.push(`${f}: ${line.trim().slice(0, 80)}`);
  }
}
ok(tf.length === 0, `toFixed only in js/units.js and the address, key and geometry builders${tf.length ? `: ${tf.join(' | ')}` : ''}`);

// 11. nothing that carries a step transitions
const css = read('styles.css');
ok(/\.valid, \.lead, \.track, \.track canvas \{ transition: none; animation: none; \}/.test(css), 'no transition or animation on the time row, the lead or the track');

// 12. the palette
const pal = spawnSync('python3', [path.join('norway-3d', 'tools', 'art', 'palette.py')], { cwd: path.join(APP, '..'), encoding: 'utf8' });
ok(pal.status === 0 && /ALL CHECKS PASS/.test(pal.stdout), 'tools/art/palette.py: ALL CHECKS PASS');
const PJ = JSON.parse(execFileSync('python3', [path.join('norway-3d', 'tools', 'art', 'palette.py'), '--json'], { cwd: path.join(APP, '..'), encoding: 'utf8' }));
const mat = read('js/material.js');
ok(css.includes(`--sky: ${PJ.sky.light};`) && css.includes(`--sky: ${PJ.sky.dark};`) && css.includes(`--sky-night: ${PJ.night.light};`) && css.includes(`--sky-night: ${PJ.night.dark};`), 'the skyline\'s colors in styles.css are the palette\'s');
ok(PJ.slope.every((c) => mat.includes(`'${c}'`) && html.includes(`--c:${c}`)), 'the steepness classes in the shader and the key are the palette\'s');
ok(mat.includes(`0x${PJ.relief.slice(1)}`) && mat.includes(`0x${PJ.water.slice(1)}`), 'the relief ground and water in the shader are the palette\'s');
ok(css.includes(`rgba(246, 249, 250, ${PJ.label.halo_a})`), 'the names\' halo in styles.css is the palette\'s');

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
const fonts = code.filter((f) => f.endsWith('.js')).flatMap((f) => [...read(f).matchAll(/'(\d{3} [\d.]+px [^'\n]*)'/g)].map((m) => m[1]));
ok(fonts.every((f) => /"Ysabeau Office"/.test(f)), `every script font names the face first (${fonts.length})`);
ok(!/[→➤]/.test(code.map((f) => read(f)).join('')) && !/\.\.\.['"`<]/.test(code.map((f) => read(f)).join('')), 'no arrows or "..." in shipped code');

// 14. budgets
const bytes = (fs_) => fs_.reduce((a, f) => a + fs.statSync(path.join(APP, f)).size, 0);
const CODE_CAP = 300000, FONT_CAP = 160000, ZIP_CAP = 60 * 2 ** 20;
const codeB = bytes(code), fontB = bytes(shipped.filter((f) => f.startsWith('fonts/'))), dataB = bytes(shipped.filter((f) => f.startsWith('data/')));
ok(codeB <= CODE_CAP, `app code ${fmt(codeB)} B (cap ${fmt(CODE_CAP)}, NOTES.md: Budgets)`);
ok(fontB <= FONT_CAP, `fonts ${fmt(fontB)} B (cap ${fmt(FONT_CAP)})`);
console.log(`     data ${fmt(dataB)} B; vendor ${fmt(bytes(shipped.filter((f) => f.startsWith('vendor/'))))} B`);
const zipOut = path.join(APP, 'tools', '.work', 'norway-3d.zip');
fs.mkdirSync(path.dirname(zipOut), { recursive: true });
if (fs.existsSync(zipOut)) fs.unlinkSync(zipOut);
const z = spawnSync('zip', ['-q', '-r', '-X', zipOut, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const zipB = z.status === 0 ? fs.statSync(zipOut).size : Infinity;
ok(zipB <= ZIP_CAP, `the ZIP, built as build-zips.yml builds it: ${fmt(zipB)} B (cap ${fmt(ZIP_CAP)}, the brief's 60 MB)`);
const list = spawnSync('unzip', ['-Z1', zipOut], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
ok(list.includes('index.html') && !list.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/')), `the ZIP: index.html at its top, ${list.length} entries, no tools/ or screenshots/`);

// 15. US spelling
const BRIT = /\b(judgement|colour(?!\smaps)\w*|centre\w*|centred|(?:kilo|milli|centi|deci)?metres?|behaviour\w*|recognis\w*|normalis\w*|quantis\w*|serialis\w*|optimis\w*|generalis\w*|initialis\w*|rasteris\w*|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey|favour\w*|catalogue\w*|modelled|modelling|for ever)\b/i;
const brit = textFiles.filter((f) => !f.startsWith('data/') && f !== 'fonts/OFL.txt' && f !== 'vendor/ramps-LICENSE.txt').filter((f) => {
  const s = read(f).replace(/Scientific colour maps/g, '').replace(/"[^"\n]*?(?:Licence|SeNorge|Kvaliteten)[^"\n]*"/g, '');
  return BRIT.test(s);
});
ok(brit.length === 0, `US spelling in shipped text${brit.length ? `: ${brit.map((f) => `${f} (${BRIT.exec(read(f))[0]})`).join(', ')}` : ''}`);

// 16. one list of hosts
const listed = Object.values(HOST_OF);
const missingHosts = HOSTS.filter((h) => !listed.includes(h)), extraHosts = listed.filter((h) => !HOSTS.includes(h));
ok(new Set(listed).size === listed.length && new Set(HOSTS).size === HOSTS.length && missingHosts.length === 0 && extraHosts.length === 0,
  `js/sources.js's HOSTS and miniapp.json's resourceHosts are one set of ${HOSTS.length}${missingHosts.length ? `; not in HOSTS: ${missingHosts.join(', ')}` : ''}${extraHosts.length ? `; not in miniapp.json: ${extraHosts.join(', ')}` : ''}`);

// 17. the hosts as the importer reads them (SnuggeryKit, ResourceHost.parse and PrivateNetwork)
const PRIVATE_SUFFIXES = ['.local', '.localhost', '.home.arpa', '.internal', '.lan'];
const hostIssue = (h) => (typeof h !== 'string' || h.length > 253 ? 'not a host name'
  : !/^[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/.test(h) ? 'not a host name'
    : /^\d+$/.test(h.split('.').pop()) ? 'an IP address'
      : h.split('.').some((l) => l.startsWith('xn--')) ? 'an xn-- label'
        : PRIVATE_SUFFIXES.some((x) => h.endsWith(x)) ? 'a private-network name' : null);
const badHosts = HOSTS.map((h) => [h, hostIssue(h)]).filter(([, why]) => why);
ok(HOSTS.length >= 1 && HOSTS.length <= 8 && badHosts.length === 0,
  `resource hosts: ${HOSTS.length} of 8, each a name Snuggery takes${badHosts.length ? `: ${badHosts.map(([h, why]) => `${h} (${why})`).join(', ')}` : ` (${HOSTS.join(', ')})`}`);
ok(['bad host', 'tiles.example.com:443', 'https://tiles.example.com', '*.example.com', '127.0.0.1', 'xn--80ak6aa92e.com', 'tiles.xn--p1ai', 'nas.local', 'localhost', 'a'.repeat(64) + '.com'].every((h) => hostIssue(h))
  && ['tiles.example.com', 'kart.nve.no'].every((h) => !hostIssue(h)), 'the host rule refuses what Snuggery refuses (ten samples) and takes plain names');

// 18. the online policy, pinned: Snuggery's MiniAppNetworkPolicy for these five hosts, sorted
const PINNED_CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; child-src 'self'; frame-src 'self'; object-src 'none'; connect-src 'self'; "
  + "img-src 'self' data: blob: https://cache.kartverket.no https://elevation-tiles-prod.s3.amazonaws.com https://hoydedata.no https://kart.nve.no https://wms.geonorge.no; "
  + "media-src 'self' blob:; "
  + "font-src 'self' data: https://cache.kartverket.no https://elevation-tiles-prod.s3.amazonaws.com https://hoydedata.no https://kart.nve.no https://wms.geonorge.no; "
  + "style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const servedCsp = onlineCsp(resourceHosts());
ok(servedCsp === PINNED_CSP, `tools/serve.mjs sends the pinned online policy${servedCsp === PINNED_CSP ? '' : `:\n       served ${servedCsp}\n       pinned ${PINNED_CSP}`}`);

// 19. no inline code in any page: Snuggery's InlineScripts.found (SnuggeryKit, MiniApp/InlineScripts.swift),
// ported step for step: comments dropped, lower-cased, every tag read; a tag with an on…= attribute or
// javascript: is inline code, and so is a <script> with no src, an executable type and a body.
const SCRIPT_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript', 'importmap']);
const isLetter = (c) => /\p{L}/u.test(c), isSpace = (c) => /\s/u.test(c);
const dropHtmlComments = (t) => { let out = '', rest = t; for (;;) { const o = rest.indexOf('<!--'); if (o < 0) return out + rest; out += rest.slice(0, o); const c = rest.indexOf('-->', o + 4); if (c < 0) return out; rest = rest.slice(c + 3); } };
function attributeValue(name, tag) {
  for (let i = 0; ;) {
    const at = tag.indexOf(name, i);
    if (at < 0) return null;
    i = at + name.length;
    if (at === 0 || !isSpace(tag[at - 1])) continue;
    let c = i;
    while (c < tag.length && isSpace(tag[c])) c++;
    if (c >= tag.length || tag[c] !== '=') continue;
    c++;
    while (c < tag.length && isSpace(tag[c])) c++;
    if (c >= tag.length) return '';
    if (tag[c] === '"' || tag[c] === "'") { const e = tag.indexOf(tag[c], c + 1); return tag.slice(c + 1, e < 0 ? tag.length : e); }
    let e = c;
    while (e < tag.length && !isSpace(tag[e]) && tag[e] !== '/') e++;
    return tag.slice(c, e);
  }
}
const isExecutable = (tag) => { const t = attributeValue('type', tag); return t === null || SCRIPT_TYPES.has(t.trim()); };
function hasEventHandler(tag) {
  for (let i = 0; ;) {
    const at = tag.indexOf('on', i);
    if (at < 0) return false;
    i = at + 2;
    if (at === 0) continue;
    const b = tag[at - 1];
    if (!(isSpace(b) || b === '/' || b === '"' || b === "'")) continue;
    let c = i, n = 0;
    while (c < tag.length && isLetter(tag[c])) { c++; n++; }
    if (!n) continue;
    while (c < tag.length && isSpace(tag[c])) c++;
    if (c < tag.length && tag[c] === '=') return true;
  }
}
function inlineScriptsFound(page) {
  const text = dropHtmlComments(page).toLowerCase();
  for (let search = 0; ;) {
    const open = text.indexOf('<', search);
    if (open < 0) return false;
    const close = text.indexOf('>', open + 1);
    if (close < 0) return false;
    const tag = text.slice(open + 1, close);
    search = close + 1;
    if (!tag.length || !isLetter(tag[0])) continue;
    if (hasEventHandler(tag) || tag.includes('javascript:')) return true;
    if (/^[\p{L}\p{N}]*/u.exec(tag)[0] !== 'script') continue;
    const end = text.indexOf('</script', close + 1);
    if (end < 0) return text.slice(close + 1).trim() !== '' && isExecutable(tag);
    const body = text.slice(close + 1, end);
    search = end + '</script'.length;
    if (attributeValue('src', tag) === null && isExecutable(tag) && body.trim() !== '') return true;
  }
}
const INLINE_SAMPLES = [
  ['<script>go()</script>', true], ['<SCRIPT type="module">go()</SCRIPT>', true], ['<script type="importmap">{}</script>', true],
  ['<button onclick="go()">', true], ['<img src="a.png" onerror = "go()">', true], ['<a href="javascript:go()">', true], ['<body><script>go()', true],
  ['<script src="app.js"></script>', false], ['<script type="module" src="app.js"></script>', false], ['<script type="application/json">{"a":1}</script>', false],
  ['<!-- <script>go()</script> <b onclick="x()"> -->', false], ['<p>Based on=data, javascript: in words</p>', false], ['<button data-on="x" aria-label="on">', false],
];
const portWrong = INLINE_SAMPLES.filter(([t, want]) => inlineScriptsFound(t) !== want);
ok(portWrong.length === 0, `the inline-code rule agrees with Snuggery's on ${INLINE_SAMPLES.length} samples${portWrong.length ? `; wrong on: ${portWrong.map(([t]) => t).join(' | ')}` : ''}`);
const pages = shipped.filter((f) => /\.html?$/i.test(f));
const inlinePages = pages.filter((f) => inlineScriptsFound(read(f)));
ok(pages.length >= 1 && inlinePages.length === 0, `no inline script, on…= attribute or javascript: address in ${pages.length} page${pages.length === 1 ? '' : 's'}${inlinePages.length ? `: ${inlinePages.join(', ')}` : ''}`);

console.log(fails.length ? `\n${fails.length} FAIL: SOME CHECKS FAIL` : '\nall checks pass');
process.exit(fails.length ? 1 : 0);
