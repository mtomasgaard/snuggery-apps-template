// Static checks for Milky Way (HOUSE.md section 7.1; the change list, step 20, in tools/DECISIONS.md). Node, no dependencies but
// python3 for tools/art/palette.py; Global Weather's tools/check.mjs in shape, changed for this app:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships outside vendor/, which is
//      pinned by sha256 instead (three.js r186, byte for byte the Anatomy and Besseggen copy);
//   3. every import / src / href / url( / fetch( and DATA path is relative, inside the folder, present;
//   4. fonts/ holds exactly the house face, its OFL.txt and the Greek supplement; data/ exactly the 33
//      files recorded before the pass;
//   5. the three font files' sha256; CREDITS.txt credits the face and names no dropped face;
//   6. the data is as the follow-up's pipeline rebuild left it (2026-10-01): each data file's sha256
//      equals the one recorded then (22 files byte for byte as before the pass; 11 JSON files whose
//      prose went to US English, every number as before: tools/DECISIONS.md section 9);
//   7. miniapp.json is valid (name unchanged, description at most 200 characters);
//   8. no AI vendor or model name in any shipped text file (Global Weather's list, stored ROT13);
//   9. the credit line, verbatim, in the CREDITS constant written to #credits;
//  10. the marketing camera's strings (HOUSE.md section 7.4): the caption's "You are ... from the Sun"
//      written by the frame loop and in no static text, the three scale words as buttons, Play,
//      Hide the controls, Show the controls; every localStorage key under milkyway: and today's
//      layers, speed and camera still read;
//  11. SI: no plain space between a digit and a unit in strings the app writes; toFixed and
//      toLocaleString only in js/units.js and the allow-listed non-text use;
//  12. no transition or animation on the track, the time row or the lead;
//  13. innerHTML: no new uses, the two left set from constants or escaped values; no
//      insertAdjacentHTML, outerHTML, document.write, eval or new Function;
//  14. js/plate.js equals `python3 tools/art/palette.py --json`, and palette.py passes;
//  15. the tells: no box-shadow, backdrop-filter, text-shadow, `transition: all`, uppercase or
//      letter-spacing in styles.css; no middle dot in a string the app writes; no arrow or "..." in
//      shipped text; both theme-color metas equal --page; the @font-face rules exactly; the chrome
//      tokens exactly the house values in both themes; one family; every script font names the face;
//  16. budgets: app code at most 242 000 bytes (it was 223 463 when the pass began, over the 200 000
//      cap, and HOUSE.md section 8 held it there; the lead set 240 000 on 2026-10-01 for the house
//      modules, then 242 000 the same day for the zoom keys and the view offset that keeps a globe
//      flown to clear of the card, and recorded why in tools/DECISIONS.md), fonts/ at most 160 000,
//      and the ZIP built exactly as build-zips.yml builds it at most 8 156 512 (today times 1.25)
//      with index.html at its top;
//  17. US spelling in every shipped text file but data/, CREDITS.txt (pipeline output quoting its
//      sources) and fonts/OFL.txt, the data's own keys excepted; and in the prose the app shows from
//      data/ (About and the card), proper names excepted.
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PLATE } from '../js/plate.js';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => n.toLocaleString('en-US');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. Shader source, the template literals
 *  js/gfx.js tags `/* glsl *\/`, is code the GPU reads, not text anyone sees: it is dropped before the
 *  comments are, or GLSL like `vec2 d` reads as "2 d", a number and a unit. */
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
  'vendor/three.core.js': '9edde002b066a9a05676a6127f67735b62baf399bdea529f2f7e31657da769e6',
  'vendor/three.module.js': '9052042d676cb0fdc1ddfefe193053f34b7ac0513a616fdac4535d49987812ea',
  'vendor/three-LICENSE.txt': '8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc',
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
  for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\()\s*['"]([^'"]+)['"]/g)) refs.push([f, m[1], '.']);
  for (const m of src.matchAll(/DATA \+ '([^']+\.(?:json|bin))'/g)) refs.push([f, `data/${m[1]}`, '.']);
}
const bad = refs.filter(([f, r, dir]) => {
  if (r.startsWith('#') || r.startsWith('${')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..') && !r.startsWith('../vendor/') && !r.startsWith('../js/')) return true;
  const resolved = path.resolve(APP, dir, r);
  return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
});
ok(bad.length === 0 && refs.length > 30, `references: ${refs.length} (imports, src, href, url(), fetch(), DATA paths): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);

// 4–6. fonts/ and data/ exactly; the faces' and the data's sha256
const DATA = {
  'about.json': 'f5ef39a0446be8a4ea02175541cface1a734a34132d98d40945c8f5d1398daeb',
  'ephem.bin': 'beec87c2c9efa10fed6d04ce8193123df9ff984fe2181ae7e24acdce653eab7c',
  'ephem.json': 'd348b3bb1d303ad8e1045b65061f4e6608f8e1901e6e9de3a6e12ea2eb619e49',
  'galaxy/galaxy.json': '43440981e28a354c68275353bac69027ae7d38f4f4744cf65a4261d97df4a236',
  'galaxy/model.png': 'be02deff91dfc8b31b0afc9cb41700e7cbe1bbc0300285e8cd2f2baa531ec26a',
  'galaxy/young-gaiadr3-ob.png': 'd15b1dd28f77adc52744450f6acdae67cc6941bcec21d43752977c7436211676',
  'galaxy/young-poggio2021-ums.png': '70f58634871aeadfd3b792b60b889e7e7f24f90a1c203f379864a35e71af9064',
  'moons.bin': 'a5a38dde526376e76b0e92c4c50de531feb0d4114400ec656ce23e293c889893',
  'moons.json': '6ef8610f2a2abd2cfa135c839c63e774336b750d1855e28a5186f83932e455ee',
  'physical.json': '68e07f0fce0951f43e77c999d581cf158cdea8bbd4c58020c6f4988cfddbdf10',
  'sky/gaia-dr3-counts.jpg': 'c1e4d3efdd5cca63bf06bb2fa7011cc0ef7e113df36b50122f73213d810e79a3',
  'sky/sky.json': 'fc8428e7db28432df6579497f4b2ad06084aa063662c90c79e9479dbff500f9c',
  'smallbodies.bin': 'ec48e8493f095997f3067ee224161e5f19e2a30fa914602b6a3f75f7396bc8b8',
  'smallbodies.json': '8cebbbe19f9f799507d1c00a98aac7c5266d7be2a6ab4ee6764fc7881961f00b',
  'stars/colour.json': '8b96165d73c2d1fda9559cd6e1d055c96512797ac35ded00f6654d0593b8eeb4',
  'stars/constellations.json': '406f258af1e57462117038cc9cd27ad4fa7ace8c7b2c2d70a043dc133645ffd0',
  'stars/deep.bin': '85c43c6503ffd1032ee30faee9d8b4d45281af97ddec57496aaa4fe7c1caaaba',
  'stars/deep.json': 'd038f378fab115a04f5c346a81a9934eebcd98345b85a5288c24cac37a5d3b36',
  'stars/exoplanets.json': 'e4662444b8140db4bd0bf5605815eb86a7eca74135a20bbe25d9374c674a5eb5',
  'stars/named.json': 'e818dce6ff112ffe7d17132fb26f054b4abe9a2dc3edd191c98e8c2e93aedd10',
  'tex/earth_night.jpg': '6de57be03bef846c15789fb024d3f053710814dbed49c8dee29666b788dd39c5',
  'tex/earth.jpg': '7405c39a220bc37519474eba54625a0d1a02b6ad954895147c103a1bc8dd61fb',
  'tex/ganymede.jpg': '94001950977c0b87e9790c2f59a12e52e9d4c366db85ac155d8968c79cdae8b5',
  'tex/io.jpg': 'd91644378edba10c8db02b913bbb2411d043f571d55088de97739aa8e7e5d5c2',
  'tex/jupiter.jpg': '050b6b6f7f5444e7eed29f11f7d6b101059ccbcd2f68948fc8e85c84ed57783d',
  'tex/mars.jpg': 'fdca196e3530ca4f2b2247b6ae3ea8c58033834a4070607b89c3219c0871a6e7',
  'tex/mercury.jpg': '4a67d90fa572a353ec67ebe5900674f0b5e4ed98ddbd440ee78fbcadc0c55dfc',
  'tex/moon.jpg': 'e5eec576beb2d29bc1e5fa0c7900bf2df823c61e43653ca750e6b84e814df0de',
  'tex/pluto.jpg': '0fc19dcc6b99fbd3caff84aa60331597d6d522413138fc744199586f2169f911',
  'tex/sun.jpg': '3b1716c9842424f2e9f27044584cae044f16b37fff5a729a5c477b119556fdd1',
  'tex/textures.json': '4859db88fb96846d746bae46098117e0777fad02114e368c5e564a4f76da400a',
  'tex/triton.jpg': '7e8231ffd8bdc11661371b14a82725c66d5fcea591e264272ec306d07aed6d6c',
  'tex/venus.jpg': '362d6931aec1d0cb1bf910c3def40a79817a1dd4d2bf7882acaadc341b981693',
};
const FONTS = {
  'ysabeau-office-gw.woff2': 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262',
  'OFL.txt': 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269',
  'ysabeau-office-milky-way-extra.woff2': 'efdeac3fc405906974460b62b3e3b0c606da4f87c80346b1c7d0c32ca068e42f',
};
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort();
  const want = [...names].sort();
  const same = JSON.stringify(have) === JSON.stringify(want);
  ok(same, `${dir}/ holds exactly its ${want.length} files${same ? '' : `; found ${have.filter((h) => !want.includes(h)).join(', ') || 'none extra'}, missing ${want.filter((x) => !have.includes(x)).join(', ') || 'none'}`}`);
};
exactly('fonts', Object.keys(FONTS));
exactly('data', Object.keys(DATA));
for (const [f, h] of Object.entries(FONTS)) ok(fs.existsSync(path.join(APP, 'fonts', f)) && sha(`fonts/${f}`) === h, `fonts/${f} sha256 ${fs.existsSync(path.join(APP, 'fonts', f)) ? sha(`fonts/${f}`).slice(0, 12) : 'missing'}… is the one ART.md names (${h.slice(0, 12)}…)`);
ok(/Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')), 'fonts/OFL.txt names the face and carries the SIL Open Font License 1.1');
{
  const cr = read('CREDITS.txt');
  // ART.md names the dropped faces only to record their removal
  const dropped = [...web, 'CREDITS.txt', 'NOTES.md', 'miniapp.json'].filter((f) => /Atkinson|Newsreader/.test(read(f)));
  ok(/Ysabeau Office by Christian Thalmann \(Catharsis Fonts\), SIL Open Font License 1\.1; a subset is in fonts\/ with its license\./.test(cr.replace(/\s+/g, ' ')) && !/no font/i.test(cr) && dropped.length === 0,
    `CREDITS.txt credits the face in the house's words; no code, credit or note names a dropped face${dropped.length ? ': ' + dropped.join(', ') : ''} (about.json's blocks written again by the follow-up's rebuild: owner call 8)`);
}
{
  const changed = Object.entries(DATA).filter(([f, h]) => !fs.existsSync(path.join(APP, 'data', f)) || sha(`data/${f}`) !== h).map(([f]) => f);
  const all = crypto.createHash('sha256').update(Object.keys(DATA).sort().map((f) => `${DATA[f]}  data/${f}\n`).join('')).digest('hex');
  ok(changed.length === 0, `the data is the follow-up's rebuild: ${Object.keys(DATA).length} files at the sha256 recorded after it (combined ${all.slice(0, 8)}…${all.slice(-6)})${changed.length ? '; CHANGED: ' + changed.join(', ') : ''}`);
}

// 7. miniapp.json
let mini = null;
try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
if (mini) {
  ok(mini.schemaVersion === 1 && mini.name === 'Milky Way' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && mini.version === '1.1',
  `miniapp.json: "${mini.name}" ${mini.version} (plan 0012 package 3.5's bump from 1.0, HOUSE.md section 13), entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters`);
}

// 8. No AI vendor or model name in shipped text (Global Weather's list, ROT13, copied as it is)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
// A data word that collides with the list is allowed by file and word here, never in the app's own
// strings: none is known today (a scan on 2026-10-01 found the constellation's name in no shipped file).
const ALLOW = {};
const texts = [...shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f) && !f.startsWith('vendor/')), 'ART.md'].filter((f, i, a) => a.indexOf(f) === i && fs.existsSync(path.join(APP, f)));
const named = texts.filter((f) => namesRe.test((ALLOW[f] || []).reduce((t, w) => t.split(rot13(w)).join(''), read(f))));
ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files and ART.md${named.length ? ': ' + named.join(', ') : ''}`);

// 9. The credit line: in About, not on the front (HOUSE.md section 4.15; plan 0012 package 3.5)
const app = read('app.js');
const credits = (app.match(/^const CREDITS = '([^']*)';$/m) || [])[1];
{
  const h = read('index.html'), front = h.slice(0, h.indexOf('<div class="sheet" id="about"'));
  const inAbout = /<h3>Sources and credits<\/h3>\s*<p id="about-credit-line" translate="no"><\/p>\s*<div id="about-sources">/.test(h);
  // nothing on the front names a source: the credit's words, the stamp's old edition, a license
  const named = ['NASA', 'JPL', 'Gaia', 'USGS', 'AT-HYG', 'LVDB', 'galstreams', 'Stellarium', 'DE430', 'retrieved', 'License', 'CC BY'].filter((t) => front.includes(t));
  ok(credits === 'NASA/JPL, USGS, ESA/Gaia/DPAC, AT-HYG, LVDB, galstreams, Stellarium' && /\$\('about-credit-line'\)\.textContent = CREDITS;/.test(app)
    && inAbout && !/id="credits"/.test(h) && !/\$\('credits'\)/.test(app) && !/\.credits\b/.test(read('styles.css')) && named.length === 0
    && !/\$\('stamp'\)\.textContent = `JPL/.test(app) && /\['Edition', `JPL DE430 and Gaia DR3/.test(app),
  `the credit line: CREDITS is "${credits}", written to About's #about-credit-line, first under Sources and credits (${inAbout}); no #credits, no .credits rule; the edition is About's first This data row, not the stamp; no source named on the front before About${named.length ? ': ' + named.join(', ') : ''}`);
}

// 10. The marketing camera's strings and keys
const html = read('index.html');
{
  const caption = /text\('cap', `You are \$\{U\.dist\(dSun\)\} from the Sun;/.test(app) && /function chrome\(dSun\)/.test(app) && /chrome\(dSun\);\n\}/.test(app);
  const before = html.slice(0, html.indexOf('<div class="sheet" id="about"'));
  const scales = [...(html.match(/<nav class="scales"[\s\S]*?<\/nav>/) || [''])[0].matchAll(/<button type="button" data-scale="(\w+)" aria-pressed="false">([^<]+)<\/button>/g)].map((m) => m[2]);
  const keys = ['<button type="button" class="tkey play" id="t-play" aria-label="Play">', 'aria-label="Hide the controls"', 'aria-label="Show the controls" aria-keyshortcuts="Escape"'].every((s) => html.includes(s));
  ok(caption && !/from the Sun/.test(code(before, 'x.html')) && JSON.stringify(scales) === '["Solar System","Neighborhood","Milky Way"]' && keys && /S\.playing \? 'Pause' : 'Play'/.test(app),
    `camera: the caption's "You are … from the Sun" written by the frame loop ${caption ? 'yes' : 'NO'} and in no static text before About; scale buttons ${JSON.stringify(scales)}; Play/Pause, Hide the controls, Show the controls ${keys ? 'present' : 'MISSING'}`);
  const util = read('js/util.js');
  const direct = web.filter((f) => f !== 'js/util.js' && /localStorage/.test(code(read(f), f)));
  const setKeys = [...new Set([...app.matchAll(/store\.(?:get|set)\('(\w+)'/g)].map((m) => m[1]))];
  const today = ['layers', 'speed', 'camera'].every((k) => new RegExp(`store\\.get\\('${k}'`).test(app));
  ok(/const KEY = 'milkyway:';/.test(util) && direct.length === 0 && today && setKeys.every((k) => ['layers', 'speed', 'camera', 'focus'].includes(k)),
    `storage: every key under milkyway: through util.js's store (${setKeys.join(', ')}); today's layers, speed and camera still read; no other localStorage${direct.length ? ': ' + direct.join(', ') : ''}`);
}

