// Static checks for Besseggen (HOUSE.md section 7.1; the change list, step 20, in tools/DECISIONS.md). Node, no dependencies but
// python3 for tools/art/palette.py; Milky Way's and Global Weather's tools/check.mjs in shape:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships outside vendor/, which is
//      pinned by sha256 instead (three.js r186, byte for byte the Anatomy copy);
//   3. every import / src / href / url( / fetch( and every data file the loader names is relative,
//      inside the folder, present;
//   4. fonts/ holds exactly the house face and its OFL.txt; data/ exactly the 17 files;
//   5. the face's and OFL.txt's sha256; CREDITS.txt credits the face; no dropped face is named;
//   6. the data is as recorded: each file's sha256 as NOTES.md tables it, combined 97d6b944…2cd3
//      (about.json and colors.json rebuilt by the pipeline follow-up of 2026-10-01; the other fifteen
//      byte for byte as before the pass, whose digest was 047cc6a1…a01e);
//   7. miniapp.json is valid (name unchanged, description at most 200 characters);
//   8. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   9. the credit line, word for word, in the CREDITS constant written to #credits;
//  10. the marketing camera's strings (HOUSE.md section 7.4; ART.md section 5): CEST and CET written
//      only by the time row, never in static text outside About; the grip's three names; Fit the route,
//      Fly the route and Stop; the viewpoint keys as buttons named from data/viewpoints.json; the
//      double-tap; Play and Pause; Hide the controls; Show the controls; every localStorage key under
//      besseggen: and every key read before the pass still read;
//  11. SI: no plain space between a digit and a unit in strings the app writes; toFixed and
//      toLocaleString only in js/units.js and in SVG geometry;
//  12. no transition or animation on the track, the time row or the lead;
//  13. innerHTML: no more sites than before the pass (11), none new, values escaped; no
//      insertAdjacentHTML, outerHTML, document.write, eval or new Function;
//  14. js/plate.js equals `python3 tools/art/palette.py --json`, palette.py passes, and styles.css
//      carries the palette's Burn, halo and ghost colors;
//  15. the tells: no box-shadow, backdrop-filter, text-shadow, `transition: all`, uppercase,
//      letter-spacing or monospace; no middle dot, arrow or "..." in what the app writes; both
//      theme-color metas equal --page; the @font-face rule exactly; the chrome tokens exactly the
//      house values in both themes; one family; every script font names the face first;
//  16. budgets: app code at most the cap (227 000 bytes, the lead's ruling, plan 0011 D11 and
//      tools/DECISIONS.md owner call 1; 215 934 when the pass began, held by HOUSE.md section 8),
//      fonts/ at most 160 000, the ZIP built exactly as build-zips.yml builds it at most 21 088 756
//      (16 871 005 before the pass, times 1.25) with index.html at its top;
//  17. US spelling in every shipped text file but data/ and fonts/OFL.txt, the data's own keys and
//      proper names excepted; data/about.json, which About shows verbatim, holds no British spelling
//      and no em dash (owner call 11, settled by the pipeline follow-up of 2026-10-01).
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PLATE } from '../js/plate.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE_CAP = 227000;
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source, roughly; shader source (tagged glsl) is code, not text. */
const unGlsl = (src) => src.replace(/\/\* glsl \*\/\s*`(?:[^`\\]|\\.)*`/g, '``');
const strings = (src) => [...code(unGlsl(src), 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);

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

// 2. No URL in the app's own code; vendor/ pinned instead
const web = shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f) && !f.startsWith('vendor/'));
const withUrls = web.filter((f) => /https?:\/\//i.test(read(f)));
ok(withUrls.length === 0, `no http(s):// in ${web.length} .html/.css/.js files outside vendor/${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);
const VENDOR = {
  'vendor/OrbitControls.js': '30386f7141d5ce5d5e0a3ab643e4eb16265f4564466108105ce449857f62fdda',
  'vendor/RoomEnvironment.js': '77d4d2bed2b60cb98424764264aedd84b56bbf3211e0f48430e15608aeded9dc',
  'vendor/three-LICENSE.txt': '8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc',
  'vendor/three.core.js': '9edde002b066a9a05676a6127f67735b62baf399bdea529f2f7e31657da769e6',
  'vendor/three.module.js': '9052042d676cb0fdc1ddfefe193053f34b7ac0513a616fdac4535d49987812ea',
};
const vendorHave = shipped.filter((f) => f.startsWith('vendor/')).sort();
ok(JSON.stringify(vendorHave) === JSON.stringify(Object.keys(VENDOR).sort()) && Object.entries(VENDOR).every(([f, h]) => sha(f) === h),
  `vendor/ is three.js r186 byte for byte: ${vendorHave.map((f) => `${f} ${sha(f).slice(0, 8)}…`).join(', ')}`);

