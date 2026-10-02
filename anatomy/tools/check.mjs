// Static checks for Anatomy (HOUSE.md section 7.1; step 18 of the pass's change list, in
// tools/DECISIONS.md). Node, no dependencies but python3 for tools/art/palette.py; Global Weather's and
// Norne Reservoir's tools/check.mjs in shape:
//   1. what the ZIP ships stays within Snuggery's limits (count, depth, largest, total, no symlinks);
//   2. no http:// or https:// in any .html, .css or .js the app ships, not even in a comment, outside
//      vendor/, whose five files are pinned byte for byte instead;
//   3. every import / src / href / url( / fetch( and data path is relative, inside the folder, present;
//   4. data/ holds exactly its ten files, fonts/ the house face and OFL.txt, js/ the two modules,
//      vendor/ its five; the face's and OFL.txt's sha256 are the house's; the type credit line is in
//      About, NOTES.md and CREDITS.txt, and the faces this pass removed are gone, the data included;
//   5. the data and vendor/ are untouched: each file's sha256 is its pin (nine data files as recorded
//      before the pass, anatomy.json as the follow-up's data text pass rebuilt it; tools/DECISIONS.md);
//   6. miniapp.json is valid;
//   7. no AI vendor or model name in any shipped text file (the house list, stored ROT13);
//   8. the credit line, word for word, in the CREDIT constant written to #credits; About prints the
//      data's first two source paragraphs verbatim, and the third, which is the app's own rendering and
//      type credit, equals the two lines index.html writes (B13); the second's count of structures both
//      releases share is the measurement file's (tools/source/bodymap_pairs.json);
//   9. the marketing camera's strings (HOUSE 7.4): "Every layer is showing" written only by app.js
//      (never in index.html), the step keys' names built in syncLayerUI(), "Explode amount" a range
//      input, "Show the controls" and "Hide the controls"; every localStorage key under
//      skeleton-viewer:, every key read before the pass still read, focus added;
//  10. SI: no plain space between a digit and a unit in strings the app writes; toFixed and
//      toLocaleString only in js/units.js;
//  11. no transition or animation on the caption line;
//  12. no innerHTML at all (the app held Global Weather's rule before the pass and keeps it), no
//      insertAdjacentHTML, outerHTML, document.write, eval or new Function;
//  13. styles.css's four custom properties equal tools/art/palette.py --json, and palette.py passes;
//  14. the tells: no box-shadow, backdrop-filter, text-shadow, `transition: all`, uppercase,
//      letter-spacing or accent-color; no middle dot, →, ➤ or "..." in what the app writes; both
//      theme-color metas; the @font-face rule word for word; the house's chrome tokens in both themes;
//      one family, no monospace; every size on the house scale (the search field's 16 px the one
//      stated departure); every script font string names "Ysabeau Office" first;
//  15. budgets: app code ≤ 200,000 bytes, fonts/ ≤ 160,000, the ZIP built exactly as build-zips.yml
//      builds it ≤ 30,692,577 (ART.md section 6) with index.html at its top and nothing else in it;
//  16. US spelling in every shipped text file outside data/, and in the data's own text (every string of
//      anatomy.json but the Latin names and the source's own names), which the follow-up's data text
//      pass brought to zero.
//
//   node tools/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };
const EXCLUDE = new Set(['screenshots', 'tools', 'pipeline', 'scripts', 'dist', 'raw']);
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+$)/g, ',');
const read = (f) => fs.readFileSync(path.join(APP, f), 'utf8');
// Source with its comments removed (line and block comments, roughly; HTML comments).
const code = (src, f) => (f.endsWith('.html') ? src.replace(/<!--[\s\S]*?-->/g, '')
  : src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1'));
/** The string literals of a JS source ('…', "…", `…`), roughly. */
const strings = (src) => [...code(src, 'x.js').matchAll(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g)].map((m) => m[0]);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(APP, f))).digest('hex');

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
const web = shipped.filter((f) => /\.(html|css|js)$/.test(f));
const own = web.filter((f) => !f.startsWith('vendor/'));
const withUrls = own.filter((f) => /https?:\/\//i.test(read(f)));
ok(withUrls.length === 0, `no http(s):// in the app's ${own.length} .html/.css/.js files (vendor/ is pinned byte for byte instead, check 5)${withUrls.length ? ': ' + withUrls.join(', ') : ''}`);

// 3. References: relative, inside the folder, present
const app = read('app.js'), html = read('index.html'), css = read('styles.css');
const anat = JSON.parse(read('data/anatomy.json')), geo = JSON.parse(read('data/geometry.json'));
{
  const refs = [];
  for (const f of own) {
    const src = code(read(f), f);
    for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\(\s*)['"]([^'"]+)['"]/g)) refs.push([f, m[1], path.dirname(f)]);
    for (const m of src.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)) refs.push([f, m[1], path.dirname(f)]);
    for (const m of src.matchAll(/(?:\bsrc=|\bhref=|fetch\(|readJSON\()\s*['"]([^'"]+)['"]/g)) refs.push([f, m[1], '.']);
    for (const m of src.matchAll(/['`]\.?\/?((?:data|fonts|vendor)\/[A-Za-z0-9_.-]+\.(?:json|woff2|bin|txt|js))['`]/g)) refs.push([f, m[1], '.']);
  }
  for (const f of geo.files) refs.push(['data/geometry.json', f.url, '.']);
  const bad = refs.filter(([f, r, dir]) => {
    if (r.startsWith('#') || r.startsWith('${')) return false;
    if (/^[a-z][a-z0-9+.-]*:/i.test(r) || r.startsWith('/') || r.split('/').includes('..')) return true;
    const resolved = path.resolve(APP, f.endsWith('.css') ? path.dirname(f) : dir, r);
    return !resolved.startsWith(APP + path.sep) || !fs.existsSync(resolved);
  });
  ok(bad.length === 0 && refs.length > 0, `references: ${refs.length} (imports, src, href, url(), fetch and readJSON, geometry.json's files): ${bad.length ? 'bad or missing: ' + bad.map((b) => `${b[0]} → ${b[1]}`).join('; ') : 'all relative, inside the folder, present'}`);
}

// 4. The folder contract and the face
const exactly = (dir, names) => {
  const have = shipped.filter((f) => f.startsWith(dir + '/')).map((f) => f.slice(dir.length + 1)).sort();
  const want = [...names].sort();
  ok(JSON.stringify(have) === JSON.stringify(want), `${dir}/ holds exactly ${want.join(', ')}${JSON.stringify(have) === JSON.stringify(want) ? '' : `; found ${have.join(', ')}`}`);
};
const DATA = {
  'anatomy.json': '7f1106b79ffe0cea6df4707ce92e7c4584ee61cf3de7d0a90324c577f99c11a2',   // re-pinned by the data text pass
  'geometry-artery.bin': '63070c34eaab70ea7a8406b54c9c4d1fce8a2cf839fd301f686369edeaa6f441',
  'geometry-cartilage.bin': 'cb6274990667c14c5a9193d9e3ddd8d1a91f92fb96899d390d7ca82370bded94',
  'geometry-muscle.bin': '8392bfe8d704c4d1d580db58c473f94fcc89637c1af2b83f78ebb0ce4a6fc393',
  'geometry-nerve.bin': '9a4cb02938b8b701a8db85b95e18684e904169d184a2e83ce7718fbfefc031d9',
  'geometry-organ.bin': '09773374629eba669a7c38033cbf6aa83e8b0fde3b8cfe32c79ff778c72594cd',
  'geometry-skin.bin': '2ab98a2df33507102948c936702ceca30f721ab91b63b42a91dff29c733b7762',
  'geometry-vein.bin': '775a78e2e1e24a512a4ecc38b25bd096edf06a547900a5cc1634153da4ef09df',
  'geometry.bin': 'bfcd6e579e4c4093c8b87cbbb4f6d7617ec7e7386304174f894f06b674023ce7',
  'geometry.json': 'f71878ca9ce8d9d1f01289cb8cc5cae5507ad7e2a0fd1e7cd9efa59921122052',
};
// Snug Kart's tools/check.mjs pins its own vendor/ to this folder's, so these never change by a byte.
const VENDOR = {
  'OrbitControls.js': '30386f7141d5ce5d5e0a3ab643e4eb16265f4564466108105ce449857f62fdda',
  'RoomEnvironment.js': '77d4d2bed2b60cb98424764264aedd84b56bbf3211e0f48430e15608aeded9dc',
  'three-LICENSE.txt': '8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc',
  'three.core.js': '9edde002b066a9a05676a6127f67735b62baf399bdea529f2f7e31657da769e6',
  'three.module.js': '9052042d676cb0fdc1ddfefe193053f34b7ac0513a616fdac4535d49987812ea',
};
exactly('data', Object.keys(DATA));
exactly('fonts', ['ysabeau-office-gw.woff2', 'OFL.txt']);
exactly('js', ['units.js', 'levels.js']);
exactly('vendor', Object.keys(VENDOR));
const TYPE_LINE = 'Ysabeau Office by Christian Thalmann (Catharsis Fonts), SIL Open Font License 1.1; a subset is in fonts/ with its license.';
{
  const FONT_SHA = 'fdf1a28c58fbcc7beb3c98cac4f01d4d1538d03581f1b1dd047a289274cdb262';
  const OFL_SHA = 'd1adfffd83f9e896bcc17e6067c7f57f6824083fdd8d6951acbfca5b29be6269';
  ok(sha('fonts/ysabeau-office-gw.woff2') === FONT_SHA, `fonts/ysabeau-office-gw.woff2 sha256 ${sha('fonts/ysabeau-office-gw.woff2').slice(0, 12)}… is the house's (${FONT_SHA.slice(0, 12)}…)`);
  ok(sha('fonts/OFL.txt') === OFL_SHA && /Ysabeau Office/.test(read('fonts/OFL.txt')) && /SIL Open Font License, Version 1\.1/.test(read('fonts/OFL.txt')),
    `fonts/OFL.txt sha256 ${sha('fonts/OFL.txt').slice(0, 12)}… is the house's (${OFL_SHA.slice(0, 12)}…), names the face and carries the OFL 1.1`);
  const notes = read('NOTES.md'), credits = read('CREDITS.txt');
  ok(notes.includes(TYPE_LINE) && credits.includes(TYPE_LINE) && html.includes(`Type: ${TYPE_LINE}`) && ![notes, credits, html].some((t) => /no font/i.test(t)),
    'the type credit line, word for word, in About (prefixed "Type: "), NOTES.md and CREDITS.txt; none says no font ships');
  const gone = [html, css, app, notes, credits, read('data/anatomy.json'), read('tools/package.json'), read('tools/update_vendor.sh')].filter((t) => /Atkinson|Newsreader|@fontsource|Georgia/.test(t)).length;
  ok(gone === 0, `the faces this pass removed (Atkinson Hyperlegible, Newsreader) are gone from the app, NOTES.md, CREDITS.txt, data/anatomy.json, tools/package.json and tools/update_vendor.sh (${gone} files still name them)`);
}

// 5. The data and vendor/ are untouched (sha256 recorded on 2026-10-01, before the house pass; anatomy.json
//    re-pinned on 2026-10-02, after the data text pass rebuilt it with only its prose changed)
{
  const changed = Object.keys(DATA).filter((f) => sha(`data/${f}`) !== DATA[f]);
  ok(changed.length === 0, `the ten data files are byte-identical to their pins (nine as before the pass, anatomy.json as the data text pass rebuilt it)${changed.length ? ': changed ' + changed.join(', ') : ''}`);
  const vchanged = Object.keys(VENDOR).filter((f) => sha(`vendor/${f}`) !== VENDOR[f]);
  ok(vchanged.length === 0, `vendor/'s five files are byte-identical to the pins (Snug Kart pins its copy to these)${vchanged.length ? ': changed ' + vchanged.join(', ') : ''}`);
}

// 6. miniapp.json
{
  let mini = null;
  try { mini = JSON.parse(read('miniapp.json')); } catch (e) { ok(false, `miniapp.json: ${e.message}`); }
  if (mini) ok(mini.schemaVersion === 1 && mini.name === 'Anatomy' && mini.entryPoint === 'index.html' && fs.existsSync(path.join(APP, mini.entryPoint))
    && typeof mini.description === 'string' && mini.description.length > 0 && mini.description.length <= 200 && typeof mini.version === 'string' && mini.version
    && !/\d,\d{3}/.test(mini.description),
  `miniapp.json: "${mini.name}" ${mini.version}, entry ${mini.entryPoint}, description ${mini.description ? mini.description.length : 0} characters (at most 200), no comma grouping`);
}

// 7. No AI vendor or model name in shipped text (the house list, ROT13, copied from Global Weather's check)
const rot13 = (s) => s.replace(/[a-z]/gi, (c) => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const NAMES_ROT13 = String.raw`bcranv|pung\f?tcg|tcg-?[0-9]|pynhqr|naguebcvp|trzvav|oneq|pbcvybg|yynzn|zvfgeny\f?nv|crecyrkvgl|tebx|qrrcfrrx|zvqwbhearl|qnyy-?r|fgnoyr\f?qvsshfvba|bchf|fbaarg|unvxh|snoyr`;
const namesRe = new RegExp(`\\b(${rot13(NAMES_ROT13).replace(/\\f/g, '\\s')})\\b`, 'i');
const texts = shipped.filter((f) => /\.(html|css|js|json|md|txt)$/.test(f));
{
  const named = texts.filter((f) => namesRe.test(read(f)));
  ok(named.length === 0, `no AI vendor or product name in ${texts.length} shipped text files (ART.md, NOTES.md and the data included)${named.length ? ': ' + named.join(', ') : ''}`);
}

// 8. The credit line, and About's sources
{
  const credit = (app.match(/^const CREDIT = '([^']*)';$/m) || [])[1];
  ok(credit === 'BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP and CC BY 4.0' && /\$\('credits'\)\.textContent = CREDIT;/.test(app),
    `the credit line: CREDIT is "${credit}", written to #credits`);
  const src = (anat.about && anat.about.sources) || [];
  const RENDER = 'Rendering: three.js r186, MIT License (its text is in vendor/three-LICENSE.txt).';
  ok(src.length === 3 && src[2] === `${RENDER} Type: ${TYPE_LINE}` && /\(ab\.sources \|\| \[\]\)\.slice\(0, 2\)\.map\(\(t\) => h\('p', \{ text: t \}\)\)/.test(app)
    && html.includes(`<p>${RENDER}</p>`) && html.includes(`<p>Type: ${TYPE_LINE}</p>`) && /\(ab\.gaps \|\| \[\]\)\.map\(\(t\) => h\('li', \{ text: t \}\)\)/.test(app),
  'About prints the data\'s first two source paragraphs and its gaps verbatim (textContent); the third is the app\'s own rendering and type credit, word for word the two lines index.html writes under them, so it is not printed twice (B13)');
  const shared = new Set(JSON.parse(read('tools/source/bodymap_pairs.json')).map((p) => p[0])).size;
  const said = ((src[1] || '').match(/from the (\d+) structures both releases share/) || [])[1];
  ok(Number(said) === shared, `the data's second source paragraph says the 4.0 structures were placed by a correction measured from ${said} structures; tools/source/bodymap_pairs.json holds ${shared}`);
  ok(/EDITION = 'BodyParts3D 3\.0 and 4\.0'/.test(app) && /BodyParts3D 3\.0/.test(geo.source) && /BodyParts3D 4\.0/.test(geo.source),
    `the stamp's edition "BodyParts3D 3.0 and 4.0" matches geometry.json's source ("${geo.source}")`);
}

// 9. The marketing camera's strings (HOUSE 7.4) and the stored keys
{
  ok(!/Every layer is showing/i.test(html) && /btnAdd\.textContent = la \? `Bring back the \$\{la\.short\.toLowerCase\(\)\}` : 'Every layer is showing';/.test(app)
    && /btnAdd\.setAttribute\('aria-label', la \? `Bring back the \$\{la\.name\.toLowerCase\(\)\} layer` : 'Every layer is showing'\);/.test(app),
  'camera: "Every layer is showing" is the bring-back key\'s name and words when nothing is off, written only by syncLayerUI() once the model is in, never in index.html; its other name is "Bring back the … layer"');
  ok(/btnPeel\.setAttribute\('aria-label', lp \? `Remove the \$\{lp\.name\.toLowerCase\(\)\} layer`/.test(app) && /btnPeel\.textContent = lp \? `Remove the \$\{lp\.short\.toLowerCase\(\)\}`/.test(app)
    && /<button type="button" class="wordkey" id="btn-peel"/.test(html) && /<button type="button" class="wordkey" id="btn-add"/.test(html),
  'camera: the remove key is a <button> named "Remove the … layer" with visible words that begin its name (WCAG 2.5.3); the bring-back key likewise');
  const prefixed = [...(html + strings(app).join('\n')).matchAll(/(?:aria-label="|>|')(Remove the|Bring back the)/g)].length;
  ok(prefixed <= 4, `camera: no other control's name begins "Remove the" or "Bring back the" (${prefixed} places write one, the two keys' words and names)`);
  ok(/<input class="hslider" id="explode" type="range" min="0" max="100" step="1" value="0" aria-label="Explode amount">/.test(html), 'camera: "Explode amount" is a native range input (0 to 100), which the camera sets by taps on its track');
  ok(/<button type="button" class="ghost" id="focus-exit" aria-label="Show the controls" aria-keyshortcuts="Escape" hidden>/.test(html) && /<button type="button" id="focus-key" aria-label="Hide the controls">/.test(html),
    'camera: the ghost key is named exactly "Show the controls" (aria-keyshortcuts Escape); the entry key "Hide the controls"');
  const descs = ['front', 'back', 'left', 'right', 'top'].filter((v) => new RegExp(`<span id="vd-${v}" hidden>`).test(html) && html.includes(`aria-describedby="vd-${v}"`));
  ok(descs.length === 5, `the five view words' descriptions are hidden elements read through aria-describedby, so a swipe never reads them twice (${descs.length} of 5)`);
  const READ = ['explode', 'level', 'layerModes', 'layerPrev', 'hidden', 'isolate', 'ghost', 'camera', 'defaultsApplied'];
  const got = new Set([...app.matchAll(/store\.get\('([A-Za-z]+)'/g)].map((m) => m[1]));
  const direct = [...code(app, 'app.js').matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  ok(/const KEY = 'skeleton-viewer:';/.test(app) && /const FOCUS_KEY = KEY \+ 'focus';/.test(app) && READ.every((k) => got.has(k)) && direct.every((d) => d === 'KEY + k' || d === 'FOCUS_KEY'),
    `storage: every key under skeleton-viewer:, the nine read before the pass still read (${READ.join(', ')}), skeleton-viewer:focus added`);
}

// 10. SI notation in what the app writes; toFixed and toLocaleString only in js/units.js
{
  const UNIT = /\d (m|cm|mm|MB|%|px|bytes)(?![\w/])/;
  const files = ['index.html', 'app.js', 'js/units.js', 'js/levels.js'];
  const hits = [];
  for (const f of files) {
    const lits = f.endsWith('.html') ? [code(read(f), f).replace(/<[^>]+>/g, ' ')] : strings(read(f));
    for (const s of lits) if (UNIT.test(s.replace(/\$\{[^}]*\}/g, '0').replace(/\$\{U\.int\([^}]*\}/g, '0'))) hits.push(`${f}: ${s.slice(0, 60)}`);
  }
  // "holds 9 509 900 bytes" is a count and its noun, as "1 752 structures" is; a plain space is right there
  const real = hits.filter((x) => !/ bytes;/.test(x));
  ok(real.length === 0, `SI: no plain space between a digit and a unit in ${files.length} files' strings${real.length ? ': ' + real.join(' | ') : ''}`);
  const fixedHits = [];
  for (const f of ['app.js', 'js/levels.js']) code(read(f), f).split('\n').forEach((l, i) => { if (/\.(toFixed|toLocaleString)\(/.test(l)) fixedHits.push(`${f}:${i + 1}`); });
  ok(fixedHits.length === 0 && !/en-GB/.test(app), `SI: toFixed and toLocaleString only in js/units.js, no en-GB${fixedHits.length ? ': ' + fixedHits.join(', ') : ''}`);
}

// 11. The caption line never moves
{
  const rules = [...code(css, 'x.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const moving = rules.filter(([, sel, body]) => /\.capline|\.caption\b|\.credits/.test(sel) && /(transition|animation)\s*:/.test(body));
  ok(moving.length === 0 && /\.capline \{ height: 30px; overflow: hidden; \}/.test(css), `no transition or animation on the caption band; the caption line's height fixed at 30 px (15 px from 640 px wide)${moving.length ? ': ' + moving.map((m) => m[1].trim()).join('; ') : ''}`);
}

// 12. No markup from strings
{
  const all = own.filter((f) => f.endsWith('.js')).map((f) => code(read(f), f)).join('\n');
  ok(!/\.innerHTML\b|insertAdjacentHTML|outerHTML\s*=|document\.write|\beval\(|new Function/.test(all),
    'no innerHTML (the rule the app held before the pass), insertAdjacentHTML, outerHTML, document.write, eval or new Function');
}

// 13. The palette: styles.css carries palette.py's four properties, and palette.py passes
{
  const TEMPLATE = path.dirname(APP);
  const run = spawnSync('python3', [path.join(APP, 'tools/art/palette.py')], { encoding: 'utf8', cwd: TEMPLATE });
  const json = spawnSync('python3', [path.join(APP, 'tools/art/palette.py'), '--json'], { encoding: 'utf8', cwd: TEMPLATE });
  ok(run.status === 0 && /ALL CHECKS PASS/.test(run.stdout), `tools/art/palette.py exits ${run.status}: ${(run.stdout.trim().split('\n').pop() || run.stderr.trim()).slice(0, 80)}`);
  let pal = null; try { pal = JSON.parse(json.stdout); } catch { /* reported below */ }
  const c = code(css, 'x.css'), light = c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')), dark = c.slice(c.indexOf('@media (prefers-color-scheme: dark)'));
  const tok = (block, name) => ((block.match(new RegExp(`${name}:\\s*([^;]+);`)) || [])[1] || '').trim().toLowerCase();
  const off = pal ? Object.entries({ light, dark }).flatMap(([th, block]) => Object.entries(pal[th]).filter(([k, v]) => tok(block, k) !== v.toLowerCase()).map(([k]) => `${th} ${k}`)) : ['palette.py --json did not parse'];
  ok(off.length === 0, `styles.css: --plate, --level, --level-halo and --select-halo equal palette.py --json in both themes${off.length ? ': ' + off.join(', ') : ''}`);
}

// 14. The look: the tells, the tokens, the face
{
  const c = code(css, 'x.css');
  const banned = [[/box-shadow/, 'box-shadow'], [/backdrop-filter/, 'backdrop-filter'], [/text-shadow/, 'text-shadow'], [/transition\s*:\s*all/, 'transition: all'], [/text-transform\s*:\s*uppercase/, 'uppercase'], [/font-variant[^;]*small-caps/, 'small capitals'], [/letter-spacing\s*:\s*(?!0\b)/, 'letter-spacing'], [/accent-color/, 'accent-color']];
  const found = banned.filter(([re]) => re.test(c)).map(([, n]) => n);
  // round only for the thumb's disc (HOUSE 3.1)
  for (const [, sel] of c.matchAll(/([^{}]+)\{[^{}]*border-radius:\s*(?:50%|999)[^{}]*\}/g)) if (!/slider-thumb|range-thumb/.test(sel)) found.push(`a round or pill radius on ${sel.trim()}`);
  ok(found.length === 0, `styles.css: no box-shadow, backdrop-filter, text-shadow, transition: all, uppercase, small capitals, letter-spacing, accent-color or pill radius${found.length ? ': ' + found.join(', ') : ''}`);
  const sizes = [...c.matchAll(/([^{}]+)\{[^{}]*?font-size:\s*([\d.]+)px/g)].map((m) => [m[1].trim(), +m[2]]);
  const offScale = sizes.filter(([sel, s]) => ![10.5, 11, 11.5, 12.5, 13.5, 15, 21].includes(s) && !(s === 16 && sel === '#search'));
  const weights = [...c.matchAll(/font-weight:\s*(\d+)/g)].map((m) => +m[1]);
  ok(offScale.length === 0 && weights.every((w) => [400, 560, 600, 620, 650].includes(w)),
    `type: every size on the house scale (${[...new Set(sizes.map((s) => s[1]))].sort((a, b) => a - b).join(', ')} px; the search field's 16 px the stated departure), every weight in the cut (${[...new Set(weights)].sort().join(', ')})${offScale.length ? ': ' + offScale.map((s) => s.join(' ')).join(', ') : ''}`);
  const dots = [], arrows = [];
  for (const f of ['app.js', 'js/units.js', 'js/levels.js']) for (const s of strings(read(f))) if (s.includes('·')) dots.push(`${f}: ${s.slice(0, 50)}`);
  if (code(html, 'index.html').replace(/<[^>]+>/g, ' ').includes('·')) dots.push('index.html');
  ok(dots.length === 0, `no middle dot in any string the app writes${dots.length ? ': ' + dots.join(' | ') : ''}`);
  for (const f of [...own, ...shipped.filter((x) => /\.(md|txt)$/.test(x) && !x.startsWith('fonts/') && !x.startsWith('vendor/'))]) {
    const src = read(f);
    const body = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? code(src, f) : src;
    if (/[→➤]/.test(body)) arrows.push(f);
    const lit = f.endsWith('.js') ? strings(src).join('\n') : f.endsWith('.html') ? code(src, f).replace(/<[^>]+>/g, ' ') : '';
    if (/\w\.\.\.(?!\w)|\.\.\.\s/.test(lit)) arrows.push(`${f} (...)`);
  }
  ok(arrows.length === 0, `no →, ➤ or "..." in the text the app shows or the files it ships${arrows.length ? ': ' + [...new Set(arrows)].join(', ') : ''}`);
  const light = c.slice(c.indexOf(':root {'), c.indexOf('@media (prefers-color-scheme: dark)')), dark = c.slice(c.indexOf('@media (prefers-color-scheme: dark)'));
  const tok = (block, name) => ((block.match(new RegExp(`--${name}:\\s*([^;]+);`)) || [])[1] || '').trim();
  const HOUSE = {
    light: { page: '#e8eef0', sheet: '#f6f9fa', ink: '#0f1c23', 'ink-2': '#45555d', 'ink-3': '#5b6a72', line: '#c9d4d8', 'line-strong': '#74858c' },
    dark: { page: '#141d21', sheet: '#1c272c', ink: '#e6edee', 'ink-2': '#a3b1b6', 'ink-3': '#8b9a9f', line: '#2a373c', 'line-strong': '#64757b' },
  };
  const offT = [];
  for (const [scheme, block] of [['light', light], ['dark', dark]]) for (const [k, v] of Object.entries(HOUSE[scheme])) if (tok(block, k).toLowerCase() !== v) offT.push(`${scheme} --${k} ${tok(block, k)}`);
  ok(offT.length === 0 && tok(light, 'draw') === 'cubic-bezier(0.2, 0, 0, 1)' && tok(light, 'sheet-in') === 'cubic-bezier(0.32, 0.72, 0, 1)' && tok(light, 'face') === "'Ysabeau Office', system-ui, -apple-system, sans-serif"
    && /color-scheme: light;/.test(light) && /color-scheme: dark;/.test(dark) && /html, body \{[^}]*background: var\(--page\)/.test(c),
  `chrome tokens: the house's seven in both themes, --draw, --sheet-in, --face, color-scheme per theme, html and body on --page${offT.length ? ': ' + offT.join(', ') : ''}`);
  const metas = [...html.matchAll(/<meta name="theme-color" content="(#[0-9a-f]{6})" media="\(prefers-color-scheme: (light|dark)\)">/gi)].map((m) => [m[2], m[1].toLowerCase()]);
  ok(metas.length === 2 && metas.every(([s, v]) => v === HOUSE[s].page), `theme-color: ${metas.map(([s, v]) => `${s} ${v}`).join(', ')}`);
  ok(/@font-face\s*\{\s*font-family: 'Ysabeau Office';\s*src: url\(fonts\/ysabeau-office-gw\.woff2\) format\('woff2'\);\s*font-weight: 400 650;\s*font-display: block;\s*\}/.test(css) && (css.match(/@font-face/g) || []).length === 1,
    "@font-face: one rule, 'Ysabeau Office' from fonts/ysabeau-office-gw.woff2, weight 400–650, font-display: block");
  const families = [...c.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim()).filter((f) => f !== "'Ysabeau Office'");
  const fontShorts = [...c.matchAll(/\bfont:\s*([^;]+);/g)].map((m) => m[1]).filter((f) => !/var\(--face\)|inherit/.test(f));
  ok(families.length === 0 && fontShorts.length === 0 && !/monospace|Georgia|(^|[\s,'"])serif\b/i.test(c), `one family: every font through --face, no monospace, no serif${families.length + fontShorts.length ? ': ' + families.concat(fontShorts).join(', ') : ''}`);
  const scriptFonts = [];
  for (const f of ['app.js']) for (const s of strings(read(f))) if (/\d(\.\d)?px\s/.test(s) && /[a-z]/i.test(s.replace(/\d+(\.\d+)?px/, ''))) scriptFonts.push([f, s]);
  ok(scriptFonts.length > 0 && scriptFonts.every(([, s]) => /px "Ysabeau Office"/.test(s)), `script font strings name "Ysabeau Office" first (${scriptFonts.length}: ${scriptFonts.map(([f, s]) => `${f} ${s.slice(0, 50)}`).join(' | ')})`);
  ok(/<html lang="en-US">/.test(html) && /viewport-fit=cover/.test(html) && !/user-scalable|maximum-scale/.test(html) && /<meta name="color-scheme" content="light dark">/.test(html),
    'index.html: lang en-US, viewport-fit=cover without maximum-scale or user-scalable, color-scheme light dark');
  ok(/document\.fonts\.load\('560 10\.5px "Ysabeau Office"'\)/.test(app) && /document\.fonts\.addEventListener\('loadingdone'/.test(app), 'the Levels wait for the face before their first draw, and redraw when it lands');
}

// 15. Budgets, and the ZIP exactly as .github/workflows/build-zips.yml builds it
{
  const codeFiles = shipped.filter((f) => /\.(html|css|js|mjs)$/.test(f) && !f.startsWith('data/') && !f.startsWith('vendor/'));
  const size = (f) => fs.statSync(path.join(APP, f)).size;
  const codeBytes = codeFiles.reduce((n, f) => n + size(f), 0);
  ok(codeBytes <= 200000, `app code ${fmt(codeBytes)} bytes (budget 200,000; 57,615 before the pass): ${codeFiles.map((f) => `${f} ${fmt(size(f))}`).join(', ')}`);
  const fontBytes = shipped.filter((f) => f.startsWith('fonts/')).reduce((n, f) => n + size(f), 0);
  ok(fontBytes <= 160000, `fonts/ ${fmt(fontBytes)} bytes (budget 160,000; 87,680 before the pass)`);
  const work = path.join(APP, 'tools', '.work'); fs.mkdirSync(work, { recursive: true });
  const zip = path.join(work, 'anatomy.zip'); fs.rmSync(zip, { force: true });
  execFileSync('zip', ['-q', '-r', '-X', zip, '.', '-x', '.*', '*/.*', 'screenshots/*', 'tools/*', 'pipeline/*', 'scripts/*', 'dist/*', 'raw/*'], { cwd: APP });
  const listing = execFileSync('unzip', ['-v', zip], { encoding: 'utf8', maxBuffer: 1 << 24 }).trim().split('\n');
  const entries = listing.map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 8 && /^\d+$/.test(p[0]) && /^\d+$/.test(p[2]) && !p[7].endsWith('/'));
  const names = entries.map((p) => p.slice(7).join(' '));
  const stored = (pred) => entries.filter((p) => pred(p[7])).reduce((n, p) => n + Number(p[2]), 0);
  const zsize = fs.statSync(zip).size;
  ok(names.includes('index.html'), `ZIP has index.html at its top (${names.length} files)`);
  ok(names.length === shipped.length && names.every((n) => shipped.includes(n)) && !names.some((f) => /^(tools|screenshots|pipeline|scripts)\//.test(f) || f.split('/').some((p) => p.startsWith('.'))),
    `ZIP holds exactly the ${shipped.length} shipped files: no tools/, screenshots/, pipeline/, scripts/ or dotfiles`);
  console.log(`     stored in the ZIP: data/ ${fmt(stored((n) => n.startsWith('data/')))}, vendor/ ${fmt(stored((n) => n.startsWith('vendor/')))}, fonts/ ${fmt(stored((n) => n.startsWith('fonts/')))}, app code ${fmt(stored((n) => codeFiles.includes(n)))}, *.md ${fmt(stored((n) => n.endsWith('.md') && !n.includes('/')))}, the rest ${fmt(stored((n) => /^(miniapp\.json|CREDITS\.txt)$/.test(n)))}`);
  ok(zsize <= 30692577, `ZIP size ${fmt(zsize)} bytes (budget 30,692,577: 24,554,062 before the pass × 1.25, and no face allowance: an app that swaps its own faces for the house's gets none)`);
}

// 16. US spelling in every shipped text file, the data's own text included
{
  const BRIT = /\b(colour\w*|centre\w*|centred|(?:kilo|milli|centi)?metres?|litres?|fibres?|behaviour\w*|recognis\w*|organis\w*|quantis\w*|optimis\w*|licences?|harbour\w*|honour\w*|neighbour\w*|humour\w*|defence|labelled|labelling|modelled|modelling|remodelled|towards|(?:down|up|out|in|back)wards|grey|favour\w*|catalogue\w*|for ever|visualis\w*|initialis\w*|dequantis\w*|speciali[sz]e\w*|faeces|plough\w*|oesophag\w*)\b/i;
  const hits = [];
  for (const f of texts.filter((x) => !x.startsWith('data/') && x !== 'fonts/OFL.txt' && !x.startsWith('vendor/'))) {
    read(f).split('\n').forEach((line, i) => { const m = line.match(BRIT); if (m) hits.push(`${f}:${i + 1} ${m[0]}`); });
  }
  ok(hits.length === 0, `US spelling in ${texts.filter((x) => !x.startsWith('data/') && x !== 'fonts/OFL.txt' && !x.startsWith('vendor/')).length} shipped text files outside data/ and vendor/${hits.length ? ': ' + hits.slice(0, 12).join(', ') : ''}`);
  // the data's own text: every string value of anatomy.json but the Latin names ("Oesophagus" is the
  // Latin term) and the source's own names (provenance, which Find still searches); "specialize" is the
  // US form the pattern also matches, so only the -ise spelling counts
  const words = {}; let strings = 0;
  (function walk(v, key) {
    if (typeof v === 'string') { if (key === 'latin' || key === 'source') return; strings++; for (const w of v.match(new RegExp(BRIT.source, 'gi')) || []) if (!/^specializ/i.test(w)) words[w.toLowerCase()] = (words[w.toLowerCase()] || 0) + 1; return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, key); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, k);
  })(anat, '');
  const n = Object.values(words).reduce((a, b) => a + b, 0);
  ok(n === 0, `US spelling in the data's own text: ${strings} strings of data/anatomy.json, the Latin names and the source's own names aside, hold ${n} British words${n ? ': ' + Object.entries(words).map(([w, c]) => `${w} ${c}`).join(', ') : ''}`);
}

if (fails.length) { console.log(`\n${fails.length} check(s) failed`); process.exit(1); }
console.log('\nall checks pass');