// 11. SI notation in what the app writes; toFixed and toLocaleString only where allowed
const appFiles = ['index.html', 'app.js', ...shipped.filter((f) => /^js\/[^/]+\.js$/.test(f))];
{
  const UNIT = /\d (°|%|km|AU|pc|kpc|Mpc|h|d|s|min|years|light-[a-z]+)(?![\w/])/;
  const hits = [];
  for (const f of appFiles) {
    const lits = f.endsWith('.html') ? [code(read(f), f).replace(/<[^>]+>/g, ' ')] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);   // an interpolation counts as a number
  }
  ok(hits.length === 0, `SI: no plain space between a digit and a unit in ${appFiles.length} files' strings${hits.length ? ': ' + hits.join(' | ') : ''}`);
  const ALLOWED = [/translate3d\(\$\{box\[0\]\.toFixed\(1\)\}px, \$\{box\[1\]\.toFixed\(1\)\}px, 0\)/];       // the labels' CSS transform
  const fixedHits = [];
  for (const f of appFiles.filter((x) => x.endsWith('.js') && x !== 'js/units.js')) {
    code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString)\(/.test(l) && !ALLOWED.some((a) => a.test(l))) fixedHits.push(`${f}:${i + 1}`); });
  }
  ok(fixedHits.length === 0, `SI: toFixed/toLocaleString only in js/units.js and ${ALLOWED.length} allow-listed non-text use${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 12. Nothing that carries a step transitions
const css = read('styles.css');
{
  const rules = [...code(css, 'x.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const moving = rules.filter(([, sel, body]) => /\.(valid|lead|track)\b|#slider|#valid|#t-date|#track/.test(sel) && /(transition|animation)\s*:\s*(?!\s|none)/.test(body));
  const none = /\.valid, \.lead, \.track, \.track canvas \{ transition: none; animation: none; \}/.test(css);
  ok(moving.length === 0 && none, `no transition or animation on the track, the time row or the lead${moving.length ? ': ' + moving.map((m) => m[1].trim()).join('; ') : ' (and styles.css says none on them)'}`);
}

// 13. innerHTML: the labels' constant markup and the Layers sheet, every value escaped; nothing new
{
  const uses = [];
  for (const f of web.filter((x) => x.endsWith('.js'))) for (const m of code(read(f), f).matchAll(/\.innerHTML\s*([+]?=)\s*([^;\n]*)/g)) uses.push([f, m[1], m[2].trim()]);
  const known = (u) => (u[0] === 'js/labels.js' && u[2] === "'<i></i><span></span>'") || (u[0] === 'app.js' && /^LAYER_DOC\(\)\.map/.test(u[2]));
  const layers = (app.match(/root\.innerHTML = LAYER_DOC\(\)[\s\S]*?\.join\(''\)\)\.join\(''\);/) || [''])[0];
  const raw = [...layers.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]).filter((v) => !/^escapeHtml\(/.test(v) && v !== "S.layers[k] ? 'checked' : ''");
  ok(uses.length === 2 && uses.every(known) && raw.length === 0 && !/insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(web.map((f) => code(read(f), f)).join('\n')),
    `innerHTML: ${uses.length} uses (stock had 7), the labels' constant and the Layers sheet with every value escaped${raw.length ? '; UNESCAPED: ' + raw.join(', ') : ''}; no insertAdjacentHTML, outerHTML, document.write, eval or new Function`);
}