// 3. References: relative, inside the folder, present
const refs = [];
for (const f of web) {
  const src = code(read(f), f);
  for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) refs.push([f, m[1], path.dirname(f)]);
  for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\(|getJSON\()\s*['"]([^'"]+)['"]/g)) refs.push([f, m[1], '.']);
}
{
  // the files the loader names by list: data/<name>.geojson and data/<name>.json, and each level's file
  const data = read('js/data.js');
  const geo = JSON.parse((data.match(/const geoNames = (\[[^\]]+\])/) || [, '[]'])[1].replace(/'/g, '"'));
  const edit = JSON.parse((data.match(/export const EDITABLE = (\[[^\]]+\])/) || [, '[]'])[1].replace(/'/g, '"'));
  for (const n of geo) refs.push(['js/data.js', `data/${n}.geojson`, '.']);
  for (const n of edit) refs.push(['js/data.js', `data/${n}.json`, '.']);
  for (const L of JSON.parse(read('data/manifest.json')).levels) refs.push(['data/manifest.json', `data/${L.file}`, '.']);
}
const bad = refs.filter(([f, r, dir]) => {
  if (r.startsWith('#') || r.startsWith('${')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || (r.split('/').includes('..') && !r.startsWith('../vendor/') && !r.startsWith('../js/'))) return true;
  const resolved = path.resolve(APP, dir, r);
  return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
});
ok(bad.length === 0 && refs.length > 40, `references: ${refs.length} (imports, src, href, url(), fetch(), the loader's data files): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);

// 4–6. fonts/ and data/ exactly; the face's and the data's sha256
const DATA = {
  'about.json': 'df7368bc874a8e11b8d3eb33b0bad8f43f2df208ed6e57fefe4563d7f47d5813',
  'colors.json': '66ef3f5566cd5093ec4f3ec465c58c250c19902983dbff7441b1442e6ab08d7c',
  'glaciers.geojson': '9f6dc7dc233c75f97b0dcaff3efc240ea15e8c79b9156114e5b005e272bb011b',
  'manifest.json': '40e2807ecba4392d77669ed5a2fe959e160868fc2f8f8276a327bd64786dd751',
  'pace.json': '9324bce7b911c37192be67bb2cbd2f9c00cf2059ce2ff7c2cf6c5eaecbc5cb7b',
  'places.geojson': '110e0e2a47ac214e8828b23a60dc197bbd461ce2b9498eafc49b93ddd62f900e',
  'rivers.geojson': '211d4e6299ab61709a63c07526a250f830151760e3ec68af9095af97abb66dbd',
  'route.geojson': '86d5e9bf7852ec072c872ae6ebf9024fab7f82f2e17f2f5172b6c5553d64e6d5',
  'terrain-L0.bin': '6381f5e086b1c6618a8888edb13489f79ee63719deda201a354e66ca01cfc523',
  'terrain-L1.bin': 'fe9afa39e5748f8091ee2d40634496b9a9e44f6a80fff5df470bce1d4a190f85',
  'terrain-L2.bin': 'e4edc0757077a5aad6d44f77288855532861f527aaf7fdbc19fdb0c7793b4bea',
  'terrain-L3.bin': 'da6f003063aeb1fbe9bca71df3105d387e9456a821bb6b86488733c2a97bfc4b',
  'terrain-L4.bin': '11db80a0d6c530792742600ced64d88a95d4ef8957045aa4f54c1f0c3d3af5c7',
  'terrain-L5.bin': 'e731e50e6e6eaa89e3d6b3ab5d322605a4f59b177054383f45761c2a1ad5a944',
  'viewpoints.json': '7486141e889be676910a40edb639dee165cec9618213876cc99212af35283dee',
  'water.geojson': '7dfa09596aebcfdd60be9cc7771dd4c89b0cf19bcca1aafabcc0fef2ff8b5f16',
  'waypoints.json': 'd64cb0970a97093cdfe2a197f8091ae09c28ccc134ecccd86ff200889c57a77e',
};
const FONTS = {
  'ysabeau-office-gw.woff2': 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262',
  'OFL.txt': 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269',
};
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort();
  const want = [...names].sort();
  const same = JSON.stringify(have) === JSON.stringify(want);
  ok(same, `${dir}/ holds exactly its ${want.length} files${same ? '' : `; extra ${have.filter((h) => !want.includes(h)).join(', ') || 'none'}, missing ${want.filter((x) => !have.includes(x)).join(', ') || 'none'}`}`);
};
exactly('fonts', Object.keys(FONTS));
exactly('data', Object.keys(DATA));
for (const [f, h] of Object.entries(FONTS)) ok(fs.existsSync(path.join(APP, 'fonts', f)) && sha(`fonts/${f}`) === h, `fonts/${f} sha256 ${fs.existsSync(path.join(APP, 'fonts', f)) ? sha(`fonts/${f}`).slice(0, 12) : 'missing'}… is the house's (${h.slice(0, 12)}…)`);
ok(/Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')), 'fonts/OFL.txt names the face and carries the SIL Open Font License 1.1');
{
  const line = /Ysabeau Office by Christian Thalmann \(Catharsis Fonts\), SIL Open Font License 1\.1; a subset is in fonts\/ with its license\./;
  const dropped = [...web, 'CREDITS.txt', 'NOTES.md', 'miniapp.json'].filter((f) => /Atkinson|Newsreader/.test(read(f)));
  ok(line.test(read('CREDITS.txt').replace(/\s+/g, ' ')) && line.test(read('NOTES.md').replace(/\s+/g, ' ')) && line.test(read('index.html') + read('app.js')) && !/no font/i.test(read('CREDITS.txt')) && dropped.length === 0,
    `the font's credit line word for word in CREDITS.txt, NOTES.md and About; no code, credit or note names a dropped face${dropped.length ? ': ' + dropped.join(', ') : ''}`);
}
{
  const changed = Object.entries(DATA).filter(([f, h]) => !fs.existsSync(path.join(APP, 'data', f)) || sha(`data/${f}`) !== h).map(([f]) => f);
  // the digest NOTES.md records: `find data -type f | sort | xargs shasum -a 256 | shasum -a 256`
  const all = crypto.createHash('sha256').update(Object.keys(DATA).sort().map((f) => `${DATA[f]}  data/${f}\n`).join('')).digest('hex');
  ok(changed.length === 0 && all === '97d6b944924f5c1d557ffed80043554d5aa5cfeb0433d23bf78de1d024652cd3',
    `the data is as recorded: ${Object.keys(DATA).length} files at their sha256 in NOTES.md, about.json and colors.json from the pipeline follow-up (combined ${all.slice(0, 8)}…${all.slice(-4)})${changed.length ? '; CHANGED: ' + changed.join(', ') : ''}`);
}

// 7. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Besseggen' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && typeof mini.version === 'string' && mini.version,
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
}

// 8. No AI vendor or model name in shipped text (Global Weather's list, ROT13, copied as it is)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = [...shipped.filter((f) => /\.(html|css|js|json|geojson|md|txt)$/.test(f) && !f.startsWith('vendor/')), 'ART.md'].filter((f, i, a) => a.indexOf(f) === i && fs.existsSync(path.join(APP, f)));
const named = texts.filter((f) => namesRe.test(read(f)));
ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files and ART.md${named.length ? ': ' + named.join(', ') : ''}`);

// 9. The credit line
const app = read('app.js');
const credits = (app.match(/^const CREDITS = '([^']*)';$/m) || [])[1];
ok(credits === 'Terrain, trail, lakes and names: Kartverket, CC BY 4.0' && /\$\('credits'\)\.textContent = CREDITS;/.test(app),
  `the credit line: CREDITS is "${credits}", written to #credits (owner call 8)`);

// 10. The marketing camera's strings and keys
const html = read('index.html');
{
  const before = code(html.slice(0, html.indexOf('<div class="dlg" id="about"')), 'x.html');
  const zone = /text\('t-zone', `\$\{U\.NN\}\$\{U\.zone\(off\)\}`\);/.test(app) && /export const zone = \(off\) => \(off === 2 \? 'CEST' : 'CET'\);/.test(read('js/units.js'));
  const grip = /const GRIP = \['Show more controls', 'Show all controls', 'Hide the extra controls'\];/.test(app) && /<button type="button" class="grip" id="grip" aria-label="Show more controls">/.test(html);
  const keys = ['<button type="button" id="btn-fit" aria-label="Fit the route">', '<button type="button" class="word" id="btn-fly">Fly the route</button>', 'id="t-play" aria-label="Play"', 'aria-label="Hide the controls"', 'aria-label="Show the controls" aria-keyshortcuts="Escape"'].every((s) => html.includes(s));
  const said = ["$('btn-fly').textContent = 'Stop';", "'Step to the next point' : 'Fly the route'", "on ? 'Pause' : 'Play'", "focus.toggle('tap')"].every((s) => app.includes(s));
  const vp = JSON.parse(read('data/viewpoints.json')).viewpoints.some((v) => v.name === 'From the boat on Gjende') && /<button type="button" class="word" data-vp="\$\{i\}">\$\{escapeHtml\(v\.name/.test(app);
  const fit = [...html.matchAll(/aria-label="Fit the route"|>Fit the route</g)].length === 1 && !/['"`>]Stop['"`<]/.test(html);
  ok(zone && !/CES?T/.test(before.replace(/<[^>]+>/g, ' ')) && grip && keys && said && vp && fit,
    `camera: CEST and CET written by the time row only (${zone}) and in no static text before About; the grip's three names (${grip}); Fit the route (one button), Fly the route, Stop, Play and Pause, Hide the controls, Show the controls (${keys && said}); "From the boat on Gjende" a button from data/viewpoints.json (${vp}); the double-tap toggles focus mode`);
  const direct = web.filter((f) => f !== 'js/util.js' && /localStorage/.test(code(read(f), f)));
  const src = [app, read('js/focus.js')].join('\n');
  const got = new Set([...src.matchAll(/store\.get\('(\w+)'/g)].map((m) => m[1]));
  const saved = new Set([...[...src.matchAll(/store\.set\('(\w+)'/g)].map((m) => m[1]), ...((app.match(/for \(const k of (\[[^\]]+\])\) store\.set/) || [, '[]'])[1].match(/'\w+'/g) || []).map((k) => k.slice(1, -1))]);
  const BEFORE = ['camera', 'cursor', 'date', 'exag', 'eyeM', 'layers', 'marker', 'minutes', 'paceFit', 'paceModel', 'reversed', 'savedViews', 'sheet'];
  const RETIRED = ['debug', 'focusHintSeen'];        // owner calls 5 and 6: the debug readout and the gesture card went
  ok(/const KEY = 'besseggen:';/.test(read('js/util.js')) && direct.length === 0 && BEFORE.every((k) => got.has(k) && saved.has(k)) && got.has('focus') && saved.has('focus')
    && [...got, ...saved].every((k) => [...BEFORE, 'focus'].includes(k)) && RETIRED.every((k) => !got.has(k)),
  `storage: every key under besseggen: through util.js's store; the ${BEFORE.length} keys read before the pass still read and written; focus added; ${RETIRED.join(' and ')} retired (owner calls 5, 6)${direct.length ? '; direct localStorage in ' + direct.join(', ') : ''}`);
}

// 11. SI notation in what the app writes; toFixed and toLocaleString only where allowed
const appFiles = ['index.html', 'app.js', ...shipped.filter((f) => /^js\/[^/]+\.js$/.test(f))];
{
  // symbols only: the spoken forms ("13 hours 38 minutes", "1 741 meters") are words for VoiceOver
  const UNIT = /\d (°|%|m|km|km\/h|mm|h|min|s|px|bytes)(?![\w/])/;
  const hits = [];
  for (const f of appFiles) {
    const lits = f.endsWith('.html') ? [code(read(f), f).replace(/<[^>]+>/g, ' ')] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0').replace(/&#8239;/g, ' '))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  const real = hits;
  ok(real.length === 0, `SI: no plain space between a digit and a unit in ${appFiles.length} files' strings${real.length ? ': ' + real.join(' | ') : ''}`);
  // SVG geometry (path data, coordinates, the counter-scale) is not text anyone reads
  const SVG = /(\b(d|x1|x2|y1|y2|cx|cy|data-ax|data-ay)="\$\{[^"]*toFixed|[ML]\$\{[^}]*toFixed|'M'\}\$\{X\(i\)\.toFixed|`M0 \$\{|setAttribute\('(x|y|x1|x2|transform)'|scale\(\$\{sx\.toFixed)/;
  const fixedHits = [];
  for (const f of appFiles.filter((x) => x.endsWith('.js') && x !== 'js/units.js')) {
    code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString)\(/.test(l) && !SVG.test(l)) fixedHits.push(`${f}:${i + 1}`); });
  }
  ok(fixedHits.length === 0, `SI: toFixed/toLocaleString only in js/units.js and SVG geometry${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 12. Nothing that carries a step transitions
const css = read('styles.css');
{
  const rules = [...code(css, 'x.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const moving = rules.filter(([, sel, body]) => /\.(valid|lead|track|zone)\b|#slider|#t-date|#t-zone|#track/.test(sel) && /(transition|animation)\s*:\s*(?!\s|none)/.test(body));
  ok(moving.length === 0 && /\.valid, \.lead, \.track, \.track canvas \{ transition: none; animation: none; \}/.test(css),
    `no transition or animation on the track, the time row or the lead${moving.length ? ': ' + moving.map((m) => m[1].trim()).join('; ') : ' (and styles.css says none on them)'}`);
}

// 13. innerHTML: 11 sites before the pass (app.js 10, js/profile.js 1); none new, every value escaped
{
  const uses = [];
  for (const f of web.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)\s*([^;\n]*)/g)) if (m[2].trim() !== "''") uses.push(`${f}: ${m[2].trim().slice(0, 30)}`);
  // the labels, the card's body, Layers, the viewpoint keys, About's generated sections, the profile
  const KNOWN = [/^app\.js: html$/, /^app\.js: LAYERS\.map/, /^app\.js: list\.length/, /^app\.js: '<section><h3>This data/, /^js\/profile\.js: `<clipPath/];
  const known = uses.filter((u) => KNOWN.some((k) => k.test(u)));
  // every interpolation in those builders is escaped, a number, a constant or row(), which escapes
  const row = /const row = \(k, v\) => `<dt>\$\{escapeHtml\(k\)\}<\/dt><dd>\$\{escapeHtml\(v\)\}<\/dd>`;/.test(app);
  ok(uses.length <= 11 && known.length === uses.length && row && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} sites (11 before the pass): ${uses.map((u) => u.split(':')[0] + ' ' + u.split(': ')[1].slice(0, 16)).join(', ')}; row() escapes; no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 14. The plate's colors are palette.py's, and palette.py's checks pass
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8', cwd: path.join(APP, '..') });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8', cwd: path.join(APP, '..') });
  let same = false;
  try { same = JSON.stringify(JSON.parse(json.stdout)) === JSON.stringify(PLATE); } catch { /* reported below */ }
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  ok(same, `js/plate.js equals python3 besseggen/tools/art/palette.py --json (${Object.keys(PLATE).join(', ')})`);
  const burn = [...css.matchAll(/--burn: (#[0-9a-f]{6})/g)].map((m) => m[1]);
  const [r, g, b] = PLATE.ghost.halo, halo = `rgba(${r}, ${g}, ${b}, ${PLATE.ghost.haloAlpha})`;
  ok(burn.join() === `${PLATE.burn.light},${PLATE.burn.dark}` && css.includes(`--plate-ink: ${PLATE.label.ink};`) && css.includes(`--plate-ink-2: ${PLATE.label.ink2};`)
    && css.includes(`--plate-halo: rgba(246, 249, 250, ${PLATE.label.halo_a});`) && PLATE.label.halo === '#f6f9fa'
    && css.includes(`.ghost .halo { stroke: ${halo};`) && css.includes(`.ghost .mark { stroke: ${PLATE.ghost.stroke};`) && css.includes(`opacity: ${PLATE.ghost.rest};`),
  `styles.css carries the palette's Burn (${burn.join(' / ')}), the labels' ink and halo, and the ghost key's stroke, halo and resting opacity`);
}

// 15. The tells
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/text-shadow/, 'text-shadow'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace/, 'monospace']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `styles.css: no box-shadow, backdrop-filter, text-shadow, transition: all, uppercase, letter-spacing or monospace${found.length ? ': ' + found.join(', ') : ''}`);
  const dots = [];
  for (const f of appFiles.filter((x) => x.endsWith('.js'))) for (const s of strings(read(f))) if (/[·—]/.test(s)) dots.push(`${f}: ${s.slice(0, 50)}`);
  if (/[·—]/.test(code(html, 'x.html').replace(/<[^>]+>/g, ' '))) dots.push('index.html');
  ok(dots.length === 0, `no middle dot or em dash in any string the app writes${dots.length ? ': ' + dots.join(' | ') : ''}`);
  const arrows = [];
  for (const f of web) {
    const src = read(f);
    if (/[→➤]/.test(src)) arrows.push(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? code(src, f).replace(/<[^>]+>/g, ' ') : '';
    if (/\w\.\.\.(?!\w)|\.\.\.\s/.test(lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤ or "..." in the shipped code or the text the app shows${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const light = c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)'));
  const dark = c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('* { box-sizing'));
  const tok = (block, name) => (block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  const HOUSE = { page: ['#e8eef0', '#141d21'], sheet: ['#f6f9fa', '#1c272c'], ink: ['#0f1c23', '#e6edee'], 'ink-2': ['#45555d', '#a3b1b6'], 'ink-3': ['#5b6a72', '#8b9a9f'], line: ['#c9d4d8', '#2a373c'], 'line-strong': ['#74858c', '#64757b'] };
  const off = Object.entries(HOUSE).filter(([n, [l, d]]) => tok(light, n) !== l || tok(dark, n) !== d).map(([n]) => n);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /color-scheme: light;/.test(light) && /color-scheme: dark;/.test(dark) && /html, body \{[^}]*background: var\(--page\);/.test(c),
    `the chrome tokens are the house's in both themes, html and body on --page${off.length ? '; DIFFER: ' + off.join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s === 'light' ? light : dark, 'page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')}`);
  ok(/@font-face \{\n  font-family: 'Ysabeau Office';\n  src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\n  font-weight: 400 650;\n  font-display: block;\n\}/.test(css) && (css.match(/@font-face/g) || []).length === 1,
    '@font-face: the house rule word for word, and the only one');
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  const faces = [...c.matchAll(/(?:^|[;{\s])font:\s*([^;]+);/g)].map((m) => m[1]).filter((v) => !/var\(--face\)|inherit/.test(v));
  ok(families.every((f) => f === "'Ysabeau Office'") && faces.length === 0 && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c),
    `one family, through --face (${families.length} @font-face family name, ${faces.length} other font stacks)`);
  const scriptFonts = [];
  for (const f of appFiles.filter((x) => x.endsWith('.js'))) for (const s of strings(read(f))) if (/\d+(\.\d+)?px\b/.test(s) && /\b(400|560|600|620|650|bold|normal)\b/.test(s) && /px\s+["']?[A-Za-z$]/.test(s) && !/px "Ysabeau Office"|px \$\{|^`\$\{FONTS/.test(s)) scriptFonts.push(`${f}: ${s.slice(0, 50)}`);
  ok(scriptFonts.length === 0 && /mctx\.font = `\$\{FONTS\[f\]\} "Ysabeau Office"/.test(app), `every font string in a script names "Ysabeau Office" first${scriptFonts.length ? ': ' + scriptFonts.join(' | ') : ''}`);
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f) && !f.startsWith('vendor/') && !f.startsWith('data/'));
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= CODE_CAP, `app code ${fmt(codeBytes)} bytes (cap ${fmt(CODE_CAP)}, the lead's ruling, plan 0011 D11; ${codeBytes <= CODE_CAP ? `${fmt(CODE_CAP - codeBytes)} to spare` : `${fmt(codeBytes - CODE_CAP)} OVER: owner call 1 in tools/DECISIONS.md`}): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= 160000, `fonts/ ${fmt(fontBytes)} bytes (budget 160,000; 87,680 before the pass)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'besseggen.zip'); fs.rmSync(zip, { force: true });
execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim().split('\n');
const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
const names = entries.map((p) => p.slice(7).join(' '));
const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((n, p) => n + Number(p[2]), 0);
const zsize = fs.statSync(zip).size;
ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
ok(names.length === shipped.length && names.every((n) => shipped.includes(n)) && !names.some((f) => f.startsWith('tools/') || f.startsWith('screenshots/') || f.split('/').some((p) => p.startsWith('.'))),
  `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/ or dotfiles`);
console.log(`     stored in the ZIP: data/ ${fmt(stored((n) => n.startsWith('data/')))}, vendor/ ${fmt(stored((n) => n.startsWith('vendor/')))}, fonts/ ${fmt(stored((n) => n.startsWith('fonts/')))}, app code ${fmt(stored((n) => codeFiles.includes(n)))}, *.md and *.txt ${fmt(stored((n) => /\.(md|txt)$/.test(n) && !n.includes('/')))}`);
ok(zsize <= 21088756, `ZIP size ${fmt(zsize)} bytes (budget 21,088,756: 16,871,005 before the pass, times 1.25)`);

// 17. US spelling in every shipped text file but data/ (pipeline output) and fonts/OFL.txt (upstream)
{
  const BRIT = /\b(judgement|colour\w*|centre\w*|centred|(?:kilo|milli|centi|deci)?metres?|behaviour\w*|recognis\w*|normalis\w*|quantis\w*|serialis\w*|optimis\w*|generalis\w*|initialis\w*|rasteris\w*|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey|favour\w*|catalogue\w*|modelled|modelling|for ever)\b/i;
  // the data's own keys, which the code must spell as the data does (about.json's license key)
  const DATA_WORDS = /\b(b|t|tr|md|pn)\.licence\b|'quantisation'/g;
  const hits = [];
  for (const f of [...texts, 'ART.md'].filter((x, i, a) => a.indexOf(x) === i && !x.startsWith('data/') && x !== 'fonts/OFL.txt')) {
    read(f).split('\n').forEach((line, i) => {
      // proper names keep their spelling; in Markdown, code spans quote code and data verbatim
      const l = (f.endsWith('.md') ? line.replace(/`[^`]*`/g, '') : line.replace(DATA_WORDS, '')).replace(/Norwegian Licence for Open Government Data/g, '');
      const m = l.match(BRIT);
      if (m) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in ${texts.length} shipped text files outside data/, comments and identifiers included${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
  // About shows data/about.json's values verbatim, so the pipeline writes them in US English with no
  // em dash (owner call 11; tools/06_editable.py, swept and rebuilt on 2026-10-01); its keys are data
  const ab = JSON.parse(read('data/about.json'));
  const vals = []; (function walk(o) { for (const [k, v] of Object.entries(o || {})) if (typeof v === 'string') vals.push(v); else if (v && typeof v === 'object') walk(v); })(ab);
  const words = vals.join('\n').match(new RegExp(BRIT.source, 'gi')) || [], dashes = (vals.join('').match(/—/g) || []).length;
  ok(words.length === 0 && dashes === 0, `data/about.json, shown verbatim in About, holds ${words.length} British spellings${words.length ? ` (${[...new Set(words.map((w) => w.toLowerCase()))].join(', ')})` : ''} and ${dashes} em dashes in its ${vals.length} values (owner call 11)`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