// 14. The plate's colors are palette.py's, and palette.py's checks pass
{
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8' });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8' });
  let same = false;
  try { same = JSON.stringify(JSON.parse(json.stdout)) === JSON.stringify(PLATE); } catch { /* reported below */ }
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  ok(same, `js/plate.js equals python3 tools/art/palette.py --json (${Object.keys(PLATE).length} keys)`);
  const sig = [...css.matchAll(/--reach: (#[0-9a-f]{6})/g)].map((m) => m[1]);
  ok(sig.join() === `${PLATE.signature.light},${PLATE.signature.dark}` && css.includes(`--plate: ${PLATE.space};`) && css.includes(`--plate-ink: ${PLATE.label};`) && css.includes(`--plate-ink-2: ${PLATE.label2};`),
    `styles.css carries the palette's signature (${sig.join(' / ')}) and plate tokens`);
}

// 15. The tells
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/text-shadow/, 'text-shadow'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/monospace/, 'monospace']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  ok(found.length === 0, `styles.css: no box-shadow, backdrop-filter, text-shadow, transition: all, uppercase, letter-spacing or monospace${found.length ? ': ' + found.join(', ') : ''}`);
  const dots = [];
  for (const f of appFiles.filter((x) => x.endsWith('.js'))) for (const s of strings(read(f))) if (s.includes('·')) dots.push(`${f}: ${s.slice(0, 50)}`);
  if (code(html, 'x.html').replace(/<[^>]+>/g, ' ').includes('·')) dots.push('index.html');
  ok(dots.length === 0, `no middle dot in any string the app writes${dots.length ? ': ' + dots.join(' | ') : ''}`);
  const arrows = [];
  for (const f of web) {
    const src = read(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : code(src, f);
    if (/[→➤]/.test(lit)) arrows.push(f);
    if (/\w\.\.\.(?!\w)|\.\.\.\s/.test(f.endsWith('.html') ? lit.replace(/<[^>]+>/g, ' ') : f.endsWith('.js') ? lit : '')) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤ or "..." in the text the app shows${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const light = c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)'));
  const dark = c.slice(c.indexOf('@media (prefers-color-scheme: dark)'), c.indexOf('* { box-sizing'));
  const tok = (block, name) => (block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  const HOUSE = { page: ['#e8eef0', '#141d21'], sheet: ['#f6f9fa', '#1c272c'], ink: ['#0f1c23', '#e6edee'], 'ink-2': ['#45555d', '#a3b1b6'], 'ink-3': ['#5b6a72', '#8b9a9f'], line: ['#c9d4d8', '#2a373c'], 'line-strong': ['#74858c', '#64757b'] };
  const off = Object.entries(HOUSE).filter(([n, [l, d]]) => tok(light, n) !== l || tok(dark, n) !== d).map(([n]) => n);
  ok(off.length === 0 && /--draw: cubic-bezier\(0\.2, 0, 0, 1\);/.test(c) && /--sheet-in: cubic-bezier\(0\.32, 0\.72, 0, 1\);/.test(c) && /color-scheme: light;/.test(light) && /color-scheme: dark;/.test(dark),
    `the chrome tokens are the house's in both themes${off.length ? '; DIFFER: ' + off.join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === tok(s === 'light' ? light : dark, 'page')), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')}`);
  ok(/@font-face \{\n  font-family: 'Ysabeau Office';\n  src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\n  font-weight: 400 650;\n  font-display: block;\n\}/.test(css)
    && /src: url\(fonts\/ysabeau-office-milky-way-extra\.woff2\) format\('woff2'\);\n  font-weight: 400 650;\n  font-display: block;\n  unicode-range: U\+02BB, U\+03B1-03C9, U\+2074-2079;/.test(css),
  "@font-face: the house rule word for word, and the supplement's with its unicode-range");
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
  const faces = [...c.matchAll(/(?:^|[;{\s])font:\s*([^;]+);/g)].map((m) => m[1]).filter((v) => !/var\(--face\)|inherit/.test(v));
  ok(families.every((f) => f === "'Ysabeau Office'") && faces.length === 0 && /--face: 'Ysabeau Office', system-ui, -apple-system, sans-serif;/.test(c),
    `one family, through --face (${families.length} @font-face family names, ${faces.length} other font stacks)`);
  const scriptFonts = [];
  for (const f of appFiles.filter((x) => x.endsWith('.js'))) for (const s of strings(read(f))) if (/\d+(\.\d+)?px\b/.test(s) && /\b(400|560|600|620|650|bold|normal)\b/.test(s) && /px\s+["']?[A-Za-z$]/.test(s) && !/px\s*\$\{[^}]*\}\s*"Ysabeau Office"|px "Ysabeau Office"|^.\$\{FONTS/.test(s)) scriptFonts.push(`${f}: ${s.slice(0, 50)}`);
  ok(scriptFonts.length === 0, `every font string in a script names "Ysabeau Office" first${scriptFonts.length ? ': ' + scriptFonts.join(' | ') : ''}`);
}

// 16. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
const codeFiles = shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f) && !f.startsWith('vendor/') && !f.startsWith('data/'));
const size = (f) => fs.statSync(path.join(APP, f)).size;
const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
ok(codeBytes <= 242000, `app code ${fmt(codeBytes)} bytes (cap 242,000, the lead's second ruling in tools/DECISIONS.md, 240,000 before it; 223,463 when the pass began; ${fmt(242000 - codeBytes)} to spare): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
ok(fontBytes <= 160000, `fonts/ ${fmt(fontBytes)} bytes (budget 160,000)`);
const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
const zip = path.join(work, 'milky-way.zip'); fs.rmSync(zip, { force: true });
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
ok(zsize <= 8156512, `ZIP size ${fmt(zsize)} bytes (budget 8,156,512: 6,525,210 before the pass, times 1.25)`);

// 17. US spelling in every shipped text file (data/ and CREDITS.txt quote their sources; OFL.txt is upstream)
{
  const BRIT = /\b(judgement|colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|behaviour\w*|recognis\w*|normalis\w*|quantis\w*|licences?|harbour\w*|honour\w*|neighbour\w*|defence|labelled|labelling|towards|grey|favour\w*|catalogue\w*|modelled|for ever)\b/i;
  // the data's own names and keys, which the code must spell as the data does
  const DATA_WORDS = /colour\.json|named\.colour|textures\.colours|quantisation_pc|\['licence', 'License'\]|gal:centre|(?:json|this|small|sb)\.labelled|planetCentre|moonFromCentre|_moonCentre|pixelCentre|jdCentre/g;
  const hits = [];
  for (const f of [...texts, 'ART.md'].filter((x, i, a) => a.indexOf(x) === i && !x.startsWith('data/') && x !== 'CREDITS.txt' && x !== 'fonts/OFL.txt')) {
    read(f).split('\n').forEach((line, i) => {
      // proper names keep their own spelling: the Open Exoplanet Catalogue, ESA's NEO Coordination Centre
      const l = (f.endsWith('.md') ? line.replace(/`[^`]*`/g, '') : line.replace(DATA_WORDS, '')).replace(/Open Exoplanet Catalogue|NEO Coordination Centre/g, '');
      const m = l.match(BRIT);
      if (m) hits.push(`${f}:${i + 1} ${m[0]}`);
    });
  }
  ok(hits.length === 0, `US spelling in the shipped text files outside data/ and CREDITS.txt${hits.length ? ': ' + hits.slice(0, 14).join(', ') + (hits.length > 14 ? ` and ${hits.length - 14} more` : '') : ''}`);
  // data/ is exempt above because it is pipeline output, but About and the card show its prose on
  // screen, so that prose is checked here: US English since the follow-up's rebuild (owner call 15,
  // tools/DECISIONS.md section 9). Proper names keep their spelling (the Open Exoplanet Catalogue, ESA's
  // NEO Coordination Centre and Planetary Defence Office, the colour-science package and a path in it).
  // tools/90_about.py's own blocks are checked too, so the next rebuild cannot bring the old words back.
  const ab = JSON.parse(read('data/about.json'));
  const shownProse = [ab.intro, ...ab.blocks.filter((b) => b.id !== 'reading-sizes' && b.id !== 'software').flatMap((b) => [b.title, b.text, b.source, b.accuracy])]
    .filter(Boolean).join('\n').replace(/Open Exoplanet Catalogue|NEO Coordination Centre|Planetary Defence Office|colour-science|colour\/colorimetry\/\S*/g, '');
  const BRIT_G = new RegExp(BRIT.source, 'gi');
  const britShown = (shownProse.match(BRIT_G) || []).length;
  const aboutPy = fs.readFileSync(path.join(APP, 'tools/90_about.py'), 'utf8');
  const ownBlocks = aboutPy.slice(aboutPy.indexOf('INTRO = ('), aboutPy.indexOf('SOFTWARE = {')).replace(/\{n?_?grey\}/g, '');
  const britPy = (ownBlocks.match(BRIT_G) || []).map((w) => w);
  ok(britPy.length === 0, `tools/90_about.py's own About prose is US English${britPy.length ? ': ' + britPy.join(', ') : ''}`);
  // The card shows data text too (app.js facts() and select()): the maps' and colors' notes, the small
  // bodies' sources and kinds, the galaxy's references and notes, the stars' distance sources and the
  // planet methods. Counted the same way, by file.
  const J = (f) => JSON.parse(read(`data/${f}`)), tex = J('tex/textures.json'), gal = J('galaxy/galaxy.json'), sb = J('smallbodies.json');
  const cardText = {
    'tex/textures.json': [...Object.values(tex.bodies || {}).flatMap((b) => [b.note, b.source_id]), ...Object.values(tex.colours || {}).flatMap((c) => [c.note, c.source])],
    'galaxy/galaxy.json': [...(gal.globulars || []), ...(gal.satellites || [])].map((o) => o.ref)
      .concat((gal.streams || []).flatMap((o) => [o.note, o.ref]), [...(gal.arms_reid2019 || []), ...(gal.arms_drimmel2024 || [])].map((a) => a.note),
        gal.frame.refs || [], [gal.frame.name], gal.model ? [gal.model.what, ...(gal.model.refs || [])] : []),
    'smallbodies.json': [...(sb.sources || []).map((x) => x.label), ...Object.values(sb.kind_labels || {}), ...Object.values(sb.info || {}).flatMap((x) => [x.orbit_ref, x.phys_ref, x.phys_from])],
    'stars/named.json': J('stars/named.json').dist_src_labels || [],
    'stars/exoplanets.json': J('stars/exoplanets.json').methods || [],
  };
  const byFile = Object.entries(cardText).map(([f, list]) => [f, (list.filter((x) => typeof x === 'string').join('\n').replace(/Open Exoplanet Catalogue|NEO Coordination Centre|Planetary Defence Office|colour-science|colour\/colorimetry\/\S*/g, '').match(BRIT_G) || []).length]).filter(([, n]) => n);
  const cardBrit = byFile.reduce((n, [, k]) => n + k, 0);
  ok(britShown === 0 && cardBrit === 0, `US English in the prose the app shows from data/ (owner call 15): ${britShown} British spellings in About (data/about.json) and ${cardBrit} in strings the card can show (${byFile.map(([f, n]) => `${f} ${n}`).join(', ') || 'none'})`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
